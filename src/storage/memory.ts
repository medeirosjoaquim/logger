/**
 * Memory Storage Provider
 *
 * In-memory storage implementation for fast, non-persistent storage.
 * Ideal for development, testing, or short-lived sessions.
 */

import { BaseStorageProvider, DEFAULT_CONFIG } from './base.js';
import type {
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
} from './types.js';

/**
 * In-memory storage provider
 *
 * Features:
 * - Fast read/write operations
 * - Configurable maximum items per store
 * - Automatic eviction of oldest items when limits are reached
 * - No persistence (data lost on page reload)
 */
export class MemoryStorageProvider extends BaseStorageProvider {
  readonly name = 'memory';

  // Storage arrays
  private logs: LogEntry[] = [];
  private sessions: Map<string, LogSession> = new Map();
  private events: SentryEvent[] = [];
  private spans: SpanData[] = [];
  private transactions: Map<string, TransactionData> = new Map();

  constructor(config?: StorageProviderConfig) {
    super(config);
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Initialize the memory storage provider
   */
  async init(): Promise<void> {
    // Memory storage doesn't require initialization
    this._ready = true;
  }

  /**
   * Close the memory storage provider
   */
  async close(): Promise<void> {
    this._ready = false;
    // Clear all data
    this.logs = [];
    this.sessions.clear();
    this.events = [];
    this.spans = [];
    this.transactions.clear();
  }

  // =========================================================================
  // Log Operations
  // =========================================================================

  /**
   * Save a log entry to memory
   */
  async saveLog(entry: LogEntry): Promise<void> {
    this.ensureReady();

    // Ensure the entry has an ID and timestamp
    const logEntry: LogEntry = {
      ...entry,
      id: entry.id || this.generateUUID(),
      timestamp: entry.timestamp || this.getCurrentTimestamp(),
    };

    this.logs.push(logEntry);

    // Enforce maximum logs limit
    if (this.logs.length > this.config.maxLogs) {
      // Remove oldest entries
      this.logs = this.enforceLimit(this.logs, this.config.maxLogs);
    }
  }

  /**
   * Get log entries matching the filter
   */
  async getLogs(filter?: LogFilter): Promise<LogEntry[]> {
    this.ensureReady();

    if (!filter) {
      // Return all logs (cloned to prevent mutation)
      return this.logs.map((log) => this.deepClone(log));
    }

    const filtered = this.filterLogs(this.logs, filter);
    return filtered.map((log) => this.deepClone(log));
  }

  /**
   * Clear log entries matching the filter
   */
  async clearLogs(filter?: LogFilter): Promise<void> {
    this.ensureReady();

    if (!filter) {
      this.logs = [];
      return;
    }

    // Get IDs of logs that match the filter
    const toRemove = this.filterLogs(this.logs, filter);
    const removeIds = new Set(toRemove.map((log) => log.id));

    // Remove matching logs
    this.logs = this.logs.filter((log) => !removeIds.has(log.id));
  }

  // =========================================================================
  // Session Operations
  // =========================================================================

  /**
   * Create a new session
   */
  async createSession(session: LogSession): Promise<void> {
    this.ensureReady();

    const sessionEntry: LogSession = {
      ...session,
      id: session.id || this.generateUUID(),
      startedAt: session.startedAt || this.getCurrentTimestamp(),
      status: session.status || 'ok',
      errors: session.errors || 0,
    };

    this.sessions.set(sessionEntry.id, sessionEntry);

    // Enforce maximum sessions limit
    if (this.sessions.size > this.config.maxSessions) {
      // Remove oldest sessions
      const sessionsArray = Array.from(this.sessions.values());
      const sorted = sessionsArray.sort(
        (a, b) =>
          this.parseTimestamp(a.startedAt).getTime() -
          this.parseTimestamp(b.startedAt).getTime()
      );

      // Remove oldest sessions until we're under the limit
      const toRemove = sorted.slice(0, this.sessions.size - this.config.maxSessions);
      for (const session of toRemove) {
        this.sessions.delete(session.id);
      }
    }
  }

  /**
   * Update an existing session
   */
  async updateSession(sessionId: string, updates: Partial<LogSession>): Promise<void> {
    this.ensureReady();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Merge updates
    const updated: LogSession = {
      ...session,
      ...updates,
      id: session.id, // Don't allow ID changes
    };

    this.sessions.set(sessionId, updated);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    this.ensureReady();

    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const endedAt = this.getCurrentTimestamp();
    const duration = this.calculateDuration(session.startedAt, endedAt);

    const updated: LogSession = {
      ...session,
      endedAt,
      duration,
      status: session.errors > 0 ? 'crashed' : 'exited',
    };

    this.sessions.set(sessionId, updated);
  }

  /**
   * Get sessions
   */
  async getSessions(limit?: number): Promise<LogSession[]> {
    this.ensureReady();

    let sessions = Array.from(this.sessions.values());

    // Sort by startedAt descending
    sessions.sort(
      (a, b) =>
        this.parseTimestamp(b.startedAt).getTime() -
        this.parseTimestamp(a.startedAt).getTime()
    );

    if (limit) {
      sessions = sessions.slice(0, limit);
    }

    return sessions.map((s) => this.deepClone(s));
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<LogSession | null> {
    this.ensureReady();

    const session = this.sessions.get(sessionId);
    return session ? this.deepClone(session) : null;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureReady();

    this.sessions.delete(sessionId);

    // Also remove logs associated with this session
    this.logs = this.logs.filter((log) => log.sessionId !== sessionId);
  }

  // =========================================================================
  // Sentry Event Operations
  // =========================================================================

  /**
   * Save a Sentry event
   */
  async saveSentryEvent(event: SentryEvent): Promise<void> {
    this.ensureReady();

    const eventEntry: SentryEvent = {
      ...event,
      event_id: event.event_id || this.generateUUID().replace(/-/g, ''),
      timestamp: event.timestamp || this.getCurrentTimestamp(),
      _localTimestamp: this.getCurrentTimestamp(),
    };

    this.events.push(eventEntry);

    // Enforce maximum events limit
    if (this.events.length > this.config.maxEvents) {
      this.events = this.enforceLimit(this.events, this.config.maxEvents);
    }
  }

  /**
   * Get Sentry events matching the filter
   */
  async getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]> {
    this.ensureReady();

    if (!filter) {
      return this.events.map((e) => this.deepClone(e));
    }

    const filtered = this.filterSentryEvents(this.events, filter);
    return filtered.map((e) => this.deepClone(e));
  }

  /**
   * Clear all Sentry events
   */
  async clearSentryEvents(): Promise<void> {
    this.ensureReady();
    this.events = [];
  }

  // =========================================================================
  // Tracing Operations
  // =========================================================================

  /**
   * Save a span
   */
  async saveSpan(span: SpanData): Promise<void> {
    this.ensureReady();

    const spanEntry: SpanData = {
      ...span,
      span_id: span.span_id || this.generateShortId(16),
      trace_id: span.trace_id || this.generateShortId(32),
      start_timestamp: span.start_timestamp || this.getCurrentTimestamp(),
    };

    this.spans.push(spanEntry);

    // Enforce maximum spans limit
    if (this.spans.length > this.config.maxSpans) {
      this.spans = this.enforceLimit(
        this.spans,
        this.config.maxSpans,
        'start_timestamp' as keyof SpanData
      );
    }
  }

  /**
   * Save a transaction
   */
  async saveTransaction(transaction: TransactionData): Promise<void> {
    this.ensureReady();

    const transactionEntry: TransactionData = {
      ...transaction,
      transaction_id: transaction.transaction_id || this.generateUUID(),
      trace_id: transaction.trace_id || this.generateShortId(32),
      start_timestamp: transaction.start_timestamp || this.getCurrentTimestamp(),
    };

    this.transactions.set(transactionEntry.transaction_id, transactionEntry);

    // Enforce maximum transactions limit
    if (this.transactions.size > this.config.maxTransactions) {
      const transactionsArray = Array.from(this.transactions.values());
      const sorted = transactionsArray.sort(
        (a, b) =>
          this.parseTimestamp(a.start_timestamp).getTime() -
          this.parseTimestamp(b.start_timestamp).getTime()
      );

      const toRemove = sorted.slice(
        0,
        this.transactions.size - this.config.maxTransactions
      );
      for (const t of toRemove) {
        this.transactions.delete(t.transaction_id);
      }
    }
  }

  /**
   * Get traces matching the filter
   */
  async getTraces(filter?: TraceFilter): Promise<TraceData[]> {
    this.ensureReady();

    // Build trace data from transactions and their spans
    const traces: TraceData[] = [];
    const transactionsList = Array.from(this.transactions.values());

    for (const transaction of transactionsList) {
      // Find all spans for this trace
      const traceSpans = this.spans.filter(
        (span) => span.trace_id === transaction.trace_id
      );

      // Calculate duration
      let duration: number | undefined;
      if (transaction.timestamp) {
        duration = this.calculateDuration(
          transaction.start_timestamp,
          transaction.timestamp
        );
      }

      const traceData: TraceData = {
        trace_id: transaction.trace_id,
        transaction: this.deepClone(transaction),
        spans: traceSpans.map((s) => this.deepClone(s)),
        start_timestamp: transaction.start_timestamp,
        timestamp: transaction.timestamp,
        duration,
      };

      traces.push(traceData);
    }

    if (!filter) {
      // Sort by start_timestamp descending
      traces.sort(
        (a, b) =>
          this.parseTimestamp(b.start_timestamp).getTime() -
          this.parseTimestamp(a.start_timestamp).getTime()
      );
      return traces;
    }

    return this.filterTraces(traces, filter);
  }

  /**
   * Clear all trace data
   */
  async clearTraces(): Promise<void> {
    this.ensureReady();
    this.spans = [];
    this.transactions.clear();
  }

  // =========================================================================
  // Helper Methods
  // =========================================================================

  /**
   * Ensure the provider is ready
   */
  private ensureReady(): void {
    if (!this._ready) {
      throw new Error('MemoryStorageProvider is not initialized. Call init() first.');
    }
  }

  // =========================================================================
  // Debug/Stats Methods
  // =========================================================================

  /**
   * Get storage statistics (useful for debugging)
   */
  getStats(): {
    logs: number;
    sessions: number;
    events: number;
    spans: number;
    transactions: number;
  } {
    return {
      logs: this.logs.length,
      sessions: this.sessions.size,
      events: this.events.length,
      spans: this.spans.length,
      transactions: this.transactions.size,
    };
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    this.ensureReady();
    this.logs = [];
    this.sessions.clear();
    this.events = [];
    this.spans = [];
    this.transactions.clear();
  }
}
