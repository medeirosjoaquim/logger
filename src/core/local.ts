/**
 * Local Storage Extensions
 *
 * Provides functions for accessing locally stored logs and events.
 * These are extensions not available in the standard Sentry SDK.
 */

import { UniversalLogger } from './logger.js';
import type { LogEntry, SentryEvent, LogFilter, SentryEventFilter } from '../storage/types.js';

/**
 * Get local logs from storage
 *
 * @param filter - Optional filter criteria
 * @returns Promise resolving to array of log entries
 */
export async function getLocalLogs(filter?: LogFilter): Promise<LogEntry[]> {
  const logger = UniversalLogger.getInstance();
  return logger.getLocalLogs(filter);
}

/**
 * Get Sentry events from local storage
 *
 * @param filter - Optional filter criteria
 * @returns Promise resolving to array of Sentry events
 */
export async function getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]> {
  const logger = UniversalLogger.getInstance();
  return logger.getSentryEvents(filter);
}

/**
 * Clear all local data
 *
 * @returns Promise resolving when data is cleared
 */
export async function clearLocalData(): Promise<void> {
  const logger = UniversalLogger.getInstance();
  return logger.clearLocalData();
}

/**
 * Export logs to a string format
 *
 * @param format - Export format ('json' or 'csv')
 * @returns Promise resolving to exported data string
 */
export function exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
  const logger = UniversalLogger.getInstance();
  return logger.exportLogs(format);
}

/**
 * Get log statistics
 *
 * @returns Promise resolving to log statistics
 */
export async function getLogStats(): Promise<LogStats> {
  const logs = await getLocalLogs();

  const stats: LogStats = {
    total: logs.length,
    byLevel: {
      fatal: 0,
      error: 0,
      warning: 0,
      log: 0,
      info: 0,
      debug: 0,
    },
    oldest: undefined,
    newest: undefined,
    byHour: {},
  };

  for (const log of logs) {
    // Count by level
    if (log.level in stats.byLevel) {
      stats.byLevel[log.level]++;
    }

    // Track oldest/newest
    const timestamp = new Date(log.timestamp).getTime();
    if (!stats.oldest || timestamp < new Date(stats.oldest).getTime()) {
      stats.oldest = log.timestamp;
    }
    if (!stats.newest || timestamp > new Date(stats.newest).getTime()) {
      stats.newest = log.timestamp;
    }

    // Count by hour
    const hour = log.timestamp.substring(0, 13); // YYYY-MM-DDTHH
    stats.byHour[hour] = (stats.byHour[hour] || 0) + 1;
  }

  return stats;
}

/**
 * Log statistics
 */
export interface LogStats {
  /** Total number of logs */
  total: number;
  /** Count by severity level */
  byLevel: {
    fatal: number;
    error: number;
    warning: number;
    log: number;
    info: number;
    debug: number;
  };
  /** Timestamp of oldest log */
  oldest: string | undefined;
  /** Timestamp of newest log */
  newest: string | undefined;
  /** Count by hour (YYYY-MM-DDTHH -> count) */
  byHour: Record<string, number>;
}

/**
 * Search logs by message content
 *
 * @param query - Search query string
 * @param options - Search options
 * @returns Promise resolving to matching log entries
 */
export async function searchLogs(
  query: string,
  options?: SearchOptions
): Promise<LogEntry[]> {
  const logs = await getLocalLogs({
    level: options?.level,
    startTime: options?.startTime,
    endTime: options?.endTime,
    limit: options?.maxResults,
  });

  const normalizedQuery = query.toLowerCase();

  return logs.filter((log) => {
    // Search in message
    if (log.message?.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Search in exception
    if (log.exception?.value?.toLowerCase().includes(normalizedQuery)) {
      return true;
    }

    // Search in tags
    if (log.tags) {
      for (const value of Object.values(log.tags)) {
        if (value.toLowerCase().includes(normalizedQuery)) {
          return true;
        }
      }
    }

    return false;
  });
}

/**
 * Search options
 */
export interface SearchOptions {
  /** Filter by level */
  level?: 'fatal' | 'error' | 'warning' | 'log' | 'info' | 'debug';
  /** Filter by start time */
  startTime?: string;
  /** Filter by end time */
  endTime?: string;
  /** Maximum results to return */
  maxResults?: number;
}

/**
 * Get recent errors
 *
 * @param count - Number of errors to return (default: 10)
 * @returns Promise resolving to recent error logs
 */
export async function getRecentErrors(count: number = 10): Promise<LogEntry[]> {
  return getLocalLogs({
    level: ['error', 'fatal'],
    limit: count,
    orderBy: 'timestamp',
    orderDirection: 'desc',
  });
}

/**
 * Get logs for a specific trace
 *
 * @param traceId - The trace ID to filter by
 * @returns Promise resolving to logs in the trace
 */
export async function getLogsForTrace(traceId: string): Promise<LogEntry[]> {
  return getLocalLogs({
    traceId,
    orderBy: 'timestamp',
    orderDirection: 'asc',
  });
}

/**
 * Get logs for a specific session
 *
 * @param sessionId - The session ID to filter by
 * @returns Promise resolving to logs in the session
 */
export async function getLogsForSession(sessionId: string): Promise<LogEntry[]> {
  return getLocalLogs({
    sessionId,
    orderBy: 'timestamp',
    orderDirection: 'asc',
  });
}

/**
 * Export data for debugging
 *
 * Creates a comprehensive export of all local data for debugging purposes.
 *
 * @returns Promise resolving to debug export data
 */
export async function exportDebugData(): Promise<DebugExport> {
  const [logs, events, stats] = await Promise.all([
    getLocalLogs(),
    getSentryEvents(),
    getLogStats(),
  ]);

  return {
    exportedAt: new Date().toISOString(),
    stats,
    logs,
    events,
    environment: {
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
      url: typeof window !== 'undefined' ? window.location?.href : undefined,
      platform: typeof navigator !== 'undefined' ? navigator.platform : undefined,
    },
  };
}

/**
 * Debug export data structure
 */
export interface DebugExport {
  /** Export timestamp */
  exportedAt: string;
  /** Log statistics */
  stats: LogStats;
  /** All log entries */
  logs: LogEntry[];
  /** All Sentry events */
  events: SentryEvent[];
  /** Environment information */
  environment: {
    userAgent?: string;
    url?: string;
    platform?: string;
  };
}
