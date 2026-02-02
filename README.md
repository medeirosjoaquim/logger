# Universal Logger

> A Sentry-compatible logging and error tracking SDK with local debugging capabilities

[![npm version](https://img.shields.io/npm/v/@universal-logger/core.svg)](https://www.npmjs.com/package/@universal-logger/core)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

**Universal Logger** is a drop-in replacement for the Sentry SDK that provides full API compatibility while adding powerful local debugging features. Use it as your primary logger or as a Sentry interceptor for development.

## ✨ Features

- 🎯 **100% Sentry API Compatible** - Drop-in replacement for `@sentry/browser`
- 🔍 **Local Debugging UI** - Built-in React panel for inspecting events, traces, and logs
- 📊 **Distributed Tracing** - Full OpenTelemetry-compatible tracing with W3C propagation
- 📝 **Structured Logging** - Six log levels with searchable attributes
- 📈 **Metrics API** - Counters, gauges, distributions, and timing
- 🎨 **Feature Flags** - Track flag evaluations for debugging
- 💾 **Pluggable Storage** - Memory, IndexedDB, or Zustand integration
- 🤖 **AI Monitoring** - Built-in instrumentation for OpenAI and Anthropic
- 🔌 **Zero Dependencies** - No required runtime dependencies
- 📦 **TypeScript First** - Full type definitions included

## 📦 Installation

```bash
npm install @universal-logger/core
```

For React UI components:
```bash
npm install @universal-logger/core react react-dom zustand
```

## 🚀 Quick Start

### Basic Usage

```typescript
import * as Sentry from '@universal-logger/core';

// Initialize (Sentry-compatible API)
Sentry.init({
  dsn: 'https://your-dsn@sentry.io/project-id',
  environment: 'production',
  tracesSampleRate: 1.0,
});

// Capture errors
try {
  riskyOperation();
} catch (error) {
  Sentry.captureException(error, {
    tags: { component: 'checkout' },
    extra: { orderId: '12345' },
  });
}

// Capture messages
Sentry.captureMessage('Payment processed', 'info');

// Add breadcrumbs
Sentry.addBreadcrumb({
  category: 'ui.click',
  message: 'User clicked checkout button',
  level: 'info',
});

// Set user context
Sentry.setUser({
  id: '123',
  email: 'user@example.com',
  username: 'john_doe',
});
```

### Development Mode with Debug UI

```typescript
import { init } from '@universal-logger/core';
import { DebugPanel } from '@universal-logger/core/react';

// Initialize with local storage
init({
  enabled: true,
  storage: 'indexeddb', // or 'memory', 'zustand'
  debug: true,
});

// Add debug panel to your app
function App() {
  return (
    <>
      <YourApp />
      <DebugPanel position="bottom-right" />
    </>
  );
}
```

### Distributed Tracing

```typescript
import { startSpan } from '@universal-logger/core';

// Automatic span management
await startSpan({ name: 'api-call', op: 'http' }, async () => {
  const response = await fetch('/api/data');
  return response.json();
});

// Nested spans
startSpan({ name: 'checkout-flow' }, () => {
  startSpan({ name: 'validate-cart' }, () => {
    validateCart();
  });
  
  startSpan({ name: 'process-payment' }, () => {
    processPayment();
  });
});
```

### Structured Logging

```typescript
import { getLogger } from '@universal-logger/core';

const logger = getLogger();

logger.info('User logged in', { 
  userId: '123',
  method: 'oauth',
  provider: 'google' 
});

logger.error('Payment failed', {
  orderId: '456',
  amount: 99.99,
  errorCode: 'INSUFFICIENT_FUNDS',
});

logger.debug('Cache hit', { key: 'user:123', ttl: 3600 });
```

### Metrics

```typescript
import { getMetrics } from '@universal-logger/core';

const metrics = getMetrics();

// Counters
metrics.increment('page.views');
metrics.increment('api.errors', 1, { endpoint: '/checkout' });

// Gauges
metrics.gauge('memory.used', 512);
metrics.gauge('queue.size', 42);

// Distributions
metrics.distribution('response.time', 150);
metrics.timing('api.call', duration);

// Unique values
metrics.set('unique.users', userId);
```

### AI Monitoring

```typescript
import { wrapOpenAI } from '@universal-logger/core';
import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const instrumentedClient = wrapOpenAI(client);

// Automatically traced and monitored
const completion = await instrumentedClient.chat.completions.create({
  model: 'gpt-4',
  messages: [{ role: 'user', content: 'Hello!' }],
});
```

## 📚 API Reference

### Core Methods

All Sentry SDK methods are supported:

#### Initialization
- `init(options)` - Initialize the SDK
- `close(timeout?)` - Shutdown and flush events
- `flush(timeout?)` - Flush pending events

#### Capturing Events
- `captureException(exception, captureContext?)` - Capture errors
- `captureMessage(message, level?)` - Capture messages
- `captureEvent(event, hint?)` - Capture custom events

#### Context Management
- `setUser(user)` - Set user information
- `setTag(key, value)` - Set a tag
- `setTags(tags)` - Set multiple tags
- `setExtra(key, value)` - Set extra data
- `setExtras(extras)` - Set multiple extras
- `setContext(name, context)` - Set custom context
- `addBreadcrumb(breadcrumb)` - Add breadcrumb

#### Scopes
- `withScope(callback)` - Execute with isolated scope
- `withIsolationScope(callback)` - Execute with isolation scope
- `getCurrentScope()` - Get current scope
- `getIsolationScope()` - Get isolation scope
- `getGlobalScope()` - Get global scope

#### Tracing
- `startSpan(options, callback)` - Start traced span
- `startInactiveSpan(options)` - Start manual span
- `startSpanManual(options, callback)` - Manual span control
- `getActiveSpan()` - Get current active span
- `continueTrace(options, callback)` - Continue distributed trace

#### Sessions
- `startSession()` - Start user session
- `endSession()` - End current session
- `captureSession(end?)` - Send session to Sentry

### Extended Features

#### Structured Logging
```typescript
const logger = getLogger();
logger.trace(message, attributes?)
logger.debug(message, attributes?)
logger.info(message, attributes?)
logger.warn(message, attributes?)
logger.error(message, attributes?)
logger.fatal(message, attributes?)
```

#### Metrics
```typescript
const metrics = getMetrics();
metrics.increment(name, value?, tags?)
metrics.gauge(name, value, tags?)
metrics.distribution(name, value, tags?)
metrics.timing(name, duration, tags?)
metrics.set(name, value, tags?)
```

#### Feature Flags
```typescript
addFeatureFlagEvaluation(key, value, variant?)
getFeatureFlags()
getFeatureFlagEvaluations()
```

## 🎨 React Components

```typescript
import { DebugPanel } from '@universal-logger/core/react';

<DebugPanel 
  position="bottom-right"  // or "bottom-left", "top-right", "top-left"
  defaultOpen={false}
  theme="dark"             // or "light"
/>
```

The debug panel includes:
- **Events Tab** - View captured exceptions and messages
- **Traces Tab** - Visualize distributed traces with waterfall view
- **Breadcrumbs Tab** - Browse breadcrumb trail
- **Sessions Tab** - Monitor user sessions
- **Logs Tab** - Search structured logs

## 🔧 Configuration

### Initialization Options

```typescript
init({
  // Sentry-compatible options
  dsn: 'https://key@sentry.io/project',
  environment: 'production',
  release: '1.0.0',
  sampleRate: 1.0,
  tracesSampleRate: 0.1,
  
  // Universal Logger options
  enabled: true,
  debug: false,
  storage: 'indexeddb', // 'memory', 'indexeddb', 'zustand'
  
  // Filtering
  ignoreErrors: [/network error/i],
  denyUrls: [/localhost/],
  allowUrls: [/myapp\.com/],
  
  // Hooks
  beforeSend: (event, hint) => {
    // Modify or drop events
    return event;
  },
  
  // Integrations
  integrations: [
    browserIntegration(),
    httpIntegration(),
    breadcrumbsIntegration(),
  ],
});
```

## 🆚 Comparison with Sentry SDK

| Feature | Sentry SDK | Universal Logger |
|---------|-----------|------------------|
| Error Tracking | ✅ | ✅ |
| Distributed Tracing | ✅ | ✅ |
| Breadcrumbs | ✅ | ✅ |
| User Context | ✅ | ✅ |
| Local Debugging UI | ❌ | ✅ |
| Structured Logging | ❌ | ✅ |
| Metrics API | ❌ | ✅ |
| Feature Flag Tracking | ❌ | ✅ |
| AI Monitoring | ❌ | ✅ |
| Zero Dependencies | ❌ | ✅ |
| Local Storage | ❌ | ✅ |

## 🔌 Storage Providers

### Memory Storage (Default)
```typescript
init({ storage: 'memory' });
```
- Fast, in-memory storage
- Data lost on page reload
- Best for: Testing, development

### IndexedDB Storage
```typescript
init({ storage: 'indexeddb' });
```
- Persistent browser storage
- Survives page reloads
- Best for: Production debugging, long sessions

### Zustand Storage
```typescript
init({ storage: 'zustand' });
```
- React state integration
- Reactive updates
- Best for: React apps with state management

## 🤝 Migration from Sentry

Universal Logger is a drop-in replacement. Simply change your import:

```diff
- import * as Sentry from '@sentry/browser';
+ import * as Sentry from '@universal-logger/core';
```

All your existing Sentry code will work without changes!

## 📖 Examples

See the [examples](./examples) directory for complete demos:
- [Simple Todo App](./examples/simple) - Full feature demonstration
- AI monitoring examples
- Distributed tracing examples
- React integration examples

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Run example
npm run example:simple
```

## 📄 License

MIT © johnbox codes

## 🤝 Contributing

Contributions are welcome! Please read our contributing guidelines and submit pull requests.

## 🐛 Issues

Found a bug? Please [open an issue](https://github.com/asari/logger/issues).

## 📮 Support

- Documentation: [GitHub Wiki](https://github.com/asari/logger/wiki)
- Issues: [GitHub Issues](https://github.com/asari/logger/issues)
- Discussions: [GitHub Discussions](https://github.com/asari/logger/discussions)

---

**Made with ❤️ for developers who need better debugging tools**
