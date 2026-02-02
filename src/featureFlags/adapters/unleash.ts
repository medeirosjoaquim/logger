/**
 * Unleash Feature Flags Adapter
 *
 * Wraps the Unleash client SDK to automatically track flag evaluations.
 * This adapter is optional and tree-shakeable.
 *
 * @see https://docs.getunleash.io/reference/sdks/javascript-browser
 */

import type {
  FeatureFlagAdapter,
  FeatureFlagValue,
  UnleashAdapterOptions,
} from '../types.js';

/**
 * Unleash client interface (minimal type definition)
 * This matches the essential parts of the Unleash JS SDK client
 */
export interface UnleashClient {
  /**
   * Check if a feature is enabled
   */
  isEnabled(toggleName: string, context?: unknown): boolean;

  /**
   * Get variant for a feature
   */
  getVariant?(toggleName: string, context?: unknown): UnleashVariant;

  /**
   * Subscribe to events
   */
  on?(event: string, callback: (...args: unknown[]) => void): void;

  /**
   * Unsubscribe from events
   */
  off?(event: string, callback: (...args: unknown[]) => void): void;
}

/**
 * Unleash variant interface
 */
export interface UnleashVariant {
  /**
   * Variant name
   */
  name: string;

  /**
   * Whether the variant is enabled
   */
  enabled: boolean;

  /**
   * Optional payload
   */
  payload?: {
    type: string;
    value: string;
  };
}

/**
 * Internal state for the Unleash adapter
 */
interface UnleashAdapterState {
  client: UnleashClient | null;
  options: UnleashAdapterOptions;
  originalIsEnabled:
    | ((toggleName: string, context?: unknown) => boolean)
    | null;
  originalGetVariant:
    | ((toggleName: string, context?: unknown) => UnleashVariant)
    | null;
  updateListener: (() => void) | null;
}

/**
 * Create an Unleash adapter instance
 *
 * @param options - Adapter configuration options
 * @returns Unleash adapter instance
 *
 * @example
 * ```typescript
 * import { unleashAdapter } from 'universal-logger/featureFlags/adapters/unleash';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 * import { UnleashClient } from 'unleash-proxy-client';
 *
 * const unleash = new UnleashClient({
 *   url: 'https://unleash.example.com/api/frontend',
 *   clientKey: 'your-client-key',
 *   appName: 'my-app',
 * });
 *
 * const adapter = unleashAdapter({
 *   onEvaluation: addFeatureFlagEvaluation,
 *   trackVariants: true,
 * });
 *
 * adapter.init(unleash);
 * await unleash.start();
 * ```
 */
export function unleashAdapter(
  options: UnleashAdapterOptions
): FeatureFlagAdapter {
  const state: UnleashAdapterState = {
    client: null,
    options: {
      ...options,
      trackVariants: options.trackVariants ?? true,
    },
    originalIsEnabled: null,
    originalGetVariant: null,
    updateListener: null,
  };

  return {
    name: 'Unleash',

    /**
     * Initialize the adapter with an Unleash client
     */
    init(providerInstance: unknown): void {
      const client = providerInstance as UnleashClient;
      state.client = client;

      // Wrap isEnabled method
      state.originalIsEnabled = client.isEnabled.bind(client);
      client.isEnabled = (toggleName: string, context?: unknown): boolean => {
        const value = state.originalIsEnabled!(toggleName, context);
        state.options.onEvaluation(toggleName, value);
        return value;
      };

      // Wrap getVariant method if it exists and tracking is enabled
      if (state.options.trackVariants && client.getVariant) {
        state.originalGetVariant = client.getVariant.bind(client);
        client.getVariant = (
          toggleName: string,
          context?: unknown
        ): UnleashVariant => {
          const variant = state.originalGetVariant!(toggleName, context);

          // Track the variant as a flag evaluation
          if (variant.enabled) {
            // Use variant name as the value, or payload value if available
            let flagValue: FeatureFlagValue = variant.name;
            if (variant.payload) {
              const parsedValue = parsePayloadValue(variant.payload);
              if (parsedValue !== undefined) {
                flagValue = parsedValue;
              }
            }
            state.options.onEvaluation(`${toggleName}:variant`, flagValue);
          }

          return variant;
        };
      }

      // Listen for flag updates
      if (client.on) {
        state.updateListener = () => {
          // Unleash doesn't provide details about which flags updated
          // This is just for notification purposes
        };
        client.on('update', state.updateListener);
      }
    },

    /**
     * Clean up the adapter
     */
    teardown(): void {
      if (state.client && state.originalIsEnabled) {
        state.client.isEnabled = state.originalIsEnabled;
      }

      if (state.client?.getVariant && state.originalGetVariant) {
        state.client.getVariant = state.originalGetVariant;
      }

      if (state.client?.off && state.updateListener) {
        state.client.off('update', state.updateListener);
      }

      state.client = null;
      state.originalIsEnabled = null;
      state.originalGetVariant = null;
      state.updateListener = null;
    },
  };
}

/**
 * Parse a variant payload value to a FeatureFlagValue
 */
function parsePayloadValue(payload: {
  type: string;
  value: string;
}): FeatureFlagValue | undefined {
  switch (payload.type) {
    case 'string':
      return payload.value;
    case 'number':
      const num = Number(payload.value);
      return Number.isNaN(num) ? undefined : num;
    case 'json':
      try {
        const parsed = JSON.parse(payload.value);
        // Only return primitive values
        if (
          typeof parsed === 'boolean' ||
          typeof parsed === 'string' ||
          typeof parsed === 'number'
        ) {
          return parsed;
        }
      } catch {
        // Invalid JSON
      }
      return undefined;
    default:
      return payload.value;
  }
}

/**
 * Create a wrapped Unleash client that automatically tracks evaluations
 *
 * @param client - The Unleash client to wrap
 * @param onEvaluation - Callback for flag evaluations
 * @param options - Optional configuration
 * @returns Wrapped client with automatic tracking
 *
 * @example
 * ```typescript
 * import { wrapUnleashClient } from 'universal-logger/featureFlags/adapters/unleash';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 *
 * const unleash = new UnleashClient({ ... });
 * const wrappedUnleash = wrapUnleashClient(unleash, addFeatureFlagEvaluation);
 *
 * // Use wrappedUnleash instead of unleash
 * const isEnabled = wrappedUnleash.isEnabled('my-feature');
 * // Automatically tracks the evaluation
 * ```
 */
export function wrapUnleashClient<T extends UnleashClient>(
  client: T,
  onEvaluation: (flagName: string, flagValue: FeatureFlagValue) => void,
  options?: Partial<UnleashAdapterOptions>
): T {
  const adapter = unleashAdapter({
    onEvaluation,
    trackVariants: options?.trackVariants,
  });
  adapter.init(client);
  return client;
}
