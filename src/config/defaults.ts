/**
 * Default Configuration Values
 *
 * Default values for all configuration options.
 * These match Sentry SDK v8 defaults where applicable.
 */

import type { InitOptions, ResolvedOptions } from './options';

/**
 * Default trace propagation targets.
 * By default, propagate to same-origin requests only (empty array means same-origin).
 * Add patterns like 'api.example.com' or /^https:\/\/api\./ to propagate to third parties.
 */
export const DEFAULT_TRACE_PROPAGATION_TARGETS: (string | RegExp)[] = [];

/**
 * Default configuration values.
 * Applied when options are not explicitly provided.
 */
export const DEFAULT_OPTIONS: Partial<InitOptions> = {
  // Core
  debug: false,
  environment: 'production',
  enabled: true,

  // Sampling
  sampleRate: 1.0,
  replaysSessionSampleRate: 0,
  replaysOnErrorSampleRate: 0,

  // Limits
  maxBreadcrumbs: 100,
  maxValueLength: 250,
  normalizeDepth: 3,
  normalizeMaxBreadth: 1000,

  // Features
  attachStacktrace: false,
  sendDefaultPii: false,
  sendClientReports: true,
  autoSessionTracking: true,

  // Integrations
  defaultIntegrations: true,

  // Tracing / Distributed Tracing
  propagateTraceparent: false,
  tracePropagationTargets: DEFAULT_TRACE_PROPAGATION_TARGETS,

  // Universal Logger specific
  mode: 'standalone',
  maxLocalEvents: 1000,
  shutdownTimeout: 2000,
};

/**
 * Get the default options.
 * Returns a copy to prevent mutation of the defaults.
 */
export function getDefaultOptions(): Partial<InitOptions> {
  return { ...DEFAULT_OPTIONS };
}

/**
 * Merge user options with default options.
 * User-provided values take precedence over defaults.
 *
 * @param options - User-provided options
 * @returns Merged options with all required defaults filled in
 */
export function mergeOptions(options: InitOptions): ResolvedOptions {
  const merged: ResolvedOptions = {
    // Apply defaults first
    debug: DEFAULT_OPTIONS.debug!,
    environment: DEFAULT_OPTIONS.environment!,
    enabled: DEFAULT_OPTIONS.enabled!,
    sampleRate: DEFAULT_OPTIONS.sampleRate!,
    maxBreadcrumbs: DEFAULT_OPTIONS.maxBreadcrumbs!,
    maxValueLength: DEFAULT_OPTIONS.maxValueLength!,
    normalizeDepth: DEFAULT_OPTIONS.normalizeDepth!,
    normalizeMaxBreadth: DEFAULT_OPTIONS.normalizeMaxBreadth!,
    attachStacktrace: DEFAULT_OPTIONS.attachStacktrace!,
    sendDefaultPii: DEFAULT_OPTIONS.sendDefaultPii!,
    sendClientReports: DEFAULT_OPTIONS.sendClientReports!,
    autoSessionTracking: DEFAULT_OPTIONS.autoSessionTracking!,
    defaultIntegrations: DEFAULT_OPTIONS.defaultIntegrations!,
    propagateTraceparent: DEFAULT_OPTIONS.propagateTraceparent!,
    mode: DEFAULT_OPTIONS.mode as 'standalone' | 'sentry-proxy' | 'sentry-dual',
    maxLocalEvents: DEFAULT_OPTIONS.maxLocalEvents!,
    shutdownTimeout: DEFAULT_OPTIONS.shutdownTimeout!,

    // Spread user options (overrides defaults)
    ...options,
  };

  // Handle special cases

  // If DSN is provided but no mode, default to sentry-dual
  if (options.dsn && !options.mode) {
    merged.mode = 'sentry-dual';
  }

  // If debug mode is enabled, ensure console logging
  if (merged.debug) {
    // Debug mode implies we want to see what's happening
  }

  // Validate and clamp sample rates
  if (merged.sampleRate !== undefined) {
    merged.sampleRate = clampSampleRate(merged.sampleRate);
  }

  if (options.tracesSampleRate !== undefined) {
    merged.tracesSampleRate = clampSampleRate(options.tracesSampleRate);
  }

  if (options.replaysSessionSampleRate !== undefined) {
    merged.replaysSessionSampleRate = clampSampleRate(options.replaysSessionSampleRate);
  }

  if (options.replaysOnErrorSampleRate !== undefined) {
    merged.replaysOnErrorSampleRate = clampSampleRate(options.replaysOnErrorSampleRate);
  }

  if (options.profilesSampleRate !== undefined) {
    merged.profilesSampleRate = clampSampleRate(options.profilesSampleRate);
  }

  // Ensure max values are positive
  merged.maxBreadcrumbs = Math.max(0, merged.maxBreadcrumbs);
  merged.maxValueLength = Math.max(0, merged.maxValueLength);
  merged.normalizeDepth = Math.max(0, merged.normalizeDepth);
  merged.normalizeMaxBreadth = Math.max(0, merged.normalizeMaxBreadth);
  merged.maxLocalEvents = Math.max(0, merged.maxLocalEvents);

  return merged;
}

/**
 * Clamp a sample rate to valid range [0, 1].
 *
 * @param rate - The sample rate to clamp
 * @returns Clamped rate between 0 and 1
 */
function clampSampleRate(rate: number): number {
  if (typeof rate !== 'number' || isNaN(rate)) {
    return 1;
  }
  return Math.max(0, Math.min(1, rate));
}

/**
 * Create options specifically for development mode.
 * Enables debugging and disables sampling.
 *
 * @param options - User-provided options
 * @returns Options optimized for development
 */
export function createDevOptions(options: InitOptions): ResolvedOptions {
  return mergeOptions({
    debug: true,
    sampleRate: 1.0,
    tracesSampleRate: 1.0,
    environment: 'development',
    enableViewer: true,
    ...options,
  });
}

/**
 * Create options specifically for production mode.
 * Disables debugging and applies sensible defaults.
 *
 * @param options - User-provided options
 * @returns Options optimized for production
 */
export function createProdOptions(options: InitOptions): ResolvedOptions {
  return mergeOptions({
    debug: false,
    environment: 'production',
    enableViewer: false,
    ...options,
  });
}

/**
 * Check if we're in a development environment.
 * Checks NODE_ENV and common development indicators.
 *
 * @returns True if in development environment
 */
export function isDevelopment(): boolean {
  // Check Node.js environment
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development') {
    return true;
  }

  // Check browser environment
  if (typeof window !== 'undefined') {
    // Check for localhost
    if (window.location?.hostname === 'localhost' || window.location?.hostname === '127.0.0.1') {
      return true;
    }
  }

  return false;
}

/**
 * Get environment-appropriate default options.
 * Uses development defaults in dev, production defaults otherwise.
 *
 * @returns Default options for current environment
 */
export function getEnvironmentDefaults(): Partial<InitOptions> {
  const defaults = getDefaultOptions();

  if (isDevelopment()) {
    return {
      ...defaults,
      debug: true,
      environment: 'development',
      enableViewer: true,
    };
  }

  return defaults;
}
