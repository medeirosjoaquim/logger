/**
 * Event Builder
 *
 * Provides functions for constructing Sentry-compatible events from
 * exceptions, messages, and raw data. Handles stack trace parsing
 * and event normalization.
 */

import type { Event, EventHint, Exception, Mechanism, SeverityLevel, StackFrame, Stacktrace } from '../types';
import { generateEventId, timestampInSeconds, normalize, isError, truncate } from './utils';

/**
 * SDK information for event metadata.
 */
const SDK_INFO = {
  name: 'universal-logger',
  version: '0.1.0',
};

/**
 * Creates an event from an exception.
 *
 * @param exception - The exception to create an event from
 * @param hint - Optional event hint with additional context
 * @param attachStacktrace - Whether to attach a stack trace (default: true)
 * @returns Sentry-compatible event
 *
 * @example
 * ```typescript
 * try {
 *   throw new Error('Something went wrong');
 * } catch (e) {
 *   const event = eventFromException(e);
 * }
 * ```
 */
export function eventFromException(
  exception: unknown,
  hint?: EventHint,
  attachStacktrace: boolean = true
): Event {
  const event: Event = {
    event_id: hint?.event_id || generateEventId(),
    timestamp: timestampInSeconds(),
    platform: 'javascript',
    level: 'error',
    sdk: SDK_INFO,
  };

  const exceptionValue = exceptionFromError(exception, attachStacktrace);
  event.exception = {
    values: [exceptionValue],
  };

  // Apply mechanism from hint if provided
  if (hint?.mechanism && exceptionValue.mechanism) {
    exceptionValue.mechanism = {
      ...exceptionValue.mechanism,
      ...hint.mechanism,
    };
  }

  return event;
}

/**
 * Creates an event from a message.
 *
 * @param message - The message to create an event from
 * @param level - Severity level (default: 'info')
 * @param hint - Optional event hint
 * @param attachStacktrace - Whether to attach a stack trace (default: false)
 * @returns Sentry-compatible event
 *
 * @example
 * ```typescript
 * const event = eventFromMessage('User logged in', 'info');
 * ```
 */
export function eventFromMessage(
  message: string,
  level: SeverityLevel = 'info',
  hint?: EventHint,
  attachStacktrace: boolean = false
): Event {
  const event: Event = {
    event_id: hint?.event_id || generateEventId(),
    timestamp: timestampInSeconds(),
    platform: 'javascript',
    level,
    message,
    sdk: SDK_INFO,
  };

  if (attachStacktrace) {
    // Create a synthetic exception for the stack trace
    const syntheticError = hint?.syntheticException || new Error(message);
    const stacktrace = parseStacktrace(syntheticError);

    if (stacktrace.frames && stacktrace.frames.length > 0) {
      event.exception = {
        values: [
          {
            type: 'Message',
            value: message,
            stacktrace,
            mechanism: {
              type: 'generic',
              handled: true,
              synthetic: true,
            },
          },
        ],
      };
    }
  }

  return event;
}

/**
 * Creates an Exception object from an error value.
 *
 * @param exception - The exception value
 * @param attachStacktrace - Whether to parse and attach stack trace
 * @returns Exception object
 */
export function exceptionFromError(
  exception: unknown,
  attachStacktrace: boolean = true
): Exception {
  let error: Error;
  let synthetic = false;

  if (isError(exception)) {
    error = exception;
  } else if (typeof exception === 'string') {
    error = new Error(exception);
    synthetic = true;
  } else {
    // Create a synthetic error from the unknown value
    const message = extractMessage(exception);
    error = new Error(message);
    synthetic = true;
  }

  const exceptionValue: Exception = {
    type: error.name || 'Error',
    value: error.message || 'Unknown error',
    mechanism: {
      type: 'generic',
      handled: true,
      synthetic,
    },
  };

  if (attachStacktrace) {
    const stacktrace = parseStacktrace(error);
    if (stacktrace.frames && stacktrace.frames.length > 0) {
      exceptionValue.stacktrace = stacktrace;
    }
  }

  return exceptionValue;
}

/**
 * Parses a stack trace from an Error object.
 *
 * @param error - The error with a stack trace
 * @returns Parsed stacktrace object
 *
 * @example
 * ```typescript
 * const error = new Error('test');
 * const stacktrace = parseStacktrace(error);
 * ```
 */
export function parseStacktrace(error: Error): Stacktrace {
  const stack = error.stack;

  if (!stack) {
    return { frames: [] };
  }

  const frames = parseStackFrames(stack);

  // Sentry expects frames in oldest-to-newest order
  return {
    frames: frames.reverse(),
  };
}

/**
 * Parses stack frames from a stack string.
 *
 * @param stack - The stack trace string
 * @returns Array of stack frames
 */
export function parseStackFrames(stack: string): StackFrame[] {
  const lines = stack.split('\n');
  const frames: StackFrame[] = [];

  for (const line of lines) {
    const frame = parseStackFrame(line);
    if (frame) {
      frames.push(frame);
    }
  }

  return frames;
}

/**
 * Regular expressions for parsing different stack frame formats.
 */
const CHROME_SAFARI_REGEX =
  /^\s*at (?:(.*?) ?\((?:address at )?)?(?:async )?((?:file|https?|blob|chrome-extension|address|native|eval|webpack|<anonymous>|[-a-z]+:|.*bundle|\/)?.*?)(?::(\d+))?(?::(\d+))?\)?\s*$/i;

const FIREFOX_OPERA_REGEX =
  /^\s*(?:(\S*)@)?((?:file|https?|blob|chrome|webpack|resource|moz-extension|safari-extension|safari-web-extension|capacitor)?:\/.*?|\[native code\]|[^@]*(?:bundle|\d+\.js)|\/[\w\-. /=]+)(?::(\d+))?(?::(\d+))?\s*$/i;

const NODE_REGEX =
  /^\s*at (?:(.*?) ?\()?(?:(.+?):(\d+):(\d+)|(native))\)?/;

/**
 * Parses a single stack frame line.
 *
 * @param line - A single line from a stack trace
 * @returns Parsed stack frame or null if the line couldn't be parsed
 *
 * @example
 * ```typescript
 * const frame = parseStackFrame('    at foo (https://example.com/app.js:123:45)');
 * // { function: 'foo', filename: 'https://example.com/app.js', lineno: 123, colno: 45 }
 * ```
 */
export function parseStackFrame(line: string): StackFrame | null {
  // Skip the first line which is usually "Error: message"
  if (!line || line.match(/^Error:/)) {
    return null;
  }

  // Try Chrome/Safari format
  let match = line.match(CHROME_SAFARI_REGEX);
  if (match) {
    const [, func, filename, lineno, colno] = match;
    return createStackFrame(func, filename, lineno, colno);
  }

  // Try Firefox/Opera format
  match = line.match(FIREFOX_OPERA_REGEX);
  if (match) {
    const [, func, filename, lineno, colno] = match;
    return createStackFrame(func, filename, lineno, colno);
  }

  // Try Node.js format
  match = line.match(NODE_REGEX);
  if (match) {
    const [, func, filename, lineno, colno, native] = match;
    if (native) {
      return { function: func || 'native', filename: 'native', in_app: false };
    }
    return createStackFrame(func, filename, lineno, colno);
  }

  return null;
}

/**
 * Creates a stack frame object from parsed values.
 */
function createStackFrame(
  func: string | undefined,
  filename: string | undefined,
  lineno: string | undefined,
  colno: string | undefined
): StackFrame | null {
  if (!filename) {
    return null;
  }

  const frame: StackFrame = {
    filename: cleanFilename(filename),
    function: cleanFunctionName(func),
  };

  if (lineno) {
    frame.lineno = parseInt(lineno, 10);
  }

  if (colno) {
    frame.colno = parseInt(colno, 10);
  }

  // Determine if this is in-app code
  frame.in_app = isInAppFrame(frame);

  return frame;
}

/**
 * Cleans up a filename for display.
 */
function cleanFilename(filename: string): string {
  if (!filename) {
    return '<anonymous>';
  }

  // Remove webpack internal paths
  if (filename.includes('webpack:')) {
    return filename.replace(/^webpack:\/\/.*?\//, '');
  }

  // Remove query strings
  const queryIndex = filename.indexOf('?');
  if (queryIndex !== -1) {
    return filename.slice(0, queryIndex);
  }

  return filename;
}

/**
 * Cleans up a function name for display.
 */
function cleanFunctionName(func: string | undefined): string {
  if (!func) {
    return '?';
  }

  // Remove module path prefix
  const dotIndex = func.lastIndexOf('.');
  if (dotIndex !== -1 && dotIndex < func.length - 1) {
    // Keep the last part only if it looks like a method name
    const lastPart = func.slice(dotIndex + 1);
    if (/^[a-z]/i.test(lastPart)) {
      return func;
    }
  }

  return func;
}

/**
 * Determines if a frame is from application code.
 */
function isInAppFrame(frame: StackFrame): boolean {
  const filename = frame.filename || '';

  // Exclude node_modules
  if (filename.includes('node_modules')) {
    return false;
  }

  // Exclude native code
  if (filename === 'native' || filename.includes('[native code]')) {
    return false;
  }

  // Exclude browser internals
  if (
    filename.includes('chrome-extension:') ||
    filename.includes('moz-extension:') ||
    filename.includes('<anonymous>')
  ) {
    return false;
  }

  // Exclude SDK code
  if (filename.includes('@sentry') || filename.includes('universal-logger')) {
    return false;
  }

  return true;
}

/**
 * Extracts a message from an unknown value.
 */
function extractMessage(value: unknown): string {
  if (value === null) {
    return 'null';
  }

  if (value === undefined) {
    return 'undefined';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'object') {
    if ('message' in value && typeof value.message === 'string') {
      return value.message;
    }
    if ('error' in value && typeof value.error === 'string') {
      return value.error;
    }
    try {
      return JSON.stringify(value);
    } catch {
      return '[Object]';
    }
  }

  return String(value);
}

/**
 * Adds fingerprint to an event for custom grouping.
 *
 * @param event - The event to modify
 * @param fingerprint - Array of strings for grouping
 * @returns Modified event
 */
export function addFingerprintToEvent(event: Event, fingerprint: string[]): Event {
  event.fingerprint = fingerprint;
  return event;
}

/**
 * Adds tags to an event.
 *
 * @param event - The event to modify
 * @param tags - Record of tag key-value pairs
 * @returns Modified event
 */
export function addTagsToEvent(event: Event, tags: Record<string, string>): Event {
  event.tags = { ...event.tags, ...tags };
  return event;
}

/**
 * Adds extra data to an event.
 *
 * @param event - The event to modify
 * @param extra - Record of extra data
 * @param maxDepth - Maximum depth for normalization
 * @returns Modified event
 */
export function addExtraToEvent(
  event: Event,
  extra: Record<string, unknown>,
  maxDepth: number = 3
): Event {
  const normalizedExtra = normalize(extra, maxDepth) as Record<string, unknown>;
  event.extra = { ...event.extra, ...normalizedExtra };
  return event;
}

/**
 * Finalizes an event before sending.
 * Applies truncation, normalization, and other processing.
 *
 * @param event - The event to finalize
 * @param options - Finalization options
 * @returns Finalized event
 */
export function finalizeEvent(
  event: Event,
  options: {
    maxValueLength?: number;
    normalizeDepth?: number;
    normalizeMaxBreadth?: number;
  } = {}
): Event {
  const {
    maxValueLength = 250,
    normalizeDepth = 3,
    normalizeMaxBreadth = 1000,
  } = options;

  // Normalize the event
  const normalized = normalize(event, normalizeDepth, normalizeMaxBreadth) as Event;

  // Truncate message
  if (typeof normalized.message === 'string') {
    normalized.message = truncate(normalized.message, maxValueLength);
  }

  // Truncate exception values
  if (normalized.exception?.values) {
    for (const exception of normalized.exception.values) {
      if (exception.value) {
        exception.value = truncate(exception.value, maxValueLength);
      }
    }
  }

  // Truncate tag values
  if (normalized.tags) {
    for (const key of Object.keys(normalized.tags)) {
      const value = normalized.tags[key];
      if (typeof value === 'string') {
        normalized.tags[key] = truncate(value, 200);
      }
    }
  }

  return normalized;
}

/**
 * Creates a minimal event for cases where we need to drop most data.
 *
 * @param eventId - Event ID to preserve
 * @param message - Short message describing why data was dropped
 * @returns Minimal event
 */
export function createMinimalEvent(eventId: string, message: string): Event {
  return {
    event_id: eventId,
    timestamp: timestampInSeconds(),
    platform: 'javascript',
    level: 'error',
    message,
    sdk: SDK_INFO,
  };
}
