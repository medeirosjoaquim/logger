/**
 * Tag Management
 *
 * Tags are key-value pairs that are indexed and searchable in Sentry.
 * They have strict validation rules for keys and values.
 */

import type { ScopeData } from '../../types/scope';
import type { Primitive } from '../../types/sentry';

/**
 * Maximum length for tag keys
 */
export const TAG_KEY_MAX_LENGTH = 32;

/**
 * Maximum length for tag values
 */
export const TAG_VALUE_MAX_LENGTH = 200;

/**
 * Pattern for valid tag keys
 * Only alphanumeric characters, dots, underscores, colons, and hyphens
 */
export const TAG_KEY_PATTERN = /^[a-zA-Z0-9._:-]+$/;

/**
 * Reserved tag keys that cannot be set by users
 */
const RESERVED_TAGS = new Set([
  'level',
  'logger',
  'server_name',
  'transaction',
  'url',
  'release',
  'environment',
  'user',
  'handled',
  'mechanism',
]);

/**
 * Validate a tag key
 *
 * @param key - The tag key to validate
 * @returns Whether the key is valid
 */
export function validateTagKey(key: string): boolean {
  if (typeof key !== 'string') {
    return false;
  }

  // Check length
  if (key.length === 0 || key.length > TAG_KEY_MAX_LENGTH) {
    return false;
  }

  // Check pattern
  if (!TAG_KEY_PATTERN.test(key)) {
    return false;
  }

  return true;
}

/**
 * Validate a tag value
 *
 * @param value - The tag value to validate
 * @returns Whether the value is valid
 */
export function validateTagValue(value: string): boolean {
  if (typeof value !== 'string') {
    return false;
  }

  // Check length
  if (value.length > TAG_VALUE_MAX_LENGTH) {
    return false;
  }

  return true;
}

/**
 * Check if a tag key is reserved
 *
 * @param key - The tag key to check
 * @returns Whether the key is reserved
 */
export function isReservedTag(key: string): boolean {
  return RESERVED_TAGS.has(key.toLowerCase());
}

/**
 * Sanitize a tag key and value pair
 *
 * Returns the sanitized pair, or null if the tag should be dropped.
 *
 * @param key - The tag key
 * @param value - The tag value
 * @returns The sanitized [key, value] pair or null
 */
export function sanitizeTag(
  key: string,
  value: unknown
): [string, string] | null {
  // Validate key type
  if (typeof key !== 'string' || key.length === 0) {
    return null;
  }

  // Sanitize key
  let sanitizedKey = key
    // Remove invalid characters
    .replace(/[^a-zA-Z0-9._:-]/g, '_')
    // Remove leading/trailing underscores
    .replace(/^_+|_+$/g, '')
    // Collapse multiple underscores
    .replace(/_+/g, '_');

  // Truncate key if too long
  if (sanitizedKey.length > TAG_KEY_MAX_LENGTH) {
    sanitizedKey = sanitizedKey.slice(0, TAG_KEY_MAX_LENGTH);
  }

  // If key is empty after sanitization, drop it
  if (sanitizedKey.length === 0) {
    return null;
  }

  // Convert value to string
  let sanitizedValue: string;

  if (value === null) {
    sanitizedValue = 'null';
  } else if (value === undefined) {
    sanitizedValue = 'undefined';
  } else if (typeof value === 'string') {
    sanitizedValue = value;
  } else if (typeof value === 'number') {
    sanitizedValue = String(value);
  } else if (typeof value === 'boolean') {
    sanitizedValue = value ? 'true' : 'false';
  } else if (typeof value === 'object') {
    try {
      sanitizedValue = JSON.stringify(value);
    } catch {
      sanitizedValue = '[object Object]';
    }
  } else {
    sanitizedValue = String(value);
  }

  // Truncate value if too long
  if (sanitizedValue.length > TAG_VALUE_MAX_LENGTH) {
    sanitizedValue = sanitizedValue.slice(0, TAG_VALUE_MAX_LENGTH - 3) + '...';
  }

  return [sanitizedKey, sanitizedValue];
}

/**
 * Set a single tag on a scope
 *
 * @param scope - The scope data object
 * @param key - The tag key
 * @param value - The tag value (will be converted to string)
 */
export function setTag(
  scope: ScopeData,
  key: string,
  value: Primitive
): void {
  const sanitized = sanitizeTag(key, value);

  if (sanitized) {
    const [sanitizedKey, sanitizedValue] = sanitized;

    // Warn if using reserved tag (but still allow it)
    if (isReservedTag(sanitizedKey)) {
      console.warn(
        `[Logger] Setting reserved tag "${sanitizedKey}" may have unexpected behavior`
      );
    }

    scope.tags[sanitizedKey] = sanitizedValue;
  }
}

/**
 * Set multiple tags on a scope
 *
 * @param scope - The scope data object
 * @param tags - Object containing tag key-value pairs
 */
export function setTags(
  scope: ScopeData,
  tags: Record<string, Primitive>
): void {
  if (!tags || typeof tags !== 'object') {
    return;
  }

  for (const [key, value] of Object.entries(tags)) {
    setTag(scope, key, value);
  }
}

/**
 * Remove a tag from a scope
 *
 * @param scope - The scope data object
 * @param key - The tag key to remove
 */
export function removeTag(scope: ScopeData, key: string): void {
  delete scope.tags[key];
}

/**
 * Clear all tags from a scope
 *
 * @param scope - The scope data object
 */
export function clearTags(scope: ScopeData): void {
  scope.tags = {};
}

/**
 * Get a tag value from a scope
 *
 * @param scope - The scope data object
 * @param key - The tag key
 * @returns The tag value or undefined
 */
export function getTag(scope: ScopeData, key: string): Primitive | undefined {
  return scope.tags[key];
}

/**
 * Get all tags from a scope
 *
 * @param scope - The scope data object
 * @returns Copy of the tags object
 */
export function getTags(scope: ScopeData): Record<string, Primitive> {
  return { ...scope.tags };
}

/**
 * Merge tags from multiple sources
 *
 * Later sources override earlier ones.
 *
 * @param sources - Array of tag objects to merge
 * @returns Merged tags object
 */
export function mergeTags(
  ...sources: (Record<string, Primitive> | undefined)[]
): Record<string, Primitive> {
  const result: Record<string, Primitive> = {};

  for (const source of sources) {
    if (source && typeof source === 'object') {
      for (const [key, value] of Object.entries(source)) {
        const sanitized = sanitizeTag(key, value);
        if (sanitized) {
          result[sanitized[0]] = sanitized[1];
        }
      }
    }
  }

  return result;
}

/**
 * Convert tags to a format suitable for sending
 *
 * @param tags - The tags object
 * @returns Tags with all values as strings
 */
export function serializeTags(
  tags: Record<string, Primitive>
): Record<string, string> {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(tags)) {
    if (value !== undefined && value !== null) {
      result[key] = String(value);
    }
  }

  return result;
}
