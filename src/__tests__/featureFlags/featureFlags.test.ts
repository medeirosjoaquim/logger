/**
 * Feature Flags Integration Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  featureFlagsIntegration,
  getFeatureFlagsIntegration,
  resetFeatureFlagsIntegration,
  addFeatureFlagEvaluation,
  getFeatureFlagEvaluations,
  getFeatureFlags,
  clearFeatureFlagEvaluations,
  getFeatureFlag,
  hasFeatureFlag,
  getFeatureFlagHistory,
} from '../../featureFlags';

describe('Feature Flags Integration', () => {
  beforeEach(() => {
    resetFeatureFlagsIntegration();
  });

  afterEach(() => {
    resetFeatureFlagsIntegration();
  });

  describe('featureFlagsIntegration', () => {
    it('should create an integration with default options', () => {
      const integration = featureFlagsIntegration();
      expect(integration.name).toBe('FeatureFlags');
      expect(typeof integration.trackEvaluation).toBe('function');
      expect(typeof integration.getEvaluations).toBe('function');
      expect(typeof integration.getFlags).toBe('function');
      expect(typeof integration.clearEvaluations).toBe('function');
    });

    it('should track flag evaluations', () => {
      const integration = featureFlagsIntegration();

      integration.trackEvaluation('feature-a', true);
      integration.trackEvaluation('feature-b', 'variant-1');
      integration.trackEvaluation('feature-c', 42);

      const flags = integration.getFlags();
      expect(flags['feature-a']).toBe(true);
      expect(flags['feature-b']).toBe('variant-1');
      expect(flags['feature-c']).toBe(42);
    });

    it('should store evaluation history', () => {
      const integration = featureFlagsIntegration();

      integration.trackEvaluation('feature-a', true);
      integration.trackEvaluation('feature-b', false);

      const evaluations = integration.getEvaluations();
      expect(evaluations.length).toBe(2);
      expect(evaluations[0].flagName).toBe('feature-a');
      expect(evaluations[0].flagValue).toBe(true);
      expect(evaluations[1].flagName).toBe('feature-b');
      expect(evaluations[1].flagValue).toBe(false);
    });

    it('should limit evaluations to maxEvaluations', () => {
      const integration = featureFlagsIntegration({ maxEvaluations: 3 });

      integration.trackEvaluation('flag-1', true);
      integration.trackEvaluation('flag-2', true);
      integration.trackEvaluation('flag-3', true);
      integration.trackEvaluation('flag-4', true);
      integration.trackEvaluation('flag-5', true);

      const evaluations = integration.getEvaluations();
      expect(evaluations.length).toBe(3);
      expect(evaluations[0].flagName).toBe('flag-3');
      expect(evaluations[2].flagName).toBe('flag-5');
    });

    it('should not track duplicates by default', () => {
      const integration = featureFlagsIntegration();

      integration.trackEvaluation('feature-a', true);
      integration.trackEvaluation('feature-a', true); // Same value, should be ignored
      integration.trackEvaluation('feature-a', false); // Different value, should be tracked

      const evaluations = integration.getEvaluations();
      expect(evaluations.length).toBe(2);
    });

    it('should track duplicates when trackDuplicates is true', () => {
      const integration = featureFlagsIntegration({ trackDuplicates: true });

      integration.trackEvaluation('feature-a', true);
      integration.trackEvaluation('feature-a', true);

      const evaluations = integration.getEvaluations();
      expect(evaluations.length).toBe(2);
    });

    it('should clear evaluations', () => {
      const integration = featureFlagsIntegration();

      integration.trackEvaluation('feature-a', true);
      integration.trackEvaluation('feature-b', false);

      integration.clearEvaluations();

      expect(integration.getEvaluations().length).toBe(0);
      expect(Object.keys(integration.getFlags()).length).toBe(0);
    });

    it('should process events and attach flag context', async () => {
      const integration = featureFlagsIntegration();

      integration.trackEvaluation('feature-a', true);
      integration.trackEvaluation('feature-b', 'variant-1');

      const event = {
        event_id: 'test-event-id',
        timestamp: Date.now() / 1000,
      };

      const processedEvent = await integration.processEvent!(
        event as any,
        {} as any,
        {} as any
      );

      expect(processedEvent).not.toBeNull();
      expect(processedEvent!.contexts).toBeDefined();
      expect(processedEvent!.contexts!.flags).toBeDefined();
      expect((processedEvent!.contexts!.flags as any).flags['feature-a']).toBe(true);
      expect((processedEvent!.contexts!.flags as any).flags['feature-b']).toBe('variant-1');
    });

    it('should not attach flag context when attachToEvents is false', async () => {
      const integration = featureFlagsIntegration({ attachToEvents: false });

      integration.trackEvaluation('feature-a', true);

      const event = {
        event_id: 'test-event-id',
        timestamp: Date.now() / 1000,
      };

      const processedEvent = await integration.processEvent!(
        event as any,
        {} as any,
        {} as any
      );

      expect(processedEvent).not.toBeNull();
      expect(processedEvent!.contexts?.flags).toBeUndefined();
    });

    it('should use custom context key', async () => {
      const integration = featureFlagsIntegration({ contextKey: 'feature_flags' });

      integration.trackEvaluation('feature-a', true);

      const event = {
        event_id: 'test-event-id',
        timestamp: Date.now() / 1000,
      };

      const processedEvent = await integration.processEvent!(
        event as any,
        {} as any,
        {} as any
      );

      expect(processedEvent!.contexts!.feature_flags).toBeDefined();
      expect(processedEvent!.contexts!.flags).toBeUndefined();
    });
  });

  describe('Public API', () => {
    it('should add flag evaluations', () => {
      addFeatureFlagEvaluation('my-feature', true);
      addFeatureFlagEvaluation('variant', 'blue');
      addFeatureFlagEvaluation('timeout', 5000);

      const flags = getFeatureFlags();
      expect(flags['my-feature']).toBe(true);
      expect(flags['variant']).toBe('blue');
      expect(flags['timeout']).toBe(5000);
    });

    it('should get flag evaluations', () => {
      addFeatureFlagEvaluation('feature-1', true);
      addFeatureFlagEvaluation('feature-2', false);

      const evaluations = getFeatureFlagEvaluations();
      expect(evaluations.length).toBe(2);
      expect(evaluations[0].flagName).toBe('feature-1');
      expect(evaluations[1].flagName).toBe('feature-2');
    });

    it('should get a specific flag value', () => {
      addFeatureFlagEvaluation('my-feature', true);

      expect(getFeatureFlag('my-feature')).toBe(true);
      expect(getFeatureFlag('non-existent')).toBeUndefined();
    });

    it('should check if a flag has been evaluated', () => {
      addFeatureFlagEvaluation('my-feature', true);

      expect(hasFeatureFlag('my-feature')).toBe(true);
      expect(hasFeatureFlag('non-existent')).toBe(false);
    });

    it('should get flag history', () => {
      addFeatureFlagEvaluation('feature-a', true);
      addFeatureFlagEvaluation('feature-b', false);
      addFeatureFlagEvaluation('feature-a', false);

      const history = getFeatureFlagHistory('feature-a');
      expect(history.length).toBe(2);
      expect(history[0].flagValue).toBe(true);
      expect(history[1].flagValue).toBe(false);
    });

    it('should clear all evaluations', () => {
      addFeatureFlagEvaluation('feature-1', true);
      addFeatureFlagEvaluation('feature-2', false);

      clearFeatureFlagEvaluations();

      expect(getFeatureFlagEvaluations().length).toBe(0);
      expect(Object.keys(getFeatureFlags()).length).toBe(0);
    });
  });

  describe('Global Integration', () => {
    it('should return the same global integration instance', () => {
      const integration1 = getFeatureFlagsIntegration();
      const integration2 = getFeatureFlagsIntegration();

      expect(integration1).toBe(integration2);
    });

    it('should reset the global integration', () => {
      const integration1 = getFeatureFlagsIntegration();
      integration1.trackEvaluation('test', true);

      resetFeatureFlagsIntegration();

      const integration2 = getFeatureFlagsIntegration();
      expect(integration2.getEvaluations().length).toBe(0);
    });
  });
});
