/**
 * XHR Transport
 *
 * HTTP transport implementation using XMLHttpRequest.
 * Fallback for environments without Fetch API support.
 */

import type {
  Transport,
  TransportRequest,
  TransportMakeRequestResponse,
  XHRTransportOptions,
} from './types.js';
import { RateLimiter, getEventCategory } from './ratelimit.js';

/**
 * Default timeout in milliseconds (30 seconds)
 */
const DEFAULT_TIMEOUT = 30000;

/**
 * Default number of retry attempts
 */
const DEFAULT_RETRY_ATTEMPTS = 3;

/**
 * Base delay for exponential backoff in milliseconds
 */
const BASE_RETRY_DELAY = 1000;

/**
 * Maximum delay for exponential backoff in milliseconds
 */
const MAX_RETRY_DELAY = 30000;

/**
 * Create an XHR-based transport
 */
export function makeXHRTransport(options: XHRTransportOptions): Transport {
  const {
    url,
    headers = {},
    timeout = DEFAULT_TIMEOUT,
    retryAttempts = DEFAULT_RETRY_ATTEMPTS,
    recordDroppedEvent,
  } = options;

  const rateLimiter = new RateLimiter();
  const pendingRequests: Set<Promise<unknown>> = new Set();
  let isClosed = false;

  /**
   * Sleep for a given number of milliseconds
   */
  function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Calculate exponential backoff delay
   */
  function getBackoffDelay(attempt: number): number {
    const delay = BASE_RETRY_DELAY * Math.pow(2, attempt);
    const jitter = delay * 0.2 * Math.random();
    return Math.min(delay + jitter, MAX_RETRY_DELAY);
  }

  /**
   * Parse response headers from XHR
   */
  function parseResponseHeaders(xhr: XMLHttpRequest): Record<string, string | null> {
    const headers: Record<string, string | null> = {};
    const headerString = xhr.getAllResponseHeaders();

    if (!headerString) {
      return headers;
    }

    const headerPairs = headerString.trim().split('\r\n');
    for (const pair of headerPairs) {
      const colonIndex = pair.indexOf(':');
      if (colonIndex > 0) {
        const key = pair.substring(0, colonIndex).trim().toLowerCase();
        const value = pair.substring(colonIndex + 1).trim();
        headers[key] = value;
      }
    }

    return headers;
  }

  /**
   * Perform a single XHR request
   */
  function performXHR(body: string | Uint8Array): Promise<TransportMakeRequestResponse> {
    return new Promise((resolve) => {
      const xhr = new XMLHttpRequest();

      xhr.open('POST', url, true);
      xhr.timeout = timeout;

      // Set headers
      xhr.setRequestHeader('Content-Type', 'application/x-sentry-envelope');
      for (const [key, value] of Object.entries(headers)) {
        xhr.setRequestHeader(key, value);
      }

      xhr.onreadystatechange = () => {
        if (xhr.readyState !== 4) {
          return;
        }

        const responseHeaders = parseResponseHeaders(xhr);

        // Update rate limits
        rateLimiter.updateLimits(responseHeaders);

        if (xhr.status === 0) {
          // Network error or timeout
          resolve({
            statusCode: 0,
            headers: responseHeaders,
            reason: 'Network error',
          });
        } else {
          resolve({
            statusCode: xhr.status,
            headers: responseHeaders,
            reason: xhr.statusText,
          });
        }
      };

      xhr.onerror = () => {
        resolve({
          statusCode: 0,
          reason: 'Network error',
        });
      };

      xhr.ontimeout = () => {
        resolve({
          statusCode: 0,
          reason: 'Request timeout',
        });
      };

      xhr.onabort = () => {
        resolve({
          statusCode: 0,
          reason: 'Request aborted',
        });
      };

      // Send the request (convert Uint8Array to string for XHR compatibility)
      try {
        const requestBody = typeof body === 'string' ? body : new TextDecoder().decode(body);
        xhr.send(requestBody);
      } catch (error) {
        resolve({
          statusCode: 0,
          reason: error instanceof Error ? error.message : 'Send error',
        });
      }
    });
  }

  /**
   * Determine if a response should be retried
   */
  function shouldRetry(response: TransportMakeRequestResponse): boolean {
    const { statusCode } = response;

    if (statusCode === undefined || statusCode === 0) {
      return true;
    }

    if (statusCode >= 501 && statusCode < 600) {
      return true;
    }

    if (statusCode === 429) {
      return true;
    }

    return false;
  }

  /**
   * Send a request with retry logic
   */
  async function send(request: TransportRequest): Promise<TransportMakeRequestResponse> {
    if (isClosed) {
      return {
        statusCode: 0,
        reason: 'Transport is closed',
      };
    }

    // Check rate limit
    const category = getEventCategory();
    if (rateLimiter.isRateLimited(category)) {
      if (recordDroppedEvent) {
        recordDroppedEvent('ratelimit_backoff', category);
      }
      return {
        statusCode: 429,
        reason: 'Rate limited',
      };
    }

    let lastResponse: TransportMakeRequestResponse = {
      statusCode: 0,
      reason: 'No attempts made',
    };

    // Retry loop
    for (let attempt = 0; attempt < retryAttempts; attempt++) {
      if (attempt > 0) {
        if (rateLimiter.isRateLimited(category)) {
          const waitTime = rateLimiter.getRemainingTime(category);
          await sleep(Math.min(waitTime, MAX_RETRY_DELAY));
        } else {
          await sleep(getBackoffDelay(attempt - 1));
        }
      }

      const requestPromise = performXHR(request.body);
      pendingRequests.add(requestPromise);

      try {
        lastResponse = await requestPromise;
      } finally {
        pendingRequests.delete(requestPromise);
      }

      // Success
      if (lastResponse.statusCode !== undefined &&
          lastResponse.statusCode >= 200 &&
          lastResponse.statusCode < 300) {
        return lastResponse;
      }

      if (!shouldRetry(lastResponse)) {
        break;
      }
    }

    if (recordDroppedEvent && lastResponse.statusCode === 0) {
      recordDroppedEvent('network_error', category);
    }

    return lastResponse;
  }

  /**
   * Flush pending requests
   */
  async function flush(flushTimeout?: number): Promise<boolean> {
    if (pendingRequests.size === 0) {
      return true;
    }

    const timeoutPromise = flushTimeout
      ? sleep(flushTimeout).then(() => false)
      : Promise.resolve(true);

    const pendingPromise = Promise.all(Array.from(pendingRequests))
      .then(() => true)
      .catch(() => true);

    return Promise.race([pendingPromise, timeoutPromise]);
  }

  /**
   * Close the transport
   */
  async function close(closeTimeout?: number): Promise<boolean> {
    isClosed = true;
    return flush(closeTimeout);
  }

  return {
    send,
    flush,
    close,
  };
}

/**
 * Check if XHR is available in the current environment
 */
export function isXHRAvailable(): boolean {
  return typeof XMLHttpRequest !== 'undefined';
}

/**
 * Synchronous XHR send for page unload scenarios
 * WARNING: This blocks the main thread and should only be used
 * when absolutely necessary (e.g., page unload)
 */
export function sendXHRSync(
  url: string,
  body: string | Uint8Array,
  headers: Record<string, string> = {}
): boolean {
  if (!isXHRAvailable()) {
    return false;
  }

  try {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, false); // false = synchronous

    xhr.setRequestHeader('Content-Type', 'application/x-sentry-envelope');
    for (const [key, value] of Object.entries(headers)) {
      xhr.setRequestHeader(key, value);
    }

    // Convert Uint8Array to string for XHR compatibility
    const requestBody = typeof body === 'string' ? body : new TextDecoder().decode(body);
    xhr.send(requestBody);

    return xhr.status >= 200 && xhr.status < 300;
  } catch {
    return false;
  }
}
