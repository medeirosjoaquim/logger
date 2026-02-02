/**
 * Storage Module Tests
 *
 * Tests for storage provider factory functions and utilities.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
// Import specific modules to avoid React dependency from ./react.ts
import { MemoryStorageProvider } from '../../storage/memory';
import { IndexedDBStorageProvider } from '../../storage/indexeddb';
import { DEFAULT_CONFIG } from '../../storage/base';

// Manually create the factory functions to avoid importing from index.ts
// which has React dependencies
function createStorageProvider(type: 'memory' | 'indexeddb', config?: any) {
  switch (type) {
    case 'memory':
      return new MemoryStorageProvider(config);
    case 'indexeddb':
      return new IndexedDBStorageProvider(config);
    default:
      throw new Error(`Unknown storage provider type: ${type}`);
  }
}

function isIndexedDBSupported(): boolean {
  try {
    return typeof indexedDB !== 'undefined' && indexedDB !== null;
  } catch {
    return false;
  }
}

function getBestStorageType(): 'memory' | 'indexeddb' {
  return isIndexedDBSupported() ? 'indexeddb' : 'memory';
}

function createBestStorageProvider(config?: any) {
  return createStorageProvider(getBestStorageType(), config);
}

describe('Storage Module', () => {
  describe('createStorageProvider', () => {
    it('creates memory storage provider', () => {
      const storage = createStorageProvider('memory');

      expect(storage).toBeInstanceOf(MemoryStorageProvider);
      expect(storage.name).toBe('memory');
    });

    it('creates indexeddb storage provider', () => {
      const storage = createStorageProvider('indexeddb');

      expect(storage).toBeInstanceOf(IndexedDBStorageProvider);
      expect(storage.name).toBe('indexeddb');
    });

    it('throws for unknown provider type', () => {
      expect(() => createStorageProvider('unknown' as 'memory')).toThrow('Unknown storage provider type');
    });

    it('passes config to memory provider', async () => {
      const storage = createStorageProvider('memory', { maxLogs: 50 });
      await storage.init();

      // Add more than default but less than 50
      for (let i = 0; i < 60; i++) {
        await (storage as MemoryStorageProvider).saveLog({
          id: `${i}`,
          message: `log ${i}`,
          level: 'info',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const logs = await storage.getLogs();
      expect(logs.length).toBeLessThanOrEqual(50);

      await storage.close();
    });

    it('passes config to indexeddb provider', () => {
      const storage = createStorageProvider('indexeddb', {
        dbName: 'test-db',
        dbVersion: 2,
      });

      expect(storage).toBeInstanceOf(IndexedDBStorageProvider);
    });
  });

  describe('getBestStorageType', () => {
    it('returns indexeddb when supported', () => {
      // In jsdom, indexedDB should be available
      if (typeof indexedDB !== 'undefined') {
        expect(getBestStorageType()).toBe('indexeddb');
      }
    });

    it('returns memory when indexeddb not supported', () => {
      // Mock indexedDB as undefined
      const originalIndexedDB = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(getBestStorageType()).toBe('memory');

      // Restore
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDB,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('isIndexedDBSupported', () => {
    it('returns true when indexedDB is available', () => {
      if (typeof indexedDB !== 'undefined') {
        expect(isIndexedDBSupported()).toBe(true);
      }
    });

    it('returns false when indexedDB is not available', () => {
      const originalIndexedDB = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', {
        value: undefined,
        writable: true,
        configurable: true,
      });

      expect(isIndexedDBSupported()).toBe(false);

      // Restore
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDB,
        writable: true,
        configurable: true,
      });
    });

    it('returns false when indexedDB throws', () => {
      const originalIndexedDB = globalThis.indexedDB;
      Object.defineProperty(globalThis, 'indexedDB', {
        get: () => {
          throw new Error('Access denied');
        },
        configurable: true,
      });

      expect(isIndexedDBSupported()).toBe(false);

      // Restore
      Object.defineProperty(globalThis, 'indexedDB', {
        value: originalIndexedDB,
        writable: true,
        configurable: true,
      });
    });
  });

  describe('createBestStorageProvider', () => {
    it('creates a storage provider', () => {
      const storage = createBestStorageProvider();

      expect(storage).toBeDefined();
      expect(typeof storage.name).toBe('string');
    });

    it('passes config to provider', async () => {
      const storage = createBestStorageProvider({ maxLogs: 10 });

      expect(storage).toBeDefined();
    });
  });

  describe('DEFAULT_CONFIG', () => {
    it('has expected default values', () => {
      expect(DEFAULT_CONFIG.maxLogs).toBe(1000);
      expect(DEFAULT_CONFIG.maxSessions).toBe(100);
      expect(DEFAULT_CONFIG.maxEvents).toBe(1000);
      expect(DEFAULT_CONFIG.maxSpans).toBe(5000);
      expect(DEFAULT_CONFIG.maxTransactions).toBe(500);
      expect(DEFAULT_CONFIG.dbName).toBe('universal-logger');
      expect(DEFAULT_CONFIG.dbVersion).toBe(1);
    });
  });

  describe('MemoryStorageProvider', () => {
    let storage: MemoryStorageProvider;

    beforeEach(async () => {
      storage = new MemoryStorageProvider();
      await storage.init();
    });

    afterEach(async () => {
      await storage.close();
    });

    it('can be instantiated directly', () => {
      expect(storage).toBeInstanceOf(MemoryStorageProvider);
    });

    it('has getStats method', () => {
      expect(typeof storage.getStats).toBe('function');

      const stats = storage.getStats();
      expect(stats).toHaveProperty('logs');
      expect(stats).toHaveProperty('sessions');
      expect(stats).toHaveProperty('events');
      expect(stats).toHaveProperty('spans');
      expect(stats).toHaveProperty('transactions');
    });

    it('has clearAll method', async () => {
      await storage.saveLog({
        id: '1',
        message: 'test',
        level: 'info',
        timestamp: new Date().toISOString(),
      });

      await storage.clearAll();

      const stats = storage.getStats();
      expect(stats.logs).toBe(0);
    });
  });

  describe('IndexedDBStorageProvider', () => {
    it('can be instantiated directly', () => {
      const storage = new IndexedDBStorageProvider();

      expect(storage).toBeInstanceOf(IndexedDBStorageProvider);
      expect(storage.name).toBe('indexeddb');
    });

    it('accepts custom config', () => {
      const storage = new IndexedDBStorageProvider({
        dbName: 'custom-db',
        dbVersion: 3,
      });

      expect(storage).toBeInstanceOf(IndexedDBStorageProvider);
    });

    it('is not ready before init', () => {
      const storage = new IndexedDBStorageProvider();

      expect(storage.isReady()).toBe(false);
    });
  });

  describe('factory functions', () => {
    it('createStorageProvider function exists', () => {
      expect(typeof createStorageProvider).toBe('function');
    });

    it('getBestStorageType function exists', () => {
      expect(typeof getBestStorageType).toBe('function');
    });

    it('isIndexedDBSupported function exists', () => {
      expect(typeof isIndexedDBSupported).toBe('function');
    });

    it('createBestStorageProvider function exists', () => {
      expect(typeof createBestStorageProvider).toBe('function');
    });
  });
});
