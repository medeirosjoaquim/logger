/**
 * Traces Tab Component
 *
 * Displays transaction traces with span timeline/waterfall visualization.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { TraceData, SpanData, TraceFilter } from '../../storage/types.js';
import type { UniversalLogger, ThemeColors, SpanTreeNode } from '../types.js';
import { createStyles, getStatusColor } from '../styles.js';
import { useLoggerTraces, useDebounce } from '../hooks/useLogger.js';
import { JsonViewer } from '../components/JsonViewer.js';
import { ExportDropdown } from '../components/Export.js';

export interface TracesTabProps {
  logger: UniversalLogger;
  colors: ThemeColors;
  maxHeight: string;
}

/**
 * Format duration for display
 */
function formatDuration(durationMs: number | undefined): string {
  if (durationMs === undefined || durationMs === null) {
    return '-';
  }

  if (durationMs < 1) {
    return '<1ms';
  }

  if (durationMs < 1000) {
    return `${Math.round(durationMs)}ms`;
  }

  return `${(durationMs / 1000).toFixed(2)}s`;
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
 * Calculate span duration in milliseconds
 */
function calculateSpanDuration(span: SpanData): number | undefined {
  if (!span.start_timestamp || !span.timestamp) {
    return undefined;
  }

  const start = new Date(span.start_timestamp).getTime();
  const end = new Date(span.timestamp).getTime();
  return end - start;
}

/**
 * Build span tree from flat span list
 */
function buildSpanTree(spans: SpanData[], rootSpanId?: string): SpanTreeNode[] {
  const spanMap = new Map<string, SpanData>();
  const childrenMap = new Map<string, string[]>();

  // Build maps
  for (const span of spans) {
    spanMap.set(span.span_id, span);
    const parentId = span.parent_span_id || 'root';
    if (!childrenMap.has(parentId)) {
      childrenMap.set(parentId, []);
    }
    childrenMap.get(parentId)!.push(span.span_id);
  }

  // Recursive builder
  function buildNode(spanId: string, depth: number): SpanTreeNode {
    const span = spanMap.get(spanId)!;
    const childIds = childrenMap.get(spanId) || [];
    const children = childIds.map((id) => buildNode(id, depth + 1));

    return {
      span,
      children,
      depth,
      duration: calculateSpanDuration(span),
    };
  }

  // Find root spans
  const rootSpanIds = rootSpanId
    ? [rootSpanId]
    : childrenMap.get('root') || [];

  return rootSpanIds
    .filter((id) => spanMap.has(id))
    .map((id) => buildNode(id, 0));
}

/**
 * Traces tab component
 */
export function TracesTab({ logger, colors, maxHeight }: TracesTabProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const debouncedSearch = useDebounce(searchTerm, 300);

  // Build storage filter
  const storageFilter = useMemo<TraceFilter>(() => {
    const f: TraceFilter = {
      orderBy: 'start_timestamp',
      orderDirection: 'desc',
      limit: 50,
    };

    if (debouncedSearch) {
      f.transactionName = debouncedSearch;
    }

    if (statusFilter !== 'all') {
      f.status = statusFilter as TraceFilter['status'];
    }

    return f;
  }, [debouncedSearch, statusFilter]);

  // Fetch traces
  const { traces, loading, error, refresh, clear } = useLoggerTraces(logger, storageFilter);

  // Selected trace
  const [selectedTraceId, setSelectedTraceId] = useState<string | null>(null);
  const selectedTrace = useMemo(
    () => traces.find((t) => t.trace_id === selectedTraceId) || null,
    [traces, selectedTraceId]
  );

  // View mode
  const [viewMode, setViewMode] = useState<'timeline' | 'waterfall' | 'raw'>('timeline');

  const handleSelectTrace = useCallback((traceId: string) => {
    setSelectedTraceId((prev) => (prev === traceId ? null : traceId));
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Search transactions..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          style={styles.searchInput}
        />

        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          style={styles.select}
        >
          <option value="all">All Status</option>
          <option value="ok">OK</option>
          <option value="error">Error</option>
          <option value="cancelled">Cancelled</option>
        </select>

        <button onClick={refresh} style={styles.button}>
          Refresh
        </button>

        <button onClick={clear} style={styles.button}>
          Clear
        </button>

        <ExportDropdown data={traces} filename="traces" colors={colors} />
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
            <span>Error loading traces: {error.message}</span>
          </div>
        )}

        {/* Loading state */}
        {loading && traces.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateText}>Loading traces...</span>
          </div>
        )}

        {/* Empty state */}
        {!loading && traces.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateIcon}>[~]</span>
            <span style={styles.emptyStateText}>No traces captured yet</span>
          </div>
        )}

        {/* Trace list */}
        {traces.length > 0 && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* List */}
            <ul
              style={{
                ...styles.list,
                flex: selectedTrace ? '0 0 40%' : '1',
                borderRight: selectedTrace ? `1px solid ${colors.border}` : 'none',
                overflow: 'auto',
              }}
            >
              {traces.map((trace) => (
                <li
                  key={trace.trace_id}
                  onClick={() => handleSelectTrace(trace.trace_id)}
                  style={{
                    ...styles.listItem,
                    ...(selectedTraceId === trace.trace_id ? styles.listItemSelected : {}),
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => {
                    if (selectedTraceId !== trace.trace_id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = colors.bgHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (selectedTraceId !== trace.trace_id) {
                      (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                    }
                  }}
                >
                  <div style={styles.eventItem}>
                    <div
                      style={{
                        ...styles.eventLevel,
                        backgroundColor: getStatusColor(trace.transaction.status, colors),
                      }}
                    />
                    <div style={styles.eventContent}>
                      <p style={styles.eventMessage}>{trace.transaction.name}</p>
                      <div style={styles.eventMeta}>
                        <span>{formatTimestamp(trace.start_timestamp)}</span>
                        <span>{formatDuration(trace.duration)}</span>
                        {trace.transaction.op && <span>{trace.transaction.op}</span>}
                        <span>{trace.spans.length} spans</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            {/* Detail panel */}
            {selectedTrace && (
              <div
                style={{
                  flex: '0 0 60%',
                  overflow: 'auto',
                  backgroundColor: colors.bgSecondary,
                }}
              >
                <TraceDetail
                  trace={selectedTrace}
                  colors={colors}
                  viewMode={viewMode}
                  onViewModeChange={setViewMode}
                  onClose={() => setSelectedTraceId(null)}
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
 * Trace detail component
 */
interface TraceDetailProps {
  trace: TraceData;
  colors: ThemeColors;
  viewMode: 'timeline' | 'waterfall' | 'raw';
  onViewModeChange: (mode: 'timeline' | 'waterfall' | 'raw') => void;
  onClose: () => void;
}

function TraceDetail({ trace, colors, viewMode, onViewModeChange, onClose }: TraceDetailProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [selectedSpan, setSelectedSpan] = useState<SpanData | null>(null);

  // Build span tree
  const spanTree = useMemo(() => buildSpanTree(trace.spans), [trace.spans]);

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
          {trace.transaction.name}
        </h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <select
            value={viewMode}
            onChange={(e) => onViewModeChange(e.target.value as typeof viewMode)}
            style={styles.select}
          >
            <option value="timeline">Timeline</option>
            <option value="waterfall">Waterfall</option>
            <option value="raw">Raw JSON</option>
          </select>
          <button onClick={onClose} style={styles.buttonIcon} title="Close">
            X
          </button>
        </div>
      </div>

      {/* Transaction summary */}
      <div
        style={{
          display: 'flex',
          gap: '24px',
          padding: '12px',
          backgroundColor: colors.bgTertiary,
          borderRadius: '4px',
          marginBottom: '16px',
          fontSize: '12px',
        }}
      >
        <div>
          <span style={{ color: colors.textMuted }}>Duration: </span>
          <span style={{ fontWeight: 500 }}>{formatDuration(trace.duration)}</span>
        </div>
        <div>
          <span style={{ color: colors.textMuted }}>Status: </span>
          <span
            style={{
              fontWeight: 500,
              color: getStatusColor(trace.transaction.status, colors),
            }}
          >
            {trace.transaction.status || 'ok'}
          </span>
        </div>
        <div>
          <span style={{ color: colors.textMuted }}>Spans: </span>
          <span style={{ fontWeight: 500 }}>{trace.spans.length}</span>
        </div>
        {trace.transaction.op && (
          <div>
            <span style={{ color: colors.textMuted }}>Operation: </span>
            <span style={{ fontWeight: 500 }}>{trace.transaction.op}</span>
          </div>
        )}
      </div>

      {/* Content based on view mode */}
      {viewMode === 'raw' ? (
        <JsonViewer data={trace} colors={colors} expandLevel={2} />
      ) : viewMode === 'waterfall' ? (
        <WaterfallView
          trace={trace}
          spans={trace.spans}
          colors={colors}
          onSelectSpan={setSelectedSpan}
          selectedSpan={selectedSpan}
        />
      ) : (
        <TimelineView
          spanTree={spanTree}
          colors={colors}
          onSelectSpan={setSelectedSpan}
          selectedSpan={selectedSpan}
        />
      )}

      {/* Selected span detail */}
      {selectedSpan && (
        <div
          style={{
            marginTop: '16px',
            padding: '12px',
            backgroundColor: colors.bgTertiary,
            borderRadius: '4px',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}
          >
            <h4 style={{ margin: 0, fontSize: '13px', fontWeight: 600 }}>
              Span: {selectedSpan.name || selectedSpan.description || selectedSpan.span_id}
            </h4>
            <button onClick={() => setSelectedSpan(null)} style={styles.buttonIcon}>
              X
            </button>
          </div>
          <JsonViewer data={selectedSpan} colors={colors} expandLevel={2} />
        </div>
      )}
    </div>
  );
}

/**
 * Timeline view component
 */
interface TimelineViewProps {
  spanTree: SpanTreeNode[];
  colors: ThemeColors;
  onSelectSpan: (span: SpanData) => void;
  selectedSpan: SpanData | null;
}

function TimelineView({ spanTree, colors, onSelectSpan, selectedSpan }: TimelineViewProps) {
  const renderNode = (node: SpanTreeNode, index: number): React.ReactNode => {
    const isSelected = selectedSpan?.span_id === node.span.span_id;

    return (
      <div key={node.span.span_id || index}>
        <div
          onClick={() => onSelectSpan(node.span)}
          style={{
            display: 'flex',
            alignItems: 'center',
            padding: '8px 12px',
            paddingLeft: `${12 + node.depth * 20}px`,
            cursor: 'pointer',
            backgroundColor: isSelected ? colors.bgSelected : 'transparent',
            borderBottom: `1px solid ${colors.borderLight}`,
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
          {/* Expand indicator */}
          <span style={{ width: '16px', color: colors.textMuted }}>
            {node.children.length > 0 ? '[-]' : '   '}
          </span>

          {/* Status dot */}
          <div
            style={{
              width: '8px',
              height: '8px',
              borderRadius: '50%',
              backgroundColor: getStatusColor(node.span.status, colors),
              marginRight: '8px',
            }}
          />

          {/* Span name */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: '13px',
                fontWeight: 500,
                color: colors.textPrimary,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {node.span.name || node.span.description || 'Unknown'}
            </div>
            {node.span.op && (
              <div style={{ fontSize: '11px', color: colors.textMuted }}>
                {node.span.op}
              </div>
            )}
          </div>

          {/* Duration */}
          <div style={{ fontSize: '12px', color: colors.textSecondary }}>
            {formatDuration(node.duration)}
          </div>
        </div>

        {/* Children */}
        {node.children.map((child, childIndex) => renderNode(child, childIndex))}
      </div>
    );
  };

  if (spanTree.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: colors.textMuted,
        }}
      >
        No spans in this trace
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: colors.bgPrimary,
        borderRadius: '4px',
        border: `1px solid ${colors.border}`,
      }}
    >
      {spanTree.map((node, index) => renderNode(node, index))}
    </div>
  );
}

/**
 * Waterfall view component
 */
interface WaterfallViewProps {
  trace: TraceData;
  spans: SpanData[];
  colors: ThemeColors;
  onSelectSpan: (span: SpanData) => void;
  selectedSpan: SpanData | null;
}

function WaterfallView({ trace, spans, colors, onSelectSpan, selectedSpan }: WaterfallViewProps) {
  // Calculate timeline boundaries
  const { minTime, maxTime, totalDuration } = useMemo(() => {
    let min = Infinity;
    let max = -Infinity;

    for (const span of spans) {
      const start = new Date(span.start_timestamp).getTime();
      const end = span.timestamp ? new Date(span.timestamp).getTime() : start;
      if (start < min) min = start;
      if (end > max) max = end;
    }

    // Also include transaction times
    if (trace.start_timestamp) {
      const start = new Date(trace.start_timestamp).getTime();
      if (start < min) min = start;
    }
    if (trace.timestamp) {
      const end = new Date(trace.timestamp).getTime();
      if (end > max) max = end;
    }

    return {
      minTime: min,
      maxTime: max,
      totalDuration: max - min,
    };
  }, [spans, trace]);

  // Sort spans by start time
  const sortedSpans = useMemo(
    () =>
      [...spans].sort(
        (a, b) =>
          new Date(a.start_timestamp).getTime() - new Date(b.start_timestamp).getTime()
      ),
    [spans]
  );

  if (sortedSpans.length === 0) {
    return (
      <div
        style={{
          padding: '24px',
          textAlign: 'center',
          color: colors.textMuted,
        }}
      >
        No spans in this trace
      </div>
    );
  }

  return (
    <div
      style={{
        backgroundColor: colors.bgPrimary,
        borderRadius: '4px',
        border: `1px solid ${colors.border}`,
      }}
    >
      {sortedSpans.map((span, index) => {
        const startTime = new Date(span.start_timestamp).getTime();
        const endTime = span.timestamp
          ? new Date(span.timestamp).getTime()
          : startTime;
        const duration = endTime - startTime;

        const leftPercent = ((startTime - minTime) / totalDuration) * 100;
        const widthPercent = Math.max((duration / totalDuration) * 100, 0.5);

        const isSelected = selectedSpan?.span_id === span.span_id;

        return (
          <div
            key={span.span_id || index}
            onClick={() => onSelectSpan(span)}
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '8px 12px',
              cursor: 'pointer',
              backgroundColor: isSelected ? colors.bgSelected : 'transparent',
              borderBottom: `1px solid ${colors.borderLight}`,
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
            {/* Span name */}
            <div
              style={{
                width: '150px',
                flexShrink: 0,
                fontSize: '12px',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                paddingRight: '12px',
              }}
            >
              {span.name || span.description || span.span_id.slice(0, 8)}
            </div>

            {/* Waterfall bar */}
            <div
              style={{
                flex: 1,
                height: '24px',
                position: 'relative',
                backgroundColor: colors.bgTertiary,
                borderRadius: '2px',
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  left: `${leftPercent}%`,
                  width: `${widthPercent}%`,
                  height: '100%',
                  backgroundColor: getStatusColor(span.status, colors),
                  borderRadius: '2px',
                  minWidth: '4px',
                }}
              />
            </div>

            {/* Duration */}
            <div
              style={{
                width: '80px',
                flexShrink: 0,
                textAlign: 'right',
                fontSize: '12px',
                color: colors.textSecondary,
              }}
            >
              {formatDuration(duration)}
            </div>
          </div>
        );
      })}
    </div>
  );
}
