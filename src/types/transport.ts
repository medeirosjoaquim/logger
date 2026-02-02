/**
 * Transport-related type definitions
 * Handles sending events to Sentry or other backends
 */

import type { DataCategory, Event, SdkInfo } from './sentry';
import type { Session, SessionAggregates } from './session';

/**
 * Envelope item types that can be sent to Sentry.
 */
export type EnvelopeItemType =
  | 'event'
  | 'session'
  | 'sessions'
  | 'transaction'
  | 'attachment'
  | 'client_report'
  | 'user_report'
  | 'profile'
  | 'replay_event'
  | 'replay_recording'
  | 'check_in'
  | 'feedback'
  | 'span';

/**
 * Base envelope header with common fields.
 */
export interface BaseEnvelopeHeaders {
  /**
   * Event ID for correlation.
   */
  event_id?: string;

  /**
   * Timestamp when the envelope was created.
   */
  sent_at?: string;

  /**
   * DSN for routing.
   */
  dsn?: string;

  /**
   * SDK information.
   */
  sdk?: SdkInfo;
}

/**
 * Dynamic sampling context in envelope headers.
 */
export interface DynamicSamplingContextHeaders {
  /**
   * Trace ID.
   */
  trace_id?: string;

  /**
   * Public key.
   */
  public_key?: string;

  /**
   * Sample rate.
   */
  sample_rate?: string;

  /**
   * Release version.
   */
  release?: string;

  /**
   * Environment.
   */
  environment?: string;

  /**
   * Transaction name.
   */
  transaction?: string;

  /**
   * User segment.
   */
  user_segment?: string;

  /**
   * Replay ID.
   */
  replay_id?: string;

  /**
   * Sampled flag.
   */
  sampled?: string;
}

/**
 * Complete envelope headers.
 */
export interface EnvelopeHeaders extends BaseEnvelopeHeaders {
  /**
   * Dynamic sampling context.
   */
  trace?: DynamicSamplingContextHeaders;
}

/**
 * Item header describing the envelope item.
 */
export interface EnvelopeItemHeaders {
  /**
   * Type of the item.
   */
  type: EnvelopeItemType;

  /**
   * Length of the item payload in bytes.
   */
  length?: number;

  /**
   * Filename for attachments.
   */
  filename?: string;

  /**
   * Content type for attachments.
   */
  content_type?: string;

  /**
   * Attachment type.
   */
  attachment_type?: string;
}

/**
 * Event envelope item.
 */
export type EventEnvelopeItem = [
  { type: 'event' | 'transaction' | 'profile' | 'replay_event' | 'feedback' },
  Event
];

/**
 * Session envelope item.
 */
export type SessionEnvelopeItem = [{ type: 'session' }, Session];

/**
 * Sessions (aggregated) envelope item.
 */
export type SessionsEnvelopeItem = [{ type: 'sessions' }, SessionAggregates];

/**
 * Attachment envelope item.
 */
export type AttachmentEnvelopeItem = [
  {
    type: 'attachment';
    filename: string;
    content_type?: string;
    attachment_type?: string;
    length?: number;
  },
  string | Uint8Array
];

/**
 * User report envelope item (legacy feedback).
 */
export type UserReportEnvelopeItem = [
  { type: 'user_report' },
  {
    event_id: string;
    name: string;
    email: string;
    comments: string;
  }
];

/**
 * Client report envelope item for tracking dropped events.
 */
export type ClientReportEnvelopeItem = [
  { type: 'client_report' },
  ClientReport
];

/**
 * Check-in envelope item for cron monitoring.
 */
export type CheckInEnvelopeItem = [
  { type: 'check_in' },
  CheckIn
];

/**
 * Span envelope item.
 */
export type SpanEnvelopeItem = [
  { type: 'span' },
  unknown
];

/**
 * Replay recording envelope item.
 */
export type ReplayRecordingEnvelopeItem = [
  { type: 'replay_recording' },
  string | Uint8Array
];

/**
 * All possible envelope item types.
 */
export type EnvelopeItem =
  | EventEnvelopeItem
  | SessionEnvelopeItem
  | SessionsEnvelopeItem
  | AttachmentEnvelopeItem
  | UserReportEnvelopeItem
  | ClientReportEnvelopeItem
  | CheckInEnvelopeItem
  | SpanEnvelopeItem
  | ReplayRecordingEnvelopeItem;

/**
 * An envelope is a container for items to be sent to Sentry.
 */
export type Envelope = [EnvelopeHeaders, EnvelopeItem[]];

/**
 * Event-specific envelope.
 */
export type EventEnvelope = [EnvelopeHeaders, EventEnvelopeItem[]];

/**
 * Session-specific envelope.
 */
export type SessionEnvelope = [EnvelopeHeaders, (SessionEnvelopeItem | SessionsEnvelopeItem)[]];

/**
 * Client report for tracking dropped events.
 */
export interface ClientReport {
  /**
   * Timestamp of the report.
   */
  timestamp: number;

  /**
   * Discarded events by category and reason.
   */
  discarded_events: Array<{
    category: DataCategory;
    reason: ClientReportDiscardReason;
    quantity: number;
  }>;
}

/**
 * Reasons for discarding events.
 */
export type ClientReportDiscardReason =
  | 'queue_overflow'
  | 'cache_overflow'
  | 'ratelimit_backoff'
  | 'network_error'
  | 'sample_rate'
  | 'before_send'
  | 'event_processor'
  | 'insufficient_data'
  | 'backpressure'
  | 'send_error';

/**
 * Check-in data for cron monitoring.
 */
export interface CheckIn {
  /**
   * Check-in ID.
   */
  check_in_id: string;

  /**
   * Monitor slug.
   */
  monitor_slug: string;

  /**
   * Status of the check-in.
   */
  status: 'in_progress' | 'ok' | 'error' | 'missed';

  /**
   * Duration in seconds.
   */
  duration?: number;

  /**
   * Release version.
   */
  release?: string;

  /**
   * Environment.
   */
  environment?: string;

  /**
   * Monitor configuration.
   */
  monitor_config?: MonitorConfig;

  /**
   * Contexts.
   */
  contexts?: {
    trace?: {
      trace_id?: string;
      span_id?: string;
    };
  };
}

/**
 * Monitor configuration for cron jobs.
 */
export interface MonitorConfig {
  /**
   * Schedule type.
   */
  schedule:
    | { type: 'crontab'; value: string }
    | { type: 'interval'; value: number; unit: 'minute' | 'hour' | 'day' | 'week' | 'month' | 'year' };

  /**
   * Check-in margin in minutes.
   */
  checkin_margin?: number;

  /**
   * Max runtime in minutes.
   */
  max_runtime?: number;

  /**
   * Timezone.
   */
  timezone?: string;

  /**
   * Number of consecutive failures to trigger alert.
   */
  failure_issue_threshold?: number;

  /**
   * Number of consecutive successes to resolve.
   */
  recovery_threshold?: number;
}

/**
 * Transport request to be sent.
 */
export interface TransportRequest {
  /**
   * The serialized envelope body.
   */
  body: string | Uint8Array;

  /**
   * The URL to send to.
   */
  url?: string;
}

/**
 * Response from transport send operation.
 */
export interface TransportResponse {
  /**
   * HTTP status code.
   */
  statusCode?: number;

  /**
   * Response headers.
   */
  headers?: Record<string, string | null>;

  /**
   * Reason for failure.
   */
  reason?: string;
}

/**
 * Result of makeRequest call.
 */
export interface TransportMakeRequestResponse {
  /**
   * HTTP status code.
   */
  statusCode?: number;

  /**
   * Response headers.
   */
  headers?: Record<string, string | null>;
}

/**
 * Internal transport request metadata.
 */
export interface InternalTransportRequestMetadata {
  /**
   * Body size in bytes.
   */
  bodySize?: number;

  /**
   * Request start time.
   */
  startTime?: number;

  /**
   * Request end time.
   */
  endTime?: number;

  /**
   * Whether the request was rate limited.
   */
  rateLimited?: boolean;

  /**
   * Retry after time (from rate limiting).
   */
  retryAfter?: number;
}

/**
 * Rate limit information.
 */
export interface RateLimits {
  /**
   * Map of category to rate limit expiry time.
   */
  [key: string]: number;
}

/**
 * Transport interface for sending envelopes.
 */
export interface Transport {
  /**
   * Send an envelope.
   * @param envelope - The envelope to send
   * @returns Promise resolving to transport response
   */
  send(envelope: Envelope): Promise<TransportResponse>;

  /**
   * Flush pending requests.
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise resolving to true if flushed successfully
   */
  flush(timeout?: number): Promise<boolean>;

  /**
   * Close the transport and release resources.
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise resolving when closed
   */
  close(timeout?: number): Promise<void>;
}

/**
 * Options for creating a transport.
 */
export interface TransportOptions {
  /**
   * URL to send envelopes to.
   */
  url?: string;

  /**
   * Recording client reports.
   */
  recordDroppedEvent?: (category: DataCategory, reason: ClientReportDiscardReason, event?: Event) => void;

  /**
   * Text encoder for encoding bodies.
   */
  textEncoder?: TextEncoder;

  /**
   * Buffer size for pending requests.
   */
  bufferSize?: number;

  /**
   * Request timeout in milliseconds.
   */
  timeout?: number;

  /**
   * Additional headers to send.
   */
  headers?: Record<string, string>;

  /**
   * Whether to fetch keepalive.
   */
  keepalive?: boolean;

  /**
   * Tunnel URL for sending through a proxy.
   */
  tunnel?: string;
}

/**
 * Function type for transport factories.
 */
export type TransportFactory = (options: TransportOptions) => Transport;

/**
 * Function type for making requests.
 */
export type TransportMakeRequestFn = (
  request: TransportRequest
) => Promise<TransportMakeRequestResponse>;
