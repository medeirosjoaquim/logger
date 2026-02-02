# Simple Todo App - Universal Sentry Logger Demo

A simple todo list application demonstrating the Universal Sentry-Compatible Logger. This example shows how to use the logger as a drop-in replacement for Sentry.

## Features

- **Drop-in Sentry Replacement**: Import the logger as `Sentry` and use the exact same API
- **Local Event Storage**: All events are stored locally (no actual Sentry server needed)
- **Error Tracking**: Capture exceptions, messages, and breadcrumbs
- **Debug Panel**: View all logged events in real-time (when React UI is added)
- **HTTP Error Logging**: Demonstrate logging of failed HTTP requests

## What's Demonstrated

1. **Basic Integration**: Initialize the logger with Sentry-compatible API
2. **Exception Capture**: Multiple error scenarios (TypeError, undefined access, etc.)
3. **Message Logging**: Log custom messages with severity levels
4. **Breadcrumbs**: Automatic tracking of user actions
5. **Context & Tags**: Enrich events with additional metadata
6. **HTTP Error Handling**: Capture failed API requests

## Running the Example

### Prerequisites

Make sure the Universal Logger is built:

```bash
# From the root of the logger project
cd ../..
npm install
npm run build
```

### Start the Example

```bash
# From this directory (examples/simple)
npm run dev
```

This will start a local server at `http://localhost:3000` and open it in your browser.

Alternatively, you can use any static file server:

```bash
# Using Python
python -m http.server 3000

# Using Node's http-server
npx http-server -p 3000
```

## How It Works

### 1. Import as Sentry

```javascript
import * as Sentry from '../../dist/index.js';
```

The logger is imported as `Sentry` to demonstrate it's a drop-in replacement for the actual Sentry SDK.

### 2. Initialize

```javascript
Sentry.init({
  debug: true,
  environment: 'development',
  release: '1.0.0',
  maxBreadcrumbs: 50,
  attachStacktrace: true,
  initialScope: {
    tags: { app: 'todo-demo' },
    user: { username: 'demo-user' },
  },
});
```

### 3. Capture Events

**Exceptions:**
```javascript
try {
  throw new Error('Something went wrong!');
} catch (error) {
  Sentry.captureException(error, {
    tags: { errorType: 'intentional' },
    extra: { additionalInfo: 'value' },
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
  message: 'Added todo: Buy milk',
  level: 'info',
  data: { todoId: 123 },
});
```

### 4. View Logs

Open your browser's console to see:
- Initialization logs
- Captured events
- Breadcrumb trail
- Error details

All events are stored locally in memory (by default) and can be retrieved:

```javascript
// In browser console
import { getLocalLogs } from '../../dist/index.js';
console.log(await getLocalLogs());
```

## Error Test Buttons

The app includes several buttons to trigger different error scenarios:

1. **Throw Error**: Basic Error object
2. **Throw TypeError**: Type error from null access
3. **Undefined Error**: Access undefined property
4. **Bad HTTP Request**: 500 server error
5. **404 Request**: Not found error
6. **Timeout Request**: Request timeout/abort

Click these buttons to see how the logger captures different error types!

## Storage Options

The example uses memory storage by default. You can switch to IndexedDB for persistence:

```javascript
Sentry.init({
  // ... other options
  _experiments: {
    storage: 'indexeddb', // Use IndexedDB instead of memory
  },
});
```

## Next Steps

1. **Add React Debug UI**: Import and use the DebugPanel component
2. **Try Different Storage**: Switch between memory, IndexedDB
3. **Enable Proxy Mode**: Forward events to actual Sentry
4. **Explore Tracing**: Add spans and transactions

## Files

- `index.html` - The main HTML file with todo app UI
- `app.js` - Application logic with Sentry integration
- `package.json` - Dev server configuration
- `README.md` - This file

## Learn More

- [Universal Logger Documentation](../../README.md)
- [Sentry JavaScript SDK](https://docs.sentry.io/platforms/javascript/)
