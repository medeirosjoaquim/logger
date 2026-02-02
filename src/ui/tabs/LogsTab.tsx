/**
 * Logs Tab Component
 *
 * Displays local log entries with level filtering and search.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { LogEntry, LogFilter, SeverityLevel } from '../../storage/types.js';
import type { UniversalLogger, ThemeColors, LogsFilterState } from '../types.js';
import { createStyles, getSeverityColor } from '../styles.js';
import { useLoggerLogs, useDebounce } from '../hooks/useLogger.js';
import { JsonViewer } from '../components/JsonViewer.js';
import { StackTrace } from '../components/StackTrace.js';
import { ExportDropdown } from '../components/Export.js';

export interface LogsTabProps {
  logger: UniversalLogger;
  colors: ThemeColors;
  maxHeight: string;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const date = new Date(timestamp);
    return date.toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  } catch {
    return timestamp;
  }
}

/**
 * Get level badge style
 */
function getLevelBadgeStyle(level: SeverityLevel, colors: ThemeColors): React.CSSProperties {
  const color = getSeverityColor(level, colors);
  return {
    display: 'inline-block',
    padding: '2px 6px',
    borderRadius: '3px',
    fontSize: '10px',
    fontWeight: 600,
    textTransform: 'uppercase',
    backgroundColor: color + '20',
    color: color,
  };
}

/**
 * Logs tab component
 */
export function LogsTab({ logger, colors, maxHeight }: LogsTabProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Filter state
  const [filter, setFilter] = useState<LogsFilterState>({
    level: 'all',
    search: '',
  });
  const debouncedSearch = useDebounce(filter.search || '', 300);

  // Build storage filter
  const storageFilter = useMemo<LogFilter>(() => {
    const f: LogFilter = {
      orderBy: 'timestamp',
      orderDirection: 'desc',
      limit: 200,
    };

    if (filter.level && filter.level !== 'all') {
      f.level = filter.level as SeverityLevel;
    }

    if (debouncedSearch) {
      f.search = debouncedSearch;
    }

    return f;
  }, [filter.level, debouncedSearch]);

  // Fetch logs
  const { logs, loading, error, refresh, clear } = useLoggerLogs(logger, storageFilter);

  // Selected log
  const [selectedLogId, setSelectedLogId] = useState<string | null>(null);
  const selectedLog = useMemo(
    () => logs.find((l) => l.id === selectedLogId) || null,
    [logs, selectedLogId]
  );

  // View mode
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  const handleSelectLog = useCallback((logId: string) => {
    setSelectedLogId((prev) => (prev === logId ? null : logId));
  }, []);

  // Count errors
  const errorCount = useMemo(
    () => logs.filter((l) => l.level === 'error' || l.level === 'fatal').length,
    [logs]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Search logs..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          style={styles.searchInput}
        />

        <select
          value={filter.level || 'all'}
          onChange={(e) => setFilter({ ...filter, level: e.target.value as LogsFilterState['level'] })}
          style={styles.select}
        >
          <option value="all">All Levels</option>
          <option value="fatal">Fatal</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="log">Log</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        <button onClick={refresh} style={styles.button}>
          Refresh
        </button>

        <button onClick={clear} style={styles.button}>
          Clear
        </button>

        <ExportDropdown data={logs} filename="logs" colors={colors} />

        {/* Error count badge */}
        {errorCount > 0 && (
          <span
            style={{
              padding: '4px 8px',
              borderRadius: '4px',
              backgroundColor: colors.error,
              color: '#ffffff',
              fontSize: '11px',
              fontWeight: 600,
            }}
          >
            {errorCount} error{errorCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          maxHeight,
        }}
      >
        {/* Error state */}
        {error && (
          <div style={{ ...styles.emptyState, color: colors.error }}>
            <span>Error loading logs: {error.message}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && logs.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateText}>Loading logs...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && logs.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateIcon}>[_]</span>
            <span style={styles.emptyStateText}>
              {debouncedSearch ? 'No logs match the search' : 'No logs recorded yet'}
            </span>
          </div>
        )}

        {/* Log list */}
        {logs.length > 0 && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* List */}
            <ul
              style={{
                ...styles.list,
                flex: selectedLog ? '0 0 50%' : '1',
                borderRight: selectedLog ? `1px solid ${colors.border}` : 'none',
                overflow: 'auto',
              }}
            >
              {logs.map((log) => (
                <li
                  key={log.id}
                  onClick={() => handleSelectLog(log.id)}
                  style={{
                    ...styles.listItem,
                    ...(selectedLogId === log.id ? styles.listItemSelected : {}),
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedLogId !== log.id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedLogId !== log.id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={styles.eventItem}>
                    <div
                      style={{
                        ...styles.eventLevel,
                        backgroundColor: getSeverityColor(log.level, colors),
                      }}
                    />
                    <div style={styles.eventContent}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={getLevelBadgeStyle(log.level, colors)}>{log.level}</span>
                        <span
                          style={{
                            ...styles.eventMessage,
                            flex: 1,
                          }}
                        >
                          {log.message}
                        </span>
                      </div>
                      <div style={styles.eventMeta}>
                        <span>{formatTimestamp(log.timestamp)}</span>
                        {log.exception && <span style={{ color: colors.error }}>[Exception]</span>}
                        {log.traceId && (
                          <span title={log.traceId}>
                            trace:{log.traceId.slice(0, 8)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Detail panel */}
            {selectedLog && (
              <div
                style={{
                  flex: '0 0 50%',
                  overflow: 'auto',
                  backgroundColor: colors.bgSecondary,
                }}
              >
                <LogDetail
                  log={selectedLog}
                  colors={colors}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onClose={() => setSelectedLogId(null)}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Log detail component
 */
interface LogDetailProps {
  log: LogEntry;
  colors: ThemeColors;
  viewMode: 'formatted' | 'raw';
  onViewModeChange: (mode: 'formatted' | 'raw') => void;
  onClose: () => void;
}

function LogDetail({ log, colors, viewMode, onViewModeChange, onClose }: LogDetailProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  return (
    <div style={{ padding: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginBottom: '16px',
        }}
      >
        <h3
          style={{
            margin: 0,
            fontSize: '14px',
            fontWeight: 600,
            color: colors.textPrimary,
          }}
        >
          Log Details
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => onViewModeChange(viewMode === 'formatted' ? 'raw' : 'formatted')}
            style={styles.button}
          >
            {viewMode === 'formatted' ? 'Show Raw' : 'Show Formatted'}
          </button>
          <button onClick={onClose} style={styles.buttonIcon} title="Close">
            X
          </button>
        </div>
      </div>

      {viewMode === 'raw' ? (
        <JsonViewer data={log} colors={colors} expandLevel={2} />
      ) : (
        <>
          {/* Message */}
          <div style={styles.detailSection}>
            <div style={styles.detailSectionTitle}>Message</div>
            <div
              style={{
                padding: '12px',
                backgroundColor: colors.bgTertiary,
                borderRadius: '4px',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
              }}
            >
              {log.message}
            </div>
          </div>

          {/* Metadata */}
          <div style={styles.detailSection}>
            <div style={styles.detailSectionTitle}>Metadata</div>
            <div
              style={{
                padding: '12px',
                backgroundColor: colors.bgTertiary,
                borderRadius: '4px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <span style={{ color: colors.textMuted }}>Level: </span>
                  <span style={{ color: getSeverityColor(log.level, colors) }}>{log.level}</span>
                </div>
                <div>
                  <span style={{ color: colors.textMuted }}>Timestamp: </span>
                  <span>{formatTimestamp(log.timestamp)}</span>
                </div>
                {log.environment && (
                  <div>
                    <span style={{ color: colors.textMuted }}>Environment: </span>
                    <span>{log.environment}</span>
                  </div>
                )}
                {log.release && (
                  <div>
                    <span style={{ color: colors.textMuted }}>Release: </span>
                    <span>{log.release}</span>
                  </div>
                )}
                {log.traceId && (
                  <div>
                    <span style={{ color: colors.textMuted }}>Trace ID: </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{log.traceId}</span>
                  </div>
                )}
                {log.spanId && (
                  <div>
                    <span style={{ color: colors.textMuted }}>Span ID: </span>
                    <span style={{ fontFamily: 'monospace', fontSize: '11px' }}>{log.spanId}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Exception */}
          {log.exception && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Exception</div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                }}
              >
                <div style={{ fontWeight: 500, color: colors.error }}>
                  {log.exception.type || 'Error'}
                </div>
                <div style={{ color: colors.textSecondary, marginTop: '4px' }}>
                  {log.exception.value}
                </div>
              </div>
            </div>
          )}

          {/* Stack trace */}
          {log.exception?.stacktrace?.frames && log.exception.stacktrace.frames.length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Stack Trace</div>
              <StackTrace frames={log.exception.stacktrace.frames} colors={colors} />
            </div>
          )}

          {/* Raw stack trace string */}
          {log.stacktrace && !log.exception?.stacktrace && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Stack Trace</div>
              <pre
                style={{
                  padding: '12px',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                  fontSize: '11px',
                  fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  margin: 0,
                }}
              >
                {log.stacktrace}
              </pre>
            </div>
          )}

          {/* Tags */}
          {log.tags && Object.keys(log.tags).length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Tags</div>
              <div>
                {Object.entries(log.tags).map(([key, value]) => (
                  <span key={key} style={styles.tag}>
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User */}
          {log.user && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>User</div>
              <JsonViewer data={log.user} colors={colors} expandLevel={2} />
            </div>
          )}

          {/* Extra */}
          {log.extra && Object.keys(log.extra).length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Extra Data</div>
              <JsonViewer data={log.extra} colors={colors} expandLevel={1} />
            </div>
          )}

          {/* Contexts */}
          {log.contexts && Object.keys(log.contexts).length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Contexts</div>
              <JsonViewer data={log.contexts} colors={colors} expandLevel={1} />
            </div>
          )}

          {/* Request */}
          {log.request && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Request</div>
              <JsonViewer data={log.request} colors={colors} expandLevel={1} />
            </div>
          )}

          {/* Breadcrumbs */}
          {log.breadcrumbs && log.breadcrumbs.length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>
                Breadcrumbs ({log.breadcrumbs.length})
              </div>
              <div
                style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                }}
              >
                {log.breadcrumbs.slice(-10).map((bc, index) => (
                  <div
                    key={index}
                    style={{
                      padding: '8px 12px',
                      borderBottom: `1px solid ${colors.borderLight}`,
                      fontSize: '12px',
                    }}
                  >
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{ color: colors.textMuted }}>{bc.category || bc.type || 'default'}</span>
                      <span style={{ flex: 1 }}>{bc.message || '-'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
