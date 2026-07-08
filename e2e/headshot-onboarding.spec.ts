import { expect, test } from '@playwright/test';
import postgres from 'postgres';

/**
 * E2E for slice 01 — Verified-email onboarding + biometric-consent gate.
 *
 * Magic-link tokens are read directly from the `verification` DB table
 * (Better Auth stores them there). This is the standard way to test
 * magic-link flows without intercepting real email — we never fake Resend.
 */

const connectionString = process.env.DATABASE_URL;

function sql() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the onboarding e2e tests');
  }
  return postgres(connectionString);
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

/**
 * Better Auth's magic-link plugin stores the link token in the `verification`
 * table under an identifier that contains the email. Read the most recent one.
 */
async function readMagicLinkToken(email: string): Promise<string> {
  const db = sql();
  try {
    // Better Auth's magic-link plugin stores the raw token as the row
    // `identifier`, and the payload (which contains the email) in `value`.
    // Match on the email inside `value` and return the identifier as the token.
    const rows = await db<{ identifier: string; value: string }[]>`
      SELECT identifier, value
      FROM "verification"
      WHERE value LIKE ${`%"email":"${email}"%`}
      ORDER BY created_at DESC
      LIMIT 1
    `;
    if (rows.length === 0) {
      throw new Error(`No magic-link verification row found for ${email}`);
    }
    return rows[0].identifier;
  } finally {
    await db.end();
  }
}

test.describe('headshot onboarding gate', () => {
  test('Scenario 1: verify email via magic link, then land consented', async ({ page }) => {
    const email = uniqueEmail('verified');

    await page.goto('/headshot/onboarding');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /send.*link|continue|get started/i }).click();

    // Confirmation that a link was sent
    await expect(page.getByText(/we sent a verification link/i)).toBeVisible();

    // Read the magic-link token from the DB and visit the link to verify.
    const token = await readMagicLinkToken(email);
    await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/headshot/onboarding`);

    // Back on onboarding, now signed-in but not consented: tick consent.
    await expect(page.getByRole('checkbox', { name: /biometric/i })).toBeVisible();
    await page.getByRole('checkbox', { name: /biometric/i }).check();
    await page.getByRole('button', { name: /consent|continue|agree/i }).click();

    // Consent recorded -> can reach the generation flow.
    await page.waitForURL('**/headshot');
    await expect(page.getByRole('heading', { name: /headshot/i })).toBeVisible();

    // Assert consent is persisted in the DB.
    const db = sql();
    try {
      const rows = await db<{ biometric_consent_at: Date | null }[]>`
        SELECT biometric_consent_at FROM "user" WHERE email = ${email} LIMIT 1
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].biometric_consent_at).not.toBeNull();
    } finally {
      await db.end();
    }
  });

  test('Scenario 2: disposable email domain is rejected at signup', async ({ page }) => {
    const email = `throwaway-${Date.now()}@mailinator.com`;

    await page.goto('/headshot/onboarding');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /send.*link|continue|get started/i }).click();

    // Friendly rejection guidance.
    await expect(page.getByText(/real email|disposable|permanent email/i)).toBeVisible();

    // No account created and no magic link sent.
    const db = sql();
    try {
      const users = await db`SELECT id FROM "user" WHERE email = ${email}`;
      expect(users.length).toBe(0);
      const verifications = await db`
        SELECT id FROM "verification" WHERE identifier LIKE ${`%${email}%`} OR value LIKE ${`%${email}%`}
      `;
      expect(verifications.length).toBe(0);
    } finally {
      await db.end();
    }
  });

  test('Scenario 3: unverified user cannot reach generation', async ({ page }) => {
    const email = uniqueEmail('unverified');

    await page.goto('/headshot/onboarding');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /send.*link|continue|get started/i }).click();
    await expect(page.getByText(/we sent a verification link/i)).toBeVisible();

    // Navigate directly to generation without opening the magic link.
    await page.goto('/headshot');

    await page.waitForURL('**/headshot/onboarding**');
    await expect(page.getByText(/verify.*email|email.*verif/i)).toBeVisible();
  });

  test('Scenario 4: verified-but-unconsented user cannot generate', async ({ page }) => {
    const email = uniqueEmail('unconsented');

    await page.goto('/headshot/onboarding');
    await page.getByLabel(/email/i).fill(email);
    await page.getByRole('button', { name: /send.*link|continue|get started/i }).click();
    await expect(page.getByText(/we sent a verification link/i)).toBeVisible();

    // Verify email via magic link but do NOT tick consent.
    const token = await readMagicLinkToken(email);
    await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/headshot/onboarding`);
    await expect(page.getByRole('checkbox', { name: /biometric/i })).toBeVisible();

    // Try to reach generation directly.
    await page.goto('/headshot');

    // Redirected back to the consent step.
    await page.waitForURL('**/headshot/onboarding**');
    await expect(page.getByRole('checkbox', { name: /biometric/i })).toBeVisible();
    await expect(page.getByText(/consent/i).first()).toBeVisible();

    // Consent not recorded in DB.
    const db = sql();
    try {
      const rows = await db<{ biometric_consent_at: Date | null }[]>`
        SELECT biometric_consent_at FROM "user" WHERE email = ${email} LIMIT 1
      `;
      expect(rows.length).toBe(1);
      expect(rows[0].biometric_consent_at).toBeNull();
    } finally {
      await db.end();
    }
  });
});
