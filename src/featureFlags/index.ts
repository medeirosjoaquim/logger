/**
 * Feature Flags Module
 *
 * Provides feature flag tracking and integration for the Universal Logger.
 * Track flag evaluations to help debug feature-related issues.
 *
 * @see https://docs.sentry.io/platforms/javascript/feature-flags/
 *
 * @example
 * ```typescript
 * // Basic usage with manual tracking
 * import { init, addFeatureFlagEvaluation, captureException } from 'universal-logger';
 * import { featureFlagsIntegration } from 'universal-logger/featureFlags';
 *
 * init({
 *   dsn: 'your-dsn',
 *   integrations: [featureFlagsIntegration()],
 * });
 *
 * // Track flag evaluations in your code
 * addFeatureFlagEvaluation('new-checkout-flow', true);
 * addFeatureFlagEvaluation('button-color', 'blue');
 *
 * // When an error occurs, the flag context is attached
 * captureException(new Error('Checkout failed'));
 * ```
 *
 * @example
 * ```typescript
 * // Usage with LaunchDarkly adapter
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 * import { wrapLaunchDarklyClient } from 'universal-logger/featureFlags/adapters/launchdarkly';
 * import * as LDClient from 'launchdarkly-js-client-sdk';
 *
 * const ldClient = LDClient.initialize('client-side-id', { key: 'user-key' });
 * const wrappedClient = wrapLaunchDarklyClient(ldClient, addFeatureFlagEvaluation);
 *
 * // Now all flag evaluations are automatically tracked
 * const isEnabled = wrappedClient.variation('my-flag', false);
 * ```
 */

// ============================================
// Types
// ============================================
export type {
  FeatureFlagValue,
  FeatureFlagEvaluation,
  FeatureFlagContext,
  FeatureFlagsIntegration,
  FeatureFlagsIntegrationOptions,
  FeatureFlagAdapter,
  AdapterOptions,
  LaunchDarklyAdapterOptions,
  StatsigAdapterOptions,
  UnleashAdapterOptions,
  OpenFeatureAdapterOptions,
} from './types.js';

// ============================================
// Integration
// ============================================
export {
  featureFlagsIntegration,
  getFeatureFlagsIntegration,
  setFeatureFlagsIntegration,
  resetFeatureFlagsIntegration,
} from './integration.js';

// ============================================
// Public API
// ============================================
export {
  addFeatureFlagEvaluation,
  getFeatureFlagEvaluations,
  getFeatureFlags,
  clearFeatureFlagEvaluations,
  getFeatureFlag,
  hasFeatureFlag,
  getFeatureFlagHistory,
} from './api.js';

// ============================================
// Adapters (re-exported for convenience)
// ============================================
// Note: For tree-shaking, import directly from the adapter files
export {
  // LaunchDarkly
  launchDarklyAdapter,
  wrapLaunchDarklyClient,

  // Statsig
  statsigAdapter,
  wrapStatsigClient,

  // Unleash
  unleashAdapter,
  wrapUnleashClient,

  // OpenFeature
  openFeatureAdapter,
  wrapOpenFeatureClient,
  createOpenFeatureHook,
} from './adapters/index.js';
