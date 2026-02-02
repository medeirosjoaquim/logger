# Demo Guide: Universal Sentry Logger in Action

This guide walks you through using the Universal Sentry Logger demo app.

## Quick Start

```bash
# From examples/simple directory
npm install
npm run dev
```

Your browser will open to `http://localhost:3000` automatically.

## What You'll See

### 1. Todo List App
A simple todo list application that demonstrates real-world usage of the logger.

**Try this:**
- Add a few todos
- Mark some as complete
- Delete a todo
- Watch the Sentry Event Log below update in real-time!

### 2. Error Testing Buttons
Six buttons that trigger different error scenarios:

#### **Throw Error**
- **What it does:** Throws a basic JavaScript Error
- **Watch for:** Error captured with stack trace in the log viewer
- **Use case:** General error handling

#### **Throw TypeError**
- **What it does:** Attempts to call a method on `null`
- **Watch for:** TypeError with specific error message
- **Use case:** Type-related errors

#### **Undefined Error**
- **What it does:** Tries to access a property on `undefined`
- **Watch for:** Error showing property access chain
- **Use case:** Null/undefined access errors

#### **Bad HTTP Request (500)**
- **What it does:** Makes an HTTP request that returns 500 status
- **Watch for:** HTTP error with status code in tags
- **Use case:** Server error handling

#### **404 Request**
- **What it does:** Makes an HTTP request to a non-existent resource
- **Watch for:** 404 error with appropriate message
- **Use case:** Resource not found errors

#### **Timeout Request**
- **What it does:** Makes a request that times out after 1 second
- **Watch for:** Abort error from timeout
- **Use case:** Network timeout handling

### 3. Sentry Event Log

The black panel at the bottom shows all captured events in real-time:

- **Color coding:** Errors (red), warnings (orange), info (blue), debug (gray)
- **Metadata:** Timestamp, event type, event ID
- **Details:** Stack traces, tags, and additional context
- **Actions:** Refresh and clear buttons

## Code Walkthrough

### Initialization (app.js)

```javascript
import * as Sentry from '@universal-logger/core';

Sentry.init({
  debug: true,
  environment: 'development',
  release: '1.0.0',
  maxBreadcrumbs: 50,
  attachStacktrace: true,
  initialScope: {
    tags: { app: 'todo-demo' },
    user: { username: 'demo-user', email: 'demo@example.com' },
  },
});
```

**Key points:**
- Import as `Sentry` to show drop-in compatibility
- `debug: true` enables console logging
- `initialScope` sets tags and user from the start
- `attachStacktrace` adds stack traces to messages

### Capturing Events

**Exceptions:**
```javascript
try {
  throw new Error('Something went wrong!');
} catch (error) {
  Sentry.captureException(error, {
    tags: { errorType: 'intentional' },
    extra: { buttonId: 'throwErrorBtn' },
  });
}
```

**Messages:**
```javascript
Sentry.captureMessage('Todo created', 'info');
```

**Breadcrumbs:**
```javascript
Sentry.addBreadcrumb({
  category: 'todo',
  message: `Added todo: ${todo.text}`,
  level: 'info',
  data: { todoId: todo.id },
});
```

### Viewing Logs

The example includes a simple log viewer that:

1. Calls `getLocalLogs()` to retrieve all events
2. Formats them with color coding and metadata
3. Auto-refreshes every 2 seconds
4. Allows manual refresh and clearing

```javascript
import { getLocalLogs, clearLocalData } from '@universal-logger/core';

async function renderLogs() {
  const logs = await getLocalLogs();
  // Render logs to DOM
}
```

## Browser Console

Open the browser console (F12) to see:

- **Debug output:** Logger initialization messages
- **Event capture:** When events are captured
- **Breadcrumb trail:** User actions being tracked
- **Error details:** Full error objects

Try running these in the console:

```javascript
// Import logger functions
import('@universal-logger/core').then(({ getLocalLogs, getLogStats }) => {
  // View all logs
  getLocalLogs().then(console.log);

  // Get statistics
  getLogStats().then(console.log);
});
```

## What's Being Demonstrated

### ✅ Sentry API Compatibility
- Identical API to Sentry SDK
- Import as `Sentry` works seamlessly
- All standard methods available

### ✅ Event Capture
- Exceptions with stack traces
- Custom messages with severity levels
- Breadcrumb tracking for user actions

### ✅ Context & Tags
- User information
- Custom tags (app name, component)
- Additional context data

### ✅ Local Storage
- Events stored in memory (default)
- No need for Sentry server
- Can switch to IndexedDB for persistence

### ✅ Real-time Logging
- Live event stream
- Auto-refresh log viewer
- Filter and export capabilities

## Next Steps

1. **Try different storage:**
   ```javascript
   Sentry.init({
     _experiments: {
       storage: 'indexeddb', // Persist across page reloads
     },
   });
   ```

2. **Enable Sentry forwarding:**
   ```javascript
   Sentry.init({
     dsn: 'https://your-key@sentry.io/your-project',
     // Events will be sent to both local storage AND Sentry
   });
   ```

3. **Add React Debug UI:**
   ```javascript
   import { DebugPanel } from '@universal-logger/core/react';
   // Use the full-featured React debug panel
   ```

4. **Explore tracing:**
   ```javascript
   Sentry.startSpan({ name: 'fetchTodos' }, () => {
     // Your code here
   });
   ```

## Questions?

Check out the main [README](../../README.md) or the [PRD](../../PRD.md) for full documentation.
