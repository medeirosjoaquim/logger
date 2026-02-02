/**
 * Debug Panel UI Types
 *
 * Type definitions for the React-based debug panel components.
 */

import type { StorageProvider } from '../storage/types.js';

/**
 * Universal Logger interface for UI components
 * This represents the minimal interface needed by the debug panel
 */
export interface UniversalLogger {
  /** Storage provider for accessing logs, events, traces, etc. */
  storage: StorageProvider;

  /** Subscribe to storage updates */
  subscribe?(callback: () => void): () => void;

  /** Get current scope data */
  getScope?(): {
    getBreadcrumbs(): import('../storage/types.js').Breadcrumb[];
    getUser(): import('../storage/types.js').User | undefined;
    getTags(): Record<string, string>;
    getExtras(): Record<string, unknown>;
  };
}

/**
 * Position options for the debug panel
 */
export type PanelPosition = 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left';

/**
 * Theme options for the debug panel
 */
export type PanelTheme = 'light' | 'dark' | 'auto';

/**
 * Props for the main DebugPanel component
 */
export interface DebugPanelProps {
  /** The logger instance to display data from */
  logger: UniversalLogger;

  /** Position of the floating panel */
  position?: PanelPosition;

  /** Whether the panel is open by default */
  defaultOpen?: boolean;

  /** Maximum height of the panel */
  maxHeight?: string;

  /** Color theme */
  theme?: PanelTheme;

  /** Custom z-index for the panel */
  zIndex?: number;
}

/**
 * Tab configuration
 */
export interface TabConfig {
  /** Unique tab identifier */
  id: ActiveTab;

  /** Display label for the tab */
  label: string;

  /** Optional icon (React node) */
  icon?: React.ReactNode;

  /** Badge count (for notifications) */
  badge?: number;
}

/**
 * Available tabs in the debug panel
 */
export type ActiveTab = 'events' | 'traces' | 'breadcrumbs' | 'logs' | 'sessions';

/**
 * Filter state for events tab
 */
export interface EventsFilterState {
  level?: import('../storage/types.js').SeverityLevel | 'all';
  search?: string;
  hasException?: boolean;
  startTime?: string;
  endTime?: string;
}

/**
 * Filter state for traces tab
 */
export interface TracesFilterState {
  status?: string | 'all';
  minDuration?: number;
  search?: string;
}

/**
 * Filter state for breadcrumbs tab
 */
export interface BreadcrumbsFilterState {
  type?: string | 'all';
  category?: string | 'all';
  search?: string;
}

/**
 * Filter state for logs tab
 */
export interface LogsFilterState {
  level?: import('../storage/types.js').SeverityLevel | 'all';
  search?: string;
}

/**
 * Export format options
 */
export type ExportFormat = 'json' | 'csv';

/**
 * Theme colors interface
 */
export interface ThemeColors {
  // Backgrounds
  bgPrimary: string;
  bgSecondary: string;
  bgTertiary: string;
  bgHover: string;
  bgSelected: string;

  // Text
  textPrimary: string;
  textSecondary: string;
  textMuted: string;

  // Borders
  border: string;
  borderLight: string;

  // Severity colors
  fatal: string;
  error: string;
  warning: string;
  info: string;
  debug: string;
  log: string;

  // Status colors
  success: string;
  pending: string;

  // Accent
  accent: string;
  accentHover: string;

  // Shadows
  shadow: string;
}

/**
 * Span tree node for trace visualization
 */
export interface SpanTreeNode {
  span: import('../storage/types.js').SpanData;
  children: SpanTreeNode[];
  depth: number;
  duration?: number;
}
