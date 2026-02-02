/**
 * Message Capture API
 *
 * Provides functions to capture log messages as Sentry events.
 */

import type {
  CaptureContext,
  Event,
  EventHint,
  SeverityLevel,
} from '../../types/sentry';
import { createSyntheticStacktrace } from './stackParser';
import { generateFingerprint } from './fingerprint';
import { applyCaptureContext } from './exception';

/**
 * Generate a UUID v4 without dashes (Sentry event ID format)
 */
function generateEventId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '');
  }

  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Valid severity levels
 */
const SEVERITY_LEVELS: SeverityLevel[] = [
  'fatal',
  'error',
  'warning',
  'log',
  'info',
  'debug',
];

/**
 * Check if a value is a valid severity level
 */
function isSeverityLevel(value: unknown): value is SeverityLevel {
  return (
    typeof value === 'string' && SEVERITY_LEVELS.includes(value as SeverityLevel)
  );
}

/**
 * Options for capturing messages
 */
export interface CaptureMessageOptions {
  /**
   * The severity level of the message
   */
  level?: SeverityLevel;

  /**
   * Additional context to apply to the event
   */
  captureContext?: CaptureContext;

  /**
   * Whether to attach a stack trace
   */
  attachStacktrace?: boolean;

  /**
   * Hint data for event processors
   */
  hint?: EventHint;
}

/**
 * Capture a message and return the event ID
 *
 * This function creates a Sentry event from a log message.
 *
 * @param message - The message to capture
 * @param captureContextOrLevel - Either a severity level or capture context
 * @returns The event ID and event
 */
export function captureMessage(
  message: string,
  captureContextOrLevel?: CaptureContext | SeverityLevel
): { eventId: string; event: Event } {
  const eventId = generateEventId();

  // Determine level and capture context
  let level: SeverityLevel = 'info';
  let captureContext: CaptureContext | undefined;

  if (isSeverityLevel(captureContextOrLevel)) {
    level = captureContextOrLevel;
  } else if (captureContextOrLevel) {
    captureContext = captureContextOrLevel;
    // Extract level from capture context if present
    if (
      typeof captureContext === 'object' &&
      'level' in captureContext &&
      isSeverityLevel(captureContext.level)
    ) {
      level = captureContext.level;
    }
  }

  // Build the event
  const event: Event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level,
    message: {
      formatted: message,
      message,
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
 * Capture a message with full options
 *
 * @param message - The message to capture
 * @param options - Capture options
 * @returns The event ID and event
 */
export function captureMessageWithOptions(
  message: string,
  options: CaptureMessageOptions = {}
): { eventId: string; event: Event } {
  const {
    level = 'info',
    captureContext,
    attachStacktrace = false,
  } = options;

  const eventId = generateEventId();

  // Build the event
  const event: Event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level,
    message: {
      formatted: message,
      message,
    },
  };

  // Optionally attach stack trace
  if (attachStacktrace) {
    const frames = createSyntheticStacktrace(2);
    if (frames && frames.length > 0) {
      // For messages, we add a synthetic exception with the stack trace
      event.exception = {
        values: [
          {
            type: 'Message',
            value: message,
            stacktrace: { frames },
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

  // Generate fingerprint
  event.fingerprint = generateFingerprint(event);

  // Apply capture context if provided
  if (captureContext) {
    applyCaptureContext(event, captureContext);
  }

  return { eventId, event };
}

/**
 * Capture a parameterized message
 *
 * Parameterized messages allow for better grouping by keeping
 * the template separate from the values.
 *
 * @param template - The message template (e.g., "User %s logged in")
 * @param params - The values to substitute
 * @param options - Capture options
 * @returns The event ID and event
 */
export function captureParameterizedMessage(
  template: string,
  params: unknown[],
  options: CaptureMessageOptions = {}
): { eventId: string; event: Event } {
  const {
    level = 'info',
    captureContext,
    attachStacktrace = false,
  } = options;

  const eventId = generateEventId();

  // Format the message with parameters
  const formatted = formatMessage(template, params);

  // Build the event
  const event: Event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level,
    message: {
      formatted,
      message: template,
      params,
    },
  };

  // For grouping, use the template as fingerprint
  event.fingerprint = [template];

  // Optionally attach stack trace
  if (attachStacktrace) {
    const frames = createSyntheticStacktrace(2);
    if (frames && frames.length > 0) {
      event.exception = {
        values: [
          {
            type: 'Message',
            value: formatted,
            stacktrace: { frames },
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

  // Apply capture context if provided
  if (captureContext) {
    applyCaptureContext(event, captureContext);
  }

  return { eventId, event };
}

/**
 * Format a message template with parameters
 *
 * Supports printf-style format specifiers:
 * - %s: string
 * - %d, %i: integer
 * - %f: float
 * - %o, %O: object (JSON)
 * - %j: JSON
 * - %%: literal %
 */
export function formatMessage(template: string, params: unknown[]): string {
  if (!params || params.length === 0) {
    return template;
  }

  let paramIndex = 0;

  return template.replace(/%([sdifojO%])/g, (match, specifier) => {
    // Handle escaped percent
    if (specifier === '%') {
      return '%';
    }

    // If we've run out of params, leave the placeholder
    if (paramIndex >= params.length) {
      return match;
    }

    const value = params[paramIndex++];

    switch (specifier) {
      case 's':
        return String(value);
      case 'd':
      case 'i':
        return String(parseInt(String(value), 10));
      case 'f':
        return String(parseFloat(String(value)));
      case 'o':
      case 'O':
      case 'j':
        try {
          return JSON.stringify(value);
        } catch {
          return '[Circular]';
        }
      default:
        return match;
    }
  });
}

/**
 * Create a message event from console arguments
 *
 * This is useful for creating events from console.log, console.error, etc.
 *
 * @param args - The console arguments
 * @param level - The severity level
 * @returns The event
 */
export function messageEventFromConsoleArgs(
  args: unknown[],
  level: SeverityLevel = 'log'
): Event {
  const eventId = generateEventId();

  // Format the message from arguments
  let message: string;
  let template: string | undefined;
  let params: unknown[] | undefined;

  if (args.length === 0) {
    message = '';
  } else if (args.length === 1) {
    message = formatValue(args[0]);
  } else if (typeof args[0] === 'string' && args[0].includes('%')) {
    // First arg looks like a template
    template = args[0];
    params = args.slice(1);
    message = formatMessage(template, params);
  } else {
    // Join all args with space
    message = args.map(formatValue).join(' ');
  }

  const event: Event = {
    event_id: eventId,
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level,
    message: template
      ? { formatted: message, message: template, params }
      : { formatted: message, message },
  };

  // Generate fingerprint
  event.fingerprint = template ? [template] : generateFingerprint(event);

  return event;
}

/**
 * Format a value for display in a message
 */
function formatValue(value: unknown): string {
  if (value === undefined) {
    return 'undefined';
  }

  if (value === null) {
    return 'null';
  }

  if (typeof value === 'string') {
    return value;
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (value instanceof Error) {
    return value.stack || `${value.name}: ${value.message}`;
  }

  if (typeof value === 'object') {
    try {
      return JSON.stringify(value);
    } catch {
      return '[object Object]';
    }
  }

  return String(value);
}
