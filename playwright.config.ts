import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright E2E configuration.
 * Docs: https://playwright.dev/docs/test-configuration
 *
 * E2E specs live in ./e2e (kept separate from Vitest unit/integration specs).
 * The dev server is started automatically via `webServer` below.
 */
// Dedicated e2e port (3000 is often taken by other local services), overridable via env.
const PORT = process.env.PORT ? Number(process.env.PORT) : 3131;
const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: './e2e',
  // Fail the build on CI if you accidentally left test.only in the source code.
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'html',

  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    // Enable more browsers once their binaries are installed
    // (`npx playwright install firefox webkit`):
    // { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    // { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],

  // Start the Next.js dev server before the tests and reuse it locally.
  webServer: {
    command: `pnpm dev --port ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
  },
});
