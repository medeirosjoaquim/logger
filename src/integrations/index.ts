/**
 * Integrations Module
 *
 * Exports all built-in integrations for extending logger functionality.
 * Sentry-compatible integration API.
 */

// Re-export from separate integration files
export {
  browserIntegration,
  type BrowserIntegrationOptions,
} from './browser.js';

export {
  httpIntegration,
  type HttpIntegrationOptions,
} from './http.js';

export {
  breadcrumbsIntegration,
  type BreadcrumbsIntegrationOptions,
} from './breadcrumbs.js';

export {
  tryCatchIntegration,
  type TryCatchIntegrationOptions,
} from './trycatch.js';

export {
  getDefaultIntegrations,
  getDefaultIntegrationsWithOptions,
  filterIntegrations,
  removeIntegrations,
  addIntegrations,
  mergeIntegrations,
  hasIntegration,
  getIntegration,
} from './defaults.js';

// Re-export registry utilities
export {
  IntegrationRegistry,
  createIntegrationRegistry,
  getGlobalRegistry,
  resetGlobalRegistry,
} from './registry.js';

// Re-export types from local types
export type {
  Integration,
  IntegrationFn,
  IntegrationClass,
  IntegrationClient,
  IntegrationClientOptions,
  IntegrationSetupOptions,
  InstrumentHandler,
  ConsoleInstrumentData,
  FetchInstrumentData,
  XHRInstrumentData,
  DOMInstrumentData,
  HistoryInstrumentData,
  ErrorInstrumentData,
  UnhandledRejectionInstrumentData,
} from './types.js';

// Re-export instrumentation utilities
export {
  instrumentConsole,
  instrumentFetch,
  instrumentXHR,
  instrumentDOM,
  instrumentHistory,
  instrumentError,
  instrumentUnhandledRejection,
  restoreAll,
} from './instrument.js';

// Re-export types from main types module
export type {
  Integration as SentryIntegration,
  IntegrationFn as SentryIntegrationFn,
  IntegrationClass as SentryIntegrationClass,
  BreadcrumbsIntegrationOptions as SentryBreadcrumbsOptions,
  HttpIntegrationOptions as SentryHttpOptions,
  DefaultIntegrationsOptions,
  GlobalHandlersOptions,
  LinkedErrorsOptions,
  InboundFiltersOptions,
  ConsoleIntegrationOptions,
} from '../types/integration.js';

import type { Integration, IntegrationClient } from './types.js';
import type { Client } from '../types/client.js';
import type { EventProcessor } from '../types/scope.js';
import type { Event, EventHint } from '../types/sentry.js';

// ============================================
// Integration Utilities
// ============================================

/**
 * Setup integrations on a client
 *
 * @param client - The client to set up integrations on
 * @param integrations - The integrations to set up
 */
export function setupIntegrations(client: Client | IntegrationClient, integrations: Integration[]): void {
  for (const integration of integrations) {
    try {
      if (integration.setup) {
        integration.setup(client as IntegrationClient);
      }
    } catch (error) {
      // Log error but don't break other integrations
      if (typeof console !== 'undefined') {
        console.error(`Error setting up integration ${integration.name}:`, error);
      }
    }
  }
}

/**
 * Run setupOnce for all integrations
 *
 * @param integrations - The integrations to initialize
 * @param addGlobalEventProcessor - Function to add global event processors
 */
export function initializeIntegrations(
  integrations: Integration[],
  addGlobalEventProcessor: (processor: EventProcessor) => void
): void {
  for (const integration of integrations) {
    try {
      if (integration.setupOnce) {
        integration.setupOnce(addGlobalEventProcessor);
      }
    } catch (error) {
      // Log error but don't break other integrations
      if (typeof console !== 'undefined') {
        console.error(`Error initializing integration ${integration.name}:`, error);
      }
    }
  }
}

/**
 * Teardown all integrations
 *
 * @param integrations - The integrations to teardown
 */
export function teardownIntegrations(integrations: Integration[]): void {
  for (const integration of integrations) {
    try {
      if (integration.teardown) {
        integration.teardown();
      }
    } catch (error) {
      // Log error but don't break other integrations
      if (typeof console !== 'undefined') {
        console.error(`Error tearing down integration ${integration.name}:`, error);
      }
    }
  }
}

/**
 * Get an integration by name from an array
 *
 * @param integrations - The integrations array
 * @param name - The integration name
 * @returns The integration or undefined
 */
export function getIntegrationByName(
  integrations: Integration[],
  name: string
): Integration | undefined {
  return integrations.find((i) => i.name === name);
}

/**
 * Add an integration to an existing array, replacing any with the same name
 *
 * @param integrations - The existing integrations
 * @param integration - The integration to add
 * @returns New integrations array
 */
export function addIntegration(
  integrations: Integration[],
  integration: Integration
): Integration[] {
  const filtered = integrations.filter((i) => i.name !== integration.name);
  return [...filtered, integration];
}

/**
 * Process an event through all integrations
 *
 * @param event - The event to process
 * @param hint - Event hint
 * @param client - The client
 * @param integrations - The integrations to run
 * @returns Processed event or null if dropped
 */
export async function processEventThroughIntegrations(
  event: Event,
  hint: EventHint,
  client: IntegrationClient,
  integrations: Integration[]
): Promise<Event | null> {
  let processedEvent: Event | null = event;

  // Run preprocessEvent on all integrations
  for (const integration of integrations) {
    if (integration.preprocessEvent && processedEvent) {
      try {
        integration.preprocessEvent(processedEvent, hint, client);
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.error(`Error in preprocessEvent for integration ${integration.name}:`, error);
        }
      }
    }
  }

  // Run processEvent on all integrations
  for (const integration of integrations) {
    if (!processedEvent) {
      break;
    }
    if (integration.processEvent) {
      try {
        const result = integration.processEvent(processedEvent, hint, client);
        processedEvent = result instanceof Promise ? await result : result;
      } catch (error) {
        if (typeof console !== 'undefined') {
          console.error(`Error in processEvent for integration ${integration.name}:`, error);
        }
      }
    }
  }

  return processedEvent;
}
