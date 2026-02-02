/**
 * Feature Flags Public API
 *
 * Provides top-level functions for tracking feature flag evaluations.
 * These functions use the global integration instance.
 *
 * @see https://docs.sentry.io/platforms/javascript/feature-flags/
 */

import type { FeatureFlagEvaluation, FeatureFlagValue } from './types.js';
import { getFeatureFlagsIntegration } from './integration.js';

/**
 * Add a feature flag evaluation to the tracking context.
 *
 * This function records a flag evaluation that will be attached to
 * subsequent events (errors, transactions) for debugging purposes.
 *
 * @param flagName - The name of the feature flag
 * @param flagValue - The evaluated value of the flag (boolean, string, or number)
 *
 * @example
 * ```typescript
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 *
 * // Track a boolean flag
 * addFeatureFlagEvaluation('new-checkout-flow', true);
 *
 * // Track a string flag (A/B test variant)
 * addFeatureFlagEvaluation('button-color', 'blue');
 *
 * // Track a numeric flag (percentage rollout)
 * addFeatureFlagEvaluation('request-timeout-ms', 5000);
 *
 * // If an error occurs, the flag context will be attached
 * captureException(new Error('Checkout failed'));
 * // Event will include: { contexts: { flags: { flags: { 'new-checkout-flow': true }, ... } } }
 * ```
 */
export function addFeatureFlagEvaluation(
  flagName: string,
  flagValue: FeatureFlagValue
): void {
  const integration = getFeatureFlagsIntegration();
  integration.trackEvaluation(flagName, flagValue);
}

/**
 * Get all feature flag evaluations from the current context.
 *
 * Returns the history of flag evaluations, limited by the maxEvaluations
 * configuration option (default: 100).
 *
 * @returns Array of flag evaluations in chronological order
 *
 * @example
 * ```typescript
 * import { getFeatureFlagEvaluations } from 'universal-logger';
 *
 * const evaluations = getFeatureFlagEvaluations();
 * console.log(evaluations);
 * // [
 * //   { flagName: 'feature-a', flagValue: true, timestamp: 1699000000000 },
 * //   { flagName: 'feature-b', flagValue: 'variant-1', timestamp: 1699000001000 },
 * // ]
 * ```
 */
export function getFeatureFlagEvaluations(): FeatureFlagEvaluation[] {
  const integration = getFeatureFlagsIntegration();
  return integration.getEvaluations();
}

/**
 * Get current feature flag values from the context.
 *
 * Returns a map of flag names to their most recent values.
 * This represents the current state of all tracked flags.
 *
 * @returns Record of flag names to their current values
 *
 * @example
 * ```typescript
 * import { getFeatureFlags } from 'universal-logger';
 *
 * const flags = getFeatureFlags();
 * console.log(flags);
 * // { 'feature-a': true, 'feature-b': 'variant-1', 'timeout-ms': 5000 }
 *
 * // Check a specific flag
 * if (flags['feature-a']) {
 *   // Feature is enabled
 * }
 * ```
 */
export function getFeatureFlags(): Record<string, FeatureFlagValue> {
  const integration = getFeatureFlagsIntegration();
  return integration.getFlags();
}

/**
 * Clear all feature flag evaluations from the context.
 *
 * This removes all tracked flag evaluations and resets the flags map.
 * Useful when starting a new user session or for testing.
 *
 * @example
 * ```typescript
 * import { clearFeatureFlagEvaluations } from 'universal-logger';
 *
 * // Clear all tracked evaluations
 * clearFeatureFlagEvaluations();
 *
 * // Start fresh
 * addFeatureFlagEvaluation('new-feature', true);
 * ```
 */
export function clearFeatureFlagEvaluations(): void {
  const integration = getFeatureFlagsIntegration();
  integration.clearEvaluations();
}

/**
 * Get a specific feature flag value from the context.
 *
 * Convenience function to get a single flag's current value.
 *
 * @param flagName - The name of the flag to retrieve
 * @returns The flag value, or undefined if not tracked
 *
 * @example
 * ```typescript
 * import { getFeatureFlag } from 'universal-logger';
 *
 * const isEnabled = getFeatureFlag('new-checkout-flow');
 * if (isEnabled === true) {
 *   // New checkout is enabled
 * }
 *
 * const variant = getFeatureFlag('button-color');
 * if (variant === 'blue') {
 *   // Use blue button
 * }
 * ```
 */
export function getFeatureFlag(flagName: string): FeatureFlagValue | undefined {
  const flags = getFeatureFlags();
  return flags[flagName];
}

/**
 * Check if a feature flag has been evaluated.
 *
 * @param flagName - The name of the flag to check
 * @returns True if the flag has been evaluated
 *
 * @example
 * ```typescript
 * import { hasFeatureFlag } from 'universal-logger';
 *
 * if (hasFeatureFlag('experimental-feature')) {
 *   console.log('Feature has been evaluated');
 * }
 * ```
 */
export function hasFeatureFlag(flagName: string): boolean {
  const flags = getFeatureFlags();
  return flagName in flags;
}

/**
 * Get the most recent evaluations for a specific flag.
 *
 * Returns all recorded evaluations for a given flag name,
 * useful for tracking changes over time.
 *
 * @param flagName - The name of the flag
 * @returns Array of evaluations for the specified flag
 *
 * @example
 * ```typescript
 * import { getFeatureFlagHistory } from 'universal-logger';
 *
 * const history = getFeatureFlagHistory('feature-rollout');
 * // Track how the flag value changed over time
 * for (const evaluation of history) {
 *   console.log(`${new Date(evaluation.timestamp)}: ${evaluation.flagValue}`);
 * }
 * ```
 */
export function getFeatureFlagHistory(
  flagName: string
): FeatureFlagEvaluation[] {
  const evaluations = getFeatureFlagEvaluations();
  return evaluations.filter((e) => e.flagName === flagName);
}
