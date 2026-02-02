/**
 * Tests for Sentry-compatible capture API
 *
 * Verifies that our API matches Sentry's expected signatures:
 * - captureException(exception, captureContext?)
 * - captureMessage(message, captureContext | level?)
 * - addBreadcrumb(breadcrumb)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Sentry-compatible Capture API', () => {
  // Mock storage to capture events
  let capturedEvents: Array<{ event: unknown; hint?: unknown }> = [];

  beforeEach(() => {
    capturedEvents = [];
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('captureException', () => {
    it('should accept exception with CaptureContext containing tags', async () => {
      const { captureException, init } = await import('../../index');

      // Initialize logger first
      await init({ enabled: true });

      // Sentry-style call with tags in CaptureContext
      const eventId = captureException(new Error('Test error'), {
        tags: {
          component: 'build_runner',
          action: 'remove_source_maps',
        },
      });

      expect(typeof eventId).toBe('string');
      expect(eventId.length).toBe(32);
    });

    it('should accept exception with CaptureContext containing extra', async () => {
      const { captureException } = await import('../../index');

      const eventId = captureException(new Error('Test error'), {
        extra: {
          removedCount: 10,
          savedSizeMB: 5.2,
        },
      });

      expect(typeof eventId).toBe('string');
    });

    it('should accept exception with CaptureContext containing tags and extra', async () => {
      const { captureException } = await import('../../index');

      // Combined tags and extra (common Sentry usage)
      const eventId = captureException(
        new Error('Cache operation failed'),
        {
          tags: {
            component: 'build_runner',
            action: 'clean_cache',
          },
          extra: {
            cacheSize: 1024,
            retryCount: 3,
          },
        }
      );

      expect(typeof eventId).toBe('string');
    });

    it('should accept exception with CaptureContext containing user', async () => {
      const { captureException } = await import('../../index');

      const eventId = captureException(new Error('User error'), {
        user: {
          id: '123',
          email: 'test@example.com',
        },
      });

      expect(typeof eventId).toBe('string');
    });

    it('should accept exception with CaptureContext containing level', async () => {
      const { captureException } = await import('../../index');

      const eventId = captureException(new Error('Warning error'), {
        level: 'warning',
      });

      expect(typeof eventId).toBe('string');
    });

    it('should accept exception with CaptureContext containing fingerprint', async () => {
      const { captureException } = await import('../../index');

      const eventId = captureException(new Error('Grouped error'), {
        fingerprint: ['my-custom-fingerprint'],
      });

      expect(typeof eventId).toBe('string');
    });

    it('should accept exception with CaptureContext containing contexts', async () => {
      const { captureException } = await import('../../index');

      const eventId = captureException(new Error('Context error'), {
        contexts: {
          build: {
            version: '1.0.0',
            environment: 'production',
          },
        },
      });

      expect(typeof eventId).toBe('string');
    });

    it('should accept exception without CaptureContext', async () => {
      const { captureException } = await import('../../index');

      const eventId = captureException(new Error('Simple error'));

      expect(typeof eventId).toBe('string');
    });

    it('should convert non-Error to Error', async () => {
      const { captureException } = await import('../../index');

      // Pass string instead of Error (Sentry supports this)
      const eventId = captureException('String error message', {
        tags: { type: 'string' },
      });

      expect(typeof eventId).toBe('string');
    });
  });

  describe('captureMessage', () => {
    it('should accept message with CaptureContext containing tags', async () => {
      const { captureMessage } = await import('../../index');

      const eventId = captureMessage('Cache cleaned successfully', {
        level: 'info',
        tags: { component: 'build_runner', action: 'clean_cache' },
      });

      expect(typeof eventId).toBe('string');
    });

    it('should accept message with CaptureContext containing extra', async () => {
      const { captureMessage } = await import('../../index');

      const eventId = captureMessage('Removing source maps to reduce deployment size', {
        level: 'info',
        tags: { component: 'build_runner', action: 'remove_source_maps' },
        extra: {
          removedCount: 10,
          savedSizeMB: 5.2,
        },
      });

      expect(typeof eventId).toBe('string');
    });

    it('should accept message with just SeverityLevel', async () => {
      const { captureMessage } = await import('../../index');

      const eventId = captureMessage('Debug message', 'debug');

      expect(typeof eventId).toBe('string');
    });

    it('should accept message without CaptureContext', async () => {
      const { captureMessage } = await import('../../index');

      const eventId = captureMessage('Simple message');

      expect(typeof eventId).toBe('string');
    });
  });

  describe('addBreadcrumb', () => {
    it('should accept breadcrumb with category, message, and level', async () => {
      const { addBreadcrumb, getCurrentScope } = await import('../../index');

      addBreadcrumb({
        category: 'tracking',
        message: 'facebookTrackPurchase called',
        level: 'info',
        data: { value: 100 },
      });

      // Verify breadcrumb was added to scope
      const scope = getCurrentScope();
      const scopeData = scope.getScopeData();
      const breadcrumbs = scopeData.breadcrumbs;

      expect(breadcrumbs.length).toBeGreaterThan(0);
      const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
      expect(lastBreadcrumb.category).toBe('tracking');
      expect(lastBreadcrumb.message).toBe('facebookTrackPurchase called');
      expect(lastBreadcrumb.level).toBe('info');
    });

    it('should accept breadcrumb with type', async () => {
      const { addBreadcrumb, getCurrentScope } = await import('../../index');

      addBreadcrumb({
        type: 'http',
        category: 'xhr',
        message: 'POST /api/data',
        level: 'info',
        data: {
          method: 'POST',
          url: '/api/data',
          status_code: 200,
        },
      });

      const scope = getCurrentScope();
      const scopeData = scope.getScopeData();
      const breadcrumbs = scopeData.breadcrumbs;

      const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
      expect(lastBreadcrumb.type).toBe('http');
    });

    it('should add timestamp automatically if not provided', async () => {
      const { addBreadcrumb, getCurrentScope } = await import('../../index');

      addBreadcrumb({
        category: 'test',
        message: 'Test breadcrumb',
      });

      const scope = getCurrentScope();
      const scopeData = scope.getScopeData();
      const breadcrumbs = scopeData.breadcrumbs;

      const lastBreadcrumb = breadcrumbs[breadcrumbs.length - 1];
      expect(typeof lastBreadcrumb.timestamp).toBe('number');
    });
  });

  describe('Default export (Sentry namespace)', () => {
    it('should have captureException on default export', async () => {
      const Sentry = await import('../../index');

      expect(typeof Sentry.default.captureException).toBe('function');
    });

    it('should have captureMessage on default export', async () => {
      const Sentry = await import('../../index');

      expect(typeof Sentry.default.captureMessage).toBe('function');
    });

    it('should have addBreadcrumb on default export', async () => {
      const Sentry = await import('../../index');

      expect(typeof Sentry.default.addBreadcrumb).toBe('function');
    });

    it('should work with Sentry-style namespace usage', async () => {
      const Sentry = (await import('../../index')).default;

      // This is the typical Sentry usage pattern
      const eventId = Sentry.captureException(new Error('Test'), {
        tags: { component: 'test' },
      });

      expect(typeof eventId).toBe('string');
    });
  });
});
