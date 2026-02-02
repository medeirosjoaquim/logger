/**
 * Transaction sampling implementation
 * Determines which transactions should be recorded and sent
 */

import type { TransactionContext, SamplingContext, SpanAttributes } from './types';

/**
 * Sampling options
 */
export interface SamplingOptions {
  /**
   * Sample rate (0.0 to 1.0)
   */
  tracesSampleRate?: number;

  /**
   * Custom sampler function
   */
  tracesSampler?: (context: SamplingContext) => number | boolean;
}

/**
 * Sample a transaction to determine if it should be recorded
 *
 * @param transactionContext - The transaction context
 * @param options - Sampling options
 * @param samplingContext - Additional sampling context
 * @returns Whether the transaction should be sampled
 */
export function sampleTransaction(
  transactionContext: TransactionContext,
  options: SamplingOptions,
  samplingContext: SamplingContext
): boolean {
  // If already explicitly set, respect that decision
  if (transactionContext.sampled !== undefined) {
    return transactionContext.sampled;
  }

  // If parent is sampled, inherit that decision (trace propagation)
  if (samplingContext.parentSampled !== undefined) {
    return samplingContext.parentSampled;
  }

  // Use custom sampler if provided
  if (options.tracesSampler) {
    const samplerResult = options.tracesSampler(samplingContext);
    return resolveSamplerResult(samplerResult);
  }

  // Use sample rate if provided
  if (options.tracesSampleRate !== undefined) {
    return Math.random() < options.tracesSampleRate;
  }

  // Default: don't sample (opt-in behavior)
  return false;
}

/**
 * Resolve the result of a sampler function
 */
function resolveSamplerResult(result: number | boolean): boolean {
  if (typeof result === 'boolean') {
    return result;
  }

  if (typeof result === 'number') {
    // Clamp between 0 and 1
    const rate = Math.max(0, Math.min(1, result));
    return Math.random() < rate;
  }

  // Invalid result, don't sample
  return false;
}

/**
 * Create a sampling context from transaction context
 */
export function createSamplingContext(
  transactionContext: TransactionContext,
  options?: {
    parentSampled?: boolean;
    request?: {
      url?: string;
      method?: string;
      headers?: Record<string, string>;
    };
    location?: {
      pathname?: string;
      href?: string;
    };
  }
): SamplingContext {
  const attributes: SpanAttributes = {
    ...transactionContext.attributes,
  };

  // Add operation as attribute if present
  if (transactionContext.op) {
    attributes['sentry.op'] = transactionContext.op;
  }

  // Add source as attribute if present
  if (transactionContext.source) {
    attributes['sentry.source'] = transactionContext.source;
  }

  return {
    transactionContext,
    parentSampled: options?.parentSampled,
    name: transactionContext.name,
    attributes,
    request: options?.request,
    location: options?.location,
  };
}

/**
 * Check if sampling is enabled based on options
 */
export function isSamplingEnabled(options: SamplingOptions): boolean {
  return options.tracesSampleRate !== undefined || options.tracesSampler !== undefined;
}

/**
 * Get effective sample rate from options and context
 */
export function getEffectiveSampleRate(
  options: SamplingOptions,
  samplingContext: SamplingContext
): number | undefined {
  // If using a custom sampler, we can't determine a static rate
  if (options.tracesSampler) {
    const result = options.tracesSampler(samplingContext);
    if (typeof result === 'number') {
      return Math.max(0, Math.min(1, result));
    }
    return result ? 1 : 0;
  }

  return options.tracesSampleRate;
}

/**
 * Default transaction sampler that samples based on operation type
 */
export function createOperationBasedSampler(
  operationRates: Record<string, number>,
  defaultRate: number = 0
): (context: SamplingContext) => number {
  return (context: SamplingContext): number => {
    const op = context.transactionContext.op;

    if (op && operationRates[op] !== undefined) {
      return operationRates[op];
    }

    return defaultRate;
  };
}

/**
 * Create a sampler that samples based on URL patterns
 */
export function createUrlPatternSampler(
  patterns: Array<{ pattern: RegExp; rate: number }>,
  defaultRate: number = 0
): (context: SamplingContext) => number {
  return (context: SamplingContext): number => {
    const url =
      context.request?.url ||
      context.location?.href ||
      context.transactionContext.name;

    if (!url) {
      return defaultRate;
    }

    for (const { pattern, rate } of patterns) {
      if (pattern.test(url)) {
        return rate;
      }
    }

    return defaultRate;
  };
}

/**
 * Combine multiple samplers with AND logic
 */
export function combineSamplers(
  samplers: Array<(context: SamplingContext) => number | boolean>
): (context: SamplingContext) => number {
  return (context: SamplingContext): number => {
    let minRate = 1;

    for (const sampler of samplers) {
      const result = sampler(context);
      const rate = typeof result === 'boolean' ? (result ? 1 : 0) : result;
      minRate = Math.min(minRate, rate);

      // Short-circuit if rate is 0
      if (minRate === 0) {
        return 0;
      }
    }

    return minRate;
  };
}
