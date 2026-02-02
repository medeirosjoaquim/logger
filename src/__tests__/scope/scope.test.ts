/**
 * Scope Tests
 *
 * Tests for the Scope class that holds contextual data applied to events.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Scope } from '../../scope/scope';
import type { Breadcrumb, Event, EventHint, SeverityLevel, User } from '../../types/sentry';

describe('Scope', () => {
  let scope: Scope;

  beforeEach(() => {
    scope = new Scope();
  });

  describe('user management', () => {
    it('sets and gets user', () => {
      scope.setUser({ id: '123', email: 'test@test.com' });
      expect(scope.getUser()?.id).toBe('123');
      expect(scope.getUser()?.email).toBe('test@test.com');
    });

    it('clears user with null', () => {
      scope.setUser({ id: '123' });
      expect(scope.getUser()?.id).toBe('123');

      scope.setUser(null);
      expect(scope.getUser()).toBeUndefined();
    });

    it('returns this for chaining', () => {
      const result = scope.setUser({ id: '123' });
      expect(result).toBe(scope);
    });

    it('handles user with all properties', () => {
      const user: User = {
        id: '123',
        email: 'test@test.com',
        username: 'testuser',
        ip_address: '127.0.0.1',
        segment: 'premium',
      };

      scope.setUser(user);
      const retrieved = scope.getUser();

      expect(retrieved).toEqual(user);
    });
  });

  describe('tags', () => {
    it('sets individual tags', () => {
      scope.setTag('key', 'value');
      expect(scope.getTag('key')).toBe('value');
    });

    it('sets multiple tags', () => {
      scope.setTags({ a: '1', b: '2' });
      expect(scope.getTags()).toEqual({ a: '1', b: '2' });
    });

    it('merges tags when setting multiple times', () => {
      scope.setTags({ a: '1', b: '2' });
      scope.setTags({ c: '3' });
      expect(scope.getTags()).toEqual({ a: '1', b: '2', c: '3' });
    });

    it('overwrites existing tags with same key', () => {
      scope.setTag('key', 'value1');
      scope.setTag('key', 'value2');
      expect(scope.getTag('key')).toBe('value2');
    });

    it('returns undefined for non-existent tag', () => {
      expect(scope.getTag('nonexistent')).toBeUndefined();
    });

    it('returns a copy of tags to prevent mutation', () => {
      scope.setTags({ a: '1' });
      const tags = scope.getTags();
      tags.b = '2';
      expect(scope.getTag('b')).toBeUndefined();
    });

    it('returns this for chaining', () => {
      const result1 = scope.setTag('key', 'value');
      const result2 = scope.setTags({ a: '1' });
      expect(result1).toBe(scope);
      expect(result2).toBe(scope);
    });
  });

  describe('extras', () => {
    it('sets a single extra value', () => {
      scope.setExtra('key', 'value');
      expect(scope.getExtra('key')).toBe('value');
    });

    it('sets multiple extras at once', () => {
      scope.setExtras({ a: 1, b: 'string', c: { nested: true } });
      expect(scope.getExtras()).toEqual({ a: 1, b: 'string', c: { nested: true } });
    });

    it('merges extras when setting multiple times', () => {
      scope.setExtras({ a: 1 });
      scope.setExtras({ b: 2 });
      expect(scope.getExtras()).toEqual({ a: 1, b: 2 });
    });

    it('handles various data types', () => {
      scope.setExtra('string', 'test');
      scope.setExtra('number', 42);
      scope.setExtra('boolean', true);
      scope.setExtra('array', [1, 2, 3]);
      scope.setExtra('object', { key: 'value' });
      scope.setExtra('null', null);
      scope.setExtra('undefined', undefined);

      expect(scope.getExtra('string')).toBe('test');
      expect(scope.getExtra('number')).toBe(42);
      expect(scope.getExtra('boolean')).toBe(true);
      expect(scope.getExtra('array')).toEqual([1, 2, 3]);
      expect(scope.getExtra('object')).toEqual({ key: 'value' });
      expect(scope.getExtra('null')).toBeNull();
      expect(scope.getExtra('undefined')).toBeUndefined();
    });

    it('returns this for chaining', () => {
      const result1 = scope.setExtra('key', 'value');
      const result2 = scope.setExtras({ a: 1 });
      expect(result1).toBe(scope);
      expect(result2).toBe(scope);
    });
  });

  describe('contexts', () => {
    it('sets a context', () => {
      scope.setContext('device', { model: 'iPhone' });
      expect(scope.getContext('device')).toEqual({ model: 'iPhone' });
    });

    it('removes context with null', () => {
      scope.setContext('device', { model: 'iPhone' });
      scope.setContext('device', null);
      expect(scope.getContext('device')).toBeUndefined();
    });

    it('gets all contexts', () => {
      scope.setContext('device', { model: 'iPhone' });
      scope.setContext('browser', { name: 'Chrome' });
      expect(scope.getContexts()).toEqual({
        device: { model: 'iPhone' },
        browser: { name: 'Chrome' },
      });
    });

    it('returns deep cloned contexts', () => {
      scope.setContext('test', { nested: { value: 1 } });
      const contexts = scope.getContexts();
      contexts.test.nested = { value: 2 };
      expect(scope.getContext('test')).toEqual({ nested: { value: 1 } });
    });

    it('returns this for chaining', () => {
      const result = scope.setContext('key', { value: 1 });
      expect(result).toBe(scope);
    });
  });

  describe('breadcrumbs', () => {
    it('adds breadcrumbs', () => {
      scope.addBreadcrumb({ message: 'test' });
      expect(scope.getBreadcrumbs()).toHaveLength(1);
      expect(scope.getBreadcrumbs()[0].message).toBe('test');
    });

    it('adds timestamp if not provided', () => {
      scope.addBreadcrumb({ message: 'test' });
      const breadcrumbs = scope.getBreadcrumbs();
      expect(breadcrumbs[0].timestamp).toBeDefined();
      expect(typeof breadcrumbs[0].timestamp).toBe('number');
    });

    it('preserves provided timestamp', () => {
      const timestamp = 1234567890;
      scope.addBreadcrumb({ message: 'test', timestamp });
      expect(scope.getBreadcrumbs()[0].timestamp).toBe(timestamp);
    });

    it('respects maxBreadcrumbs default limit (100)', () => {
      for (let i = 0; i < 150; i++) {
        scope.addBreadcrumb({ message: `test ${i}` });
      }
      expect(scope.getBreadcrumbs()).toHaveLength(100);
    });

    it('respects custom maxBreadcrumbs limit', () => {
      for (let i = 0; i < 150; i++) {
        scope.addBreadcrumb({ message: `test ${i}` }, 50);
      }
      expect(scope.getBreadcrumbs()).toHaveLength(50);
    });

    it('keeps most recent breadcrumbs when exceeding limit', () => {
      for (let i = 0; i < 20; i++) {
        scope.addBreadcrumb({ message: `test ${i}` }, 10);
      }
      const breadcrumbs = scope.getBreadcrumbs();
      expect(breadcrumbs).toHaveLength(10);
      // Should have breadcrumbs 10-19 (most recent)
      expect(breadcrumbs[0].message).toBe('test 10');
      expect(breadcrumbs[9].message).toBe('test 19');
    });

    it('clears breadcrumbs', () => {
      scope.addBreadcrumb({ message: 'test1' });
      scope.addBreadcrumb({ message: 'test2' });
      scope.clearBreadcrumbs();
      expect(scope.getBreadcrumbs()).toHaveLength(0);
    });

    it('returns a copy of breadcrumbs', () => {
      scope.addBreadcrumb({ message: 'test' });
      const breadcrumbs = scope.getBreadcrumbs();
      breadcrumbs.push({ message: 'new' });
      expect(scope.getBreadcrumbs()).toHaveLength(1);
    });

    it('returns this for chaining', () => {
      const result = scope.addBreadcrumb({ message: 'test' });
      expect(result).toBe(scope);
    });
  });

  describe('fingerprint', () => {
    it('sets fingerprint', () => {
      scope.setFingerprint(['custom', 'fingerprint']);
      expect(scope.getFingerprint()).toEqual(['custom', 'fingerprint']);
    });

    it('returns a copy of fingerprint', () => {
      scope.setFingerprint(['a', 'b']);
      const fingerprint = scope.getFingerprint();
      fingerprint.push('c');
      expect(scope.getFingerprint()).toEqual(['a', 'b']);
    });

    it('replaces existing fingerprint', () => {
      scope.setFingerprint(['a']);
      scope.setFingerprint(['b', 'c']);
      expect(scope.getFingerprint()).toEqual(['b', 'c']);
    });

    it('returns this for chaining', () => {
      const result = scope.setFingerprint(['test']);
      expect(result).toBe(scope);
    });
  });

  describe('level', () => {
    it('sets level', () => {
      scope.setLevel('error');
      expect(scope.getLevel()).toBe('error');
    });

    it('accepts all severity levels', () => {
      const levels: SeverityLevel[] = ['fatal', 'error', 'warning', 'log', 'info', 'debug'];
      for (const level of levels) {
        scope.setLevel(level);
        expect(scope.getLevel()).toBe(level);
      }
    });

    it('returns this for chaining', () => {
      const result = scope.setLevel('info');
      expect(result).toBe(scope);
    });
  });

  describe('transaction name', () => {
    it('sets transaction name', () => {
      scope.setTransactionName('GET /api/users');
      expect(scope.getTransactionName()).toBe('GET /api/users');
    });

    it('returns this for chaining', () => {
      const result = scope.setTransactionName('test');
      expect(result).toBe(scope);
    });
  });

  describe('span', () => {
    it('sets and gets span', () => {
      const mockSpan = {
        spanId: 'abc123',
        traceId: 'def456',
        name: 'test span',
        startTimestamp: Date.now() / 1000,
      };
      scope.setSpan(mockSpan);
      expect(scope.getSpan()).toEqual(mockSpan);
    });

    it('clears span with undefined', () => {
      const mockSpan = { spanId: 'abc123', traceId: 'def456', name: 'test', startTimestamp: Date.now() / 1000 };
      scope.setSpan(mockSpan);
      scope.setSpan(undefined);
      expect(scope.getSpan()).toBeUndefined();
    });

    it('returns this for chaining', () => {
      const result = scope.setSpan(undefined);
      expect(result).toBe(scope);
    });
  });

  describe('event processors', () => {
    it('adds event processor', () => {
      const processor = vi.fn((event) => event);
      scope.addEventProcessor(processor);
      expect(scope.getEventProcessors()).toHaveLength(1);
    });

    it('returns a copy of event processors', () => {
      const processor = vi.fn((event) => event);
      scope.addEventProcessor(processor);
      const processors = scope.getEventProcessors();
      processors.push(vi.fn());
      expect(scope.getEventProcessors()).toHaveLength(1);
    });

    it('returns this for chaining', () => {
      const result = scope.addEventProcessor((event) => event);
      expect(result).toBe(scope);
    });
  });

  describe('propagation context', () => {
    it('generates propagation context on construction', () => {
      const context = scope.getPropagationContext();
      expect(context.traceId).toBeDefined();
      expect(context.spanId).toBeDefined();
      expect(context.traceId.length).toBe(32);
      expect(context.spanId.length).toBe(16);
    });

    it('sets propagation context', () => {
      const context = {
        traceId: '12345678901234567890123456789012',
        spanId: '1234567890123456',
        sampled: true,
      };
      scope.setPropagationContext(context);
      expect(scope.getPropagationContext()).toEqual(context);
    });

    it('returns a copy of propagation context', () => {
      const original = scope.getPropagationContext();
      const retrieved = scope.getPropagationContext();
      retrieved.traceId = 'modified';
      expect(scope.getPropagationContext().traceId).toBe(original.traceId);
    });

    it('returns this for chaining', () => {
      const result = scope.setPropagationContext({ traceId: 'test', spanId: 'test' });
      expect(result).toBe(scope);
    });
  });

  describe('clone', () => {
    it('creates independent copy', () => {
      scope.setTag('key', 'value');

      const clone = scope.clone();
      clone.setTag('key', 'different');

      expect(scope.getTag('key')).toBe('value');
      expect(clone.getTag('key')).toBe('different');
    });

    it('clones all scope properties', () => {
      scope.setUser({ id: '123' });
      scope.setTags({ tag: 'value' });
      scope.setExtras({ extra: 'data' });
      scope.setContext('ctx', { key: 'value' });
      scope.addBreadcrumb({ message: 'test' });
      scope.setFingerprint(['fp']);
      scope.setLevel('error');
      scope.setTransactionName('tx');
      scope.setPropagationContext({ traceId: 'abc', spanId: 'def' });

      const clone = scope.clone();

      expect(clone.getUser()).toEqual({ id: '123' });
      expect(clone.getTags()).toEqual({ tag: 'value' });
      expect(clone.getExtras()).toEqual({ extra: 'data' });
      expect(clone.getContext('ctx')).toEqual({ key: 'value' });
      expect(clone.getBreadcrumbs()).toHaveLength(1);
      expect(clone.getFingerprint()).toEqual(['fp']);
      expect(clone.getLevel()).toBe('error');
      expect(clone.getTransactionName()).toBe('tx');
      expect(clone.getPropagationContext()).toEqual({ traceId: 'abc', spanId: 'def' });
    });

    it('modifications to clone do not affect original', () => {
      scope.setTags({ a: '1' });
      scope.addBreadcrumb({ message: 'original' });

      const clone = scope.clone();
      clone.setTags({ b: '2' });
      clone.addBreadcrumb({ message: 'cloned' });

      expect(scope.getTags()).toEqual({ a: '1' });
      expect(scope.getBreadcrumbs()).toHaveLength(1);
      expect(clone.getTags()).toEqual({ a: '1', b: '2' });
      expect(clone.getBreadcrumbs()).toHaveLength(2);
    });
  });

  describe('clear', () => {
    it('clears all scope data', () => {
      scope.setUser({ id: '123' });
      scope.setTags({ tag: 'value' });
      scope.setExtras({ extra: 'data' });
      scope.setContext('ctx', { key: 'value' });
      scope.addBreadcrumb({ message: 'test' });
      scope.setFingerprint(['fp']);
      scope.setLevel('error');
      scope.setTransactionName('tx');

      scope.clear();

      expect(scope.getUser()).toBeUndefined();
      expect(scope.getTags()).toEqual({});
      expect(scope.getExtras()).toEqual({});
      expect(scope.getContext('ctx')).toBeUndefined();
      expect(scope.getBreadcrumbs()).toHaveLength(0);
      expect(scope.getFingerprint()).toEqual([]);
      expect(scope.getLevel()).toBeUndefined();
      expect(scope.getTransactionName()).toBeUndefined();
    });

    it('regenerates propagation context after clear', () => {
      const originalContext = scope.getPropagationContext();
      scope.clear();
      const newContext = scope.getPropagationContext();

      expect(newContext.traceId).toBeDefined();
      expect(newContext.spanId).toBeDefined();
      // IDs should be different after clear
      expect(newContext.traceId).not.toBe(originalContext.traceId);
    });

    it('returns this for chaining', () => {
      const result = scope.clear();
      expect(result).toBe(scope);
    });
  });

  describe('update', () => {
    it('updates from another Scope', () => {
      const otherScope = new Scope();
      otherScope.setUser({ id: '456' });
      otherScope.setTags({ newTag: 'newValue' });

      scope.setTags({ existingTag: 'existingValue' });
      scope.update(otherScope);

      expect(scope.getUser()).toEqual({ id: '456' });
      expect(scope.getTags()).toEqual({ existingTag: 'existingValue', newTag: 'newValue' });
    });

    it('updates from ScopeData object', () => {
      scope.update({
        user: { id: '789' },
        tags: { key: 'value' },
        extras: { data: 'test' },
      });

      expect(scope.getUser()).toEqual({ id: '789' });
      expect(scope.getTags()).toEqual({ key: 'value' });
      expect(scope.getExtras()).toEqual({ data: 'test' });
    });

    it('handles undefined input', () => {
      scope.setTags({ existing: 'value' });
      scope.update(undefined);
      expect(scope.getTags()).toEqual({ existing: 'value' });
    });

    it('returns this for chaining', () => {
      const result = scope.update({});
      expect(result).toBe(scope);
    });
  });

  describe('applyToEvent', () => {
    it('applies user to event', async () => {
      scope.setUser({ id: '123' });
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.user).toEqual({ id: '123' });
    });

    it('applies tags to event', async () => {
      scope.setTags({ key: 'value' });
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.tags).toEqual({ key: 'value' });
    });

    it('applies extras to event', async () => {
      scope.setExtras({ extra: 'data' });
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.extra).toEqual({ extra: 'data' });
    });

    it('applies contexts to event', async () => {
      scope.setContext('device', { model: 'iPhone' });
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.contexts?.device).toEqual({ model: 'iPhone' });
    });

    it('applies breadcrumbs to event', async () => {
      scope.addBreadcrumb({ message: 'test', timestamp: 123 });
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.breadcrumbs).toHaveLength(1);
      expect(result?.breadcrumbs?.[0].message).toBe('test');
    });

    it('applies fingerprint to event', async () => {
      scope.setFingerprint(['custom']);
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.fingerprint).toEqual(['custom']);
    });

    it('applies level to event when not set on event', async () => {
      scope.setLevel('warning');
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.level).toBe('warning');
    });

    it('does not override existing event level', async () => {
      scope.setLevel('warning');
      const event: Event = { event_id: 'test', level: 'error' };

      const result = await scope.applyToEvent(event);

      expect(result?.level).toBe('error');
    });

    it('applies transaction name to event', async () => {
      scope.setTransactionName('GET /api/users');
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.transaction).toBe('GET /api/users');
    });

    it('runs event processors', async () => {
      const processor = vi.fn((event) => ({ ...event, extra: { processed: true } }));
      scope.addEventProcessor(processor);
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(processor).toHaveBeenCalled();
      expect(result?.extra).toEqual({ processed: true });
    });

    it('drops event when processor returns null', async () => {
      scope.addEventProcessor(() => null);
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result).toBeNull();
    });

    it('runs processors in order', async () => {
      const order: number[] = [];
      scope.addEventProcessor((event) => {
        order.push(1);
        return event;
      });
      scope.addEventProcessor((event) => {
        order.push(2);
        return event;
      });

      await scope.applyToEvent({ event_id: 'test' });

      expect(order).toEqual([1, 2]);
    });

    it('handles async event processors', async () => {
      scope.addEventProcessor(async (event) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return { ...event, extra: { async: true } };
      });
      const event: Event = { event_id: 'test' };

      const result = await scope.applyToEvent(event);

      expect(result?.extra).toEqual({ async: true });
    });

    it('merges scope data with existing event data', async () => {
      scope.setTags({ scopeTag: 'scopeValue' });
      const event: Event = {
        event_id: 'test',
        tags: { eventTag: 'eventValue' },
      };

      const result = await scope.applyToEvent(event);

      expect(result?.tags).toEqual({ scopeTag: 'scopeValue', eventTag: 'eventValue' });
    });

    it('event data takes precedence over scope data', async () => {
      scope.setTags({ key: 'scopeValue' });
      const event: Event = {
        event_id: 'test',
        tags: { key: 'eventValue' },
      };

      const result = await scope.applyToEvent(event);

      expect(result?.tags?.key).toBe('eventValue');
    });
  });
});
