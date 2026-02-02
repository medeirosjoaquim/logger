/**
 * Browser Integration
 *
 * Captures unhandled errors and promise rejections in the browser.
 */

import type { Integration, IntegrationClient } from './types.js';
import type { EventProcessor } from '../types/scope.js';
import type { Event as SentryEvent, Mechanism } from '../types/sentry.js';

/**
 * Options for the browser integration
 */
export interface BrowserIntegrationOptions {
  /**
   * Whether to capture global errors (window.onerror)
   * @default true
   */
  onerror?: boolean;

  /**
   * Whether to capture unhandled promise rejections
   * @default true
   */
  onunhandledrejection?: boolean;
}

/**
 * Create the browser integration
 */
export function browserIntegration(options: BrowserIntegrationOptions = {}): Integration {
  const { onerror = true, onunhandledrejection = true } = options;

  let client: IntegrationClient | null = null;
  let originalOnerror: typeof window.onerror = null;
  let originalOnunhandledrejection: typeof window.onunhandledrejection = null;

  return {
    name: 'Browser',

    setupOnce(addGlobalEventProcessor: (processor: EventProcessor) => void) {
      // Add event processor to mark browser-captured errors
      addGlobalEventProcessor((event, hint) => {
        // Add browser context if not present
        if (!event.contexts) {
          event.contexts = {};
        }

        if (!event.contexts.browser && typeof navigator !== 'undefined') {
          event.contexts.browser = {
            name: getBrowserName(),
            version: getBrowserVersion(),
          };
        }

        // Add device context if not present
        if (!event.contexts.device && typeof navigator !== 'undefined') {
          event.contexts.device = {
            family: 'Desktop',
            screen_resolution: typeof screen !== 'undefined'
              ? `${screen.width}x${screen.height}`
              : undefined,
            orientation: typeof screen !== 'undefined' && screen.orientation
              ? screen.orientation.type.includes('landscape') ? 'landscape' : 'portrait'
              : undefined,
          };
        }

        return event;
      });
    },

    setup(c: IntegrationClient) {
      client = c;

      // Skip if not in browser environment
      if (typeof window === 'undefined') {
        return;
      }

      // Set up global error handler
      if (onerror) {
        originalOnerror = window.onerror;

        window.onerror = function (
          this: typeof globalThis,
          message: string | Event,
          source?: string,
          lineno?: number,
          colno?: number,
          error?: Error
        ): boolean {
          if (client) {
            const mechanism: Mechanism = {
              type: 'onerror',
              handled: false,
            };

            if (error) {
              client.captureException(error, {
                mechanism,
                data: { source, lineno, colno },
              });
            } else {
              // No error object - create synthetic event
              const syntheticError = new Error(String(message));
              syntheticError.name = 'Error';

              client.captureException(syntheticError, {
                mechanism,
                syntheticException: syntheticError,
                data: { source, lineno, colno },
              });
            }
          }

          // Call original handler
          if (originalOnerror) {
            return originalOnerror.call(this, message, source, lineno, colno, error) as boolean ?? false;
          }

          return false;
        } as OnErrorEventHandler;
      }

      // Set up unhandled rejection handler
      if (onunhandledrejection) {
        originalOnunhandledrejection = window.onunhandledrejection;

        window.onunhandledrejection = function (event: PromiseRejectionEvent) {
          if (client) {
            const mechanism: Mechanism = {
              type: 'onunhandledrejection',
              handled: false,
            };

            // Try to extract error from rejection reason
            let error: Error;
            if (event.reason instanceof Error) {
              error = event.reason;
            } else if (typeof event.reason === 'string') {
              error = new Error(event.reason);
              error.name = 'UnhandledRejection';
            } else {
              error = new Error('Non-Error promise rejection captured');
              error.name = 'UnhandledRejection';
            }

            client.captureException(error, {
              mechanism,
              originalException: event.reason,
              data: {
                rejectionReason: typeof event.reason === 'object'
                  ? JSON.stringify(event.reason)
                  : String(event.reason),
              },
            });
          }

          // Call original handler
          if (originalOnunhandledrejection) {
            return originalOnunhandledrejection.call(window, event);
          }
        };
      }
    },

    teardown() {
      if (typeof window !== 'undefined') {
        if (originalOnerror !== null) {
          window.onerror = originalOnerror;
          originalOnerror = null;
        }
        if (originalOnunhandledrejection !== null) {
          window.onunhandledrejection = originalOnunhandledrejection;
          originalOnunhandledrejection = null;
        }
      }
      client = null;
    },
  };
}

/**
 * Get browser name from user agent
 */
function getBrowserName(): string | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  const ua = navigator.userAgent;

  if (ua.includes('Firefox/')) return 'Firefox';
  if (ua.includes('Edg/')) return 'Edge';
  if (ua.includes('Chrome/')) return 'Chrome';
  if (ua.includes('Safari/') && !ua.includes('Chrome')) return 'Safari';
  if (ua.includes('Opera/') || ua.includes('OPR/')) return 'Opera';
  if (ua.includes('MSIE') || ua.includes('Trident/')) return 'Internet Explorer';

  return undefined;
}

/**
 * Get browser version from user agent
 */
function getBrowserVersion(): string | undefined {
  if (typeof navigator === 'undefined') {
    return undefined;
  }

  const ua = navigator.userAgent;

  // Try to extract version
  const patterns = [
    /Firefox\/(\d+(?:\.\d+)*)/,
    /Edg\/(\d+(?:\.\d+)*)/,
    /Chrome\/(\d+(?:\.\d+)*)/,
    /Version\/(\d+(?:\.\d+)*)/,
    /Safari\/(\d+(?:\.\d+)*)/,
    /OPR\/(\d+(?:\.\d+)*)/,
    /Opera\/(\d+(?:\.\d+)*)/,
    /MSIE (\d+(?:\.\d+)*)/,
    /rv:(\d+(?:\.\d+)*)/,
  ];

  for (const pattern of patterns) {
    const match = ua.match(pattern);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}
