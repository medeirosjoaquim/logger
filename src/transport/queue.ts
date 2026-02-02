/**
 * Event Queue
 *
 * Queues events for batch sending with priority ordering.
 * Errors are sent with highest priority, followed by transactions.
 */

import type { Event } from '../types/sentry.js';
import type { Transport, TransportRequest, QueuedEvent, EventQueueOptions } from './types.js';
import { createEventEnvelope, serializeEnvelope } from './envelope.js';
import type { Dsn } from './envelope.js';

/**
 * Priority levels for events
 */
export enum EventPriority {
  /** Highest priority - errors and crashes */
  ERROR = 0,
  /** High priority - transactions */
  TRANSACTION = 1,
  /** Normal priority - sessions and other events */
  NORMAL = 2,
  /** Low priority - client reports and internal events */
  LOW = 3,
}

/**
 * Default configuration values
 */
const DEFAULT_MAX_SIZE = 100;
const DEFAULT_FLUSH_INTERVAL = 5000;
const DEFAULT_FLUSH_TIMEOUT = 30000;

/**
 * EventQueue class for managing event batching and sending
 */
export class EventQueue {
  private queue: QueuedEvent[] = [];
  private transport: Transport;
  private dsn: Dsn;
  private maxSize: number;
  private flushInterval: number;
  private flushTimeout: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private flushing: boolean = false;
  private droppedEvents: Map<string, number> = new Map();

  constructor(transport: Transport, dsn: Dsn, options: EventQueueOptions = {}) {
    this.transport = transport;
    this.dsn = dsn;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.flushInterval = options.flushInterval ?? DEFAULT_FLUSH_INTERVAL;
    this.flushTimeout = options.flushTimeout ?? DEFAULT_FLUSH_TIMEOUT;

    if (options.autoStart !== false) {
      this.start();
    }
  }

  /**
   * Get the current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Check if the queue is empty
   */
  isEmpty(): boolean {
    return this.queue.length === 0;
  }

  /**
   * Add an event to the queue
   */
  add(event: Event, priority?: EventPriority): void {
    // Determine priority based on event type if not provided
    const eventPriority = priority ?? this.getEventPriority(event);

    const queuedEvent: QueuedEvent = {
      event,
      priority: eventPriority,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Insert in priority order
    this.insertByPriority(queuedEvent);

    // Enforce max size (remove lowest priority items)
    while (this.queue.length > this.maxSize) {
      const removed = this.queue.pop();
      if (removed) {
        this.recordDropped(removed.event, 'queue_overflow');
      }
    }
  }

  /**
   * Flush all queued events
   */
  async flush(): Promise<void> {
    if (this.flushing || this.queue.length === 0) {
      return;
    }

    this.flushing = true;

    try {
      // Get all events to send
      const eventsToSend = [...this.queue];
      this.queue = [];

      // Send events one by one (could be batched in future)
      for (const queuedEvent of eventsToSend) {
        try {
          const envelope = createEventEnvelope(queuedEvent.event, this.dsn);
          const serialized = serializeEnvelope(envelope);
          const request: TransportRequest = { body: serialized };

          const response = await Promise.race([
            this.transport.send(request),
            this.createTimeout(),
          ]);

          // If failed, re-queue with incremented retry count
          if (!this.isSuccessResponse(response)) {
            queuedEvent.retryCount++;
            if (queuedEvent.retryCount < 3) {
              this.insertByPriority(queuedEvent);
            } else {
              this.recordDropped(queuedEvent.event, 'network_error');
            }
          }
        } catch {
          // Re-queue on error
          queuedEvent.retryCount++;
          if (queuedEvent.retryCount < 3) {
            this.insertByPriority(queuedEvent);
          } else {
            this.recordDropped(queuedEvent.event, 'network_error');
          }
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Start the periodic flush timer
   */
  start(): void {
    if (this.timer) {
      return;
    }

    this.timer = setInterval(() => {
      this.flush().catch(() => {
        // Ignore flush errors
      });
    }, this.flushInterval);

    // Unref the timer in Node.js to allow process exit
    if (typeof this.timer === 'object' && 'unref' in this.timer) {
      (this.timer as NodeJS.Timeout).unref();
    }
  }

  /**
   * Stop the periodic flush timer
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  /**
   * Clear the queue without sending
   */
  clear(): void {
    for (const queuedEvent of this.queue) {
      this.recordDropped(queuedEvent.event, 'queue_overflow');
    }
    this.queue = [];
  }

  /**
   * Get dropped event counts
   */
  getDroppedCounts(): Map<string, number> {
    return new Map(this.droppedEvents);
  }

  /**
   * Clear dropped event counts
   */
  clearDroppedCounts(): void {
    this.droppedEvents.clear();
  }

  /**
   * Determine priority based on event type
   */
  private getEventPriority(event: Event): EventPriority {
    // Errors have highest priority
    if (event.exception?.values?.length || event.level === 'fatal' || event.level === 'error') {
      return EventPriority.ERROR;
    }

    // Transactions have high priority
    if (event.type === 'transaction') {
      return EventPriority.TRANSACTION;
    }

    // Feedback has normal priority
    if (event.type === 'feedback') {
      return EventPriority.NORMAL;
    }

    // Default to normal priority
    return EventPriority.NORMAL;
  }

  /**
   * Insert event maintaining priority order (lower number = higher priority)
   */
  private insertByPriority(event: QueuedEvent): void {
    // Find insertion point
    let insertIndex = this.queue.length;
    for (let i = 0; i < this.queue.length; i++) {
      if (event.priority < this.queue[i].priority) {
        insertIndex = i;
        break;
      }
    }

    // Insert at the found position
    this.queue.splice(insertIndex, 0, event);
  }

  /**
   * Check if response indicates success
   */
  private isSuccessResponse(response: unknown): boolean {
    if (!response || typeof response !== 'object') {
      return false;
    }
    const { statusCode } = response as { statusCode?: number };
    return statusCode !== undefined && statusCode >= 200 && statusCode < 300;
  }

  /**
   * Create a timeout promise
   */
  private createTimeout(): Promise<{ statusCode: 0; reason: string }> {
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve({ statusCode: 0, reason: 'Timeout' });
      }, this.flushTimeout);
    });
  }

  /**
   * Record a dropped event
   */
  private recordDropped(event: Event, reason: string): void {
    const category = event.type === 'transaction' ? 'transaction' : 'error';
    const key = `${reason}:${category}`;
    const current = this.droppedEvents.get(key) || 0;
    this.droppedEvents.set(key, current + 1);
  }
}

/**
 * Create a new event queue
 */
export function createEventQueue(
  transport: Transport,
  dsn: Dsn,
  options?: EventQueueOptions
): EventQueue {
  return new EventQueue(transport, dsn, options);
}
