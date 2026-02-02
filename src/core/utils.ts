/**
 * Core Utility Functions
 *
 * Provides essential utilities for event ID generation, timestamps,
 * data normalization, and type checking.
 */

/**
 * Generates a UUID v4 string (without dashes) suitable for Sentry event IDs.
 *
 * @returns A 32-character hexadecimal string
 * @example
 * ```typescript
 * const eventId = generateEventId();
 * // "a1b2c3d4e5f6789012345678abcdef12"
 * ```
 */
export function generateEventId(): string {
  return uuid4().replace(/-/g, '');
}

/**
 * Generates a standard UUID v4 string.
 *
 * @returns A UUID v4 string in standard format (with dashes)
 * @example
 * ```typescript
 * const id = uuid4();
 * // "a1b2c3d4-e5f6-4890-1234-5678abcdef12"
 * ```
 */
export function uuid4(): string {
  // Use crypto.randomUUID if available (modern browsers and Node.js 19+)
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Fallback to manual generation
  const hex = '0123456789abcdef';
  let uuid = '';

  for (let i = 0; i < 36; i++) {
    if (i === 8 || i === 13 || i === 18 || i === 23) {
      uuid += '-';
    } else if (i === 14) {
      uuid += '4'; // Version 4
    } else if (i === 19) {
      uuid += hex[(getRandomInt(16) & 0x3) | 0x8]; // Variant bits
    } else {
      uuid += hex[getRandomInt(16)];
    }
  }

  return uuid;
}

/**
 * Gets a random integer using crypto if available.
 *
 * @param max - Maximum value (exclusive)
 * @returns Random integer from 0 to max-1
 */
function getRandomInt(max: number): number {
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint32Array(1);
    crypto.getRandomValues(array);
    return array[0] % max;
  }
  return Math.floor(Math.random() * max);
}

/**
 * Generates a 16-character hex string suitable for span IDs.
 *
 * @returns A 16-character hexadecimal string
 */
export function generateSpanId(): string {
  const hex = '0123456789abcdef';
  let spanId = '';

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const array = new Uint8Array(8);
    crypto.getRandomValues(array);
    for (const byte of array) {
      spanId += hex[byte >> 4] + hex[byte & 0xf];
    }
  } else {
    for (let i = 0; i < 16; i++) {
      spanId += hex[Math.floor(Math.random() * 16)];
    }
  }

  return spanId;
}

/**
 * Generates a 32-character hex string suitable for trace IDs.
 *
 * @returns A 32-character hexadecimal string
 */
export function generateTraceId(): string {
  return generateSpanId() + generateSpanId();
}

/**
 * Returns the current timestamp in seconds (Unix timestamp).
 *
 * @returns Unix timestamp in seconds with millisecond precision
 * @example
 * ```typescript
 * const ts = timestampInSeconds();
 * // 1706832000.123
 * ```
 */
export function timestampInSeconds(): number {
  return Date.now() / 1000;
}

/**
 * Returns the current date as a Unix timestamp in seconds.
 * This is an alias for timestampInSeconds for compatibility.
 *
 * @returns Unix timestamp in seconds
 */
export function dateTimestampInSeconds(): number {
  return Math.floor(Date.now() / 1000);
}

/**
 * Returns the current timestamp as an ISO 8601 string.
 *
 * @returns ISO 8601 formatted timestamp string
 */
export function timestampToISOString(): string {
  return new Date().toISOString();
}

/**
 * Converts a Unix timestamp in seconds to an ISO 8601 string.
 *
 * @param timestamp - Unix timestamp in seconds
 * @returns ISO 8601 formatted timestamp string
 */
export function secondsToISOString(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString();
}

/**
 * Normalizes data for safe serialization and transmission.
 * Handles circular references, depth limiting, and breadth limiting.
 *
 * @param data - The data to normalize
 * @param depth - Maximum depth to traverse (default: 3)
 * @param maxBreadth - Maximum number of properties per object (default: 1000)
 * @returns Normalized data safe for JSON serialization
 * @example
 * ```typescript
 * const obj = { a: 1, b: { c: { d: { e: 5 } } } };
 * normalize(obj, 2);
 * // { a: 1, b: { c: "[Object]" } }
 * ```
 */
export function normalize(
  data: unknown,
  depth: number = 3,
  maxBreadth: number = 1000
): unknown {
  const seen = new WeakSet();
  return normalizeValue(data, depth, maxBreadth, seen);
}

/**
 * Internal recursive normalizer.
 */
function normalizeValue(
  value: unknown,
  depth: number,
  maxBreadth: number,
  seen: WeakSet<object>
): unknown {
  // Handle null and undefined
  if (value === null || value === undefined) {
    return value;
  }

  // Handle primitives
  const type = typeof value;
  if (type === 'boolean' || type === 'number' || type === 'string') {
    return value;
  }

  if (type === 'bigint') {
    return value.toString();
  }

  if (type === 'symbol') {
    return value.toString();
  }

  if (type === 'function') {
    return `[Function: ${(value as (...args: unknown[]) => unknown).name || 'anonymous'}]`;
  }

  // Handle Date
  if (value instanceof Date) {
    return value.toISOString();
  }

  // Handle RegExp
  if (value instanceof RegExp) {
    return value.toString();
  }

  // Handle Error
  if (isError(value)) {
    return normalizeError(value, depth, maxBreadth, seen);
  }

  // Handle Arrays and Objects
  if (type === 'object') {
    // Check for circular references
    if (seen.has(value as object)) {
      return '[Circular]';
    }

    // Depth limit reached
    if (depth <= 0) {
      if (Array.isArray(value)) {
        return `[Array(${value.length})]`;
      }
      return '[Object]';
    }

    seen.add(value as object);

    // Handle Arrays
    if (Array.isArray(value)) {
      const result: unknown[] = [];
      const length = Math.min(value.length, maxBreadth);
      for (let i = 0; i < length; i++) {
        result.push(normalizeValue(value[i], depth - 1, maxBreadth, seen));
      }
      if (value.length > maxBreadth) {
        result.push(`... ${value.length - maxBreadth} more items`);
      }
      return result;
    }

    // Handle Map
    if (value instanceof Map) {
      const obj: Record<string, unknown> = { __type__: 'Map' };
      let count = 0;
      for (const [k, v] of value) {
        if (count >= maxBreadth) {
          obj.__truncated__ = `${value.size - count} more entries`;
          break;
        }
        const key = typeof k === 'string' ? k : String(k);
        obj[key] = normalizeValue(v, depth - 1, maxBreadth, seen);
        count++;
      }
      return obj;
    }

    // Handle Set
    if (value instanceof Set) {
      const arr: unknown[] = [];
      let count = 0;
      for (const v of value) {
        if (count >= maxBreadth) {
          arr.push(`... ${value.size - count} more items`);
          break;
        }
        arr.push(normalizeValue(v, depth - 1, maxBreadth, seen));
        count++;
      }
      return { __type__: 'Set', values: arr };
    }

    // Handle plain objects
    const result: Record<string, unknown> = {};
    const keys = Object.keys(value as object);
    const length = Math.min(keys.length, maxBreadth);

    for (let i = 0; i < length; i++) {
      const key = keys[i];
      result[key] = normalizeValue((value as Record<string, unknown>)[key], depth - 1, maxBreadth, seen);
    }

    if (keys.length > maxBreadth) {
      result.__truncated__ = `${keys.length - maxBreadth} more keys`;
    }

    return result;
  }

  return String(value);
}

/**
 * Normalizes an Error object.
 */
function normalizeError(
  error: Error,
  depth: number,
  maxBreadth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name,
    message: error.message,
  };

  if (error.stack) {
    result.stack = error.stack;
  }

  // Include any custom properties
  for (const key of Object.keys(error)) {
    if (key !== 'name' && key !== 'message' && key !== 'stack') {
      result[key] = normalizeValue(
        (error as unknown as Record<string, unknown>)[key],
        depth - 1,
        maxBreadth,
        seen
      );
    }
  }

  // Handle cause
  if ('cause' in error && error.cause) {
    result.cause = normalizeValue(error.cause, depth - 1, maxBreadth, seen);
  }

  return result;
}

/**
 * Truncates a string to a maximum length.
 *
 * @param str - The string to truncate
 * @param max - Maximum length
 * @returns Truncated string with ellipsis if truncated
 * @example
 * ```typescript
 * truncate("Hello World", 8);
 * // "Hello..."
 * ```
 */
export function truncate(str: string, max: number): string {
  if (typeof str !== 'string' || str.length <= max) {
    return str;
  }
  return str.slice(0, max - 3) + '...';
}

/**
 * Checks if a value is an Error object.
 *
 * @param value - The value to check
 * @returns True if the value is an Error
 */
export function isError(value: unknown): value is Error {
  if (value instanceof Error) {
    return true;
  }

  // Duck typing for Error-like objects
  if (
    value !== null &&
    typeof value === 'object' &&
    'name' in value &&
    'message' in value
  ) {
    return true;
  }

  return false;
}

/**
 * Checks if a value is a plain object (not an array, null, or class instance).
 *
 * @param value - The value to check
 * @returns True if the value is a plain object
 */
export function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object') {
    return false;
  }

  const proto = Object.getPrototypeOf(value);
  return proto === null || proto === Object.prototype;
}

/**
 * Checks if a value is a primitive type.
 *
 * @param value - The value to check
 * @returns True if the value is a primitive
 */
export function isPrimitive(value: unknown): value is string | number | boolean | null | undefined {
  return value === null || value === undefined || typeof value !== 'object';
}

/**
 * Checks if a value is a thenable (has a .then method).
 *
 * @param value - The value to check
 * @returns True if the value is thenable
 */
export function isThenable<T>(value: unknown): value is PromiseLike<T> {
  return (
    value !== null &&
    typeof value === 'object' &&
    typeof (value as PromiseLike<T>).then === 'function'
  );
}

/**
 * Converts a value to a string representation.
 *
 * @param value - The value to convert
 * @returns String representation of the value
 */
export function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/**
 * Creates a resolved promise with a timeout.
 *
 * @param timeout - Timeout in milliseconds
 * @param fallback - Value to resolve with on timeout
 * @returns Promise that resolves after timeout
 */
export function resolveAfterTimeout<T>(timeout: number, fallback: T): Promise<T> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(fallback), timeout);
  });
}

/**
 * Creates a promise that rejects after a timeout.
 *
 * @param timeout - Timeout in milliseconds
 * @param message - Error message for timeout
 * @returns Promise that rejects after timeout
 */
export function rejectAfterTimeout(timeout: number, message: string): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => reject(new Error(message)), timeout);
  });
}

/**
 * Wraps a promise with a timeout.
 *
 * @param promise - The promise to wrap
 * @param timeout - Timeout in milliseconds
 * @param fallback - Value to resolve with on timeout
 * @returns Promise that resolves with the original value or fallback on timeout
 */
export function promiseWithTimeout<T>(
  promise: Promise<T>,
  timeout: number,
  fallback: T
): Promise<T> {
  return Promise.race([promise, resolveAfterTimeout(timeout, fallback)]);
}

/**
 * Safely executes a callback and catches any errors.
 *
 * @param callback - The callback to execute
 * @param onError - Optional error handler
 * @returns The result of the callback or undefined on error
 */
export function safeExecute<T>(
  callback: () => T,
  onError?: (error: unknown) => void
): T | undefined {
  try {
    return callback();
  } catch (error) {
    if (onError) {
      onError(error);
    }
    return undefined;
  }
}

/**
 * Debounces a function.
 *
 * @param fn - The function to debounce
 * @param wait - Wait time in milliseconds
 * @returns Debounced function
 */
export function debounce<T extends (...args: unknown[]) => unknown>(
  fn: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;

  return function (...args: Parameters<T>) {
    if (timeout !== null) {
      clearTimeout(timeout);
    }
    timeout = setTimeout(() => {
      fn(...args);
      timeout = null;
    }, wait);
  };
}

/**
 * Creates a deep clone of an object.
 *
 * @param obj - The object to clone
 * @returns Deep clone of the object
 */
export function deepClone<T>(obj: T): T {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => deepClone(item)) as T;
  }

  if (obj instanceof Date) {
    return new Date(obj.getTime()) as T;
  }

  if (obj instanceof Map) {
    const result = new Map();
    for (const [key, value] of obj) {
      result.set(deepClone(key), deepClone(value));
    }
    return result as T;
  }

  if (obj instanceof Set) {
    const result = new Set();
    for (const value of obj) {
      result.add(deepClone(value));
    }
    return result as T;
  }

  const result: Record<string, unknown> = {};
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = deepClone((obj as Record<string, unknown>)[key]);
    }
  }
  return result as T;
}

/**
 * Merges multiple objects deeply.
 *
 * @param target - The target object
 * @param sources - Source objects to merge
 * @returns Merged object
 */
export function deepMerge<T extends Record<string, unknown>>(
  target: T,
  ...sources: Partial<T>[]
): T {
  for (const source of sources) {
    if (!source) continue;

    for (const key in source) {
      if (Object.prototype.hasOwnProperty.call(source, key)) {
        const targetValue = target[key];
        const sourceValue = source[key];

        if (isPlainObject(targetValue) && isPlainObject(sourceValue)) {
          target[key] = deepMerge(
            targetValue as Record<string, unknown>,
            sourceValue as Record<string, unknown>
          ) as T[Extract<keyof T, string>];
        } else if (sourceValue !== undefined) {
          target[key] = sourceValue as T[Extract<keyof T, string>];
        }
      }
    }
  }

  return target;
}

/**
 * Converts an unknown error value to an Error object.
 *
 * @param error - The error value
 * @returns Error object
 */
export function ensureError(error: unknown): Error {
  if (error instanceof Error) {
    return error;
  }

  if (typeof error === 'string') {
    return new Error(error);
  }

  if (typeof error === 'object' && error !== null) {
    const errorObj = error as Record<string, unknown>;
    const message = errorObj.message || errorObj.error || String(error);
    const err = new Error(String(message));
    if (errorObj.name) {
      err.name = String(errorObj.name);
    }
    if (errorObj.stack) {
      err.stack = String(errorObj.stack);
    }
    return err;
  }

  return new Error(String(error));
}
