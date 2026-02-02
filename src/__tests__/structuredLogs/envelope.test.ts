/**
 * Tests for Log Envelope Formatting
 */

import { describe, it, expect } from 'vitest';
import {
  logRecordToEnvelopeItem,
  convertAttributesToEnvelopeFormat,
  createLogBatch,
  createLogEnvelope,
  serializeLogEnvelope,
  parseLogEnvelope,
  getLogEnvelopeSize,
  splitIntoEnvelopes,
  mergeLogEnvelopes,
} from '../../structuredLogs/envelope';
import type { LogRecord } from '../../structuredLogs/types';

describe('Log Envelope', () => {
  const createTestLogRecord = (overrides: Partial<LogRecord> = {}): LogRecord => ({
    level: 'info',
    message: 'Test message',
    attributes: { userId: '123', count: 42 },
    timestamp: 1704067200, // 2024-01-01T00:00:00Z
    traceId: 'abc123def456',
    spanId: 'span123',
    logId: 'log123',
    severityNumber: 9,
    severityText: 'INFO',
    ...overrides,
  });

  describe('logRecordToEnvelopeItem', () => {
    it('should convert a log record to envelope item format', () => {
      const record = createTestLogRecord();
      const item = logRecordToEnvelopeItem(record);

      expect(item.timestamp).toBe(1704067200);
      expect(item.level).toBe('info');
      expect(item.body).toBe('Test message');
      expect(item.trace_id).toBe('abc123def456');
      expect(item.span_id).toBe('span123');
      expect(item.severity_number).toBe(9);
      expect(item.severity_text).toBe('INFO');
    });

    it('should convert attributes to envelope format', () => {
      const record = createTestLogRecord();
      const item = logRecordToEnvelopeItem(record);

      expect(item.attributes).toEqual({
        userId: { type: 'string', value: '123' },
        count: { type: 'integer', value: 42 },
      });
    });

    it('should handle records without trace context', () => {
      const record = createTestLogRecord({
        traceId: undefined,
        spanId: undefined,
      });
      const item = logRecordToEnvelopeItem(record);

      expect(item.trace_id).toBeUndefined();
      expect(item.span_id).toBeUndefined();
    });

    it('should handle records without attributes', () => {
      const record = createTestLogRecord({ attributes: {} });
      const item = logRecordToEnvelopeItem(record);

      expect(item.attributes).toBeUndefined();
    });
  });

  describe('convertAttributesToEnvelopeFormat', () => {
    it('should convert string attributes', () => {
      const result = convertAttributesToEnvelopeFormat({ name: 'test' });
      expect(result.name).toEqual({ type: 'string', value: 'test' });
    });

    it('should convert integer attributes', () => {
      const result = convertAttributesToEnvelopeFormat({ count: 42 });
      expect(result.count).toEqual({ type: 'integer', value: 42 });
    });

    it('should convert float attributes', () => {
      const result = convertAttributesToEnvelopeFormat({ ratio: 3.14 });
      expect(result.ratio).toEqual({ type: 'double', value: 3.14 });
    });

    it('should convert boolean attributes', () => {
      const result = convertAttributesToEnvelopeFormat({ active: true });
      expect(result.active).toEqual({ type: 'boolean', value: true });
    });

    it('should skip null and undefined values', () => {
      const result = convertAttributesToEnvelopeFormat({
        name: 'test',
        empty: null as unknown as string,
        missing: undefined as unknown as string,
      });

      expect(result.name).toBeDefined();
      expect(result.empty).toBeUndefined();
      expect(result.missing).toBeUndefined();
    });
  });

  describe('createLogBatch', () => {
    it('should create a batch from multiple records', () => {
      const records = [
        createTestLogRecord({ message: 'First' }),
        createTestLogRecord({ message: 'Second' }),
        createTestLogRecord({ message: 'Third' }),
      ];

      const batch = createLogBatch(records);

      expect(batch.items).toHaveLength(3);
      expect(batch.items[0].body).toBe('First');
      expect(batch.items[1].body).toBe('Second');
      expect(batch.items[2].body).toBe('Third');
    });

    it('should handle empty array', () => {
      const batch = createLogBatch([]);
      expect(batch.items).toHaveLength(0);
    });
  });

  describe('createLogEnvelope', () => {
    it('should create a complete envelope', () => {
      const records = [createTestLogRecord()];
      const envelope = createLogEnvelope(records, {
        sdkName: 'universal-logger',
        sdkVersion: '1.0.0',
        release: 'app@1.0.0',
        environment: 'production',
      });

      expect(envelope.headers.sent_at).toBeDefined();
      expect(envelope.headers.sdk).toEqual({
        name: 'universal-logger',
        version: '1.0.0',
      });
      expect(envelope.headers.trace?.release).toBe('app@1.0.0');
      expect(envelope.headers.trace?.environment).toBe('production');
      expect(envelope.items).toHaveLength(1);
      expect(envelope.items[0].header.type).toBe('log');
    });

    it('should include trace context from records', () => {
      const records = [
        createTestLogRecord({ traceId: 'trace-abc' }),
      ];
      const envelope = createLogEnvelope(records);

      expect(envelope.headers.trace?.trace_id).toBe('trace-abc');
    });

    it('should handle records without trace context', () => {
      const records = [
        createTestLogRecord({ traceId: undefined }),
      ];
      const envelope = createLogEnvelope(records);

      expect(envelope.headers.trace?.trace_id).toBeUndefined();
    });
  });

  describe('serializeLogEnvelope', () => {
    it('should serialize envelope to newline-delimited JSON', () => {
      const records = [createTestLogRecord({ message: 'Test' })];
      const envelope = createLogEnvelope(records);
      const serialized = serializeLogEnvelope(envelope);

      const lines = serialized.split('\n');
      expect(lines.length).toBe(3); // header, item header, item payload

      // Verify each line is valid JSON
      lines.forEach((line) => {
        expect(() => JSON.parse(line)).not.toThrow();
      });
    });

    it('should produce parseable output', () => {
      const records = [
        createTestLogRecord({ message: 'First' }),
        createTestLogRecord({ message: 'Second' }),
      ];
      const envelope = createLogEnvelope(records);
      const serialized = serializeLogEnvelope(envelope);
      const parsed = parseLogEnvelope(serialized);

      expect(parsed.items).toHaveLength(1);
      expect(parsed.items[0].payload.items).toHaveLength(2);
      expect(parsed.items[0].payload.items[0].body).toBe('First');
      expect(parsed.items[0].payload.items[1].body).toBe('Second');
    });
  });

  describe('parseLogEnvelope', () => {
    it('should parse serialized envelope correctly', () => {
      const original = createLogEnvelope([createTestLogRecord()], {
        sdkName: 'test-sdk',
        sdkVersion: '1.0.0',
      });
      const serialized = serializeLogEnvelope(original);
      const parsed = parseLogEnvelope(serialized);

      expect(parsed.headers.sdk?.name).toBe('test-sdk');
      expect(parsed.headers.sdk?.version).toBe('1.0.0');
      expect(parsed.items).toHaveLength(1);
    });

    it('should throw on empty data', () => {
      expect(() => parseLogEnvelope('')).toThrow('Invalid log envelope');
    });
  });

  describe('getLogEnvelopeSize', () => {
    it('should return envelope size in bytes', () => {
      const envelope = createLogEnvelope([createTestLogRecord()]);
      const size = getLogEnvelopeSize(envelope);

      expect(typeof size).toBe('number');
      expect(size).toBeGreaterThan(0);
    });

    it('should increase with more records', () => {
      const smallEnvelope = createLogEnvelope([createTestLogRecord()]);
      const largeEnvelope = createLogEnvelope([
        createTestLogRecord(),
        createTestLogRecord(),
        createTestLogRecord(),
      ]);

      const smallSize = getLogEnvelopeSize(smallEnvelope);
      const largeSize = getLogEnvelopeSize(largeEnvelope);

      expect(largeSize).toBeGreaterThan(smallSize);
    });
  });

  describe('splitIntoEnvelopes', () => {
    it('should split records into multiple envelopes', () => {
      const records = Array(10).fill(null).map((_, i) =>
        createTestLogRecord({ message: `Message ${i}` })
      );

      const envelopes = splitIntoEnvelopes(records, 3);

      expect(envelopes).toHaveLength(4); // 3 + 3 + 3 + 1
      expect(envelopes[0].items[0].payload.items).toHaveLength(3);
      expect(envelopes[3].items[0].payload.items).toHaveLength(1);
    });

    it('should handle records fewer than batch size', () => {
      const records = [createTestLogRecord()];
      const envelopes = splitIntoEnvelopes(records, 100);

      expect(envelopes).toHaveLength(1);
      expect(envelopes[0].items[0].payload.items).toHaveLength(1);
    });

    it('should handle empty records array', () => {
      const envelopes = splitIntoEnvelopes([]);
      expect(envelopes).toHaveLength(0);
    });
  });

  describe('mergeLogEnvelopes', () => {
    it('should merge multiple envelopes into one', () => {
      const env1 = createLogEnvelope([createTestLogRecord({ message: 'First' })]);
      const env2 = createLogEnvelope([createTestLogRecord({ message: 'Second' })]);
      const env3 = createLogEnvelope([createTestLogRecord({ message: 'Third' })]);

      const merged = mergeLogEnvelopes([env1, env2, env3]);

      expect(merged.items).toHaveLength(1);
      expect(merged.items[0].payload.items).toHaveLength(3);
      expect(merged.items[0].payload.items[0].body).toBe('First');
      expect(merged.items[0].payload.items[1].body).toBe('Second');
      expect(merged.items[0].payload.items[2].body).toBe('Third');
    });

    it('should update SDK info if provided', () => {
      const env = createLogEnvelope([createTestLogRecord()], {
        sdkName: 'old-sdk',
        sdkVersion: '1.0.0',
      });

      const merged = mergeLogEnvelopes([env], {
        sdkName: 'new-sdk',
        sdkVersion: '2.0.0',
      });

      expect(merged.headers.sdk?.name).toBe('new-sdk');
      expect(merged.headers.sdk?.version).toBe('2.0.0');
    });
  });
});
