/**
 * Simple Todo App - Demonstrating Universal Sentry Logger
 *
 * This app imports the logger as "Sentry" to demonstrate drop-in compatibility.
 */

// Import logger as "Sentry" to demonstrate drop-in replacement
import * as Sentry from '../../dist/index.js';

// Import local logger functions to display logs
import { getLocalLogs, clearLocalData } from '../../dist/index.js';

// Initialize Sentry with local storage
Sentry.init({
  // Operating in standalone mode (local only, no actual Sentry server)
  debug: true,
  environment: 'development',
  release: '1.0.0',

  // Track all user interactions as breadcrumbs
  maxBreadcrumbs: 50,

  // Attach stack traces to messages
  attachStacktrace: true,

  // Add initial context
  initialScope: {
    tags: { app: 'todo-demo' },
    user: { username: 'demo-user', email: 'demo@example.com' },
  },
});

// Set additional context
Sentry.setTag('component', 'todo-list');
Sentry.setContext('app_info', {
  version: '1.0.0',
  feature: 'todo-management',
});

console.log('[App] Sentry initialized successfully!');

// ============================================
// Todo App Logic
// ============================================

let todos = [];
let nextId = 1;

// DOM elements
const todoInput = document.getElementById('todoInput');
const addBtn = document.getElementById('addBtn');
const todoList = document.getElementById('todoList');
const totalCount = document.getElementById('totalCount');
const activeCount = document.getElementById('activeCount');
const completedCount = document.getElementById('completedCount');

// Error buttons
const throwErrorBtn = document.getElementById('throwErrorBtn');
const throwTypeErrorBtn = document.getElementById('throwTypeErrorBtn');
const undefinedErrorBtn = document.getElementById('undefinedErrorBtn');
const badHttpBtn = document.getElementById('badHttpBtn');
const notFoundBtn = document.getElementById('notFoundBtn');
const timeoutBtn = document.getElementById('timeoutBtn');

/**
 * Add a new todo
 */
function addTodo(text) {
  if (!text || text.trim() === '') {
    Sentry.captureMessage('Attempted to add empty todo', 'warning');
    alert('Please enter a todo item!');
    return;
  }

  const todo = {
    id: nextId++,
    text: text.trim(),
    completed: false,
    createdAt: new Date().toISOString(),
  };

  todos.push(todo);

  // Log breadcrumb for todo creation
  Sentry.addBreadcrumb({
    category: 'todo',
    message: `Added todo: ${todo.text}`,
    level: 'info',
    data: { todoId: todo.id },
  });

  // Log to Sentry
  Sentry.captureMessage(`Todo created: ${todo.text}`, 'info');

  renderTodos();
  todoInput.value = '';
  todoInput.focus();
}

/**
 * Toggle todo completion
 */
function toggleTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    Sentry.captureException(new Error(`Todo not found: ${id}`));
    return;
  }

  todo.completed = !todo.completed;

  Sentry.addBreadcrumb({
    category: 'todo',
    message: `Toggled todo: ${todo.text}`,
    level: 'info',
    data: {
      todoId: id,
      completed: todo.completed,
    },
  });

  renderTodos();
}

/**
 * Delete a todo
 */
function deleteTodo(id) {
  const todo = todos.find(t => t.id === id);
  if (!todo) {
    Sentry.captureException(new Error(`Cannot delete: Todo ${id} not found`));
    return;
  }

  todos = todos.filter(t => t.id !== id);

  Sentry.addBreadcrumb({
    category: 'todo',
    message: `Deleted todo: ${todo.text}`,
    level: 'warning',
    data: { todoId: id },
  });

  renderTodos();
}

/**
 * Render todos to the DOM
 */
function renderTodos() {
  const activeTodos = todos.filter(t => !t.completed);
  const completedTodos = todos.filter(t => t.completed);

  // Update stats
  totalCount.textContent = todos.length;
  activeCount.textContent = activeTodos.length;
  completedCount.textContent = completedTodos.length;

  // Clear list
  todoList.innerHTML = '';

  // Show empty state if no todos
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

  // Render each todo
  todos.forEach(todo => {
    const li = document.createElement('li');
    li.className = `todo-item ${todo.completed ? 'completed' : ''}`;
    li.innerHTML = `
      <input
        type="checkbox"
        class="todo-checkbox"
        ${todo.completed ? 'checked' : ''}
        data-id="${todo.id}"
      >
      <span class="todo-text">${escapeHtml(todo.text)}</span>
      <button class="btn btn-danger btn-small" data-id="${todo.id}" data-action="delete">
        Delete
      </button>
    `;
    todoList.appendChild(li);
  });

  // Add event listeners
  todoList.querySelectorAll('.todo-checkbox').forEach(checkbox => {
    checkbox.addEventListener('change', (e) => {
      toggleTodo(parseInt(e.target.dataset.id));
    });
  });

  todoList.querySelectorAll('[data-action="delete"]').forEach(btn => {
    btn.addEventListener('click', (e) => {
      deleteTodo(parseInt(e.target.dataset.id));
    });
  });
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================
// Event Listeners
// ============================================

addBtn.addEventListener('click', () => {
  addTodo(todoInput.value);
});

todoInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    addTodo(todoInput.value);
  }
});

// ============================================
// Error Testing Buttons
// ============================================

throwErrorBtn.addEventListener('click', () => {
  try {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: 'User clicked "Throw Error" button',
      level: 'info',
    });

    throw new Error('This is a test error from the "Throw Error" button!');
  } catch (error) {
    Sentry.captureException(error, {
      tags: { errorType: 'intentional', source: 'button' },
      extra: { buttonId: 'throwErrorBtn' },
    });
    console.error('Caught and logged error:', error);
  }
});

throwTypeErrorBtn.addEventListener('click', () => {
  try {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: 'User clicked "Throw TypeError" button',
      level: 'info',
    });

    // Intentionally cause a TypeError
    const obj = null;
    obj.nonExistentMethod(); // This will throw TypeError
  } catch (error) {
    Sentry.captureException(error, {
      tags: { errorType: 'type-error', source: 'button' },
      extra: { buttonId: 'throwTypeErrorBtn' },
    });
    console.error('Caught TypeError:', error);
  }
});

undefinedErrorBtn.addEventListener('click', () => {
  try {
    Sentry.addBreadcrumb({
      category: 'user-action',
      message: 'User clicked "Undefined Error" button',
      level: 'info',
    });

    // Access undefined property
    const result = window.somethingThatDoesNotExist.foo.bar;
  } catch (error) {
    Sentry.captureException(error, {
      tags: { errorType: 'undefined-access', source: 'button' },
      extra: { buttonId: 'undefinedErrorBtn' },
    });
    console.error('Caught undefined access error:', error);
  }
});

badHttpBtn.addEventListener('click', async () => {
  try {
    Sentry.addBreadcrumb({
      category: 'http',
      message: 'Attempting bad HTTP request',
      level: 'info',
      data: { url: 'https://httpstat.us/500' },
    });

    const response = await fetch('https://httpstat.us/500');

    if (!response.ok) {
      throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { errorType: 'http-error', httpStatus: '500' },
      extra: {
        url: 'https://httpstat.us/500',
        buttonId: 'badHttpBtn',
      },
    });
    console.error('HTTP request failed:', error);
  }
});

notFoundBtn.addEventListener('click', async () => {
  try {
    Sentry.addBreadcrumb({
      category: 'http',
      message: 'Attempting 404 request',
      level: 'info',
      data: { url: 'https://httpstat.us/404' },
    });

    const response = await fetch('https://httpstat.us/404');

    if (!response.ok) {
      throw new Error(`Resource not found: ${response.status}`);
    }
  } catch (error) {
    Sentry.captureException(error, {
      tags: { errorType: 'not-found', httpStatus: '404' },
      extra: {
        url: 'https://httpstat.us/404',
        buttonId: 'notFoundBtn',
      },
    });
    console.error('404 error:', error);
  }
});

timeoutBtn.addEventListener('click', async () => {
  try {
    Sentry.addBreadcrumb({
      category: 'http',
      message: 'Attempting request with timeout',
      level: 'info',
      data: { url: 'https://httpstat.us/200?sleep=5000', timeout: 1000 },
    });

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000);

    const response = await fetch('https://httpstat.us/200?sleep=5000', {
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
  } catch (error) {
    Sentry.captureException(error, {
      tags: { errorType: 'timeout', httpStatus: 'timeout' },
      extra: {
        url: 'https://httpstat.us/200?sleep=5000',
        timeout: 1000,
        buttonId: 'timeoutBtn',
      },
    });
    console.error('Request timeout:', error);
  }
});

// ============================================
// Global Error Handlers
// ============================================

window.addEventListener('error', (event) => {
  console.error('Global error handler:', event.error);
  // The browserIntegration will automatically capture this
});

window.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled promise rejection:', event.reason);
  // The browserIntegration will automatically capture this
});

// ============================================
// Log Viewer
// ============================================

const logContainer = document.getElementById('logContainer');
const refreshLogsBtn = document.getElementById('refreshLogsBtn');
const clearLogsBtn = document.getElementById('clearLogsBtn');

/**
 * Format timestamp
 */
function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

/**
 * Render logs to the viewer
 */
async function renderLogs() {
  try {
    const logs = await getLocalLogs();

    if (!logs || logs.length === 0) {
      logContainer.innerHTML = `
        <div class="log-empty">
          No events captured yet. Interact with the app or click error buttons above!
        </div>
      `;
      return;
    }

    // Sort logs by timestamp (newest first)
    const sortedLogs = [...logs].sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Limit to last 50 logs
    const recentLogs = sortedLogs.slice(0, 50);

    logContainer.innerHTML = recentLogs.map(log => {
      const level = log.level || 'info';
      const message = log.message || log.exception?.values?.[0]?.value || 'Unknown event';
      const eventType = log.exception ? 'exception' : log.message ? 'message' : 'event';

      let details = '';
      if (log.exception) {
        const exceptionValue = log.exception.values?.[0];
        if (exceptionValue?.stacktrace?.frames) {
          const topFrame = exceptionValue.stacktrace.frames[0];
          details = `${topFrame?.filename || 'unknown'}:${topFrame?.lineno || '?'}`;
        }
      }
      if (log.tags) {
        const tagStr = Object.entries(log.tags)
          .map(([k, v]) => `${k}=${v}`)
          .join(', ');
        if (tagStr) {
          details = details ? `${details} | ${tagStr}` : tagStr;
        }
      }

      return `
        <div class="log-entry ${level}">
          <div class="log-meta">
            <span class="log-level ${level}">${level}</span>
            <span>${formatTime(log.timestamp)}</span>
            <span>${eventType}</span>
            ${log.event_id ? `<span>ID: ${log.event_id.slice(0, 8)}</span>` : ''}
          </div>
          <div class="log-message">${escapeHtml(message)}</div>
          ${details ? `<div class="log-details">${escapeHtml(details)}</div>` : ''}
        </div>
      `;
    }).join('');

  } catch (error) {
    console.error('Failed to render logs:', error);
    logContainer.innerHTML = `
      <div class="log-empty" style="color: #f56565;">
        Error loading logs: ${escapeHtml(error.message)}
      </div>
    `;
  }
}

/**
 * Clear all logs
 */
async function clearLogs() {
  try {
    await clearLocalData();
    await renderLogs();
    console.log('[LogViewer] Logs cleared');
  } catch (error) {
    console.error('Failed to clear logs:', error);
  }
}

// Log viewer event listeners
refreshLogsBtn.addEventListener('click', renderLogs);
clearLogsBtn.addEventListener('click', clearLogs);

// Auto-refresh logs every 2 seconds
setInterval(renderLogs, 2000);

// ============================================
// Initialize App
// ============================================

console.log('[App] Todo app initialized!');
Sentry.captureMessage('Todo app started', 'info');

// Initial log render
renderLogs();

// Add some sample todos to demonstrate
setTimeout(() => {
  addTodo('Click the error buttons to see them logged');
  addTodo('Check the log viewer below!');
}, 500);
