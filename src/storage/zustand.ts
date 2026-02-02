/**
 * Zustand Storage Provider
 *
 * Reactive storage implementation using Zustand for state management.
 * Provides optional persistence to localStorage/sessionStorage and
 * subscription-based updates for React integration.
 */

import { createStore, type StoreApi } from 'zustand/vanilla';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import { BaseStorageProvider } from './base.js';
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

// =============================================================================
// Zustand State Types
// =============================================================================

/**
 * Internal Zustand state shape
 */
export interface LoggerState {
  logs: LogEntry[];
  sessions: Map<string, LogSession>;
  events: SentryEvent[];
  spans: SpanData[];
  transactions: Map<string, TransactionData>;
  currentSessionId: string | null;
}

/**
 * Zustand state with actions
 */
export interface LoggerStateWithActions extends LoggerState {
  // Log actions
  addLog: (entry: LogEntry) => void;
  setLogs: (logs: LogEntry[]) => void;
  clearLogs: () => void;

  // Session actions
  addSession: (session: LogSession) => void;
  updateSession: (id: string, updates: Partial<LogSession>) => void;
  removeSession: (id: string) => void;
  setCurrentSessionId: (id: string | null) => void;

  // Event actions
  addEvent: (event: SentryEvent) => void;
  clearEvents: () => void;

  // Span actions
  addSpan: (span: SpanData) => void;
  clearSpans: () => void;

  // Transaction actions
  addTransaction: (transaction: TransactionData) => void;
  removeTransaction: (id: string) => void;
  clearTransactions: () => void;

  // Bulk actions
  clearAll: () => void;
}

/**
 * Serializable state for persistence
 */
interface SerializableState {
  logs: LogEntry[];
  sessions: [string, LogSession][];
  events: SentryEvent[];
  spans: SpanData[];
  transactions: [string, TransactionData][];
  currentSessionId: string | null;
}

// =============================================================================
// Zustand Storage Options
// =============================================================================

/**
 * Configuration options for ZustandStorageProvider
 */
export interface ZustandStorageOptions extends StorageProviderConfig {
  /** Storage name for persistence */
  name?: string;
  /** Enable persistence to web storage */
  persist?: boolean;
  /** Web storage type for persistence */
  storage?: 'localStorage' | 'sessionStorage';
}

/**
 * Default Zustand storage configuration
 */
const ZUSTAND_DEFAULTS: Required<Pick<ZustandStorageOptions, 'name' | 'persist' | 'storage'>> = {
  name: 'universal-logger',
  persist: true,
  storage: 'localStorage',
};

// =============================================================================
// ZustandStorageProvider
// =============================================================================

/**
 * Zustand-based storage provider
 *
 * Features:
 * - Reactive state management with Zustand
 * - Optional persistence to localStorage/sessionStorage
 * - Configurable maximum items per store
 * - Subscribe to state changes for real-time updates
 * - Compatible with React via zustand hooks
 */
export class ZustandStorageProvider extends BaseStorageProvider {
  readonly name = 'zustand';

  private store: StoreApi<LoggerStateWithActions>;
  private zustandOptions: Required<Pick<ZustandStorageOptions, 'name' | 'persist' | 'storage'>>;

  constructor(options: ZustandStorageOptions = {}) {
    super(options);
    this.zustandOptions = {
      name: options.name ?? ZUSTAND_DEFAULTS.name,
      persist: options.persist ?? ZUSTAND_DEFAULTS.persist,
      storage: options.storage ?? ZUSTAND_DEFAULTS.storage,
    };
    this.store = this.createStore();
  }

  /**
   * Create the Zustand store with optional persistence
   */
  private createStore(): StoreApi<LoggerStateWithActions> {
    const initialState: LoggerState = {
      logs: [],
      sessions: new Map(),
      events: [],
      spans: [],
      transactions: new Map(),
      currentSessionId: null,
    };

    type SetState = StoreApi<LoggerStateWithActions>['setState'];

    const storeCreator = (
      set: SetState,
      _get: StoreApi<LoggerStateWithActions>['getState']
    ): LoggerStateWithActions => ({
      ...initialState,

      // Log actions
      addLog: (entry: LogEntry) =>
        set((state: LoggerStateWithActions) => ({
          logs: [...state.logs, entry].slice(-this.config.maxLogs),
        })),

      setLogs: (logs: LogEntry[]) => set({ logs }),

      clearLogs: () => set({ logs: [] }),

      // Session actions
      addSession: (session: LogSession) =>
        set((state: LoggerStateWithActions) => {
          const newSessions = new Map(state.sessions);
          newSessions.set(session.id, session);

          // Enforce max sessions limit
          if (newSessions.size > this.config.maxSessions) {
            const sorted = Array.from(newSessions.entries()).sort(
              (a: [string, LogSession], b: [string, LogSession]) =>
                this.parseTimestamp(a[1].startedAt).getTime() -
                this.parseTimestamp(b[1].startedAt).getTime()
            );
            const toRemove = sorted.slice(0, newSessions.size - this.config.maxSessions);
            for (const [id] of toRemove) {
              newSessions.delete(id);
            }
          }

          return {
            sessions: newSessions,
            currentSessionId: session.id,
          };
        }),

      updateSession: (id: string, updates: Partial<LogSession>) =>
        set((state: LoggerStateWithActions) => {
          const session = state.sessions.get(id);
          if (!session) return state;

          const newSessions = new Map(state.sessions);
          newSessions.set(id, { ...session, ...updates, id: session.id });
          return { sessions: newSessions };
        }),

      removeSession: (id: string) =>
        set((state: LoggerStateWithActions) => {
          const newSessions = new Map(state.sessions);
          newSessions.delete(id);
          return {
            sessions: newSessions,
            logs: state.logs.filter((log: LogEntry) => log.sessionId !== id),
          };
        }),

      setCurrentSessionId: (id: string | null) => set({ currentSessionId: id }),

      // Event actions
      addEvent: (event: SentryEvent) =>
        set((state: LoggerStateWithActions) => ({
          events: [...state.events, event].slice(-this.config.maxEvents),
        })),

      clearEvents: () => set({ events: [] }),

      // Span actions
      addSpan: (span: SpanData) =>
        set((state: LoggerStateWithActions) => ({
          spans: [...state.spans, span].slice(-this.config.maxSpans),
        })),

      clearSpans: () => set({ spans: [] }),

      // Transaction actions
      addTransaction: (transaction: TransactionData) =>
        set((state: LoggerStateWithActions) => {
          const newTransactions = new Map(state.transactions);
          newTransactions.set(transaction.transaction_id, transaction);

          // Enforce max transactions limit
          if (newTransactions.size > this.config.maxTransactions) {
            const sorted = Array.from(newTransactions.entries()).sort(
              (a: [string, TransactionData], b: [string, TransactionData]) =>
                this.parseTimestamp(a[1].start_timestamp).getTime() -
                this.parseTimestamp(b[1].start_timestamp).getTime()
            );
            const toRemove = sorted.slice(0, newTransactions.size - this.config.maxTransactions);
            for (const [id] of toRemove) {
              newTransactions.delete(id);
            }
          }

          return { transactions: newTransactions };
        }),

      removeTransaction: (id: string) =>
        set((state: LoggerStateWithActions) => {
          const newTransactions = new Map(state.transactions);
          newTransactions.delete(id);
          return { transactions: newTransactions };
        }),

      clearTransactions: () => set({ transactions: new Map() }),

      // Bulk actions
      clearAll: () =>
        set({
          logs: [],
          sessions: new Map(),
          events: [],
          spans: [],
          transactions: new Map(),
          currentSessionId: null,
        }),
    });

    if (this.zustandOptions.persist) {
      const getStorage = (): StateStorage => {
        const storage =
          this.zustandOptions.storage === 'sessionStorage' ? sessionStorage : localStorage;
        return {
          getItem: (name: string): string | null => storage.getItem(name),
          setItem: (name: string, value: string): void => storage.setItem(name, value),
          removeItem: (name: string): void => storage.removeItem(name),
        };
      };

      return createStore(
        persist(storeCreator, {
          name: this.zustandOptions.name,
          storage: createJSONStorage(getStorage),
          partialize: (state: LoggerStateWithActions): SerializableState => ({
            logs: state.logs,
            sessions: Array.from(state.sessions.entries()),
            events: state.events,
            spans: state.spans,
            transactions: Array.from(state.transactions.entries()),
            currentSessionId: state.currentSessionId,
          }),
          merge: (
            persisted: unknown,
            current: LoggerStateWithActions
          ): LoggerStateWithActions => {
            const persistedState = persisted as SerializableState | undefined;
            if (!persistedState) return current;

            return {
              ...current,
              logs: persistedState.logs ?? [],
              sessions: new Map(persistedState.sessions ?? []),
              events: persistedState.events ?? [],
              spans: persistedState.spans ?? [],
              transactions: new Map(persistedState.transactions ?? []),
              currentSessionId: persistedState.currentSessionId ?? null,
            };
          },
        })
      );
    }

    return createStore(storeCreator);
  }

  // =========================================================================
  // Lifecycle Methods
  // =========================================================================

  /**
   * Initialize the Zustand storage provider
   */
  async init(): Promise<void> {
    this._ready = true;
  }

  /**
   * Close the Zustand storage provider
   */
  async close(): Promise<void> {
    this._ready = false;
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

    this.store.getState().addLog(logEntry);
  }

  /**
   * Get log entries matching the filter
   */
  async getLogs(filter?: LogFilter): Promise<LogEntry[]> {
    this.ensureReady();

    const logs = this.store.getState().logs;

    if (!filter) {
      return logs.map((log) => this.deepClone(log));
    }

    return this.filterLogs(logs, filter).map((log) => this.deepClone(log));
  }

  /**
   * Clear log entries matching the filter
   */
  async clearLogs(filter?: LogFilter): Promise<void> {
    this.ensureReady();

    if (!filter) {
      this.store.getState().clearLogs();
      return;
    }

    // Get IDs of logs that match the filter
    const toRemove = this.filterLogs(this.store.getState().logs, filter);
    const removeIds = new Set(toRemove.map((log) => log.id));

    // Keep logs that don't match the filter
    const remaining = this.store.getState().logs.filter((log: LogEntry) => !removeIds.has(log.id));
    this.store.getState().setLogs(remaining);
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

    this.store.getState().addSession(sessionEntry);
  }

  /**
   * Update an existing session
   */
  async updateSession(sessionId: string, updates: Partial<LogSession>): Promise<void> {
    this.ensureReady();

    const session = this.store.getState().sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    this.store.getState().updateSession(sessionId, updates);
  }

  /**
   * End a session
   */
  async endSession(sessionId: string): Promise<void> {
    this.ensureReady();

    const session = this.store.getState().sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    const endedAt = this.getCurrentTimestamp();
    const duration = this.calculateDuration(session.startedAt, endedAt);

    this.store.getState().updateSession(sessionId, {
      endedAt,
      duration,
      status: session.errors > 0 ? 'crashed' : 'exited',
    });
  }

  /**
   * Get sessions
   */
  async getSessions(limit?: number): Promise<LogSession[]> {
    this.ensureReady();

    const sessionsMap = this.store.getState().sessions;
    let sessions: LogSession[] = Array.from(sessionsMap.values());

    // Sort by startedAt descending
    sessions.sort(
      (a, b) =>
        this.parseTimestamp(b.startedAt).getTime() - this.parseTimestamp(a.startedAt).getTime()
    );

    if (limit) {
      sessions = sessions.slice(0, limit);
    }

    return sessions.map((s: LogSession) => this.deepClone(s));
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<LogSession | null> {
    this.ensureReady();

    const session = this.store.getState().sessions.get(sessionId);
    return session ? this.deepClone(session) : null;
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<void> {
    this.ensureReady();
    this.store.getState().removeSession(sessionId);
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

    this.store.getState().addEvent(eventEntry);
  }

  /**
   * Get Sentry events matching the filter
   */
  async getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]> {
    this.ensureReady();

    const events = this.store.getState().events;

    if (!filter) {
      return events.map((e) => this.deepClone(e));
    }

    return this.filterSentryEvents(events, filter).map((e) => this.deepClone(e));
  }

  /**
   * Clear all Sentry events
   */
  async clearSentryEvents(): Promise<void> {
    this.ensureReady();
    this.store.getState().clearEvents();
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

    this.store.getState().addSpan(spanEntry);
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

    this.store.getState().addTransaction(transactionEntry);
  }

  /**
   * Get traces matching the filter
   */
  async getTraces(filter?: TraceFilter): Promise<TraceData[]> {
    this.ensureReady();

    const transactionsMap = this.store.getState().transactions;
    const transactions: TransactionData[] = Array.from(transactionsMap.values());
    const allSpans = this.store.getState().spans;

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
        duration = this.calculateDuration(transaction.start_timestamp, transaction.timestamp);
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
    this.store.getState().clearSpans();
    this.store.getState().clearTransactions();
  }

  // =========================================================================
  // Zustand-Specific Methods
  // =========================================================================

  /**
   * Subscribe to state changes
   * @param listener - Callback function called on state changes
   * @returns Unsubscribe function
   */
  subscribe(listener: (state: LoggerStateWithActions) => void): () => void {
    return this.store.subscribe(listener);
  }

  /**
   * Subscribe to a specific state selector
   * @param selector - Function to select part of the state
   * @param listener - Callback function called when selected state changes
   * @returns Unsubscribe function
   */
  subscribeWithSelector<T>(
    selector: (state: LoggerStateWithActions) => T,
    listener: (value: T, previousValue: T) => void
  ): () => void {
    let previousValue = selector(this.store.getState());

    return this.store.subscribe((state: LoggerStateWithActions) => {
      const currentValue = selector(state);
      if (currentValue !== previousValue) {
        listener(currentValue, previousValue);
        previousValue = currentValue;
      }
    });
  }

  /**
   * Get current state snapshot
   */
  getState(): LoggerStateWithActions {
    return this.store.getState();
  }

  /**
   * Get the underlying Zustand store (for advanced usage)
   */
  getStore(): StoreApi<LoggerStateWithActions> {
    return this.store;
  }

  /**
   * Get the current session ID
   */
  getCurrentSessionId(): string | null {
    return this.store.getState().currentSessionId;
  }

  /**
   * Get the current session
   */
  async getCurrentSession(): Promise<LogSession | null> {
    const id = this.getCurrentSessionId();
    return id ? this.getSession(id) : null;
  }

  // =========================================================================
  // Debug/Stats Methods
  // =========================================================================

  /**
   * Get storage statistics
   */
  getStats(): {
    logs: number;
    sessions: number;
    events: number;
    spans: number;
    transactions: number;
  } {
    const state = this.store.getState();
    return {
      logs: state.logs.length,
      sessions: state.sessions.size,
      events: state.events.length,
      spans: state.spans.length,
      transactions: state.transactions.size,
    };
  }

  /**
   * Clear all data
   */
  async clearAll(): Promise<void> {
    this.ensureReady();
    this.store.getState().clearAll();
  }

  // =========================================================================
  // Private Helpers
  // =========================================================================

  /**
   * Ensure the provider is ready
   */
  private ensureReady(): void {
    if (!this._ready) {
      throw new Error('ZustandStorageProvider is not initialized. Call init() first.');
    }
  }
}
