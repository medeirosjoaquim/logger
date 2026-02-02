/**
 * Feature Flags Integration
 *
 * Generic integration for tracking feature flag evaluations.
 * Attaches flag context to events for debugging feature-related issues.
 *
 * @see https://docs.sentry.io/platforms/javascript/feature-flags/
 */

import type { Client } from '../types/client.js';
import type { Event as SentryEvent, EventHint } from '../types/sentry.js';
import type {
  FeatureFlagContext,
  FeatureFlagEvaluation,
  FeatureFlagsIntegration,
  FeatureFlagsIntegrationOptions,
  FeatureFlagValue,
} from './types.js';

/**
 * Default maximum number of flag evaluations to store
 */
const DEFAULT_MAX_EVALUATIONS = 100;

/**
 * Default context key for storing flags
 */
const DEFAULT_CONTEXT_KEY = 'flags';

/**
 * Internal state for the feature flags integration
 */
interface FeatureFlagsState {
  flags: Record<string, FeatureFlagValue>;
  evaluations: FeatureFlagEvaluation[];
  options: Required<FeatureFlagsIntegrationOptions>;
  client: Client | null;
}

/**
 * Create a feature flags integration instance
 *
 * @param options - Configuration options for the integration
 * @returns Feature flags integration instance
 *
 * @example
 * ```typescript
 * import { init } from 'universal-logger';
 * import { featureFlagsIntegration } from 'universal-logger/featureFlags';
 *
 * init({
 *   dsn: 'your-dsn',
 *   integrations: [
 *     featureFlagsIntegration({
 *       maxEvaluations: 100,
 *       attachToEvents: true,
 *     }),
 *   ],
 * });
 * ```
 */
export function featureFlagsIntegration(
  options: FeatureFlagsIntegrationOptions = {}
): FeatureFlagsIntegration {
  const state: FeatureFlagsState = {
    flags: {},
    evaluations: [],
    options: {
      maxEvaluations: options.maxEvaluations ?? DEFAULT_MAX_EVALUATIONS,
      attachToEvents: options.attachToEvents ?? true,
      trackDuplicates: options.trackDuplicates ?? false,
      contextKey: options.contextKey ?? DEFAULT_CONTEXT_KEY,
    },
    client: null,
  };

  return {
    name: 'FeatureFlags',

    /**
     * Track a feature flag evaluation
     */
    trackEvaluation(flag: string, value: FeatureFlagValue): void {
      // Skip if value hasn't changed and we're not tracking duplicates
      if (!state.options.trackDuplicates && state.flags[flag] === value) {
        return;
      }

      // Update current flag value
      state.flags[flag] = value;

      // Create evaluation record
      const evaluation: FeatureFlagEvaluation = {
        flagName: flag,
        flagValue: value,
        timestamp: Date.now(),
      };

      // Add to evaluations list
      state.evaluations.push(evaluation);

      // Trim to max evaluations (FIFO eviction)
      if (state.evaluations.length > state.options.maxEvaluations) {
        state.evaluations = state.evaluations.slice(-state.options.maxEvaluations);
      }
    },

    /**
     * Get all tracked flag evaluations
     */
    getEvaluations(): FeatureFlagEvaluation[] {
      return [...state.evaluations];
    },

    /**
     * Get current flag values
     */
    getFlags(): Record<string, FeatureFlagValue> {
      return { ...state.flags };
    },

    /**
     * Clear all tracked evaluations
     */
    clearEvaluations(): void {
      state.evaluations = [];
      state.flags = {};
    },

    /**
     * Set up the integration on a client
     */
    setup(client: Client): void {
      state.client = client;
    },

    /**
     * Process events to attach flag context
     */
    processEvent(
      event: SentryEvent,
      _hint: EventHint,
      _client: Client
    ): SentryEvent | null {
      if (!state.options.attachToEvents) {
        return event;
      }

      // Only attach if we have flag data
      if (
        Object.keys(state.flags).length === 0 &&
        state.evaluations.length === 0
      ) {
        return event;
      }

      // Build the feature flag context
      const flagContext: FeatureFlagContext = {
        flags: { ...state.flags },
        evaluations: state.evaluations.slice(-10), // Only include last 10 evaluations in event
      };

      // Attach to event contexts
      return {
        ...event,
        contexts: {
          ...event.contexts,
          [state.options.contextKey]: flagContext,
        },
      };
    },

    /**
     * Clean up the integration
     */
    teardown(): void {
      state.evaluations = [];
      state.flags = {};
      state.client = null;
    },
  };
}

/**
 * Singleton instance for module-level access
 */
let globalIntegration: FeatureFlagsIntegration | null = null;

/**
 * Get or create the global feature flags integration instance
 *
 * @param options - Configuration options (only used on first call)
 * @returns The global integration instance
 */
export function getFeatureFlagsIntegration(
  options?: FeatureFlagsIntegrationOptions
): FeatureFlagsIntegration {
  if (!globalIntegration) {
    globalIntegration = featureFlagsIntegration(options);
  }
  return globalIntegration;
}

/**
 * Set the global feature flags integration instance
 * Useful for setting up with a custom configuration
 *
 * @param integration - Integration instance to use globally
 */
export function setFeatureFlagsIntegration(
  integration: FeatureFlagsIntegration
): void {
  globalIntegration = integration;
}

/**
 * Reset the global integration instance
 * Useful for testing
 */
export function resetFeatureFlagsIntegration(): void {
  if (globalIntegration?.teardown) {
    globalIntegration.teardown();
  }
  globalIntegration = null;
}
