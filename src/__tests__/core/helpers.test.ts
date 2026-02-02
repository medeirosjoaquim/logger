/**
 * Tests for production helper utilities
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { helpers, sentry } from '../../core/helpers';
import { UniversalLogger } from '../../core/logger';

// Helper to wait for async event processing
const waitForProcessing = () => new Promise(resolve => setTimeout(resolve, 50));

describe('Production Helper Utilities', () => {
  beforeEach(async () => {
    UniversalLogger.resetInstance();
    const logger = UniversalLogger.getInstance();
    await logger.init({
      _experiments: { storage: 'memory' },
    });
  });

  afterEach(async () => {
    await UniversalLogger.getInstance().close();
    UniversalLogger.resetInstance();
  });

  describe('helpers.captureError', () => {
    it('captures an error and returns event ID', () => {
      const error = new Error('Test error');
      const eventId = helpers.captureError(error);

      expect(eventId).toBeDefined();
      expect(typeof eventId).toBe('string');
      expect(eventId.length).toBe(32); // UUID without dashes
    });

    it('captures error with tags', async () => {
      const error = new Error('Tagged error');
      const eventId = helpers.captureError(error, {
        tags: { section: 'checkout', userId: '123' },
      });

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event).toBeDefined();
      expect(event?.tags).toMatchObject({ section: 'checkout', userId: '123' });
    });

    it('captures error with extra data', async () => {
      const error = new Error('Error with extra');
      const eventId = helpers.captureError(error, {
        extra: { orderId: 'order-123', amount: 99.99 },
      });

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event).toBeDefined();
      expect(event?.extra).toMatchObject({ orderId: 'order-123', amount: 99.99 });
    });

    it('captures error with user context', async () => {
      const error = new Error('User error');
      const eventId = helpers.captureError(error, {
        user: { id: 'user-456', email: 'test@example.com' },
      });

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event).toBeDefined();
      expect(event?.user).toMatchObject({ id: 'user-456', email: 'test@example.com' });
    });

    it('captures error with fingerprint', async () => {
      const error = new Error('Fingerprinted error');
      const eventId = helpers.captureError(error, {
        fingerprint: ['payment', 'timeout'],
      });

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event).toBeDefined();
      expect(event?.fingerprint).toBeDefined();
      expect(event?.fingerprint).toContain('payment');
      expect(event?.fingerprint).toContain('timeout');
    });
  });

  describe('helpers.trackEvent', () => {
    it('tracks an event with default info level', async () => {
      const eventId = helpers.trackEvent('User completed onboarding');

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event).toBeDefined();
      expect(event?.level).toBe('info');
    });

    it('tracks event with custom level', async () => {
      const eventId = helpers.trackEvent('Suspicious activity detected', {
        level: 'warning',
      });

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event).toBeDefined();
      expect(event?.level).toBe('warning');
    });

    it('tracks event with tags and data', async () => {
      const eventId = helpers.trackEvent('High-value transaction', {
        tags: { transactionType: 'purchase' },
        data: { amount: 5000, currency: 'USD' },
      });

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event).toBeDefined();
      expect(event?.tags).toMatchObject({ transactionType: 'purchase' });
      expect(event?.extra).toMatchObject({ amount: 5000, currency: 'USD' });
    });
  });

  describe('helpers.identifyUser', () => {
    it('sets user on the scope', () => {
      helpers.identifyUser({
        id: 'user-789',
        email: 'user@example.com',
        username: 'testuser',
      });

      const logger = UniversalLogger.getInstance();
      const user = logger.getCurrentScope().getUser();
      expect(user).toMatchObject({
        id: 'user-789',
        email: 'user@example.com',
        username: 'testuser',
      });
    });

    it('maps plan to segment', () => {
      helpers.identifyUser({
        id: 'user-123',
        plan: 'premium',
      });

      const logger = UniversalLogger.getInstance();
      const user = logger.getCurrentScope().getUser();
      expect(user?.segment).toBe('premium');
    });

    it('clears user when null is passed', () => {
      helpers.identifyUser({ id: 'user-123' });
      helpers.identifyUser(null);

      const logger = UniversalLogger.getInstance();
      const user = logger.getCurrentScope().getUser();
      expect(user).toBeUndefined();
    });
  });

  describe('helpers.trackNavigation', () => {
    it('adds navigation breadcrumb', () => {
      helpers.trackNavigation('/dashboard');

      const logger = UniversalLogger.getInstance();
      const breadcrumbs = logger.getCurrentScope().getBreadcrumbs();
      const navBreadcrumb = breadcrumbs.find(b => b.category === 'navigation');
      expect(navBreadcrumb).toBeDefined();
      expect(navBreadcrumb).toMatchObject({
        category: 'navigation',
        message: 'Navigated to /dashboard',
        level: 'info',
      });
      expect(navBreadcrumb?.data?.to).toBe('/dashboard');
    });

    it('includes from URL when provided', () => {
      helpers.trackNavigation('/checkout', '/cart');

      const logger = UniversalLogger.getInstance();
      const breadcrumbs = logger.getCurrentScope().getBreadcrumbs();
      const navBreadcrumb = breadcrumbs.find(b => b.message === 'Navigated to /checkout');
      expect(navBreadcrumb).toBeDefined();
      expect(navBreadcrumb?.data).toMatchObject({
        to: '/checkout',
        from: '/cart',
      });
    });
  });

  describe('helpers.trackApiRequest', () => {
    it('tracks started API request', () => {
      helpers.trackApiRequest('/api/users', 'started', { method: 'GET' });

      const logger = UniversalLogger.getInstance();
      const breadcrumbs = logger.getCurrentScope().getBreadcrumbs();
      const apiBreadcrumb = breadcrumbs.find(b => b.category === 'api' && b.message === 'API request started');
      expect(apiBreadcrumb).toBeDefined();
      expect(apiBreadcrumb).toMatchObject({
        category: 'api',
        message: 'API request started',
        level: 'info',
      });
      expect(apiBreadcrumb?.data).toMatchObject({ endpoint: '/api/users', method: 'GET' });
    });

    it('tracks completed API request', () => {
      helpers.trackApiRequest('/api/users', 'completed', {
        method: 'GET',
        status: 200,
        duration: 150,
      });

      const logger = UniversalLogger.getInstance();
      const breadcrumbs = logger.getCurrentScope().getBreadcrumbs();
      const apiBreadcrumb = breadcrumbs.find(b => b.message === 'API request completed');
      expect(apiBreadcrumb).toBeDefined();
      expect(apiBreadcrumb).toMatchObject({
        category: 'api',
        message: 'API request completed',
        level: 'info',
      });
      expect(apiBreadcrumb?.data).toMatchObject({
        endpoint: '/api/users',
        method: 'GET',
        status: 200,
        duration: 150,
      });
    });

    it('tracks failed API request with error level', () => {
      helpers.trackApiRequest('/api/users', 'failed', { error: 'Network error' });

      const logger = UniversalLogger.getInstance();
      const breadcrumbs = logger.getCurrentScope().getBreadcrumbs();
      const apiBreadcrumb = breadcrumbs.find(b => b.message === 'API request failed');
      expect(apiBreadcrumb).toBeDefined();
      expect(apiBreadcrumb?.level).toBe('error');
    });
  });

  describe('helpers.trackUserAction', () => {
    it('tracks user action breadcrumb', () => {
      helpers.trackUserAction('Clicked checkout button', {
        cartItems: 5,
        totalAmount: 129.99,
      });

      const logger = UniversalLogger.getInstance();
      const breadcrumbs = logger.getCurrentScope().getBreadcrumbs();
      const uiBreadcrumb = breadcrumbs.find(b => b.category === 'ui.click');
      expect(uiBreadcrumb).toBeDefined();
      expect(uiBreadcrumb).toMatchObject({
        category: 'ui.click',
        message: 'Clicked checkout button',
        level: 'info',
      });
      expect(uiBreadcrumb?.data).toMatchObject({ cartItems: 5, totalAmount: 129.99 });
    });
  });

  describe('helpers.withContext', () => {
    it('executes function with isolated context', async () => {
      let capturedEventId: string | undefined;

      helpers.withContext(
        { tags: { operation: 'payment' }, extra: { orderId: '123' } },
        () => {
          const logger = UniversalLogger.getInstance();
          capturedEventId = logger.captureMessage('Payment processed');
        }
      );

      expect(capturedEventId).toBeDefined();

      await waitForProcessing();

      const logger = UniversalLogger.getInstance();
      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === capturedEventId);
      expect(event).toBeDefined();
      expect(event?.tags).toMatchObject({ operation: 'payment' });
      expect(event?.extra).toMatchObject({ orderId: '123' });
    });

    it('returns the function return value', () => {
      const result = helpers.withContext(
        { tags: { test: 'true' } },
        () => 'hello world'
      );

      expect(result).toBe('hello world');
    });

    it('does not leak context outside withContext', async () => {
      helpers.withContext(
        { tags: { isolated: 'true' } },
        () => {}
      );

      // Capture outside withContext
      const logger = UniversalLogger.getInstance();
      const eventId = logger.captureMessage('Outside context');

      await waitForProcessing();

      const events = await logger.getSentryEvents();
      const event = events.find(e => e.event_id === eventId);
      expect(event?.tags?.isolated).toBeUndefined();
    });
  });

  describe('sentry alias', () => {
    it('sentry is an alias for helpers', () => {
      expect(sentry).toBe(helpers);
    });
  });
});

describe('configureScope export', () => {
  beforeEach(async () => {
    UniversalLogger.resetInstance();
    const logger = UniversalLogger.getInstance();
    await logger.init({
      _experiments: { storage: 'memory' },
    });
  });

  afterEach(async () => {
    await UniversalLogger.getInstance().close();
    UniversalLogger.resetInstance();
  });

  it('is exported from index', async () => {
    const { configureScope } = await import('../../index');
    expect(configureScope).toBeDefined();
    expect(typeof configureScope).toBe('function');
  });

  it('modifies global scope persistently', async () => {
    const { configureScope, getCurrentScope } = await import('../../index');

    configureScope((scope) => {
      scope.setTag('app_version', '1.0.0');
      scope.setTag('environment', 'production');
    });

    const scope = getCurrentScope();
    expect(scope.getTag('app_version')).toBe('1.0.0');
    expect(scope.getTag('environment')).toBe('production');
  });
});
