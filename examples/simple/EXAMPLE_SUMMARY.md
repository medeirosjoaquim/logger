# Simple Example - Summary

## Created Files

### 1. **index.html** (Main UI)
- Beautiful gradient purple background
- Todo list interface with add/delete/complete functionality
- 6 error testing buttons for different scenarios
- Integrated Sentry Event Log viewer at the bottom
- Responsive design with modern styling

### 2. **app.js** (Application Logic)
- Imports logger as `Sentry` to demonstrate drop-in compatibility
- Initializes Sentry with debug mode, tags, and user context
- Todo management (add, complete, delete) with breadcrumb logging
- 6 error scenarios:
  - Basic Error
  - TypeError (null access)
  - Undefined property access
  - HTTP 500 error
  - HTTP 404 error
  - Request timeout
- Real-time log viewer that auto-refreshes every 2 seconds
- Displays events with color coding, metadata, and details

### 3. **package.json**
- Uses Vite as a dev server/bundler
- Scripts: `npm run dev`, `npm start`, `npm run build`
- No production dependencies (uses local logger source)

### 4. **vite.config.js**
- Configures alias to import from logger source (`@universal-logger/core`)
- Sets dev server port to 3000
- Auto-opens browser on start

### 5. **README.md**
- Quick start instructions
- Feature overview
- Code examples
- Storage options explanation
- Next steps guidance

### 6. **DEMO_GUIDE.md**
- Detailed walkthrough of the demo
- Explanation of each error button
- Code walkthrough with examples
- Browser console tips
- Next steps for experimentation

### 7. **EXAMPLE_SUMMARY.md** (this file)
- Overview of all created files

## Key Features Demonstrated

✅ **Drop-in Sentry Replacement**
- Import as `Sentry` works identically to Sentry SDK
- All core methods available (captureException, captureMessage, addBreadcrumb)

✅ **Event Capture**
- Exceptions with full stack traces
- Messages with severity levels
- User actions as breadcrumbs

✅ **Context & Enrichment**
- Tags (app name, error type, HTTP status)
- User info (username, email)
- Extra data (button IDs, URLs)

✅ **Local Debugging**
- Real-time event log viewer
- Color-coded severity levels
- Automatic refresh every 2 seconds
- No actual Sentry server needed

✅ **Error Scenarios**
- JavaScript errors (Error, TypeError)
- Undefined access errors
- HTTP errors (500, 404)
- Network timeouts

✅ **Modern Development**
- Vite for instant dev server
- Hot module reload
- TypeScript source compilation on-the-fly

## How to Run

```bash
cd /home/asari/dojo/logger/examples/simple
npm install
npm run dev
```

Browser opens to `http://localhost:3000` automatically!

## What You'll See

1. **Top Section**: Todo list app
2. **Middle Section**: 6 error testing buttons
3. **Bottom Section**: Live Sentry event log (black terminal-style panel)

## Try These Actions

1. Add a todo → See breadcrumb logged
2. Complete a todo → See breadcrumb logged
3. Delete a todo → See breadcrumb logged
4. Click "Throw Error" → See error captured with stack trace
5. Click "Bad HTTP Request" → See HTTP 500 error logged
6. Watch the log viewer update in real-time!

## Architecture

```
Browser (localhost:3000)
    ↓
Vite Dev Server
    ↓
app.js (imports from source)
    ↓
../../src/index.ts (Sentry-compatible API)
    ↓
UniversalLogger (core logger class)
    ↓
MemoryStorageProvider (stores events)
    ↓
getLocalLogs() → renders to DOM
```

## Storage

By default, uses **in-memory storage**:
- Events cleared on page reload
- Fast and simple
- Perfect for demo/debugging

Can switch to **IndexedDB**:
```javascript
Sentry.init({
  _experiments: {
    storage: 'indexeddb',
  },
});
```

## Next Enhancements

Future improvements could include:
- [ ] React Debug Panel integration
- [ ] Trace/span visualization
- [ ] Session replay
- [ ] Export logs to JSON/CSV
- [ ] Filter events by type/severity
- [ ] Search functionality
