# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.1.0] - 2024

### Added

- **Sentry SDK API Compatibility**: Full drop-in replacement for `@sentry/browser`
  - `init`, `captureException`, `captureMessage`, `captureEvent`
  - `setTag`, `setTags`, `setContext`, `setExtra`, `setExtras`, `setUser`
  - `addBreadcrumb`, `withScope`, `withIsolationScope`
  - `getCurrentScope`, `getIsolationScope`, `getGlobalScope`

- **Distributed Tracing**: Complete tracing API implementation
  - `startSpan`, `startInactiveSpan`, `startSpanManual`
  - `getActiveSpan`, `generateTraceId`, `generateSpanId`
  - W3C trace context propagation
  - Configurable sampling (traces and profiles)

- **Storage Providers**: Pluggable local storage backends
  - `MemoryStorageProvider`: In-memory storage for development
  - `IndexedDBStorageProvider`: Persistent browser storage
  - `ZustandStorageProvider`: React state integration

- **React Debug UI**: Built-in visual inspection panel
  - Events, traces, breadcrumbs, sessions tabs
  - Real-time log streaming
  - Search and filter capabilities
  - Import via `@universal-logger/core/react`

- **Integrations Framework**: Extensible integration system
  - `browserIntegration`: DOM event capture
  - `httpIntegration`: Fetch/XHR interception
  - `breadcrumbsIntegration`: Automatic breadcrumb collection
  - `tryCatchIntegration`: Error boundary instrumentation

- **Session Management**: User session tracking
  - `startSession`, `endSession`, `captureSession`
  - Session replay support

- **Transport Layer**: Reliable event delivery
  - Fetch and XHR transports
  - Offline queue with retry
  - Rate limiting
  - Sentry envelope format support

- **Feedback API**: User feedback collection
  - `captureFeedback`, `sendFeedback`
  - `createFeedbackWidget` for UI integration

- **Multiple Operational Modes**:
  - Standalone: Local-only storage
  - Proxy/Hybrid: Forward to Sentry while keeping local copies
  - Debug interceptor: Capture without modifying application code
