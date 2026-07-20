import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';
import { FREE_GENERATION_LIMIT } from '@/modules/headshot/services/headshot.service';

/**
 * E2E for slice 04 — abuse controls (one-free-generation cap + free regenerate).
 *
 * To control real-Gemini cost this is ONE consolidated test that reuses a single
 * real generation:
 *   1. First generation is free and succeeds (scenario 1) — REAL Gemini.
 *   2. The one free regenerate of that same job succeeds (scenario 3) — REAL
 *      Gemini — and marks `free_regen_used`.
 *   3. A third attempt on the same job is blocked (scenario 3 tail) — pre-spend,
 *      no Gemini.
 *   4. A brand-new job for the same account is blocked with payment-required
 *      (scenario 2) — pre-spend, no Gemini.
 *
 * Scenarios 3 and 4 are blocked BEFORE any model call, so they cost nothing.
 */

const connectionString = process.env.DATABASE_URL;
const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');

function sql() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the abuse-controls e2e test');
  }
  return postgres(connectionString);
}

function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.com`;
}

async function readMagicLinkToken(email: string): Promise<string> {
  const db = sql();
  try {
    const rows = await db<{ identifier: string }[]>`
      SELECT identifier FROM "verification"
      WHERE value LIKE ${`%"email":"${email}"%`}
      ORDER BY created_at DESC LIMIT 1
    `;
    if (rows.length === 0) throw new Error(`No magic-link row for ${email}`);
    return rows[0].identifier;
  } finally {
    await db.end();
  }
}

async function userAndJob(
  email: string,
): Promise<{ free_generation_count: number; free_regen_used: boolean; status: string }> {
  const db = sql();
  try {
    const rows = await db<
      { free_generation_count: number; free_regen_used: boolean; status: string }[]
    >`
      SELECT u.headshot_free_generation_count AS free_generation_count,
             j.free_regen_used, j.status
      FROM "headshot_jobs" j
      JOIN "user" u ON u.id = j.user_id
      WHERE u.email = ${email}
      ORDER BY j.created_at DESC LIMIT 1
    `;
    return rows[0];
  } finally {
    await db.end();
  }
}

/**
 * Directly exhaust the remaining free-generation slots for a user, so the
 * "cap reached" assertion doesn't require paying for extra real Gemini calls
 * just to burn through FREE_GENERATION_LIMIT — this test already covers one
 * real free generation (scenario 1) and one real free regenerate (scenario 3);
 * that's enough to prove the happy paths without tripling Gemini spend.
 */
async function exhaustFreeGenerations(email: string): Promise<void> {
  const db = sql();
  try {
    await db`
      UPDATE "user" SET headshot_free_generation_count = ${FREE_GENERATION_LIMIT}
      WHERE email = ${email}
    `;
  } finally {
    await db.end();
  }
}

/** Onboard + consent a fresh user, upload the portrait, land on the style step. */
async function onboardAndUpload(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /send.*link|continue|get started/i }).click();
  await expect(page.getByText(/we sent a verification link/i)).toBeVisible();

  const token = await readMagicLinkToken(email);
  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/`);

  await page.getByRole('checkbox', { name: /biometric/i }).check();
  await page.getByRole('button', { name: /consent|continue|agree/i }).click();

  await page.waitForURL('**/headshot');
  await uploadPortrait(page);
}

/** From the style step: upload the portrait and wait for the style picker. */
async function uploadPortrait(page: import('@playwright/test').Page) {
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /choose photo/i }).click();
  await (await chooser).setFiles(join(FIXTURES, 'portrait-source.jpg'));

  await expect(page.getByRole('group', { name: /choose a headshot style/i })).toBeVisible({
    timeout: 30000,
  });
}

test.describe('headshot abuse controls', () => {
  // Two real Gemini generations (first + one regenerate) can take a while.
  test.setTimeout(300_000);

  test('Scenario: free generation, free regenerate, then further attempts require payment', async ({
    page,
  }) => {
    const email = uniqueEmail('abuse');
    await onboardAndUpload(page, email);

    // 1. First generation is free and succeeds (REAL Gemini).
    await page.getByRole('button', { name: /^generate$/i }).click();
    await expect(page.getByTestId('headshot-previews')).toBeVisible({ timeout: 120_000 });

    // One of FREE_GENERATION_LIMIT free generations now consumed; free regenerate
    // still available (a separate, per-job allowance).
    let state = await userAndJob(email);
    expect(state.free_generation_count).toBe(1);
    expect(state.free_regen_used).toBe(false);
    expect(state.status).toBe('ready');

    // 2. Free regenerate of the SAME job (REAL Gemini) via "Try a different style".
    await page.getByRole('button', { name: /try a different style/i }).click();
    await page.getByRole('radio', { name: /executive/i }).click();
    await page.getByRole('button', { name: /^generate$/i }).click();
    await expect(page.getByTestId('headshot-previews')).toBeVisible({ timeout: 120_000 });

    // The one free regenerate is now used; the per-account free-generation count
    // is untouched by regenerating (still 1 — the regen is a separate allowance).
    state = await userAndJob(email);
    expect(state.free_regen_used).toBe(true);
    expect(state.free_generation_count).toBe(1);
    expect(state.status).toBe('ready');

    // 3. A THIRD attempt on the SAME job is blocked before any spend. Assert on
    //    the API response (the transient toast is unreliable): 409 with a
    //    "already generated" message. Costs nothing (blocked pre-Gemini).
    await page.getByRole('button', { name: /try a different style/i }).click();
    const thirdAttempt = page.waitForResponse(
      (r) => /\/api\/headshots\/.+\/generate$/.test(r.url()) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^generate$/i }).click();
    const thirdRes = await thirdAttempt;
    expect(thirdRes.status()).toBe(409);
    const thirdBody = await thirdRes.json();
    expect(thirdBody.code).toBe('JOB_NOT_GENERATABLE');

    // 4. A BRAND-NEW job for the same account is blocked with payment-required
    //    (HTTP 402) — also pre-spend. Only one of FREE_GENERATION_LIMIT slots was
    //    consumed so far (the regen doesn't count), so directly exhaust the
    //    remaining slots rather than paying for two more real Gemini generations
    //    just to prove the cap — the happy path is already covered above.
    await exhaustFreeGenerations(email);

    await page.goto('/headshot');
    await uploadPortrait(page);
    const newJobAttempt = page.waitForResponse(
      (r) => /\/api\/headshots\/.+\/generate$/.test(r.url()) && r.request().method() === 'POST',
    );
    await page.getByRole('button', { name: /^generate$/i }).click();
    const newJobRes = await newJobAttempt;
    expect(newJobRes.status()).toBe(402);
    const newJobBody = await newJobRes.json();
    expect(newJobBody.code).toBe('PAYMENT_REQUIRED');
  });
});
