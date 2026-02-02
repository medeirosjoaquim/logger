/**
 * Span class implementation
 * Represents a single unit of work in a distributed trace
 */

import type {
  SpanStatus,
  SpanStatusCode,
  SpanAttributes,
  SpanAttributeValue,
  SpanContext,
  SpanJSON,
  StartSpanOptions,
} from './types';
import { generateSpanId, generateTraceId } from './idGenerator';

/**
 * Get the current timestamp in seconds with millisecond precision
 */
function timestampInSeconds(): number {
  return Date.now() / 1000;
}

/**
 * Span class representing a single unit of work
 */
export class Span {
  /**
   * Unique span identifier (16 hex characters)
   */
  private _spanId: string;

  /**
   * Trace identifier (32 hex characters)
   */
  private _traceId: string;

  /**
   * Parent span identifier
   */
  private _parentSpanId?: string;

  /**
   * Span name/description
   */
  private _name: string;

  /**
   * Span operation type
   */
  private _op?: string;

  /**
   * Span status
   */
  private _status: SpanStatus;

  /**
   * Start timestamp in seconds
   */
  private _startTimestamp: number;

  /**
   * End timestamp in seconds
   */
  private _endTimestamp?: number;

  /**
   * Span attributes
   */
  private _attributes: SpanAttributes;

  /**
   * Span tags (Sentry-compatible)
   */
  private _tags: Record<string, string>;

  /**
   * Additional data
   */
  private _data: Record<string, unknown>;

  /**
   * Whether this span was sampled
   */
  private _sampled?: boolean;

  /**
   * Child spans
   */
  private _children: Span[] = [];

  /**
   * Parent span reference
   */
  private _parent?: Span;

  /**
   * Span origin
   */
  private _origin?: string;

  /**
   * Create a new Span
   */
  constructor(options: StartSpanOptions) {
    this._spanId = generateSpanId();
    this._traceId = options.traceId || generateTraceId();
    this._parentSpanId = options.parentSpanId;
    this._name = options.name;
    this._op = options.op;
    this._status = { code: 'unset' };
    this._startTimestamp = options.startTime ?? timestampInSeconds();
    this._attributes = { ...options.attributes };
    this._tags = { ...options.tags };
    this._data = { ...options.data };
    this._sampled = options.sampled;
    this._origin = options.origin;
  }

  // ============================================
  // Public getters
  // ============================================

  /**
   * Get the span ID
   */
  get spanId(): string {
    return this._spanId;
  }

  /**
   * Get the trace ID
   */
  get traceId(): string {
    return this._traceId;
  }

  /**
   * Get the parent span ID
   */
  get parentSpanId(): string | undefined {
    return this._parentSpanId;
  }

  /**
   * Get the span name
   */
  get name(): string {
    return this._name;
  }

  /**
   * Set the span name
   */
  set name(name: string) {
    this._name = name;
  }

  /**
   * Get the operation type
   */
  get op(): string | undefined {
    return this._op;
  }

  /**
   * Set the operation type
   */
  set op(op: string | undefined) {
    this._op = op;
  }

  /**
   * Get the span status
   */
  get status(): SpanStatus {
    return this._status;
  }

  /**
   * Get the start timestamp
   */
  get startTimestamp(): number {
    return this._startTimestamp;
  }

  /**
   * Get the end timestamp
   */
  get endTimestamp(): number | undefined {
    return this._endTimestamp;
  }

  /**
   * Get span attributes
   */
  get attributes(): SpanAttributes {
    return { ...this._attributes };
  }

  /**
   * Get span tags
   */
  get tags(): Record<string, string> {
    return { ...this._tags };
  }

  /**
   * Get span data
   */
  get data(): Record<string, unknown> {
    return { ...this._data };
  }

  /**
   * Get whether this span was sampled
   */
  get sampled(): boolean | undefined {
    return this._sampled;
  }

  /**
   * Set whether this span was sampled
   */
  set sampled(sampled: boolean | undefined) {
    this._sampled = sampled;
  }

  /**
   * Get child spans
   */
  get children(): Span[] {
    return [...this._children];
  }

  /**
   * Get span origin
   */
  get origin(): string | undefined {
    return this._origin;
  }

  // ============================================
  // Lifecycle methods
  // ============================================

  /**
   * End this span
   */
  end(endTimestamp?: number): void {
    if (this._endTimestamp !== undefined) {
      // Span already ended
      return;
    }
    this._endTimestamp = endTimestamp ?? timestampInSeconds();
  }

  /**
   * Check if this span is still recording
   */
  isRecording(): boolean {
    return this._endTimestamp === undefined;
  }

  // ============================================
  // Attribute methods
  // ============================================

  /**
   * Set a single attribute
   */
  setAttribute(key: string, value: SpanAttributeValue): this {
    if (this.isRecording()) {
      this._attributes[key] = value;
    }
    return this;
  }

  /**
   * Set multiple attributes
   */
  setAttributes(attributes: SpanAttributes): this {
    if (this.isRecording()) {
      for (const [key, value] of Object.entries(attributes)) {
        this._attributes[key] = value;
      }
    }
    return this;
  }

  /**
   * Set a tag
   */
  setTag(key: string, value: string): this {
    if (this.isRecording()) {
      this._tags[key] = value;
    }
    return this;
  }

  /**
   * Set data
   */
  setData(key: string, value: unknown): this {
    if (this.isRecording()) {
      this._data[key] = value;
    }
    return this;
  }

  // ============================================
  // Status methods
  // ============================================

  /**
   * Set the span status
   */
  setStatus(status: SpanStatus | SpanStatusCode): this {
    if (typeof status === 'string') {
      this._status = { code: status };
    } else {
      this._status = status;
    }
    return this;
  }

  // ============================================
  // Relationship methods
  // ============================================

  /**
   * Add a child span
   */
  addChild(span: Span): void {
    this._children.push(span);
    span._parent = this;
    span._parentSpanId = this._spanId;
    span._traceId = this._traceId;
  }

  /**
   * Get the parent span
   */
  getParent(): Span | undefined {
    return this._parent;
  }

  /**
   * Start a child span
   */
  startChild(options: StartSpanOptions): Span {
    const child = new Span({
      ...options,
      traceId: this._traceId,
      parentSpanId: this._spanId,
      sampled: options.sampled ?? this._sampled,
    });
    this.addChild(child);
    return child;
  }

  // ============================================
  // Context methods
  // ============================================

  /**
   * Get the span context for distributed tracing
   */
  spanContext(): SpanContext {
    return {
      traceId: this._traceId,
      spanId: this._spanId,
      parentSpanId: this._parentSpanId,
      sampled: this._sampled,
      traceFlags: this._sampled ? 1 : 0,
    };
  }

  // ============================================
  // Serialization methods
  // ============================================

  /**
   * Convert to JSON for sending to Sentry
   */
  toJSON(): SpanJSON {
    const json: SpanJSON = {
      span_id: this._spanId,
      trace_id: this._traceId,
      start_timestamp: this._startTimestamp,
    };

    if (this._parentSpanId) {
      json.parent_span_id = this._parentSpanId;
    }

    if (this._op) {
      json.op = this._op;
    }

    if (this._name) {
      json.description = this._name;
    }

    if (this._status.code !== 'unset') {
      json.status = this._status.code;
    }

    if (this._endTimestamp !== undefined) {
      json.timestamp = this._endTimestamp;
    }

    if (Object.keys(this._tags).length > 0) {
      json.tags = { ...this._tags };
    }

    // Merge attributes and data
    const combinedData = { ...this._data };
    for (const [key, value] of Object.entries(this._attributes)) {
      if (value !== undefined && value !== null) {
        combinedData[key] = value;
      }
    }
    if (Object.keys(combinedData).length > 0) {
      json.data = combinedData;
    }

    if (this._origin) {
      json.origin = this._origin;
    }

    return json;
  }

  /**
   * Get the duration of this span in seconds
   */
  getDuration(): number | undefined {
    if (this._endTimestamp === undefined) {
      return undefined;
    }
    return this._endTimestamp - this._startTimestamp;
  }

  /**
   * Update the span name
   */
  updateName(name: string): this {
    this._name = name;
    return this;
  }
}
