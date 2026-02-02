/**
 * Sampling Logic
 *
 * Sampling utilities for events and transactions.
 * Determines whether events should be captured based on sample rates.
 */

import type { SamplingContext, TransactionContext } from '../types/span';
import type { InitOptions } from './options';

/**
 * Sampling decision result.
 */
export interface SamplingDecision {
  /**
   * Whether to sample (capture) the event.
   */
  sampled: boolean;

  /**
   * The sample rate that was applied (for debugging).
   */
  sampleRate?: number;

  /**
   * Reason for the sampling decision.
   */
  reason?: SamplingReason;
}

/**
 * Reasons for sampling decisions.
 */
export type SamplingReason =
  | 'explicit_rate'        // Sampled based on explicit sample rate
  | 'sampler_function'     // Sampled based on custom sampler function
  | 'parent_sampled'       // Inherited from parent span
  | 'parent_not_sampled'   // Parent was not sampled
  | 'no_rate_configured'   // No sample rate configured (defaults to 100%)
  | 'rate_zero'            // Sample rate is 0
  | 'rate_one'             // Sample rate is 1
  | 'random'               // Random selection based on rate
  | 'disabled';            // Sampling disabled

/**
 * Generate a random number between 0 and 1.
 * Uses crypto.getRandomValues when available for better randomness.
 *
 * @returns Random number between 0 and 1
 */
export function generateRandom(): number {
  // Try to use crypto for better randomness
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] / (0xffffffff + 1);
  }

  // Fall back to Math.random
  return Math.random();
}

/**
 * Check if an event should be sampled based on sample rate.
 *
 * @param sampleRate - Sample rate (0.0 to 1.0)
 * @returns True if the event should be sampled (captured)
 *
 * @example
 * ```typescript
 * // 50% of calls will return true
 * shouldSampleEvent(0.5);
 *
 * // Always returns true
 * shouldSampleEvent(1.0);
 *
 * // Always returns false
 * shouldSampleEvent(0);
 * ```
 */
export function shouldSampleEvent(sampleRate?: number): boolean {
  // If no sample rate, default to capturing everything
  if (sampleRate === undefined || sampleRate === null) {
    return true;
  }

  // Ensure rate is a valid number
  if (typeof sampleRate !== 'number' || isNaN(sampleRate)) {
    return true;
  }

  // Edge cases
  if (sampleRate <= 0) {
    return false;
  }

  if (sampleRate >= 1) {
    return true;
  }

  // Random sampling
  return generateRandom() < sampleRate;
}

/**
 * Get sampling decision for an event with detailed reason.
 *
 * @param sampleRate - Sample rate (0.0 to 1.0)
 * @returns Sampling decision with reason
 */
export function getSamplingDecision(sampleRate?: number): SamplingDecision {
  if (sampleRate === undefined || sampleRate === null) {
    return {
      sampled: true,
      reason: 'no_rate_configured',
    };
  }

  if (typeof sampleRate !== 'number' || isNaN(sampleRate)) {
    return {
      sampled: true,
      sampleRate: undefined,
      reason: 'no_rate_configured',
    };
  }

  if (sampleRate <= 0) {
    return {
      sampled: false,
      sampleRate: 0,
      reason: 'rate_zero',
    };
  }

  if (sampleRate >= 1) {
    return {
      sampled: true,
      sampleRate: 1,
      reason: 'rate_one',
    };
  }

  const sampled = generateRandom() < sampleRate;

  return {
    sampled,
    sampleRate,
    reason: 'random',
  };
}

/**
 * Create a sampling context for transaction sampling.
 *
 * @param transactionContext - The transaction context
 * @param parentSampled - Whether the parent span was sampled
 * @param request - Optional request data
 * @param location - Optional location data
 * @returns Sampling context
 */
export function createSamplingContext(
  transactionContext: TransactionContext,
  parentSampled?: boolean,
  request?: unknown,
  location?: unknown
): SamplingContext {
  return {
    transactionContext,
    parentSampled,
    name: transactionContext.name,
    attributes: transactionContext.attributes || {},
    request: request as SamplingContext['request'],
    location: location as SamplingContext['location'],
  };
}

/**
 * Check if a transaction should be sampled.
 * Uses tracesSampler if provided, otherwise falls back to tracesSampleRate.
 *
 * @param context - Sampling context
 * @param options - SDK options containing sample rates and sampler
 * @returns Sampling decision
 *
 * @example
 * ```typescript
 * const decision = shouldSampleTransaction(context, {
 *   tracesSampler: (ctx) => {
 *     if (ctx.name.includes('health')) return 0;
 *     return 0.5;
 *   }
 * });
 * ```
 */
export function shouldSampleTransaction(
  context: SamplingContext,
  options: Pick<InitOptions, 'tracesSampleRate' | 'tracesSampler'>
): SamplingDecision {
  const { tracesSampleRate, tracesSampler } = options;

  // If custom sampler is provided, use it
  if (tracesSampler) {
    try {
      const samplerResult = tracesSampler(context);

      if (typeof samplerResult === 'boolean') {
        return {
          sampled: samplerResult,
          sampleRate: samplerResult ? 1 : 0,
          reason: 'sampler_function',
        };
      }

      if (typeof samplerResult === 'number') {
        if (samplerResult <= 0) {
          return {
            sampled: false,
            sampleRate: 0,
            reason: 'sampler_function',
          };
        }

        if (samplerResult >= 1) {
          return {
            sampled: true,
            sampleRate: 1,
            reason: 'sampler_function',
          };
        }

        const sampled = generateRandom() < samplerResult;
        return {
          sampled,
          sampleRate: samplerResult,
          reason: 'sampler_function',
        };
      }
    } catch (error) {
      // If sampler throws, fall back to rate-based sampling
      console.warn('[Universal Logger] tracesSampler threw an error:', error);
    }
  }

  // Check parent sampling decision
  if (context.parentSampled !== undefined) {
    return {
      sampled: context.parentSampled,
      reason: context.parentSampled ? 'parent_sampled' : 'parent_not_sampled',
    };
  }

  // Fall back to tracesSampleRate
  if (tracesSampleRate === undefined) {
    // No tracing configured, don't sample transactions
    return {
      sampled: false,
      reason: 'no_rate_configured',
    };
  }

  const decision = getSamplingDecision(tracesSampleRate);
  return {
    ...decision,
    reason: decision.reason === 'no_rate_configured' ? 'explicit_rate' : decision.reason,
  };
}

/**
 * Check if a replay session should be sampled.
 *
 * @param isError - Whether an error occurred in the session
 * @param options - SDK options containing replay sample rates
 * @returns Sampling decision
 */
export function shouldSampleReplay(
  isError: boolean,
  options: Pick<InitOptions, 'replaysSessionSampleRate' | 'replaysOnErrorSampleRate'>
): SamplingDecision {
  const { replaysSessionSampleRate, replaysOnErrorSampleRate } = options;

  // If error occurred and we have an error sample rate, use it
  if (isError && replaysOnErrorSampleRate !== undefined) {
    return getSamplingDecision(replaysOnErrorSampleRate);
  }

  // Otherwise use session sample rate
  return getSamplingDecision(replaysSessionSampleRate);
}

/**
 * Check if profiling should be enabled for a transaction.
 *
 * @param transactionSampled - Whether the transaction is sampled
 * @param options - SDK options containing profile sample rate
 * @returns Sampling decision
 */
export function shouldSampleProfile(
  transactionSampled: boolean,
  options: Pick<InitOptions, 'profilesSampleRate'>
): SamplingDecision {
  // Profiling requires transaction to be sampled
  if (!transactionSampled) {
    return {
      sampled: false,
      reason: 'parent_not_sampled',
    };
  }

  const { profilesSampleRate } = options;

  if (profilesSampleRate === undefined) {
    return {
      sampled: false,
      reason: 'no_rate_configured',
    };
  }

  return getSamplingDecision(profilesSampleRate);
}

/**
 * Apply sampling to determine if an event should be captured.
 *
 * @param event - Event type ('error', 'transaction', 'replay', 'profile')
 * @param options - SDK options
 * @param context - Additional context for sampling decision
 * @returns Whether the event should be captured
 */
export function applySampling(
  event: 'error' | 'transaction' | 'replay' | 'profile',
  options: InitOptions,
  context?: {
    samplingContext?: SamplingContext;
    isError?: boolean;
    transactionSampled?: boolean;
  }
): boolean {
  switch (event) {
    case 'error':
      return shouldSampleEvent(options.sampleRate);

    case 'transaction':
      if (!context?.samplingContext) {
        return shouldSampleEvent(options.tracesSampleRate);
      }
      return shouldSampleTransaction(context.samplingContext, options).sampled;

    case 'replay':
      return shouldSampleReplay(context?.isError ?? false, options).sampled;

    case 'profile':
      return shouldSampleProfile(context?.transactionSampled ?? false, options).sampled;

    default:
      return true;
  }
}

/**
 * Create a deterministic sample decision based on a stable ID.
 * Useful for consistent sampling across multiple events.
 *
 * @param id - Stable ID (e.g., session ID, user ID)
 * @param sampleRate - Sample rate (0.0 to 1.0)
 * @returns Whether to sample
 */
export function deterministicSample(id: string, sampleRate: number): boolean {
  if (sampleRate <= 0) return false;
  if (sampleRate >= 1) return true;

  // Simple hash function
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }

  // Convert to 0-1 range
  const normalized = (hash & 0x7fffffff) / 0x7fffffff;

  return normalized < sampleRate;
}
