/**
 * IndexedDB Storage Provider
 *
 * Persistent storage implementation using IndexedDB for browser environments.
 * Supports offline persistence and efficient querying with indexes.
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

// Store names
const STORE_LOGS = 'logs';
const STORE_SESSIONS = 'sessions';
const STORE_EVENTS = 'events';
const STORE_SPANS = 'spans';
const STORE_TRANSACTIONS = 'transactions';

/**
 * IndexedDB storage provider
 *
 * Features:
 * - Persistent storage across page reloads
 * - Efficient indexing for common queries
 * - Transaction-based operations for data integrity
 * - Supports large data volumes
 */
export class IndexedDBStorageProvider extends BaseStorageProvider {
  readonly name = 'indexeddb';

  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor(config?: StorageProviderConfig) {
    super(config);
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Initialize the IndexedDB storage provider
   */
  async init(): Promise<void> {
    // Return existing promise if already initializing
    if (this.initPromise) {
      return this.initPromise;
    }

    // Return immediately if already ready
    if (this._ready && this.db) {
      return;
    }

    this.initPromise = this.initDatabase();
    await this.initPromise;
  }

  /**
   * Initialize the database
   */
  private async initDatabase(): Promise<void> {
    // Check for IndexedDB support
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not supported in this environment');
    }

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.config.dbName, this.config.dbVersion);

      request.onerror = () => {
        this.initPromise = null;
        reject(new Error(`Failed to open IndexedDB: ${request.error?.message}`));
      };

      request.onsuccess = () => {
        this.db = request.result;
        this._ready = true;

        // Handle connection errors
        this.db.onerror = (event) => {
          console.error('IndexedDB error:', event);
        };

        // Handle version change (another tab upgraded the database)
        this.db.onversionchange = () => {
          this.db?.close();
          this._ready = false;
          this.db = null;
          console.warn('IndexedDB version changed. Closing connection.');
        };

        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        this.createObjectStores(db);
      };
    });
  }

  /**
   * Create object stores and indexes
   */
  private createObjectStores(db: IDBDatabase): void {
    // Logs store
    if (!db.objectStoreNames.contains(STORE_LOGS)) {
      const logsStore = db.createObjectStore(STORE_LOGS, { keyPath: 'id' });
      logsStore.createIndex('timestamp', 'timestamp', { unique: false });
      logsStore.createIndex('level', 'level', { unique: false });
      logsStore.createIndex('sessionId', 'sessionId', { unique: false });
      logsStore.createIndex('traceId', 'traceId', { unique: false });
      logsStore.createIndex('eventId', 'eventId', { unique: false });
      logsStore.createIndex('level_timestamp', ['level', 'timestamp'], { unique: false });
    }

    // Sessions store
    if (!db.objectStoreNames.contains(STORE_SESSIONS)) {
      const sessionsStore = db.createObjectStore(STORE_SESSIONS, { keyPath: 'id' });
      sessionsStore.createIndex('startedAt', 'startedAt', { unique: false });
      sessionsStore.createIndex('status', 'status', { unique: false });
    }

    // Events store (Sentry events)
    if (!db.objectStoreNames.contains(STORE_EVENTS)) {
      const eventsStore = db.createObjectStore(STORE_EVENTS, { keyPath: 'event_id' });
      eventsStore.createIndex('timestamp', 'timestamp', { unique: false });
      eventsStore.createIndex('level', 'level', { unique: false });
      eventsStore.createIndex('type', 'type', { unique: false });
      eventsStore.createIndex('environment', 'environment', { unique: false });
      eventsStore.createIndex('release', 'release', { unique: false });
      eventsStore.createIndex('_localTimestamp', '_localTimestamp', { unique: false });
    }

    // Spans store
    if (!db.objectStoreNames.contains(STORE_SPANS)) {
      const spansStore = db.createObjectStore(STORE_SPANS, { keyPath: 'span_id' });
      spansStore.createIndex('trace_id', 'trace_id', { unique: false });
      spansStore.createIndex('parent_span_id', 'parent_span_id', { unique: false });
      spansStore.createIndex('start_timestamp', 'start_timestamp', { unique: false });
      spansStore.createIndex('_transactionId', '_transactionId', { unique: false });
      spansStore.createIndex('_sessionId', '_sessionId', { unique: false });
    }

    // Transactions store
    if (!db.objectStoreNames.contains(STORE_TRANSACTIONS)) {
      const transactionsStore = db.createObjectStore(STORE_TRANSACTIONS, {
        keyPath: 'transaction_id',
      });
      transactionsStore.createIndex('trace_id', 'trace_id', { unique: false });
      transactionsStore.createIndex('name', 'name', { unique: false });
      transactionsStore.createIndex('start_timestamp', 'start_timestamp', { unique: false });
      transactionsStore.createIndex('_sessionId', '_sessionId', { unique: false });
    }
  }

  /**
   * Close the IndexedDB connection
   */
  async close(): Promise<void> {
    if (this.db) {
      this.db.close();
      this.db = null;
    }
    this._ready = false;
    this.initPromise = null;
  }

  // =========================================================================
  // Log Operations
  // =========================================================================

  /**
   * Save a log entry
   */
  async saveLog(entry: LogEntry): Promise<void> {
    this.ensureReady();

    const logEntry: LogEntry = {
      ...entry,
      id: entry.id || this.generateUUID(),
      timestamp: entry.timestamp || this.getCurrentTimestamp(),
    };

    await this.putRecord(STORE_LOGS, logEntry);
  }

  /**
   * Get log entries matching the filter
   */
  async getLogs(filter?: LogFilter): Promise<LogEntry[]> {
    this.ensureReady();

    const logs = await this.getAllRecords<LogEntry>(STORE_LOGS);

    if (!filter) {
      // Sort by timestamp descending
      logs.sort(
        (a, b) =>
          this.parseTimestamp(b.timestamp).getTime() -
          this.parseTimestamp(a.timestamp).getTime()
      );
      return logs;
    }

    return this.filterLogs(logs, filter);
  }

  /**
   * Clear log entries matching the filter
   */
  async clearLogs(filter?: LogFilter): Promise<void> {
    this.ensureReady();

    if (!filter) {
      await this.clearStore(STORE_LOGS);
      return;
    }

    // Get logs matching the filter and delete them
    const logs = await this.getLogs(filter);
    const transaction = this.db!.transaction(STORE_LOGS, 'readwrite');
    const store = transaction.objectStore(STORE_LOGS);

    for (const log of logs) {
      store.delete(log.id);
    }

    await this.transactionComplete(transaction);
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

    await this.putRecord(STORE_SESSIONS, sessionEntry);
  }

  /**
   * Update an existing session
   */
  async updateSession(sessionId: string, updates: Partial<LogSession>): Promise<void> {
    this.ensureReady();

    const session = await this.getRecord<LogSession>(STORE_SESSIONS, sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const updated: LogSession = {
      ...session,
      ...updates,
      id: session.id, // Don't allow ID changes
    };

    await this.putRecord(STORE_SESSIONS, updated);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    this.ensureReady();

    const session = await this.getRecord<LogSession>(STORE_SESSIONS, sessionId);
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

    await this.putRecord(STORE_SESSIONS, updated);
  }

  /**
   * Get sessions
   */
  async getSessions(limit?: number): Promise<LogSession[]> {
    this.ensureReady();

    let sessions = await this.getAllRecords<LogSession>(STORE_SESSIONS);

    // Sort by startedAt descending
    sessions.sort(
      (a, b) =>
        this.parseTimestamp(b.startedAt).getTime() -
        this.parseTimestamp(a.startedAt).getTime()
    );

    if (limit) {
      sessions = sessions.slice(0, limit);
    }

    return sessions;
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<LogSession | null> {
    this.ensureReady();
    return this.getRecord<LogSession>(STORE_SESSIONS, sessionId);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureReady();

    // Delete the session
    await this.deleteRecord(STORE_SESSIONS, sessionId);

    // Delete associated logs
    const logs = await this.getLogs({ sessionId });
    if (logs.length > 0) {
      const transaction = this.db!.transaction(STORE_LOGS, 'readwrite');
      const store = transaction.objectStore(STORE_LOGS);

      for (const log of logs) {
        store.delete(log.id);
      }

      await this.transactionComplete(transaction);
    }
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

    await this.putRecord(STORE_EVENTS, eventEntry);
  }

  /**
   * Get Sentry events matching the filter
   */
  async getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]> {
    this.ensureReady();

    const events = await this.getAllRecords<SentryEvent>(STORE_EVENTS);

    if (!filter) {
      // Sort by timestamp descending
      events.sort(
        (a, b) =>
          this.parseTimestamp(b.timestamp).getTime() -
          this.parseTimestamp(a.timestamp).getTime()
      );
      return events;
    }

    return this.filterSentryEvents(events, filter);
  }

  /**
   * Clear all Sentry events
   */
  async clearSentryEvents(): Promise<void> {
    this.ensureReady();
    await this.clearStore(STORE_EVENTS);
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

    await this.putRecord(STORE_SPANS, spanEntry);
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

    await this.putRecord(STORE_TRANSACTIONS, transactionEntry);
  }

  /**
   * Get traces matching the filter
   */
  async getTraces(filter?: TraceFilter): Promise<TraceData[]> {
    this.ensureReady();

    const transactions = await this.getAllRecords<TransactionData>(STORE_TRANSACTIONS);
    const allSpans = await this.getAllRecords<SpanData>(STORE_SPANS);

    // Group spans by trace_id for efficient lookup
    const spansByTraceId = new Map<string, SpanData[]>();
    for (const span of allSpans) {
      const existing = spansByTraceId.get(span.trace_id) || [];
      existing.push(span);
      spansByTraceId.set(span.trace_id, existing);
    }

    // Build trace data
    const traces: TraceData[] = transactions.map((transaction) => {
      const traceSpans = spansByTraceId.get(transaction.trace_id) || [];

      let duration: number | undefined;
      if (transaction.timestamp) {
        duration = this.calculateDuration(
          transaction.start_timestamp,
          transaction.timestamp
        );
      }

      return {
        trace_id: transaction.trace_id,
        transaction: this.deepClone(transaction),
        spans: traceSpans.map((s) => this.deepClone(s)),
        start_timestamp: transaction.start_timestamp,
        timestamp: transaction.timestamp,
        duration,
      };
    });

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
    await Promise.all([this.clearStore(STORE_SPANS), this.clearStore(STORE_TRANSACTIONS)]);
  }

  // =========================================================================
  // IndexedDB Helper Methods
  // =========================================================================

  /**
   * Ensure the database is ready
   */
  private ensureReady(): void {
    if (!this._ready || !this.db) {
      throw new Error('IndexedDBStorageProvider is not initialized. Call init() first.');
    }
  }

  /**
   * Get a single record by key
   */
  private getRecord<T>(storeName: string, key: IDBValidKey): Promise<T | null> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(key);

      request.onsuccess = () => {
        resolve(request.result || null);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get record: ${request.error?.message}`));
      };
    });
  }

  /**
   * Get all records from a store
   */
  private getAllRecords<T>(storeName: string): Promise<T[]> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();

      request.onsuccess = () => {
        resolve(request.result || []);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get records: ${request.error?.message}`));
      };
    });
  }

  /**
   * Put a record in a store (insert or update)
   */
  private putRecord<T>(storeName: string, record: T): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(record);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to put record: ${request.error?.message}`));
      };
    });
  }

  /**
   * Delete a record from a store
   */
  private deleteRecord(storeName: string, key: IDBValidKey): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(key);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete record: ${request.error?.message}`));
      };
    });
  }

  /**
   * Clear all records from a store
   */
  private clearStore(storeName: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.clear();

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to clear store: ${request.error?.message}`));
      };
    });
  }

  /**
   * Wait for a transaction to complete
   */
  private transactionComplete(transaction: IDBTransaction): Promise<void> {
    return new Promise((resolve, reject) => {
      transaction.oncomplete = () => {
        resolve();
      };

      transaction.onerror = () => {
        reject(new Error(`Transaction failed: ${transaction.error?.message}`));
      };

      transaction.onabort = () => {
        reject(new Error('Transaction aborted'));
      };
    });
  }

  // =========================================================================
  // Debug/Maintenance Methods
  // =========================================================================

  /**
   * Get storage statistics
   */
  async getStats(): Promise<{
    logs: number;
    sessions: number;
    events: number;
    spans: number;
    transactions: number;
  }> {
    this.ensureReady();

    const [logs, sessions, events, spans, transactions] = await Promise.all([
      this.getCount(STORE_LOGS),
      this.getCount(STORE_SESSIONS),
      this.getCount(STORE_EVENTS),
      this.getCount(STORE_SPANS),
      this.getCount(STORE_TRANSACTIONS),
    ]);

    return { logs, sessions, events, spans, transactions };
  }

  /**
   * Get count of records in a store
   */
  private getCount(storeName: string): Promise<number> {
    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.count();

      request.onsuccess = () => {
        resolve(request.result);
      };

      request.onerror = () => {
        reject(new Error(`Failed to get count: ${request.error?.message}`));
      };
    });
  }

  /**
   * Clear all data from all stores
   */
  async clearAll(): Promise<void> {
    this.ensureReady();
    await Promise.all([
      this.clearStore(STORE_LOGS),
      this.clearStore(STORE_SESSIONS),
      this.clearStore(STORE_EVENTS),
      this.clearStore(STORE_SPANS),
      this.clearStore(STORE_TRANSACTIONS),
    ]);
  }

  /**
   * Delete the entire database
   */
  async deleteDatabase(): Promise<void> {
    // Close the connection first
    await this.close();

    return new Promise((resolve, reject) => {
      const request = indexedDB.deleteDatabase(this.config.dbName);

      request.onsuccess = () => {
        resolve();
      };

      request.onerror = () => {
        reject(new Error(`Failed to delete database: ${request.error?.message}`));
      };

      request.onblocked = () => {
        console.warn('Database deletion blocked - close all other connections');
      };
    });
  }
}
