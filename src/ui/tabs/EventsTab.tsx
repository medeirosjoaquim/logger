/**
 * Events Tab Component
 *
 * Displays Sentry events with filtering, selection, and detail view.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { SentryEvent, SentryEventFilter, SeverityLevel } from '../../storage/types.js';
import type { UniversalLogger, ThemeColors, EventsFilterState } from '../types.js';
import { createStyles, getSeverityColor } from '../styles.js';
import { useLoggerEvents, useDebounce } from '../hooks/useLogger.js';
import { StackTrace } from '../components/StackTrace.js';
import { JsonViewer } from '../components/JsonViewer.js';
import { ExportDropdown } from '../components/Export.js';

export interface EventsTabProps {
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
    });
  } catch {
    return timestamp;
  }
}

/**
 * Get message from event
 */
function getEventMessage(event: SentryEvent): string {
  if (event.exception?.values?.[0]) {
    const exc = event.exception.values[0];
    return `${exc.type || 'Error'}: ${exc.value || 'Unknown error'}`;
  }

  if (typeof event.message === 'string') {
    return event.message;
  }

  if (event.message?.formatted) {
    return event.message.formatted;
  }

  if (event.message?.message) {
    return event.message.message;
  }

  return 'No message';
}

/**
 * Events tab component
 */
export function EventsTab({ logger, colors, maxHeight }: EventsTabProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Filter state
  const [filter, setFilter] = useState<EventsFilterState>({
    level: 'all',
    search: '',
  });
  const debouncedSearch = useDebounce(filter.search || '', 300);

  // Build storage filter from UI filter
  const storageFilter = useMemo<SentryEventFilter>(() => {
    const f: SentryEventFilter = {
      orderBy: 'timestamp',
      orderDirection: 'desc',
      limit: 100,
    };

    if (filter.level && filter.level !== 'all') {
      f.level = filter.level as SeverityLevel;
    }

    if (debouncedSearch) {
      f.search = debouncedSearch;
    }

    if (filter.hasException) {
      f.hasException = true;
    }

    return f;
  }, [filter.level, debouncedSearch, filter.hasException]);

  // Fetch events
  const { events, loading, error, refresh, clear } = useLoggerEvents(logger, storageFilter);

  // Selected event
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const selectedEvent = useMemo(
    () => events.find((e) => e.event_id === selectedEventId) || null,
    [events, selectedEventId]
  );

  // View mode for detail
  const [viewMode, setViewMode] = useState<'formatted' | 'raw'>('formatted');

  const handleSelectEvent = useCallback((eventId: string) => {
    setSelectedEventId((prev) => (prev === eventId ? null : eventId));
  }, []);

  const errorCount = useMemo(
    () => events.filter((e) => e.level === 'error' || e.level === 'fatal').length,
    [events]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Search events..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          style={styles.searchInput}
        />

        <select
          value={filter.level || 'all'}
          onChange={(e) => setFilter({ ...filter, level: e.target.value as EventsFilterState['level'] })}
          style={styles.select}
        >
          <option value="all">All Levels</option>
          <option value="fatal">Fatal</option>
          <option value="error">Error</option>
          <option value="warning">Warning</option>
          <option value="info">Info</option>
          <option value="debug">Debug</option>
        </select>

        <label
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            color: colors.textSecondary,
            cursor: 'pointer',
          }}
        >
          <input
            type="checkbox"
            checked={filter.hasException || false}
            onChange={(e) => setFilter({ ...filter, hasException: e.target.checked })}
          />
          Exceptions
        </label>

        <button onClick={refresh} style={styles.button} title="Refresh">
          Refresh
        </button>

        <button onClick={clear} style={styles.button} title="Clear all events">
          Clear
        </button>

        <ExportDropdown data={events} filename="sentry-events" colors={colors} />
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
            <span>Error loading events: {error.message}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && events.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateText}>Loading events...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && events.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateIcon}>[!]</span>
            <span style={styles.emptyStateText}>No events captured yet</span>
          </div>
        )}

        {/* Event list */}
        {events.length > 0 && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* List */}
            <ul
              style={{
                ...styles.list,
                flex: selectedEvent ? '0 0 50%' : '1',
                borderRight: selectedEvent ? `1px solid ${colors.border}` : 'none',
                overflow: 'auto',
              }}
            >
              {events.map((event) => (
                <li
                  key={event.event_id}
                  onClick={() => handleSelectEvent(event.event_id)}
                  style={{
                    ...styles.listItem,
                    ...(selectedEventId === event.event_id ? styles.listItemSelected : {}),
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedEventId !== event.event_id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedEventId !== event.event_id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={styles.eventItem}>
                    <div
                      style={{
                        ...styles.eventLevel,
                        backgroundColor: getSeverityColor(event.level, colors),
                      }}
                    />
                    <div style={styles.eventContent}>
                      <p style={styles.eventMessage}>{getEventMessage(event)}</p>
                      <div style={styles.eventMeta}>
                        <span>{formatTimestamp(event.timestamp)}</span>
                        {event.level && <span style={{ textTransform: 'uppercase' }}>{event.level}</span>}
                        {event.environment && <span>{event.environment}</span>}
                        {event.transaction && <span>{event.transaction}</span>}
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Detail panel */}
            {selectedEvent && (
              <div
                style={{
                  flex: '0 0 50%',
                  overflow: 'auto',
                  backgroundColor: colors.bgSecondary,
                }}
              >
                <EventDetail
                  event={selectedEvent}
                  colors={colors}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onClose={() => setSelectedEventId(null)}
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
 * Event detail component
 */
interface EventDetailProps {
  event: SentryEvent;
  colors: ThemeColors;
  viewMode: 'formatted' | 'raw';
  onViewModeChange: (mode: 'formatted' | 'raw') => void;
  onClose: () => void;
}

function EventDetail({ event, colors, viewMode, onViewModeChange, onClose }: EventDetailProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  const exception = event.exception?.values?.[0];
  const stackFrames = exception?.stacktrace?.frames || [];

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
          Event Details
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
        <JsonViewer data={event} colors={colors} expandLevel={2} />
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
                fontWeight: 500,
              }}
            >
              {getEventMessage(event)}
            </div>
          </div>

          {/* Exception details */}
          {exception && (
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
                  {exception.type || 'Error'}
                </div>
                <div style={{ color: colors.textSecondary, marginTop: '4px' }}>
                  {exception.value}
                </div>
                {exception.mechanism && (
                  <div style={{ marginTop: '8px', fontSize: '12px' }}>
                    <span style={{ color: colors.textMuted }}>Mechanism: </span>
                    <span>{exception.mechanism.type}</span>
                    {exception.mechanism.handled !== undefined && (
                      <span style={{ marginLeft: '8px' }}>
                        ({exception.mechanism.handled ? 'Handled' : 'Unhandled'})
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Stack trace */}
          {stackFrames.length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Stack Trace</div>
              <StackTrace frames={stackFrames} colors={colors} />
            </div>
          )}

          {/* Tags */}
          {event.tags && Object.keys(event.tags).length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Tags</div>
              <div>
                {Object.entries(event.tags).map(([key, value]) => (
                  <span key={key} style={styles.tag}>
                    {key}: {value}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* User */}
          {event.user && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>User</div>
              <JsonViewer data={event.user} colors={colors} expandLevel={2} />
            </div>
          )}

          {/* Contexts */}
          {event.contexts && Object.keys(event.contexts).length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Contexts</div>
              <JsonViewer data={event.contexts} colors={colors} expandLevel={1} />
            </div>
          )}

          {/* Extra */}
          {event.extra && Object.keys(event.extra).length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Extra Data</div>
              <JsonViewer data={event.extra} colors={colors} expandLevel={1} />
            </div>
          )}

          {/* Breadcrumbs */}
          {event.breadcrumbs && event.breadcrumbs.length > 0 && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>
                Breadcrumbs ({event.breadcrumbs.length})
              </div>
              <div
                style={{
                  maxHeight: '200px',
                  overflow: 'auto',
                  backgroundColor: colors.bgTertiary,
                  borderRadius: '4px',
                }}
              >
                {event.breadcrumbs.slice(-10).map((bc, index) => (
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
                      <span style={{ color: colors.textMuted }}>
                        {bc.timestamp
                          ? new Date(typeof bc.timestamp === 'number' ? bc.timestamp * 1000 : bc.timestamp).toLocaleTimeString()
                          : ''}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Request */}
          {event.request && (
            <div style={styles.detailSection}>
              <div style={styles.detailSectionTitle}>Request</div>
              <JsonViewer data={event.request} colors={colors} expandLevel={1} />
            </div>
          )}
        </>
      )}
    </div>
  );
}
