/**
 * Automatic Breadcrumb Collection
 *
 * Instruments browser APIs to automatically capture breadcrumbs for:
 * - Console messages
 * - DOM clicks
 * - Navigation (history API)
 * - Fetch requests
 * - XMLHttpRequest
 */

import type { Breadcrumb } from '../../types/sentry';
import {
  createBreadcrumb,
  createConsoleBreadcrumb,
  createHttpBreadcrumb,
  createNavigationBreadcrumb,
  createUIBreadcrumb,
} from './breadcrumb';

/**
 * Callback type for adding breadcrumbs
 */
export type AddBreadcrumbFn = (breadcrumb: Breadcrumb) => void;

/**
 * Cleanup function returned by instrumentation functions
 */
export type CleanupFn = () => void;

/**
 * Options for automatic breadcrumb collection
 */
export interface AutoBreadcrumbOptions {
  /**
   * Whether to capture console breadcrumbs
   */
  console?: boolean;

  /**
   * Whether to capture DOM click breadcrumbs
   */
  dom?: boolean;

  /**
   * Whether to capture navigation breadcrumbs
   */
  navigation?: boolean;

  /**
   * Whether to capture fetch breadcrumbs
   */
  fetch?: boolean;

  /**
   * Whether to capture XHR breadcrumbs
   */
  xhr?: boolean;
}

/**
 * Setup all automatic breadcrumb collection
 */
export function setupAutoBreadcrumbs(
  addBreadcrumb: AddBreadcrumbFn,
  options: AutoBreadcrumbOptions = {}
): CleanupFn {
  const cleanupFns: CleanupFn[] = [];

  const defaultOptions: AutoBreadcrumbOptions = {
    console: true,
    dom: true,
    navigation: true,
    fetch: true,
    xhr: true,
    ...options,
  };

  if (defaultOptions.console) {
    cleanupFns.push(instrumentConsole(addBreadcrumb));
  }

  if (defaultOptions.dom) {
    cleanupFns.push(instrumentDOM(addBreadcrumb));
  }

  if (defaultOptions.navigation) {
    cleanupFns.push(instrumentHistory(addBreadcrumb));
  }

  if (defaultOptions.fetch) {
    cleanupFns.push(instrumentFetch(addBreadcrumb));
  }

  if (defaultOptions.xhr) {
    cleanupFns.push(instrumentXHR(addBreadcrumb));
  }

  return () => {
    for (const cleanup of cleanupFns) {
      try {
        cleanup();
      } catch {
        // Ignore cleanup errors
      }
    }
  };
}

/**
 * Instrument console methods to capture breadcrumbs
 */
export function instrumentConsole(addBreadcrumb: AddBreadcrumbFn): CleanupFn {
  if (typeof console === 'undefined') {
    return () => {};
  }

  const originalMethods: Partial<Console> = {};
  const levels = ['log', 'info', 'warn', 'error', 'debug'] as const;

  for (const level of levels) {
    const original = console[level];
    if (typeof original !== 'function') {
      continue;
    }

    originalMethods[level] = original;

    console[level] = function (...args: unknown[]) {
      // Create breadcrumb
      try {
        addBreadcrumb(createConsoleBreadcrumb(level, args));
      } catch {
        // Ignore breadcrumb errors
      }

      // Call original
      return original.apply(console, args);
    };
  }

  return () => {
    for (const level of levels) {
      if (originalMethods[level]) {
        console[level] = originalMethods[level] as typeof console.log;
      }
    }
  };
}

/**
 * Instrument DOM to capture click breadcrumbs
 */
export function instrumentDOM(addBreadcrumb: AddBreadcrumbFn): CleanupFn {
  if (typeof document === 'undefined' || typeof document.addEventListener !== 'function') {
    return () => {};
  }

  const handler = (event: Event) => {
    try {
      const target = getEventTarget(event);
      if (!target) {
        return;
      }

      // Create a description of the clicked element
      const description = describeElement(target);
      if (!description) {
        return;
      }

      addBreadcrumb(
        createUIBreadcrumb('click', description, {
          target: getElementSelector(target),
        })
      );
    } catch {
      // Ignore errors
    }
  };

  // Use capture phase to ensure we get the event
  document.addEventListener('click', handler, { capture: true, passive: true });

  return () => {
    document.removeEventListener('click', handler, { capture: true } as EventListenerOptions);
  };
}

/**
 * Get the target element from an event
 */
function getEventTarget(event: Event): Element | null {
  try {
    if (event.target instanceof Element) {
      return event.target;
    }
  } catch {
    // Ignore errors accessing event.target
  }
  return null;
}

/**
 * Create a human-readable description of an element
 */
function describeElement(element: Element): string | null {
  const tagName = element.tagName.toLowerCase();

  // Skip body and html
  if (tagName === 'body' || tagName === 'html') {
    return null;
  }

  let description = tagName;

  // Add ID if present
  if (element.id) {
    description = `${tagName}#${element.id}`;
  }

  // Add class if present
  if (element.className && typeof element.className === 'string') {
    const classes = element.className.split(' ').filter(Boolean).slice(0, 2);
    if (classes.length > 0) {
      description += `.${classes.join('.')}`;
    }
  }

  // Add text content for buttons and links
  if (tagName === 'button' || tagName === 'a') {
    const text = element.textContent?.trim().slice(0, 32);
    if (text) {
      description += `[${text}]`;
    }
  }

  // Add type for inputs
  if (tagName === 'input') {
    const input = element as HTMLInputElement;
    description += `[type="${input.type || 'text'}"]`;
    if (input.name) {
      description += `[name="${input.name}"]`;
    }
  }

  return description;
}

/**
 * Get a CSS selector for an element
 */
function getElementSelector(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let depth = 0;
  const maxDepth = 5;

  while (current && depth < maxDepth) {
    let selector = current.tagName.toLowerCase();

    if (current.id) {
      selector = `#${current.id}`;
      parts.unshift(selector);
      break; // ID is unique, stop here
    }

    if (current.className && typeof current.className === 'string') {
      const classes = current.className.split(' ').filter(Boolean).slice(0, 2);
      if (classes.length > 0) {
        selector += `.${classes.join('.')}`;
      }
    }

    parts.unshift(selector);
    current = current.parentElement;
    depth++;
  }

  return parts.join(' > ');
}

/**
 * Instrument navigation breadcrumbs
 */
export function setupNavigationBreadcrumbs(
  addBreadcrumb: AddBreadcrumbFn
): CleanupFn {
  return instrumentHistory(addBreadcrumb);
}

/**
 * Instrument click breadcrumbs
 */
export function setupClickBreadcrumbs(
  addBreadcrumb: AddBreadcrumbFn
): CleanupFn {
  return instrumentDOM(addBreadcrumb);
}

/**
 * Instrument console breadcrumbs
 */
export function setupConsoleBreadcrumbs(
  addBreadcrumb: AddBreadcrumbFn
): CleanupFn {
  return instrumentConsole(addBreadcrumb);
}

/**
 * Instrument fetch breadcrumbs
 */
export function setupFetchBreadcrumbs(
  addBreadcrumb: AddBreadcrumbFn
): CleanupFn {
  return instrumentFetch(addBreadcrumb);
}

/**
 * Instrument XHR breadcrumbs
 */
export function setupXHRBreadcrumbs(
  addBreadcrumb: AddBreadcrumbFn
): CleanupFn {
  return instrumentXHR(addBreadcrumb);
}

/**
 * Instrument the history API to capture navigation breadcrumbs
 */
export function instrumentHistory(addBreadcrumb: AddBreadcrumbFn): CleanupFn {
  if (typeof window === 'undefined' || typeof window.history === 'undefined') {
    return () => {};
  }

  let lastUrl = getCurrentUrl();

  // Wrap pushState
  const originalPushState = window.history.pushState;
  window.history.pushState = function (...args) {
    const from = lastUrl;
    const result = originalPushState.apply(window.history, args);
    const to = getCurrentUrl();

    if (from !== to) {
      lastUrl = to;
      try {
        addBreadcrumb(createNavigationBreadcrumb(from, to));
      } catch {
        // Ignore errors
      }
    }

    return result;
  };

  // Wrap replaceState
  const originalReplaceState = window.history.replaceState;
  window.history.replaceState = function (...args) {
    const from = lastUrl;
    const result = originalReplaceState.apply(window.history, args);
    const to = getCurrentUrl();

    if (from !== to) {
      lastUrl = to;
      try {
        addBreadcrumb(createNavigationBreadcrumb(from, to));
      } catch {
        // Ignore errors
      }
    }

    return result;
  };

  // Listen for popstate
  const popstateHandler = () => {
    const from = lastUrl;
    const to = getCurrentUrl();

    if (from !== to) {
      lastUrl = to;
      try {
        addBreadcrumb(createNavigationBreadcrumb(from, to));
      } catch {
        // Ignore errors
      }
    }
  };

  window.addEventListener('popstate', popstateHandler);

  return () => {
    window.history.pushState = originalPushState;
    window.history.replaceState = originalReplaceState;
    window.removeEventListener('popstate', popstateHandler);
  };
}

/**
 * Get the current URL
 */
function getCurrentUrl(): string {
  try {
    return window.location.href;
  } catch {
    return '';
  }
}

/**
 * Instrument fetch to capture HTTP breadcrumbs
 */
export function instrumentFetch(addBreadcrumb: AddBreadcrumbFn): CleanupFn {
  if (typeof fetch === 'undefined' || typeof window === 'undefined') {
    return () => {};
  }

  const originalFetch = window.fetch;

  window.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const startTime = Date.now();
    let method = 'GET';
    let url: string;

    // Extract URL and method
    if (typeof input === 'string') {
      url = input;
    } else if (input instanceof URL) {
      url = input.toString();
    } else {
      url = input.url;
      method = input.method || 'GET';
    }

    if (init?.method) {
      method = init.method;
    }

    try {
      const response = await originalFetch.apply(window, [input, init]);
      const duration = Date.now() - startTime;

      try {
        addBreadcrumb(
          createHttpBreadcrumb(method, url, response.status, duration)
        );
      } catch {
        // Ignore errors
      }

      return response;
    } catch (error) {
      const duration = Date.now() - startTime;

      try {
        addBreadcrumb(
          createBreadcrumb(`Fetch error: ${url}`, {
            type: 'http',
            category: 'fetch',
            level: 'error',
            data: {
              method,
              url,
              duration,
              error: error instanceof Error ? error.message : String(error),
            },
          })
        );
      } catch {
        // Ignore errors
      }

      throw error;
    }
  };

  return () => {
    window.fetch = originalFetch;
  };
}

/**
 * Instrument XMLHttpRequest to capture HTTP breadcrumbs
 */
export function instrumentXHR(addBreadcrumb: AddBreadcrumbFn): CleanupFn {
  if (typeof XMLHttpRequest === 'undefined') {
    return () => {};
  }

  const xhrProto = XMLHttpRequest.prototype;
  const originalOpen = xhrProto.open;
  const originalSend = xhrProto.send;

  // Store request info on the XHR object
  const xhrInfoKey = Symbol('xhrInfo');

  interface XHRInfo {
    method: string;
    url: string;
    startTime?: number;
  }

  xhrProto.open = function (
    method: string,
    url: string | URL,
    async?: boolean,
    username?: string | null,
    password?: string | null
  ) {
    (this as XMLHttpRequest & { [xhrInfoKey]?: XHRInfo })[xhrInfoKey] = {
      method,
      url: url.toString(),
    };

    return originalOpen.apply(this, [
      method,
      url,
      async !== false, // Default to true
      username ?? null,
      password ?? null,
    ]);
  };

  xhrProto.send = function (body?: Document | XMLHttpRequestBodyInit | null) {
    const xhr = this as XMLHttpRequest & { [xhrInfoKey]?: XHRInfo };
    const info = xhr[xhrInfoKey];

    if (info) {
      info.startTime = Date.now();

      const onLoadEnd = () => {
        const duration = info.startTime ? Date.now() - info.startTime : undefined;

        try {
          addBreadcrumb(
            createHttpBreadcrumb(info.method, info.url, xhr.status, duration)
          );
        } catch {
          // Ignore errors
        }

        // Clean up
        xhr.removeEventListener('loadend', onLoadEnd);
      };

      xhr.addEventListener('loadend', onLoadEnd);
    }

    return originalSend.apply(this, [body]);
  };

  return () => {
    xhrProto.open = originalOpen;
    xhrProto.send = originalSend;
  };
}

/**
 * Create a breadcrumb from a form submission
 */
export function instrumentForms(addBreadcrumb: AddBreadcrumbFn): CleanupFn {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const handler = (event: Event) => {
    try {
      const form = event.target as HTMLFormElement;
      if (!(form instanceof HTMLFormElement)) {
        return;
      }

      addBreadcrumb(
        createBreadcrumb(`Form submission`, {
          type: 'ui',
          category: 'form.submit',
          data: {
            action: form.action,
            method: form.method.toUpperCase() || 'GET',
            name: form.name || undefined,
            id: form.id || undefined,
          },
        })
      );
    } catch {
      // Ignore errors
    }
  };

  document.addEventListener('submit', handler, { capture: true, passive: true });

  return () => {
    document.removeEventListener('submit', handler, { capture: true } as EventListenerOptions);
  };
}

/**
 * Instrument focus/blur events
 */
export function instrumentFocus(addBreadcrumb: AddBreadcrumbFn): CleanupFn {
  if (typeof document === 'undefined') {
    return () => {};
  }

  const focusHandler = (event: Event) => {
    try {
      const target = event.target as Element;
      if (!(target instanceof Element)) {
        return;
      }

      // Only track focus on interactive elements
      const tagName = target.tagName.toLowerCase();
      if (!['input', 'textarea', 'select', 'button', 'a'].includes(tagName)) {
        return;
      }

      addBreadcrumb(
        createUIBreadcrumb('focus', describeElement(target) || tagName)
      );
    } catch {
      // Ignore errors
    }
  };

  document.addEventListener('focus', focusHandler, { capture: true, passive: true });

  return () => {
    document.removeEventListener('focus', focusHandler, { capture: true } as EventListenerOptions);
  };
}
