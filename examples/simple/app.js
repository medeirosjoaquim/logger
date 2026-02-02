/**
 * Universal Sentry Logger - Complete Feature Demo
 *
 * This app demonstrates all features of the Universal Sentry-Compatible Logger:
 * - Error tracking & breadcrumbs
 * - Metrics API
 * - Structured Logs
 * - Feature Flags
 * - User Feedback
 * - Attachments
 * - Distributed Tracing
 * - AI Monitoring (mock)
 */

// Import logger as "Sentry" to demonstrate drop-in replacement
import * as Sentry from '@universal-logger/core';

// Import all our new features
import {
  getLocalLogs,
  clearLocalData,
  // Metrics
  metrics,
  getMetrics,
  // Structured Logs
  logger,
  getLogger,
  // Feature Flags
  addFeatureFlagEvaluation,
  getFeatureFlags,
  featureFlagsIntegration,
  // Feedback
  showReportDialog,
  createFeedbackWidgetButton,
  // Attachments
  addAttachment,
  // Tracing
  startSpan,
  startInactiveSpan,
  getActiveSpan,
} from '@universal-logger/core';

// Initialize Sentry with all features
Sentry.init({
  debug: true,
  environment: 'development',
  release: '2.0.0',
  maxBreadcrumbs: 50,
  attachStacktrace: true,
  initialScope: {
    tags: { app: 'feature-demo' },
    user: { username: 'demo-user', email: 'demo@example.com' },
  },
  integrations: [
    featureFlagsIntegration({ maxEvaluations: 50 }),
  ],
});

// Set additional context
Sentry.setTag('component', 'demo-app');
Sentry.setContext('app_info', {
  version: '2.0.0',
  features: ['metrics', 'logs', 'flags', 'feedback', 'tracing'],
});

console.log('[App] Universal Logger initialized with all features!');

// ============================================
// Feature Flags Demo
// ============================================

// Simulate feature flag evaluations
const FEATURES = {
  darkMode: false,
  betaFeatures: true,
  newCheckout: true,
  aiAssistant: false,
};

function checkFeatureFlag(flagName) {
  const value = FEATURES[flagName] ?? false;
  addFeatureFlagEvaluation(flagName, value);
  return value;
}

// Evaluate some flags on startup
checkFeatureFlag('darkMode');
checkFeatureFlag('betaFeatures');
checkFeatureFlag('newCheckout');

// ============================================
// Todo App Logic (same as before)
// ============================================

let todos = [];
let nextId = 1;

const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const totalCount = document.getElementById('totalCount');
const activeCount = document.getElementById('activeCount');
const completedCount = document.getElementById('completedCount');

function addTodo(text) {
  if (!text || text.trim() === '') {
    logger.warn('Attempted to add empty todo', { action: 'add_todo' });
    Sentry.captureMessage('Attempted to add empty todo', 'warning');
    alert('Please enter a todo item!');
    return;
  }

  // Track with metrics
  metrics.increment('todos.created');

  // Use tracing span
  return startSpan({ name: 'addTodo', op: 'task' }, () => {
    const todo = {
      id: nextId++,
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    todos.push(todo);

    // Structured log
    logger.info('Todo created', {
      todoId: todo.id,
      text: todo.text.substring(0, 50),
    });

    Sentry.addBreadcrumb({
      category: 'todo',
      message: `Added todo: ${todo.text}`,
      level: 'info',
      data: { todoId: todo.id },
    });

    renderTodos();
    todoInput.value = '';
    todoInput.focus();

    return todo;
  });
}

function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    Sentry.captureException(new Error(`Todo not found: ${id}`));
    return;
  }

  todo.completed = !todo.completed;

  // Track completion with metrics
  if (todo.completed) {
    metrics.increment('todos.completed');
  }

  logger.debug('Todo toggled', { todoId: id, completed: todo.completed });

  Sentry.addBreadcrumb({
    category: 'todo',
    message: `Toggled todo: ${todo.text}`,
    level: 'info',
    data: { todoId: id, completed: todo.completed },
  });

  renderTodos();
}

function deleteTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    Sentry.captureException(new Error(`Cannot delete: Todo ${id} not found`));
    return;
  }

  todos = todos.filter(t => t.id !== id);

  metrics.increment('todos.deleted');
  logger.info('Todo deleted', { todoId: id });

  Sentry.addBreadcrumb({
    category: 'todo',
    message: `Deleted todo: ${todo.text}`,
    level: 'warning',
    data: { todoId: id },
  });

  renderTodos();
}

function renderTodos() {
  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  totalCount.textContent = todos.length;
  activeCount.textContent = activeTodos.length;
  completedCount.textContent = completedTodos.length;

  // Track metrics
  metrics.gauge('todos.active_count', activeTodos.length);
  metrics.gauge('todos.total_count', todos.length);

  todoList.innerHTML = '';

  if (todos.length === 0) {
    todoList.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
        <p>No todos yet. Add one above!</p>
      </div>
    `;
    return;
  }

  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.innerHTML = `
      <input type="checkbox" class="todo-checkbox" ${todo.completed ? 'checked' : ''} data-id="${todo.id}">
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button class="btn btn-danger btn-small" data-id="${todo.id}" data-action="delete">Delete</button>
    `;
    todoList.appendChild(li);
  });

  todoList.querySelectorAll('.todo-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => toggleTodo(parseInt(e.target.dataset.id)));
  });

  todoList.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => deleteTodo(parseInt(e.target.dataset.id)));
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Event Listeners
// ============================================

addBtn.addEventListener('click', () => addTodo(todoInput.value));
todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTodo(todoInput.value);
});

// ============================================
// Error Testing Buttons
// ============================================

document.getElementById('throwErrorBtn').addEventListener('click', () => {
  try {
    metrics.increment('errors.thrown', 1, { tags: { type: 'generic' } });
    logger.error('User triggered test error', { button: 'throwErrorBtn' });
    throw new Error('This is a test error!');
  } catch (error) {
    Sentry.captureException(error, {
      tags: { errorType: 'intentional' },
    });
  }
});

document.getElementById('throwTypeErrorBtn').addEventListener('click', () => {
  try {
    metrics.increment('errors.thrown', 1, { tags: { type: 'type-error' } });
    const obj = null;
    obj.nonExistentMethod();
  } catch (error) {
    Sentry.captureException(error, { tags: { errorType: 'type-error' } });
  }
});

document.getElementById('undefinedErrorBtn').addEventListener('click', () => {
  try {
    metrics.increment('errors.thrown', 1, { tags: { type: 'undefined' } });
    const result = window.somethingUndefined.foo.bar;
  } catch (error) {
    Sentry.captureException(error, { tags: { errorType: 'undefined-access' } });
  }
});

// Helper to create meaningful HTTP errors
function createHttpError(status, url, message) {
  const error = new Error(message || `HTTP ${status} Error: Request to ${url} failed`);
  error.name = 'HttpError';
  error.status = status;
  error.url = url;
  return error;
}

document.getElementById('badHttpBtn').addEventListener('click', async () => {
  const start = performance.now();
  const url = 'https://httpstat.us/500';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => 'No response body');
      throw createHttpError(
        response.status,
        url,
        `HTTP 500 Internal Server Error from ${url} - ${text.substring(0, 100)}`
      );
    }
  } catch (error) {
    // If it's a network error, wrap it with more context
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      error = createHttpError(500, url, `Network/CORS Error connecting to ${url} (Server Error simulation)`);
    }
    metrics.timing('http.request_duration', performance.now() - start, { tags: { status: '500' } });
    metrics.increment('http.errors', 1, { tags: { status: '500' } });
    Sentry.captureException(error, { 
      tags: { errorType: 'http', httpStatus: '500' },
      contexts: { http: { url, method: 'GET', status_code: 500 } }
    });
  }
});

document.getElementById('notFoundBtn').addEventListener('click', async () => {
  const start = performance.now();
  const url = 'https://httpstat.us/404';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      const text = await response.text().catch(() => 'No response body');
      throw createHttpError(
        response.status,
        url,
        `HTTP 404 Not Found: ${url} - Resource does not exist - ${text.substring(0, 100)}`
      );
    }
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      error = createHttpError(404, url, `Network/CORS Error connecting to ${url} (404 simulation)`);
    }
    metrics.timing('http.request_duration', performance.now() - start, { tags: { status: '404' } });
    metrics.increment('http.errors', 1, { tags: { status: '404' } });
    Sentry.captureException(error, { 
      tags: { errorType: 'http', httpStatus: '404' },
      contexts: { http: { url, method: 'GET', status_code: 404 } }
    });
  }
});

document.getElementById('timeoutBtn').addEventListener('click', async () => {
  const start = performance.now();
  const url = 'https://httpstat.us/200?sleep=5000';
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw createHttpError(response.status, url, 'Request failed');
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    const errorContext = {
      tags: { errorType: isTimeout ? 'timeout' : 'network' },
      contexts: { 
        http: { url, method: 'GET', timeout_ms: 1000 },
        timeout: { requested: 1000, actual: Math.round(performance.now() - start) }
      }
    };
    
    if (isTimeout) {
      error = new Error(`Request Timeout: ${url} did not respond within 1000ms`);
      error.name = 'TimeoutError';
    } else if (error.name === 'TypeError' && error.message.includes('fetch')) {
      error = new Error(`Network/CORS Error: Could not connect to ${url} (Timeout simulation)`);
      error.name = 'NetworkError';
    }
    
    metrics.timing('http.request_duration', performance.now() - start, { tags: { status: isTimeout ? 'timeout' : 'error' } });
    metrics.increment(isTimeout ? 'http.timeouts' : 'http.errors');
    Sentry.captureException(error, errorContext);
  }
});

// ============================================
// Metrics Demo Buttons
// ============================================

document.getElementById('metricsCounterBtn').addEventListener('click', () => {
  metrics.increment('button.clicks', 1, { tags: { button: 'counter' } });
  metrics.increment('demo.counter');
  logger.info('Counter incremented');
  showNotification('Counter incremented!');
});

document.getElementById('metricsGaugeBtn').addEventListener('click', () => {
  const value = Math.floor(Math.random() * 100);
  metrics.gauge('demo.random_value', value);
  metrics.gauge('memory.simulated', value * 1024 * 1024, { unit: 'byte' });
  logger.info('Gauge recorded', { value });
  showNotification(`Gauge set to ${value}`);
});

document.getElementById('metricsDistBtn').addEventListener('click', () => {
  const value = Math.floor(Math.random() * 500) + 50;
  metrics.distribution('demo.response_time', value, { unit: 'millisecond' });
  logger.info('Distribution recorded', { value, unit: 'ms' });
  showNotification(`Distribution: ${value}ms`);
});

document.getElementById('metricsTimingBtn').addEventListener('click', () => {
  const start = performance.now();
  // Simulate some work
  for (let i = 0; i < 1000000; i++) { Math.sqrt(i); }
  const duration = performance.now() - start;
  metrics.timing('demo.computation', duration);
  logger.info('Timing recorded', { duration: duration.toFixed(2) });
  showNotification(`Computation took ${duration.toFixed(2)}ms`);
});

document.getElementById('metricsSetBtn').addEventListener('click', () => {
  const userId = `user_${Math.floor(Math.random() * 1000)}`;
  metrics.set('demo.unique_users', userId);
  logger.info('Unique user tracked', { userId });
  showNotification(`Tracked user: ${userId}`);
});

// ============================================
// Structured Logs Demo
// ============================================

document.getElementById('logTraceBtn').addEventListener('click', () => {
  logger.trace('This is a trace log', { detail: 'very detailed' });
  showNotification('Trace log sent');
});

document.getElementById('logDebugBtn').addEventListener('click', () => {
  logger.debug('Debugging info', { state: { count: todos.length } });
  showNotification('Debug log sent');
});

document.getElementById('logInfoBtn').addEventListener('click', () => {
  logger.info('User performed action', { action: 'button_click', userId: 'demo' });
  showNotification('Info log sent');
});

document.getElementById('logWarnBtn').addEventListener('click', () => {
  logger.warn('Something might be wrong', { warning: 'demo warning' });
  showNotification('Warning log sent');
});

document.getElementById('logErrorBtn').addEventListener('click', () => {
  logger.error('An error occurred', { errorCode: 'DEMO_001' });
  showNotification('Error log sent');
});

document.getElementById('logFatalBtn').addEventListener('click', () => {
  logger.fatal('Critical system failure', { severity: 'critical' });
  showNotification('Fatal log sent');
});

// ============================================
// Feature Flags Demo
// ============================================

document.getElementById('flagCheckBtn').addEventListener('click', () => {
  const flagName = 'experimentalFeature';
  const value = checkFeatureFlag(flagName);
  logger.info('Feature flag checked', { flag: flagName, value });
  showNotification(`Flag "${flagName}": ${value}`);
});

document.getElementById('flagToggleBtn').addEventListener('click', () => {
  const flags = ['darkMode', 'betaFeatures', 'newCheckout', 'aiAssistant'];
  const randomFlag = flags[Math.floor(Math.random() * flags.length)];
  FEATURES[randomFlag] = !FEATURES[randomFlag];
  const value = checkFeatureFlag(randomFlag);
  logger.info('Feature flag toggled', { flag: randomFlag, value });
  showNotification(`Toggled "${randomFlag}" to ${value}`);
});

document.getElementById('flagListBtn').addEventListener('click', () => {
  const flags = getFeatureFlags();
  logger.info('Feature flags retrieved', { flags });
  console.log('Current feature flags:', flags);
  showNotification(`${Object.keys(flags).length} flags tracked`);
});

// ============================================
// Attachments Demo
// ============================================

document.getElementById('attachTextBtn').addEventListener('click', () => {
  addAttachment({
    filename: 'debug-info.txt',
    data: `Debug info captured at ${new Date().toISOString()}\nTodos: ${todos.length}\nActive: ${todos.filter(t => !t.completed).length}`,
    contentType: 'text/plain',
  });
  logger.info('Text attachment added');
  showNotification('Text attachment added!');
});

document.getElementById('attachJsonBtn').addEventListener('click', () => {
  addAttachment({
    filename: 'app-state.json',
    data: JSON.stringify({ todos, timestamp: Date.now(), features: FEATURES }, null, 2),
    contentType: 'application/json',
  });
  logger.info('JSON attachment added');
  showNotification('JSON attachment added!');
});

document.getElementById('attachBinaryBtn').addEventListener('click', () => {
  // Create a small binary payload
  const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  addAttachment({
    filename: 'binary-data.bin',
    data: bytes,
    contentType: 'application/octet-stream',
  });
  logger.info('Binary attachment added');
  showNotification('Binary attachment added!');
});

// ============================================
// Tracing Demo
// ============================================

document.getElementById('tracingSimpleBtn').addEventListener('click', async () => {
  await startSpan({ name: 'simple-operation', op: 'demo' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    logger.info('Simple span completed');
  });
  showNotification('Simple span recorded!');
});

document.getElementById('tracingNestedBtn').addEventListener('click', async () => {
  await startSpan({ name: 'parent-operation', op: 'demo.parent' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 50));

    await startSpan({ name: 'child-operation-1', op: 'demo.child' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });

    await startSpan({ name: 'child-operation-2', op: 'demo.child' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
    });

    logger.info('Nested spans completed');
  });
  showNotification('Nested spans recorded!');
});

document.getElementById('tracingManualBtn').addEventListener('click', async () => {
  const span = startInactiveSpan({ name: 'manual-span', op: 'demo.manual' });
  span.setAttribute('custom.attribute', 'demo-value');

  await new Promise(resolve => setTimeout(resolve, 75));

  span.setStatus('ok');
  span.end();

  logger.info('Manual span completed', { spanId: span.spanId });
  showNotification('Manual span recorded!');
});

// ============================================
// Feedback Demo
// ============================================

document.getElementById('feedbackDialogBtn').addEventListener('click', () => {
  showReportDialog({
    title: 'Send Feedback',
    subtitle: 'Help us improve this demo',
    enableScreenshot: true,
    onSubmit: (feedback) => {
      logger.info('Feedback submitted', { message: feedback.message?.substring(0, 50) });
      metrics.increment('feedback.submitted');
    },
  });
});

// Create floating feedback widget
const feedbackWidget = createFeedbackWidgetButton({
  position: 'bottom-left',
  triggerLabel: 'Feedback',
  buttonColor: '#10b981',
});

// ============================================
// Notification Helper
// ============================================

function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'notification';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => notification.classList.add('show'), 10);
  setTimeout(() => {
    notification.classList.remove('show');
    setTimeout(() => notification.remove(), 300);
  }, 2000);
}

// ============================================
// Log Panel
// ============================================

const logToggleBtn = document.getElementById('logToggleBtn');
const logPanel = document.getElementById('logPanel');
const logPanelOverlay = document.getElementById('logPanelOverlay');
const errorBadge = document.getElementById('errorBadge');
const logContainer = document.getElementById('logContainer');

let isPanelOpen = false;
let _lastLogCount = 0;

function toggleLogPanel() {
  isPanelOpen = !isPanelOpen;
  logToggleBtn.classList.toggle('open', isPanelOpen);
  logPanel.classList.toggle('open', isPanelOpen);
  logPanelOverlay.classList.toggle('open', isPanelOpen);
  if (isPanelOpen) renderLogs();
}

logToggleBtn.addEventListener('click', toggleLogPanel);
logPanelOverlay.addEventListener('click', toggleLogPanel);
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && isPanelOpen) toggleLogPanel();
});

function formatTime(isoString) {
  return new Date(isoString).toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });
}

function updateErrorBadge(logs) {
  const errorCount = logs?.filter(log =>
    log.level === 'error' || log.level === 'fatal' || log.exception
  ).length || 0;

  if (errorCount > 0) {
    errorBadge.textContent = errorCount > 99 ? '99+' : errorCount;
    errorBadge.classList.remove('hidden');
  } else {
    errorBadge.classList.add('hidden');
  }
}

// Convert structured log record to display format
function structuredLogToDisplay(log) {
  return {
    id: log.logId,
    level: log.level,
    timestamp: new Date(log.timestamp * 1000).toISOString(),
    message: log.message,
    type: 'structured-log',
    attributes: log.attributes,
    traceId: log.traceId,
    spanId: log.spanId,
  };
}

// Convert metric to display format
function metricToDisplay(metric) {
  return {
    id: `metric-${metric.name}-${Date.now()}`,
    level: 'info',
    timestamp: new Date().toISOString(),
    message: `${metric.type}: ${metric.name} = ${metric.value}`,
    type: 'metric',
    attributes: metric.tags || {},
    metricType: metric.type,
    metricName: metric.name,
    metricValue: metric.value,
    metricUnit: metric.unit,
  };
}

async function renderLogs() {
  try {
    // Aggregate logs from multiple sources
    const sentryLogs = await getLocalLogs();
    const structuredLogs = getLogger().getBuffer().map(structuredLogToDisplay);
    
    // Combine all logs
    const allLogs = [
      ...(sentryLogs || []),
      ...structuredLogs,
    ];
    
    _lastLogCount = allLogs.length;
    updateErrorBadge(sentryLogs);

    if (allLogs.length === 0) {
      logContainer.innerHTML = '<div class="log-empty">No events yet. Try the buttons above!</div>';
      return;
    }

    // Sort by timestamp descending
    const sortedLogs = allLogs.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 100);

    logContainer.innerHTML = sortedLogs.map(log => {
      const level = log.level || 'info';
      const type = log.type || (log.exception ? 'exception' : 'message');
      let errorType = '';
      let message = log.message || '';
      
      // Extract extra context
      const contexts = log.contexts || {};
      const tags = log.tags || log.attributes || {};
      const httpContext = contexts.http || {};
      const timeoutContext = contexts.timeout || {};

      if (log.exception) {
        errorType = log.exception.type || 'Error';
        message = log.exception.value || message || 'Unknown error';
      }

      // Build context badges
      let contextBadges = '';
      if (type === 'structured-log') {
        contextBadges += `<span class="context-badge log-type">structured</span>`;
      } else if (type === 'metric') {
        contextBadges += `<span class="context-badge metric-type">${log.metricType}</span>`;
      }
      if (tags.errorType) {
        contextBadges += `<span class="context-badge error-type">${escapeHtml(tags.errorType)}</span>`;
      }
      if (tags.httpStatus) {
        contextBadges += `<span class="context-badge http-status">HTTP ${escapeHtml(tags.httpStatus)}</span>`;
      }
      if (httpContext.status_code) {
        contextBadges += `<span class="context-badge http-status">Status: ${httpContext.status_code}</span>`;
      }

      // Build HTTP context info
      let httpInfoHtml = '';
      if (httpContext.url || httpContext.method || httpContext.status_code) {
        httpInfoHtml = `
          <div class="log-http-info">
            ${httpContext.method ? `<span class="http-method">${httpContext.method}</span>` : ''}
            ${httpContext.url ? `<span class="http-url" title="${escapeHtml(httpContext.url)}">${escapeHtml(httpContext.url.length > 50 ? httpContext.url.substring(0, 47) + '...' : httpContext.url)}</span>` : ''}
            ${timeoutContext.requested ? `<span class="http-timeout">timeout: ${timeoutContext.requested}ms</span>` : ''}
          </div>
        `;
      }
      
      // Build attributes info for structured logs
      let attributesHtml = '';
      if (type === 'structured-log' && log.attributes && Object.keys(log.attributes).length > 0) {
        const attrs = Object.entries(log.attributes)
          .filter(([k]) => !k.startsWith('sentry.')) // Filter internal attrs
          .slice(0, 5)
          .map(([k, v]) => `<span class="attr-item">${escapeHtml(k)}: ${escapeHtml(String(v).substring(0, 30))}</span>`)
          .join('');
        if (attrs) {
          attributesHtml = `<div class="log-attributes">${attrs}</div>`;
        }
      }

      let stackHtml = '';
      if (log.exception?.stacktrace?.frames?.length > 0) {
        const frames = [...log.exception.stacktrace.frames].reverse();
        // Filter out less relevant frames for cleaner display
        const relevantFrames = frames.filter(f => 
          f.filename && 
          !f.filename.includes('node_modules') && 
          !f.filename.includes('chrome-extension')
        );
        const displayFrames = relevantFrames.length > 0 ? relevantFrames : frames;
        
        stackHtml = `
          <div class="log-stack">
            ${displayFrames.slice(0, 5).map(frame => {
              const fn = frame.function || '<anonymous>';
              const file = (frame.filename || 'unknown').split('/').pop();
              return `<div class="stack-frame"><span class="stack-fn">${escapeHtml(fn)}</span><span class="stack-loc">${escapeHtml(file)}:${frame.lineno || '?'}</span></div>`;
            }).join('')}
            ${displayFrames.length > 5 ? `<div class="stack-more">+ ${displayFrames.length - 5} more</div>` : ''}
          </div>
        `;
      }

      return `
        <div class="log-entry ${level} ${type}">
          <div class="log-meta">
            <span class="log-level ${level}">${level}</span>
            <span>${formatTime(log.timestamp)}</span>
            <span>${type}</span>
            ${log.eventId ? `<span class="log-id">${log.eventId.slice(0, 8)}</span>` : ''}
            ${log.id && !log.eventId ? `<span class="log-id">${log.id.slice(0, 8)}</span>` : ''}
          </div>
          ${errorType ? `<div class="log-error-type">${escapeHtml(errorType)}</div>` : ''}
          ${contextBadges ? `<div class="log-context-badges">${contextBadges}</div>` : ''}
          <div class="log-message">${escapeHtml(message)}</div>
          ${attributesHtml}
          ${httpInfoHtml}
          ${stackHtml}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error rendering logs:', error);
    logContainer.innerHTML = `<div class="log-empty" style="color: #f56565;">Error: ${escapeHtml(error.message)}</div>`;
  }
}

document.getElementById('refreshLogsBtn').addEventListener('click', renderLogs);
document.getElementById('clearLogsBtn').addEventListener('click', async () => {
  await clearLocalData();
  getLogger().clearBuffer();
  _lastLogCount = 0;
  await renderLogs();
});

// Auto-refresh - only re-render when log count changes to avoid blinking
setInterval(async () => {
  const logs = await getLocalLogs();
  updateErrorBadge(logs);
  if (isPanelOpen && logs && logs.length !== _lastLogCount) {
    renderLogs();
  }
}, 2000);

// ============================================
// Initialize
// ============================================

console.log('[App] Feature demo initialized!');
logger.info('Application started', { version: '2.0.0', features: Object.keys(FEATURES) });
Sentry.captureMessage('Demo app started', 'info');
renderLogs();

setTimeout(() => {
  addTodo('Try the Metrics buttons below!');
  addTodo('Check out Feature Flags demo');
  addTodo('Test Structured Logs');
}, 500);
