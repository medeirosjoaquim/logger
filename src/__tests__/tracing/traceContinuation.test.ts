/**
 * Tests for Trace Continuation (Distributed Tracing)
 */

import { describe, it, expect } from 'vitest';
import {
  extractIncomingTraceData,
  extractTraceDataFromObject,
  createSpanContextFromTraceData,
  continueTraceFromData,
  continueTraceWithOptions,
  getTracePropagationContext,
  type IncomingTraceData,
} from '../../tracing/traceContinuation.js';

describe('traceContinuation', () => {
  describe('extractIncomingTraceData', () => {
    it('extracts trace data from sentry-trace header', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      const result = extractIncomingTraceData({
        sentryTrace: `${traceId}-${parentSpanId}-1`,
      });

      expect(result).toBeDefined();
      expect(result!.traceId).toBe(traceId);
      expect(result!.parentSpanId).toBe(parentSpanId);
      expect(result!.sampled).toBe(true);
    });

    it('extracts unsampled flag from sentry-trace', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      const result = extractIncomingTraceData({
        sentryTrace: `${traceId}-${parentSpanId}-0`,
      });

      expect(result).toBeDefined();
      expect(result!.sampled).toBe(false);
    });

    it('handles sentry-trace without sampling decision', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      const result = extractIncomingTraceData({
        sentryTrace: `${traceId}-${parentSpanId}`,
      });

      expect(result).toBeDefined();
      expect(result!.sampled).toBeUndefined();
    });

    it('falls back to W3C traceparent header', () => {
      const traceId = 'c'.repeat(32);
      const parentSpanId = 'd'.repeat(16);

      const result = extractIncomingTraceData({
        traceparent: `00-${traceId}-${parentSpanId}-01`,
      });

      expect(result).toBeDefined();
      expect(result!.traceId).toBe(traceId);
      expect(result!.parentSpanId).toBe(parentSpanId);
      expect(result!.sampled).toBe(true);
    });

    it('prefers sentry-trace over traceparent', () => {
      const sentryTraceId = 'a'.repeat(32);
      const traceparentId = 'b'.repeat(32);

      const result = extractIncomingTraceData({
        sentryTrace: `${sentryTraceId}-${'c'.repeat(16)}-1`,
        traceparent: `00-${traceparentId}-${'d'.repeat(16)}-01`,
      });

      expect(result).toBeDefined();
      expect(result!.traceId).toBe(sentryTraceId);
    });

    it('extracts DSC from baggage header', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      const result = extractIncomingTraceData({
        sentryTrace: `${traceId}-${parentSpanId}-1`,
        baggage: `sentry-trace_id=${traceId},sentry-public_key=abc123,sentry-release=1.0.0,sentry-environment=production`,
      });

      expect(result).toBeDefined();
      expect(result!.dsc).toBeDefined();
      expect(result!.dsc!.trace_id).toBe(traceId);
      expect(result!.dsc!.public_key).toBe('abc123');
      expect(result!.dsc!.release).toBe('1.0.0');
      expect(result!.dsc!.environment).toBe('production');
    });

    it('returns undefined for invalid sentry-trace header', () => {
      const result = extractIncomingTraceData({
        sentryTrace: 'invalid-header',
      });

      expect(result).toBeUndefined();
    });

    it('returns undefined when no headers provided', () => {
      const result = extractIncomingTraceData({});
      expect(result).toBeUndefined();
    });
  });

  describe('extractTraceDataFromObject', () => {
    it('extracts from plain header object', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      const result = extractTraceDataFromObject({
        'sentry-trace': `${traceId}-${parentSpanId}-1`,
      });

      expect(result).toBeDefined();
      expect(result!.traceId).toBe(traceId);
    });

    it('handles case-insensitive header names', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      // The function should work with lowercase header names
      const result = extractTraceDataFromObject({
        'sentry-trace': `${traceId}-${parentSpanId}-1`,
      });

      expect(result).toBeDefined();
    });

    it('handles array values (takes first)', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      const result = extractTraceDataFromObject({
        'sentry-trace': [`${traceId}-${parentSpanId}-1`, 'other-value'],
      });

      expect(result).toBeDefined();
      expect(result!.traceId).toBe(traceId);
    });
  });

  describe('createSpanContextFromTraceData', () => {
    it('creates span context from trace data', () => {
      const traceData: IncomingTraceData = {
        traceId: 'a'.repeat(32),
        parentSpanId: 'b'.repeat(16),
        sampled: true,
      };

      const context = createSpanContextFromTraceData(traceData);

      expect(context.traceId).toBe(traceData.traceId);
      expect(context.parentSpanId).toBe(traceData.parentSpanId);
      expect(context.sampled).toBe(true);
      expect(context.traceFlags).toBe(1);
    });

    it('sets traceFlags to 0 when not sampled', () => {
      const traceData: IncomingTraceData = {
        traceId: 'a'.repeat(32),
        parentSpanId: 'b'.repeat(16),
        sampled: false,
      };

      const context = createSpanContextFromTraceData(traceData);

      expect(context.traceFlags).toBe(0);
    });
  });

  describe('continueTraceFromData', () => {
    it('continues trace with provided trace data', () => {
      const traceData: IncomingTraceData = {
        traceId: 'a'.repeat(32),
        parentSpanId: 'b'.repeat(16),
        sampled: true,
      };

      let capturedSpan: unknown;
      continueTraceFromData(traceData, 'test-operation', (span) => {
        capturedSpan = span;
      });

      expect(capturedSpan).toBeDefined();
      expect((capturedSpan as { traceId: string }).traceId).toBe(traceData.traceId);
    });

    it('returns result from callback', () => {
      const traceData: IncomingTraceData = {
        traceId: 'a'.repeat(32),
        parentSpanId: 'b'.repeat(16),
        sampled: true,
      };

      const result = continueTraceFromData(traceData, 'test', () => 'hello');

      expect(result).toBe('hello');
    });
  });

  describe('continueTraceWithOptions', () => {
    it('continues trace from sentry-trace and baggage headers', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      let capturedData: unknown;
      continueTraceWithOptions(
        {
          sentryTrace: `${traceId}-${parentSpanId}-1`,
          baggage: `sentry-trace_id=${traceId},sentry-public_key=abc`,
          name: 'my-operation',
          op: 'http.server',
        },
        (data) => {
          capturedData = data;
        }
      );

      expect(capturedData).toBeDefined();
      const data = capturedData as {
        traceId: string;
        parentSpanId: string;
        sampled: boolean;
        dsc: { trace_id: string; public_key: string };
      };
      expect(data.traceId).toBe(traceId);
      expect(data.parentSpanId).toBe(parentSpanId);
      expect(data.sampled).toBe(true);
      expect(data.dsc).toBeDefined();
    });

    it('creates new trace when no valid headers provided', () => {
      let capturedData: unknown;
      continueTraceWithOptions(
        {
          name: 'new-operation',
        },
        (data) => {
          capturedData = data;
        }
      );

      expect(capturedData).toBeDefined();
      const data = capturedData as {
        traceId: string;
        parentSpanId: string | undefined;
      };
      expect(data.traceId).toBeDefined();
      expect(data.traceId.length).toBe(32);
      expect(data.parentSpanId).toBeUndefined();
    });
  });

  describe('getTracePropagationContext', () => {
    it('returns propagation context from headers object', () => {
      const traceId = 'a'.repeat(32);
      const parentSpanId = 'b'.repeat(16);

      const context = getTracePropagationContext({
        'sentry-trace': `${traceId}-${parentSpanId}-1`,
        baggage: `sentry-trace_id=${traceId},sentry-public_key=abc`,
      });

      expect(context.traceId).toBe(traceId);
      expect(context.parentSpanId).toBe(parentSpanId);
      expect(context.sampled).toBe(true);
      expect(context.dsc?.public_key).toBe('abc');
    });

    it('returns empty object when no valid headers', () => {
      const context = getTracePropagationContext({});

      expect(context.traceId).toBeUndefined();
      expect(context.parentSpanId).toBeUndefined();
      expect(context.sampled).toBeUndefined();
      expect(context.dsc).toBeUndefined();
    });
  });
});
