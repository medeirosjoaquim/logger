/**
 * Propagation Context Tests
 *
 * Tests for trace context propagation utilities.
 */

import { describe, it, expect } from 'vitest';
import {
  generatePropagationContext,
  createChildPropagationContext,
  generateTraceId,
  generateSpanId,
  parseTraceparent,
  serializeTraceparent,
  parseBaggage,
  serializeBaggage,
  extractPropagationContext,
  injectPropagationContext,
  type PropagationContext,
  type DynamicSamplingContext,
} from '../../scope/propagationContext';

describe('Propagation Context', () => {
  describe('generateTraceId', () => {
    it('generates 32-character hex string', () => {
      const id = generateTraceId();

      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 50; i++) {
        ids.add(generateTraceId());
      }

      expect(ids.size).toBe(50);
    });
  });

  describe('generateSpanId', () => {
    it('generates 16-character hex string', () => {
      const id = generateSpanId();

      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 50; i++) {
        ids.add(generateSpanId());
      }

      expect(ids.size).toBe(50);
    });
  });

  describe('generatePropagationContext', () => {
    it('generates context with trace and span IDs', () => {
      const context = generatePropagationContext();

      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
      expect(context.traceId).toHaveLength(32);
      expect(context.spanId).toHaveLength(16);
    });

    it('sampled is undefined by default', () => {
      const context = generatePropagationContext();

      expect(context.sampled).toBeUndefined();
    });
  });

  describe('createChildPropagationContext', () => {
    it('creates child with same trace ID', () => {
      const parent = generatePropagationContext();
      const child = createChildPropagationContext(parent);

      expect(child.traceId).toBe(parent.traceId);
    });

    it('creates child with new span ID', () => {
      const parent = generatePropagationContext();
      const child = createChildPropagationContext(parent);

      expect(child.spanId).not.toBe(parent.spanId);
    });

    it('sets parent span ID in child', () => {
      const parent = generatePropagationContext();
      const child = createChildPropagationContext(parent);

      expect(child.parentSpanId).toBe(parent.spanId);
    });

    it('inherits sampling decision from parent', () => {
      const parent: PropagationContext = {
        traceId: generateTraceId(),
        spanId: generateSpanId(),
        sampled: true,
      };
      const child = createChildPropagationContext(parent);

      expect(child.sampled).toBe(true);
    });

    it('inherits DSC from parent', () => {
      const dsc: DynamicSamplingContext = {
        trace_id: generateTraceId(),
        public_key: 'abc123',
        release: '1.0.0',
      };
      const parent: PropagationContext = {
        traceId: dsc.trace_id!,
        spanId: generateSpanId(),
        dsc,
      };
      const child = createChildPropagationContext(parent);

      expect(child.dsc).toEqual(dsc);
    });
  });

  describe('parseTraceparent', () => {
    it('parses valid W3C traceparent header', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      const context = parseTraceparent(traceparent);

      expect(context).toBeDefined();
      expect(context?.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(context?.spanId).toBe('b7ad6b7169203331');
      expect(context?.sampled).toBe(true);
    });

    it('parses sampled=false from flags', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00';
      const context = parseTraceparent(traceparent);

      expect(context?.sampled).toBe(false);
    });

    it('returns undefined for invalid format', () => {
      expect(parseTraceparent('invalid')).toBeUndefined();
      expect(parseTraceparent('')).toBeUndefined();
      expect(parseTraceparent('00-abc-def-01')).toBeUndefined();
    });

    it('returns undefined for version ff (reserved)', () => {
      const traceparent = 'ff-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01';
      expect(parseTraceparent(traceparent)).toBeUndefined();
    });

    it('returns undefined for all-zero trace ID', () => {
      const traceparent = '00-00000000000000000000000000000000-b7ad6b7169203331-01';
      expect(parseTraceparent(traceparent)).toBeUndefined();
    });

    it('returns undefined for all-zero span ID', () => {
      const traceparent = '00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01';
      expect(parseTraceparent(traceparent)).toBeUndefined();
    });

    it('is case insensitive', () => {
      const traceparent = '00-0AF7651916CD43DD8448EB211C80319C-B7AD6B7169203331-01';
      const context = parseTraceparent(traceparent);

      expect(context).toBeDefined();
      expect(context?.traceId).toBe('0AF7651916CD43DD8448EB211C80319C');
    });
  });

  describe('serializeTraceparent', () => {
    it('serializes context to W3C traceparent format', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        sampled: true,
      };
      const traceparent = serializeTraceparent(context);

      expect(traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    });

    it('sets flags to 00 when not sampled', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        sampled: false,
      };
      const traceparent = serializeTraceparent(context);

      expect(traceparent.endsWith('-00')).toBe(true);
    });

    it('sets flags to 00 when sampled is undefined', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
      };
      const traceparent = serializeTraceparent(context);

      expect(traceparent.endsWith('-00')).toBe(true);
    });

    it('round-trips with parseTraceparent', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        sampled: true,
      };
      const traceparent = serializeTraceparent(context);
      const parsed = parseTraceparent(traceparent);

      expect(parsed?.traceId).toBe(context.traceId);
      expect(parsed?.spanId).toBe(context.spanId);
      expect(parsed?.sampled).toBe(context.sampled);
    });
  });

  describe('parseBaggage', () => {
    it('parses baggage header with sentry keys', () => {
      const baggage = 'sentry-trace_id=abc123,sentry-release=1.0.0,sentry-environment=production';
      const dsc = parseBaggage(baggage);

      expect(dsc).toBeDefined();
      expect(dsc?.trace_id).toBe('abc123');
      expect(dsc?.release).toBe('1.0.0');
      expect(dsc?.environment).toBe('production');
    });

    it('ignores non-sentry keys', () => {
      const baggage = 'sentry-release=1.0.0,other-key=value';
      const dsc = parseBaggage(baggage);

      expect(dsc?.release).toBe('1.0.0');
      expect(dsc).not.toHaveProperty('other-key');
    });

    it('decodes URL-encoded values', () => {
      const baggage = 'sentry-transaction=GET%20%2Fapi%2Fusers';
      const dsc = parseBaggage(baggage);

      expect(dsc?.transaction).toBe('GET /api/users');
    });

    it('handles empty baggage', () => {
      expect(parseBaggage('')).toBeUndefined();
    });

    it('handles baggage with no sentry keys', () => {
      const baggage = 'key1=value1,key2=value2';
      expect(parseBaggage(baggage)).toBeUndefined();
    });

    it('handles malformed items gracefully', () => {
      const baggage = 'sentry-release=1.0.0,malformed,sentry-environment=production';
      const dsc = parseBaggage(baggage);

      expect(dsc?.release).toBe('1.0.0');
      expect(dsc?.environment).toBe('production');
    });
  });

  describe('serializeBaggage', () => {
    it('serializes DSC to baggage format', () => {
      const dsc: DynamicSamplingContext = {
        trace_id: 'abc123',
        release: '1.0.0',
        environment: 'production',
      };
      const baggage = serializeBaggage(dsc);

      expect(baggage).toContain('sentry-trace-id=abc123');
      expect(baggage).toContain('sentry-release=1.0.0');
      expect(baggage).toContain('sentry-environment=production');
    });

    it('URL-encodes values', () => {
      const dsc: DynamicSamplingContext = {
        transaction: 'GET /api/users',
      };
      const baggage = serializeBaggage(dsc);

      expect(baggage).toContain(encodeURIComponent('GET /api/users'));
    });

    it('skips undefined and null values', () => {
      const dsc: DynamicSamplingContext = {
        trace_id: 'abc123',
        release: undefined,
      };
      const baggage = serializeBaggage(dsc);

      expect(baggage).toContain('sentry-trace-id=abc123');
      expect(baggage).not.toContain('release');
    });

    it('handles empty DSC', () => {
      const dsc: DynamicSamplingContext = {};
      const baggage = serializeBaggage(dsc);

      expect(baggage).toBe('');
    });

    it('round-trips with parseBaggage', () => {
      const dsc: DynamicSamplingContext = {
        trace_id: 'abc123',
        release: '1.0.0',
        environment: 'production',
      };
      const baggage = serializeBaggage(dsc);
      const parsed = parseBaggage(baggage);

      expect(parsed?.trace_id).toBe(dsc.trace_id);
      expect(parsed?.release).toBe(dsc.release);
      expect(parsed?.environment).toBe(dsc.environment);
    });
  });

  describe('extractPropagationContext', () => {
    it('extracts context from headers', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
        baggage: 'sentry-release=1.0.0',
      };
      const context = extractPropagationContext(headers);

      expect(context).toBeDefined();
      expect(context?.traceId).toBe('0af7651916cd43dd8448eb211c80319c');
      expect(context?.spanId).toBe('b7ad6b7169203331');
      expect(context?.dsc?.release).toBe('1.0.0');
    });

    it('returns undefined without traceparent', () => {
      const headers = {
        baggage: 'sentry-release=1.0.0',
      };
      expect(extractPropagationContext(headers)).toBeUndefined();
    });

    it('returns context without DSC if no baggage', () => {
      const headers = {
        traceparent: '00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01',
      };
      const context = extractPropagationContext(headers);

      expect(context).toBeDefined();
      expect(context?.dsc).toBeUndefined();
    });

    it('returns undefined for invalid traceparent', () => {
      const headers = {
        traceparent: 'invalid',
      };
      expect(extractPropagationContext(headers)).toBeUndefined();
    });
  });

  describe('injectPropagationContext', () => {
    it('injects traceparent into headers', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        sampled: true,
      };
      const headers: Record<string, string> = {};

      injectPropagationContext(context, headers);

      expect(headers.traceparent).toBe('00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01');
    });

    it('injects baggage when DSC present', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        dsc: {
          release: '1.0.0',
          environment: 'production',
        },
      };
      const headers: Record<string, string> = {};

      injectPropagationContext(context, headers);

      expect(headers.baggage).toContain('sentry-release=1.0.0');
      expect(headers.baggage).toContain('sentry-environment=production');
    });

    it('merges with existing baggage', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        dsc: {
          release: '1.0.0',
        },
      };
      const headers: Record<string, string> = {
        baggage: 'other-key=value',
      };

      injectPropagationContext(context, headers);

      expect(headers.baggage).toContain('other-key=value');
      expect(headers.baggage).toContain('sentry-release=1.0.0');
    });

    it('replaces existing sentry baggage entries', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
        dsc: {
          release: '2.0.0',
        },
      };
      const headers: Record<string, string> = {
        baggage: 'sentry-release=1.0.0,other-key=value',
      };

      injectPropagationContext(context, headers);

      expect(headers.baggage).toContain('sentry-release=2.0.0');
      expect(headers.baggage).not.toContain('sentry-release=1.0.0');
    });

    it('does not inject baggage when no DSC', () => {
      const context: PropagationContext = {
        traceId: '0af7651916cd43dd8448eb211c80319c',
        spanId: 'b7ad6b7169203331',
      };
      const headers: Record<string, string> = {};

      injectPropagationContext(context, headers);

      expect(headers.baggage).toBeUndefined();
    });

    it('returns the headers object', () => {
      const context = generatePropagationContext();
      const headers: Record<string, string> = {};

      const result = injectPropagationContext(context, headers);

      expect(result).toBe(headers);
    });
  });

  describe('integration scenarios', () => {
    it('full round-trip: generate -> inject -> extract', () => {
      // Server generates context
      const serverContext = generatePropagationContext();
      serverContext.sampled = true;
      serverContext.dsc = {
        trace_id: serverContext.traceId,
        public_key: 'abc123',
        release: '1.0.0',
        environment: 'production',
      };

      // Inject into headers
      const headers: Record<string, string> = {};
      injectPropagationContext(serverContext, headers);

      // Client extracts context
      const clientContext = extractPropagationContext(headers);

      expect(clientContext?.traceId).toBe(serverContext.traceId);
      expect(clientContext?.spanId).toBe(serverContext.spanId);
      expect(clientContext?.sampled).toBe(true);
      expect(clientContext?.dsc?.release).toBe('1.0.0');
    });

    it('propagates through multiple services', () => {
      // Service A creates initial context
      const serviceAContext = generatePropagationContext();
      serviceAContext.sampled = true;

      // Service A sends to Service B
      const headersAB: Record<string, string> = {};
      injectPropagationContext(serviceAContext, headersAB);

      // Service B extracts and creates child
      const serviceBContextIn = extractPropagationContext(headersAB)!;
      const serviceBContext = createChildPropagationContext(serviceBContextIn);

      // Service B sends to Service C
      const headersBC: Record<string, string> = {};
      injectPropagationContext(serviceBContext, headersBC);

      // Service C extracts
      const serviceCContext = extractPropagationContext(headersBC)!;

      // All should share the same trace ID
      expect(serviceCContext.traceId).toBe(serviceAContext.traceId);

      // The extracted context's spanId is Service B's span (from traceparent header)
      // parentSpanId is only set in createChildPropagationContext, not during extraction
      expect(serviceCContext.spanId).toBe(serviceBContext.spanId);
    });
  });
});
