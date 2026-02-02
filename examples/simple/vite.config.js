import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@universal-logger/core': path.resolve(__dirname, '../../src/index.ts'),
    },
  },
  server: {
    port: 3000,
    open: true,
  },
});
