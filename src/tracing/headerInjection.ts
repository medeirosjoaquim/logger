/**
 * Header Injection for Distributed Tracing
 *
 * Provides utilities for injecting trace headers into outgoing HTTP requests
 * and checking URL patterns for trace propagation.
 */

import { Span } from './span.js';
import { generateSentryTraceHeader, generateBaggageHeader } from './propagation.js';
import type { DynamicSamplingContext } from './types.js';

/**
 * Check if a URL matches any of the propagation targets
 *
 * @param url - The URL to check
 * @param targets - Array of string or RegExp patterns to match against
 * @returns True if the URL matches any target
 */
export function shouldPropagateTo(url: string, targets: (string | RegExp)[]): boolean {
  // If no targets specified, don't propagate by default
  if (!targets || targets.length === 0) {
    return false;
  }

  for (const target of targets) {
    if (typeof target === 'string') {
      // String matching - check if URL contains the target string
      if (url.includes(target)) {
        return true;
      }
    } else if (target instanceof RegExp) {
      // RegExp matching
      if (target.test(url)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Check if a URL is same-origin as the current page
 *
 * @param url - The URL to check
 * @returns True if same-origin
 */
export function isSameOrigin(url: string): boolean {
  if (typeof window === 'undefined' || !window.location) {
    return false;
  }

  try {
    const parsedUrl = new URL(url, window.location.href);
    return (
      parsedUrl.protocol === window.location.protocol &&
      parsedUrl.host === window.location.host
    );
  } catch {
    return false;
  }
}

/**
 * Get the full URL from a fetch input
 *
 * @param input - The fetch input (string, URL, or Request)
 * @returns The full URL string
 */
export function getUrlFromFetchInput(input: RequestInfo | URL): string {
  if (typeof input === 'string') {
    return input;
  }
  if (input instanceof URL) {
    return input.href;
  }
  // Request object
  return input.url;
}

/**
 * Create trace headers for a span
 *
 * @param span - The span to generate headers for
 * @param dsc - Optional dynamic sampling context
 * @returns Object containing sentry-trace and baggage headers
 */
export function createTraceHeaders(
  span: Span,
  dsc?: Partial<DynamicSamplingContext>
): { 'sentry-trace': string; baggage: string } {
  const sentryTraceHeader = generateSentryTraceHeader(span);

  // Build DSC from span if not provided
  const fullDsc: DynamicSamplingContext = {
    trace_id: span.traceId,
    public_key: dsc?.public_key || '',
    release: dsc?.release,
    environment: dsc?.environment,
    transaction: dsc?.transaction || span.name,
    sample_rate: dsc?.sample_rate,
    sampled: span.sampled !== undefined ? String(span.sampled) : undefined,
  };

  const baggageHeader = generateBaggageHeader(fullDsc);

  return {
    'sentry-trace': sentryTraceHeader,
    baggage: baggageHeader,
  };
}

/**
 * Inject tracing headers into fetch RequestInit
 *
 * @param input - The fetch input (URL, string, or Request)
 * @param init - The RequestInit options (may be undefined)
 * @param span - The span to get trace context from
 * @param dsc - Optional dynamic sampling context
 * @returns New RequestInit with tracing headers injected
 */
export function injectTracingHeaders(
  input: RequestInfo | URL,
  init: RequestInit | undefined,
  span: Span,
  dsc?: Partial<DynamicSamplingContext>
): RequestInit {
  const traceHeaders = createTraceHeaders(span, dsc);

  // Clone the init object or create a new one
  const newInit: RequestInit = { ...init };

  // Handle headers - they can be Headers, array of arrays, or object
  if (newInit.headers instanceof Headers) {
    // Clone Headers object
    const headers = new Headers(newInit.headers);
    headers.set('sentry-trace', traceHeaders['sentry-trace']);

    // Merge baggage if existing
    const existingBaggage = headers.get('baggage');
    if (existingBaggage) {
      headers.set('baggage', `${existingBaggage},${traceHeaders.baggage}`);
    } else {
      headers.set('baggage', traceHeaders.baggage);
    }

    newInit.headers = headers;
  } else if (Array.isArray(newInit.headers)) {
    // Array of [key, value] pairs
    const headers = [...newInit.headers];

    // Remove existing sentry-trace if present
    const filteredHeaders = headers.filter(
      ([key]) => key.toLowerCase() !== 'sentry-trace'
    );

    // Find and merge baggage
    const baggageIndex = filteredHeaders.findIndex(
      ([key]) => key.toLowerCase() === 'baggage'
    );

    if (baggageIndex >= 0) {
      const [key, value] = filteredHeaders[baggageIndex];
      filteredHeaders[baggageIndex] = [key, `${value},${traceHeaders.baggage}`];
    } else {
      filteredHeaders.push(['baggage', traceHeaders.baggage]);
    }

    filteredHeaders.push(['sentry-trace', traceHeaders['sentry-trace']]);
    newInit.headers = filteredHeaders;
  } else {
    // Plain object or undefined
    const headers: Record<string, string> = { ...(newInit.headers as Record<string, string>) };

    headers['sentry-trace'] = traceHeaders['sentry-trace'];

    // Merge baggage if existing
    const baggageKey = Object.keys(headers).find(
      (k) => k.toLowerCase() === 'baggage'
    );
    if (baggageKey) {
      headers[baggageKey] = `${headers[baggageKey]},${traceHeaders.baggage}`;
    } else {
      headers['baggage'] = traceHeaders.baggage;
    }

    newInit.headers = headers;
  }

  // If input is a Request, we need to preserve its body
  if (typeof input !== 'string' && !(input instanceof URL) && input.body && !newInit.body) {
    // Don't attempt to clone body, it may have already been consumed
    // The caller should handle this case
  }

  return newInit;
}

/**
 * Inject tracing headers into XMLHttpRequest
 *
 * @param xhr - The XMLHttpRequest to inject headers into
 * @param span - The span to get trace context from
 * @param dsc - Optional dynamic sampling context
 */
export function injectXHRHeaders(
  xhr: XMLHttpRequest,
  span: Span,
  dsc?: Partial<DynamicSamplingContext>
): void {
  const traceHeaders = createTraceHeaders(span, dsc);

  try {
    xhr.setRequestHeader('sentry-trace', traceHeaders['sentry-trace']);
    xhr.setRequestHeader('baggage', traceHeaders.baggage);
  } catch {
    // XMLHttpRequest may throw if headers are already sent
    // or if the state is not OPENED
  }
}

/**
 * Check if we should inject headers for a given URL
 *
 * @param url - The URL to check
 * @param tracePropagationTargets - Array of allowed targets
 * @param allowSameOrigin - Whether to allow same-origin requests even if not in targets
 * @returns True if headers should be injected
 */
export function shouldInjectHeaders(
  url: string,
  tracePropagationTargets: (string | RegExp)[] | undefined,
  allowSameOrigin: boolean = true
): boolean {
  // Check if URL matches propagation targets
  if (tracePropagationTargets && tracePropagationTargets.length > 0) {
    return shouldPropagateTo(url, tracePropagationTargets);
  }

  // If no targets specified, optionally allow same-origin
  if (allowSameOrigin) {
    return isSameOrigin(url);
  }

  return false;
}

/**
 * Options for the tracing header injector
 */
export interface TracingHeaderInjectorOptions {
  /**
   * URL patterns to propagate traces to
   */
  tracePropagationTargets?: (string | RegExp)[];

  /**
   * Whether to propagate to same-origin requests even if not in targets
   * @default true
   */
  allowSameOrigin?: boolean;

  /**
   * Dynamic sampling context to include in headers
   */
  dsc?: Partial<DynamicSamplingContext>;
}

/**
 * Create a tracing header injector function for use with fetch wrappers
 *
 * @param options - Injector options
 * @returns Function that takes span and returns a fetch interceptor
 */
export function createTracingHeaderInjector(
  options: TracingHeaderInjectorOptions
): (span: Span) => {
  shouldInject: (url: string) => boolean;
  inject: (input: RequestInfo | URL, init?: RequestInit) => RequestInit;
  injectXHR: (xhr: XMLHttpRequest) => void;
} {
  const {
    tracePropagationTargets = [],
    allowSameOrigin = true,
    dsc,
  } = options;

  return (span: Span) => ({
    shouldInject: (url: string) =>
      shouldInjectHeaders(url, tracePropagationTargets, allowSameOrigin),

    inject: (input: RequestInfo | URL, init?: RequestInit) =>
      injectTracingHeaders(input, init, span, dsc),

    injectXHR: (xhr: XMLHttpRequest) => injectXHRHeaders(xhr, span, dsc),
  });
}
