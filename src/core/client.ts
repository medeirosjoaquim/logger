/**
 * UniversalClient Implementation
 *
 * The client is responsible for capturing events and managing the SDK lifecycle.
 * It implements the Sentry Client interface for compatibility.
 */

import type {
  Client,
  ClientOptions,
  Dsn,
  Event,
  EventHint,
  Integration,
  ScopeLike,
  Session,
  SeverityLevel,
  Transport,
} from '../types';
import type { StorageProvider } from '../storage/types';
import { EventPipeline, createDefaultPipeline } from './pipeline';
import { eventFromException, eventFromMessage } from './eventbuilder';
import { parseDsn, isValidDsn } from './dsn';
import { generateEventId, promiseWithTimeout } from './utils';

/**
 * Hook callback type.
 */
type HookCallback = (...args: unknown[]) => void;

/**
 * SDK information.
 */
const SDK_INFO = {
  name: 'universal-logger',
  version: '0.1.0',
};

/**
 * UniversalClient
 *
 * The main client implementation for the Universal Logger.
 * Manages event capture, integrations, and transport.
 *
 * @example
 * ```typescript
 * const client = new UniversalClient({
 *   dsn: 'https://abc@sentry.io/123',
 *   environment: 'production',
 * });
 *
 * client.captureException(new Error('Something went wrong'));
 * ```
 */
export class UniversalClient implements Client {
  private readonly _options: ClientOptions;
  private readonly _dsn: Dsn | undefined;
  private readonly _transport: Transport | undefined;
  private readonly _pipeline: EventPipeline;
  private readonly _integrations: Map<string, Integration> = new Map();
  private readonly _hooks: Map<string, Set<HookCallback>> = new Map();
  private readonly _storage: StorageProvider | null;

  private _enabled: boolean = true;
  private _closed: boolean = false;
  private _numProcessing: number = 0;

  /**
   * Creates a new UniversalClient.
   *
   * @param options - Client configuration options
   * @param storage - Optional storage provider
   */
  constructor(options: ClientOptions, storage: StorageProvider | null = null) {
    this._options = {
      // Defaults
      enabled: true,
      debug: false,
      sampleRate: 1.0,
      maxBreadcrumbs: 100,
      attachStacktrace: false,
      sendDefaultPii: false,
      autoSessionTracking: true,
      sendClientReports: true,
      maxValueLength: 250,
      normalizeDepth: 3,
      normalizeMaxBreadth: 1000,
      shutdownTimeout: 2000,
      // User options
      ...options,
    };

    this._storage = storage;
    this._enabled = this._options.enabled !== false;

    // Parse DSN if provided
    if (this._options.dsn && isValidDsn(this._options.dsn)) {
      try {
        this._dsn = parseDsn(this._options.dsn);
      } catch (error) {
        this.logDebug('Failed to parse DSN:', error);
      }
    }

    // Create the event pipeline
    this._pipeline = createDefaultPipeline(this._options, storage);

    // Setup integrations
    this._setupIntegrations();

    this.logDebug('Client initialized', { dsn: this._dsn?.projectId });
  }

  // =========================================================================
  // Client Interface Implementation
  // =========================================================================

  /**
   * Captures an exception and returns the event ID.
   *
   * @param exception - The exception to capture
   * @param hint - Optional event hint
   * @param scope - Optional scope to apply
   * @returns Event ID
   */
  captureException(
    exception: unknown,
    hint?: EventHint,
    scope?: ScopeLike
  ): string {
    if (!this._enabled || this._closed) {
      return '';
    }

    const eventId = hint?.event_id || generateEventId();
    const eventHint: EventHint = {
      ...hint,
      event_id: eventId,
      originalException: exception,
    };

    // Build the event
    const event = eventFromException(
      exception,
      eventHint,
      this._options.attachStacktrace !== false
    );

    // Apply SDK info
    event.sdk = SDK_INFO;

    // Apply release and environment from options
    if (this._options.release) {
      event.release = this._options.release;
    }
    if (this._options.environment) {
      event.environment = this._options.environment;
    }
    if (this._options.dist) {
      event.dist = this._options.dist;
    }
    if (this._options.serverName) {
      event.server_name = this._options.serverName;
    }

    // Process the event asynchronously
    this._processEvent(event, eventHint, scope);

    return eventId;
  }

  /**
   * Captures a message and returns the event ID.
   *
   * @param message - The message to capture
   * @param level - Severity level
   * @param hint - Optional event hint
   * @param scope - Optional scope to apply
   * @returns Event ID
   */
  captureMessage(
    message: string,
    level?: SeverityLevel,
    hint?: EventHint,
    scope?: ScopeLike
  ): string {
    if (!this._enabled || this._closed) {
      return '';
    }

    const eventId = hint?.event_id || generateEventId();
    const eventHint: EventHint = {
      ...hint,
      event_id: eventId,
    };

    // Build the event
    const event = eventFromMessage(
      message,
      level || 'info',
      eventHint,
      this._options.attachStacktrace === true
    );

    // Apply SDK info and options
    event.sdk = SDK_INFO;
    if (this._options.release) {
      event.release = this._options.release;
    }
    if (this._options.environment) {
      event.environment = this._options.environment;
    }
    if (this._options.dist) {
      event.dist = this._options.dist;
    }
    if (this._options.serverName) {
      event.server_name = this._options.serverName;
    }

    // Process the event asynchronously
    this._processEvent(event, eventHint, scope);

    return eventId;
  }

  /**
   * Captures a raw event and returns the event ID.
   *
   * @param event - The event to capture
   * @param hint - Optional event hint
   * @param scope - Optional scope to apply
   * @returns Event ID
   */
  captureEvent(event: Event, hint?: EventHint, scope?: ScopeLike): string {
    if (!this._enabled || this._closed) {
      return '';
    }

    const eventId = event.event_id || hint?.event_id || generateEventId();
    const eventHint: EventHint = {
      ...hint,
      event_id: eventId,
    };

    // Ensure event has an ID
    event.event_id = eventId;

    // Apply SDK info and options
    if (!event.sdk) {
      event.sdk = SDK_INFO;
    }
    if (!event.release && this._options.release) {
      event.release = this._options.release;
    }
    if (!event.environment && this._options.environment) {
      event.environment = this._options.environment;
    }
    if (!event.dist && this._options.dist) {
      event.dist = this._options.dist;
    }
    if (!event.server_name && this._options.serverName) {
      event.server_name = this._options.serverName;
    }

    // Process the event asynchronously
    this._processEvent(event, eventHint, scope);

    return eventId;
  }

  /**
   * Captures a session.
   *
   * @param session - The session to capture
   */
  captureSession(session: Session): void {
    if (!this._enabled || this._closed) {
      return;
    }

    // Emit session hook
    this.emit('captureSession', session);

    // Store session if storage is available
    if (this._storage) {
      // Session storage is handled by the session manager
      // This is a placeholder for transport
    }

    this.logDebug('Session captured', { sid: session.sid });
  }

  /**
   * Gets the client options.
   */
  getOptions(): ClientOptions {
    return this._options;
  }

  /**
   * Gets the parsed DSN.
   */
  getDsn(): Dsn | undefined {
    return this._dsn;
  }

  /**
   * Gets the transport instance.
   */
  getTransport(): Transport | undefined {
    return this._transport;
  }

  /**
   * Flushes pending events.
   *
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise resolving to true if flushed successfully
   */
  async flush(timeout?: number): Promise<boolean> {
    const timeoutMs = timeout ?? this._options.shutdownTimeout ?? 2000;

    this.emit('flush');

    // Wait for pending events to be processed
    const flushPromise = this._waitForProcessing();
    const result = await promiseWithTimeout(flushPromise, timeoutMs, false);

    // Flush transport if available
    if (this._transport) {
      await promiseWithTimeout(this._transport.flush(timeoutMs), timeoutMs, false);
    }

    return result;
  }

  /**
   * Closes the client and releases resources.
   *
   * @param timeout - Maximum time to wait in milliseconds
   * @returns Promise resolving to true if closed successfully
   */
  async close(timeout?: number): Promise<boolean> {
    if (this._closed) {
      return true;
    }

    this.emit('close');
    this._closed = true;
    this._enabled = false;

    // Flush pending events
    const flushed = await this.flush(timeout);

    // Close transport
    if (this._transport) {
      await this._transport.close?.(timeout);
    }

    // Close storage
    if (this._storage) {
      await this._storage.close();
    }

    // Teardown integrations
    this._teardownIntegrations();

    this.logDebug('Client closed');

    return flushed;
  }

  /**
   * Registers an event hook.
   *
   * @param hook - Hook name
   * @param callback - Callback function
   */
  on(hook: string, callback: HookCallback): void {
    if (!this._hooks.has(hook)) {
      this._hooks.set(hook, new Set());
    }
    this._hooks.get(hook)!.add(callback);
  }

  /**
   * Unregisters an event hook.
   *
   * @param hook - Hook name
   * @param callback - Callback function
   */
  off(hook: string, callback: HookCallback): void {
    this._hooks.get(hook)?.delete(callback);
  }

  /**
   * Emits an event hook.
   *
   * @param hook - Hook name
   * @param args - Arguments to pass to callbacks
   */
  emit(hook: string, ...args: unknown[]): void {
    const callbacks = this._hooks.get(hook);
    if (callbacks) {
      for (const callback of callbacks) {
        try {
          callback(...args);
        } catch (error) {
          this.logDebug('Hook callback error:', error);
        }
      }
    }
  }

  // =========================================================================
  // Integration Management
  // =========================================================================

  /**
   * Adds an integration.
   *
   * @param integration - Integration to add
   */
  addIntegration(integration: Integration): void {
    if (this._integrations.has(integration.name)) {
      this.logDebug(`Integration ${integration.name} already registered`);
      return;
    }

    this._integrations.set(integration.name, integration);

    // Setup the integration
    if (integration.setup) {
      try {
        integration.setup(this);
      } catch (error) {
        this.logDebug(`Integration ${integration.name} setup failed:`, error);
      }
    }

    this.logDebug(`Integration ${integration.name} added`);
  }

  /**
   * Gets an integration by name.
   *
   * @param name - Integration name
   * @returns Integration or null if not found
   */
  getIntegration<T extends Integration>(name: string): T | null {
    return (this._integrations.get(name) as T) || null;
  }

  /**
   * Gets all integrations.
   */
  getIntegrations(): Integration[] {
    return Array.from(this._integrations.values());
  }

  // =========================================================================
  // Pipeline and Event Processor Management
  // =========================================================================

  /**
   * Adds an event processor to the pipeline.
   *
   * @param processor - Event processor function
   */
  addEventProcessor(processor: import('../types').EventProcessor): void {
    this._pipeline.addEventProcessor(processor);
  }

  /**
   * Gets the event pipeline.
   */
  getPipeline(): EventPipeline {
    return this._pipeline;
  }

  // =========================================================================
  // Private Methods
  // =========================================================================

  /**
   * Processes an event through the pipeline.
   */
  private async _processEvent(
    event: Event,
    hint: EventHint,
    scope?: ScopeLike
  ): Promise<void> {
    this._numProcessing++;

    try {
      // Let integrations preprocess the event
      for (const integration of this._integrations.values()) {
        if (integration.preprocessEvent) {
          try {
            integration.preprocessEvent(event, hint, this);
          } catch (error) {
            this.logDebug(`Integration ${integration.name} preprocessEvent failed:`, error);
          }
        }
      }

      // Process through pipeline
      const result = await this._pipeline.processEvent(event, hint, scope);

      if (result.event) {
        this.emit('afterSendEvent', result.event, hint);
        this.logDebug('Event processed', { eventId: result.event.event_id });
      } else {
        this.logDebug('Event dropped', { reason: result.reason, details: result.details });
      }
    } catch (error) {
      this.logDebug('Event processing failed:', error);
    } finally {
      this._numProcessing--;
    }
  }

  /**
   * Waits for all pending events to be processed.
   */
  private async _waitForProcessing(): Promise<boolean> {
    // Simple polling implementation
    const maxWait = 100; // 100 iterations
    let iterations = 0;

    while (this._numProcessing > 0 && iterations < maxWait) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      iterations++;
    }

    return this._numProcessing === 0;
  }

  /**
   * Sets up integrations from options.
   */
  private _setupIntegrations(): void {
    const integrations = this._options.integrations || [];

    for (const integration of integrations) {
      this.addIntegration(integration);
    }

    // Call afterAllSetup on all integrations
    for (const integration of this._integrations.values()) {
      if (integration.afterAllSetup) {
        try {
          integration.afterAllSetup(this);
        } catch (error) {
          this.logDebug(`Integration ${integration.name} afterAllSetup failed:`, error);
        }
      }
    }
  }

  /**
   * Tears down all integrations.
   */
  private _teardownIntegrations(): void {
    // Integrations don't have a teardown method in the interface,
    // but we clear the map
    this._integrations.clear();
  }

  /**
   * Logs debug messages if debug mode is enabled.
   */
  private logDebug(...args: unknown[]): void {
    if (this._options.debug) {
      console.debug('[UniversalClient]', ...args);
    }
  }
}

/**
 * Creates a new client with the given options.
 *
 * @param options - Client options
 * @param storage - Optional storage provider
 * @returns New client instance
 */
export function createClient(
  options: ClientOptions,
  storage: StorageProvider | null = null
): UniversalClient {
  return new UniversalClient(options, storage);
}
