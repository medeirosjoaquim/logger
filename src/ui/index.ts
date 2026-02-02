/**
 * Debug Panel UI Module
 *
 * React-based debug panel for viewing Sentry events, traces, breadcrumbs, logs, and sessions.
 *
 * @example
 * ```tsx
 * import { DebugPanel } from '@universal-logger/core/react';
 * import { logger } from './logger';
 *
 * function App() {
 *   return (
 *     <>
 *       <YourApp />
 *       <DebugPanel logger={logger} />
 *     </>
 *   );
 * }
 * ```
 */

// Main components
export { DebugPanel } from './DebugPanel.js';

// Hooks
export {
  useLoggerEvents,
  useLoggerTraces,
  useLoggerLogs,
  useLoggerSessions,
  useLoggerBreadcrumbs,
  useAutoRefresh,
  useKeyboardShortcut,
  useLocalStorage,
  useDebounce,
} from './hooks/useLogger.js';

// Components (for custom UIs)
export { StackTrace } from './components/StackTrace.js';
export { JsonViewer, RawJson } from './components/JsonViewer.js';
export { ExportButton, ExportDropdown } from './components/Export.js';

// Tab components (for building custom panels)
export { EventsTab } from './tabs/EventsTab.js';
export { TracesTab } from './tabs/TracesTab.js';
export { BreadcrumbsTab } from './tabs/BreadcrumbsTab.js';
export { LogsTab } from './tabs/LogsTab.js';
export { SessionsTab } from './tabs/SessionsTab.js';

// Types
export type {
  DebugPanelProps,
  UniversalLogger,
  PanelPosition,
  PanelTheme,
  ActiveTab,
  TabConfig,
  ThemeColors,
  EventsFilterState,
  TracesFilterState,
  BreadcrumbsFilterState,
  LogsFilterState,
  ExportFormat,
  SpanTreeNode,
} from './types.js';

// Styles (for theming)
export {
  lightTheme,
  darkTheme,
  getTheme,
  getSeverityColor,
  getStatusColor,
  createStyles,
  getPositionStyles,
} from './styles.js';
