/**
 * Universal Sentry Logger - Complete Feature Demo
 *
 * Dark theme with lime contrast
 * Features: Metrics, Logs, Flags, Feedback, Tracing, AI, Scope
 */

import * as Sentry from '@universal-logger/core';

import {
  getLocalLogs,
  clearLocalData,
  metrics,
  getMetrics,
  logger,
  getLogger,
  addFeatureFlagEvaluation,
  getFeatureFlags,
  featureFlagsIntegration,
  showReportDialog,
  createFeedbackWidgetButton,
  addAttachment,
  startSpan,
  startInactiveSpan,
  getActiveSpan,
} from '@universal-logger/core';

// Initialize
Sentry.init({
  debug: true,
  environment: 'development',
  release: '2.0.0',
  maxBreadcrumbs: 100,
  attachStacktrace: true,
  initialScope: {
    tags: { app: 'feature-demo' },
    user: { username: 'demo-user', email: 'demo@example.com' },
  },
  integrations: [
    featureFlagsIntegration({ maxEvaluations: 50 }),
  ],
});

Sentry.setTag('component', 'demo-app');
Sentry.setContext('app_info', {
  version: '2.0.0',
  features: ['metrics', 'logs', 'flags', 'feedback', 'tracing', 'ai'],
});

console.log('[App] Universal Logger initialized');

// ============================================
// Feature Flags
// ============================================

const FEATURES = {
  darkMode: true,
  betaFeatures: true,
  newCheckout: false,
  aiAssistant: true,
  experimentalUI: false,
};

function checkFeatureFlag(flagName) {
  const value = FEATURES[flagName] ?? false;
  addFeatureFlagEvaluation(flagName, value);
  return value;
}

checkFeatureFlag('darkMode');
checkFeatureFlag('betaFeatures');
checkFeatureFlag('aiAssistant');

// ============================================
// Local Breadcrumb Collection
// ============================================

const collectedBreadcrumbs = [];

function addBreadcrumb(crumb) {
  collectedBreadcrumbs.push({
    ...crumb,
    timestamp: new Date().toISOString(),
  });
  if (collectedBreadcrumbs.length > 100) {
    collectedBreadcrumbs.shift();
  }
  Sentry.addBreadcrumb(crumb);
}

// ============================================
// AI Monitoring State
// ============================================

const aiLogs = [];

function logAIEvent(type, data) {
  const event = {
    id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    timestamp: new Date().toISOString(),
    ...data,
  };
  aiLogs.push(event);
  logger.info(`AI ${type}`, { aiType: type, ...data });
  return event;
}

// ============================================
// Todo App
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
    return;
  }

  metrics.increment('todos.created');

  return startSpan({ name: 'addTodo', op: 'task' }, () => {
    const todo = {
      id: nextId++,
      text: text.trim(),
      completed: false,
      createdAt: new Date().toISOString(),
    };

    todos.push(todo);

    logger.info('Todo created', {
      todoId: todo.id,
      text: todo.text.substring(0, 50),
    });

    addBreadcrumb({
      category: 'todo',
      message: `Added: ${todo.text}`,
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

  if (todo.completed) {
    metrics.increment('todos.completed');
  }

  logger.debug('Todo toggled', { todoId: id, completed: todo.completed });

  addBreadcrumb({
    category: 'todo',
    message: `Toggled: ${todo.text}`,
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

  addBreadcrumb({
    category: 'todo',
    message: `Deleted: ${todo.text}`,
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

  metrics.gauge('todos.active_count', activeTodos.length);
  metrics.gauge('todos.total_count', todos.length);

  todoList.innerHTML = '';

  if (todos.length === 0) {
    todoList.innerHTML = `
      <div class="empty-state">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"></path>
        </svg>
        <p>No todos yet</p>
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

// Event Listeners
addBtn.addEventListener('click', () => addTodo(todoInput.value));
todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addTodo(todoInput.value);
});

// ============================================
// Error Testing
// ============================================

function createHttpError(status, url, message) {
  const error = new Error(message || `HTTP ${status}: ${url}`);
  error.name = 'HttpError';
  error.status = status;
  error.url = url;
  return error;
}

document.getElementById('throwErrorBtn').addEventListener('click', () => {
  try {
    metrics.increment('errors.thrown', 1, { tags: { type: 'generic' } });
    logger.error('User triggered test error', { button: 'throwErrorBtn' });
    throw new Error('This is a test error!');
  } catch (error) {
    Sentry.captureException(error, { tags: { errorType: 'intentional' } });
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

document.getElementById('badHttpBtn').addEventListener('click', async () => {
  const start = performance.now();
  const url = 'https://httpstat.us/500';
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw createHttpError(response.status, url, `HTTP 500 Internal Server Error`);
    }
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      error = createHttpError(500, url, `Network/CORS Error (500 simulation)`);
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
      throw createHttpError(response.status, url, `HTTP 404 Not Found`);
    }
  } catch (error) {
    if (error.name === 'TypeError' && error.message.includes('fetch')) {
      error = createHttpError(404, url, `Network/CORS Error (404 simulation)`);
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
  } catch (error) {
    const isTimeout = error.name === 'AbortError';
    if (isTimeout) {
      error = new Error(`Request Timeout: ${url} (1000ms)`);
      error.name = 'TimeoutError';
    } else if (error.name === 'TypeError') {
      error = new Error(`Network/CORS Error (Timeout simulation)`);
      error.name = 'NetworkError';
    }
    metrics.timing('http.request_duration', performance.now() - start);
    metrics.increment(isTimeout ? 'http.timeouts' : 'http.errors');
    Sentry.captureException(error, {
      tags: { errorType: isTimeout ? 'timeout' : 'network' },
      contexts: { http: { url, method: 'GET', timeout_ms: 1000 } }
    });
  }
});

// ============================================
// Metrics Demo
// ============================================

document.getElementById('metricsCounterBtn').addEventListener('click', () => {
  metrics.increment('button.clicks', 1, { tags: { button: 'counter' } });
  metrics.increment('demo.counter');
  logger.info('Counter incremented');
  showNotification('Counter incremented');
});

document.getElementById('metricsGaugeBtn').addEventListener('click', () => {
  const value = Math.floor(Math.random() * 100);
  metrics.gauge('demo.random_value', value);
  metrics.gauge('memory.simulated', value * 1024 * 1024, { unit: 'byte' });
  logger.info('Gauge recorded', { value });
  showNotification(`Gauge: ${value}`);
});

document.getElementById('metricsDistBtn').addEventListener('click', () => {
  const value = Math.floor(Math.random() * 500) + 50;
  metrics.distribution('demo.response_time', value, { unit: 'millisecond' });
  logger.info('Distribution recorded', { value, unit: 'ms' });
  showNotification(`Distribution: ${value}ms`);
});

document.getElementById('metricsTimingBtn').addEventListener('click', () => {
  const start = performance.now();
  for (let i = 0; i < 1000000; i++) { Math.sqrt(i); }
  const duration = performance.now() - start;
  metrics.timing('demo.computation', duration);
  logger.info('Timing recorded', { duration: duration.toFixed(2) });
  showNotification(`Timing: ${duration.toFixed(2)}ms`);
});

document.getElementById('metricsSetBtn').addEventListener('click', () => {
  const userId = `user_${Math.floor(Math.random() * 1000)}`;
  metrics.set('demo.unique_users', userId);
  logger.info('Unique user tracked', { userId });
  showNotification(`Tracked: ${userId}`);
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
  logger.info('User action', { action: 'button_click', userId: 'demo' });
  showNotification('Info log sent');
});

document.getElementById('logWarnBtn').addEventListener('click', () => {
  logger.warn('Something might be wrong', { warning: 'demo' });
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
  const flags = Object.keys(FEATURES);
  const randomFlag = flags[Math.floor(Math.random() * flags.length)];
  FEATURES[randomFlag] = !FEATURES[randomFlag];
  const value = checkFeatureFlag(randomFlag);
  logger.info('Feature flag toggled', { flag: randomFlag, value });
  showNotification(`"${randomFlag}": ${value}`);
});

document.getElementById('flagListBtn').addEventListener('click', () => {
  const flags = getFeatureFlags();
  logger.info('Feature flags retrieved', { count: Object.keys(flags).length });
  console.log('Feature flags:', flags);
  showNotification(`${Object.keys(flags).length} flags tracked`);
});

// ============================================
// Attachments Demo
// ============================================

document.getElementById('attachTextBtn').addEventListener('click', () => {
  addAttachment({
    filename: 'debug-info.txt',
    data: `Debug info: ${new Date().toISOString()}\nTodos: ${todos.length}`,
    contentType: 'text/plain',
  });
  logger.info('Text attachment added');
  showNotification('Text attached');
});

document.getElementById('attachJsonBtn').addEventListener('click', () => {
  addAttachment({
    filename: 'app-state.json',
    data: JSON.stringify({ todos, features: FEATURES }, null, 2),
    contentType: 'application/json',
  });
  logger.info('JSON attachment added');
  showNotification('JSON attached');
});

document.getElementById('attachBinaryBtn').addEventListener('click', () => {
  const bytes = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]);
  addAttachment({
    filename: 'binary-data.bin',
    data: bytes,
    contentType: 'application/octet-stream',
  });
  logger.info('Binary attachment added');
  showNotification('Binary attached');
});

// ============================================
// Tracing Demo
// ============================================

document.getElementById('tracingSimpleBtn').addEventListener('click', async () => {
  await startSpan({ name: 'simple-operation', op: 'demo' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 100));
    logger.info('Simple span completed');
  });
  showNotification('Simple span recorded');
});

document.getElementById('tracingNestedBtn').addEventListener('click', async () => {
  await startSpan({ name: 'parent-operation', op: 'demo.parent' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 50));

    await startSpan({ name: 'child-1', op: 'demo.child' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 30));
    });

    await startSpan({ name: 'child-2', op: 'demo.child' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 40));
    });

    logger.info('Nested spans completed');
  });
  showNotification('Nested spans recorded');
});

document.getElementById('tracingManualBtn').addEventListener('click', async () => {
  const span = startInactiveSpan({ name: 'manual-span', op: 'demo.manual' });
  span.setAttribute('custom.attribute', 'demo-value');
  await new Promise(resolve => setTimeout(resolve, 75));
  span.setStatus('ok');
  span.end();
  logger.info('Manual span completed', { spanId: span.spanId });
  showNotification('Manual span recorded');
});

// ============================================
// AI Monitoring Demo
// ============================================

document.getElementById('aiChatBtn').addEventListener('click', async () => {
  const start = performance.now();

  addBreadcrumb({
    category: 'ai',
    message: 'Starting chat completion',
    level: 'info',
    data: { model: 'gpt-4', type: 'chat' },
  });

  await startSpan({ name: 'ai.chat', op: 'ai.chat_completion' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 150 + Math.random() * 200));

    const event = logAIEvent('chat', {
      model: 'gpt-4',
      inputTokens: Math.floor(Math.random() * 500) + 100,
      outputTokens: Math.floor(Math.random() * 300) + 50,
      latency: performance.now() - start,
    });

    metrics.timing('ai.chat.latency', performance.now() - start);
    metrics.increment('ai.chat.requests');
  });

  showNotification('Chat completion tracked');
});

document.getElementById('aiCompletionBtn').addEventListener('click', async () => {
  const start = performance.now();

  addBreadcrumb({
    category: 'ai',
    message: 'Starting text completion',
    level: 'info',
    data: { model: 'claude-3', type: 'completion' },
  });

  await startSpan({ name: 'ai.completion', op: 'ai.text_completion' }, async () => {
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));

    const event = logAIEvent('completion', {
      model: 'claude-3-sonnet',
      inputTokens: Math.floor(Math.random() * 200) + 50,
      outputTokens: Math.floor(Math.random() * 500) + 100,
      latency: performance.now() - start,
    });

    metrics.timing('ai.completion.latency', performance.now() - start);
    metrics.increment('ai.completion.requests');
  });

  showNotification('Text completion tracked');
});

document.getElementById('aiPipelineBtn').addEventListener('click', async () => {
  const start = performance.now();

  addBreadcrumb({
    category: 'ai',
    message: 'Starting AI pipeline',
    level: 'info',
    data: { steps: ['embed', 'retrieve', 'generate'] },
  });

  await startSpan({ name: 'ai.pipeline', op: 'ai.pipeline' }, async () => {
    // Embedding step
    await startSpan({ name: 'ai.embed', op: 'ai.embedding' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 50));
      logAIEvent('embedding', { model: 'text-embedding-ada-002', dimensions: 1536 });
    });

    // Retrieval step
    await startSpan({ name: 'ai.retrieve', op: 'ai.retrieval' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 80));
      logAIEvent('retrieval', { source: 'vector-db', documents: 5 });
    });

    // Generation step
    await startSpan({ name: 'ai.generate', op: 'ai.generation' }, async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
      logAIEvent('generation', { model: 'gpt-4', tokens: 350 });
    });

    metrics.timing('ai.pipeline.latency', performance.now() - start);
    metrics.increment('ai.pipeline.requests');
  });

  showNotification('AI pipeline tracked');
});

// ============================================
// Scope & Context Demo
// ============================================

document.getElementById('scopeUserBtn').addEventListener('click', () => {
  const userId = `user_${Math.floor(Math.random() * 10000)}`;
  Sentry.setUser({
    id: userId,
    email: `${userId}@example.com`,
    username: userId,
  });

  addBreadcrumb({
    category: 'auth',
    message: `User set: ${userId}`,
    level: 'info',
  });

  logger.info('User context set', { userId });
  showNotification(`User: ${userId}`);
});

document.getElementById('scopeTagBtn').addEventListener('click', () => {
  const tags = ['feature', 'experiment', 'version', 'region', 'tier'];
  const tag = tags[Math.floor(Math.random() * tags.length)];
  const value = `value_${Math.floor(Math.random() * 100)}`;

  Sentry.setTag(tag, value);

  addBreadcrumb({
    category: 'context',
    message: `Tag added: ${tag}=${value}`,
    level: 'info',
  });

  logger.info('Tag added', { tag, value });
  showNotification(`Tag: ${tag}=${value}`);
});

document.getElementById('scopeContextBtn').addEventListener('click', () => {
  const contexts = ['device', 'browser', 'session', 'performance'];
  const contextName = contexts[Math.floor(Math.random() * contexts.length)];

  Sentry.setContext(contextName, {
    timestamp: Date.now(),
    random: Math.random(),
    todoCount: todos.length,
  });

  addBreadcrumb({
    category: 'context',
    message: `Context set: ${contextName}`,
    level: 'info',
  });

  logger.info('Context set', { context: contextName });
  showNotification(`Context: ${contextName}`);
});

document.getElementById('scopeClearBtn').addEventListener('click', () => {
  Sentry.setUser(null);

  addBreadcrumb({
    category: 'auth',
    message: 'User context cleared',
    level: 'info',
  });

  logger.info('Scope cleared');
  showNotification('Scope cleared');
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

const feedbackWidget = createFeedbackWidgetButton({
  position: 'bottom-left',
  triggerLabel: 'Feedback',
  buttonColor: '#a3e635',
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
    setTimeout(() => notification.remove(), 200);
  }, 1500);
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
let currentTab = 'all';
let _lastLogCount = 0;

// Tab handling
document.querySelectorAll('.log-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.log-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    currentTab = tab.dataset.tab;
    renderLogs();
  });
});

function toggleLogPanel() {
  isPanelOpen = !isPanelOpen;
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

function breadcrumbToDisplay(crumb) {
  return {
    id: `bc-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    level: crumb.level || 'info',
    timestamp: crumb.timestamp || new Date().toISOString(),
    message: crumb.message,
    type: 'breadcrumb',
    category: crumb.category,
    data: crumb.data,
  };
}

function aiLogToDisplay(log) {
  return {
    id: log.id,
    level: 'info',
    timestamp: log.timestamp,
    message: `${log.type}: ${log.model || log.source || 'unknown'}`,
    type: 'ai',
    aiType: log.type,
    attributes: log,
  };
}

async function renderLogs() {
  try {
    const sentryLogs = await getLocalLogs() || [];
    const structuredLogs = getLogger().getBuffer().map(structuredLogToDisplay);
    const breadcrumbs = collectedBreadcrumbs.map(breadcrumbToDisplay);
    const aiDisplayLogs = aiLogs.map(aiLogToDisplay);

    let allLogs = [
      ...sentryLogs,
      ...structuredLogs,
      ...breadcrumbs,
      ...aiDisplayLogs,
    ];

    // Filter by tab
    if (currentTab === 'errors') {
      allLogs = allLogs.filter(l => l.level === 'error' || l.level === 'fatal' || l.exception);
    } else if (currentTab === 'logs') {
      allLogs = allLogs.filter(l => l.type === 'structured-log');
    } else if (currentTab === 'metrics') {
      allLogs = allLogs.filter(l => l.type === 'metric');
    } else if (currentTab === 'breadcrumbs') {
      allLogs = allLogs.filter(l => l.type === 'breadcrumb');
    }

    _lastLogCount = allLogs.length;
    updateErrorBadge(sentryLogs);

    if (allLogs.length === 0) {
      const msg = currentTab === 'all' ? 'No events yet' : `No ${currentTab} events`;
      logContainer.innerHTML = `<div class="log-empty">${msg}</div>`;
      return;
    }

    const sortedLogs = allLogs
      .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
      .slice(0, 100);

    logContainer.innerHTML = sortedLogs.map(log => {
      const level = log.level || 'info';
      const type = log.type || (log.exception ? 'exception' : 'message');
      let errorType = '';
      let message = log.message || '';

      const contexts = log.contexts || {};
      const tags = log.tags || log.attributes || {};
      const httpContext = contexts.http || {};

      if (log.exception) {
        errorType = log.exception.type || 'Error';
        message = log.exception.value || message || 'Unknown error';
      }

      let contextBadges = '';
      if (type === 'structured-log') {
        contextBadges += `<span class="context-badge log-type">log</span>`;
      } else if (type === 'metric') {
        contextBadges += `<span class="context-badge metric-type">${log.metricType || 'metric'}</span>`;
      } else if (type === 'breadcrumb') {
        contextBadges += `<span class="context-badge log-type">breadcrumb</span>`;
        if (log.category) {
          contextBadges += `<span class="breadcrumb-category">${escapeHtml(log.category)}</span>`;
        }
      } else if (type === 'ai') {
        contextBadges += `<span class="context-badge ai-type">${log.aiType || 'ai'}</span>`;
      }
      if (tags.errorType) {
        contextBadges += `<span class="context-badge error-type">${escapeHtml(tags.errorType)}</span>`;
      }
      if (tags.httpStatus) {
        contextBadges += `<span class="context-badge http-status">HTTP ${escapeHtml(tags.httpStatus)}</span>`;
      }

      let httpInfoHtml = '';
      if (httpContext.url || httpContext.method) {
        httpInfoHtml = `
          <div class="log-http-info">
            ${httpContext.method ? `<span class="http-method">${httpContext.method}</span>` : ''}
            ${httpContext.url ? `<span class="http-url">${escapeHtml(httpContext.url.substring(0, 50))}</span>` : ''}
          </div>
        `;
      }

      let attributesHtml = '';
      if ((type === 'structured-log' || type === 'ai') && log.attributes && Object.keys(log.attributes).length > 0) {
        const attrs = Object.entries(log.attributes)
          .filter(([k]) => !k.startsWith('sentry.') && k !== 'type' && k !== 'id' && k !== 'timestamp')
          .slice(0, 5)
          .map(([k, v]) => `<span class="attr-item">${escapeHtml(k)}: ${escapeHtml(String(v).substring(0, 25))}</span>`)
          .join('');
        if (attrs) {
          attributesHtml = `<div class="log-attributes">${attrs}</div>`;
        }
      }

      let breadcrumbDataHtml = '';
      if (type === 'breadcrumb' && log.data && Object.keys(log.data).length > 0) {
        const dataStr = JSON.stringify(log.data);
        if (dataStr.length < 100) {
          breadcrumbDataHtml = `<div class="breadcrumb-data">${escapeHtml(dataStr)}</div>`;
        }
      }

      let stackHtml = '';
      if (log.exception?.stacktrace?.frames?.length > 0) {
        const frames = [...log.exception.stacktrace.frames].reverse();
        const relevantFrames = frames.filter(f =>
          f.filename &&
          !f.filename.includes('node_modules') &&
          !f.filename.includes('chrome-extension')
        );
        const displayFrames = relevantFrames.length > 0 ? relevantFrames : frames;

        stackHtml = `
          <div class="log-stack">
            ${displayFrames.slice(0, 4).map(frame => {
              const fn = frame.function || '<anonymous>';
              const file = (frame.filename || 'unknown').split('/').pop();
              return `<div class="stack-frame"><span class="stack-fn">${escapeHtml(fn)}</span><span class="stack-loc">${escapeHtml(file)}:${frame.lineno || '?'}</span></div>`;
            }).join('')}
            ${displayFrames.length > 4 ? `<div class="stack-more">+ ${displayFrames.length - 4} more</div>` : ''}
          </div>
        `;
      }

      return `
        <div class="log-entry ${level} ${type}">
          <div class="log-meta">
            <span class="log-level ${level}">${level}</span>
            <span>${formatTime(log.timestamp)}</span>
            ${log.eventId ? `<span class="log-id">${log.eventId.slice(0, 8)}</span>` : ''}
            ${log.id && !log.eventId ? `<span class="log-id">${String(log.id).slice(0, 8)}</span>` : ''}
          </div>
          ${errorType ? `<div class="log-error-type">${escapeHtml(errorType)}</div>` : ''}
          ${contextBadges ? `<div class="log-context-badges">${contextBadges}</div>` : ''}
          <div class="log-message">${escapeHtml(message)}</div>
          ${attributesHtml}
          ${breadcrumbDataHtml}
          ${httpInfoHtml}
          ${stackHtml}
        </div>
      `;
    }).join('');
  } catch (error) {
    console.error('Error rendering logs:', error);
    logContainer.innerHTML = `<div class="log-empty" style="color: var(--red);">Error: ${escapeHtml(error.message)}</div>`;
  }
}

document.getElementById('refreshLogsBtn').addEventListener('click', renderLogs);
document.getElementById('clearLogsBtn').addEventListener('click', async () => {
  await clearLocalData();
  getLogger().clearBuffer();
  aiLogs.length = 0;
  collectedBreadcrumbs.length = 0;
  _lastLogCount = 0;
  await renderLogs();
});

// Auto-refresh
setInterval(async () => {
  const logs = await getLocalLogs();
  updateErrorBadge(logs);
  if (isPanelOpen) {
    const totalCount = (logs?.length || 0) + getLogger().getBuffer().length + aiLogs.length + collectedBreadcrumbs.length;
    if (totalCount !== _lastLogCount) {
      renderLogs();
    }
  }
}, 2000);

// ============================================
// Initialize
// ============================================

console.log('[App] Feature demo ready');
logger.info('Application started', { version: '2.0.0' });
Sentry.captureMessage('Demo app started', 'info');
renderLogs();

setTimeout(() => {
  addTodo('Try the Metrics buttons');
  addTodo('Check out AI Monitoring');
  addTodo('Test Structured Logs');
}, 500);
