/**
 * Sentry Interceptor
 *
 * Intercepts calls to the global Sentry object and routes them
 * through the Universal Logger.
 */

import type { Event, EventHint, Breadcrumb, BreadcrumbHint, User, SeverityLevel } from '../types/sentry';
import type { ScopeLike } from '../types/scope';

/**
 * Minimal Sentry-like interface for interception.
 */
export interface SentryLike {
  init?: (options: unknown) => void;
  captureException?: (exception: unknown, hint?: EventHint) => string;
  captureMessage?: (message: string, level?: SeverityLevel, hint?: EventHint) => string;
  captureEvent?: (event: Event, hint?: EventHint) => string;
  addBreadcrumb?: (breadcrumb: Breadcrumb, hint?: BreadcrumbHint) => void;
  setUser?: (user: User | null) => void;
  setTag?: (key: string, value: string) => void;
  setTags?: (tags: Record<string, string>) => void;
  setExtra?: (key: string, value: unknown) => void;
  setExtras?: (extras: Record<string, unknown>) => void;
  setContext?: (name: string, context: Record<string, unknown> | null) => void;
  configureScope?: (callback: (scope: ScopeLike) => void) => void;
  withScope?: <T>(callback: (scope: ScopeLike) => T) => T;
  getCurrentScope?: () => ScopeLike;
  getIsolationScope?: () => ScopeLike;
  getGlobalScope?: () => ScopeLike;
  startTransaction?: (context: unknown, customSamplingContext?: unknown) => unknown;
  startSpan?: <T>(options: unknown, callback: (span: unknown) => T) => T;
  startInactiveSpan?: (options: unknown) => unknown;
  getActiveSpan?: () => unknown;
  flush?: (timeout?: number) => Promise<boolean>;
  close?: (timeout?: number) => Promise<boolean>;
  lastEventId?: () => string | undefined;
  [key: string]: unknown;
}

/**
 * Logger interface for receiving intercepted calls.
 */
export interface InterceptorLogger {
  captureException(exception: unknown, hint?: EventHint): string;
  captureMessage(message: string, level?: SeverityLevel, hint?: EventHint): string;
  captureEvent(event: Event, hint?: EventHint): string;
  addBreadcrumb(breadcrumb: Breadcrumb, hint?: BreadcrumbHint): void;
  setUser(user: User | null): void;
  setTag(key: string, value: string): void;
  setTags(tags: Record<string, string>): void;
  setExtra(key: string, value: unknown): void;
  setExtras(extras: Record<string, unknown>): void;
  setContext(name: string, context: Record<string, unknown> | null): void;
  getCurrentScope(): ScopeLike;
  withScope<T>(callback: (scope: ScopeLike) => T): T;
}

/**
 * Sentry proxy controller.
 */
export interface SentryProxy {
  /**
   * Reference to the original Sentry object (if any).
   */
  original: SentryLike | null;

  /**
   * Start intercepting Sentry calls.
   */
  intercept(): void;

  /**
   * Stop intercepting and restore original Sentry.
   */
  restore(): void;

  /**
   * Check if currently intercepting.
   */
  isIntercepting(): boolean;

  /**
   * Get the proxy object (for replacing global Sentry).
   */
  getProxy(): SentryLike;
}

/**
 * Options for creating a Sentry interceptor.
 */
export interface InterceptorOptions {
  /**
   * Whether to forward calls to the original Sentry.
   */
  forwardToOriginal: boolean;

  /**
   * Whether to log intercepted calls for debugging.
   */
  debug: boolean;

  /**
   * Callback when an event is intercepted.
   */
  onIntercept?: (method: string, args: unknown[]) => void;
}

/**
 * Create a Sentry interceptor.
 *
 * @param logger - The logger to receive intercepted calls
 * @param options - Interceptor options
 * @returns Sentry proxy controller
 */
export function createSentryInterceptor(
  logger: InterceptorLogger,
  options: InterceptorOptions
): SentryProxy {
  let original: SentryLike | null = null;
  let intercepting = false;
  const { forwardToOriginal, debug, onIntercept } = options;

  /**
   * Log debug information if enabled.
   */
  function debugLog(method: string, args: unknown[]): void {
    if (debug) {
      console.log(`[Universal Logger] Intercepted Sentry.${method}`, args);
    }
    if (onIntercept) {
      onIntercept(method, args);
    }
  }

  /**
   * Create the proxy object that mimics Sentry.
   */
  function createProxyObject(): SentryLike {
    const proxy: SentryLike = {
      // Initialization (no-op, logger is already initialized)
      init(options: unknown): void {
        debugLog('init', [options]);
        if (forwardToOriginal && original?.init) {
          original.init(options);
        }
      },

      // Error capturing
      captureException(exception: unknown, hint?: EventHint): string {
        debugLog('captureException', [exception, hint]);
        const eventId = logger.captureException(exception, hint);
        if (forwardToOriginal && original?.captureException) {
          original.captureException(exception, hint);
        }
        return eventId;
      },

      captureMessage(message: string, level?: SeverityLevel, hint?: EventHint): string {
        debugLog('captureMessage', [message, level, hint]);
        const eventId = logger.captureMessage(message, level, hint);
        if (forwardToOriginal && original?.captureMessage) {
          original.captureMessage(message, level, hint);
        }
        return eventId;
      },

      captureEvent(event: Event, hint?: EventHint): string {
        debugLog('captureEvent', [event, hint]);
        const eventId = logger.captureEvent(event, hint);
        if (forwardToOriginal && original?.captureEvent) {
          original.captureEvent(event, hint);
        }
        return eventId;
      },

      // Breadcrumbs
      addBreadcrumb(breadcrumb: Breadcrumb, hint?: BreadcrumbHint): void {
        debugLog('addBreadcrumb', [breadcrumb, hint]);
        logger.addBreadcrumb(breadcrumb, hint);
        if (forwardToOriginal && original?.addBreadcrumb) {
          original.addBreadcrumb(breadcrumb, hint);
        }
      },

      // User and context
      setUser(user: User | null): void {
        debugLog('setUser', [user]);
        logger.setUser(user);
        if (forwardToOriginal && original?.setUser) {
          original.setUser(user);
        }
      },

      setTag(key: string, value: string): void {
        debugLog('setTag', [key, value]);
        logger.setTag(key, value);
        if (forwardToOriginal && original?.setTag) {
          original.setTag(key, value);
        }
      },

      setTags(tags: Record<string, string>): void {
        debugLog('setTags', [tags]);
        logger.setTags(tags);
        if (forwardToOriginal && original?.setTags) {
          original.setTags(tags);
        }
      },

      setExtra(key: string, value: unknown): void {
        debugLog('setExtra', [key, value]);
        logger.setExtra(key, value);
        if (forwardToOriginal && original?.setExtra) {
          original.setExtra(key, value);
        }
      },

      setExtras(extras: Record<string, unknown>): void {
        debugLog('setExtras', [extras]);
        logger.setExtras(extras);
        if (forwardToOriginal && original?.setExtras) {
          original.setExtras(extras);
        }
      },

      setContext(name: string, context: Record<string, unknown> | null): void {
        debugLog('setContext', [name, context]);
        logger.setContext(name, context);
        if (forwardToOriginal && original?.setContext) {
          original.setContext(name, context);
        }
      },

      // Scope management
      configureScope(callback: (scope: ScopeLike) => void): void {
        debugLog('configureScope', [callback]);
        const scope = logger.getCurrentScope();
        callback(scope);
        if (forwardToOriginal && original?.configureScope) {
          original.configureScope(callback);
        }
      },

      withScope<T>(callback: (scope: ScopeLike) => T): T {
        debugLog('withScope', [callback]);
        return logger.withScope(callback);
      },

      getCurrentScope(): ScopeLike {
        debugLog('getCurrentScope', []);
        return logger.getCurrentScope();
      },

      getIsolationScope(): ScopeLike {
        debugLog('getIsolationScope', []);
        // Return current scope as isolation scope for simplicity
        return logger.getCurrentScope();
      },

      getGlobalScope(): ScopeLike {
        debugLog('getGlobalScope', []);
        // Return current scope as global scope for simplicity
        return logger.getCurrentScope();
      },

      // Tracing (forward to original or no-op)
      startTransaction(context: unknown, customSamplingContext?: unknown): unknown {
        debugLog('startTransaction', [context, customSamplingContext]);
        if (forwardToOriginal && original?.startTransaction) {
          return original.startTransaction(context, customSamplingContext);
        }
        // Return a dummy transaction if not forwarding
        return createDummySpan(context);
      },

      startSpan<T>(options: unknown, callback: (span: unknown) => T): T {
        debugLog('startSpan', [options, callback]);
        if (forwardToOriginal && original?.startSpan) {
          return original.startSpan(options, callback);
        }
        return callback(createDummySpan(options));
      },

      startInactiveSpan(options: unknown): unknown {
        debugLog('startInactiveSpan', [options]);
        if (forwardToOriginal && original?.startInactiveSpan) {
          return original.startInactiveSpan(options);
        }
        return createDummySpan(options);
      },

      getActiveSpan(): unknown {
        debugLog('getActiveSpan', []);
        if (forwardToOriginal && original?.getActiveSpan) {
          return original.getActiveSpan();
        }
        return undefined;
      },

      // Lifecycle
      flush(timeout?: number): Promise<boolean> {
        debugLog('flush', [timeout]);
        if (forwardToOriginal && original?.flush) {
          return original.flush(timeout);
        }
        return Promise.resolve(true);
      },

      close(timeout?: number): Promise<boolean> {
        debugLog('close', [timeout]);
        if (forwardToOriginal && original?.close) {
          return original.close(timeout);
        }
        return Promise.resolve(true);
      },

      lastEventId(): string | undefined {
        debugLog('lastEventId', []);
        if (forwardToOriginal && original?.lastEventId) {
          return original.lastEventId();
        }
        return undefined;
      },
    };

    return proxy;
  }

  const proxyObject = createProxyObject();

  return {
    original,

    intercept(): void {
      if (intercepting) {
        return;
      }

      // Store original Sentry if it exists
      if (typeof globalThis !== 'undefined' && (globalThis as any).Sentry) {
        original = (globalThis as any).Sentry;
      } else if (typeof window !== 'undefined' && (window as any).Sentry) {
        original = (window as any).Sentry;
      }

      // Replace global Sentry with proxy
      if (typeof globalThis !== 'undefined') {
        (globalThis as any).Sentry = proxyObject;
      }
      if (typeof window !== 'undefined') {
        (window as any).Sentry = proxyObject;
      }

      intercepting = true;

      if (debug) {
        console.log('[Universal Logger] Sentry interception started');
      }
    },

    restore(): void {
      if (!intercepting) {
        return;
      }

      // Restore original Sentry
      if (original) {
        if (typeof globalThis !== 'undefined') {
          (globalThis as any).Sentry = original;
        }
        if (typeof window !== 'undefined') {
          (window as any).Sentry = original;
        }
      } else {
        // Remove the proxy if there was no original
        if (typeof globalThis !== 'undefined') {
          delete (globalThis as any).Sentry;
        }
        if (typeof window !== 'undefined') {
          delete (window as any).Sentry;
        }
      }

      intercepting = false;

      if (debug) {
        console.log('[Universal Logger] Sentry interception stopped');
      }
    },

    isIntercepting(): boolean {
      return intercepting;
    },

    getProxy(): SentryLike {
      return proxyObject;
    },
  };
}

/**
 * Create a dummy span object for when tracing is not forwarded.
 */
function createDummySpan(options: unknown): unknown {
  const spanContext = {
    traceId: generateId(32),
    spanId: generateId(16),
  };

  return {
    spanContext: () => spanContext,
    setAttribute: () => {},
    setAttributes: () => {},
    setStatus: () => {},
    updateName: () => {},
    end: () => {},
    isRecording: () => false,
    addEvent: () => {},
    recordException: () => {},
    toJSON: () => ({
      span_id: spanContext.spanId,
      trace_id: spanContext.traceId,
      start_timestamp: Date.now() / 1000,
    }),
    startTime: Date.now() / 1000,
    name: (options as any)?.name || 'dummy-span',
    op: (options as any)?.op,
    attributes: {},
  };
}

/**
 * Generate a random hex ID.
 */
function generateId(length: number): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

/**
 * Wrap a Sentry method with an interceptor function.
 *
 * @param method - Original method
 * @param interceptor - Interceptor function
 * @returns Wrapped method
 */
export function wrapSentryMethod<T extends (...args: any[]) => any>(
  method: T,
  interceptor: (...args: Parameters<T>) => void
): T {
  return ((...args: Parameters<T>): ReturnType<T> => {
    interceptor(...args);
    return method(...args);
  }) as T;
}

/**
 * Check if Sentry is available globally.
 */
export function isSentryAvailable(): boolean {
  if (typeof globalThis !== 'undefined' && (globalThis as any).Sentry) {
    return true;
  }
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    return true;
  }
  return false;
}

/**
 * Get the global Sentry object if available.
 */
export function getGlobalSentry(): SentryLike | undefined {
  if (typeof globalThis !== 'undefined' && (globalThis as any).Sentry) {
    return (globalThis as any).Sentry;
  }
  if (typeof window !== 'undefined' && (window as any).Sentry) {
    return (window as any).Sentry;
  }
  return undefined;
}
