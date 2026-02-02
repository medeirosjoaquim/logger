/**
 * Tests for Structured Logger
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  StructuredLogger,
  getLogger,
  initLogger,
  resetLogger,
  logger,
} from '../../structuredLogs/logger';
import type { LogRecord, LogAttributes } from '../../structuredLogs/types';

describe('StructuredLogger', () => {
  let testLogger: StructuredLogger;

  beforeEach(() => {
    resetLogger();
    testLogger = new StructuredLogger({
      enabled: true,
      minLevel: 'trace',
      flushInterval: 0, // Disable auto-flush for tests
    });
  });

  afterEach(() => {
    testLogger.destroy();
    resetLogger();
  });

  describe('log level methods', () => {
    it('should log trace messages', () => {
      testLogger.trace('trace message');
      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('trace');
      expect(buffer[0].message).toBe('trace message');
    });

    it('should log debug messages', () => {
      testLogger.debug('debug message');
      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('debug');
      expect(buffer[0].message).toBe('debug message');
    });

    it('should log info messages', () => {
      testLogger.info('info message');
      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('info');
      expect(buffer[0].message).toBe('info message');
    });

    it('should log warn messages', () => {
      testLogger.warn('warn message');
      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('warn');
      expect(buffer[0].message).toBe('warn message');
    });

    it('should log error messages', () => {
      testLogger.error('error message');
      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('error');
      expect(buffer[0].message).toBe('error message');
    });

    it('should log fatal messages', () => {
      testLogger.fatal('fatal message');
      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('fatal');
      expect(buffer[0].message).toBe('fatal message');
    });
  });

  describe('attributes', () => {
    it('should include attributes in log records', () => {
      testLogger.info('message with attributes', {
        userId: '123',
        count: 42,
        active: true,
      });

      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].attributes.userId).toBe('123');
      expect(buffer[0].attributes.count).toBe(42);
      expect(buffer[0].attributes.active).toBe(true);
    });

    it('should merge default attributes with per-log attributes', () => {
      testLogger.setDefaultAttributes({ app: 'test-app', version: '1.0.0' });
      testLogger.info('message', { userId: '123' });

      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].attributes.app).toBe('test-app');
      expect(buffer[0].attributes.version).toBe('1.0.0');
      expect(buffer[0].attributes.userId).toBe('123');
    });

    it('should allow per-log attributes to override defaults', () => {
      testLogger.setDefaultAttributes({ app: 'default-app' });
      testLogger.info('message', { app: 'custom-app' });

      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].attributes.app).toBe('custom-app');
    });
  });

  describe('template literal support (fmt)', () => {
    it('should format template literals correctly', () => {
      const userId = '123';
      const action = 'login';
      const message = testLogger.fmt`User ${userId} performed ${action}`;

      expect(message.toString()).toBe('User 123 performed login');
    });

    it('should store template metadata', () => {
      const userId = '123';
      const action = 'login';
      const message = testLogger.fmt`User ${userId} performed ${action}`;

      testLogger.info(message);

      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].message).toBe('User 123 performed login');
      expect(buffer[0].messageTemplate).toBe('User {0} performed {1}');
      expect(buffer[0].messageParams).toEqual(['123', 'login']);
      expect(buffer[0].attributes['message.template']).toBe('User {0} performed {1}');
      expect(buffer[0].attributes['message.parameter.0']).toBe('123');
      expect(buffer[0].attributes['message.parameter.1']).toBe('login');
    });

    it('should handle numbers and booleans in templates', () => {
      const count = 42;
      const active = true;
      const message = testLogger.fmt`Count: ${count}, Active: ${active}`;

      testLogger.info(message);

      const buffer = testLogger.getBuffer();
      expect(buffer[0].message).toBe('Count: 42, Active: true');
      expect(buffer[0].attributes['message.parameter.0']).toBe(42);
      expect(buffer[0].attributes['message.parameter.1']).toBe(true);
    });
  });

  describe('minimum level filtering', () => {
    it('should filter logs below minimum level', () => {
      const filteredLogger = new StructuredLogger({
        minLevel: 'info',
        flushInterval: 0,
      });

      filteredLogger.trace('trace');
      filteredLogger.debug('debug');
      filteredLogger.info('info');
      filteredLogger.warn('warn');

      const buffer = filteredLogger.getBuffer();
      expect(buffer).toHaveLength(2);
      expect(buffer[0].level).toBe('info');
      expect(buffer[1].level).toBe('warn');

      filteredLogger.destroy();
    });

    it('should allow all levels when minLevel is trace', () => {
      testLogger.trace('trace');
      testLogger.debug('debug');
      testLogger.info('info');
      testLogger.warn('warn');
      testLogger.error('error');
      testLogger.fatal('fatal');

      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(6);
    });
  });

  describe('beforeSendLog hook', () => {
    it('should allow modifying logs', () => {
      const modifyingLogger = new StructuredLogger({
        flushInterval: 0,
        beforeSendLog: (log) => ({
          ...log,
          attributes: { ...log.attributes, modified: true },
        }),
      });

      modifyingLogger.info('test');

      const buffer = modifyingLogger.getBuffer();
      expect(buffer[0].attributes.modified).toBe(true);

      modifyingLogger.destroy();
    });

    it('should allow dropping logs', () => {
      const filteringLogger = new StructuredLogger({
        flushInterval: 0,
        beforeSendLog: (log) => {
          if (log.level === 'debug') {
            return null;
          }
          return log;
        },
      });

      filteringLogger.debug('should be dropped');
      filteringLogger.info('should be kept');

      const buffer = filteringLogger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].level).toBe('info');

      filteringLogger.destroy();
    });

    it('should allow filtering sensitive data', () => {
      const sanitizingLogger = new StructuredLogger({
        flushInterval: 0,
        beforeSendLog: (log) => {
          const newAttributes = { ...log.attributes };
          if ('password' in newAttributes) {
            delete newAttributes.password;
          }
          return { ...log, attributes: newAttributes };
        },
      });

      sanitizingLogger.info('login', { username: 'user', password: 'secret' });

      const buffer = sanitizingLogger.getBuffer();
      expect(buffer[0].attributes.username).toBe('user');
      expect(buffer[0].attributes.password).toBeUndefined();

      sanitizingLogger.destroy();
    });
  });

  describe('enabled state', () => {
    it('should not log when disabled', () => {
      const disabledLogger = new StructuredLogger({
        enabled: false,
        flushInterval: 0,
      });

      disabledLogger.info('should not be logged');

      const buffer = disabledLogger.getBuffer();
      expect(buffer).toHaveLength(0);

      disabledLogger.destroy();
    });

    it('should respect configure() changes to enabled', () => {
      testLogger.info('logged');
      testLogger.configure({ enabled: false });
      testLogger.info('not logged');

      const buffer = testLogger.getBuffer();
      expect(buffer).toHaveLength(1);
    });
  });

  describe('buffer management', () => {
    it('should clear buffer on clearBuffer()', () => {
      testLogger.info('message 1');
      testLogger.info('message 2');
      expect(testLogger.getBuffer()).toHaveLength(2);

      testLogger.clearBuffer();
      expect(testLogger.getBuffer()).toHaveLength(0);
    });

    it('should flush when buffer reaches max size', async () => {
      const flushCallback = vi.fn();
      const smallBufferLogger = new StructuredLogger({
        maxBufferSize: 3,
        flushInterval: 0,
      });
      smallBufferLogger.setOnFlush(flushCallback);

      smallBufferLogger.info('1');
      smallBufferLogger.info('2');
      expect(flushCallback).not.toHaveBeenCalled();

      smallBufferLogger.info('3'); // This should trigger flush
      await new Promise((resolve) => setTimeout(resolve, 10)); // Allow async flush

      expect(flushCallback).toHaveBeenCalled();
      smallBufferLogger.destroy();
    });

    it('should call onFlush callback when flushing', async () => {
      const flushCallback = vi.fn();
      testLogger.setOnFlush(flushCallback);

      testLogger.info('test');
      await testLogger.flush();

      expect(flushCallback).toHaveBeenCalledTimes(1);
      expect(flushCallback).toHaveBeenCalledWith([
        expect.objectContaining({
          level: 'info',
          message: 'test',
        }),
      ]);
    });
  });

  describe('timestamp and log ID', () => {
    it('should generate timestamps', () => {
      const beforeTime = Date.now() / 1000;
      testLogger.info('test');
      const afterTime = Date.now() / 1000;

      const buffer = testLogger.getBuffer();
      expect(buffer[0].timestamp).toBeGreaterThanOrEqual(beforeTime);
      expect(buffer[0].timestamp).toBeLessThanOrEqual(afterTime);
    });

    it('should generate unique log IDs', () => {
      testLogger.info('first');
      testLogger.info('second');

      const buffer = testLogger.getBuffer();
      expect(buffer[0].logId).toBeDefined();
      expect(buffer[1].logId).toBeDefined();
      expect(buffer[0].logId).not.toBe(buffer[1].logId);
    });

    it('should include severity number', () => {
      testLogger.info('test');

      const buffer = testLogger.getBuffer();
      expect(buffer[0].severityNumber).toBe(9); // info = 9 (OpenTelemetry compatible)
    });
  });

  describe('singleton API', () => {
    it('should return same instance from getLogger()', () => {
      const logger1 = getLogger();
      const logger2 = getLogger();
      expect(logger1).toBe(logger2);
    });

    it('should create new instance on initLogger()', () => {
      const logger1 = getLogger();
      const logger2 = initLogger({ minLevel: 'error' });
      expect(logger1).not.toBe(logger2);
    });

    it('should reset instance on resetLogger()', () => {
      const logger1 = getLogger();
      logger1.info('test');
      expect(logger1.getBuffer()).toHaveLength(1);

      resetLogger();
      const logger2 = getLogger();
      expect(logger2.getBuffer()).toHaveLength(0);
    });
  });

  describe('exported logger object', () => {
    beforeEach(() => {
      resetLogger();
    });

    it('should have all log level methods', () => {
      expect(typeof logger.trace).toBe('function');
      expect(typeof logger.debug).toBe('function');
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.fatal).toBe('function');
    });

    it('should have fmt method', () => {
      expect(typeof logger.fmt).toBe('function');
    });

    it('should log through the singleton', () => {
      logger.info('test message', { key: 'value' });

      const buffer = logger.getBuffer();
      expect(buffer).toHaveLength(1);
      expect(buffer[0].message).toBe('test message');
      expect(buffer[0].attributes.key).toBe('value');
    });
  });
});
