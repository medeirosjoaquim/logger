/**
 * ID generation utilities for tracing
 * Generates UUIDs for trace and span IDs
 */

/**
 * Generate a random 16-character hex string (8 bytes) for span IDs
 */
export function generateSpanId(): string {
  return generateRandomHex(16);
}

/**
 * Generate a random 32-character hex string (16 bytes) for trace IDs
 */
export function generateTraceId(): string {
  return generateRandomHex(32);
}

/**
 * Generate a random hex string of specified length
 */
function generateRandomHex(length: number): string {
  // Try crypto.randomUUID first (available in modern browsers and Node.js)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const bytes = new Uint8Array(length / 2);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Fallback to Math.random (less secure but works everywhere)
  let result = '';
  const hexChars = '0123456789abcdef';
  for (let i = 0; i < length; i++) {
    result += hexChars[Math.floor(Math.random() * 16)];
  }
  return result;
}

/**
 * Generate a UUID v4 (used for event IDs)
 */
export function generateEventId(): string {
  // Try crypto.randomUUID first
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '');
  }

  // Fallback implementation
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  // Set version to 4 and variant to RFC4122
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate a trace ID format
 */
export function isValidTraceId(traceId: string): boolean {
  return /^[0-9a-f]{32}$/i.test(traceId);
}

/**
 * Validate a span ID format
 */
export function isValidSpanId(spanId: string): boolean {
  return /^[0-9a-f]{16}$/i.test(spanId);
}
