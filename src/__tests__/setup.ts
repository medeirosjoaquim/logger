/**
 * Test setup file for Vitest
 *
 * This file is run before each test file.
 * Configures global test utilities and resets state between tests.
 */

import { beforeEach, afterEach, vi } from 'vitest';

// Global state to track any active spans for cleanup
let activeSpanCleanup: (() => void) | undefined;

beforeEach(() => {
  // Reset all mocks before each test
  vi.clearAllMocks();

  // Reset any module-level state
  activeSpanCleanup = undefined;
});

afterEach(() => {
  // Restore all mocked functions
  vi.restoreAllMocks();

  // Clean up any active spans
  if (activeSpanCleanup) {
    activeSpanCleanup();
  }

  // Reset timers if any were used
  vi.useRealTimers();
});

/**
 * Register a cleanup function for active spans
 */
export function registerSpanCleanup(cleanup: () => void): void {
  activeSpanCleanup = cleanup;
}

/**
 * Helper to wait for async operations to settle
 */
export async function flushPromises(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Helper to create a mock crypto object for testing
 */
export function mockCrypto(): void {
  const mockRandomUUID = vi.fn(() => '12345678-1234-1234-1234-123456789012');
  const mockGetRandomValues = vi.fn((array: Uint8Array) => {
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
    return array;
  });

  vi.stubGlobal('crypto', {
    randomUUID: mockRandomUUID,
    getRandomValues: mockGetRandomValues,
  });
}
