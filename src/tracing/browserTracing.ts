/**
 * Browser-specific tracing utilities
 * Integrates with browser Performance API for timing data
 */

import { Span } from './span';
import { Transaction } from './transaction';
import { TraceContext } from './context';
import { startTransaction } from './hubExtensions';
import type { BrowserTracingOptions, SpanAttributes } from './types';

// ============================================
// Browser environment detection
// ============================================

/**
 * Check if we're in a browser environment
 */
function isBrowser(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof document !== 'undefined' &&
    typeof window.performance !== 'undefined'
  );
}

/**
 * Get the browser Performance API if available
 */
function getPerformance(): Performance | undefined {
  if (isBrowser()) {
    return window.performance;
  }
  return undefined;
}

// ============================================
// Page Load Span
// ============================================

/**
 * Start a browser tracing page load span
 * Captures navigation timing and web vitals
 */
export function startBrowserTracingPageLoadSpan(options?: BrowserTracingOptions): Span {
  const performance = getPerformance();

  const name = options?.name || getPageLoadName();
  const op = options?.op || 'pageload';

  const attributes: SpanAttributes = {
    ...options?.attributes,
  };

  // Add navigation type if available
  if (performance && 'getEntriesByType' in performance) {
    try {
      const navEntries = performance.getEntriesByType('navigation');
      if (navEntries.length > 0) {
        const navEntry = navEntries[0] as PerformanceNavigationTiming;
        attributes['browser.navigation.type'] = navEntry.type;
      }
    } catch {
      // Ignore errors
    }
  }

  // Start the transaction
  const transaction = startTransaction({
    name,
    op,
    attributes,
    source: 'url',
  });

  // Add timing spans if performance API is available
  if (performance) {
    addNavigationTimingSpans(transaction, performance);
  }

  return transaction;
}

/**
 * Start a browser tracing navigation span
 * For client-side navigations (SPA)
 */
export function startBrowserTracingNavigationSpan(options?: BrowserTracingOptions): Span {
  const name = options?.name || getNavigationName();
  const op = options?.op || 'navigation';

  const attributes: SpanAttributes = {
    ...options?.attributes,
    'sentry.source': 'url',
  };

  // Start the transaction
  const transaction = startTransaction({
    name,
    op,
    attributes,
    source: 'url',
  });

  return transaction;
}

/**
 * Report that the page has fully loaded
 * Should be called when the page is fully interactive
 */
export function reportPageLoaded(): void {
  const activeTransaction = TraceContext.getActiveTransaction();

  if (!activeTransaction) {
    return;
  }

  const performance = getPerformance();
  if (!performance) {
    return;
  }

  // Add final timing measurements
  addWebVitalsMeasurements(activeTransaction);
}

// ============================================
// Navigation Timing Spans
// ============================================

/**
 * Add navigation timing spans to a transaction
 */
function addNavigationTimingSpans(transaction: Transaction, performance: Performance): void {
  if (!('getEntriesByType' in performance)) {
    return;
  }

  try {
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length === 0) {
      return;
    }

    const navEntry = navEntries[0] as PerformanceNavigationTiming;
    const startTime = navEntry.startTime;

    // DNS lookup
    if (navEntry.domainLookupEnd > navEntry.domainLookupStart) {
      createTimingSpan(
        transaction,
        'DNS Lookup',
        'browser.dns',
        startTime + navEntry.domainLookupStart,
        startTime + navEntry.domainLookupEnd
      );
    }

    // TCP connection
    if (navEntry.connectEnd > navEntry.connectStart) {
      createTimingSpan(
        transaction,
        'TCP Connection',
        'browser.connect',
        startTime + navEntry.connectStart,
        startTime + navEntry.connectEnd
      );
    }

    // TLS negotiation
    if (navEntry.secureConnectionStart > 0 && navEntry.connectEnd > navEntry.secureConnectionStart) {
      createTimingSpan(
        transaction,
        'TLS Negotiation',
        'browser.tls',
        startTime + navEntry.secureConnectionStart,
        startTime + navEntry.connectEnd
      );
    }

    // Request
    if (navEntry.responseStart > navEntry.requestStart) {
      createTimingSpan(
        transaction,
        'Request',
        'browser.request',
        startTime + navEntry.requestStart,
        startTime + navEntry.responseStart
      );
    }

    // Response
    if (navEntry.responseEnd > navEntry.responseStart) {
      createTimingSpan(
        transaction,
        'Response',
        'browser.response',
        startTime + navEntry.responseStart,
        startTime + navEntry.responseEnd
      );
    }

    // DOM Processing
    if (navEntry.domContentLoadedEventStart > navEntry.responseEnd) {
      createTimingSpan(
        transaction,
        'DOM Processing',
        'browser.dom',
        startTime + navEntry.responseEnd,
        startTime + navEntry.domContentLoadedEventStart
      );
    }

    // DOM Content Loaded
    if (navEntry.domContentLoadedEventEnd > navEntry.domContentLoadedEventStart) {
      createTimingSpan(
        transaction,
        'DOMContentLoaded',
        'browser.domContentLoaded',
        startTime + navEntry.domContentLoadedEventStart,
        startTime + navEntry.domContentLoadedEventEnd
      );
    }

    // Load Event
    if (navEntry.loadEventEnd > navEntry.loadEventStart) {
      createTimingSpan(
        transaction,
        'Load Event',
        'browser.load',
        startTime + navEntry.loadEventStart,
        startTime + navEntry.loadEventEnd
      );
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Create a timing span with browser timing data
 */
function createTimingSpan(
  transaction: Transaction,
  name: string,
  op: string,
  startTime: number,
  endTime: number
): Span {
  // Convert from DOMHighResTimeStamp (milliseconds) to seconds
  const startTimestamp = hrTimeToTimestamp(startTime);
  const endTimestamp = hrTimeToTimestamp(endTime);

  const span = transaction.startChild({
    name,
    op,
    startTime: startTimestamp,
  });

  span.end(endTimestamp);
  return span;
}

// ============================================
// Web Vitals
// ============================================

/**
 * Add web vitals measurements to a transaction
 */
function addWebVitalsMeasurements(transaction: Transaction): void {
  const performance = getPerformance();
  if (!performance || !('getEntriesByType' in performance)) {
    return;
  }

  try {
    // Get paint timing
    const paintEntries = performance.getEntriesByType('paint');
    for (const entry of paintEntries) {
      if (entry.name === 'first-paint') {
        transaction.setAttribute('fp', entry.startTime);
      } else if (entry.name === 'first-contentful-paint') {
        transaction.setAttribute('fcp', entry.startTime);
      }
    }

    // Get navigation timing for TTFB
    const navEntries = performance.getEntriesByType('navigation');
    if (navEntries.length > 0) {
      const navEntry = navEntries[0] as PerformanceNavigationTiming;
      transaction.setAttribute('ttfb', navEntry.responseStart);
    }

    // Get LCP using PerformanceObserver if available
    // This needs to be set up earlier, but we'll try to get any existing entries
    const lcpEntries = performance.getEntriesByType('largest-contentful-paint');
    if (lcpEntries.length > 0) {
      const lcpEntry = lcpEntries[lcpEntries.length - 1];
      transaction.setAttribute('lcp', lcpEntry.startTime);
    }
  } catch {
    // Ignore errors
  }
}

// ============================================
// Web Vitals Observer
// ============================================

/**
 * Observer for Core Web Vitals
 */
let webVitalsObserver: PerformanceObserver | undefined;

/**
 * Start observing web vitals
 * Results will be added to the active transaction
 */
export function startWebVitalsObserver(): void {
  if (!isBrowser() || typeof PerformanceObserver === 'undefined') {
    return;
  }

  try {
    webVitalsObserver = new PerformanceObserver((entryList) => {
      const transaction = TraceContext.getActiveTransaction();
      if (!transaction) {
        return;
      }

      for (const entry of entryList.getEntries()) {
        if (entry.entryType === 'largest-contentful-paint') {
          transaction.setAttribute('lcp', entry.startTime);
        } else if (entry.entryType === 'first-input') {
          const fidEntry = entry as PerformanceEventTiming;
          transaction.setAttribute('fid', fidEntry.processingStart - fidEntry.startTime);
        } else if (entry.entryType === 'layout-shift') {
          // CLS needs accumulation - simplified here
          const clsEntry = entry as PerformanceEntry & { value: number; hadRecentInput: boolean };
          if (!clsEntry.hadRecentInput) {
            const currentCLS = (transaction.attributes['cls'] as number) || 0;
            transaction.setAttribute('cls', currentCLS + clsEntry.value);
          }
        }
      }
    });

    // Observe web vitals
    webVitalsObserver.observe({
      type: 'largest-contentful-paint',
      buffered: true,
    });
    webVitalsObserver.observe({
      type: 'first-input',
      buffered: true,
    });
    webVitalsObserver.observe({
      type: 'layout-shift',
      buffered: true,
    });
  } catch {
    // Observer not supported
  }
}

/**
 * Stop observing web vitals
 */
export function stopWebVitalsObserver(): void {
  if (webVitalsObserver) {
    webVitalsObserver.disconnect();
    webVitalsObserver = undefined;
  }
}

// ============================================
// Resource Timing
// ============================================

/**
 * Create spans for resource timing entries
 */
export function addResourceTimingSpans(transaction: Transaction): void {
  const performance = getPerformance();
  if (!performance || !('getEntriesByType' in performance)) {
    return;
  }

  try {
    const resourceEntries = performance.getEntriesByType('resource') as PerformanceResourceTiming[];

    for (const entry of resourceEntries) {
      const name = entry.name;
      const op = getResourceOp(entry.initiatorType);

      const span = transaction.startChild({
        name: getResourceName(name),
        op,
        startTime: hrTimeToTimestamp(entry.startTime),
        attributes: {
          'http.url': name,
          'resource.initiator_type': entry.initiatorType,
          'resource.transfer_size': entry.transferSize,
          'resource.encoded_body_size': entry.encodedBodySize,
          'resource.decoded_body_size': entry.decodedBodySize,
        },
      });

      span.end(hrTimeToTimestamp(entry.responseEnd));
    }
  } catch {
    // Ignore errors
  }
}

// ============================================
// Utility functions
// ============================================

/**
 * Get page load name from current URL
 */
function getPageLoadName(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.pathname;
  }
  return '/';
}

/**
 * Get navigation name from current URL
 */
function getNavigationName(): string {
  if (typeof window !== 'undefined' && window.location) {
    return window.location.pathname;
  }
  return '/';
}

/**
 * Convert DOMHighResTimeStamp to timestamp in seconds
 */
function hrTimeToTimestamp(hrTime: number): number {
  if (typeof performance !== 'undefined' && performance.timeOrigin) {
    return (performance.timeOrigin + hrTime) / 1000;
  }
  // Fallback
  return Date.now() / 1000 - (performance?.now?.() || 0) / 1000 + hrTime / 1000;
}

/**
 * Get operation type for resource
 */
function getResourceOp(initiatorType: string): string {
  switch (initiatorType) {
    case 'fetch':
    case 'xmlhttprequest':
      return 'http.client';
    case 'script':
      return 'resource.script';
    case 'css':
    case 'link':
      return 'resource.css';
    case 'img':
      return 'resource.img';
    case 'video':
    case 'audio':
      return 'resource.media';
    default:
      return 'resource.other';
  }
}

/**
 * Get short resource name from URL
 */
function getResourceName(url: string): string {
  try {
    const parsed = new URL(url);
    return parsed.pathname.split('/').pop() || parsed.pathname;
  } catch {
    return url;
  }
}

// ============================================
// History API integration (for SPAs)
// ============================================

let historyPushState: typeof history.pushState | undefined;
let historyReplaceState: typeof history.replaceState | undefined;

/**
 * Instrument the History API for SPA navigation tracking
 */
export function instrumentHistoryAPI(
  onNavigate: (to: string, from: string) => void
): () => void {
  if (!isBrowser()) {
    return () => {};
  }

  const originalPushState = history.pushState;
  const originalReplaceState = history.replaceState;

  historyPushState = originalPushState;
  historyReplaceState = originalReplaceState;

  let currentUrl = window.location.href;

  const handleNavigation = (method: 'pushState' | 'replaceState') => {
    return function (
      this: History,
      data: unknown,
      unused: string,
      url?: string | URL | null
    ) {
      const previousUrl = currentUrl;
      const result =
        method === 'pushState'
          ? originalPushState.call(this, data, unused, url)
          : originalReplaceState.call(this, data, unused, url);

      currentUrl = window.location.href;

      if (previousUrl !== currentUrl) {
        onNavigate(currentUrl, previousUrl);
      }

      return result;
    };
  };

  history.pushState = handleNavigation('pushState');
  history.replaceState = handleNavigation('replaceState');

  // Handle popstate (back/forward)
  const handlePopState = () => {
    const previousUrl = currentUrl;
    currentUrl = window.location.href;

    if (previousUrl !== currentUrl) {
      onNavigate(currentUrl, previousUrl);
    }
  };

  window.addEventListener('popstate', handlePopState);

  // Return cleanup function
  return () => {
    if (historyPushState) {
      history.pushState = historyPushState;
    }
    if (historyReplaceState) {
      history.replaceState = historyReplaceState;
    }
    window.removeEventListener('popstate', handlePopState);
  };
}
