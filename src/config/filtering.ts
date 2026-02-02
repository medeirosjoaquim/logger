/**
 * Event Filtering
 *
 * Filtering logic for events, transactions, and URLs.
 * Determines whether events should be captured or ignored.
 */

import type { Event } from '../types/sentry';

/**
 * Check if a value matches a pattern.
 * Strings are matched as substrings (case-insensitive).
 * RegExp patterns are tested against the value.
 *
 * @param value - The value to match
 * @param pattern - The pattern to match against
 * @returns True if the value matches the pattern
 *
 * @example
 * ```typescript
 * matchesPattern('TypeError: foo', 'TypeError');     // true
 * matchesPattern('TypeError: foo', /^TypeError/);   // true
 * matchesPattern('ReferenceError', 'TypeError');    // false
 * ```
 */
export function matchesPattern(value: string, pattern: string | RegExp): boolean {
  if (!value || !pattern) {
    return false;
  }

  if (typeof pattern === 'string') {
    // Case-insensitive substring match
    return value.toLowerCase().includes(pattern.toLowerCase());
  }

  // RegExp match
  return pattern.test(value);
}

/**
 * Check if a value matches any pattern in an array.
 *
 * @param value - The value to match
 * @param patterns - Array of patterns to match against
 * @returns True if the value matches any pattern
 */
export function matchesAnyPattern(
  value: string,
  patterns: Array<string | RegExp>
): boolean {
  if (!value || !patterns || patterns.length === 0) {
    return false;
  }

  for (const pattern of patterns) {
    if (matchesPattern(value, pattern)) {
      return true;
    }
  }

  return false;
}

/**
 * Extract error message from an event.
 * Handles both message events and exception events.
 *
 * @param event - The event to extract message from
 * @returns Error message or empty string
 */
export function getEventMessage(event: Event): string {
  // Check for direct message
  if (typeof event.message === 'string') {
    return event.message;
  }

  if (typeof event.message === 'object' && event.message) {
    return event.message.formatted || event.message.message || '';
  }

  // Check for exception values
  if (event.exception?.values?.length) {
    const exception = event.exception.values[0];
    const type = exception.type || '';
    const value = exception.value || '';

    if (type && value) {
      return `${type}: ${value}`;
    }

    return type || value;
  }

  return '';
}

/**
 * Extract error type from an event.
 *
 * @param event - The event to extract type from
 * @returns Error type or empty string
 */
export function getEventType(event: Event): string {
  if (event.exception?.values?.length) {
    return event.exception.values[0].type || '';
  }

  return '';
}

/**
 * Check if an error event should be ignored.
 * Matches against both the error type and message.
 *
 * @param event - The event to check
 * @param ignoreErrors - Patterns to ignore
 * @returns True if the event should be ignored
 *
 * @example
 * ```typescript
 * const event = { exception: { values: [{ type: 'TypeError', value: 'foo is undefined' }] } };
 * shouldIgnoreError(event, ['TypeError']);  // true
 * shouldIgnoreError(event, [/undefined/]); // true
 * shouldIgnoreError(event, ['ReferenceError']); // false
 * ```
 */
export function shouldIgnoreError(
  event: Event,
  ignoreErrors?: Array<string | RegExp>
): boolean {
  if (!ignoreErrors || ignoreErrors.length === 0) {
    return false;
  }

  // Get the full error message
  const message = getEventMessage(event);
  if (message && matchesAnyPattern(message, ignoreErrors)) {
    return true;
  }

  // Also check just the error type
  const errorType = getEventType(event);
  if (errorType && matchesAnyPattern(errorType, ignoreErrors)) {
    return true;
  }

  // Check exception values individually
  if (event.exception?.values) {
    for (const exception of event.exception.values) {
      if (exception.type && matchesAnyPattern(exception.type, ignoreErrors)) {
        return true;
      }
      if (exception.value && matchesAnyPattern(exception.value, ignoreErrors)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a transaction should be ignored.
 *
 * @param name - Transaction name
 * @param ignoreTransactions - Patterns to ignore
 * @returns True if the transaction should be ignored
 *
 * @example
 * ```typescript
 * shouldIgnoreTransaction('GET /health', ['health']); // true
 * shouldIgnoreTransaction('GET /api/users', [/^OPTIONS/]); // false
 * ```
 */
export function shouldIgnoreTransaction(
  name: string,
  ignoreTransactions?: Array<string | RegExp>
): boolean {
  if (!name || !ignoreTransactions || ignoreTransactions.length === 0) {
    return false;
  }

  return matchesAnyPattern(name, ignoreTransactions);
}

/**
 * Check if a URL is allowed based on allow and deny patterns.
 * allowUrls takes precedence over denyUrls if both match.
 *
 * @param url - URL to check
 * @param allowUrls - Patterns for allowed URLs (whitelist)
 * @param denyUrls - Patterns for denied URLs (blocklist)
 * @returns True if the URL is allowed
 *
 * @example
 * ```typescript
 * // URL in deny list but not allow list
 * isUrlAllowed('https://example.com/api', undefined, ['example.com']); // false
 *
 * // URL in both - allow takes precedence
 * isUrlAllowed('https://example.com/api', ['example.com'], ['example.com']); // true
 *
 * // URL not in either list
 * isUrlAllowed('https://other.com', ['example.com'], ['blocked.com']); // true
 * ```
 */
export function isUrlAllowed(
  url: string,
  allowUrls?: Array<string | RegExp>,
  denyUrls?: Array<string | RegExp>
): boolean {
  if (!url) {
    return true;
  }

  // If allowUrls is specified, URL must match one of them
  if (allowUrls && allowUrls.length > 0) {
    return matchesAnyPattern(url, allowUrls);
  }

  // If denyUrls is specified, URL must not match any of them
  if (denyUrls && denyUrls.length > 0) {
    return !matchesAnyPattern(url, denyUrls);
  }

  // No filters, allow all URLs
  return true;
}

/**
 * Get the URL from an event.
 * Extracts from request, tags, or contexts.
 *
 * @param event - The event to extract URL from
 * @returns URL or undefined
 */
export function getEventUrl(event: Event): string | undefined {
  // Check request URL
  if (event.request?.url) {
    return event.request.url;
  }

  // Check tags
  if (event.tags?.url && typeof event.tags.url === 'string') {
    return event.tags.url;
  }

  // Check browser context
  const browser = event.contexts?.browser as Record<string, unknown> | undefined;
  if (browser?.url && typeof browser.url === 'string') {
    return browser.url;
  }

  return undefined;
}

/**
 * Check if an event should be filtered based on URL.
 *
 * @param event - The event to check
 * @param allowUrls - Patterns for allowed URLs
 * @param denyUrls - Patterns for denied URLs
 * @returns True if the event should be dropped
 */
export function shouldFilterByUrl(
  event: Event,
  allowUrls?: Array<string | RegExp>,
  denyUrls?: Array<string | RegExp>
): boolean {
  const url = getEventUrl(event);

  if (!url) {
    // No URL, don't filter
    return false;
  }

  return !isUrlAllowed(url, allowUrls, denyUrls);
}

/**
 * Check if a URL matches trace propagation targets.
 *
 * @param url - URL to check
 * @param targets - Trace propagation target patterns
 * @returns True if trace headers should be attached
 */
export function shouldPropagateTrace(
  url: string,
  targets?: Array<string | RegExp>
): boolean {
  if (!url || !targets || targets.length === 0) {
    return false;
  }

  return matchesAnyPattern(url, targets);
}

/**
 * Filter options for event filtering.
 */
export interface FilterOptions {
  ignoreErrors?: Array<string | RegExp>;
  ignoreTransactions?: Array<string | RegExp>;
  allowUrls?: Array<string | RegExp>;
  denyUrls?: Array<string | RegExp>;
}

/**
 * Check if an event should be filtered/dropped.
 *
 * @param event - The event to check
 * @param options - Filter options
 * @returns True if the event should be dropped
 */
export function shouldFilterEvent(event: Event, options: FilterOptions): boolean {
  const { ignoreErrors, ignoreTransactions, allowUrls, denyUrls } = options;

  // Check error filtering
  if (event.type === undefined || event.type === 'event') {
    if (shouldIgnoreError(event, ignoreErrors)) {
      return true;
    }
  }

  // Check transaction filtering
  if (event.type === 'transaction' && event.transaction) {
    if (shouldIgnoreTransaction(event.transaction, ignoreTransactions)) {
      return true;
    }
  }

  // Check URL filtering
  if (shouldFilterByUrl(event, allowUrls, denyUrls)) {
    return true;
  }

  return false;
}

/**
 * Create a filter function from options.
 *
 * @param options - Filter options
 * @returns Filter function that returns true for events to drop
 */
export function createEventFilter(
  options: FilterOptions
): (event: Event) => boolean {
  return (event: Event) => shouldFilterEvent(event, options);
}

/**
 * Common error patterns to ignore (used as defaults).
 * These are typically browser errors that aren't actionable.
 */
export const COMMON_IGNORE_ERRORS: Array<string | RegExp> = [
  // Random plugins/extensions
  'top.GLOBALS',
  // See: http://blog.errorception.com/2012/03/tale-of-unfindable-js-error.html
  'originalCreateNotification',
  'canvas.contentDocument',
  'MyApp_RemoveAllHighlights',
  'http://tt.epicplay.com',
  "Can't find variable: ZiteReader",
  'jigsaw is not defined',
  'ComboSearch is not defined',
  'http://loading.retry.widdit.com/',
  'atomicFindClose',
  // Facebook borance
  'fb_xd_fragment',
  // ISP "optimizations"
  'bmi_SafeAddOnload',
  'EBCallBackMessageReceived',
  // See https://groups.google.com/a/chromium.org/forum/#!topic/chromium-discuss/7VU0_VvC7mE
  '_telerik',
  // Various browser extension errors
  /^Script error\.?$/,
  /^Javascript error: Script error\.? on line 0$/,
  // Chrome extensions
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  // Safari extensions
  /^safari-extension:\/\//,
  // Edge extensions
  /^ms-browser-extension:\/\//,
];

/**
 * Common URL patterns to deny (used as defaults).
 * These are typically third-party scripts that produce errors.
 */
export const COMMON_DENY_URLS: Array<string | RegExp> = [
  // Google Adsense
  /pagead\/js/i,
  // Facebook
  /graph\.facebook\.com/i,
  // Woopra
  /static\.woopra\.com\/js/i,
  // Chrome extensions
  /extensions\//i,
  /^chrome:\/\//i,
  /^chrome-extension:\/\//i,
  // Firefox extensions
  /^moz-extension:\/\//i,
  // Safari extensions
  /^safari-extension:\/\//i,
  /^safari-web-extension:\/\//i,
  // Edge extensions
  /^ms-browser-extension:\/\//i,
];
