/**
 * Metrics Envelope Formatting
 *
 * Formats metrics in statsd-style format for Sentry envelope items.
 * Supports batch encoding of multiple metrics.
 *
 * @see https://develop.sentry.dev/sdk/metrics/
 */

import type {
  StatsdMetric,
  MetricBucket,
  MetricData,
  MetricType,
} from './types.js';

/**
 * Encode a metric name for statsd format
 * Replaces invalid characters with underscores
 */
export function encodeMetricName(name: string): string {
  // Metric names should only contain alphanumeric characters, underscores, and dots
  return name.replace(/[^a-zA-Z0-9_.]/g, '_');
}

/**
 * Encode a tag key for statsd format
 */
export function encodeTagKey(key: string): string {
  // Tag keys should only contain alphanumeric characters and underscores
  return key.replace(/[^a-zA-Z0-9_]/g, '_');
}

/**
 * Encode a tag value for statsd format
 * Escapes special characters
 */
export function encodeTagValue(value: string): string {
  // Escape backslashes, pipes, and commas
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\|/g, '\\u007c')
    .replace(/,/g, '\\u002c')
    .replace(/\n/g, '\\n');
}

/**
 * Format tags for statsd line format
 * Returns empty string if no tags
 */
export function formatTags(tags: Record<string, string>): string {
  const entries = Object.entries(tags);
  if (entries.length === 0) {
    return '';
  }

  const formatted = entries
    .map(([key, value]) => `${encodeTagKey(key)}:${encodeTagValue(value)}`)
    .join(',');

  return `|#${formatted}`;
}

/**
 * Format a single metric value for statsd format
 */
export function formatValue(value: number | string): string {
  if (typeof value === 'number') {
    // Format numbers with sufficient precision
    if (Number.isInteger(value)) {
      return String(value);
    }
    // Use up to 6 decimal places
    return value.toFixed(6).replace(/\.?0+$/, '');
  }
  // For string values (sets), hash to number
  return String(hashString(value));
}

/**
 * Simple string hash function for set values
 * Returns a 32-bit integer
 */
export function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash);
}

/**
 * Format a statsd metric line
 *
 * Format: `name@unit:value|type|#tag1:value1,tag2:value2|T timestamp`
 *
 * Examples:
 * - `request.count@none:1|c|#env:production|T1234567890`
 * - `memory.used@byte:1073741824|g|#host:web-1`
 * - `response.time@millisecond:125.5:87.3:203.1|d|#endpoint:/api`
 */
export function formatStatsdLine(metric: StatsdMetric): string {
  const name = encodeMetricName(metric.name);
  const unit = metric.unit || 'none';

  // Format values
  const valuesStr = metric.values.map(formatValue).join(':');

  // Build the line
  let line = `${name}@${unit}:${valuesStr}|${metric.type}`;

  // Add tags if present
  if (Object.keys(metric.tags).length > 0) {
    line += formatTags(metric.tags);
  }

  // Add timestamp
  line += `|T${Math.floor(metric.timestamp)}`;

  return line;
}

/**
 * Format multiple statsd metrics into a batch string
 * Metrics are separated by newlines
 */
export function formatStatsdBatch(metrics: StatsdMetric[]): string {
  return metrics.map(formatStatsdLine).join('\n');
}

/**
 * Create a metric envelope item payload
 * Returns the statsd-formatted string for the envelope item
 */
export function createMetricEnvelopePayload(buckets: MetricBucket[]): string {
  const allMetrics: StatsdMetric[] = [];

  for (const bucket of buckets) {
    allMetrics.push(...bucket.metrics);
  }

  return formatStatsdBatch(allMetrics);
}

/**
 * Create a metric envelope item header
 */
export function createMetricEnvelopeItemHeader(): { type: 'statsd'; length?: number } {
  return {
    type: 'statsd',
  };
}

/**
 * Convert MetricData to StatsdMetric format
 */
export function metricDataToStatsd(metric: MetricData): StatsdMetric {
  const typeChar = getStatsdTypeChar(metric.type);

  return {
    name: metric.name,
    type: typeChar,
    values: [metric.value],
    unit: metric.unit,
    tags: metric.tags,
    timestamp: metric.timestamp,
  };
}

/**
 * Get the statsd type character for a metric type
 */
export function getStatsdTypeChar(type: MetricType): 'c' | 'g' | 'd' | 's' {
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
 * Batch multiple MetricData items into StatsdMetric format
 * Groups metrics by name, type, tags, and timestamp bucket
 */
export function batchMetricData(
  metrics: MetricData[],
  bucketInterval: number = 10
): StatsdMetric[] {
  // Group by name + type + tags + timestamp bucket
  const groups = new Map<string, StatsdMetric>();

  for (const metric of metrics) {
    const flooredTimestamp = Math.floor(metric.timestamp / bucketInterval) * bucketInterval;
    const tagsKey = Object.keys(metric.tags)
      .sort()
      .map((k) => `${k}=${metric.tags[k]}`)
      .join(',');
    const groupKey = `${metric.name}:${metric.type}:${tagsKey}:${flooredTimestamp}`;

    const existing = groups.get(groupKey);

    if (existing) {
      // Add value to existing group
      existing.values.push(metric.value);
    } else {
      // Create new group
      groups.set(groupKey, {
        name: metric.name,
        type: getStatsdTypeChar(metric.type),
        values: [metric.value],
        unit: metric.unit,
        tags: metric.tags,
        timestamp: flooredTimestamp,
      });
    }
  }

  return Array.from(groups.values());
}

/**
 * Create a complete metric envelope structure
 */
export interface MetricEnvelope {
  headers: {
    sent_at: string;
    dsn?: string;
  };
  items: Array<{
    header: { type: 'statsd'; length?: number };
    payload: string;
  }>;
}

/**
 * Create a metric envelope for transport
 */
export function createMetricEnvelope(
  metrics: MetricData[],
  dsn?: string
): MetricEnvelope {
  const batchedMetrics = batchMetricData(metrics);
  const payload = formatStatsdBatch(batchedMetrics);

  return {
    headers: {
      sent_at: new Date().toISOString(),
      dsn,
    },
    items: [
      {
        header: createMetricEnvelopeItemHeader(),
        payload,
      },
    ],
  };
}

/**
 * Serialize a metric envelope to string format
 */
export function serializeMetricEnvelope(envelope: MetricEnvelope): string {
  const lines: string[] = [];

  // Envelope header
  lines.push(JSON.stringify(envelope.headers));

  // Items
  for (const item of envelope.items) {
    lines.push(JSON.stringify(item.header));
    lines.push(item.payload);
  }

  return lines.join('\n');
}

/**
 * Parse a metric from statsd line format
 * Useful for testing and debugging
 */
export function parseStatsdLine(line: string): StatsdMetric | null {
  // Format: `name@unit:value[:value...]|type[|#tag1:value1,tag2:value2][|T timestamp]`
  const regex = /^([^@]+)@([^:]+):([^|]+)\|([cgds])(?:\|#([^|]+))?(?:\|T(\d+))?$/;
  const match = line.match(regex);

  if (!match) {
    return null;
  }

  const [, name, unit, valuesStr, type, tagsStr, timestampStr] = match;

  // Parse values
  const values: (number | string)[] = valuesStr.split(':').map((v) => {
    const num = parseFloat(v);
    return isNaN(num) ? v : num;
  });

  // Parse tags
  const tags: Record<string, string> = {};
  if (tagsStr) {
    for (const tag of tagsStr.split(',')) {
      const [key, value] = tag.split(':');
      if (key && value) {
        tags[key] = value
          .replace(/\\u007c/g, '|')
          .replace(/\\u002c/g, ',')
          .replace(/\\n/g, '\n')
          .replace(/\\\\/g, '\\');
      }
    }
  }

  // Parse timestamp
  const timestamp = timestampStr ? parseInt(timestampStr, 10) : Math.floor(Date.now() / 1000);

  return {
    name,
    type: type as 'c' | 'g' | 'd' | 's',
    values,
    unit,
    tags,
    timestamp,
  };
}
