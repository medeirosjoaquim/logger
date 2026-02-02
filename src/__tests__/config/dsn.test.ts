/**
 * DSN Parser Tests
 *
 * Tests for parsing and working with Sentry DSN strings.
 */

import { describe, it, expect } from 'vitest';
import {
  parseDsn,
  dsnToString,
  getBaseApiUrl,
  getStoreEndpoint,
  getEnvelopeEndpoint,
  getReportEndpoint,
  getSentryAuthHeader,
  isValidDsn,
  getProjectIdFromDsn,
  getPublicKeyFromDsn,
  DsnParseError,
} from '../../core/dsn';

describe('DSN', () => {
  describe('parseDsn', () => {
    it('parses valid DSN', () => {
      const dsn = parseDsn('https://abc123@o456.ingest.sentry.io/789');

      expect(dsn.publicKey).toBe('abc123');
      expect(dsn.projectId).toBe('789');
      expect(dsn.host).toBe('o456.ingest.sentry.io');
      expect(dsn.protocol).toBe('https');
    });

    it('parses DSN with secret key', () => {
      const dsn = parseDsn('https://abc123:secret@sentry.io/789');

      expect(dsn.publicKey).toBe('abc123');
      expect(dsn.secretKey).toBe('secret');
      expect(dsn.projectId).toBe('789');
    });

    it('parses DSN with port', () => {
      const dsn = parseDsn('https://abc123@sentry.example.com:9000/789');

      expect(dsn.host).toBe('sentry.example.com');
      expect(dsn.port).toBe('9000');
    });

    it('parses DSN with path', () => {
      const dsn = parseDsn('https://abc123@sentry.example.com/api/sentry/789');

      expect(dsn.path).toBe('api/sentry');
      expect(dsn.projectId).toBe('789');
    });

    it('parses DSN with http protocol', () => {
      const dsn = parseDsn('http://abc123@localhost/789');

      expect(dsn.protocol).toBe('http');
    });

    it('throws for invalid DSN - empty string', () => {
      expect(() => parseDsn('')).toThrow(DsnParseError);
    });

    it('throws for invalid DSN - null', () => {
      expect(() => parseDsn(null as unknown as string)).toThrow(DsnParseError);
    });

    it('throws for invalid DSN - missing protocol', () => {
      expect(() => parseDsn('abc123@sentry.io/789')).toThrow(DsnParseError);
    });

    it('throws for invalid DSN - invalid protocol', () => {
      expect(() => parseDsn('ftp://abc123@sentry.io/789')).toThrow(DsnParseError);
    });

    it('throws for invalid DSN - missing public key', () => {
      expect(() => parseDsn('https://sentry.io/789')).toThrow(DsnParseError);
    });

    it('throws for invalid DSN - missing project ID', () => {
      expect(() => parseDsn('https://abc123@sentry.io/')).toThrow(DsnParseError);
    });

    it('throws for invalid DSN - malformed URL', () => {
      expect(() => parseDsn('invalid')).toThrow(DsnParseError);
    });

    it('DsnParseError has correct name', () => {
      try {
        parseDsn('invalid');
      } catch (error) {
        expect((error as Error).name).toBe('DsnParseError');
      }
    });

    it('DsnParseError message includes "Invalid Sentry DSN"', () => {
      try {
        parseDsn('invalid');
      } catch (error) {
        expect((error as Error).message).toContain('Invalid Sentry DSN');
      }
    });
  });

  describe('dsnToString', () => {
    it('converts DSN back to string', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const str = dsnToString(dsn);

      expect(str).toBe('https://abc@sentry.io/123');
    });

    it('includes port in string if present', () => {
      const dsn = parseDsn('https://abc@sentry.io:9000/123');
      const str = dsnToString(dsn);

      expect(str).toBe('https://abc@sentry.io:9000/123');
    });

    it('includes path in string if present', () => {
      const dsn = parseDsn('https://abc@sentry.io/api/123');
      const str = dsnToString(dsn);

      expect(str).toBe('https://abc@sentry.io/api/123');
    });

    it('optionally includes secret key', () => {
      const dsn = parseDsn('https://abc:secret@sentry.io/123');

      expect(dsnToString(dsn, false)).toBe('https://abc@sentry.io/123');
      expect(dsnToString(dsn, true)).toBe('https://abc:secret@sentry.io/123');
    });

    it('round-trips without loss', () => {
      const original = 'https://abc123@o456.ingest.sentry.io/789';
      const dsn = parseDsn(original);
      const result = dsnToString(dsn);

      expect(result).toBe(original);
    });

    it('round-trips DSN with all components', () => {
      const original = 'https://abc:secret@sentry.example.com:9000/api/sentry/789';
      const dsn = parseDsn(original);
      const result = dsnToString(dsn, true);

      expect(result).toBe(original);
    });
  });

  describe('getBaseApiUrl', () => {
    it('returns base API URL', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const url = getBaseApiUrl(dsn);

      expect(url).toBe('https://sentry.io');
    });

    it('includes port in base URL', () => {
      const dsn = parseDsn('https://abc@sentry.io:9000/123');
      const url = getBaseApiUrl(dsn);

      expect(url).toBe('https://sentry.io:9000');
    });

    it('includes path in base URL', () => {
      const dsn = parseDsn('https://abc@sentry.io/api/sentry/123');
      const url = getBaseApiUrl(dsn);

      expect(url).toBe('https://sentry.io/api/sentry');
    });
  });

  describe('getStoreEndpoint', () => {
    it('returns store endpoint URL', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const url = getStoreEndpoint(dsn);

      expect(url).toBe('https://sentry.io/api/123/store/');
    });

    it('includes custom path in endpoint', () => {
      const dsn = parseDsn('https://abc@sentry.io/api/sentry/123');
      const url = getStoreEndpoint(dsn);

      expect(url).toBe('https://sentry.io/api/sentry/api/123/store/');
    });
  });

  describe('getEnvelopeEndpoint', () => {
    it('returns envelope endpoint URL', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const url = getEnvelopeEndpoint(dsn);

      expect(url).toBe('https://sentry.io/api/123/envelope/');
    });
  });

  describe('getReportEndpoint', () => {
    it('returns report endpoint URL with event ID', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const url = getReportEndpoint(dsn, 'event-123');

      expect(url).toContain('/api/embed/error-page/');
      expect(url).toContain('dsn=');
      expect(url).toContain('eventId=event-123');
    });

    it('URL-encodes DSN and event ID', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const url = getReportEndpoint(dsn, 'event with spaces');

      expect(url).toContain(encodeURIComponent('event with spaces'));
    });
  });

  describe('getSentryAuthHeader', () => {
    it('returns auth header value', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const header = getSentryAuthHeader(dsn, 'sentry.javascript.browser', '7.0.0');

      expect(header).toContain('Sentry ');
      expect(header).toContain('sentry_version=7');
      expect(header).toContain('sentry_client=sentry.javascript.browser/7.0.0');
      expect(header).toContain('sentry_key=abc');
    });

    it('includes secret key if present', () => {
      const dsn = parseDsn('https://abc:secret@sentry.io/123');
      const header = getSentryAuthHeader(dsn, 'sentry.javascript.browser', '7.0.0');

      expect(header).toContain('sentry_secret=secret');
    });

    it('does not include secret key if not present', () => {
      const dsn = parseDsn('https://abc@sentry.io/123');
      const header = getSentryAuthHeader(dsn, 'sentry.javascript.browser', '7.0.0');

      expect(header).not.toContain('sentry_secret');
    });
  });

  describe('isValidDsn', () => {
    it('returns true for valid DSN', () => {
      expect(isValidDsn('https://abc@sentry.io/123')).toBe(true);
    });

    it('returns false for invalid DSN', () => {
      expect(isValidDsn('invalid')).toBe(false);
      expect(isValidDsn('')).toBe(false);
    });

    it('returns false for null/undefined', () => {
      expect(isValidDsn(null as unknown as string)).toBe(false);
      expect(isValidDsn(undefined as unknown as string)).toBe(false);
    });
  });

  describe('getProjectIdFromDsn', () => {
    it('returns project ID from valid DSN', () => {
      expect(getProjectIdFromDsn('https://abc@sentry.io/123')).toBe('123');
      expect(getProjectIdFromDsn('https://abc@sentry.io/456789')).toBe('456789');
    });

    it('returns undefined for invalid DSN', () => {
      expect(getProjectIdFromDsn('invalid')).toBeUndefined();
      expect(getProjectIdFromDsn('')).toBeUndefined();
    });
  });

  describe('getPublicKeyFromDsn', () => {
    it('returns public key from valid DSN', () => {
      expect(getPublicKeyFromDsn('https://abc123@sentry.io/123')).toBe('abc123');
      expect(getPublicKeyFromDsn('https://mykey@sentry.io/456')).toBe('mykey');
    });

    it('returns undefined for invalid DSN', () => {
      expect(getPublicKeyFromDsn('invalid')).toBeUndefined();
      expect(getPublicKeyFromDsn('')).toBeUndefined();
    });
  });

  describe('real-world DSN formats', () => {
    it('parses Sentry cloud DSN', () => {
      const dsn = parseDsn('https://1234567890abcdef@o123456.ingest.sentry.io/7890123');

      expect(dsn.publicKey).toBe('1234567890abcdef');
      expect(dsn.host).toBe('o123456.ingest.sentry.io');
      expect(dsn.projectId).toBe('7890123');
    });

    it('parses self-hosted DSN', () => {
      const dsn = parseDsn('https://abc@sentry.mycompany.com/1');

      expect(dsn.host).toBe('sentry.mycompany.com');
    });

    it('parses localhost DSN for development', () => {
      const dsn = parseDsn('http://abc@localhost:9000/1');

      expect(dsn.protocol).toBe('http');
      expect(dsn.host).toBe('localhost');
      expect(dsn.port).toBe('9000');
    });

    it('parses DSN with IP address', () => {
      const dsn = parseDsn('http://abc@192.168.1.100:9000/1');

      expect(dsn.host).toBe('192.168.1.100');
      expect(dsn.port).toBe('9000');
    });
  });
});
