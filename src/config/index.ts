/**
 * Configuration Module
 *
 * Exports all configuration-related functionality including options,
 * defaults, validation, DSN parsing, filtering, and sampling.
 */

// Options types and interfaces
export type {
  InitOptions,
  ResolvedOptions,
  TransportFactory,
  StackParser,
  BeforeSendCallback,
  BeforeSendTransactionCallback,
  BeforeSendSpanCallback,
  BeforeBreadcrumbCallback,
  TracesSampler,
} from './options';

// Default values and option merging
export {
  DEFAULT_OPTIONS,
  getDefaultOptions,
  mergeOptions,
  createDevOptions,
  createProdOptions,
  isDevelopment,
  getEnvironmentDefaults,
} from './defaults';

// Validation utilities
export {
  ConfigurationError,
  validateDsn,
  parseDsnForValidation,
  validateSampleRate,
  validateOptions,
  warnInvalidOptions,
  validateOptionsWithResult,
  logValidationWarnings,
} from './validation';

export type {
  ValidationWarning,
  ValidationResult,
} from './validation';

// DSN parsing and handling
export type { Dsn } from './dsn';

export {
  parseDsn,
  dsnToString,
  getEnvelopeEndpoint,
  getStoreEndpoint,
  getBaseApiEndpoint,
  getMinidumpEndpoint,
  getSecurityEndpoint,
  getReportDialogUrl,
  getAuthHeaders,
  extractPublicKey,
  extractProjectId,
  isValidDsn,
  createDsn,
} from './dsn';

// Filtering utilities
export type { FilterOptions } from './filtering';

export {
  matchesPattern,
  matchesAnyPattern,
  getEventMessage,
  getEventType,
  shouldIgnoreError,
  shouldIgnoreTransaction,
  isUrlAllowed,
  getEventUrl,
  shouldFilterByUrl,
  shouldPropagateTrace,
  shouldFilterEvent,
  createEventFilter,
  COMMON_IGNORE_ERRORS,
  COMMON_DENY_URLS,
} from './filtering';

// Sampling utilities
export type {
  SamplingDecision,
  SamplingReason,
} from './sampling';

export {
  generateRandom,
  shouldSampleEvent,
  getSamplingDecision,
  createSamplingContext,
  shouldSampleTransaction,
  shouldSampleReplay,
  shouldSampleProfile,
  applySampling,
  deterministicSample,
} from './sampling';
