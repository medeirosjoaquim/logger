/**
 * Sessions Tab Component
 *
 * Displays logging sessions with status, duration, and error count.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { LogSession } from '../../storage/types.js';
import type { UniversalLogger, ThemeColors } from '../types.js';
import { createStyles } from '../styles.js';
import { useLoggerSessions } from '../hooks/useLogger.js';
import { JsonViewer } from '../components/JsonViewer.js';
import { ExportDropdown } from '../components/Export.js';

export interface SessionsTabProps {
  logger: UniversalLogger;
  colors: ThemeColors;
  maxHeight: string;
}

/**
 * Format duration for display
 */
function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || durationMs === null) {
    return 'Ongoing';
  }

  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }

  if (durationMs < 60000) {
    return `${(durationMs / 1000).toFixed(1)}s`;
  }

  const minutes = Math.floor(durationMs / 60000);
  const seconds = Math.floor((durationMs % 60000) / 1000);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: string | undefined): string {
  if (!timestamp) return 'Unknown';
  try {
    const date = new Date(timestamp);
    return date.toLocaleString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return timestamp;
  }
}

/**
 * Get status color
 */
function getSessionStatusColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case 'ok':
    case 'exited':
      return colors.success;
    case 'crashed':
      return colors.error;
    case 'abnormal':
      return colors.warning;
    default:
      return colors.textSecondary;
  }
}

/**
 * Get status background color
 */
function getSessionStatusBgColor(status: string, colors: ThemeColors): string {
  switch (status) {
    case 'ok':
    case 'exited':
      return colors.success + '20';
    case 'crashed':
      return colors.error + '20';
    case 'abnormal':
      return colors.warning + '20';
    default:
      return colors.bgTertiary;
  }
}

/**
 * Sessions tab component
 */
export function SessionsTab({ logger, colors, maxHeight }: SessionsTabProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Fetch sessions
  const { sessions, loading, error, refresh } = useLoggerSessions(logger, 50);

  // Selected session
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const selectedSession = useMemo(
    () => sessions.find((s) => s.id === selectedSessionId) || null,
    [sessions, selectedSessionId]
  );

  const handleSelectSession = useCallback((sessionId: string) => {
    setSelectedSessionId((prev) => (prev === sessionId ? null : sessionId));
  }, []);

  // Calculate stats
  const stats = useMemo(() => {
    const total = sessions.length;
    const crashed = sessions.filter((s) => s.status === 'crashed').length;
    const totalErrors = sessions.reduce((sum, s) => sum + (s.errors || 0), 0);

    return { total, crashed, totalErrors };
  }, [sessions]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={{ flex: 1, display: 'flex', gap: '16px', fontSize: '12px' }}>
          <span>
            <span style={{ color: colors.textMuted }}>Total: </span>
            <span style={{ fontWeight: 500 }}>{stats.total}</span>
          </span>
          <span>
            <span style={{ color: colors.textMuted }}>Crashed: </span>
            <span style={{ fontWeight: 500, color: stats.crashed > 0 ? colors.error : colors.textPrimary }}>
              {stats.crashed}
            </span>
          </span>
          <span>
            <span style={{ color: colors.textMuted }}>Total Errors: </span>
            <span style={{ fontWeight: 500, color: stats.totalErrors > 0 ? colors.error : colors.textPrimary }}>
              {stats.totalErrors}
            </span>
          </span>
        </div>

        <button onClick={refresh} style={styles.button}>
          Refresh
        </button>

        <ExportDropdown data={sessions} filename="sessions" colors={colors} />
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
            <span>Error loading sessions: {error.message}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && sessions.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateText}>Loading sessions...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && sessions.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateIcon}>[S]</span>
            <span style={styles.emptyStateText}>No sessions recorded yet</span>
          </div>
        )}

        {/* Session list */}
        {sessions.length > 0 && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* List */}
            <div
              style={{
                flex: selectedSession ? '0 0 50%' : '1',
                borderRight: selectedSession ? `1px solid ${colors.border}` : 'none',
                overflow: 'auto',
              }}
            >
              {sessions.map((session) => {
                const isSelected = selectedSessionId === session.id;
                const isCurrent = !session.endedAt;

                return (
                  <div
                    key={session.id}
                    onClick={() => handleSelectSession(session.id)}
                    style={{
                      ...styles.sessionItem,
                      backgroundColor: isSelected ? colors.bgSelected : 'transparent',
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgHover;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                      }
                    }}
                  >
                    {/* Header */}
                    <div style={styles.sessionHeader}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={styles.sessionId}>{session.id.slice(0, 12)}...</span>
                        {isCurrent && (
                          <span
                            style={{
                              padding: '2px 6px',
                              borderRadius: '3px',
                              fontSize: '9px',
                              fontWeight: 600,
                              backgroundColor: colors.accent,
                              color: '#ffffff',
                            }}
                          >
                            CURRENT
                          </span>
                        )}
                      </div>
                      <span
                        style={{
                          ...styles.sessionStatus,
                          backgroundColor: getSessionStatusBgColor(session.status, colors),
                          color: getSessionStatusColor(session.status, colors),
                        }}
                      >
                        {session.status}
                      </span>
                    </div>

                    {/* Stats */}
                    <div style={styles.sessionStats}>
                      <span>
                        <span style={{ color: colors.textMuted }}>Started: </span>
                        {formatTimestamp(session.startedAt)}
                      </span>
                      <span>
                        <span style={{ color: colors.textMuted }}>Duration: </span>
                        {formatDuration(session.duration)}
                      </span>
                      <span>
                        <span style={{ color: colors.textMuted }}>Errors: </span>
                        <span
                          style={{
                            color: session.errors > 0 ? colors.error : colors.textSecondary,
                            fontWeight: session.errors > 0 ? 600 : 400,
                          }}
                        >
                          {session.errors}
                        </span>
                      </span>
                    </div>

                    {/* User info */}
                    {session.user && (
                      <div
                        style={{
                          marginTop: '8px',
                          fontSize: '11px',
                          color: colors.textMuted,
                        }}
                      >
                        User: {session.user.email || session.user.username || session.user.id || 'Anonymous'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {selectedSession && (
              <div
                style={{
                  flex: '0 0 50%',
                  overflow: 'auto',
                  backgroundColor: colors.bgSecondary,
                }}
              >
                <SessionDetail
                  session={selectedSession}
                  colors={colors}
                  onClose={() => setSelectedSessionId(null)}
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
 * Session detail component
 */
interface SessionDetailProps {
  session: LogSession;
  colors: ThemeColors;
  onClose: () => void;
}

function SessionDetail({ session, colors, onClose }: SessionDetailProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

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
          Session Details
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setViewMode(viewMode === 'formatted' ? 'raw' : 'formatted')}
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
        <JsonViewer data={session} colors={colors} expandLevel={2} />
      ) : (
        <>
          {/* Session ID */}
          <div style={styles.detailSection}>
            <div style={styles.detailSectionTitle}>Session ID</div>
            <div
              style={{
                padding: '12px',
                backgroundColor: colors.bgTertiary,
                borderRadius: '4px',
                fontFamily: 'Monaco, Consolas, "Courier New", monospace',
                fontSize: '12px',
              }}
            >
              {session.id}
            </div>
          </div>

          {/* Status & Timing */}
          <div style={styles.detailSection}>
            <div style={styles.detailSectionTitle}>Status & Timing</div>
            <div
              style={{
                padding: '12px',
                backgroundColor: colors.bgTertiary,
                borderRadius: '4px',
              }}
            >
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <span style={{ color: colors.textMuted }}>Status: </span>
                  <span
                    style={{
                      fontWeight: 500,
                      color: getSessionStatusColor(session.status, colors),
                    }}
                  >
                    {session.status}
                  </span>
                </div>
                <div>
                  <span style={{ color: colors.textMuted }}>Duration: </span>
                  <span style={{ fontWeight: 500 }}>{formatDuration(session.duration)}</span>
                </div>
                <div>
                  <span style={{ color: colors.textMuted }}>Started: </span>
                  <span>{formatTimestamp(session.startedAt)}</span>
                </div>
                <div>
                  <span style={{ color: colors.textMuted }}>Ended: </span>
                  <span>{session.endedAt ? formatTimestamp(session.endedAt) : 'Ongoing'}</span>
                </div>
                <div>
                  <span style={{ color: colors.textMuted }}>Errors: </span>
                  <span
                    style={{
                      fontWeight: session.errors > 0 ? 600 : 400,
                      color: session.errors > 0 ? colors.error : colors.textPrimary,
                    }}
                  >
                    {session.errors}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Environment */}
          {(session.release || session.environment) && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Environment</div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                }}
              >
                {session.environment && (
                  <div style={{ marginBottom: '8px' }}>
                    <span style={{ color: colors.textMuted }}>Environment: </span>
                    <span>{session.environment}</span>
                  </div>
                )}
                {session.release && (
                  <div>
                    <span style={{ color: colors.textMuted }}>Release: </span>
                    <span>{session.release}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* User */}
          {session.user && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>User</div>
              <JsonViewer data={session.user} colors={colors} expandLevel={2} />
            </div>
          )}

          {/* Device */}
          {session.device && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Device</div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                }}
              >
                {session.device.family && (
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ color: colors.textMuted }}>Family: </span>
                    <span>{session.device.family}</span>
                  </div>
                )}
                {session.device.model && (
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ color: colors.textMuted }}>Model: </span>
                    <span>{session.device.model}</span>
                  </div>
                )}
                {session.device.brand && (
                  <div>
                    <span style={{ color: colors.textMuted }}>Brand: </span>
                    <span>{session.device.brand}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* OS */}
          {session.os && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Operating System</div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                }}
              >
                {session.os.name && (
                  <span>
                    {session.os.name}
                    {session.os.version && ` ${session.os.version}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Browser */}
          {session.browser && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Browser</div>
              <div
                style={{
                  padding: '12px',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                }}
              >
                {session.browser.name && (
                  <span>
                    {session.browser.name}
                    {session.browser.version && ` ${session.browser.version}`}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Custom Attributes */}
          {session.attributes && Object.keys(session.attributes).length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Custom Attributes</div>
              <JsonViewer data={session.attributes} colors={colors} expandLevel={1} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
