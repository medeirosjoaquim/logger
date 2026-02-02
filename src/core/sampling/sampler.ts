/**
 * Main sampler for determining which events to send to Sentry
 * Implements Sentry-compatible sampling with support for:
 * - Fixed sample rates for errors
 * - Fixed sample rates for transactions
 * - Custom transaction samplers
 * - Distributed tracing (parent sampling decisions)
 */

import { SamplingStats, type SamplingStatsData } from './stats';

export interface SamplingContext {
  /** Name of the transaction/event */
  name: string;
  /** Parent's sampling decision for distributed tracing */
  parentSampled?: boolean;
  /** Additional attributes for sampling decisions */
  attributes?: Record<string, unknown>;
  /** Transaction-specific context */
  transactionContext?: {
    name: string;
    op?: string;
  };
}

export interface SamplerOptions {
  /**
   * Sample rate for error events (0.0 to 1.0)
   * Defaults to 1.0 (sample all errors)
   */
  sampleRate?: number;

  /**
   * Sample rate for transaction events (0.0 to 1.0)
   * Defaults to 0 (sample no transactions)
   */
  tracesSampleRate?: number;

  /**
   * Custom sampler function for transactions
   * Return a number (0.0-1.0) for probability sampling
   * Return a boolean for deterministic sampling
   * Takes precedence over tracesSampleRate when provided
   */
  tracesSampler?: (context: SamplingContext) => number | boolean;
}

export class Sampler {
  private options: SamplerOptions;
  private stats: SamplingStats;

  constructor(options: SamplerOptions = {}) {
    this.options = this.validateOptions(options);
    this.stats = new SamplingStats();
  }

  /**
   * Validate and normalize sampler options
   */
  private validateOptions(options: SamplerOptions): SamplerOptions {
    const validated = { ...options };

    // Validate sampleRate
    if (validated.sampleRate !== undefined) {
      if (validated.sampleRate < 0 || validated.sampleRate > 1) {
        console.warn(`[Sampler] sampleRate must be between 0 and 1, got ${validated.sampleRate}. Clamping.`);
        validated.sampleRate = Math.max(0, Math.min(1, validated.sampleRate));
      }
    }

    // Validate tracesSampleRate
    if (validated.tracesSampleRate !== undefined) {
      if (validated.tracesSampleRate < 0 || validated.tracesSampleRate > 1) {
        console.warn(`[Sampler] tracesSampleRate must be between 0 and 1, got ${validated.tracesSampleRate}. Clamping.`);
        validated.tracesSampleRate = Math.max(0, Math.min(1, validated.tracesSampleRate));
      }
    }

    return validated;
  }

  /**
   * Determine if an error event should be sampled
   * O(1) time complexity - single random number generation and comparison
   *
   * @returns true if the error should be sent, false if it should be dropped
   */
  shouldSampleError(): boolean {
    const rate = this.options.sampleRate ?? 1.0;

    // Fast path: always sample or never sample
    if (rate === 1) {
      this.stats.record('error', true);
      return true;
    }
    if (rate === 0) {
      this.stats.record('error', false);
      return false;
    }

    const sampled = Math.random() < rate;
    this.stats.record('error', sampled);
    return sampled;
  }

  /**
   * Determine if a transaction should be sampled
   * Considers parent sampling decision for distributed tracing
   * O(1) time complexity
   *
   * Sampling decision hierarchy:
   * 1. Parent sampling decision (for distributed tracing continuity)
   * 2. Custom tracesSampler function (if provided)
   * 3. Fixed tracesSampleRate
   *
   * @param context - Context for making the sampling decision
   * @returns true if the transaction should be traced, false if it should be dropped
   */
  shouldSampleTransaction(context: SamplingContext): boolean {
    // 1. Honor parent sampling decision (distributed tracing)
    // This ensures trace continuity across service boundaries
    if (context.parentSampled !== undefined) {
      this.stats.record('transaction', context.parentSampled, 'inherited');
      return context.parentSampled;
    }

    // 2. Use custom sampler if provided
    if (this.options.tracesSampler) {
      const result = this.options.tracesSampler(context);

      // Handle both boolean and number returns
      let sampled: boolean;
      if (typeof result === 'boolean') {
        sampled = result;
      } else {
        // Validate the returned rate
        const rate = Math.max(0, Math.min(1, result));
        sampled = Math.random() < rate;
      }

      this.stats.record('transaction', sampled, 'sampler');
      return sampled;
    }

    // 3. Fall back to fixed rate
    const rate = this.options.tracesSampleRate ?? 0;

    // Fast path for common cases
    if (rate === 1) {
      this.stats.record('transaction', true, 'rate');
      return true;
    }
    if (rate === 0) {
      this.stats.record('transaction', false, 'rate');
      return false;
    }

    const sampled = Math.random() < rate;
    this.stats.record('transaction', sampled, 'rate');
    return sampled;
  }

  /**
   * Get current sampling statistics
   */
  getStats(): SamplingStatsData {
    return this.stats.getData();
  }

  /**
   * Reset sampling statistics
   * Useful for periodic reporting
   */
  resetStats(): void {
    this.stats.reset();
  }

  /**
   * Update sampler options at runtime
   * Useful for dynamic configuration
   */
  updateOptions(options: Partial<SamplerOptions>): void {
    this.options = this.validateOptions({ ...this.options, ...options });
  }

  /**
   * Get current sample rate for errors
   */
  getErrorSampleRate(): number {
    return this.options.sampleRate ?? 1.0;
  }

  /**
   * Get current sample rate for transactions
   * Note: Returns the fixed rate, not accounting for custom sampler
   */
  getTransactionSampleRate(): number {
    return this.options.tracesSampleRate ?? 0;
  }

  /**
   * Check if a custom traces sampler is configured
   */
  hasCustomSampler(): boolean {
    return typeof this.options.tracesSampler === 'function';
  }
}
