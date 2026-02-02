/**
 * Event Capture API
 *
 * Provides functions to capture raw events.
 */

import type {
  Event,
  EventHint,
  SeverityLevel,
} from '../../types/sentry';
import type { ScopeData } from '../../types/scope';
import { generateFingerprint } from './fingerprint';
import { applyScopeToEvent } from './exception';

/**
 * Generate a UUID v4 without dashes (Sentry event ID format)
 */
function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Capture a raw event and return the event ID
 *
 * This function validates the event structure and adds any missing
 * required fields before processing.
 *
 * @param event - The event to capture
 * @param hint - Optional hint data for event processors
 * @returns The event ID
 */
export function captureEvent(
  event: Event,
  hint?: EventHint
): { eventId: string; event: Event } {
  // Clone the event to avoid mutation
  const processedEvent: Event = { ...event };

  // Add event_id if not present
  if (!processedEvent.event_id) {
    processedEvent.event_id = generateEventId();
  }

  // Add timestamp if not present
  if (!processedEvent.timestamp) {
    processedEvent.timestamp = Date.now() / 1000;
  }

  // Add platform if not present
  if (!processedEvent.platform) {
    processedEvent.platform = 'javascript';
  }

  // Validate and normalize the event
  validateEvent(processedEvent);

  // Generate fingerprint if not present
  if (!processedEvent.fingerprint || processedEvent.fingerprint.length === 0) {
    processedEvent.fingerprint = generateFingerprint(processedEvent);
  }

  return { eventId: processedEvent.event_id, event: processedEvent };
}

/**
 * Capture an event with scope data applied
 *
 * @param event - The event to capture
 * @param scope - The scope data to apply
 * @param hint - Optional hint data
 * @returns The event ID and processed event
 */
export function captureEventWithScope(
  event: Event,
  scope: ScopeData,
  hint?: EventHint
): { eventId: string; event: Event } {
  // First capture the event normally
  const { eventId, event: baseEvent } = captureEvent(event, hint);

  // Then apply scope data
  const finalEvent = applyScopeToEvent(baseEvent, scope);

  // Regenerate fingerprint after scope application
  if (!event.fingerprint || event.fingerprint.length === 0) {
    finalEvent.fingerprint = generateFingerprint(finalEvent);
  }

  return { eventId, event: finalEvent };
}

/**
 * Validate an event structure
 *
 * This function checks for common issues and fixes them where possible.
 */
function validateEvent(event: Event): void {
  // Validate event_id format (32 hex characters)
  if (event.event_id && !/^[a-f0-9]{32}$/.test(event.event_id)) {
    // If it looks like a UUID with dashes, remove them
    if (/^[a-f0-9-]{36}$/.test(event.event_id)) {
      event.event_id = event.event_id.replace(/-/g, '');
    } else {
      // Generate a new valid ID
      event.event_id = generateEventId();
    }
  }

  // Validate timestamp
  if (event.timestamp !== undefined) {
    if (typeof event.timestamp === 'string') {
      // Convert ISO string to Unix timestamp
      const date = new Date(event.timestamp);
      if (!isNaN(date.getTime())) {
        event.timestamp = date.getTime() / 1000;
      } else {
        event.timestamp = Date.now() / 1000;
      }
    } else if (typeof event.timestamp === 'number') {
      // Normalize to seconds if it looks like milliseconds
      if (event.timestamp > 10000000000) {
        event.timestamp = event.timestamp / 1000;
      }
    }
  }

  // Validate level
  const validLevels: SeverityLevel[] = [
    'fatal',
    'error',
    'warning',
    'log',
    'info',
    'debug',
  ];
  if (event.level && !validLevels.includes(event.level)) {
    event.level = 'error';
  }

  // Ensure exception values is an array
  if (event.exception && !Array.isArray(event.exception.values)) {
    if (event.exception.values) {
      event.exception.values = [event.exception.values as any];
    } else {
      delete event.exception;
    }
  }

  // Ensure breadcrumbs is an array
  if (event.breadcrumbs && !Array.isArray(event.breadcrumbs)) {
    event.breadcrumbs = [];
  }

  // Ensure fingerprint is an array
  if (event.fingerprint && !Array.isArray(event.fingerprint)) {
    event.fingerprint = [String(event.fingerprint)];
  }

  // Validate tags
  if (event.tags) {
    const validatedTags: Record<string, string | number | boolean | bigint | symbol | null | undefined> = {};
    for (const [key, value] of Object.entries(event.tags)) {
      // Skip invalid keys
      if (typeof key !== 'string' || key.length === 0 || key.length > 32) {
        continue;
      }
      // Convert values to primitives
      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        validatedTags[key] = value;
      } else if (value !== null && value !== undefined) {
        validatedTags[key] = String(value);
      }
    }
    event.tags = validatedTags;
  }
}

/**
 * Check if an event has an exception
 */
export function eventHasException(event: Event): boolean {
  return !!(
    event.exception &&
    event.exception.values &&
    event.exception.values.length > 0
  );
}

/**
 * Check if an event has a message
 */
export function eventHasMessage(event: Event): boolean {
  if (!event.message) {
    return false;
  }

  if (typeof event.message === 'string') {
    return event.message.length > 0;
  }

  return !!(event.message.formatted || event.message.message);
}

/**
 * Get the event type based on its contents
 */
export function getEventType(event: Event): 'error' | 'message' | 'transaction' | 'unknown' {
  if (event.type === 'transaction') {
    return 'transaction';
  }

  if (eventHasException(event)) {
    return 'error';
  }

  if (eventHasMessage(event)) {
    return 'message';
  }

  return 'unknown';
}

/**
 * Create a minimal error event
 */
export function createErrorEvent(
  message: string,
  type = 'Error'
): Event {
  const eventId = generateEventId();

  return {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    exception: {
      values: [
        {
          type,
          value: message,
          mechanism: {
            type: 'generic',
            handled: true,
          },
        },
      ],
    },
  };
}

/**
 * Create a minimal message event
 */
export function createMessageEvent(
  message: string,
  level: SeverityLevel = 'info'
): Event {
  const eventId = generateEventId();

  return {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level,
    message: {
      formatted: message,
      message,
    },
  };
}

/**
 * Merge two events, with the second taking precedence
 */
export function mergeEvents(base: Event, override: Partial<Event>): Event {
  const merged: Event = { ...base };

  // Merge simple properties
  const simpleProps: (keyof Event)[] = [
    'event_id',
    'timestamp',
    'platform',
    'level',
    'logger',
    'server_name',
    'release',
    'dist',
    'environment',
    'transaction',
    'type',
    'start_timestamp',
  ];

  for (const prop of simpleProps) {
    if (override[prop] !== undefined) {
      (merged as any)[prop] = override[prop];
    }
  }

  // Merge user
  if (override.user) {
    merged.user = { ...merged.user, ...override.user };
  }

  // Merge tags
  if (override.tags) {
    merged.tags = { ...merged.tags, ...override.tags };
  }

  // Merge extra
  if (override.extra) {
    merged.extra = { ...merged.extra, ...override.extra };
  }

  // Merge contexts
  if (override.contexts) {
    merged.contexts = { ...merged.contexts, ...override.contexts };
  }

  // Merge fingerprint (override replaces)
  if (override.fingerprint && override.fingerprint.length > 0) {
    merged.fingerprint = override.fingerprint;
  }

  // Merge message
  if (override.message) {
    merged.message = override.message;
  }

  // Merge exception
  if (override.exception) {
    merged.exception = override.exception;
  }

  // Merge breadcrumbs (concatenate, with override coming later)
  if (override.breadcrumbs && override.breadcrumbs.length > 0) {
    merged.breadcrumbs = [
      ...(merged.breadcrumbs || []),
      ...override.breadcrumbs,
    ];
  }

  // Merge SDK info
  if (override.sdk) {
    merged.sdk = { ...merged.sdk, ...override.sdk };
  }

  // Merge request
  if (override.request) {
    merged.request = { ...merged.request, ...override.request };
  }

  return merged;
}

/**
 * Prepare an event for sending
 *
 * This performs final validation and cleanup.
 */
export function prepareEventForSending(event: Event): Event {
  const prepared: Event = { ...event };

  // Ensure required fields
  if (!prepared.event_id) {
    prepared.event_id = generateEventId();
  }

  if (!prepared.timestamp) {
    prepared.timestamp = Date.now() / 1000;
  }

  if (!prepared.platform) {
    prepared.platform = 'javascript';
  }

  // Remove undefined values from tags
  if (prepared.tags) {
    const cleanTags: Record<string, string | number | boolean | bigint | symbol | null | undefined> = {};
    for (const [key, value] of Object.entries(prepared.tags)) {
      if (value !== undefined) {
        cleanTags[key] = value;
      }
    }
    prepared.tags = cleanTags;
  }

  // Remove undefined values from extra
  if (prepared.extra) {
    const cleanExtra: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(prepared.extra)) {
      if (value !== undefined) {
        cleanExtra[key] = value;
      }
    }
    prepared.extra = cleanExtra;
  }

  // Ensure fingerprint is set
  if (!prepared.fingerprint || prepared.fingerprint.length === 0) {
    prepared.fingerprint = generateFingerprint(prepared);
  }

  return prepared;
}
