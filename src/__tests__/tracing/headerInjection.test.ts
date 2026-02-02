/**
 * Tests for Header Injection (Distributed Tracing)
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { Span } from '../../tracing/span.js';
import {
  shouldPropagateTo,
  isSameOrigin,
  getUrlFromFetchInput,
  createTraceHeaders,
  injectTracingHeaders,
  shouldInjectHeaders,
} from '../../tracing/headerInjection.js';

describe('headerInjection', () => {
  describe('shouldPropagateTo', () => {
    it('returns false when targets array is empty', () => {
      expect(shouldPropagateTo('https://api.example.com/data', [])).toBe(false);
    });

    it('returns false when url does not match any string target', () => {
      const targets = ['localhost', 'example.org'];
      expect(shouldPropagateTo('https://api.example.com/data', targets)).toBe(false);
    });

    it('returns true when url contains a string target', () => {
      const targets = ['example.com', 'localhost'];
      expect(shouldPropagateTo('https://api.example.com/data', targets)).toBe(true);
    });

    it('returns true when url matches a RegExp target', () => {
      const targets = [/^https:\/\/api\./];
      expect(shouldPropagateTo('https://api.example.com/data', targets)).toBe(true);
    });

    it('returns false when url does not match RegExp target', () => {
      const targets = [/^http:\/\/api\./];
      expect(shouldPropagateTo('https://api.example.com/data', targets)).toBe(false);
    });

    it('handles mixed string and RegExp targets', () => {
      const targets = ['localhost', /\.internal\./];
      expect(shouldPropagateTo('https://api.internal.example.com', targets)).toBe(true);
      expect(shouldPropagateTo('http://localhost:3000', targets)).toBe(true);
      expect(shouldPropagateTo('https://external.com', targets)).toBe(false);
    });
  });

  describe('getUrlFromFetchInput', () => {
    it('returns string input as-is', () => {
      expect(getUrlFromFetchInput('https://example.com/api')).toBe('https://example.com/api');
    });

    it('returns href from URL object', () => {
      const url = new URL('https://example.com/api?foo=bar');
      expect(getUrlFromFetchInput(url)).toBe('https://example.com/api?foo=bar');
    });

    it('returns url from Request object', () => {
      const request = new Request('https://example.com/api');
      expect(getUrlFromFetchInput(request)).toBe('https://example.com/api');
    });
  });

  describe('createTraceHeaders', () => {
    it('creates sentry-trace and baggage headers from span', () => {
      const span = new Span({
        name: 'test-span',
        traceId: 'a'.repeat(32),
        sampled: true,
      });

      const headers = createTraceHeaders(span);

      expect(headers['sentry-trace']).toMatch(/^[a-f0-9]{32}-[a-f0-9]{16}-1$/);
      expect(headers.baggage).toContain('sentry-trace_id=');
      expect(headers.baggage).toContain('sentry-sampled=true');
    });

    it('includes DSC properties in baggage header', () => {
      const span = new Span({
        name: 'test-span',
        sampled: true,
      });

      const headers = createTraceHeaders(span, {
        public_key: 'abc123',
        release: '1.0.0',
        environment: 'production',
      });

      expect(headers.baggage).toContain('sentry-public_key=abc123');
      expect(headers.baggage).toContain('sentry-release=1.0.0');
      expect(headers.baggage).toContain('sentry-environment=production');
    });

    it('handles unsampled spans', () => {
      const span = new Span({
        name: 'test-span',
        sampled: false,
      });

      const headers = createTraceHeaders(span);

      expect(headers['sentry-trace']).toMatch(/-0$/);
      expect(headers.baggage).toContain('sentry-sampled=false');
    });
  });

  describe('injectTracingHeaders', () => {
    let span: Span;

    beforeEach(() => {
      span = new Span({
        name: 'test-span',
        traceId: 'b'.repeat(32),
        sampled: true,
      });
    });

    it('injects headers into undefined init', () => {
      const newInit = injectTracingHeaders('https://example.com', undefined, span);

      expect(newInit.headers).toBeDefined();
      const headers = newInit.headers as Record<string, string>;
      expect(headers['sentry-trace']).toBeDefined();
      expect(headers['baggage']).toBeDefined();
    });

    it('injects headers into existing plain object headers', () => {
      const init: RequestInit = {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      };

      const newInit = injectTracingHeaders('https://example.com', init, span);

      const headers = newInit.headers as Record<string, string>;
      expect(headers['Content-Type']).toBe('application/json');
      expect(headers['sentry-trace']).toBeDefined();
      expect(headers['baggage']).toBeDefined();
    });

    it('injects headers into Headers object', () => {
      const init: RequestInit = {
        headers: new Headers({
          'Content-Type': 'application/json',
        }),
      };

      const newInit = injectTracingHeaders('https://example.com', init, span);

      const headers = newInit.headers as Headers;
      expect(headers.get('Content-Type')).toBe('application/json');
      expect(headers.get('sentry-trace')).toBeDefined();
      expect(headers.get('baggage')).toBeDefined();
    });

    it('injects headers into array-style headers', () => {
      const init: RequestInit = {
        headers: [
          ['Content-Type', 'application/json'],
        ],
      };

      const newInit = injectTracingHeaders('https://example.com', init, span);

      const headers = newInit.headers as [string, string][];
      const hasContentType = headers.some(([k]) => k === 'Content-Type');
      const hasSentryTrace = headers.some(([k]) => k === 'sentry-trace');
      const hasBaggage = headers.some(([k]) => k === 'baggage');

      expect(hasContentType).toBe(true);
      expect(hasSentryTrace).toBe(true);
      expect(hasBaggage).toBe(true);
    });

    it('merges with existing baggage header (object)', () => {
      const init: RequestInit = {
        headers: {
          baggage: 'other-key=other-value',
        },
      };

      const newInit = injectTracingHeaders('https://example.com', init, span);

      const headers = newInit.headers as Record<string, string>;
      expect(headers['baggage']).toContain('other-key=other-value');
      expect(headers['baggage']).toContain('sentry-trace_id=');
    });

    it('merges with existing baggage header (Headers)', () => {
      const init: RequestInit = {
        headers: new Headers({
          baggage: 'other-key=other-value',
        }),
      };

      const newInit = injectTracingHeaders('https://example.com', init, span);

      const headers = newInit.headers as Headers;
      const baggage = headers.get('baggage');
      expect(baggage).toContain('other-key=other-value');
      expect(baggage).toContain('sentry-trace_id=');
    });
  });

  describe('shouldInjectHeaders', () => {
    it('returns true for URLs matching propagation targets', () => {
      const targets = ['api.example.com'];
      expect(shouldInjectHeaders('https://api.example.com/data', targets, false)).toBe(true);
    });

    it('returns false for URLs not matching targets when same-origin disabled', () => {
      const targets = ['api.example.com'];
      expect(shouldInjectHeaders('https://other.com/data', targets, false)).toBe(false);
    });

    it('returns false when no targets and same-origin not matching', () => {
      // In non-browser environment, isSameOrigin returns false
      expect(shouldInjectHeaders('https://example.com', [], false)).toBe(false);
    });
  });
});
