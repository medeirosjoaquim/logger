/**
 * Integration System Type Definitions
 *
 * Types for the integration system that allows extending logger functionality.
 */

import type { Event as SentryEvent, EventHint, Breadcrumb } from '../types/sentry.js';
import type { EventProcessor } from '../types/scope.js';

/**
 * Client interface for integrations
 * Minimal interface that integrations need to interact with the client
 */
export interface IntegrationClient {
  /**
   * Get client options
   */
  getOptions(): IntegrationClientOptions;

  /**
   * Capture an exception
   */
  captureException(exception: unknown, hint?: EventHint): string;

  /**
   * Capture a message
   */
  captureMessage(message: string, level?: string): string;

  /**
   * Add a breadcrumb
   */
  addBreadcrumb(breadcrumb: Breadcrumb): void;

  /**
   * Get the DSN
   */
  getDsn(): string | undefined;
}

/**
 * Client options relevant to integrations
 */
export interface IntegrationClientOptions {
  /**
   * The DSN to use
   */
  dsn?: string;

  /**
   * Whether the SDK is enabled
   */
  enabled?: boolean;

  /**
   * Whether debug mode is enabled
   */
  debug?: boolean;

  /**
   * Default integrations to use
   */
  defaultIntegrations?: Integration[] | false;

  /**
   * Additional integrations to use
   */
  integrations?: Integration[] | ((integrations: Integration[]) => Integration[]);

  /**
   * Environment name
   */
  environment?: string;

  /**
   * Release version
   */
  release?: string;

  /**
   * Stack trace limit
   */
  stackTraceLimit?: number;

  /**
   * Maximum breadcrumbs to keep
   */
  maxBreadcrumbs?: number;

  /**
   * Sample rate for events (0.0 to 1.0)
   */
  sampleRate?: number;

  /**
   * Sample rate for traces (0.0 to 1.0)
   */
  tracesSampleRate?: number;

  /**
   * URLs to attach tracing headers to
   */
  tracePropagationTargets?: (string | RegExp)[];

  /**
   * Whether to send default PII (personally identifiable information)
   */
  sendDefaultPii?: boolean;

  /**
   * Initial scope data
   */
  initialScope?: Record<string, unknown>;

  /**
   * Normalization depth
   */
  normalizeDepth?: number;
}

/**
 * Integration interface
 *
 * Integrations can hook into various parts of the SDK lifecycle
 * to add functionality like automatic error capturing, breadcrumbs, etc.
 */
export interface Integration {
  /**
   * Unique name for this integration
   */
  name: string;

  /**
   * Called once when the SDK is initialized
   * Use this to set up global handlers that should only be registered once
   *
   * @param addGlobalEventProcessor Function to add a global event processor
   */
  setupOnce?(addGlobalEventProcessor: (processor: EventProcessor) => void): void;

  /**
   * Called when the integration is set up on a client
   * Use this for client-specific setup
   *
   * @param client The client this integration is being set up on
   */
  setup?(client: IntegrationClient): void;

  /**
   * Called before an event is sent
   * Can modify the event or return null to drop it
   *
   * @param event The event to process
   * @param hint Additional information about the event
   * @param client The client sending the event
   * @returns Modified event, null to drop, or a promise
   */
  processEvent?(
    event: SentryEvent,
    hint: EventHint,
    client: IntegrationClient
  ): SentryEvent | null | Promise<SentryEvent | null>;

  /**
   * Called before processEvent to set up the event
   * Use this for modifications that don't need async
   *
   * @param event The event to preprocess
   * @param hint Additional information about the event
   * @param client The client sending the event
   */
  preprocessEvent?(event: SentryEvent, hint: EventHint, client: IntegrationClient): void;

  /**
   * Called when the integration should be torn down
   * Clean up any resources or listeners
   */
  teardown?(): void;
}

/**
 * Integration factory function type
 * Returns an integration, optionally accepting configuration
 */
export type IntegrationFn<T extends unknown[] = unknown[]> = (...args: T) => Integration;

/**
 * Integration class constructor type
 */
export type IntegrationClass<T extends Integration = Integration> = new (
  ...args: unknown[]
) => T;

/**
 * Options for integration setup
 */
export interface IntegrationSetupOptions {
  /**
   * Whether to call setupOnce
   */
  callSetupOnce?: boolean;

  /**
   * Whether to call setup
   */
  callSetup?: boolean;
}

/**
 * Instrumentation handler function type
 * Called when instrumented functionality is triggered
 */
export type InstrumentHandler<T = unknown> = (data: T) => void;

/**
 * Data passed to console instrument handlers
 */
export interface ConsoleInstrumentData {
  /**
   * Console method called
   */
  method: 'log' | 'warn' | 'error' | 'info' | 'debug' | 'assert' | 'trace';

  /**
   * Arguments passed to the console method
   */
  args: unknown[];
}

/**
 * Data passed to fetch instrument handlers
 */
export interface FetchInstrumentData {
  /**
   * Request URL
   */
  url: string;

  /**
   * Request method
   */
  method: string;

  /**
   * Request headers
   */
  requestHeaders?: Record<string, string>;

  /**
   * Response status code
   */
  statusCode?: number;

  /**
   * Response headers
   */
  responseHeaders?: Record<string, string | null>;

  /**
   * Error if the request failed
   */
  error?: Error;

  /**
   * Start timestamp
   */
  startTimestamp: number;

  /**
   * End timestamp
   */
  endTimestamp?: number;
}

/**
 * Data passed to XHR instrument handlers
 */
export interface XHRInstrumentData {
  /**
   * Request URL
   */
  url: string;

  /**
   * Request method
   */
  method: string;

  /**
   * Response status code
   */
  statusCode?: number;

  /**
   * Response status text
   */
  statusText?: string;

  /**
   * Error if the request failed
   */
  error?: Error;

  /**
   * Start timestamp
   */
  startTimestamp: number;

  /**
   * End timestamp
   */
  endTimestamp?: number;

  /**
   * The XHR object
   */
  xhr?: XMLHttpRequest;
}

/**
 * Data passed to DOM event instrument handlers
 */
export interface DOMInstrumentData {
  /**
   * Event type
   */
  eventType: string;

  /**
   * Event target
   */
  target: EventTarget | null;

  /**
   * Target element tag name
   */
  tagName?: string;

  /**
   * Target element ID
   */
  elementId?: string;

  /**
   * Target element class name
   */
  className?: string;

  /**
   * Target element inner text (truncated)
   */
  innerText?: string;

  /**
   * DOM Event object (not Sentry Event)
   */
  event: globalThis.Event;
}

/**
 * Data passed to history instrument handlers
 */
export interface HistoryInstrumentData {
  /**
   * Previous URL
   */
  from: string;

  /**
   * New URL
   */
  to: string;

  /**
   * Navigation type
   */
  navigationType: 'pushState' | 'replaceState' | 'popstate';
}

/**
 * Data passed to error instrument handlers
 */
export interface ErrorInstrumentData {
  /**
   * Error message
   */
  message: string;

  /**
   * Source URL
   */
  source?: string;

  /**
   * Line number
   */
  lineno?: number;

  /**
   * Column number
   */
  colno?: number;

  /**
   * Error object
   */
  error?: Error;

  /**
   * Original event
   */
  event: ErrorEvent | globalThis.Event;
}

/**
 * Data passed to unhandled rejection instrument handlers
 */
export interface UnhandledRejectionInstrumentData {
  /**
   * Rejection reason
   */
  reason: unknown;

  /**
   * Original event
   */
  event: PromiseRejectionEvent;
}
