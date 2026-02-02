/**
 * Client-related type definitions
 * The client is the main interface for capturing events
 */

import type { Breadcrumb, BreadcrumbHint, CaptureContext, Event, EventHint, SeverityLevel } from './sentry';
import type { EventProcessor, ScopeLike } from './scope';
import type { Session } from './session';
import type { Span } from './span';
import type { Transport, TransportOptions } from './transport';
import type { Integration } from './integration';

/**
 * DSN (Data Source Name) interface.
 */
export interface Dsn {
  /**
   * Protocol (http or https).
   */
  protocol: string;

  /**
   * Public key from the DSN.
   */
  publicKey: string;

  /**
   * Secret key (deprecated, not used in modern SDKs).
   */
  secretKey?: string;

  /**
   * Sentry host.
   */
  host: string;

  /**
   * Port number (optional).
   */
  port?: string;

  /**
   * Path (for self-hosted Sentry).
   */
  path?: string;

  /**
   * Project ID.
   */
  projectId: string;
}

/**
 * Stack parser function type.
 */
export type StackParser = (stack: string, skipFirst?: number) => import('./sentry').StackFrame[];

/**
 * Traces sampler function type.
 */
export type TracesSampler = (samplingContext: TracesSamplerContext) => number | boolean;

/**
 * Context passed to traces sampler.
 */
export interface TracesSamplerContext {
  /**
   * Transaction context.
   */
  transactionContext: {
    name: string;
    parentSampled?: boolean;
  };

  /**
   * Parent sampling decision.
   */
  parentSampled?: boolean;

  /**
   * Request data if available.
   */
  request?: unknown;

  /**
   * Location data if available.
   */
  location?: unknown;
}

/**
 * beforeSend callback type.
 */
export type BeforeSendCallback = (
  event: Event,
  hint: EventHint
) => Event | null | PromiseLike<Event | null>;

/**
 * beforeSendTransaction callback type.
 */
export type BeforeSendTransactionCallback = (
  event: Event,
  hint: EventHint
) => Event | null | PromiseLike<Event | null>;

/**
 * beforeSendSpan callback type.
 */
export type BeforeSendSpanCallback = (span: Span) => Span | null;

/**
 * beforeBreadcrumb callback type.
 */
export type BeforeBreadcrumbCallback = (
  breadcrumb: Breadcrumb,
  hint?: BreadcrumbHint
) => Breadcrumb | null;

/**
 * Client options for configuring the client.
 */
export interface ClientOptions {
  /**
   * DSN string for Sentry connection.
   */
  dsn?: string;

  /**
   * Whether the client is enabled.
   * @default true
   */
  enabled?: boolean;

  /**
   * Enable debug mode for verbose logging.
   * @default false
   */
  debug?: boolean;

  /**
   * Release version identifier.
   */
  release?: string;

  /**
   * Environment name (e.g., 'production', 'staging').
   */
  environment?: string;

  /**
   * Distribution identifier (for mobile apps).
   */
  dist?: string;

  /**
   * Sample rate for error events (0.0 to 1.0).
   * @default 1.0
   */
  sampleRate?: number;

  /**
   * Sample rate for transactions (0.0 to 1.0).
   */
  tracesSampleRate?: number;

  /**
   * Custom sampler function for transactions.
   */
  tracesSampler?: TracesSampler;

  /**
   * Sample rate for profiles (0.0 to 1.0).
   */
  profilesSampleRate?: number;

  /**
   * Maximum number of breadcrumbs to keep.
   * @default 100
   */
  maxBreadcrumbs?: number;

  /**
   * Attach stack traces to messages.
   * @default false
   */
  attachStacktrace?: boolean;

  /**
   * Send default PII (personally identifiable information).
   * @default false
   */
  sendDefaultPii?: boolean;

  /**
   * Server name for the event.
   */
  serverName?: string;

  /**
   * Callback to process events before sending.
   */
  beforeSend?: BeforeSendCallback;

  /**
   * Callback to process transactions before sending.
   */
  beforeSendTransaction?: BeforeSendTransactionCallback;

  /**
   * Callback to process spans before sending.
   */
  beforeSendSpan?: BeforeSendSpanCallback;

  /**
   * Callback to process breadcrumbs before adding.
   */
  beforeBreadcrumb?: BeforeBreadcrumbCallback;

  /**
   * Integrations to use.
   */
  integrations?: Integration[];

  /**
   * Default integrations configuration.
   */
  defaultIntegrations?: boolean | Integration[];

  /**
   * Custom transport factory.
   */
  transport?: (options: TransportOptions) => Transport;

  /**
   * Transport options.
   */
  transportOptions?: Partial<TransportOptions>;

  /**
   * Custom stack parser.
   */
  stackParser?: StackParser;

  /**
   * Patterns for error messages to ignore.
   */
  ignoreErrors?: Array<string | RegExp>;

  /**
   * Patterns for transaction names to ignore.
   */
  ignoreTransactions?: Array<string | RegExp>;

  /**
   * URL patterns to deny (block).
   */
  denyUrls?: Array<string | RegExp>;

  /**
   * URL patterns to allow (whitelist).
   */
  allowUrls?: Array<string | RegExp>;

  /**
   * Enable automatic session tracking.
   * @default true for browser
   */
  autoSessionTracking?: boolean;

  /**
   * Send client reports.
   * @default true
   */
  sendClientReports?: boolean;

  /**
   * Tunnel URL for sending events through a proxy.
   */
  tunnel?: string;

  /**
   * Initial scope configuration.
   */
  initialScope?: CaptureContext;

  /**
   * Maximum length for string values.
   * @default 250
   */
  maxValueLength?: number;

  /**
   * Depth for normalizing objects.
   * @default 3
   */
  normalizeDepth?: number;

  /**
   * Maximum number of properties per object level.
   * @default 1000
   */
  normalizeMaxBreadth?: number;

  /**
   * Timeout for shutdown in milliseconds.
   * @default 2000
   */
  shutdownTimeout?: number;

  /**
   * Experimental options.
   */
  _experiments?: Record<string, unknown>;
}

/**
 * Client interface for event capture and management.
 */
export interface Client {
  /**
   * Capture an exception.
   * @param exception - The exception to capture
   * @param hint - Optional event hint
   * @param scope - Optional scope to apply
   * @returns Event ID
   */
  captureException(exception: unknown, hint?: EventHint, scope?: ScopeLike): string;

  /**
   * Capture a message.
   * @param message - The message to capture
   * @param level - Severity level
   * @param hint - Optional event hint
   * @param scope - Optional scope to apply
   * @returns Event ID
   */
  captureMessage(message: string, level?: SeverityLevel, hint?: EventHint, scope?: ScopeLike): string;

  /**
   * Capture a raw event.
   * @param event - The event to capture
   * @param hint - Optional event hint
   * @param scope - Optional scope to apply
   * @returns Event ID
   */
  captureEvent(event: Event, hint?: EventHint, scope?: ScopeLike): string;

  /**
   * Capture a session.
   * @param session - The session to capture
   */
  captureSession(session: Session): void;

  /**
   * Get the client options.
   */
  getOptions(): ClientOptions;

  /**
   * Get the parsed DSN.
   */
  getDsn(): Dsn | undefined;

  /**
   * Get the transport instance.
   */
  getTransport(): Transport | undefined;

  /**
   * Flush pending events.
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise resolving to true if flushed successfully
   */
  flush(timeout?: number): Promise<boolean>;

  /**
   * Close the client and release resources.
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise resolving to true if closed successfully
   */
  close(timeout?: number): Promise<boolean>;

  /**
   * Register an event hook.
   * @param hook - Hook name
   * @param callback - Callback function
   */
  on(hook: string, callback: (...args: unknown[]) => void): void;

  /**
   * Emit an event hook.
   * @param hook - Hook name
   * @param args - Arguments to pass to callbacks
   */
  emit(hook: string, ...args: unknown[]): void;

  /**
   * Add an integration.
   * @param integration - Integration to add
   */
  addIntegration?(integration: Integration): void;

  /**
   * Get an integration by name.
   * @param name - Integration name
   */
  getIntegration?<T extends Integration>(name: string): T | null;

  /**
   * Get all integrations.
   */
  getIntegrations?(): Integration[];
}

/**
 * Hook types supported by the client.
 */
export type ClientHook =
  | 'beforeEnvelope'
  | 'afterEnvelope'
  | 'beforeSendEvent'
  | 'afterSendEvent'
  | 'createDsc'
  | 'onerror'
  | 'onunhandledrejection'
  | 'startTransaction'
  | 'finishTransaction'
  | 'beforeAddBreadcrumb'
  | 'startSpan'
  | 'endSpan'
  | 'flush'
  | 'close';

/**
 * Event hint with original exception.
 */
export interface ExceptionEventHint extends EventHint {
  /**
   * The original exception that was captured.
   */
  originalException: Error | string | unknown;
}

/**
 * Event hint with synthetic exception.
 */
export interface MessageEventHint extends EventHint {
  /**
   * Synthetic exception for stack trace.
   */
  syntheticException?: Error;
}
