/**
 * Tracing type definitions
 * Compatible with Sentry SDK v8 and OpenTelemetry
 */

/**
 * Span status codes following OpenTelemetry conventions
 */
export type SpanStatusCode = 'ok' | 'error' | 'unset';

/**
 * Span status with optional description
 */
export interface SpanStatus {
  /**
   * The status code
   */
  code: SpanStatusCode;

  /**
   * Optional status message/description
   */
  message?: string;
}

/**
 * Allowed primitive types for span attributes
 */
export type SpanAttributeValue =
  | string
  | number
  | boolean
  | undefined
  | null
  | Array<string>
  | Array<number>
  | Array<boolean>;

/**
 * Span attributes (key-value pairs)
 */
export type SpanAttributes = Record<string, SpanAttributeValue>;

/**
 * Span context for distributed tracing
 */
export interface SpanContext {
  /**
   * The unique trace identifier (32 hex characters)
   */
  traceId: string;

  /**
   * The unique span identifier (16 hex characters)
   */
  spanId: string;

  /**
   * The parent span identifier (16 hex characters)
   */
  parentSpanId?: string;

  /**
   * Trace flags (for sampling decisions)
   */
  traceFlags?: number;

  /**
   * Whether this span was sampled
   */
  sampled?: boolean;
}

/**
 * Options for starting a new span
 */
export interface StartSpanOptions {
  /**
   * The name of the span
   */
  name: string;

  /**
   * The operation type (e.g., 'http.client', 'db.query')
   */
  op?: string;

  /**
   * Span attributes
   */
  attributes?: SpanAttributes;

  /**
   * Tags for the span (Sentry-compatible)
   */
  tags?: Record<string, string>;

  /**
   * Additional data
   */
  data?: Record<string, unknown>;

  /**
   * Explicit start timestamp (seconds with millisecond precision)
   */
  startTime?: number;

  /**
   * Parent span context for distributed tracing
   */
  parentSpanId?: string;

  /**
   * Trace ID for distributed tracing
   */
  traceId?: string;

  /**
   * Whether this span is sampled
   */
  sampled?: boolean;

  /**
   * Force this to be a transaction
   */
  forceTransaction?: boolean;

  /**
   * Scope to use for this span
   */
  scope?: unknown;

  /**
   * Origin of the span
   */
  origin?: string;
}

/**
 * JSON representation of a span
 */
export interface SpanJSON {
  /**
   * Span ID
   */
  span_id: string;

  /**
   * Trace ID
   */
  trace_id: string;

  /**
   * Parent span ID
   */
  parent_span_id?: string;

  /**
   * Span operation
   */
  op?: string;

  /**
   * Span description/name
   */
  description?: string;

  /**
   * Span status
   */
  status?: SpanStatusCode;

  /**
   * Start timestamp in seconds
   */
  start_timestamp: number;

  /**
   * End timestamp in seconds
   */
  timestamp?: number;

  /**
   * Tags
   */
  tags?: Record<string, string>;

  /**
   * Additional data
   */
  data?: Record<string, unknown>;

  /**
   * Span origin
   */
  origin?: string;
}

/**
 * Transaction source - how the transaction name was determined
 */
export type TransactionSource = 'custom' | 'url' | 'route' | 'view' | 'component' | 'task';

/**
 * Transaction metadata
 */
export interface TransactionMetadata {
  /**
   * How the transaction name was determined
   */
  source?: TransactionSource;

  /**
   * Sample rate used for this transaction
   */
  sampleRate?: number;

  /**
   * Dynamic sampling context
   */
  dynamicSamplingContext?: DynamicSamplingContext;

  /**
   * The baggage header items
   */
  baggage?: string;

  /**
   * SDK-specific metadata
   */
  sdk?: {
    name?: string;
    version?: string;
  };
}

/**
 * Transaction context for creating transactions
 */
export interface TransactionContext extends StartSpanOptions {
  /**
   * Transaction name
   */
  name: string;

  /**
   * Transaction source
   */
  source?: TransactionSource;

  /**
   * Transaction metadata
   */
  metadata?: TransactionMetadata;

  /**
   * Whether to trim end timestamp to last child span
   */
  trimEnd?: boolean;
}

/**
 * JSON representation of a transaction
 */
export interface TransactionJSON extends SpanJSON {
  /**
   * Transaction type marker
   */
  type: 'transaction';

  /**
   * Transaction name
   */
  transaction: string;

  /**
   * Child spans
   */
  spans: SpanJSON[];

  /**
   * Transaction contexts
   */
  contexts?: {
    trace?: SpanContext & {
      op?: string;
      status?: string;
    };
    [key: string]: unknown;
  };

  /**
   * Transaction info
   */
  transaction_info?: {
    source?: TransactionSource;
  };

  /**
   * Measurements
   */
  measurements?: Record<string, { value: number; unit?: string }>;

  /**
   * Environment
   */
  environment?: string;

  /**
   * Release
   */
  release?: string;

  /**
   * Tags
   */
  tags?: Record<string, string>;
}

/**
 * Dynamic sampling context (DSC)
 */
export interface DynamicSamplingContext {
  /**
   * Trace ID
   */
  trace_id: string;

  /**
   * Public key (from DSN)
   */
  public_key: string;

  /**
   * Release version
   */
  release?: string;

  /**
   * Environment
   */
  environment?: string;

  /**
   * Transaction name
   */
  transaction?: string;

  /**
   * Sample rate used
   */
  sample_rate?: string;

  /**
   * Whether the transaction was sampled
   */
  sampled?: string;
}

/**
 * Sampling context passed to tracesSampler
 */
export interface SamplingContext {
  /**
   * The transaction context being sampled
   */
  transactionContext: TransactionContext;

  /**
   * Parent span's sampling decision
   */
  parentSampled?: boolean;

  /**
   * The transaction/span name
   */
  name: string;

  /**
   * Span attributes
   */
  attributes: SpanAttributes;

  /**
   * Request information (if available)
   */
  request?: {
    url?: string;
    method?: string;
    headers?: Record<string, string>;
  };

  /**
   * Location information (browser)
   */
  location?: {
    pathname?: string;
    href?: string;
  };
}

/**
 * Browser tracing options
 */
export interface BrowserTracingOptions {
  /**
   * Span name
   */
  name?: string;

  /**
   * Span operation
   */
  op?: string;

  /**
   * Additional attributes
   */
  attributes?: SpanAttributes;

  /**
   * Whether to record page load spans
   */
  recordPageLoadSpan?: boolean;

  /**
   * Whether to record navigation spans
   */
  recordNavigationSpan?: boolean;

  /**
   * Whether to collect web vitals
   */
  enableWebVitals?: boolean;
}

/**
 * Trace propagation data
 */
export interface TracePropagationData {
  /**
   * The sentry-trace header value
   */
  sentryTrace: string;

  /**
   * The baggage header value
   */
  baggage: string;
}

/**
 * Parsed sentry-trace header
 */
export interface ParsedSentryTrace {
  /**
   * Trace ID
   */
  traceId: string;

  /**
   * Parent span ID
   */
  parentSpanId: string;

  /**
   * Sampling decision
   */
  sampled?: boolean;
}

/**
 * Hub interface (minimal for tracing)
 */
export interface Hub {
  /**
   * Get current client
   */
  getClient(): unknown;

  /**
   * Get current scope
   */
  getScope(): unknown;

  /**
   * Capture event
   */
  captureEvent(event: unknown): string;

  /**
   * Get the tracing options
   */
  getTracingOptions?(): {
    tracesSampleRate?: number;
    tracesSampler?: (context: SamplingContext) => number | boolean;
  };
}
