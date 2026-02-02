/**
 * HTTP Integration
 *
 * Instruments fetch and XHR to capture HTTP requests as breadcrumbs and spans.
 */

import type { Integration, IntegrationClient, FetchInstrumentData, XHRInstrumentData } from './types.js';
import type { Breadcrumb } from '../types/sentry.js';
import { instrumentFetch, instrumentXHR } from './instrument.js';

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
}

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
  } = options;

  let client: IntegrationClient | null = null;
  let unsubscribeFetch: (() => void) | null = null;
  let unsubscribeXHR: (() => void) | null = null;

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
        } catch {
          // Ignore invalid DSN
        }
      }

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
