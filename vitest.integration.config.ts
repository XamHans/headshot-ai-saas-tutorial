import { config } from 'dotenv';
import { resolve } from 'path';
import { defineConfig } from 'vitest/config';

// Load environment variables from .env file
config();

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: ['**/tests/**/*.integration.test.ts'],
    testTimeout: 30000, // Longer timeout for integration tests
    hookTimeout: 60000,
    // All integration files share the single `test` Postgres schema, and setup.ts
    // truncates every table before each test — parallel files would wipe each
    // other's rows mid-test.
    fileParallelism: false,
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './'),
    },
  },
});
