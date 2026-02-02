/**
 * Feature Flags Adapters
 *
 * Provider-specific adapters for automatic flag evaluation tracking.
 * Each adapter wraps a feature flag provider's SDK to automatically
 * track evaluations with the Universal Logger.
 *
 * These adapters are optional and tree-shakeable - only import the
 * adapters you need for your specific provider.
 */

// LaunchDarkly adapter
export {
  launchDarklyAdapter,
  wrapLaunchDarklyClient,
  type LaunchDarklyClient,
} from './launchdarkly.js';

// Statsig adapter
export {
  statsigAdapter,
  wrapStatsigClient,
  type StatsigClient,
  type StatsigDynamicConfig,
  type StatsigLayer,
} from './statsig.js';

// Unleash adapter
export {
  unleashAdapter,
  wrapUnleashClient,
  type UnleashClient,
  type UnleashVariant,
} from './unleash.js';

// OpenFeature adapter
export {
  openFeatureAdapter,
  wrapOpenFeatureClient,
  createOpenFeatureHook,
  type OpenFeatureClient,
  type OpenFeatureEvaluationDetails,
  type OpenFeatureHook,
  type OpenFeatureHookContext,
} from './openfeature.js';
