/**
 * Storage Provider Module
 *
 * Exports all storage providers and factory function.
 */

// Export types
export type {
  StorageProvider,
  StorageProviderConfig,
  LogEntry,
  LogSession,
  SentryEvent,
  SpanData,
  TransactionData,
  TraceData,
  LogFilter,
  SentryEventFilter,
  TraceFilter,
  SeverityLevel,
  BreadcrumbType,
  SpanStatus,
  SessionStatus,
  Breadcrumb,
  User,
  ExceptionData,
  StackFrame,
  RequestData,
  SpanAttributes,
} from './types.js';

// Export base class and defaults
export { BaseStorageProvider, DEFAULT_CONFIG } from './base.js';

// Export providers
export { MemoryStorageProvider } from './memory.js';
export { IndexedDBStorageProvider } from './indexeddb.js';
export { ZustandStorageProvider } from './zustand.js';
export type { ZustandStorageOptions, LoggerState, LoggerStateWithActions } from './zustand.js';

// React hooks are NOT exported here to avoid requiring React as a dependency.
// Import from '@universal-logger/core/react' instead for React hooks.

// Import for factory function
import type { StorageProvider, StorageProviderConfig } from './types.js';
import { MemoryStorageProvider } from './memory.js';
import { IndexedDBStorageProvider } from './indexeddb.js';
import { ZustandStorageProvider, type ZustandStorageOptions } from './zustand.js';

/**
 * Storage provider types supported by the factory
 */
export type StorageProviderType = 'memory' | 'indexeddb' | 'zustand';

/**
 * Factory function to create storage providers
 *
 * @param type - The type of storage provider to create
 * @param config - Optional configuration for the provider
 * @returns A new storage provider instance
 *
 * @example
 * ```typescript
 * // Create a memory storage provider
 * const memory = createStorageProvider('memory');
 * await memory.init();
 *
 * // Create an IndexedDB provider with custom config
 * const idb = createStorageProvider('indexeddb', {
 *   dbName: 'my-app-logger',
 *   dbVersion: 2
 * });
 * await idb.init();
 *
 * // Create a Zustand provider with persistence
 * const zustand = createStorageProvider('zustand', {
 *   name: 'my-app-logger',
 *   persist: true,
 *   storage: 'localStorage'
 * });
 * await zustand.init();
 * ```
 */
export function createStorageProvider(
  type: StorageProviderType,
  config?: StorageProviderConfig | ZustandStorageOptions
): StorageProvider {
  switch (type) {
    case 'memory':
      return new MemoryStorageProvider(config);

    case 'indexeddb':
      return new IndexedDBStorageProvider(config);

    case 'zustand':
      return new ZustandStorageProvider(config as ZustandStorageOptions);

    default:
      throw new Error(`Unknown storage provider type: ${type}`);
  }
}

/**
 * Check if IndexedDB is supported in the current environment
 *
 * @returns true if IndexedDB is available
 */
export function isIndexedDBSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

/**
 * Get the best available storage provider type for the current environment
 *
 * @returns 'indexeddb' if supported, otherwise 'memory'
 */
export function getBestStorageType(): StorageProviderType {
  return isIndexedDBSupported() ? 'indexeddb' : 'memory';
}

/**
 * Create the best available storage provider for the current environment
 *
 * @param config - Optional configuration for the provider
 * @returns A new storage provider instance (IndexedDB if available, Memory otherwise)
 *
 * @example
 * ```typescript
 * const storage = createBestStorageProvider();
 * await storage.init();
 * console.log(`Using ${storage.name} storage`);
 * ```
 */
export function createBestStorageProvider(config?: StorageProviderConfig): StorageProvider {
  return createStorageProvider(getBestStorageType(), config);
}
