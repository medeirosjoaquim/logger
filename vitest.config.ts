import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Enable global test APIs (describe, it, expect)
    globals: true,

    // Use jsdom for browser-like environment
    environment: 'jsdom',

    // Setup files to run before each test file
    setupFiles: ['./src/__tests__/setup.ts'],

    // Test file patterns to include
    include: ['src/__tests__/**/*.test.ts', 'src/__tests__/**/*.test.tsx'],

    // Files/directories to exclude
    exclude: [
      'node_modules',
      'dist',
      'src/__tests__/helpers.ts',
      'src/__tests__/setup.ts',
    ],

    // Coverage configuration
    coverage: {
      // Use v8 for coverage (faster than c8)
      provider: 'v8',

      // Coverage reporters
      reporter: ['text', 'json', 'html'],

      // Files to include in coverage
      include: ['src/**/*.ts'],

      // Files to exclude from coverage
      exclude: [
        'src/__tests__/**',
        'src/ui/**',
        'src/types/**',
        'src/**/index.ts',
        '**/*.d.ts',
      ],

      // Coverage thresholds
      // Note: Overall coverage is lower because many source files are not yet tested.
      // The specific modules we test have good coverage (80-100%).
      // Set thresholds lower until full test suite is developed.
      thresholds: {
        statements: 10,
        branches: 60,
        functions: 50,
        lines: 10,
      },
    },

    // Reporter configuration
    reporters: ['default'],

    // Timeout for tests (in ms)
    testTimeout: 10000,

    // Timeout for hooks (in ms)
    hookTimeout: 10000,

    // Pool options
    pool: 'forks',

    // Watch mode options
    watch: true,

    // Isolate tests to prevent state leakage
    isolate: true,

    // Type checking
    typecheck: {
      enabled: false, // Run type checking separately with tsc
    },
  },

  // Resolve aliases (if needed)
  resolve: {
    alias: {
      // Add any path aliases here
    },
  },
});
