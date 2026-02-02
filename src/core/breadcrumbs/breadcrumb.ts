/**
 * Breadcrumb Management
 *
 * Breadcrumbs are a trail of events that happened before an error.
 * They provide context about what the user was doing leading up to the error.
 */

import type { Breadcrumb, BreadcrumbHint, SeverityLevel } from '../../types/sentry';
import type { ScopeData } from '../../types/scope';

/**
 * Breadcrumb types
 */
export type BreadcrumbType =
  | 'default'
  | 'debug'
  | 'error'
  | 'navigation'
  | 'http'
  | 'info'
  | 'query'
  | 'transaction'
  | 'ui'
  | 'user';

/**
 * Callback for modifying breadcrumbs before they are added
 */
export type BeforeBreadcrumbCallback = (
  breadcrumb: Breadcrumb,
  hint?: BreadcrumbHint
) => Breadcrumb | null;

/**
 * Options for adding breadcrumbs
 */
export interface AddBreadcrumbOptions {
  /**
   * Maximum number of breadcrumbs to keep
   */
  maxBreadcrumbs?: number;

  /**
   * Callback to modify or filter breadcrumbs
   */
  beforeBreadcrumb?: BeforeBreadcrumbCallback;
}

/**
 * Default maximum number of breadcrumbs
 */
export const DEFAULT_MAX_BREADCRUMBS = 100;

/**
 * Maximum data payload size for breadcrumbs
 */
const MAX_BREADCRUMB_DATA_SIZE = 4096;

/**
 * Add a breadcrumb to a scope
 *
 * Breadcrumbs are stored in FIFO order and limited by maxBreadcrumbs.
 * The beforeBreadcrumb callback can modify or drop breadcrumbs.
 *
 * @param scope - The scope data object
 * @param breadcrumb - The breadcrumb to add
 * @param hint - Optional hint data for the callback
 * @param options - Options for adding the breadcrumb
 */
export function addBreadcrumb(
  scope: ScopeData,
  breadcrumb: Breadcrumb,
  hint?: BreadcrumbHint,
  options: AddBreadcrumbOptions = {}
): void {
  const { maxBreadcrumbs = DEFAULT_MAX_BREADCRUMBS, beforeBreadcrumb } = options;

  // Validate and normalize the breadcrumb
  let normalizedBreadcrumb = validateBreadcrumb(breadcrumb);

  if (!normalizedBreadcrumb) {
    return;
  }

  // Run through beforeBreadcrumb callback if provided
  if (beforeBreadcrumb) {
    try {
      const result = beforeBreadcrumb(normalizedBreadcrumb, hint);
      if (result === null) {
        // Callback dropped the breadcrumb
        return;
      }
      normalizedBreadcrumb = result;
    } catch (error) {
      console.warn('[Logger] beforeBreadcrumb callback threw an error:', error);
      // Continue with the original breadcrumb
    }
  }

  // Add to the scope
  scope.breadcrumbs.push(normalizedBreadcrumb);

  // Enforce FIFO limit
  while (scope.breadcrumbs.length > maxBreadcrumbs) {
    scope.breadcrumbs.shift();
  }
}

/**
 * Validate and normalize a breadcrumb
 *
 * @param breadcrumb - The breadcrumb to validate
 * @returns The normalized breadcrumb or null if invalid
 */
export function validateBreadcrumb(breadcrumb: Breadcrumb): Breadcrumb | null {
  if (!breadcrumb || typeof breadcrumb !== 'object') {
    return null;
  }

  const normalized: Breadcrumb = {};

  // Validate type
  if (breadcrumb.type !== undefined) {
    if (typeof breadcrumb.type === 'string' && isValidBreadcrumbType(breadcrumb.type)) {
      normalized.type = breadcrumb.type;
    } else {
      normalized.type = 'default';
    }
  }

  // Validate category
  if (breadcrumb.category !== undefined) {
    if (typeof breadcrumb.category === 'string') {
      normalized.category = truncateString(breadcrumb.category, 64);
    }
  }

  // Validate message
  if (breadcrumb.message !== undefined) {
    if (typeof breadcrumb.message === 'string') {
      normalized.message = truncateString(breadcrumb.message, 1024);
    }
  }

  // Validate level
  if (breadcrumb.level !== undefined) {
    if (isValidSeverityLevel(breadcrumb.level)) {
      normalized.level = breadcrumb.level;
    }
  }

  // Validate timestamp
  if (breadcrumb.timestamp !== undefined) {
    if (typeof breadcrumb.timestamp === 'number') {
      normalized.timestamp = breadcrumb.timestamp;
    }
  } else {
    // Add timestamp if not provided
    normalized.timestamp = Date.now() / 1000;
  }

  // Validate and normalize data
  if (breadcrumb.data !== undefined) {
    if (typeof breadcrumb.data === 'object' && breadcrumb.data !== null) {
      normalized.data = normalizeBreadcrumbData(breadcrumb.data);
    }
  }

  // Breadcrumb must have at least a message, category, or type
  if (!normalized.message && !normalized.category && !normalized.type) {
    return null;
  }

  return normalized;
}

/**
 * Check if a value is a valid breadcrumb type
 */
function isValidBreadcrumbType(type: string): type is BreadcrumbType {
  const validTypes: BreadcrumbType[] = [
    'default',
    'debug',
    'error',
    'navigation',
    'http',
    'info',
    'query',
    'transaction',
    'ui',
    'user',
  ];
  return validTypes.includes(type as BreadcrumbType);
}

/**
 * Check if a value is a valid severity level
 */
function isValidSeverityLevel(level: unknown): level is SeverityLevel {
  const validLevels: SeverityLevel[] = [
    'fatal',
    'error',
    'warning',
    'log',
    'info',
    'debug',
  ];
  return typeof level === 'string' && validLevels.includes(level as SeverityLevel);
}

/**
 * Normalize breadcrumb data
 */
function normalizeBreadcrumbData(
  data: Record<string, unknown>
): Record<string, unknown> {
  const normalized: Record<string, unknown> = {};
  let totalSize = 0;

  for (const [key, value] of Object.entries(data)) {
    // Normalize key
    const normalizedKey = truncateString(key, 32);

    // Normalize value
    let normalizedValue: unknown;

    if (value === null || value === undefined) {
      normalizedValue = value;
    } else if (typeof value === 'string') {
      normalizedValue = truncateString(value, 512);
    } else if (typeof value === 'number' || typeof value === 'boolean') {
      normalizedValue = value;
    } else if (typeof value === 'object') {
      try {
        const json = JSON.stringify(value);
        if (json.length > 512) {
          normalizedValue = truncateString(json, 512);
        } else {
          normalizedValue = value;
        }
      } catch {
        normalizedValue = '[Object]';
      }
    } else {
      normalizedValue = String(value);
    }

    // Check size limit
    const entrySize =
      normalizedKey.length +
      (typeof normalizedValue === 'string'
        ? normalizedValue.length
        : JSON.stringify(normalizedValue).length);

    if (totalSize + entrySize > MAX_BREADCRUMB_DATA_SIZE) {
      break;
    }

    normalized[normalizedKey] = normalizedValue;
    totalSize += entrySize;
  }

  return normalized;
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
 * Create a breadcrumb from common parameters
 */
export function createBreadcrumb(
  message: string,
  options: {
    type?: BreadcrumbType;
    category?: string;
    level?: SeverityLevel;
    data?: Record<string, unknown>;
  } = {}
): Breadcrumb {
  return {
    type: options.type || 'default',
    category: options.category,
    message,
    level: options.level,
    timestamp: Date.now() / 1000,
    data: options.data,
  };
}

/**
 * Create a navigation breadcrumb
 */
export function createNavigationBreadcrumb(
  from: string,
  to: string
): Breadcrumb {
  return {
    type: 'navigation',
    category: 'navigation',
    timestamp: Date.now() / 1000,
    data: {
      from,
      to,
    },
  };
}

/**
 * Create an HTTP breadcrumb
 */
export function createHttpBreadcrumb(
  method: string,
  url: string,
  statusCode?: number,
  duration?: number
): Breadcrumb {
  return {
    type: 'http',
    category: 'http',
    timestamp: Date.now() / 1000,
    data: {
      method: method.toUpperCase(),
      url,
      status_code: statusCode,
      duration,
    },
    level: statusCode && statusCode >= 400 ? 'error' : undefined,
  };
}

/**
 * Create a UI breadcrumb (click, input, etc.)
 */
export function createUIBreadcrumb(
  action: string,
  target?: string,
  data?: Record<string, unknown>
): Breadcrumb {
  return {
    type: 'ui',
    category: `ui.${action}`,
    message: target,
    timestamp: Date.now() / 1000,
    data,
  };
}

/**
 * Create a console breadcrumb
 */
export function createConsoleBreadcrumb(
  level: 'log' | 'info' | 'warn' | 'error' | 'debug',
  args: unknown[]
): Breadcrumb {
  const message = args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (arg instanceof Error) return arg.message;
      try {
        return JSON.stringify(arg);
      } catch {
        return String(arg);
      }
    })
    .join(' ');

  const severityMap: Record<string, SeverityLevel> = {
    log: 'log',
    info: 'info',
    warn: 'warning',
    error: 'error',
    debug: 'debug',
  };

  return {
    type: level === 'error' ? 'error' : 'debug',
    category: 'console',
    message: truncateString(message, 1024),
    level: severityMap[level],
    timestamp: Date.now() / 1000,
  };
}

/**
 * Create a query breadcrumb (for database queries)
 */
export function createQueryBreadcrumb(
  query: string,
  category: string = 'query',
  duration?: number
): Breadcrumb {
  return {
    type: 'query',
    category,
    message: truncateString(query, 256),
    timestamp: Date.now() / 1000,
    data: duration !== undefined ? { duration } : undefined,
  };
}

/**
 * Clear all breadcrumbs from a scope
 */
export function clearBreadcrumbs(scope: ScopeData): void {
  scope.breadcrumbs = [];
}

/**
 * Get all breadcrumbs from a scope
 */
export function getBreadcrumbs(scope: ScopeData): Breadcrumb[] {
  return [...scope.breadcrumbs];
}

/**
 * Get the most recent breadcrumbs from a scope
 */
export function getRecentBreadcrumbs(
  scope: ScopeData,
  count: number
): Breadcrumb[] {
  return scope.breadcrumbs.slice(-count);
}

/**
 * Filter breadcrumbs by type
 */
export function filterBreadcrumbsByType(
  breadcrumbs: Breadcrumb[],
  type: BreadcrumbType
): Breadcrumb[] {
  return breadcrumbs.filter((b) => b.type === type);
}

/**
 * Filter breadcrumbs by category
 */
export function filterBreadcrumbsByCategory(
  breadcrumbs: Breadcrumb[],
  category: string
): Breadcrumb[] {
  return breadcrumbs.filter((b) => b.category === category);
}

/**
 * Filter breadcrumbs by level
 */
export function filterBreadcrumbsByLevel(
  breadcrumbs: Breadcrumb[],
  level: SeverityLevel
): Breadcrumb[] {
  return breadcrumbs.filter((b) => b.level === level);
}

/**
 * Merge breadcrumbs from multiple sources
 *
 * Combines and sorts by timestamp, removing duplicates.
 */
export function mergeBreadcrumbs(
  ...sources: (Breadcrumb[] | undefined)[]
): Breadcrumb[] {
  const allBreadcrumbs: Breadcrumb[] = [];

  for (const source of sources) {
    if (source && Array.isArray(source)) {
      allBreadcrumbs.push(...source);
    }
  }

  // Sort by timestamp
  allBreadcrumbs.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  // Remove duplicates (same timestamp and message)
  const seen = new Set<string>();
  return allBreadcrumbs.filter((b) => {
    const key = `${b.timestamp}-${b.message}-${b.category}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
