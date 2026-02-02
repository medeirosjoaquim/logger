/**
 * Proxy Module
 *
 * Exports all proxy-related functionality including Sentry interception,
 * mode management, envelope handling, API client, and event viewer.
 */

// Mode management
export type { LoggerMode, ModeConfig, ModeState } from './modes';

export {
  getModeConfig,
  isValidMode,
  getAvailableModes,
  getAllModeConfigs,
  recommendMode,
  createModeState,
  activateModeState,
  deactivateModeState,
} from './modes';

// Sentry interceptor
export type {
  SentryLike,
  InterceptorLogger,
  SentryProxy,
  InterceptorOptions,
} from './interceptor';

export {
  createSentryInterceptor,
  wrapSentryMethod,
  isSentryAvailable,
  getGlobalSentry,
} from './interceptor';

// Envelope handling
export type {
  EnvelopeHeader,
  ItemHeader,
} from './envelope';

export {
  createSentryEnvelope,
  createSessionEnvelope,
  createMultiItemEnvelope,
  parseEnvelope,
  createAttachmentItem,
  createClientReportItem,
  getEnvelopeSize,
  exceedsMaxSize,
} from './envelope';

// Sentry API client
export type {
  RateLimiter,
  SentryApiClientOptions,
} from './api';

export {
  createRateLimiter,
  SentryApiClient,
  createSentryApiClient,
  sendEventToSentry,
  BatchSender,
} from './api';

// Event viewer
export type {
  ViewerEventType,
  SentryResponse,
  EventViewerData,
  ViewerFilter,
  ViewerListener,
  ViewerStats,
} from './viewer';

export {
  EventViewer,
  getEventViewer,
  resetEventViewer,
} from './viewer';

// Re-export DSN types from config for convenience
export type { Dsn } from '../config/dsn';
export { parseDsn, dsnToString, getEnvelopeEndpoint } from '../config/dsn';

/**
 * Options for setting up the proxy.
 */
export interface ProxyOptions {
  /**
   * The logger mode.
   */
  mode: LoggerMode;

  /**
   * DSN for forwarding events to Sentry.
   */
  dsn?: string;

  /**
   * Whether to intercept the global Sentry object.
   */
  interceptGlobalSentry?: boolean;

  /**
   * Whether to enable debug logging.
   */
  debug?: boolean;

  /**
   * Callback when events are intercepted.
   */
  onIntercept?: (method: string, args: unknown[]) => void;

  /**
   * Maximum events to store in the viewer.
   */
  maxViewerEvents?: number;
}

import type { InterceptorLogger } from './interceptor';
import { getModeConfig, LoggerMode } from './modes';
import { createSentryInterceptor, SentryProxy } from './interceptor';
import { EventViewer } from './viewer';
import { parseDsn } from '../config/dsn';
import { SentryApiClient } from './api';

/**
 * Proxy setup result.
 */
export interface ProxySetupResult {
  /**
   * The Sentry proxy (if intercepting).
   */
  proxy: SentryProxy | null;

  /**
   * The event viewer.
   */
  viewer: EventViewer;

  /**
   * The Sentry API client (if forwarding).
   */
  apiClient: SentryApiClient | null;

  /**
   * The mode configuration.
   */
  modeConfig: import('./modes').ModeConfig;
}

/**
 * Set up the proxy based on options.
 *
 * @param logger - The logger to receive intercepted calls
 * @param options - Proxy options
 * @returns Proxy setup result
 *
 * @example
 * ```typescript
 * const { proxy, viewer, apiClient } = setupProxy(logger, {
 *   mode: 'sentry-dual',
 *   dsn: 'https://abc@sentry.io/123',
 *   interceptGlobalSentry: true,
 * });
 * ```
 */
export function setupProxy(
  logger: InterceptorLogger,
  options: ProxyOptions
): ProxySetupResult {
  const modeConfig = getModeConfig(options.mode);
  const viewer = new EventViewer(options.maxViewerEvents || 100);

  let proxy: SentryProxy | null = null;
  let apiClient: SentryApiClient | null = null;

  // Set up Sentry interception if needed
  if (modeConfig.interceptSentry && options.interceptGlobalSentry !== false) {
    proxy = createSentryInterceptor(logger, {
      forwardToOriginal: modeConfig.forwardToSentry,
      debug: options.debug || false,
      onIntercept: options.onIntercept,
    });

    proxy.intercept();
  }

  // Set up API client if forwarding to Sentry
  if (modeConfig.forwardToSentry && options.dsn) {
    const dsn = parseDsn(options.dsn);

    if (dsn) {
      apiClient = new SentryApiClient(dsn, {
        sdkName: 'universal-logger',
        sdkVersion: '0.1.0',
      });
    }
  }

  return {
    proxy,
    viewer,
    apiClient,
    modeConfig,
  };
}

/**
 * Tear down proxy setup.
 *
 * @param result - The proxy setup result to tear down
 */
export function teardownProxy(result: ProxySetupResult): void {
  if (result.proxy) {
    result.proxy.restore();
  }

  result.viewer.clear();
}
