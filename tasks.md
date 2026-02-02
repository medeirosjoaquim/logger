# Tasks: Universal Sentry-Compatible Logger

Generated from PRD.md - 20 implementation tasks

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
- [ ] `setTag(key, value)` - Tag key validation (32 char, alphanumeric + .-_:)
- [ ] `setTags(tags)` - Batch tag setting
- [ ] `setContext(name, context)` - Context data normalization, no "type" key
- [ ] `setExtra(name, extra)` - Arbitrary data attachment
- [ ] `setExtras(extras)` - Batch extra setting
- [ ] `setUser(user)` - User object with IP auto ("{{auto}}")

### Validation Rules
- Tag keys: max 32 characters, alphanumeric + .-_:
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

### Acceptance Criteria
- Sessions track duration correctly
- Error counts accumulated
- Sessions persist across page loads

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

**Total Tasks**: 20
**HIGH Priority**: 12
**MEDIUM Priority**: 8
