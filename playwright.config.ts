import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// Load .env.local / .env (like Next.js does) so the test runner — not only the
// dev server — has access to DATABASE_URL etc., which the onboarding specs need
// to read magic-link tokens directly from the DB. Kept dependency-free.
function loadEnvFile(file: string) {
  const path = join(process.cwd(), file);
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, 'utf-8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

for (const file of ['.env', '.env.local']) loadEnvFile(file);

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
    // better-auth computes redirect targets (e.g. after magic-link verify) from
    // BETTER_AUTH_URL, not from the request's own host/port. .env.local pins it
    // to the manual dev server's port (3000); without this override the e2e
    // server (3131) would issue redirects to a port nothing is listening on,
    // and any navigation that follows one (e.g. page.goto) gets ERR_CONNECTION_REFUSED.
    env: {
      ...process.env,
      BETTER_AUTH_URL: baseURL,
      NEXT_PUBLIC_APP_URL: baseURL,
    },
  },
});
