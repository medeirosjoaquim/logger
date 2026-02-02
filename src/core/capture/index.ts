/**
 * Capture APIs
 *
 * Functions for capturing exceptions, messages, and events.
 */

// Exception capture
export {
  captureException,
  normalizeException,
  exceptionFromError,
  parseStackTrace,
  applyCaptureContext,
  applyScopeToEvent,
  isError,
  isPlainErrorMessage,
  extractErrorCause,
  exceptionsFromErrorWithCause,
  type CaptureExceptionOptions,
} from './exception';

// Message capture
export {
  captureMessage,
  captureMessageWithOptions,
  captureParameterizedMessage,
  formatMessage,
  messageEventFromConsoleArgs,
  type CaptureMessageOptions,
} from './message';

// Event capture
export {
  captureEvent,
  captureEventWithScope,
  eventHasException,
  eventHasMessage,
  getEventType,
  createErrorEvent,
  createMessageEvent,
  mergeEvents,
  prepareEventForSending,
} from './event';

// Stack parsing
export {
  parseStack,
  chromeStackParser,
  firefoxStackParser,
  safariStackParser,
  extractFilename,
  normalizeUrl,
  isInApp,
  createSyntheticStacktrace,
  type StackParser,
} from './stackParser';

// Fingerprinting
export {
  generateFingerprint,
  applyFingerprintRules,
  mergeFingerprints,
  DEFAULT_FINGERPRINT,
} from './fingerprint';
