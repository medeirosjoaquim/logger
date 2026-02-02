/**
 * Offline Queue
 *
 * Queues requests when offline and replays them when back online.
 * Persists queue to storage (IndexedDB) for durability.
 */

import type { StorageProvider } from '../storage/types.js';
import type { Transport, TransportRequest, TransportMakeRequestResponse } from './types.js';

/**
 * Configuration for the offline queue
 */
export interface OfflineQueueOptions {
  /**
   * Maximum number of requests to queue
   */
  maxSize?: number;

  /**
   * Maximum age of queued items in milliseconds
   */
  maxAge?: number;

  /**
   * Storage key prefix
   */
  storageKey?: string;

  /**
   * Interval to check for connectivity in milliseconds
   */
  checkInterval?: number;
}

/**
 * Queued request with metadata
 */
interface QueuedRequest {
  /**
   * Unique ID for this request
   */
  id: string;

  /**
   * The request body
   */
  body: string;

  /**
   * Timestamp when the request was queued
   */
  timestamp: number;

  /**
   * Number of retry attempts
   */
  retryCount: number;
}

/**
 * Default maximum queue size
 */
const DEFAULT_MAX_SIZE = 30;

/**
 * Default maximum age (24 hours)
 */
const DEFAULT_MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * Default check interval (30 seconds)
 */
const DEFAULT_CHECK_INTERVAL = 30000;

/**
 * Storage key for the queue
 */
const DEFAULT_STORAGE_KEY = 'universal-logger-offline-queue';

/**
 * OfflineQueue class for managing offline requests
 */
export class OfflineQueue {
  private queue: QueuedRequest[] = [];
  private storage: StorageProvider | null;
  private maxSize: number;
  private maxAge: number;
  private storageKey: string;
  private checkInterval: number;
  private checkTimer: ReturnType<typeof setInterval> | null = null;
  private isOnline: boolean = true;
  private flushing: boolean = false;
  private initialized: boolean = false;

  constructor(storage: StorageProvider | null, options: OfflineQueueOptions = {}) {
    this.storage = storage;
    this.maxSize = options.maxSize ?? DEFAULT_MAX_SIZE;
    this.maxAge = options.maxAge ?? DEFAULT_MAX_AGE;
    this.storageKey = options.storageKey ?? DEFAULT_STORAGE_KEY;
    this.checkInterval = options.checkInterval ?? DEFAULT_CHECK_INTERVAL;

    // Set up online/offline listeners if in browser
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.handleOnline.bind(this));
      window.addEventListener('offline', this.handleOffline.bind(this));
      this.isOnline = navigator.onLine;
    }
  }

  /**
   * Initialize the offline queue
   */
  async init(): Promise<void> {
    if (this.initialized) {
      return;
    }

    await this.loadQueue();
    this.startPeriodicCheck();
    this.initialized = true;
  }

  /**
   * Check if we're currently offline
   */
  isOffline(): boolean {
    return !this.isOnline;
  }

  /**
   * Get the current queue size
   */
  size(): number {
    return this.queue.length;
  }

  /**
   * Enqueue a request for later sending
   */
  async enqueue(request: TransportRequest): Promise<void> {
    // Convert body to string if needed
    const body = typeof request.body === 'string'
      ? request.body
      : this.uint8ArrayToString(request.body);

    const queuedRequest: QueuedRequest = {
      id: this.generateId(),
      body,
      timestamp: Date.now(),
      retryCount: 0,
    };

    // Add to queue
    this.queue.push(queuedRequest);

    // Enforce max size (remove oldest items)
    while (this.queue.length > this.maxSize) {
      this.queue.shift();
    }

    // Persist to storage
    await this.persistQueue();
  }

  /**
   * Dequeue the next request
   */
  async dequeue(): Promise<TransportRequest | undefined> {
    // Remove expired items first
    this.removeExpired();

    const item = this.queue.shift();
    if (item) {
      await this.persistQueue();
      return { body: item.body };
    }
    return undefined;
  }

  /**
   * Peek at the next request without removing it
   */
  peek(): TransportRequest | undefined {
    this.removeExpired();
    const item = this.queue[0];
    if (item) {
      return { body: item.body };
    }
    return undefined;
  }

  /**
   * Flush all queued requests using the provided transport
   */
  async flush(transport: Transport): Promise<void> {
    if (this.flushing) {
      return;
    }

    this.flushing = true;

    try {
      // Remove expired items
      this.removeExpired();

      while (this.queue.length > 0) {
        const item = this.queue[0];
        const request: TransportRequest = { body: item.body };

        try {
          const response = await transport.send(request);

          if (this.isSuccessResponse(response)) {
            // Remove from queue on success
            this.queue.shift();
            await this.persistQueue();
          } else if (this.isPermanentError(response)) {
            // Remove on permanent error
            this.queue.shift();
            await this.persistQueue();
          } else {
            // Temporary error - increment retry count
            item.retryCount++;
            if (item.retryCount >= 3) {
              // Too many retries - remove
              this.queue.shift();
              await this.persistQueue();
            } else {
              // Keep in queue and stop flushing
              break;
            }
          }
        } catch {
          // Error sending - stop flushing
          break;
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  /**
   * Clear the queue
   */
  async clear(): Promise<void> {
    this.queue = [];
    await this.persistQueue();
  }

  /**
   * Stop the offline queue
   */
  stop(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline.bind(this));
      window.removeEventListener('offline', this.handleOffline.bind(this));
    }
  }

  /**
   * Load queue from storage
   */
  private async loadQueue(): Promise<void> {
    if (!this.storage) {
      this.tryLoadFromLocalStorage();
      return;
    }

    try {
      // Use the storage provider to get persisted queue
      // For now, we'll use localStorage as a fallback since
      // the storage provider doesn't have a generic key-value interface
      this.tryLoadFromLocalStorage();
    } catch {
      // Ignore errors loading queue
    }
  }

  /**
   * Try to load queue from localStorage
   */
  private tryLoadFromLocalStorage(): void {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      const stored = localStorage.getItem(this.storageKey);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.queue = parsed;
          this.removeExpired();
        }
      }
    } catch {
      // Ignore parse errors
    }
  }

  /**
   * Persist queue to storage
   */
  private async persistQueue(): Promise<void> {
    if (typeof localStorage === 'undefined') {
      return;
    }

    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
    } catch {
      // Storage might be full - try to reduce queue size
      while (this.queue.length > 0) {
        this.queue.shift();
        try {
          localStorage.setItem(this.storageKey, JSON.stringify(this.queue));
          break;
        } catch {
          // Keep trying with smaller queue
        }
      }
    }
  }

  /**
   * Remove expired items from the queue
   */
  private removeExpired(): void {
    const now = Date.now();
    const cutoff = now - this.maxAge;
    this.queue = this.queue.filter((item) => item.timestamp > cutoff);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Convert Uint8Array to string
   */
  private uint8ArrayToString(data: Uint8Array): string {
    return new TextDecoder().decode(data);
  }

  /**
   * Check if a response indicates success
   */
  private isSuccessResponse(response: TransportMakeRequestResponse): boolean {
    const { statusCode } = response;
    return statusCode !== undefined && statusCode >= 200 && statusCode < 300;
  }

  /**
   * Check if a response indicates a permanent error (don't retry)
   */
  private isPermanentError(response: TransportMakeRequestResponse): boolean {
    const { statusCode } = response;
    // 4xx errors (except 429) are permanent
    return statusCode !== undefined && statusCode >= 400 && statusCode < 500 && statusCode !== 429;
  }

  /**
   * Handle going online
   */
  private handleOnline(): void {
    this.isOnline = true;
  }

  /**
   * Handle going offline
   */
  private handleOffline(): void {
    this.isOnline = false;
  }

  /**
   * Start periodic connectivity check
   */
  private startPeriodicCheck(): void {
    if (this.checkTimer) {
      return;
    }

    this.checkTimer = setInterval(() => {
      // Update online status
      if (typeof navigator !== 'undefined') {
        this.isOnline = navigator.onLine;
      }
    }, this.checkInterval);
  }
}

/**
 * Create an offline-aware transport wrapper
 */
export function createOfflineTransport(
  transport: Transport,
  queue: OfflineQueue
): Transport {
  async function send(request: TransportRequest): Promise<TransportMakeRequestResponse> {
    // If offline, queue the request
    if (queue.isOffline()) {
      await queue.enqueue(request);
      return {
        statusCode: 0,
        reason: 'Queued for offline',
      };
    }

    // Try to flush any queued requests first
    await queue.flush(transport);

    // Send the current request
    const response = await transport.send(request);

    // If network error, queue for retry
    if (response.statusCode === 0) {
      await queue.enqueue(request);
    }

    return response;
  }

  async function flush(timeout?: number): Promise<boolean> {
    // Flush queued requests
    await queue.flush(transport);
    // Flush transport
    return transport.flush(timeout);
  }

  async function close(timeout?: number): Promise<boolean> {
    queue.stop();
    return transport.close(timeout);
  }

  return { send, flush, close };
}
