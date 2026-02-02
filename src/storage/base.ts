/**
 * Base Storage Provider
 *
 * Abstract base class with common utility methods for storage providers.
 * Provides ID generation, filtering logic, and shared functionality.
 */

import type {
  StorageProvider,
  StorageProviderConfig,
  LogEntry,
  LogSession,
  SentryEvent,
  SpanData,
  TransactionData,
  TraceData,
  LogFilter,
  SentryEventFilter,
  TraceFilter,
  SeverityLevel,
  SpanStatus,
} from './types.js';

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<StorageProviderConfig> = {
  maxLogs: 1000,
  maxSessions: 100,
  maxEvents: 1000,
  maxSpans: 5000,
  maxTransactions: 500,
  dbName: 'universal-logger',
  dbVersion: 1,
};

/**
 * Abstract base class for storage providers
 */
export abstract class BaseStorageProvider implements StorageProvider {
  abstract readonly name: string;

  protected _ready: boolean = false;
  protected config: Required<StorageProviderConfig>;

  constructor(config?: StorageProviderConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check if the provider is ready
   */
  isReady(): boolean {
    return this._ready;
  }

  // Abstract methods that must be implemented by subclasses
  abstract init(): Promise<void>;
  abstract close(): Promise<void>;
  abstract saveLog(entry: LogEntry): Promise<void>;
  abstract getLogs(filter?: LogFilter): Promise<LogEntry[]>;
  abstract clearLogs(filter?: LogFilter): Promise<void>;
  abstract createSession(session: LogSession): Promise<void>;
  abstract updateSession(sessionId: string, updates: Partial<LogSession>): Promise<void>;
  abstract endSession(sessionId: string): Promise<void>;
  abstract getSessions(limit?: number): Promise<LogSession[]>;
  abstract getSession(sessionId: string): Promise<LogSession | null>;
  abstract deleteSession(sessionId: string): Promise<void>;
  abstract saveSentryEvent(event: SentryEvent): Promise<void>;
  abstract getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]>;
  abstract clearSentryEvents(): Promise<void>;
  abstract saveSpan(span: SpanData): Promise<void>;
  abstract saveTransaction(transaction: TransactionData): Promise<void>;
  abstract getTraces(filter?: TraceFilter): Promise<TraceData[]>;
  abstract clearTraces(): Promise<void>;

  // =========================================================================
  // UUID Generation
  // =========================================================================

  /**
   * Generate a UUID v4
   * Uses crypto.randomUUID if available, falls back to manual generation
   */
  protected generateUUID(): string {
    // Use native crypto.randomUUID if available (modern browsers and Node.js 19+)
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
      return crypto.randomUUID();
    }

    // Fallback implementation for older environments
    return this.generateUUIDFallback();
  }

  /**
   * Fallback UUID v4 generation
   */
  private generateUUIDFallback(): string {
    // Get random values
    const getRandomValues = (length: number): Uint8Array => {
      const array = new Uint8Array(length);
      if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
        crypto.getRandomValues(array);
      } else {
        // Last resort: Math.random (not cryptographically secure)
        for (let i = 0; i < length; i++) {
          array[i] = Math.floor(Math.random() * 256);
        }
      }
      return array;
    };

    const bytes = getRandomValues(16);

    // Set version (4) and variant (RFC4122)
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    // Convert to hex string with dashes
    const hex = Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
  }

  /**
   * Generate a short ID (for span/trace IDs)
   */
  protected generateShortId(length: number = 16): string {
    const chars = '0123456789abcdef';
    let result = '';
    const randomValues = new Uint8Array(length);

    if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
      crypto.getRandomValues(randomValues);
    } else {
      for (let i = 0; i < length; i++) {
        randomValues[i] = Math.floor(Math.random() * 256);
      }
    }

    for (let i = 0; i < length; i++) {
      result += chars[randomValues[i] % 16];
    }

    return result;
  }

  // =========================================================================
  // Timestamp Utilities
  // =========================================================================

  /**
   * Get current timestamp in ISO format
   */
  protected getCurrentTimestamp(): string {
    return new Date().toISOString();
  }

  /**
   * Parse a timestamp string to Date
   */
  protected parseTimestamp(timestamp: string): Date {
    return new Date(timestamp);
  }

  /**
   * Calculate duration between two timestamps in milliseconds
   */
  protected calculateDuration(start: string, end: string): number {
    const startDate = this.parseTimestamp(start);
    const endDate = this.parseTimestamp(end);
    return endDate.getTime() - startDate.getTime();
  }

  // =========================================================================
  // Log Filtering
  // =========================================================================

  /**
   * Filter log entries based on criteria
   */
  protected filterLogs(logs: LogEntry[], filter: LogFilter): LogEntry[] {
    let filtered = [...logs];

    // Filter by level
    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      filtered = filtered.filter((log) => levels.includes(log.level));
    }

    // Filter by session
    if (filter.sessionId) {
      filtered = filtered.filter((log) => log.sessionId === filter.sessionId);
    }

    // Filter by time range
    if (filter.startTime) {
      const startTime = this.parseTimestamp(filter.startTime);
      filtered = filtered.filter((log) => this.parseTimestamp(log.timestamp) >= startTime);
    }

    if (filter.endTime) {
      const endTime = this.parseTimestamp(filter.endTime);
      filtered = filtered.filter((log) => this.parseTimestamp(log.timestamp) <= endTime);
    }

    // Filter by search text
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter(
        (log) =>
          log.message.toLowerCase().includes(searchLower) ||
          log.exception?.value?.toLowerCase().includes(searchLower) ||
          log.exception?.type?.toLowerCase().includes(searchLower)
      );
    }

    // Filter by tags
    if (filter.tags && Object.keys(filter.tags).length > 0) {
      filtered = filtered.filter((log) => {
        if (!log.tags) return false;
        return Object.entries(filter.tags!).every(([key, value]) => log.tags![key] === value);
      });
    }

    // Filter by trace ID
    if (filter.traceId) {
      filtered = filtered.filter((log) => log.traceId === filter.traceId);
    }

    // Filter by event ID
    if (filter.eventId) {
      filtered = filtered.filter((log) => log.eventId === filter.eventId);
    }

    // Apply ordering
    const orderBy = filter.orderBy || 'timestamp';
    const orderDirection = filter.orderDirection || 'desc';
    filtered = this.sortLogs(filtered, orderBy, orderDirection);

    // Apply pagination
    if (filter.offset) {
      filtered = filtered.slice(filter.offset);
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Sort log entries
   */
  private sortLogs(
    logs: LogEntry[],
    orderBy: 'timestamp' | 'level',
    direction: 'asc' | 'desc'
  ): LogEntry[] {
    const levelOrder: Record<SeverityLevel, number> = {
      fatal: 0,
      error: 1,
      warning: 2,
      log: 3,
      info: 4,
      debug: 5,
    };

    return logs.sort((a, b) => {
      let comparison: number;

      if (orderBy === 'level') {
        comparison = levelOrder[a.level] - levelOrder[b.level];
      } else {
        comparison = this.parseTimestamp(a.timestamp).getTime() - this.parseTimestamp(b.timestamp).getTime();
      }

      return direction === 'desc' ? -comparison : comparison;
    });
  }

  // =========================================================================
  // Sentry Event Filtering
  // =========================================================================

  /**
   * Filter Sentry events based on criteria
   */
  protected filterSentryEvents(events: SentryEvent[], filter: SentryEventFilter): SentryEvent[] {
    let filtered = [...events];

    // Filter by level
    if (filter.level) {
      const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
      filtered = filtered.filter((event) => event.level && levels.includes(event.level));
    }

    // Filter by type
    if (filter.type) {
      filtered = filtered.filter((event) => event.type === filter.type);
    }

    // Filter by time range
    if (filter.startTime) {
      const startTime = this.parseTimestamp(filter.startTime);
      filtered = filtered.filter((event) => this.parseTimestamp(event.timestamp) >= startTime);
    }

    if (filter.endTime) {
      const endTime = this.parseTimestamp(filter.endTime);
      filtered = filtered.filter((event) => this.parseTimestamp(event.timestamp) <= endTime);
    }

    // Filter by environment
    if (filter.environment) {
      filtered = filtered.filter((event) => event.environment === filter.environment);
    }

    // Filter by release
    if (filter.release) {
      filtered = filtered.filter((event) => event.release === filter.release);
    }

    // Filter by search text
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      filtered = filtered.filter((event) => {
        const message =
          typeof event.message === 'string'
            ? event.message
            : event.message?.formatted || event.message?.message || '';
        if (message.toLowerCase().includes(searchLower)) return true;

        // Search in exception values
        if (event.exception?.values) {
          for (const exc of event.exception.values) {
            if (exc.value?.toLowerCase().includes(searchLower)) return true;
            if (exc.type?.toLowerCase().includes(searchLower)) return true;
          }
        }

        return false;
      });
    }

    // Filter by tags
    if (filter.tags && Object.keys(filter.tags).length > 0) {
      filtered = filtered.filter((event) => {
        if (!event.tags) return false;
        return Object.entries(filter.tags!).every(([key, value]) => event.tags![key] === value);
      });
    }

    // Filter by user ID
    if (filter.userId) {
      filtered = filtered.filter(
        (event) => event.user?.id?.toString() === filter.userId
      );
    }

    // Filter by hasException
    if (filter.hasException !== undefined) {
      filtered = filtered.filter((event) => {
        const hasExc = event.exception?.values && event.exception.values.length > 0;
        return filter.hasException ? hasExc : !hasExc;
      });
    }

    // Filter by fingerprint
    if (filter.fingerprint && filter.fingerprint.length > 0) {
      filtered = filtered.filter((event) => {
        if (!event.fingerprint) return false;
        return filter.fingerprint!.every((fp) => event.fingerprint!.includes(fp));
      });
    }

    // Apply ordering
    const orderBy = filter.orderBy || 'timestamp';
    const orderDirection = filter.orderDirection || 'desc';
    filtered = this.sortSentryEvents(filtered, orderBy, orderDirection);

    // Apply pagination
    if (filter.offset) {
      filtered = filtered.slice(filter.offset);
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Sort Sentry events
   */
  private sortSentryEvents(
    events: SentryEvent[],
    orderBy: 'timestamp' | 'level',
    direction: 'asc' | 'desc'
  ): SentryEvent[] {
    const levelOrder: Record<SeverityLevel, number> = {
      fatal: 0,
      error: 1,
      warning: 2,
      log: 3,
      info: 4,
      debug: 5,
    };

    return events.sort((a, b) => {
      let comparison: number;

      if (orderBy === 'level') {
        const levelA = a.level ? levelOrder[a.level] : 5;
        const levelB = b.level ? levelOrder[b.level] : 5;
        comparison = levelA - levelB;
      } else {
        comparison = this.parseTimestamp(a.timestamp).getTime() - this.parseTimestamp(b.timestamp).getTime();
      }

      return direction === 'desc' ? -comparison : comparison;
    });
  }

  // =========================================================================
  // Trace Filtering
  // =========================================================================

  /**
   * Filter traces based on criteria
   */
  protected filterTraces(traces: TraceData[], filter: TraceFilter): TraceData[] {
    let filtered = [...traces];

    // Filter by trace ID
    if (filter.traceId) {
      filtered = filtered.filter((trace) => trace.trace_id === filter.traceId);
    }

    // Filter by transaction name
    if (filter.transactionName) {
      filtered = filtered.filter((trace) =>
        trace.transaction.name.includes(filter.transactionName!)
      );
    }

    // Filter by operation
    if (filter.op) {
      filtered = filtered.filter((trace) => trace.transaction.op === filter.op);
    }

    // Filter by status
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      filtered = filtered.filter(
        (trace) => trace.transaction.status && statuses.includes(trace.transaction.status)
      );
    }

    // Filter by time range
    if (filter.startTime) {
      const startTime = this.parseTimestamp(filter.startTime);
      filtered = filtered.filter(
        (trace) => this.parseTimestamp(trace.start_timestamp) >= startTime
      );
    }

    if (filter.endTime) {
      const endTime = this.parseTimestamp(filter.endTime);
      filtered = filtered.filter(
        (trace) => this.parseTimestamp(trace.start_timestamp) <= endTime
      );
    }

    // Filter by duration
    if (filter.minDuration !== undefined) {
      filtered = filtered.filter(
        (trace) => trace.duration !== undefined && trace.duration >= filter.minDuration!
      );
    }

    if (filter.maxDuration !== undefined) {
      filtered = filtered.filter(
        (trace) => trace.duration !== undefined && trace.duration <= filter.maxDuration!
      );
    }

    // Filter by sampled
    if (filter.sampled !== undefined) {
      filtered = filtered.filter((trace) => trace.transaction.sampled === filter.sampled);
    }

    // Filter by session ID
    if (filter.sessionId) {
      filtered = filtered.filter(
        (trace) => trace.transaction._sessionId === filter.sessionId
      );
    }

    // Apply ordering
    const orderBy = filter.orderBy || 'start_timestamp';
    const orderDirection = filter.orderDirection || 'desc';
    filtered = this.sortTraces(filtered, orderBy, orderDirection);

    // Apply pagination
    if (filter.offset) {
      filtered = filtered.slice(filter.offset);
    }

    if (filter.limit) {
      filtered = filtered.slice(0, filter.limit);
    }

    return filtered;
  }

  /**
   * Sort traces
   */
  private sortTraces(
    traces: TraceData[],
    orderBy: 'start_timestamp' | 'duration',
    direction: 'asc' | 'desc'
  ): TraceData[] {
    return traces.sort((a, b) => {
      let comparison: number;

      if (orderBy === 'duration') {
        comparison = (a.duration || 0) - (b.duration || 0);
      } else {
        comparison =
          this.parseTimestamp(a.start_timestamp).getTime() -
          this.parseTimestamp(b.start_timestamp).getTime();
      }

      return direction === 'desc' ? -comparison : comparison;
    });
  }

  // =========================================================================
  // Utility Methods
  // =========================================================================

  /**
   * Enforce a maximum limit on an array by removing oldest items
   */
  protected enforceLimit<T extends { timestamp?: string }>(
    items: T[],
    maxItems: number,
    timestampKey: keyof T = 'timestamp' as keyof T
  ): T[] {
    if (items.length <= maxItems) {
      return items;
    }

    // Sort by timestamp (oldest first) and remove oldest items
    const sorted = [...items].sort((a, b) => {
      const timeA = a[timestampKey] as unknown as string;
      const timeB = b[timestampKey] as unknown as string;
      return this.parseTimestamp(timeA).getTime() - this.parseTimestamp(timeB).getTime();
    });

    return sorted.slice(items.length - maxItems);
  }

  /**
   * Deep clone an object
   */
  protected deepClone<T>(obj: T): T {
    if (obj === null || typeof obj !== 'object') {
      return obj;
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.deepClone(item)) as T;
    }

    const cloned = {} as T;
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key]);
      }
    }

    return cloned;
  }
}
