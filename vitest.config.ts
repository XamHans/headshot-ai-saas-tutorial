import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', '**/*.feature'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.*', '**/e2e/**'],
    hookTimeout: 30000,
    // Service tests share a single Postgres `test` schema and TRUNCATE it in a
    // global `beforeEach`, so files must not run in parallel — otherwise one
    // file's cleanup wipes another file's seeded rows mid-test.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
