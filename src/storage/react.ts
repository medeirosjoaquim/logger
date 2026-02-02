/**
 * React Hooks for Zustand Storage Provider
 *
 * Provides reactive hooks that integrate with ZustandStorageProvider
 * for real-time updates in React components.
 */

import { useSyncExternalStore, useCallback, useMemo } from 'react';
import type { ZustandStorageProvider, LoggerStateWithActions } from './zustand.js';
import type {
  LogEntry,
  SentryEvent,
  LogSession,
  SpanData,
  TransactionData,
  TraceData,
  SeverityLevel,
} from './types.js';

// =============================================================================
// Hook Factory
// =============================================================================

/**
 * Create React hooks for a ZustandStorageProvider instance
 *
 * @param provider - The ZustandStorageProvider instance
 * @returns Object containing all available hooks
 *
 * @example
 * ```typescript
 * const provider = new ZustandStorageProvider();
 * await provider.init();
 *
 * const { useLogs, useEvents, useSessions } = createLoggerHooks(provider);
 *
 * function LogViewer() {
 *   const logs = useLogs();
 *   return <ul>{logs.map(log => <li key={log.id}>{log.message}</li>)}</ul>;
 * }
 * ```
 */
export function createLoggerHooks(provider: ZustandStorageProvider) {
  const store = provider.getStore();

  /**
   * Base hook for subscribing to store state
   */
  function useStoreSelector<T>(selector: (state: LoggerStateWithActions) => T): T {
    const getSnapshot = useCallback(() => selector(store.getState()), []);
    const subscribe = useCallback(
      (onStoreChange: () => void) => store.subscribe(onStoreChange),
      []
    );

    return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  }

  // ===========================================================================
  // Log Hooks
  // ===========================================================================

  /**
   * Hook for accessing all logs with optional filtering
   *
   * @param filter - Optional filter criteria
   * @returns Array of log entries
   */
  function useLogs(filter?: { level?: SeverityLevel | SeverityLevel[] }): LogEntry[] {
    const logs = useStoreSelector((state) => state.logs);

    return useMemo(() => {
      if (!filter) return logs;

      let filtered = logs;

      if (filter.level) {
        const levels = Array.isArray(filter.level) ? filter.level : [filter.level];
        filtered = filtered.filter((log) => levels.includes(log.level));
      }

      return filtered;
    }, [logs, filter?.level]);
  }

  /**
   * Hook for getting logs by session
   *
   * @param sessionId - The session ID to filter by
   * @returns Array of log entries for the session
   */
  function useLogsBySession(sessionId: string | null): LogEntry[] {
    const logs = useStoreSelector((state) => state.logs);

    return useMemo(() => {
      if (!sessionId) return [];
      return logs.filter((log) => log.sessionId === sessionId);
    }, [logs, sessionId]);
  }

  /**
   * Hook for getting the total log count
   *
   * @returns Number of logs
   */
  function useLogCount(): number {
    return useStoreSelector((state) => state.logs.length);
  }

  /**
   * Hook for getting error log count
   *
   * @returns Number of error/fatal logs
   */
  function useErrorCount(): number {
    const logs = useStoreSelector((state) => state.logs);

    return useMemo(
      () => logs.filter((log) => log.level === 'error' || log.level === 'fatal').length,
      [logs]
    );
  }

  // ===========================================================================
  // Event Hooks
  // ===========================================================================

  /**
   * Hook for accessing all Sentry events
   *
   * @returns Array of Sentry events
   */
  function useEvents(): SentryEvent[] {
    return useStoreSelector((state) => state.events);
  }

  /**
   * Hook for getting events with exceptions
   *
   * @returns Array of Sentry events that have exceptions
   */
  function useExceptionEvents(): SentryEvent[] {
    const events = useStoreSelector((state) => state.events);

    return useMemo(
      () => events.filter((event) => event.exception?.values && event.exception.values.length > 0),
      [events]
    );
  }

  /**
   * Hook for getting the total event count
   *
   * @returns Number of events
   */
  function useEventCount(): number {
    return useStoreSelector((state) => state.events.length);
  }

  // ===========================================================================
  // Session Hooks
  // ===========================================================================

  /**
   * Hook for accessing all sessions
   *
   * @returns Array of sessions
   */
  function useSessions(): LogSession[] {
    const sessions = useStoreSelector((state) => state.sessions);

    return useMemo(() => {
      const sessionList = Array.from(sessions.values());
      // Sort by startedAt descending
      sessionList.sort((a, b) => {
        const timeA = new Date(a.startedAt).getTime();
        const timeB = new Date(b.startedAt).getTime();
        return timeB - timeA;
      });
      return sessionList;
    }, [sessions]);
  }

  /**
   * Hook for accessing the current session
   *
   * @returns The current session or null
   */
  function useCurrentSession(): LogSession | null {
    const sessions = useStoreSelector((state) => state.sessions);
    const currentSessionId = useStoreSelector((state) => state.currentSessionId);

    return useMemo(() => {
      if (!currentSessionId) return null;
      return sessions.get(currentSessionId) || null;
    }, [sessions, currentSessionId]);
  }

  /**
   * Hook for getting the current session ID
   *
   * @returns The current session ID or null
   */
  function useCurrentSessionId(): string | null {
    return useStoreSelector((state) => state.currentSessionId);
  }

  /**
   * Hook for getting the total session count
   *
   * @returns Number of sessions
   */
  function useSessionCount(): number {
    return useStoreSelector((state) => state.sessions.size);
  }

  // ===========================================================================
  // Tracing Hooks
  // ===========================================================================

  /**
   * Hook for accessing all spans
   *
   * @returns Array of spans
   */
  function useSpans(): SpanData[] {
    return useStoreSelector((state) => state.spans);
  }

  /**
   * Hook for getting spans by trace ID
   *
   * @param traceId - The trace ID to filter by
   * @returns Array of spans for the trace
   */
  function useSpansByTrace(traceId: string | null): SpanData[] {
    const spans = useStoreSelector((state) => state.spans);

    return useMemo(() => {
      if (!traceId) return [];
      return spans.filter((span) => span.trace_id === traceId);
    }, [spans, traceId]);
  }

  /**
   * Hook for getting the total span count
   *
   * @returns Number of spans
   */
  function useSpanCount(): number {
    return useStoreSelector((state) => state.spans.length);
  }

  /**
   * Hook for accessing all transactions
   *
   * @returns Array of transactions
   */
  function useTransactions(): TransactionData[] {
    const transactions = useStoreSelector((state) => state.transactions);

    return useMemo(() => {
      const txList = Array.from(transactions.values());
      // Sort by start_timestamp descending
      txList.sort((a, b) => {
        const timeA = new Date(a.start_timestamp).getTime();
        const timeB = new Date(b.start_timestamp).getTime();
        return timeB - timeA;
      });
      return txList;
    }, [transactions]);
  }

  /**
   * Hook for getting the total transaction count
   *
   * @returns Number of transactions
   */
  function useTransactionCount(): number {
    return useStoreSelector((state) => state.transactions.size);
  }

  /**
   * Hook for accessing complete trace data (transactions with their spans)
   *
   * @returns Array of trace data
   */
  function useTraces(): TraceData[] {
    const transactions = useStoreSelector((state) => state.transactions);
    const spans = useStoreSelector((state) => state.spans);

    return useMemo(() => {
      // Group spans by trace_id
      const spansByTraceId = new Map<string, SpanData[]>();
      for (const span of spans) {
        const existing = spansByTraceId.get(span.trace_id) || [];
        existing.push(span);
        spansByTraceId.set(span.trace_id, existing);
      }

      // Build trace data
      const traces: TraceData[] = Array.from(transactions.values()).map((transaction) => {
        const traceSpans = spansByTraceId.get(transaction.trace_id) || [];

        let duration: number | undefined;
        if (transaction.timestamp) {
          const start = new Date(transaction.start_timestamp).getTime();
          const end = new Date(transaction.timestamp).getTime();
          duration = end - start;
        }

        return {
          trace_id: transaction.trace_id,
          transaction,
          spans: traceSpans,
          start_timestamp: transaction.start_timestamp,
          timestamp: transaction.timestamp,
          duration,
        };
      });

      // Sort by start_timestamp descending
      traces.sort((a, b) => {
        const timeA = new Date(a.start_timestamp).getTime();
        const timeB = new Date(b.start_timestamp).getTime();
        return timeB - timeA;
      });

      return traces;
    }, [transactions, spans]);
  }

  // ===========================================================================
  // Stats Hooks
  // ===========================================================================

  /**
   * Hook for getting storage statistics
   *
   * @returns Object with counts for all data types
   */
  function useStats(): {
    logs: number;
    sessions: number;
    events: number;
    spans: number;
    transactions: number;
  } {
    const logs = useStoreSelector((state) => state.logs.length);
    const sessions = useStoreSelector((state) => state.sessions.size);
    const events = useStoreSelector((state) => state.events.length);
    const spans = useStoreSelector((state) => state.spans.length);
    const transactions = useStoreSelector((state) => state.transactions.size);

    return useMemo(
      () => ({ logs, sessions, events, spans, transactions }),
      [logs, sessions, events, spans, transactions]
    );
  }

  // ===========================================================================
  // Action Hooks
  // ===========================================================================

  /**
   * Hook for getting storage actions
   *
   * @returns Object with action functions
   */
  function useActions() {
    const state = store.getState();

    return useMemo(
      () => ({
        clearLogs: state.clearLogs,
        clearEvents: state.clearEvents,
        clearSpans: state.clearSpans,
        clearTransactions: state.clearTransactions,
        clearAll: state.clearAll,
      }),
      []
    );
  }

  return {
    // Log hooks
    useLogs,
    useLogsBySession,
    useLogCount,
    useErrorCount,

    // Event hooks
    useEvents,
    useExceptionEvents,
    useEventCount,

    // Session hooks
    useSessions,
    useCurrentSession,
    useCurrentSessionId,
    useSessionCount,

    // Tracing hooks
    useSpans,
    useSpansByTrace,
    useSpanCount,
    useTransactions,
    useTransactionCount,
    useTraces,

    // Stats hooks
    useStats,

    // Action hooks
    useActions,

    // Base selector hook (for custom selectors)
    useStoreSelector,
  };
}

// =============================================================================
// Types Export
// =============================================================================

/**
 * Type for the hooks object returned by createLoggerHooks
 */
export type LoggerHooks = ReturnType<typeof createLoggerHooks>;
