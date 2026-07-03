import { setupServer } from 'msw/node';
import { afterAll, beforeAll, beforeEach } from 'vitest';
import { handlers } from './mocks/handlers';
import '@testing-library/jest-dom';
import { cleanTestDatabase, setupTestDatabase, teardownTestDatabase } from './utils/test-database';

// Load environment variables from .env for tests (needed for DATABASE_URL).
// Optional: a fresh clone may not have a .env yet, and in CI the environment is
// provided by the shell — a missing file must not crash the whole suite.
try {
  process.loadEnvFile?.('.env');
} catch {
  // No .env file present — fall back to the ambient environment.
}

// Setup MSW server for API mocking
export const server = setupServer(...handlers);

// Global setup for all tests
beforeAll(async () => {
  // Start MSW server
  server.listen({ onUnhandledRequest: 'bypass' });

  // Setup test database (create schema, run migrations)
  await setupTestDatabase();
});

afterAll(async () => {
  // Stop MSW server
  server.close();

  // Cleanup test database
  await teardownTestDatabase();
});

beforeEach(async () => {
  // Reset MSW handlers
  server.resetHandlers();

  // Clean test database tables before each test
  await cleanTestDatabase();
});
