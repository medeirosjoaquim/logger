/**
 * Breadcrumbs Integration
 *
 * Automatically captures breadcrumbs from various browser events.
 */

import type { Integration, IntegrationClient } from './types.js';
import type { Breadcrumb, SeverityLevel } from '../types/sentry.js';
import {
  instrumentConsole,
  instrumentDOM,
  instrumentFetch,
  instrumentXHR,
  instrumentHistory,
} from './instrument.js';

/**
 * Options for the breadcrumbs integration
 */
export interface BreadcrumbsIntegrationOptions {
  /**
   * Whether to capture console logs
   * @default true
   */
  console?: boolean | {
    /** Levels to capture */
    levels?: ('log' | 'warn' | 'error' | 'info' | 'debug')[];
  };

  /**
   * Whether to capture DOM events
   * @default true
   */
  dom?: boolean | {
    /** Event types to capture */
    eventTypes?: string[];
    /** Maximum inner text length to capture */
    maxInnerTextLength?: number;
  };

  /**
   * Whether to capture fetch requests
   * @default true
   */
  fetch?: boolean;

  /**
   * Whether to capture XHR requests
   * @default true
   */
  xhr?: boolean;

  /**
   * Whether to capture history changes
   * @default true
   */
  history?: boolean;

  /**
   * Maximum number of breadcrumbs to keep
   * @default 100
   */
  maxBreadcrumbs?: number;
}

/**
 * Create the breadcrumbs integration
 */
export function breadcrumbsIntegration(options: BreadcrumbsIntegrationOptions = {}): Integration {
  const {
    console: consoleOption = true,
    dom: domOption = true,
    fetch: fetchOption = true,
    xhr: xhrOption = true,
    history: historyOption = true,
    maxBreadcrumbs = 100,
  } = options;

  let client: IntegrationClient | null = null;
  const unsubscribers: (() => void)[] = [];

  // Parse console options
  const consoleEnabled = consoleOption !== false;
  const consoleLevels = typeof consoleOption === 'object' && consoleOption.levels
    ? consoleOption.levels
    : ['log', 'warn', 'error', 'info', 'debug'];

  // Parse DOM options
  const domEnabled = domOption !== false;
  const domEventTypes = typeof domOption === 'object' && domOption.eventTypes
    ? domOption.eventTypes
    : ['click', 'keypress', 'submit'];
  const maxInnerTextLength = typeof domOption === 'object' && domOption.maxInnerTextLength
    ? domOption.maxInnerTextLength
    : 100;

  return {
    name: 'Breadcrumbs',

    setup(c: IntegrationClient) {
      client = c;

      // Instrument console
      if (consoleEnabled && typeof console !== 'undefined') {
        const unsubscribe = instrumentConsole((data) => {
          if (!client) return;
          if (!consoleLevels.includes(data.method as typeof consoleLevels[number])) return;

          const level = mapConsoleLevel(data.method);
          const message = formatConsoleArgs(data.args);

          const breadcrumb: Breadcrumb = {
            type: 'debug',
            category: 'console',
            message,
            level,
            timestamp: Date.now() / 1000,
            data: {
              logger: 'console',
            },
          };

          client.addBreadcrumb(breadcrumb);
        });
        unsubscribers.push(unsubscribe);
      }

      // Instrument DOM events
      if (domEnabled && typeof document !== 'undefined') {
        const unsubscribe = instrumentDOM(
          (data) => {
            if (!client) return;

            // Build a meaningful message
            let message = `${data.eventType} on `;
            if (data.tagName) {
              message += data.tagName.toLowerCase();
              if (data.elementId) {
                message += `#${data.elementId}`;
              } else if (data.className) {
                const classes = data.className.split(' ').filter(Boolean);
                if (classes.length > 0) {
                  message += `.${classes.slice(0, 2).join('.')}`;
                }
              }
            } else {
              message += 'unknown element';
            }

            const breadcrumb: Breadcrumb = {
              type: 'ui',
              category: `ui.${data.eventType}`,
              message,
              level: 'info',
              timestamp: Date.now() / 1000,
              data: {
                tag: data.tagName?.toLowerCase(),
                id: data.elementId || undefined,
                class: data.className || undefined,
                text: data.innerText?.substring(0, maxInnerTextLength),
              },
            };

            client.addBreadcrumb(breadcrumb);
          },
          domEventTypes
        );
        unsubscribers.push(unsubscribe);
      }

      // Instrument fetch
      if (fetchOption && typeof fetch !== 'undefined') {
        const unsubscribe = instrumentFetch((data) => {
          if (!client) return;

          // Skip logging to Sentry endpoint
          const dsnUrl = client.getDsn();
          if (dsnUrl && data.url.includes(dsnUrl)) return;

          const breadcrumb: Breadcrumb = {
            type: 'http',
            category: 'fetch',
            message: `${data.method} ${truncateUrl(data.url)}`,
            level: data.error || (data.statusCode && data.statusCode >= 400) ? 'error' : 'info',
            timestamp: data.startTimestamp / 1000,
            data: {
              url: data.url,
              method: data.method,
              status_code: data.statusCode,
            },
          };

          if (data.error) {
            breadcrumb.data!.error = data.error.message;
          }

          client.addBreadcrumb(breadcrumb);
        });
        unsubscribers.push(unsubscribe);
      }

      // Instrument XHR
      if (xhrOption && typeof XMLHttpRequest !== 'undefined') {
        const unsubscribe = instrumentXHR((data) => {
          if (!client) return;

          // Skip logging to Sentry endpoint
          const dsnUrl = client.getDsn();
          if (dsnUrl && data.url.includes(dsnUrl)) return;

          const breadcrumb: Breadcrumb = {
            type: 'http',
            category: 'xhr',
            message: `${data.method} ${truncateUrl(data.url)}`,
            level: data.error || (data.statusCode && data.statusCode >= 400) ? 'error' : 'info',
            timestamp: data.startTimestamp / 1000,
            data: {
              url: data.url,
              method: data.method,
              status_code: data.statusCode,
            },
          };

          if (data.error) {
            breadcrumb.data!.error = data.error.message;
          }

          client.addBreadcrumb(breadcrumb);
        });
        unsubscribers.push(unsubscribe);
      }

      // Instrument history
      if (historyOption && typeof history !== 'undefined' && typeof window !== 'undefined') {
        const unsubscribe = instrumentHistory((data) => {
          if (!client) return;

          const breadcrumb: Breadcrumb = {
            type: 'navigation',
            category: 'navigation',
            message: `Navigate from ${truncateUrl(data.from)} to ${truncateUrl(data.to)}`,
            level: 'info',
            timestamp: Date.now() / 1000,
            data: {
              from: data.from,
              to: data.to,
              navigation_type: data.navigationType,
            },
          };

          client.addBreadcrumb(breadcrumb);
        });
        unsubscribers.push(unsubscribe);
      }
    },

    teardown() {
      for (const unsubscribe of unsubscribers) {
        unsubscribe();
      }
      unsubscribers.length = 0;
      client = null;
    },
  };
}

/**
 * Map console method to severity level
 */
function mapConsoleLevel(method: string): SeverityLevel {
  switch (method) {
    case 'error':
    case 'assert':
      return 'error';
    case 'warn':
      return 'warning';
    case 'info':
      return 'info';
    case 'debug':
    case 'trace':
      return 'debug';
    default:
      return 'log';
  }
}

/**
 * Format console arguments to a string
 */
function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') return arg;
      if (typeof arg === 'number' || typeof arg === 'boolean') return String(arg);
      if (arg === null) return 'null';
      if (arg === undefined) return 'undefined';
      if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
      try {
        return JSON.stringify(arg, null, 0).substring(0, 200);
      } catch {
        return '[Object]';
      }
    })
    .join(' ');
}

/**
 * Truncate a URL for display
 */
function truncateUrl(url: string, maxLength: number = 100): string {
  if (url.length <= maxLength) return url;

  try {
    const parsed = new URL(url);
    // Keep protocol, host, and truncate path
    const base = `${parsed.protocol}//${parsed.host}`;
    const remaining = maxLength - base.length - 3;
    if (remaining > 0 && parsed.pathname.length > remaining) {
      return `${base}${parsed.pathname.substring(0, remaining)}...`;
    }
    return base + parsed.pathname;
  } catch {
    // Not a valid URL, just truncate
    return url.substring(0, maxLength - 3) + '...';
  }
}
