/**
 * Structured Logger Implementation
 *
 * Provides a Sentry-compatible logging API with:
 * - Six log levels (trace, debug, info, warn, error, fatal)
 * - Template literal support for parameterized messages
 * - Automatic trace correlation
 * - Buffering and batching
 * - beforeSendLog hook for filtering
 */

import type {
  LogLevel,
  LogRecord,
  LogAttributes,
  LoggerOptions,
  LoggerAPI,
  ParameterizedLogMessage,
} from './types';
import {
  LogLevelValues,
  SeverityNumbers,
  isParameterizedLogMessage,
} from './types';
import { generateEventId } from '../tracing/idGenerator';

// Import trace context for span correlation
let getActiveSpan: (() => { spanId: string; traceId: string } | undefined) | undefined;

// Dynamic import to avoid circular dependencies
try {
  const tracing = require('../tracing/context');
  getActiveSpan = () => {
    const span = tracing.getActiveSpan?.();
    if (span) {
      return {
        spanId: span.spanId,
        traceId: span.traceId,
      };
    }
    return undefined;
  };
} catch {
  // Tracing module not available
  getActiveSpan = undefined;
}

/**
 * Default logger options
 */
const DEFAULT_OPTIONS: Required<LoggerOptions> = {
  enabled: true,
  minLevel: 'trace',
  maxBufferSize: 100,
  flushInterval: 5000,
  beforeSendLog: (log) => log,
  defaultAttributes: {},
  release: '',
  environment: '',
};

/**
 * Structured Logger class
 */
export class StructuredLogger implements LoggerAPI {
  private _options: Required<LoggerOptions>;
  private _buffer: LogRecord[] = [];
  private _flushTimer: ReturnType<typeof setInterval> | null = null;
  private _defaultAttributes: LogAttributes = {};
  private _onFlush?: (logs: LogRecord[]) => void | Promise<void>;

  constructor(options: LoggerOptions = {}) {
    this._options = { ...DEFAULT_OPTIONS, ...options };
    this._defaultAttributes = { ...this._options.defaultAttributes };

    // Start flush timer if interval is set
    if (this._options.flushInterval > 0) {
      this._startFlushTimer();
    }
  }

  // ============================================
  // Log Level Methods
  // ============================================

  /**
   * Log a trace-level message (fine-grained debugging)
   */
  trace(message: string, attributes?: LogAttributes): void {
    this._log('trace', message, attributes);
  }

  /**
   * Log a debug-level message (development diagnostics)
   */
  debug(message: string, attributes?: LogAttributes): void {
    this._log('debug', message, attributes);
  }

  /**
   * Log an info-level message (normal operations, milestones)
   */
  info(message: string, attributes?: LogAttributes): void {
    this._log('info', message, attributes);
  }

  /**
   * Log a warn-level message (potential issues, degraded state)
   */
  warn(message: string, attributes?: LogAttributes): void {
    this._log('warn', message, attributes);
  }

  /**
   * Log an error-level message (failures that need attention)
   */
  error(message: string, attributes?: LogAttributes): void {
    this._log('error', message, attributes);
  }

  /**
   * Log a fatal-level message (critical failures, system down)
   */
  fatal(message: string, attributes?: LogAttributes): void {
    this._log('fatal', message, attributes);
  }

  // ============================================
  // Template Literal Support
  // ============================================

  /**
   * Template literal function for parameterized messages
   *
   * Parameters become searchable attributes automatically.
   * The template and each parameter are stored as discrete attributes.
   *
   * @example
   * logger.info(logger.fmt`User ${userId} purchased ${productName}`)
   */
  fmt = (strings: TemplateStringsArray, ...values: unknown[]): string => {
    // Build the formatted message
    let message = '';
    for (let i = 0; i < strings.length; i++) {
      message += strings[i];
      if (i < values.length) {
        message += String(values[i]);
      }
    }

    // Build the template string (with placeholders)
    let template = '';
    for (let i = 0; i < strings.length; i++) {
      template += strings[i];
      if (i < values.length) {
        template += `{${i}}`;
      }
    }

    // Create a special object that carries both the message and metadata
    const result: ParameterizedLogMessage = {
      __sentry_log_message__: message,
      __sentry_template_string__: template,
      __sentry_template_values__: values,
    };

    // Return as string (with hidden properties)
    // We use a trick where toString returns the formatted message
    // but the object still carries the metadata
    const str = new String(message) as string & ParameterizedLogMessage;
    str.__sentry_log_message__ = message;
    str.__sentry_template_string__ = template;
    str.__sentry_template_values__ = values;

    return str;
  };

  // ============================================
  // Buffer Management
  // ============================================

  /**
   * Flush all buffered logs
   */
  async flush(): Promise<void> {
    if (this._buffer.length === 0) {
      return;
    }

    const logs = [...this._buffer];
    this._buffer = [];

    if (this._onFlush) {
      await this._onFlush(logs);
    }
  }

  /**
   * Get the current buffer of logs
   */
  getBuffer(): LogRecord[] {
    return [...this._buffer];
  }

  /**
   * Clear the log buffer
   */
  clearBuffer(): void {
    this._buffer = [];
  }

  // ============================================
  // Configuration
  // ============================================

  /**
   * Configure the logger options
   */
  configure(options: Partial<LoggerOptions>): void {
    this._options = { ...this._options, ...options };

    if (options.defaultAttributes) {
      this._defaultAttributes = {
        ...this._defaultAttributes,
        ...options.defaultAttributes,
      };
    }

    // Restart flush timer if interval changed
    if (options.flushInterval !== undefined) {
      this._stopFlushTimer();
      if (options.flushInterval > 0) {
        this._startFlushTimer();
      }
    }
  }

  /**
   * Set default attributes for all subsequent logs
   */
  setDefaultAttributes(attributes: LogAttributes): void {
    this._defaultAttributes = { ...this._defaultAttributes, ...attributes };
  }

  /**
   * Set the flush callback
   */
  setOnFlush(callback: (logs: LogRecord[]) => void | Promise<void>): void {
    this._onFlush = callback;
  }

  /**
   * Destroy the logger and clean up resources
   */
  destroy(): void {
    this._stopFlushTimer();
    this._buffer = [];
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * Internal log method
   */
  private _log(
    level: LogLevel,
    message: string | ParameterizedLogMessage,
    attributes?: LogAttributes
  ): void {
    // Check if enabled
    if (!this._options.enabled) {
      return;
    }

    // Check minimum level
    if (LogLevelValues[level] < LogLevelValues[this._options.minLevel]) {
      return;
    }

    // Extract message and template info
    let finalMessage: string;
    let messageTemplate: string | undefined;
    let messageParams: unknown[] | undefined;

    if (isParameterizedLogMessage(message)) {
      finalMessage = message.__sentry_log_message__;
      messageTemplate = message.__sentry_template_string__;
      messageParams = message.__sentry_template_values__;
    } else if (typeof message === 'object' && message !== null) {
      // Check if it's a String object with metadata
      const msgObj = message as unknown as ParameterizedLogMessage;
      if (msgObj.__sentry_log_message__) {
        finalMessage = msgObj.__sentry_log_message__;
        messageTemplate = msgObj.__sentry_template_string__;
        messageParams = msgObj.__sentry_template_values__;
      } else {
        finalMessage = String(message);
      }
    } else {
      finalMessage = String(message);
    }

    // Build attributes
    const finalAttributes: LogAttributes = {
      ...this._defaultAttributes,
      ...attributes,
    };

    // Add environment and release if available
    if (this._options.environment) {
      finalAttributes.environment = this._options.environment;
    }
    if (this._options.release) {
      finalAttributes.release = this._options.release;
    }

    // Add template attributes if present
    if (messageTemplate) {
      finalAttributes['message.template'] = messageTemplate;
      if (messageParams) {
        messageParams.forEach((param, index) => {
          const value = param;
          if (
            typeof value === 'string' ||
            typeof value === 'number' ||
            typeof value === 'boolean'
          ) {
            finalAttributes[`message.parameter.${index}`] = value;
          } else {
            finalAttributes[`message.parameter.${index}`] = String(value);
          }
        });
      }
    }

    // Get trace context if available
    let traceId: string | undefined;
    let spanId: string | undefined;

    if (getActiveSpan) {
      const span = getActiveSpan();
      if (span) {
        traceId = span.traceId;
        spanId = span.spanId;
        finalAttributes['sentry.trace.parent_span_id'] = spanId;
      }
    }

    // Create log record
    const logRecord: LogRecord = {
      level,
      message: finalMessage,
      attributes: finalAttributes,
      timestamp: Date.now() / 1000, // Unix timestamp in seconds
      traceId,
      spanId,
      logId: generateEventId(),
      messageTemplate,
      messageParams,
      severityNumber: SeverityNumbers[level],
      severityText: level.toUpperCase(),
    };

    // Apply beforeSendLog hook
    const processedLog = this._options.beforeSendLog(logRecord);
    if (!processedLog) {
      // Log was dropped
      return;
    }

    // Add to buffer
    this._buffer.push(processedLog);

    // Check if buffer is full
    if (this._buffer.length >= this._options.maxBufferSize) {
      this.flush().catch(() => {
        // Ignore flush errors
      });
    }
  }

  /**
   * Start the flush timer
   */
  private _startFlushTimer(): void {
    if (this._flushTimer) {
      return;
    }

    this._flushTimer = setInterval(() => {
      this.flush().catch(() => {
        // Ignore flush errors
      });
    }, this._options.flushInterval);

    // Unref the timer so it doesn't keep the process alive
    if (typeof this._flushTimer === 'object' && 'unref' in this._flushTimer) {
      (this._flushTimer as NodeJS.Timeout).unref();
    }
  }

  /**
   * Stop the flush timer
   */
  private _stopFlushTimer(): void {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
  }
}

// ============================================
// Singleton Instance
// ============================================

let _loggerInstance: StructuredLogger | undefined;

/**
 * Get the singleton logger instance
 */
export function getLogger(): StructuredLogger {
  if (!_loggerInstance) {
    _loggerInstance = new StructuredLogger();
  }
  return _loggerInstance;
}

/**
 * Initialize the logger with options
 */
export function initLogger(options: LoggerOptions = {}): StructuredLogger {
  if (_loggerInstance) {
    _loggerInstance.destroy();
  }
  _loggerInstance = new StructuredLogger(options);
  return _loggerInstance;
}

/**
 * Reset the logger instance (for testing)
 */
export function resetLogger(): void {
  if (_loggerInstance) {
    _loggerInstance.destroy();
    _loggerInstance = undefined;
  }
}

// ============================================
// Convenience exports matching Sentry.logger API
// ============================================

/**
 * Default logger instance with Sentry-compatible API
 */
export const logger: LoggerAPI = {
  trace: (message: string, attributes?: LogAttributes) =>
    getLogger().trace(message, attributes),
  debug: (message: string, attributes?: LogAttributes) =>
    getLogger().debug(message, attributes),
  info: (message: string, attributes?: LogAttributes) =>
    getLogger().info(message, attributes),
  warn: (message: string, attributes?: LogAttributes) =>
    getLogger().warn(message, attributes),
  error: (message: string, attributes?: LogAttributes) =>
    getLogger().error(message, attributes),
  fatal: (message: string, attributes?: LogAttributes) =>
    getLogger().fatal(message, attributes),
  fmt: (strings: TemplateStringsArray, ...values: unknown[]) =>
    getLogger().fmt(strings, ...values),
  flush: () => getLogger().flush(),
  setDefaultAttributes: (attributes: LogAttributes) =>
    getLogger().setDefaultAttributes(attributes),
  getBuffer: () => getLogger().getBuffer(),
  clearBuffer: () => getLogger().clearBuffer(),
  configure: (options: Partial<LoggerOptions>) => getLogger().configure(options),
};
