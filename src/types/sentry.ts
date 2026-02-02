/**
 * Core Sentry-compatible type definitions
 * Compatible with Sentry SDK v8 public API
 */

/**
 * Severity levels for events and breadcrumbs.
 * Ordered from most to least severe.
 */
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

/**
 * Unique identifier for events (UUID v4 format without dashes).
 */
export type EventId = string;

/**
 * Primitive types that can be used in various Sentry data structures.
 */
export type Primitive = string | number | boolean | bigint | symbol | null | undefined;

/**
 * Describes the mechanism by which an exception was captured.
 */
export interface Mechanism {
  /**
   * The type of mechanism (e.g., 'generic', 'onerror', 'onunhandledrejection').
   */
  type: string;

  /**
   * Whether the exception was handled by the application.
   * False indicates an unhandled exception.
   */
  handled?: boolean;

  /**
   * Additional data associated with the mechanism.
   */
  data?: Record<string, unknown>;

  /**
   * Human-readable description of the mechanism.
   */
  description?: string;

  /**
   * URL to documentation about this mechanism.
   */
  help_link?: string;

  /**
   * Whether this is a synthetic exception (created programmatically).
   */
  synthetic?: boolean;

  /**
   * Source of the exception (e.g., 'instrument', 'middleware').
   */
  source?: string;

  /**
   * Whether the mechanism is the root cause of the exception chain.
   */
  is_exception_group?: boolean;

  /**
   * Exception ID for exception groups.
   */
  exception_id?: number;

  /**
   * Parent exception ID for exception groups.
   */
  parent_id?: number;
}

/**
 * Represents a single frame in a stack trace.
 */
export interface StackFrame {
  /**
   * The name of the function being called.
   */
  function?: string;

  /**
   * The relative filename (from the project root).
   */
  filename?: string;

  /**
   * The line number in the source file.
   */
  lineno?: number;

  /**
   * The column number in the source file.
   */
  colno?: number;

  /**
   * The absolute path to the source file.
   */
  abs_path?: string;

  /**
   * The source code of the line that caused the error.
   */
  context_line?: string;

  /**
   * Source code lines before the context line.
   */
  pre_context?: string[];

  /**
   * Source code lines after the context line.
   */
  post_context?: string[];

  /**
   * Whether this frame is from application code (vs library code).
   */
  in_app?: boolean;

  /**
   * The module/package name.
   */
  module?: string;

  /**
   * Platform-specific instruction address.
   */
  instruction_addr?: string;

  /**
   * Platform-specific symbol address.
   */
  symbol_addr?: string;

  /**
   * Platform-specific image address.
   */
  image_addr?: string;

  /**
   * The package/assembly name.
   */
  package?: string;

  /**
   * Platform-specific identifier.
   */
  platform?: string;

  /**
   * Local variables at this frame.
   */
  vars?: Record<string, unknown>;

  /**
   * Address mode for native frames.
   */
  addr_mode?: string;
}

/**
 * Represents a complete stack trace.
 */
export interface Stacktrace {
  /**
   * Array of stack frames, ordered from oldest to newest.
   */
  frames?: StackFrame[];

  /**
   * Register values at the time of the crash (native only).
   */
  registers?: Record<string, string>;
}

/**
 * Represents a single exception in an event.
 */
export interface Exception {
  /**
   * The type/class name of the exception.
   */
  type?: string;

  /**
   * The error message.
   */
  value?: string;

  /**
   * The stack trace for this exception.
   */
  stacktrace?: Stacktrace;

  /**
   * The mechanism that captured this exception.
   */
  mechanism?: Mechanism;

  /**
   * The module where the exception originated.
   */
  module?: string;

  /**
   * Thread ID that raised the exception.
   */
  thread_id?: number;
}

/**
 * User information for event attribution.
 */
export interface User {
  /**
   * Unique identifier for the user.
   */
  id?: string | number;

  /**
   * User's email address.
   */
  email?: string;

  /**
   * User's username or handle.
   */
  username?: string;

  /**
   * User's IP address.
   */
  ip_address?: string;

  /**
   * User segment for analytics.
   */
  segment?: string;

  /**
   * Geographic information about the user.
   */
  geo?: {
    country_code?: string;
    region?: string;
    city?: string;
  };

  /**
   * Additional custom user data.
   */
  data?: Record<string, unknown>;

  /**
   * User's full name.
   */
  name?: string;
}

/**
 * Represents a breadcrumb - a record of an event that happened prior to an issue.
 */
export interface Breadcrumb {
  /**
   * The type of breadcrumb (e.g., 'default', 'http', 'navigation', 'error', 'debug', 'query', 'ui', 'user').
   */
  type?: string;

  /**
   * A category for the breadcrumb (e.g., 'ui.click', 'xhr', 'console').
   */
  category?: string;

  /**
   * A message describing what happened.
   */
  message?: string;

  /**
   * The severity level of this breadcrumb.
   */
  level?: SeverityLevel;

  /**
   * Unix timestamp (in seconds) when the breadcrumb was recorded.
   */
  timestamp?: number;

  /**
   * Arbitrary data associated with this breadcrumb.
   */
  data?: Record<string, unknown>;

  /**
   * Event ID if this breadcrumb is associated with an event.
   */
  event_id?: string;
}

/**
 * Hint object passed when adding breadcrumbs.
 */
export interface BreadcrumbHint {
  /**
   * The original DOM event that triggered this breadcrumb.
   */
  event?: unknown;

  /**
   * The input data (e.g., for fetch/xhr).
   */
  input?: unknown;

  /**
   * The response data (e.g., for fetch/xhr).
   */
  response?: unknown;

  /**
   * The XMLHttpRequest object.
   */
  xhr?: unknown;

  /**
   * The fetch request info.
   */
  request?: unknown;

  /**
   * The fetch response.
   */
  fetchResponse?: unknown;

  /**
   * Start timestamp for timing.
   */
  startTimestamp?: number;

  /**
   * End timestamp for timing.
   */
  endTimestamp?: number;

  /**
   * Additional arbitrary data.
   */
  [key: string]: unknown;
}

/**
 * Context information attached to events.
 */
export interface Contexts {
  /**
   * App-specific context.
   */
  app?: {
    app_name?: string;
    app_version?: string;
    app_identifier?: string;
    app_build?: string;
    app_start_time?: string;
    device_app_hash?: string;
    build_type?: string;
    [key: string]: unknown;
  };

  /**
   * Device information.
   */
  device?: {
    name?: string;
    family?: string;
    model?: string;
    model_id?: string;
    arch?: string;
    battery_level?: number;
    orientation?: 'portrait' | 'landscape';
    manufacturer?: string;
    brand?: string;
    screen_resolution?: string;
    screen_density?: number;
    screen_dpi?: number;
    online?: boolean;
    charging?: boolean;
    low_memory?: boolean;
    simulator?: boolean;
    memory_size?: number;
    free_memory?: number;
    usable_memory?: number;
    storage_size?: number;
    free_storage?: number;
    external_storage_size?: number;
    external_free_storage?: number;
    boot_time?: string;
    timezone?: string;
    [key: string]: unknown;
  };

  /**
   * Operating system information.
   */
  os?: {
    name?: string;
    version?: string;
    build?: string;
    kernel_version?: string;
    rooted?: boolean;
    [key: string]: unknown;
  };

  /**
   * Runtime information.
   */
  runtime?: {
    name?: string;
    version?: string;
    [key: string]: unknown;
  };

  /**
   * Browser information.
   */
  browser?: {
    name?: string;
    version?: string;
    [key: string]: unknown;
  };

  /**
   * GPU information.
   */
  gpu?: {
    name?: string;
    vendor_name?: string;
    memory_size?: number;
    api_type?: string;
    multi_threaded_rendering?: boolean;
    version?: string;
    npot_support?: string;
    [key: string]: unknown;
  };

  /**
   * Trace context for distributed tracing.
   */
  trace?: {
    trace_id?: string;
    span_id?: string;
    parent_span_id?: string;
    op?: string;
    status?: string;
    [key: string]: unknown;
  };

  /**
   * Response context for HTTP responses.
   */
  response?: {
    status_code?: number;
    body_size?: number;
    headers?: Record<string, string>;
    [key: string]: unknown;
  };

  /**
   * Additional custom contexts.
   */
  [key: string]: unknown;
}

/**
 * Request information for HTTP-related events.
 */
export interface Request {
  /**
   * The URL of the request.
   */
  url?: string;

  /**
   * The HTTP method.
   */
  method?: string;

  /**
   * Request headers.
   */
  headers?: Record<string, string>;

  /**
   * The query string.
   */
  query_string?: string | Record<string, string>;

  /**
   * Request body data.
   */
  data?: unknown;

  /**
   * Cookie header value.
   */
  cookies?: string | Record<string, string>;

  /**
   * Environment variables (server-side).
   */
  env?: Record<string, string>;
}

/**
 * SDK metadata attached to events.
 */
export interface SdkInfo {
  /**
   * The name of the SDK (e.g., 'sentry.javascript.browser').
   */
  name?: string;

  /**
   * The version of the SDK.
   */
  version?: string;

  /**
   * List of installed integrations.
   */
  integrations?: string[];

  /**
   * List of packages included in the SDK.
   */
  packages?: Array<{
    name: string;
    version: string;
  }>;
}

/**
 * Thread information for multi-threaded applications.
 */
export interface Thread {
  /**
   * Unique thread identifier.
   */
  id?: number;

  /**
   * Thread name.
   */
  name?: string;

  /**
   * Whether this thread crashed.
   */
  crashed?: boolean;

  /**
   * Whether this is the current (active) thread.
   */
  current?: boolean;

  /**
   * Stack trace for this thread.
   */
  stacktrace?: Stacktrace;
}

/**
 * Debug image information for native crash reports.
 */
export interface DebugImage {
  /**
   * Type of debug image.
   */
  type?: string;

  /**
   * Debug identifier.
   */
  debug_id?: string;

  /**
   * Code identifier.
   */
  code_id?: string;

  /**
   * Image name or path.
   */
  image_addr?: string;

  /**
   * Image size in bytes.
   */
  image_size?: number;

  /**
   * Image architecture.
   */
  arch?: string;

  /**
   * Code file path.
   */
  code_file?: string;

  /**
   * Debug file path.
   */
  debug_file?: string;
}

/**
 * Debug metadata for the event.
 */
export interface DebugMeta {
  /**
   * List of debug images.
   */
  images?: DebugImage[];

  /**
   * SDK information.
   */
  sdk_info?: {
    sdk_name?: string;
    version_major?: number;
    version_minor?: number;
    version_patchlevel?: number;
  };
}

/**
 * The main Sentry event interface.
 * Represents a complete event that can be sent to Sentry.
 */
export interface Event {
  /**
   * Unique identifier for the event (UUID without dashes).
   */
  event_id?: EventId;

  /**
   * ISO 8601 timestamp when the event was created.
   */
  timestamp?: number | string;

  /**
   * The platform that generated the event (e.g., 'javascript', 'node', 'python').
   */
  platform?: string;

  /**
   * The severity level of the event.
   */
  level?: SeverityLevel;

  /**
   * The logger that created this event.
   */
  logger?: string;

  /**
   * Server name or hostname.
   */
  server_name?: string;

  /**
   * Release version identifier.
   */
  release?: string;

  /**
   * Distribution identifier (for mobile apps).
   */
  dist?: string;

  /**
   * Environment name (e.g., 'production', 'staging').
   */
  environment?: string;

  /**
   * Transaction name for performance events.
   */
  transaction?: string;

  /**
   * User who experienced this event.
   */
  user?: User;

  /**
   * HTTP request information.
   */
  request?: Request;

  /**
   * Additional contexts.
   */
  contexts?: Contexts;

  /**
   * Tags for categorization and filtering.
   */
  tags?: Record<string, Primitive>;

  /**
   * Extra arbitrary data.
   */
  extra?: Record<string, unknown>;

  /**
   * Fingerprint for issue grouping.
   */
  fingerprint?: string[];

  /**
   * Breadcrumbs leading up to this event.
   */
  breadcrumbs?: Breadcrumb[];

  /**
   * Exception information.
   */
  exception?: {
    values?: Exception[];
  };

  /**
   * Log message.
   */
  message?: string | {
    formatted?: string;
    message?: string;
    params?: unknown[];
  };

  /**
   * SDK information.
   */
  sdk?: SdkInfo;

  /**
   * Threads information (for native crashes).
   */
  threads?: {
    values?: Thread[];
  };

  /**
   * Debug metadata.
   */
  debug_meta?: DebugMeta;

  /**
   * Modules/packages loaded at the time of the event.
   */
  modules?: Record<string, string>;

  /**
   * Type of event ('event', 'transaction', 'profile', 'replay_event').
   */
  type?: 'event' | 'transaction' | 'profile' | 'replay_event' | 'feedback';

  /**
   * Start timestamp for transactions.
   */
  start_timestamp?: number;

  /**
   * Spans for transaction events.
   */
  spans?: unknown[];

  /**
   * Measurements for performance data.
   */
  measurements?: Record<string, { value: number; unit?: string }>;

  /**
   * Span breakdown data.
   */
  span_breakdown?: unknown;

  /**
   * Transaction info.
   */
  transaction_info?: {
    source?: 'custom' | 'url' | 'route' | 'view' | 'component' | 'task';
  };
}

/**
 * Hint object passed to event processors and beforeSend.
 */
export interface EventHint {
  /**
   * The original exception that was captured.
   */
  originalException?: Error | string | unknown;

  /**
   * A synthetic exception created for stack trace generation.
   */
  syntheticException?: Error;

  /**
   * Additional data provided when capturing the event.
   */
  data?: unknown;

  /**
   * The event ID assigned to this event.
   */
  event_id?: string;

  /**
   * Capture context provided when capturing.
   */
  captureContext?: CaptureContext;

  /**
   * The mechanism that captured this exception.
   */
  mechanism?: Partial<Mechanism>;

  /**
   * Integration name that processed this event.
   */
  integrations?: string[];

  /**
   * Attachments to send with the event.
   */
  attachments?: Attachment[];
}

/**
 * File attachment for events.
 */
export interface Attachment {
  /**
   * The filename.
   */
  filename: string;

  /**
   * The attachment data.
   * Can be a string (for text), Uint8Array (for binary), or Blob (for browser files).
   */
  data: string | Uint8Array | Blob;

  /**
   * MIME type of the attachment.
   */
  contentType?: string;

  /**
   * Type of attachment.
   */
  attachmentType?: 'event.attachment' | 'event.minidump' | 'event.applecrashreport' | 'event.view_hierarchy' | 'unreal.context' | 'unreal.logs';
}

/**
 * Context that can be passed when capturing events.
 * Can be either scope data or a function that modifies scope.
 */
export type CaptureContext =
  | Partial<ScopeContext>
  | ((scope: ScopeContext) => ScopeContext);

/**
 * Scope context for capture context.
 */
export interface ScopeContext {
  /**
   * User information.
   */
  user?: User;

  /**
   * Tags to set.
   */
  tags?: Record<string, Primitive>;

  /**
   * Extra data to set.
   */
  extra?: Record<string, unknown>;

  /**
   * Contexts to set.
   */
  contexts?: Contexts;

  /**
   * Fingerprint to set.
   */
  fingerprint?: string[];

  /**
   * Level to set.
   */
  level?: SeverityLevel;

  /**
   * Transaction name to set.
   */
  transactionName?: string;
}

/**
 * Parameterized string for structured logging.
 */
export interface ParameterizedString {
  /**
   * The raw message template.
   */
  __sentry_template_string__?: string;

  /**
   * The values to substitute.
   */
  __sentry_template_values__?: unknown[];
}

/**
 * Extras type for additional data.
 */
export type Extras = Record<string, unknown>;

/**
 * Data category for rate limiting and quotas.
 */
export type DataCategory =
  | 'default'
  | 'error'
  | 'transaction'
  | 'replay'
  | 'security'
  | 'attachment'
  | 'session'
  | 'internal'
  | 'profile'
  | 'monitor'
  | 'feedback'
  | 'span'
  | 'unknown';
