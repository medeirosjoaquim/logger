/**
 * Scope-related type definitions
 * Scopes hold contextual data that is applied to events
 */

import type {
  Breadcrumb,
  Contexts,
  Event,
  EventHint,
  Primitive,
  SeverityLevel,
  User,
} from './sentry';
import type { Span } from './span';

/**
 * Callback function type for scope modification.
 */
export type ScopeCallback = (scope: ScopeData) => ScopeData;

/**
 * Generic context record type.
 */
export type ScopeContext = Record<string, unknown>;

/**
 * Event processor function type.
 * Receives an event and hint, returns modified event or null to drop.
 */
export type EventProcessor = (
  event: Event,
  hint: EventHint
) => Event | null | PromiseLike<Event | null>;

/**
 * Attachment data for scope.
 */
export interface ScopeAttachment {
  /**
   * The filename of the attachment.
   */
  filename: string;

  /**
   * The attachment data as string or bytes.
   */
  data: string | Uint8Array;

  /**
   * MIME content type.
   */
  contentType?: string;

  /**
   * Type of attachment.
   */
  attachmentType?: string;
}

/**
 * Propagation context for distributed tracing.
 */
export interface PropagationContext {
  /**
   * The trace ID.
   */
  traceId: string;

  /**
   * The span ID.
   */
  spanId: string;

  /**
   * The parent span ID if any.
   */
  parentSpanId?: string;

  /**
   * Whether sampling decision has been made.
   */
  sampled?: boolean;

  /**
   * Dynamic sampling context.
   */
  dsc?: DynamicSamplingContext;
}

/**
 * Dynamic sampling context for trace-based sampling.
 */
export interface DynamicSamplingContext {
  /**
   * Trace ID.
   */
  trace_id?: string;

  /**
   * Public key from DSN.
   */
  public_key?: string;

  /**
   * Sample rate applied.
   */
  sample_rate?: string;

  /**
   * Release version.
   */
  release?: string;

  /**
   * Environment name.
   */
  environment?: string;

  /**
   * Transaction name.
   */
  transaction?: string;

  /**
   * Whether user segment was set.
   */
  user_segment?: string;

  /**
   * Replay ID if replay is active.
   */
  replay_id?: string;

  /**
   * Whether this is a segment sample.
   */
  sampled?: string;
}

/**
 * Complete scope data structure.
 * Holds all contextual information that can be attached to events.
 */
export interface ScopeData {
  /**
   * User information for the current scope.
   */
  user?: User;

  /**
   * Tags attached to events in this scope.
   * Tags are indexed and searchable in Sentry.
   */
  tags: Record<string, Primitive>;

  /**
   * Extra data attached to events in this scope.
   * Extras are not indexed but are displayed in event details.
   */
  extras: Record<string, unknown>;

  /**
   * Contexts provide structured data about the environment.
   */
  contexts: Contexts;

  /**
   * Breadcrumbs are a trail of events leading up to an issue.
   */
  breadcrumbs: Breadcrumb[];

  /**
   * Fingerprint for custom issue grouping.
   */
  fingerprint: string[];

  /**
   * Default severity level for events in this scope.
   */
  level?: SeverityLevel;

  /**
   * Transaction name for performance monitoring.
   */
  transactionName?: string;

  /**
   * The active span for tracing.
   */
  span?: Span;

  /**
   * Session associated with this scope.
   */
  session?: unknown;

  /**
   * Request data for the current scope.
   */
  request?: Event['request'];

  /**
   * Event processors to run on events.
   */
  eventProcessors: EventProcessor[];

  /**
   * Attachments to include with events.
   */
  attachments: ScopeAttachment[];

  /**
   * Propagation context for distributed tracing.
   */
  propagationContext: PropagationContext;

  /**
   * SDK processing metadata.
   */
  sdkProcessingMetadata: Record<string, unknown>;

  /**
   * Whether to clear breadcrumbs on this scope.
   */
  clearBreadcrumbs?: boolean;
}

/**
 * Options for creating a new scope.
 */
export interface ScopeOptions {
  /**
   * Initial user data.
   */
  user?: User;

  /**
   * Initial tags.
   */
  tags?: Record<string, Primitive>;

  /**
   * Initial extra data.
   */
  extras?: Record<string, unknown>;

  /**
   * Initial contexts.
   */
  contexts?: Contexts;

  /**
   * Initial breadcrumbs.
   */
  breadcrumbs?: Breadcrumb[];

  /**
   * Initial fingerprint.
   */
  fingerprint?: string[];

  /**
   * Initial level.
   */
  level?: SeverityLevel;
}

/**
 * Interface for scope-like objects.
 */
export interface ScopeLike {
  /**
   * Set the user for this scope.
   */
  setUser(user: User | null): this;

  /**
   * Set a tag on this scope.
   */
  setTag(key: string, value: Primitive): this;

  /**
   * Set multiple tags on this scope.
   */
  setTags(tags: Record<string, Primitive>): this;

  /**
   * Set extra data on this scope.
   */
  setExtra(key: string, value: unknown): this;

  /**
   * Set multiple extras on this scope.
   */
  setExtras(extras: Record<string, unknown>): this;

  /**
   * Set a context on this scope.
   */
  setContext(name: string, context: ScopeContext | null): this;

  /**
   * Set the severity level for this scope.
   */
  setLevel(level: SeverityLevel): this;

  /**
   * Set the transaction name for this scope.
   */
  setTransactionName(name: string): this;

  /**
   * Set the fingerprint for this scope.
   */
  setFingerprint(fingerprint: string[]): this;

  /**
   * Add a breadcrumb to this scope.
   */
  addBreadcrumb(breadcrumb: Breadcrumb, maxBreadcrumbs?: number): this;

  /**
   * Clear all breadcrumbs from this scope.
   */
  clearBreadcrumbs(): this;

  /**
   * Add an event processor to this scope.
   */
  addEventProcessor(processor: EventProcessor): this;

  /**
   * Add an attachment to this scope.
   */
  addAttachment(attachment: ScopeAttachment): this;

  /**
   * Clear all attachments from this scope.
   */
  clearAttachments(): this;

  /**
   * Clear this scope, resetting all data.
   */
  clear(): this;

  /**
   * Clone this scope.
   */
  clone(): ScopeLike;

  /**
   * Get the scope data.
   */
  getScopeData(): ScopeData;

  /**
   * Set the span for this scope.
   */
  setSpan(span?: Span): this;

  /**
   * Get the current span.
   */
  getSpan(): Span | undefined;

  /**
   * Set the propagation context.
   */
  setPropagationContext(context: PropagationContext): this;

  /**
   * Get the propagation context.
   */
  getPropagationContext(): PropagationContext;

  /**
   * Apply this scope to an event.
   */
  applyToEvent(event: Event, hint?: EventHint): Event | null | PromiseLike<Event | null>;
}

/**
 * Interface for the isolation scope.
 */
export interface IsolationScope extends ScopeLike {
  /**
   * The scope type identifier.
   */
  readonly type: 'isolation';
}

/**
 * Interface for the current scope.
 */
export interface CurrentScope extends ScopeLike {
  /**
   * The scope type identifier.
   */
  readonly type: 'current';
}

/**
 * Interface for the global scope.
 */
export interface GlobalScope extends ScopeLike {
  /**
   * The scope type identifier.
   */
  readonly type: 'global';
}

/**
 * Union type for all scope types.
 */
export type AnyScope = IsolationScope | CurrentScope | GlobalScope | ScopeLike;
