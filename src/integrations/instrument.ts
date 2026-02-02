/**
 * Instrumentation Utilities
 *
 * Functions for instrumenting browser APIs to capture breadcrumbs and spans.
 * Wraps native APIs in a non-destructive way.
 */

import type {
  InstrumentHandler,
  ConsoleInstrumentData,
  FetchInstrumentData,
  XHRInstrumentData,
  DOMInstrumentData,
  HistoryInstrumentData,
  ErrorInstrumentData,
  UnhandledRejectionInstrumentData,
} from './types.js';

/**
 * Storage for original functions
 */
const originalFunctions: {
  console: Record<string, (...args: unknown[]) => void>;
  fetch?: typeof fetch;
  xhrOpen?: typeof XMLHttpRequest.prototype.open;
  xhrSend?: typeof XMLHttpRequest.prototype.send;
  historyPushState?: typeof History.prototype.pushState;
  historyReplaceState?: typeof History.prototype.replaceState;
  onerror?: typeof window.onerror;
  onunhandledrejection?: typeof window.onunhandledrejection;
  addEventListener?: typeof EventTarget.prototype.addEventListener;
  removeEventListener?: typeof EventTarget.prototype.removeEventListener;
} = {
  console: {},
};

/**
 * Handlers for each instrument type
 */
const handlers: {
  console: InstrumentHandler<ConsoleInstrumentData>[];
  fetch: InstrumentHandler<FetchInstrumentData>[];
  xhr: InstrumentHandler<XHRInstrumentData>[];
  dom: InstrumentHandler<DOMInstrumentData>[];
  history: InstrumentHandler<HistoryInstrumentData>[];
  error: InstrumentHandler<ErrorInstrumentData>[];
  unhandledrejection: InstrumentHandler<UnhandledRejectionInstrumentData>[];
} = {
  console: [],
  fetch: [],
  xhr: [],
  dom: [],
  history: [],
  error: [],
  unhandledrejection: [],
};

/**
 * Track which instrumentations are active
 */
const instrumented: Set<string> = new Set();

/**
 * Instrument console methods
 */
export function instrumentConsole(handler: InstrumentHandler<ConsoleInstrumentData>): () => void {
  handlers.console.push(handler);

  if (!instrumented.has('console')) {
    instrumented.add('console');

    const consoleMethods = ['log', 'warn', 'error', 'info', 'debug', 'assert', 'trace'] as const;

    for (const method of consoleMethods) {
      if (typeof console !== 'undefined' && typeof console[method] === 'function') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const original = (console as any)[method] as (...args: unknown[]) => void;
        originalFunctions.console[method] = original.bind(console);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (console as any)[method] = function (...args: unknown[]) {
          // Call original
          originalFunctions.console[method]?.(...args);

          // Notify handlers
          const data: ConsoleInstrumentData = { method, args };
          for (const h of handlers.console) {
            try {
              h(data);
            } catch {
              // Ignore handler errors
            }
          }
        };
      }
    }
  }

  // Return unsubscribe function
  return () => {
    const index = handlers.console.indexOf(handler);
    if (index > -1) {
      handlers.console.splice(index, 1);
    }
  };
}

/**
 * Instrument fetch API
 */
export function instrumentFetch(handler: InstrumentHandler<FetchInstrumentData>): () => void {
  handlers.fetch.push(handler);

  if (!instrumented.has('fetch') && typeof fetch !== 'undefined') {
    instrumented.add('fetch');
    originalFunctions.fetch = fetch;

    (globalThis as { fetch: typeof fetch }).fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
      const startTimestamp = Date.now();
      const method = init?.method || 'GET';
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      let requestHeaders: Record<string, string> | undefined;
      if (init?.headers) {
        requestHeaders = {};
        const headers = new Headers(init.headers);
        headers.forEach((value, key) => {
          requestHeaders![key] = value;
        });
      }

      try {
        const response = await originalFunctions.fetch!.call(globalThis, input, init);
        const endTimestamp = Date.now();

        // Extract response headers
        const responseHeaders: Record<string, string | null> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key] = value;
        });

        const data: FetchInstrumentData = {
          url,
          method,
          requestHeaders,
          statusCode: response.status,
          responseHeaders,
          startTimestamp,
          endTimestamp,
        };

        for (const h of handlers.fetch) {
          try {
            h(data);
          } catch {
            // Ignore handler errors
          }
        }

        return response;
      } catch (error) {
        const endTimestamp = Date.now();

        const data: FetchInstrumentData = {
          url,
          method,
          requestHeaders,
          error: error instanceof Error ? error : new Error(String(error)),
          startTimestamp,
          endTimestamp,
        };

        for (const h of handlers.fetch) {
          try {
            h(data);
          } catch {
            // Ignore handler errors
          }
        }

        throw error;
      }
    };
  }

  return () => {
    const index = handlers.fetch.indexOf(handler);
    if (index > -1) {
      handlers.fetch.splice(index, 1);
    }
  };
}

/**
 * Instrument XMLHttpRequest
 */
export function instrumentXHR(handler: InstrumentHandler<XHRInstrumentData>): () => void {
  handlers.xhr.push(handler);

  if (!instrumented.has('xhr') && typeof XMLHttpRequest !== 'undefined') {
    instrumented.add('xhr');

    const xhrProto = XMLHttpRequest.prototype;
    originalFunctions.xhrOpen = xhrProto.open;
    originalFunctions.xhrSend = xhrProto.send;

    // Store request data on the XHR instance
    const xhrData = new WeakMap<
      XMLHttpRequest,
      { method: string; url: string; startTimestamp?: number }
    >();

    xhrProto.open = function (
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null
    ) {
      xhrData.set(this, { method, url: url.toString() });
      return originalFunctions.xhrOpen!.call(this, method, url, async, username, password);
    };

    xhrProto.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const data = xhrData.get(this);
      if (data) {
        data.startTimestamp = Date.now();

        const onreadystatechange = this.onreadystatechange;
        this.onreadystatechange = function (event) {
          if (this.readyState === 4) {
            const endTimestamp = Date.now();
            const instrumentData: XHRInstrumentData = {
              url: data.url,
              method: data.method,
              statusCode: this.status,
              statusText: this.statusText,
              startTimestamp: data.startTimestamp!,
              endTimestamp,
              xhr: this,
            };

            for (const h of handlers.xhr) {
              try {
                h(instrumentData);
              } catch {
                // Ignore handler errors
              }
            }
          }

          if (onreadystatechange) {
            onreadystatechange.call(this, event);
          }
        };

        // Handle errors
        const onerror = this.onerror;
        this.onerror = function (event) {
          const endTimestamp = Date.now();
          const instrumentData: XHRInstrumentData = {
            url: data.url,
            method: data.method,
            error: new Error('XHR error'),
            startTimestamp: data.startTimestamp!,
            endTimestamp,
            xhr: this,
          };

          for (const h of handlers.xhr) {
            try {
              h(instrumentData);
            } catch {
              // Ignore handler errors
            }
          }

          if (onerror) {
            onerror.call(this, event);
          }
        };
      }

      return originalFunctions.xhrSend!.call(this, body);
    };
  }

  return () => {
    const index = handlers.xhr.indexOf(handler);
    if (index > -1) {
      handlers.xhr.splice(index, 1);
    }
  };
}

/**
 * Instrument DOM events (click, input, etc.)
 */
export function instrumentDOM(
  handler: InstrumentHandler<DOMInstrumentData>,
  eventTypes: string[] = ['click', 'keypress', 'submit']
): () => void {
  handlers.dom.push(handler);

  if (!instrumented.has('dom') && typeof document !== 'undefined') {
    instrumented.add('dom');

    const domHandler = (event: Event) => {
      const target = event.target as HTMLElement | null;

      const data: DOMInstrumentData = {
        eventType: event.type,
        target: event.target,
        tagName: target?.tagName,
        elementId: target?.id,
        className: target?.className,
        innerText: target?.innerText?.substring(0, 100),
        event,
      };

      for (const h of handlers.dom) {
        try {
          h(data);
        } catch {
          // Ignore handler errors
        }
      }
    };

    for (const eventType of eventTypes) {
      document.addEventListener(eventType, domHandler, { capture: true, passive: true });
    }
  }

  return () => {
    const index = handlers.dom.indexOf(handler);
    if (index > -1) {
      handlers.dom.splice(index, 1);
    }
  };
}

/**
 * Instrument History API (pushState, replaceState, popstate)
 */
export function instrumentHistory(handler: InstrumentHandler<HistoryInstrumentData>): () => void {
  handlers.history.push(handler);

  if (!instrumented.has('history') && typeof history !== 'undefined' && typeof window !== 'undefined') {
    instrumented.add('history');

    let currentUrl = window.location.href;

    const notifyNavigation = (to: string, navigationType: 'pushState' | 'replaceState' | 'popstate') => {
      const from = currentUrl;
      currentUrl = to;

      const data: HistoryInstrumentData = { from, to, navigationType };

      for (const h of handlers.history) {
        try {
          h(data);
        } catch {
          // Ignore handler errors
        }
      }
    };

    // Wrap pushState
    originalFunctions.historyPushState = history.pushState.bind(history);
    history.pushState = function (state, unused, url?) {
      const result = originalFunctions.historyPushState!(state, unused, url);
      if (url) {
        notifyNavigation(new URL(url.toString(), window.location.href).href, 'pushState');
      }
      return result;
    };

    // Wrap replaceState
    originalFunctions.historyReplaceState = history.replaceState.bind(history);
    history.replaceState = function (state, unused, url?) {
      const result = originalFunctions.historyReplaceState!(state, unused, url);
      if (url) {
        notifyNavigation(new URL(url.toString(), window.location.href).href, 'replaceState');
      }
      return result;
    };

    // Listen for popstate
    window.addEventListener('popstate', () => {
      notifyNavigation(window.location.href, 'popstate');
    });
  }

  return () => {
    const index = handlers.history.indexOf(handler);
    if (index > -1) {
      handlers.history.splice(index, 1);
    }
  };
}

/**
 * Instrument global error handler
 */
export function instrumentError(handler: InstrumentHandler<ErrorInstrumentData>): () => void {
  handlers.error.push(handler);

  if (!instrumented.has('error') && typeof window !== 'undefined') {
    instrumented.add('error');

    const originalOnError = window.onerror;
    originalFunctions.onerror = originalOnError as typeof window.onerror;

    window.onerror = function (message, source, lineno, colno, error) {
      const data: ErrorInstrumentData = {
        message: typeof message === 'string' ? message : 'Unknown error',
        source,
        lineno,
        colno,
        error: error instanceof Error ? error : undefined,
        event: new ErrorEvent('error', { message: String(message), error }),
      };

      for (const h of handlers.error) {
        try {
          h(data);
        } catch {
          // Ignore handler errors
        }
      }

      if (originalOnError) {
        return originalOnError.call(window, message, source, lineno, colno, error);
      }
      return false;
    };
  }

  return () => {
    const index = handlers.error.indexOf(handler);
    if (index > -1) {
      handlers.error.splice(index, 1);
    }
  };
}

/**
 * Instrument unhandled promise rejections
 */
export function instrumentUnhandledRejection(
  handler: InstrumentHandler<UnhandledRejectionInstrumentData>
): () => void {
  handlers.unhandledrejection.push(handler);

  if (!instrumented.has('unhandledrejection') && typeof window !== 'undefined') {
    instrumented.add('unhandledrejection');

    const originalHandler = window.onunhandledrejection;
    originalFunctions.onunhandledrejection = originalHandler as typeof window.onunhandledrejection;

    window.onunhandledrejection = function (event: PromiseRejectionEvent) {
      const data: UnhandledRejectionInstrumentData = {
        reason: event.reason,
        event,
      };

      for (const h of handlers.unhandledrejection) {
        try {
          h(data);
        } catch {
          // Ignore handler errors
        }
      }

      if (originalHandler) {
        return originalHandler.call(window, event);
      }
    };
  }

  return () => {
    const index = handlers.unhandledrejection.indexOf(handler);
    if (index > -1) {
      handlers.unhandledrejection.splice(index, 1);
    }
  };
}

/**
 * Restore all instrumented functions to their originals
 */
export function restoreAll(): void {
  // Restore console
  for (const [method, original] of Object.entries(originalFunctions.console)) {
    if (original && typeof console !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (console as any)[method] = original;
    }
  }
  originalFunctions.console = {};

  // Restore fetch
  if (originalFunctions.fetch) {
    (globalThis as { fetch: typeof fetch }).fetch = originalFunctions.fetch;
    originalFunctions.fetch = undefined;
  }

  // Restore XHR
  if (originalFunctions.xhrOpen && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.open = originalFunctions.xhrOpen;
    originalFunctions.xhrOpen = undefined;
  }
  if (originalFunctions.xhrSend && typeof XMLHttpRequest !== 'undefined') {
    XMLHttpRequest.prototype.send = originalFunctions.xhrSend;
    originalFunctions.xhrSend = undefined;
  }

  // Restore history
  if (originalFunctions.historyPushState && typeof history !== 'undefined') {
    history.pushState = originalFunctions.historyPushState;
    originalFunctions.historyPushState = undefined;
  }
  if (originalFunctions.historyReplaceState && typeof history !== 'undefined') {
    history.replaceState = originalFunctions.historyReplaceState;
    originalFunctions.historyReplaceState = undefined;
  }

  // Restore error handlers
  if (typeof window !== 'undefined') {
    if (originalFunctions.onerror !== undefined) {
      window.onerror = originalFunctions.onerror;
      originalFunctions.onerror = undefined;
    }
    if (originalFunctions.onunhandledrejection !== undefined) {
      window.onunhandledrejection = originalFunctions.onunhandledrejection;
      originalFunctions.onunhandledrejection = undefined;
    }
  }

  // Clear handlers and instrumented flags
  handlers.console = [];
  handlers.fetch = [];
  handlers.xhr = [];
  handlers.dom = [];
  handlers.history = [];
  handlers.error = [];
  handlers.unhandledrejection = [];
  instrumented.clear();
}
