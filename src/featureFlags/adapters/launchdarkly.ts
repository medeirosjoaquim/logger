/**
 * LaunchDarkly Feature Flags Adapter
 *
 * Wraps the LaunchDarkly SDK to automatically track flag evaluations.
 * This adapter is optional and tree-shakeable.
 *
 * @see https://docs.launchdarkly.com/sdk/client-side/javascript
 */

import type {
  FeatureFlagAdapter,
  FeatureFlagValue,
  LaunchDarklyAdapterOptions,
} from '../types.js';

/**
 * LaunchDarkly client interface (minimal type definition)
 * This matches the essential parts of the LaunchDarkly JS SDK client
 */
export interface LaunchDarklyClient {
  /**
   * Get variation for a flag
   */
  variation(flagKey: string, defaultValue: unknown): unknown;

  /**
   * Get boolean variation
   */
  boolVariation?(flagKey: string, defaultValue: boolean): boolean;

  /**
   * Get string variation
   */
  stringVariation?(flagKey: string, defaultValue: string): string;

  /**
   * Get number variation
   */
  numberVariation?(flagKey: string, defaultValue: number): number;

  /**
   * Get all flags
   */
  allFlags?(): Record<string, unknown>;

  /**
   * Listen for flag changes
   */
  on?(event: string, callback: (...args: unknown[]) => void): void;

  /**
   * Remove listener
   */
  off?(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Internal state for the LaunchDarkly adapter
 */
interface LaunchDarklyAdapterState {
  client: LaunchDarklyClient | null;
  options: LaunchDarklyAdapterOptions;
  originalVariation: ((flagKey: string, defaultValue: unknown) => unknown) | null;
  changeListener: ((...args: unknown[]) => void) | null;
}

/**
 * Create a LaunchDarkly adapter instance
 *
 * @param options - Adapter configuration options
 * @returns LaunchDarkly adapter instance
 *
 * @example
 * ```typescript
 * import { launchDarklyAdapter } from 'universal-logger/featureFlags/adapters/launchdarkly';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 * import * as LDClient from 'launchdarkly-js-client-sdk';
 *
 * const ldClient = LDClient.initialize('client-side-id', { key: 'user-key' });
 *
 * const adapter = launchDarklyAdapter({
 *   onEvaluation: addFeatureFlagEvaluation,
 *   trackAllFlags: true,
 * });
 *
 * adapter.init(ldClient);
 * ```
 */
export function launchDarklyAdapter(
  options: LaunchDarklyAdapterOptions
): FeatureFlagAdapter {
  const state: LaunchDarklyAdapterState = {
    client: null,
    options: {
      ...options,
      trackAllFlags: options.trackAllFlags ?? true,
    },
    originalVariation: null,
    changeListener: null,
  };

  return {
    name: 'LaunchDarkly',

    /**
     * Initialize the adapter with a LaunchDarkly client
     */
    init(providerInstance: unknown): void {
      const client = providerInstance as LaunchDarklyClient;
      state.client = client;

      // Store original variation method
      state.originalVariation = client.variation.bind(client);

      // Wrap the variation method to track evaluations
      client.variation = (flagKey: string, defaultValue: unknown): unknown => {
        const value = state.originalVariation!(flagKey, defaultValue);

        // Convert to FeatureFlagValue if possible
        const flagValue = convertToFlagValue(value);
        if (flagValue !== undefined) {
          state.options.onEvaluation(flagKey, flagValue);
        }

        return value;
      };

      // Wrap typed variation methods if they exist
      if (client.boolVariation) {
        const originalBoolVariation = client.boolVariation.bind(client);
        client.boolVariation = (flagKey: string, defaultValue: boolean): boolean => {
          const value = originalBoolVariation(flagKey, defaultValue);
          state.options.onEvaluation(flagKey, value);
          return value;
        };
      }

      if (client.stringVariation) {
        const originalStringVariation = client.stringVariation.bind(client);
        client.stringVariation = (flagKey: string, defaultValue: string): string => {
          const value = originalStringVariation(flagKey, defaultValue);
          state.options.onEvaluation(flagKey, value);
          return value;
        };
      }

      if (client.numberVariation) {
        const originalNumberVariation = client.numberVariation.bind(client);
        client.numberVariation = (flagKey: string, defaultValue: number): number => {
          const value = originalNumberVariation(flagKey, defaultValue);
          state.options.onEvaluation(flagKey, value);
          return value;
        };
      }

      // Track all flag changes if enabled
      if (state.options.trackAllFlags && client.on) {
        state.changeListener = (...args: unknown[]) => {
          // LaunchDarkly passes the flag key as the first argument
          const key = args[0];
          if (typeof key !== 'string') return;

          // Re-evaluate the flag to get the new value
          if (client.allFlags) {
            const flags = client.allFlags();
            const value = flags[key];
            const flagValue = convertToFlagValue(value);
            if (flagValue !== undefined) {
              state.options.onEvaluation(key, flagValue);
            }
          }
        };
        client.on('change', state.changeListener);
      }
    },

    /**
     * Clean up the adapter
     */
    teardown(): void {
      if (state.client && state.originalVariation) {
        // Restore original variation method
        state.client.variation = state.originalVariation;
      }

      // Remove change listener
      if (state.client?.off && state.changeListener) {
        state.client.off('change', state.changeListener);
      }

      state.client = null;
      state.originalVariation = null;
      state.changeListener = null;
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
  // Cannot convert objects, arrays, null, undefined, etc.
  return undefined;
}

/**
 * Create a wrapped LaunchDarkly client that automatically tracks evaluations
 *
 * This is an alternative to using the adapter pattern that returns a new
 * client instance with tracking built in.
 *
 * @param client - The LaunchDarkly client to wrap
 * @param onEvaluation - Callback for flag evaluations
 * @returns Wrapped client with automatic tracking
 *
 * @example
 * ```typescript
 * import { wrapLaunchDarklyClient } from 'universal-logger/featureFlags/adapters/launchdarkly';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 *
 * const ldClient = LDClient.initialize('client-side-id', { key: 'user-key' });
 * const wrappedClient = wrapLaunchDarklyClient(ldClient, addFeatureFlagEvaluation);
 *
 * // Use wrappedClient instead of ldClient
 * const isEnabled = wrappedClient.variation('my-flag', false);
 * // Automatically tracks the evaluation
 * ```
 */
export function wrapLaunchDarklyClient<T extends LaunchDarklyClient>(
  client: T,
  onEvaluation: (flagName: string, flagValue: FeatureFlagValue) => void
): T {
  const adapter = launchDarklyAdapter({ onEvaluation });
  adapter.init(client);
  return client;
}
