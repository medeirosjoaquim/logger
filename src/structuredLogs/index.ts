/**
 * Structured Logs API
 *
 * Provides a Sentry-compatible logging system with:
 * - Six log levels (trace, debug, info, warn, error, fatal)
 * - Template literal support for parameterized messages
 * - Automatic trace correlation
 * - Console method interception
 * - Buffering and batching for transport
 *
 * @example
 * ```typescript
 * import { logger } from '@universal-logger/structuredLogs';
 *
 * // Simple logging
 * logger.info('User logged in', { userId: '123' });
 *
 * // Parameterized messages
 * const userId = '123';
 * const action = 'purchase';
 * logger.info(logger.fmt`User ${userId} performed ${action}`);
 *
 * // Configure logging
 * logger.configure({
 *   minLevel: 'info',
 *   beforeSendLog: (log) => {
 *     if (log.attributes?.password) {
 *       delete log.attributes.password;
 *     }
 *     return log;
 *   }
 * });
 * ```
 *
 * @packageDocumentation
 */

// ============================================
// Types
// ============================================
export type {
  LogLevel,
  LogAttributes,
  LogRecord,
  LoggerOptions,
  LoggerAPI,
  LogEnvelopeItemType,
  LogEnvelopeItemHeader,
  LogEnvelopeItem,
  LogBatch,
  ConsoleMethod,
  ConsoleIntegrationOptions,
  ParameterizedLogMessage,
} from './types';

export {
  LogLevelValues,
  SeverityNumbers,
  LogLevelToSeverity,
  isParameterizedLogMessage,
} from './types';

// ============================================
// Logger
// ============================================
export {
  StructuredLogger,
  getLogger,
  initLogger,
  resetLogger,
  logger,
} from './logger';

// ============================================
// Envelope
// ============================================
export type {
  LogEnvelopeHeaders,
  LogEnvelope,
  LogEnvelopeOptions,
} from './envelope';

export {
  logRecordToEnvelopeItem,
  convertAttributesToEnvelopeFormat,
  createLogBatch,
  createLogEnvelope,
  serializeLogEnvelope,
  serializeLogEnvelopeToBytes,
  parseLogEnvelope,
  getLogEnvelopeSize,
  splitIntoEnvelopes,
  mergeLogEnvelopes,
} from './envelope';

// ============================================
// Console Integration
// ============================================
export {
  installConsoleIntegration,
  uninstallConsoleIntegration,
  isConsoleIntegrationActive,
  updateConsoleIntegrationOptions,
  consoleLoggingIntegration,
  withoutConsoleCapture,
  createConsoleProxy,
} from './console';
