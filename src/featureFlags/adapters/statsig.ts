/**
 * Statsig Feature Flags Adapter
 *
 * Wraps the Statsig SDK to automatically track flag evaluations.
 * This adapter is optional and tree-shakeable.
 *
 * @see https://docs.statsig.com/client/javascript-sdk
 */

import type {
  FeatureFlagAdapter,
  FeatureFlagValue,
  StatsigAdapterOptions,
} from '../types.js';

/**
 * Statsig client interface (minimal type definition)
 * This matches the essential parts of the Statsig JS SDK
 */
export interface StatsigClient {
  /**
   * Check a feature gate
   */
  checkGate(gateName: string): boolean;

  /**
   * Get a dynamic config value
   */
  getConfig?(configName: string): StatsigDynamicConfig;

  /**
   * Get an experiment
   */
  getExperiment?(experimentName: string): StatsigDynamicConfig;

  /**
   * Get parameter from layer
   */
  getLayer?(layerName: string): StatsigLayer;
}

/**
 * Statsig dynamic config interface
 */
export interface StatsigDynamicConfig {
  /**
   * Get a value from the config
   */
  get<T>(parameterName: string, defaultValue: T): T;

  /**
   * Get the value as a specific type
   */
  getValue?(parameterName: string, defaultValue?: unknown): unknown;
}

/**
 * Statsig layer interface
 */
export interface StatsigLayer {
  /**
   * Get a value from the layer
   */
  get<T>(parameterName: string, defaultValue: T): T;
}

/**
 * Internal state for the Statsig adapter
 */
interface StatsigAdapterState {
  client: StatsigClient | null;
  options: StatsigAdapterOptions;
  originalCheckGate: ((gateName: string) => boolean) | null;
  originalGetConfig:
    | ((configName: string) => StatsigDynamicConfig)
    | null;
  originalGetExperiment:
    | ((experimentName: string) => StatsigDynamicConfig)
    | null;
}

/**
 * Create a Statsig adapter instance
 *
 * @param options - Adapter configuration options
 * @returns Statsig adapter instance
 *
 * @example
 * ```typescript
 * import { statsigAdapter } from 'universal-logger/featureFlags/adapters/statsig';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 * import { Statsig } from 'statsig-js';
 *
 * await Statsig.initialize('client-sdk-key', { userID: 'user-123' });
 *
 * const adapter = statsigAdapter({
 *   onEvaluation: addFeatureFlagEvaluation,
 *   trackDynamicConfigs: true,
 *   trackExperiments: true,
 * });
 *
 * adapter.init(Statsig);
 * ```
 */
export function statsigAdapter(
  options: StatsigAdapterOptions
): FeatureFlagAdapter {
  const state: StatsigAdapterState = {
    client: null,
    options: {
      ...options,
      trackDynamicConfigs: options.trackDynamicConfigs ?? true,
      trackExperiments: options.trackExperiments ?? true,
    },
    originalCheckGate: null,
    originalGetConfig: null,
    originalGetExperiment: null,
  };

  return {
    name: 'Statsig',

    /**
     * Initialize the adapter with a Statsig client
     */
    init(providerInstance: unknown): void {
      const client = providerInstance as StatsigClient;
      state.client = client;

      // Wrap checkGate method
      state.originalCheckGate = client.checkGate.bind(client);
      client.checkGate = (gateName: string): boolean => {
        const value = state.originalCheckGate!(gateName);
        state.options.onEvaluation(gateName, value);
        return value;
      };

      // Wrap getConfig method if it exists and tracking is enabled
      if (state.options.trackDynamicConfigs && client.getConfig) {
        state.originalGetConfig = client.getConfig.bind(client);
        client.getConfig = (configName: string): StatsigDynamicConfig => {
          const config = state.originalGetConfig!(configName);
          return wrapDynamicConfig(
            config,
            configName,
            state.options.onEvaluation,
            'config'
          );
        };
      }

      // Wrap getExperiment method if it exists and tracking is enabled
      if (state.options.trackExperiments && client.getExperiment) {
        state.originalGetExperiment = client.getExperiment.bind(client);
        client.getExperiment = (experimentName: string): StatsigDynamicConfig => {
          const experiment = state.originalGetExperiment!(experimentName);
          return wrapDynamicConfig(
            experiment,
            experimentName,
            state.options.onEvaluation,
            'experiment'
          );
        };
      }
    },

    /**
     * Clean up the adapter
     */
    teardown(): void {
      if (state.client && state.originalCheckGate) {
        state.client.checkGate = state.originalCheckGate;
      }

      if (state.client?.getConfig && state.originalGetConfig) {
        state.client.getConfig = state.originalGetConfig;
      }

      if (state.client?.getExperiment && state.originalGetExperiment) {
        state.client.getExperiment = state.originalGetExperiment;
      }

      state.client = null;
      state.originalCheckGate = null;
      state.originalGetConfig = null;
      state.originalGetExperiment = null;
    },
  };
}

/**
 * Wrap a dynamic config to track parameter access
 */
function wrapDynamicConfig(
  config: StatsigDynamicConfig,
  name: string,
  onEvaluation: (flagName: string, flagValue: FeatureFlagValue) => void,
  type: 'config' | 'experiment'
): StatsigDynamicConfig {
  const originalGet = config.get.bind(config);

  return {
    ...config,
    get<T>(parameterName: string, defaultValue: T): T {
      const value = originalGet(parameterName, defaultValue);

      // Track the evaluation with a composite name
      const flagName = `${type}:${name}:${parameterName}`;
      const flagValue = convertToFlagValue(value);
      if (flagValue !== undefined) {
        onEvaluation(flagName, flagValue);
      }

      return value;
    },
  };
}

/**
 * Convert an unknown value to a FeatureFlagValue
 * Returns undefined if the value cannot be converted
 */
function convertToFlagValue(value: unknown): FeatureFlagValue | undefined {
  if (typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (typeof value === 'number' && !Number.isNaN(value)) {
    return value;
  }
  return undefined;
}

/**
 * Create a wrapped Statsig client that automatically tracks evaluations
 *
 * @param client - The Statsig client to wrap
 * @param onEvaluation - Callback for flag evaluations
 * @param options - Optional configuration
 * @returns Wrapped client with automatic tracking
 *
 * @example
 * ```typescript
 * import { wrapStatsigClient } from 'universal-logger/featureFlags/adapters/statsig';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 *
 * const wrappedStatsig = wrapStatsigClient(Statsig, addFeatureFlagEvaluation);
 *
 * // Use wrappedStatsig instead of Statsig
 * const isEnabled = wrappedStatsig.checkGate('my-gate');
 * // Automatically tracks the evaluation
 * ```
 */
export function wrapStatsigClient<T extends StatsigClient>(
  client: T,
  onEvaluation: (flagName: string, flagValue: FeatureFlagValue) => void,
  options?: Partial<StatsigAdapterOptions>
): T {
  const adapter = statsigAdapter({
    onEvaluation,
    trackDynamicConfigs: options?.trackDynamicConfigs,
    trackExperiments: options?.trackExperiments,
  });
  adapter.init(client);
  return client;
}
