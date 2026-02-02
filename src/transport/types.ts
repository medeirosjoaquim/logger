/**
 * Transport Layer Type Definitions
 *
 * Types for the transport system that sends events to Sentry-compatible backends.
 */

import type { Event, SeverityLevel } from '../types/sentry.js';

/**
 * Request body to send via transport
 */
export interface TransportRequest {
  /**
   * The serialized body to send
   */
  body: string | Uint8Array;

  /**
   * Optional content type override
   */
  contentType?: string;
}

/**
 * Response from the transport
 */
export interface TransportMakeRequestResponse {
  /**
   * HTTP status code from the server
   */
  statusCode?: number;

  /**
   * Response headers
   */
  headers?: Record<string, string | null>;

  /**
   * Human-readable reason/status text
   */
  reason?: string;
}

/**
 * Reason an event was dropped
 */
export type EventDropReason =
  | 'before_send'
  | 'event_processor'
  | 'network_error'
  | 'queue_overflow'
  | 'ratelimit_backoff'
  | 'sample_rate';

/**
 * Category for rate limiting purposes
 */
export type TransportCategory =
  | 'default'
  | 'error'
  | 'transaction'
  | 'replay'
  | 'attachment'
  | 'session'
  | 'internal';

/**
 * Options for creating a transport
 */
export interface TransportOptions {
  /**
   * Callback to record when an event is dropped
   */
  recordDroppedEvent?: (reason: EventDropReason, category: TransportCategory, event?: Event) => void;

  /**
   * TextEncoder instance to use for encoding
   */
  textEncoder?: TextEncoder;

  /**
   * Maximum number of requests to queue
   */
  maxQueueSize?: number;

  /**
   * Request timeout in milliseconds
   */
  timeout?: number;

  /**
   * Number of retry attempts
   */
  retryAttempts?: number;
}

/**
 * Transport interface for sending events to the server
 */
export interface Transport {
  /**
   * Send a request to the server
   * @param request The request to send
   * @returns Response from the server
   */
  send(request: TransportRequest): Promise<TransportMakeRequestResponse>;

  /**
   * Flush any pending requests
   * @param timeout Maximum time to wait in milliseconds
   * @returns True if all requests were flushed
   */
  flush(timeout?: number): Promise<boolean>;

  /**
   * Close the transport and release resources
   * @param timeout Maximum time to wait for pending requests
   * @returns True if closed successfully
   */
  close(timeout?: number): Promise<boolean>;
}

/**
 * Factory function type for creating transports
 */
export type TransportFactory = (options: TransportOptions) => Transport;

/**
 * Internal transport state
 */
export interface TransportState {
  /**
   * Whether the transport is currently sending
   */
  sending: boolean;

  /**
   * Number of pending requests
   */
  pendingCount: number;

  /**
   * Whether the transport is closed
   */
  closed: boolean;
}

/**
 * Rate limit state from server headers
 */
export interface RateLimitState {
  /**
   * Category-specific rate limits (timestamp until rate limit expires)
   */
  limits: Map<TransportCategory | 'all', number>;

  /**
   * Last retry-after value received
   */
  retryAfter?: number;
}

/**
 * Options for fetch-based transport
 */
export interface FetchTransportOptions extends TransportOptions {
  /**
   * The URL to send requests to
   */
  url: string;

  /**
   * Custom headers to include with requests
   */
  headers?: Record<string, string>;

  /**
   * Custom fetch implementation
   */
  fetchImpl?: typeof fetch;

  /**
   * Whether to use keepalive for requests
   */
  keepalive?: boolean;

  /**
   * Request referrer policy
   */
  referrerPolicy?: ReferrerPolicy;
}

/**
 * Options for XHR-based transport
 */
export interface XHRTransportOptions extends TransportOptions {
  /**
   * The URL to send requests to
   */
  url: string;

  /**
   * Custom headers to include with requests
   */
  headers?: Record<string, string>;
}

/**
 * Queued event for batch processing
 */
export interface QueuedEvent {
  /**
   * The event to send
   */
  event: Event;

  /**
   * Priority level (0 = highest, errors first)
   */
  priority: number;

  /**
   * Timestamp when the event was queued
   */
  timestamp: number;

  /**
   * Number of retry attempts
   */
  retryCount: number;
}

/**
 * Options for the event queue
 */
export interface EventQueueOptions {
  /**
   * Maximum number of events to queue
   */
  maxSize?: number;

  /**
   * Interval between flush attempts in milliseconds
   */
  flushInterval?: number;

  /**
   * Maximum time to wait for a flush in milliseconds
   */
  flushTimeout?: number;

  /**
   * Whether to start flushing automatically
   */
  autoStart?: boolean;
}
