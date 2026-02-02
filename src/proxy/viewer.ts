/**
 * Event Viewer Data
 *
 * Manages event data for the local event viewer.
 * Provides a way to inspect captured events during development.
 */

import type { Event } from '../types/sentry';
import type { Session } from '../types/session';

/**
 * Event types that can be viewed.
 */
export type ViewerEventType = 'event' | 'transaction' | 'session' | 'replay';

/**
 * Sentry response information.
 */
export interface SentryResponse {
  /**
   * HTTP status code from Sentry.
   */
  statusCode: number;

  /**
   * Event ID returned by Sentry.
   */
  eventId?: string;

  /**
   * Error message if request failed.
   */
  error?: string;

  /**
   * Time taken for the request in milliseconds.
   */
  duration?: number;
}

/**
 * Data structure for events in the viewer.
 */
export interface EventViewerData {
  /**
   * Unique ID for this viewer entry.
   */
  id: string;

  /**
   * ISO 8601 timestamp when the event was captured.
   */
  timestamp: string;

  /**
   * Type of event.
   */
  type: ViewerEventType;

  /**
   * The actual event data.
   */
  event: Event | Session;

  /**
   * Response from Sentry (if forwarded).
   */
  sentryResponse?: SentryResponse;

  /**
   * Whether this event was only stored locally.
   */
  localOnly: boolean;

  /**
   * Source of the event (e.g., 'captureException', 'captureMessage').
   */
  source?: string;

  /**
   * Tags for filtering.
   */
  tags?: Record<string, string>;

  /**
   * Whether this event was marked as important.
   */
  starred?: boolean;

  /**
   * Notes added by the user.
   */
  notes?: string;
}

/**
 * Filter options for querying events.
 */
export interface ViewerFilter {
  /**
   * Filter by event type.
   */
  type?: ViewerEventType;

  /**
   * Filter by source.
   */
  source?: string;

  /**
   * Filter by local only events.
   */
  localOnly?: boolean;

  /**
   * Filter by starred events.
   */
  starred?: boolean;

  /**
   * Maximum number of events to return.
   */
  limit?: number;

  /**
   * Offset for pagination.
   */
  offset?: number;

  /**
   * Search query for event content.
   */
  search?: string;

  /**
   * Start timestamp for time-based filtering.
   */
  startTime?: string;

  /**
   * End timestamp for time-based filtering.
   */
  endTime?: string;

  /**
   * Filter by tags.
   */
  tags?: Record<string, string>;
}

/**
 * Listener callback type.
 */
export type ViewerListener = (events: EventViewerData[]) => void;

/**
 * Statistics for the event viewer.
 */
export interface ViewerStats {
  /**
   * Total number of events.
   */
  total: number;

  /**
   * Count by event type.
   */
  byType: Record<ViewerEventType, number>;

  /**
   * Count of local only events.
   */
  localOnly: number;

  /**
   * Count of forwarded events.
   */
  forwarded: number;

  /**
   * Count of failed forwards.
   */
  failed: number;

  /**
   * Count of starred events.
   */
  starred: number;

  /**
   * Oldest event timestamp.
   */
  oldest?: string;

  /**
   * Newest event timestamp.
   */
  newest?: string;
}

/**
 * Event viewer for inspecting captured events.
 */
export class EventViewer {
  private events: EventViewerData[] = [];
  private maxEvents: number;
  private listeners: Set<ViewerListener> = new Set();

  constructor(maxEvents: number = 100) {
    this.maxEvents = maxEvents;
  }

  /**
   * Add an event to the viewer.
   *
   * @param data - Event data (without id and timestamp)
   * @returns The created viewer entry
   */
  addEvent(
    data: Omit<EventViewerData, 'id' | 'timestamp'>
  ): EventViewerData {
    const entry: EventViewerData = {
      id: generateId(),
      timestamp: new Date().toISOString(),
      ...data,
    };

    this.events.unshift(entry);

    // Trim to max events
    if (this.events.length > this.maxEvents) {
      this.events = this.events.slice(0, this.maxEvents);
    }

    // Notify listeners
    this.notifyListeners();

    return entry;
  }

  /**
   * Get events with optional filtering.
   *
   * @param filter - Filter options
   * @returns Filtered events
   */
  getEvents(filter?: ViewerFilter): EventViewerData[] {
    let result = [...this.events];

    if (filter) {
      // Filter by type
      if (filter.type) {
        result = result.filter(e => e.type === filter.type);
      }

      // Filter by source
      if (filter.source) {
        result = result.filter(e => e.source === filter.source);
      }

      // Filter by local only
      if (filter.localOnly !== undefined) {
        result = result.filter(e => e.localOnly === filter.localOnly);
      }

      // Filter by starred
      if (filter.starred !== undefined) {
        result = result.filter(e => e.starred === filter.starred);
      }

      // Filter by time range
      if (filter.startTime) {
        result = result.filter(e => e.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        result = result.filter(e => e.timestamp <= filter.endTime!);
      }

      // Filter by tags
      if (filter.tags) {
        result = result.filter(e => {
          if (!e.tags) return false;
          for (const [key, value] of Object.entries(filter.tags!)) {
            if (e.tags[key] !== value) return false;
          }
          return true;
        });
      }

      // Search
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        result = result.filter(e => {
          const eventJson = JSON.stringify(e.event).toLowerCase();
          return eventJson.includes(searchLower);
        });
      }

      // Pagination
      if (filter.offset) {
        result = result.slice(filter.offset);
      }

      if (filter.limit) {
        result = result.slice(0, filter.limit);
      }
    }

    return result;
  }

  /**
   * Get a single event by ID.
   *
   * @param id - Event ID
   * @returns Event or undefined
   */
  getEventById(id: string): EventViewerData | undefined {
    return this.events.find(e => e.id === id);
  }

  /**
   * Update an event.
   *
   * @param id - Event ID
   * @param updates - Updates to apply
   * @returns Updated event or undefined
   */
  updateEvent(
    id: string,
    updates: Partial<Pick<EventViewerData, 'starred' | 'notes' | 'sentryResponse'>>
  ): EventViewerData | undefined {
    const event = this.events.find(e => e.id === id);

    if (event) {
      Object.assign(event, updates);
      this.notifyListeners();
    }

    return event;
  }

  /**
   * Delete an event.
   *
   * @param id - Event ID
   * @returns True if deleted
   */
  deleteEvent(id: string): boolean {
    const index = this.events.findIndex(e => e.id === id);

    if (index !== -1) {
      this.events.splice(index, 1);
      this.notifyListeners();
      return true;
    }

    return false;
  }

  /**
   * Subscribe to event changes.
   *
   * @param listener - Callback function
   * @returns Unsubscribe function
   */
  subscribe(listener: ViewerListener): () => void {
    this.listeners.add(listener);

    // Send initial events
    listener(this.events);

    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Clear all events.
   */
  clear(): void {
    this.events = [];
    this.notifyListeners();
  }

  /**
   * Get statistics about stored events.
   */
  getStats(): ViewerStats {
    const stats: ViewerStats = {
      total: this.events.length,
      byType: {
        event: 0,
        transaction: 0,
        session: 0,
        replay: 0,
      },
      localOnly: 0,
      forwarded: 0,
      failed: 0,
      starred: 0,
    };

    for (const event of this.events) {
      stats.byType[event.type]++;

      if (event.localOnly) {
        stats.localOnly++;
      } else {
        stats.forwarded++;
      }

      if (event.sentryResponse?.error) {
        stats.failed++;
      }

      if (event.starred) {
        stats.starred++;
      }
    }

    if (this.events.length > 0) {
      stats.newest = this.events[0].timestamp;
      stats.oldest = this.events[this.events.length - 1].timestamp;
    }

    return stats;
  }

  /**
   * Export events as JSON.
   *
   * @param filter - Filter options
   * @returns JSON string
   */
  exportAsJson(filter?: ViewerFilter): string {
    const events = this.getEvents(filter);
    return JSON.stringify(events, null, 2);
  }

  /**
   * Import events from JSON.
   *
   * @param json - JSON string
   * @returns Number of imported events
   */
  importFromJson(json: string): number {
    try {
      const data = JSON.parse(json);

      if (!Array.isArray(data)) {
        throw new Error('Invalid import data: expected array');
      }

      let imported = 0;

      for (const item of data) {
        if (isValidViewerData(item)) {
          this.events.push(item);
          imported++;
        }
      }

      // Sort by timestamp (newest first)
      this.events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

      // Trim to max events
      if (this.events.length > this.maxEvents) {
        this.events = this.events.slice(0, this.maxEvents);
      }

      this.notifyListeners();

      return imported;
    } catch {
      throw new Error('Failed to import events: invalid JSON');
    }
  }

  /**
   * Set the maximum number of events.
   *
   * @param max - Maximum events
   */
  setMaxEvents(max: number): void {
    this.maxEvents = max;

    if (this.events.length > max) {
      this.events = this.events.slice(0, max);
      this.notifyListeners();
    }
  }

  /**
   * Get the maximum number of events.
   */
  getMaxEvents(): number {
    return this.maxEvents;
  }

  /**
   * Get the current event count.
   */
  getEventCount(): number {
    return this.events.length;
  }

  /**
   * Notify all listeners of changes.
   */
  private notifyListeners(): void {
    for (const listener of this.listeners) {
      try {
        listener([...this.events]);
      } catch (error) {
        console.error('[EventViewer] Listener error:', error);
      }
    }
  }
}

/**
 * Generate a unique ID.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

/**
 * Validate viewer data structure.
 */
function isValidViewerData(data: unknown): data is EventViewerData {
  if (!data || typeof data !== 'object') return false;

  const d = data as Record<string, unknown>;

  return (
    typeof d.id === 'string' &&
    typeof d.timestamp === 'string' &&
    typeof d.type === 'string' &&
    ['event', 'transaction', 'session', 'replay'].includes(d.type as string) &&
    typeof d.event === 'object' &&
    typeof d.localOnly === 'boolean'
  );
}

/**
 * Create a singleton event viewer instance.
 */
let globalViewer: EventViewer | null = null;

/**
 * Get the global event viewer instance.
 *
 * @param maxEvents - Maximum events (only used on first call)
 * @returns Event viewer instance
 */
export function getEventViewer(maxEvents?: number): EventViewer {
  if (!globalViewer) {
    globalViewer = new EventViewer(maxEvents || 100);
  }
  return globalViewer;
}

/**
 * Reset the global event viewer.
 * Useful for testing.
 */
export function resetEventViewer(): void {
  globalViewer = null;
}
