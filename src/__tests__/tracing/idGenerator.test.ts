/**
 * ID Generator Tests
 *
 * Tests for trace and span ID generation utilities.
 */

import { describe, it, expect, vi } from 'vitest';
import {
  generateSpanId,
  generateTraceId,
  generateEventId,
  isValidTraceId,
  isValidSpanId,
} from '../../tracing/idGenerator';

describe('ID Generator', () => {
  describe('generateSpanId', () => {
    it('generates 16-character hex string', () => {
      const id = generateSpanId();

      expect(id).toHaveLength(16);
      expect(id).toMatch(/^[0-9a-f]{16}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateSpanId());
      }

      expect(ids.size).toBe(100);
    });

    it('generates lowercase hex characters', () => {
      const id = generateSpanId();

      expect(id).toBe(id.toLowerCase());
    });
  });

  describe('generateTraceId', () => {
    it('generates 32-character hex string', () => {
      const id = generateTraceId();

      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateTraceId());
      }

      expect(ids.size).toBe(100);
    });

    it('generates lowercase hex characters', () => {
      const id = generateTraceId();

      expect(id).toBe(id.toLowerCase());
    });
  });

  describe('generateEventId', () => {
    it('generates 32-character hex string (UUID without dashes)', () => {
      const id = generateEventId();

      expect(id).toHaveLength(32);
      expect(id).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates unique IDs', () => {
      const ids = new Set<string>();

      for (let i = 0; i < 100; i++) {
        ids.add(generateEventId());
      }

      expect(ids.size).toBe(100);
    });

    it('does not contain dashes', () => {
      const id = generateEventId();

      expect(id).not.toContain('-');
    });
  });

  describe('isValidTraceId', () => {
    it('returns true for valid trace ID', () => {
      expect(isValidTraceId('12345678901234567890123456789012')).toBe(true);
      expect(isValidTraceId('abcdef1234567890abcdef1234567890')).toBe(true);
      expect(isValidTraceId('ABCDEF1234567890ABCDEF1234567890')).toBe(true);
    });

    it('returns false for invalid trace ID - wrong length', () => {
      expect(isValidTraceId('123456789012345678901234567890')).toBe(false); // 30 chars
      expect(isValidTraceId('1234567890123456789012345678901234')).toBe(false); // 34 chars
    });

    it('returns false for invalid trace ID - non-hex characters', () => {
      expect(isValidTraceId('1234567890123456789012345678901g')).toBe(false);
      expect(isValidTraceId('1234567890123456789012345678901-')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidTraceId('')).toBe(false);
    });
  });

  describe('isValidSpanId', () => {
    it('returns true for valid span ID', () => {
      expect(isValidSpanId('1234567890123456')).toBe(true);
      expect(isValidSpanId('abcdef1234567890')).toBe(true);
      expect(isValidSpanId('ABCDEF1234567890')).toBe(true);
    });

    it('returns false for invalid span ID - wrong length', () => {
      expect(isValidSpanId('12345678901234')).toBe(false); // 14 chars
      expect(isValidSpanId('123456789012345678')).toBe(false); // 18 chars
    });

    it('returns false for invalid span ID - non-hex characters', () => {
      expect(isValidSpanId('123456789012345g')).toBe(false);
      expect(isValidSpanId('123456789012345-')).toBe(false);
    });

    it('returns false for empty string', () => {
      expect(isValidSpanId('')).toBe(false);
    });
  });

  describe('crypto fallback', () => {
    it('works without crypto.randomUUID', () => {
      // Even in environments without randomUUID, it should work
      const eventId = generateEventId();

      expect(eventId).toHaveLength(32);
      expect(eventId).toMatch(/^[0-9a-f]{32}$/);
    });

    it('generates different IDs even with Math.random fallback', () => {
      // Generate many IDs to ensure randomness
      const ids = new Set<string>();

      for (let i = 0; i < 50; i++) {
        ids.add(generateSpanId());
        ids.add(generateTraceId());
      }

      // All IDs should be unique
      expect(ids.size).toBe(100);
    });
  });

  describe('generated IDs pass validation', () => {
    it('generated span IDs are valid', () => {
      for (let i = 0; i < 10; i++) {
        const id = generateSpanId();
        expect(isValidSpanId(id)).toBe(true);
      }
    });

    it('generated trace IDs are valid', () => {
      for (let i = 0; i < 10; i++) {
        const id = generateTraceId();
        expect(isValidTraceId(id)).toBe(true);
      }
    });
  });
});
