/**
 * Test Helper Utilities
 *
 * Provides mock objects and factory functions for tests.
 */

import { vi } from 'vitest';
import type { StorageProvider, LogEntry, SentryEvent, LogFilter, SentryEventFilter, TraceFilter, LogSession, SpanData, TransactionData, TraceData, SeverityLevel } from '../storage/types';
import type { Event, EventHint, Breadcrumb, User } from '../types/sentry';

/**
 * Create a mock storage provider
 */
export function mockStorage(): StorageProvider {
  return {
    name: 'mock',
    isReady: vi.fn(() => true),
    init: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    saveLog: vi.fn().mockResolvedValue(undefined),
    getLogs: vi.fn().mockResolvedValue([]),
    clearLogs: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(undefined),
    updateSession: vi.fn().mockResolvedValue(undefined),
    endSession: vi.fn().mockResolvedValue(undefined),
    getSessions: vi.fn().mockResolvedValue([]),
    getSession: vi.fn().mockResolvedValue(null),
    deleteSession: vi.fn().mockResolvedValue(undefined),
    saveSentryEvent: vi.fn().mockResolvedValue(undefined),
    getSentryEvents: vi.fn().mockResolvedValue([]),
    clearSentryEvents: vi.fn().mockResolvedValue(undefined),
    saveSpan: vi.fn().mockResolvedValue(undefined),
    saveTransaction: vi.fn().mockResolvedValue(undefined),
    getTraces: vi.fn().mockResolvedValue([]),
    clearTraces: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Create a test Sentry event
 */
export function createTestEvent(overrides: Partial<Event> = {}): Event {
  return {
    event_id: '12345678901234567890123456789012',
    timestamp: Date.now() / 1000,
    platform: 'javascript',
    level: 'error',
    ...overrides,
  };
}

/**
 * Create a test Sentry event with storage format
 */
export function createTestSentryEvent(overrides: Partial<SentryEvent> = {}): SentryEvent {
  return {
    event_id: '12345678901234567890123456789012',
    timestamp: new Date().toISOString(),
    platform: 'javascript',
    level: 'error',
    ...overrides,
  };
}

/**
 * Create a test log entry
 */
export function createTestLogEntry(overrides: Partial<LogEntry> = {}): LogEntry {
  return {
    id: 'test-log-id',
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Test log message',
    ...overrides,
  };
}

/**
 * Create a test log session
 */
export function createTestSession(overrides: Partial<LogSession> = {}): LogSession {
  return {
    id: 'test-session-id',
    startedAt: new Date().toISOString(),
    status: 'ok',
    errors: 0,
    ...overrides,
  };
}

/**
 * Create a test span data object
 */
export function createTestSpanData(overrides: Partial<SpanData> = {}): SpanData {
  return {
    span_id: 'abcdef1234567890',
    trace_id: '12345678901234567890123456789012',
    name: 'Test Span',
    start_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test transaction data object
 */
export function createTestTransactionData(overrides: Partial<TransactionData> = {}): TransactionData {
  return {
    transaction_id: 'test-transaction-id',
    trace_id: '12345678901234567890123456789012',
    name: 'Test Transaction',
    start_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test trace data object
 */
export function createTestTraceData(overrides: Partial<TraceData> = {}): TraceData {
  const transaction = createTestTransactionData();
  return {
    trace_id: '12345678901234567890123456789012',
    transaction,
    spans: [],
    start_timestamp: new Date().toISOString(),
    ...overrides,
  };
}

/**
 * Create a test exception
 */
export function createTestException(message: string = 'Test error'): Error {
  const error = new Error(message);
  error.name = 'TestError';
  return error;
}

/**
 * Create a test user
 */
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: '123',
    email: 'test@example.com',
    username: 'testuser',
    ...overrides,
  };
}

/**
 * Create a test breadcrumb
 */
export function createTestBreadcrumb(overrides: Partial<Breadcrumb> = {}): Breadcrumb {
  return {
    type: 'default',
    category: 'test',
    message: 'Test breadcrumb',
    timestamp: Date.now() / 1000,
    level: 'info',
    ...overrides,
  };
}

/**
 * Create a test event hint
 */
export function createTestEventHint(overrides: Partial<EventHint> = {}): EventHint {
  return {
    event_id: '12345678901234567890123456789012',
    ...overrides,
  };
}

/**
 * Generate a valid 32-character event ID
 */
export function generateEventId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a valid 16-character span ID
 */
export function generateSpanId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 16; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a valid 32-character trace ID
 */
export function generateTraceId(): string {
  const chars = '0123456789abcdef';
  let result = '';
  for (let i = 0; i < 32; i++) {
    result += chars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Create a mock console for testing console integrations
 */
export function mockConsole(): {
  log: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  debug: ReturnType<typeof vi.fn>;
} {
  return {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
    debug: vi.fn(),
  };
}

/**
 * Create a mock fetch function
 */
export function mockFetch(
  response: Partial<Response> = {}
): ReturnType<typeof vi.fn> {
  const defaultResponse = {
    ok: true,
    status: 200,
    statusText: 'OK',
    headers: new Headers(),
    json: vi.fn().mockResolvedValue({}),
    text: vi.fn().mockResolvedValue(''),
    ...response,
  };

  return vi.fn().mockResolvedValue(defaultResponse);
}

/**
 * Wait for a specified amount of time
 */
export function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Create a Chrome-style stack trace string
 */
export function createChromeStackTrace(): string {
  return `Error: test error
    at functionName (http://example.com/file.js:10:5)
    at anotherFunction (http://example.com/file.js:20:10)
    at http://example.com/other.js:30:15
    at async asyncFunction (http://example.com/async.js:40:20)`;
}

/**
 * Create a Firefox-style stack trace string
 */
export function createFirefoxStackTrace(): string {
  return `functionName@http://example.com/file.js:10:5
anotherFunction@http://example.com/file.js:20:10
@http://example.com/other.js:30:15
asyncFunction@http://example.com/async.js:40:20`;
}

/**
 * Create a Safari-style stack trace string
 */
export function createSafariStackTrace(): string {
  return `functionName@http://example.com/file.js:10:5
anotherFunction@http://example.com/file.js:20:10
global code@http://example.com/other.js:30:15
asyncFunction@http://example.com/async.js:40:20`;
}
