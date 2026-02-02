/**
 * OpenFeature Feature Flags Adapter
 *
 * Wraps the OpenFeature SDK to automatically track flag evaluations.
 * OpenFeature is a vendor-neutral, feature flagging standard.
 * This adapter is optional and tree-shakeable.
 *
 * @see https://openfeature.dev/docs/reference/technologies/client/web
 */

import type {
  FeatureFlagAdapter,
  FeatureFlagValue,
  OpenFeatureAdapterOptions,
} from '../types.js';

/**
 * OpenFeature client interface (minimal type definition)
 * This matches the essential parts of the OpenFeature web SDK client
 */
export interface OpenFeatureClient {
  /**
   * Get boolean value for a flag
   */
  getBooleanValue(
    flagKey: string,
    defaultValue: boolean,
    context?: unknown,
    options?: unknown
  ): Promise<boolean>;

  /**
   * Get string value for a flag
   */
  getStringValue(
    flagKey: string,
    defaultValue: string,
    context?: unknown,
    options?: unknown
  ): Promise<string>;

  /**
   * Get number value for a flag
   */
  getNumberValue(
    flagKey: string,
    defaultValue: number,
    context?: unknown,
    options?: unknown
  ): Promise<number>;

  /**
   * Get object value for a flag
   */
  getObjectValue?<T = unknown>(
    flagKey: string,
    defaultValue: T,
    context?: unknown,
    options?: unknown
  ): Promise<T>;

  /**
   * Get boolean value details
   */
  getBooleanDetails?(
    flagKey: string,
    defaultValue: boolean,
    context?: unknown,
    options?: unknown
  ): Promise<OpenFeatureEvaluationDetails<boolean>>;

  /**
   * Get string value details
   */
  getStringDetails?(
    flagKey: string,
    defaultValue: string,
    context?: unknown,
    options?: unknown
  ): Promise<OpenFeatureEvaluationDetails<string>>;

  /**
   * Get number value details
   */
  getNumberDetails?(
    flagKey: string,
    defaultValue: number,
    context?: unknown,
    options?: unknown
  ): Promise<OpenFeatureEvaluationDetails<number>>;

  /**
   * Add an event handler
   */
  addHandler?(event: string, handler: (...args: unknown[]) => void): void;

  /**
   * Remove an event handler
   */
  removeHandler?(event: string, handler: (...args: unknown[]) => void): void;
}

/**
 * OpenFeature evaluation details
 */
export interface OpenFeatureEvaluationDetails<T> {
  /**
   * The evaluated value
   */
  value: T;

  /**
   * The variant that was selected
   */
  variant?: string;

  /**
   * The reason for the evaluation result
   */
  reason?: string;

  /**
   * Error code if evaluation failed
   */
  errorCode?: string;

  /**
   * Error message if evaluation failed
   */
  errorMessage?: string;
}

/**
 * Internal state for the OpenFeature adapter
 */
interface OpenFeatureAdapterState {
  client: OpenFeatureClient | null;
  options: OpenFeatureAdapterOptions;
  originalGetBooleanValue:
    | OpenFeatureClient['getBooleanValue']
    | null;
  originalGetStringValue:
    | OpenFeatureClient['getStringValue']
    | null;
  originalGetNumberValue:
    | OpenFeatureClient['getNumberValue']
    | null;
}

/**
 * Create an OpenFeature adapter instance
 *
 * @param options - Adapter configuration options
 * @returns OpenFeature adapter instance
 *
 * @example
 * ```typescript
 * import { openFeatureAdapter } from 'universal-logger/featureFlags/adapters/openfeature';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 * import { OpenFeature } from '@openfeature/web-sdk';
 *
 * await OpenFeature.setProvider(yourProvider);
 * const client = OpenFeature.getClient();
 *
 * const adapter = openFeatureAdapter({
 *   onEvaluation: addFeatureFlagEvaluation,
 *   trackAllTypes: true,
 * });
 *
 * adapter.init(client);
 * ```
 */
export function openFeatureAdapter(
  options: OpenFeatureAdapterOptions
): FeatureFlagAdapter {
  const state: OpenFeatureAdapterState = {
    client: null,
    options: {
      ...options,
      trackAllTypes: options.trackAllTypes ?? true,
    },
    originalGetBooleanValue: null,
    originalGetStringValue: null,
    originalGetNumberValue: null,
  };

  return {
    name: 'OpenFeature',

    /**
     * Initialize the adapter with an OpenFeature client
     */
    init(providerInstance: unknown): void {
      const client = providerInstance as OpenFeatureClient;
      state.client = client;

      // Wrap getBooleanValue method
      state.originalGetBooleanValue = client.getBooleanValue.bind(client);
      client.getBooleanValue = async (
        flagKey: string,
        defaultValue: boolean,
        context?: unknown,
        options?: unknown
      ): Promise<boolean> => {
        const value = await state.originalGetBooleanValue!(
          flagKey,
          defaultValue,
          context,
          options
        );
        state.options.onEvaluation(flagKey, value);
        return value;
      };

      // Wrap getStringValue method
      state.originalGetStringValue = client.getStringValue.bind(client);
      client.getStringValue = async (
        flagKey: string,
        defaultValue: string,
        context?: unknown,
        options?: unknown
      ): Promise<string> => {
        const value = await state.originalGetStringValue!(
          flagKey,
          defaultValue,
          context,
          options
        );
        state.options.onEvaluation(flagKey, value);
        return value;
      };

      // Wrap getNumberValue method
      state.originalGetNumberValue = client.getNumberValue.bind(client);
      client.getNumberValue = async (
        flagKey: string,
        defaultValue: number,
        context?: unknown,
        options?: unknown
      ): Promise<number> => {
        const value = await state.originalGetNumberValue!(
          flagKey,
          defaultValue,
          context,
          options
        );
        state.options.onEvaluation(flagKey, value);
        return value;
      };
    },

    /**
     * Clean up the adapter
     */
    teardown(): void {
      if (state.client) {
        if (state.originalGetBooleanValue) {
          state.client.getBooleanValue = state.originalGetBooleanValue;
        }
        if (state.originalGetStringValue) {
          state.client.getStringValue = state.originalGetStringValue;
        }
        if (state.originalGetNumberValue) {
          state.client.getNumberValue = state.originalGetNumberValue;
        }
      }

      state.client = null;
      state.originalGetBooleanValue = null;
      state.originalGetStringValue = null;
      state.originalGetNumberValue = null;
    },
  };
}

/**
 * Create a wrapped OpenFeature client that automatically tracks evaluations
 *
 * @param client - The OpenFeature client to wrap
 * @param onEvaluation - Callback for flag evaluations
 * @param options - Optional configuration
 * @returns Wrapped client with automatic tracking
 *
 * @example
 * ```typescript
 * import { wrapOpenFeatureClient } from 'universal-logger/featureFlags/adapters/openfeature';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 *
 * const client = OpenFeature.getClient();
 * const wrappedClient = wrapOpenFeatureClient(client, addFeatureFlagEvaluation);
 *
 * // Use wrappedClient instead of client
 * const isEnabled = await wrappedClient.getBooleanValue('my-flag', false);
 * // Automatically tracks the evaluation
 * ```
 */
export function wrapOpenFeatureClient<T extends OpenFeatureClient>(
  client: T,
  onEvaluation: (flagName: string, flagValue: FeatureFlagValue) => void,
  options?: Partial<OpenFeatureAdapterOptions>
): T {
  const adapter = openFeatureAdapter({
    onEvaluation,
    trackAllTypes: options?.trackAllTypes,
  });
  adapter.init(client);
  return client;
}

/**
 * Create a hook for OpenFeature that automatically tracks evaluations
 *
 * OpenFeature supports hooks that run during flag evaluation.
 * This hook tracks all flag evaluations through the standard hook mechanism.
 *
 * @param onEvaluation - Callback for flag evaluations
 * @returns OpenFeature hook object
 *
 * @example
 * ```typescript
 * import { createOpenFeatureHook } from 'universal-logger/featureFlags/adapters/openfeature';
 * import { addFeatureFlagEvaluation } from 'universal-logger';
 * import { OpenFeature } from '@openfeature/web-sdk';
 *
 * const trackingHook = createOpenFeatureHook(addFeatureFlagEvaluation);
 * OpenFeature.addHooks(trackingHook);
 *
 * // All flag evaluations will now be tracked automatically
 * ```
 */
export function createOpenFeatureHook(
  onEvaluation: (flagName: string, flagValue: FeatureFlagValue) => void
): OpenFeatureHook {
  return {
    after: (hookContext, evaluationDetails) => {
      const value = evaluationDetails.value;
      if (
        typeof value === 'boolean' ||
        typeof value === 'string' ||
        typeof value === 'number'
      ) {
        onEvaluation(hookContext.flagKey, value);
      }
    },
  };
}

/**
 * OpenFeature hook interface
 */
export interface OpenFeatureHook {
  /**
   * Called before flag evaluation
   */
  before?(hookContext: OpenFeatureHookContext): void | Promise<void>;

  /**
   * Called after flag evaluation
   */
  after?(
    hookContext: OpenFeatureHookContext,
    evaluationDetails: OpenFeatureEvaluationDetails<unknown>
  ): void | Promise<void>;

  /**
   * Called when an error occurs
   */
  error?(
    hookContext: OpenFeatureHookContext,
    error: unknown
  ): void | Promise<void>;

  /**
   * Called at the end of evaluation (always)
   */
  finally?(hookContext: OpenFeatureHookContext): void | Promise<void>;
}

/**
 * OpenFeature hook context
 */
export interface OpenFeatureHookContext {
  /**
   * The flag key being evaluated
   */
  flagKey: string;

  /**
   * The flag value type
   */
  flagValueType: 'boolean' | 'string' | 'number' | 'object';

  /**
   * The default value
   */
  defaultValue: unknown;

  /**
   * The evaluation context
   */
  context?: unknown;

  /**
   * The client metadata
   */
  clientMetadata?: unknown;

  /**
   * The provider metadata
   */
  providerMetadata?: unknown;
}
