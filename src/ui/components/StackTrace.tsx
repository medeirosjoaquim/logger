/**
 * Stack Trace Component
 *
 * Displays expandable stack frames with highlighting for in-app code.
 */

import React, { useState, useMemo } from 'react';
import type { StackFrame } from '../../storage/types.js';
import type { ThemeColors } from '../types.js';
import { createStyles } from '../styles.js';

export interface StackTraceProps {
  /** Stack frames to display */
  frames: StackFrame[];

  /** Theme colors */
  colors: ThemeColors;

  /** Maximum frames to show initially */
  maxFrames?: number;

  /** Whether to show collapsed frames by default */
  defaultExpanded?: boolean;
}

/**
 * Stack trace visualization component
 */
export function StackTrace({
  frames,
  colors,
  maxFrames = 5,
  defaultExpanded = false,
}: StackTraceProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const [expandedFrames, setExpandedFrames] = useState<Set<number>>(new Set());
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Reverse frames to show most recent first (if not already)
  const displayFrames = useMemo(() => {
    // Sentry sends frames oldest-to-newest, we want newest first
    return [...frames].reverse();
  }, [frames]);

  const visibleFrames = expanded
    ? displayFrames
    : displayFrames.slice(0, maxFrames);

  const hiddenCount = displayFrames.length - maxFrames;

  const toggleFrame = (index: number) => {
    setExpandedFrames((prev) => {
      const next = new Set(prev);
      if (next.has(index)) {
        next.delete(index);
      } else {
        next.add(index);
      }
      return next;
    });
  };

  if (frames.length === 0) {
    return (
      <div style={{ ...styles.emptyState, padding: '24px' }}>
        <span style={styles.emptyStateText}>No stack trace available</span>
      </div>
    );
  }

  return (
    <div style={styles.stackTrace}>
      {visibleFrames.map((frame, index) => {
        const isExpanded = expandedFrames.has(index);
        const hasContext = frame.context_line || frame.pre_context?.length || frame.post_context?.length;

        return (
          <div
            key={index}
            style={{
              ...styles.stackFrame,
              ...(frame.in_app !== false ? styles.stackFrameInApp : {}),
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                cursor: hasContext ? 'pointer' : 'default',
              }}
              onClick={() => hasContext && toggleFrame(index)}
            >
              {/* Expand/Collapse indicator */}
              {hasContext && (
                <span
                  style={{
                    marginRight: '8px',
                    color: colors.textMuted,
                    fontSize: '10px',
                    width: '12px',
                  }}
                >
                  {isExpanded ? '[-]' : '[+]'}
                </span>
              )}

              <div style={{ flex: 1, minWidth: 0 }}>
                {/* Function name */}
                <div style={styles.stackFrameFunction}>
                  {frame.function || '<anonymous>'}
                  {frame.in_app !== false && (
                    <span
                      style={{
                        marginLeft: '8px',
                        padding: '1px 6px',
                        borderRadius: '3px',
                        backgroundColor: colors.accent,
                        color: '#ffffff',
                        fontSize: '9px',
                        fontWeight: 600,
                        textTransform: 'uppercase',
                      }}
                    >
                      IN APP
                    </span>
                  )}
                </div>

                {/* File location */}
                <div style={styles.stackFrameFile}>
                  {frame.filename || frame.abs_path || 'unknown'}
                  {frame.lineno !== undefined && (
                    <span>
                      :{frame.lineno}
                      {frame.colno !== undefined && `:${frame.colno}`}
                    </span>
                  )}
                  {frame.module && (
                    <span style={{ marginLeft: '8px', color: colors.textMuted }}>
                      in {frame.module}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Context lines (expanded) */}
            {isExpanded && hasContext && (
              <div
                style={{
                  marginTop: '8px',
                  padding: '8px',
                  backgroundColor: colors.bgPrimary,
                  borderRadius: '4px',
                  fontSize: '11px',
                  overflowX: 'auto',
                }}
              >
                {/* Pre-context */}
                {frame.pre_context?.map((line, i) => (
                  <div
                    key={`pre-${i}`}
                    style={{
                      display: 'flex',
                      color: colors.textMuted,
                    }}
                  >
                    <span
                      style={{
                        width: '40px',
                        textAlign: 'right',
                        marginRight: '12px',
                        userSelect: 'none',
                      }}
                    >
                      {(frame.lineno || 0) - (frame.pre_context?.length || 0) + i}
                    </span>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{line}</pre>
                  </div>
                ))}

                {/* Context line (highlighted) */}
                {frame.context_line && (
                  <div
                    style={{
                      display: 'flex',
                      backgroundColor: colors.bgSelected,
                      margin: '0 -8px',
                      padding: '2px 8px',
                    }}
                  >
                    <span
                      style={{
                        width: '40px',
                        textAlign: 'right',
                        marginRight: '12px',
                        userSelect: 'none',
                        color: colors.accent,
                        fontWeight: 600,
                      }}
                    >
                      {frame.lineno}
                    </span>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap', color: colors.textPrimary }}>
                      {frame.context_line}
                    </pre>
                  </div>
                )}

                {/* Post-context */}
                {frame.post_context?.map((line, i) => (
                  <div
                    key={`post-${i}`}
                    style={{
                      display: 'flex',
                      color: colors.textMuted,
                    }}
                  >
                    <span
                      style={{
                        width: '40px',
                        textAlign: 'right',
                        marginRight: '12px',
                        userSelect: 'none',
                      }}
                    >
                      {(frame.lineno || 0) + 1 + i}
                    </span>
                    <pre style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{line}</pre>
                  </div>
                ))}

                {/* Local variables */}
                {frame.vars && Object.keys(frame.vars).length > 0 && (
                  <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: `1px solid ${colors.border}` }}>
                    <div style={{ fontSize: '10px', color: colors.textMuted, marginBottom: '4px' }}>
                      Local Variables:
                    </div>
                    {Object.entries(frame.vars).map(([key, value]) => (
                      <div key={key} style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ color: colors.accent }}>{key}:</span>
                        <span style={{ color: colors.textSecondary }}>
                          {typeof value === 'string' ? value : JSON.stringify(value)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* Show more button */}
      {!expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(true)}
          style={{
            width: '100%',
            padding: '8px',
            border: 'none',
            backgroundColor: colors.bgTertiary,
            color: colors.accent,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Show {hiddenCount} more frame{hiddenCount !== 1 ? 's' : ''}
        </button>
      )}

      {expanded && hiddenCount > 0 && (
        <button
          onClick={() => setExpanded(false)}
          style={{
            width: '100%',
            padding: '8px',
            border: 'none',
            backgroundColor: colors.bgTertiary,
            color: colors.accent,
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Show fewer frames
        </button>
      )}
    </div>
  );
}
