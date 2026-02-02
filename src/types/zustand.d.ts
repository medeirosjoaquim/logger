/**
 * Zustand Type Stubs
 *
 * Provides type declarations for optional zustand dependency.
 * These types are used when zustand is not installed, allowing
 * the project to compile without the actual zustand package.
 */

declare module 'zustand/vanilla' {
  export interface StoreApi<T> {
    getState: () => T;
    setState: (
      partial: T | Partial<T> | ((state: T) => T | Partial<T>),
      replace?: boolean
    ) => void;
    subscribe: (listener: (state: T, prevState: T) => void) => () => void;
    destroy: () => void;
  }

  export type StateCreator<T, _Mis = unknown, _Mos = unknown, U = T> = (
    setState: StoreApi<T>['setState'],
    getState: StoreApi<T>['getState'],
    store: StoreApi<T>
  ) => U;

  export function createStore<T>(
    createState: StateCreator<T, unknown, unknown, T>
  ): StoreApi<T>;
}

declare module 'zustand/middleware' {
  import type { StateCreator, StoreApi } from 'zustand/vanilla';

  export interface StateStorage {
    getItem: (name: string) => string | null | Promise<string | null>;
    setItem: (name: string, value: string) => void | Promise<void>;
    removeItem: (name: string) => void | Promise<void>;
  }

  export interface PersistStorage<S> {
    getItem: (name: string) => StorageValue<S> | null | Promise<StorageValue<S> | null>;
    setItem: (name: string, value: StorageValue<S>) => void | Promise<void>;
    removeItem: (name: string) => void | Promise<void>;
  }

  export interface StorageValue<S> {
    state: S;
    version?: number;
  }

  export interface PersistOptions<S, PersistedState = S> {
    name: string;
    storage?: PersistStorage<PersistedState> | undefined;
    partialize?: (state: S) => PersistedState;
    onRehydrateStorage?: (state: S) => ((state?: S, error?: unknown) => void) | void;
    version?: number;
    migrate?: (persistedState: unknown, version: number) => PersistedState | Promise<PersistedState>;
    merge?: (persistedState: unknown, currentState: S) => S;
    skipHydration?: boolean;
  }

  export function persist<T, PersistedState = T>(
    initializer: StateCreator<T, unknown, unknown, T>,
    options: PersistOptions<T, PersistedState>
  ): StateCreator<T, unknown, unknown, T>;

  export function createJSONStorage<S>(
    getStorage: () => StateStorage,
    options?: { reviver?: (key: string, value: unknown) => unknown; replacer?: (key: string, value: unknown) => unknown }
  ): PersistStorage<S>;
}
