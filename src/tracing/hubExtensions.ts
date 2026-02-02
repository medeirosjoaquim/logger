/**
 * Hub tracing extensions
 * Main span APIs matching Sentry v8
 */

import { Span } from './span';
import { Transaction } from './transaction';
import { TraceContext } from './context';
import { sampleTransaction, createSamplingContext } from './sampling';
import { generateTraceId } from './idGenerator';
import type {
  StartSpanOptions,
  TransactionContext,
  Hub,
  SamplingContext,
} from './types';

/**
 * Default hub implementation for standalone use
 */
const defaultHub: Hub = {
  getClient() {
    return null;
  },
  getScope() {
    return {};
  },
  captureEvent(event: unknown) {
    // In standalone mode, just log to console
    if (typeof console !== 'undefined' && console.debug) {
      console.debug('[Tracing] Transaction captured:', event);
    }
    const eventObj = event as { event_id?: string };
    return eventObj.event_id || '';
  },
};

// Current hub reference
let _currentHub: Hub = defaultHub;

/**
 * Set the hub to use for tracing
 */
export function setTracingHub(hub: Hub): void {
  _currentHub = hub;
}

/**
 * Get the current hub
 */
export function getTracingHub(): Hub {
  return _currentHub;
}

// ============================================
// Main span APIs
// ============================================

/**
 * Start a span and run a callback with it active
 * The span is automatically finished when the callback completes
 *
 * @param options - Span options
 * @param callback - Callback to run with the span active
 * @returns The result of the callback
 */
export function startSpan<T>(options: StartSpanOptions, callback: (span: Span) => T): T {
  if (TraceContext.isTracingSuppressed()) {
    // Create a no-op span that won't be recorded
    const noopSpan = new Span({ ...options, sampled: false });
    return callback(noopSpan);
  }

  const parentSpan = TraceContext.getActiveSpan();
  const parentTransaction = TraceContext.getActiveTransaction();

  let span: Span;
  let transaction: Transaction | undefined = parentTransaction;

  if (parentSpan) {
    // Create a child span
    span = parentSpan.startChild(options);
  } else if (options.forceTransaction || !parentTransaction) {
    // Create a new transaction
    const transactionContext: TransactionContext = {
      ...options,
      source: 'custom',
    };

    // Sample the transaction
    const samplingContext = createSamplingContext(transactionContext);
    const tracingOptions = _currentHub.getTracingOptions?.() || {};
    const sampled = sampleTransaction(transactionContext, tracingOptions, samplingContext);

    transaction = new Transaction(
      { ...transactionContext, sampled },
      _currentHub
    );
    span = transaction;
  } else {
    // Create a span under the existing transaction
    span = parentTransaction.startChild(options);
  }

  // Run the callback with the span active
  return TraceContext.runWithContext(span, transaction, () => {
    try {
      const result = callback(span);

      // Handle async results
      if (result instanceof Promise) {
        return result
          .then((value) => {
            span.setStatus('ok');
            return value;
          })
          .catch((error) => {
            span.setStatus({ code: 'error', message: String(error) });
            throw error;
          })
          .finally(() => {
            span.end();
            if (span instanceof Transaction) {
              span.finish();
            }
          }) as T;
      }

      span.setStatus('ok');
      span.end();
      if (span instanceof Transaction) {
        span.finish();
      }
      return result;
    } catch (error) {
      span.setStatus({ code: 'error', message: String(error) });
      span.end();
      if (span instanceof Transaction) {
        span.finish();
      }
      throw error;
    }
  });
}

/**
 * Start a span with manual control over when it ends
 *
 * @param options - Span options
 * @param callback - Callback to run with the span and finish function
 * @returns The result of the callback
 */
export function startSpanManual<T>(
  options: StartSpanOptions,
  callback: (span: Span, finish: () => void) => T
): T {
  if (TraceContext.isTracingSuppressed()) {
    const noopSpan = new Span({ ...options, sampled: false });
    return callback(noopSpan, () => {});
  }

  const parentSpan = TraceContext.getActiveSpan();
  const parentTransaction = TraceContext.getActiveTransaction();

  let span: Span;
  let transaction: Transaction | undefined = parentTransaction;

  if (parentSpan) {
    span = parentSpan.startChild(options);
  } else if (options.forceTransaction || !parentTransaction) {
    const transactionContext: TransactionContext = {
      ...options,
      source: 'custom',
    };

    const samplingContext = createSamplingContext(transactionContext);
    const tracingOptions = _currentHub.getTracingOptions?.() || {};
    const sampled = sampleTransaction(transactionContext, tracingOptions, samplingContext);

    transaction = new Transaction(
      { ...transactionContext, sampled },
      _currentHub
    );
    span = transaction;
  } else {
    span = parentTransaction.startChild(options);
  }

  const finish = (): void => {
    span.end();
    if (span instanceof Transaction) {
      span.finish();
    }
  };

  return TraceContext.runWithContext(span, transaction, () => {
    return callback(span, finish);
  });
}

/**
 * Start a span that is not automatically made active
 * Useful for background operations or spans that shouldn't affect the current context
 *
 * @param options - Span options
 * @returns The created span
 */
export function startInactiveSpan(options: StartSpanOptions): Span {
  if (TraceContext.isTracingSuppressed()) {
    return new Span({ ...options, sampled: false });
  }

  const parentSpan = TraceContext.getActiveSpan();
  const parentTransaction = TraceContext.getActiveTransaction();

  if (parentSpan) {
    return parentSpan.startChild(options);
  }

  if (options.forceTransaction || !parentTransaction) {
    const transactionContext: TransactionContext = {
      ...options,
      source: 'custom',
    };

    const samplingContext = createSamplingContext(transactionContext);
    const tracingOptions = _currentHub.getTracingOptions?.() || {};
    const sampled = sampleTransaction(transactionContext, tracingOptions, samplingContext);

    return new Transaction(
      { ...transactionContext, sampled },
      _currentHub
    );
  }

  return parentTransaction.startChild(options);
}

// ============================================
// Trace continuation
// ============================================

/**
 * Continue a trace from incoming headers
 *
 * @param options - The trace continuation options
 * @param callback - Callback to run in the continued trace context
 */
export function continueTrace(
  options: { sentryTrace?: string; baggage?: string },
  callback: () => void
): void {
  // Parse the sentry-trace header
  let traceId: string | undefined;
  let parentSpanId: string | undefined;
  let parentSampled: boolean | undefined;

  if (options.sentryTrace) {
    const parts = options.sentryTrace.split('-');
    if (parts.length >= 2) {
      traceId = parts[0];
      parentSpanId = parts[1];
      if (parts.length >= 3) {
        parentSampled = parts[2] === '1';
      }
    }
  }

  // Create a virtual span to hold the trace context
  if (traceId && parentSpanId) {
    const virtualSpan = new Span({
      name: 'continued-trace',
      traceId,
      parentSpanId,
      sampled: parentSampled,
    });

    TraceContext.runWithSpan(virtualSpan, callback);
  } else {
    callback();
  }
}

// ============================================
// Trace suppression
// ============================================

/**
 * Run a callback with tracing suppressed
 * No spans will be created or recorded during this callback
 *
 * @param callback - Callback to run with tracing suppressed
 * @returns The result of the callback
 */
export function suppressTracing<T>(callback: () => T): T {
  return TraceContext.runWithSuppression(callback);
}

// ============================================
// New trace
// ============================================

/**
 * Start a new trace, disconnected from any parent
 *
 * @param callback - Callback to run in the new trace context
 * @returns The result of the callback
 */
export function startNewTrace<T>(callback: () => T): T {
  // Clear the current context and run with a fresh trace
  return TraceContext.runWithContext(undefined, undefined, () => {
    // Generate a new trace ID for this context
    const newTraceId = generateTraceId();

    // Create a placeholder span with the new trace ID
    const rootSpan = new Span({
      name: 'new-trace-root',
      traceId: newTraceId,
    });

    return TraceContext.runWithSpan(rootSpan, callback);
  });
}

// ============================================
// Transaction creation helpers
// ============================================

/**
 * Start a new transaction
 */
export function startTransaction(
  context: TransactionContext,
  customSamplingContext?: Partial<SamplingContext>
): Transaction {
  const samplingContext = createSamplingContext(context, customSamplingContext);
  const tracingOptions = _currentHub.getTracingOptions?.() || {};
  const sampled = sampleTransaction(context, tracingOptions, samplingContext);

  const transaction = new Transaction(
    { ...context, sampled },
    _currentHub
  );

  // Set as active transaction
  TraceContext.setActiveTransaction(transaction);
  TraceContext.setActiveSpan(transaction);

  return transaction;
}

/**
 * Get the active transaction
 */
export function getActiveTransaction(): Transaction | undefined {
  return TraceContext.getActiveTransaction();
}

/**
 * Get the active span
 */
export function getActiveSpan(): Span | undefined {
  return TraceContext.getActiveSpan();
}
