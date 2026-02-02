# Tasks: Universal Sentry-Compatible Logger v1

Generated from PRD.md + Sentry JavaScript SDK Features Analysis - 29 implementation tasks

---

## Sentry JavaScript SDK Features Analysis

### Overview
This document analyzes the current Universal Sentry-Compatible Logger task list against Sentry's official JavaScript SDK features to identify missing implementations for achieving 50%+ compatibility.

### Current Coverage Summary

| Feature Category | Status |
|------------------|--------|
| Error Monitoring | ✅ 100% |
| Tracing | ✅ 100% |
| Breadcrumbs | ✅ 100% |
| Sessions | ✅ 100% |
| Scopes | ✅ 100% |
| Integrations | ✅ 100% |
| Transports | ✅ 100% |
| Session Replay | ✅ With Task 21 |
| User Feedback | ✅ With Task 22 |
| Metrics | ✅ With Task 23 |
| Feature Flags | ✅ With Task 24 |
| Structured Logs | ✅ With Task 25 |
| Attachments | ✅ With Task 28 |
| Distributed Tracing | ✅ With Task 29 |

**Estimated Compatibility: ~75-80%** (well above the 50% target)

---

## Task 1: Core Type Definitions

**Phase**: 1 - Core Infrastructure
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Define all Sentry-compatible TypeScript interfaces in `/types/sentry.ts`.

### Deliverables
- [ ] `InitOptions` - All init configuration options
- [ ] `Event`, `EventId`, `EventHint` - Event types
- [ ] `User` - User interface with IP auto support
- [ ] `Breadcrumb`, `BreadcrumbHint` - Breadcrumb types
- [ ] `Scope` - Scope interface
- [ ] `Client` - Client interface
- [ ] `Span`, `Transaction` - Tracing types
- [ ] `CaptureContext`, `SeverityLevel` - Capture types
- [ ] `Integration` - Integration base type
- [ ] `Transport` - Transport interface
- [ ] `Feedback` - Feedback types
- [ ] Local logger types: `LogEntry`, `LogSession`, `StorageProvider`, filter types

### Acceptance Criteria
- Types are 100% compatible with Sentry SDK public API
- All types are exported and documented

---

## Task 2: Storage Provider System

**Phase**: 1 - Core Infrastructure
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement the pluggable storage provider architecture with support for Sentry events.

### Deliverables
- [ ] Base `StorageProvider` interface with all methods
- [ ] `IndexedDBStorageProvider` - Full Sentry event support
- [ ] `MemoryStorageProvider` - Full Sentry event support
- [ ] `ZustandStorageProvider` - Full Sentry event support

### Interface Methods
```typescript
interface StorageProvider {
  name: string;
  isReady(): boolean;
  init(): Promise<void>;
  close(): Promise<void>;
  saveLog(entry: LogEntry): Promise<void>;
  getLogs(filter: LogFilter): Promise<LogEntry[]>;
  clearLogs(filter?: LogFilter): Promise<void>;
  createSession(session: LogSession): Promise<void>;
  endSession(sessionId: string): Promise<void>;
  getSessions(limit?: number): Promise<LogSession[]>;
  deleteSession(sessionId: string): Promise<void>;
  saveSentryEvent(event: SentryEvent): Promise<void>;
  getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]>;
  saveSpan(span: Span): Promise<void>;
  saveTransaction(transaction: Transaction): Promise<void>;
  getTraces(filter?: TraceFilter): Promise<Trace[]>;
}
```

### Acceptance Criteria
- All providers implement the full interface
- Events persist correctly across page reloads (IndexedDB)
- Memory provider handles large event volumes

---

## Task 3: UniversalLogger Core Class

**Phase**: 1 - Core Infrastructure
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement the main `UniversalLogger` class with singleton pattern and core lifecycle.

### Deliverables
- [ ] Singleton pattern with instance management
- [ ] Client initialization and lifecycle
- [ ] Scope management (current, isolation, global)
- [ ] Event queue and flush mechanism
- [ ] Enable/disable state management
- [ ] `init(options)` method with full option support
- [ ] `getClient()` / `setCurrentClient()` methods
- [ ] `flush()` and `close()` methods
- [ ] `isEnabled()` and `lastEventId()` methods

### Configuration Support
```typescript
interface UniversalLoggerConfig {
  mode: 'standalone' | 'sentry-proxy' | 'sentry-dual';
  storage: 'indexeddb' | 'memory' | 'zustand' | 'custom';
  sentry?: {
    dsn?: string;
    options?: SentryInitOptions;
    proxy?: boolean;
  };
}
```

### Acceptance Criteria
- Logger initializes with all supported options
- Singleton pattern works correctly
- Flush mechanism processes all queued events

---

## Task 4: Event Processing Pipeline

**Phase**: 1 - Core Infrastructure
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Build the complete event processing pipeline from capture to storage/forwarding.

### Deliverables
- [ ] `beforeSend` hook execution
- [ ] Event processor chain (`addEventProcessor()`)
- [ ] Sampling application (`sampleRate`)
- [ ] Error filtering (`ignoreErrors`, `denyUrls`, `allowUrls`)
- [ ] Event serialization to LogEntry
- [ ] Sentry event metadata preservation
- [ ] Event ID tracking and generation

### Pipeline Flow
```
Sentry API Call
    ↓
Pre-processing (beforeSend, event processors)
    ↓
Sampling (sampleRate check)
    ↓
Filtering (ignoreErrors, denyUrls, allowUrls)
    ↓
Local Storage (IndexedDB/Memory/Zustand)
    ↓
Sentry Forwarding (if proxy mode)
    ↓
Post-processing (callbacks)
```

### Acceptance Criteria
- Events pass through all pipeline stages
- beforeSend can modify or drop events
- Sampling correctly drops events at configured rate

---

## Task 5: captureException Implementation

**Phase**: 2 - Event Capture API
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement full `captureException()` API with all Sentry features.

### Deliverables
- [ ] Error object handling (Error, string, unknown)
- [ ] Stack trace extraction and parsing
- [ ] Capture context application
- [ ] Fingerprint generation
- [ ] User/context/attachment merging
- [ ] Support for `CaptureContext` parameter

### API Signature
```typescript
captureException(exception: unknown, captureContext?: CaptureContext): EventId;
```

### Acceptance Criteria
- All error types are handled correctly
- Stack traces are parsed and normalized
- Capture context merges with scope data
- Returns valid EventId

---

## Task 6: captureMessage Implementation

**Phase**: 2 - Event Capture API
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement full `captureMessage()` API with severity level support.

### Deliverables
- [ ] Message event construction
- [ ] Severity level support (fatal, error, warning, log, info, debug)
- [ ] Attach stack trace if `attachStacktrace` option enabled
- [ ] Capture context support

### API Signature
```typescript
captureMessage(message: string, captureContext?: CaptureContext | SeverityLevel): EventId;
```

### Acceptance Criteria
- Messages are captured with correct severity
- Stack traces attached when configured
- Returns valid EventId

---

## Task 7: captureEvent Implementation

**Phase**: 2 - Event Capture API
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement full `captureEvent()` API for raw event submission.

### Deliverables
- [ ] Full event object support
- [ ] Event validation
- [ ] Event ID generation
- [ ] Event hint support

### API Signature
```typescript
captureEvent(event: Event, hint?: EventHint): EventId;
```

### Acceptance Criteria
- Raw events are captured correctly
- Event validation prevents malformed events
- Returns valid EventId

---

## Task 8: Enrichment APIs

**Phase**: 2 - Event Capture API
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement all event enrichment APIs (setTag, setContext, setExtra, setUser).

### Deliverables
- [ ] `setTag(key, value)` - Tag key validation (32 char, alphanumeric + .-_-:)
- [ ] `setTags(tags)` - Batch tag setting
- [ ] `setContext(name, context)` - Context data normalization, no "type" key
- [ ] `setExtra(name, extra)` - Arbitrary data attachment
- [ ] `setExtras(extras)` - Batch extra setting
- [ ] `setUser(user)` - User object with IP auto ("{{auto}}")

### Validation Rules
- Tag keys: max 32 characters, alphanumeric + .-_-:
- Tag values: max 200 characters, no newlines
- Context: depth-limited serialization

### Acceptance Criteria
- All enrichment data appears in captured events
- Validation rules enforced
- User "{{auto}}" IP detection works

---

## Task 9: Breadcrumb System

**Phase**: 2 - Event Capture API
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement complete breadcrumb capture and management.

### Deliverables
- [ ] `addBreadcrumb(breadcrumb, hint)` - Manual breadcrumb addition
- [ ] Breadcrumb validation (type, category, message, level, data, timestamp)
- [ ] `beforeBreadcrumb` hook execution
- [ ] Max breadcrumb enforcement (`maxBreadcrumbs` option)
- [ ] Automatic breadcrumb collection (clicks, navigation, fetch, console)
- [ ] Breadcrumb storage and retrieval
- [ ] Breadcrumb filtering

### Breadcrumb Types
- default, debug, error, navigation, http, info, query, transaction, ui, user

### Acceptance Criteria
- Manual and automatic breadcrumbs captured
- beforeBreadcrumb can modify or drop breadcrumbs
- maxBreadcrumbs limit enforced (FIFO eviction)

---

## Task 10: Span Class & Basic Tracing

**Phase**: 3 - Tracing System
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement the Span class and basic span creation APIs.

### Deliverables
- [ ] `Span` class with lifecycle (start, end, status)
- [ ] Parent-child relationships
- [ ] Span attributes and tags
- [ ] `startSpan(options, callback)` - Auto-end on callback return
- [ ] `startInactiveSpan(options)` - Manual lifecycle
- [ ] `startSpanManual(options, callback)` - Explicit end control

### Span Options
```typescript
interface StartSpanOptions {
  name: string;
  op?: string;
  attributes?: SpanAttributes;
  parentSpan?: Span;
  forceTransaction?: boolean;
}
```

### Acceptance Criteria
- Spans track timing correctly
- Parent-child relationships preserved
- Callbacks receive span instance

---

## Task 11: Transaction Management

**Phase**: 3 - Tracing System
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement Transaction class and transaction lifecycle management.

### Deliverables
- [ ] `Transaction` class (root span with metadata)
- [ ] Transaction sampling (`tracesSampleRate`, `tracesSampler`)
- [ ] Transaction options (name, op, parentSampled)
- [ ] Transaction start/end lifecycle
- [ ] Child span management
- [ ] Transaction finalization
- [ ] `beforeSendTransaction` hook

### Acceptance Criteria
- Transactions contain all child spans
- Sampling decisions respected
- beforeSendTransaction can modify/filter

---

## Task 12: Span Utilities

**Phase**: 3 - Tracing System
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement span utility functions for inspection and manipulation.

### Deliverables
- [ ] `spanToJSON(span)` - Span serialization
- [ ] `updateSpanName(span, name)` - Dynamic name updates
- [ ] `setHttpStatus(span, status)` - HTTP status to span status mapping
- [ ] `getActiveSpan()` - Current span retrieval
- [ ] `getRootSpan(span)` - Root span traversal
- [ ] `withActiveSpan(span, callback)` - Scoped span activation

### Acceptance Criteria
- All utilities work correctly with Span instances
- HTTP status maps to correct span status

---

## Task 13: Browser Tracing

**Phase**: 3 - Tracing System
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement browser-specific tracing for page loads and navigation.

### Deliverables
- [ ] `startBrowserTracingPageLoadSpan()` - Page load span creation
- [ ] Performance timing integration
- [ ] Auto-end on page idle
- [ ] `startBrowserTracingNavigationSpan()` - Navigation span creation
- [ ] Route change detection
- [ ] `reportPageLoaded()` - Manual page load signal

### Acceptance Criteria
- Page load spans capture performance timings
- Navigation spans track route changes
- Auto-end works correctly

---

## Task 14: Scope Implementation

**Phase**: 4 - Scope Management
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement complete Scope class and scope management APIs.

### Deliverables
- [ ] `Scope` class with data storage (user, tags, extras, contexts, breadcrumbs)
- [ ] Scope cloning and forking
- [ ] Scope hierarchy
- [ ] `withScope(callback)` - Scope forking and cleanup
- [ ] `withIsolationScope(callback)` - Isolation scope handling
- [ ] `getCurrentScope()` - Current scope access
- [ ] `getIsolationScope()` - Isolation scope access
- [ ] `getGlobalScope()` - Global scope access

### Scope Data Management
- User data inheritance and merging
- Tag merging rules and limits
- Context normalization
- Breadcrumb inheritance

### Acceptance Criteria
- Scopes isolate data correctly
- Forked scopes don't affect parent
- All scope data appears in events

---

## Task 15: Sessions API

**Phase**: 5 - Sessions API
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement session lifecycle and tracking APIs.

### Deliverables
- [ ] `startSession()` - Session creation with ID generation
- [ ] `endSession()` - Session termination with duration calculation
- [ ] `captureSession(end?)` - Session reporting
- [ ] Session metadata tracking (started, errors, duration)
- [ ] Session persistence to storage
- [ ] Session history retrieval
- [ ] Release health tracking (crash-free rate, user adoption)

### Acceptance Criteria
- Sessions track duration correctly
- Error counts accumulated
- Sessions persist across page loads
- Release health metrics calculated

---

## Task 16: Transport Layer

**Phase**: 6 - Transport Layer
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement transport layer for event delivery.

### Deliverables
- [ ] Base `Transport` interface (send, flush, close)
- [ ] `FetchTransport` implementation with retry logic
- [ ] Keep-alive support for page unload
- [ ] Request timeout handling
- [ ] `XHRTransport` fallback implementation
- [ ] Event queue with priority (errors > transactions > breadcrumbs)
- [ ] Queue batching and periodic flush
- [ ] Offline support with IndexedDB queue persistence
- [ ] Tunnel endpoint support

### Acceptance Criteria
- Events delivered reliably
- Retry logic handles failures
- Offline events sent on reconnection

---

## Task 17: Integration System

**Phase**: 7 - Integrations
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement the integration system and default integrations.

### Deliverables
- [ ] Integration base class (name, setup, teardown)
- [ ] Integration registry and lifecycle
- [ ] `addIntegration()` API
- [ ] Browser integration (global error handlers, unhandled rejections)
- [ ] HTTP integration (fetch/XHR instrumentation)
- [ ] Breadcrumbs integration (clicks, navigation, console)
- [ ] TryCatch integration

### Integration Hooks
- `setupOnce()` - Run once globally
- `setup()` - Run on client init
- `processEvent()` - Event processing

### Acceptance Criteria
- Default integrations auto-capture events
- Custom integrations register correctly
- Integrations can be disabled

---

## Task 18: Configuration & Options

**Phase**: 8 - Configuration
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement complete init options parsing and validation.

### Deliverables
- [ ] DSN parsing and validation
- [ ] Option defaults and validation
- [ ] Environment detection (production/development)
- [ ] `sampleRate` - Error sampling
- [ ] `beforeSend` - Event modification/filtering
- [ ] `ignoreErrors` - String/regex matching
- [ ] `denyUrls` / `allowUrls` - URL filtering
- [ ] `tracesSampleRate` / `tracesSampler` - Transaction sampling
- [ ] `beforeSendTransaction` / `beforeSendSpan` - Tracing hooks
- [ ] `maxBreadcrumbs` / `beforeBreadcrumb` - Breadcrumb options
- [ ] Core options: debug, release, environment, sendDefaultPii, attachStacktrace, etc.

### Acceptance Criteria
- All documented Sentry options supported
- Invalid options produce helpful errors
- Defaults match Sentry SDK

---

## Task 19: Sentry Proxy Mode

**Phase**: 9 - Sentry Proxy
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement Sentry interception and dual-mode operation.

### Deliverables
- [ ] Sentry SDK wrapping and method interception
- [ ] Mode switching: standalone, proxy, dual
- [ ] DSN validation (format, public key, project ID extraction)
- [ ] Envelope construction (Sentry format)
- [ ] Sentry API communication (store endpoint, auth headers)
- [ ] Rate limit handling
- [ ] Local event viewer (real-time stream, filtering, inspection)
- [ ] Sentry response viewer (status, errors)

### Acceptance Criteria
- All Sentry calls captured locally
- Events forwarded correctly in proxy mode
- Rate limits handled gracefully

---

## Task 20: Debug UI Extensions

**Phase**: 10 - Debug UI
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Extend the React DebugPanel with Sentry-specific views.

### Deliverables
- [ ] Sentry event tab (list view, detail view, raw JSON)
- [ ] Tracing tab (transaction tree, span timeline, performance metrics)
- [ ] Breadcrumbs tab (timeline, filtering, details)
- [ ] Event export (JSON, CSV, Sentry format)
- [ ] Analysis tools (frequency, grouping, user impact)
- [ ] Playback tools (event replay, timeline scrubber)

### Acceptance Criteria
- All captured data viewable in UI
- Export produces valid files
- UI updates in real-time

---

## Task 21: Session Replay System

**Phase**: 11 - Session Replay
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement Session Replay for video-like reproduction of user sessions. One of Sentry's flagship features; essential for understanding user context.

### Reference
https://docs.sentry.io/platforms/javascript/session-replay/

### Deliverables
- [ ] DOM recording and replay (using rrweb or similar)
- [ ] Privacy masking (text, images, inputs) with `maskAllText`, `maskAllInputs`
- [ ] Session sampling (`replaysSessionSampleRate`)
- [ ] Error-based sampling (`replaysOnErrorSampleRate`)
- [ ] Canvas recording support (`enableCanvasCapture`)
- [ ] Network request replay capture
- [ ] Console log replay capture
- [ ] `startSessionReplay()` / `stopSessionReplay()` APIs
- [ ] Replay event buffering and upload

### Configuration Options
```typescript
interface ReplayConfig {
  replaysSessionSampleRate: number;
  replaysOnErrorSampleRate: number;
  maskAllText: boolean;
  maskAllInputs: boolean;
  enableCanvasCapture: boolean;
  blockAllMedia: boolean;
}
```

### Acceptance Criteria
- DOM mutations recorded accurately
- Privacy masking works for sensitive content
- Sampling rates respected
- Replays upload to Sentry correctly

---

## Task 22: User Feedback System

**Phase**: 12 - User Feedback
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement embeddable widget for collecting user feedback. Core feature for user-centric error reporting.

### Reference
https://docs.sentry.io/platforms/javascript/user-feedback/

### Deliverables
- [ ] Embeddable feedback widget (vanilla JS + framework wrappers)
- [ ] Crash-report modal (tied to errors) via `showReportDialog()`
- [ ] Screenshot attachment support
- [ ] Custom form fields configuration
- [ ] Programmatic API (`captureFeedback()`)
- [ ] User feedback event envelope formatting
- [ ] Integration with event association

### API Signature
```typescript
captureFeedback(
  feedback: { name?: string; email?: string; message: string; screenshot?: Blob },
  options?: { eventId?: string; attachments?: Attachment[] }
): string;

showReportDialog(options: ReportDialogOptions): void;
```

### Acceptance Criteria
- Widget renders correctly and captures feedback
- Feedback associates with error events
- Screenshot attachment works
- Dialog can be triggered programmatically

---

## Task 23: Metrics API

**Phase**: 13 - Metrics
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement Metrics API for counters, gauges, and distributions. Modern Sentry feature for application health monitoring.

### Reference
https://docs.sentry.io/platforms/javascript/metrics/

### Deliverables
- [ ] `Sentry.metrics.increment()` - Event counters
- [ ] `Sentry.metrics.gauge()` - Current values
- [ ] `Sentry.metrics.distribution()` - Value ranges
- [ ] `Sentry.metrics.set()` - Unique value tracking
- [ ] `Sentry.metrics.timing()` - Duration measurements
- [ ] Metric attributes/tags for filtering/grouping
- [ ] `beforeSendMetric` hook for filtering
- [ ] Metric aggregation and batching
- [ ] Metric envelope formatting

### API Signature
```typescript
interface Metrics {
  increment(name: string, value?: number, options?: MetricOptions): void;
  gauge(name: string, value: number, options?: MetricOptions): void;
  distribution(name: string, value: number, options?: MetricOptions): void;
  set(name: string, value: string | number, options?: MetricOptions): void;
  timing(name: string, value: number, options?: MetricOptions): void;
}

interface MetricOptions {
  tags?: Record<string, string>;
  unit?: string;
  timestamp?: number;
}
```

### Acceptance Criteria
- All metric types recorded correctly
- Metrics aggregated efficiently
- Tags applied for filtering
- Metrics sent in correct envelope format

---

## Task 24: Feature Flags Integration

**Phase**: 14 - Feature Flags
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement feature flag evaluation tracking for debugging feature-related issues.

### Reference
https://docs.sentry.io/platforms/javascript/feature-flags/

### Deliverables
- [ ] Generic `featureFlagsIntegration()` for custom providers
- [ ] Evaluation tracking API (`addFeatureFlagEvaluation()`)
- [ ] Integration adapters for popular providers:
  - [ ] LaunchDarkly
  - [ ] Statsig
  - [ ] Unleash
  - [ ] OpenFeature
- [ ] Feature flag context in events
- [ ] Flag evaluation history tracking
- [ ] Change tracking support

### API Signature
```typescript
addFeatureFlagEvaluation(flagName: string, flagValue: boolean | string | number): void;

interface FeatureFlagsIntegration {
  name: string;
  setup: (client: Client) => void;
  trackEvaluation: (flag: string, value: unknown) => void;
}
```

### Acceptance Criteria
- Feature flag evaluations captured
- Flags appear in event context
- Integration works with popular providers
- No performance impact on flag checks

---

## Task 25: Structured Logs API

**Phase**: 15 - Structured Logs
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement new logging system with searchable attributes. Modern replacement/augmentation for breadcrumbs.

### Reference
https://docs.sentry.io/platforms/javascript/logs/

### Deliverables
- [ ] `Sentry.logger.trace/debug/info/warn/error/fatal()` methods
- [ ] `Sentry.logger.fmt` template literal support
- [ ] Console logging integration
- [ ] Log filtering with `beforeSendLog`
- [ ] Log-scoped attributes
- [ ] Log envelope formatting
- [ ] Log correlation with spans and events

### API Signature
```typescript
interface Logger {
  trace(message: string, attributes?: LogAttributes): void;
  debug(message: string, attributes?: LogAttributes): void;
  info(message: string, attributes?: LogAttributes): void;
  warn(message: string, attributes?: LogAttributes): void;
  error(message: string, attributes?: LogAttributes): void;
  fatal(message: string, attributes?: LogAttributes): void;
  fmt: TemplateStringsArray;
}

interface LogAttributes {
  [key: string]: string | number | boolean;
}
```

### Acceptance Criteria
- All log levels supported
- Attributes serialized correctly
- Logs correlate with active spans
- beforeSendLog can filter/modify logs

---

## Task 26: AI Agent Monitoring (Optional)

**Phase**: 16 - AI Monitoring
**Priority**: LOW
**Status**: [ ] Not Started

### Description
Implement AI system monitoring for OpenAI, Anthropic, LangChain, etc. Emerging feature for AI-powered applications.

### Reference
https://docs.sentry.io/platforms/javascript/ai-agent-monitoring-browser/

### Deliverables
- [ ] AI client wrappers (OpenAI, Anthropic, etc.)
- [ ] Agent span creation (`ai.agent.invoke`)
- [ ] Tool execution spans (`ai.tool.execute`)
- [ ] Token usage tracking (input/output totals)
- [ ] Latency monitoring
- [ ] LLM call instrumentation
- [ ] AI pipeline tracking

### API Signature
```typescript
interface AIMonitoring {
  wrapOpenAI(client: OpenAI): OpenAI;
  wrapAnthropic(client: Anthropic): Anthropic;
  startAgentSpan(name: string, options?: AgentSpanOptions): Span;
  recordTokenUsage(input: number, output: number): void;
}
```

### Acceptance Criteria
- AI client calls instrumented
- Token usage tracked accurately
- Spans created for agent/tool calls
- No interference with AI client functionality

---

## Task 27: Profiling (Optional/Deferred)

**Phase**: 17 - Profiling
**Priority**: LOW
**Status**: [ ] Not Started

### Description
Implement function-level performance profiling using JS Self-Profiling API. Deep performance insights.

### Reference
https://docs.sentry.io/platforms/javascript/profiling/

### Deliverables
- [ ] JS Self-Profiling API integration
- [ ] Document-Policy header detection/requirement
- [ ] Chromium-only support handling
- [ ] Profile collection and encoding
- [ ] `profilesSampleRate` configuration
- [ ] Profile-envelope formatting
- [ ] Profile-transaction correlation

### Configuration
```typescript
interface ProfilingConfig {
  profilesSampleRate: number;
  // Requires Document-Policy: js-profiling header
}
```

### Acceptance Criteria
- Profiles collected in Chromium browsers
- Document-Policy header detected/reported
- Profiles correlate with transactions
- Minimal performance overhead

---

## Task 28: Attachment Support

**Phase**: 18 - Attachments
**Priority**: MEDIUM
**Status**: [ ] Not Started

### Description
Implement file attachment support for events. Critical for rich error context.

### Reference
https://docs.sentry.io/platforms/javascript/enriching-events/attachments/

### Deliverables
- [ ] `addAttachment()` API
- [ ] Attachment size limits enforcement
- [ ] Attachment types (screenshot, log file, etc.)
- [ ] Envelope attachment encoding (multipart/form-data)
- [ ] Attachment retrieval from scope
- [ ] Attachment filtering in `beforeSend`

### API Signature
```typescript
interface Attachment {
  data: Blob | string | Uint8Array;
  filename: string;
  contentType?: string;
  attachmentType?: 'event.attachment' | 'event.minidump' | 'event.view_hierarchy';
}

addAttachment(attachment: Attachment): void;
```

### Acceptance Criteria
- Attachments added to events correctly
- Size limits enforced
- Envelope encoding correct
- Attachments viewable in Sentry UI

---

## Task 29: Distributed Tracing Headers

**Phase**: 19 - Distributed Tracing
**Priority**: HIGH
**Status**: [ ] Not Started

### Description
Implement trace context propagation across services. Essential for microservices tracing.

### Reference
https://docs.sentry.io/platforms/javascript/tracing/distributed-tracing/

### Deliverables
- [ ] `sentry-trace` header generation and injection
- [ ] `baggage` header propagation (W3C tracestate compatible)
- [ ] `tracePropagationTargets` configuration
- [ ] Incoming trace continuation from headers
- [ ] Outgoing request header injection (fetch/XHR)
- [ ] Dynamic sampling context propagation
- [ ] Third-party origin handling

### Configuration
```typescript
interface DistributedTracingConfig {
  tracePropagationTargets: (string | RegExp)[];
  propagateTraces: boolean;
}
```

### Header Format
```
sentry-trace: <trace-id>-<span-id>-<sampled>
baggage: sentry-trace_id=<id>,sentry-sample_rate=<rate>,...
```

### Acceptance Criteria
- Headers injected on outgoing requests
- Incoming traces continued correctly
- tracePropagationTargets respected
- Dynamic sampling context propagated

---

## Task 30: Logger Factory Pattern (Named Instances)

**Phase**: 20 - Core Architecture Enhancement
**Priority**: HIGH
**Status**: [x] Completed

### Description
Implement factory pattern to support multiple named logger instances with different storage providers. Enables `logger.create('name', provider)` API to fulfill the end goal of creating isolated loggers for different app modules.

### User End Goal
```javascript
const mylogger = logger.create('provider');
// Allows collecting data, tracking errors
// If I already have sentry.functionXYZ, logger will just work as well
```

### Deliverables
- [ ] `UniversalLogger.create(name, options)` - Factory method for named instances
- [ ] `UniversalLogger.get(name)` - Retrieve existing named instance
- [ ] `UniversalLogger.destroy(name)` - Destroy specific named instance
- [ ] `UniversalLogger.destroyAll()` - Destroy all named instances
- [ ] Per-instance storage provider configuration
- [ ] Per-instance scope isolation
- [ ] Registry to track all named instances
- [ ] Backward compatibility with singleton pattern

### API Signature
```typescript
// Create named logger with specific provider
const authLogger = UniversalLogger.create('auth', {
  storage: 'memory',
  maxBreadcrumbs: 100,
});

const apiLogger = UniversalLogger.create('api', {
  storage: 'indexeddb',
  dsn: 'https://xxx@sentry.io/123',
});

// Use like regular Sentry
authLogger.captureException(error);
authLogger.setTag('module', 'auth');

apiLogger.captureMessage('API called');
apiLogger.setTag('module', 'api');

// Retrieve existing
const sameAuthLogger = UniversalLogger.get('auth');

// Cleanup
UniversalLogger.destroy('auth');
UniversalLogger.destroyAll();
```

### Factory Options
```typescript
interface NamedLoggerOptions {
  storage?: 'memory' | 'indexeddb' | StorageProvider;
  dsn?: string;  // Sentry DSN for proxy mode
  maxBreadcrumbs?: number;
  sampleRate?: number;
  beforeSend?: (event: Event) => Event | null;
  environment?: string;
  release?: string;
}
```

### Acceptance Criteria
- Multiple named loggers can coexist
- Each logger has isolated storage
- Factory API matches user end goal pattern
- No conflicts between named instances
- Singleton pattern still works for backward compatibility
- Proper cleanup/destroy functionality

---

## Summary

| Phase | Tasks | Priority |
|-------|-------|----------|
| Phase 1: Core Infrastructure | 1, 2, 3, 4 | HIGH |
| Phase 2: Event Capture API | 5, 6, 7, 8, 9 | HIGH |
| Phase 3: Tracing System | 10, 11, 12, 13 | HIGH/MEDIUM |
| Phase 4: Scope Management | 14 | MEDIUM |
| Phase 5: Sessions API | 15 | MEDIUM |
| Phase 6: Transport Layer | 16 | HIGH |
| Phase 7: Integrations | 17 | MEDIUM |
| Phase 8: Configuration | 18 | HIGH |
| Phase 9: Sentry Proxy | 19 | HIGH |
| Phase 10: Debug UI | 20 | MEDIUM |
| Phase 11: Session Replay | 21 | HIGH |
| Phase 12: User Feedback | 22 | HIGH |
| Phase 13: Metrics | 23 | MEDIUM |
| Phase 14: Feature Flags | 24 | MEDIUM |
| Phase 15: Structured Logs | 25 | MEDIUM |
| Phase 16: AI Monitoring | 26 | LOW |
| Phase 17: Profiling | 27 | LOW |
| Phase 18: Attachments | 28 | MEDIUM |
| Phase 19: Distributed Tracing | 29 | HIGH |
| Phase 20: Factory Pattern | 30 | HIGH |

**Total Tasks**: 30
**HIGH Priority**: 15
**MEDIUM Priority**: 11
**LOW Priority**: 3

---

## Key Documentation References

1. **Main JavaScript SDK**: https://docs.sentry.io/platforms/javascript/
2. **Session Replay**: https://docs.sentry.io/platforms/javascript/session-replay/
3. **User Feedback**: https://docs.sentry.io/platforms/javascript/user-feedback/
4. **Tracing**: https://docs.sentry.io/platforms/javascript/tracing/
5. **Metrics**: https://docs.sentry.io/platforms/javascript/metrics/
6. **Logs**: https://docs.sentry.io/platforms/javascript/logs/
7. **Profiling**: https://docs.sentry.io/platforms/javascript/profiling/
8. **Feature Flags**: https://docs.sentry.io/platforms/javascript/feature-flags/
9. **AI Monitoring**: https://docs.sentry.io/platforms/javascript/ai-agent-monitoring-browser/
10. **Configuration Options**: https://docs.sentry.io/platforms/javascript/configuration/
