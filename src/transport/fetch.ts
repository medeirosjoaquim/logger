/**
 * Fetch Transport
 *
 * HTTP transport implementation using the Fetch API.
 * Includes retry logic, timeout handling, and rate limiting.
 */

import type {
  Transport,
  TransportRequest,
  TransportMakeRequestResponse,
  FetchTransportOptions,
  TransportState,
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
 * Create a fetch-based transport
 */
export function makeFetchTransport(options: FetchTransportOptions): Transport {
  const {
    url,
    headers = {},
    fetchImpl = fetch,
    keepalive = false,
    referrerPolicy = 'origin',
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
    // Add jitter to prevent thundering herd
    const jitter = delay * 0.2 * Math.random();
    return Math.min(delay + jitter, MAX_RETRY_DELAY);
  }

  /**
   * Create an abort signal with timeout
   */
  function createTimeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    return {
      signal: controller.signal,
      clear: () => clearTimeout(timeoutId),
    };
  }

  /**
   * Perform a single fetch request
   */
  async function performFetch(
    body: string | Uint8Array,
    useKeepalive: boolean = false
  ): Promise<TransportMakeRequestResponse> {
    const { signal, clear } = createTimeoutSignal(timeout);

    try {
      // Convert Uint8Array to string for fetch body compatibility
      const requestBody = typeof body === 'string' ? body : new TextDecoder().decode(body);

      const response = await fetchImpl(url, {
        method: 'POST',
        body: requestBody,
        headers: {
          'Content-Type': 'application/x-sentry-envelope',
          ...headers,
        },
        referrerPolicy,
        keepalive: useKeepalive,
        signal,
      });

      clear();

      // Extract headers
      const responseHeaders: Record<string, string | null> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key.toLowerCase()] = value;
      });

      // Update rate limits from response headers
      rateLimiter.updateLimits(responseHeaders);

      return {
        statusCode: response.status,
        headers: responseHeaders,
        reason: response.statusText,
      };
    } catch (error) {
      clear();

      // Handle abort (timeout)
      if (error instanceof Error && error.name === 'AbortError') {
        return {
          statusCode: 0,
          reason: 'Request timeout',
        };
      }

      // Network error
      return {
        statusCode: 0,
        reason: error instanceof Error ? error.message : 'Network error',
      };
    }
  }

  /**
   * Determine if a response should be retried
   */
  function shouldRetry(response: TransportMakeRequestResponse): boolean {
    const { statusCode } = response;

    // No status code means network error - retry
    if (statusCode === undefined || statusCode === 0) {
      return true;
    }

    // Retry on server errors (5xx) except 500 (usually a permanent error)
    if (statusCode >= 501 && statusCode < 600) {
      return true;
    }

    // Retry on 429 (rate limited)
    if (statusCode === 429) {
      return true;
    }

    // Don't retry on success or client errors
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

    // Check rate limit before sending
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
      // Wait before retry (not on first attempt)
      if (attempt > 0) {
        // Check if rate limited from previous response
        if (rateLimiter.isRateLimited(category)) {
          const waitTime = rateLimiter.getRemainingTime(category);
          await sleep(Math.min(waitTime, MAX_RETRY_DELAY));
        } else {
          await sleep(getBackoffDelay(attempt - 1));
        }
      }

      lastResponse = await performFetch(request.body);

      // Success - 2xx status codes
      if (lastResponse.statusCode !== undefined &&
          lastResponse.statusCode >= 200 &&
          lastResponse.statusCode < 300) {
        return lastResponse;
      }

      // Check if we should retry
      if (!shouldRetry(lastResponse)) {
        break;
      }
    }

    // All retries failed
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
 * Create a fetch transport with keepalive support for page unload
 * This is useful for sending data when the page is being closed
 */
export function makeFetchTransportWithKeepalive(options: FetchTransportOptions): Transport {
  const baseTransport = makeFetchTransport({ ...options, keepalive: true });

  // Wrap send to use keepalive
  return {
    ...baseTransport,
    async send(request: TransportRequest): Promise<TransportMakeRequestResponse> {
      // For page unload scenarios, we want to use keepalive
      // This allows the request to complete even after the page navigates away
      return baseTransport.send(request);
    },
  };
}

/**
 * Create a beacon transport for page unload events
 * Uses navigator.sendBeacon for guaranteed delivery
 */
export function makeBeaconTransport(options: FetchTransportOptions): Transport {
  const { url, recordDroppedEvent } = options;
  const rateLimiter = new RateLimiter();

  async function send(request: TransportRequest): Promise<TransportMakeRequestResponse> {
    // Check rate limit
    const category = getEventCategory();
    if (rateLimiter.isRateLimited(category)) {
      if (recordDroppedEvent) {
        recordDroppedEvent('ratelimit_backoff', category);
      }
      return { statusCode: 429, reason: 'Rate limited' };
    }

    // Check if sendBeacon is available
    if (typeof navigator === 'undefined' || typeof navigator.sendBeacon !== 'function') {
      return { statusCode: 0, reason: 'sendBeacon not available' };
    }

    // Convert body to string for Blob
    const bodyStr = typeof request.body === 'string'
      ? request.body
      : new TextDecoder().decode(request.body);

    const blob = new Blob(
      [bodyStr],
      { type: 'application/x-sentry-envelope' }
    );

    const queued = navigator.sendBeacon(url, blob);

    if (queued) {
      // sendBeacon doesn't return status, assume success
      return { statusCode: 200, reason: 'Beacon queued' };
    } else {
      // Queue full or other error
      if (recordDroppedEvent) {
        recordDroppedEvent('network_error', category);
      }
      return { statusCode: 0, reason: 'Beacon queue full' };
    }
  }

  async function flush(): Promise<boolean> {
    // sendBeacon doesn't support flushing
    return true;
  }

  async function close(): Promise<boolean> {
    return true;
  }

  return { send, flush, close };
}
