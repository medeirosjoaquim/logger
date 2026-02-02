/**
 * Exception Capture API
 *
 * Provides functions to capture exceptions and convert them to Sentry events.
 */

import type {
  CaptureContext,
  Event,
  EventHint,
  Exception,
  Mechanism,
  SeverityLevel,
  Stacktrace,
} from '../../types/sentry';
import type { ScopeData } from '../../types/scope';
import { parseStack, createSyntheticStacktrace } from './stackParser';
import { generateFingerprint } from './fingerprint';

/**
 * Options for capturing exceptions
 */
export interface CaptureExceptionOptions {
  /**
   * Additional context to apply to the event
   */
  captureContext?: CaptureContext;

  /**
   * The mechanism that captured this exception
   */
  mechanism?: Mechanism;

  /**
   * Whether to attach a stack trace if one is not available
   */
  attachStacktrace?: boolean;

  /**
   * Hint data for event processors
   */
  hint?: EventHint;
}

/**
 * Generate a UUID v4 without dashes (Sentry event ID format)
 */
function generateEventId(): string {
  // Use crypto.randomUUID if available
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  // Fallback to manual generation
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort: Math.random (not cryptographically secure)
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version (4) and variant (RFC 4122)
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  // Convert to hex string without dashes
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Capture an exception and return the event ID
 *
 * This function normalizes the exception, extracts stack traces,
 * and builds a Sentry-compatible event.
 *
 * @param exception - The exception to capture (can be any type)
 * @param options - Capture options
 * @returns The event ID
 */
export function captureException(
  exception: unknown,
  options: CaptureExceptionOptions = {}
): { eventId: string; event: Event } {
  const { captureContext, mechanism, attachStacktrace = true } = options;

  // Generate event ID
  const eventId = generateEventId();

  // Normalize the exception to an Error if needed
  const normalizedError = normalizeException(exception);

  // Extract exception data
  const exceptionData = exceptionFromError(normalizedError, mechanism);

  // If no stack trace and attachStacktrace is true, create a synthetic one
  if (!exceptionData.stacktrace && attachStacktrace) {
    const syntheticFrames = createSyntheticStacktrace(2);
    if (syntheticFrames && syntheticFrames.length > 0) {
      exceptionData.stacktrace = { frames: syntheticFrames };
      // Mark the mechanism as synthetic
      if (!exceptionData.mechanism) {
        exceptionData.mechanism = {
          type: 'generic',
          handled: true,
          synthetic: true,
        };
      } else {
        exceptionData.mechanism.synthetic = true;
      }
    }
  }

  // Build the event
  const event: Event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error' as SeverityLevel,
    exception: {
      values: [exceptionData],
    },
  };

  // Generate fingerprint
  event.fingerprint = generateFingerprint(event);

  // Apply capture context if provided
  if (captureContext) {
    applyCaptureContext(event, captureContext);
  }

  return { eventId, event };
}

/**
 * Normalize any value to an Error object
 */
export function normalizeException(exception: unknown): Error {
  if (exception instanceof Error) {
    return exception;
  }

  if (typeof exception === 'string') {
    return new Error(exception);
  }

  if (exception === null) {
    return new Error('null');
  }

  if (exception === undefined) {
    return new Error('undefined');
  }

  if (typeof exception === 'object') {
    // Try to extract meaningful information
    const obj = exception as Record<string, unknown>;

    // Check for common error-like properties
    const message =
      obj.message ||
      obj.error ||
      obj.reason ||
      obj.description ||
      JSON.stringify(exception);

    const error = new Error(String(message));

    // Copy over name if available
    if (obj.name) {
      error.name = String(obj.name);
    }

    // Copy over stack if available
    if (obj.stack && typeof obj.stack === 'string') {
      error.stack = obj.stack;
    }

    return error;
  }

  // For primitives, convert to string
  return new Error(String(exception));
}

/**
 * Extract exception data from an Error object
 */
export function exceptionFromError(
  error: Error,
  mechanism?: Mechanism
): Exception {
  const exception: Exception = {
    type: error.name || 'Error',
    value: error.message || String(error),
  };

  // Parse stack trace if available
  if (error.stack) {
    const frames = parseStackTrace(error.stack);
    if (frames && frames.length > 0) {
      exception.stacktrace = { frames };
    }
  }

  // Add mechanism
  exception.mechanism = mechanism || {
    type: 'generic',
    handled: true,
  };

  // Extract module from Error subclass
  if (error.constructor && error.constructor.name !== 'Error') {
    exception.module = error.constructor.name;
  }

  return exception;
}

/**
 * Parse a stack trace string into frames
 */
export function parseStackTrace(stack: string): Stacktrace['frames'] {
  return parseStack(stack);
}

/**
 * Apply capture context to an event
 */
export function applyCaptureContext(
  event: Event,
  context: CaptureContext
): void {
  if (typeof context === 'function') {
    // Context is a function that modifies scope data
    // CaptureContext callback uses ScopeContext which has 'extra', not 'extras'
    const scopeContextData = {
      tags: { ...(event.tags as Record<string, string>) },
      extra: { ...event.extra },
      contexts: { ...event.contexts },
      fingerprint: [...(event.fingerprint || [])],
      user: event.user ? { ...event.user } : undefined,
      level: event.level,
    };

    // Call the function to modify scope data
    const modified = context(scopeContextData as unknown as ScopeData);

    // Apply modified data back to event
    if (modified.tags) {
      event.tags = { ...event.tags, ...modified.tags };
    }
    // Handle both 'extra' (ScopeContext) and 'extras' (ScopeData) for compatibility
    const modifiedExtra = (modified as Record<string, unknown>).extra ?? (modified as ScopeData).extras;
    if (modifiedExtra && typeof modifiedExtra === 'object' && Object.keys(modifiedExtra).length > 0) {
      event.extra = { ...event.extra, ...modifiedExtra };
    }
    if (modified.contexts) {
      event.contexts = { ...event.contexts, ...modified.contexts };
    }
    if (modified.user) {
      event.user = modified.user;
    }
    if (modified.level) {
      event.level = modified.level;
    }
    if (modified.fingerprint && modified.fingerprint.length > 0) {
      event.fingerprint = modified.fingerprint;
    }
    if (modified.transactionName) {
      event.transaction = modified.transactionName;
    }
  } else {
    // Context is a partial scope context object
    if (context.tags) {
      event.tags = { ...event.tags, ...context.tags };
    }
    if (context.extra) {
      event.extra = { ...event.extra, ...context.extra };
    }
    if (context.contexts) {
      event.contexts = { ...event.contexts, ...context.contexts };
    }
    if (context.user) {
      event.user = { ...event.user, ...context.user };
    }
    if (context.level) {
      event.level = context.level;
    }
    if (context.fingerprint && context.fingerprint.length > 0) {
      event.fingerprint = context.fingerprint;
    }
    if (context.transactionName) {
      event.transaction = context.transactionName;
    }
  }
}

/**
 * Apply scope data to an event
 */
export function applyScopeToEvent(event: Event, scope: ScopeData): Event {
  // Apply user
  if (scope.user) {
    event.user = { ...event.user, ...scope.user };
  }

  // Apply tags
  if (scope.tags && Object.keys(scope.tags).length > 0) {
    event.tags = { ...scope.tags, ...event.tags };
  }

  // Apply extras
  if (scope.extras && Object.keys(scope.extras).length > 0) {
    event.extra = { ...scope.extras, ...event.extra };
  }

  // Apply contexts
  if (scope.contexts && Object.keys(scope.contexts).length > 0) {
    event.contexts = { ...scope.contexts, ...event.contexts };
  }

  // Apply level if not already set
  if (scope.level && !event.level) {
    event.level = scope.level;
  }

  // Apply transaction name if not already set
  if (scope.transactionName && !event.transaction) {
    event.transaction = scope.transactionName;
  }

  // Apply fingerprint
  if (scope.fingerprint && scope.fingerprint.length > 0) {
    // Merge with existing fingerprint, scope takes precedence
    event.fingerprint = [
      ...scope.fingerprint,
      ...(event.fingerprint || []).filter(
        (f) => !scope.fingerprint.includes(f)
      ),
    ];
  }

  // Apply breadcrumbs
  if (scope.breadcrumbs && scope.breadcrumbs.length > 0) {
    event.breadcrumbs = [...scope.breadcrumbs];
  }

  // Apply request data
  if (scope.request) {
    event.request = { ...scope.request };
  }

  return event;
}

/**
 * Check if a value is an Error or Error-like object
 */
export function isError(value: unknown): value is Error {
  if (value instanceof Error) {
    return true;
  }

  if (typeof value !== 'object' || value === null) {
    return false;
  }

  const obj = value as Record<string, unknown>;
  return (
    typeof obj.name === 'string' &&
    typeof obj.message === 'string' &&
    (typeof obj.stack === 'undefined' || typeof obj.stack === 'string')
  );
}

/**
 * Check if a value is a plain error message string
 */
export function isPlainErrorMessage(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}

/**
 * Extract the error cause chain from an error
 */
export function extractErrorCause(error: Error): Error[] {
  const chain: Error[] = [error];
  let current: Error & { cause?: unknown } = error;

  // Follow the cause chain (ES2022+)
  while (current.cause instanceof Error) {
    chain.push(current.cause);
    current = current.cause;

    // Prevent infinite loops
    if (chain.length > 10) {
      break;
    }
  }

  return chain;
}

/**
 * Build exception values from an error with cause chain
 */
export function exceptionsFromErrorWithCause(
  error: Error,
  mechanism?: Mechanism
): Exception[] {
  const chain = extractErrorCause(error);
  const exceptions: Exception[] = [];

  for (let i = 0; i < chain.length; i++) {
    const err = chain[i];
    const exc = exceptionFromError(err, i === 0 ? mechanism : undefined);

    // Add exception group metadata
    if (chain.length > 1) {
      exc.mechanism = exc.mechanism || { type: 'generic', handled: true };
      exc.mechanism.exception_id = i;
      if (i > 0) {
        exc.mechanism.parent_id = 0;
      }
    }

    exceptions.push(exc);
  }

  // Reverse to get newest-to-oldest order (Sentry convention)
  return exceptions.reverse();
}
