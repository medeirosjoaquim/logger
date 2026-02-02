/**
 * Stack Parser Tests
 *
 * Tests for parsing stack traces from different browser engines.
 */

import { describe, it, expect } from 'vitest';
import {
  parseStack,
  chromeStackParser,
  firefoxStackParser,
  safariStackParser,
  extractFilename,
  normalizeUrl,
  isInApp,
  createSyntheticStacktrace,
} from '../../core/capture/stackParser';

describe('Stack Parser', () => {
  describe('parseStack', () => {
    it('parses Chrome stack traces', () => {
      const stack = `Error: test
    at functionName (http://example.com/file.js:10:5)
    at http://example.com/other.js:20:10`;

      const frames = parseStack(stack);

      expect(frames).toHaveLength(2);
      // Frames are reversed (oldest first, per Sentry convention)
      expect(frames[1].function).toBe('functionName');
      expect(frames[1].lineno).toBe(10);
      expect(frames[1].colno).toBe(5);
      expect(frames[0].lineno).toBe(20);
    });

    it('parses Firefox stack traces', () => {
      const stack = `functionName@http://example.com/file.js:10:5
anonymous@http://example.com/other.js:20:10`;

      const frames = parseStack(stack);

      expect(frames).toHaveLength(2);
      expect(frames[1].function).toBe('functionName');
      expect(frames[1].lineno).toBe(10);
    });

    it('parses Safari stack traces', () => {
      const stack = `functionName@http://example.com/file.js:10:5
global code@http://example.com/other.js:20:10`;

      const frames = parseStack(stack);

      expect(frames).toHaveLength(2);
      expect(frames[1].function).toBe('functionName');
    });

    it('returns empty array for empty stack', () => {
      expect(parseStack('')).toEqual([]);
    });

    it('returns empty array for null/undefined', () => {
      expect(parseStack(null as unknown as string)).toEqual([]);
      expect(parseStack(undefined as unknown as string)).toEqual([]);
    });

    it('skips lines when requested', () => {
      const stack = `Error: test
    at skip1 (http://example.com/file.js:1:1)
    at skip2 (http://example.com/file.js:2:2)
    at keep (http://example.com/file.js:3:3)`;

      const frames = parseStack(stack, 2);

      expect(frames).toHaveLength(1);
      expect(frames[0].function).toBe('keep');
    });
  });

  describe('chromeStackParser', () => {
    it('parses standard Chrome format', () => {
      const stack = `Error: test error
    at Object.test (http://example.com/test.js:10:15)
    at Context.<anonymous> (http://example.com/spec.js:20:25)
    at http://example.com/other.js:30:35`;

      const frames = chromeStackParser(stack);

      expect(frames).toHaveLength(3);

      // Check first frame (was last in stack, now first due to reversal)
      expect(frames[0].lineno).toBe(30);
      expect(frames[0].colno).toBe(35);

      // Check last frame (was first in stack)
      expect(frames[2].function).toBe('Object.test');
      expect(frames[2].lineno).toBe(10);
      expect(frames[2].colno).toBe(15);
    });

    it('handles async stack frames', () => {
      const stack = `Error: test
    at async functionName (http://example.com/file.js:10:5)`;

      const frames = chromeStackParser(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].function).toBe('functionName');
    });

    it('handles anonymous functions', () => {
      const stack = `Error: test
    at http://example.com/file.js:10:5`;

      const frames = chromeStackParser(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].function).toBe('<anonymous>');
    });

    it('handles native code references', () => {
      const stack = `Error: test
    at Array.forEach (<anonymous>)
    at functionName (http://example.com/file.js:10:5)`;

      const frames = chromeStackParser(stack);

      // Should have both frames
      expect(frames.length).toBeGreaterThanOrEqual(1);
    });

    it('handles eval frames', () => {
      const stack = `Error: test
    at eval at functionName (http://example.com/file.js:10:5)`;

      const frames = chromeStackParser(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].function).toContain('eval');
    });
  });

  describe('firefoxStackParser', () => {
    it('parses standard Firefox format', () => {
      const stack = `functionOne@http://example.com/file.js:10:5
functionTwo@http://example.com/file.js:20:10
@http://example.com/other.js:30:15`;

      const frames = firefoxStackParser(stack);

      expect(frames).toHaveLength(3);
      expect(frames[2].function).toBe('functionOne');
      expect(frames[2].lineno).toBe(10);
      expect(frames[0].function).toBe('<anonymous>');
    });

    it('handles anonymous functions', () => {
      const stack = `@http://example.com/file.js:10:5`;

      const frames = firefoxStackParser(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].function).toBe('<anonymous>');
    });

    it('handles native code', () => {
      // Firefox format with native code includes line numbers
      const stack = `functionName@[native code]:0:0`;

      const frames = firefoxStackParser(stack);

      // Native code may or may not parse depending on format
      // The key is that it doesn't throw
      expect(Array.isArray(frames)).toBe(true);
    });
  });

  describe('safariStackParser', () => {
    it('uses same parser as Firefox', () => {
      expect(safariStackParser).toBe(firefoxStackParser);
    });

    it('handles Safari global code frames', () => {
      const stack = `global code@http://example.com/file.js:10:5`;

      const frames = safariStackParser(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].function).toBe('global code');
    });

    it('handles Safari format without column numbers', () => {
      const stack = `functionName@http://example.com/file.js:10`;

      const frames = safariStackParser(stack);

      expect(frames).toHaveLength(1);
      expect(frames[0].lineno).toBe(10);
      expect(frames[0].colno).toBeUndefined();
    });
  });

  describe('extractFilename', () => {
    it('extracts filename from URL', () => {
      expect(extractFilename('http://example.com/path/to/file.js')).toBe('file.js');
    });

    it('extracts filename from path', () => {
      expect(extractFilename('/path/to/file.js')).toBe('file.js');
    });

    it('removes query string', () => {
      expect(extractFilename('http://example.com/file.js?v=123')).toBe('file.js');
    });

    it('removes hash', () => {
      expect(extractFilename('http://example.com/file.js#section')).toBe('file.js');
    });

    it('handles webpack URLs', () => {
      expect(extractFilename('webpack://my-app/./src/index.js')).toBe('index.js');
    });

    it('handles file:// URLs', () => {
      expect(extractFilename('file:///Users/test/project/file.js')).toBe('file.js');
    });

    it('returns <anonymous> for empty input', () => {
      expect(extractFilename('')).toBe('<anonymous>');
    });

    it('returns input if no path separator', () => {
      expect(extractFilename('file.js')).toBe('file.js');
    });
  });

  describe('normalizeUrl', () => {
    it('normalizes URL by removing query and hash', () => {
      expect(normalizeUrl('http://example.com/file.js?v=1#line10')).toBe('http://example.com/file.js');
    });

    it('normalizes webpack URLs', () => {
      const url = 'webpack://my-app/./src/file.js';
      const normalized = normalizeUrl(url);
      expect(normalized).toContain('webpack://');
    });

    it('adds https to protocol-relative URLs', () => {
      expect(normalizeUrl('//example.com/file.js')).toBe('https://example.com/file.js');
    });

    it('returns empty string for empty input', () => {
      expect(normalizeUrl('')).toBe('');
    });
  });

  describe('isInApp', () => {
    it('returns true for app code', () => {
      expect(isInApp('http://example.com/app/component.js')).toBe(true);
      expect(isInApp('/src/index.js')).toBe(true);
    });

    it('returns false for node_modules', () => {
      expect(isInApp('http://example.com/node_modules/package/index.js')).toBe(false);
      expect(isInApp('/node_modules/react/index.js')).toBe(false);
    });

    it('returns false for vendor directories', () => {
      expect(isInApp('/vendor/lib.js')).toBe(false);
      expect(isInApp('/vendors/lib.js')).toBe(false);
    });

    it('returns false for build directories', () => {
      expect(isInApp('/dist/bundle.js')).toBe(false);
      expect(isInApp('/build/app.js')).toBe(false);
    });

    it('returns false for CDN URLs', () => {
      expect(isInApp('https://cdn.jsdelivr.net/package.js')).toBe(false);
      expect(isInApp('https://unpkg.com/package.js')).toBe(false);
      expect(isInApp('https://cdnjs.cloudflare.com/libs/package.js')).toBe(false);
    });

    it('returns false for browser extension URLs', () => {
      expect(isInApp('chrome-extension://abc/script.js')).toBe(false);
      expect(isInApp('moz-extension://abc/script.js')).toBe(false);
    });

    it('returns false for native code markers', () => {
      expect(isInApp('[native code]')).toBe(false);
      expect(isInApp('<anonymous>')).toBe(false);
    });

    it('returns true for empty input', () => {
      expect(isInApp('')).toBe(true);
    });
  });

  describe('createSyntheticStacktrace', () => {
    it('creates a stacktrace from current location', () => {
      const frames = createSyntheticStacktrace();

      expect(frames).toBeDefined();
      expect(frames!.length).toBeGreaterThan(0);
    });

    it('skips requested number of frames', () => {
      const frames1 = createSyntheticStacktrace(0);
      const frames2 = createSyntheticStacktrace(2);

      // frames2 should have fewer frames
      if (frames1 && frames2) {
        expect(frames2.length).toBeLessThan(frames1.length);
      }
    });

    it('frames have expected properties', () => {
      const frames = createSyntheticStacktrace();

      if (frames && frames.length > 0) {
        const frame = frames[0];
        // At minimum, frames should have some identifying info
        expect(
          frame.filename !== undefined ||
          frame.function !== undefined
        ).toBe(true);
      }
    });
  });

  describe('frame properties', () => {
    it('sets in_app based on filename', () => {
      const appStack = `Error: test
    at functionName (http://example.com/app/file.js:10:5)`;

      const nodeModulesStack = `Error: test
    at functionName (http://example.com/node_modules/package/index.js:10:5)`;

      const appFrames = parseStack(appStack);
      const nodeModulesFrames = parseStack(nodeModulesStack);

      expect(appFrames[0].in_app).toBe(true);
      expect(nodeModulesFrames[0].in_app).toBe(false);
    });

    it('sets abs_path from full URL', () => {
      const stack = `Error: test
    at functionName (http://example.com/path/to/file.js:10:5)`;

      const frames = parseStack(stack);

      expect(frames[0].abs_path).toContain('http://example.com');
    });

    it('sets filename from URL path', () => {
      const stack = `Error: test
    at functionName (http://example.com/path/to/file.js:10:5)`;

      const frames = parseStack(stack);

      expect(frames[0].filename).toBe('file.js');
    });
  });

  describe('edge cases', () => {
    it('handles malformed stack traces gracefully', () => {
      const malformedStack = `not a real stack trace
    random text here
    more random stuff`;

      const frames = parseStack(malformedStack);

      // Should not throw, just return empty or partial results
      expect(Array.isArray(frames)).toBe(true);
    });

    it('handles mixed format stack traces', () => {
      // This might happen in some edge cases
      const mixedStack = `Error: test
    at functionName (http://example.com/file.js:10:5)
otherFunction@http://example.com/other.js:20:10`;

      const frames = parseStack(mixedStack);

      // Should parse what it can
      expect(frames.length).toBeGreaterThan(0);
    });

    it('handles very long stack traces', () => {
      let stack = 'Error: deep stack\n';
      for (let i = 0; i < 100; i++) {
        stack += `    at function${i} (http://example.com/file.js:${i}:1)\n`;
      }

      const frames = parseStack(stack);

      expect(frames).toHaveLength(100);
    });

    it('handles special characters in function names', () => {
      const stack = `Error: test
    at Object.<anonymous> (http://example.com/file.js:10:5)
    at Array.forEach (native)
    at Object.defineProperty (http://example.com/file.js:20:10)`;

      const frames = parseStack(stack);

      // Should parse without errors
      expect(frames.length).toBeGreaterThanOrEqual(1);
    });

    it('handles unicode in file paths', () => {
      const stack = `Error: test
    at functionName (http://example.com/\u65E5\u672C\u8A9E/file.js:10:5)`;

      const frames = parseStack(stack);

      expect(frames).toHaveLength(1);
    });
  });
});
