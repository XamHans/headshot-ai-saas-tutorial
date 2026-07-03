import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
// @ts-expect-error

export default defineConfig({
  plugins: [],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}', '**/*.feature'],
    exclude: ['**/node_modules/**', '**/dist/**', '**/*.integration.test.*', '**/e2e/**'],
    hookTimeout: 30000,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
