/**
 * Breadcrumbs Tab Component
 *
 * Displays breadcrumb trail with filtering by type and category.
 */

import React, { useState, useMemo, useCallback } from 'react';
import type { Breadcrumb } from '../../storage/types.js';
import type { UniversalLogger, ThemeColors, BreadcrumbsFilterState } from '../types.js';
import { createStyles, getSeverityColor } from '../styles.js';
import { useLoggerBreadcrumbs, useDebounce } from '../hooks/useLogger.js';
import { JsonViewer } from '../components/JsonViewer.js';
import { ExportDropdown } from '../components/Export.js';

export interface BreadcrumbsTabProps {
  logger: UniversalLogger;
  colors: ThemeColors;
  maxHeight: string;
}

/**
 * Get icon for breadcrumb type
 */
function getBreadcrumbIcon(type: string | undefined): string {
  switch (type) {
    case 'http':
      return '{ }';
    case 'navigation':
      return '->';
    case 'ui':
      return '[#]';
    case 'user':
      return '[U]';
    case 'error':
      return '[!]';
    case 'debug':
      return '[D]';
    case 'query':
      return 'DB';
    case 'info':
      return '[i]';
    case 'transaction':
      return '[T]';
    default:
      return '[*]';
  }
}

/**
 * Format timestamp for display
 */
function formatTimestamp(timestamp: number | string | undefined): string {
  if (!timestamp) return '';

  try {
    // Timestamp might be in seconds or milliseconds
    const ms = typeof timestamp === 'number'
      ? (timestamp < 1e12 ? timestamp * 1000 : timestamp)
      : new Date(timestamp).getTime();

    return new Date(ms).toLocaleTimeString(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3,
    });
  } catch {
    return String(timestamp);
  }
}

/**
 * Breadcrumbs tab component
 */
export function BreadcrumbsTab({ logger, colors, maxHeight }: BreadcrumbsTabProps) {
  const styles = useMemo(() => createStyles(colors), [colors]);

  // Get breadcrumbs from scope
  const { breadcrumbs, refresh } = useLoggerBreadcrumbs(logger);

  // Filter state
  const [filter, setFilter] = useState<BreadcrumbsFilterState>({
    type: 'all',
    category: 'all',
    search: '',
  });
  const debouncedSearch = useDebounce(filter.search || '', 300);

  // Get unique types and categories
  const { types, categories } = useMemo(() => {
    const typeSet = new Set<string>();
    const categorySet = new Set<string>();

    for (const bc of breadcrumbs) {
      if (bc.type) typeSet.add(bc.type);
      if (bc.category) categorySet.add(bc.category);
    }

    return {
      types: Array.from(typeSet).sort(),
      categories: Array.from(categorySet).sort(),
    };
  }, [breadcrumbs]);

  // Filter breadcrumbs
  const filteredBreadcrumbs = useMemo(() => {
    return breadcrumbs.filter((bc) => {
      // Type filter
      if (filter.type && filter.type !== 'all' && bc.type !== filter.type) {
        return false;
      }

      // Category filter
      if (filter.category && filter.category !== 'all' && bc.category !== filter.category) {
        return false;
      }

      // Search filter
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        const message = (bc.message || '').toLowerCase();
        const category = (bc.category || '').toLowerCase();
        const type = (bc.type || '').toLowerCase();

        if (
          !message.includes(searchLower) &&
          !category.includes(searchLower) &&
          !type.includes(searchLower)
        ) {
          return false;
        }
      }

      return true;
    });
  }, [breadcrumbs, filter.type, filter.category, debouncedSearch]);

  // Selected breadcrumb
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const selectedBreadcrumb = useMemo(
    () => (selectedIndex !== null ? filteredBreadcrumbs[selectedIndex] : null),
    [filteredBreadcrumbs, selectedIndex]
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <input
          type="text"
          placeholder="Search breadcrumbs..."
          value={filter.search}
          onChange={(e) => setFilter({ ...filter, search: e.target.value })}
          style={styles.searchInput}
        />

        <select
          value={filter.type || 'all'}
          onChange={(e) => setFilter({ ...filter, type: e.target.value })}
          style={styles.select}
        >
          <option value="all">All Types</option>
          {types.map((type) => (
            <option key={type} value={type}>
              {type}
            </option>
          ))}
        </select>

        <select
          value={filter.category || 'all'}
          onChange={(e) => setFilter({ ...filter, category: e.target.value })}
          style={styles.select}
        >
          <option value="all">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>

        <button onClick={refresh} style={styles.button}>
          Refresh
        </button>

        <ExportDropdown data={filteredBreadcrumbs} filename="breadcrumbs" colors={colors} />
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: 'auto',
          maxHeight,
        }}
      >
        {/* Empty state */}
        {filteredBreadcrumbs.length === 0 && (
          <div style={styles.emptyState}>
            <span style={styles.emptyStateIcon}>[...]</span>
            <span style={styles.emptyStateText}>
              {breadcrumbs.length === 0
                ? 'No breadcrumbs recorded yet'
                : 'No breadcrumbs match the current filter'}
            </span>
          </div>
        )}

        {/* Breadcrumb list */}
        {filteredBreadcrumbs.length > 0 && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* List */}
            <div
              style={{
                flex: selectedBreadcrumb ? '0 0 60%' : '1',
                borderRight: selectedBreadcrumb ? `1px solid ${colors.border}` : 'none',
                overflow: 'auto',
              }}
            >
              {filteredBreadcrumbs.map((bc, index) => {
                const isSelected = selectedIndex === index;

                return (
                  <div
                    key={index}
                    onClick={() => setSelectedIndex(isSelected ? null : index)}
                    style={{
                      ...styles.breadcrumbItem,
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
                    {/* Icon */}
                    <div
                      style={{
                        ...styles.breadcrumbIcon,
                        backgroundColor: getSeverityColor(bc.level, colors) + '20',
                        color: getSeverityColor(bc.level, colors),
                      }}
                    >
                      {getBreadcrumbIcon(bc.type)}
                    </div>

                    {/* Content */}
                    <div style={styles.breadcrumbContent}>
                      <div style={styles.breadcrumbCategory}>
                        {bc.category || bc.type || 'default'}
                        {bc.level && (
                          <span
                            style={{
                              marginLeft: '8px',
                              color: getSeverityColor(bc.level, colors),
                            }}
                          >
                            [{bc.level}]
                          </span>
                        )}
                      </div>
                      <div style={styles.breadcrumbMessage}>
                        {bc.message || (bc.data ? JSON.stringify(bc.data).slice(0, 100) : '-')}
                      </div>
                    </div>

                    {/* Timestamp */}
                    <div
                      style={{
                        fontSize: '11px',
                        color: colors.textMuted,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {formatTimestamp(bc.timestamp)}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {selectedBreadcrumb && (
              <div
                style={{
                  flex: '0 0 40%',
                  overflow: 'auto',
                  padding: '16px',
                  backgroundColor: colors.bgSecondary,
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginBottom: '16px',
                  }}
                >
                  <h4
                    style={{
                      margin: 0,
                      fontSize: '13px',
                      fontWeight: 600,
                      color: colors.textPrimary,
                    }}
                  >
                    Breadcrumb Details
                  </h4>
                  <button
                    onClick={() => setSelectedIndex(null)}
                    style={styles.buttonIcon}
                  >
                    X
                  </button>
                </div>

                {/* Basic info */}
                <div style={styles.detailSection}>
                  <div style={styles.detailSectionTitle}>Info</div>
                  <div
                    style={{
                      padding: '12px',
                      backgroundColor: colors.bgTertiary,
                      borderRadius: '4px',
                    }}
                  >
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: colors.textMuted }}>Type: </span>
                      <span>{selectedBreadcrumb.type || 'default'}</span>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: colors.textMuted }}>Category: </span>
                      <span>{selectedBreadcrumb.category || '-'}</span>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <span style={{ color: colors.textMuted }}>Level: </span>
                      <span
                        style={{
                          color: getSeverityColor(selectedBreadcrumb.level, colors),
                        }}
                      >
                        {selectedBreadcrumb.level || 'info'}
                      </span>
                    </div>
                    <div>
                      <span style={{ color: colors.textMuted }}>Timestamp: </span>
                      <span>{formatTimestamp(selectedBreadcrumb.timestamp)}</span>
                    </div>
                  </div>
                </div>

                {/* Message */}
                {selectedBreadcrumb.message && (
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
                      {selectedBreadcrumb.message}
                    </div>
                  </div>
                )}

                {/* Data */}
                {selectedBreadcrumb.data && Object.keys(selectedBreadcrumb.data).length > 0 && (
                  <div style={styles.detailSection}>
                    <div style={styles.detailSectionTitle}>Data</div>
                    <JsonViewer
                      data={selectedBreadcrumb.data}
                      colors={colors}
                      expandLevel={2}
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
