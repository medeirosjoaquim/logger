/**
 * Universal Logger
 *
 * Main logger class that provides Sentry-compatible API with local storage support.
 * Implements singleton pattern for global access.
 */

import type {
  Event,
  EventHint,
  Breadcrumb,
  BreadcrumbHint,
  User,
  SeverityLevel,
  CaptureContext,
} from '../types/sentry.js';
import type { Client, ClientOptions } from '../types/client.js';
import type { Integration } from '../types/integration.js';
import type { StorageProvider, LogEntry, SentryEvent, LogFilter, SentryEventFilter } from '../storage/types.js';
import type { Scope } from '../scope/scope.js';
import type { InitOptions } from '../types/options.js';

import { Scope as ScopeClass } from '../scope/scope.js';
import { ScopeManager, getDefaultScopeManager } from '../scope/scopeManager.js';
import { captureException as buildException } from './capture/exception.js';
import { captureMessage as buildMessage } from './capture/message.js';
import { captureEvent as buildEvent } from './capture/event.js';
import { createStorageProvider, MemoryStorageProvider } from '../storage/index.js';
import { generateEventId } from '../tracing/idGenerator.js';

/**
 * Configuration for the Universal Logger
 */
export interface UniversalLoggerConfig {
  /** Operating mode */
  mode: 'standalone' | 'proxy' | 'hybrid';
  /** Storage provider type or instance */
  storage: 'memory' | 'indexeddb' | StorageProvider;
  /** Sentry configuration (for proxy/hybrid mode) */
  sentry?: {
    dsn: string;
    options?: Partial<InitOptions>;
  };
}

/**
 * Universal Logger class
 *
 * Provides a Sentry-compatible logging interface with local storage support.
 * Can operate in standalone mode (local only), proxy mode (forward to Sentry),
 * or hybrid mode (local storage + Sentry forwarding).
 */
export class UniversalLogger {
  private static _instance: UniversalLogger | undefined;

  private _initialized = false;
  private _enabled = true;
  private _options: InitOptions = {};
  private _scopeManager: ScopeManager;
  private _storage: StorageProvider | undefined;
  private _integrations: Integration[] = [];
  private _lastEventId: string | undefined;
  private _client: Client | undefined;

  private constructor() {
    this._scopeManager = getDefaultScopeManager();
  }

  /**
   * Get the singleton instance
   */
  static getInstance(): UniversalLogger {
    if (!UniversalLogger._instance) {
      UniversalLogger._instance = new UniversalLogger();
    }
    return UniversalLogger._instance;
  }

  /**
   * Reset the singleton instance (for testing)
   */
  static resetInstance(): void {
    if (UniversalLogger._instance) {
      UniversalLogger._instance.close();
      UniversalLogger._instance = undefined;
    }
  }

  // ============================================
  // Initialization
  // ============================================

  /**
   * Initialize the logger with options
   */
  async init(options: InitOptions): Promise<void> {
    if (this._initialized) {
      console.warn('Logger already initialized. Call close() first to reinitialize.');
      return;
    }

    this._options = { ...options };
    this._enabled = options.enabled !== false;

    // Setup storage
    const storageType = options._experiments?.storage as string || 'memory';
    if (typeof storageType === 'string') {
      this._storage = createStorageProvider(storageType as 'memory' | 'indexeddb');
    } else if (storageType && typeof storageType === 'object') {
      this._storage = storageType as StorageProvider;
    } else {
      this._storage = new MemoryStorageProvider();
    }

    await this._storage.init();

    // Setup integrations
    if (Array.isArray(options.integrations)) {
      this._integrations = options.integrations;
    } else if (typeof options.integrations === 'function') {
      const defaultIntegrations = options.defaultIntegrations === false
        ? []
        : (Array.isArray(options.defaultIntegrations) ? options.defaultIntegrations : []);
      this._integrations = options.integrations(defaultIntegrations);
    }

    // Apply initial scope
    if (options.initialScope) {
      const scope = this.getCurrentScope();
      if (typeof options.initialScope === 'function') {
        const result = options.initialScope({} as Record<string, unknown>);
        if (result.tags) scope.setTags(result.tags as Record<string, string>);
        if (result.user) scope.setUser(result.user as User);
      } else {
        const initial = options.initialScope;
        if (initial.tags) scope.setTags(initial.tags as Record<string, string>);
        if (initial.user) scope.setUser(initial.user as User);
      }
    }

    this._initialized = true;
  }

  /**
   * Check if the logger is initialized
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Check if the logger is enabled
   */
  isEnabled(): boolean {
    return this._enabled && this._initialized;
  }

  // ============================================
  // Client Access
  // ============================================

  /**
   * Get the current client
   */
  getClient(): Client | undefined {
    return this._client;
  }

  // ============================================
  // Scope Management
  // ============================================

  /**
   * Get the current scope
   */
  getCurrentScope(): Scope {
    return this._scopeManager.getCurrentScope() as unknown as Scope;
  }

  /**
   * Get the isolation scope
   */
  getIsolationScope(): Scope {
    return this._scopeManager.getIsolationScope() as unknown as Scope;
  }

  /**
   * Get the global scope
   */
  getGlobalScope(): Scope {
    return this._scopeManager.getGlobalScope() as unknown as Scope;
  }

  /**
   * Run a callback with a new scope
   */
  withScope<T>(callback: (scope: Scope) => T): T {
    return this._scopeManager.withScope((scope) => callback(scope as unknown as Scope));
  }

  /**
   * Run a callback with a new isolation scope
   */
  withIsolationScope<T>(callback: (scope: Scope) => T): T {
    return this._scopeManager.withIsolationScope((scope) => callback(scope as unknown as Scope));
  }

  // ============================================
  // Capture Methods
  // ============================================

  /**
   * Capture an exception
   */
  captureException(exception: unknown, hint?: EventHint): string {
    if (!this.isEnabled()) {
      return '';
    }

    const { eventId, event } = buildException(exception, {
      hint,
      attachStacktrace: this._options.attachStacktrace,
    });

    this._lastEventId = eventId;
    this._processEvent(event, hint);

    return eventId;
  }

  /**
   * Capture a message
   */
  captureMessage(message: string, captureContext?: CaptureContext | SeverityLevel): string {
    if (!this.isEnabled()) {
      return '';
    }

    const { eventId, event } = buildMessage(message, captureContext);

    this._lastEventId = eventId;
    this._processEvent(event);

    return eventId;
  }

  /**
   * Capture an event
   */
  captureEvent(event: Event, hint?: EventHint): string {
    if (!this.isEnabled()) {
      return '';
    }

    // Ensure event has an ID
    if (!event.event_id) {
      event.event_id = generateEventId();
    }

    this._lastEventId = event.event_id;
    this._processEvent(event, hint);

    return event.event_id;
  }

  /**
   * Get the last event ID
   */
  lastEventId(): string | undefined {
    return this._lastEventId;
  }

  // ============================================
  // Enrichment Methods
  // ============================================

  /**
   * Set a tag on the current scope
   */
  setTag(key: string, value: string): void {
    this.getCurrentScope().setTag(key, value);
  }

  /**
   * Set multiple tags on the current scope
   */
  setTags(tags: Record<string, string>): void {
    this.getCurrentScope().setTags(tags);
  }

  /**
   * Set a context on the current scope
   */
  setContext(name: string, context: Record<string, unknown> | null): void {
    this.getCurrentScope().setContext(name, context);
  }

  /**
   * Set an extra on the current scope
   */
  setExtra(key: string, extra: unknown): void {
    this.getCurrentScope().setExtra(key, extra);
  }

  /**
   * Set multiple extras on the current scope
   */
  setExtras(extras: Record<string, unknown>): void {
    this.getCurrentScope().setExtras(extras);
  }

  /**
   * Set the user on the current scope
   */
  setUser(user: User | null): void {
    this.getCurrentScope().setUser(user);
  }

  /**
   * Add a breadcrumb to the current scope
   */
  addBreadcrumb(breadcrumb: Breadcrumb, hint?: BreadcrumbHint): void {
    // Apply beforeBreadcrumb callback if configured
    let finalBreadcrumb: Breadcrumb | null = breadcrumb;

    if (this._options.beforeBreadcrumb) {
      finalBreadcrumb = this._options.beforeBreadcrumb(breadcrumb, hint);
      if (!finalBreadcrumb) {
        return;
      }
    }

    this.getCurrentScope().addBreadcrumb(finalBreadcrumb, this._options.maxBreadcrumbs);
  }

  // ============================================
  // Event Processors
  // ============================================

  /**
   * Add an event processor
   */
  addEventProcessor(processor: (event: Event, hint?: EventHint) => Event | null | Promise<Event | null>): void {
    this.getCurrentScope().addEventProcessor(processor);
  }

  /**
   * Add an integration
   */
  addIntegration(integration: Integration): void {
    // Check if already installed
    const existing = this._integrations.find((i) => i.name === integration.name);
    if (existing) {
      return;
    }

    this._integrations.push(integration);

    // Setup the integration if client exists
    if (this._client && integration.setup) {
      integration.setup(this._client);
    }
  }

  // ============================================
  // Lifecycle
  // ============================================

  /**
   * Flush pending events
   */
  async flush(timeout?: number): Promise<boolean> {
    // For now, just return true as we process events synchronously
    return true;
  }

  /**
   * Close the logger and release resources
   */
  async close(timeout?: number): Promise<boolean> {
    if (this._storage) {
      await this._storage.close();
    }

    this._initialized = false;
    this._enabled = false;

    return true;
  }

  // ============================================
  // Local Storage Access
  // ============================================

  /**
   * Get local logs from storage
   */
  async getLocalLogs(filter?: LogFilter): Promise<LogEntry[]> {
    if (!this._storage) {
      return [];
    }
    return this._storage.getLogs(filter);
  }

  /**
   * Get Sentry events from storage
   */
  async getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]> {
    if (!this._storage) {
      return [];
    }
    return this._storage.getSentryEvents(filter);
  }

  /**
   * Clear local data
   */
  async clearLocalData(): Promise<void> {
    if (!this._storage) {
      return;
    }
    await this._storage.clearLogs();
    await this._storage.clearSentryEvents();
  }

  /**
   * Export logs to a string format
   */
  async exportLogs(format: 'json' | 'csv' = 'json'): Promise<string> {
    const logs = await this.getLocalLogs();

    if (format === 'json') {
      return JSON.stringify(logs, null, 2);
    }

    // CSV format
    if (logs.length === 0) {
      return 'id,timestamp,level,message\n';
    }

    const headers = ['id', 'timestamp', 'level', 'message'];
    const rows = logs.map((log) => {
      return headers.map((h) => {
        const value = log[h as keyof LogEntry];
        if (typeof value === 'string') {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return String(value ?? '');
      }).join(',');
    });

    return [headers.join(','), ...rows].join('\n');
  }

  // ============================================
  // Internal Methods
  // ============================================

  /**
   * Process an event through the pipeline
   */
  private async _processEvent(event: Event, hint?: EventHint): Promise<void> {
    // Get the current scope and apply it to the event
    const scope = this.getCurrentScope();
    const processedEvent = await scope.applyToEvent(event, hint);

    if (!processedEvent) {
      // Event was dropped by a processor
      return;
    }

    // Apply beforeSend callback
    if (this._options.beforeSend) {
      const result = await this._options.beforeSend(processedEvent, hint || {});
      if (!result) {
        return;
      }
    }

    // Store locally
    await this._storeEvent(processedEvent);
  }

  /**
   * Store an event in local storage
   */
  private async _storeEvent(event: Event): Promise<void> {
    if (!this._storage) {
      return;
    }

    // Convert to SentryEvent format for storage
    // Use type assertion to handle minor type differences between Event and SentryEvent
    const timestamp = typeof event.timestamp === 'number'
      ? new Date(event.timestamp * 1000).toISOString()
      : new Date().toISOString();

    const sentryEvent: SentryEvent = {
      event_id: event.event_id || generateEventId(),
      timestamp,
      platform: event.platform,
      level: event.level,
      message: typeof event.message === 'string' ? event.message : event.message?.formatted,
      exception: event.exception as SentryEvent['exception'],
      user: event.user as SentryEvent['user'],
      tags: event.tags as SentryEvent['tags'],
      extra: event.extra,
      contexts: event.contexts as SentryEvent['contexts'],
      breadcrumbs: event.breadcrumbs as SentryEvent['breadcrumbs'],
      fingerprint: event.fingerprint,
      release: event.release || this._options.release,
      environment: event.environment || this._options.environment,
      sdk: event.sdk as SentryEvent['sdk'],
    };

    await this._storage.saveSentryEvent(sentryEvent);

    // Also store as a log entry for easier querying
    // Extract message string from sentryEvent.message which can be string or object
    const messageString = typeof sentryEvent.message === 'string'
      ? sentryEvent.message
      : (sentryEvent.message?.formatted || sentryEvent.message?.message || '');

    const logEntry: LogEntry = {
      id: sentryEvent.event_id,
      timestamp: sentryEvent.timestamp,
      level: sentryEvent.level || 'log',
      message: messageString,
      eventId: sentryEvent.event_id,
      tags: sentryEvent.tags,
      extra: sentryEvent.extra,
      contexts: sentryEvent.contexts,
      user: sentryEvent.user,
      breadcrumbs: sentryEvent.breadcrumbs,
      release: sentryEvent.release,
      environment: sentryEvent.environment,
    };

    if (event.exception?.values?.[0]) {
      logEntry.exception = event.exception.values[0];
    }

    await this._storage.saveLog(logEntry);
  }
}

// Export singleton instance methods bound to the singleton
const logger = UniversalLogger.getInstance();

export const init = logger.init.bind(logger);
export const getClient = () => logger.getClient();
export const getCurrentScope = () => logger.getCurrentScope();
export const getIsolationScope = () => logger.getIsolationScope();
export const getGlobalScope = () => logger.getGlobalScope();
export const isEnabled = () => logger.isEnabled();
export const lastEventId = () => logger.lastEventId();
