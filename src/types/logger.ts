/**
 * Local logger type definitions
 * Types for the universal logger's local storage and querying
 */

import type { Breadcrumb, Event, Exception, SeverityLevel } from './sentry';
import type { SpanJSON } from './span';

/**
 * Log levels for local logging.
 * Mapped to Sentry severity levels for compatibility.
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Mapping between log levels and Sentry severity levels.
 */
export const LogLevelToSeverity: Record<LogLevel, SeverityLevel> = {
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
  fatal: 'fatal',
};

/**
 * Mapping between Sentry severity levels and log levels.
 */
export const SeverityToLogLevel: Record<SeverityLevel, LogLevel> = {
  debug: 'debug',
  info: 'info',
  log: 'info',
  warning: 'warn',
  error: 'error',
  fatal: 'fatal',
};

/**
 * A single log entry stored locally.
 */
export interface LogEntry {
  /**
   * Unique identifier for the log entry.
   */
  id: string;

  /**
   * ISO 8601 timestamp when the log was created.
   */
  timestamp: string;

  /**
   * The log level.
   */
  level: LogLevel;

  /**
   * The log message.
   */
  message: string;

  /**
   * Additional structured data.
   */
  data?: Record<string, unknown>;

  /**
   * Associated session ID.
   */
  sessionId?: string;

  /**
   * Associated Sentry event ID (if sent to Sentry).
   */
  eventId?: string;

  /**
   * Exception information if this log is for an error.
   */
  exception?: Exception;

  /**
   * Breadcrumbs captured at the time of this log.
   */
  breadcrumbs?: Breadcrumb[];

  /**
   * Tags for filtering.
   */
  tags?: Record<string, string>;

  /**
   * Trace ID for distributed tracing.
   */
  traceId?: string;

  /**
   * Span ID for distributed tracing.
   */
  spanId?: string;

  /**
   * Source of the log (file, function, etc.).
   */
  source?: LogSource;

  /**
   * User context at the time of logging.
   */
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };

  /**
   * Environment information.
   */
  environment?: string;

  /**
   * Release version.
   */
  release?: string;

  /**
   * Whether this log was sent to Sentry.
   */
  sentToSentry?: boolean;

  /**
   * Error sending to Sentry (if any).
   */
  sentryError?: string;
}

/**
 * Source information for a log entry.
 */
export interface LogSource {
  /**
   * The file name.
   */
  file?: string;

  /**
   * The function name.
   */
  function?: string;

  /**
   * The line number.
   */
  line?: number;

  /**
   * The column number.
   */
  column?: number;

  /**
   * The module name.
   */
  module?: string;
}

/**
 * A log session represents a period of user activity.
 */
export interface LogSession {
  /**
   * Unique session identifier.
   */
  id: string;

  /**
   * ISO 8601 timestamp when the session started.
   */
  startedAt: string;

  /**
   * ISO 8601 timestamp when the session ended (if ended).
   */
  endedAt?: string;

  /**
   * Session metadata.
   */
  metadata?: Record<string, unknown>;

  /**
   * Number of errors during this session.
   */
  errorCount: number;

  /**
   * Number of warnings during this session.
   */
  warnCount: number;

  /**
   * Total number of log entries.
   */
  logCount: number;

  /**
   * User information for the session.
   */
  user?: {
    id?: string;
    email?: string;
    username?: string;
  };

  /**
   * Environment name.
   */
  environment?: string;

  /**
   * Release version.
   */
  release?: string;

  /**
   * Device/browser information.
   */
  device?: {
    type?: string;
    name?: string;
    brand?: string;
    os?: string;
    osVersion?: string;
  };

  /**
   * Geographic information.
   */
  geo?: {
    country?: string;
    region?: string;
    city?: string;
  };

  /**
   * Session status.
   */
  status: 'active' | 'ended' | 'crashed' | 'abnormal';

  /**
   * Crash information if session crashed.
   */
  crashInfo?: {
    eventId?: string;
    message?: string;
    timestamp?: string;
  };
}

/**
 * Filter options for querying logs.
 */
export interface LogFilter {
  /**
   * Filter by log level (includes this level and above).
   */
  level?: LogLevel;

  /**
   * Filter by specific levels (exact match).
   */
  levels?: LogLevel[];

  /**
   * Filter by session ID.
   */
  sessionId?: string;

  /**
   * Filter by start time (inclusive).
   */
  startTime?: string | Date;

  /**
   * Filter by end time (exclusive).
   */
  endTime?: string | Date;

  /**
   * Search in message and data.
   */
  search?: string;

  /**
   * Filter by tags.
   */
  tags?: Record<string, string>;

  /**
   * Filter by trace ID.
   */
  traceId?: string;

  /**
   * Filter by whether it has an exception.
   */
  hasException?: boolean;

  /**
   * Filter by user ID.
   */
  userId?: string;

  /**
   * Filter by environment.
   */
  environment?: string;

  /**
   * Filter by release.
   */
  release?: string;

  /**
   * Limit number of results.
   */
  limit?: number;

  /**
   * Offset for pagination.
   */
  offset?: number;

  /**
   * Sort order.
   */
  sortOrder?: 'asc' | 'desc';

  /**
   * Sort field.
   */
  sortBy?: 'timestamp' | 'level' | 'sessionId';

  /**
   * Only include logs sent to Sentry.
   */
  sentToSentry?: boolean;
}

/**
 * Filter options for querying Sentry events.
 */
export interface SentryEventFilter {
  /**
   * Filter by severity level.
   */
  level?: SeverityLevel;

  /**
   * Filter by specific levels.
   */
  levels?: SeverityLevel[];

  /**
   * Filter by start time.
   */
  startTime?: string | Date;

  /**
   * Filter by end time.
   */
  endTime?: string | Date;

  /**
   * Filter by whether it has an exception.
   */
  hasException?: boolean;

  /**
   * Filter by event type.
   */
  eventType?: 'event' | 'transaction' | 'feedback';

  /**
   * Search in message and exception values.
   */
  search?: string;

  /**
   * Filter by user ID.
   */
  userId?: string;

  /**
   * Filter by transaction name.
   */
  transaction?: string;

  /**
   * Filter by tags.
   */
  tags?: Record<string, string>;

  /**
   * Filter by trace ID.
   */
  traceId?: string;

  /**
   * Limit number of results.
   */
  limit?: number;

  /**
   * Offset for pagination.
   */
  offset?: number;
}

/**
 * Filter options for querying traces/spans.
 */
export interface TraceFilter {
  /**
   * Filter by trace ID.
   */
  traceId?: string;

  /**
   * Filter by span ID.
   */
  spanId?: string;

  /**
   * Filter by parent span ID.
   */
  parentSpanId?: string;

  /**
   * Filter by start time.
   */
  startTime?: string | Date;

  /**
   * Filter by end time.
   */
  endTime?: string | Date;

  /**
   * Filter by operation name.
   */
  op?: string;

  /**
   * Filter by span status.
   */
  status?: string;

  /**
   * Filter by span name/description.
   */
  name?: string;

  /**
   * Search in name and attributes.
   */
  search?: string;

  /**
   * Minimum duration in milliseconds.
   */
  minDuration?: number;

  /**
   * Maximum duration in milliseconds.
   */
  maxDuration?: number;

  /**
   * Limit number of results.
   */
  limit?: number;

  /**
   * Offset for pagination.
   */
  offset?: number;
}

/**
 * Stored Sentry event (local copy).
 */
export interface StoredEvent extends Event {
  /**
   * Local storage ID.
   */
  _localId: string;

  /**
   * Timestamp when stored.
   */
  _storedAt: string;

  /**
   * Whether the event was sent to Sentry.
   */
  _sentToSentry: boolean;

  /**
   * Error sending to Sentry (if any).
   */
  _sentryError?: string;

  /**
   * Sentry event ID (if sent).
   */
  _sentryEventId?: string;
}

/**
 * Stored span (local copy).
 */
export interface StoredSpan extends SpanJSON {
  /**
   * Local storage ID.
   */
  _localId: string;

  /**
   * Timestamp when stored.
   */
  _storedAt: string;

  /**
   * Whether the span was sent to Sentry.
   */
  _sentToSentry: boolean;

  /**
   * Associated session ID.
   */
  _sessionId?: string;
}

/**
 * Query result with pagination info.
 */
export interface QueryResult<T> {
  /**
   * The items matching the query.
   */
  items: T[];

  /**
   * Total count of matching items.
   */
  total: number;

  /**
   * Whether there are more items.
   */
  hasMore: boolean;

  /**
   * Offset for next page.
   */
  nextOffset?: number;
}

/**
 * Log statistics for a time period.
 */
export interface LogStats {
  /**
   * Total number of logs.
   */
  total: number;

  /**
   * Count by level.
   */
  byLevel: Record<LogLevel, number>;

  /**
   * Count by session.
   */
  bySessions: number;

  /**
   * Error rate (errors / total).
   */
  errorRate: number;

  /**
   * Time period start.
   */
  startTime: string;

  /**
   * Time period end.
   */
  endTime: string;

  /**
   * Number of unique users.
   */
  uniqueUsers?: number;
}

/**
 * Log export format.
 */
export type LogExportFormat = 'json' | 'csv' | 'ndjson';

/**
 * Options for exporting logs.
 */
export interface LogExportOptions {
  /**
   * Filter for logs to export.
   */
  filter?: LogFilter;

  /**
   * Export format.
   */
  format?: LogExportFormat;

  /**
   * Whether to include breadcrumbs.
   */
  includeBreadcrumbs?: boolean;

  /**
   * Whether to include exception details.
   */
  includeExceptions?: boolean;

  /**
   * Maximum number of logs to export.
   */
  maxLogs?: number;
}
