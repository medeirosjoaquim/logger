/**
 * HTTP Integration
 *
 * Instruments fetch and XHR to capture HTTP requests as breadcrumbs and spans.
 * Supports distributed tracing by injecting trace headers into outgoing requests.
 */

import type { Integration, IntegrationClient, FetchInstrumentData, XHRInstrumentData } from './types.js';
import type { Breadcrumb } from '../types/sentry.js';
import { instrumentFetch, instrumentXHR } from './instrument.js';
import {
  shouldInjectHeaders,
  injectTracingHeaders,
  injectXHRHeaders,
  getUrlFromFetchInput,
} from '../tracing/headerInjection.js';
import { TraceContext } from '../tracing/context.js';
import type { DynamicSamplingContext } from '../tracing/types.js';

/**
 * Options for the HTTP integration
 */
export interface HttpIntegrationOptions {
  /**
   * Whether to instrument fetch
   * @default true
   */
  fetch?: boolean;

  /**
   * Whether to instrument XHR
   * @default true
   */
  xhr?: boolean;

  /**
   * Whether to create breadcrumbs for requests
   * @default true
   */
  breadcrumbs?: boolean;

  /**
   * Whether to include request/response data in breadcrumbs
   * @default false
   */
  includeData?: boolean;

  /**
   * URLs to exclude from instrumentation
   * Can be strings (exact match) or RegExp
   */
  excludeUrls?: (string | RegExp)[];

  /**
   * Whether to capture errors
   * @default true
   */
  captureErrors?: boolean;

  /**
   * Filter function to determine if a request should be captured
   */
  shouldCapture?: (url: string, method: string) => boolean;

  /**
   * Whether to propagate trace headers to outgoing requests
   * @default true
   */
  tracing?: boolean;

  /**
   * URL patterns to propagate trace headers to
   * If not specified, headers are propagated to same-origin requests only
   */
  tracePropagationTargets?: (string | RegExp)[];

  /**
   * Whether to propagate to same-origin requests even if not in tracePropagationTargets
   * @default true
   */
  traceSameOrigin?: boolean;
}

/**
 * Storage for original fetch function
 */
let originalFetch: typeof fetch | undefined;

/**
 * Storage for original XHR methods
 */
let originalXHROpen: typeof XMLHttpRequest.prototype.open | undefined;
let originalXHRSend: typeof XMLHttpRequest.prototype.send | undefined;

/**
 * WeakMap to store XHR request data
 */
const xhrRequestData = new WeakMap<
  XMLHttpRequest,
  { method: string; url: string; traceHeadersInjected?: boolean }
>();

/**
 * Create the HTTP integration
 */
export function httpIntegration(options: HttpIntegrationOptions = {}): Integration {
  const {
    fetch: instrumentFetchOption = true,
    xhr: instrumentXHROption = true,
    breadcrumbs = true,
    includeData = false,
    excludeUrls = [],
    captureErrors = true,
    shouldCapture,
    tracing = true,
    tracePropagationTargets,
    traceSameOrigin = true,
  } = options;

  let client: IntegrationClient | null = null;
  let unsubscribeFetch: (() => void) | null = null;
  let unsubscribeXHR: (() => void) | null = null;
  let dsc: Partial<DynamicSamplingContext> | undefined;

  /**
   * Check if URL should be excluded
   */
  function isExcluded(url: string): boolean {
    for (const exclude of excludeUrls) {
      if (typeof exclude === 'string') {
        if (url === exclude || url.includes(exclude)) {
          return true;
        }
      } else if (exclude instanceof RegExp) {
        if (exclude.test(url)) {
          return true;
        }
      }
    }
    return false;
  }

  /**
   * Check if request should be captured
   */
  function shouldCaptureRequest(url: string, method: string): boolean {
    if (isExcluded(url)) {
      return false;
    }

    if (shouldCapture) {
      return shouldCapture(url, method);
    }

    return true;
  }

  /**
   * Handle fetch data
   */
  function handleFetch(data: FetchInstrumentData): void {
    if (!client || !shouldCaptureRequest(data.url, data.method)) {
      return;
    }

    const duration = data.endTimestamp
      ? data.endTimestamp - data.startTimestamp
      : undefined;

    if (breadcrumbs) {
      const breadcrumb: Breadcrumb = {
        type: 'http',
        category: 'fetch',
        message: `${data.method} ${data.url}`,
        level: data.error || (data.statusCode && data.statusCode >= 400) ? 'error' : 'info',
        timestamp: data.startTimestamp / 1000,
        data: {
          url: data.url,
          method: data.method,
          status_code: data.statusCode,
          duration,
        },
      };

      if (includeData && data.requestHeaders) {
        breadcrumb.data!.request_headers = sanitizeHeaders(data.requestHeaders);
      }

      if (data.error) {
        breadcrumb.data!.error = data.error.message;
      }

      client.addBreadcrumb(breadcrumb);
    }

    // Capture failed requests as exceptions
    if (captureErrors && data.error) {
      client.captureException(data.error, {
        mechanism: {
          type: 'fetch',
          handled: true,
        },
        data: {
          url: data.url,
          method: data.method,
        },
      });
    }
  }

  /**
   * Handle XHR data
   */
  function handleXHR(data: XHRInstrumentData): void {
    if (!client || !shouldCaptureRequest(data.url, data.method)) {
      return;
    }

    const duration = data.endTimestamp
      ? data.endTimestamp - data.startTimestamp
      : undefined;

    if (breadcrumbs) {
      const breadcrumb: Breadcrumb = {
        type: 'http',
        category: 'xhr',
        message: `${data.method} ${data.url}`,
        level: data.error || (data.statusCode && data.statusCode >= 400) ? 'error' : 'info',
        timestamp: data.startTimestamp / 1000,
        data: {
          url: data.url,
          method: data.method,
          status_code: data.statusCode,
          status_text: data.statusText,
          duration,
        },
      };

      if (data.error) {
        breadcrumb.data!.error = data.error.message;
      }

      client.addBreadcrumb(breadcrumb);
    }

    // Capture failed requests as exceptions
    if (captureErrors && data.error) {
      client.captureException(data.error, {
        mechanism: {
          type: 'xhr',
          handled: true,
        },
        data: {
          url: data.url,
          method: data.method,
        },
      });
    }
  }

  /**
   * Wrap fetch to inject tracing headers
   */
  function wrapFetch(): void {
    if (typeof fetch === 'undefined') {
      return;
    }

    // Save original if not already saved
    if (!originalFetch) {
      originalFetch = fetch;
    }

    (globalThis as { fetch: typeof fetch }).fetch = function (
      input: RequestInfo | URL,
      init?: RequestInit
    ): Promise<Response> {
      // Get URL for checking
      const url = getUrlFromFetchInput(input);

      // Check if we should inject headers
      if (
        tracing &&
        !isExcluded(url) &&
        shouldInjectHeaders(url, tracePropagationTargets, traceSameOrigin)
      ) {
        const activeSpan = TraceContext.getActiveSpan();

        if (activeSpan) {
          // Inject headers
          const newInit = injectTracingHeaders(input, init, activeSpan, dsc);
          return originalFetch!.call(globalThis, input, newInit);
        }
      }

      return originalFetch!.call(globalThis, input, init);
    };
  }

  /**
   * Wrap XHR to inject tracing headers
   */
  function wrapXHR(): void {
    if (typeof XMLHttpRequest === 'undefined') {
      return;
    }

    const xhrProto = XMLHttpRequest.prototype;

    // Save originals if not already saved
    if (!originalXHROpen) {
      originalXHROpen = xhrProto.open;
    }
    if (!originalXHRSend) {
      originalXHRSend = xhrProto.send;
    }

    // Wrap open to capture URL and method
    xhrProto.open = function (
      method: string,
      url: string | URL,
      async: boolean = true,
      username?: string | null,
      password?: string | null
    ) {
      const urlString = url.toString();
      xhrRequestData.set(this, { method, url: urlString });

      return originalXHROpen!.call(this, method, url, async, username, password);
    };

    // Wrap send to inject headers
    xhrProto.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
      const requestData = xhrRequestData.get(this);

      if (requestData && !requestData.traceHeadersInjected) {
        const { url } = requestData;

        // Check if we should inject headers
        if (
          tracing &&
          !isExcluded(url) &&
          shouldInjectHeaders(url, tracePropagationTargets, traceSameOrigin)
        ) {
          const activeSpan = TraceContext.getActiveSpan();

          if (activeSpan) {
            injectXHRHeaders(this, activeSpan, dsc);
            requestData.traceHeadersInjected = true;
          }
        }
      }

      return originalXHRSend!.call(this, body);
    };
  }

  /**
   * Restore original fetch and XHR
   */
  function restoreOriginals(): void {
    if (originalFetch && typeof globalThis !== 'undefined') {
      (globalThis as { fetch: typeof fetch }).fetch = originalFetch;
    }

    if (typeof XMLHttpRequest !== 'undefined') {
      if (originalXHROpen) {
        XMLHttpRequest.prototype.open = originalXHROpen;
      }
      if (originalXHRSend) {
        XMLHttpRequest.prototype.send = originalXHRSend;
      }
    }
  }

  return {
    name: 'Http',

    setup(c: IntegrationClient) {
      client = c;

      // Get DSN to exclude from instrumentation
      const dsn = c.getDsn();
      if (dsn) {
        try {
          const dsnUrl = new URL(dsn.replace(/^(\w+):\/\/(\w+)@/, '$1://'));
          excludeUrls.push(dsnUrl.origin);

          // Extract public key for DSC
          const match = dsn.match(/^(\w+):\/\/(\w+)@/);
          if (match) {
            dsc = {
              public_key: match[2],
            };
          }
        } catch {
          // Ignore invalid DSN
        }
      }

      // Get additional DSC from client options
      const clientOptions = c.getOptions?.();
      if (clientOptions) {
        dsc = {
          ...dsc,
          release: clientOptions.release,
          environment: clientOptions.environment,
        };
      }

      // Wrap fetch and XHR for tracing header injection
      if (tracing) {
        if (instrumentFetchOption && typeof fetch !== 'undefined') {
          wrapFetch();
        }

        if (instrumentXHROption && typeof XMLHttpRequest !== 'undefined') {
          wrapXHR();
        }
      }

      // Set up breadcrumb/error instrumentation
      if (instrumentFetchOption && typeof fetch !== 'undefined') {
        unsubscribeFetch = instrumentFetch(handleFetch);
      }

      if (instrumentXHROption && typeof XMLHttpRequest !== 'undefined') {
        unsubscribeXHR = instrumentXHR(handleXHR);
      }
    },

    teardown() {
      if (unsubscribeFetch) {
        unsubscribeFetch();
        unsubscribeFetch = null;
      }
      if (unsubscribeXHR) {
        unsubscribeXHR();
        unsubscribeXHR = null;
      }

      // Restore original functions
      restoreOriginals();

      client = null;
    },
  };
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers: Record<string, string>): Record<string, string> {
  const sensitiveHeaders = [
    'authorization',
    'cookie',
    'set-cookie',
    'x-api-key',
    'x-auth-token',
    'x-csrf-token',
  ];

  const sanitized: Record<string, string> = {};

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    if (sensitiveHeaders.includes(lowerKey)) {
      sanitized[key] = '[Filtered]';
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized;
}
