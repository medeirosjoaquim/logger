/**
 * Sentry Envelope Handling
 *
 * Creates and parses Sentry envelopes for transport.
 * Envelopes are the container format for sending events to Sentry.
 */

import type { Event, SdkInfo } from '../types/sentry';
import type { Session } from '../types/session';
import type { Dsn } from '../config/dsn';
import type { DynamicSamplingContext } from '../types/scope';

/**
 * Envelope header structure.
 */
export interface EnvelopeHeader {
  /**
   * Event ID for correlation.
   */
  event_id?: string;

  /**
   * ISO 8601 timestamp when the envelope was created.
   */
  sent_at: string;

  /**
   * DSN for routing.
   */
  dsn?: string;

  /**
   * SDK information.
   */
  sdk?: SdkInfo;

  /**
   * Dynamic sampling context for trace-based routing.
   */
  trace?: DynamicSamplingContext;
}

/**
 * Item header for individual envelope items.
 */
export interface ItemHeader {
  /**
   * Type of the item.
   */
  type: 'event' | 'session' | 'transaction' | 'attachment' | 'client_report' | 'user_report' | 'profile' | 'replay_event' | 'replay_recording' | 'check_in' | 'feedback' | 'span' | 'sessions';

  /**
   * Length of the payload in bytes.
   */
  length?: number;

  /**
   * Content type of the payload.
   */
  content_type?: string;

  /**
   * Filename for attachments.
   */
  filename?: string;

  /**
   * Attachment type.
   */
  attachment_type?: string;
}

/**
 * Create a Sentry envelope for an event.
 *
 * @param event - The event to create an envelope for
 * @param dsn - The DSN for routing
 * @param sdkInfo - SDK information
 * @returns Serialized envelope string
 *
 * @example
 * ```typescript
 * const envelope = createSentryEnvelope(event, dsn);
 * // Returns a newline-delimited string:
 * // {"event_id":"...","sent_at":"...","dsn":"..."}
 * // {"type":"event","length":123}
 * // {"message":"Hello world",...}
 * ```
 */
export function createSentryEnvelope(
  event: Event,
  dsn: Dsn,
  sdkInfo?: SdkInfo
): string {
  const eventId = event.event_id || generateEventId();
  const sentAt = new Date().toISOString();

  // Create envelope header
  const envelopeHeader: EnvelopeHeader = {
    event_id: eventId,
    sent_at: sentAt,
    dsn: dsnToString(dsn),
  };

  if (sdkInfo) {
    envelopeHeader.sdk = sdkInfo;
  }

  // Add trace context if available
  if (event.contexts?.trace) {
    const traceContext = event.contexts.trace;
    envelopeHeader.trace = {
      trace_id: traceContext.trace_id as string,
      public_key: dsn.publicKey,
      environment: event.environment,
      release: event.release,
    };
  }

  // Determine item type
  const itemType = event.type === 'transaction' ? 'transaction' : 'event';

  // Serialize event
  const eventJson = JSON.stringify(event);

  // Create item header
  const itemHeader: ItemHeader = {
    type: itemType,
    length: new TextEncoder().encode(eventJson).length,
  };

  // Combine into envelope
  const parts = [
    JSON.stringify(envelopeHeader),
    JSON.stringify(itemHeader),
    eventJson,
  ];

  return parts.join('\n');
}

/**
 * Create a Sentry envelope for a session.
 *
 * @param session - The session to create an envelope for
 * @param dsn - The DSN for routing
 * @returns Serialized envelope string
 */
export function createSessionEnvelope(
  session: Session,
  dsn: Dsn
): string {
  const sentAt = new Date().toISOString();

  // Create envelope header
  const envelopeHeader: EnvelopeHeader = {
    sent_at: sentAt,
    dsn: dsnToString(dsn),
  };

  // Serialize session
  const sessionJson = JSON.stringify({
    sid: session.sid,
    did: session.did,
    init: session.init,
    started: typeof session.started === 'number'
      ? new Date(session.started * 1000).toISOString()
      : session.started,
    timestamp: typeof session.timestamp === 'number'
      ? new Date(session.timestamp * 1000).toISOString()
      : new Date().toISOString(),
    status: session.status || 'ok',
    errors: session.errors || 0,
    duration: session.duration,
    attrs: session.attrs,
  });

  // Create item header
  const itemHeader: ItemHeader = {
    type: 'session',
    length: new TextEncoder().encode(sessionJson).length,
  };

  // Combine into envelope
  const parts = [
    JSON.stringify(envelopeHeader),
    JSON.stringify(itemHeader),
    sessionJson,
  ];

  return parts.join('\n');
}

/**
 * Create a Sentry envelope from multiple items.
 *
 * @param items - Array of items to include in the envelope
 * @param dsn - The DSN for routing
 * @param sdkInfo - SDK information
 * @returns Serialized envelope string
 */
export function createMultiItemEnvelope(
  items: Array<{ type: ItemHeader['type']; data: unknown }>,
  dsn: Dsn,
  sdkInfo?: SdkInfo
): string {
  const sentAt = new Date().toISOString();

  // Create envelope header
  const envelopeHeader: EnvelopeHeader = {
    sent_at: sentAt,
    dsn: dsnToString(dsn),
  };

  if (sdkInfo) {
    envelopeHeader.sdk = sdkInfo;
  }

  const parts: string[] = [JSON.stringify(envelopeHeader)];

  for (const item of items) {
    const itemJson = JSON.stringify(item.data);
    const itemHeader: ItemHeader = {
      type: item.type,
      length: new TextEncoder().encode(itemJson).length,
    };

    parts.push(JSON.stringify(itemHeader));
    parts.push(itemJson);
  }

  return parts.join('\n');
}

/**
 * Parse a Sentry envelope string into its components.
 *
 * @param envelope - The envelope string to parse
 * @returns Parsed envelope components
 */
export function parseEnvelope(envelope: string): {
  header: EnvelopeHeader;
  items: Array<{ header: ItemHeader; payload: unknown }>;
} {
  const lines = envelope.split('\n');

  if (lines.length < 3) {
    throw new Error('Invalid envelope: must have at least 3 lines');
  }

  const header = JSON.parse(lines[0]) as EnvelopeHeader;
  const items: Array<{ header: ItemHeader; payload: unknown }> = [];

  let i = 1;
  while (i < lines.length) {
    if (!lines[i]) {
      i++;
      continue;
    }

    const itemHeader = JSON.parse(lines[i]) as ItemHeader;
    i++;

    if (i >= lines.length) {
      throw new Error('Invalid envelope: missing payload for item');
    }

    const payload = JSON.parse(lines[i]);
    i++;

    items.push({ header: itemHeader, payload });
  }

  return { header, items };
}

/**
 * Create an attachment envelope item.
 *
 * @param filename - Attachment filename
 * @param data - Attachment data
 * @param contentType - MIME type
 * @returns Envelope item parts
 */
export function createAttachmentItem(
  filename: string,
  data: string | Uint8Array,
  contentType: string = 'application/octet-stream'
): { header: string; payload: string | Uint8Array } {
  const isString = typeof data === 'string';
  const length = isString
    ? new TextEncoder().encode(data).length
    : data.length;

  const itemHeader: ItemHeader = {
    type: 'attachment',
    filename,
    content_type: contentType,
    length,
  };

  return {
    header: JSON.stringify(itemHeader),
    payload: data,
  };
}

/**
 * Create a client report envelope item.
 *
 * @param discardedEvents - Events that were discarded
 * @returns Envelope item parts
 */
export function createClientReportItem(
  discardedEvents: Array<{
    category: string;
    reason: string;
    quantity: number;
  }>
): { header: string; payload: string } {
  const payload = JSON.stringify({
    timestamp: new Date().toISOString(),
    discarded_events: discardedEvents,
  });

  const itemHeader: ItemHeader = {
    type: 'client_report',
    length: new TextEncoder().encode(payload).length,
  };

  return {
    header: JSON.stringify(itemHeader),
    payload,
  };
}

/**
 * Generate a random event ID (UUID v4 without dashes).
 */
function generateEventId(): string {
  const bytes = new Uint8Array(16);

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version (4) and variant (8, 9, a, or b)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Convert to hex string without dashes
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Convert DSN to string format.
 */
function dsnToString(dsn: Dsn): string {
  let result = `${dsn.protocol}://${dsn.publicKey}`;

  if (dsn.secretKey) {
    result += `:${dsn.secretKey}`;
  }

  result += `@${dsn.host}`;

  if (dsn.port) {
    result += `:${dsn.port}`;
  }

  if (dsn.path) {
    result += `/${dsn.path}`;
  }

  result += `/${dsn.projectId}`;

  return result;
}

/**
 * Calculate the size of an envelope in bytes.
 *
 * @param envelope - The envelope string
 * @returns Size in bytes
 */
export function getEnvelopeSize(envelope: string): number {
  return new TextEncoder().encode(envelope).length;
}

/**
 * Check if an envelope exceeds the size limit.
 *
 * @param envelope - The envelope string
 * @param maxSize - Maximum size in bytes (default 65536)
 * @returns True if the envelope exceeds the limit
 */
export function exceedsMaxSize(envelope: string, maxSize: number = 65536): boolean {
  return getEnvelopeSize(envelope) > maxSize;
}
