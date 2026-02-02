/**
 * Integration-related type definitions
 * Integrations extend Sentry functionality
 */

import type { Client } from './client';
import type { Event, EventHint } from './sentry';

/**
 * Integration interface for extending Sentry functionality.
 * Integrations can hook into event processing and add automatic instrumentation.
 */
export interface Integration {
  /**
   * Unique name for this integration.
   * Used to identify and deduplicate integrations.
   */
  name: string;

  /**
   * Called once when the SDK is initialized.
   * Use this for one-time setup that applies globally.
   *
   * @param addGlobalEventProcessor - Function to add a global event processor
   * @deprecated Use `setup` instead for SDK v8+
   */
  setupOnce?(
    addGlobalEventProcessor: (processor: EventProcessor) => void,
    getCurrentHub?: () => unknown
  ): void;

  /**
   * Called when the integration is added to a client.
   * Use this for per-client setup.
   *
   * @param client - The client instance
   */
  setup?(client: Client): void;

  /**
   * Process an event before it's sent.
   * Can modify the event or return null to drop it.
   *
   * @param event - The event to process
   * @param hint - Additional event context
   * @param client - The client instance
   * @returns Modified event, null to drop, or promise
   */
  processEvent?(
    event: Event,
    hint: EventHint,
    client: Client
  ): Event | null | PromiseLike<Event | null>;

  /**
   * Pre-process an event before other processing.
   * Runs before `processEvent` and event processors.
   *
   * @param event - The event to pre-process
   * @param hint - Additional event context
   * @param client - The client instance
   */
  preprocessEvent?(event: Event, hint: EventHint, client: Client): void;

  /**
   * Called after the integration has been set up.
   * Use this for initialization that requires the client to be ready.
   *
   * @param client - The client instance
   */
  afterAllSetup?(client: Client): void;
}

/**
 * Event processor function type.
 */
export type EventProcessor = (
  event: Event,
  hint: EventHint
) => Event | null | PromiseLike<Event | null>;

/**
 * Factory function type for creating integrations.
 * Allows parameterized integration creation.
 */
export type IntegrationFn<T extends Integration = Integration> = (
  ...args: unknown[]
) => T;

/**
 * Integration class constructor type.
 */
export interface IntegrationClass<T extends Integration = Integration> {
  /**
   * Static integration name.
   */
  id: string;

  /**
   * Construct a new integration instance.
   */
  new (...args: unknown[]): T;
}

/**
 * Options for default integrations.
 */
export interface DefaultIntegrationsOptions {
  /**
   * Whether to include the console integration.
   */
  console?: boolean;

  /**
   * Whether to include the HTTP integration.
   */
  http?: boolean;

  /**
   * Whether to include the breadcrumbs integration.
   */
  breadcrumbs?: boolean;

  /**
   * Whether to include the global error handler integration.
   */
  globalHandlers?: boolean;

  /**
   * Whether to include the linked errors integration.
   */
  linkedErrors?: boolean;

  /**
   * Whether to include the dedupe integration.
   */
  dedupe?: boolean;

  /**
   * Whether to include the function name integration.
   */
  functionToString?: boolean;

  /**
   * Whether to include the inbound filters integration.
   */
  inboundFilters?: boolean;
}

/**
 * Options for the inbound filters integration.
 */
export interface InboundFiltersOptions {
  /**
   * Patterns for error messages to ignore.
   */
  ignoreErrors?: Array<string | RegExp>;

  /**
   * Patterns for transaction names to ignore.
   */
  ignoreTransactions?: Array<string | RegExp>;

  /**
   * Patterns for URLs to ignore.
   */
  denyUrls?: Array<string | RegExp>;

  /**
   * Patterns for URLs to allow (overrides denyUrls).
   */
  allowUrls?: Array<string | RegExp>;

  /**
   * Whether to ignore internal errors.
   */
  ignoreInternal?: boolean;

  /**
   * Whether to disable default filters.
   */
  disableErrorDefaults?: boolean;
}

/**
 * Options for the breadcrumbs integration.
 */
export interface BreadcrumbsIntegrationOptions {
  /**
   * Whether to capture console logs as breadcrumbs.
   */
  console?: boolean;

  /**
   * Whether to capture DOM events as breadcrumbs.
   */
  dom?:
    | boolean
    | {
        /**
         * Max string length for serialized attributes.
         */
        serializeAttribute?: string[] | number;
        /**
         * Max string length for serialized data.
         */
        maxStringLength?: number;
      };

  /**
   * Whether to capture fetch requests as breadcrumbs.
   */
  fetch?: boolean;

  /**
   * Whether to capture history changes as breadcrumbs.
   */
  history?: boolean;

  /**
   * Whether to capture sentry events as breadcrumbs.
   */
  sentry?: boolean;

  /**
   * Whether to capture XHR requests as breadcrumbs.
   */
  xhr?: boolean;
}

/**
 * Options for the linked errors integration.
 */
export interface LinkedErrorsOptions {
  /**
   * Key to use for finding the linked error.
   * @default 'cause'
   */
  key?: string;

  /**
   * Maximum depth to follow error chain.
   * @default 5
   */
  limit?: number;
}

/**
 * Options for the global handlers integration.
 */
export interface GlobalHandlersOptions {
  /**
   * Whether to capture onerror events.
   */
  onerror?: boolean;

  /**
   * Whether to capture onunhandledrejection events.
   */
  onunhandledrejection?: boolean;
}

/**
 * Options for the HTTP integration.
 */
export interface HttpIntegrationOptions {
  /**
   * Whether to trace outgoing HTTP requests.
   */
  tracing?: boolean;

  /**
   * Whether to capture breadcrumbs for HTTP requests.
   */
  breadcrumbs?: boolean;

  /**
   * URLs to trace.
   */
  tracingOrigins?: Array<string | RegExp>;

  /**
   * Whether to propagate trace headers.
   */
  tracePropagationTargets?: Array<string | RegExp>;
}

/**
 * Options for the console integration.
 */
export interface ConsoleIntegrationOptions {
  /**
   * Console methods to wrap.
   */
  levels?: Array<'log' | 'info' | 'warn' | 'error' | 'debug' | 'assert'>;
}

/**
 * Integration index signature for storing integrations by name.
 */
export type IntegrationIndex = Record<string, Integration>;

/**
 * Function to get the default integrations.
 */
export type GetDefaultIntegrations = (options?: DefaultIntegrationsOptions) => Integration[];

/**
 * Options for adding integrations.
 */
export interface AddIntegrationOptions {
  /**
   * Array of integrations to add.
   */
  integrations?: Integration[] | IntegrationFn[];

  /**
   * Default integrations to use.
   */
  defaultIntegrations?: Integration[] | false;
}

/**
 * Result of getting installed integrations.
 */
export interface InstalledIntegrations {
  /**
   * Map of integration name to integration instance.
   */
  [key: string]: Integration;
}
