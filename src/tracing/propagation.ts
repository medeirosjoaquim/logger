/**
 * Trace propagation utilities
 * Implements W3C Trace Context and Sentry baggage propagation
 */

import { Span } from './span';
import type {
  SpanContext,
  DynamicSamplingContext,
  TracePropagationData,
  ParsedSentryTrace,
} from './types';

// ============================================
// Sentry Trace Header (sentry-trace)
// ============================================

/**
 * Generate the sentry-trace header from a span
 * Format: {traceId}-{spanId}-{sampled}
 *
 * @param span - The span to generate the header for
 * @returns The sentry-trace header value
 */
export function generateSentryTraceHeader(span: Span): string {
  const { traceId, spanId, sampled } = span.spanContext();

  // Sampled can be: 1 (sampled), 0 (not sampled), or omitted (deferred)
  if (sampled === undefined) {
    return `${traceId}-${spanId}`;
  }

  return `${traceId}-${spanId}-${sampled ? '1' : '0'}`;
}

/**
 * Parse a sentry-trace header
 * Format: {traceId}-{spanId}-{sampled}
 *
 * @param header - The sentry-trace header value
 * @returns Parsed span context or undefined if invalid
 */
export function parseSentryTraceHeader(header: string): ParsedSentryTrace | undefined {
  if (!header || typeof header !== 'string') {
    return undefined;
  }

  // Trim whitespace
  const trimmed = header.trim();

  // Split by dash
  const parts = trimmed.split('-');

  if (parts.length < 2) {
    return undefined;
  }

  const traceId = parts[0];
  const parentSpanId = parts[1];

  // Validate trace ID (32 hex characters)
  if (!/^[0-9a-f]{32}$/i.test(traceId)) {
    return undefined;
  }

  // Validate span ID (16 hex characters)
  if (!/^[0-9a-f]{16}$/i.test(parentSpanId)) {
    return undefined;
  }

  // Parse sampled flag
  let sampled: boolean | undefined;
  if (parts.length >= 3) {
    const sampledStr = parts[2];
    if (sampledStr === '1') {
      sampled = true;
    } else if (sampledStr === '0') {
      sampled = false;
    }
    // Any other value means sampling is deferred
  }

  return {
    traceId,
    parentSpanId,
    sampled,
  };
}

/**
 * Extract span context from sentry-trace header
 */
export function extractSpanContextFromHeader(header: string): Partial<SpanContext> | undefined {
  const parsed = parseSentryTraceHeader(header);
  if (!parsed) {
    return undefined;
  }

  return {
    traceId: parsed.traceId,
    parentSpanId: parsed.parentSpanId,
    sampled: parsed.sampled,
  };
}

// ============================================
// Baggage Header
// ============================================

/**
 * Generate the baggage header from dynamic sampling context
 * Only includes sentry-prefixed items
 *
 * @param dsc - The dynamic sampling context
 * @returns The baggage header value
 */
export function generateBaggageHeader(dsc: DynamicSamplingContext): string {
  const items: string[] = [];

  // Add all DSC properties with sentry- prefix
  if (dsc.trace_id) {
    items.push(`sentry-trace_id=${encodeURIComponent(dsc.trace_id)}`);
  }
  if (dsc.public_key) {
    items.push(`sentry-public_key=${encodeURIComponent(dsc.public_key)}`);
  }
  if (dsc.release) {
    items.push(`sentry-release=${encodeURIComponent(dsc.release)}`);
  }
  if (dsc.environment) {
    items.push(`sentry-environment=${encodeURIComponent(dsc.environment)}`);
  }
  if (dsc.transaction) {
    items.push(`sentry-transaction=${encodeURIComponent(dsc.transaction)}`);
  }
  if (dsc.sample_rate) {
    items.push(`sentry-sample_rate=${encodeURIComponent(dsc.sample_rate)}`);
  }
  if (dsc.sampled) {
    items.push(`sentry-sampled=${encodeURIComponent(dsc.sampled)}`);
  }

  return items.join(',');
}

/**
 * Parse a baggage header and extract Sentry-related items
 *
 * @param header - The baggage header value
 * @returns The dynamic sampling context or undefined if no Sentry items
 */
export function parseBaggageHeader(header: string): DynamicSamplingContext | undefined {
  if (!header || typeof header !== 'string') {
    return undefined;
  }

  const dsc: Partial<DynamicSamplingContext> = {};
  let hasSentryItems = false;

  // Split by comma and process each item
  const items = header.split(',');

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) {
      continue;
    }

    // Split key=value
    const equalsIndex = trimmed.indexOf('=');
    if (equalsIndex === -1) {
      continue;
    }

    const key = trimmed.substring(0, equalsIndex).trim();
    const value = trimmed.substring(equalsIndex + 1).trim();

    // Only process sentry-prefixed items
    if (!key.startsWith('sentry-')) {
      continue;
    }

    hasSentryItems = true;
    const sentryKey = key.substring(7); // Remove 'sentry-' prefix

    try {
      const decodedValue = decodeURIComponent(value);

      switch (sentryKey) {
        case 'trace_id':
          dsc.trace_id = decodedValue;
          break;
        case 'public_key':
          dsc.public_key = decodedValue;
          break;
        case 'release':
          dsc.release = decodedValue;
          break;
        case 'environment':
          dsc.environment = decodedValue;
          break;
        case 'transaction':
          dsc.transaction = decodedValue;
          break;
        case 'sample_rate':
          dsc.sample_rate = decodedValue;
          break;
        case 'sampled':
          dsc.sampled = decodedValue;
          break;
      }
    } catch {
      // Ignore decode errors
      continue;
    }
  }

  if (!hasSentryItems || !dsc.trace_id || !dsc.public_key) {
    return undefined;
  }

  return dsc as DynamicSamplingContext;
}

// ============================================
// Combined propagation
// ============================================

/**
 * Get trace propagation data from a span
 *
 * @param span - The span to get propagation data for
 * @param dsc - Optional dynamic sampling context
 * @returns The trace propagation data
 */
export function getTraceparentData(
  span: Span,
  dsc?: Partial<DynamicSamplingContext>
): TracePropagationData {
  const sentryTrace = generateSentryTraceHeader(span);

  // Build DSC from span if not provided
  const fullDsc: DynamicSamplingContext = {
    trace_id: span.traceId,
    public_key: dsc?.public_key || '',
    release: dsc?.release,
    environment: dsc?.environment,
    transaction: dsc?.transaction || span.name,
    sample_rate: dsc?.sample_rate,
    sampled: span.sampled !== undefined ? String(span.sampled) : undefined,
  };

  const baggage = generateBaggageHeader(fullDsc);

  return {
    sentryTrace,
    baggage,
  };
}

/**
 * Create propagation headers object for outgoing requests
 */
export function getPropagationHeaders(span: Span): Record<string, string> {
  const { sentryTrace, baggage } = getTraceparentData(span);

  const headers: Record<string, string> = {
    'sentry-trace': sentryTrace,
  };

  if (baggage) {
    headers['baggage'] = baggage;
  }

  return headers;
}

// ============================================
// W3C Trace Context (for compatibility)
// ============================================

/**
 * Generate W3C traceparent header
 * Format: {version}-{traceId}-{spanId}-{flags}
 */
export function generateTraceparentHeader(span: Span): string {
  const version = '00';
  const { traceId, spanId, sampled } = span.spanContext();
  const flags = sampled ? '01' : '00';

  return `${version}-${traceId}-${spanId}-${flags}`;
}

/**
 * Parse W3C traceparent header
 */
export function parseTraceparentHeader(
  header: string
): { traceId: string; spanId: string; sampled: boolean } | undefined {
  if (!header || typeof header !== 'string') {
    return undefined;
  }

  const parts = header.trim().split('-');

  if (parts.length !== 4) {
    return undefined;
  }

  const [version, traceId, spanId, flags] = parts;

  // We only support version 00
  if (version !== '00') {
    return undefined;
  }

  // Validate trace ID (32 hex characters)
  if (!/^[0-9a-f]{32}$/i.test(traceId)) {
    return undefined;
  }

  // Validate span ID (16 hex characters)
  if (!/^[0-9a-f]{16}$/i.test(spanId)) {
    return undefined;
  }

  // Validate flags (2 hex characters)
  if (!/^[0-9a-f]{2}$/i.test(flags)) {
    return undefined;
  }

  // Parse sampled flag (bit 0 of flags)
  const flagsInt = parseInt(flags, 16);
  const sampled = (flagsInt & 0x01) === 0x01;

  return {
    traceId,
    spanId,
    sampled,
  };
}

// ============================================
// Header extraction utilities
// ============================================

/**
 * Extract trace context from request headers
 */
export function extractTraceContext(headers: Record<string, string | undefined>): {
  traceId?: string;
  parentSpanId?: string;
  sampled?: boolean;
  dsc?: DynamicSamplingContext;
} {
  const result: {
    traceId?: string;
    parentSpanId?: string;
    sampled?: boolean;
    dsc?: DynamicSamplingContext;
  } = {};

  // Try sentry-trace header first
  const sentryTraceHeader = headers['sentry-trace'];
  if (sentryTraceHeader) {
    const parsed = parseSentryTraceHeader(sentryTraceHeader);
    if (parsed) {
      result.traceId = parsed.traceId;
      result.parentSpanId = parsed.parentSpanId;
      result.sampled = parsed.sampled;
    }
  }

  // Try W3C traceparent as fallback
  if (!result.traceId) {
    const traceparentHeader = headers['traceparent'];
    if (traceparentHeader) {
      const parsed = parseTraceparentHeader(traceparentHeader);
      if (parsed) {
        result.traceId = parsed.traceId;
        result.parentSpanId = parsed.spanId;
        result.sampled = parsed.sampled;
      }
    }
  }

  // Parse baggage header
  const baggageHeader = headers['baggage'];
  if (baggageHeader) {
    result.dsc = parseBaggageHeader(baggageHeader);
  }

  return result;
}
