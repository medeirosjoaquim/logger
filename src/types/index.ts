/**
 * Type definitions for Universal Logger
 * Re-exports all types from submodules
 */

// ============= Core Sentry types =============
export type {
  SeverityLevel,
  EventId,
  Primitive,
  Mechanism,
  StackFrame,
  Stacktrace,
  Exception,
  User,
  Breadcrumb,
  BreadcrumbHint,
  Contexts,
  Request,
  SdkInfo,
  Thread,
  DebugImage,
  DebugMeta,
  Event,
  EventHint,
  CaptureContext,
  ScopeContext,
  ParameterizedString,
  Extras,
  DataCategory,
  Attachment,
} from './sentry';

// ============= Scope types =============
export type {
  ScopeCallback,
  ScopeContext as ScopeContextData,
  EventProcessor,
  ScopeAttachment,
  PropagationContext,
  DynamicSamplingContext,
  ScopeData,
  ScopeOptions,
  ScopeLike,
  IsolationScope,
  CurrentScope,
  GlobalScope,
  AnyScope,
} from './scope';

// ============= Span and tracing types =============
export type {
  SpanStatus,
  SpanAttributeValue,
  SpanAttributes,
  SpanTimeInput,
  SpanOrigin,
  SpanContext,
  SpanJSON,
  StartSpanOptions,
  TransactionContext,
  TransactionSource,
  TransactionMetadata,
  Sampler,
  SamplingContext,
  SamplingDecision,
  Span,
  Transaction,
  SpanLink,
  SpanLinkOptions,
  MeasurementUnit,
  Measurement,
  SpanRecorder,
} from './span';
export { SpanStatusCode, TraceFlags } from './span';

// ============= Session types =============
export type {
  SessionStatus,
  Session,
  SessionAttributes,
  SessionContext,
  SessionAggregates,
  SessionAggregate,
  SessionFlusher,
  SessionOptions,
  RequestSession,
  ReplayEvent,
  RecordingSegment,
} from './session';

// ============= Client types =============
export type {
  Dsn,
  StackParser,
  TracesSampler,
  TracesSamplerContext,
  BeforeSendCallback,
  BeforeSendTransactionCallback,
  BeforeSendSpanCallback,
  BeforeBreadcrumbCallback,
  ClientOptions,
  Client,
  ClientHook,
  ExceptionEventHint,
  MessageEventHint,
} from './client';

// ============= Options types =============
export type {
  DsnComponents,
  Dsn as DsnParsed,
  StackLineParser,
  StackFrame as OptionsStackFrame,
  DebugLogger,
  InitOptions,
  SdkMetadata,
  ClientOptions as OptionsClientOptions,
  ClientMethodOptions,
  CaptureExceptionOptions,
  CaptureMessageOptions,
  CaptureEventOptions,
  AddBreadcrumbOptions,
  TraceOptions,
  CustomSamplingContext,
  BrowserOptions,
  NodeOptions,
  FlushOptions,
  ProfilingOptions,
} from './options';

// ============= Transport types =============
export type {
  EnvelopeItemType,
  BaseEnvelopeHeaders,
  DynamicSamplingContextHeaders,
  EnvelopeHeaders,
  EnvelopeItemHeaders,
  EventEnvelopeItem,
  SessionEnvelopeItem,
  SessionsEnvelopeItem,
  AttachmentEnvelopeItem,
  UserReportEnvelopeItem,
  ClientReportEnvelopeItem,
  CheckInEnvelopeItem,
  SpanEnvelopeItem,
  ReplayRecordingEnvelopeItem,
  EnvelopeItem,
  Envelope,
  EventEnvelope,
  SessionEnvelope,
  ClientReport,
  ClientReportDiscardReason,
  CheckIn,
  MonitorConfig,
  TransportRequest,
  TransportResponse,
  TransportMakeRequestResponse,
  InternalTransportRequestMetadata,
  RateLimits,
  Transport,
  TransportOptions,
  TransportFactory,
  TransportMakeRequestFn,
} from './transport';

// ============= Integration types =============
export type {
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
} from './integration';

// ============= Feedback types =============
export type {
  FeedbackEvent,
  FeedbackAttachment,
  SendFeedbackOptions,
  FeedbackFormConfig,
  FeedbackColorScheme,
  FeedbackWidgetConfig,
  FeedbackInternalEvent,
  UserReport,
  FeedbackResult,
  FeedbackScreenshot,
} from './feedback';

// ============= Logger types =============
export type {
  LogLevel,
  LogEntry,
  LogSource,
  LogSession,
  LogFilter,
  SentryEventFilter,
  TraceFilter,
  StoredEvent,
  StoredSpan,
  QueryResult,
  LogStats,
  LogExportFormat,
  LogExportOptions,
} from './logger';
export { LogLevelToSeverity, SeverityToLogLevel } from './logger';

// ============= Storage types =============
export type {
  StorageConfig,
  StorageProvider,
  StorageStats,
  CleanupResult,
  StorageExport,
  ImportResult,
  StorageMigration,
  StorageEventType,
  StorageEventListener,
  StorageProviderWithEvents,
} from './storage';

// ============= Config types =============
export type {
  UniversalLoggerMode,
  ConsoleConfig,
  SentryForwardingConfig,
  SamplingConfig,
  SamplerContext,
  FilterConfig,
  FilterContext,
  RedactionConfig,
  PerformanceConfig,
  LoggerHooks,
  HookLogEntry,
  UniversalLoggerConfig,
  SessionConfig,
  BreadcrumbConfig,
  ResolvedLoggerConfig,
  ConfigValidationResult,
  ConfigValidationError,
} from './config';
