/**
 * Trace context management
 * Manages active spans and transactions with async context support
 */

import { Span } from './span';
import { Transaction } from './transaction';

/**
 * Context storage interface
 */
interface ContextStorage<T> {
  get(): T | undefined;
  set(value: T | undefined): void;
  run<R>(value: T | undefined, callback: () => R): R;
}

/**
 * Simple synchronous context storage (fallback)
 */
class SyncContextStorage<T> implements ContextStorage<T> {
  private _value: T | undefined;

  get(): T | undefined {
    return this._value;
  }

  set(value: T | undefined): void {
    this._value = value;
  }

  run<R>(value: T | undefined, callback: () => R): R {
    const previous = this._value;
    this._value = value;
    try {
      return callback();
    } finally {
      this._value = previous;
    }
  }
}

/**
 * AsyncLocalStorage-based context storage
 * Uses Node.js AsyncLocalStorage when available
 */
class AsyncContextStorage<T> implements ContextStorage<T> {
  private _storage: AsyncLocalStorageType<T>;
  private _fallback: T | undefined;

  constructor(storage: AsyncLocalStorageType<T>) {
    this._storage = storage;
  }

  get(): T | undefined {
    return this._storage.getStore() ?? this._fallback;
  }

  set(value: T | undefined): void {
    // AsyncLocalStorage doesn't support setting outside of run()
    // so we use a fallback for that case
    this._fallback = value;
  }

  run<R>(value: T | undefined, callback: () => R): R {
    return this._storage.run(value as T, callback);
  }
}

// Type for AsyncLocalStorage
type AsyncLocalStorageType<T> = {
  getStore(): T | undefined;
  run<R>(store: T, callback: () => R): R;
};

// Try to get AsyncLocalStorage
let AsyncLocalStorageClass: (new <T>() => AsyncLocalStorageType<T>) | undefined;

try {
  // Check if we're in Node.js environment with async_hooks
  if (typeof globalThis !== 'undefined' && 'process' in globalThis) {
    // Use dynamic import check without actually importing
    // This prevents bundler issues in browser environments
    const nodeVersion = (globalThis as unknown as { process: { version: string } }).process
      .version;
    const majorVersion = parseInt(nodeVersion.slice(1).split('.')[0], 10);
    if (majorVersion >= 12) {
      // AsyncLocalStorage is available in Node.js 12.17+
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      AsyncLocalStorageClass = require('async_hooks').AsyncLocalStorage;
    }
  }
} catch {
  // Not in Node.js or async_hooks not available
  AsyncLocalStorageClass = undefined;
}

/**
 * Create context storage for a value type
 */
function createContextStorage<T>(): ContextStorage<T> {
  if (AsyncLocalStorageClass) {
    try {
      const storage = new AsyncLocalStorageClass<T>();
      return new AsyncContextStorage<T>(storage);
    } catch {
      // Fall through to sync storage
    }
  }
  return new SyncContextStorage<T>();
}

/**
 * TraceContext manages active spans and transactions
 */
export class TraceContext {
  /**
   * Storage for active span
   */
  private static _spanStorage: ContextStorage<Span> = createContextStorage<Span>();

  /**
   * Storage for active transaction
   */
  private static _transactionStorage: ContextStorage<Transaction> =
    createContextStorage<Transaction>();

  /**
   * Whether tracing is suppressed
   */
  private static _suppressionStorage: ContextStorage<boolean> = createContextStorage<boolean>();

  // ============================================
  // Active span management
  // ============================================

  /**
   * Get the currently active span
   */
  static getActiveSpan(): Span | undefined {
    if (this._suppressionStorage.get()) {
      return undefined;
    }
    return this._spanStorage.get();
  }

  /**
   * Set the currently active span
   */
  static setActiveSpan(span: Span | undefined): void {
    this._spanStorage.set(span);
  }

  /**
   * Run a callback with a span as the active span
   */
  static runWithSpan<T>(span: Span | undefined, callback: () => T): T {
    return this._spanStorage.run(span, callback);
  }

  // ============================================
  // Active transaction management
  // ============================================

  /**
   * Get the currently active transaction
   */
  static getActiveTransaction(): Transaction | undefined {
    if (this._suppressionStorage.get()) {
      return undefined;
    }
    return this._transactionStorage.get();
  }

  /**
   * Set the currently active transaction
   */
  static setActiveTransaction(transaction: Transaction | undefined): void {
    this._transactionStorage.set(transaction);
  }

  /**
   * Run a callback with a transaction as the active transaction
   */
  static runWithTransaction<T>(transaction: Transaction | undefined, callback: () => T): T {
    return this._transactionStorage.run(transaction, callback);
  }

  // ============================================
  // Combined context management
  // ============================================

  /**
   * Run a callback with both span and transaction context
   */
  static runWithContext<T>(
    span: Span | undefined,
    transaction: Transaction | undefined,
    callback: () => T
  ): T {
    return this._spanStorage.run(span, () => {
      return this._transactionStorage.run(transaction, callback);
    });
  }

  // ============================================
  // Trace suppression
  // ============================================

  /**
   * Check if tracing is currently suppressed
   */
  static isTracingSuppressed(): boolean {
    return this._suppressionStorage.get() === true;
  }

  /**
   * Run a callback with tracing suppressed
   */
  static runWithSuppression<T>(callback: () => T): T {
    return this._suppressionStorage.run(true, callback);
  }

  // ============================================
  // Utility methods
  // ============================================

  /**
   * Get the active span or transaction
   */
  static getActiveSpanOrTransaction(): Span | Transaction | undefined {
    return this.getActiveSpan() || this.getActiveTransaction();
  }

  /**
   * Clear all context
   */
  static clear(): void {
    this._spanStorage.set(undefined);
    this._transactionStorage.set(undefined);
    this._suppressionStorage.set(undefined);
  }
}

// ============================================
// Convenience exports
// ============================================

/**
 * Get the currently active span
 */
export function getActiveSpan(): Span | undefined {
  return TraceContext.getActiveSpan();
}

/**
 * Get the currently active transaction
 */
export function getActiveTransaction(): Transaction | undefined {
  return TraceContext.getActiveTransaction();
}

/**
 * Check if tracing is suppressed
 */
export function isTracingSuppressed(): boolean {
  return TraceContext.isTracingSuppressed();
}
