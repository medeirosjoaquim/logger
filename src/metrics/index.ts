/**
 * Metrics API Module
 *
 * Sentry-compatible metrics collection for counters, gauges, distributions, sets, and timings.
 *
 * @example
 * ```ts
 * import { metrics } from './metrics';
 *
 * // Increment a counter
 * metrics.increment('page.views');
 * metrics.increment('api.calls', 1, { tags: { endpoint: '/users' } });
 *
 * // Record a gauge
 * metrics.gauge('memory.used', 1024 * 1024 * 512, { unit: 'byte' });
 *
 * // Record a distribution
 * metrics.distribution('response.size', 4096, { unit: 'byte' });
 *
 * // Track unique values with a set
 * metrics.set('user.unique', userId);
 *
 * // Record timing (shorthand for distribution with millisecond unit)
 * metrics.timing('api.response', performance.now() - startTime);
 * ```
 *
 * @see https://docs.sentry.io/platforms/javascript/metrics/
 */

// Types
export type {
  MetricUnit,
  MetricType,
  MetricOptions,
  MetricData,
  AggregatedCounter,
  AggregatedGauge,
  AggregatedDistribution,
  AggregatedSet,
  AggregatedMetric,
  MetricBucketKey,
  MetricBuckets,
  BeforeSendMetricCallback,
  MetricsConfig,
  MetricsAPI,
  StatsdMetric,
  MetricBucket,
} from './types.js';

// Aggregator
export {
  MetricsAggregator,
  generateBucketKey,
  floorToInterval,
  calculateDistributionStats,
} from './aggregator.js';

// Envelope
export {
  encodeMetricName,
  encodeTagKey,
  encodeTagValue,
  formatTags,
  formatValue,
  hashString,
  formatStatsdLine,
  formatStatsdBatch,
  createMetricEnvelopePayload,
  createMetricEnvelopeItemHeader,
  metricDataToStatsd,
  getStatsdTypeChar,
  batchMetricData,
  createMetricEnvelope,
  serializeMetricEnvelope,
  parseStatsdLine,
  type MetricEnvelope,
} from './envelope.js';

// Main metrics implementation
export {
  Metrics,
  getMetrics,
  initMetrics,
  resetMetrics,
  increment,
  gauge,
  distribution,
  set,
  timing,
  flushMetrics,
  createScopedMetrics,
  measureAsync,
  measureSync,
} from './metrics.js';

// Create the default metrics API object for Sentry-style usage
import {
  getMetrics,
  increment,
  gauge,
  distribution,
  set,
  timing,
  flushMetrics,
} from './metrics.js';

/**
 * Default metrics API object
 * Provides Sentry-compatible metrics interface
 *
 * @example
 * ```ts
 * import { metrics } from '@universal-logger/core';
 *
 * metrics.increment('page.views');
 * metrics.gauge('memory.used', 512, { unit: 'megabyte' });
 * metrics.timing('api.latency', responseTime);
 * ```
 */
export const metrics = {
  /**
   * Increment a counter metric.
   * @param name - Name of the counter
   * @param value - Value to add (default: 1)
   * @param options - Optional tags, unit, and timestamp
   */
  increment,

  /**
   * Record a gauge metric (current value at a point in time).
   * @param name - Name of the gauge
   * @param value - Current value
   * @param options - Optional tags, unit, and timestamp
   */
  gauge,

  /**
   * Record a distribution metric (for histograms/percentiles).
   * @param name - Name of the distribution
   * @param value - Value to add to the distribution
   * @param options - Optional tags, unit, and timestamp
   */
  distribution,

  /**
   * Record a set metric (track unique values).
   * @param name - Name of the set
   * @param value - Value to add to the set
   * @param options - Optional tags, unit, and timestamp
   */
  set,

  /**
   * Record a timing metric (shorthand for distribution with millisecond unit).
   * @param name - Name of the timing metric
   * @param value - Duration in milliseconds
   * @param options - Optional tags and timestamp
   */
  timing,

  /**
   * Flush all buffered metrics immediately.
   * @returns Promise that resolves when flush is complete
   */
  flush: flushMetrics,

  /**
   * Get the underlying Metrics instance for advanced configuration.
   */
  getInstance: getMetrics,
};

export default metrics;
