/**
 * Metrics API Type Definitions
 *
 * Types for Sentry-compatible metrics collection including counters, gauges,
 * distributions, sets, and timing measurements.
 *
 * @see https://docs.sentry.io/platforms/javascript/metrics/
 */

/**
 * Units supported for metrics
 * Based on Sentry's metric units specification
 */
export type MetricUnit =
  // Duration units
  | 'nanosecond'
  | 'microsecond'
  | 'millisecond'
  | 'second'
  | 'minute'
  | 'hour'
  | 'day'
  | 'week'
  // Information units
  | 'bit'
  | 'byte'
  | 'kilobyte'
  | 'kibibyte'
  | 'megabyte'
  | 'mebibyte'
  | 'gigabyte'
  | 'gibibyte'
  | 'terabyte'
  | 'tebibyte'
  | 'petabyte'
  | 'pebibyte'
  | 'exabyte'
  | 'exbibyte'
  // Fraction units
  | 'ratio'
  | 'percent'
  // No unit
  | 'none'
  // Custom unit (string)
  | string;

/**
 * Type of metric
 */
export type MetricType = 'counter' | 'gauge' | 'distribution' | 'set';

/**
 * Options for metric recording
 */
export interface MetricOptions {
  /**
   * Tags to associate with this metric.
   * Tags are key-value pairs used for filtering and grouping.
   */
  tags?: Record<string, string>;

  /**
   * Unit of measurement (e.g., 'millisecond', 'byte', 'percent').
   * Defaults to 'none'.
   */
  unit?: MetricUnit;

  /**
   * Unix timestamp in seconds when the metric was recorded.
   * Defaults to current time.
   */
  timestamp?: number;
}

/**
 * Internal representation of a metric data point
 */
export interface MetricData {
  /**
   * Name of the metric (e.g., 'request.duration', 'page.load')
   */
  name: string;

  /**
   * Type of metric
   */
  type: MetricType;

  /**
   * The metric value.
   * - Counter: number to add
   * - Gauge: current value
   * - Distribution: numeric value to add to distribution
   * - Set: string or number to track unique values
   */
  value: number | string;

  /**
   * Tags associated with this metric
   */
  tags: Record<string, string>;

  /**
   * Unit of measurement
   */
  unit: MetricUnit;

  /**
   * Unix timestamp in seconds when recorded
   */
  timestamp: number;
}

/**
 * Aggregated counter data
 */
export interface AggregatedCounter {
  type: 'counter';
  value: number;
  tags: Record<string, string>;
  unit: MetricUnit;
  firstTimestamp: number;
  lastTimestamp: number;
}

/**
 * Aggregated gauge data (keeps last value)
 */
export interface AggregatedGauge {
  type: 'gauge';
  value: number;
  min: number;
  max: number;
  sum: number;
  count: number;
  tags: Record<string, string>;
  unit: MetricUnit;
  firstTimestamp: number;
  lastTimestamp: number;
}

/**
 * Aggregated distribution data
 */
export interface AggregatedDistribution {
  type: 'distribution';
  values: number[];
  tags: Record<string, string>;
  unit: MetricUnit;
  firstTimestamp: number;
  lastTimestamp: number;
}

/**
 * Aggregated set data
 */
export interface AggregatedSet {
  type: 'set';
  values: Set<string | number>;
  tags: Record<string, string>;
  unit: MetricUnit;
  firstTimestamp: number;
  lastTimestamp: number;
}

/**
 * Union type for all aggregated metric types
 */
export type AggregatedMetric =
  | AggregatedCounter
  | AggregatedGauge
  | AggregatedDistribution
  | AggregatedSet;

/**
 * Bucket key for metric aggregation
 * Format: `${metricType}:${metricName}:${sortedTagsString}`
 */
export type MetricBucketKey = string;

/**
 * Map of metric buckets for aggregation
 */
export type MetricBuckets = Map<MetricBucketKey, AggregatedMetric>;

/**
 * Callback for filtering/modifying metrics before sending
 */
export type BeforeSendMetricCallback = (
  metric: MetricData
) => MetricData | null;

/**
 * Configuration options for the metrics system
 */
export interface MetricsConfig {
  /**
   * Whether metrics collection is enabled.
   * Defaults to true.
   */
  enabled?: boolean;

  /**
   * Flush interval in milliseconds.
   * Metrics are aggregated and flushed at this interval.
   * Defaults to 5000 (5 seconds).
   */
  flushInterval?: number;

  /**
   * Maximum number of metric buckets to keep before forcing a flush.
   * Defaults to 1000.
   */
  maxBuckets?: number;

  /**
   * Default tags to apply to all metrics.
   */
  defaultTags?: Record<string, string>;

  /**
   * Callback to filter/modify metrics before sending.
   * Return null to drop the metric.
   */
  beforeSendMetric?: BeforeSendMetricCallback;

  /**
   * Callback when metrics are flushed (for transport).
   */
  onFlush?: (metrics: MetricData[]) => void | Promise<void>;
}

/**
 * Public Metrics API interface
 * Compatible with Sentry.metrics API
 */
export interface MetricsAPI {
  /**
   * Increment a counter metric.
   *
   * @param name - Name of the counter
   * @param value - Value to add (default: 1)
   * @param options - Optional tags, unit, and timestamp
   *
   * @example
   * ```ts
   * metrics.increment('page.views');
   * metrics.increment('api.calls', 1, { tags: { endpoint: '/users' } });
   * ```
   */
  increment(name: string, value?: number, options?: MetricOptions): void;

  /**
   * Record a gauge metric (current value at a point in time).
   *
   * @param name - Name of the gauge
   * @param value - Current value
   * @param options - Optional tags, unit, and timestamp
   *
   * @example
   * ```ts
   * metrics.gauge('memory.used', 1024 * 1024 * 512, { unit: 'byte' });
   * metrics.gauge('cpu.usage', 65.5, { unit: 'percent' });
   * ```
   */
  gauge(name: string, value: number, options?: MetricOptions): void;

  /**
   * Record a distribution metric (for histograms/percentiles).
   *
   * @param name - Name of the distribution
   * @param value - Value to add to the distribution
   * @param options - Optional tags, unit, and timestamp
   *
   * @example
   * ```ts
   * metrics.distribution('response.size', 4096, { unit: 'byte' });
   * metrics.distribution('request.duration', 125, { unit: 'millisecond' });
   * ```
   */
  distribution(name: string, value: number, options?: MetricOptions): void;

  /**
   * Record a set metric (track unique values).
   *
   * @param name - Name of the set
   * @param value - Value to add to the set
   * @param options - Optional tags, unit, and timestamp
   *
   * @example
   * ```ts
   * metrics.set('user.unique', userId);
   * metrics.set('page.visitors', sessionId);
   * ```
   */
  set(name: string, value: string | number, options?: MetricOptions): void;

  /**
   * Record a timing metric (shorthand for distribution with millisecond unit).
   *
   * @param name - Name of the timing metric
   * @param value - Duration in milliseconds
   * @param options - Optional tags and timestamp (unit defaults to 'millisecond')
   *
   * @example
   * ```ts
   * metrics.timing('api.response', performance.now() - startTime);
   * metrics.timing('db.query', queryDuration, { tags: { table: 'users' } });
   * ```
   */
  timing(name: string, value: number, options?: MetricOptions): void;

  /**
   * Flush all buffered metrics immediately.
   *
   * @returns Promise that resolves when flush is complete
   */
  flush(): Promise<void>;

  /**
   * Get the current configuration.
   */
  getConfig(): MetricsConfig;

  /**
   * Update configuration options.
   */
  configure(config: Partial<MetricsConfig>): void;
}

/**
 * Statsd-style metric line format for envelope encoding
 */
export interface StatsdMetric {
  /**
   * Metric name
   */
  name: string;

  /**
   * Metric type indicator:
   * - 'c' for counter
   * - 'g' for gauge
   * - 'd' for distribution
   * - 's' for set
   */
  type: 'c' | 'g' | 'd' | 's';

  /**
   * Values (single value for c/g, multiple for d/s)
   */
  values: (number | string)[];

  /**
   * Unit of measurement
   */
  unit: string;

  /**
   * Tags as key-value pairs
   */
  tags: Record<string, string>;

  /**
   * Bucket timestamp (unix seconds, typically floored to 10s intervals)
   */
  timestamp: number;
}

/**
 * Metric bucket for statsd encoding
 * Groups metrics by timestamp bucket (typically 10 seconds)
 */
export interface MetricBucket {
  /**
   * Bucket timestamp (floored to bucket interval)
   */
  timestamp: number;

  /**
   * Metrics in this bucket
   */
  metrics: StatsdMetric[];
}
