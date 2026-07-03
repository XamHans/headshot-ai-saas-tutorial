import { expect, test } from '@playwright/test';

/**
 * Smoke tests - verify the app boots and the public pages render.
 * These need no database or auth, so they are safe to run anywhere.
 *
 * Extend with authenticated flows by seeding a session via a global
 * setup + `storageState` (https://playwright.dev/docs/auth).
 */

test.describe('public pages', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/AI Starter Kit/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page shows the sign-in form', async ({ page }) => {
    await page.goto('/login');

    await expect(page.getByText('Welcome back')).toBeVisible();
    await expect(page.getByRole('button', { name: /sign in with google/i })).toBeVisible();
  });
});
