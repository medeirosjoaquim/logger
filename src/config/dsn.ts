/**
 * DSN Parsing and Handling
 *
 * DSN (Data Source Name) parsing utilities for Sentry compatibility.
 * Format: https://<public_key>@<host>/<project_id>
 * Or: https://<public_key>:<secret_key>@<host>/<project_id>
 */

/**
 * Parsed DSN components.
 */
export interface Dsn {
  /**
   * Protocol (http or https).
   */
  protocol: 'http' | 'https';

  /**
   * Public key (also known as the client key).
   */
  publicKey: string;

  /**
   * Secret key (deprecated, not used in modern SDKs).
   */
  secretKey?: string;

  /**
   * Sentry host (e.g., 'o123.ingest.sentry.io' or custom domain).
   */
  host: string;

  /**
   * Port number (optional, rarely used).
   */
  port?: string;

  /**
   * Path for self-hosted Sentry (optional).
   */
  path: string;

  /**
   * Sentry project ID.
   */
  projectId: string;
}

/**
 * DSN regex pattern for parsing.
 * Captures: protocol, public_key, secret_key, host, port, path, project_id
 */
const DSN_REGEX = /^(https?):\/\/([a-zA-Z0-9]+)(?::([a-zA-Z0-9]+))?@([^/:]+)(?::(\d+))?(\/[^/]*)?\/(\d+)$/;

/**
 * Simple DSN regex without port for common cases.
 */
const DSN_SIMPLE_REGEX = /^(https?):\/\/([a-zA-Z0-9]+)(?::([a-zA-Z0-9]+))?@([^/]+)(?:\/(.+))?\/(\d+)$/;

/**
 * Parse a DSN string into its components.
 *
 * @param dsn - The DSN string to parse
 * @returns Parsed DSN or undefined if invalid
 *
 * @example
 * ```typescript
 * const dsn = parseDsn('https://abc123@o456.ingest.sentry.io/789');
 * // {
 * //   protocol: 'https',
 * //   publicKey: 'abc123',
 * //   host: 'o456.ingest.sentry.io',
 * //   path: '',
 * //   projectId: '789'
 * // }
 * ```
 */
export function parseDsn(dsn: string): Dsn | undefined {
  if (!dsn || typeof dsn !== 'string') {
    return undefined;
  }

  // Try the complex regex first (handles port)
  let match = dsn.match(DSN_REGEX);

  if (match) {
    const [, protocol, publicKey, secretKey, host, port, path, projectId] = match;

    return {
      protocol: protocol as 'http' | 'https',
      publicKey,
      secretKey: secretKey || undefined,
      host,
      port: port || undefined,
      path: path ? path.slice(1) : '', // Remove leading slash
      projectId,
    };
  }

  // Fall back to simple regex
  match = dsn.match(DSN_SIMPLE_REGEX);

  if (match) {
    const [, protocol, publicKey, secretKey, host, path, projectId] = match;

    // Check if host contains port
    const hostParts = host.split(':');
    const actualHost = hostParts[0];
    const port = hostParts[1];

    return {
      protocol: protocol as 'http' | 'https',
      publicKey,
      secretKey: secretKey || undefined,
      host: actualHost,
      port: port || undefined,
      path: path || '',
      projectId,
    };
  }

  return undefined;
}

/**
 * Convert a parsed DSN back to a string.
 *
 * @param dsn - The parsed DSN
 * @returns DSN string
 *
 * @example
 * ```typescript
 * const dsnString = dsnToString({
 *   protocol: 'https',
 *   publicKey: 'abc123',
 *   host: 'o456.ingest.sentry.io',
 *   path: '',
 *   projectId: '789'
 * });
 * // 'https://abc123@o456.ingest.sentry.io/789'
 * ```
 */
export function dsnToString(dsn: Dsn): string {
  const { protocol, publicKey, secretKey, host, port, path, projectId } = dsn;

  let result = `${protocol}://${publicKey}`;

  if (secretKey) {
    result += `:${secretKey}`;
  }

  result += `@${host}`;

  if (port) {
    result += `:${port}`;
  }

  if (path) {
    result += `/${path}`;
  }

  result += `/${projectId}`;

  return result;
}

/**
 * Get the envelope endpoint URL for a DSN.
 * This is where events are sent in envelope format.
 *
 * @param dsn - The parsed DSN
 * @param tunnel - Optional tunnel URL (overrides DSN endpoint)
 * @returns Envelope endpoint URL
 *
 * @example
 * ```typescript
 * const url = getEnvelopeEndpoint(dsn);
 * // 'https://o456.ingest.sentry.io/api/789/envelope/'
 * ```
 */
export function getEnvelopeEndpoint(dsn: Dsn, tunnel?: string): string {
  // If tunnel is provided, use it directly
  if (tunnel) {
    return tunnel;
  }

  return getBaseApiEndpoint(dsn) + '/envelope/';
}

/**
 * Get the store endpoint URL for a DSN.
 * This is the legacy endpoint for sending individual events.
 *
 * @param dsn - The parsed DSN
 * @returns Store endpoint URL
 *
 * @example
 * ```typescript
 * const url = getStoreEndpoint(dsn);
 * // 'https://o456.ingest.sentry.io/api/789/store/'
 * ```
 */
export function getStoreEndpoint(dsn: Dsn): string {
  return getBaseApiEndpoint(dsn) + '/store/';
}

/**
 * Get the base API endpoint for a DSN.
 *
 * @param dsn - The parsed DSN
 * @returns Base API URL
 */
export function getBaseApiEndpoint(dsn: Dsn): string {
  const { protocol, host, port, path, projectId } = dsn;

  let url = `${protocol}://${host}`;

  if (port) {
    url += `:${port}`;
  }

  if (path) {
    url += `/${path}`;
  }

  url += `/api/${projectId}`;

  return url;
}

/**
 * Get the minidump endpoint URL for a DSN.
 * Used for native crash reports.
 *
 * @param dsn - The parsed DSN
 * @returns Minidump endpoint URL
 */
export function getMinidumpEndpoint(dsn: Dsn): string {
  return getBaseApiEndpoint(dsn) + '/minidump/?sentry_key=' + dsn.publicKey;
}

/**
 * Get the security endpoint URL for a DSN.
 * Used for CSP and other security reports.
 *
 * @param dsn - The parsed DSN
 * @returns Security endpoint URL
 */
export function getSecurityEndpoint(dsn: Dsn): string {
  return getBaseApiEndpoint(dsn) + '/security/?sentry_key=' + dsn.publicKey;
}

/**
 * Get the report dialog URL for a DSN.
 * Used for the crash report dialog.
 *
 * @param dsn - The parsed DSN
 * @param options - Optional dialog options
 * @returns Report dialog URL
 */
export function getReportDialogUrl(
  dsn: Dsn,
  options?: {
    eventId?: string;
    user?: {
      email?: string;
      name?: string;
    };
  }
): string {
  const { protocol, host, port, path, projectId, publicKey } = dsn;

  let url = `${protocol}://${host}`;

  if (port) {
    url += `:${port}`;
  }

  if (path) {
    url += `/${path}`;
  }

  url += `/api/embed/error-page/?dsn=${encodeURIComponent(dsnToString(dsn))}`;

  if (options?.eventId) {
    url += `&eventId=${encodeURIComponent(options.eventId)}`;
  }

  if (options?.user?.email) {
    url += `&email=${encodeURIComponent(options.user.email)}`;
  }

  if (options?.user?.name) {
    url += `&name=${encodeURIComponent(options.user.name)}`;
  }

  return url;
}

/**
 * Create authentication headers for Sentry API requests.
 *
 * @param dsn - The parsed DSN
 * @param sdkName - SDK name (e.g., 'sentry.javascript.browser')
 * @param sdkVersion - SDK version
 * @returns Headers object with X-Sentry-Auth header
 */
export function getAuthHeaders(
  dsn: Dsn,
  sdkName: string = 'universal-logger',
  sdkVersion: string = '0.1.0'
): Record<string, string> {
  const timestamp = Math.floor(Date.now() / 1000);

  let authHeader = `Sentry sentry_version=7`;
  authHeader += `, sentry_client=${sdkName}/${sdkVersion}`;
  authHeader += `, sentry_timestamp=${timestamp}`;
  authHeader += `, sentry_key=${dsn.publicKey}`;

  if (dsn.secretKey) {
    authHeader += `, sentry_secret=${dsn.secretKey}`;
  }

  return {
    'X-Sentry-Auth': authHeader,
    'Content-Type': 'application/x-sentry-envelope',
  };
}

/**
 * Extract the public key from a DSN string.
 * Useful for quick validation without full parsing.
 *
 * @param dsn - The DSN string
 * @returns Public key or undefined
 */
export function extractPublicKey(dsn: string): string | undefined {
  const parsed = parseDsn(dsn);
  return parsed?.publicKey;
}

/**
 * Extract the project ID from a DSN string.
 * Useful for quick validation without full parsing.
 *
 * @param dsn - The DSN string
 * @returns Project ID or undefined
 */
export function extractProjectId(dsn: string): string | undefined {
  const parsed = parseDsn(dsn);
  return parsed?.projectId;
}

/**
 * Check if a DSN is valid.
 *
 * @param dsn - The DSN string to validate
 * @returns True if the DSN is valid
 */
export function isValidDsn(dsn: string): boolean {
  return parseDsn(dsn) !== undefined;
}

/**
 * Create a DSN from components.
 *
 * @param components - DSN components
 * @returns DSN object
 */
export function createDsn(components: {
  protocol?: 'http' | 'https';
  publicKey: string;
  secretKey?: string;
  host: string;
  port?: string;
  path?: string;
  projectId: string;
}): Dsn {
  return {
    protocol: components.protocol || 'https',
    publicKey: components.publicKey,
    secretKey: components.secretKey,
    host: components.host,
    port: components.port,
    path: components.path || '',
    projectId: components.projectId,
  };
}
