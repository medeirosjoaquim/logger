/**
 * Stack Trace Parsing Utilities
 *
 * Parses JavaScript stack traces from different browser engines:
 * - Chrome/V8: "    at functionName (file.js:10:5)"
 * - Firefox: "functionName@file.js:10:5"
 * - Safari: "functionName@file.js:10:5"
 */

import type { StackFrame } from '../../types/sentry';

/**
 * Stack parser function type
 */
export interface StackParser {
  (stack: string, skipFirstLines?: number): StackFrame[];
}

/**
 * Regular expressions for different stack trace formats
 */

// Chrome/V8/Edge format: "    at functionName (file.js:10:5)"
// Also handles: "    at file.js:10:5" and "    at async functionName (file.js:10:5)"
const CHROME_STACK_LINE_REGEX =
  /^\s*at\s+(?:async\s+)?(?:(.+?)\s+\()?(?:(.+?):(\d+):(\d+)|([^)]+))\)?$/;

// Firefox/Safari format: "functionName@file.js:10:5"
// Also handles: "@file.js:10:5" for anonymous functions
const FIREFOX_STACK_LINE_REGEX = /^(?:(.*)@)?(.+?):(\d+):(\d+)$/;

// Safari format can also be: "functionName@file.js:10"
const SAFARI_STACK_LINE_REGEX = /^(?:(.*)@)?(.+?):(\d+)(?::(\d+))?$/;

// Detect eval wrappers like "eval at functionName (file.js:10:5)"
const EVAL_WRAPPER_REGEX = /eval\s+at\s+([^\s(]+)\s*\((.+):(\d+):(\d+)\)/;

/**
 * Parse a single Chrome/V8 stack line
 */
function parseChromeStackLine(line: string): StackFrame | null {
  const match = line.match(CHROME_STACK_LINE_REGEX);
  if (!match) {
    return null;
  }

  const [, functionName, file, lineNo, colNo, altLocation] = match;

  // Handle the case where there's no file info (e.g., native code)
  if (!file && !altLocation) {
    return null;
  }

  // Check if it's eval code
  const evalMatch = line.match(EVAL_WRAPPER_REGEX);
  if (evalMatch) {
    const [, evalFn, evalFile, evalLine, evalCol] = evalMatch;
    return {
      function: evalFn ? `eval at ${evalFn}` : 'eval',
      filename: extractFilename(evalFile),
      abs_path: normalizeUrl(evalFile),
      lineno: parseInt(evalLine, 10),
      colno: parseInt(evalCol, 10),
      in_app: isInApp(evalFile),
    };
  }

  // Handle native or internal functions
  if (altLocation && !file) {
    if (altLocation.includes('native') || altLocation === '<anonymous>') {
      return {
        function: functionName || '<anonymous>',
        filename: altLocation,
        in_app: false,
      };
    }
  }

  const filePath = file || altLocation;
  if (!filePath) {
    return null;
  }

  return {
    function: functionName || '<anonymous>',
    filename: extractFilename(filePath),
    abs_path: normalizeUrl(filePath),
    lineno: lineNo ? parseInt(lineNo, 10) : undefined,
    colno: colNo ? parseInt(colNo, 10) : undefined,
    in_app: isInApp(filePath),
  };
}

/**
 * Parse a single Firefox stack line
 */
function parseFirefoxStackLine(line: string): StackFrame | null {
  // Try Firefox format first
  let match = line.match(FIREFOX_STACK_LINE_REGEX);

  // Fall back to Safari format if Firefox doesn't match
  if (!match) {
    match = line.match(SAFARI_STACK_LINE_REGEX);
  }

  if (!match) {
    return null;
  }

  const [, functionName, file, lineNo, colNo] = match;

  // Skip empty or invalid entries
  if (!file || file === '[native code]') {
    return {
      function: functionName || '<anonymous>',
      filename: '[native code]',
      in_app: false,
    };
  }

  return {
    function: functionName || '<anonymous>',
    filename: extractFilename(file),
    abs_path: normalizeUrl(file),
    lineno: lineNo ? parseInt(lineNo, 10) : undefined,
    colno: colNo ? parseInt(colNo, 10) : undefined,
    in_app: isInApp(file),
  };
}

/**
 * Chrome/V8 stack parser
 */
export const chromeStackParser: StackParser = (
  stack: string,
  skipFirstLines = 0
): StackFrame[] => {
  const lines = stack.split('\n');
  const frames: StackFrame[] = [];

  // Skip the error message line and any requested lines
  let startIndex = 0;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trim().startsWith('at ')) {
      startIndex = i;
      break;
    }
  }

  for (let i = startIndex + skipFirstLines; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const frame = parseChromeStackLine(line);
    if (frame) {
      frames.push(frame);
    }
  }

  // Reverse to get oldest-to-newest order (Sentry convention)
  return frames.reverse();
};

/**
 * Firefox stack parser
 */
export const firefoxStackParser: StackParser = (
  stack: string,
  skipFirstLines = 0
): StackFrame[] => {
  const lines = stack.split('\n');
  const frames: StackFrame[] = [];

  // Firefox doesn't have the error message as a separate line
  for (let i = skipFirstLines; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const frame = parseFirefoxStackLine(line);
    if (frame) {
      frames.push(frame);
    }
  }

  // Reverse to get oldest-to-newest order (Sentry convention)
  return frames.reverse();
};

/**
 * Safari stack parser (same format as Firefox)
 */
export const safariStackParser: StackParser = firefoxStackParser;

/**
 * Detect the stack trace format
 */
function detectStackFormat(
  stack: string
): 'chrome' | 'firefox' | 'safari' | 'unknown' {
  const lines = stack.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Chrome format has "at " prefix
    if (trimmed.startsWith('at ')) {
      return 'chrome';
    }

    // Firefox/Safari format has function@file:line:column or @file:line:column
    if (trimmed.includes('@') && trimmed.match(/:\d+:\d+$/)) {
      // Try to distinguish Safari from Firefox
      // In practice, they use the same format
      return 'firefox';
    }

    // Safari might not have column numbers
    if (trimmed.includes('@') && trimmed.match(/:\d+$/)) {
      return 'safari';
    }
  }

  return 'unknown';
}

/**
 * Combined parser that auto-detects format
 */
export function parseStack(stack: string, skipFirstLines = 0): StackFrame[] {
  if (!stack) {
    return [];
  }

  const format = detectStackFormat(stack);

  switch (format) {
    case 'chrome':
      return chromeStackParser(stack, skipFirstLines);
    case 'firefox':
      return firefoxStackParser(stack, skipFirstLines);
    case 'safari':
      return safariStackParser(stack, skipFirstLines);
    default:
      // Try Chrome first, then Firefox as fallback
      const chromeFrames = chromeStackParser(stack, skipFirstLines);
      if (chromeFrames.length > 0) {
        return chromeFrames;
      }
      return firefoxStackParser(stack, skipFirstLines);
  }
}

/**
 * Extract filename from a full path or URL
 */
export function extractFilename(absPath: string): string {
  if (!absPath) {
    return '<anonymous>';
  }

  // Remove query string and hash
  let path = absPath.split('?')[0].split('#')[0];

  // Handle webpack/bundler paths like "webpack://..."
  if (path.includes('webpack://')) {
    path = path.replace(/^webpack:\/\/[^/]*\//, '');
  }

  // Handle file:// URLs
  if (path.startsWith('file://')) {
    path = path.replace('file://', '');
  }

  // Get the last part of the path
  const segments = path.split('/');
  const filename = segments[segments.length - 1];

  return filename || absPath;
}

/**
 * Normalize a URL for consistent comparison
 */
export function normalizeUrl(url: string): string {
  if (!url) {
    return '';
  }

  // Remove query string and hash
  let normalized = url.split('?')[0].split('#')[0];

  // Normalize webpack URLs
  if (normalized.includes('webpack://')) {
    normalized = normalized.replace(/^webpack:\/\/[^/]*/, 'webpack://.');
  }

  // Ensure consistent protocol format
  if (normalized.startsWith('//')) {
    normalized = 'https:' + normalized;
  }

  return normalized;
}

/**
 * Determine if a frame is from application code (vs library/vendor code)
 */
export function isInApp(filename: string): boolean {
  if (!filename) {
    return true;
  }

  // Lowercase for comparison
  const lower = filename.toLowerCase();

  // Common patterns for library/vendor code
  const libraryPatterns = [
    'node_modules',
    '/vendor/',
    '/vendors/',
    '/lib/',
    '/libs/',
    '/dist/',
    '/build/',
    '/bundle/',
    'webpack://',
    'webpack-internal://',
    '<anonymous>',
    '[native code]',
    'native',
    'unknown',
    // Common CDNs
    'unpkg.com',
    'cdnjs.cloudflare.com',
    'jsdelivr.net',
    'cdn.',
    // Browser internals
    'extensions://',
    'chrome-extension://',
    'moz-extension://',
    'safari-extension://',
  ];

  for (const pattern of libraryPatterns) {
    if (lower.includes(pattern)) {
      return false;
    }
  }

  return true;
}

/**
 * Create a synthetic stack trace from the current call site
 */
export function createSyntheticStacktrace(
  skipFrames = 0
): StackFrame[] | undefined {
  const err = new Error();
  if (!err.stack) {
    return undefined;
  }

  // Skip at least 2 frames: Error constructor and this function
  return parseStack(err.stack, skipFrames + 2);
}
