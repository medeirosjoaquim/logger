/**
 * User Management
 *
 * Manages user information attached to events for user-specific debugging.
 */

import type { ScopeData } from '../../types/scope';
import type { User } from '../../types/sentry';

/**
 * Special value for automatic IP address resolution
 */
export const AUTO_IP_ADDRESS = '{{auto}}';

/**
 * Set user information on a scope
 *
 * Setting user to null clears the user information.
 *
 * @param scope - The scope data object
 * @param user - The user information or null to clear
 */
export function setUser(scope: ScopeData, user: User | null): void {
  if (user === null) {
    scope.user = undefined;
  } else {
    // Validate and normalize user data
    scope.user = normalizeUser(user);
  }
}

/**
 * Normalize user data for safe storage
 */
function normalizeUser(user: User): User {
  const normalized: User = {};

  // Copy known fields with validation
  if (user.id !== undefined) {
    if (typeof user.id === 'string' || typeof user.id === 'number') {
      normalized.id = user.id;
    } else {
      normalized.id = String(user.id);
    }
  }

  if (user.email !== undefined) {
    if (typeof user.email === 'string' && isValidEmail(user.email)) {
      normalized.email = user.email;
    }
  }

  if (user.username !== undefined) {
    if (typeof user.username === 'string') {
      normalized.username = truncateString(user.username, 128);
    }
  }

  if (user.ip_address !== undefined) {
    if (typeof user.ip_address === 'string') {
      // Keep {{auto}} as-is for server-side resolution
      if (user.ip_address === AUTO_IP_ADDRESS || isValidIPAddress(user.ip_address)) {
        normalized.ip_address = user.ip_address;
      }
    }
  }

  if (user.segment !== undefined) {
    if (typeof user.segment === 'string') {
      normalized.segment = truncateString(user.segment, 64);
    }
  }

  if (user.name !== undefined) {
    if (typeof user.name === 'string') {
      normalized.name = truncateString(user.name, 256);
    }
  }

  // Copy geo data
  if (user.geo && typeof user.geo === 'object') {
    normalized.geo = {};

    if (user.geo.country_code && typeof user.geo.country_code === 'string') {
      // Country codes should be 2 characters (ISO 3166-1 alpha-2)
      normalized.geo.country_code = user.geo.country_code.toUpperCase().slice(0, 2);
    }

    if (user.geo.region && typeof user.geo.region === 'string') {
      normalized.geo.region = truncateString(user.geo.region, 64);
    }

    if (user.geo.city && typeof user.geo.city === 'string') {
      normalized.geo.city = truncateString(user.geo.city, 64);
    }

    // Remove geo if empty
    if (Object.keys(normalized.geo).length === 0) {
      delete normalized.geo;
    }
  }

  // Copy custom data with normalization
  if (user.data && typeof user.data === 'object') {
    normalized.data = normalizeUserData(user.data);
  }

  return normalized;
}

/**
 * Normalize custom user data
 */
function normalizeUserData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  const maxKeys = 50;
  let count = 0;

  for (const [key, value] of Object.entries(data)) {
    if (count >= maxKeys) {
      break;
    }

    // Skip non-string keys
    if (typeof key !== 'string') {
      continue;
    }

    // Truncate long keys
    const normalizedKey = truncateString(key, 32);

    // Normalize value
    normalized[normalizedKey] = normalizeValue(value);
    count++;
  }

  return normalized;
}

/**
 * Normalize a single value
 */
function normalizeValue(value: unknown): unknown {
  if (value === null || value === undefined) {
    return value;
  }

  if (typeof value === 'string') {
    return truncateString(value, 512);
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 10).map(normalizeValue);
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
 * Simple email validation
 */
function isValidEmail(email: string): boolean {
  // Basic email pattern - not exhaustive but catches most cases
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Validate an IP address (IPv4 or IPv6)
 */
function isValidIPAddress(ip: string): boolean {
  // IPv4 pattern
  const ipv4Pattern =
    /^(\d{1,3}\.){3}\d{1,3}$/;

  // IPv6 pattern (simplified)
  const ipv6Pattern =
    /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;

  if (ipv4Pattern.test(ip)) {
    // Validate IPv4 octets
    const parts = ip.split('.');
    return parts.every((part) => {
      const num = parseInt(part, 10);
      return num >= 0 && num <= 255;
    });
  }

  return ipv6Pattern.test(ip);
}

/**
 * Resolve the user's IP address
 *
 * This handles the special {{auto}} value by:
 * - On the client: leaving it as-is for server-side resolution
 * - On the server: resolving it from the request
 *
 * @param user - The user object
 * @param sendDefaultPii - Whether default PII is enabled
 * @returns User with resolved IP address
 */
export function resolveUserIpAddress(
  user: User,
  sendDefaultPii: boolean
): User {
  // If user has no IP address, nothing to resolve
  if (!user.ip_address) {
    return user;
  }

  // If not {{auto}}, keep as-is
  if (user.ip_address !== AUTO_IP_ADDRESS) {
    return user;
  }

  // {{auto}} handling:
  // - On client: leave as-is (server will resolve from request headers)
  // - If sendDefaultPii is false, remove the IP address
  if (!sendDefaultPii) {
    const { ip_address: _, ...userWithoutIp } = user;
    return userWithoutIp;
  }

  // In browser, we can't get the real IP, so leave {{auto}}
  // The server-side endpoint will resolve it from X-Forwarded-For or similar
  return user;
}

/**
 * Get user information from a scope
 *
 * @param scope - The scope data object
 * @returns The user information or undefined
 */
export function getUser(scope: ScopeData): User | undefined {
  return scope.user ? { ...scope.user } : undefined;
}

/**
 * Clear user information from a scope
 *
 * @param scope - The scope data object
 */
export function clearUser(scope: ScopeData): void {
  scope.user = undefined;
}

/**
 * Update specific user fields without replacing the entire user
 *
 * @param scope - The scope data object
 * @param updates - Partial user data to merge
 */
export function updateUser(scope: ScopeData, updates: Partial<User>): void {
  if (!scope.user) {
    scope.user = normalizeUser(updates);
  } else {
    scope.user = normalizeUser({ ...scope.user, ...updates });
  }
}

/**
 * Set user ID
 *
 * @param scope - The scope data object
 * @param id - The user ID
 */
export function setUserId(scope: ScopeData, id: string | number): void {
  updateUser(scope, { id });
}

/**
 * Set user email
 *
 * @param scope - The scope data object
 * @param email - The user email
 */
export function setUserEmail(scope: ScopeData, email: string): void {
  updateUser(scope, { email });
}

/**
 * Set user IP address
 *
 * @param scope - The scope data object
 * @param ipAddress - The IP address or {{auto}}
 */
export function setUserIpAddress(scope: ScopeData, ipAddress: string): void {
  updateUser(scope, { ip_address: ipAddress });
}

/**
 * Set user to auto-detect IP address
 *
 * @param scope - The scope data object
 */
export function setAutoIpAddress(scope: ScopeData): void {
  updateUser(scope, { ip_address: AUTO_IP_ADDRESS });
}

/**
 * Merge user data from multiple sources
 *
 * Later sources override earlier ones.
 *
 * @param sources - Array of user objects to merge
 * @returns Merged user object
 */
export function mergeUsers(...sources: (User | undefined)[]): User | undefined {
  let result: User | undefined;

  for (const source of sources) {
    if (source) {
      if (!result) {
        result = { ...source };
      } else {
        result = { ...result, ...source };

        // Deep merge geo
        if (source.geo) {
          result.geo = { ...result.geo, ...source.geo };
        }

        // Deep merge data
        if (source.data) {
          result.data = { ...result.data, ...source.data };
        }
      }
    }
  }

  return result ? normalizeUser(result) : undefined;
}

/**
 * Check if a user object has any identifying information
 *
 * @param user - The user object
 * @returns Whether the user has identifying info
 */
export function hasUserIdentity(user: User | undefined): boolean {
  if (!user) {
    return false;
  }

  return !!(
    user.id ||
    user.email ||
    user.username ||
    (user.ip_address && user.ip_address !== AUTO_IP_ADDRESS)
  );
}

/**
 * Anonymize a user by removing identifying information
 *
 * Keeps non-identifying data like segment and geo.
 *
 * @param user - The user object
 * @returns Anonymized user object
 */
export function anonymizeUser(user: User): User {
  const anonymized: User = {};

  // Keep non-identifying fields
  if (user.segment) {
    anonymized.segment = user.segment;
  }

  if (user.geo) {
    anonymized.geo = { ...user.geo };
  }

  // Remove identifying fields
  // id, email, username, ip_address, name are not copied

  return anonymized;
}
