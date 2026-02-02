/**
 * Event Fingerprinting
 *
 * Generates fingerprints for event grouping in Sentry.
 * Fingerprints determine which events are grouped together as the same issue.
 */

import type { Event, Exception, StackFrame } from '../../types/sentry';

/**
 * Default fingerprint value that tells Sentry to use its default grouping
 */
export const DEFAULT_FINGERPRINT = ['{{ default }}'];

/**
 * Generate a fingerprint for an event
 *
 * The fingerprint determines how events are grouped into issues.
 * By default, Sentry groups by stack trace and exception type.
 *
 * @param event - The event to generate a fingerprint for
 * @returns Array of strings that make up the fingerprint
 */
export function generateFingerprint(event: Event): string[] {
  // If the event already has a fingerprint, use it
  if (event.fingerprint && event.fingerprint.length > 0) {
    return event.fingerprint;
  }

  const parts: string[] = [];

  // Include exception type and value if present
  if (event.exception?.values && event.exception.values.length > 0) {
    const mainException = event.exception.values[event.exception.values.length - 1];
    if (mainException) {
      parts.push(...generateExceptionFingerprint(mainException));
    }
  }

  // Include message if present and no exception
  if (parts.length === 0 && event.message) {
    const message = typeof event.message === 'string'
      ? event.message
      : event.message.formatted || event.message.message || '';
    if (message) {
      parts.push(normalizeMessage(message));
    }
  }

  // If we still have nothing, use default
  if (parts.length === 0) {
    return DEFAULT_FINGERPRINT;
  }

  return parts;
}

/**
 * Generate fingerprint parts from an exception
 */
function generateExceptionFingerprint(exception: Exception): string[] {
  const parts: string[] = [];

  // Add exception type
  if (exception.type) {
    parts.push(exception.type);
  }

  // Add value if it's not too generic
  if (exception.value && !isGenericErrorMessage(exception.value)) {
    parts.push(normalizeMessage(exception.value));
  }

  // Add stack trace fingerprint if available
  if (exception.stacktrace?.frames && exception.stacktrace.frames.length > 0) {
    const stackFingerprint = generateStackFingerprint(exception.stacktrace.frames);
    if (stackFingerprint) {
      parts.push(stackFingerprint);
    }
  }

  return parts;
}

/**
 * Generate a fingerprint from a stack trace
 *
 * Uses the top application frames to create a fingerprint
 */
function generateStackFingerprint(frames: StackFrame[]): string | null {
  // Get application frames (in_app === true)
  const appFrames = frames.filter((frame) => frame.in_app !== false);

  // If no app frames, use all frames
  const relevantFrames = appFrames.length > 0 ? appFrames : frames;

  // Take the top 5 frames for fingerprinting
  const topFrames = relevantFrames.slice(-5);

  if (topFrames.length === 0) {
    return null;
  }

  // Create fingerprint from frame locations
  const frameParts = topFrames.map((frame) => {
    const parts: string[] = [];

    if (frame.filename) {
      parts.push(normalizeFilename(frame.filename));
    }

    if (frame.function) {
      parts.push(frame.function);
    }

    if (frame.lineno !== undefined) {
      parts.push(String(frame.lineno));
    }

    return parts.join(':');
  });

  return frameParts.join('|');
}

/**
 * Normalize a filename for fingerprinting
 *
 * Removes dynamic parts like hashes and versions
 */
function normalizeFilename(filename: string): string {
  return filename
    // Remove content hashes (common in bundled files)
    .replace(/[.-][a-f0-9]{8,32}(\.[a-z]+)$/i, '$1')
    // Remove version numbers
    .replace(/@[\d.]+/, '')
    // Remove query strings
    .replace(/\?.*$/, '')
    // Remove hash fragments
    .replace(/#.*$/, '');
}

/**
 * Normalize an error message for fingerprinting
 *
 * Removes dynamic values like IDs, timestamps, etc.
 */
function normalizeMessage(message: string): string {
  return message
    // Remove UUIDs
    .replace(/[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/gi, '<uuid>')
    // Remove hex IDs
    .replace(/\b[a-f0-9]{24,}\b/gi, '<id>')
    // Remove numbers that look like IDs
    .replace(/\b\d{6,}\b/g, '<id>')
    // Remove timestamps
    .replace(/\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}:\d{2}/g, '<timestamp>')
    // Remove email addresses
    .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '<email>')
    // Remove IP addresses
    .replace(/\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g, '<ip>')
    // Remove URLs
    .replace(/https?:\/\/[^\s]+/g, '<url>')
    // Remove file paths
    .replace(/\/[^\s:]+\.(js|ts|jsx|tsx|mjs|cjs)/g, '<file>')
    // Normalize whitespace
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if an error message is too generic to be useful for fingerprinting
 */
function isGenericErrorMessage(message: string): boolean {
  const genericMessages = [
    'error',
    'unknown error',
    'an error occurred',
    'something went wrong',
    'internal error',
    'script error',
    'script error.',
    'null',
    'undefined',
    'network error',
    'failed to fetch',
    'load failed',
    'promise rejection',
  ];

  const normalized = message.toLowerCase().trim();
  return genericMessages.includes(normalized);
}

/**
 * Apply fingerprint rules to modify an event's fingerprint
 *
 * Rules can include:
 * - {{ default }} - Use Sentry's default grouping
 * - {{ type }} - Use the exception type
 * - {{ function }} - Use the function name from the top frame
 * - {{ module }} - Use the module name from the top frame
 * - {{ filename }} - Use the filename from the top frame
 * - {{ message }} - Use the error message
 *
 * @param event - The event to apply rules to
 * @param fingerprint - The fingerprint rules to apply
 * @returns The expanded fingerprint
 */
export function applyFingerprintRules(
  event: Event,
  fingerprint: string[]
): string[] {
  return fingerprint.map((rule) => {
    // Keep the rule as-is if it's the default
    if (rule === '{{ default }}') {
      return rule;
    }

    // Expand type placeholder
    if (rule === '{{ type }}') {
      const exception = event.exception?.values?.[event.exception.values.length - 1];
      return exception?.type || 'Error';
    }

    // Expand function placeholder
    if (rule === '{{ function }}') {
      const frame = getTopFrame(event);
      return frame?.function || '<anonymous>';
    }

    // Expand module placeholder
    if (rule === '{{ module }}') {
      const frame = getTopFrame(event);
      return frame?.module || frame?.filename || '<unknown>';
    }

    // Expand filename placeholder
    if (rule === '{{ filename }}') {
      const frame = getTopFrame(event);
      return frame?.filename || '<unknown>';
    }

    // Expand message placeholder
    if (rule === '{{ message }}') {
      if (typeof event.message === 'string') {
        return normalizeMessage(event.message);
      }
      if (event.message?.formatted || event.message?.message) {
        return normalizeMessage(event.message.formatted || event.message.message || '');
      }
      const exception = event.exception?.values?.[event.exception.values.length - 1];
      return exception?.value ? normalizeMessage(exception.value) : '<no message>';
    }

    // Return the rule as-is (custom string)
    return rule;
  });
}

/**
 * Get the top (most recent) application frame from an event
 */
function getTopFrame(event: Event): StackFrame | null {
  const exception = event.exception?.values?.[event.exception.values.length - 1];
  const frames = exception?.stacktrace?.frames;

  if (!frames || frames.length === 0) {
    return null;
  }

  // Frames are in oldest-to-newest order, so top is last
  // Prefer application frames
  for (let i = frames.length - 1; i >= 0; i--) {
    if (frames[i].in_app !== false) {
      return frames[i];
    }
  }

  // Fall back to the newest frame
  return frames[frames.length - 1];
}

/**
 * Merge two fingerprints, handling {{ default }} specially
 */
export function mergeFingerprints(
  base: string[],
  override: string[]
): string[] {
  // If override contains {{ default }}, replace it with the base fingerprint
  const hasDefault = override.includes('{{ default }}');

  if (!hasDefault) {
    return override;
  }

  // Expand {{ default }} to the base fingerprint
  const result: string[] = [];
  for (const part of override) {
    if (part === '{{ default }}') {
      result.push(...base);
    } else {
      result.push(part);
    }
  }

  return result;
}
