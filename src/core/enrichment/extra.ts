/**
 * Extra Data Management
 *
 * Extras are arbitrary key-value pairs attached to events.
 * Unlike tags, extras are not indexed but can store more complex data.
 */

import type { ScopeData } from '../../types/scope';

/**
 * Maximum depth for normalizing extra values
 */
const DEFAULT_MAX_DEPTH = 5;

/**
 * Maximum number of keys/items at each level
 */
const DEFAULT_MAX_BREADTH = 100;

/**
 * Maximum string length for extra values
 */
const MAX_STRING_LENGTH = 8192;

/**
 * Maximum total size for extras (in characters when serialized)
 */
const MAX_EXTRAS_SIZE = 256 * 1024; // 256KB

/**
 * Set extra data on a scope
 *
 * @param scope - The scope data object
 * @param key - The extra key
 * @param value - The extra value (any type)
 */
export function setExtra(
  scope: ScopeData,
  key: string,
  value: unknown
): void {
  if (!key || typeof key !== 'string') {
    return;
  }

  // Normalize the value for safe serialization
  const normalized = normalizeExtra(value);

  // Check if adding this would exceed size limit
  const currentSize = estimateSize(scope.extras);
  const newSize = estimateSize(normalized);

  if (currentSize + newSize > MAX_EXTRAS_SIZE) {
    console.warn(
      `[Logger] Extra "${key}" dropped due to size limit (would exceed ${MAX_EXTRAS_SIZE} bytes)`
    );
    return;
  }

  scope.extras[key] = normalized;
}

/**
 * Set multiple extras on a scope
 *
 * @param scope - The scope data object
 * @param extras - Object containing extra key-value pairs
 */
export function setExtras(
  scope: ScopeData,
  extras: Record<string, unknown>
): void {
  if (!extras || typeof extras !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(extras)) {
    setExtra(scope, key, value);
  }
}

/**
 * Normalize an extra value for safe serialization
 *
 * This handles:
 * - Circular references
 * - Deep nesting
 * - Non-serializable values
 * - Large objects
 *
 * @param value - The value to normalize
 * @param depth - Maximum depth to traverse (default: 5)
 * @param maxBreadth - Maximum keys/items at each level (default: 100)
 * @returns Normalized value
 */
export function normalizeExtra(
  value: unknown,
  depth: number = DEFAULT_MAX_DEPTH,
  maxBreadth: number = DEFAULT_MAX_BREADTH
): unknown {
  return normalizeValue(value, depth, maxBreadth, new WeakSet());
}

/**
 * Normalize any value for safe serialization
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
  if (typeof value === 'string') {
    return truncateString(value, MAX_STRING_LENGTH);
  }

  if (typeof value === 'number') {
    // Handle special numeric values
    if (!Number.isFinite(value)) {
      return String(value);
    }
    return value;
  }

  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'bigint') {
    return value.toString();
  }

  if (typeof value === 'symbol') {
    return value.toString();
  }

  if (typeof value === 'function') {
    try {
      // Try to get function source (truncated)
      const source = value.toString();
      return truncateString(`[Function: ${value.name || 'anonymous'}] ${source}`, 200);
    } catch {
      return `[Function: ${value.name || 'anonymous'}]`;
    }
  }

  // Handle objects
  if (typeof value === 'object') {
    // Check for circular references
    if (seen.has(value)) {
      return '[Circular]';
    }

    // Check depth limit
    if (depth <= 0) {
      return summarizeValue(value);
    }

    // Mark as seen
    seen.add(value);

    // Handle arrays
    if (Array.isArray(value)) {
      return normalizeArray(value, depth - 1, maxBreadth, seen);
    }

    // Handle special object types
    if (value instanceof Error) {
      return normalizeError(value, depth, maxBreadth, seen);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    if (typeof URL !== 'undefined' && value instanceof URL) {
      return value.toString();
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${value.byteLength} bytes]`;
    }

    if (typeof Uint8Array !== 'undefined' && ArrayBuffer.isView(value)) {
      const view = value as { byteLength: number; constructor: { name: string } };
      return `[${view.constructor.name}: ${view.byteLength} bytes]`;
    }

    if (typeof Blob !== 'undefined' && value instanceof Blob) {
      return `[Blob: ${value.size} bytes, ${value.type || 'unknown type'}]`;
    }

    if (typeof Map !== 'undefined' && value instanceof Map) {
      return normalizeMap(value, depth - 1, maxBreadth, seen);
    }

    if (typeof Set !== 'undefined' && value instanceof Set) {
      return normalizeSet(value, depth - 1, maxBreadth, seen);
    }

    if (typeof WeakMap !== 'undefined' && value instanceof WeakMap) {
      return '[WeakMap]';
    }

    if (typeof WeakSet !== 'undefined' && value instanceof WeakSet) {
      return '[WeakSet]';
    }

    if (typeof Promise !== 'undefined' && value instanceof Promise) {
      return '[Promise]';
    }

    // Handle DOM elements
    if (typeof Element !== 'undefined' && value instanceof Element) {
      return summarizeDOMElement(value);
    }

    // Handle plain objects
    return normalizeObject(
      value as Record<string, unknown>,
      depth - 1,
      maxBreadth,
      seen
    );
  }

  // Fallback for unknown types
  return String(value);
}

/**
 * Create a summary of a value (when depth limit is reached)
 */
function summarizeValue(value: unknown): string {
  if (Array.isArray(value)) {
    return `[Array: ${value.length} items]`;
  }

  if (value instanceof Map) {
    return `[Map: ${value.size} entries]`;
  }

  if (value instanceof Set) {
    return `[Set: ${value.size} items]`;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (value instanceof Error) {
    return `[${value.name}: ${truncateString(value.message, 100)}]`;
  }

  if (typeof value === 'object' && value !== null) {
    const proto = Object.getPrototypeOf(value);
    const name = proto?.constructor?.name || 'Object';
    const keys = Object.keys(value as object);
    return `[${name}: ${keys.length} properties]`;
  }

  return '[Object]';
}

/**
 * Summarize a DOM element
 */
function summarizeDOMElement(element: Element): string {
  let summary = element.tagName.toLowerCase();

  if (element.id) {
    summary += `#${element.id}`;
  }

  if (element.className && typeof element.className === 'string') {
    summary += `.${element.className.split(' ').filter(Boolean).join('.')}`;
  }

  return `[Element: ${summary}]`;
}

/**
 * Normalize a plain object
 */
function normalizeObject(
  obj: Record<string, unknown>,
  depth: number,
  maxBreadth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let count = 0;

  // Get all own properties including symbols
  const keys = [
    ...Object.keys(obj),
    ...Object.getOwnPropertySymbols(obj).map((s) => s.toString()),
  ];

  for (const key of keys) {
    if (count >= maxBreadth) {
      result['...'] = `${keys.length - count} more properties`;
      break;
    }

    try {
      const value = obj[key];
      result[String(key)] = normalizeValue(value, depth, maxBreadth, seen);
      count++;
    } catch {
      result[String(key)] = '[Error accessing property]';
      count++;
    }
  }

  return result;
}

/**
 * Normalize an array
 */
function normalizeArray(
  arr: unknown[],
  depth: number,
  maxBreadth: number,
  seen: WeakSet<object>
): unknown[] {
  const result: unknown[] = [];
  const limit = Math.min(arr.length, maxBreadth);

  for (let i = 0; i < limit; i++) {
    try {
      result.push(normalizeValue(arr[i], depth, maxBreadth, seen));
    } catch {
      result.push('[Error accessing element]');
    }
  }

  if (arr.length > limit) {
    result.push(`... ${arr.length - limit} more items`);
  }

  return result;
}

/**
 * Normalize an Error object with full details
 */
function normalizeError(
  error: Error,
  depth: number,
  maxBreadth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    name: error.name,
    message: truncateString(error.message, MAX_STRING_LENGTH),
  };

  if (error.stack) {
    result.stack = truncateString(error.stack, MAX_STRING_LENGTH * 2);
  }

  // Include cause if present (ES2022+)
  if ('cause' in error && error.cause !== undefined) {
    result.cause = normalizeValue(error.cause, depth - 1, maxBreadth, seen);
  }

  // Include any additional properties
  for (const key of Object.keys(error)) {
    if (!(key in result)) {
      try {
        result[key] = normalizeValue(
          (error as unknown as Record<string, unknown>)[key],
          depth - 1,
          maxBreadth,
          seen
        );
      } catch {
        result[key] = '[Error accessing property]';
      }
    }
  }

  return result;
}

/**
 * Normalize a Map
 */
function normalizeMap(
  map: Map<unknown, unknown>,
  depth: number,
  maxBreadth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    __type__: 'Map',
    entries: {},
  };

  const entries = result.entries as Record<string, unknown>;
  let count = 0;

  map.forEach((value, key) => {
    if (count >= maxBreadth) {
      return;
    }

    const keyStr = typeof key === 'string' ? key : JSON.stringify(key);
    entries[keyStr] = normalizeValue(value, depth, maxBreadth, seen);
    count++;
  });

  if (count >= maxBreadth && map.size > count) {
    entries['...'] = `${map.size - count} more entries`;
  }

  return result;
}

/**
 * Normalize a Set
 */
function normalizeSet(
  set: Set<unknown>,
  depth: number,
  maxBreadth: number,
  seen: WeakSet<object>
): Record<string, unknown> {
  const result: Record<string, unknown> = {
    __type__: 'Set',
    values: [],
  };

  const values = result.values as unknown[];
  let count = 0;

  set.forEach((value) => {
    if (count >= maxBreadth) {
      return;
    }

    values.push(normalizeValue(value, depth, maxBreadth, seen));
    count++;
  });

  if (count >= maxBreadth && set.size > count) {
    values.push(`... ${set.size - count} more items`);
  }

  return result;
}

/**
 * Truncate a string to a maximum length
 */
function truncateString(str: string, maxLength: number): string {
  if (str.length <= maxLength) {
    return str;
  }
  return str.slice(0, maxLength - 3) + '...';
}

/**
 * Estimate the size of a value when serialized
 */
function estimateSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return 0;
  }
}

/**
 * Remove an extra from a scope
 *
 * @param scope - The scope data object
 * @param key - The extra key to remove
 */
export function removeExtra(scope: ScopeData, key: string): void {
  delete scope.extras[key];
}

/**
 * Clear all extras from a scope
 *
 * @param scope - The scope data object
 */
export function clearExtras(scope: ScopeData): void {
  scope.extras = {};
}

/**
 * Get an extra value from a scope
 *
 * @param scope - The scope data object
 * @param key - The extra key
 * @returns The extra value or undefined
 */
export function getExtra(scope: ScopeData, key: string): unknown {
  return scope.extras[key];
}

/**
 * Get all extras from a scope
 *
 * @param scope - The scope data object
 * @returns Copy of the extras object
 */
export function getExtras(scope: ScopeData): Record<string, unknown> {
  return { ...scope.extras };
}

/**
 * Merge extras from multiple sources
 *
 * Later sources override earlier ones.
 *
 * @param sources - Array of extras objects to merge
 * @returns Merged extras object
 */
export function mergeExtras(
  ...sources: (Record<string, unknown> | undefined)[]
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  let currentSize = 0;

  for (const source of sources) {
    if (source && typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        const normalized = normalizeExtra(value);
        const newSize = estimateSize(normalized);

        if (currentSize + newSize <= MAX_EXTRAS_SIZE) {
          result[key] = normalized;
          currentSize += newSize;
        }
      }
    }
  }

  return result;
}
