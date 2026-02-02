/**
 * Event Processing Pipeline
 *
 * Handles the complete lifecycle of events from capture to storage/forwarding.
 * Implements sampling, filtering, processing, and the beforeSend hook chain.
 */

import type {
  Event,
  EventHint,
  EventProcessor,
  ClientOptions,
  ScopeLike,
} from '../types';
import type { StorageProvider, SentryEvent } from '../storage/types';
import { generateEventId, timestampInSeconds, isThenable } from './utils';
import { finalizeEvent } from './eventbuilder';

/**
 * Pipeline options derived from client options.
 */
export interface PipelineOptions {
  /** Sample rate for error events (0.0 to 1.0) */
  sampleRate?: number;
  /** Sample rate for transactions (0.0 to 1.0) */
  tracesSampleRate?: number;
  /** Callback to modify/drop events before sending */
  beforeSend?: ClientOptions['beforeSend'];
  /** Callback to modify/drop transactions before sending */
  beforeSendTransaction?: ClientOptions['beforeSendTransaction'];
  /** Patterns for error messages to ignore */
  ignoreErrors?: Array<string | RegExp>;
  /** Patterns for transaction names to ignore */
  ignoreTransactions?: Array<string | RegExp>;
  /** URL patterns to deny */
  denyUrls?: Array<string | RegExp>;
  /** URL patterns to allow */
  allowUrls?: Array<string | RegExp>;
  /** Maximum length for string values */
  maxValueLength?: number;
  /** Depth for normalizing objects */
  normalizeDepth?: number;
  /** Maximum properties per object level */
  normalizeMaxBreadth?: number;
  /** Enable debug logging */
  debug?: boolean;
}

/**
 * Pipeline result indicating what happened to the event.
 */
export interface PipelineResult {
  /** The processed event, or null if dropped */
  event: Event | null;
  /** Reason for dropping if event is null */
  reason?: 'sampled' | 'filtered' | 'beforeSend' | 'eventProcessor' | 'error';
  /** Additional details about why event was dropped */
  details?: string;
}

/**
 * Event Processing Pipeline
 *
 * Processes events through multiple stages:
 * 1. Pre-processing (ID generation, timestamps)
 * 2. Event processors (integration hooks)
 * 3. Sampling (random sampling based on rate)
 * 4. Filtering (ignoreErrors, denyUrls, allowUrls)
 * 5. beforeSend hook
 * 6. Finalization (normalization, truncation)
 * 7. Storage (local persistence)
 * 8. Forwarding (to Sentry if in proxy mode)
 *
 * @example
 * ```typescript
 * const pipeline = new EventPipeline(options, storage);
 * const result = await pipeline.processEvent(event, hint);
 * if (result.event) {
 *   // Event was processed and stored
 * } else {
 *   // Event was dropped, reason: result.reason
 * }
 * ```
 */
export class EventPipeline {
  private readonly options: PipelineOptions;
  private readonly storage: StorageProvider | null;
  private readonly eventProcessors: EventProcessor[] = [];
  private readonly forwardToSentry: boolean = false;

  /**
   * Creates a new event processing pipeline.
   *
   * @param options - Pipeline configuration options
   * @param storage - Storage provider for persisting events
   */
  constructor(options: PipelineOptions, storage: StorageProvider | null) {
    this.options = options;
    this.storage = storage;
  }

  /**
   * Processes an event through the pipeline.
   *
   * @param event - The event to process
   * @param hint - Optional event hint with additional context
   * @param scope - Optional scope to apply
   * @returns Pipeline result with processed event or null if dropped
   */
  async processEvent(
    event: Event,
    hint?: EventHint,
    scope?: ScopeLike
  ): Promise<PipelineResult> {
    try {
      // Stage 1: Pre-processing
      let processedEvent = this.preProcess(event, hint);

      // Stage 2: Apply scope
      if (scope) {
        const scopeResult = scope.applyToEvent(processedEvent, hint);
        if (scopeResult === null) {
          return { event: null, reason: 'eventProcessor', details: 'Scope returned null' };
        }
        if (isThenable(scopeResult)) {
          const resolvedEvent = await scopeResult;
          if (resolvedEvent === null) {
            return { event: null, reason: 'eventProcessor', details: 'Scope returned null' };
          }
          processedEvent = resolvedEvent;
        } else {
          processedEvent = scopeResult;
        }
      }

      // Stage 3: Event processors
      const processorsResult = await this.runEventProcessors(processedEvent, hint);
      if (processorsResult === null) {
        return { event: null, reason: 'eventProcessor' };
      }
      processedEvent = processorsResult;

      // Stage 4: Sampling
      if (!this.applySampling(processedEvent)) {
        return { event: null, reason: 'sampled' };
      }

      // Stage 5: Filtering
      const filterResult = this.applyFiltering(processedEvent);
      if (filterResult !== true) {
        return { event: null, reason: 'filtered', details: filterResult };
      }

      // Stage 6: beforeSend hook
      const beforeSendResult = await this.runBeforeSend(processedEvent, hint);
      if (beforeSendResult === null) {
        return { event: null, reason: 'beforeSend' };
      }
      processedEvent = beforeSendResult;

      // Stage 7: Finalization
      processedEvent = finalizeEvent(processedEvent, {
        maxValueLength: this.options.maxValueLength,
        normalizeDepth: this.options.normalizeDepth,
        normalizeMaxBreadth: this.options.normalizeMaxBreadth,
      });

      // Stage 8: Storage
      await this.storeEvent(processedEvent);

      // Stage 9: Forwarding (if enabled)
      if (this.forwardToSentry) {
        await this.forwardEvent(processedEvent);
      }

      return { event: processedEvent };
    } catch (error) {
      this.logDebug('Pipeline error:', error);
      return {
        event: null,
        reason: 'error',
        details: error instanceof Error ? error.message : String(error),
      };
    }
  }

  /**
   * Adds an event processor to the pipeline.
   *
   * @param processor - Event processor function
   */
  addEventProcessor(processor: EventProcessor): void {
    this.eventProcessors.push(processor);
  }

  /**
   * Removes all event processors.
   */
  clearEventProcessors(): void {
    this.eventProcessors.length = 0;
  }

  /**
   * Gets all registered event processors.
   */
  getEventProcessors(): EventProcessor[] {
    return [...this.eventProcessors];
  }

  // =========================================================================
  // Private Pipeline Stages
  // =========================================================================

  /**
   * Pre-processes an event (assigns ID, timestamp, etc.).
   */
  private preProcess(event: Event, hint?: EventHint): Event {
    // Ensure event has an ID
    if (!event.event_id) {
      event.event_id = hint?.event_id || generateEventId();
    }

    // Ensure event has a timestamp
    if (!event.timestamp) {
      event.timestamp = timestampInSeconds();
    }

    // Set default platform
    if (!event.platform) {
      event.platform = 'javascript';
    }

    // Set default level for non-transaction events
    if (!event.level && event.type !== 'transaction') {
      event.level = 'error';
    }

    return event;
  }

  /**
   * Runs all event processors on the event.
   */
  private async runEventProcessors(
    event: Event,
    hint?: EventHint
  ): Promise<Event | null> {
    let processedEvent: Event | null = event;

    for (const processor of this.eventProcessors) {
      if (processedEvent === null) {
        break;
      }

      try {
        const result = processor(processedEvent, hint || {});

        if (isThenable(result)) {
          processedEvent = await result;
        } else {
          processedEvent = result;
        }
      } catch (error) {
        this.logDebug('Event processor error:', error);
        // Continue with next processor on error
      }
    }

    return processedEvent;
  }

  /**
   * Runs the beforeSend hook.
   */
  private async runBeforeSend(
    event: Event,
    hint?: EventHint
  ): Promise<Event | null> {
    const isTransaction = event.type === 'transaction';

    // Select appropriate callback
    const callback = isTransaction
      ? this.options.beforeSendTransaction
      : this.options.beforeSend;

    if (!callback) {
      return event;
    }

    try {
      const result = callback(event, hint || {});

      if (isThenable(result)) {
        return await result;
      }

      return result;
    } catch (error) {
      this.logDebug('beforeSend error:', error);
      // Return null to drop the event on error
      return null;
    }
  }

  /**
   * Applies sampling to determine if the event should be sent.
   */
  private applySampling(event: Event): boolean {
    const isTransaction = event.type === 'transaction';
    const sampleRate = isTransaction
      ? this.options.tracesSampleRate
      : this.options.sampleRate;

    // If no sample rate is configured, send all events
    if (sampleRate === undefined || sampleRate === null) {
      return true;
    }

    // Always send if rate is 1.0
    if (sampleRate >= 1.0) {
      return true;
    }

    // Never send if rate is 0
    if (sampleRate <= 0) {
      return false;
    }

    // Random sampling
    return Math.random() < sampleRate;
  }

  /**
   * Applies filtering rules to determine if the event should be sent.
   *
   * @returns true if event should be sent, or a string describing why it was filtered
   */
  private applyFiltering(event: Event): true | string {
    // Check ignoreErrors
    if (this.checkIgnoreErrors(event)) {
      return 'Matched ignoreErrors pattern';
    }

    // Check ignoreTransactions
    if (this.checkIgnoreTransactions(event)) {
      return 'Matched ignoreTransactions pattern';
    }

    // Check denyUrls (only if allowUrls doesn't match)
    const urlCheckResult = this.checkUrls(event);
    if (urlCheckResult !== true) {
      return urlCheckResult;
    }

    return true;
  }

  /**
   * Checks if the event matches any ignoreErrors patterns.
   */
  private checkIgnoreErrors(event: Event): boolean {
    const patterns = this.options.ignoreErrors;
    if (!patterns || patterns.length === 0) {
      return false;
    }

    // Get error messages to check
    const messages: string[] = [];

    if (typeof event.message === 'string') {
      messages.push(event.message);
    } else if (event.message?.message) {
      messages.push(event.message.message);
    }

    if (event.exception?.values) {
      for (const exception of event.exception.values) {
        if (exception.type) {
          messages.push(exception.type);
        }
        if (exception.value) {
          messages.push(exception.value);
        }
      }
    }

    return this.matchesPatterns(messages, patterns);
  }

  /**
   * Checks if the event matches any ignoreTransactions patterns.
   */
  private checkIgnoreTransactions(event: Event): boolean {
    if (event.type !== 'transaction') {
      return false;
    }

    const patterns = this.options.ignoreTransactions;
    if (!patterns || patterns.length === 0) {
      return false;
    }

    const transactionName = event.transaction;
    if (!transactionName) {
      return false;
    }

    return this.matchesPatterns([transactionName], patterns);
  }

  /**
   * Checks URL-based filtering (denyUrls/allowUrls).
   */
  private checkUrls(event: Event): true | string {
    const url = this.getEventUrl(event);
    if (!url) {
      return true;
    }

    // Check allowUrls first (if configured, URL must match)
    if (this.options.allowUrls && this.options.allowUrls.length > 0) {
      if (!this.matchesPatterns([url], this.options.allowUrls)) {
        return 'URL not in allowUrls';
      }
    }

    // Check denyUrls
    if (this.options.denyUrls && this.options.denyUrls.length > 0) {
      if (this.matchesPatterns([url], this.options.denyUrls)) {
        return 'URL matched denyUrls';
      }
    }

    return true;
  }

  /**
   * Gets the URL from an event for filtering.
   */
  private getEventUrl(event: Event): string | null {
    // Check request URL
    if (event.request?.url) {
      return event.request.url;
    }

    // Check stack frames for URL
    if (event.exception?.values) {
      for (const exception of event.exception.values) {
        if (exception.stacktrace?.frames) {
          for (const frame of exception.stacktrace.frames) {
            if (frame.filename && frame.filename.startsWith('http')) {
              return frame.filename;
            }
            if (frame.abs_path && frame.abs_path.startsWith('http')) {
              return frame.abs_path;
            }
          }
        }
      }
    }

    return null;
  }

  /**
   * Checks if any values match any patterns.
   */
  private matchesPatterns(
    values: string[],
    patterns: Array<string | RegExp>
  ): boolean {
    for (const value of values) {
      for (const pattern of patterns) {
        if (typeof pattern === 'string') {
          if (value.includes(pattern)) {
            return true;
          }
        } else if (pattern instanceof RegExp) {
          if (pattern.test(value)) {
            return true;
          }
        }
      }
    }
    return false;
  }

  /**
   * Stores an event in local storage.
   */
  private async storeEvent(event: Event): Promise<void> {
    if (!this.storage) {
      return;
    }

    try {
      // Convert to SentryEvent format for storage
      // Use type assertion since the Event and SentryEvent types are structurally compatible
      const sentryEvent = {
        ...event,
        event_id: event.event_id || generateEventId(),
        timestamp: typeof event.timestamp === 'number'
          ? new Date(event.timestamp * 1000).toISOString()
          : (event.timestamp as string) || new Date().toISOString(),
        _localTimestamp: new Date().toISOString(),
        _forwarded: false,
      } as SentryEvent;

      await this.storage.saveSentryEvent(sentryEvent);
    } catch (error) {
      this.logDebug('Failed to store event:', error);
    }
  }

  /**
   * Forwards an event to Sentry (placeholder for proxy mode).
   */
  private async forwardEvent(_event: Event): Promise<void> {
    // This will be implemented in the proxy module
    // For now, it's a no-op
  }

  /**
   * Logs debug messages if debug mode is enabled.
   */
  private logDebug(...args: unknown[]): void {
    if (this.options.debug) {
      console.debug('[UniversalLogger Pipeline]', ...args);
    }
  }
}

/**
 * Creates a default event pipeline with standard configuration.
 *
 * @param options - Client options to derive pipeline options from
 * @param storage - Storage provider
 * @returns Configured event pipeline
 */
export function createDefaultPipeline(
  options: ClientOptions,
  storage: StorageProvider | null
): EventPipeline {
  return new EventPipeline(
    {
      sampleRate: options.sampleRate,
      tracesSampleRate: options.tracesSampleRate,
      beforeSend: options.beforeSend,
      beforeSendTransaction: options.beforeSendTransaction,
      ignoreErrors: options.ignoreErrors,
      ignoreTransactions: options.ignoreTransactions,
      denyUrls: options.denyUrls,
      allowUrls: options.allowUrls,
      maxValueLength: options.maxValueLength,
      normalizeDepth: options.normalizeDepth,
      normalizeMaxBreadth: options.normalizeMaxBreadth,
      debug: options.debug,
    },
    storage
  );
}
