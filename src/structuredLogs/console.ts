/**
 * Console Integration for Structured Logs
 *
 * Provides optional interception of console.log/warn/error calls
 * and converts them to structured logs.
 */

import type {
  ConsoleMethod,
  ConsoleIntegrationOptions,
  LogLevel,
  LogAttributes,
} from './types';
import { getLogger, StructuredLogger } from './logger';

/**
 * Map console methods to log levels
 */
const CONSOLE_METHOD_TO_LEVEL: Record<ConsoleMethod, LogLevel> = {
  log: 'info',
  debug: 'debug',
  info: 'info',
  warn: 'warn',
  error: 'error',
};

/**
 * Default console integration options
 */
const DEFAULT_OPTIONS: Required<ConsoleIntegrationOptions> = {
  levels: ['log', 'warn', 'error'],
  passthrough: true,
  prefix: '',
};

/**
 * Original console methods storage
 */
interface OriginalConsoleMethods {
  log?: typeof console.log;
  debug?: typeof console.debug;
  info?: typeof console.info;
  warn?: typeof console.warn;
  error?: typeof console.error;
}

/**
 * Stored original console methods
 */
let originalMethods: OriginalConsoleMethods = {};

/**
 * Whether console integration is currently active
 */
let isIntegrationActive = false;

/**
 * Current integration options
 */
let currentOptions: Required<ConsoleIntegrationOptions> = { ...DEFAULT_OPTIONS };

/**
 * Current logger instance
 */
let currentLogger: StructuredLogger | undefined;

/**
 * Format console arguments into a message string
 */
function formatConsoleArgs(args: unknown[]): string {
  return args
    .map((arg) => {
      if (typeof arg === 'string') {
        return arg;
      }
      if (typeof arg === 'object' && arg !== null) {
        try {
          return JSON.stringify(arg);
        } catch {
          return String(arg);
        }
      }
      return String(arg);
    })
    .join(' ');
}

/**
 * Extract attributes from console arguments
 *
 * If the last argument is an object with only primitive values,
 * it's treated as attributes
 */
function extractAttributes(args: unknown[]): {
  message: string;
  attributes: LogAttributes;
} {
  const attributes: LogAttributes = {};
  let messageArgs = args;

  // Check if last argument is an attributes object
  if (args.length > 1) {
    const lastArg = args[args.length - 1];
    if (
      typeof lastArg === 'object' &&
      lastArg !== null &&
      !Array.isArray(lastArg)
    ) {
      // Check if all values are primitives
      const entries = Object.entries(lastArg as Record<string, unknown>);
      const allPrimitives = entries.every(
        ([, v]) =>
          typeof v === 'string' ||
          typeof v === 'number' ||
          typeof v === 'boolean'
      );

      if (allPrimitives) {
        messageArgs = args.slice(0, -1);
        for (const [key, value] of entries) {
          attributes[key] = value as string | number | boolean;
        }
      }
    }
  }

  const message = formatConsoleArgs(messageArgs);
  return { message, attributes };
}

/**
 * Create a wrapped console method
 */
function createWrappedMethod(
  method: ConsoleMethod,
  original: (...args: unknown[]) => void,
  logger: StructuredLogger,
  options: Required<ConsoleIntegrationOptions>
): (...args: unknown[]) => void {
  const level = CONSOLE_METHOD_TO_LEVEL[method];

  return function (...args: unknown[]): void {
    // Extract message and attributes
    const { message, attributes } = extractAttributes(args);

    // Add prefix if configured
    const finalMessage = options.prefix
      ? `${options.prefix}${message}`
      : message;

    // Mark as from console integration
    attributes['sentry.origin'] = 'console';
    attributes['console.method'] = method;

    // Log to structured logger
    logger[level](finalMessage, attributes);

    // Call original method if passthrough is enabled
    if (options.passthrough) {
      original.apply(console, args);
    }
  };
}

/**
 * Install console integration
 *
 * Wraps console methods to capture logs as structured logs
 */
export function installConsoleIntegration(
  options: ConsoleIntegrationOptions = {},
  logger?: StructuredLogger
): void {
  if (isIntegrationActive) {
    // Already installed, update options
    currentOptions = { ...DEFAULT_OPTIONS, ...options };
    return;
  }

  currentOptions = { ...DEFAULT_OPTIONS, ...options };
  currentLogger = logger || getLogger();

  // Store original methods and install wrappers
  for (const method of currentOptions.levels) {
    const original = console[method];
    if (typeof original === 'function') {
      originalMethods[method] = original.bind(console);
      (console as unknown as Record<string, unknown>)[method] = createWrappedMethod(
        method,
        original,
        currentLogger,
        currentOptions
      );
    }
  }

  isIntegrationActive = true;
}

/**
 * Uninstall console integration
 *
 * Restores original console methods
 */
export function uninstallConsoleIntegration(): void {
  if (!isIntegrationActive) {
    return;
  }

  // Restore original methods
  for (const [method, original] of Object.entries(originalMethods)) {
    if (original) {
      (console as unknown as Record<string, unknown>)[method] = original;
    }
  }

  originalMethods = {};
  isIntegrationActive = false;
  currentLogger = undefined;
}

/**
 * Check if console integration is active
 */
export function isConsoleIntegrationActive(): boolean {
  return isIntegrationActive;
}

/**
 * Update console integration options
 */
export function updateConsoleIntegrationOptions(
  options: Partial<ConsoleIntegrationOptions>
): void {
  if (!isIntegrationActive) {
    return;
  }

  // Uninstall and reinstall with new options
  uninstallConsoleIntegration();
  installConsoleIntegration({ ...currentOptions, ...options }, currentLogger);
}

/**
 * Console logging integration factory
 *
 * Creates an integration object compatible with Sentry's integration system
 */
export function consoleLoggingIntegration(
  options: ConsoleIntegrationOptions = {}
): {
  name: string;
  setup: () => void;
  setupOnce: () => void;
  teardown: () => void;
} {
  return {
    name: 'ConsoleLogging',

    setup(): void {
      installConsoleIntegration(options);
    },

    setupOnce(): void {
      // Same as setup for this integration
      installConsoleIntegration(options);
    },

    teardown(): void {
      uninstallConsoleIntegration();
    },
  };
}

/**
 * Temporarily disable console integration
 *
 * Useful when you need to log something without capturing it
 */
export function withoutConsoleCapture<T>(callback: () => T): T {
  if (!isIntegrationActive) {
    return callback();
  }

  const wasActive = isIntegrationActive;
  const savedOptions = { ...currentOptions };
  const savedLogger = currentLogger;

  uninstallConsoleIntegration();

  try {
    return callback();
  } finally {
    if (wasActive) {
      installConsoleIntegration(savedOptions, savedLogger);
    }
  }
}

/**
 * Create a console proxy that captures logs without modifying global console
 *
 * Useful for capturing logs in specific contexts without global side effects
 */
export function createConsoleProxy(
  logger: StructuredLogger = getLogger(),
  options: ConsoleIntegrationOptions = {}
): Console {
  const finalOptions = { ...DEFAULT_OPTIONS, ...options };

  const proxy = {} as Console;

  // Copy all console properties
  for (const key of Object.getOwnPropertyNames(console)) {
    const descriptor = Object.getOwnPropertyDescriptor(console, key);
    if (descriptor) {
      Object.defineProperty(proxy, key, descriptor);
    }
  }

  // Override specified methods
  for (const method of finalOptions.levels) {
    const original = console[method];
    if (typeof original === 'function') {
      (proxy as unknown as Record<string, unknown>)[method] = createWrappedMethod(
        method,
        original,
        logger,
        finalOptions
      );
    }
  }

  return proxy;
}
