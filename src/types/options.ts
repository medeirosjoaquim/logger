/**
 * Configuration options type definitions
 * Options for initializing the Sentry SDK
 */

import type {
  Breadcrumb,
  BreadcrumbHint,
  Event,
  EventHint,
  SeverityLevel,
} from './sentry';
import type { ScopeContext } from './scope';
import type { Integration } from './integration';
import type { Transport, TransportOptions } from './transport';
import type { Sampler, SamplingContext, SpanAttributes, StartSpanOptions } from './span';

/**
 * DSN (Data Source Name) components.
 */
export interface DsnComponents {
  /**
   * Protocol (http or https).
   */
  protocol: string;

  /**
   * Public key (client key).
   */
  publicKey: string;

  /**
   * Secret key (deprecated, not used in SDK v8+).
   */
  secretKey?: string;

  /**
   * Sentry host.
   */
  host: string;

  /**
   * Port number.
   */
  port?: string;

  /**
   * Path prefix.
   */
  path?: string;

  /**
   * Project ID.
   */
  projectId: string;
}

/**
 * Parsed DSN with convenience methods.
 */
export interface Dsn extends DsnComponents {
  /**
   * Get the full DSN string.
   */
  toString(): string;
}

/**
 * Stack parser function type.
 */
export type StackParser = (stack: string, skipLines?: number) => StackFrame[];

/**
 * Stack line parser function type.
 */
export type StackLineParser = (line: string) => StackFrame | undefined;

/**
 * Stack frame for parsing.
 */
export interface StackFrame {
  filename?: string;
  function?: string;
  lineno?: number;
  colno?: number;
  in_app?: boolean;
  abs_path?: string;
  module?: string;
}

/**
 * Debug log function type.
 */
export type DebugLogger = (...args: unknown[]) => void;

/**
 * Init options for initializing the Sentry SDK.
 */
export interface InitOptions {
  /**
   * The DSN (Data Source Name) for your Sentry project.
   * If not provided, the SDK will look for the SENTRY_DSN environment variable.
   */
  dsn?: string;

  /**
   * Enable debug mode for verbose logging.
   * @default false
   */
  debug?: boolean;

  /**
   * Release version identifier.
   * Used for release tracking and source maps.
   */
  release?: string;

  /**
   * Distribution identifier (for mobile apps).
   */
  dist?: string;

  /**
   * Environment name (e.g., 'production', 'staging', 'development').
   */
  environment?: string;

  /**
   * Sample rate for error events (0.0 to 1.0).
   * @default 1.0
   */
  sampleRate?: number;

  /**
   * Sample rate for transaction/tracing events (0.0 to 1.0).
   * @default 0
   */
  tracesSampleRate?: number;

  /**
   * Custom sampler function for traces.
   */
  tracesSampler?: Sampler;

  /**
   * Maximum number of breadcrumbs to record.
   * @default 100
   */
  maxBreadcrumbs?: number;

  /**
   * Maximum depth for serializing objects.
   * @default 3
   */
  maxValueLength?: number;

  /**
   * Whether to normalize depth of data.
   * @default 3
   */
  normalizeDepth?: number;

  /**
   * Maximum size of breadcrumbs in bytes.
   * @default 20000
   */
  maxBreadcrumbsSize?: number;

  /**
   * Callback before sending an event.
   * Return null to drop the event.
   */
  beforeSend?: (
    event: Event,
    hint: EventHint
  ) => Event | null | PromiseLike<Event | null>;

  /**
   * Callback before sending error events.
   * Return null to drop the event.
   */
  beforeSendTransaction?: (
    event: Event,
    hint: EventHint
  ) => Event | null | PromiseLike<Event | null>;

  /**
   * Callback before sending span events.
   */
  beforeSendSpan?: (span: unknown) => unknown | null;

  /**
   * Callback before adding a breadcrumb.
   * Return null to drop the breadcrumb.
   */
  beforeBreadcrumb?: (
    breadcrumb: Breadcrumb,
    hint?: BreadcrumbHint
  ) => Breadcrumb | null;

  /**
   * Integrations to install.
   * Can be an array or a function that receives default integrations.
   */
  integrations?: Integration[] | ((integrations: Integration[]) => Integration[]);

  /**
   * Default integrations to use.
   * Set to false to disable all default integrations.
   */
  defaultIntegrations?: Integration[] | false;

  /**
   * Custom transport to use for sending events.
   */
  transport?: (options: TransportOptions) => Transport;

  /**
   * Transport options.
   */
  transportOptions?: TransportOptions;

  /**
   * Custom stack parser.
   */
  stackParser?: StackParser;

  /**
   * Whether to attach stack traces to messages.
   * @default false
   */
  attachStacktrace?: boolean;

  /**
   * Whether to automatically capture sessions.
   * @default true for browser, false for node
   */
  autoSessionTracking?: boolean;

  /**
   * Whether to send client reports.
   * @default true
   */
  sendClientReports?: boolean;

  /**
   * Server name for the event.
   */
  serverName?: string;

  /**
   * Tags to attach to all events.
   */
  initialScope?:
    | Partial<ScopeContext>
    | ((scope: ScopeContext) => ScopeContext);

  /**
   * Patterns for error messages to ignore.
   */
  ignoreErrors?: Array<string | RegExp>;

  /**
   * Patterns for transaction names to ignore.
   */
  ignoreTransactions?: Array<string | RegExp>;

  /**
   * Patterns for URLs to deny (browser only).
   */
  denyUrls?: Array<string | RegExp>;

  /**
   * Patterns for URLs to allow (browser only).
   */
  allowUrls?: Array<string | RegExp>;

  /**
   * Whether to capture unhandled rejections.
   * @default true
   */
  captureUnhandledRejections?: boolean;

  /**
   * Whether to capture uncaught exceptions.
   * @default true
   */
  captureUncaughtExceptions?: boolean;

  /**
   * Tunnel URL for sending events through a proxy.
   */
  tunnel?: string;

  /**
   * Whether to enable tracing.
   * @default false
   */
  enableTracing?: boolean;

  /**
   * URLs to propagate trace headers to.
   */
  tracePropagationTargets?: Array<string | RegExp>;

  /**
   * Whether to include local variables in stack frames.
   * @default false
   */
  includeLocalVariables?: boolean;

  /**
   * Shutdown timeout in milliseconds.
   * @default 2000
   */
  shutdownTimeout?: number;

  /**
   * Maximum number of requests to buffer.
   * @default 30
   */
  maxQueueSize?: number;

  /**
   * Request timeout in milliseconds.
   * @default 30000
   */
  transportTimeout?: number;

  /**
   * Whether to enable SDK.
   * @default true
   */
  enabled?: boolean;

  /**
   * Send default PII (personally identifiable information).
   * @default false
   */
  sendDefaultPii?: boolean;

  /**
   * Custom metadata for the SDK.
   */
  _metadata?: SdkMetadata;

  /**
   * Experimental options.
   */
  _experiments?: {
    [key: string]: unknown;
  };
}

/**
 * SDK metadata for internal use.
 */
export interface SdkMetadata {
  /**
   * SDK name.
   */
  sdk?: {
    name?: string;
    version?: string;
  };
}

/**
 * Client options extend init options with additional runtime options.
 */
export interface ClientOptions extends Omit<InitOptions, 'dsn' | 'integrations'> {
  /**
   * Transport factory function.
   */
  transport: (options: TransportOptions) => Transport;

  /**
   * Stack parser function.
   */
  stackParser: StackParser;

  /**
   * Integrations array (resolved from init options).
   */
  integrations: Integration[];

  /**
   * Parsed DSN (resolved from string DSN).
   */
  dsn?: DsnComponents;

  /**
   * Original DSN string.
   */
  originalDsn?: string;
}

/**
 * Options passed to client methods.
 */
export interface ClientMethodOptions {
  /**
   * Whether to capture the event synchronously.
   */
  sync?: boolean;
}

/**
 * Options for capturing exceptions.
 */
export interface CaptureExceptionOptions extends ClientMethodOptions {
  /**
   * Capture context to apply.
   */
  captureContext?: Partial<ScopeContext> | ((scope: ScopeContext) => ScopeContext);

  /**
   * Event hint.
   */
  hint?: EventHint;
}

/**
 * Options for capturing messages.
 */
export interface CaptureMessageOptions extends CaptureExceptionOptions {
  /**
   * Severity level for the message.
   */
  level?: SeverityLevel;
}

/**
 * Options for capturing events.
 */
export interface CaptureEventOptions extends ClientMethodOptions {
  /**
   * Event hint.
   */
  hint?: EventHint;
}

/**
 * Options for adding breadcrumbs.
 */
export interface AddBreadcrumbOptions {
  /**
   * Breadcrumb hint.
   */
  hint?: BreadcrumbHint;
}

/**
 * Options for starting spans.
 */
export interface TraceOptions extends StartSpanOptions {
  /**
   * Attributes to set on the span.
   */
  attributes?: SpanAttributes;
}

/**
 * Sampling context for custom samplers.
 */
export interface CustomSamplingContext extends SamplingContext {
  /**
   * Custom data for sampling decisions.
   */
  [key: string]: unknown;
}

/**
 * Browser-specific init options.
 */
export interface BrowserOptions extends InitOptions {
  /**
   * Whether to automatically inject tracing.
   */
  enableLongTask?: boolean;

  /**
   * Enable performance profiling.
   */
  enableProfiling?: boolean;

  /**
   * Replay options.
   */
  replaysSessionSampleRate?: number;

  /**
   * Replay on error sample rate.
   */
  replaysOnErrorSampleRate?: number;
}

/**
 * Node.js-specific init options.
 */
export interface NodeOptions extends InitOptions {
  /**
   * App root path for resolving files.
   */
  appRoot?: string;

  /**
   * Frame context lines.
   */
  frameContextLines?: number;

  /**
   * Whether to instrument HTTP requests.
   */
  instrumentHttp?: boolean;

  /**
   * Max request body size to capture.
   */
  maxRequestBodySize?: 'none' | 'small' | 'medium' | 'always';

  /**
   * Whether to include request data.
   */
  includeRequestData?: boolean;
}

/**
 * Options for flush/close operations.
 */
export interface FlushOptions {
  /**
   * Timeout in milliseconds.
   */
  timeout?: number;
}

/**
 * Profiling options.
 */
export interface ProfilingOptions {
  /**
   * Profile sample rate.
   */
  profilesSampleRate?: number;

  /**
   * Profiles sampler function.
   */
  profilesSampler?: (context: SamplingContext) => boolean | number;
}
