/**
 * Sentry API Client
 *
 * Handles communication with the Sentry API including
 * rate limiting and retry logic.
 */

import type { Event } from '../types/sentry';
import type { Session } from '../types/session';
import type { TransportMakeRequestResponse, TransportOptions } from '../types/transport';
import type { Dsn } from '../config/dsn';
import { getEnvelopeEndpoint, getAuthHeaders } from '../config/dsn';
import { createSentryEnvelope, createSessionEnvelope } from './envelope';

/**
 * Rate limiter for managing API rate limits.
 */
export interface RateLimiter {
  /**
   * Check if a category is currently rate limited.
   */
  isRateLimited(category: string): boolean;

  /**
   * Update rate limits from response headers.
   */
  updateFromHeaders(headers: Record<string, string | null>): void;

  /**
   * Get the retry-after time for a category.
   */
  getRetryAfter(category: string): number | undefined;

  /**
   * Clear all rate limits.
   */
  clear(): void;
}

/**
 * Create a rate limiter.
 */
export function createRateLimiter(): RateLimiter {
  const limits: Map<string, number> = new Map();

  return {
    isRateLimited(category: string): boolean {
      const limit = limits.get(category) || limits.get('');
      if (!limit) return false;
      return Date.now() < limit;
    },

    updateFromHeaders(headers: Record<string, string | null>): void {
      const rateLimitHeader = headers['x-sentry-rate-limits'];
      const retryAfterHeader = headers['retry-after'];

      if (rateLimitHeader) {
        // Format: quota_limit, quota_limit, ...
        // quota_limit: retry_after:categories:scope:reason_code
        const items = rateLimitHeader.split(',');

        for (const item of items) {
          const [retryAfter, categoriesStr] = item.trim().split(':');
          const retryAfterMs = (parseInt(retryAfter, 10) || 60) * 1000;
          const limitUntil = Date.now() + retryAfterMs;

          if (!categoriesStr || categoriesStr === '') {
            // Empty category means all categories
            limits.set('', limitUntil);
          } else {
            const categories = categoriesStr.split(';');
            for (const category of categories) {
              limits.set(category.trim(), limitUntil);
            }
          }
        }
      } else if (retryAfterHeader) {
        // Simple retry-after header
        let retryAfterMs: number;

        if (retryAfterHeader.match(/^\d+$/)) {
          retryAfterMs = parseInt(retryAfterHeader, 10) * 1000;
        } else {
          // HTTP date format
          retryAfterMs = Math.max(0, new Date(retryAfterHeader).getTime() - Date.now());
        }

        limits.set('', Date.now() + retryAfterMs);
      }
    },

    getRetryAfter(category: string): number | undefined {
      const limit = limits.get(category) || limits.get('');
      if (!limit) return undefined;

      const remaining = limit - Date.now();
      return remaining > 0 ? remaining : undefined;
    },

    clear(): void {
      limits.clear();
    },
  };
}

/**
 * Options for the Sentry API client.
 */
export interface SentryApiClientOptions extends Partial<TransportOptions> {
  /**
   * SDK name for authentication headers.
   */
  sdkName?: string;

  /**
   * SDK version for authentication headers.
   */
  sdkVersion?: string;

  /**
   * Timeout for requests in milliseconds.
   */
  timeout?: number;

  /**
   * Whether to use fetch keepalive.
   */
  keepalive?: boolean;

  /**
   * Tunnel URL for sending events through a proxy.
   */
  tunnel?: string;

  /**
   * Maximum number of retries.
   */
  maxRetries?: number;

  /**
   * Retry delay in milliseconds.
   */
  retryDelay?: number;
}

/**
 * Sentry API client for sending events.
 */
export class SentryApiClient {
  private dsn: Dsn;
  private rateLimiter: RateLimiter;
  private options: SentryApiClientOptions;
  private endpoint: string;

  constructor(dsn: Dsn, options: SentryApiClientOptions = {}) {
    this.dsn = dsn;
    this.options = {
      sdkName: 'universal-logger',
      sdkVersion: '0.1.0',
      timeout: 30000,
      keepalive: false,
      maxRetries: 3,
      retryDelay: 1000,
      ...options,
    };
    this.rateLimiter = createRateLimiter();
    this.endpoint = getEnvelopeEndpoint(dsn, options.tunnel);
  }

  /**
   * Send an event to Sentry.
   *
   * @param event - The event to send
   * @returns Transport response
   */
  async sendEvent(event: Event): Promise<TransportMakeRequestResponse> {
    const category = event.type === 'transaction' ? 'transaction' : 'error';

    // Check rate limiting
    if (this.rateLimiter.isRateLimited(category)) {
      const retryAfter = this.rateLimiter.getRetryAfter(category);
      return {
        statusCode: 429,
        headers: {
          'retry-after': retryAfter ? String(retryAfter / 1000) : null,
        },
      };
    }

    // Create envelope
    const envelope = createSentryEnvelope(event, this.dsn, {
      name: this.options.sdkName,
      version: this.options.sdkVersion,
    });

    return this.sendEnvelope(envelope);
  }

  /**
   * Send a session to Sentry.
   *
   * @param session - The session to send
   * @returns Transport response
   */
  async sendSession(session: Session): Promise<TransportMakeRequestResponse> {
    // Check rate limiting
    if (this.rateLimiter.isRateLimited('session')) {
      const retryAfter = this.rateLimiter.getRetryAfter('session');
      return {
        statusCode: 429,
        headers: {
          'retry-after': retryAfter ? String(retryAfter / 1000) : null,
        },
      };
    }

    // Create envelope
    const envelope = createSessionEnvelope(session, this.dsn);

    return this.sendEnvelope(envelope);
  }

  /**
   * Send a raw envelope to Sentry.
   *
   * @param envelope - The envelope string to send
   * @returns Transport response
   */
  async sendEnvelope(envelope: string): Promise<TransportMakeRequestResponse> {
    const headers = this.getHeaders();
    const { timeout, keepalive, maxRetries, retryDelay } = this.options;

    let lastError: Error | undefined;
    let attempt = 0;

    while (attempt < (maxRetries || 3)) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        const response = await fetch(this.endpoint, {
          method: 'POST',
          headers,
          body: envelope,
          keepalive,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // Extract response headers
        const responseHeaders: Record<string, string | null> = {};
        response.headers.forEach((value, key) => {
          responseHeaders[key.toLowerCase()] = value;
        });

        // Handle rate limiting
        this.handleRateLimit({
          statusCode: response.status,
          headers: responseHeaders,
        });

        // Success or permanent failure
        if (response.ok || response.status < 500) {
          return {
            statusCode: response.status,
            headers: responseHeaders,
          };
        }

        // Server error, may retry
        lastError = new Error(`Sentry API returned ${response.status}`);
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        // Don't retry on abort (timeout)
        if ((error as Error).name === 'AbortError') {
          return {
            statusCode: 408,
            headers: {},
          };
        }
      }

      attempt++;

      if (attempt < (maxRetries || 3)) {
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, retryDelay));
      }
    }

    // All retries failed
    return {
      statusCode: 0,
      headers: {
        'x-error': lastError?.message || 'Unknown error',
      },
    };
  }

  /**
   * Get authentication headers for requests.
   */
  private getHeaders(): Record<string, string> {
    const authHeaders = getAuthHeaders(
      this.dsn,
      this.options.sdkName,
      this.options.sdkVersion
    );

    return {
      ...authHeaders,
      ...(this.options.headers || {}),
    };
  }

  /**
   * Handle rate limit response.
   */
  private handleRateLimit(response: TransportMakeRequestResponse): void {
    if (response.headers) {
      this.rateLimiter.updateFromHeaders(response.headers);
    }
  }

  /**
   * Check if a category is rate limited.
   */
  isRateLimited(category: string = ''): boolean {
    return this.rateLimiter.isRateLimited(category);
  }

  /**
   * Get the DSN.
   */
  getDsn(): Dsn {
    return this.dsn;
  }

  /**
   * Get the endpoint URL.
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * Clear rate limits.
   */
  clearRateLimits(): void {
    this.rateLimiter.clear();
  }
}

/**
 * Create a Sentry API client.
 *
 * @param dsn - The DSN
 * @param options - Client options
 * @returns API client instance
 */
export function createSentryApiClient(
  dsn: Dsn,
  options?: SentryApiClientOptions
): SentryApiClient {
  return new SentryApiClient(dsn, options);
}

/**
 * Send an event to Sentry using the simple API.
 * Creates a temporary client for one-off sends.
 *
 * @param event - The event to send
 * @param dsn - The DSN
 * @param options - Client options
 * @returns Transport response
 */
export async function sendEventToSentry(
  event: Event,
  dsn: Dsn,
  options?: SentryApiClientOptions
): Promise<TransportMakeRequestResponse> {
  const client = new SentryApiClient(dsn, options);
  return client.sendEvent(event);
}

/**
 * Batch sender for sending multiple events efficiently.
 */
export class BatchSender {
  private client: SentryApiClient;
  private queue: Array<{ event: Event; resolve: (response: TransportMakeRequestResponse) => void }> = [];
  private flushTimeout: ReturnType<typeof setTimeout> | null = null;
  private batchSize: number;
  private flushInterval: number;

  constructor(dsn: Dsn, options?: SentryApiClientOptions & { batchSize?: number; flushInterval?: number }) {
    this.client = new SentryApiClient(dsn, options);
    this.batchSize = options?.batchSize || 10;
    this.flushInterval = options?.flushInterval || 5000;
  }

  /**
   * Add an event to the batch queue.
   */
  add(event: Event): Promise<TransportMakeRequestResponse> {
    return new Promise(resolve => {
      this.queue.push({ event, resolve });

      if (this.queue.length >= this.batchSize) {
        this.flush();
      } else if (!this.flushTimeout) {
        this.flushTimeout = setTimeout(() => this.flush(), this.flushInterval);
      }
    });
  }

  /**
   * Flush all queued events.
   */
  async flush(): Promise<void> {
    if (this.flushTimeout) {
      clearTimeout(this.flushTimeout);
      this.flushTimeout = null;
    }

    const items = this.queue.splice(0, this.queue.length);

    for (const item of items) {
      try {
        const response = await this.client.sendEvent(item.event);
        item.resolve(response);
      } catch {
        item.resolve({ statusCode: 0, headers: {} });
      }
    }
  }

  /**
   * Close the batch sender.
   */
  async close(): Promise<void> {
    await this.flush();
  }
}
