/**
 * Storage Provider Types
 *
 * Type definitions for the pluggable storage provider architecture.
 * These types define the contract for all storage implementations.
 */

// =============================================================================
// Severity and Log Types
// =============================================================================

/**
 * Sentry-compatible severity levels
 */
export type SeverityLevel = 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';

/**
 * Breadcrumb types matching Sentry specification
 */
export type BreadcrumbType =
  | 'default'
  | 'debug'
  | 'error'
  | 'navigation'
  | 'http'
  | 'info'
  | 'query'
  | 'transaction'
  | 'ui'
  | 'user';

/**
 * Span status codes matching Sentry/OpenTelemetry specification
 */
export type SpanStatus =
  | 'ok'
  | 'cancelled'
  | 'unknown'
  | 'invalid_argument'
  | 'deadline_exceeded'
  | 'not_found'
  | 'already_exists'
  | 'permission_denied'
  | 'resource_exhausted'
  | 'failed_precondition'
  | 'aborted'
  | 'out_of_range'
  | 'unimplemented'
  | 'internal_error'
  | 'unavailable'
  | 'data_loss'
  | 'unauthenticated';

// =============================================================================
// Log Entry Types
// =============================================================================

/**
 * A breadcrumb representing a trail of events before an error
 */
export interface Breadcrumb {
  type?: BreadcrumbType;
  category?: string;
  message?: string;
  data?: Record<string, unknown>;
  level?: SeverityLevel;
  timestamp?: string;
}

/**
 * User information attached to events
 */
export interface User {
  id?: string | number;
  email?: string;
  username?: string;
  ip_address?: string;
  segment?: string;
  [key: string]: unknown;
}

/**
 * Exception information for error events
 */
export interface ExceptionData {
  type?: string;
  value?: string;
  module?: string;
  mechanism?: {
    type: string;
    handled?: boolean;
    data?: Record<string, unknown>;
  };
  stacktrace?: {
    frames?: StackFrame[];
  };
}

/**
 * Stack frame information
 */
export interface StackFrame {
  filename?: string;
  function?: string;
  module?: string;
  lineno?: number;
  colno?: number;
  abs_path?: string;
  context_line?: string;
  pre_context?: string[];
  post_context?: string[];
  in_app?: boolean;
  vars?: Record<string, unknown>;
}

/**
 * Request information for HTTP events
 */
export interface RequestData {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  query_string?: string;
  data?: unknown;
  cookies?: Record<string, string>;
  env?: Record<string, string>;
}

/**
 * A log entry stored in the storage provider
 */
export interface LogEntry {
  id: string;
  timestamp: string;
  level: SeverityLevel;
  message: string;
  sessionId?: string;

  // Error information
  exception?: ExceptionData;
  stacktrace?: string;

  // Context data
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, Record<string, unknown>>;
  user?: User;
  breadcrumbs?: Breadcrumb[];

  // Sentry-specific
  eventId?: string;
  fingerprint?: string[];
  release?: string;
  environment?: string;
  platform?: string;
  sdk?: {
    name: string;
    version: string;
  };

  // Request data
  request?: RequestData;

  // Tracing
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
}

// =============================================================================
// Session Types
// =============================================================================

/**
 * Session status matching Sentry specification
 */
export type SessionStatus = 'ok' | 'exited' | 'crashed' | 'abnormal';

/**
 * A logging session
 */
export interface LogSession {
  id: string;
  startedAt: string;
  endedAt?: string;
  status: SessionStatus;

  // Session metadata
  release?: string;
  environment?: string;
  ipAddress?: string;
  userAgent?: string;
  user?: User;

  // Session stats
  errors: number;
  duration?: number;

  // Device/OS info
  device?: {
    family?: string;
    model?: string;
    brand?: string;
  };
  os?: {
    name?: string;
    version?: string;
  };
  browser?: {
    name?: string;
    version?: string;
  };

  // Custom attributes
  attributes?: Record<string, unknown>;
}

// =============================================================================
// Sentry Event Types
// =============================================================================

/**
 * A Sentry-compatible event
 */
export interface SentryEvent {
  event_id: string;
  timestamp: string;
  platform?: string;
  level?: SeverityLevel;
  logger?: string;
  transaction?: string;
  server_name?: string;
  release?: string;
  dist?: string;
  environment?: string;
  message?: string | { formatted?: string; message?: string; params?: unknown[] };

  // Exception data
  exception?: {
    values?: ExceptionData[];
  };

  // Context
  user?: User;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
  contexts?: Record<string, Record<string, unknown>>;
  breadcrumbs?: Breadcrumb[];
  fingerprint?: string[];

  // Request
  request?: RequestData;

  // SDK info
  sdk?: {
    name: string;
    version: string;
    integrations?: string[];
    packages?: Array<{ name: string; version: string }>;
  };

  // Debug info
  debug_meta?: {
    images?: Array<{
      type: string;
      code_file?: string;
      debug_id?: string;
      [key: string]: unknown;
    }>;
  };

  // Tracing context
  type?: 'event' | 'transaction' | 'feedback';
  spans?: SpanData[];

  // Internal tracking
  _localTimestamp?: string;
  _forwarded?: boolean;
  _forwardedAt?: string;
}

// =============================================================================
// Tracing Types
// =============================================================================

/**
 * Span attributes
 */
export type SpanAttributes = Record<string, string | number | boolean | undefined>;

/**
 * Data for a single span
 */
export interface SpanData {
  span_id: string;
  trace_id: string;
  parent_span_id?: string;
  name: string;
  op?: string;
  description?: string;
  start_timestamp: string;
  timestamp?: string;
  status?: SpanStatus;
  tags?: Record<string, string>;
  data?: SpanAttributes;
  origin?: string;

  // Internal tracking
  _sessionId?: string;
  _transactionId?: string;
}

/**
 * Data for a transaction (root span)
 */
export interface TransactionData {
  transaction_id: string;
  trace_id: string;
  name: string;
  op?: string;
  start_timestamp: string;
  timestamp?: string;
  status?: SpanStatus;
  tags?: Record<string, string>;
  data?: SpanAttributes;

  // Transaction-specific
  sampled?: boolean;
  sample_rate?: number;
  parent_sampled?: boolean;

  // Child spans
  spans?: SpanData[];

  // Context
  contexts?: Record<string, Record<string, unknown>>;
  measurements?: Record<string, { value: number; unit?: string }>;

  // Internal tracking
  _sessionId?: string;
  _eventId?: string;
}

/**
 * Trace data combining transaction and spans
 */
export interface TraceData {
  trace_id: string;
  transaction: TransactionData;
  spans: SpanData[];
  start_timestamp: string;
  timestamp?: string;
  duration?: number;
}

// =============================================================================
// Filter Types
// =============================================================================

/**
 * Filter options for log queries
 */
export interface LogFilter {
  level?: SeverityLevel | SeverityLevel[];
  sessionId?: string;
  startTime?: string;
  endTime?: string;
  search?: string;
  tags?: Record<string, string>;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'level';
  orderDirection?: 'asc' | 'desc';
  traceId?: string;
  eventId?: string;
}

/**
 * Filter options for Sentry event queries
 */
export interface SentryEventFilter {
  level?: SeverityLevel | SeverityLevel[];
  type?: 'event' | 'transaction' | 'feedback';
  startTime?: string;
  endTime?: string;
  environment?: string;
  release?: string;
  search?: string;
  tags?: Record<string, string>;
  userId?: string;
  limit?: number;
  offset?: number;
  orderBy?: 'timestamp' | 'level';
  orderDirection?: 'asc' | 'desc';
  hasException?: boolean;
  fingerprint?: string[];
}

/**
 * Filter options for trace queries
 */
export interface TraceFilter {
  traceId?: string;
  transactionName?: string;
  op?: string;
  status?: SpanStatus | SpanStatus[];
  startTime?: string;
  endTime?: string;
  minDuration?: number;
  maxDuration?: number;
  sampled?: boolean;
  limit?: number;
  offset?: number;
  orderBy?: 'start_timestamp' | 'duration';
  orderDirection?: 'asc' | 'desc';
  sessionId?: string;
}

// =============================================================================
// Storage Provider Interface
// =============================================================================

/**
 * Configuration options for storage providers
 */
export interface StorageProviderConfig {
  /** Maximum number of log entries to store (for memory provider) */
  maxLogs?: number;
  /** Maximum number of sessions to store (for memory provider) */
  maxSessions?: number;
  /** Maximum number of events to store (for memory provider) */
  maxEvents?: number;
  /** Maximum number of spans to store (for memory provider) */
  maxSpans?: number;
  /** Maximum number of transactions to store (for memory provider) */
  maxTransactions?: number;
  /** Database name for IndexedDB */
  dbName?: string;
  /** Database version for IndexedDB */
  dbVersion?: number;
}

/**
 * The storage provider interface that all implementations must follow
 */
export interface StorageProvider {
  /** Unique name identifying this storage provider */
  readonly name: string;

  /**
   * Check if the storage provider is ready to use
   */
  isReady(): boolean;

  /**
   * Initialize the storage provider
   * @throws Error if initialization fails
   */
  init(): Promise<void>;

  /**
   * Close the storage provider and release resources
   */
  close(): Promise<void>;

  // =========================================================================
  // Log Operations
  // =========================================================================

  /**
   * Save a log entry to storage
   * @param entry - The log entry to save
   */
  saveLog(entry: LogEntry): Promise<void>;

  /**
   * Retrieve log entries matching the filter
   * @param filter - Optional filter criteria
   * @returns Array of matching log entries
   */
  getLogs(filter?: LogFilter): Promise<LogEntry[]>;

  /**
   * Clear log entries matching the filter
   * @param filter - Optional filter criteria (clears all if not provided)
   */
  clearLogs(filter?: LogFilter): Promise<void>;

  // =========================================================================
  // Session Operations
  // =========================================================================

  /**
   * Create a new session
   * @param session - The session to create
   */
  createSession(session: LogSession): Promise<void>;

  /**
   * Update an existing session
   * @param sessionId - The ID of the session to update
   * @param updates - Partial session data to merge
   */
  updateSession(sessionId: string, updates: Partial<LogSession>): Promise<void>;

  /**
   * End a session (sets endedAt and calculates duration)
   * @param sessionId - The ID of the session to end
   */
  endSession(sessionId: string): Promise<void>;

  /**
   * Retrieve sessions
   * @param limit - Maximum number of sessions to return
   * @returns Array of sessions, ordered by startedAt descending
   */
  getSessions(limit?: number): Promise<LogSession[]>;

  /**
   * Get a specific session by ID
   * @param sessionId - The ID of the session to retrieve
   * @returns The session or null if not found
   */
  getSession(sessionId: string): Promise<LogSession | null>;

  /**
   * Delete a session and optionally its associated logs
   * @param sessionId - The ID of the session to delete
   */
  deleteSession(sessionId: string): Promise<void>;

  // =========================================================================
  // Sentry Event Operations
  // =========================================================================

  /**
   * Save a Sentry event
   * @param event - The Sentry event to save
   */
  saveSentryEvent(event: SentryEvent): Promise<void>;

  /**
   * Retrieve Sentry events matching the filter
   * @param filter - Optional filter criteria
   * @returns Array of matching events
   */
  getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]>;

  /**
   * Clear all Sentry events
   */
  clearSentryEvents(): Promise<void>;

  // =========================================================================
  // Tracing Operations
  // =========================================================================

  /**
   * Save a span
   * @param span - The span data to save
   */
  saveSpan(span: SpanData): Promise<void>;

  /**
   * Save a transaction
   * @param transaction - The transaction data to save
   */
  saveTransaction(transaction: TransactionData): Promise<void>;

  /**
   * Retrieve traces matching the filter
   * @param filter - Optional filter criteria
   * @returns Array of trace data (transaction + spans)
   */
  getTraces(filter?: TraceFilter): Promise<TraceData[]>;

  /**
   * Clear all trace data (spans and transactions)
   */
  clearTraces(): Promise<void>;
}
