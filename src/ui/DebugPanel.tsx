/**
 * Debug Panel Component
 *
 * Main floating debug panel for viewing Sentry events, traces, breadcrumbs, logs, and sessions.
 */

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import type { DebugPanelProps, ActiveTab, TabConfig, ThemeColors } from './types.js';
import { createStyles, getPositionStyles, getTheme, lightTheme, darkTheme } from './styles.js';
import { useKeyboardShortcut, useLocalStorage } from './hooks/useLogger.js';
import { EventsTab } from './tabs/EventsTab.js';
import { TracesTab } from './tabs/TracesTab.js';
import { BreadcrumbsTab } from './tabs/BreadcrumbsTab.js';
import { LogsTab } from './tabs/LogsTab.js';
import { SessionsTab } from './tabs/SessionsTab.js';

/**
 * Tab configuration
 */
const TABS: TabConfig[] = [
  { id: 'events', label: 'Events' },
  { id: 'traces', label: 'Traces' },
  { id: 'breadcrumbs', label: 'Breadcrumbs' },
  { id: 'logs', label: 'Logs' },
  { id: 'sessions', label: 'Sessions' },
];

/**
 * Debug Panel Component
 *
 * A floating, resizable panel for viewing logger data.
 */
export function DebugPanel({
  logger,
  position = 'bottom-right',
  defaultOpen = false,
  maxHeight = '400px',
  theme = 'auto',
  zIndex = 9999,
}: DebugPanelProps) {
  // Panel state
  const [isOpen, setIsOpen] = useLocalStorage('debug-panel-open', defaultOpen);
  const [activeTab, setActiveTab] = useLocalStorage<ActiveTab>('debug-panel-tab', 'events');
  const [panelHeight, setPanelHeight] = useLocalStorage('debug-panel-height', 400);

  // Theme handling
  const [currentTheme, setCurrentTheme] = useState<ThemeColors>(() => getTheme(theme));

  // Listen for system theme changes
  useEffect(() => {
    if (theme !== 'auto') {
      setCurrentTheme(theme === 'dark' ? darkTheme : lightTheme);
      return;
    }

    const updateTheme = () => {
      setCurrentTheme(getTheme('auto'));
    };

    updateTheme();

    if (typeof window !== 'undefined' && window.matchMedia) {
      const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
      mediaQuery.addEventListener('change', updateTheme);
      return () => mediaQuery.removeEventListener('change', updateTheme);
    }
  }, [theme]);

  // Styles
  const styles = useMemo(() => createStyles(currentTheme), [currentTheme]);
  const positionStyles = useMemo(
    () => getPositionStyles(position, isOpen),
    [position, isOpen]
  );

  // Keyboard shortcuts
  useKeyboardShortcut('Escape', () => setIsOpen(false));
  useKeyboardShortcut('d', () => setIsOpen((prev) => !prev), { ctrl: true, shift: true });

  // Resize handling
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStartY, setResizeStartY] = useState(0);
  const [resizeStartHeight, setResizeStartHeight] = useState(0);

  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      setResizeStartY(e.clientY);
      setResizeStartHeight(panelHeight);
    },
    [panelHeight]
  );

  useEffect(() => {
    if (!isResizing) return;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = resizeStartY - e.clientY;
      const newHeight = Math.max(200, Math.min(800, resizeStartHeight + deltaY));
      setPanelHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing, resizeStartY, resizeStartHeight, setPanelHeight]);

  // Toggle panel
  const togglePanel = useCallback(() => {
    setIsOpen((prev) => !prev);
  }, [setIsOpen]);

  // Render toggle button
  const renderToggleButton = () => {
    const buttonPosition = {
      ...positionStyles,
      ...(position.includes('bottom') ? { bottom: '16px' } : { top: '16px' }),
      ...(position.includes('right') ? { right: '16px' } : { left: '16px' }),
    };

    return (
      <button
        onClick={togglePanel}
        style={{
          ...styles.toggleButton,
          ...buttonPosition,
          zIndex,
        }}
        title={isOpen ? 'Close Debug Panel (Ctrl+Shift+D)' : 'Open Debug Panel (Ctrl+Shift+D)'}
        onMouseEnter={(e) => {
          (e.target as HTMLButtonElement).style.transform = 'scale(1.1)';
        }}
        onMouseLeave={(e) => {
          (e.target as HTMLButtonElement).style.transform = 'scale(1)';
        }}
      >
        {isOpen ? (
          // Close icon
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M15 5L5 15M5 5L15 15"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        ) : (
          // Bug icon
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <path
              d="M10 3C7.5 3 5.5 5 5.5 7.5V9H14.5V7.5C14.5 5 12.5 3 10 3Z"
              stroke="currentColor"
              strokeWidth="1.5"
            />
            <rect x="5" y="9" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.5" />
            <path d="M3 11H5M15 11H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M3 15H5M15 15H17" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M4 7L5.5 8.5M16 7L14.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        )}
      </button>
    );
  };

  // Render panel
  const renderPanel = () => {
    if (!isOpen) return null;

    return (
      <div
        style={{
          ...styles.panel,
          ...positionStyles,
          height: `${panelHeight}px`,
          zIndex,
        }}
      >
        {/* Resize handle */}
        <div
          style={styles.resizeHandle}
          onMouseDown={handleResizeStart}
        />

        {/* Header */}
        <div style={styles.header}>
          <h2 style={styles.headerTitle}>Debug Panel</h2>
          <div style={styles.headerActions}>
            <button
              onClick={togglePanel}
              style={styles.buttonIcon}
              title="Close (Escape)"
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M12 4L4 12M4 4L12 12"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Tabs */}
        <div style={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                ...styles.tab,
                ...(activeTab === tab.id ? styles.tabActive : {}),
              }}
              onMouseEnter={(e) => {
                if (activeTab !== tab.id) {
                  (e.target as HTMLButtonElement).style.color = currentTheme.textPrimary;
                }
              }}
              onMouseLeave={(e) => {
                if (activeTab !== tab.id) {
                  (e.target as HTMLButtonElement).style.color = currentTheme.textSecondary;
                }
              }}
            >
              {tab.label}
              {tab.badge !== undefined && tab.badge > 0 && (
                <span style={styles.tabBadge}>{tab.badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={styles.content}>
          {activeTab === 'events' && (
            <EventsTab
              logger={logger}
              colors={currentTheme}
              maxHeight={`${panelHeight - 100}px`}
            />
          )}
          {activeTab === 'traces' && (
            <TracesTab
              logger={logger}
              colors={currentTheme}
              maxHeight={`${panelHeight - 100}px`}
            />
          )}
          {activeTab === 'breadcrumbs' && (
            <BreadcrumbsTab
              logger={logger}
              colors={currentTheme}
              maxHeight={`${panelHeight - 100}px`}
            />
          )}
          {activeTab === 'logs' && (
            <LogsTab
              logger={logger}
              colors={currentTheme}
              maxHeight={`${panelHeight - 100}px`}
            />
          )}
          {activeTab === 'sessions' && (
            <SessionsTab
              logger={logger}
              colors={currentTheme}
              maxHeight={`${panelHeight - 100}px`}
            />
          )}
        </div>
      </div>
    );
  };

  return (
    <>
      {renderToggleButton()}
      {renderPanel()}
    </>
  );
}
