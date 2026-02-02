/**
 * Log Envelope Formatting
 *
 * Formats structured logs for Sentry log envelope transport.
 * Supports batching multiple log records into a single envelope.
 */

import type {
  LogRecord,
  LogEnvelopeItem,
  LogEnvelopeItemHeader,
  LogBatch,
  LogAttributes,
} from './types';
import { SeverityNumbers } from './types';

/**
 * Envelope headers for log envelopes
 */
export interface LogEnvelopeHeaders {
  /**
   * Timestamp when the envelope was created
   */
  sent_at?: string;

  /**
   * SDK information
   */
  sdk?: {
    name?: string;
    version?: string;
  };

  /**
   * DSN to use for routing
   */
  dsn?: string;

  /**
   * Trace context for distributed tracing
   */
  trace?: {
    trace_id?: string;
    public_key?: string;
    release?: string;
    environment?: string;
  };
}

/**
 * Complete log envelope structure
 */
export interface LogEnvelope {
  /**
   * Envelope headers
   */
  headers: LogEnvelopeHeaders;

  /**
   * Items in the envelope
   */
  items: Array<{
    header: LogEnvelopeItemHeader;
    payload: LogBatch;
  }>;
}

/**
 * Options for creating log envelopes
 */
export interface LogEnvelopeOptions {
  /**
   * SDK name
   */
  sdkName?: string;

  /**
   * SDK version
   */
  sdkVersion?: string;

  /**
   * DSN string
   */
  dsn?: string;

  /**
   * Public key from DSN
   */
  publicKey?: string;

  /**
   * Release version
   */
  release?: string;

  /**
   * Environment name
   */
  environment?: string;
}

/**
 * Convert a LogRecord to a LogEnvelopeItem
 */
export function logRecordToEnvelopeItem(record: LogRecord): LogEnvelopeItem {
  const item: LogEnvelopeItem = {
    timestamp: record.timestamp,
    level: record.level,
    body: record.message,
    severity_number: record.severityNumber ?? SeverityNumbers[record.level],
    severity_text: record.severityText ?? record.level.toUpperCase(),
  };

  // Add trace context if available
  if (record.traceId) {
    item.trace_id = record.traceId;
  }
  if (record.spanId) {
    item.span_id = record.spanId;
  }

  // Convert attributes to envelope format
  if (record.attributes && Object.keys(record.attributes).length > 0) {
    item.attributes = convertAttributesToEnvelopeFormat(record.attributes);
  }

  return item;
}

/**
 * Convert LogAttributes to envelope attribute format
 *
 * Sentry expects attributes in a specific format with type information
 */
export function convertAttributesToEnvelopeFormat(
  attributes: LogAttributes
): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(attributes)) {
    if (value === undefined || value === null) {
      continue;
    }

    // Sentry expects attributes in a specific format
    // Each attribute should have a type and value
    if (typeof value === 'string') {
      result[key] = {
        type: 'string',
        value: value,
      };
    } else if (typeof value === 'number') {
      if (Number.isInteger(value)) {
        result[key] = {
          type: 'integer',
          value: value,
        };
      } else {
        result[key] = {
          type: 'double',
          value: value,
        };
      }
    } else if (typeof value === 'boolean') {
      result[key] = {
        type: 'boolean',
        value: value,
      };
    }
  }

  return result;
}

/**
 * Create a log batch from multiple log records
 */
export function createLogBatch(records: LogRecord[]): LogBatch {
  return {
    items: records.map(logRecordToEnvelopeItem),
  };
}

/**
 * Create a log envelope from log records
 */
export function createLogEnvelope(
  records: LogRecord[],
  options: LogEnvelopeOptions = {}
): LogEnvelope {
  const headers: LogEnvelopeHeaders = {
    sent_at: new Date().toISOString(),
  };

  // Add SDK info if available
  if (options.sdkName || options.sdkVersion) {
    headers.sdk = {
      name: options.sdkName,
      version: options.sdkVersion,
    };
  }

  // Add DSN if available
  if (options.dsn) {
    headers.dsn = options.dsn;
  }

  // Add trace context if any records have trace info
  const firstRecordWithTrace = records.find((r) => r.traceId);
  if (firstRecordWithTrace || options.release || options.environment) {
    headers.trace = {
      trace_id: firstRecordWithTrace?.traceId,
      public_key: options.publicKey,
      release: options.release,
      environment: options.environment,
    };
  }

  const batch = createLogBatch(records);

  return {
    headers,
    items: [
      {
        header: {
          type: 'log',
          content_type: 'application/json',
        },
        payload: batch,
      },
    ],
  };
}

/**
 * Serialize a log envelope to a string for transport
 * Uses newline-delimited JSON format (same as other Sentry envelopes)
 */
export function serializeLogEnvelope(envelope: LogEnvelope): string {
  const lines: string[] = [];

  // Envelope header
  lines.push(JSON.stringify(envelope.headers));

  // Each item (header + payload pair)
  for (const item of envelope.items) {
    lines.push(JSON.stringify(item.header));
    lines.push(JSON.stringify(item.payload));
  }

  return lines.join('\n');
}

/**
 * Serialize a log envelope to bytes for transport
 */
export function serializeLogEnvelopeToBytes(
  envelope: LogEnvelope,
  encoder: TextEncoder = new TextEncoder()
): Uint8Array {
  const serialized = serializeLogEnvelope(envelope);
  return encoder.encode(serialized);
}

/**
 * Parse a serialized log envelope
 */
export function parseLogEnvelope(data: string): LogEnvelope {
  const lines = data.split('\n').filter((line) => line.trim() !== '');

  if (lines.length < 1) {
    throw new Error('Invalid log envelope: empty data');
  }

  const headers: LogEnvelopeHeaders = JSON.parse(lines[0]);
  const items: Array<{
    header: LogEnvelopeItemHeader;
    payload: LogBatch;
  }> = [];

  // Parse items (pairs of header + payload)
  let i = 1;
  while (i < lines.length) {
    const header: LogEnvelopeItemHeader = JSON.parse(lines[i]);
    i++;

    let payload: LogBatch = { items: [] };
    if (i < lines.length) {
      payload = JSON.parse(lines[i]);
      i++;
    }

    items.push({ header, payload });
  }

  return { headers, items };
}

/**
 * Get the estimated size of a log envelope in bytes
 */
export function getLogEnvelopeSize(envelope: LogEnvelope): number {
  const serialized = serializeLogEnvelope(envelope);
  return new TextEncoder().encode(serialized).length;
}

/**
 * Split a large batch of log records into smaller envelopes
 *
 * @param records - Log records to split
 * @param maxBatchSize - Maximum number of records per envelope
 * @param options - Envelope options
 */
export function splitIntoEnvelopes(
  records: LogRecord[],
  maxBatchSize: number = 100,
  options: LogEnvelopeOptions = {}
): LogEnvelope[] {
  const envelopes: LogEnvelope[] = [];

  for (let i = 0; i < records.length; i += maxBatchSize) {
    const batch = records.slice(i, i + maxBatchSize);
    envelopes.push(createLogEnvelope(batch, options));
  }

  return envelopes;
}

/**
 * Merge multiple log envelopes into one
 * Note: This only works if all envelopes have the same headers
 */
export function mergeLogEnvelopes(
  envelopes: LogEnvelope[],
  options: LogEnvelopeOptions = {}
): LogEnvelope {
  const allRecords: LogEnvelopeItem[] = [];

  for (const envelope of envelopes) {
    for (const item of envelope.items) {
      allRecords.push(...item.payload.items);
    }
  }

  const headers: LogEnvelopeHeaders = {
    sent_at: new Date().toISOString(),
    ...envelopes[0]?.headers,
  };

  // Update SDK info if provided
  if (options.sdkName || options.sdkVersion) {
    headers.sdk = {
      name: options.sdkName ?? headers.sdk?.name,
      version: options.sdkVersion ?? headers.sdk?.version,
    };
  }

  return {
    headers,
    items: [
      {
        header: {
          type: 'log',
          content_type: 'application/json',
        },
        payload: {
          items: allRecords,
        },
      },
    ],
  };
}
