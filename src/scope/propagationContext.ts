/**
 * Propagation Context
 *
 * Handles trace context propagation for distributed tracing.
 * Compatible with W3C Trace Context specification.
 */

/**
 * Dynamic Sampling Context for trace-based sampling decisions
 */
export interface DynamicSamplingContext {
  /** The trace ID this context belongs to */
  trace_id?: string;
  /** The public key (DSN) */
  public_key?: string;
  /** Sample rate applied to this trace */
  sample_rate?: string;
  /** Release version */
  release?: string;
  /** Environment */
  environment?: string;
  /** Transaction name */
  transaction?: string;
  /** Whether the trace was sampled */
  sampled?: string;
  /** User segment for sampling */
  user_segment?: string;
  /** Replay ID if session replay is active */
  replay_id?: string;
}

/**
 * Propagation context for distributed tracing
 */
export interface PropagationContext {
  /** The trace ID (32 hex characters) */
  traceId: string;
  /** The span ID (16 hex characters) */
  spanId: string;
  /** Parent span ID if this is a child span */
  parentSpanId?: string;
  /** Whether this trace is sampled */
  sampled?: boolean;
  /** Dynamic sampling context for baggage header */
  dsc?: DynamicSamplingContext;
}

/**
 * Generates a random hex string of the specified length
 */
function generateHexString(length: number): string {
  const bytes = new Uint8Array(length / 2);

  // Use crypto API if available (browser or Node.js >= 15)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Fallback for older environments
    for (let i = 0; i < bytes.length; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generates a new trace ID (32 hex characters)
 */
export function generateTraceId(): string {
  return generateHexString(32);
}

/**
 * Generates a new span ID (16 hex characters)
 */
export function generateSpanId(): string {
  return generateHexString(16);
}

/**
 * Generates a new propagation context with unique trace and span IDs
 */
export function generatePropagationContext(): PropagationContext {
  return {
    traceId: generateTraceId(),
    spanId: generateSpanId(),
    sampled: undefined,
  };
}

/**
 * Creates a child propagation context from a parent context
 */
export function createChildPropagationContext(
  parent: PropagationContext
): PropagationContext {
  return {
    traceId: parent.traceId,
    spanId: generateSpanId(),
    parentSpanId: parent.spanId,
    sampled: parent.sampled,
    dsc: parent.dsc,
  };
}

/**
 * Parses a W3C traceparent header into a propagation context
 * Format: {version}-{trace_id}-{span_id}-{trace_flags}
 * Example: 00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01
 */
export function parseTraceparent(
  traceparent: string
): PropagationContext | undefined {
  const match = traceparent.match(
    /^([0-9a-f]{2})-([0-9a-f]{32})-([0-9a-f]{16})-([0-9a-f]{2})$/i
  );

  if (!match) {
    return undefined;
  }

  const [, version, traceId, spanId, flags] = match;

  // We only support version 00
  if (version === 'ff') {
    return undefined;
  }

  // Check for invalid all-zero trace or span IDs
  if (traceId === '00000000000000000000000000000000') {
    return undefined;
  }
  if (spanId === '0000000000000000') {
    return undefined;
  }

  const sampled = (parseInt(flags, 16) & 0x01) === 1;

  return {
    traceId,
    spanId,
    sampled,
  };
}

/**
 * Serializes a propagation context to a W3C traceparent header
 */
export function serializeTraceparent(context: PropagationContext): string {
  const flags = context.sampled ? '01' : '00';
  return `00-${context.traceId}-${context.spanId}-${flags}`;
}

/**
 * Parses a W3C baggage header into a dynamic sampling context
 * Format: key1=value1,key2=value2,...
 */
export function parseBaggage(
  baggage: string
): DynamicSamplingContext | undefined {
  const dsc: DynamicSamplingContext = {};
  const items = baggage.split(',');

  for (const item of items) {
    const [key, value] = item.trim().split('=');
    if (!key || !value) continue;

    // Only parse sentry- prefixed keys
    if (key.startsWith('sentry-')) {
      const sentryKey = key.slice(7).replace(/-/g, '_') as keyof DynamicSamplingContext;
      dsc[sentryKey] = decodeURIComponent(value);
    }
  }

  return Object.keys(dsc).length > 0 ? dsc : undefined;
}

/**
 * Serializes a dynamic sampling context to a W3C baggage header
 */
export function serializeBaggage(dsc: DynamicSamplingContext): string {
  const items: string[] = [];

  for (const [key, value] of Object.entries(dsc)) {
    if (value !== undefined && value !== null) {
      const sentryKey = `sentry-${key.replace(/_/g, '-')}`;
      items.push(`${sentryKey}=${encodeURIComponent(String(value))}`);
    }
  }

  return items.join(',');
}

/**
 * Extracts propagation context from incoming headers
 */
export function extractPropagationContext(headers: {
  traceparent?: string;
  baggage?: string;
  [key: string]: string | undefined;
}): PropagationContext | undefined {
  const traceparent = headers.traceparent || headers['traceparent'];
  if (!traceparent) {
    return undefined;
  }

  const context = parseTraceparent(traceparent);
  if (!context) {
    return undefined;
  }

  const baggage = headers.baggage || headers['baggage'];
  if (baggage) {
    context.dsc = parseBaggage(baggage);
  }

  return context;
}

/**
 * Injects propagation context into outgoing headers
 */
export function injectPropagationContext(
  context: PropagationContext,
  headers: Record<string, string>
): Record<string, string> {
  headers['traceparent'] = serializeTraceparent(context);

  if (context.dsc) {
    const existingBaggage = headers['baggage'];
    const sentryBaggage = serializeBaggage(context.dsc);

    if (existingBaggage) {
      // Merge with existing baggage, removing any existing sentry- entries
      const nonSentryItems = existingBaggage
        .split(',')
        .filter((item) => !item.trim().startsWith('sentry-'))
        .join(',');

      headers['baggage'] = nonSentryItems
        ? `${nonSentryItems},${sentryBaggage}`
        : sentryBaggage;
    } else {
      headers['baggage'] = sentryBaggage;
    }
  }

  return headers;
}
