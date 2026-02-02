/**
 * Trace Continuation
 *
 * Utilities for continuing traces from incoming request headers.
 * Supports both sentry-trace and W3C traceparent formats.
 */

import { Span } from './span.js';
import { TraceContext } from './context.js';
import {
  parseSentryTraceHeader,
  parseBaggageHeader,
  parseTraceparentHeader,
  extractTraceContext,
} from './propagation.js';
import type { DynamicSamplingContext, ParsedSentryTrace, SpanContext } from './types.js';

/**
 * Incoming trace data extracted from request headers
 */
export interface IncomingTraceData {
  /**
   * Trace ID from incoming request
   */
  traceId: string;

  /**
   * Parent span ID from incoming request
   */
  parentSpanId: string;

  /**
   * Sampling decision from upstream
   */
  sampled?: boolean;

  /**
   * Dynamic sampling context from baggage header
   */
  dsc?: DynamicSamplingContext;
}

/**
 * Options for extracting trace data
 */
export interface ExtractTraceOptions {
  /**
   * The sentry-trace header value
   */
  sentryTrace?: string | null;

  /**
   * The baggage header value
   */
  baggage?: string | null;

  /**
   * W3C traceparent header (fallback)
   */
  traceparent?: string | null;

  /**
   * W3C tracestate header (optional)
   */
  tracestate?: string | null;
}

/**
 * Extract trace data from incoming request headers
 *
 * @param options - Header values to extract from
 * @returns Extracted trace data or undefined if no valid trace found
 */
export function extractIncomingTraceData(
  options: ExtractTraceOptions
): IncomingTraceData | undefined {
  const { sentryTrace, baggage, traceparent } = options;

  let traceId: string | undefined;
  let parentSpanId: string | undefined;
  let sampled: boolean | undefined;
  let dsc: DynamicSamplingContext | undefined;

  // Try sentry-trace header first
  if (sentryTrace) {
    const parsed = parseSentryTraceHeader(sentryTrace);
    if (parsed) {
      traceId = parsed.traceId;
      parentSpanId = parsed.parentSpanId;
      sampled = parsed.sampled;
    }
  }

  // Fall back to W3C traceparent
  if (!traceId && traceparent) {
    const parsed = parseTraceparentHeader(traceparent);
    if (parsed) {
      traceId = parsed.traceId;
      parentSpanId = parsed.spanId;
      sampled = parsed.sampled;
    }
  }

  // Parse baggage for DSC
  if (baggage) {
    dsc = parseBaggageHeader(baggage);
  }

  if (!traceId || !parentSpanId) {
    return undefined;
  }

  return {
    traceId,
    parentSpanId,
    sampled,
    dsc,
  };
}

/**
 * Extract trace data from a Headers object (browser/fetch API)
 *
 * @param headers - Headers object to extract from
 * @returns Extracted trace data or undefined if no valid trace found
 */
export function extractTraceDataFromHeaders(
  headers: Headers
): IncomingTraceData | undefined {
  return extractIncomingTraceData({
    sentryTrace: headers.get('sentry-trace'),
    baggage: headers.get('baggage'),
    traceparent: headers.get('traceparent'),
    tracestate: headers.get('tracestate'),
  });
}

/**
 * Extract trace data from a plain object of headers
 *
 * @param headers - Header object to extract from
 * @returns Extracted trace data or undefined if no valid trace found
 */
export function extractTraceDataFromObject(
  headers: Record<string, string | string[] | undefined>
): IncomingTraceData | undefined {
  const getHeader = (name: string): string | undefined => {
    const value = headers[name] || headers[name.toLowerCase()];
    if (Array.isArray(value)) {
      return value[0];
    }
    return value;
  };

  return extractIncomingTraceData({
    sentryTrace: getHeader('sentry-trace'),
    baggage: getHeader('baggage'),
    traceparent: getHeader('traceparent'),
    tracestate: getHeader('tracestate'),
  });
}

/**
 * Create a span context from incoming trace data
 *
 * @param traceData - Incoming trace data
 * @returns Partial span context
 */
export function createSpanContextFromTraceData(
  traceData: IncomingTraceData
): Partial<SpanContext> {
  return {
    traceId: traceData.traceId,
    parentSpanId: traceData.parentSpanId,
    sampled: traceData.sampled,
    traceFlags: traceData.sampled ? 1 : 0,
  };
}

/**
 * Continue a trace from incoming request headers
 *
 * @param traceData - The extracted trace data
 * @param name - Name for the new span
 * @param callback - Callback to run within the trace context
 * @returns Result of the callback
 */
export function continueTraceFromData<T>(
  traceData: IncomingTraceData,
  name: string,
  callback: (span: Span) => T
): T {
  const span = new Span({
    name,
    traceId: traceData.traceId,
    parentSpanId: traceData.parentSpanId,
    sampled: traceData.sampled,
  });

  return TraceContext.runWithSpan(span, () => callback(span));
}

/**
 * Continue a trace from request headers
 *
 * @param headers - Headers object or plain object
 * @param name - Name for the new span
 * @param callback - Callback to run within the trace context
 * @returns Result of the callback
 */
export function continueTraceFromHeaders<T>(
  headers: Headers | Record<string, string | string[] | undefined>,
  name: string,
  callback: (span: Span) => T
): T {
  const traceData =
    headers instanceof Headers
      ? extractTraceDataFromHeaders(headers)
      : extractTraceDataFromObject(headers);

  if (!traceData) {
    // No valid incoming trace, create a new root span
    const span = new Span({ name });
    return TraceContext.runWithSpan(span, () => callback(span));
  }

  return continueTraceFromData(traceData, name, callback);
}

/**
 * Options for trace continuation with full control
 */
export interface ContinueTraceOptions {
  /**
   * Sentry-trace header value
   */
  sentryTrace?: string;

  /**
   * Baggage header value
   */
  baggage?: string;

  /**
   * Name for the continued span/transaction
   */
  name?: string;

  /**
   * Operation type for the span
   */
  op?: string;
}

/**
 * Continue a trace from headers with full options
 *
 * This is the main API for continuing traces from incoming requests.
 *
 * @param options - Continuation options
 * @param callback - Callback to run within the trace context
 * @returns Result of the callback
 */
export function continueTraceWithOptions<T>(
  options: ContinueTraceOptions,
  callback: (data: {
    span: Span;
    traceId: string;
    parentSpanId?: string;
    sampled?: boolean;
    dsc?: DynamicSamplingContext;
  }) => T
): T {
  const traceData = extractIncomingTraceData({
    sentryTrace: options.sentryTrace,
    baggage: options.baggage,
  });

  if (!traceData) {
    // No valid incoming trace, create a new root span
    const span = new Span({
      name: options.name || 'continued-trace',
      op: options.op,
    });

    return TraceContext.runWithSpan(span, () =>
      callback({
        span,
        traceId: span.traceId,
        parentSpanId: undefined,
        sampled: undefined,
        dsc: undefined,
      })
    );
  }

  const span = new Span({
    name: options.name || 'continued-trace',
    op: options.op,
    traceId: traceData.traceId,
    parentSpanId: traceData.parentSpanId,
    sampled: traceData.sampled,
  });

  return TraceContext.runWithSpan(span, () =>
    callback({
      span,
      traceId: traceData.traceId,
      parentSpanId: traceData.parentSpanId,
      sampled: traceData.sampled,
      dsc: traceData.dsc,
    })
  );
}

/**
 * Get trace propagation context from incoming headers
 *
 * This extracts trace context without creating a span,
 * useful for setting up scope context.
 *
 * @param headers - Headers to extract from
 * @returns Propagation context or empty object
 */
export function getTracePropagationContext(
  headers: Headers | Record<string, string | string[] | undefined>
): {
  traceId?: string;
  parentSpanId?: string;
  sampled?: boolean;
  dsc?: DynamicSamplingContext;
} {
  const traceData =
    headers instanceof Headers
      ? extractTraceDataFromHeaders(headers)
      : extractTraceDataFromObject(headers);

  if (!traceData) {
    return {};
  }

  return {
    traceId: traceData.traceId,
    parentSpanId: traceData.parentSpanId,
    sampled: traceData.sampled,
    dsc: traceData.dsc,
  };
}
