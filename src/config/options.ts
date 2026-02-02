/**
 * Configuration Options
 *
 * Full options interface for initializing the Universal Logger.
 * Compatible with Sentry SDK v8 public API.
 */

import type { Event, EventHint, Breadcrumb, BreadcrumbHint, CaptureContext } from '../types/sentry';
import type { Span, Transaction, SamplingContext } from '../types/span';
import type { Integration } from '../types/integration';
import type { Transport, TransportOptions } from '../types/transport';

/**
 * Factory function for creating transports.
 */
export type TransportFactory = (options: TransportOptions) => Transport;

/**
 * Stack parser function type.
 */
export type StackParser = (stack: string, skipFirst?: number) => import('../types/sentry').StackFrame[];

/**
 * beforeSend callback for processing events before sending.
 */
export type BeforeSendCallback = (
  event: Event,
  hint: EventHint
) => Event | null | PromiseLike<Event | null>;

/**
 * beforeSendTransaction callback for processing transactions before sending.
 */
export type BeforeSendTransactionCallback = (
  transaction: Transaction
) => Transaction | null;

/**
 * beforeSendSpan callback for processing spans before sending.
 */
export type BeforeSendSpanCallback = (span: Span) => Span | null;

/**
 * beforeBreadcrumb callback for processing breadcrumbs before adding.
 */
export type BeforeBreadcrumbCallback = (
  breadcrumb: Breadcrumb,
  hint?: BreadcrumbHint
) => Breadcrumb | null;

/**
 * Traces sampler function type.
 */
export type TracesSampler = (samplingContext: SamplingContext) => number | boolean;

/**
 * Full initialization options for the Universal Logger.
 * Compatible with Sentry SDK v8.
 */
export interface InitOptions {
  // ===========================================================================
  // Core Options
  // ===========================================================================

  /**
   * The DSN (Data Source Name) for sending events to Sentry.
   * Format: https://<public_key>@<host>/<project_id>
   * Or: https://<public_key>:<secret_key>@<host>/<project_id>
   *
   * If not provided, events are only stored locally.
   */
  dsn?: string;

  /**
   * Enable debug mode for verbose logging.
   * When true, logs SDK internal operations to console.
   * @default false
   */
  debug?: boolean;

  /**
   * Release version identifier.
   * Used to associate events with a specific release.
   * Recommended to use semantic versioning.
   */
  release?: string;

  /**
   * Environment name (e.g., 'production', 'staging', 'development').
   * Used to filter events in the Sentry UI.
   * @default 'production'
   */
  environment?: string;

  /**
   * Tunnel URL for sending events through a proxy.
   * Useful for bypassing ad blockers or security restrictions.
   * When set, events are sent to this URL instead of the DSN endpoint.
   */
  tunnel?: string;

  /**
   * Whether the SDK is enabled.
   * When false, no events are captured or sent.
   * @default true
   */
  enabled?: boolean;

  // ===========================================================================
  // Sampling Options
  // ===========================================================================

  /**
   * Sample rate for error events (0.0 to 1.0).
   * 1.0 means 100% of events are sent.
   * 0.0 means no events are sent.
   * @default 1.0
   */
  sampleRate?: number;

  /**
   * Sample rate for performance transactions (0.0 to 1.0).
   * Required to enable performance monitoring.
   * Set to 1.0 for 100% of transactions.
   */
  tracesSampleRate?: number;

  /**
   * Custom function for determining transaction sample rate.
   * Called for each transaction, can return 0.0-1.0 or boolean.
   * Takes precedence over tracesSampleRate when provided.
   */
  tracesSampler?: TracesSampler;

  /**
   * Sample rate for session replays during normal sessions (0.0 to 1.0).
   * Only applies when using replay integration.
   * @default 0
   */
  replaysSessionSampleRate?: number;

  /**
   * Sample rate for session replays when an error occurs (0.0 to 1.0).
   * Only applies when using replay integration.
   * @default 0
   */
  replaysOnErrorSampleRate?: number;

  /**
   * Sample rate for profiles (0.0 to 1.0).
   * Only applies when using profiling integration.
   */
  profilesSampleRate?: number;

  // ===========================================================================
  // Hook Callbacks
  // ===========================================================================

  /**
   * Callback to process events before sending.
   * Can modify the event, return null to drop it, or return a promise.
   */
  beforeSend?: BeforeSendCallback;

  /**
   * Callback to process transactions before sending.
   * Can modify the transaction or return null to drop it.
   */
  beforeSendTransaction?: BeforeSendTransactionCallback;

  /**
   * Callback to process spans before adding to transaction.
   * Can modify the span or return null to drop it.
   */
  beforeSendSpan?: BeforeSendSpanCallback;

  /**
   * Callback to process breadcrumbs before adding to scope.
   * Can modify the breadcrumb or return null to drop it.
   */
  beforeBreadcrumb?: BeforeBreadcrumbCallback;

  // ===========================================================================
  // Filtering Options
  // ===========================================================================

  /**
   * Patterns for error messages to ignore.
   * Strings are matched as substrings, RegExp for pattern matching.
   * Matched errors are not captured.
   */
  ignoreErrors?: Array<string | RegExp>;

  /**
   * Patterns for transaction names to ignore.
   * Strings are matched as substrings, RegExp for pattern matching.
   * Matched transactions are not captured.
   */
  ignoreTransactions?: Array<string | RegExp>;

  /**
   * URL patterns to deny (block).
   * Events from these URLs are not captured.
   * Strings are matched as substrings, RegExp for pattern matching.
   */
  denyUrls?: Array<string | RegExp>;

  /**
   * URL patterns to allow (whitelist).
   * Only events from these URLs are captured.
   * Takes precedence over denyUrls when both match.
   * Strings are matched as substrings, RegExp for pattern matching.
   */
  allowUrls?: Array<string | RegExp>;

  // ===========================================================================
  // Limit Options
  // ===========================================================================

  /**
   * Maximum number of breadcrumbs to keep.
   * Older breadcrumbs are discarded when limit is reached.
   * @default 100
   */
  maxBreadcrumbs?: number;

  /**
   * Maximum length for string values in event data.
   * Longer strings are truncated.
   * @default 250
   */
  maxValueLength?: number;

  /**
   * Maximum depth for normalizing nested objects.
   * Deeper levels are truncated with '[Object]' or '[Array]'.
   * @default 3
   */
  normalizeDepth?: number;

  /**
   * Maximum number of properties per object level during normalization.
   * Additional properties are truncated.
   * @default 1000
   */
  normalizeMaxBreadth?: number;

  // ===========================================================================
  // Feature Flags
  // ===========================================================================

  /**
   * Attach stack traces to pure capture message events.
   * Useful for debugging but increases payload size.
   * @default false
   */
  attachStacktrace?: boolean;

  /**
   * Send default PII (personally identifiable information).
   * When true, includes IP address, cookies, and user data.
   * @default false
   */
  sendDefaultPii?: boolean;

  /**
   * Send client reports for dropped events.
   * Helps track SDK health and rate limiting.
   * @default true
   */
  sendClientReports?: boolean;

  /**
   * Enable automatic session tracking.
   * Tracks user sessions for release health.
   * @default true
   */
  autoSessionTracking?: boolean;

  // ===========================================================================
  // Integration Options
  // ===========================================================================

  /**
   * Integrations to use.
   * Can be an array of integrations or a function that receives
   * default integrations and returns modified array.
   */
  integrations?: Integration[] | ((defaultIntegrations: Integration[]) => Integration[]);

  /**
   * Whether to use default integrations.
   * When false, only explicitly provided integrations are used.
   * @default true
   */
  defaultIntegrations?: boolean;

  // ===========================================================================
  // Transport Options
  // ===========================================================================

  /**
   * Custom transport factory function.
   * Allows using a custom transport for sending events.
   */
  transport?: TransportFactory;

  /**
   * Additional options passed to the transport.
   */
  transportOptions?: Record<string, unknown>;

  // ===========================================================================
  // Scope Options
  // ===========================================================================

  /**
   * Initial scope configuration.
   * Applied to the global scope on initialization.
   */
  initialScope?: CaptureContext;

  // ===========================================================================
  // Tracing Options
  // ===========================================================================

  /**
   * URL patterns for trace propagation.
   * Trace headers are attached to requests matching these patterns.
   * Strings are matched as substrings, RegExp for pattern matching.
   */
  tracePropagationTargets?: Array<string | RegExp>;

  /**
   * Whether to propagate trace parent header.
   * When true, outgoing requests include the sentry-trace header.
   * @default false
   */
  propagateTraceparent?: boolean;

  // ===========================================================================
  // Advanced Options
  // ===========================================================================

  /**
   * Server name for the event.
   * Used in server-side SDKs.
   */
  serverName?: string;

  /**
   * Distribution identifier (for mobile apps).
   */
  dist?: string;

  /**
   * Custom stack parser function.
   */
  stackParser?: StackParser;

  /**
   * Timeout for shutdown in milliseconds.
   * @default 2000
   */
  shutdownTimeout?: number;

  /**
   * Experimental options.
   * These may change or be removed without notice.
   */
  _experiments?: Record<string, unknown>;

  // ===========================================================================
  // Universal Logger Specific Options
  // ===========================================================================

  /**
   * Mode for the logger.
   * - 'standalone': Local logging only
   * - 'sentry-proxy': Intercept Sentry calls, log locally
   * - 'sentry-dual': Log locally AND forward to Sentry
   * @default 'standalone'
   */
  mode?: 'standalone' | 'sentry-proxy' | 'sentry-dual';

  /**
   * Whether to intercept the global Sentry object.
   * Only applies when mode is 'sentry-proxy' or 'sentry-dual'.
   * @default false
   */
  interceptGlobalSentry?: boolean;

  /**
   * Storage provider to use for local logging.
   * @default 'memory'
   */
  storageProvider?: 'memory' | 'indexeddb' | 'localstorage';

  /**
   * Maximum number of events to store locally.
   * @default 1000
   */
  maxLocalEvents?: number;

  /**
   * Enable the local event viewer.
   * @default true in development
   */
  enableViewer?: boolean;
}

/**
 * Type for required options after merging with defaults.
 * All optional properties have defined values.
 */
export interface ResolvedOptions extends Omit<InitOptions, keyof RequiredDefaults>, RequiredDefaults {
  // All options are now defined
}

/**
 * Properties that have required default values.
 */
interface RequiredDefaults {
  debug: boolean;
  environment: string;
  enabled: boolean;
  sampleRate: number;
  maxBreadcrumbs: number;
  maxValueLength: number;
  normalizeDepth: number;
  normalizeMaxBreadth: number;
  attachStacktrace: boolean;
  sendDefaultPii: boolean;
  sendClientReports: boolean;
  autoSessionTracking: boolean;
  defaultIntegrations: boolean;
  propagateTraceparent: boolean;
  mode: 'standalone' | 'sentry-proxy' | 'sentry-dual';
  maxLocalEvents: number;
  shutdownTimeout: number;
}
