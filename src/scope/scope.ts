/**
 * Scope Implementation
 *
 * The Scope class holds contextual data that is applied to events.
 * This is a Sentry-compatible implementation that supports:
 * - User information
 * - Tags and extras
 * - Breadcrumbs
 * - Contexts
 * - Event processors
 * - Fingerprinting
 * - Propagation context for distributed tracing
 */

import type {
  Breadcrumb,
  Event,
  EventHint,
  SeverityLevel,
  User,
} from '../types/sentry.js';
import {
  generatePropagationContext,
  type PropagationContext,
} from './propagationContext.js';

/**
 * Event processor function type.
 * Can modify events or return null to drop them.
 */
export type EventProcessor = (
  event: Event,
  hint?: EventHint
) => Promise<Event | null> | Event | null;

/**
 * Span interface for tracing integration
 */
export interface Span {
  spanId: string;
  traceId: string;
  parentSpanId?: string;
  name: string;
  op?: string;
  status?: string;
  startTimestamp: number;
  endTimestamp?: number;
  tags?: Record<string, string>;
  data?: Record<string, unknown>;
}

/**
 * Attachment data for scope
 */
export interface ScopeAttachment {
  filename: string;
  data: string | Uint8Array | Blob;
  contentType?: string;
  attachmentType?: 'event.attachment' | 'event.minidump' | 'event.applecrashreport' | 'event.view_hierarchy' | 'unreal.context' | 'unreal.logs';
}

/**
 * Data that can be used to update a scope
 */
export interface ScopeData {
  user?: User;
  tags?: Record<string, string>;
  extras?: Record<string, unknown>;
  contexts?: Record<string, Record<string, unknown>>;
  breadcrumbs?: Breadcrumb[];
  fingerprint?: string[];
  level?: SeverityLevel;
  transactionName?: string;
  propagationContext?: PropagationContext;
  eventProcessors?: EventProcessor[];
  attachments?: ScopeAttachment[];
  sdkProcessingMetadata?: Record<string, unknown>;
}

/**
 * Default maximum number of breadcrumbs to keep
 */
const DEFAULT_MAX_BREADCRUMBS = 100;

/**
 * Scope class for holding contextual data applied to events
 */
export class Scope {
  private user: User | undefined;
  private tags: Record<string, string> = {};
  private extras: Record<string, unknown> = {};
  private contexts: Record<string, Record<string, unknown>> = {};
  private breadcrumbs: Breadcrumb[] = [];
  private fingerprint: string[] = [];
  private level: SeverityLevel | undefined;
  private transactionName: string | undefined;
  private span: Span | undefined;
  private eventProcessors: EventProcessor[] = [];
  private propagationContext: PropagationContext;
  private attachments: ScopeAttachment[] = [];

  constructor() {
    this.propagationContext = generatePropagationContext();
  }

  // ===========================================================================
  // User Management
  // ===========================================================================

  /**
   * Sets the user for this scope
   * @param user - User object or null to clear
   */
  setUser(user: User | null): this {
    this.user = user ?? undefined;
    return this;
  }

  /**
   * Gets the current user
   */
  getUser(): User | undefined {
    return this.user;
  }

  // ===========================================================================
  // Tags
  // ===========================================================================

  /**
   * Sets a single tag
   * @param key - Tag key
   * @param value - Tag value (will be stringified)
   */
  setTag(key: string, value: string): this {
    this.tags[key] = value;
    return this;
  }

  /**
   * Sets multiple tags at once
   * @param tags - Object containing key-value pairs
   */
  setTags(tags: Record<string, string>): this {
    this.tags = { ...this.tags, ...tags };
    return this;
  }

  /**
   * Gets a single tag value
   * @param key - Tag key
   */
  getTag(key: string): string | undefined {
    return this.tags[key];
  }

  /**
   * Gets all tags
   */
  getTags(): Record<string, string> {
    return { ...this.tags };
  }

  // ===========================================================================
  // Extras
  // ===========================================================================

  /**
   * Sets a single extra value
   * @param key - Extra key
   * @param value - Extra value (any serializable value)
   */
  setExtra(key: string, value: unknown): this {
    this.extras[key] = value;
    return this;
  }

  /**
   * Sets multiple extras at once
   * @param extras - Object containing key-value pairs
   */
  setExtras(extras: Record<string, unknown>): this {
    this.extras = { ...this.extras, ...extras };
    return this;
  }

  /**
   * Gets a single extra value
   * @param key - Extra key
   */
  getExtra(key: string): unknown {
    return this.extras[key];
  }

  /**
   * Gets all extras
   */
  getExtras(): Record<string, unknown> {
    return { ...this.extras };
  }

  // ===========================================================================
  // Contexts
  // ===========================================================================

  /**
   * Sets a context
   * @param key - Context name (e.g., 'device', 'browser', 'app')
   * @param context - Context object or null to remove
   */
  setContext(key: string, context: Record<string, unknown> | null): this {
    if (context === null) {
      delete this.contexts[key];
    } else {
      this.contexts[key] = context;
    }
    return this;
  }

  /**
   * Gets a specific context
   * @param key - Context name
   */
  getContext(key: string): Record<string, unknown> | undefined {
    return this.contexts[key];
  }

  /**
   * Gets all contexts
   */
  getContexts(): Record<string, Record<string, unknown>> {
    // Deep clone to prevent external modification
    const result: Record<string, Record<string, unknown>> = {};
    for (const [key, value] of Object.entries(this.contexts)) {
      result[key] = { ...value };
    }
    return result;
  }

  // ===========================================================================
  // Breadcrumbs
  // ===========================================================================

  /**
   * Adds a breadcrumb to the scope
   * @param breadcrumb - Breadcrumb to add
   * @param maxBreadcrumbs - Maximum breadcrumbs to keep (default: 100)
   */
  addBreadcrumb(
    breadcrumb: Breadcrumb,
    maxBreadcrumbs: number = DEFAULT_MAX_BREADCRUMBS
  ): this {
    // Ensure timestamp is set
    const timestampedBreadcrumb: Breadcrumb = {
      timestamp: Date.now() / 1000,
      ...breadcrumb,
    };

    this.breadcrumbs.push(timestampedBreadcrumb);

    // Trim to max breadcrumbs, keeping the most recent
    if (this.breadcrumbs.length > maxBreadcrumbs) {
      this.breadcrumbs = this.breadcrumbs.slice(-maxBreadcrumbs);
    }

    return this;
  }

  /**
   * Gets all breadcrumbs
   */
  getBreadcrumbs(): Breadcrumb[] {
    return [...this.breadcrumbs];
  }

  /**
   * Clears all breadcrumbs
   */
  clearBreadcrumbs(): this {
    this.breadcrumbs = [];
    return this;
  }

  // ===========================================================================
  // Fingerprint
  // ===========================================================================

  /**
   * Sets the fingerprint for issue grouping
   * @param fingerprint - Array of strings for grouping
   */
  setFingerprint(fingerprint: string[]): this {
    this.fingerprint = [...fingerprint];
    return this;
  }

  /**
   * Gets the current fingerprint
   */
  getFingerprint(): string[] {
    return [...this.fingerprint];
  }

  // ===========================================================================
  // Level
  // ===========================================================================

  /**
   * Sets the severity level
   * @param level - Severity level
   */
  setLevel(level: SeverityLevel): this {
    this.level = level;
    return this;
  }

  /**
   * Gets the current level
   */
  getLevel(): SeverityLevel | undefined {
    return this.level;
  }

  // ===========================================================================
  // Transaction
  // ===========================================================================

  /**
   * Sets the transaction name
   * @param name - Transaction name
   */
  setTransactionName(name: string): this {
    this.transactionName = name;
    return this;
  }

  /**
   * Gets the current transaction name
   */
  getTransactionName(): string | undefined {
    return this.transactionName;
  }

  // ===========================================================================
  // Span
  // ===========================================================================

  /**
   * Sets the active span for this scope
   * @param span - Span object or undefined to clear
   */
  setSpan(span: Span | undefined): this {
    this.span = span;
    return this;
  }

  /**
   * Gets the active span
   */
  getSpan(): Span | undefined {
    return this.span;
  }

  // ===========================================================================
  // Event Processors
  // ===========================================================================

  /**
   * Adds an event processor
   * @param processor - Event processor function
   */
  addEventProcessor(processor: EventProcessor): this {
    this.eventProcessors.push(processor);
    return this;
  }

  /**
   * Gets all event processors
   */
  getEventProcessors(): EventProcessor[] {
    return [...this.eventProcessors];
  }

  // ===========================================================================
  // Attachments
  // ===========================================================================

  /**
   * Adds an attachment to the scope
   * @param attachment - Attachment to add
   */
  addAttachment(attachment: ScopeAttachment): this {
    this.attachments.push(attachment);
    return this;
  }

  /**
   * Gets all attachments
   */
  getAttachments(): ScopeAttachment[] {
    return [...this.attachments];
  }

  /**
   * Clears all attachments
   */
  clearAttachments(): this {
    this.attachments = [];
    return this;
  }

  // ===========================================================================
  // Propagation Context
  // ===========================================================================

  /**
   * Gets the propagation context
   */
  getPropagationContext(): PropagationContext {
    return { ...this.propagationContext };
  }

  /**
   * Sets the propagation context
   * @param context - Propagation context
   */
  setPropagationContext(context: PropagationContext): this {
    this.propagationContext = { ...context };
    return this;
  }

  // ===========================================================================
  // Clone / Fork
  // ===========================================================================

  /**
   * Creates a clone of this scope
   * The clone is independent and modifications won't affect the original
   */
  clone(): Scope {
    const newScope = new Scope();

    // Copy primitive values
    newScope.user = this.user ? { ...this.user } : undefined;
    newScope.tags = { ...this.tags };
    newScope.extras = { ...this.extras };
    newScope.fingerprint = [...this.fingerprint];
    newScope.level = this.level;
    newScope.transactionName = this.transactionName;

    // Deep copy contexts
    for (const [key, value] of Object.entries(this.contexts)) {
      newScope.contexts[key] = { ...value };
    }

    // Copy breadcrumbs (shallow copy of each breadcrumb object)
    newScope.breadcrumbs = this.breadcrumbs.map((b) => ({ ...b }));

    // Copy span
    newScope.span = this.span ? { ...this.span } : undefined;

    // Copy event processors (by reference - they're functions)
    newScope.eventProcessors = [...this.eventProcessors];

    // Copy propagation context
    newScope.propagationContext = { ...this.propagationContext };

    // Copy attachments (shallow copy of each attachment object)
    newScope.attachments = this.attachments.map((a) => ({ ...a }));

    return newScope;
  }

  // ===========================================================================
  // Apply to Event
  // ===========================================================================

  /**
   * Applies scope data to an event
   * @param event - Event to modify
   * @param hint - Optional event hint
   * @returns Modified event or null if dropped
   */
  async applyToEvent(
    event: Event,
    hint?: EventHint
  ): Promise<Event | null> {
    // Clone the event to avoid mutating the original
    let processedEvent: Event = { ...event };

    // Apply user
    if (this.user) {
      processedEvent.user = { ...this.user, ...processedEvent.user };
    }

    // Apply tags
    if (Object.keys(this.tags).length > 0) {
      processedEvent.tags = { ...this.tags, ...processedEvent.tags };
    }

    // Apply extras
    if (Object.keys(this.extras).length > 0) {
      processedEvent.extra = { ...this.extras, ...processedEvent.extra };
    }

    // Apply contexts
    if (Object.keys(this.contexts).length > 0) {
      processedEvent.contexts = {
        ...this.contexts,
        ...processedEvent.contexts,
      };
    }

    // Apply breadcrumbs
    if (this.breadcrumbs.length > 0) {
      const eventBreadcrumbs = processedEvent.breadcrumbs || [];
      processedEvent.breadcrumbs = [
        ...this.breadcrumbs,
        ...eventBreadcrumbs,
      ];
    }

    // Apply fingerprint (scope fingerprint takes precedence)
    if (this.fingerprint.length > 0) {
      processedEvent.fingerprint = this.fingerprint;
    }

    // Apply level (only if not set on event)
    if (this.level && !processedEvent.level) {
      processedEvent.level = this.level;
    }

    // Apply transaction name
    if (this.transactionName && !processedEvent.transaction) {
      processedEvent.transaction = this.transactionName;
    }

    // Apply trace context from span or propagation context
    if (this.span || this.propagationContext) {
      const traceContext: Record<string, unknown> = {};

      if (this.span) {
        traceContext.span_id = this.span.spanId;
        traceContext.trace_id = this.span.traceId;
        if (this.span.parentSpanId) {
          traceContext.parent_span_id = this.span.parentSpanId;
        }
        if (this.span.op) {
          traceContext.op = this.span.op;
        }
        if (this.span.status) {
          traceContext.status = this.span.status;
        }
      } else {
        traceContext.span_id = this.propagationContext.spanId;
        traceContext.trace_id = this.propagationContext.traceId;
        if (this.propagationContext.parentSpanId) {
          traceContext.parent_span_id = this.propagationContext.parentSpanId;
        }
      }

      processedEvent.contexts = {
        ...processedEvent.contexts,
        trace: {
          ...(processedEvent.contexts?.trace as Record<string, unknown>),
          ...traceContext,
        },
      };
    }

    // Run event processors
    for (const processor of this.eventProcessors) {
      const result = await processor(processedEvent, hint);
      if (result === null) {
        return null;
      }
      processedEvent = result;
    }

    return processedEvent;
  }

  // ===========================================================================
  // Get Scope Data
  // ===========================================================================

  /**
   * Returns all scope data as an object
   */
  getScopeData(): ScopeData {
    return {
      user: this.user,
      tags: { ...this.tags },
      extras: { ...this.extras },
      contexts: this.getContexts(),
      breadcrumbs: [...this.breadcrumbs],
      fingerprint: [...this.fingerprint],
      level: this.level,
      transactionName: this.transactionName,
      propagationContext: this.getPropagationContext(),
      eventProcessors: [...this.eventProcessors],
      attachments: [...this.attachments],
      sdkProcessingMetadata: {},
    };
  }

  // ===========================================================================
  // Clear
  // ===========================================================================

  /**
   * Clears all scope data
   */
  clear(): this {
    this.user = undefined;
    this.tags = {};
    this.extras = {};
    this.contexts = {};
    this.breadcrumbs = [];
    this.fingerprint = [];
    this.level = undefined;
    this.transactionName = undefined;
    this.span = undefined;
    this.eventProcessors = [];
    this.propagationContext = generatePropagationContext();
    this.attachments = [];
    return this;
  }

  // ===========================================================================
  // Update
  // ===========================================================================

  /**
   * Updates this scope with data from another scope or scope data object
   * @param scope - Scope or Partial<ScopeData> to merge into this scope
   */
  update(scope: Scope | Partial<ScopeData> | undefined): this {
    if (!scope) {
      return this;
    }

    // Handle Scope instance
    if (scope instanceof Scope) {
      const user = scope.getUser();
      if (user) {
        this.setUser(user);
      }

      this.setTags(scope.getTags());
      this.setExtras(scope.getExtras());

      const contexts = scope.getContexts();
      for (const [key, value] of Object.entries(contexts)) {
        this.setContext(key, value);
      }

      for (const breadcrumb of scope.getBreadcrumbs()) {
        this.addBreadcrumb(breadcrumb);
      }

      const fingerprint = scope.getFingerprint();
      if (fingerprint.length > 0) {
        this.setFingerprint(fingerprint);
      }

      const level = scope.getLevel();
      if (level) {
        this.setLevel(level);
      }

      const transactionName = scope.getTransactionName();
      if (transactionName) {
        this.setTransactionName(transactionName);
      }

      const propagationContext = scope.getPropagationContext();
      if (propagationContext) {
        this.setPropagationContext(propagationContext);
      }

      return this;
    }

    // Handle ScopeData object
    if (scope.user) {
      this.setUser(scope.user);
    }

    if (scope.tags) {
      this.setTags(scope.tags);
    }

    if (scope.extras) {
      this.setExtras(scope.extras);
    }

    if (scope.contexts) {
      for (const [key, value] of Object.entries(scope.contexts)) {
        this.setContext(key, value);
      }
    }

    if (scope.breadcrumbs) {
      for (const breadcrumb of scope.breadcrumbs) {
        this.addBreadcrumb(breadcrumb);
      }
    }

    if (scope.fingerprint) {
      this.setFingerprint(scope.fingerprint);
    }

    if (scope.level) {
      this.setLevel(scope.level);
    }

    if (scope.transactionName) {
      this.setTransactionName(scope.transactionName);
    }

    if (scope.propagationContext) {
      this.setPropagationContext(scope.propagationContext);
    }

    return this;
  }
}
