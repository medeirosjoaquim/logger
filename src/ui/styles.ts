/**
 * CSS-in-JS Styles for Debug Panel
 *
 * All styles are defined here to avoid external CSS dependencies.
 * Supports both light and dark themes.
 */

import type { ThemeColors } from './types.js';

/**
 * Light theme colors
 */
export const lightTheme: ThemeColors = {
  // Backgrounds
  bgPrimary: '#ffffff',
  bgSecondary: '#f8f9fa',
  bgTertiary: '#e9ecef',
  bgHover: '#f1f3f5',
  bgSelected: '#e7f5ff',

  // Text
  textPrimary: '#212529',
  textSecondary: '#495057',
  textMuted: '#868e96',

  // Borders
  border: '#dee2e6',
  borderLight: '#e9ecef',

  // Severity colors
  fatal: '#c92a2a',
  error: '#e03131',
  warning: '#f59f00',
  info: '#1c7ed6',
  debug: '#868e96',
  log: '#495057',

  // Status colors
  success: '#2f9e44',
  pending: '#f59f00',

  // Accent
  accent: '#228be6',
  accentHover: '#1c7ed6',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.1)',
};

/**
 * Dark theme colors
 */
export const darkTheme: ThemeColors = {
  // Backgrounds
  bgPrimary: '#1a1b1e',
  bgSecondary: '#25262b',
  bgTertiary: '#2c2e33',
  bgHover: '#373a40',
  bgSelected: '#1a4480',

  // Text
  textPrimary: '#c1c2c5',
  textSecondary: '#909296',
  textMuted: '#5c5f66',

  // Borders
  border: '#373a40',
  borderLight: '#2c2e33',

  // Severity colors
  fatal: '#ff6b6b',
  error: '#ff8787',
  warning: '#ffd43b',
  info: '#74c0fc',
  debug: '#909296',
  log: '#c1c2c5',

  // Status colors
  success: '#69db7c',
  pending: '#ffd43b',

  // Accent
  accent: '#4dabf7',
  accentHover: '#74c0fc',

  // Shadows
  shadow: 'rgba(0, 0, 0, 0.5)',
};

/**
 * Get theme colors based on theme setting
 */
export function getTheme(theme: 'light' | 'dark' | 'auto'): ThemeColors {
  if (theme === 'auto') {
    // Check for system dark mode preference
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? darkTheme
        : lightTheme;
    }
    return lightTheme;
  }
  return theme === 'dark' ? darkTheme : lightTheme;
}

/**
 * Get severity level color
 */
export function getSeverityColor(
  level: string | undefined,
  colors: ThemeColors
): string {
  switch (level) {
    case 'fatal':
      return colors.fatal;
    case 'error':
      return colors.error;
    case 'warning':
      return colors.warning;
    case 'info':
      return colors.info;
    case 'debug':
      return colors.debug;
    case 'log':
    default:
      return colors.log;
  }
}

/**
 * Get span status color
 */
export function getStatusColor(
  status: string | undefined,
  colors: ThemeColors
): string {
  if (!status || status === 'ok') {
    return colors.success;
  }
  if (status === 'error' || status === 'internal_error') {
    return colors.error;
  }
  return colors.pending;
}

/**
 * Base styles factory function
 */
export function createStyles(colors: ThemeColors) {
  return {
    // Panel container
    panel: {
      position: 'fixed' as const,
      display: 'flex',
      flexDirection: 'column' as const,
      width: '600px',
      maxWidth: 'calc(100vw - 32px)',
      backgroundColor: colors.bgPrimary,
      border: `1px solid ${colors.border}`,
      borderRadius: '8px',
      boxShadow: `0 4px 24px ${colors.shadow}`,
      fontFamily:
        '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
      fontSize: '13px',
      color: colors.textPrimary,
      overflow: 'hidden',
    },

    // Toggle button
    toggleButton: {
      position: 'fixed' as const,
      width: '48px',
      height: '48px',
      borderRadius: '50%',
      backgroundColor: colors.accent,
      color: '#ffffff',
      border: 'none',
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      boxShadow: `0 2px 12px ${colors.shadow}`,
      transition: 'transform 0.2s, background-color 0.2s',
      outline: 'none',
    },

    // Header
    header: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '12px 16px',
      borderBottom: `1px solid ${colors.border}`,
      backgroundColor: colors.bgSecondary,
    },

    headerTitle: {
      margin: 0,
      fontSize: '14px',
      fontWeight: 600,
      color: colors.textPrimary,
    },

    headerActions: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
    },

    // Tabs
    tabs: {
      display: 'flex',
      borderBottom: `1px solid ${colors.border}`,
      backgroundColor: colors.bgSecondary,
      overflowX: 'auto' as const,
    },

    tab: {
      padding: '10px 16px',
      border: 'none',
      backgroundColor: 'transparent',
      color: colors.textSecondary,
      cursor: 'pointer',
      fontSize: '13px',
      fontWeight: 500,
      whiteSpace: 'nowrap' as const,
      borderBottom: '2px solid transparent',
      transition: 'color 0.2s, border-color 0.2s',
      outline: 'none',
    },

    tabActive: {
      color: colors.accent,
      borderBottomColor: colors.accent,
    },

    tabBadge: {
      marginLeft: '6px',
      padding: '2px 6px',
      borderRadius: '10px',
      backgroundColor: colors.error,
      color: '#ffffff',
      fontSize: '11px',
      fontWeight: 600,
    },

    // Content area
    content: {
      flex: 1,
      overflow: 'auto' as const,
      padding: '0',
    },

    // List items
    list: {
      listStyle: 'none',
      margin: 0,
      padding: 0,
    },

    listItem: {
      padding: '12px 16px',
      borderBottom: `1px solid ${colors.borderLight}`,
      cursor: 'pointer',
      transition: 'background-color 0.15s',
    },

    listItemHover: {
      backgroundColor: colors.bgHover,
    },

    listItemSelected: {
      backgroundColor: colors.bgSelected,
    },

    // Event/Log item
    eventItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
    },

    eventLevel: {
      width: '6px',
      height: '6px',
      borderRadius: '50%',
      marginTop: '6px',
      flexShrink: 0,
    },

    eventContent: {
      flex: 1,
      minWidth: 0,
    },

    eventMessage: {
      margin: 0,
      fontSize: '13px',
      fontWeight: 500,
      color: colors.textPrimary,
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap' as const,
    },

    eventMeta: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      marginTop: '4px',
      fontSize: '11px',
      color: colors.textMuted,
    },

    // Toolbar/Filter bar
    toolbar: {
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '8px 16px',
      borderBottom: `1px solid ${colors.border}`,
      backgroundColor: colors.bgSecondary,
    },

    searchInput: {
      flex: 1,
      padding: '6px 12px',
      border: `1px solid ${colors.border}`,
      borderRadius: '4px',
      backgroundColor: colors.bgPrimary,
      color: colors.textPrimary,
      fontSize: '12px',
      outline: 'none',
    },

    select: {
      padding: '6px 12px',
      border: `1px solid ${colors.border}`,
      borderRadius: '4px',
      backgroundColor: colors.bgPrimary,
      color: colors.textPrimary,
      fontSize: '12px',
      outline: 'none',
      cursor: 'pointer',
    },

    // Buttons
    button: {
      padding: '6px 12px',
      border: `1px solid ${colors.border}`,
      borderRadius: '4px',
      backgroundColor: colors.bgPrimary,
      color: colors.textPrimary,
      fontSize: '12px',
      cursor: 'pointer',
      transition: 'background-color 0.15s',
      outline: 'none',
    },

    buttonPrimary: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      color: '#ffffff',
    },

    buttonIcon: {
      padding: '6px',
      border: 'none',
      borderRadius: '4px',
      backgroundColor: 'transparent',
      color: colors.textSecondary,
      cursor: 'pointer',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Detail view
    detailPanel: {
      padding: '16px',
      backgroundColor: colors.bgSecondary,
      borderTop: `1px solid ${colors.border}`,
    },

    detailSection: {
      marginBottom: '16px',
    },

    detailSectionTitle: {
      fontSize: '12px',
      fontWeight: 600,
      color: colors.textMuted,
      textTransform: 'uppercase' as const,
      letterSpacing: '0.5px',
      marginBottom: '8px',
    },

    // Stack trace
    stackTrace: {
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      backgroundColor: colors.bgTertiary,
      borderRadius: '4px',
      overflow: 'hidden',
    },

    stackFrame: {
      padding: '8px 12px',
      borderBottom: `1px solid ${colors.borderLight}`,
    },

    stackFrameInApp: {
      backgroundColor: colors.bgSelected,
    },

    stackFrameFunction: {
      color: colors.accent,
      fontWeight: 500,
    },

    stackFrameFile: {
      color: colors.textSecondary,
      fontSize: '11px',
    },

    // Span timeline
    timeline: {
      position: 'relative' as const,
      paddingLeft: '20px',
    },

    timelineItem: {
      position: 'relative' as const,
      padding: '8px 0 8px 16px',
      borderLeft: `2px solid ${colors.border}`,
    },

    timelineItemDot: {
      position: 'absolute' as const,
      left: '-6px',
      top: '12px',
      width: '10px',
      height: '10px',
      borderRadius: '50%',
      backgroundColor: colors.accent,
      border: `2px solid ${colors.bgPrimary}`,
    },

    // Span waterfall
    waterfall: {
      position: 'relative' as const,
    },

    waterfallBar: {
      height: '20px',
      borderRadius: '2px',
      backgroundColor: colors.accent,
      position: 'relative' as const,
    },

    // JSON viewer
    jsonViewer: {
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      fontSize: '12px',
      lineHeight: '1.5',
      backgroundColor: colors.bgTertiary,
      padding: '12px',
      borderRadius: '4px',
      overflow: 'auto' as const,
    },

    jsonKey: {
      color: colors.accent,
    },

    jsonString: {
      color: colors.success,
    },

    jsonNumber: {
      color: colors.warning,
    },

    jsonBoolean: {
      color: colors.info,
    },

    jsonNull: {
      color: colors.textMuted,
    },

    // Empty state
    emptyState: {
      display: 'flex',
      flexDirection: 'column' as const,
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px 16px',
      color: colors.textMuted,
    },

    emptyStateIcon: {
      fontSize: '32px',
      marginBottom: '12px',
    },

    emptyStateText: {
      fontSize: '14px',
      textAlign: 'center' as const,
    },

    // Breadcrumb item
    breadcrumbItem: {
      display: 'flex',
      alignItems: 'flex-start',
      gap: '12px',
      padding: '10px 16px',
      borderBottom: `1px solid ${colors.borderLight}`,
    },

    breadcrumbIcon: {
      width: '24px',
      height: '24px',
      borderRadius: '4px',
      backgroundColor: colors.bgTertiary,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: '12px',
      flexShrink: 0,
    },

    breadcrumbContent: {
      flex: 1,
      minWidth: 0,
    },

    breadcrumbCategory: {
      fontSize: '11px',
      color: colors.textMuted,
      marginBottom: '2px',
    },

    breadcrumbMessage: {
      fontSize: '13px',
      color: colors.textPrimary,
    },

    // Session item
    sessionItem: {
      padding: '12px 16px',
      borderBottom: `1px solid ${colors.borderLight}`,
    },

    sessionHeader: {
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: '8px',
    },

    sessionId: {
      fontFamily: 'Monaco, Consolas, "Courier New", monospace',
      fontSize: '12px',
      color: colors.accent,
    },

    sessionStatus: {
      padding: '2px 8px',
      borderRadius: '4px',
      fontSize: '11px',
      fontWeight: 500,
    },

    sessionStats: {
      display: 'flex',
      gap: '16px',
      fontSize: '12px',
      color: colors.textSecondary,
    },

    // Copy button
    copyButton: {
      padding: '4px 8px',
      border: `1px solid ${colors.border}`,
      borderRadius: '4px',
      backgroundColor: 'transparent',
      color: colors.textSecondary,
      fontSize: '11px',
      cursor: 'pointer',
    },

    // Tags
    tag: {
      display: 'inline-block',
      padding: '2px 8px',
      borderRadius: '4px',
      backgroundColor: colors.bgTertiary,
      fontSize: '11px',
      color: colors.textSecondary,
      marginRight: '4px',
      marginBottom: '4px',
    },

    // Resize handle
    resizeHandle: {
      position: 'absolute' as const,
      top: 0,
      left: 0,
      right: 0,
      height: '4px',
      cursor: 'ns-resize',
      backgroundColor: 'transparent',
    },
  };
}

/**
 * Position styles based on panel position
 */
export function getPositionStyles(position: string, isOpen: boolean) {
  const base = {
    margin: '16px',
  };

  switch (position) {
    case 'top-left':
      return { ...base, top: 0, left: 0 };
    case 'top-right':
      return { ...base, top: 0, right: 0 };
    case 'bottom-left':
      return { ...base, bottom: isOpen ? 0 : 'auto', left: 0 };
    case 'bottom-right':
    default:
      return { ...base, bottom: isOpen ? 0 : 'auto', right: 0 };
  }
}
