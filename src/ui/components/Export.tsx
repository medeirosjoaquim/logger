/**
 * Export Component
 *
 * Provides functionality to export data as JSON or CSV.
 */

import React, { useCallback, useState, useMemo } from 'react';
import type { ExportFormat, ThemeColors } from '../types.js';
import { createStyles } from '../styles.js';

export interface ExportButtonProps {
  /** Data to export */
  data: unknown;

  /** Filename for the download (without extension) */
  filename: string;

  /** Export format */
  format: ExportFormat;

  /** Theme colors */
  colors: ThemeColors;

  /** Custom button text */
  buttonText?: string;

  /** Button style override */
  style?: React.CSSProperties;
}

/**
 * Convert data to CSV format
 */
function toCSV(data: unknown): string {
  if (!Array.isArray(data) || data.length === 0) {
    return '';
  }

  // Get all unique keys from all objects
  const keys = new Set<string>();
  for (const item of data) {
    if (typeof item === 'object' && item !== null) {
      Object.keys(item).forEach((key) => keys.add(key));
    }
  }

  const headers = Array.from(keys);

  // Escape CSV values
  const escapeCSV = (value: unknown): string => {
    if (value === null || value === undefined) {
      return '';
    }

    let stringValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

    // Escape quotes and wrap in quotes if needed
    if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
      stringValue = `"${stringValue.replace(/"/g, '""')}"`;
    }

    return stringValue;
  };

  // Build CSV rows
  const rows = data.map((item) => {
    if (typeof item !== 'object' || item === null) {
      return escapeCSV(item);
    }
    return headers.map((key) => escapeCSV((item as Record<string, unknown>)[key])).join(',');
  });

  return [headers.join(','), ...rows].join('\n');
}

/**
 * Trigger a file download
 */
function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

/**
 * Export button component
 */
export function ExportButton({
  data,
  filename,
  format,
  colors,
  buttonText,
  style,
}: ExportButtonProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(() => {
    setExporting(true);

    try {
      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === 'csv') {
        content = toCSV(data);
        mimeType = 'text/csv;charset=utf-8';
        extension = 'csv';
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      }

      downloadFile(content, `${filename}.${extension}`, mimeType);
    } finally {
      setExporting(false);
    }
  }, [data, filename, format]);

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      style={{
        ...styles.button,
        ...style,
        opacity: exporting ? 0.7 : 1,
        cursor: exporting ? 'wait' : 'pointer',
      }}
    >
      {buttonText || `Export ${format.toUpperCase()}`}
    </button>
  );
}

/**
 * Export dropdown with multiple format options
 */
export interface ExportDropdownProps {
  /** Data to export */
  data: unknown;

  /** Filename for the download (without extension) */
  filename: string;

  /** Theme colors */
  colors: ThemeColors;

  /** Available formats */
  formats?: ExportFormat[];
}

export function ExportDropdown({
  data,
  filename,
  colors,
  formats = ['json', 'csv'],
}: ExportDropdownProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);
  const [isOpen, setIsOpen] = useState(false);

  const handleExport = useCallback(
    (format: ExportFormat) => {
      let content: string;
      let mimeType: string;
      let extension: string;

      if (format === 'csv') {
        content = toCSV(data);
        mimeType = 'text/csv;charset=utf-8';
        extension = 'csv';
      } else {
        content = JSON.stringify(data, null, 2);
        mimeType = 'application/json';
        extension = 'json';
      }

      downloadFile(content, `${filename}.${extension}`, mimeType);
      setIsOpen(false);
    },
    [data, filename]
  );

  const copyToClipboard = useCallback(async () => {
    try {
      const jsonString = JSON.stringify(data, null, 2);
      await navigator.clipboard.writeText(jsonString);
      setIsOpen(false);
    } catch {
      // Ignore errors
    }
  }, [data]);

  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...styles.button,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
        }}
      >
        Export
        <span style={{ fontSize: '10px' }}>{isOpen ? '\u25B2' : '\u25BC'}</span>
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 999,
            }}
            onClick={() => setIsOpen(false)}
          />

          {/* Dropdown menu */}
          <div
            style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              marginTop: '4px',
              backgroundColor: colors.bgPrimary,
              border: `1px solid ${colors.border}`,
              borderRadius: '4px',
              boxShadow: `0 4px 12px ${colors.shadow}`,
              zIndex: 1000,
              minWidth: '120px',
            }}
          >
            {formats.map((format) => (
              <button
                key={format}
                onClick={() => handleExport(format)}
                style={{
                  display: 'block',
                  width: '100%',
                  padding: '8px 12px',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: colors.textPrimary,
                  fontSize: '12px',
                  textAlign: 'left',
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = colors.bgHover;
                }}
                onMouseLeave={(e) => {
                  (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
                }}
              >
                Download {format.toUpperCase()}
              </button>
            ))}

            <div
              style={{
                borderTop: `1px solid ${colors.border}`,
              }}
            />

            <button
              onClick={copyToClipboard}
              style={{
                display: 'block',
                width: '100%',
                padding: '8px 12px',
                border: 'none',
                backgroundColor: 'transparent',
                color: colors.textPrimary,
                fontSize: '12px',
                textAlign: 'left',
                cursor: 'pointer',
              }}
              onMouseEnter={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = colors.bgHover;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLButtonElement).style.backgroundColor = 'transparent';
              }}
            >
              Copy to Clipboard
            </button>
          </div>
        </>
      )}
    </div>
  );
}
