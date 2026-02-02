/**
 * TryCatch Integration
 *
 * Wraps timer functions and event listeners to capture errors.
 */

import type { Integration, IntegrationClient } from './types.js';
import type { Mechanism } from '../types/sentry.js';

/**
 * Options for the trycatch integration
 */
export interface TryCatchIntegrationOptions {
  /**
   * Whether to wrap setTimeout
   * @default true
   */
  setTimeout?: boolean;

  /**
   * Whether to wrap setInterval
   * @default true
   */
  setInterval?: boolean;

  /**
   * Whether to wrap requestAnimationFrame
   * @default true
   */
  requestAnimationFrame?: boolean;

  /**
   * Whether to wrap event listeners
   * @default true
   */
  eventTarget?: boolean;

  /**
   * Event targets to wrap
   * @default ['EventTarget', 'Window', 'Node', 'Document', 'XMLHttpRequest']
   */
  eventTargets?: string[];
}

/**
 * Store original functions for restoration
 */
interface OriginalFunctions {
  setTimeout?: typeof setTimeout;
  setInterval?: typeof setInterval;
  requestAnimationFrame?: typeof requestAnimationFrame;
  addEventListener?: Map<EventTarget, typeof EventTarget.prototype.addEventListener>;
  removeEventListener?: Map<EventTarget, typeof EventTarget.prototype.removeEventListener>;
}

/**
 * Create the trycatch integration
 */
export function tryCatchIntegration(options: TryCatchIntegrationOptions = {}): Integration {
  const {
    setTimeout: wrapSetTimeout = true,
    setInterval: wrapSetInterval = true,
    requestAnimationFrame: wrapRAF = true,
    eventTarget: wrapEventTarget = true,
    eventTargets = ['EventTarget', 'Window', 'Node', 'Document', 'XMLHttpRequest'],
  } = options;

  let client: IntegrationClient | null = null;
  const originals: OriginalFunctions = {};
  const wrappedListeners = new WeakMap<Function, Function>();

  /**
   * Create a wrapped function that catches errors
   */
  function wrap(fn: Function, mechanism: Mechanism): Function {
    // Already wrapped
    if (wrappedListeners.has(fn)) {
      return wrappedListeners.get(fn)!;
    }

    const wrapped = function (this: unknown, ...args: unknown[]) {
      try {
        return fn.apply(this, args);
      } catch (error) {
        if (client && error instanceof Error) {
          client.captureException(error, { mechanism });
        }
        throw error;
      }
    };

    wrappedListeners.set(fn, wrapped);
    return wrapped;
  }

  /**
   * Wrap setTimeout
   */
  function wrapSetTimeoutFn(): void {
    if (typeof globalThis.setTimeout === 'undefined') return;

    originals.setTimeout = globalThis.setTimeout;

    (globalThis as unknown as { setTimeout: typeof setTimeout }).setTimeout = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (typeof callback === 'function') {
        const wrapped = wrap(callback, {
          type: 'setTimeout',
          handled: false,
        });
        return originals.setTimeout!(wrapped as TimerHandler, delay, ...args);
      }
      return originals.setTimeout!(callback, delay, ...args);
    }) as unknown as typeof setTimeout;
  }

  /**
   * Wrap setInterval
   */
  function wrapSetIntervalFn(): void {
    if (typeof globalThis.setInterval === 'undefined') return;

    originals.setInterval = globalThis.setInterval;

    (globalThis as unknown as { setInterval: typeof setInterval }).setInterval = ((
      callback: TimerHandler,
      delay?: number,
      ...args: unknown[]
    ) => {
      if (typeof callback === 'function') {
        const wrapped = wrap(callback, {
          type: 'setInterval',
          handled: false,
        });
        return originals.setInterval!(wrapped as TimerHandler, delay, ...args);
      }
      return originals.setInterval!(callback, delay, ...args);
    }) as unknown as typeof setInterval;
  }

  /**
   * Wrap requestAnimationFrame
   */
  function wrapRequestAnimationFrameFn(): void {
    if (typeof globalThis.requestAnimationFrame === 'undefined') return;

    originals.requestAnimationFrame = globalThis.requestAnimationFrame;

    globalThis.requestAnimationFrame = function (callback: FrameRequestCallback): number {
      const wrapped = wrap(callback, {
        type: 'requestAnimationFrame',
        handled: false,
      });
      return originals.requestAnimationFrame!(wrapped as FrameRequestCallback);
    };
  }

  /**
   * Wrap event target addEventListener
   */
  function wrapEventTargets(): void {
    if (typeof globalThis === 'undefined') return;

    originals.addEventListener = new Map();
    originals.removeEventListener = new Map();

    for (const targetName of eventTargets) {
      const target = (globalThis as Record<string, unknown>)[targetName] as
        | { prototype: EventTarget }
        | undefined;

      if (!target || !target.prototype) continue;

      const proto = target.prototype;
      const originalAdd = proto.addEventListener;
      const originalRemove = proto.removeEventListener;

      originals.addEventListener.set(proto, originalAdd);
      originals.removeEventListener.set(proto, originalRemove);

      proto.addEventListener = function (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | AddEventListenerOptions
      ) {
        if (!listener) {
          return originalAdd.call(this, type, listener, options);
        }

        // Handle EventListenerObject
        const fn =
          typeof listener === 'function' ? listener : listener.handleEvent?.bind(listener);

        if (!fn) {
          return originalAdd.call(this, type, listener, options);
        }

        const wrapped = wrap(fn, {
          type: 'eventListener',
          handled: false,
          data: { eventType: type },
        });

        // Store mapping for removeEventListener
        wrappedListeners.set(fn, wrapped);

        // Create wrapped listener object if needed
        const wrappedListener: EventListenerOrEventListenerObject =
          typeof listener === 'function'
            ? (wrapped as EventListener)
            : { handleEvent: wrapped as EventListener };

        return originalAdd.call(this, type, wrappedListener, options);
      };

      proto.removeEventListener = function (
        type: string,
        listener: EventListenerOrEventListenerObject | null,
        options?: boolean | EventListenerOptions
      ) {
        if (!listener) {
          return originalRemove.call(this, type, listener, options);
        }

        const fn =
          typeof listener === 'function' ? listener : listener.handleEvent?.bind(listener);

        if (!fn) {
          return originalRemove.call(this, type, listener, options);
        }

        const wrapped = wrappedListeners.get(fn);
        if (wrapped) {
          const wrappedListener: EventListenerOrEventListenerObject =
            typeof listener === 'function'
              ? (wrapped as EventListener)
              : { handleEvent: wrapped as EventListener };

          return originalRemove.call(this, type, wrappedListener, options);
        }

        return originalRemove.call(this, type, listener, options);
      };
    }
  }

  /**
   * Restore all wrapped functions
   */
  function restore(): void {
    if (originals.setTimeout) {
      globalThis.setTimeout = originals.setTimeout;
    }

    if (originals.setInterval) {
      globalThis.setInterval = originals.setInterval;
    }

    if (originals.requestAnimationFrame) {
      globalThis.requestAnimationFrame = originals.requestAnimationFrame;
    }

    if (originals.addEventListener) {
      for (const [proto, original] of originals.addEventListener.entries()) {
        (proto as EventTarget).addEventListener = original;
      }
    }

    if (originals.removeEventListener) {
      for (const [proto, original] of originals.removeEventListener.entries()) {
        (proto as EventTarget).removeEventListener = original;
      }
    }
  }

  return {
    name: 'TryCatch',

    setupOnce() {
      // Wrap timer functions globally (once)
      if (wrapSetTimeout) {
        wrapSetTimeoutFn();
      }

      if (wrapSetInterval) {
        wrapSetIntervalFn();
      }

      if (wrapRAF) {
        wrapRequestAnimationFrameFn();
      }

      if (wrapEventTarget) {
        wrapEventTargets();
      }
    },

    setup(c: IntegrationClient) {
      client = c;
    },

    teardown() {
      restore();
      client = null;
    },
  };
}
