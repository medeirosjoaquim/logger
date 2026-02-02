/**
 * Transport Layer
 *
 * Exports all transport-related functionality for sending events
 * to Sentry-compatible backends.
 */

// Types
export type {
  Transport,
  TransportRequest,
  TransportMakeRequestResponse,
  TransportOptions,
  TransportFactory,
  TransportState,
  TransportCategory,
  EventDropReason,
  FetchTransportOptions,
  XHRTransportOptions,
  QueuedEvent,
  EventQueueOptions,
  RateLimitState,
} from './types.js';

// Envelope
export type {
  Envelope,
  EnvelopeHeaders,
  EnvelopeItem,
  EnvelopeItemHeader,
  EnvelopeItemType,
  Dsn,
  Session,
  SessionStatus,
  ClientReport,
  CreateEventEnvelopeOptions,
} from './envelope.js';

export {
  parseDsn,
  getEnvelopeEndpoint,
  createEventEnvelope,
  createEventEnvelopeWithAttachments,
  createSessionEnvelope,
  createClientReportEnvelope,
  addAttachmentToEnvelope,
  addAttachmentToEnvelopeAsync,
  addAttachmentsToEnvelope,
  serializeEnvelope,
  serializeEnvelopeToBytes,
  parseEnvelope,
  getEnvelopeSize,
} from './envelope.js';

// Attachments
export type {
  AttachmentType,
  AttachmentValidationResult,
  EncodedAttachment,
} from './attachments.js';

export {
  MAX_ATTACHMENT_SIZE,
  MAX_TOTAL_ATTACHMENTS_SIZE,
  DEFAULT_ATTACHMENT_TYPE,
  getAttachmentSize,
  validateAttachment,
  validateAttachmentsSize,
  encodeAttachment,
  encodeAttachmentAsync,
  createAttachmentEnvelopeItem,
  createAttachmentEnvelopeItemAsync,
  createAttachmentEnvelopeItems,
  createAttachmentEnvelopeItemsAsync,
  inferContentType,
  filterAttachments,
  dropAttachmentsByFilename,
  dropAttachmentsBySize,
  keepAttachmentsByContentType,
  createTextAttachment,
  createJsonAttachment,
  createBinaryAttachment,
} from './attachments.js';

// Rate Limiting
export {
  RateLimiter,
  createRateLimiter,
  getEventCategory,
} from './ratelimit.js';

// Fetch Transport
export {
  makeFetchTransport,
  makeFetchTransportWithKeepalive,
  makeBeaconTransport,
} from './fetch.js';

// XHR Transport
export {
  makeXHRTransport,
  isXHRAvailable,
  sendXHRSync,
} from './xhr.js';

// Offline Queue
export type { OfflineQueueOptions } from './offline.js';
export {
  OfflineQueue,
  createOfflineTransport,
} from './offline.js';

// Event Queue
export {
  EventQueue,
  EventPriority,
  createEventQueue,
} from './queue.js';

// Factory functions

import type { Transport, TransportOptions, FetchTransportOptions } from './types.js';
import type { Dsn } from './envelope.js';
import { getEnvelopeEndpoint } from './envelope.js';
import { makeFetchTransport, makeBeaconTransport } from './fetch.js';
import { makeXHRTransport, isXHRAvailable } from './xhr.js';
import { OfflineQueue, createOfflineTransport } from './offline.js';

/**
 * Options for creating a transport
 */
export interface CreateTransportOptions extends TransportOptions {
  /**
   * Use XHR instead of fetch
   */
  useXHR?: boolean;

  /**
   * Enable offline queue
   */
  enableOffline?: boolean;

  /**
   * Custom headers
   */
  headers?: Record<string, string>;

  /**
   * Use beacon for page unload
   */
  useBeacon?: boolean;
}

/**
 * Create a transport for the given DSN
 *
 * Automatically selects the best transport based on environment:
 * - Fetch API if available
 * - XHR as fallback
 * - Optionally wraps with offline queue
 */
export function createTransport(dsn: Dsn, options: CreateTransportOptions = {}): Transport {
  const url = getEnvelopeEndpoint(dsn);
  const { useXHR, enableOffline, headers, useBeacon, ...transportOptions } = options;

  let transport: Transport;

  // Create base transport
  if (useBeacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
    transport = makeBeaconTransport({ url, headers, ...transportOptions });
  } else if (useXHR || (typeof fetch === 'undefined' && isXHRAvailable())) {
    transport = makeXHRTransport({ url, headers, ...transportOptions });
  } else if (typeof fetch !== 'undefined') {
    transport = makeFetchTransport({ url, headers, ...transportOptions });
  } else if (isXHRAvailable()) {
    transport = makeXHRTransport({ url, headers, ...transportOptions });
  } else {
    // No transport available - create a no-op transport
    transport = createNoopTransport();
  }

  // Wrap with offline queue if enabled
  if (enableOffline) {
    const queue = new OfflineQueue(null);
    queue.init();
    transport = createOfflineTransport(transport, queue);
  }

  return transport;
}

/**
 * Create a no-op transport for environments without network capability
 */
export function createNoopTransport(): Transport {
  return {
    async send() {
      return { statusCode: 0, reason: 'No transport available' };
    },
    async flush() {
      return true;
    },
    async close() {
      return true;
    },
  };
}

/**
 * Create a multiplexing transport that sends to multiple destinations
 */
export function createMultiplexTransport(transports: Transport[]): Transport {
  return {
    async send(request) {
      const results = await Promise.all(
        transports.map((t) => t.send(request).catch(() => ({ statusCode: 0, reason: 'Error' })))
      );

      // Return first successful response, or first response if all failed
      const success = results.find(
        (r) => r.statusCode !== undefined && r.statusCode >= 200 && r.statusCode < 300
      );
      return success || results[0] || { statusCode: 0, reason: 'No transports' };
    },

    async flush(timeout) {
      const results = await Promise.all(transports.map((t) => t.flush(timeout)));
      return results.every((r) => r);
    },

    async close(timeout) {
      const results = await Promise.all(transports.map((t) => t.close(timeout)));
      return results.every((r) => r);
    },
  };
}

/**
 * Check if the transport should be available in the current environment
 */
export function isTransportAvailable(): boolean {
  return typeof fetch !== 'undefined' || isXHRAvailable();
}
