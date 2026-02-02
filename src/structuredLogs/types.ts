/**
 * Type definitions for Structured Logs API
 *
 * Provides types for the Sentry-compatible logging system with
 * searchable attributes and trace correlation.
 */

/**
 * Log severity levels ordered from least to most severe
 */
export type LogLevel = 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal';

/**
 * Numeric values for log levels (for comparison and filtering)
 */
export const LogLevelValues: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

/**
 * Attributes that can be attached to log records
 * Only primitive types are supported for searchability
 */
export interface LogAttributes {
  [key: string]: string | number | boolean;
}

/**
 * A single log record
 */
export interface LogRecord {
  /**
   * Log severity level
   */
  level: LogLevel;

  /**
   * The log message
   */
  message: string;

  /**
   * Structured attributes for searching and filtering
   */
  attributes: LogAttributes;

  /**
   * Unix timestamp in seconds when the log was created
   */
  timestamp: number;

  /**
   * Trace ID for correlation with distributed tracing
   */
  traceId?: string;

  /**
   * Span ID of the parent span if within an active trace
   */
  spanId?: string;

  /**
   * Unique identifier for this log record
   */
  logId?: string;

  /**
   * Message template for parameterized messages
   */
  messageTemplate?: string;

  /**
   * Template parameter values
   */
  messageParams?: unknown[];

  /**
   * Severity number (for envelope format)
   */
  severityNumber?: number;

  /**
   * Severity text (for envelope format)
   */
  severityText?: string;
}

/**
 * Options for configuring the logger
 */
export interface LoggerOptions {
  /**
   * Whether logging is enabled
   * @default true
   */
  enabled?: boolean;

  /**
   * Minimum log level to capture
   * @default 'trace'
   */
  minLevel?: LogLevel;

  /**
   * Maximum number of logs to buffer before flushing
   * @default 100
   */
  maxBufferSize?: number;

  /**
   * Flush interval in milliseconds
   * @default 5000
   */
  flushInterval?: number;

  /**
   * Callback to filter or modify logs before sending
   * Return null to drop the log
   */
  beforeSendLog?: (log: LogRecord) => LogRecord | null;

  /**
   * Default attributes to attach to all logs
   */
  defaultAttributes?: LogAttributes;

  /**
   * Release version (auto-populated from Sentry config if available)
   */
  release?: string;

  /**
   * Environment name (auto-populated from Sentry config if available)
   */
  environment?: string;
}

/**
 * The main Logger API interface
 */
export interface LoggerAPI {
  /**
   * Log a trace-level message (fine-grained debugging)
   */
  trace(message: string, attributes?: LogAttributes): void;

  /**
   * Log a debug-level message (development diagnostics)
   */
  debug(message: string, attributes?: LogAttributes): void;

  /**
   * Log an info-level message (normal operations, milestones)
   */
  info(message: string, attributes?: LogAttributes): void;

  /**
   * Log a warn-level message (potential issues, degraded state)
   */
  warn(message: string, attributes?: LogAttributes): void;

  /**
   * Log an error-level message (failures that need attention)
   */
  error(message: string, attributes?: LogAttributes): void;

  /**
   * Log a fatal-level message (critical failures, system down)
   */
  fatal(message: string, attributes?: LogAttributes): void;

  /**
   * Template literal function for parameterized messages
   * Parameters become searchable attributes automatically
   *
   * @example
   * logger.info(logger.fmt`User ${userId} purchased ${productName}`)
   */
  fmt: (strings: TemplateStringsArray, ...values: unknown[]) => string;

  /**
   * Flush all buffered logs
   */
  flush(): Promise<void>;

  /**
   * Set default attributes for all subsequent logs
   */
  setDefaultAttributes(attributes: LogAttributes): void;

  /**
   * Get the current buffer of logs
   */
  getBuffer(): LogRecord[];

  /**
   * Clear the log buffer
   */
  clearBuffer(): void;

  /**
   * Configure the logger options
   */
  configure(options: Partial<LoggerOptions>): void;
}

/**
 * Envelope item type for logs
 */
export type LogEnvelopeItemType = 'log';

/**
 * Log envelope item header
 */
export interface LogEnvelopeItemHeader {
  type: LogEnvelopeItemType;
  content_type?: string;
  length?: number;
}

/**
 * Log item in Sentry envelope format
 */
export interface LogEnvelopeItem {
  /**
   * Unix timestamp in seconds
   */
  timestamp: number;

  /**
   * Trace ID
   */
  trace_id?: string;

  /**
   * Span ID
   */
  span_id?: string;

  /**
   * Log severity level
   */
  level: LogLevel;

  /**
   * Log message body
   */
  body: string;

  /**
   * Structured attributes
   */
  attributes?: Record<string, unknown>;

  /**
   * Severity number (OTel compatible)
   */
  severity_number?: number;

  /**
   * Severity text (OTel compatible)
   */
  severity_text?: string;
}

/**
 * Batch of log items for envelope
 */
export interface LogBatch {
  /**
   * Array of log items
   */
  items: LogEnvelopeItem[];
}

/**
 * Console method names that can be intercepted
 */
export type ConsoleMethod = 'log' | 'debug' | 'info' | 'warn' | 'error';

/**
 * Options for console integration
 */
export interface ConsoleIntegrationOptions {
  /**
   * Console methods to intercept
   * @default ['log', 'warn', 'error']
   */
  levels?: ConsoleMethod[];

  /**
   * Whether to still call the original console method
   * @default true
   */
  passthrough?: boolean;

  /**
   * Prefix to add to intercepted log messages
   */
  prefix?: string;
}

/**
 * Parameterized string result from fmt template
 */
export interface ParameterizedLogMessage {
  /**
   * The formatted message string
   */
  __sentry_log_message__: string;

  /**
   * The raw message template
   */
  __sentry_template_string__: string;

  /**
   * The template parameter values
   */
  __sentry_template_values__: unknown[];
}

/**
 * Type guard for parameterized log messages
 */
export function isParameterizedLogMessage(
  value: unknown
): value is ParameterizedLogMessage {
  return (
    typeof value === 'object' &&
    value !== null &&
    '__sentry_log_message__' in value &&
    '__sentry_template_string__' in value &&
    '__sentry_template_values__' in value
  );
}

/**
 * Severity number mapping (OpenTelemetry compatible)
 */
export const SeverityNumbers: Record<LogLevel, number> = {
  trace: 1,
  debug: 5,
  info: 9,
  warn: 13,
  error: 17,
  fatal: 21,
};

/**
 * Map log levels to Sentry severity levels
 */
export const LogLevelToSeverity: Record<LogLevel, string> = {
  trace: 'debug',
  debug: 'debug',
  info: 'info',
  warn: 'warning',
  error: 'error',
  fatal: 'fatal',
};
