/**
 * Memory Storage Provider Tests
 *
 * Tests for the in-memory storage implementation.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { MemoryStorageProvider } from '../../storage/memory';
import type { LogEntry, SentryEvent, LogSession, SpanData, TransactionData } from '../../storage/types';

describe('MemoryStorageProvider', () => {
  let storage: MemoryStorageProvider;

  beforeEach(async () => {
    storage = new MemoryStorageProvider();
    await storage.init();
  });

  afterEach(async () => {
    await storage.close();
  });

  describe('initialization', () => {
    it('has correct name', () => {
      expect(storage.name).toBe('memory');
    });

    it('is ready after init', () => {
      expect(storage.isReady()).toBe(true);
    });

    it('is not ready before init', () => {
      const freshStorage = new MemoryStorageProvider();
      expect(freshStorage.isReady()).toBe(false);
    });

    it('throws error when not initialized', async () => {
      const freshStorage = new MemoryStorageProvider();
      await expect(freshStorage.getLogs()).rejects.toThrow('not initialized');
    });

    it('accepts custom config', async () => {
      const customStorage = new MemoryStorageProvider({
        maxLogs: 50,
        maxEvents: 100,
      });
      await customStorage.init();
      expect(customStorage.isReady()).toBe(true);
      await customStorage.close();
    });
  });

  describe('close', () => {
    it('clears all data on close', async () => {
      await storage.saveLog({ id: '1', message: 'test', level: 'info', timestamp: new Date().toISOString() });
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString() });

      await storage.close();
      await storage.init();

      expect(await storage.getLogs()).toHaveLength(0);
      expect(await storage.getSentryEvents()).toHaveLength(0);
    });

    it('sets isReady to false', async () => {
      await storage.close();
      expect(storage.isReady()).toBe(false);
    });
  });

  describe('logs', () => {
    it('saves and retrieves logs', async () => {
      const entry: LogEntry = {
        id: '1',
        message: 'test message',
        level: 'info',
        timestamp: new Date().toISOString(),
      };

      await storage.saveLog(entry);
      const logs = await storage.getLogs();

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('test message');
    });

    it('generates ID if not provided', async () => {
      await storage.saveLog({
        id: '',
        message: 'test',
        level: 'info',
        timestamp: new Date().toISOString(),
      });

      const logs = await storage.getLogs();
      expect(logs[0].id).toBeTruthy();
    });

    it('generates timestamp if not provided', async () => {
      await storage.saveLog({
        id: '1',
        message: 'test',
        level: 'info',
        timestamp: '',
      });

      const logs = await storage.getLogs();
      expect(logs[0].timestamp).toBeTruthy();
    });

    it('filters by level', async () => {
      await storage.saveLog({ id: '1', message: 'info', level: 'info', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '2', message: 'error', level: 'error', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '3', message: 'warning', level: 'warning', timestamp: new Date().toISOString() });

      const errors = await storage.getLogs({ level: 'error' });
      expect(errors).toHaveLength(1);
      expect(errors[0].level).toBe('error');
    });

    it('filters by multiple levels', async () => {
      await storage.saveLog({ id: '1', message: 'info', level: 'info', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '2', message: 'error', level: 'error', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '3', message: 'warning', level: 'warning', timestamp: new Date().toISOString() });

      const logs = await storage.getLogs({ level: ['error', 'warning'] });
      expect(logs).toHaveLength(2);
    });

    it('filters by session ID', async () => {
      await storage.saveLog({ id: '1', message: 'session1', level: 'info', timestamp: new Date().toISOString(), sessionId: 'session1' });
      await storage.saveLog({ id: '2', message: 'session2', level: 'info', timestamp: new Date().toISOString(), sessionId: 'session2' });

      const logs = await storage.getLogs({ sessionId: 'session1' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('session1');
    });

    it('filters by search text in message', async () => {
      await storage.saveLog({ id: '1', message: 'Hello World', level: 'info', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '2', message: 'Goodbye World', level: 'info', timestamp: new Date().toISOString() });

      const logs = await storage.getLogs({ search: 'hello' });
      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('Hello World');
    });

    it('filters by time range', async () => {
      const now = new Date();
      const past = new Date(now.getTime() - 10000);
      const future = new Date(now.getTime() + 10000);

      await storage.saveLog({ id: '1', message: 'past', level: 'info', timestamp: past.toISOString() });
      await storage.saveLog({ id: '2', message: 'now', level: 'info', timestamp: now.toISOString() });
      await storage.saveLog({ id: '3', message: 'future', level: 'info', timestamp: future.toISOString() });

      const logs = await storage.getLogs({
        startTime: new Date(now.getTime() - 5000).toISOString(),
        endTime: new Date(now.getTime() + 5000).toISOString(),
      });

      expect(logs).toHaveLength(1);
      expect(logs[0].message).toBe('now');
    });

    it('supports pagination with limit', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.saveLog({ id: `${i}`, message: `log ${i}`, level: 'info', timestamp: new Date().toISOString() });
      }

      const logs = await storage.getLogs({ limit: 5 });
      expect(logs).toHaveLength(5);
    });

    it('supports pagination with offset', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.saveLog({ id: `${i}`, message: `log ${i}`, level: 'info', timestamp: new Date(Date.now() + i * 1000).toISOString() });
      }

      const logs = await storage.getLogs({ offset: 5, orderBy: 'timestamp', orderDirection: 'asc' });
      expect(logs).toHaveLength(5);
    });

    it('clears all logs', async () => {
      await storage.saveLog({ id: '1', message: 'test1', level: 'info', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '2', message: 'test2', level: 'info', timestamp: new Date().toISOString() });

      await storage.clearLogs();

      expect(await storage.getLogs()).toHaveLength(0);
    });

    it('clears logs matching filter', async () => {
      await storage.saveLog({ id: '1', message: 'info', level: 'info', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '2', message: 'error', level: 'error', timestamp: new Date().toISOString() });

      await storage.clearLogs({ level: 'error' });

      const logs = await storage.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].level).toBe('info');
    });

    it('enforces max logs limit', async () => {
      const smallStorage = new MemoryStorageProvider({ maxLogs: 5 });
      await smallStorage.init();

      for (let i = 0; i < 10; i++) {
        await smallStorage.saveLog({
          id: `${i}`,
          message: `log ${i}`,
          level: 'info',
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const logs = await smallStorage.getLogs();
      expect(logs).toHaveLength(5);

      await smallStorage.close();
    });

    it('returns cloned logs to prevent mutation', async () => {
      await storage.saveLog({ id: '1', message: 'test', level: 'info', timestamp: new Date().toISOString() });

      const logs = await storage.getLogs();
      logs[0].message = 'modified';

      const freshLogs = await storage.getLogs();
      expect(freshLogs[0].message).toBe('test');
    });
  });

  describe('sessions', () => {
    it('creates and retrieves session', async () => {
      const session: LogSession = {
        id: 'session1',
        startedAt: new Date().toISOString(),
        status: 'ok',
        errors: 0,
      };

      await storage.createSession(session);
      const retrieved = await storage.getSession('session1');

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe('session1');
    });

    it('generates ID if not provided', async () => {
      await storage.createSession({
        id: '',
        startedAt: new Date().toISOString(),
        status: 'ok',
        errors: 0,
      });

      const sessions = await storage.getSessions();
      expect(sessions).toHaveLength(1);
      expect(sessions[0].id).toBeTruthy();
    });

    it('generates startedAt if not provided', async () => {
      await storage.createSession({
        id: 'session1',
        startedAt: '',
        status: 'ok',
        errors: 0,
      });

      const session = await storage.getSession('session1');
      expect(session?.startedAt).toBeTruthy();
    });

    it('updates session', async () => {
      await storage.createSession({
        id: 'session1',
        startedAt: new Date().toISOString(),
        status: 'ok',
        errors: 0,
      });

      await storage.updateSession('session1', { errors: 5 });

      const session = await storage.getSession('session1');
      expect(session?.errors).toBe(5);
    });

    it('throws error updating non-existent session', async () => {
      await expect(storage.updateSession('nonexistent', { errors: 1 })).rejects.toThrow('not found');
    });

    it('ends session', async () => {
      await storage.createSession({
        id: 'session1',
        startedAt: new Date().toISOString(),
        status: 'ok',
        errors: 0,
      });

      await storage.endSession('session1');

      const session = await storage.getSession('session1');
      expect(session?.endedAt).toBeTruthy();
      expect(session?.duration).toBeDefined();
      expect(session?.status).toBe('exited');
    });

    it('marks crashed session when errors > 0', async () => {
      await storage.createSession({
        id: 'session1',
        startedAt: new Date().toISOString(),
        status: 'ok',
        errors: 3,
      });

      await storage.endSession('session1');

      const session = await storage.getSession('session1');
      expect(session?.status).toBe('crashed');
    });

    it('throws error ending non-existent session', async () => {
      await expect(storage.endSession('nonexistent')).rejects.toThrow('not found');
    });

    it('gets sessions ordered by startedAt descending', async () => {
      await storage.createSession({ id: 'old', startedAt: new Date(Date.now() - 10000).toISOString(), status: 'ok', errors: 0 });
      await storage.createSession({ id: 'new', startedAt: new Date().toISOString(), status: 'ok', errors: 0 });

      const sessions = await storage.getSessions();

      expect(sessions[0].id).toBe('new');
      expect(sessions[1].id).toBe('old');
    });

    it('limits number of sessions returned', async () => {
      for (let i = 0; i < 10; i++) {
        await storage.createSession({ id: `session${i}`, startedAt: new Date().toISOString(), status: 'ok', errors: 0 });
      }

      const sessions = await storage.getSessions(5);
      expect(sessions).toHaveLength(5);
    });

    it('deletes session', async () => {
      await storage.createSession({ id: 'session1', startedAt: new Date().toISOString(), status: 'ok', errors: 0 });

      await storage.deleteSession('session1');

      const session = await storage.getSession('session1');
      expect(session).toBeNull();
    });

    it('deletes associated logs when deleting session', async () => {
      await storage.createSession({ id: 'session1', startedAt: new Date().toISOString(), status: 'ok', errors: 0 });
      await storage.saveLog({ id: '1', message: 'session log', level: 'info', timestamp: new Date().toISOString(), sessionId: 'session1' });
      await storage.saveLog({ id: '2', message: 'other log', level: 'info', timestamp: new Date().toISOString(), sessionId: 'other' });

      await storage.deleteSession('session1');

      const logs = await storage.getLogs();
      expect(logs).toHaveLength(1);
      expect(logs[0].sessionId).toBe('other');
    });

    it('returns null for non-existent session', async () => {
      const session = await storage.getSession('nonexistent');
      expect(session).toBeNull();
    });

    it('enforces max sessions limit', async () => {
      const smallStorage = new MemoryStorageProvider({ maxSessions: 3 });
      await smallStorage.init();

      for (let i = 0; i < 5; i++) {
        await smallStorage.createSession({
          id: `session${i}`,
          startedAt: new Date(Date.now() + i * 1000).toISOString(),
          status: 'ok',
          errors: 0,
        });
      }

      const sessions = await smallStorage.getSessions();
      expect(sessions).toHaveLength(3);

      await smallStorage.close();
    });
  });

  describe('Sentry events', () => {
    it('saves and retrieves Sentry events', async () => {
      const event: SentryEvent = {
        event_id: '123',
        timestamp: new Date().toISOString(),
        message: 'Test event',
        level: 'error',
      };

      await storage.saveSentryEvent(event);
      const events = await storage.getSentryEvents();

      expect(events).toHaveLength(1);
      expect(events[0].event_id).toBe('123');
    });

    it('generates event_id if not provided', async () => {
      await storage.saveSentryEvent({
        event_id: '',
        timestamp: new Date().toISOString(),
      });

      const events = await storage.getSentryEvents();
      expect(events[0].event_id).toBeTruthy();
      // Should be 32 hex characters (UUID without dashes)
      expect(events[0].event_id.length).toBe(32);
    });

    it('adds _localTimestamp', async () => {
      await storage.saveSentryEvent({
        event_id: '123',
        timestamp: new Date().toISOString(),
      });

      const events = await storage.getSentryEvents();
      expect(events[0]._localTimestamp).toBeTruthy();
    });

    it('filters by level', async () => {
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString(), level: 'error' });
      await storage.saveSentryEvent({ event_id: '2', timestamp: new Date().toISOString(), level: 'warning' });

      const errors = await storage.getSentryEvents({ level: 'error' });
      expect(errors).toHaveLength(1);
      expect(errors[0].level).toBe('error');
    });

    it('filters by type', async () => {
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString(), type: 'event' });
      await storage.saveSentryEvent({ event_id: '2', timestamp: new Date().toISOString(), type: 'transaction' });

      const transactions = await storage.getSentryEvents({ type: 'transaction' });
      expect(transactions).toHaveLength(1);
      expect(transactions[0].type).toBe('transaction');
    });

    it('filters by environment', async () => {
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString(), environment: 'production' });
      await storage.saveSentryEvent({ event_id: '2', timestamp: new Date().toISOString(), environment: 'development' });

      const prod = await storage.getSentryEvents({ environment: 'production' });
      expect(prod).toHaveLength(1);
    });

    it('filters by search text', async () => {
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString(), message: 'User login failed' });
      await storage.saveSentryEvent({ event_id: '2', timestamp: new Date().toISOString(), message: 'User logout success' });

      const events = await storage.getSentryEvents({ search: 'login' });
      expect(events).toHaveLength(1);
    });

    it('filters by hasException', async () => {
      await storage.saveSentryEvent({
        event_id: '1',
        timestamp: new Date().toISOString(),
        exception: { values: [{ type: 'Error', value: 'test' }] },
      });
      await storage.saveSentryEvent({
        event_id: '2',
        timestamp: new Date().toISOString(),
        message: 'No exception',
      });

      const withException = await storage.getSentryEvents({ hasException: true });
      expect(withException).toHaveLength(1);

      const withoutException = await storage.getSentryEvents({ hasException: false });
      expect(withoutException).toHaveLength(1);
    });

    it('clears all events', async () => {
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString() });
      await storage.saveSentryEvent({ event_id: '2', timestamp: new Date().toISOString() });

      await storage.clearSentryEvents();

      expect(await storage.getSentryEvents()).toHaveLength(0);
    });

    it('enforces max events limit', async () => {
      const smallStorage = new MemoryStorageProvider({ maxEvents: 3 });
      await smallStorage.init();

      for (let i = 0; i < 5; i++) {
        await smallStorage.saveSentryEvent({
          event_id: `${i}`,
          timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const events = await smallStorage.getSentryEvents();
      expect(events).toHaveLength(3);

      await smallStorage.close();
    });
  });

  describe('tracing', () => {
    it('saves and retrieves spans', async () => {
      const span: SpanData = {
        span_id: 'span123',
        trace_id: 'trace456',
        name: 'Test Span',
        start_timestamp: new Date().toISOString(),
      };

      await storage.saveSpan(span);
      const traces = await storage.getTraces();

      // Spans alone don't create traces - they need a transaction
      expect(traces).toHaveLength(0);
    });

    it('saves transactions', async () => {
      const transaction: TransactionData = {
        transaction_id: 'tx123',
        trace_id: 'trace456',
        name: 'Test Transaction',
        start_timestamp: new Date().toISOString(),
      };

      await storage.saveTransaction(transaction);
      const traces = await storage.getTraces();

      expect(traces).toHaveLength(1);
      expect(traces[0].transaction.name).toBe('Test Transaction');
    });

    it('generates IDs if not provided', async () => {
      await storage.saveTransaction({
        transaction_id: '',
        trace_id: '',
        name: 'Test',
        start_timestamp: new Date().toISOString(),
      });

      const traces = await storage.getTraces();
      expect(traces[0].transaction.transaction_id).toBeTruthy();
      expect(traces[0].trace_id).toBeTruthy();
    });

    it('associates spans with transactions', async () => {
      const traceId = 'trace123';

      await storage.saveTransaction({
        transaction_id: 'tx1',
        trace_id: traceId,
        name: 'Transaction',
        start_timestamp: new Date().toISOString(),
      });

      await storage.saveSpan({
        span_id: 'span1',
        trace_id: traceId,
        name: 'Child Span',
        start_timestamp: new Date().toISOString(),
      });

      const traces = await storage.getTraces();
      expect(traces[0].spans).toHaveLength(1);
      expect(traces[0].spans[0].name).toBe('Child Span');
    });

    it('filters traces by transaction name', async () => {
      await storage.saveTransaction({
        transaction_id: 'tx1',
        trace_id: 'trace1',
        name: 'GET /api/users',
        start_timestamp: new Date().toISOString(),
      });
      await storage.saveTransaction({
        transaction_id: 'tx2',
        trace_id: 'trace2',
        name: 'POST /api/orders',
        start_timestamp: new Date().toISOString(),
      });

      const traces = await storage.getTraces({ transactionName: '/users' });
      expect(traces).toHaveLength(1);
      expect(traces[0].transaction.name).toBe('GET /api/users');
    });

    it('filters traces by operation', async () => {
      await storage.saveTransaction({
        transaction_id: 'tx1',
        trace_id: 'trace1',
        name: 'Transaction 1',
        op: 'http.server',
        start_timestamp: new Date().toISOString(),
      });
      await storage.saveTransaction({
        transaction_id: 'tx2',
        trace_id: 'trace2',
        name: 'Transaction 2',
        op: 'db.query',
        start_timestamp: new Date().toISOString(),
      });

      const traces = await storage.getTraces({ op: 'http.server' });
      expect(traces).toHaveLength(1);
    });

    it('filters traces by status', async () => {
      await storage.saveTransaction({
        transaction_id: 'tx1',
        trace_id: 'trace1',
        name: 'Success',
        status: 'ok',
        start_timestamp: new Date().toISOString(),
      });
      await storage.saveTransaction({
        transaction_id: 'tx2',
        trace_id: 'trace2',
        name: 'Failed',
        status: 'internal_error',
        start_timestamp: new Date().toISOString(),
      });

      const okTraces = await storage.getTraces({ status: 'ok' });
      expect(okTraces).toHaveLength(1);
      expect(okTraces[0].transaction.name).toBe('Success');
    });

    it('calculates trace duration', async () => {
      const start = new Date().toISOString();
      const end = new Date(Date.now() + 5000).toISOString();

      await storage.saveTransaction({
        transaction_id: 'tx1',
        trace_id: 'trace1',
        name: 'Transaction',
        start_timestamp: start,
        timestamp: end,
      });

      const traces = await storage.getTraces();
      expect(traces[0].duration).toBeGreaterThan(0);
    });

    it('clears all traces', async () => {
      await storage.saveTransaction({
        transaction_id: 'tx1',
        trace_id: 'trace1',
        name: 'Transaction',
        start_timestamp: new Date().toISOString(),
      });
      await storage.saveSpan({
        span_id: 'span1',
        trace_id: 'trace1',
        name: 'Span',
        start_timestamp: new Date().toISOString(),
      });

      await storage.clearTraces();

      const traces = await storage.getTraces();
      expect(traces).toHaveLength(0);
    });

    it('enforces max spans limit', async () => {
      const smallStorage = new MemoryStorageProvider({ maxSpans: 3 });
      await smallStorage.init();

      for (let i = 0; i < 5; i++) {
        await smallStorage.saveSpan({
          span_id: `span${i}`,
          trace_id: 'trace1',
          name: `Span ${i}`,
          start_timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      // Stats method shows internal state
      const stats = smallStorage.getStats();
      expect(stats.spans).toBe(3);

      await smallStorage.close();
    });

    it('enforces max transactions limit', async () => {
      const smallStorage = new MemoryStorageProvider({ maxTransactions: 3 });
      await smallStorage.init();

      for (let i = 0; i < 5; i++) {
        await smallStorage.saveTransaction({
          transaction_id: `tx${i}`,
          trace_id: `trace${i}`,
          name: `Transaction ${i}`,
          start_timestamp: new Date(Date.now() + i * 1000).toISOString(),
        });
      }

      const traces = await smallStorage.getTraces();
      expect(traces).toHaveLength(3);

      await smallStorage.close();
    });
  });

  describe('getStats', () => {
    it('returns correct statistics', async () => {
      await storage.saveLog({ id: '1', message: 'log', level: 'info', timestamp: new Date().toISOString() });
      await storage.saveLog({ id: '2', message: 'log', level: 'info', timestamp: new Date().toISOString() });
      await storage.createSession({ id: 's1', startedAt: new Date().toISOString(), status: 'ok', errors: 0 });
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString() });
      await storage.saveSpan({ span_id: '1', trace_id: 't1', name: 'Span', start_timestamp: new Date().toISOString() });
      await storage.saveTransaction({ transaction_id: '1', trace_id: 't1', name: 'Tx', start_timestamp: new Date().toISOString() });

      const stats = storage.getStats();

      expect(stats.logs).toBe(2);
      expect(stats.sessions).toBe(1);
      expect(stats.events).toBe(1);
      expect(stats.spans).toBe(1);
      expect(stats.transactions).toBe(1);
    });
  });

  describe('clearAll', () => {
    it('clears all data', async () => {
      await storage.saveLog({ id: '1', message: 'log', level: 'info', timestamp: new Date().toISOString() });
      await storage.createSession({ id: 's1', startedAt: new Date().toISOString(), status: 'ok', errors: 0 });
      await storage.saveSentryEvent({ event_id: '1', timestamp: new Date().toISOString() });
      await storage.saveSpan({ span_id: '1', trace_id: 't1', name: 'Span', start_timestamp: new Date().toISOString() });
      await storage.saveTransaction({ transaction_id: '1', trace_id: 't1', name: 'Tx', start_timestamp: new Date().toISOString() });

      await storage.clearAll();

      const stats = storage.getStats();
      expect(stats.logs).toBe(0);
      expect(stats.sessions).toBe(0);
      expect(stats.events).toBe(0);
      expect(stats.spans).toBe(0);
      expect(stats.transactions).toBe(0);
    });
  });
});
