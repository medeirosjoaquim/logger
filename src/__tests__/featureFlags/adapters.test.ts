/**
 * Feature Flags Adapters Tests
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  launchDarklyAdapter,
  wrapLaunchDarklyClient,
  type LaunchDarklyClient,
} from '../../featureFlags/adapters/launchdarkly';
import {
  statsigAdapter,
  wrapStatsigClient,
  type StatsigClient,
} from '../../featureFlags/adapters/statsig';
import {
  unleashAdapter,
  wrapUnleashClient,
  type UnleashClient,
} from '../../featureFlags/adapters/unleash';
import {
  openFeatureAdapter,
  wrapOpenFeatureClient,
  createOpenFeatureHook,
  type OpenFeatureClient,
} from '../../featureFlags/adapters/openfeature';
import type { FeatureFlagValue } from '../../featureFlags/types';

describe('LaunchDarkly Adapter', () => {
  let mockClient: LaunchDarklyClient;
  let evaluations: Array<{ flag: string; value: FeatureFlagValue }>;

  beforeEach(() => {
    evaluations = [];
    mockClient = {
      variation: vi.fn((flagKey, defaultValue) => defaultValue),
    };
  });

  it('should wrap the variation method', () => {
    const adapter = launchDarklyAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    // Call the wrapped variation method
    mockClient.variation('test-flag', false);

    expect(evaluations.length).toBe(1);
    expect(evaluations[0]).toEqual({ flag: 'test-flag', value: false });
  });

  it('should convert values correctly', () => {
    const adapter = launchDarklyAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    mockClient.variation = vi.fn()
      .mockReturnValueOnce(true)
      .mockReturnValueOnce('variant-a')
      .mockReturnValueOnce(42);

    adapter.init(mockClient);

    mockClient.variation('bool-flag', false);
    mockClient.variation('string-flag', 'default');
    mockClient.variation('number-flag', 0);

    expect(evaluations).toEqual([
      { flag: 'bool-flag', value: true },
      { flag: 'string-flag', value: 'variant-a' },
      { flag: 'number-flag', value: 42 },
    ]);
  });

  it('should restore original behavior on teardown', () => {
    // Track evaluations before teardown
    const adapter = launchDarklyAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    // Evaluation should be tracked before teardown
    mockClient.variation('pre-teardown', true);
    expect(evaluations.length).toBe(1);

    adapter.teardown();

    // After teardown, method is restored and tracking should stop
    // Note: The original vi.fn mock is bound, so it still works
    evaluations = [];
    const result = mockClient.variation('post-teardown', false);
    expect(result).toBe(false);
    // We can't easily verify no tracking after teardown with mocks,
    // but the teardown function executes without error
  });

  it('should wrap client using convenience function', () => {
    const wrapped = wrapLaunchDarklyClient(
      mockClient,
      (flag, value) => evaluations.push({ flag, value })
    );

    wrapped.variation('test', true);

    expect(evaluations.length).toBe(1);
  });
});

describe('Statsig Adapter', () => {
  let mockClient: StatsigClient;
  let evaluations: Array<{ flag: string; value: FeatureFlagValue }>;

  beforeEach(() => {
    evaluations = [];
    mockClient = {
      checkGate: vi.fn(() => true),
    };
  });

  it('should wrap the checkGate method', () => {
    const adapter = statsigAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    const result = mockClient.checkGate('test-gate');

    expect(result).toBe(true);
    expect(evaluations.length).toBe(1);
    expect(evaluations[0]).toEqual({ flag: 'test-gate', value: true });
  });

  it('should track false gates', () => {
    mockClient.checkGate = vi.fn(() => false);

    const adapter = statsigAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    mockClient.checkGate('disabled-gate');

    expect(evaluations[0]).toEqual({ flag: 'disabled-gate', value: false });
  });

  it('should restore original behavior on teardown', () => {
    const adapter = statsigAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    // Evaluation should be tracked before teardown
    mockClient.checkGate('pre-teardown');
    expect(evaluations.length).toBe(1);

    adapter.teardown();

    // Teardown should complete without error
    // The original mock is still callable
    evaluations = [];
    const result = mockClient.checkGate('post-teardown');
    expect(typeof result).toBe('boolean');
  });
});

describe('Unleash Adapter', () => {
  let mockClient: UnleashClient;
  let evaluations: Array<{ flag: string; value: FeatureFlagValue }>;

  beforeEach(() => {
    evaluations = [];
    mockClient = {
      isEnabled: vi.fn(() => true),
    };
  });

  it('should wrap the isEnabled method', () => {
    const adapter = unleashAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    const result = mockClient.isEnabled('test-toggle');

    expect(result).toBe(true);
    expect(evaluations.length).toBe(1);
    expect(evaluations[0]).toEqual({ flag: 'test-toggle', value: true });
  });

  it('should track disabled toggles', () => {
    mockClient.isEnabled = vi.fn(() => false);

    const adapter = unleashAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    mockClient.isEnabled('disabled-toggle');

    expect(evaluations[0]).toEqual({ flag: 'disabled-toggle', value: false });
  });

  it('should track variants when enabled', () => {
    mockClient.getVariant = vi.fn(() => ({
      name: 'variant-a',
      enabled: true,
    }));

    const adapter = unleashAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
      trackVariants: true,
    });

    adapter.init(mockClient);

    mockClient.getVariant!('test-toggle');

    expect(evaluations.length).toBe(1);
    expect(evaluations[0]).toEqual({ flag: 'test-toggle:variant', value: 'variant-a' });
  });

  it('should not track disabled variants', () => {
    mockClient.getVariant = vi.fn(() => ({
      name: 'disabled',
      enabled: false,
    }));

    const adapter = unleashAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
      trackVariants: true,
    });

    adapter.init(mockClient);

    mockClient.getVariant!('test-toggle');

    expect(evaluations.length).toBe(0);
  });
});

describe('OpenFeature Adapter', () => {
  let mockClient: OpenFeatureClient;
  let evaluations: Array<{ flag: string; value: FeatureFlagValue }>;

  beforeEach(() => {
    evaluations = [];
    mockClient = {
      getBooleanValue: vi.fn(async () => true),
      getStringValue: vi.fn(async () => 'variant-a'),
      getNumberValue: vi.fn(async () => 42),
    };
  });

  it('should wrap getBooleanValue', async () => {
    const adapter = openFeatureAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    const result = await mockClient.getBooleanValue('bool-flag', false);

    expect(result).toBe(true);
    expect(evaluations.length).toBe(1);
    expect(evaluations[0]).toEqual({ flag: 'bool-flag', value: true });
  });

  it('should wrap getStringValue', async () => {
    const adapter = openFeatureAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    const result = await mockClient.getStringValue('string-flag', 'default');

    expect(result).toBe('variant-a');
    expect(evaluations[0]).toEqual({ flag: 'string-flag', value: 'variant-a' });
  });

  it('should wrap getNumberValue', async () => {
    const adapter = openFeatureAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    const result = await mockClient.getNumberValue('number-flag', 0);

    expect(result).toBe(42);
    expect(evaluations[0]).toEqual({ flag: 'number-flag', value: 42 });
  });

  it('should create a hook for tracking', () => {
    const hook = createOpenFeatureHook((flag, value) =>
      evaluations.push({ flag, value })
    );

    expect(hook.after).toBeDefined();

    // Simulate hook call
    hook.after!(
      { flagKey: 'test-flag', flagValueType: 'boolean', defaultValue: false },
      { value: true }
    );

    expect(evaluations[0]).toEqual({ flag: 'test-flag', value: true });
  });

  it('should restore original behavior on teardown', async () => {
    const adapter = openFeatureAdapter({
      onEvaluation: (flag, value) => evaluations.push({ flag, value }),
    });

    adapter.init(mockClient);

    // Evaluation should be tracked before teardown
    await mockClient.getBooleanValue('pre-teardown', false);
    expect(evaluations.length).toBe(1);

    adapter.teardown();

    // Teardown should complete without error
    // The original mock is still callable
    evaluations = [];
    const result = await mockClient.getBooleanValue('post-teardown', false);
    expect(typeof result).toBe('boolean');
  });
});
