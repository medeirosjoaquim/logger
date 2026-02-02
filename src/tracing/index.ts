/**
 * Tracing Module
 *
 * Exports all tracing-related functions and types for distributed tracing
 * with Sentry-compatible API.
 */

// ============================================
// Core classes
// ============================================

// Span class
export { Span } from './span.js';

// Transaction class
export { Transaction, isTransaction } from './transaction.js';

// ============================================
// ID generation
// ============================================

export {
  generateTraceId,
  generateSpanId,
  generateEventId,
  isValidTraceId,
  isValidSpanId,
} from './idGenerator.js';

// ============================================
// Span utilities
// ============================================

export {
  // Active span management
  getActiveSpan,
  setActiveSpan,
  withActiveSpan,
  // Serialization
  spanToJSON,
  // Name updates
  updateSpanName,
  // HTTP status
  setHttpStatus,
  getSpanStatusFromHttpCode,
  // Root span
  getRootSpan,
  getTransaction,
  // Span relationships
  isDescendantOf,
  getAllSpans,
  // Timing utilities
  timestampInSeconds,
  hrTimeToSeconds,
  getSpanDurationMs,
  // Status utilities
  isErrorStatus,
  isOkStatus,
  createErrorStatus,
  createOkStatus,
  // Attribute utilities
  setHttpClientAttributes,
  setDatabaseAttributes,
} from './spanUtils.js';

// ============================================
// Sampling
// ============================================

export {
  sampleTransaction,
  createSamplingContext,
  isSamplingEnabled,
  getEffectiveSampleRate,
  createOperationBasedSampler,
  createUrlPatternSampler,
  combineSamplers,
} from './sampling.js';

export type { SamplingOptions } from './sampling.js';

// ============================================
// Context management
// ============================================

export {
  TraceContext,
  getActiveSpan as getActiveSpanFromContext,
  getActiveTransaction as getActiveTransactionFromContext,
  isTracingSuppressed,
} from './context.js';

// ============================================
// Hub extensions (main span APIs)
// ============================================

export {
  // Configuration
  setTracingHub,
  getTracingHub,
  // Main span APIs
  startSpan,
  startSpanManual,
  startInactiveSpan,
  // Trace continuation
  continueTrace,
  // Trace suppression
  suppressTracing,
  // New trace
  startNewTrace,
  // Transaction helpers
  startTransaction,
  getActiveTransaction,
} from './hubExtensions.js';

// ============================================
// Propagation
// ============================================

export {
  // Sentry trace header
  generateSentryTraceHeader,
  parseSentryTraceHeader,
  extractSpanContextFromHeader,
  // Baggage header
  generateBaggageHeader,
  parseBaggageHeader,
  // Combined
  getTraceparentData,
  getPropagationHeaders,
  // W3C Trace Context
  generateTraceparentHeader,
  parseTraceparentHeader,
  // Extraction
  extractTraceContext,
} from './propagation.js';

// ============================================
// Header Injection (Distributed Tracing)
// ============================================

export {
  // URL matching
  shouldPropagateTo,
  shouldInjectHeaders,
  isSameOrigin,
  getUrlFromFetchInput,
  // Header creation
  createTraceHeaders,
  // Injection
  injectTracingHeaders,
  injectXHRHeaders,
  // Factory
  createTracingHeaderInjector,
} from './headerInjection.js';

export type { TracingHeaderInjectorOptions } from './headerInjection.js';

// ============================================
// Trace Continuation
// ============================================

export {
  // Extraction
  extractIncomingTraceData,
  extractTraceDataFromHeaders,
  extractTraceDataFromObject,
  // Context creation
  createSpanContextFromTraceData,
  // Continuation
  continueTraceFromData,
  continueTraceFromHeaders,
  continueTraceWithOptions,
  // Propagation context
  getTracePropagationContext,
} from './traceContinuation.js';

export type {
  IncomingTraceData,
  ExtractTraceOptions,
  ContinueTraceOptions,
} from './traceContinuation.js';

// ============================================
// Browser tracing
// ============================================

export {
  // Page load and navigation
  startBrowserTracingPageLoadSpan,
  startBrowserTracingNavigationSpan,
  reportPageLoaded,
  // Web vitals
  startWebVitalsObserver,
  stopWebVitalsObserver,
  // Resource timing
  addResourceTimingSpans,
  // History API instrumentation
  instrumentHistoryAPI,
} from './browserTracing.js';

// ============================================
// Types
// ============================================

export type {
  SpanStatus,
  SpanStatusCode,
  SpanJSON,
  SpanAttributes,
  SpanAttributeValue,
  SpanContext,
  StartSpanOptions,
  TransactionContext,
  TransactionSource,
  TransactionMetadata,
  TransactionJSON,
  DynamicSamplingContext,
  Hub,
  SamplingContext,
  BrowserTracingOptions,
  TracePropagationData,
  ParsedSentryTrace,
} from './types.js';
