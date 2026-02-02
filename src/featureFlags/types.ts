/**
 * Feature Flags Type Definitions
 *
 * Types for feature flag tracking and integration with the Universal Logger.
 * Allows tracking flag evaluations for debugging feature-related issues.
 *
 * @see https://docs.sentry.io/platforms/javascript/feature-flags/
 */

import type { Client } from '../types/client.js';
import type { Event as SentryEvent, EventHint } from '../types/sentry.js';

/**
 * Allowed types for feature flag values
 */
export type FeatureFlagValue = boolean | string | number;

/**
 * Represents a single feature flag evaluation
 */
export interface FeatureFlagEvaluation {
  /**
   * Name of the feature flag
   */
  flagName: string;

  /**
   * Value of the feature flag when evaluated
   */
  flagValue: FeatureFlagValue;

  /**
   * Timestamp when the flag was evaluated (milliseconds since epoch)
   */
  timestamp: number;
}

/**
 * Context containing feature flag data for a scope
 */
export interface FeatureFlagContext {
  /**
   * Current flag values keyed by flag name
   */
  flags: Record<string, FeatureFlagValue>;

  /**
   * History of flag evaluations (limited to prevent memory issues)
   */
  evaluations: FeatureFlagEvaluation[];
}

/**
 * Extended integration interface for feature flags
 */
export interface FeatureFlagsIntegration {
  /**
   * Integration name
   */
  name: 'FeatureFlags';

  /**
   * Track a feature flag evaluation
   *
   * @param flag - Name of the feature flag
   * @param value - Value of the feature flag
   */
  trackEvaluation(flag: string, value: FeatureFlagValue): void;

  /**
   * Get all tracked flag evaluations
   */
  getEvaluations(): FeatureFlagEvaluation[];

  /**
   * Get current flag values
   */
  getFlags(): Record<string, FeatureFlagValue>;

  /**
   * Clear all tracked evaluations
   */
  clearEvaluations(): void;

  /**
   * Called when integration is set up on a client
   */
  setup?(client: Client): void;

  /**
   * Process an event before it's sent
   */
  processEvent?(
    event: SentryEvent,
    hint: EventHint,
    client: Client
  ): SentryEvent | null | Promise<SentryEvent | null>;

  /**
   * Clean up the integration
   */
  teardown?(): void;
}

/**
 * Options for the feature flags integration
 */
export interface FeatureFlagsIntegrationOptions {
  /**
   * Maximum number of flag evaluations to store
   * @default 100
   */
  maxEvaluations?: number;

  /**
   * Whether to attach flag context to events
   * @default true
   */
  attachToEvents?: boolean;

  /**
   * Whether to track duplicate evaluations of the same flag
   * @default false
   */
  trackDuplicates?: boolean;

  /**
   * Custom context key for storing flags in events
   * @default 'flags'
   */
  contextKey?: string;
}

/**
 * Base interface for feature flag provider adapters
 */
export interface FeatureFlagAdapter {
  /**
   * Name of the adapter (e.g., 'LaunchDarkly', 'Statsig')
   */
  name: string;

  /**
   * Initialize the adapter with the provider's SDK
   *
   * @param providerInstance - Instance of the provider SDK
   */
  init(providerInstance: unknown): void;

  /**
   * Clean up the adapter
   */
  teardown(): void;
}

/**
 * Options common to all adapters
 */
export interface AdapterOptions {
  /**
   * Function to call when a flag is evaluated
   */
  onEvaluation: (flagName: string, flagValue: FeatureFlagValue) => void;
}

/**
 * LaunchDarkly specific types
 */
export interface LaunchDarklyAdapterOptions extends AdapterOptions {
  /**
   * Whether to track all flag changes
   * @default true
   */
  trackAllFlags?: boolean;
}

/**
 * Statsig specific types
 */
export interface StatsigAdapterOptions extends AdapterOptions {
  /**
   * Whether to track dynamic configs
   * @default true
   */
  trackDynamicConfigs?: boolean;

  /**
   * Whether to track experiments
   * @default true
   */
  trackExperiments?: boolean;
}

/**
 * Unleash specific types
 */
export interface UnleashAdapterOptions extends AdapterOptions {
  /**
   * Whether to track variants
   * @default true
   */
  trackVariants?: boolean;
}

/**
 * OpenFeature specific types
 */
export interface OpenFeatureAdapterOptions extends AdapterOptions {
  /**
   * Whether to track all flag types
   * @default true
   */
  trackAllTypes?: boolean;
}
