/**
 * Envelope Construction and Serialization
 *
 * Creates and serializes Sentry envelopes for transport.
 * Compatible with Sentry envelope format specification.
 */

import type { Event, SdkInfo, User } from '../types/sentry.js';
import { generateEventId } from '../tracing/idGenerator.js';

/**
 * Types of items that can be included in an envelope
 */
export type EnvelopeItemType =
  | 'event'
  | 'session'
  | 'attachment'
  | 'transaction'
  | 'client_report'
  | 'replay_event'
  | 'feedback'
  | 'profile'
  | 'span';

/**
 * Envelope header containing routing information
 */
export interface EnvelopeHeaders {
  /**
   * Event ID (for single-event envelopes)
   */
  event_id?: string;

  /**
   * Timestamp when the envelope was created
   */
  sent_at?: string;

  /**
   * SDK information
   */
  sdk?: SdkInfo;

  /**
   * DSN to use for routing
   */
  dsn?: string;

  /**
   * Trace context for distributed tracing
   */
  trace?: {
    trace_id?: string;
    public_key?: string;
    release?: string;
    environment?: string;
    transaction?: string;
    sample_rate?: string;
    sampled?: string;
  };
}

/**
 * Item header for an envelope item
 */
export interface EnvelopeItemHeader {
  /**
   * Type of the item
   */
  type: EnvelopeItemType;

  /**
   * Content type of the payload
   */
  content_type?: string;

  /**
   * Length of the payload in bytes
   */
  length?: number;

  /**
   * Filename for attachments
   */
  filename?: string;

  /**
   * Attachment type
   */
  attachment_type?: string;
}

/**
 * A single item in an envelope
 */
export interface EnvelopeItem<T = unknown> {
  /**
   * Item header
   */
  header: EnvelopeItemHeader;

  /**
   * Item payload
   */
  payload: T;
}

/**
 * A complete envelope ready for transport
 */
export interface Envelope {
  /**
   * Envelope headers
   */
  headers: EnvelopeHeaders;

  /**
   * Items in the envelope
   */
  items: EnvelopeItem[];
}

/**
 * DSN (Data Source Name) components
 */
export interface Dsn {
  /**
   * Protocol (http or https)
   */
  protocol: string;

  /**
   * Public key
   */
  publicKey: string;

  /**
   * Secret key (deprecated, may be empty)
   */
  secretKey?: string;

  /**
   * Sentry host
   */
  host: string;

  /**
   * Port number
   */
  port?: string;

  /**
   * Project ID
   */
  projectId: string;

  /**
   * Optional path prefix
   */
  path?: string;
}

/**
 * Session status values
 */
export type SessionStatus = 'ok' | 'exited' | 'crashed' | 'abnormal';

/**
 * Session data for session tracking
 */
export interface Session {
  /**
   * Session ID
   */
  sid: string;

  /**
   * User ID
   */
  did?: string;

  /**
   * Initial session status
   */
  init: boolean;

  /**
   * Start timestamp
   */
  started: string;

  /**
   * Session status
   */
  status: SessionStatus;

  /**
   * Error count
   */
  errors: number;

  /**
   * Duration in seconds
   */
  duration?: number;

  /**
   * User agent
   */
  attrs?: {
    release?: string;
    environment?: string;
    user_agent?: string;
    ip_address?: string;
  };
}

/**
 * Client report for diagnostics
 */
export interface ClientReport {
  /**
   * Report timestamp
   */
  timestamp: string;

  /**
   * Discarded events counts
   */
  discarded_events: Array<{
    reason: string;
    category: string;
    quantity: number;
  }>;
}

/**
 * Parse a DSN string into components
 */
export function parseDsn(dsnString: string): Dsn | null {
  const match = dsnString.match(
    /^(?:(\w+):)?\/\/(?:(\w+)(?::(\w+))?@)?([\w.-]+)(?::(\d+))?(\/.*)?\/(\d+)$/
  );

  if (!match) {
    return null;
  }

  const [, protocol = 'https', publicKey, secretKey, host, port, path = '', projectId] = match;

  return {
    protocol,
    publicKey,
    secretKey,
    host,
    port,
    path: path.replace(/\/$/, ''),
    projectId,
  };
}

/**
 * Get the envelope endpoint URL from a DSN
 */
export function getEnvelopeEndpoint(dsn: Dsn): string {
  const { protocol, host, port, path, projectId, publicKey } = dsn;
  const portStr = port ? `:${port}` : '';
  return `${protocol}://${host}${portStr}${path}/api/${projectId}/envelope/?sentry_key=${publicKey}&sentry_version=7`;
}

/**
 * Create an envelope for an event
 */
export function createEventEnvelope(event: Event, dsn: Dsn): Envelope {
  const eventId = event.event_id || generateEventId();
  const timestamp = typeof event.timestamp === 'number'
    ? new Date(event.timestamp * 1000).toISOString()
    : event.timestamp || new Date().toISOString();

  const headers: EnvelopeHeaders = {
    event_id: eventId,
    sent_at: new Date().toISOString(),
    sdk: event.sdk,
  };

  // Add trace context if available
  if (event.contexts?.trace) {
    headers.trace = {
      trace_id: event.contexts.trace.trace_id as string | undefined,
      public_key: dsn.publicKey,
      release: event.release,
      environment: event.environment,
    };
  }

  // Determine item type
  const itemType: EnvelopeItemType = event.type === 'transaction'
    ? 'transaction'
    : event.type === 'replay_event'
    ? 'replay_event'
    : event.type === 'feedback'
    ? 'feedback'
    : 'event';

  const items: EnvelopeItem[] = [
    {
      header: { type: itemType },
      payload: {
        ...event,
        event_id: eventId,
        timestamp,
      },
    },
  ];

  return { headers, items };
}

/**
 * Create an envelope for a session
 */
export function createSessionEnvelope(session: Session, dsn: Dsn): Envelope {
  const headers: EnvelopeHeaders = {
    sent_at: new Date().toISOString(),
  };

  const items: EnvelopeItem[] = [
    {
      header: { type: 'session' },
      payload: session,
    },
  ];

  return { headers, items };
}

/**
 * Create an envelope for a client report
 */
export function createClientReportEnvelope(report: ClientReport, dsn: Dsn): Envelope {
  const headers: EnvelopeHeaders = {
    sent_at: new Date().toISOString(),
  };

  const items: EnvelopeItem[] = [
    {
      header: { type: 'client_report' },
      payload: report,
    },
  ];

  return { headers, items };
}

/**
 * Add an attachment to an envelope
 */
export function addAttachmentToEnvelope(
  envelope: Envelope,
  attachment: {
    filename: string;
    data: string | Uint8Array;
    contentType?: string;
    attachmentType?: string;
  }
): Envelope {
  const { filename, data, contentType, attachmentType } = attachment;

  const item: EnvelopeItem = {
    header: {
      type: 'attachment',
      filename,
      content_type: contentType || 'application/octet-stream',
      attachment_type: attachmentType || 'event.attachment',
      length: typeof data === 'string' ? new TextEncoder().encode(data).length : data.length,
    },
    payload: data,
  };

  return {
    ...envelope,
    items: [...envelope.items, item],
  };
}

/**
 * Serialize an envelope to a string for transport
 * Uses newline-delimited JSON format
 */
export function serializeEnvelope(envelope: Envelope): string {
  const lines: string[] = [];

  // Serialize envelope header
  lines.push(JSON.stringify(envelope.headers));

  // Serialize each item
  for (const item of envelope.items) {
    // Item header
    lines.push(JSON.stringify(item.header));

    // Item payload
    if (typeof item.payload === 'string') {
      lines.push(item.payload);
    } else if (item.payload instanceof Uint8Array) {
      // For binary data, we need special handling
      // In a string serialization, we base64 encode it
      lines.push(uint8ArrayToBase64(item.payload));
    } else {
      lines.push(JSON.stringify(item.payload));
    }
  }

  return lines.join('\n');
}

/**
 * Serialize an envelope to bytes for transport
 * Useful for binary attachments
 */
export function serializeEnvelopeToBytes(envelope: Envelope, encoder: TextEncoder = new TextEncoder()): Uint8Array {
  const parts: Uint8Array[] = [];

  // Serialize envelope header
  parts.push(encoder.encode(JSON.stringify(envelope.headers) + '\n'));

  // Serialize each item
  for (const item of envelope.items) {
    // Item header
    parts.push(encoder.encode(JSON.stringify(item.header) + '\n'));

    // Item payload
    if (typeof item.payload === 'string') {
      parts.push(encoder.encode(item.payload + '\n'));
    } else if (item.payload instanceof Uint8Array) {
      parts.push(item.payload);
      parts.push(encoder.encode('\n'));
    } else {
      parts.push(encoder.encode(JSON.stringify(item.payload) + '\n'));
    }
  }

  // Combine all parts
  const totalLength = parts.reduce((sum, part) => sum + part.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    result.set(part, offset);
    offset += part.length;
  }

  return result;
}

/**
 * Parse an envelope from a string
 */
export function parseEnvelope(data: string): Envelope {
  const lines = data.split('\n');
  if (lines.length < 1) {
    throw new Error('Invalid envelope: empty data');
  }

  // Parse envelope header
  const headers: EnvelopeHeaders = JSON.parse(lines[0]);
  const items: EnvelopeItem[] = [];

  // Parse items (pairs of header + payload)
  let i = 1;
  while (i < lines.length) {
    if (!lines[i] || lines[i].trim() === '') {
      i++;
      continue;
    }

    // Parse item header
    const itemHeader: EnvelopeItemHeader = JSON.parse(lines[i]);
    i++;

    // Parse item payload
    let payload: unknown;
    if (i < lines.length && lines[i]) {
      try {
        payload = JSON.parse(lines[i]);
      } catch {
        // If not valid JSON, treat as string
        payload = lines[i];
      }
    }
    i++;

    items.push({ header: itemHeader, payload });
  }

  return { headers, items };
}

/**
 * Convert Uint8Array to base64 string
 */
function uint8ArrayToBase64(bytes: Uint8Array): string {
  // In browser, use btoa
  if (typeof btoa === 'function') {
    let binary = '';
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  // In Node.js, use Buffer
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(bytes).toString('base64');
  }

  // Fallback: manual base64 encoding
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  let i = 0;

  while (i < bytes.length) {
    const a = bytes[i++];
    const b = bytes[i++] || 0;
    const c = bytes[i++] || 0;

    const triplet = (a << 16) | (b << 8) | c;

    result += chars[(triplet >> 18) & 0x3f];
    result += chars[(triplet >> 12) & 0x3f];
    result += i - 2 <= bytes.length ? chars[(triplet >> 6) & 0x3f] : '=';
    result += i - 1 <= bytes.length ? chars[triplet & 0x3f] : '=';
  }

  return result;
}

/**
 * Get the size of a serialized envelope in bytes
 */
export function getEnvelopeSize(envelope: Envelope): number {
  const serialized = serializeEnvelope(envelope);
  return new TextEncoder().encode(serialized).length;
}
