/**
 * Context Management
 *
 * Contexts provide structured data about the environment where an event occurred.
 * Common contexts include browser, device, OS, app, etc.
 */

import type { ScopeData } from '../../types/scope';
import type { Contexts } from '../../types/sentry';

/**
 * Maximum depth for normalizing context values
 */
const DEFAULT_MAX_DEPTH = 3;

/**
 * Maximum number of keys at each level
 */
const DEFAULT_MAX_BREADTH = 100;

/**
 * Maximum string length for context values
 */
const MAX_STRING_LENGTH = 1024;

/**
 * Set a named context on a scope
 *
 * Setting a context to null removes it.
 *
 * @param scope - The scope data object
 * @param name - The context name (e.g., 'browser', 'device', 'custom')
 * @param context - The context data or null to remove
 */
export function setContext(
  scope: ScopeData,
  name: string,
  context: Record<string, unknown> | null
): void {
  if (!name || typeof name !== 'string') {
    return;
  }

  if (context === null) {
    // Remove the context
    delete scope.contexts[name];
  } else if (typeof context === 'object') {
    // Normalize and set the context
    scope.contexts[name] = normalizeContext(context);
  }
}

/**
 * Normalize a context object for safe serialization
 *
 * This handles:
 * - Circular references
 * - Deep nesting
 * - Non-serializable values
 * - Large objects
 *
 * @param context - The context to normalize
 * @param depth - Maximum depth to traverse (default: 3)
 * @param maxBreadth - Maximum keys at each level (default: 100)
 * @returns Normalized context
 */
export function normalizeContext(
  context: Record<string, unknown>,
  depth: number = DEFAULT_MAX_DEPTH,
  maxBreadth: number = DEFAULT_MAX_BREADTH
): Record<string, unknown> {
  return normalizeValue(
    context,
    depth,
    maxBreadth,
    new WeakSet()
  ) as Record<string, unknown>;
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
    return `[Function: ${value.name || 'anonymous'}]`;
  }

  // Handle objects
  if (typeof value === 'object') {
    // Check for circular references
    if (seen.has(value)) {
      return '[Circular]';
    }

    // Check depth limit
    if (depth <= 0) {
      return Array.isArray(value) ? '[Array]' : '[Object]';
    }

    // Mark as seen
    seen.add(value);

    // Handle arrays
    if (Array.isArray(value)) {
      return normalizeArray(value, depth - 1, maxBreadth, seen);
    }

    // Handle special object types
    if (value instanceof Error) {
      return normalizeError(value);
    }

    if (value instanceof Date) {
      return value.toISOString();
    }

    if (value instanceof RegExp) {
      return value.toString();
    }

    if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer) {
      return `[ArrayBuffer: ${value.byteLength} bytes]`;
    }

    if (typeof Uint8Array !== 'undefined' && ArrayBuffer.isView(value)) {
      return `[TypedArray: ${value.byteLength} bytes]`;
    }

    if (typeof Map !== 'undefined' && value instanceof Map) {
      return normalizeMap(value, depth - 1, maxBreadth, seen);
    }

    if (typeof Set !== 'undefined' && value instanceof Set) {
      return normalizeSet(value, depth - 1, maxBreadth, seen);
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

  for (const key of Object.keys(obj)) {
    if (count >= maxBreadth) {
      result['...'] = `${Object.keys(obj).length - count} more keys`;
      break;
    }

    try {
      result[key] = normalizeValue(obj[key], depth, maxBreadth, seen);
      count++;
    } catch {
      result[key] = '[Error accessing property]';
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
 * Normalize an Error object
 */
function normalizeError(error: Error): Record<string, unknown> {
  return {
    name: error.name,
    message: truncateString(error.message, MAX_STRING_LENGTH),
    stack: error.stack ? truncateString(error.stack, MAX_STRING_LENGTH * 4) : undefined,
  };
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
  const result: Record<string, unknown> = {};
  let count = 0;

  map.forEach((value, key) => {
    if (count >= maxBreadth) {
      return;
    }

    const keyStr = typeof key === 'string' ? key : String(key);
    result[keyStr] = normalizeValue(value, depth, maxBreadth, seen);
    count++;
  });

  if (count >= maxBreadth && map.size > count) {
    result['...'] = `${map.size - count} more entries`;
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
): unknown[] {
  const result: unknown[] = [];
  let count = 0;

  set.forEach((value) => {
    if (count >= maxBreadth) {
      return;
    }

    result.push(normalizeValue(value, depth, maxBreadth, seen));
    count++;
  });

  if (count >= maxBreadth && set.size > count) {
    result.push(`... ${set.size - count} more items`);
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
 * Get a named context from a scope
 *
 * @param scope - The scope data object
 * @param name - The context name
 * @returns The context data or undefined
 */
export function getContext(
  scope: ScopeData,
  name: string
): Record<string, unknown> | undefined {
  return scope.contexts[name] as Record<string, unknown> | undefined;
}

/**
 * Get all contexts from a scope
 *
 * @param scope - The scope data object
 * @returns Copy of the contexts object
 */
export function getContexts(scope: ScopeData): Contexts {
  // Deep clone to prevent mutation
  return JSON.parse(JSON.stringify(scope.contexts));
}

/**
 * Clear all contexts from a scope
 *
 * @param scope - The scope data object
 */
export function clearContexts(scope: ScopeData): void {
  scope.contexts = {};
}

/**
 * Merge contexts from multiple sources
 *
 * Later sources override earlier ones at the context level,
 * but individual context properties are deep merged.
 *
 * @param sources - Array of context objects to merge
 * @returns Merged contexts object
 */
export function mergeContexts(...sources: (Contexts | undefined)[]): Contexts {
  const result: Contexts = {};

  for (const source of sources) {
    if (source && typeof source === 'object') {
      for (const [name, context] of Object.entries(source)) {
        if (context && typeof context === 'object') {
          // Deep merge the context
          result[name] = {
            ...(result[name] as Record<string, unknown> || {}),
            ...normalizeContext(context as Record<string, unknown>),
          };
        }
      }
    }
  }

  return result;
}

/**
 * Set browser context from the current environment
 */
export function setBrowserContext(scope: ScopeData): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  const browserContext: Record<string, unknown> = {};

  // User agent parsing (basic)
  const ua = navigator.userAgent;
  browserContext.name = getBrowserName(ua);
  browserContext.version = getBrowserVersion(ua);

  setContext(scope, 'browser', browserContext);
}

/**
 * Set device context from the current environment
 */
export function setDeviceContext(scope: ScopeData): void {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return;
  }

  const deviceContext: Record<string, unknown> = {};

  // Screen info
  if (typeof screen !== 'undefined') {
    deviceContext.screen_resolution = `${screen.width}x${screen.height}`;
    deviceContext.screen_density = window.devicePixelRatio;
  }

  // Online status
  if (typeof navigator.onLine !== 'undefined') {
    deviceContext.online = navigator.onLine;
  }

  // Memory info (if available)
  const nav = navigator as any;
  if (nav.deviceMemory) {
    deviceContext.memory_size = nav.deviceMemory * 1024 * 1024 * 1024; // Convert GB to bytes
  }

  setContext(scope, 'device', deviceContext);
}

/**
 * Set OS context from the current environment
 */
export function setOSContext(scope: ScopeData): void {
  if (typeof navigator === 'undefined') {
    return;
  }

  const ua = navigator.userAgent;
  const osContext: Record<string, unknown> = {};

  osContext.name = getOSName(ua);
  osContext.version = getOSVersion(ua);

  setContext(scope, 'os', osContext);
}

// Helper functions for parsing user agent
function getBrowserName(ua: string): string {
  if (ua.includes('Firefox')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome')) return 'Chrome';
  if (ua.includes('Safari')) return 'Safari';
  if (ua.includes('Opera') || ua.includes('OPR')) return 'Opera';
  if (ua.includes('MSIE') || ua.includes('Trident')) return 'IE';
  return 'Unknown';
}

function getBrowserVersion(ua: string): string | undefined {
  let match: RegExpMatchArray | null;

  if ((match = ua.match(/Firefox\/(\d+\.\d+)/))) return match[1];
  if ((match = ua.match(/Edg\/(\d+\.\d+)/))) return match[1];
  if ((match = ua.match(/Chrome\/(\d+\.\d+)/))) return match[1];
  if ((match = ua.match(/Version\/(\d+\.\d+).*Safari/))) return match[1];
  if ((match = ua.match(/(?:Opera|OPR)\/(\d+\.\d+)/))) return match[1];
  if ((match = ua.match(/(?:MSIE |rv:)(\d+\.\d+)/))) return match[1];

  return undefined;
}

function getOSName(ua: string): string {
  if (ua.includes('Windows')) return 'Windows';
  if (ua.includes('Mac OS X') || ua.includes('Macintosh')) return 'macOS';
  if (ua.includes('Linux')) return 'Linux';
  if (ua.includes('Android')) return 'Android';
  if (ua.includes('iPhone') || ua.includes('iPad') || ua.includes('iPod')) return 'iOS';
  if (ua.includes('CrOS')) return 'Chrome OS';
  return 'Unknown';
}

function getOSVersion(ua: string): string | undefined {
  let match: RegExpMatchArray | null;

  if ((match = ua.match(/Windows NT (\d+\.\d+)/))) {
    // Map Windows NT versions
    const version = match[1];
    const versions: Record<string, string> = {
      '10.0': '10',
      '6.3': '8.1',
      '6.2': '8',
      '6.1': '7',
      '6.0': 'Vista',
      '5.1': 'XP',
    };
    return versions[version] || version;
  }

  if ((match = ua.match(/Mac OS X (\d+[._]\d+(?:[._]\d+)?)/))) {
    return match[1].replace(/_/g, '.');
  }

  if ((match = ua.match(/Android (\d+(?:\.\d+)?)/))) {
    return match[1];
  }

  if ((match = ua.match(/(?:iPhone|iPad|iPod).*OS (\d+[._]\d+)/))) {
    return match[1].replace(/_/g, '.');
  }

  return undefined;
}
