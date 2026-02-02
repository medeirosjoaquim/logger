/**
 * Span and tracing-related type definitions
 * Compatible with Sentry SDK v8 and OpenTelemetry concepts
 */

/**
 * Status codes for spans, aligned with OpenTelemetry and gRPC status codes.
 */
export type SpanStatus =
  | 'ok'
  | 'deadline_exceeded'
  | 'unauthenticated'
  | 'permission_denied'
  | 'not_found'
  | 'already_exists'
  | 'resource_exhausted'
  | 'failed_precondition'
  | 'aborted'
  | 'out_of_range'
  | 'unimplemented'
  | 'internal_error'
  | 'unavailable'
  | 'data_loss'
  | 'unknown_error'
  | 'cancelled';

/**
 * Numeric status codes matching OpenTelemetry SpanStatusCode.
 */
export enum SpanStatusCode {
  /** The default status. */
  UNSET = 0,
  /** The operation completed successfully. */
  OK = 1,
  /** The operation encountered an error. */
  ERROR = 2,
}

/**
 * Valid types for span attribute values.
 */
export type SpanAttributeValue =
  | string
  | number
  | boolean
  | Array<string>
  | Array<number>
  | Array<boolean>;

/**
 * Span attributes are key-value pairs attached to spans.
 */
export type SpanAttributes = Record<string, SpanAttributeValue | undefined>;

/**
 * Span time input can be a Date, number (milliseconds), or high-resolution time tuple.
 */
export type SpanTimeInput = Date | number | [number, number];

/**
 * Span origin describes where a span was created.
 */
export type SpanOrigin =
  | 'manual'
  | 'auto'
  | `auto.${string}`
  | `manual.${string}`;

/**
 * Trace flags from W3C Trace Context specification.
 */
export enum TraceFlags {
  /** No flags set. */
  NONE = 0,
  /** Trace is sampled. */
  SAMPLED = 1,
}

/**
 * Span context contains the identifiers for a span.
 */
export interface SpanContext {
  /**
   * The trace ID (32 character hex string).
   */
  traceId: string;

  /**
   * The span ID (16 character hex string).
   */
  spanId: string;

  /**
   * The parent span ID if this span has a parent.
   */
  parentSpanId?: string;

  /**
   * Whether this span is sampled.
   */
  sampled?: boolean;

  /**
   * W3C trace flags.
   */
  traceFlags?: TraceFlags;

  /**
   * Trace state from W3C Trace Context.
   */
  traceState?: string;

  /**
   * Whether this context is from a remote parent.
   */
  isRemote?: boolean;
}

/**
 * JSON representation of a span for serialization.
 */
export interface SpanJSON {
  /**
   * The trace ID.
   */
  trace_id: string;

  /**
   * The span ID.
   */
  span_id: string;

  /**
   * The parent span ID.
   */
  parent_span_id?: string;

  /**
   * The operation name.
   */
  op?: string;

  /**
   * The span description/name.
   */
  description?: string;

  /**
   * The span status.
   */
  status?: SpanStatus;

  /**
   * Start timestamp in seconds.
   */
  start_timestamp: number;

  /**
   * End timestamp in seconds.
   */
  timestamp?: number;

  /**
   * Span tags (legacy, prefer data).
   */
  tags?: Record<string, string>;

  /**
   * Span data/attributes.
   */
  data?: SpanAttributes;

  /**
   * Origin of the span.
   */
  origin?: SpanOrigin;

  /**
   * Exclusive time (time not spent in child spans).
   */
  exclusive_time?: number;

  /**
   * Measurements attached to this span.
   */
  measurements?: Record<string, { value: number; unit?: string }>;

  /**
   * Whether this is a segment (root of a trace segment).
   */
  is_segment?: boolean;

  /**
   * Segment ID.
   */
  segment_id?: string;

  /**
   * Profile ID if profiling is enabled.
   */
  profile_id?: string;
}

/**
 * Options for starting a new span.
 */
export interface StartSpanOptions {
  /**
   * The name/description of the span.
   */
  name: string;

  /**
   * The operation type (e.g., 'http.client', 'db.query').
   */
  op?: string;

  /**
   * Attributes to set on the span.
   */
  attributes?: SpanAttributes;

  /**
   * Parent span to use. If not provided, uses the current active span.
   */
  parentSpan?: Span;

  /**
   * Force this span to be a transaction.
   */
  forceTransaction?: boolean;

  /**
   * Scope to use for this span.
   */
  scope?: unknown;

  /**
   * Start time for the span.
   */
  startTime?: SpanTimeInput;

  /**
   * Only create the span if there is an active span.
   */
  onlyIfParent?: boolean;

  /**
   * Origin of the span.
   */
  origin?: SpanOrigin;

  /**
   * Whether to make this span the active span.
   */
  makeActive?: boolean;

  /**
   * Experimental options.
   */
  experimental?: {
    /**
     * Whether to create a standalone span.
     */
    standalone?: boolean;
  };
}

/**
 * Transaction-specific context extending SpanContext.
 */
export interface TransactionContext extends SpanContext {
  /**
   * The transaction name.
   */
  name: string;

  /**
   * The transaction operation.
   */
  op?: string;

  /**
   * Transaction status.
   */
  status?: SpanStatus;

  /**
   * Source of the transaction name.
   */
  source?: TransactionSource;

  /**
   * Metadata about the transaction.
   */
  metadata?: TransactionMetadata;

  /**
   * Tags for the transaction.
   */
  tags?: Record<string, string>;

  /**
   * Data/attributes for the transaction.
   */
  data?: SpanAttributes;

  /**
   * Span attributes (alias for data).
   */
  attributes?: SpanAttributes;

  /**
   * Origin of the transaction.
   */
  origin?: SpanOrigin;

  /**
   * Trimmed state.
   */
  trimEnd?: boolean;
}

/**
 * Source of transaction name, used for grouping.
 */
export type TransactionSource =
  | 'custom'
  | 'url'
  | 'route'
  | 'view'
  | 'component'
  | 'task';

/**
 * Metadata for transactions.
 */
export interface TransactionMetadata {
  /**
   * Sample rate applied to this transaction.
   */
  sampleRate?: number;

  /**
   * Dynamic sampling context.
   */
  dynamicSamplingContext?: Record<string, string>;

  /**
   * Source of the transaction name.
   */
  source?: TransactionSource;

  /**
   * Request data.
   */
  request?: unknown;

  /**
   * Bundle IDs for JavaScript bundles.
   */
  bundleIds?: string[];
}

/**
 * Sampler function type.
 */
export type Sampler = (context: SamplingContext) => SamplingDecision;

/**
 * Context passed to the sampler.
 */
export interface SamplingContext {
  /**
   * The transaction context.
   */
  transactionContext: TransactionContext;

  /**
   * The parent span if any.
   */
  parentSpan?: Span;

  /**
   * Whether the parent was sampled.
   */
  parentSampled?: boolean;

  /**
   * Request data if available.
   */
  request?: unknown;

  /**
   * Location data if available.
   */
  location?: unknown;

  /**
   * Custom sampling context.
   */
  [key: string]: unknown;
}

/**
 * Sampling decision from the sampler.
 */
export interface SamplingDecision {
  /**
   * Whether to sample.
   */
  decision: boolean;

  /**
   * The sample rate used.
   */
  sampleRate?: number;
}

/**
 * Span interface representing a unit of work.
 */
export interface Span {
  /**
   * Get the span context.
   */
  spanContext(): SpanContext;

  /**
   * Set the span name/description.
   */
  updateName(name: string): this;

  /**
   * Set an attribute on the span.
   */
  setAttribute(key: string, value: SpanAttributeValue | undefined): this;

  /**
   * Set multiple attributes on the span.
   */
  setAttributes(attributes: SpanAttributes): this;

  /**
   * Set the span status.
   */
  setStatus(status: SpanStatus | { code: SpanStatusCode; message?: string }): this;

  /**
   * End the span.
   */
  end(endTime?: SpanTimeInput): void;

  /**
   * Check if the span is recording.
   */
  isRecording(): boolean;

  /**
   * Add an event to the span.
   */
  addEvent(name: string, attributesOrTime?: SpanAttributes | SpanTimeInput, time?: SpanTimeInput): this;

  /**
   * Record an exception on the span.
   */
  recordException(exception: unknown, time?: SpanTimeInput): void;

  /**
   * Convert the span to JSON.
   */
  toJSON(): SpanJSON;

  /**
   * Get the span's start time in seconds.
   */
  readonly startTime: number;

  /**
   * Get the span's end time in seconds (undefined if not ended).
   */
  readonly endTime?: number;

  /**
   * Get the span's operation.
   */
  readonly op?: string;

  /**
   * Get the span's name/description.
   */
  readonly name: string;

  /**
   * Get the span's attributes.
   */
  readonly attributes: SpanAttributes;

  /**
   * Get the span's status.
   */
  readonly status?: SpanStatus;

  /**
   * Get the span's origin.
   */
  readonly origin?: SpanOrigin;

  /**
   * Get the parent span ID.
   */
  readonly parentSpanId?: string;

  /**
   * Check if the span is sampled.
   */
  readonly sampled?: boolean;
}

/**
 * Transaction interface extending Span with transaction-specific methods.
 */
export interface Transaction extends Span {
  /**
   * Get the transaction name.
   */
  readonly name: string;

  /**
   * Set the transaction name.
   */
  setName(name: string, source?: TransactionSource): void;

  /**
   * Get the transaction metadata.
   */
  readonly metadata: TransactionMetadata;

  /**
   * Set transaction metadata.
   */
  setMetadata(metadata: Partial<TransactionMetadata>): void;

  /**
   * Get the transaction context.
   */
  readonly transactionContext: TransactionContext;

  /**
   * Get the dynamic sampling context.
   */
  getDynamicSamplingContext(): Record<string, string>;

  /**
   * Finish the transaction and send it.
   */
  finish(endTimestamp?: number): void;

  /**
   * Convert to JSON with child spans.
   */
  toJSON(): SpanJSON & {
    spans?: SpanJSON[];
  };
}

/**
 * Span link connecting spans across traces.
 */
export interface SpanLink {
  /**
   * The span context of the linked span.
   */
  context: SpanContext;

  /**
   * Attributes describing the link.
   */
  attributes?: SpanAttributes;
}

/**
 * Options for span links.
 */
export interface SpanLinkOptions {
  /**
   * Links to add to the span.
   */
  links?: SpanLink[];
}

/**
 * Measurement unit types.
 */
export type MeasurementUnit =
  | 'none'
  | 'ratio'
  | 'percent'
  | 'second'
  | 'millisecond'
  | 'microsecond'
  | 'nanosecond'
  | 'byte'
  | 'kilobyte'
  | 'megabyte'
  | 'gigabyte';

/**
 * Measurement value.
 */
export interface Measurement {
  /**
   * The measurement value.
   */
  value: number;

  /**
   * The measurement unit.
   */
  unit?: MeasurementUnit;
}

/**
 * Span recorder for collecting child spans.
 */
export interface SpanRecorder {
  /**
   * Add a span to the recorder.
   */
  add(span: Span): void;

  /**
   * Get all recorded spans.
   */
  spans: Span[];
}
