/**
 * Metrics Implementation
 *
 * Main implementation of the Sentry-compatible Metrics API.
 * Provides methods for recording counters, gauges, distributions, sets, and timings.
 *
 * @see https://docs.sentry.io/platforms/javascript/metrics/
 */

import type {
  MetricsAPI,
  MetricsConfig,
  MetricOptions,
  MetricData,
  MetricType,
  MetricUnit,
  BeforeSendMetricCallback,
} from './types.js';
import { MetricsAggregator } from './aggregator.js';
import { createMetricEnvelope, serializeMetricEnvelope } from './envelope.js';

/**
 * Default configuration values
 */
const DEFAULT_CONFIG: Required<MetricsConfig> = {
  enabled: true,
  flushInterval: 5000, // 5 seconds
  maxBuckets: 1000,
  defaultTags: {},
  beforeSendMetric: (metric: MetricData) => metric,
  onFlush: () => {},
};

/**
 * Metrics class implementation
 *
 * Provides the full Sentry metrics API with aggregation and flushing.
 */
export class Metrics implements MetricsAPI {
  private _config: Required<MetricsConfig>;
  private _aggregator: MetricsAggregator;
  private _flushTimer: ReturnType<typeof setInterval> | null = null;
  private _flushing = false;

  constructor(config: MetricsConfig = {}) {
    this._config = { ...DEFAULT_CONFIG, ...config };
    this._aggregator = new MetricsAggregator({
      maxBuckets: this._config.maxBuckets,
    });

    // Start periodic flush if enabled
    if (this._config.enabled && this._config.flushInterval > 0) {
      this._startFlushTimer();
    }
  }

  /**
   * Start the periodic flush timer
   */
  private _startFlushTimer(): void {
    if (this._flushTimer) {
      return;
    }

    this._flushTimer = setInterval(() => {
      this.flush().catch((err) => {
        console.error('[Metrics] Flush error:', err);
      });
    }, this._config.flushInterval);

    // Unref the timer in Node.js so it doesn't keep the process alive
    if (typeof this._flushTimer === 'object' && 'unref' in this._flushTimer) {
      (this._flushTimer as { unref(): void }).unref();
    }
  }

  /**
   * Stop the periodic flush timer
   */
  private _stopFlushTimer(): void {
    if (this._flushTimer) {
      clearInterval(this._flushTimer);
      this._flushTimer = null;
    }
  }

  /**
   * Record a metric
   */
  private _record(
    name: string,
    type: MetricType,
    value: number | string,
    options: MetricOptions = {}
  ): void {
    if (!this._config.enabled) {
      return;
    }

    // Build the metric data
    const metric: MetricData = {
      name,
      type,
      value,
      tags: { ...this._config.defaultTags, ...options.tags },
      unit: options.unit ?? 'none',
      timestamp: options.timestamp ?? Date.now() / 1000,
    };

    // Apply beforeSendMetric callback
    if (this._config.beforeSendMetric) {
      const processed = this._config.beforeSendMetric(metric);
      if (processed === null) {
        return; // Metric was filtered out
      }
      // Use processed metric
      this._aggregator.add(processed);
    } else {
      this._aggregator.add(metric);
    }

    // Check if we should force flush due to bucket limit
    if (this._aggregator.size >= this._config.maxBuckets) {
      this.flush().catch((err) => {
        console.error('[Metrics] Force flush error:', err);
      });
    }
  }

  /**
   * Increment a counter metric
   *
   * @param name - Name of the counter
   * @param value - Value to add (default: 1)
   * @param options - Optional tags, unit, and timestamp
   */
  increment(name: string, value: number = 1, options?: MetricOptions): void {
    this._record(name, 'counter', value, options);
  }

  /**
   * Record a gauge metric
   *
   * @param name - Name of the gauge
   * @param value - Current value
   * @param options - Optional tags, unit, and timestamp
   */
  gauge(name: string, value: number, options?: MetricOptions): void {
    this._record(name, 'gauge', value, options);
  }

  /**
   * Record a distribution metric
   *
   * @param name - Name of the distribution
   * @param value - Value to add to the distribution
   * @param options - Optional tags, unit, and timestamp
   */
  distribution(name: string, value: number, options?: MetricOptions): void {
    this._record(name, 'distribution', value, options);
  }

  /**
   * Record a set metric
   *
   * @param name - Name of the set
   * @param value - Value to add to the set
   * @param options - Optional tags, unit, and timestamp
   */
  set(name: string, value: string | number, options?: MetricOptions): void {
    this._record(name, 'set', value, options);
  }

  /**
   * Record a timing metric
   * Shorthand for distribution with millisecond unit
   *
   * @param name - Name of the timing metric
   * @param value - Duration in milliseconds
   * @param options - Optional tags and timestamp
   */
  timing(name: string, value: number, options?: MetricOptions): void {
    this._record(name, 'distribution', value, {
      ...options,
      unit: options?.unit ?? 'millisecond',
    });
  }

  /**
   * Flush all buffered metrics immediately
   */
  async flush(): Promise<void> {
    if (this._flushing || this._aggregator.isEmpty) {
      return;
    }

    this._flushing = true;

    try {
      const metrics = this._aggregator.flush();

      if (metrics.length > 0 && this._config.onFlush) {
        await this._config.onFlush(metrics);
      }
    } finally {
      this._flushing = false;
    }
  }

  /**
   * Get the current configuration
   */
  getConfig(): MetricsConfig {
    return { ...this._config };
  }

  /**
   * Update configuration options
   */
  configure(config: Partial<MetricsConfig>): void {
    const wasEnabled = this._config.enabled;
    const oldInterval = this._config.flushInterval;

    this._config = { ...this._config, ...config };

    // Handle enable/disable
    if (config.enabled !== undefined) {
      if (config.enabled && !wasEnabled) {
        // Enabling
        if (this._config.flushInterval > 0) {
          this._startFlushTimer();
        }
      } else if (!config.enabled && wasEnabled) {
        // Disabling
        this._stopFlushTimer();
      }
    }

    // Handle flush interval change
    if (config.flushInterval !== undefined && config.flushInterval !== oldInterval) {
      this._stopFlushTimer();
      if (this._config.enabled && this._config.flushInterval > 0) {
        this._startFlushTimer();
      }
    }

    // Update aggregator max buckets
    if (config.maxBuckets !== undefined) {
      this._aggregator = new MetricsAggregator({
        maxBuckets: this._config.maxBuckets,
      });
    }
  }

  /**
   * Close the metrics system
   * Flushes remaining metrics and stops the timer
   */
  async close(): Promise<void> {
    this._stopFlushTimer();
    await this.flush();
    this._config.enabled = false;
  }

  /**
   * Get the serialized envelope for current metrics
   * Useful for custom transport implementations
   */
  getEnvelope(dsn?: string): string | null {
    const metrics = this._aggregator.flush();

    if (metrics.length === 0) {
      return null;
    }

    const envelope = createMetricEnvelope(metrics, dsn);
    return serializeMetricEnvelope(envelope);
  }
}

/**
 * Singleton metrics instance
 */
let _metricsInstance: Metrics | null = null;

/**
 * Get the singleton metrics instance
 */
export function getMetrics(): Metrics {
  if (!_metricsInstance) {
    _metricsInstance = new Metrics();
  }
  return _metricsInstance;
}

/**
 * Initialize the metrics system with configuration
 */
export function initMetrics(config: MetricsConfig): Metrics {
  if (_metricsInstance) {
    _metricsInstance.configure(config);
  } else {
    _metricsInstance = new Metrics(config);
  }
  return _metricsInstance;
}

/**
 * Reset the metrics singleton (for testing)
 */
export function resetMetrics(): void {
  if (_metricsInstance) {
    _metricsInstance.close();
    _metricsInstance = null;
  }
}

/**
 * Create standalone metrics API functions
 * These are bound to the singleton instance
 */
export const increment = (name: string, value?: number, options?: MetricOptions): void => {
  getMetrics().increment(name, value, options);
};

export const gauge = (name: string, value: number, options?: MetricOptions): void => {
  getMetrics().gauge(name, value, options);
};

export const distribution = (name: string, value: number, options?: MetricOptions): void => {
  getMetrics().distribution(name, value, options);
};

export const set = (name: string, value: string | number, options?: MetricOptions): void => {
  getMetrics().set(name, value, options);
};

export const timing = (name: string, value: number, options?: MetricOptions): void => {
  getMetrics().timing(name, value, options);
};

export const flushMetrics = (): Promise<void> => {
  return getMetrics().flush();
};

/**
 * Create a scoped metrics API with default tags
 */
export function createScopedMetrics(defaultTags: Record<string, string>): {
  increment: (name: string, value?: number, options?: MetricOptions) => void;
  gauge: (name: string, value: number, options?: MetricOptions) => void;
  distribution: (name: string, value: number, options?: MetricOptions) => void;
  set: (name: string, value: string | number, options?: MetricOptions) => void;
  timing: (name: string, value: number, options?: MetricOptions) => void;
} {
  const metricsInstance = getMetrics();

  const withDefaultTags = (options?: MetricOptions): MetricOptions => ({
    ...options,
    tags: { ...defaultTags, ...options?.tags },
  });

  return {
    increment: (name, value, options) => metricsInstance.increment(name, value, withDefaultTags(options)),
    gauge: (name, value, options) => metricsInstance.gauge(name, value, withDefaultTags(options)),
    distribution: (name, value, options) => metricsInstance.distribution(name, value, withDefaultTags(options)),
    set: (name, value, options) => metricsInstance.set(name, value, withDefaultTags(options)),
    timing: (name, value, options) => metricsInstance.timing(name, value, withDefaultTags(options)),
  };
}

/**
 * Utility: Measure execution time of a function
 */
export async function measureAsync<T>(
  name: string,
  fn: () => Promise<T>,
  options?: MetricOptions
): Promise<T> {
  const start = performance.now();
  try {
    return await fn();
  } finally {
    const duration = performance.now() - start;
    timing(name, duration, options);
  }
}

/**
 * Utility: Measure execution time of a synchronous function
 */
export function measureSync<T>(
  name: string,
  fn: () => T,
  options?: MetricOptions
): T {
  const start = performance.now();
  try {
    return fn();
  } finally {
    const duration = performance.now() - start;
    timing(name, duration, options);
  }
}
