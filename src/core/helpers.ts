/**
 * Production Helper Utilities
 *
 * Convenience wrappers for common Sentry operations in production Next.js apps.
 * These helpers provide a simpler API with automatic context handling.
 */

import type { SeverityLevel, User, Breadcrumb } from '../types/sentry.js';
import { UniversalLogger } from './logger.js';

/**
 * Options for capturing errors with context
 */
export interface CaptureErrorOptions {
  /** Tags for categorization and filtering */
  tags?: Record<string, string>;
  /** Extra arbitrary data */
  extra?: Record<string, unknown>;
  /** Severity level override */
  level?: SeverityLevel;
  /** User information */
  user?: User;
  /** Custom fingerprint for grouping */
  fingerprint?: string[];
}

/**
 * Options for tracking events
 */
export interface TrackEventOptions {
  /** Tags for categorization */
  tags?: Record<string, string>;
  /** Additional data */
  data?: Record<string, unknown>;
  /** Severity level (default: 'info') */
  level?: SeverityLevel;
}

/**
 * User identification options (extends base User with common patterns)
 */
export interface IdentifyUserOptions extends User {
  /** User's subscription tier or plan */
  plan?: string;
}

/**
 * Production-ready Sentry helper object
 *
 * Provides convenient methods for common error tracking patterns.
 *
 * @example
 * ```typescript
 * import { helpers } from '@universal-logger/core';
 *
 * // Capture error with automatic context
 * helpers.captureError(error, {
 *   tags: { section: 'checkout' },
 *   extra: { cartId, userId }
 * });
 *
 * // Track important events
 * helpers.trackEvent('High-value transaction', {
 *   tags: { type: 'purchase' },
 *   data: { amount: 500, currency: 'USD' }
 * });
 *
 * // Identify user for error attribution
 * helpers.identifyUser({ id: user.id, email: user.email, plan: 'premium' });
 * ```
 */
export const helpers = {
  /**
   * Capture an error with automatic context wrapping
   *
   * Uses withScope internally to ensure context is isolated to this error.
   *
   * @param error - The error to capture
   * @param options - Context options (tags, extra, level, user, fingerprint)
   * @returns The event ID
   *
   * @example
   * ```typescript
   * try {
   *   await riskyOperation();
   * } catch (error) {
   *   helpers.captureError(error, {
   *     tags: { operation: 'payment' },
   *     extra: { orderId, amount }
   *   });
   * }
   * ```
   */
  captureError: (error: unknown, options?: CaptureErrorOptions): string => {
    const logger = UniversalLogger.getInstance();

    return logger.withScope((scope) => {
      if (options?.tags) {
        scope.setTags(options.tags);
      }
      if (options?.extra) {
        scope.setExtras(options.extra);
      }
      if (options?.level) {
        scope.setLevel(options.level);
      }
      if (options?.user) {
        scope.setUser(options.user);
      }
      if (options?.fingerprint) {
        scope.setFingerprint(options.fingerprint);
      }

      return logger.captureException(error);
    });
  },

  /**
   * Track a custom event/message
   *
   * Use for important events that aren't errors but need visibility
   * (e.g., security events, business logic milestones).
   *
   * @param message - The event message
   * @param options - Event options (tags, data, level)
   * @returns The event ID
   *
   * @example
   * ```typescript
   * helpers.trackEvent('User reached payment limit', {
   *   level: 'warning',
   *   tags: { userId },
   *   data: { currentLimit: 1000, attempted: 1500 }
   * });
   * ```
   */
  trackEvent: (message: string, options?: TrackEventOptions): string => {
    const logger = UniversalLogger.getInstance();
    const level = options?.level ?? 'info';

    return logger.withScope((scope) => {
      if (options?.tags) {
        scope.setTags(options.tags);
      }
      if (options?.data) {
        scope.setExtras(options.data);
      }

      return logger.captureMessage(message, level);
    });
  },

  /**
   * Identify the current user
   *
   * Sets user information for error attribution. Call after authentication
   * to associate errors with specific users.
   *
   * @param user - User information or null to clear
   *
   * @example
   * ```typescript
   * // After login
   * helpers.identifyUser({
   *   id: user.id,
   *   email: user.email,
   *   username: user.username,
   *   plan: user.subscriptionTier
   * });
   *
   * // After logout
   * helpers.identifyUser(null);
   * ```
   */
  identifyUser: (user: IdentifyUserOptions | null): void => {
    const logger = UniversalLogger.getInstance();

    if (user === null) {
      logger.setUser(null);
      return;
    }

    // Map plan to segment if provided (common pattern)
    const sentryUser: User = {
      ...user,
    };

    if (user.plan && !user.segment) {
      sentryUser.segment = user.plan;
    }

    logger.setUser(sentryUser);
  },

  /**
   * Add a navigation breadcrumb
   *
   * Tracks page navigation for debugging context.
   *
   * @param url - The URL being navigated to
   * @param from - The previous URL (optional)
   *
   * @example
   * ```typescript
   * // In your router or navigation handler
   * helpers.trackNavigation('/dashboard', window.location.pathname);
   * ```
   */
  trackNavigation: (url: string, from?: string): void => {
    const logger = UniversalLogger.getInstance();

    const breadcrumb: Breadcrumb = {
      category: 'navigation',
      message: `Navigated to ${url}`,
      level: 'info',
      data: { to: url },
    };

    if (from) {
      breadcrumb.data = { ...breadcrumb.data, from };
    }

    logger.addBreadcrumb(breadcrumb);
  },

  /**
   * Add an API request breadcrumb
   *
   * Tracks API calls for debugging context. Call at the start
   * and end of requests.
   *
   * @param endpoint - The API endpoint
   * @param status - 'started', 'completed', or 'failed'
   * @param data - Additional data (method, status code, duration, etc.)
   *
   * @example
   * ```typescript
   * helpers.trackApiRequest('/api/users', 'started', { method: 'GET' });
   *
   * const response = await fetch('/api/users');
   *
   * helpers.trackApiRequest('/api/users', 'completed', {
   *   method: 'GET',
   *   status: response.status,
   *   duration: Date.now() - startTime
   * });
   * ```
   */
  trackApiRequest: (
    endpoint: string,
    status: 'started' | 'completed' | 'failed',
    data?: Record<string, unknown>
  ): void => {
    const logger = UniversalLogger.getInstance();

    const breadcrumb: Breadcrumb = {
      category: 'api',
      message: `API request ${status}`,
      level: status === 'failed' ? 'error' : 'info',
      data: {
        endpoint,
        ...data,
      },
    };

    logger.addBreadcrumb(breadcrumb);
  },

  /**
   * Add a user action breadcrumb
   *
   * Tracks user interactions for debugging context.
   *
   * @param action - Description of the action (e.g., 'clicked checkout button')
   * @param data - Additional context data
   *
   * @example
   * ```typescript
   * helpers.trackUserAction('Clicked checkout button', {
   *   cartItems: 5,
   *   totalAmount: 129.99
   * });
   * ```
   */
  trackUserAction: (action: string, data?: Record<string, unknown>): void => {
    const logger = UniversalLogger.getInstance();

    logger.addBreadcrumb({
      category: 'ui.click',
      message: action,
      level: 'info',
      data,
    });
  },

  /**
   * Execute a function with isolated scope and context
   *
   * Wraps withScope with a more ergonomic API for common use cases.
   *
   * @param context - Context to apply (tags, extra, user, fingerprint)
   * @param fn - Function to execute
   * @returns The return value of the function
   *
   * @example
   * ```typescript
   * const result = await helpers.withContext(
   *   {
   *     tags: { operation: 'payment' },
   *     extra: { orderId }
   *   },
   *   async () => {
   *     // Any errors in here will have the context attached
   *     return await processPayment(orderId);
   *   }
   * );
   * ```
   */
  withContext: <T>(
    context: CaptureErrorOptions,
    fn: () => T
  ): T => {
    const logger = UniversalLogger.getInstance();

    return logger.withScope((scope) => {
      if (context.tags) {
        scope.setTags(context.tags);
      }
      if (context.extra) {
        scope.setExtras(context.extra);
      }
      if (context.level) {
        scope.setLevel(context.level);
      }
      if (context.user) {
        scope.setUser(context.user);
      }
      if (context.fingerprint) {
        scope.setFingerprint(context.fingerprint);
      }

      return fn();
    });
  },
};

/**
 * Alias for helpers object (matches common Sentry pattern)
 */
export const sentry = helpers;
