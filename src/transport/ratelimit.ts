/**
 * Rate Limit Handler
 *
 * Handles rate limit responses from Sentry-compatible backends.
 * Parses rate limit headers and tracks when categories are limited.
 */

import type { TransportCategory, RateLimitState } from './types.js';

/**
 * Default rate limit duration in milliseconds (60 seconds)
 */
const DEFAULT_RATE_LIMIT_DURATION = 60000;

/**
 * Map of Sentry data categories to transport categories
 */
const CATEGORY_MAP: Record<string, TransportCategory> = {
  default: 'default',
  error: 'error',
  transaction: 'transaction',
  replay: 'replay',
  attachment: 'attachment',
  session: 'session',
  internal: 'internal',
  // Aliases
  event: 'error',
  span: 'transaction',
  metric_bucket: 'internal',
};

/**
 * RateLimiter class for managing rate limit state
 */
export class RateLimiter {
  /**
   * Map of category to timestamp when rate limit expires
   */
  private limits: Map<TransportCategory | 'all', number> = new Map();

  /**
   * Check if a category is currently rate limited
   * @param category The category to check
   * @returns True if rate limited
   */
  isRateLimited(category: TransportCategory): boolean {
    const now = Date.now();

    // Check for global rate limit
    const allLimit = this.limits.get('all');
    if (allLimit !== undefined && now < allLimit) {
      return true;
    }

    // Check for category-specific rate limit
    const categoryLimit = this.limits.get(category);
    if (categoryLimit !== undefined && now < categoryLimit) {
      return true;
    }

    // Check for 'default' category as fallback
    if (category !== 'default') {
      const defaultLimit = this.limits.get('default');
      if (defaultLimit !== undefined && now < defaultLimit) {
        return true;
      }
    }

    return false;
  }

  /**
   * Get the timestamp until which a category is rate limited
   * @param category The category to check
   * @returns Timestamp in milliseconds, or 0 if not rate limited
   */
  disabledUntil(category: TransportCategory): number {
    const now = Date.now();

    // Check for global rate limit
    const allLimit = this.limits.get('all');
    if (allLimit !== undefined && now < allLimit) {
      return allLimit;
    }

    // Check for category-specific rate limit
    const categoryLimit = this.limits.get(category);
    if (categoryLimit !== undefined && now < categoryLimit) {
      return categoryLimit;
    }

    // Check for 'default' category as fallback
    if (category !== 'default') {
      const defaultLimit = this.limits.get('default');
      if (defaultLimit !== undefined && now < defaultLimit) {
        return defaultLimit;
      }
    }

    return 0;
  }

  /**
   * Get remaining time until rate limit expires
   * @param category The category to check
   * @returns Time in milliseconds, or 0 if not rate limited
   */
  getRemainingTime(category: TransportCategory): number {
    const until = this.disabledUntil(category);
    if (until === 0) {
      return 0;
    }
    return Math.max(0, until - Date.now());
  }

  /**
   * Update rate limits from response headers
   * @param headers Response headers
   */
  updateLimits(headers: Record<string, string | null>): void {
    const now = Date.now();

    // Parse X-Sentry-Rate-Limits header (preferred)
    const rateLimits = this.getHeader(headers, 'x-sentry-rate-limits');
    if (rateLimits) {
      this.parseRateLimits(rateLimits, now);
      return;
    }

    // Fall back to Retry-After header
    const retryAfter = this.getHeader(headers, 'retry-after');
    if (retryAfter) {
      const duration = this.parseRetryAfter(retryAfter);
      this.limits.set('all', now + duration);
    }
  }

  /**
   * Get current rate limit state
   * @returns The current rate limit state
   */
  getState(): RateLimitState {
    return {
      limits: new Map(this.limits),
    };
  }

  /**
   * Clear all rate limits
   */
  clear(): void {
    this.limits.clear();
  }

  /**
   * Get a header value case-insensitively
   */
  private getHeader(headers: Record<string, string | null>, name: string): string | null {
    const lowerName = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
      if (key.toLowerCase() === lowerName) {
        return value;
      }
    }
    return null;
  }

  /**
   * Parse the X-Sentry-Rate-Limits header
   * Format: quota_limit:categories:scope:reason:namespaces, ...
   * Example: 60:error:scope:reason, 120:transaction:scope
   */
  private parseRateLimits(header: string, now: number): void {
    const limits = header.split(',');

    for (const limit of limits) {
      const parts = limit.trim().split(':');
      if (parts.length < 1) continue;

      // First part is the retry duration in seconds
      const retryAfterSeconds = parseInt(parts[0], 10);
      if (isNaN(retryAfterSeconds) || retryAfterSeconds <= 0) continue;

      const retryAfterMs = retryAfterSeconds * 1000;
      const limitUntil = now + retryAfterMs;

      // Second part is comma-separated categories (or empty for all)
      const categories = parts[1] || '';

      if (!categories) {
        // Empty categories means rate limit applies to all
        this.limits.set('all', limitUntil);
      } else {
        // Parse individual categories
        const categoryList = categories.split(';');
        for (const cat of categoryList) {
          const trimmedCat = cat.trim();
          if (!trimmedCat) continue;

          const transportCategory = this.mapCategory(trimmedCat);
          if (transportCategory) {
            const existingLimit = this.limits.get(transportCategory) || 0;
            // Use the longer rate limit if multiple apply
            if (limitUntil > existingLimit) {
              this.limits.set(transportCategory, limitUntil);
            }
          }
        }
      }
    }
  }

  /**
   * Parse Retry-After header value
   * Can be either a number of seconds or an HTTP date
   */
  private parseRetryAfter(header: string): number {
    const seconds = parseInt(header, 10);
    if (!isNaN(seconds)) {
      return seconds * 1000;
    }

    // Try to parse as HTTP date
    const date = Date.parse(header);
    if (!isNaN(date)) {
      const diff = date - Date.now();
      return Math.max(0, diff);
    }

    return DEFAULT_RATE_LIMIT_DURATION;
  }

  /**
   * Map a Sentry category string to a transport category
   */
  private mapCategory(category: string): TransportCategory | null {
    const lower = category.toLowerCase();
    return CATEGORY_MAP[lower] || null;
  }
}

/**
 * Create a new rate limiter instance
 */
export function createRateLimiter(): RateLimiter {
  return new RateLimiter();
}

/**
 * Get the transport category for an event type
 */
export function getEventCategory(eventType?: string): TransportCategory {
  switch (eventType) {
    case 'transaction':
      return 'transaction';
    case 'replay_event':
      return 'replay';
    case 'feedback':
      return 'error';
    default:
      return 'error';
  }
}
