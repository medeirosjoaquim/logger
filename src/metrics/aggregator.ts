/**
 * Metrics Aggregator
 *
 * Handles in-memory aggregation of metrics before flushing.
 * Aggregates counters by summing, gauges by keeping latest value with min/max/avg,
 * distributions by collecting all values, and sets by tracking unique values.
 */

import type {
  MetricData,
  MetricType,
  MetricUnit,
  MetricBucketKey,
  AggregatedMetric,
  AggregatedCounter,
  AggregatedGauge,
  AggregatedDistribution,
  AggregatedSet,
  StatsdMetric,
  MetricBucket,
} from './types.js';

/**
 * Default bucket interval in seconds (10 seconds)
 */
const DEFAULT_BUCKET_INTERVAL = 10;

/**
 * Generate a bucket key for metric aggregation
 * Format: `${type}:${name}:${sortedTags}`
 */
export function generateBucketKey(
  name: string,
  type: MetricType,
  tags: Record<string, string>
): MetricBucketKey {
  // Sort tags by key for consistent bucketing
  const sortedTags = Object.keys(tags)
    .sort()
    .map((key) => `${key}=${tags[key]}`)
    .join(',');

  return `${type}:${name}:${sortedTags}`;
}

/**
 * Floor timestamp to bucket interval
 */
export function floorToInterval(timestamp: number, interval: number = DEFAULT_BUCKET_INTERVAL): number {
  return Math.floor(timestamp / interval) * interval;
}

/**
 * MetricsAggregator class
 *
 * Buffers metrics in memory and aggregates them by type:
 * - Counters: Sum all values
 * - Gauges: Keep last value, track min/max/sum/count for averaging
 * - Distributions: Collect all values for percentile calculation
 * - Sets: Track unique values
 */
export class MetricsAggregator {
  private _buckets: Map<MetricBucketKey, AggregatedMetric> = new Map();
  private _maxBuckets: number;
  private _bucketInterval: number;

  constructor(options: { maxBuckets?: number; bucketInterval?: number } = {}) {
    this._maxBuckets = options.maxBuckets ?? 1000;
    this._bucketInterval = options.bucketInterval ?? DEFAULT_BUCKET_INTERVAL;
  }

  /**
   * Add a metric data point to the aggregator
   */
  add(metric: MetricData): void {
    const bucketKey = generateBucketKey(metric.name, metric.type, metric.tags);
    const existing = this._buckets.get(bucketKey);

    if (existing) {
      this._updateBucket(existing, metric);
    } else {
      this._createBucket(bucketKey, metric);
    }
  }

  /**
   * Create a new bucket for a metric
   */
  private _createBucket(key: MetricBucketKey, metric: MetricData): void {
    // Check if we need to enforce max buckets
    if (this._buckets.size >= this._maxBuckets) {
      // Remove oldest bucket (first entry)
      const firstKey = this._buckets.keys().next().value;
      if (firstKey) {
        this._buckets.delete(firstKey);
      }
    }

    const timestamp = metric.timestamp;

    switch (metric.type) {
      case 'counter': {
        const counter: AggregatedCounter = {
          type: 'counter',
          value: typeof metric.value === 'number' ? metric.value : 0,
          tags: { ...metric.tags },
          unit: metric.unit,
          firstTimestamp: timestamp,
          lastTimestamp: timestamp,
        };
        this._buckets.set(key, counter);
        break;
      }

      case 'gauge': {
        const value = typeof metric.value === 'number' ? metric.value : 0;
        const gauge: AggregatedGauge = {
          type: 'gauge',
          value,
          min: value,
          max: value,
          sum: value,
          count: 1,
          tags: { ...metric.tags },
          unit: metric.unit,
          firstTimestamp: timestamp,
          lastTimestamp: timestamp,
        };
        this._buckets.set(key, gauge);
        break;
      }

      case 'distribution': {
        const distribution: AggregatedDistribution = {
          type: 'distribution',
          values: [typeof metric.value === 'number' ? metric.value : 0],
          tags: { ...metric.tags },
          unit: metric.unit,
          firstTimestamp: timestamp,
          lastTimestamp: timestamp,
        };
        this._buckets.set(key, distribution);
        break;
      }

      case 'set': {
        const set: AggregatedSet = {
          type: 'set',
          values: new Set([metric.value]),
          tags: { ...metric.tags },
          unit: metric.unit,
          firstTimestamp: timestamp,
          lastTimestamp: timestamp,
        };
        this._buckets.set(key, set);
        break;
      }
    }
  }

  /**
   * Update an existing bucket with a new metric value
   */
  private _updateBucket(bucket: AggregatedMetric, metric: MetricData): void {
    bucket.lastTimestamp = Math.max(bucket.lastTimestamp, metric.timestamp);
    bucket.firstTimestamp = Math.min(bucket.firstTimestamp, metric.timestamp);

    switch (bucket.type) {
      case 'counter': {
        (bucket as AggregatedCounter).value += typeof metric.value === 'number' ? metric.value : 0;
        break;
      }

      case 'gauge': {
        const gauge = bucket as AggregatedGauge;
        const value = typeof metric.value === 'number' ? metric.value : 0;
        gauge.value = value; // Gauge always keeps the last value
        gauge.min = Math.min(gauge.min, value);
        gauge.max = Math.max(gauge.max, value);
        gauge.sum += value;
        gauge.count += 1;
        break;
      }

      case 'distribution': {
        const distribution = bucket as AggregatedDistribution;
        distribution.values.push(typeof metric.value === 'number' ? metric.value : 0);
        break;
      }

      case 'set': {
        const set = bucket as AggregatedSet;
        set.values.add(metric.value);
        break;
      }
    }
  }

  /**
   * Get the current number of buckets
   */
  get size(): number {
    return this._buckets.size;
  }

  /**
   * Check if there are any metrics buffered
   */
  get isEmpty(): boolean {
    return this._buckets.size === 0;
  }

  /**
   * Flush all aggregated metrics and return them as MetricData array
   * Clears the internal buffer.
   */
  flush(): MetricData[] {
    const result: MetricData[] = [];

    for (const [key, bucket] of this._buckets.entries()) {
      const [type, name] = key.split(':');

      switch (bucket.type) {
        case 'counter': {
          result.push({
            name,
            type: 'counter',
            value: bucket.value,
            tags: bucket.tags,
            unit: bucket.unit,
            timestamp: bucket.lastTimestamp,
          });
          break;
        }

        case 'gauge': {
          // For gauge, we could emit multiple data points
          // Here we emit the last value as the primary metric
          result.push({
            name,
            type: 'gauge',
            value: bucket.value,
            tags: bucket.tags,
            unit: bucket.unit,
            timestamp: bucket.lastTimestamp,
          });
          break;
        }

        case 'distribution': {
          // For distribution, emit each value separately for transport
          // The receiver will aggregate them
          for (const value of bucket.values) {
            result.push({
              name,
              type: 'distribution',
              value,
              tags: bucket.tags,
              unit: bucket.unit,
              timestamp: bucket.lastTimestamp,
            });
          }
          break;
        }

        case 'set': {
          // For set, emit each unique value
          for (const value of bucket.values) {
            result.push({
              name,
              type: 'set',
              value,
              tags: bucket.tags,
              unit: bucket.unit,
              timestamp: bucket.lastTimestamp,
            });
          }
          break;
        }
      }
    }

    // Clear the buckets
    this._buckets.clear();

    return result;
  }

  /**
   * Flush metrics in statsd format for Sentry envelope
   * Groups metrics by timestamp bucket
   */
  flushToStatsd(): MetricBucket[] {
    const bucketsByTime = new Map<number, StatsdMetric[]>();

    for (const [key, bucket] of this._buckets.entries()) {
      // Parse the key to get name
      const parts = key.split(':');
      const name = parts[1];
      const flooredTimestamp = floorToInterval(bucket.lastTimestamp, this._bucketInterval);

      if (!bucketsByTime.has(flooredTimestamp)) {
        bucketsByTime.set(flooredTimestamp, []);
      }

      const statsdMetric = this._toStatsdMetric(name, bucket);
      bucketsByTime.get(flooredTimestamp)!.push(statsdMetric);
    }

    // Clear buckets
    this._buckets.clear();

    // Convert to array of MetricBucket
    return Array.from(bucketsByTime.entries()).map(([timestamp, metrics]) => ({
      timestamp,
      metrics,
    }));
  }

  /**
   * Convert an aggregated metric to statsd format
   */
  private _toStatsdMetric(name: string, bucket: AggregatedMetric): StatsdMetric {
    const typeChar = this._getTypeChar(bucket.type);

    let values: (number | string)[];

    switch (bucket.type) {
      case 'counter':
        values = [bucket.value];
        break;
      case 'gauge':
        values = [bucket.value];
        break;
      case 'distribution':
        values = [...bucket.values];
        break;
      case 'set':
        values = Array.from(bucket.values);
        break;
    }

    return {
      name,
      type: typeChar,
      values,
      unit: bucket.unit,
      tags: bucket.tags,
      timestamp: bucket.lastTimestamp,
    };
  }

  /**
   * Get the statsd type character for a metric type
   */
  private _getTypeChar(type: MetricType): 'c' | 'g' | 'd' | 's' {
    switch (type) {
      case 'counter':
        return 'c';
      case 'gauge':
        return 'g';
      case 'distribution':
        return 'd';
      case 'set':
        return 's';
    }
  }

  /**
   * Get a snapshot of the current buckets (for debugging)
   */
  getBuckets(): Map<MetricBucketKey, AggregatedMetric> {
    return new Map(this._buckets);
  }

  /**
   * Clear all buckets without flushing
   */
  clear(): void {
    this._buckets.clear();
  }
}

/**
 * Calculate distribution statistics from an array of values
 */
export function calculateDistributionStats(values: number[]): {
  count: number;
  sum: number;
  min: number;
  max: number;
  mean: number;
  median: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
} {
  if (values.length === 0) {
    return {
      count: 0,
      sum: 0,
      min: 0,
      max: 0,
      mean: 0,
      median: 0,
      p75: 0,
      p90: 0,
      p95: 0,
      p99: 0,
    };
  }

  const sorted = [...values].sort((a, b) => a - b);
  const count = sorted.length;
  const sum = sorted.reduce((acc, val) => acc + val, 0);

  const percentile = (p: number): number => {
    const index = Math.ceil((p / 100) * count) - 1;
    return sorted[Math.max(0, Math.min(index, count - 1))];
  };

  return {
    count,
    sum,
    min: sorted[0],
    max: sorted[count - 1],
    mean: sum / count,
    median: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    p95: percentile(95),
    p99: percentile(99),
  };
}
