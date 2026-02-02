/**
 * DSN (Data Source Name) Parser
 *
 * Parses and validates Sentry DSN strings. A DSN is used to configure
 * the Sentry SDK to send events to the correct project.
 *
 * DSN Format: {PROTOCOL}://{PUBLIC_KEY}@{HOST}/{PROJECT_ID}
 * Example: https://abc123@sentry.io/12345
 */

import type { Dsn } from '../types';

/**
 * Regular expression for parsing DSN strings.
 * Captures: protocol, publicKey, secretKey (optional), host, port (optional), path (optional), projectId
 */
const DSN_REGEX = /^(?:(\w+):)\/\/(?:(\w+)(?::(\w+))?@)?([\w.-]+)(?::(\d+))?(\/[\w./-]*)?\/(\d+)$/;

/**
 * Error thrown when DSN parsing fails.
 */
export class DsnParseError extends Error {
  constructor(message: string) {
    super(`Invalid Sentry DSN: ${message}`);
    this.name = 'DsnParseError';
  }
}

/**
 * Parses a Sentry DSN string into its components.
 *
 * @param dsn - The DSN string to parse
 * @returns Parsed DSN object
 * @throws DsnParseError if the DSN is invalid
 *
 * @example
 * ```typescript
 * const dsn = parseDsn('https://abc123@o12345.ingest.sentry.io/67890');
 * // {
 * //   protocol: 'https',
 * //   publicKey: 'abc123',
 * //   host: 'o12345.ingest.sentry.io',
 * //   projectId: '67890'
 * // }
 * ```
 */
export function parseDsn(dsn: string): Dsn {
  if (!dsn || typeof dsn !== 'string') {
    throw new DsnParseError('DSN must be a non-empty string');
  }

  const match = dsn.match(DSN_REGEX);

  if (!match) {
    throw new DsnParseError(
      `Invalid DSN format. Expected: {PROTOCOL}://{PUBLIC_KEY}@{HOST}/{PROJECT_ID}`
    );
  }

  const [, protocol, publicKey, secretKey, host, port, path, projectId] = match;

  // Validate protocol
  if (!protocol || (protocol !== 'http' && protocol !== 'https')) {
    throw new DsnParseError('Protocol must be "http" or "https"');
  }

  // Validate public key
  if (!publicKey) {
    throw new DsnParseError('Public key is required');
  }

  // Validate host
  if (!host) {
    throw new DsnParseError('Host is required');
  }

  // Validate project ID
  if (!projectId) {
    throw new DsnParseError('Project ID is required');
  }

  const result: Dsn = {
    protocol,
    publicKey,
    host,
    projectId,
  };

  // Add optional fields if present
  if (secretKey) {
    result.secretKey = secretKey;
  }

  if (port) {
    result.port = port;
  }

  if (path && path !== '/') {
    // Remove leading and trailing slashes for consistency
    result.path = path.replace(/^\/+|\/+$/g, '');
  }

  return result;
}

/**
 * Converts a parsed DSN object back to a string.
 *
 * @param dsn - The parsed DSN object
 * @param includeSecretKey - Whether to include the secret key (deprecated)
 * @returns DSN string
 *
 * @example
 * ```typescript
 * const str = dsnToString({
 *   protocol: 'https',
 *   publicKey: 'abc123',
 *   host: 'sentry.io',
 *   projectId: '67890'
 * });
 * // "https://abc123@sentry.io/67890"
 * ```
 */
export function dsnToString(dsn: Dsn, includeSecretKey: boolean = false): string {
  const { protocol, publicKey, secretKey, host, port, path, projectId } = dsn;

  let auth = publicKey;
  if (includeSecretKey && secretKey) {
    auth += `:${secretKey}`;
  }

  let url = `${protocol}://${auth}@${host}`;

  if (port) {
    url += `:${port}`;
  }

  if (path) {
    url += `/${path}`;
  }

  url += `/${projectId}`;

  return url;
}

/**
 * Gets the base API URL from a DSN.
 *
 * @param dsn - The parsed DSN object
 * @returns Base API URL
 *
 * @example
 * ```typescript
 * const baseUrl = getBaseApiUrl(parseDsn('https://abc@sentry.io/123'));
 * // "https://sentry.io"
 * ```
 */
export function getBaseApiUrl(dsn: Dsn): string {
  const { protocol, host, port, path } = dsn;

  let url = `${protocol}://${host}`;

  if (port) {
    url += `:${port}`;
  }

  if (path) {
    url += `/${path}`;
  }

  return url;
}

/**
 * Gets the store endpoint URL for sending events.
 *
 * @param dsn - The parsed DSN object
 * @returns Store endpoint URL
 *
 * @example
 * ```typescript
 * const url = getStoreEndpoint(parseDsn('https://abc@sentry.io/123'));
 * // "https://sentry.io/api/123/store/"
 * ```
 */
export function getStoreEndpoint(dsn: Dsn): string {
  return `${getBaseApiUrl(dsn)}/api/${dsn.projectId}/store/`;
}

/**
 * Gets the envelope endpoint URL for sending envelopes.
 * This is the modern way to send data to Sentry.
 *
 * @param dsn - The parsed DSN object
 * @returns Envelope endpoint URL
 *
 * @example
 * ```typescript
 * const url = getEnvelopeEndpoint(parseDsn('https://abc@sentry.io/123'));
 * // "https://sentry.io/api/123/envelope/"
 * ```
 */
export function getEnvelopeEndpoint(dsn: Dsn): string {
  return `${getBaseApiUrl(dsn)}/api/${dsn.projectId}/envelope/`;
}

/**
 * Gets the report endpoint URL for user feedback.
 *
 * @param dsn - The parsed DSN object
 * @param eventId - The event ID to attach feedback to
 * @returns Report endpoint URL
 */
export function getReportEndpoint(dsn: Dsn, eventId: string): string {
  return `${getBaseApiUrl(dsn)}/api/embed/error-page/?dsn=${encodeURIComponent(dsnToString(dsn))}&eventId=${encodeURIComponent(eventId)}`;
}

/**
 * Creates the Sentry authentication header value.
 *
 * @param dsn - The parsed DSN object
 * @param sdkName - SDK name for the header
 * @param sdkVersion - SDK version for the header
 * @returns Authentication header value
 *
 * @example
 * ```typescript
 * const auth = getSentryAuthHeader(dsn, 'sentry.javascript.browser', '7.0.0');
 * // "Sentry sentry_version=7, sentry_client=sentry.javascript.browser/7.0.0, sentry_key=abc123"
 * ```
 */
export function getSentryAuthHeader(
  dsn: Dsn,
  sdkName: string,
  sdkVersion: string
): string {
  const parts = [
    `sentry_version=7`,
    `sentry_client=${sdkName}/${sdkVersion}`,
    `sentry_key=${dsn.publicKey}`,
  ];

  // Secret key is deprecated but included for backwards compatibility
  if (dsn.secretKey) {
    parts.push(`sentry_secret=${dsn.secretKey}`);
  }

  return `Sentry ${parts.join(', ')}`;
}

/**
 * Validates that a DSN string is properly formatted.
 *
 * @param dsn - The DSN string to validate
 * @returns True if the DSN is valid
 */
export function isValidDsn(dsn: string): boolean {
  try {
    parseDsn(dsn);
    return true;
  } catch {
    return false;
  }
}

/**
 * Gets the project ID from a DSN string.
 *
 * @param dsn - The DSN string
 * @returns Project ID or undefined if invalid
 */
export function getProjectIdFromDsn(dsn: string): string | undefined {
  try {
    return parseDsn(dsn).projectId;
  } catch {
    return undefined;
  }
}

/**
 * Gets the public key from a DSN string.
 *
 * @param dsn - The DSN string
 * @returns Public key or undefined if invalid
 */
export function getPublicKeyFromDsn(dsn: string): string | undefined {
  try {
    return parseDsn(dsn).publicKey;
  } catch {
    return undefined;
  }
}
