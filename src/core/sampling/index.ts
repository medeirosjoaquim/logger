/**
 * Sampling module for the Universal Sentry-Compatible Logger
 *
 * Provides comprehensive sampling functionality including:
 * - Deterministic and probabilistic sampling
 * - Distributed tracing support (parent sampling propagation)
 * - Custom sampling functions
 * - Sampling statistics and monitoring
 * - Client reports for dropped event tracking
 * - Dynamic Sampling Context (DSC) support
 *
 * @example
 * ```typescript
 * import { createSampler, ClientReportManager, extractSamplingDecision } from './sampling';
 *
 * // Create a sampler with custom configuration
 * const sampler = createSampler({
 *   sampleRate: 1.0, // Sample all errors
 *   tracesSampleRate: 0.1, // Sample 10% of transactions
 *   tracesSampler: (context) => {
 *     // Custom logic: always sample payment transactions
 *     if (context.transactionContext?.op === 'payment') {
 *       return true;
 *     }
 *     return 0.1; // 10% for everything else
 *   }
 * });
 *
 * // Use the sampler
 * if (sampler.shouldSampleError()) {
 *   // Send error to Sentry
 * }
 *
 * if (sampler.shouldSampleTransaction({ name: 'checkout', transactionContext: { name: 'checkout', op: 'payment' } })) {
 *   // Start transaction
 * }
 * ```
 */

// Main sampler
export {
  Sampler,
  type SamplingContext,
  type SamplerOptions
} from './sampler';

// Statistics tracking
export {
  SamplingStats,
  type SamplingStatsData,
  type CategoryStats
} from './stats';

// Client reports for dropped events
export {
  ClientReportManager,
  createClientReportEnvelopeItem,
  type ClientReportOutcome,
  type ClientReport,
  type SendReportCallback
} from './clientReports';

// Trace propagation and DSC
export {
  extractSamplingDecision,
  parseSentryTrace,
  createSentryTrace,
  parseBaggageToDsc,
  dscToBaggage,
  mergeBaggageWithDsc,
  createDsc,
  isSameDsc,
  type DynamicSamplingContext,
  type SamplingDecision,
  type TraceContext
} from './propagation';

// Re-import for convenience function
import { Sampler, type SamplerOptions } from './sampler';

/**
 * Convenience function to create a new Sampler instance
 *
 * @param options - Sampler configuration options
 * @returns A new Sampler instance
 *
 * @example
 * ```typescript
 * const sampler = createSampler({
 *   sampleRate: 1.0,
 *   tracesSampleRate: 0.2
 * });
 * ```
 */
export function createSampler(options: SamplerOptions = {}): Sampler {
  return new Sampler(options);
}

/**
 * Default sampler instance for simple use cases
 * Samples all errors, no transactions
 */
export const defaultSampler = new Sampler({
  sampleRate: 1.0,
  tracesSampleRate: 0
});
