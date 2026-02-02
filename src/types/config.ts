/**
 * Universal logger configuration type definitions
 * Configuration for different logger modes and behaviors
 */

import type { InitOptions, ClientOptions } from './options';
import type { StorageConfig, StorageProvider } from './storage';
import type { LogLevel } from './logger';
import type { Integration } from './integration';
import type { Transport } from './transport';

/**
 * Logger operation mode.
 * - standalone: Local logging only, no Sentry integration
 * - sentry-proxy: All operations proxied through Sentry SDK
 * - sentry-dual: Both local logging and Sentry, with local storage
 */
export type UniversalLoggerMode = 'standalone' | 'sentry-proxy' | 'sentry-dual';

/**
 * Console output configuration.
 */
export interface ConsoleConfig {
  /**
   * Whether to output to console.
   * @default true in development, false in production
   */
  enabled?: boolean;

  /**
   * Minimum level to output to console.
   * @default 'debug'
   */
  level?: LogLevel;

  /**
   * Whether to use colors in console output.
   * @default true
   */
  colors?: boolean;

  /**
   * Whether to include timestamps.
   * @default true
   */
  timestamps?: boolean;

  /**
   * Whether to include log source (file, line).
   * @default false
   */
  showSource?: boolean;

  /**
   * Whether to pretty-print objects.
   * @default true
   */
  prettyPrint?: boolean;

  /**
   * Maximum depth for object inspection.
   * @default 3
   */
  inspectDepth?: number;
}

/**
 * Sentry forwarding configuration.
 */
export interface SentryForwardingConfig {
  /**
   * Whether to forward to Sentry.
   * @default true in sentry-proxy and sentry-dual modes
   */
  enabled?: boolean;

  /**
   * Minimum level to forward to Sentry.
   * @default 'error'
   */
  level?: LogLevel;

  /**
   * Whether to include breadcrumbs from local logs.
   * @default true
   */
  includeBreadcrumbs?: boolean;

  /**
   * Maximum number of breadcrumbs to include.
   * @default 50
   */
  maxBreadcrumbs?: number;

  /**
   * Whether to batch events before sending.
   * @default false
   */
  batch?: boolean;

  /**
   * Batch size for batched sending.
   * @default 10
   */
  batchSize?: number;

  /**
   * Batch timeout in milliseconds.
   * @default 5000
   */
  batchTimeout?: number;

  /**
   * Whether to retry failed sends.
   * @default true
   */
  retry?: boolean;

  /**
   * Maximum retry attempts.
   * @default 3
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds.
   * @default 1000
   */
  retryDelay?: number;
}

/**
 * Sampling configuration.
 */
export interface SamplingConfig {
  /**
   * Sample rate for log entries (0.0 to 1.0).
   * @default 1.0
   */
  logSampleRate?: number;

  /**
   * Sample rate for error events (0.0 to 1.0).
   * @default 1.0
   */
  errorSampleRate?: number;

  /**
   * Sample rate for trace spans (0.0 to 1.0).
   * @default 1.0
   */
  traceSampleRate?: number;

  /**
   * Custom sampler function.
   */
  sampler?: (context: SamplerContext) => boolean;
}

/**
 * Context for custom sampler.
 */
export interface SamplerContext {
  /**
   * Log level.
   */
  level: LogLevel;

  /**
   * Log message.
   */
  message: string;

  /**
   * Whether this is an error.
   */
  isError: boolean;

  /**
   * Tags on the log.
   */
  tags?: Record<string, string>;

  /**
   * User information.
   */
  user?: {
    id?: string;
    email?: string;
  };
}

/**
 * Filtering configuration.
 */
export interface FilterConfig {
  /**
   * Patterns for messages to ignore.
   */
  ignoreMessages?: Array<string | RegExp>;

  /**
   * Patterns for errors to ignore.
   */
  ignoreErrors?: Array<string | RegExp>;

  /**
   * Tags that must be present.
   */
  requireTags?: string[];

  /**
   * Custom filter function.
   */
  filter?: (entry: FilterContext) => boolean;
}

/**
 * Context for custom filter.
 */
export interface FilterContext {
  /**
   * Log level.
   */
  level: LogLevel;

  /**
   * Log message.
   */
  message: string;

  /**
   * Log data.
   */
  data?: Record<string, unknown>;

  /**
   * Tags on the log.
   */
  tags?: Record<string, string>;

  /**
   * Whether this has an exception.
   */
  hasException: boolean;
}

/**
 * Redaction configuration for sensitive data.
 */
export interface RedactionConfig {
  /**
   * Whether to enable redaction.
   * @default true
   */
  enabled?: boolean;

  /**
   * Keys to redact (case-insensitive).
   * @default ['password', 'secret', 'token', 'apiKey', 'authorization']
   */
  keys?: string[];

  /**
   * Patterns for values to redact.
   */
  patterns?: RegExp[];

  /**
   * Replacement string.
   * @default '[REDACTED]'
   */
  replacement?: string;

  /**
   * Whether to redact in nested objects.
   * @default true
   */
  deep?: boolean;

  /**
   * Maximum depth for deep redaction.
   * @default 10
   */
  maxDepth?: number;
}

/**
 * Performance configuration.
 */
export interface PerformanceConfig {
  /**
   * Whether to enable automatic performance tracking.
   * @default false
   */
  enabled?: boolean;

  /**
   * Track long tasks (browser only).
   * @default false
   */
  trackLongTasks?: boolean;

  /**
   * Long task threshold in milliseconds.
   * @default 50
   */
  longTaskThreshold?: number;

  /**
   * Track resource timing.
   * @default false
   */
  trackResources?: boolean;

  /**
   * Track user interactions.
   * @default false
   */
  trackInteractions?: boolean;

  /**
   * Track web vitals.
   * @default false
   */
  trackWebVitals?: boolean;
}

/**
 * Hook callbacks for logger lifecycle events.
 */
export interface LoggerHooks {
  /**
   * Called before a log is written.
   */
  beforeLog?: (entry: HookLogEntry) => HookLogEntry | null;

  /**
   * Called after a log is written.
   */
  afterLog?: (entry: HookLogEntry) => void;

  /**
   * Called before an error is captured.
   */
  beforeCapture?: (error: Error, context: unknown) => boolean;

  /**
   * Called after an error is captured.
   */
  afterCapture?: (eventId: string, error: Error) => void;

  /**
   * Called before sending to Sentry.
   */
  beforeSend?: (event: unknown) => unknown | null;

  /**
   * Called after sending to Sentry.
   */
  afterSend?: (eventId: string, success: boolean) => void;

  /**
   * Called when a session starts.
   */
  onSessionStart?: (sessionId: string) => void;

  /**
   * Called when a session ends.
   */
  onSessionEnd?: (sessionId: string) => void;
}

/**
 * Log entry for hooks.
 */
export interface HookLogEntry {
  /**
   * Log level.
   */
  level: LogLevel;

  /**
   * Log message.
   */
  message: string;

  /**
   * Log data.
   */
  data?: Record<string, unknown>;

  /**
   * Log tags.
   */
  tags?: Record<string, string>;

  /**
   * Timestamp.
   */
  timestamp: string;
}

/**
 * Main configuration for the universal logger.
 */
export interface UniversalLoggerConfig {
  /**
   * Logger operation mode.
   * @default 'standalone'
   */
  mode?: UniversalLoggerMode;

  /**
   * Whether the logger is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable debug mode for verbose internal logging.
   * @default false
   */
  debug?: boolean;

  /**
   * Application name.
   */
  appName?: string;

  /**
   * Application version/release.
   */
  release?: string;

  /**
   * Environment name.
   * @default 'development'
   */
  environment?: string;

  /**
   * Default log level.
   * @default 'info'
   */
  defaultLevel?: LogLevel;

  /**
   * Minimum level to record.
   * @default 'debug'
   */
  minLevel?: LogLevel;

  /**
   * Default tags to add to all logs.
   */
  defaultTags?: Record<string, string>;

  /**
   * Default extra data to add to all logs.
   */
  defaultExtra?: Record<string, unknown>;

  /**
   * Storage configuration.
   */
  storage?: StorageConfig;

  /**
   * Console output configuration.
   */
  console?: ConsoleConfig;

  /**
   * Sentry SDK configuration (for sentry-proxy and sentry-dual modes).
   */
  sentry?: InitOptions;

  /**
   * Sentry forwarding configuration.
   */
  sentryForwarding?: SentryForwardingConfig;

  /**
   * Sampling configuration.
   */
  sampling?: SamplingConfig;

  /**
   * Filter configuration.
   */
  filter?: FilterConfig;

  /**
   * Redaction configuration for sensitive data.
   */
  redaction?: RedactionConfig;

  /**
   * Performance tracking configuration.
   */
  performance?: PerformanceConfig;

  /**
   * Lifecycle hooks.
   */
  hooks?: LoggerHooks;

  /**
   * Custom integrations.
   */
  integrations?: Integration[];

  /**
   * Custom transport factory.
   */
  transport?: (options: unknown) => Transport;

  /**
   * Custom storage provider.
   */
  storageProvider?: StorageProvider;

  /**
   * Session configuration.
   */
  session?: SessionConfig;

  /**
   * Breadcrumb configuration.
   */
  breadcrumbs?: BreadcrumbConfig;
}

/**
 * Session tracking configuration.
 */
export interface SessionConfig {
  /**
   * Whether to enable session tracking.
   * @default true
   */
  enabled?: boolean;

  /**
   * Session timeout in milliseconds.
   * @default 30 minutes (1800000)
   */
  timeout?: number;

  /**
   * Whether to track page views as session events.
   * @default true
   */
  trackPageViews?: boolean;

  /**
   * Whether to track user interactions.
   * @default false
   */
  trackInteractions?: boolean;

  /**
   * Custom session ID generator.
   */
  generateId?: () => string;
}

/**
 * Breadcrumb configuration.
 */
export interface BreadcrumbConfig {
  /**
   * Whether to capture breadcrumbs.
   * @default true
   */
  enabled?: boolean;

  /**
   * Maximum number of breadcrumbs to keep.
   * @default 100
   */
  maxBreadcrumbs?: number;

  /**
   * Capture console logs as breadcrumbs.
   * @default true
   */
  console?: boolean;

  /**
   * Capture DOM events as breadcrumbs (browser only).
   * @default true
   */
  dom?: boolean;

  /**
   * Capture fetch/XHR as breadcrumbs.
   * @default true
   */
  fetch?: boolean;

  /**
   * Capture history/navigation as breadcrumbs.
   * @default true
   */
  history?: boolean;

  /**
   * Capture Sentry events as breadcrumbs.
   * @default false
   */
  sentry?: boolean;
}

/**
 * Validated/resolved configuration after defaults are applied.
 */
export interface ResolvedLoggerConfig extends Required<Omit<UniversalLoggerConfig,
  'sentry' | 'transport' | 'storageProvider' | 'integrations'
>> {
  /**
   * Sentry SDK configuration.
   */
  sentry?: InitOptions;

  /**
   * Custom transport factory.
   */
  transport?: (options: unknown) => Transport;

  /**
   * Custom storage provider.
   */
  storageProvider?: StorageProvider;

  /**
   * Custom integrations.
   */
  integrations: Integration[];
}

/**
 * Configuration validation result.
 */
export interface ConfigValidationResult {
  /**
   * Whether the configuration is valid.
   */
  valid: boolean;

  /**
   * Validation errors.
   */
  errors: ConfigValidationError[];

  /**
   * Validation warnings.
   */
  warnings: string[];
}

/**
 * Configuration validation error.
 */
export interface ConfigValidationError {
  /**
   * Path to the invalid field.
   */
  path: string;

  /**
   * Error message.
   */
  message: string;

  /**
   * Invalid value.
   */
  value?: unknown;
}
