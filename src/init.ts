/**
 * Initialization Helper
 *
 * Provides a convenient init function that configures the Universal Logger
 * with sensible defaults and Sentry-compatible options.
 */

import { UniversalLogger } from './core/logger.js';
import { createStorageProvider } from './storage/index.js';
import { getDefaultIntegrations } from './integrations/index.js';
import type { InitOptions } from './types/options.js';
import type { Integration as IntegrationInternal } from './integrations/types.js';
import type { Integration } from './types/integration.js';
import type { StorageProviderType } from './storage/index.js';

/**
 * Extended init options for Universal Logger
 */
export interface UniversalLoggerInitOptions extends InitOptions {
  /**
   * Operating mode for the logger
   * - 'standalone': Local storage only, no Sentry forwarding
   * - 'proxy': Forward all events to Sentry
   * - 'hybrid': Local storage + Sentry forwarding
   * @default 'standalone'
   */
  mode?: 'standalone' | 'proxy' | 'hybrid';

  /**
   * Storage provider type
   * - 'memory': In-memory storage (default)
   * - 'indexeddb': IndexedDB storage (persistent)
   * @default 'memory'
   */
  storage?: StorageProviderType;
}

/**
 * Initialize the Universal Logger
 *
 * This function sets up the logger with the provided options,
 * including integrations, storage, and optional Sentry forwarding.
 *
 * @param options - Initialization options
 *
 * @example
 * ```typescript
 * // Basic standalone initialization
 * init({
 *   mode: 'standalone',
 *   storage: 'indexeddb',
 *   debug: true,
 * });
 *
 * // With Sentry forwarding
 * init({
 *   dsn: 'https://key@sentry.io/123',
 *   mode: 'hybrid',
 *   release: '1.0.0',
 *   environment: 'production',
 * });
 *
 * // With custom integrations
 * init({
 *   integrations: (defaults) => [
 *     ...defaults,
 *     myCustomIntegration(),
 *   ],
 * });
 * ```
 */
export function init(options: UniversalLoggerInitOptions = {}): void {
  const logger = UniversalLogger.getInstance();

  // Determine storage type
  const storageType = options.storage || 'memory';

  // Setup integrations
  // Note: IntegrationInternal and Integration types are structurally compatible
  // but TypeScript requires explicit casting when they come from different modules
  let integrations: Integration[];

  if (typeof options.integrations === 'function') {
    // User provided a function to modify default integrations
    const defaultIntegrations = options.defaultIntegrations === false
      ? []
      : Array.isArray(options.defaultIntegrations)
        ? options.defaultIntegrations
        : (getDefaultIntegrations() as unknown as Integration[]);

    integrations = options.integrations(defaultIntegrations);
  } else if (Array.isArray(options.integrations)) {
    // User provided an array of integrations
    integrations = options.integrations;
  } else if (options.defaultIntegrations === false) {
    // User disabled default integrations
    integrations = [];
  } else if (Array.isArray(options.defaultIntegrations)) {
    // User provided custom default integrations
    integrations = options.defaultIntegrations;
  } else {
    // Use default integrations
    integrations = getDefaultIntegrations() as unknown as Integration[];
  }

  // Build final options
  const finalOptions: InitOptions = {
    ...options,
    integrations,
    _experiments: {
      ...options._experiments,
      storage: storageType,
    },
  };

  // Initialize the logger
  logger.init(finalOptions);

  // Log debug info if enabled
  if (options.debug) {
    console.log('[UniversalLogger] Initialized with options:', {
      mode: options.mode || 'standalone',
      storage: storageType,
      dsn: options.dsn ? '[REDACTED]' : undefined,
      release: options.release,
      environment: options.environment,
      integrations: integrations.map((i) => i.name),
    });
  }
}

/**
 * Create a scoped init function with default options
 *
 * @param defaults - Default options to apply
 * @returns Init function with defaults applied
 *
 * @example
 * ```typescript
 * const initWithDefaults = createScopedInit({
 *   release: '1.0.0',
 *   environment: 'production',
 * });
 *
 * // Later, initialize with additional options
 * initWithDefaults({
 *   debug: true,
 * });
 * ```
 */
export function createScopedInit(
  defaults: Partial<UniversalLoggerInitOptions>
): (options?: Partial<UniversalLoggerInitOptions>) => void {
  return (options: Partial<UniversalLoggerInitOptions> = {}) => {
    init({
      ...defaults,
      ...options,
    } as UniversalLoggerInitOptions);
  };
}

/**
 * Quick initialization for development
 *
 * Sets up the logger with sensible defaults for development:
 * - Debug mode enabled
 * - Memory storage
 * - All default integrations
 *
 * @example
 * ```typescript
 * import { initDev } from '@universal-logger/core';
 *
 * initDev();
 * ```
 */
export function initDev(): void {
  init({
    mode: 'standalone',
    storage: 'memory',
    debug: true,
    environment: 'development',
  });
}

/**
 * Quick initialization for production
 *
 * Sets up the logger with sensible defaults for production:
 * - Debug mode disabled
 * - IndexedDB storage (persistent)
 * - All default integrations
 *
 * @param options - Additional options
 *
 * @example
 * ```typescript
 * import { initProd } from '@universal-logger/core';
 *
 * initProd({
 *   dsn: 'https://key@sentry.io/123',
 *   release: process.env.VERSION,
 * });
 * ```
 */
export function initProd(options: Partial<UniversalLoggerInitOptions> = {}): void {
  init({
    mode: options.dsn ? 'hybrid' : 'standalone',
    storage: 'indexeddb',
    debug: false,
    environment: 'production',
    ...options,
  });
}

/**
 * Check if the logger is initialized
 *
 * @returns true if the logger has been initialized
 */
export function isInitialized(): boolean {
  return UniversalLogger.getInstance().isInitialized();
}
