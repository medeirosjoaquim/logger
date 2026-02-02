/**
 * Storage provider type definitions
 * Interfaces for local storage of logs and events
 */

import type { Event } from './sentry';
import type { SpanJSON } from './span';
import type {
  LogEntry,
  LogFilter,
  LogSession,
  LogStats,
  QueryResult,
  SentryEventFilter,
  StoredEvent,
  StoredSpan,
  TraceFilter,
} from './logger';

/**
 * Storage configuration options.
 */
export interface StorageConfig {
  /**
   * Storage type/backend to use.
   */
  type: 'memory' | 'indexeddb' | 'sqlite' | 'filesystem' | 'custom';

  /**
   * Maximum number of log entries to store.
   * @default 10000
   */
  maxLogEntries?: number;

  /**
   * Maximum number of events to store.
   * @default 1000
   */
  maxEvents?: number;

  /**
   * Maximum number of spans to store.
   * @default 5000
   */
  maxSpans?: number;

  /**
   * Maximum number of sessions to store.
   * @default 100
   */
  maxSessions?: number;

  /**
   * Time-to-live for log entries in milliseconds.
   * @default 7 days (604800000)
   */
  logTtl?: number;

  /**
   * Time-to-live for events in milliseconds.
   * @default 30 days (2592000000)
   */
  eventTtl?: number;

  /**
   * Time-to-live for spans in milliseconds.
   * @default 7 days (604800000)
   */
  spanTtl?: number;

  /**
   * Database name (for IndexedDB/SQLite).
   * @default 'universal-logger'
   */
  dbName?: string;

  /**
   * Database version (for IndexedDB).
   * @default 1
   */
  dbVersion?: number;

  /**
   * File path for filesystem storage.
   */
  filePath?: string;

  /**
   * Whether to compress stored data.
   * @default false
   */
  compress?: boolean;

  /**
   * Whether to encrypt stored data.
   * @default false
   */
  encrypt?: boolean;

  /**
   * Encryption key (required if encrypt is true).
   */
  encryptionKey?: string;

  /**
   * Whether to sync to cloud storage.
   * @default false
   */
  cloudSync?: boolean;

  /**
   * Cloud sync endpoint URL.
   */
  cloudSyncUrl?: string;

  /**
   * Cloud sync API key.
   */
  cloudSyncApiKey?: string;

  /**
   * Custom storage provider instance.
   */
  customProvider?: StorageProvider;
}

/**
 * Storage provider interface.
 * Implementations handle actual storage operations.
 */
export interface StorageProvider {
  /**
   * Provider name for identification.
   */
  readonly name: string;

  /**
   * Initialize the storage provider.
   * Called once when the logger is initialized.
   */
  init(): Promise<void>;

  /**
   * Close the storage provider and release resources.
   */
  close(): Promise<void>;

  /**
   * Check if the storage provider is ready.
   */
  isReady(): boolean;

  // ============= Log Entry Methods =============

  /**
   * Store a log entry.
   * @param entry - The log entry to store
   */
  storeLog(entry: LogEntry): Promise<void>;

  /**
   * Store multiple log entries in batch.
   * @param entries - The log entries to store
   */
  storeLogs(entries: LogEntry[]): Promise<void>;

  /**
   * Get a log entry by ID.
   * @param id - The log entry ID
   */
  getLog(id: string): Promise<LogEntry | null>;

  /**
   * Query log entries with filters.
   * @param filter - Filter options
   */
  queryLogs(filter?: LogFilter): Promise<QueryResult<LogEntry>>;

  /**
   * Delete a log entry by ID.
   * @param id - The log entry ID
   */
  deleteLog(id: string): Promise<boolean>;

  /**
   * Delete multiple log entries by IDs.
   * @param ids - The log entry IDs
   */
  deleteLogs(ids: string[]): Promise<number>;

  /**
   * Delete logs matching a filter.
   * @param filter - Filter options
   */
  deleteLogsByFilter(filter: LogFilter): Promise<number>;

  /**
   * Get log statistics.
   * @param filter - Optional filter for time range
   */
  getLogStats(filter?: LogFilter): Promise<LogStats>;

  // ============= Session Methods =============

  /**
   * Store a session.
   * @param session - The session to store
   */
  storeSession(session: LogSession): Promise<void>;

  /**
   * Get a session by ID.
   * @param id - The session ID
   */
  getSession(id: string): Promise<LogSession | null>;

  /**
   * Update a session.
   * @param id - The session ID
   * @param updates - Partial session updates
   */
  updateSession(id: string, updates: Partial<LogSession>): Promise<void>;

  /**
   * List all sessions.
   * @param limit - Maximum number of sessions to return
   * @param offset - Offset for pagination
   */
  listSessions(limit?: number, offset?: number): Promise<QueryResult<LogSession>>;

  /**
   * Delete a session and optionally its logs.
   * @param id - The session ID
   * @param deleteLogs - Whether to delete associated logs
   */
  deleteSession(id: string, deleteLogs?: boolean): Promise<boolean>;

  // ============= Event Methods =============

  /**
   * Store a Sentry event.
   * @param event - The event to store
   */
  storeEvent(event: StoredEvent): Promise<void>;

  /**
   * Get an event by ID.
   * @param id - The local event ID
   */
  getEvent(id: string): Promise<StoredEvent | null>;

  /**
   * Query events with filters.
   * @param filter - Filter options
   */
  queryEvents(filter?: SentryEventFilter): Promise<QueryResult<StoredEvent>>;

  /**
   * Update event metadata (e.g., mark as sent to Sentry).
   * @param id - The local event ID
   * @param updates - Partial event updates
   */
  updateEvent(id: string, updates: Partial<StoredEvent>): Promise<void>;

  /**
   * Delete an event by ID.
   * @param id - The local event ID
   */
  deleteEvent(id: string): Promise<boolean>;

  /**
   * Get events that haven't been sent to Sentry.
   * @param limit - Maximum number of events to return
   */
  getUnsentEvents(limit?: number): Promise<StoredEvent[]>;

  // ============= Span Methods =============

  /**
   * Store a span.
   * @param span - The span to store
   */
  storeSpan(span: StoredSpan): Promise<void>;

  /**
   * Store multiple spans in batch.
   * @param spans - The spans to store
   */
  storeSpans(spans: StoredSpan[]): Promise<void>;

  /**
   * Get a span by ID.
   * @param id - The local span ID
   */
  getSpan(id: string): Promise<StoredSpan | null>;

  /**
   * Query spans with filters.
   * @param filter - Filter options
   */
  querySpans(filter?: TraceFilter): Promise<QueryResult<StoredSpan>>;

  /**
   * Get all spans for a trace.
   * @param traceId - The trace ID
   */
  getSpansByTrace(traceId: string): Promise<StoredSpan[]>;

  /**
   * Delete a span by ID.
   * @param id - The local span ID
   */
  deleteSpan(id: string): Promise<boolean>;

  // ============= Maintenance Methods =============

  /**
   * Clear all stored data.
   */
  clear(): Promise<void>;

  /**
   * Get storage usage statistics.
   */
  getStorageStats(): Promise<StorageStats>;

  /**
   * Run cleanup to remove expired entries.
   */
  cleanup(): Promise<CleanupResult>;

  /**
   * Export all data for backup.
   */
  export(): Promise<StorageExport>;

  /**
   * Import data from backup.
   * @param data - The exported data to import
   */
  import(data: StorageExport): Promise<ImportResult>;

  /**
   * Compact storage (if supported).
   */
  compact?(): Promise<void>;
}

/**
 * Storage usage statistics.
 */
export interface StorageStats {
  /**
   * Number of log entries.
   */
  logCount: number;

  /**
   * Number of sessions.
   */
  sessionCount: number;

  /**
   * Number of events.
   */
  eventCount: number;

  /**
   * Number of spans.
   */
  spanCount: number;

  /**
   * Total storage size in bytes (if available).
   */
  totalSizeBytes?: number;

  /**
   * Log storage size in bytes.
   */
  logSizeBytes?: number;

  /**
   * Event storage size in bytes.
   */
  eventSizeBytes?: number;

  /**
   * Span storage size in bytes.
   */
  spanSizeBytes?: number;

  /**
   * Oldest log timestamp.
   */
  oldestLog?: string;

  /**
   * Newest log timestamp.
   */
  newestLog?: string;

  /**
   * Oldest event timestamp.
   */
  oldestEvent?: string;

  /**
   * Newest event timestamp.
   */
  newestEvent?: string;
}

/**
 * Cleanup operation result.
 */
export interface CleanupResult {
  /**
   * Number of logs deleted.
   */
  logsDeleted: number;

  /**
   * Number of events deleted.
   */
  eventsDeleted: number;

  /**
   * Number of spans deleted.
   */
  spansDeleted: number;

  /**
   * Number of sessions deleted.
   */
  sessionsDeleted: number;

  /**
   * Bytes freed (if available).
   */
  bytesFreed?: number;

  /**
   * Duration of cleanup in milliseconds.
   */
  durationMs: number;
}

/**
 * Exported storage data for backup.
 */
export interface StorageExport {
  /**
   * Export version for compatibility.
   */
  version: number;

  /**
   * Export timestamp.
   */
  exportedAt: string;

  /**
   * Log entries.
   */
  logs: LogEntry[];

  /**
   * Sessions.
   */
  sessions: LogSession[];

  /**
   * Events.
   */
  events: StoredEvent[];

  /**
   * Spans.
   */
  spans: StoredSpan[];

  /**
   * Additional metadata.
   */
  metadata?: Record<string, unknown>;
}

/**
 * Import operation result.
 */
export interface ImportResult {
  /**
   * Number of logs imported.
   */
  logsImported: number;

  /**
   * Number of sessions imported.
   */
  sessionsImported: number;

  /**
   * Number of events imported.
   */
  eventsImported: number;

  /**
   * Number of spans imported.
   */
  spansImported: number;

  /**
   * Number of items skipped (duplicates).
   */
  skipped: number;

  /**
   * Errors encountered during import.
   */
  errors: string[];
}

/**
 * Storage migration interface.
 */
export interface StorageMigration {
  /**
   * Migration version number.
   */
  version: number;

  /**
   * Migration name/description.
   */
  name: string;

  /**
   * Run the migration.
   * @param storage - The storage provider
   */
  up(storage: StorageProvider): Promise<void>;

  /**
   * Rollback the migration.
   * @param storage - The storage provider
   */
  down(storage: StorageProvider): Promise<void>;
}

/**
 * Storage event types for listeners.
 */
export type StorageEventType =
  | 'log:added'
  | 'log:deleted'
  | 'session:added'
  | 'session:updated'
  | 'session:deleted'
  | 'event:added'
  | 'event:updated'
  | 'event:deleted'
  | 'span:added'
  | 'span:deleted'
  | 'cleanup'
  | 'clear';

/**
 * Storage event listener callback.
 */
export type StorageEventListener = (
  event: StorageEventType,
  data: unknown
) => void;

/**
 * Extended storage provider with event support.
 */
export interface StorageProviderWithEvents extends StorageProvider {
  /**
   * Add an event listener.
   * @param event - Event type to listen for
   * @param listener - Callback function
   */
  on(event: StorageEventType, listener: StorageEventListener): void;

  /**
   * Remove an event listener.
   * @param event - Event type
   * @param listener - Callback function to remove
   */
  off(event: StorageEventType, listener: StorageEventListener): void;

  /**
   * Emit an event.
   * @param event - Event type
   * @param data - Event data
   */
  emit(event: StorageEventType, data: unknown): void;
}
