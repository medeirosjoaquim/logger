/**
 * Integration Registry
 *
 * Manages registration and lifecycle of integrations.
 */

import type { Event, EventHint } from '../types/sentry.js';
import type { EventProcessor } from '../types/scope.js';
import type { Integration, IntegrationClient, IntegrationSetupOptions } from './types.js';

/**
 * IntegrationRegistry class for managing integrations
 */
export class IntegrationRegistry {
  /**
   * Map of integration name to integration instance
   */
  private integrations: Map<string, Integration> = new Map();

  /**
   * Global event processors added by integrations
   */
  private globalEventProcessors: EventProcessor[] = [];

  /**
   * Whether setupOnce has been called
   */
  private setupComplete: boolean = false;

  /**
   * Whether the registry is initialized
   */
  private initialized: boolean = false;

  /**
   * Register an integration
   *
   * @param integration The integration to register
   */
  register(integration: Integration): void {
    if (this.integrations.has(integration.name)) {
      // Integration already registered - skip
      return;
    }

    this.integrations.set(integration.name, integration);
  }

  /**
   * Register multiple integrations
   *
   * @param integrations The integrations to register
   */
  registerAll(integrations: Integration[]): void {
    for (const integration of integrations) {
      this.register(integration);
    }
  }

  /**
   * Get an integration by name
   *
   * @param name The integration name
   * @returns The integration or undefined if not found
   */
  get(name: string): Integration | undefined {
    return this.integrations.get(name);
  }

  /**
   * Check if an integration is registered
   *
   * @param name The integration name
   * @returns True if registered
   */
  has(name: string): boolean {
    return this.integrations.has(name);
  }

  /**
   * Get all registered integrations
   *
   * @returns Array of all integrations
   */
  getAll(): Integration[] {
    return Array.from(this.integrations.values());
  }

  /**
   * Get all integration names
   *
   * @returns Array of integration names
   */
  getNames(): string[] {
    return Array.from(this.integrations.keys());
  }

  /**
   * Remove an integration
   *
   * @param name The integration name
   */
  remove(name: string): void {
    const integration = this.integrations.get(name);
    if (integration?.teardown) {
      integration.teardown();
    }
    this.integrations.delete(name);
  }

  /**
   * Clear all integrations
   */
  clear(): void {
    for (const integration of this.integrations.values()) {
      if (integration.teardown) {
        integration.teardown();
      }
    }
    this.integrations.clear();
    this.globalEventProcessors = [];
    this.setupComplete = false;
    this.initialized = false;
  }

  /**
   * Set up all integrations for a client
   *
   * @param client The client to set up integrations for
   * @param options Setup options
   */
  setupIntegrations(client: IntegrationClient, options: IntegrationSetupOptions = {}): void {
    const { callSetupOnce = true, callSetup = true } = options;

    // Call setupOnce for each integration (only once globally)
    if (callSetupOnce && !this.setupComplete) {
      for (const integration of this.integrations.values()) {
        if (integration.setupOnce) {
          try {
            integration.setupOnce(this.addGlobalEventProcessor.bind(this));
          } catch (error) {
            console.error(`Error in setupOnce for integration ${integration.name}:`, error);
          }
        }
      }
      this.setupComplete = true;
    }

    // Call setup for each integration
    if (callSetup) {
      for (const integration of this.integrations.values()) {
        if (integration.setup) {
          try {
            integration.setup(client);
          } catch (error) {
            console.error(`Error in setup for integration ${integration.name}:`, error);
          }
        }
      }
    }

    this.initialized = true;
  }

  /**
   * Check if integrations are set up
   */
  isSetup(): boolean {
    return this.initialized;
  }

  /**
   * Add a global event processor
   *
   * @param processor The event processor to add
   */
  addGlobalEventProcessor(processor: EventProcessor): void {
    this.globalEventProcessors.push(processor);
  }

  /**
   * Get all global event processors
   *
   * @returns Array of event processors
   */
  getGlobalEventProcessors(): EventProcessor[] {
    return [...this.globalEventProcessors];
  }

  /**
   * Process an event through all integrations
   *
   * @param event The event to process
   * @param hint Event hint
   * @param client The client
   * @returns Processed event or null if dropped
   */
  async processEvent(
    event: Event,
    hint: EventHint,
    client: IntegrationClient
  ): Promise<Event | null> {
    let processedEvent: Event | null = event;

    // First, call preprocessEvent on all integrations
    for (const integration of this.integrations.values()) {
      if (integration.preprocessEvent && processedEvent) {
        try {
          integration.preprocessEvent(processedEvent, hint, client);
        } catch (error) {
          console.error(`Error in preprocessEvent for integration ${integration.name}:`, error);
        }
      }
    }

    // Then, run through global event processors
    for (const processor of this.globalEventProcessors) {
      if (!processedEvent) {
        break;
      }
      try {
        const result = processor(processedEvent, hint);
        processedEvent = result instanceof Promise ? await result : result;
      } catch (error) {
        console.error('Error in global event processor:', error);
      }
    }

    // Finally, call processEvent on all integrations
    for (const integration of this.integrations.values()) {
      if (!processedEvent) {
        break;
      }
      if (integration.processEvent) {
        try {
          const result = integration.processEvent(processedEvent, hint, client);
          processedEvent = result instanceof Promise ? await result : result;
        } catch (error) {
          console.error(`Error in processEvent for integration ${integration.name}:`, error);
        }
      }
    }

    return processedEvent;
  }

  /**
   * Tear down all integrations
   */
  teardown(): void {
    for (const integration of this.integrations.values()) {
      if (integration.teardown) {
        try {
          integration.teardown();
        } catch (error) {
          console.error(`Error in teardown for integration ${integration.name}:`, error);
        }
      }
    }
  }
}

/**
 * Create a new integration registry
 */
export function createIntegrationRegistry(): IntegrationRegistry {
  return new IntegrationRegistry();
}

/**
 * Global integration registry instance
 */
let globalRegistry: IntegrationRegistry | null = null;

/**
 * Get or create the global integration registry
 */
export function getGlobalRegistry(): IntegrationRegistry {
  if (!globalRegistry) {
    globalRegistry = new IntegrationRegistry();
  }
  return globalRegistry;
}

/**
 * Reset the global integration registry
 * Used primarily for testing
 */
export function resetGlobalRegistry(): void {
  if (globalRegistry) {
    globalRegistry.clear();
    globalRegistry = null;
  }
}
