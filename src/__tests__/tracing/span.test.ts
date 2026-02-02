/**
 * Span Tests
 *
 * Tests for the Span class representing a unit of work in distributed tracing.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Span } from '../../tracing/span';
import {
  spanToJSON,
  getActiveSpan,
  setActiveSpan,
  withActiveSpan,
  getRootSpan,
  getAllSpans,
  isDescendantOf,
  getSpanStatusFromHttpCode,
  setHttpStatus,
  isErrorStatus,
  isOkStatus,
  createErrorStatus,
  createOkStatus,
  getSpanDurationMs,
  timestampInSeconds,
} from '../../tracing/spanUtils';

describe('Span', () => {
  describe('constructor', () => {
    it('creates span with required options', () => {
      const span = new Span({ name: 'test' });

      expect(span.name).toBe('test');
      expect(span.spanId).toBeDefined();
      expect(span.traceId).toBeDefined();
      expect(span.spanId.length).toBe(16);
      expect(span.traceId.length).toBe(32);
    });

    it('accepts custom trace ID', () => {
      const traceId = '12345678901234567890123456789012';
      const span = new Span({ name: 'test', traceId });

      expect(span.traceId).toBe(traceId);
    });

    it('accepts parent span ID', () => {
      const parentSpanId = '1234567890123456';
      const span = new Span({ name: 'test', parentSpanId });

      expect(span.parentSpanId).toBe(parentSpanId);
    });

    it('accepts operation type', () => {
      const span = new Span({ name: 'test', op: 'http.client' });

      expect(span.op).toBe('http.client');
    });

    it('accepts initial attributes', () => {
      const span = new Span({
        name: 'test',
        attributes: { key: 'value', num: 42 },
      });

      expect(span.attributes.key).toBe('value');
      expect(span.attributes.num).toBe(42);
    });

    it('accepts initial tags', () => {
      const span = new Span({
        name: 'test',
        tags: { tag1: 'value1' },
      });

      expect(span.tags.tag1).toBe('value1');
    });

    it('accepts initial data', () => {
      const span = new Span({
        name: 'test',
        data: { extra: 'data' },
      });

      expect(span.data.extra).toBe('data');
    });

    it('accepts sampled flag', () => {
      const span = new Span({ name: 'test', sampled: true });

      expect(span.sampled).toBe(true);
    });

    it('accepts custom start time', () => {
      const startTime = 1234567890.123;
      const span = new Span({ name: 'test', startTime });

      expect(span.startTimestamp).toBe(startTime);
    });

    it('uses current time if start time not provided', () => {
      const before = Date.now() / 1000;
      const span = new Span({ name: 'test' });
      const after = Date.now() / 1000;

      expect(span.startTimestamp).toBeGreaterThanOrEqual(before);
      expect(span.startTimestamp).toBeLessThanOrEqual(after);
    });

    it('starts with unset status', () => {
      const span = new Span({ name: 'test' });

      expect(span.status.code).toBe('unset');
    });
  });

  describe('lifecycle', () => {
    it('tracks recording state before end', () => {
      const span = new Span({ name: 'test' });

      expect(span.isRecording()).toBe(true);
    });

    it('tracks recording state after end', () => {
      const span = new Span({ name: 'test' });
      span.end();

      expect(span.isRecording()).toBe(false);
    });

    it('sets end timestamp on end', () => {
      const span = new Span({ name: 'test' });
      expect(span.endTimestamp).toBeUndefined();

      span.end();

      expect(span.endTimestamp).toBeDefined();
    });

    it('accepts custom end timestamp', () => {
      const span = new Span({ name: 'test' });
      const endTime = 1234567890.456;

      span.end(endTime);

      expect(span.endTimestamp).toBe(endTime);
    });

    it('ignores multiple end calls', () => {
      const span = new Span({ name: 'test' });
      span.end(1000);
      span.end(2000);

      expect(span.endTimestamp).toBe(1000);
    });
  });

  describe('attributes', () => {
    it('sets a single attribute', () => {
      const span = new Span({ name: 'test' });
      span.setAttribute('key', 'value');

      expect(span.attributes.key).toBe('value');
    });

    it('sets multiple attributes', () => {
      const span = new Span({ name: 'test' });
      span.setAttributes({ a: 'string', b: 42, c: true });

      expect(span.attributes.a).toBe('string');
      expect(span.attributes.b).toBe(42);
      expect(span.attributes.c).toBe(true);
    });

    it('returns this for chaining', () => {
      const span = new Span({ name: 'test' });
      const result = span.setAttribute('key', 'value');

      expect(result).toBe(span);
    });

    it('does not set attributes after span ends', () => {
      const span = new Span({ name: 'test' });
      span.end();
      span.setAttribute('key', 'value');

      expect(span.attributes.key).toBeUndefined();
    });

    it('returns copy of attributes', () => {
      const span = new Span({ name: 'test' });
      span.setAttribute('key', 'value');

      const attrs = span.attributes;
      attrs.key = 'modified';

      expect(span.attributes.key).toBe('value');
    });
  });

  describe('tags', () => {
    it('sets a tag', () => {
      const span = new Span({ name: 'test' });
      span.setTag('key', 'value');

      expect(span.tags.key).toBe('value');
    });

    it('returns this for chaining', () => {
      const span = new Span({ name: 'test' });
      const result = span.setTag('key', 'value');

      expect(result).toBe(span);
    });

    it('does not set tags after span ends', () => {
      const span = new Span({ name: 'test' });
      span.end();
      span.setTag('key', 'value');

      expect(span.tags.key).toBeUndefined();
    });
  });

  describe('data', () => {
    it('sets data', () => {
      const span = new Span({ name: 'test' });
      span.setData('key', { nested: true });

      expect(span.data.key).toEqual({ nested: true });
    });

    it('returns this for chaining', () => {
      const span = new Span({ name: 'test' });
      const result = span.setData('key', 'value');

      expect(result).toBe(span);
    });

    it('does not set data after span ends', () => {
      const span = new Span({ name: 'test' });
      span.end();
      span.setData('key', 'value');

      expect(span.data.key).toBeUndefined();
    });
  });

  describe('status', () => {
    it('sets status with code', () => {
      const span = new Span({ name: 'test' });
      span.setStatus('ok');

      expect(span.status.code).toBe('ok');
    });

    it('sets status with object', () => {
      const span = new Span({ name: 'test' });
      span.setStatus({ code: 'error', message: 'Something went wrong' });

      expect(span.status.code).toBe('error');
      expect(span.status.message).toBe('Something went wrong');
    });

    it('returns this for chaining', () => {
      const span = new Span({ name: 'test' });
      const result = span.setStatus('ok');

      expect(result).toBe(span);
    });
  });

  describe('name', () => {
    it('can update span name', () => {
      const span = new Span({ name: 'original' });
      span.name = 'updated';

      expect(span.name).toBe('updated');
    });

    it('updateName returns this for chaining', () => {
      const span = new Span({ name: 'test' });
      const result = span.updateName('new name');

      expect(result).toBe(span);
      expect(span.name).toBe('new name');
    });
  });

  describe('op', () => {
    it('can update operation', () => {
      const span = new Span({ name: 'test' });
      span.op = 'db.query';

      expect(span.op).toBe('db.query');
    });
  });

  describe('parent-child relationships', () => {
    it('maintains parent relationship via parentSpanId', () => {
      const parent = new Span({ name: 'parent' });
      const child = new Span({
        name: 'child',
        parentSpanId: parent.spanId,
        traceId: parent.traceId,
      });

      expect(child.parentSpanId).toBe(parent.spanId);
      expect(child.traceId).toBe(parent.traceId);
    });

    it('starts child span from parent', () => {
      const parent = new Span({ name: 'parent' });
      const child = parent.startChild({ name: 'child' });

      expect(child.parentSpanId).toBe(parent.spanId);
      expect(child.traceId).toBe(parent.traceId);
    });

    it('adds child to parent children array', () => {
      const parent = new Span({ name: 'parent' });
      const child = parent.startChild({ name: 'child' });

      expect(parent.children).toContain(child);
    });

    it('child inherits sampling decision from parent', () => {
      const parent = new Span({ name: 'parent', sampled: true });
      const child = parent.startChild({ name: 'child' });

      expect(child.sampled).toBe(true);
    });

    it('child can override sampling decision', () => {
      const parent = new Span({ name: 'parent', sampled: true });
      const child = parent.startChild({ name: 'child', sampled: false });

      expect(child.sampled).toBe(false);
    });

    it('gets parent span', () => {
      const parent = new Span({ name: 'parent' });
      const child = parent.startChild({ name: 'child' });

      expect(child.getParent()).toBe(parent);
    });

    it('addChild sets up proper relationship', () => {
      const parent = new Span({ name: 'parent' });
      const child = new Span({ name: 'child' });

      parent.addChild(child);

      expect(child.parentSpanId).toBe(parent.spanId);
      expect(child.traceId).toBe(parent.traceId);
      expect(child.getParent()).toBe(parent);
    });
  });

  describe('spanContext', () => {
    it('returns span context', () => {
      const span = new Span({ name: 'test', sampled: true });
      const context = span.spanContext();

      expect(context.traceId).toBe(span.traceId);
      expect(context.spanId).toBe(span.spanId);
      expect(context.sampled).toBe(true);
    });

    it('includes trace flags', () => {
      const sampledSpan = new Span({ name: 'test', sampled: true });
      const unsampledSpan = new Span({ name: 'test', sampled: false });

      expect(sampledSpan.spanContext().traceFlags).toBe(1);
      expect(unsampledSpan.spanContext().traceFlags).toBe(0);
    });

    it('includes parent span ID if present', () => {
      const parent = new Span({ name: 'parent' });
      const child = parent.startChild({ name: 'child' });

      expect(child.spanContext().parentSpanId).toBe(parent.spanId);
    });
  });

  describe('toJSON', () => {
    it('serializes span to JSON', () => {
      const span = new Span({
        name: 'test span',
        op: 'http.client',
      });
      span.end();

      const json = span.toJSON();

      expect(json.span_id).toBe(span.spanId);
      expect(json.trace_id).toBe(span.traceId);
      expect(json.description).toBe('test span');
      expect(json.op).toBe('http.client');
      expect(json.start_timestamp).toBeDefined();
      expect(json.timestamp).toBeDefined();
    });

    it('includes tags in JSON', () => {
      const span = new Span({ name: 'test' });
      span.setTag('key', 'value');
      span.end();

      const json = span.toJSON();

      expect(json.tags).toEqual({ key: 'value' });
    });

    it('merges attributes and data in JSON', () => {
      const span = new Span({ name: 'test' });
      span.setAttribute('attr', 'attrValue');
      span.setData('data', 'dataValue');
      span.end();

      const json = span.toJSON();

      expect(json.data?.attr).toBe('attrValue');
      expect(json.data?.data).toBe('dataValue');
    });

    it('includes status in JSON when not unset', () => {
      const span = new Span({ name: 'test' });
      span.setStatus('ok');
      span.end();

      const json = span.toJSON();

      expect(json.status).toBe('ok');
    });

    it('omits status in JSON when unset', () => {
      const span = new Span({ name: 'test' });
      span.end();

      const json = span.toJSON();

      expect(json.status).toBeUndefined();
    });
  });

  describe('getDuration', () => {
    it('returns undefined for recording span', () => {
      const span = new Span({ name: 'test' });

      expect(span.getDuration()).toBeUndefined();
    });

    it('returns duration in seconds for ended span', () => {
      const span = new Span({ name: 'test', startTime: 1000 });
      span.end(1001.5);

      expect(span.getDuration()).toBe(1.5);
    });
  });
});

describe('spanUtils', () => {
  describe('spanToJSON', () => {
    it('converts span to JSON', () => {
      const span = new Span({ name: 'test' });
      const json = spanToJSON(span);

      expect(json.description).toBe('test');
    });
  });

  describe('active span management', () => {
    beforeEach(() => {
      setActiveSpan(undefined);
    });

    it('getActiveSpan returns undefined when no active span', () => {
      expect(getActiveSpan()).toBeUndefined();
    });

    it('setActiveSpan sets the active span', () => {
      const span = new Span({ name: 'test' });
      setActiveSpan(span);

      expect(getActiveSpan()).toBe(span);
    });
  });

  describe('withActiveSpan', () => {
    beforeEach(() => {
      setActiveSpan(undefined);
    });

    it('sets active span during callback', () => {
      const span = new Span({ name: 'test' });
      let capturedSpan: Span | undefined;

      withActiveSpan(span, () => {
        capturedSpan = getActiveSpan();
      });

      expect(capturedSpan).toBe(span);
    });

    it('restores previous span after callback', () => {
      const outerSpan = new Span({ name: 'outer' });
      const innerSpan = new Span({ name: 'inner' });

      setActiveSpan(outerSpan);

      withActiveSpan(innerSpan, () => {
        expect(getActiveSpan()).toBe(innerSpan);
      });

      expect(getActiveSpan()).toBe(outerSpan);
    });

    it('restores previous span even if callback throws', () => {
      const outerSpan = new Span({ name: 'outer' });
      const innerSpan = new Span({ name: 'inner' });

      setActiveSpan(outerSpan);

      try {
        withActiveSpan(innerSpan, () => {
          throw new Error('test error');
        });
      } catch {
        // Expected
      }

      expect(getActiveSpan()).toBe(outerSpan);
    });

    it('returns callback result', () => {
      const span = new Span({ name: 'test' });

      const result = withActiveSpan(span, () => 42);

      expect(result).toBe(42);
    });
  });

  describe('getRootSpan', () => {
    it('returns the span itself if no parent', () => {
      const span = new Span({ name: 'root' });

      expect(getRootSpan(span)).toBe(span);
    });

    it('returns root span from child', () => {
      const root = new Span({ name: 'root' });
      const child = root.startChild({ name: 'child' });
      const grandchild = child.startChild({ name: 'grandchild' });

      expect(getRootSpan(grandchild)).toBe(root);
    });
  });

  describe('getAllSpans', () => {
    it('returns all spans in tree', () => {
      const root = new Span({ name: 'root' });
      const child1 = root.startChild({ name: 'child1' });
      const child2 = root.startChild({ name: 'child2' });
      const grandchild = child1.startChild({ name: 'grandchild' });

      const allSpans = getAllSpans(root);

      expect(allSpans).toHaveLength(4);
      expect(allSpans).toContain(root);
      expect(allSpans).toContain(child1);
      expect(allSpans).toContain(child2);
      expect(allSpans).toContain(grandchild);
    });
  });

  describe('isDescendantOf', () => {
    it('returns true for direct child', () => {
      const parent = new Span({ name: 'parent' });
      const child = parent.startChild({ name: 'child' });

      expect(isDescendantOf(child, parent)).toBe(true);
    });

    it('returns true for grandchild', () => {
      const grandparent = new Span({ name: 'grandparent' });
      const parent = grandparent.startChild({ name: 'parent' });
      const child = parent.startChild({ name: 'child' });

      expect(isDescendantOf(child, grandparent)).toBe(true);
    });

    it('returns false for unrelated spans', () => {
      const span1 = new Span({ name: 'span1' });
      const span2 = new Span({ name: 'span2' });

      expect(isDescendantOf(span1, span2)).toBe(false);
    });

    it('returns false for parent-child check in wrong direction', () => {
      const parent = new Span({ name: 'parent' });
      const child = parent.startChild({ name: 'child' });

      expect(isDescendantOf(parent, child)).toBe(false);
    });
  });

  describe('HTTP status utilities', () => {
    it('getSpanStatusFromHttpCode returns ok for 2xx', () => {
      expect(getSpanStatusFromHttpCode(200).code).toBe('ok');
      expect(getSpanStatusFromHttpCode(201).code).toBe('ok');
      expect(getSpanStatusFromHttpCode(299).code).toBe('ok');
    });

    it('getSpanStatusFromHttpCode returns ok for 3xx', () => {
      expect(getSpanStatusFromHttpCode(301).code).toBe('ok');
      expect(getSpanStatusFromHttpCode(304).code).toBe('ok');
    });

    it('getSpanStatusFromHttpCode returns error for 4xx', () => {
      expect(getSpanStatusFromHttpCode(400).code).toBe('error');
      expect(getSpanStatusFromHttpCode(404).code).toBe('error');
      expect(getSpanStatusFromHttpCode(429).code).toBe('error');
    });

    it('getSpanStatusFromHttpCode returns error for 5xx', () => {
      expect(getSpanStatusFromHttpCode(500).code).toBe('error');
      expect(getSpanStatusFromHttpCode(503).code).toBe('error');
    });

    it('getSpanStatusFromHttpCode includes message for known status codes', () => {
      expect(getSpanStatusFromHttpCode(404).message).toBe('not_found');
      expect(getSpanStatusFromHttpCode(401).message).toBe('unauthenticated');
      expect(getSpanStatusFromHttpCode(403).message).toBe('permission_denied');
      expect(getSpanStatusFromHttpCode(500).message).toBe('internal_error');
    });

    it('setHttpStatus sets status code attribute and span status', () => {
      const span = new Span({ name: 'test' });
      setHttpStatus(span, 404);

      expect(span.attributes['http.response.status_code']).toBe(404);
      expect(span.status.code).toBe('error');
    });
  });

  describe('status utilities', () => {
    it('isErrorStatus returns true for error status', () => {
      expect(isErrorStatus({ code: 'error' })).toBe(true);
    });

    it('isErrorStatus returns false for ok status', () => {
      expect(isErrorStatus({ code: 'ok' })).toBe(false);
    });

    it('isOkStatus returns true for ok status', () => {
      expect(isOkStatus({ code: 'ok' })).toBe(true);
    });

    it('isOkStatus returns false for error status', () => {
      expect(isOkStatus({ code: 'error' })).toBe(false);
    });

    it('createErrorStatus creates error status', () => {
      const status = createErrorStatus('Something went wrong');

      expect(status.code).toBe('error');
      expect(status.message).toBe('Something went wrong');
    });

    it('createOkStatus creates ok status', () => {
      const status = createOkStatus();

      expect(status.code).toBe('ok');
    });
  });

  describe('timing utilities', () => {
    it('timestampInSeconds returns current time in seconds', () => {
      const before = Date.now() / 1000;
      const timestamp = timestampInSeconds();
      const after = Date.now() / 1000;

      expect(timestamp).toBeGreaterThanOrEqual(before);
      expect(timestamp).toBeLessThanOrEqual(after);
    });

    it('getSpanDurationMs returns duration in milliseconds', () => {
      const span = new Span({ name: 'test', startTime: 1 });
      span.end(2);

      expect(getSpanDurationMs(span)).toBe(1000);
    });

    it('getSpanDurationMs returns undefined for recording span', () => {
      const span = new Span({ name: 'test' });

      expect(getSpanDurationMs(span)).toBeUndefined();
    });
  });
});
