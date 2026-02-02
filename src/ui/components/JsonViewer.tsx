/**
 * JSON Viewer Component
 *
 * Collapsible JSON tree with syntax highlighting and copy functionality.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { ThemeColors } from '../types.js';
import { createStyles } from '../styles.js';

export interface JsonViewerProps {
  /** Data to display */
  data: unknown;

  /** Number of levels to expand by default */
  expandLevel?: number;

  /** Theme colors */
  colors: ThemeColors;

  /** Whether to show line numbers */
  showLineNumbers?: boolean;

  /** Maximum string length before truncation */
  maxStringLength?: number;
}

interface JsonNodeProps {
  keyName?: string;
  value: unknown;
  depth: number;
  expandLevel: number;
  colors: ThemeColors;
  styles: ReturnType<typeof createStyles>;
  isLast: boolean;
}

/**
 * Render a single JSON node
 */
function JsonNode({
  keyName,
  value,
  depth,
  expandLevel,
  colors,
  styles,
  isLast,
}: JsonNodeProps) {
  const [expanded, setExpanded] = useState(depth < expandLevel);

  const indent = depth * 16;
  const isExpandable = value !== null && (typeof value === 'object' || Array.isArray(value));
  const isEmpty = isExpandable && (Array.isArray(value) ? value.length === 0 : Object.keys(value as object).length === 0);

  const toggleExpand = useCallback(() => {
    if (isExpandable && !isEmpty) {
      setExpanded((prev) => !prev);
    }
  }, [isExpandable, isEmpty]);

  // Render primitive values
  if (!isExpandable) {
    return (
      <div style={{ paddingLeft: `${indent}px`, display: 'flex' }}>
        {keyName !== undefined && (
          <>
            <span style={styles.jsonKey}>"{keyName}"</span>
            <span style={{ color: colors.textSecondary }}>: </span>
          </>
        )}
        {renderPrimitiveValue(value, colors, styles)}
        {!isLast && <span style={{ color: colors.textSecondary }}>,</span>}
      </div>
    );
  }

  const isArray = Array.isArray(value);
  const entries = isArray
    ? (value as unknown[]).map((v, i) => [i.toString(), v] as [string, unknown])
    : Object.entries(value as object);

  // Render empty array/object
  if (isEmpty) {
    return (
      <div style={{ paddingLeft: `${indent}px`, display: 'flex' }}>
        {keyName !== undefined && (
          <>
            <span style={styles.jsonKey}>"{keyName}"</span>
            <span style={{ color: colors.textSecondary }}>: </span>
          </>
        )}
        <span style={{ color: colors.textSecondary }}>
          {isArray ? '[]' : '{}'}
        </span>
        {!isLast && <span style={{ color: colors.textSecondary }}>,</span>}
      </div>
    );
  }

  // Render expandable array/object
  return (
    <div>
      <div
        style={{
          paddingLeft: `${indent}px`,
          display: 'flex',
          cursor: 'pointer',
        }}
        onClick={toggleExpand}
      >
        <span
          style={{
            width: '16px',
            color: colors.textMuted,
            userSelect: 'none',
          }}
        >
          {expanded ? '[-]' : '[+]'}
        </span>
        {keyName !== undefined && (
          <>
            <span style={styles.jsonKey}>"{keyName}"</span>
            <span style={{ color: colors.textSecondary }}>: </span>
          </>
        )}
        <span style={{ color: colors.textSecondary }}>
          {isArray ? '[' : '{'}
        </span>
        {!expanded && (
          <>
            <span style={{ color: colors.textMuted }}>
              {isArray ? ` ${entries.length} items ` : ` ${entries.length} keys `}
            </span>
            <span style={{ color: colors.textSecondary }}>
              {isArray ? ']' : '}'}
            </span>
            {!isLast && <span style={{ color: colors.textSecondary }}>,</span>}
          </>
        )}
      </div>

      {expanded && (
        <>
          {entries.map(([key, val], index) => (
            <JsonNode
              key={key}
              keyName={isArray ? undefined : key}
              value={val}
              depth={depth + 1}
              expandLevel={expandLevel}
              colors={colors}
              styles={styles}
              isLast={index === entries.length - 1}
            />
          ))}
          <div style={{ paddingLeft: `${indent}px` }}>
            <span style={{ color: colors.textSecondary }}>
              {isArray ? ']' : '}'}
            </span>
            {!isLast && <span style={{ color: colors.textSecondary }}>,</span>}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Render a primitive value with appropriate styling
 */
function renderPrimitiveValue(
  value: unknown,
  colors: ThemeColors,
  styles: ReturnType<typeof createStyles>
): React.ReactNode {
  if (value === null) {
    return <span style={styles.jsonNull}>null</span>;
  }

  if (value === undefined) {
    return <span style={styles.jsonNull}>undefined</span>;
  }

  if (typeof value === 'boolean') {
    return <span style={styles.jsonBoolean}>{value.toString()}</span>;
  }

  if (typeof value === 'number') {
    return <span style={styles.jsonNumber}>{value.toString()}</span>;
  }

  if (typeof value === 'string') {
    // Truncate long strings
    const maxLen = 500;
    const displayValue = value.length > maxLen ? value.slice(0, maxLen) + '...' : value;
    return <span style={styles.jsonString}>"{escapeString(displayValue)}"</span>;
  }

  // Fallback for other types
  return <span style={{ color: colors.textSecondary }}>{String(value)}</span>;
}

/**
 * Escape special characters in strings
 */
function escapeString(str: string): string {
  return str
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t');
}

/**
 * JSON viewer component
 */
export function JsonViewer({
  data,
  expandLevel = 1,
  colors,
  showLineNumbers = false,
  maxStringLength = 500,
}: JsonViewerProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  const copyToClipboard = useCallback(async () => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = JSON.stringify(data, null, 2);
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [data]);

  return (
    <div style={{ position: 'relative' }}>
      {/* Copy button */}
      <button
        onClick={copyToClipboard}
        style={{
          ...styles.copyButton,
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 1,
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>

      {/* JSON content */}
      <div
        style={{
          ...styles.jsonViewer,
          paddingTop: '32px',
        }}
      >
        <JsonNode
          value={data}
          depth={0}
          expandLevel={expandLevel}
          colors={colors}
          styles={styles}
          isLast={true}
        />
      </div>
    </div>
  );
}

/**
 * Raw JSON display (non-interactive)
 */
export function RawJson({
  data,
  colors,
}: {
  data: unknown;
  colors: ThemeColors;
}) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [copied, setCopied] = useState(false);

  const jsonString = useMemo(() => {
    try {
      return JSON.stringify(data, null, 2);
    } catch {
      return String(data);
    }
  }, [data]);

  const copyToClipboard = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(jsonString);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore errors
    }
  }, [jsonString]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={copyToClipboard}
        style={{
          ...styles.copyButton,
          position: 'absolute',
          top: '8px',
          right: '8px',
          zIndex: 1,
        }}
      >
        {copied ? 'Copied!' : 'Copy'}
      </button>

      <pre
        style={{
          ...styles.jsonViewer,
          paddingTop: '32px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-all',
        }}
      >
        {jsonString}
      </pre>
    </div>
  );
}
