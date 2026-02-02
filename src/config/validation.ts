/**
 * Configuration Validation
 *
 * Validates configuration options and provides helpful error messages.
 */

import type { InitOptions } from './options';

/**
 * Validation error for configuration issues.
 */
export class ConfigurationError extends Error {
  constructor(message: string) {
    super(`[Universal Logger] Configuration error: ${message}`);
    this.name = 'ConfigurationError';
  }
}

/**
 * Validation warning for non-critical issues.
 */
export interface ValidationWarning {
  option: string;
  message: string;
  suggestion?: string;
}

/**
 * Result of validation.
 */
export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: ValidationWarning[];
}

/**
 * DSN regex pattern for validation.
 * Format: https://<public_key>@<host>/<project_id>
 * Or: https://<public_key>:<secret_key>@<host>/<project_id>
 */
const DSN_REGEX = /^(https?):\/\/([a-zA-Z0-9]+)(?::([a-zA-Z0-9]+))?@([^/]+)(?:\/(.+))?\/(\d+)$/;

/**
 * Validate a DSN string.
 *
 * @param dsn - The DSN to validate
 * @returns True if the DSN is valid
 */
export function validateDsn(dsn: string): boolean {
  if (!dsn || typeof dsn !== 'string') {
    return false;
  }

  return DSN_REGEX.test(dsn);
}

/**
 * Parse and validate a DSN string.
 *
 * @param dsn - The DSN to parse
 * @returns Parsed DSN components or null if invalid
 */
export function parseDsnForValidation(dsn: string): {
  protocol: string;
  publicKey: string;
  secretKey?: string;
  host: string;
  path?: string;
  projectId: string;
} | null {
  if (!dsn || typeof dsn !== 'string') {
    return null;
  }

  const match = dsn.match(DSN_REGEX);
  if (!match) {
    return null;
  }

  const [, protocol, publicKey, secretKey, host, path, projectId] = match;

  return {
    protocol,
    publicKey,
    secretKey: secretKey || undefined,
    host,
    path: path || undefined,
    projectId,
  };
}

/**
 * Validate a sample rate value.
 *
 * @param rate - The sample rate to validate
 * @param name - The name of the option for error messages
 * @throws ConfigurationError if the rate is invalid
 */
export function validateSampleRate(rate: number | undefined, name: string): void {
  if (rate === undefined) {
    return;
  }

  if (typeof rate !== 'number') {
    throw new ConfigurationError(
      `${name} must be a number, got ${typeof rate}`
    );
  }

  if (isNaN(rate)) {
    throw new ConfigurationError(
      `${name} must be a valid number, got NaN`
    );
  }

  if (rate < 0 || rate > 1) {
    throw new ConfigurationError(
      `${name} must be between 0 and 1, got ${rate}`
    );
  }
}

/**
 * Validate all configuration options.
 *
 * @param options - The options to validate
 * @throws ConfigurationError if validation fails
 */
export function validateOptions(options: InitOptions): void {
  // Validate DSN if provided
  if (options.dsn !== undefined) {
    if (typeof options.dsn !== 'string') {
      throw new ConfigurationError(
        `dsn must be a string, got ${typeof options.dsn}`
      );
    }

    if (options.dsn && !validateDsn(options.dsn)) {
      throw new ConfigurationError(
        `Invalid DSN format: ${options.dsn}. Expected format: https://<public_key>@<host>/<project_id>`
      );
    }
  }

  // Validate sample rates
  validateSampleRate(options.sampleRate, 'sampleRate');
  validateSampleRate(options.tracesSampleRate, 'tracesSampleRate');
  validateSampleRate(options.replaysSessionSampleRate, 'replaysSessionSampleRate');
  validateSampleRate(options.replaysOnErrorSampleRate, 'replaysOnErrorSampleRate');
  validateSampleRate(options.profilesSampleRate, 'profilesSampleRate');

  // Validate numeric limits
  if (options.maxBreadcrumbs !== undefined) {
    if (typeof options.maxBreadcrumbs !== 'number' || options.maxBreadcrumbs < 0) {
      throw new ConfigurationError(
        `maxBreadcrumbs must be a non-negative number, got ${options.maxBreadcrumbs}`
      );
    }
  }

  if (options.maxValueLength !== undefined) {
    if (typeof options.maxValueLength !== 'number' || options.maxValueLength < 0) {
      throw new ConfigurationError(
        `maxValueLength must be a non-negative number, got ${options.maxValueLength}`
      );
    }
  }

  if (options.normalizeDepth !== undefined) {
    if (typeof options.normalizeDepth !== 'number' || options.normalizeDepth < 0) {
      throw new ConfigurationError(
        `normalizeDepth must be a non-negative number, got ${options.normalizeDepth}`
      );
    }
  }

  if (options.normalizeMaxBreadth !== undefined) {
    if (typeof options.normalizeMaxBreadth !== 'number' || options.normalizeMaxBreadth < 0) {
      throw new ConfigurationError(
        `normalizeMaxBreadth must be a non-negative number, got ${options.normalizeMaxBreadth}`
      );
    }
  }

  // Validate mode
  if (options.mode !== undefined) {
    const validModes = ['standalone', 'sentry-proxy', 'sentry-dual'];
    if (!validModes.includes(options.mode)) {
      throw new ConfigurationError(
        `mode must be one of: ${validModes.join(', ')}. Got: ${options.mode}`
      );
    }
  }

  // Validate integrations
  if (options.integrations !== undefined) {
    if (!Array.isArray(options.integrations) && typeof options.integrations !== 'function') {
      throw new ConfigurationError(
        `integrations must be an array or function, got ${typeof options.integrations}`
      );
    }
  }

  // Validate filter patterns
  validatePatternArray(options.ignoreErrors, 'ignoreErrors');
  validatePatternArray(options.ignoreTransactions, 'ignoreTransactions');
  validatePatternArray(options.denyUrls, 'denyUrls');
  validatePatternArray(options.allowUrls, 'allowUrls');
  validatePatternArray(options.tracePropagationTargets, 'tracePropagationTargets');

  // Validate callbacks
  if (options.beforeSend !== undefined && typeof options.beforeSend !== 'function') {
    throw new ConfigurationError(
      `beforeSend must be a function, got ${typeof options.beforeSend}`
    );
  }

  if (options.beforeSendTransaction !== undefined && typeof options.beforeSendTransaction !== 'function') {
    throw new ConfigurationError(
      `beforeSendTransaction must be a function, got ${typeof options.beforeSendTransaction}`
    );
  }

  if (options.beforeSendSpan !== undefined && typeof options.beforeSendSpan !== 'function') {
    throw new ConfigurationError(
      `beforeSendSpan must be a function, got ${typeof options.beforeSendSpan}`
    );
  }

  if (options.beforeBreadcrumb !== undefined && typeof options.beforeBreadcrumb !== 'function') {
    throw new ConfigurationError(
      `beforeBreadcrumb must be a function, got ${typeof options.beforeBreadcrumb}`
    );
  }

  if (options.tracesSampler !== undefined && typeof options.tracesSampler !== 'function') {
    throw new ConfigurationError(
      `tracesSampler must be a function, got ${typeof options.tracesSampler}`
    );
  }

  if (options.transport !== undefined && typeof options.transport !== 'function') {
    throw new ConfigurationError(
      `transport must be a function, got ${typeof options.transport}`
    );
  }
}

/**
 * Validate an array of string/RegExp patterns.
 *
 * @param patterns - The patterns to validate
 * @param name - The name of the option for error messages
 * @throws ConfigurationError if validation fails
 */
function validatePatternArray(
  patterns: Array<string | RegExp> | undefined,
  name: string
): void {
  if (patterns === undefined) {
    return;
  }

  if (!Array.isArray(patterns)) {
    throw new ConfigurationError(
      `${name} must be an array, got ${typeof patterns}`
    );
  }

  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    if (typeof pattern !== 'string' && !(pattern instanceof RegExp)) {
      throw new ConfigurationError(
        `${name}[${i}] must be a string or RegExp, got ${typeof pattern}`
      );
    }
  }
}

/**
 * Warn about potentially problematic options.
 * Does not throw, just logs warnings.
 *
 * @param options - The options to check
 * @returns Array of warnings
 */
export function warnInvalidOptions(options: InitOptions): ValidationWarning[] {
  const warnings: ValidationWarning[] = [];

  // Warn about missing DSN
  if (!options.dsn && options.mode !== 'standalone') {
    warnings.push({
      option: 'dsn',
      message: 'No DSN provided. Events will only be stored locally.',
      suggestion: 'Provide a DSN to send events to Sentry.',
    });
  }

  // Warn about low sample rates
  if (options.sampleRate !== undefined && options.sampleRate < 0.1 && options.sampleRate > 0) {
    warnings.push({
      option: 'sampleRate',
      message: `Sample rate is very low (${options.sampleRate}). Most events will be dropped.`,
      suggestion: 'Consider increasing the sample rate or use tracesSampleRate for transactions.',
    });
  }

  // Warn about development settings in production
  if (options.environment === 'production') {
    if (options.debug) {
      warnings.push({
        option: 'debug',
        message: 'Debug mode is enabled in production.',
        suggestion: 'Disable debug mode in production for better performance.',
      });
    }

    if (options.tracesSampleRate === 1.0) {
      warnings.push({
        option: 'tracesSampleRate',
        message: 'Capturing 100% of traces in production may impact performance.',
        suggestion: 'Consider lowering tracesSampleRate in production.',
      });
    }
  }

  // Warn about secret key in DSN
  if (options.dsn) {
    const parsed = parseDsnForValidation(options.dsn);
    if (parsed?.secretKey) {
      warnings.push({
        option: 'dsn',
        message: 'DSN contains a secret key. This is deprecated and not recommended.',
        suggestion: 'Use a DSN without the secret key portion.',
      });
    }
  }

  // Warn about very high maxBreadcrumbs
  if (options.maxBreadcrumbs !== undefined && options.maxBreadcrumbs > 500) {
    warnings.push({
      option: 'maxBreadcrumbs',
      message: `maxBreadcrumbs is set to ${options.maxBreadcrumbs}, which may increase memory usage.`,
      suggestion: 'Consider keeping maxBreadcrumbs below 500.',
    });
  }

  // Warn about very high normalizeDepth
  if (options.normalizeDepth !== undefined && options.normalizeDepth > 10) {
    warnings.push({
      option: 'normalizeDepth',
      message: `normalizeDepth is set to ${options.normalizeDepth}, which may impact performance.`,
      suggestion: 'Consider keeping normalizeDepth below 10.',
    });
  }

  // Warn about sendDefaultPii
  if (options.sendDefaultPii === true) {
    warnings.push({
      option: 'sendDefaultPii',
      message: 'sendDefaultPii is enabled. This will send personally identifiable information.',
      suggestion: 'Ensure this is compliant with your privacy policy.',
    });
  }

  return warnings;
}

/**
 * Perform full validation and return results.
 *
 * @param options - The options to validate
 * @returns Validation result with errors and warnings
 */
export function validateOptionsWithResult(options: InitOptions): ValidationResult {
  const errors: string[] = [];
  const warnings: ValidationWarning[] = [];

  try {
    validateOptions(options);
  } catch (error) {
    if (error instanceof ConfigurationError) {
      errors.push(error.message);
    } else {
      errors.push(String(error));
    }
  }

  warnings.push(...warnInvalidOptions(options));

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Log validation warnings to console.
 *
 * @param warnings - Warnings to log
 * @param debug - Whether to log all warnings or just critical ones
 */
export function logValidationWarnings(
  warnings: ValidationWarning[],
  debug: boolean = false
): void {
  if (warnings.length === 0) {
    return;
  }

  for (const warning of warnings) {
    const message = `[Universal Logger] Warning: ${warning.message}`;
    const suggestion = warning.suggestion ? ` ${warning.suggestion}` : '';

    if (debug) {
      console.warn(message + suggestion);
    }
  }
}
