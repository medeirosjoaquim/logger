/**
 * Core Module
 *
 * Main exports for the Universal Logger core functionality.
 * Provides Sentry-compatible API with singleton access.
 */

// ============================================
// Logger
// ============================================

export {
  UniversalLogger,
  type UniversalLoggerConfig,
} from './logger.js';

// ============================================
// Client
// ============================================

export {
  UniversalClient,
  createClient,
} from './client.js';

// ============================================
// Pipeline
// ============================================

export {
  EventPipeline,
  createDefaultPipeline,
  type PipelineOptions,
  type PipelineResult,
} from './pipeline.js';

// ============================================
// Utils
// ============================================

export {
  generateEventId,
  generateSpanId,
  generateTraceId,
  uuid4,
  timestampInSeconds,
  dateTimestampInSeconds,
  timestampToISOString,
  secondsToISOString,
  normalize,
  truncate,
  isError as utilsIsError,
  isPlainObject,
  isPrimitive,
  isThenable,
  safeStringify,
  resolveAfterTimeout,
  rejectAfterTimeout,
  promiseWithTimeout,
  safeExecute,
  debounce,
  deepClone,
  deepMerge,
  ensureError,
} from './utils.js';

// ============================================
// DSN
// ============================================

export {
  parseDsn,
  dsnToString,
  getBaseApiUrl,
  getStoreEndpoint,
  getEnvelopeEndpoint,
  getReportEndpoint,
  getSentryAuthHeader,
  isValidDsn,
  getProjectIdFromDsn,
  getPublicKeyFromDsn,
  DsnParseError,
} from './dsn.js';

// ============================================
// Event Builder
// ============================================

export {
  eventFromException,
  eventFromMessage,
  exceptionFromError as eventBuilderExceptionFromError,
  parseStacktrace as eventBuilderParseStacktrace,
  parseStackFrames,
  parseStackFrame,
  addFingerprintToEvent,
  addTagsToEvent,
  addExtraToEvent,
  finalizeEvent,
  createMinimalEvent,
} from './eventbuilder.js';

// ============================================
// Capture APIs
// ============================================

export {
  // Exception capture
  captureException,
  normalizeException,
  exceptionFromError,
  parseStackTrace,
  applyCaptureContext,
  applyScopeToEvent,
  isError as captureIsError,
  isPlainErrorMessage,
  extractErrorCause,
  exceptionsFromErrorWithCause,
  type CaptureExceptionOptions,

  // Message capture
  captureMessage,
  captureMessageWithOptions,
  captureParameterizedMessage,
  formatMessage,
  messageEventFromConsoleArgs,
  type CaptureMessageOptions,

  // Event capture
  captureEvent,
  captureEventWithScope,
  eventHasException,
  eventHasMessage,
  getEventType,
  createErrorEvent,
  createMessageEvent,
  mergeEvents,
  prepareEventForSending,

  // Stack parsing
  parseStack,
  chromeStackParser,
  firefoxStackParser,
  safariStackParser,
  extractFilename,
  normalizeUrl,
  isInApp,
  createSyntheticStacktrace,
  type StackParser,

  // Fingerprinting
  generateFingerprint,
  applyFingerprintRules,
  mergeFingerprints,
  DEFAULT_FINGERPRINT,
} from './capture/index.js';

// ============================================
// Enrichment APIs
// ============================================

export {
  // Tag management
  TAG_KEY_MAX_LENGTH,
  TAG_VALUE_MAX_LENGTH,
  TAG_KEY_PATTERN,
  validateTagKey,
  validateTagValue,
  isReservedTag,
  sanitizeTag,
  setTag as setTagOnScope,
  setTags as setTagsOnScope,
  removeTag,
  clearTags,
  getTag,
  getTags,
  mergeTags,
  serializeTags,

  // Context management
  setContext as setContextOnScope,
  normalizeContext,
  getContext,
  getContexts,
  clearContexts,
  mergeContexts,
  setBrowserContext,
  setDeviceContext,
  setOSContext,

  // Extra data management
  setExtra as setExtraOnScope,
  setExtras as setExtrasOnScope,
  normalizeExtra,
  removeExtra,
  clearExtras,
  getExtra,
  getExtras,
  mergeExtras,

  // User management
  AUTO_IP_ADDRESS,
  setUser as setUserOnScope,
  getUser,
  clearUser,
  updateUser,
  setUserId,
  setUserEmail,
  setUserIpAddress,
  setAutoIpAddress,
  resolveUserIpAddress,
  mergeUsers,
  hasUserIdentity,
  anonymizeUser,
} from './enrichment/index.js';

// ============================================
// Breadcrumb APIs
// ============================================

export {
  // Breadcrumb management
  addBreadcrumb as addBreadcrumbToScope,
  validateBreadcrumb,
  createBreadcrumb,
  createNavigationBreadcrumb,
  createHttpBreadcrumb,
  createUIBreadcrumb,
  createConsoleBreadcrumb,
  createQueryBreadcrumb,
  clearBreadcrumbs,
  getBreadcrumbs,
  getRecentBreadcrumbs,
  filterBreadcrumbsByType,
  filterBreadcrumbsByCategory,
  filterBreadcrumbsByLevel,
  mergeBreadcrumbs,
  DEFAULT_MAX_BREADCRUMBS,
  type BreadcrumbType,
  type BeforeBreadcrumbCallback,
  type AddBreadcrumbOptions,

  // Automatic breadcrumb collection
  setupAutoBreadcrumbs,
  setupConsoleBreadcrumbs,
  setupClickBreadcrumbs,
  setupNavigationBreadcrumbs,
  setupFetchBreadcrumbs,
  setupXHRBreadcrumbs,
  instrumentConsole,
  instrumentDOM,
  instrumentHistory,
  instrumentFetch,
  instrumentXHR,
  instrumentForms,
  instrumentFocus,
  type AddBreadcrumbFn,
  type CleanupFn,
  type AutoBreadcrumbOptions,
} from './breadcrumbs/index.js';

// ============================================
// Singleton Exports
// ============================================

import { UniversalLogger } from './logger.js';

const logger = UniversalLogger.getInstance();

/**
 * Initialize the logger
 */
export const init = logger.init.bind(logger);

/**
 * Get the current client
 */
export const getClient = () => logger.getClient();

/**
 * Get the current scope
 */
export const getCurrentScope = () => logger.getCurrentScope();

/**
 * Get the isolation scope
 */
export const getIsolationScope = () => logger.getIsolationScope();

/**
 * Get the global scope
 */
export const getGlobalScope = () => logger.getGlobalScope();

/**
 * Check if the logger is enabled
 */
export const isEnabled = () => logger.isEnabled();

/**
 * Get the last event ID
 */
export const lastEventId = () => logger.lastEventId();

/**
 * Set a tag on the current scope
 */
export const setTag = logger.setTag.bind(logger);

/**
 * Set multiple tags on the current scope
 */
export const setTags = logger.setTags.bind(logger);

/**
 * Set a context on the current scope
 */
export const setContext = logger.setContext.bind(logger);

/**
 * Set an extra on the current scope
 */
export const setExtra = logger.setExtra.bind(logger);

/**
 * Set multiple extras on the current scope
 */
export const setExtras = logger.setExtras.bind(logger);

/**
 * Set the user on the current scope
 */
export const setUser = logger.setUser.bind(logger);

/**
 * Add a breadcrumb to the current scope
 */
export const addBreadcrumb = logger.addBreadcrumb.bind(logger);

/**
 * Run a callback with a new scope
 */
export const withScope = logger.withScope.bind(logger);

/**
 * Run a callback with a new isolation scope
 */
export const withIsolationScope = logger.withIsolationScope.bind(logger);

/**
 * Flush pending events
 */
export const flush = logger.flush.bind(logger);

/**
 * Close the logger
 */
export const close = logger.close.bind(logger);

/**
 * Add an event processor
 */
export const addEventProcessor = logger.addEventProcessor.bind(logger);

/**
 * Add an integration
 */
export const addIntegration = logger.addIntegration.bind(logger);

/**
 * Capture an exception (singleton binding)
 *
 * Note: This is exported as a convenience. The capture APIs from
 * ./capture are more flexible but return {eventId, event} rather
 * than just the eventId.
 */
export const captureExceptionSingleton = logger.captureException.bind(logger);

/**
 * Capture a message (singleton binding)
 */
export const captureMessageSingleton = logger.captureMessage.bind(logger);

/**
 * Capture an event (singleton binding)
 */
export const captureEventSingleton = logger.captureEvent.bind(logger);

/**
 * Get locally stored logs
 */
export const getLocalLogs = logger.getLocalLogs.bind(logger);

/**
 * Get locally stored Sentry events
 */
export const getSentryEvents = logger.getSentryEvents.bind(logger);

/**
 * Clear local data
 */
export const clearLocalData = logger.clearLocalData.bind(logger);

/**
 * Export logs to a string format
 */
export const exportLogs = logger.exportLogs.bind(logger);
