/**
 * Span utility functions
 * Helper functions for working with spans
 */

import { Span } from './span';
import { Transaction } from './transaction';
import type { SpanJSON, SpanStatus, SpanStatusCode } from './types';

// ============================================
// Active span management (module-level state)
// ============================================

let _activeSpan: Span | undefined;

/**
 * Get the currently active span
 */
export function getActiveSpan(): Span | undefined {
  return _activeSpan;
}

/**
 * Set the currently active span
 */
export function setActiveSpan(span: Span | undefined): void {
  _activeSpan = span;
}

// ============================================
// Serialization utilities
// ============================================

/**
 * Convert a span to JSON format
 */
export function spanToJSON(span: Span): SpanJSON {
  return span.toJSON();
}

// ============================================
// Span name utilities
// ============================================

/**
 * Update the name of a span
 */
export function updateSpanName(span: Span, name: string): void {
  span.updateName(name);
}

// ============================================
// HTTP status utilities
// ============================================

/**
 * Map HTTP status codes to span status
 */
export function getSpanStatusFromHttpCode(httpStatus: number): SpanStatus {
  if (httpStatus >= 200 && httpStatus < 400) {
    return { code: 'ok' };
  }

  let statusCode: SpanStatusCode = 'error';
  let message: string | undefined;

  if (httpStatus === 400) {
    message = 'invalid_argument';
  } else if (httpStatus === 401) {
    message = 'unauthenticated';
  } else if (httpStatus === 403) {
    message = 'permission_denied';
  } else if (httpStatus === 404) {
    message = 'not_found';
  } else if (httpStatus === 409) {
    message = 'already_exists';
  } else if (httpStatus === 429) {
    message = 'resource_exhausted';
  } else if (httpStatus === 499) {
    message = 'cancelled';
  } else if (httpStatus === 500) {
    message = 'internal_error';
  } else if (httpStatus === 501) {
    message = 'unimplemented';
  } else if (httpStatus === 503) {
    message = 'unavailable';
  } else if (httpStatus === 504) {
    message = 'deadline_exceeded';
  } else if (httpStatus >= 400 && httpStatus < 500) {
    message = 'invalid_argument';
  } else if (httpStatus >= 500) {
    message = 'internal_error';
  } else {
    statusCode = 'unset';
    message = undefined;
  }

  return { code: statusCode, message };
}

/**
 * Set HTTP status on a span
 */
export function setHttpStatus(span: Span, httpStatus: number): void {
  span.setAttribute('http.response.status_code', httpStatus);
  span.setStatus(getSpanStatusFromHttpCode(httpStatus));
}

// ============================================
// Root span utilities
// ============================================

/**
 * Get the root span from any span in the tree
 */
export function getRootSpan(span: Span): Span {
  let current = span;
  let parent = current.getParent();

  while (parent) {
    current = parent;
    parent = current.getParent();
  }

  return current;
}

/**
 * Get the transaction from a span
 */
export function getTransaction(span: Span): Transaction | undefined {
  const root = getRootSpan(span);
  if (root instanceof Transaction) {
    return root;
  }
  return undefined;
}

// ============================================
// Scoped activation utilities
// ============================================

/**
 * Run a callback with a span as the active span
 */
export function withActiveSpan<T>(span: Span, callback: (span: Span) => T): T {
  const previousSpan = _activeSpan;
  _activeSpan = span;

  try {
    return callback(span);
  } finally {
    _activeSpan = previousSpan;
  }
}

// ============================================
// Span relationship utilities
// ============================================

/**
 * Check if a span is a descendant of another span
 */
export function isDescendantOf(span: Span, potentialAncestor: Span): boolean {
  let current = span.getParent();

  while (current) {
    if (current === potentialAncestor) {
      return true;
    }
    current = current.getParent();
  }

  return false;
}

/**
 * Get all spans in a trace tree (depth-first)
 */
export function getAllSpans(rootSpan: Span): Span[] {
  const spans: Span[] = [rootSpan];

  for (const child of rootSpan.children) {
    spans.push(...getAllSpans(child));
  }

  return spans;
}

// ============================================
// Timing utilities
// ============================================

/**
 * Get the current timestamp in seconds with millisecond precision
 */
export function timestampInSeconds(): number {
  return Date.now() / 1000;
}

/**
 * Convert a high-resolution timestamp (DOMHighResTimeStamp) to seconds
 */
export function hrTimeToSeconds(hrTime: number): number {
  return hrTime / 1000;
}

/**
 * Get span duration in milliseconds
 */
export function getSpanDurationMs(span: Span): number | undefined {
  const duration = span.getDuration();
  if (duration === undefined) {
    return undefined;
  }
  return duration * 1000;
}

// ============================================
// Span status utilities
// ============================================

/**
 * Check if a span status indicates an error
 */
export function isErrorStatus(status: SpanStatus): boolean {
  return status.code === 'error';
}

/**
 * Check if a span status indicates success
 */
export function isOkStatus(status: SpanStatus): boolean {
  return status.code === 'ok';
}

/**
 * Create an error status with a message
 */
export function createErrorStatus(message?: string): SpanStatus {
  return { code: 'error', message };
}

/**
 * Create an OK status
 */
export function createOkStatus(): SpanStatus {
  return { code: 'ok' };
}

// ============================================
// Span attribute utilities
// ============================================

/**
 * Set standard HTTP client span attributes
 */
export function setHttpClientAttributes(
  span: Span,
  options: {
    url: string;
    method: string;
    statusCode?: number;
  }
): void {
  span.setAttribute('http.request.method', options.method);
  span.setAttribute('url.full', options.url);

  if (options.statusCode !== undefined) {
    span.setAttribute('http.response.status_code', options.statusCode);
  }
}

/**
 * Set standard database span attributes
 */
export function setDatabaseAttributes(
  span: Span,
  options: {
    system: string;
    name?: string;
    operation?: string;
    statement?: string;
  }
): void {
  span.setAttribute('db.system', options.system);

  if (options.name) {
    span.setAttribute('db.name', options.name);
  }

  if (options.operation) {
    span.setAttribute('db.operation', options.operation);
  }

  if (options.statement) {
    span.setAttribute('db.statement', options.statement);
  }
}
