/**
 * Sampling decision propagation for distributed tracing
 *
 * Implements Sentry's trace propagation format including:
 * - sentry-trace header parsing/generation
 * - baggage header parsing/generation with Dynamic Sampling Context (DSC)
 *
 * @see https://develop.sentry.dev/sdk/performance/#header-sentry-trace
 * @see https://develop.sentry.dev/sdk/performance/dynamic-sampling-context/
 */

export interface DynamicSamplingContext {
  /** The trace ID - required */
  trace_id: string;
  /** The DSN's public key - required */
  public_key: string;
  /** The sample rate that was used (0.0-1.0) */
  sample_rate?: string;
  /** The release version */
  release?: string;
  /** The environment (production, staging, etc.) */
  environment?: string;
  /** The transaction name */
  transaction?: string;
  /** User segment for targeting */
  user_segment?: string;
  /** Whether this trace was sampled ('true' or 'false') */
  sampled?: string;
  /** Replay ID if Sentry Session Replay is active */
  replay_id?: string;
}

export interface SamplingDecision {
  /** Whether the trace is sampled */
  sampled?: boolean;
  /** The Dynamic Sampling Context */
  dsc?: DynamicSamplingContext;
}

export interface TraceContext {
  /** The trace ID (32 hex chars) */
  traceId: string;
  /** The parent span ID (16 hex chars) */
  parentSpanId: string;
  /** Whether this trace is sampled */
  sampled?: boolean;
}

/**
 * Extract sampling decision from incoming trace headers
 * Used when receiving requests that are part of a distributed trace
 * O(1) time complexity for sentry-trace, O(n) for baggage where n is baggage items
 *
 * @param sentryTrace - The sentry-trace header value
 * @param baggage - The baggage header value
 * @returns The extracted sampling decision and DSC
 */
export function extractSamplingDecision(
  sentryTrace?: string,
  baggage?: string
): SamplingDecision {
  let sampled: boolean | undefined;
  let dsc: DynamicSamplingContext | undefined;

  // Parse sentry-trace header: {trace_id}-{span_id}-{sampled}
  // Example: "00000000000000000000000000000001-0000000000000001-1"
  if (sentryTrace) {
    const parsed = parseSentryTrace(sentryTrace);
    if (parsed) {
      sampled = parsed.sampled;
    }
  }

  // Parse baggage header for DSC
  // DSC can override the sampled decision from sentry-trace
  if (baggage) {
    dsc = parseBaggageToDsc(baggage);
    if (dsc?.sampled !== undefined) {
      sampled = dsc.sampled === 'true';
    }
  }

  return { sampled, dsc };
}

/**
 * Parse sentry-trace header
 * Format: {trace_id}-{span_id}-{sampled}
 *
 * @param sentryTrace - The sentry-trace header value
 * @returns Parsed trace context or undefined if invalid
 */
export function parseSentryTrace(sentryTrace: string): TraceContext | undefined {
  if (!sentryTrace) return undefined;

  // Match: trace_id (32 hex) - span_id (16 hex) - optional sampled (0 or 1)
  const match = sentryTrace.match(
    /^([0-9a-f]{32})-([0-9a-f]{16})(?:-([01]))?$/i
  );

  if (!match) return undefined;

  const [, traceId, parentSpanId, sampledStr] = match;

  return {
    traceId,
    parentSpanId,
    sampled: sampledStr === undefined ? undefined : sampledStr === '1'
  };
}

/**
 * Create a sentry-trace header value
 *
 * @param traceId - The trace ID (32 hex chars)
 * @param spanId - The span ID (16 hex chars)
 * @param sampled - Whether the trace is sampled
 * @returns The sentry-trace header value
 */
export function createSentryTrace(
  traceId: string,
  spanId: string,
  sampled?: boolean
): string {
  const sampledStr = sampled === undefined ? '' : sampled ? '-1' : '-0';
  return `${traceId}-${spanId}${sampledStr}`;
}

/**
 * Parse baggage header to extract Dynamic Sampling Context
 * Only extracts sentry-prefixed entries
 *
 * @param baggage - The baggage header value
 * @returns The extracted DSC or undefined if no valid Sentry entries
 */
export function parseBaggageToDsc(baggage: string): DynamicSamplingContext | undefined {
  if (!baggage) return undefined;

  const dsc: Partial<DynamicSamplingContext> = {};

  // Baggage format: key1=value1, key2=value2, ...
  const items = baggage.split(',');

  for (const item of items) {
    const trimmed = item.trim();
    const equalsIndex = trimmed.indexOf('=');

    if (equalsIndex === -1) continue;

    const key = trimmed.substring(0, equalsIndex);
    const value = trimmed.substring(equalsIndex + 1);

    // Only process sentry-prefixed entries
    if (key.startsWith('sentry-')) {
      // Convert sentry-trace-id to trace_id
      const dscKey = key
        .replace('sentry-', '')
        .replace(/-/g, '_') as keyof DynamicSamplingContext;

      try {
        dsc[dscKey] = decodeURIComponent(value);
      } catch {
        // Skip malformed values
        dsc[dscKey] = value;
      }
    }
  }

  // trace_id and public_key are required for a valid DSC
  if (!dsc.trace_id || !dsc.public_key) {
    return undefined;
  }

  return dsc as DynamicSamplingContext;
}

/**
 * Create baggage header from Dynamic Sampling Context
 *
 * @param dsc - The Dynamic Sampling Context
 * @returns The baggage header value
 */
export function dscToBaggage(dsc: DynamicSamplingContext): string {
  return Object.entries(dsc)
    .filter(([, value]) => value !== undefined && value !== '')
    .map(([key, value]) => {
      // Convert trace_id back to sentry-trace-id
      const baggageKey = `sentry-${key.replace(/_/g, '-')}`;
      return `${baggageKey}=${encodeURIComponent(String(value))}`;
    })
    .join(',');
}

/**
 * Merge existing baggage with new DSC entries
 * Preserves non-Sentry baggage entries
 *
 * @param existingBaggage - The existing baggage header value
 * @param dsc - The Dynamic Sampling Context to merge
 * @returns The merged baggage header value
 */
export function mergeBaggageWithDsc(
  existingBaggage: string | undefined,
  dsc: DynamicSamplingContext
): string {
  const nonSentryEntries: string[] = [];

  // Extract non-Sentry entries from existing baggage
  if (existingBaggage) {
    const items = existingBaggage.split(',');
    for (const item of items) {
      const trimmed = item.trim();
      if (trimmed && !trimmed.startsWith('sentry-')) {
        nonSentryEntries.push(trimmed);
      }
    }
  }

  // Create Sentry entries from DSC
  const sentryBaggage = dscToBaggage(dsc);

  // Combine
  if (nonSentryEntries.length > 0) {
    return `${nonSentryEntries.join(',')},${sentryBaggage}`;
  }

  return sentryBaggage;
}

/**
 * Create a new Dynamic Sampling Context
 *
 * @param traceId - The trace ID
 * @param publicKey - The DSN's public key
 * @param options - Additional DSC options
 * @returns A new Dynamic Sampling Context
 */
export function createDsc(
  traceId: string,
  publicKey: string,
  options: Partial<Omit<DynamicSamplingContext, 'trace_id' | 'public_key'>> = {}
): DynamicSamplingContext {
  return {
    trace_id: traceId,
    public_key: publicKey,
    ...options
  };
}

/**
 * Check if two DSCs represent the same trace
 */
export function isSameDsc(
  dsc1: DynamicSamplingContext | undefined,
  dsc2: DynamicSamplingContext | undefined
): boolean {
  if (!dsc1 || !dsc2) return false;
  return dsc1.trace_id === dsc2.trace_id && dsc1.public_key === dsc2.public_key;
}
