/**
 * Transaction class implementation
 * A transaction is a special span that represents a complete trace
 */

import { Span } from './span';
import type {
  TransactionContext,
  TransactionMetadata,
  TransactionSource,
  TransactionJSON,
  SpanJSON,
  SamplingContext,
  Hub,
  StartSpanOptions,
} from './types';
import { generateEventId } from './idGenerator';

/**
 * Transaction class - a special span representing a complete trace
 */
export class Transaction extends Span {
  /**
   * Transaction name (may differ from span name)
   */
  private _transactionName: string;

  /**
   * Transaction metadata
   */
  private _metadata: TransactionMetadata;

  /**
   * All spans within this transaction
   */
  private _spans: Span[] = [];

  /**
   * Reference to the Hub
   */
  private _hub: Hub;

  /**
   * Whether to trim end timestamp to last child span
   */
  private _trimEnd: boolean;

  /**
   * Create a new Transaction
   */
  constructor(transactionContext: TransactionContext, hub: Hub) {
    super({
      name: transactionContext.name,
      op: transactionContext.op,
      attributes: transactionContext.attributes,
      tags: transactionContext.tags,
      data: transactionContext.data,
      startTime: transactionContext.startTime,
      traceId: transactionContext.traceId,
      parentSpanId: transactionContext.parentSpanId,
      sampled: transactionContext.sampled,
      origin: transactionContext.origin,
    });

    this._transactionName = transactionContext.name;
    this._metadata = {
      source: transactionContext.source || 'custom',
      ...transactionContext.metadata,
    };
    this._hub = hub;
    this._trimEnd = transactionContext.trimEnd ?? false;
  }

  // ============================================
  // Transaction-specific methods
  // ============================================

  /**
   * Get the transaction name
   */
  get transactionName(): string {
    return this._transactionName;
  }

  /**
   * Set the transaction name
   */
  setName(name: string, source?: TransactionSource): void {
    this._transactionName = name;
    this.name = name;
    if (source) {
      this._metadata.source = source;
    }
  }

  /**
   * Get the transaction metadata
   */
  get metadata(): TransactionMetadata {
    return { ...this._metadata };
  }

  /**
   * Set transaction metadata
   */
  setMetadata(metadata: Partial<TransactionMetadata>): void {
    this._metadata = { ...this._metadata, ...metadata };
  }

  /**
   * Get all spans in this transaction
   */
  get spans(): Span[] {
    return [...this._spans];
  }

  // ============================================
  // Child span methods
  // ============================================

  /**
   * Start a child span within this transaction
   */
  override startChild(spanContext: StartSpanOptions): Span {
    const span = super.startChild(spanContext);
    this._spans.push(span);
    return span;
  }

  /**
   * Register a span with this transaction
   */
  registerSpan(span: Span): void {
    this._spans.push(span);
  }

  // ============================================
  // Sampling methods
  // ============================================

  /**
   * Get the sampling context for this transaction
   */
  getSamplingContext(): SamplingContext {
    return {
      transactionContext: {
        name: this._transactionName,
        op: this.op,
        attributes: this.attributes,
        tags: this.tags,
        data: this.data,
        source: this._metadata.source,
        metadata: this._metadata,
      },
      parentSampled: undefined, // Would come from parent transaction
      name: this._transactionName,
      attributes: this.attributes,
    };
  }

  // ============================================
  // Finalization methods
  // ============================================

  /**
   * Finish the transaction and send it
   * Returns the event ID if sent, undefined otherwise
   */
  finish(endTimestamp?: number): string | undefined {
    // Don't finish if already finished
    if (this.endTimestamp !== undefined) {
      return undefined;
    }

    // End the span
    let finalEndTimestamp = endTimestamp;

    // If trimEnd is enabled, use the latest child span end time
    if (this._trimEnd && this._spans.length > 0) {
      let latestEndTime = 0;
      for (const span of this._spans) {
        const spanEndTime = span.endTimestamp;
        if (spanEndTime !== undefined && spanEndTime > latestEndTime) {
          latestEndTime = spanEndTime;
        }
      }
      if (latestEndTime > 0) {
        finalEndTimestamp = latestEndTime;
      }
    }

    this.end(finalEndTimestamp);

    // Don't send if not sampled
    if (this.sampled === false) {
      return undefined;
    }

    // Generate event ID
    const eventId = generateEventId();

    // Build the transaction event
    const transactionEvent = this.toJSON();

    // Capture the event through the hub
    try {
      this._hub.captureEvent({
        ...transactionEvent,
        event_id: eventId,
        type: 'transaction',
      });
    } catch (e) {
      // Silently handle errors
      console.debug('Failed to capture transaction:', e);
    }

    return eventId;
  }

  // ============================================
  // Serialization methods
  // ============================================

  /**
   * Convert to JSON for sending to Sentry
   */
  override toJSON(): TransactionJSON {
    const spanJson = super.toJSON();

    // Convert child spans to JSON
    const spansJson: SpanJSON[] = [];
    for (const span of this._spans) {
      // Only include finished spans
      if (span.endTimestamp !== undefined) {
        spansJson.push(span.toJSON());
      }
    }

    // Also include children from the Span class
    for (const child of this.children) {
      if (child.endTimestamp !== undefined && !this._spans.includes(child)) {
        spansJson.push(child.toJSON());
      }
    }

    const transactionJson: TransactionJSON = {
      ...spanJson,
      type: 'transaction',
      transaction: this._transactionName,
      spans: spansJson,
      contexts: {
        trace: {
          traceId: this.traceId,
          spanId: this.spanId,
          parentSpanId: this.parentSpanId,
          op: this.op,
          status: this.status.code !== 'unset' ? this.status.code : undefined,
        },
      },
      transaction_info: {
        source: this._metadata.source,
      },
    };

    return transactionJson;
  }

  /**
   * Get the Hub associated with this transaction
   */
  getHub(): Hub {
    return this._hub;
  }
}

/**
 * Check if a span is a transaction
 */
export function isTransaction(span: Span): span is Transaction {
  return span instanceof Transaction;
}
