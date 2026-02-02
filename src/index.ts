/**
 * Universal Sentry-Compatible Logger
 *
 * A drop-in replacement for the Sentry SDK that provides:
 * - Full Sentry API compatibility
 * - Local storage for offline support
 * - Optional forwarding to Sentry
 * - Debug UI for local development
 *
 * @packageDocumentation
 */

// ============================================
// Core Logger
// ============================================
export { UniversalLogger, type UniversalLoggerConfig } from './core/logger';

// ============================================
// Singleton API (Sentry-compatible)
// ============================================
import { UniversalLogger } from './core/logger';

const logger = UniversalLogger.getInstance();

// Initialization
export function init(options: import('./types').InitOptions): void {
  logger.init(options);
}

// Capture methods
export function captureException(
  exception: unknown,
  captureContext?: import('./types').CaptureContext
): string {
  return logger.captureException(exception, captureContext);
}

export function captureMessage(
  message: string,
  captureContext?: import('./types').CaptureContext | import('./types').SeverityLevel
): string {
  return logger.captureMessage(message, captureContext);
}

export function captureEvent(
  event: import('./types').Event,
  hint?: import('./types').EventHint
): string {
  return logger.captureEvent(event, hint);
}

// Enrichment
export function setTag(key: string, value: string): void {
  logger.setTag(key, value);
}

export function setTags(tags: Record<string, string>): void {
  logger.setTags(tags);
}

export function setContext(name: string, context: Record<string, unknown> | null): void {
  logger.setContext(name, context);
}

export function setExtra(key: string, value: unknown): void {
  logger.setExtra(key, value);
}

export function setExtras(extras: Record<string, unknown>): void {
  logger.setExtras(extras);
}

export function setUser(user: import('./types').User | null): void {
  logger.setUser(user);
}

export function addBreadcrumb(breadcrumb: import('./types').Breadcrumb): void {
  logger.addBreadcrumb(breadcrumb);
}

// Attachments
export function addAttachment(attachment: import('./types').Attachment): void {
  logger.addAttachment(attachment);
}

export function clearAttachments(): void {
  logger.clearAttachments();
}

// Scope
import type { Scope as ScopeType } from './scope/scope';

export function withScope<T>(callback: (scope: ScopeType) => T): T {
  return logger.withScope(callback);
}

export function withIsolationScope<T>(callback: (scope: ScopeType) => T): T {
  return logger.withIsolationScope(callback);
}

export function getCurrentScope(): ScopeType {
  return logger.getCurrentScope();
}

export function getIsolationScope(): ScopeType {
  return logger.getIsolationScope();
}

export function getGlobalScope(): ScopeType {
  return logger.getGlobalScope();
}

export function configureScope(callback: (scope: ScopeType) => void): void {
  callback(logger.getCurrentScope());
}

// Lifecycle
export function flush(timeout?: number): Promise<boolean> {
  return logger.flush(timeout);
}

export function close(timeout?: number): Promise<boolean> {
  return logger.close(timeout);
}

export function isEnabled(): boolean {
  return logger.isEnabled();
}

export function lastEventId(): string | undefined {
  return logger.lastEventId();
}

export function getClient() {
  return logger.getClient();
}

// Event processors and integrations
export function addEventProcessor(
  processor: (event: import('./types').Event, hint?: import('./types').EventHint) => import('./types').Event | null | Promise<import('./types').Event | null>
): void {
  logger.addEventProcessor(processor);
}

export function addIntegration(integration: import('./types').Integration): void {
  logger.addIntegration(integration);
}

// ============================================
// Scope
// ============================================
export {
  Scope,
  ScopeManager,
  getDefaultScopeManager,
  resetDefaultScopeManager,
} from './scope';

export type { EventProcessor, ScopeData } from './scope';

// ============================================
// Tracing
// ============================================
export {
  // Core classes
  Span,
  Transaction,
  isTransaction,

  // Main span APIs
  startSpan,
  startInactiveSpan,
  startSpanManual,
  getActiveSpan,
  getRootSpan,
  withActiveSpan,
  continueTrace,
  suppressTracing,
  startNewTrace,

  // ID generation
  generateTraceId,
  generateSpanId,
  generateEventId,

  // Propagation headers
  generateSentryTraceHeader,
  parseSentryTraceHeader,
  generateBaggageHeader,
  parseBaggageHeader,
  getPropagationHeaders,
  extractTraceContext,

  // Distributed tracing - header injection
  shouldPropagateTo,
  shouldInjectHeaders,
  injectTracingHeaders,
  injectXHRHeaders,
  createTraceHeaders,
  createTracingHeaderInjector,

  // Distributed tracing - trace continuation
  extractIncomingTraceData,
  extractTraceDataFromHeaders,
  extractTraceDataFromObject,
  continueTraceFromHeaders,
  continueTraceWithOptions,
  getTracePropagationContext,
} from './tracing';

export type {
  // Header injection types
  TracingHeaderInjectorOptions,
  // Trace continuation types
  IncomingTraceData,
  ExtractTraceOptions,
  ContinueTraceOptions,
  // Core tracing types
  DynamicSamplingContext,
  TracePropagationData,
  ParsedSentryTrace,
} from './tracing';

export {
  spanToJSON,
  setHttpStatus,
  updateSpanName,
} from './tracing/spanUtils';

// ============================================
// Browser Tracing
// ============================================
export {
  startBrowserTracingPageLoadSpan,
  startBrowserTracingNavigationSpan,
  reportPageLoaded,
} from './tracing/browserTracing';

// ============================================
// Sessions
// ============================================
export {
  Session,
  SessionManager,
  type SessionStatus,
  type SessionData,
  type SessionContext,
} from './sessions';

// Session singleton functions
import { SessionManager } from './sessions';
import { createStorageProvider } from './storage';

let _sessionManager: SessionManager | undefined;

export function startSession(context?: Record<string, unknown>): void {
  if (!_sessionManager) {
    const storage = createStorageProvider('memory');
    _sessionManager = new SessionManager(storage);
  }
  _sessionManager.startSession(context);
}

export function endSession(): void {
  if (_sessionManager) {
    _sessionManager.endSession();
  }
}

export function captureSession(endSession?: boolean): void {
  if (_sessionManager) {
    _sessionManager.captureSession(endSession);
  }
}

// ============================================
// Integrations
// ============================================
export {
  browserIntegration,
  httpIntegration,
  breadcrumbsIntegration,
  tryCatchIntegration,
  getDefaultIntegrations,
} from './integrations';

// ============================================
// Metrics API
// ============================================
export {
  // Main metrics object (Sentry-style)
  metrics,
  // Metrics class
  Metrics,
  // Singleton functions
  getMetrics,
  initMetrics,
  resetMetrics,
  increment,
  gauge,
  distribution,
  set,
  timing,
  flushMetrics,
  // Utilities
  createScopedMetrics,
  measureAsync,
  measureSync,
  // Aggregator
  MetricsAggregator,
  // Envelope utilities
  createMetricEnvelope,
  serializeMetricEnvelope,
  formatStatsdLine,
  formatStatsdBatch,
  // Types
  type MetricUnit,
  type MetricType,
  type MetricOptions,
  type MetricData,
  type MetricsConfig,
  type MetricsAPI,
  type StatsdMetric,
  type MetricBucket,
  type AggregatedMetric,
  type MetricEnvelope,
} from './metrics';

// Import metrics for default export
import { metrics } from './metrics';

// ============================================
// Structured Logs API
// ============================================
import { logger as structuredLogger } from './structuredLogs';

// Export as Sentry.logger for API compatibility
export { structuredLogger as logger };

export {
  // Logger classes and functions
  StructuredLogger,
  getLogger,
  initLogger as initStructuredLogger,
  resetLogger,

  // Types
  type LogLevel,
  type LogAttributes,
  type LogRecord,
  type LoggerOptions,
  type LoggerAPI,
  type LogEnvelopeItem,
  type LogBatch,
  type ConsoleMethod,
  type ConsoleIntegrationOptions as LogConsoleIntegrationOptions,
  type ParameterizedLogMessage,

  // Constants
  LogLevelValues,
  SeverityNumbers,
  LogLevelToSeverity,
  isParameterizedLogMessage,

  // Envelope utilities
  type LogEnvelopeHeaders,
  type LogEnvelope,
  type LogEnvelopeOptions,
  logRecordToEnvelopeItem,
  convertAttributesToEnvelopeFormat,
  createLogBatch,
  createLogEnvelope,
  serializeLogEnvelope,
  serializeLogEnvelopeToBytes,
  parseLogEnvelope,
  getLogEnvelopeSize,
  splitIntoEnvelopes,
  mergeLogEnvelopes,

  // Console integration
  installConsoleIntegration,
  uninstallConsoleIntegration,
  isConsoleIntegrationActive,
  updateConsoleIntegrationOptions,
  consoleLoggingIntegration,
  withoutConsoleCapture,
  createConsoleProxy,
} from './structuredLogs';

// ============================================
// Feedback
// ============================================
export {
  captureFeedback,
  sendFeedback,
  createFeedbackWidget,
  validateFeedback,
  defaultFeedbackFormConfig,
  showReportDialog,
  captureScreenshot,
  createFeedbackWidgetButton,
  removeFeedbackWidgetButton,
  type FeedbackEvent,
  type FeedbackWithScreenshot,
  type SendFeedbackOptions,
  type FeedbackFormConfig,
  type ReportDialogOptions,
  type FeedbackWidgetOptions,
} from './core/feedback';

// ============================================
// Production Helper Utilities
// ============================================
export {
  helpers,
  sentry,
  type CaptureErrorOptions,
  type TrackEventOptions,
  type IdentifyUserOptions,
} from './core/helpers';

// ============================================
// Local Logger Extensions (not in Sentry)
// ============================================
export {
  getLocalLogs,
  getSentryEvents,
  clearLocalData,
  exportLogs,
  getLogStats,
  searchLogs,
  getRecentErrors,
  getLogsForTrace,
  getLogsForSession,
  exportDebugData,
  type LogStats,
  type SearchOptions,
  type DebugExport,
} from './core/local';

// ============================================
// Storage Providers
// ============================================
export {
  createStorageProvider,
  createBestStorageProvider,
  isIndexedDBSupported,
  getBestStorageType,
  MemoryStorageProvider,
  IndexedDBStorageProvider,
  BaseStorageProvider,
  type StorageProvider,
  type StorageProviderConfig,
  type StorageProviderType,
  type LogEntry,
  type LogFilter,
  type SentryEvent,
  type SentryEventFilter,
} from './storage';

// ============================================
// Attachment Utilities
// ============================================
export {
  MAX_ATTACHMENT_SIZE,
  MAX_TOTAL_ATTACHMENTS_SIZE,
  validateAttachment,
  validateAttachmentsSize,
  encodeAttachment,
  encodeAttachmentAsync,
  createTextAttachment,
  createJsonAttachment,
  createBinaryAttachment,
  filterAttachments,
  dropAttachmentsByFilename,
  dropAttachmentsBySize,
  keepAttachmentsByContentType,
  type AttachmentType,
  type AttachmentValidationResult,
  type EncodedAttachment,
} from './transport/attachments';

// ============================================
// Feature Flags
// ============================================
export {
  // Integration
  featureFlagsIntegration,
  getFeatureFlagsIntegration,
  setFeatureFlagsIntegration,
  resetFeatureFlagsIntegration,

  // Public API
  addFeatureFlagEvaluation,
  getFeatureFlagEvaluations,
  getFeatureFlags,
  clearFeatureFlagEvaluations,
  getFeatureFlag,
  hasFeatureFlag,
  getFeatureFlagHistory,
} from './featureFlags';

export type {
  FeatureFlagValue,
  FeatureFlagEvaluation,
  FeatureFlagContext,
  FeatureFlagsIntegration,
  FeatureFlagsIntegrationOptions,
  FeatureFlagAdapter,
  AdapterOptions,
  LaunchDarklyAdapterOptions,
  StatsigAdapterOptions,
  UnleashAdapterOptions,
  OpenFeatureAdapterOptions,
} from './featureFlags';

// ============================================
// Init helpers
// ============================================
export {
  init as initLogger,
  initDev,
  initProd,
  isInitialized,
  createScopedInit,
  type UniversalLoggerInitOptions,
} from './init';

// ============================================
// Type Exports
// ============================================
export type {
  // Sentry types
  Event,
  EventId,
  EventHint,
  Exception,
  StackFrame,
  Stacktrace,
  Breadcrumb,
  BreadcrumbHint,
  User,
  CaptureContext,
  SeverityLevel,
  Mechanism,
  Contexts,
  Request,
  SdkInfo,
  Extras,
  DataCategory,
  Attachment,
  ParameterizedString,
} from './types/sentry';

export type {
  // Scope types
  ScopeLike,
  ScopeData as ScopeDataType,
  ScopeCallback,
  IsolationScope,
  CurrentScope,
  GlobalScope,
  AnyScope,
  ScopeOptions,
} from './types/scope';

export type {
  // Span/Transaction types
  Span as SpanType,
  SpanContext,
  SpanStatus,
  SpanAttributes,
  SpanAttributeValue,
  StartSpanOptions,
  Transaction as TransactionType,
  TransactionContext,
  TransactionSource,
  TransactionMetadata,
  SpanJSON,
  SpanTimeInput,
  SpanOrigin,
  SpanLink,
  SpanLinkOptions,
  Sampler,
  SamplingContext,
  SamplingDecision,
  MeasurementUnit,
  Measurement,
  SpanRecorder,
} from './types/span';

export { SpanStatusCode, TraceFlags } from './types/span';

export type {
  // Session types (from types)
  Session as SessionTypeFromTypes,
  SessionStatus as SessionStatusType,
  SessionAttributes as SessionAttributesType,
  SessionContext as SessionContextType,
  SessionAggregates as SessionAggregatesType,
  SessionAggregate,
  SessionFlusher as SessionFlusherType,
} from './types/session';

export type {
  // Integration types
  Integration,
  IntegrationFn,
  IntegrationClass,
  DefaultIntegrationsOptions,
  InboundFiltersOptions,
  BreadcrumbsIntegrationOptions,
  LinkedErrorsOptions,
  GlobalHandlersOptions,
  HttpIntegrationOptions,
  ConsoleIntegrationOptions,
  IntegrationIndex,
  GetDefaultIntegrations,
  AddIntegrationOptions,
  InstalledIntegrations,
} from './types/integration';

export type {
  // Transport types
  Transport,
  TransportOptions,
  TransportRequest,
  TransportResponse,
  TransportFactory,
  TransportMakeRequestFn,
  TransportMakeRequestResponse,
  RateLimits,
  Envelope,
  EnvelopeItem,
  EnvelopeHeaders,
  EnvelopeItemHeaders,
  EventEnvelope,
  SessionEnvelope,
  ClientReport,
  ClientReportDiscardReason,
} from './types/transport';

export type {
  // Options
  InitOptions,
  ClientOptions,
  BrowserOptions,
  NodeOptions,
  FlushOptions,
  ProfilingOptions,
  DsnComponents,
  StackParser,
  StackLineParser,
  DebugLogger,
  SdkMetadata,
  CaptureExceptionOptions,
  CaptureMessageOptions,
  CaptureEventOptions,
  AddBreadcrumbOptions,
  TraceOptions,
  CustomSamplingContext,
} from './types/options';

export type {
  // Client types
  Client,
  ClientHook,
  Dsn,
  TracesSampler,
  TracesSamplerContext,
  BeforeSendCallback,
  BeforeSendTransactionCallback,
  BeforeSendSpanCallback,
  BeforeBreadcrumbCallback,
  ExceptionEventHint,
  MessageEventHint,
} from './types/client';

export type {
  // Storage types (additional from storage/types.js)
  LogSession,
  SpanData,
  TransactionData,
  TraceData,
  TraceFilter,
  BreadcrumbType,
  ExceptionData,
  RequestData,
} from './storage/types';

// ============================================
// AI Agent Monitoring
// ============================================
export {
  // Main API
  aiMonitoring,
  getActiveAISpan,
  createAIMonitoring,

  // Span helpers
  startAgentSpan,
  startToolSpan,
  startPipelineSpan,
  startPipelineStepSpan,
  recordTokenUsage,
  recordCost,
  recordModelInfo,
  recordFinishReason,
  startChatCompletionSpan,
  startEmbeddingSpan,
  finalizeStreamingSpan,

  // Client wrappers
  wrapOpenAIClient,
  wrapAnthropicClient,

  // Manual instrumentation
  instrumentChatCompletion,
  instrumentEmbeddings,
  instrumentAnthropicMessage,

  // Utilities
  calculateAnthropicCost,
  parseAnthropicModel,
} from './ai';

export type {
  // Core types
  AIMonitoring,
  AISpanAttributes,
  TokenUsage,

  // Span options
  AgentSpanOptions,
  ToolSpanOptions,
  AIPipelineOptions,

  // Wrapper options
  WrapOpenAIOptions,
  WrapAnthropicOptions,

  // Response types
  ChatMessage,
  ChatCompletionResponse,
  CompletionUsage,
  EmbeddingsResponse,
  OpenAIStreamEvent,
  AnthropicMessageResponse,
  AnthropicStreamEvent,

  // Utility types
  AIOperationType,
  AIProvider,
  FinishReason,
} from './ai';

// ============================================
// Default export
// ============================================
import { aiMonitoring } from './ai';

export default {
  init,
  captureException,
  captureMessage,
  captureEvent,
  setTag,
  setTags,
  setContext,
  setExtra,
  setExtras,
  setUser,
  addBreadcrumb,
  addAttachment,
  clearAttachments,
  withScope,
  withIsolationScope,
  configureScope,
  getCurrentScope,
  getIsolationScope,
  getGlobalScope,
  flush,
  close,
  isEnabled,
  lastEventId,
  getClient,
  addEventProcessor,
  addIntegration,
  startSession,
  endSession,
  captureSession,
  // Structured Logs API (Sentry.logger)
  logger: structuredLogger,
  // Metrics API (Sentry.metrics)
  metrics,
  // AI Agent Monitoring
  ai: aiMonitoring,
};
