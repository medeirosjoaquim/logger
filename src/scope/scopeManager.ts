/**
 * Scope Manager
 *
 * Manages the hierarchy of scopes: global, isolation, and current.
 * Provides withScope and withIsolationScope for temporary scope modifications.
 *
 * Scope hierarchy:
 * - Global Scope: Shared across the entire application
 * - Isolation Scope: Isolated per async context (e.g., per request in server environments)
 * - Current Scope: The most local scope, typically forked for temporary modifications
 */

import { Scope } from './scope.js';

/**
 * Scope Manager for handling scope hierarchy
 */
export class ScopeManager {
  private globalScope: Scope;
  private isolationScope: Scope;
  private currentScope: Scope;

  constructor() {
    this.globalScope = new Scope();
    this.isolationScope = new Scope();
    this.currentScope = new Scope();
  }

  /**
   * Gets the global scope.
   * This scope is shared across the entire application and should be used
   * sparingly for data that truly needs to be global.
   */
  getGlobalScope(): Scope {
    return this.globalScope;
  }

  /**
   * Gets the isolation scope.
   * This scope is isolated per async context (e.g., per HTTP request).
   * Use this for request-specific data like user info, request tags, etc.
   */
  getIsolationScope(): Scope {
    return this.isolationScope;
  }

  /**
   * Gets the current scope.
   * This is the most local scope and is typically forked for
   * temporary modifications within a specific code block.
   */
  getCurrentScope(): Scope {
    return this.currentScope;
  }

  /**
   * Sets the current scope.
   * @param scope - The new current scope
   */
  setCurrentScope(scope: Scope): void {
    this.currentScope = scope;
  }

  /**
   * Sets the isolation scope.
   * @param scope - The new isolation scope
   */
  setIsolationScope(scope: Scope): void {
    this.isolationScope = scope;
  }

  /**
   * Executes a callback with a forked current scope.
   * The scope is automatically restored after the callback completes.
   * Changes made to the scope within the callback do not affect the parent scope.
   *
   * @param callback - Function to execute with the forked scope
   * @returns The return value of the callback
   *
   * @example
   * ```typescript
   * scopeManager.withScope((scope) => {
   *   scope.setTag('handler', 'myFunction');
   *   scope.setUser({ id: '123' });
   *   // These changes only apply within this callback
   *   captureMessage('Something happened');
   * });
   * // Original scope is restored here
   * ```
   */
  withScope<T>(callback: (scope: Scope) => T): T {
    const previousScope = this.currentScope;
    const forkedScope = previousScope.clone();
    this.currentScope = forkedScope;

    try {
      return callback(forkedScope);
    } finally {
      this.currentScope = previousScope;
    }
  }

  /**
   * Executes a callback with a forked isolation scope.
   * This is useful for isolating context in async operations like HTTP requests.
   * Both the isolation scope and current scope are forked.
   *
   * @param callback - Function to execute with the forked isolation scope
   * @returns The return value of the callback
   *
   * @example
   * ```typescript
   * scopeManager.withIsolationScope((scope) => {
   *   scope.setUser(request.user);
   *   scope.setTag('request_id', request.id);
   *   // Handle the entire request in this isolated context
   *   await handleRequest(request);
   * });
   * ```
   */
  withIsolationScope<T>(callback: (scope: Scope) => T): T {
    const previousIsolationScope = this.isolationScope;
    const previousCurrentScope = this.currentScope;

    const forkedIsolationScope = previousIsolationScope.clone();
    const forkedCurrentScope = previousCurrentScope.clone();

    this.isolationScope = forkedIsolationScope;
    this.currentScope = forkedCurrentScope;

    try {
      return callback(forkedIsolationScope);
    } finally {
      this.isolationScope = previousIsolationScope;
      this.currentScope = previousCurrentScope;
    }
  }

  /**
   * Executes an async callback with a forked current scope.
   * The scope is automatically restored after the callback completes.
   *
   * @param callback - Async function to execute with the forked scope
   * @returns Promise resolving to the return value of the callback
   */
  async withScopeAsync<T>(callback: (scope: Scope) => Promise<T>): Promise<T> {
    const previousScope = this.currentScope;
    const forkedScope = previousScope.clone();
    this.currentScope = forkedScope;

    try {
      return await callback(forkedScope);
    } finally {
      this.currentScope = previousScope;
    }
  }

  /**
   * Executes an async callback with a forked isolation scope.
   *
   * @param callback - Async function to execute with the forked isolation scope
   * @returns Promise resolving to the return value of the callback
   */
  async withIsolationScopeAsync<T>(
    callback: (scope: Scope) => Promise<T>
  ): Promise<T> {
    const previousIsolationScope = this.isolationScope;
    const previousCurrentScope = this.currentScope;

    const forkedIsolationScope = previousIsolationScope.clone();
    const forkedCurrentScope = previousCurrentScope.clone();

    this.isolationScope = forkedIsolationScope;
    this.currentScope = forkedCurrentScope;

    try {
      return await callback(forkedIsolationScope);
    } finally {
      this.isolationScope = previousIsolationScope;
      this.currentScope = previousCurrentScope;
    }
  }

  /**
   * Configures the current scope without forking.
   * Changes made in the callback persist in the current scope.
   *
   * @param callback - Function to configure the scope
   *
   * @example
   * ```typescript
   * scopeManager.configureScope((scope) => {
   *   scope.setTag('version', '1.0.0');
   * });
   * // The tag persists in the current scope
   * ```
   */
  configureScope(callback: (scope: Scope) => void): void {
    callback(this.currentScope);
  }

  /**
   * Resets all scopes to fresh instances.
   * Useful for testing or when reinitializing the logger.
   */
  reset(): void {
    this.globalScope = new Scope();
    this.isolationScope = new Scope();
    this.currentScope = new Scope();
  }

  /**
   * Gets merged scope data from all scope layers.
   * The merge order is: global -> isolation -> current
   * Later scopes override earlier ones.
   */
  getMergedScope(): Scope {
    const merged = new Scope();

    // Apply global scope
    merged.update(this.globalScope);

    // Apply isolation scope (overrides global)
    merged.update(this.isolationScope);

    // Apply current scope (overrides isolation)
    merged.update(this.currentScope);

    return merged;
  }
}

// Singleton instance for convenience
let defaultScopeManager: ScopeManager | undefined;

/**
 * Gets the default scope manager instance.
 * Creates one if it doesn't exist.
 */
export function getDefaultScopeManager(): ScopeManager {
  if (!defaultScopeManager) {
    defaultScopeManager = new ScopeManager();
  }
  return defaultScopeManager;
}

/**
 * Resets the default scope manager.
 * Useful for testing.
 */
export function resetDefaultScopeManager(): void {
  defaultScopeManager = undefined;
}
