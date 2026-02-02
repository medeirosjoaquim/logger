/**
 * React Hooks for Logger Integration
 *
 * Custom hooks for subscribing to logger data and updates.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SentryEvent,
  TraceData,
  LogEntry,
  LogSession,
  Breadcrumb,
  SentryEventFilter,
  TraceFilter,
  LogFilter,
} from '../../storage/types.js';
import type { UniversalLogger } from '../types.js';

/**
 * Hook for accessing Sentry events from the logger
 */
export function useLoggerEvents(
  logger: UniversalLogger,
  filter?: SentryEventFilter
) {
  const [events, setEvents] = useState<SentryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchEvents = useCallback(async () => {
    try {
      setLoading(true);
      const data = await logger.storage.getSentryEvents(filter);
      setEvents(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch events'));
    } finally {
      setLoading(false);
    }
  }, [logger.storage, filter]);

  useEffect(() => {
    fetchEvents();

    // Subscribe to updates if available
    if (logger.subscribe) {
      return logger.subscribe(fetchEvents);
    }

    // Fallback: poll for updates
    const interval = setInterval(fetchEvents, 2000);
    return () => clearInterval(interval);
  }, [fetchEvents, logger.subscribe]);

  const clearEvents = useCallback(async () => {
    await logger.storage.clearSentryEvents();
    setEvents([]);
  }, [logger.storage]);

  return { events, loading, error, refresh: fetchEvents, clear: clearEvents };
}

/**
 * Hook for accessing traces from the logger
 */
export function useLoggerTraces(
  logger: UniversalLogger,
  filter?: TraceFilter
) {
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchTraces = useCallback(async () => {
    try {
      setLoading(true);
      const data = await logger.storage.getTraces(filter);
      setTraces(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch traces'));
    } finally {
      setLoading(false);
    }
  }, [logger.storage, filter]);

  useEffect(() => {
    fetchTraces();

    if (logger.subscribe) {
      return logger.subscribe(fetchTraces);
    }

    const interval = setInterval(fetchTraces, 2000);
    return () => clearInterval(interval);
  }, [fetchTraces, logger.subscribe]);

  const clearTraces = useCallback(async () => {
    await logger.storage.clearTraces();
    setTraces([]);
  }, [logger.storage]);

  return { traces, loading, error, refresh: fetchTraces, clear: clearTraces };
}

/**
 * Hook for accessing log entries from the logger
 */
export function useLoggerLogs(
  logger: UniversalLogger,
  filter?: LogFilter
) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchLogs = useCallback(async () => {
    try {
      setLoading(true);
      const data = await logger.storage.getLogs(filter);
      setLogs(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch logs'));
    } finally {
      setLoading(false);
    }
  }, [logger.storage, filter]);

  useEffect(() => {
    fetchLogs();

    if (logger.subscribe) {
      return logger.subscribe(fetchLogs);
    }

    const interval = setInterval(fetchLogs, 2000);
    return () => clearInterval(interval);
  }, [fetchLogs, logger.subscribe]);

  const clearLogs = useCallback(async () => {
    await logger.storage.clearLogs();
    setLogs([]);
  }, [logger.storage]);

  return { logs, loading, error, refresh: fetchLogs, clear: clearLogs };
}

/**
 * Hook for accessing sessions from the logger
 */
export function useLoggerSessions(
  logger: UniversalLogger,
  limit?: number
) {
  const [sessions, setSessions] = useState<LogSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSessions = useCallback(async () => {
    try {
      setLoading(true);
      const data = await logger.storage.getSessions(limit);
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch sessions'));
    } finally {
      setLoading(false);
    }
  }, [logger.storage, limit]);

  useEffect(() => {
    fetchSessions();

    if (logger.subscribe) {
      return logger.subscribe(fetchSessions);
    }

    const interval = setInterval(fetchSessions, 2000);
    return () => clearInterval(interval);
  }, [fetchSessions, logger.subscribe]);

  return { sessions, loading, error, refresh: fetchSessions };
}

/**
 * Hook for accessing breadcrumbs from the current scope
 */
export function useLoggerBreadcrumbs(logger: UniversalLogger) {
  const [breadcrumbs, setBreadcrumbs] = useState<Breadcrumb[]>([]);

  const fetchBreadcrumbs = useCallback(() => {
    if (logger.getScope) {
      const scope = logger.getScope();
      setBreadcrumbs(scope.getBreadcrumbs());
    }
  }, [logger]);

  useEffect(() => {
    fetchBreadcrumbs();

    if (logger.subscribe) {
      return logger.subscribe(fetchBreadcrumbs);
    }

    const interval = setInterval(fetchBreadcrumbs, 1000);
    return () => clearInterval(interval);
  }, [fetchBreadcrumbs, logger.subscribe]);

  return { breadcrumbs, refresh: fetchBreadcrumbs };
}

/**
 * Hook for auto-refreshing data at an interval
 */
export function useAutoRefresh(
  callback: () => void | Promise<void>,
  intervalMs: number = 2000,
  enabled: boolean = true
) {
  const savedCallback = useRef(callback);

  useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;

    const tick = () => {
      savedCallback.current();
    };

    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs, enabled]);
}

/**
 * Hook for keyboard shortcuts
 */
export function useKeyboardShortcut(
  key: string,
  callback: () => void,
  modifiers: { ctrl?: boolean; alt?: boolean; shift?: boolean; meta?: boolean } = {}
) {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (
        event.key === key &&
        !!event.ctrlKey === !!modifiers.ctrl &&
        !!event.altKey === !!modifiers.alt &&
        !!event.shiftKey === !!modifiers.shift &&
        !!event.metaKey === !!modifiers.meta
      ) {
        event.preventDefault();
        callback();
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [key, callback, modifiers.ctrl, modifiers.alt, modifiers.shift, modifiers.meta]);
}

/**
 * Hook for local storage persistence
 */
export function useLocalStorage<T>(key: string, initialValue: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch {
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (valueOrFn: T | ((prev: T) => T)) => {
      try {
        setStoredValue((prev) => {
          const newValue = typeof valueOrFn === 'function'
            ? (valueOrFn as (prev: T) => T)(prev)
            : valueOrFn;
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, JSON.stringify(newValue));
          }
          return newValue;
        });
      } catch {
        // Ignore storage errors
      }
    },
    [key]
  );

  return [storedValue, setValue];
}

/**
 * Hook for debouncing values
 */
export function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}
