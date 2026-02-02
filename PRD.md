# PRD: Universal Sentry-Compatible Logger

## Overview

Create a higher-order component (HOC) logger system that is 100% compatible with Sentry SDK API, capable of intercepting all Sentry calls for local debugging while also serving as the main logger. The system will support `new LocalLogger('indexeddb')` to capture all Sentry events with identical debugging UI hits.

## Goals

1. **Sentry API Compatibility**: Implement all Sentry SDK methods, options, and types
2. **Dual Mode Operation**: Work as primary logger OR as Sentry interceptor/debugger
3. **Feature Parity**: Support all Sentry features (tracing, breadcrumbs, contexts, sessions, etc.)
4. **Drop-in Replacement**: Replace Sentry SDK without code changes
5. **Enhanced Debugging**: Provide local inspection of all events sent to Sentry

---

## Current Logger System Analysis

### Existing Architecture (`/home/asari/dojo/kimi-excel/packages/client/src/lib/logger.ts`)

**Strengths:**
- Session-based logging with multiple storage providers (IndexedDB, Memory, Zustand)
- React DebugPanel with real-time log viewing
- Pluggable storage provider architecture
- Log level filtering and session management

**Limitations:**
- Partial Sentry compatibility (only basic capture methods)
- No tracing support (spans/transactions)
- Limited breadcrumb management
- No session replay capture
- Missing many Sentry options (sampling, filtering, integrations)
- No transport layer abstraction
- No event processors or hooks

### Key Components

```
Logger (singleton)
  ├── StorageProvider Interface
  │   ├── IndexedDBStorageProvider
  │   ├── MemoryStorageProvider
  │   ├── ZustandStorageProvider
  │   └── SentryStorageProvider (partial)
  └── LogEntry / LogSession
```

---

## Target Architecture

### Universal Logger (HOC Pattern)

```typescript
interface UniversalLoggerConfig {
  mode: 'standalone' | 'sentry-proxy' | 'sentry-dual';
  storage: 'indexeddb' | 'memory' | 'zustand' | 'custom';
  sentry?: {
    dsn?: string;
    options?: SentryInitOptions;
    proxy?: boolean; // Capture and forward to Sentry
  };
}

class UniversalLogger {
  // Core Sentry API
  init(options: SentryInitOptions): Client | undefined;
  captureException(exception: unknown, captureContext?: CaptureContext): EventId;
  captureMessage(message: string, captureContext?: CaptureContext | SeverityLevel): EventId;
  captureEvent(event: Event): EventId;

  // Tracing API
  startSpan<T>(options: StartSpanOptions, callback: (span: Span) => T): T;
  startInactiveSpan(options: StartSpanOptions): Span;
  startSpanManual<T>(options: StartSpanOptions, callback: (span: Span) => T): T;

  // Enrichment API
  setTag(key: string, value: string): void;
  setTags(tags: Record<string, string>): void;
  setContext(name: string, context: Record<string, unknown>): void;
  setExtra(name: string, extra: unknown): void;
  setUser(user: User | null): void;
  addBreadcrumb(breadcrumb: Breadcrumb, hint?: Hint): void;

  // Scope API
  withScope(callback: (scope: Scope) => void): void;
  getCurrentScope(): Scope;

  // Sessions API
  startSession(): void;
  endSession(): void;
  captureSession(end?: boolean): void;

  // Utility API
  flush(timeout?: number): Promise<boolean>;
  close(timeout?: number): Promise<boolean>;
  isEnabled(): boolean;
  lastEventId(): string | undefined;

  // Local Debugging Extensions
  getLocalLogs(): LogEntry[];
  exportLocalLogs(): string;
  clearLocalLogs(): void;
  getSentryEvents(): SentryEvent[];
  interceptSentry(enabled: boolean): void;
}
```

### Storage Architecture

```typescript
interface StorageProvider {
  name: string;
  isReady(): boolean;
  init(): Promise<void>;
  close(): Promise<void>;

  // Log operations
  saveLog(entry: LogEntry): Promise<void>;
  getLogs(filter: LogFilter): Promise<LogEntry[]>;
  clearLogs(filter?: LogFilter): Promise<void>;

  // Session operations
  createSession(session: LogSession): Promise<void>;
  endSession(sessionId: string): Promise<void>;
  getSessions(limit?: number): Promise<LogSession[]>;
  deleteSession(sessionId: string): Promise<void>;

  // Sentry-specific
  saveSentryEvent(event: SentryEvent): Promise<void>;
  getSentryEvents(filter?: SentryEventFilter): Promise<SentryEvent[]>;

  // Tracing operations
  saveSpan(span: Span): Promise<void>;
  saveTransaction(transaction: Transaction): Promise<void>;
  getTraces(filter?: TraceFilter): Promise<Trace[]>;
}
```

### Event Processing Pipeline

```
Sentry API Call
    ↓
Pre-processing (beforeSend, event processors)
    ↓
Local Storage (IndexedDB/Memory/Zustand)
    ↓
Sentry Forwarding (if proxy mode enabled)
    ↓
Post-processing (callbacks, hooks)
    ↓
Debug UI Update
```

---

## Sentry API Coverage Matrix

### Core APIs (100% Coverage Required)

| API Method | Status | Notes |
|------------|--------|-------|
| `init()` | Implement | Full options support |
| `getClient()` | Implement | Return client or null |
| `setCurrentClient()` | Implement | Client management |
| `lastEventId()` | Implement | Track last event |
| `flush()` | Implement | Queue flush |
| `isEnabled()` | Implement | Enable/disable flag |
| `close()` | Implement | Cleanup and disable |
| `addEventProcessor()` | Implement | Event transformation |
| `addIntegration()` | Implement | Integration system |

### Capturing Events (100% Coverage Required)

| API Method | Status | Notes |
|------------|--------|-------|
| `captureException()` | Implement | Support all capture contexts |
| `captureMessage()` | Implement | Support severity levels |
| `captureEvent()` | Implement | Full event support |

### Enriching Events (100% Coverage Required)

| API Method | Status | Notes |
|------------|--------|-------|
| `setTag()` | Implement | 32 char key limit |
| `setTags()` | Implement | Batch tag setting |
| `setContext()` | Implement | No type key restriction |
| `setExtra()` | Implement | Arbitrary data |
| `setExtras()` | Implement | Batch extra setting |
| `setUser()` | Implement | Support "{{auto}}" IP |
| `addBreadcrumb()` | Implement | All breadcrumb types |

### Tracing (100% Coverage Required)

| API Method | Status | Notes |
|------------|--------|-------|
| `startSpan()` | Implement | Async/sync callbacks |
| `startInactiveSpan()` | Implement | Manual end required |
| `startSpanManual()` | Implement | No auto-end |
| `setActiveSpanInBrowser()` | Implement | Active span control |
| `continueTrace()` | Implement | Trace continuation |
| `suppressTracing()` | Implement | Span suppression |
| `startNewTrace()` | Implement | New trace root |
| `startBrowserTracingPageLoadSpan()` | Implement | Page load spans |
| `startBrowserTracingNavigationSpan()` | Implement | Navigation spans |
| `reportPageLoaded()` | Implement | Page load signal |

### Tracing Utilities

| API Method | Status | Notes |
|------------|--------|-------|
| `spanToJSON()` | Implement | Span serialization |
| `updateSpanName()` | Implement | Name update |
| `setHttpStatus()` | Implement | HTTP status mapping |
| `getActiveSpan()` | Implement | Current span retrieval |
| `getRootSpan()` | Implement | Root span finder |
| `withActiveSpan()` | Implement | Scoped active span |

### Sessions (100% Coverage Required)

| API Method | Status | Notes |
|------------|--------|-------|
| `startSession()` | Implement | Session lifecycle |
| `endSession()` | Implement | Session termination |
| `captureSession()` | Implement | Session reporting |

### Scopes (100% Coverage Required)

| API Method | Status | Notes |
|------------|--------|-------|
| `withScope()` | Implement | Scope forking |
| `withIsolationScope()` | Implement | Isolation scope |
| `getCurrentScope()` | Implement | Current scope access |
| `getIsolationScope()` | Implement | Isolation scope access |
| `getGlobalScope()` | Implement | Global scope access |

### User Feedback

| API Method | Status | Notes |
|------------|--------|-------|
| `captureFeedback()` | Implement | Feedback capture |
| `getFeedback()` | Implement | Integration access |
| `sendFeedback()` | Implement | Async feedback |

---

## Sentry Configuration Options Coverage

### Core Options (100% Coverage Required)

| Option | Type | Default | Implementation |
|--------|------|---------|-----------------|
| `dsn` | string | - | DSN parsing and storage |
| `debug` | boolean | false | Debug mode flag |
| `release` | string | - | Release tracking |
| `environment` | string | "production" | Environment label |
| `tunnel` | string | - | Custom transport endpoint |
| `sendDefaultPii` | boolean | false | Auto-IP collection |
| `maxBreadcrumbs` | number | 100 | Breadcrumb limit |
| `attachStacktrace` | boolean | false | Stack on messages |
| `initialScope` | CaptureContext | - | Initial scope data |
| `maxValueLength` | number | - | String truncation |
| `normalizeDepth` | number | 3 | Object normalization |
| `normalizeMaxBreadth` | number | 1000 | Array/obj limit |
| `enabled` | boolean | true | SDK enable/disable |
| `sendClientReports` | boolean | true | Client reports |
| `integrations` | Integration[] | [] | Integration list |
| `defaultIntegrations` | boolean\|undefined | true | Default integrations |
| `beforeBreadcrumb` | function | - | Breadcrumb filter |
| `transport` | function | - | Custom transport |
| `transportOptions` | object | - | Transport config |

### Error Monitoring Options (100% Coverage Required)

| Option | Type | Default | Implementation |
|--------|------|---------|-----------------|
| `sampleRate` | number | 1.0 | Error sampling |
| `beforeSend` | function | - | Event modification |
| `enhanceFetchErrorMessages` | 'always'\|'report-only'\|false | 'always' | Fetch enhancement |
| `ignoreErrors` | string[]\|RegExp[] | [] | Error filtering |
| `denyUrls` | string[]\|RegExp[] | [] | URL denylist |
| `allowUrls` | string[]\|RegExp[] | [] | URL allowlist |

### Tracing Options (100% Coverage Required)

| Option | Type | Default | Implementation |
|--------|------|---------|-----------------|
| `tracesSampleRate` | number | - | Transaction sampling |
| `tracesSampler` | function | - | Dynamic sampling |
| `tracePropagationTargets` | string[]\|RegExp[] | - | Trace headers |
| `beforeSendTransaction` | function | - | Transaction modification |
| `beforeSendSpan` | function | - | Span modification |
| `ignoreTransactions` | string[]\|RegExp[] | [] | Transaction filtering |
| `ignoreSpans` | array | [] | Span filtering |
| `propagateTraceparent` | boolean | false | W3C header |

### Logs Options

| Option | Type | Default | Implementation |
|--------|------|---------|-----------------|
| `enableLogs` | boolean | false | Log capture |
| `beforeSendLog` | function | - | Log modification |

### Session Replay Options

| Option | Type | Default | Implementation |
|--------|------|---------|-----------------|
| `replaysSessionSampleRate` | number | - | Session replay |
| `replaysOnErrorSampleRate` | number | - | Error replay |

### Profiling Options

| Option | Type | Default | Implementation |
|--------|------|---------|-----------------|
| `profileSessionSampleRate` | number | - | Profile sampling |
| `profileLifecycle` | 'trace'\|'manual' | 'manual' | Profile control |

---

## Implementation Tasks

### Phase 1: Core Infrastructure (Priority: HIGH)

#### 1.1 Type Definitions
- [ ] Define Sentry-compatible interfaces in `/types/sentry.ts`
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
- [ ] Create local logger types
  - [ ] `LogEntry` - Extended with Sentry fields
  - [ ] `LogSession` - Session tracking
  - [ ] `StorageProvider` - Provider interface
  - [ ] `LogFilter`, `SentryEventFilter`, `TraceFilter` - Filter types

#### 1.2 Core Logger Class
- [ ] Implement `UniversalLogger` class
  - [ ] Singleton pattern with instance management
  - [ ] Client initialization and lifecycle
  - [ ] Scope management (current, isolation, global)
  - [ ] Event queue and flush mechanism
  - [ ] Enable/disable state management
- [ ] Implement storage provider system
  - [ ] Base `StorageProvider` interface
  - [ ] `IndexedDBStorageProvider` - Sentry event support
  - [ ] `MemoryStorageProvider` - Sentry event support
  - [ ] `ZustandStorageProvider` - Sentry event support

#### 1.3 Event Processing Pipeline
- [ ] Build event pre-processing
  - [ ] `beforeSend` hook execution
  - [ ] Event processor chain
  - [ ] Sampling application
  - [ ] Filtering (ignoreErrors, denyUrls, allowUrls)
- [ ] Implement local event storage
  - [ ] Event serialization to LogEntry
  - [ ] Sentry event metadata preservation
  - [ ] Event ID tracking
- [ ] Build Sentry forwarding
  - [ ] DSN parsing and validation
  - [ ] Envelope construction
  - [ ] HTTP transport with retry
  - [ ] Tunnel endpoint support

### Phase 2: Event Capture API (Priority: HIGH)

#### 2.1 Error Capture
- [ ] `captureException()` implementation
  - [ ] Error object handling
  - [ ] Stack trace extraction and parsing
  - [ ] Capture context application
  - [ ] Fingerprint generation
  - [ ] User/context/attachment merging
- [ ] `captureMessage()` implementation
  - [ ] Severity level support
  - [ ] Attach stack trace if `attachStacktrace` enabled
  - [ ] Message event construction
- [ ] `captureEvent()` implementation
  - [ ] Full event object support
  - [ ] Event validation
  - [ ] Event ID generation

#### 2.2 Enrichment API
- [ ] `setTag()` / `setTags()` implementation
  - [ ] Tag key validation (32 char, alphanumeric + .-_:`)
  - [ ] Tag value validation (200 char, no newlines)
- [ ] `setContext()` implementation
  - [ ] Context data normalization
  - [ ] Context name validation (no "type" key)
  - [ ] Depth-limited serialization
- [ ] `setExtra()` / `setExtras()` implementation
  - [ ] Arbitrary data attachment
  - [ ] Normalization and truncation
- [ ] `setUser()` implementation
  - [ ] User object handling
  - [ ] IP address auto-detection ("{{auto}}")
  - [ ] User unsetting (null parameter)

#### 2.3 Breadcrumbs
- [ ] `addBreadcrumb()` implementation
  - [ ] Breadcrumb validation (type, category, message, level, data, timestamp)
  - [ ] `beforeBreadcrumb` hook execution
  - [ ] Max breadcrumb enforcement
  - [ ] Automatic breadcrumb types
- [ ] Breadcrumb management
  - [ ] Automatic collection (clicks, navigation, fetch, console)
  - [ ] Breadcrumb storage and retrieval
  - [ ] Breadcrumb filtering

### Phase 3: Tracing System (Priority: HIGH)

#### 3.1 Span Management
- [ ] `Span` class implementation
  - [ ] Span lifecycle (start, end, status)
  - [ ] Parent-child relationships
  - [ ] Attributes and tags
  - [ ] Span JSON serialization
- [ ] `startSpan()` implementation
  - [ ] Async/sync callback support
  - [ ] Auto-end on callback return
  - [ ] Span option parsing
- [ ] `startInactiveSpan()` implementation
  - [ ] Manual span lifecycle
  - [ ] No auto-end behavior
- [ ] `startSpanManual()` implementation
  - [ ] Explicit end control
  - [ ] Scoped active span

#### 3.2 Transaction Management
- [ ] `Transaction` class implementation
  - [ ] Root span with metadata
  - [ ] Transaction sampling
  - [ ] Transaction options (name, op, parentSampled)
- [ ] Transaction lifecycle
  - [ ] Transaction start/end
  - [ ] Child span management
  - [ ] Transaction finalization
- [ ] `beforeSendTransaction` hook
  - [ ] Transaction modification
  - [ ] Transaction filtering

#### 3.3 Span Utilities
- [ ] `spanToJSON()` implementation
  - [ ] Span serialization to JSON
- [ ] `updateSpanName()` implementation
  - [ ] Dynamic name updates
- [ ] `setHttpStatus()` implementation
  - [ ] HTTP status to span status mapping
- [ ] `getActiveSpan()` implementation
  - [ ] Current span retrieval
- [ ] `getRootSpan()` implementation
  - [ ] Root span traversal
- [ ] `withActiveSpan()` implementation
  - [ ] Scoped span activation

#### 3.4 Browser Tracing
- [ ] `startBrowserTracingPageLoadSpan()` implementation
  - [ ] Page load span creation
  - [ ] Performance timing hooks
  - [ ] Auto-end on page idle
- [ ] `startBrowserTracingNavigationSpan()` implementation
  - [ ] Navigation span creation
  - [ ] Route change detection
  - [ ] Auto-end on page idle
- [ ] `reportPageLoaded()` implementation
  - [ ] Manual page load signal
  - [ ] EnableReportPageLoaded integration support

#### 3.5 Trace Propagation
- [ ] `continueTrace()` implementation
  - [ ] sentry-trace header parsing
  - [ ] baggage header parsing
  - [ ] Trace context restoration
- [ ] `suppressTracing()` implementation
  - [ ] Span suppression scope
- [ ] `startNewTrace()` implementation
  - [ ] New trace root creation

#### 3.6 W3C Trace Context
- [ ] `propagateTraceparent` option support
  - [ ] traceparent header injection
  - [ ] sentry-trace header injection
  - [ ] baggage header injection
- [ ] `tracePropagationTargets` filtering
  - [ ] Target URL matching
  - [ ] CORS header handling

### Phase 4: Scope Management (Priority: MEDIUM)

#### 4.1 Scope Implementation
- [ ] `Scope` class implementation
  - [ ] Scope data storage (user, tags, extras, contexts, breadcrumbs)
  - [ ] Scope cloning and forking
  - [ ] Scope hierarchy
- [ ] `withScope()` implementation
  - [ ] Scope forking and callback execution
  - [ ] Scope cleanup
- [ ] `withIsolationScope()` implementation
  - [ ] Isolation scope handling
- [ ] `getCurrentScope()` implementation
  - [ ] Current scope access
- [ ] `getIsolationScope()` implementation
  - [ ] Isolation scope access
- [ ] `getGlobalScope()` implementation
  - [ ] Global scope access

#### 4.2 Scope Data Management
- [ ] User data in scope
  - [ ] User object handling
  - [ ] User inheritance
  - [ ] User merging strategies
- [ ] Tags in scope
  - [ ] Tag storage and retrieval
  - [ ] Tag merging rules
  - [ ] Tag limit enforcement
- [ ] Contexts in scope
  - [ ] Context storage and retrieval
  - [ ] Context merging
  - [ ] Context normalization
- [ ] Extras in scope
  - [ ] Extra data storage
  - [ ] Extra merging
- [ ] Breadcrumbs in scope
  - [ ] Breadcrumb management
  - [ ] Breadcrumb limits
  - [ ] Breadcrumb inheritance

### Phase 5: Sessions API (Priority: MEDIUM)

#### 5.1 Session Lifecycle
- [ ] `startSession()` implementation
  - [ ] Session creation
  - [ ] Session ID generation
  - [ ] Session metadata tracking
- [ ] `endSession()` implementation
  - [ ] Session termination
  - [ ] Duration calculation
  - [ ] Error count tracking
- [ ] `captureSession()` implementation
  - [ ] Session reporting
  - [ ] Session finalization flag

#### 5.2 Session Storage
- [ ] Session persistence
  - [ ] Session save to storage
  - [ ] Session retrieval
  - [ ] Session history
- [ ] Session aggregation
  - [ ] Session rollup
  - [ ] Release health metrics

### Phase 6: Transport Layer (Priority: HIGH)

#### 6.1 Transport Implementation
- [ ] Base `Transport` interface
  - [ ] Send method signature
  - [ ] Flush method signature
  - [ ] Close method signature
- [ ] `FetchTransport` implementation
  - [ ] Fetch-based event sending
  - [ ] Keep-alive support
  - [ ] Request timeout handling
  - [ ] Retry logic
- [ ] `XHRTransport` implementation (fallback)
  - [ ] XHR-based event sending
  - [ ] Fallback for older browsers

#### 6.2 Event Queue
- [ ] Event queue implementation
  - [ ] Queue data structure
  - [ ] Queue priority (errors > transactions > breadcrumbs)
  - [ ] Queue batching
- [ ] Queue flush mechanism
  - [ ] Periodic flush
  - [ ] Page visibility flush
  - [ ] Before unload flush
- [ ] Offline support
  - [ ] IndexedDB queue persistence
  - [ ] Retry on reconnection

#### 6.3 Tunnel Support
- [ ] Tunnel endpoint implementation
  - [ ] URL-based tunneling
  - [ ] Custom transport creation
  - [ ] Tunnel request handling

### Phase 7: Integrations (Priority: MEDIUM)

#### 7.1 Integration System
- [ ] Integration base class
  - [ ] Integration name
  - [ ] Integration setup
  - [ ] Integration teardown
- [ ] Integration registry
  - [ ] Integration registration
  - [ ] Integration lookup
  - [ ] Integration lifecycle

#### 7.2 Default Integrations
- [ ] Browser integration
  - [ ] Global error handlers
  - [ ] Unhandled rejection handlers
  - [ ] Console API instrumentation
  - [ ] DOM event listeners
- [ ] HTTP integration
  - [ ] Fetch instrumentation
  - [ ] XHR instrumentation
  - [ ] Request headers injection
  - [ ] Response status capture
- [ ] Breadcrumbs integration
  - [ ] Click breadcrumbs
  - [ ] Navigation breadcrumbs
  - [ ] XHR/fetch breadcrumbs
  - [ ] Console breadcrumbs
- [ ] TryCatch integration
  - [ ] Try/catch wrapping

#### 7.3 Custom Integrations
- [ ] `addIntegration()` implementation
  - [ ] Integration registration
  - [ ] Integration setup
- [ ] Integration hooks
  - [ ] `setupOnce()` - Run once
  - [ ] `setup()` - Run on client init
  - [ ] `processEvent()` - Event processing

### Phase 8: Configuration & Options (Priority: HIGH)

#### 8.1 Option Parsing
- [ ] `init()` options handling
  - [ ] DSN parsing and validation
  - [ ] Option defaults
  - [ ] Option validation
- [ ] Environment detection
  - [ ] Production vs development
  - [ ] Environment label

#### 8.2 Error Monitoring Options
- [ ] `sampleRate` implementation
  - [ ] Random sampling
  - [ ] Sample decision caching
- [ ] `beforeSend()` implementation
  - [ ] Event modification
  - [ ] Event filtering (null return)
- [ ] `enhanceFetchErrorMessages()` implementation
  - [ ] 'always' mode - Modify error message
  - [ ] 'report-only' mode - Sentry-only enhancement
  - [ ] false mode - Disabled
- [ ] `ignoreErrors()` implementation
  - [ ] String matching (contains)
  - [ ] Regex matching
  - [ ] Pattern array iteration
- [ ] `denyUrls()` implementation
  - [ ] Stack frame URL checking
  - [ ] String contains matching
  - [ ] Regex matching
- [ ] `allowUrls()` implementation
  - [ ] Stack frame URL checking
  - [ ] String contains matching
  - [ ] Regex matching

#### 8.3 Tracing Options
- [ ] `tracesSampleRate()` implementation
  - [ ] Fixed rate sampling
  - [ ] Per-transaction sampling
- [ ] `tracesSampler()` implementation
  - [ ] Dynamic sampling function
  - [ ] Sampling context (parentSampled, name, attributes)
- [ ] `tracePropagationTargets()` implementation
  - [ ] Target URL matching
  - [ ] Header injection control
- [ ] `beforeSendTransaction()` implementation
  - [ ] Transaction modification
  - [ ] Transaction filtering
- [ ] `beforeSendSpan()` implementation
  - [ ] Span modification
  - [ ] Span filtering
- [ ] `ignoreTransactions()` implementation
  - [ ] Transaction name filtering
  - [ ] String/regex matching
- [ ] `ignoreSpans()` implementation
  - [ ] Span name matching
  - [ ] Span op matching
  - [ ] Object pattern matching
- [ ] `propagateTraceparent()` implementation
  - [ ] W3C header injection

#### 8.4 Breadcrumb Options
- [ ] `maxBreadcrumbs()` implementation
  - [ ] Breadcrumb limit enforcement
  - [ ] FIFO eviction
- [ ] `beforeBreadcrumb()` implementation
  - [ ] Breadcrumb modification
  - [ ] Breadcrumb filtering (null return)

#### 8.5 Core Options
- [ ] `debug()` implementation
  - [ ] Debug logging to console
  - [ ] Internal state logging
- [ ] `release()` implementation
  - [ ] Release storage
  - [ ] Release propagation to events
- [ ] `environment()` implementation
  - [ ] Environment storage
  - [ ] Environment propagation to events
- [ ] `sendDefaultPii()` implementation
  - [ ] Auto-IP address collection
  - [ ] PII policy enforcement
- [ ] `attachStacktrace()` implementation
  - [ ] Stack trace generation for messages
- [ ] `initialScope()` implementation
  - [ ] Object-based initial scope
  - [ ] Function-based initial scope
- [ ] `maxValueLength()` implementation
  - [ ] String truncation
- [ ] `normalizeDepth()` implementation
  - [ ] Object depth normalization
- [ ] `normalizeMaxBreadth()` implementation
  - [ ] Array/object property limit
- [ ] `enabled()` implementation
  - [ ] SDK enable/disable toggle

### Phase 9: Sentry Proxy Mode (Priority: HIGH)

#### 9.1 Sentry Interception
- [ ] Sentry SDK wrapping
  - [ ] Proxy Sentry object
  - [ ] Method interception
  - [ ] Event capture before Sentry
- [ ] Dual mode operation
  - [ ] Local-only mode
  - [ ] Proxy mode (forward to Sentry)
  - [ ] Dual mode (local + Sentry)

#### 9.2 Event Forwarding
- [ ] DSN validation
  - [ ] DSN format checking
  - [ ] Public key extraction
  - [ ] Project ID extraction
- [ ] Envelope construction
  - [ ] Event envelope format
  - [ ] Attachment encoding
  - [ ] Compression
- [ ] Sentry API communication
  - [ ] Store endpoint
  - [ ] Authentication headers
  - [ ] Rate limit handling

#### 9.3 Debugging Interface
- [ ] Local event viewer
  - [ ] Real-time event stream
  - [ ] Event filtering
  - [ ] Event inspection
- [ ] Sentry response viewer
  - [ ] Response status codes
  - [ ] Response bodies
  - [ ] Error messages
- [ ] Diff viewer
  - [ ] Local vs Sentry event comparison
  - [ ] Missing field detection

### Phase 10: Enhanced Debug UI (Priority: MEDIUM)

#### 10.1 Debug Panel Extensions
- [ ] Sentry event tab
  - [ ] Event list view
  - [ ] Event detail view
  - [ ] Raw JSON viewer
- [ ] Tracing tab
  - [ ] Transaction tree view
  - [ ] Span timeline
  - [ ] Performance metrics
- [ ] Breadcrumbs tab
  - [ ] Breadcrumb timeline
  - [ ] Breadcrumb filtering
  - [ ] Breadcrumb details

#### 10.2 Export & Analysis
- [ ] Event export
  - [ ] JSON export
  - [ ] CSV export
  - [ ] Sentry format export
- [ ] Analysis tools
  - [ ] Event frequency analysis
  - [ ] Error grouping visualization
  - [ ] User impact analysis
- [ ] Playback tools
  - [ ] Event replay
  - [ ] Timeline scrubber
  - [ ] Event sequence viewer

### Phase 11: Testing (Priority: HIGH)

#### 11.1 Unit Tests
- [ ] Core logger tests
  - [ ] Initialization tests
  - [ ] Event capture tests
  - [ ] Enrichment API tests
- [ ] Scope tests
  - [ ] Scope forking tests
  - [ ] Scope data management tests
  - [ ] Scope inheritance tests
- [ ] Tracing tests
  - [ ] Span lifecycle tests
  - [ ] Transaction tests
  - [ ] Trace propagation tests
- [ ] Storage tests
  - [ ] IndexedDB tests
  - [ ] Memory tests
  - [ ] Zustand tests

#### 11.2 Integration Tests
- [ ] Sentry proxy tests
  - [ ] Event forwarding tests
  - [ ] DSN tests
  - [ ] Response handling tests
- [ ] Browser integration tests
  - [ ] Error handler tests
  - [ ] Console instrumentation tests
  - [ ] DOM event tests
- [ ] Transport tests
  - [ ] Fetch transport tests
  - [ ] XHR transport tests
  - [ ] Retry logic tests

#### 11.3 Compatibility Tests
- [ ] Sentry API parity tests
  - [ ] Method signature tests
  - [ ] Event format tests
  - [ ] Response format tests
- [ ] Option compatibility tests
  - [ ] All options tested
  - [ ] Option interaction tests
  - [ ] Default value tests

### Phase 12: Documentation (Priority: MEDIUM)

#### 12.1 API Documentation
- [ ] Type definitions documentation
  - [ ] Interface documentation
  - [ ] Type parameter documentation
  - [ ] Example usage
- [ ] API reference
  - [ ] Method documentation
  - [ ] Parameter documentation
  - [ ] Return value documentation
  - [ ] Example usage

#### 12.2 Usage Guides
- [ ] Setup guide
  - [ ] Installation
  - [ ] Initialization
  - [ ] Configuration
- [ ] Sentry proxy guide
  - [ ] Proxy mode setup
  - [ ] Event interception
  - [ ] Debugging workflow
- [ ] Standalone mode guide
  - [ ] Sentry replacement
  - [ ] Local logging
  - [ ] Feature comparison

#### 12.3 Migration Guide
- [ ] From Sentry SDK
  - [ ] API mapping
  - [ ] Option mapping
  - [ ] Code changes
- [ ] From current logger
  - [ ] API changes
  - [ ] Data migration
  - [ ] UI updates

---

## Non-Functional Requirements

### Performance
- Event capture latency < 5ms
- Storage write latency < 10ms
- UI update latency < 50ms
- Zero impact on main thread (async operations)

### Reliability
- No data loss in offline mode
- Retry logic for failed sends
- Graceful degradation when storage fails
- Error boundary around all operations

### Compatibility
- Support for all modern browsers (Chrome, Firefox, Safari, Edge)
- Support for IE11+ (with polyfills)
- Support for Node.js environment
- Support for React, Vue, Angular, Svelte

### Security
- No PII in local logs by default
- Secure storage of sensitive data
- DSN validation
- Request/response sanitization

---

## Success Criteria

1. **API Compatibility**: 100% of public Sentry SDK methods implemented and tested
2. **Option Coverage**: All documented Sentry options supported
3. **Drop-in Replacement**: Replace Sentry SDK without code changes
4. **Debugging**: All Sentry events visible in local debug UI
5. **Performance**: No measurable impact on application performance
6. **Testing**: 90%+ code coverage, all API methods tested

---

## Timeline Estimate

- **Phase 1**: Core Infrastructure - 2 weeks
- **Phase 2**: Event Capture API - 1 week
- **Phase 3**: Tracing System - 2 weeks
- **Phase 4**: Scope Management - 1 week
- **Phase 5**: Sessions API - 3 days
- **Phase 6**: Transport Layer - 1 week
- **Phase 7**: Integrations - 1 week
- **Phase 8**: Configuration - 3 days
- **Phase 9**: Sentry Proxy - 1 week
- **Phase 10**: Debug UI - 1 week
- **Phase 11**: Testing - 2 weeks
- **Phase 12**: Documentation - 1 week

**Total**: ~12 weeks

---

## Open Questions

1. Should we support Sentry's proprietary envelope format, or standard JSON?
2. Do we need to support all default integrations or just the core ones?
3. Should we implement session replay or just log events?
4. What level of offline support is required ( IndexedDB queue vs memory queue)?
5. Do we need to support server-side rendering (SSR) scenarios?
