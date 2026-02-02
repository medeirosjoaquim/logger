# Universal Logger - Complete Feature Demo

A comprehensive demo showcasing all features of the Universal Sentry-Compatible Logger.

## Features Demonstrated

### Core Features (Sentry-Compatible)
- **Error Tracking** - Capture exceptions with full stack traces
- **Breadcrumbs** - Automatic and manual breadcrumb tracking
- **Scope Management** - Tags, user info, contexts, and extras
- **Event Processing** - beforeSend hooks and sampling

### New Features
- **Metrics API** - Counters, gauges, distributions, timing, unique sets
- **Structured Logs** - Six log levels with searchable attributes
- **Feature Flags** - Track flag evaluations for debugging
- **User Feedback** - Embeddable widget and modal dialog
- **Attachments** - Attach files to error events
- **Distributed Tracing** - Spans with context propagation
- **AI Monitoring** - Instrument AI client calls (OpenAI, Anthropic)

## Running the Demo

```bash
# From the examples/simple directory
npm install
npm run dev

# Or from the root directory
npm run example:simple
```

Opens at http://localhost:3000

## Demo Sections

### Todo List
A simple todo app demonstrating:
- Breadcrumb tracking for user actions
- Metrics for todo counts (gauge, counter)
- Structured logs for state changes
- Span tracing for operations

### Metrics API
```javascript
metrics.increment('page.views');           // Counter
metrics.gauge('memory.used', 512);         // Current value
metrics.distribution('response.time', 150); // Histogram
metrics.timing('api.call', duration);       // Duration
metrics.set('unique.users', 'user123');    // Unique tracking
```

### Structured Logs
```javascript
logger.trace('Detailed debug info');
logger.debug('Debugging information');
logger.info('User action', { userId: '123' });
logger.warn('Warning condition');
logger.error('Error occurred', { code: 500 });
logger.fatal('Critical failure');
```

### Feature Flags
```javascript
addFeatureFlagEvaluation('dark-mode', true);
addFeatureFlagEvaluation('beta-features', false);
const flags = getFeatureFlags(); // { 'dark-mode': true, ... }
```

### Attachments
```javascript
addAttachment({
  filename: 'debug.txt',
  data: 'Debug info here',
  contentType: 'text/plain',
});

addAttachment({
  filename: 'state.json',
  data: JSON.stringify(appState),
  contentType: 'application/json',
});
```

### Distributed Tracing
```javascript
// Automatic span management
startSpan({ name: 'api-call', op: 'http' }, async () => {
  await fetch('/api/data');
});

// Nested spans
startSpan({ name: 'parent' }, () => {
  startSpan({ name: 'child' }, () => {
    // Child operation
  });
});

// Manual control
const span = startInactiveSpan({ name: 'manual' });
span.setAttribute('key', 'value');
span.end();
```

### User Feedback
```javascript
// Open feedback dialog
showReportDialog({
  title: 'Report an Issue',
  enableScreenshot: true,
  onSubmit: (feedback) => console.log(feedback),
});

// Create floating widget
createFeedbackWidgetButton({
  position: 'bottom-right',
  triggerLabel: 'Feedback',
});
```

### Error Testing
Test various error scenarios:
- Generic errors
- TypeErrors
- Undefined access
- HTTP 500/404 errors
- Request timeouts

## Event Log Panel

Click the "Log" button in the bottom-right corner to view:
- All captured events in real-time
- Error count badge
- Stack traces for exceptions
- Event IDs for correlation

## Complete Integration Example

```javascript
import * as Sentry from '@universal-logger/core';
import {
  metrics,
  logger,
  addFeatureFlagEvaluation,
  addAttachment,
  startSpan,
  showReportDialog,
  featureFlagsIntegration,
} from '@universal-logger/core';

// Initialize with all features
Sentry.init({
  debug: true,
  environment: 'development',
  release: '1.0.0',
  maxBreadcrumbs: 50,
  attachStacktrace: true,
  initialScope: {
    tags: { app: 'my-app' },
    user: { id: '123', email: 'user@example.com' },
  },
  integrations: [
    featureFlagsIntegration({ maxEvaluations: 100 }),
  ],
});

// Set context
Sentry.setTag('component', 'checkout');
Sentry.setContext('cart', { items: 3, total: 99.99 });

// Track feature flags
addFeatureFlagEvaluation('new-checkout', true);

// Log with structure
logger.info('Checkout started', { cartId: 'abc123' });

// Track metrics
metrics.increment('checkout.started');

// Wrap operations in spans
await startSpan({ name: 'process-checkout', op: 'task' }, async () => {
  // Attach debug info
  addAttachment({
    filename: 'cart.json',
    data: JSON.stringify(cart),
  });

  try {
    await processPayment();
    metrics.increment('checkout.success');
  } catch (error) {
    metrics.increment('checkout.failed');
    Sentry.captureException(error);

    // Show feedback dialog
    showReportDialog({
      eventId: Sentry.lastEventId(),
      title: 'Checkout Failed',
    });
  }
});
```

## Files

```
examples/simple/
├── index.html      # Main HTML with feature demo UI
├── app.js          # Application logic demonstrating all features
├── package.json    # Dependencies
├── vite.config.js  # Vite dev server configuration
└── README.md       # This file
```
