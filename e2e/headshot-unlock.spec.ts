import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import postgres from 'postgres';
import { r2Storage } from '@/lib/storage/r2-client';

/**
 * E2E for slice 05 — Stripe unlock + webhook delivery.
 *
 * This does NOT run real Gemini generation (covered by slice 03, and it costs
 * real money/time). Instead it seeds a `ready` job with 3 image rows directly
 * in the DB and uploads real objects to the `full/` R2 keys, then exercises the
 * REAL Stripe test-mode Checkout + the REAL webhook (delivered via the
 * `stripe listen` forwarder wired up in playwright.config globalSetup).
 *
 * Verification contract covered here:
 *   #1 Paying unlocks clean full-res downloads (real Checkout + webhook).
 *   #2 Full-res is unavailable before payment (403 FORBIDDEN).
 *   #3 Full-res links are short-lived presigned URLs (X-Amz-Expires, real 200).
 *   #5 A user cannot download another user's job (404 JOB_NOT_FOUND).
 * (#4 idempotency of the atomic UPDATE is proven directly in the Vitest unit
 *  test `modules/headshot/tests/headshot-unlock.service.test.ts`.)
 */

const connectionString = process.env.DATABASE_URL;
const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');

function sql() {
  if (!connectionString) throw new Error('DATABASE_URL is required for the unlock e2e test');
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

/** Onboard + consent a fresh user; returns their user id. Leaves the browser authenticated. */
async function onboard(page: Page, email: string): Promise<string> {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /send.*link|continue|get started/i }).click();
  await expect(page.getByText(/we sent a verification link/i)).toBeVisible();

  const token = await readMagicLinkToken(email);
  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/`);

  await page.getByRole('checkbox', { name: /biometric/i }).check();
  await page.getByRole('button', { name: /consent|continue|agree/i }).click();
  await page.waitForURL('**/headshot');

  const db = sql();
  try {
    const rows = await db<{ id: string }[]>`SELECT id FROM "user" WHERE email = ${email} LIMIT 1`;
    return rows[0].id;
  } finally {
    await db.end();
  }
}

/**
 * Seed a `ready` job with 3 image rows for `userId`, uploading a real object to
 * each `full/` key so the post-unlock signed URLs resolve to a real 200. Returns
 * the job id.
 */
async function seedReadyJobWithFullRes(userId: string): Promise<string> {
  const jobId = crypto.randomUUID();
  const sourceImageKey = `sources/${userId}/${jobId}.jpg`;
  const bytes = readFileSync(join(FIXTURES, 'portrait-source.jpg'));

  const images = [0, 1, 2].map((i) => ({
    id: crypto.randomUUID(),
    fullKey: `full/${userId}/${jobId}/${i}.jpg`,
    previewKey: `previews/${userId}/${jobId}/${i}.jpg`,
  }));

  // Real objects behind the full-res keys (so the presigned URLs 200).
  for (const img of images) {
    await r2Storage.uploadFile(img.fullKey, bytes, 'image/jpeg');
  }

  const db = sql();
  try {
    await db`
      INSERT INTO "headshot_jobs" (id, user_id, source_image_key, style_id, status, unlocked, free_regen_used, created_at, updated_at)
      VALUES (${jobId}, ${userId}, ${sourceImageKey}, 'corporate-linkedin', 'ready', false, false, now(), now())
    `;
    for (const img of images) {
      await db`
        INSERT INTO "headshot_images" (id, job_id, preview_key, full_key, style_variant, created_at)
        VALUES (${img.id}, ${jobId}, ${img.previewKey}, ${img.fullKey}, 'corporate-linkedin', now())
      `;
    }
  } finally {
    await db.end();
  }
  return jobId;
}

test.describe('headshot unlock ($5 → clean full-res)', () => {
  test.setTimeout(120_000);

  test('Scenario: paying unlocks clean full-res; unpaid + non-owner are denied', async ({
    page,
    browser,
  }) => {
    const email = uniqueEmail('unlock');
    const userId = await onboard(page, email);
    const jobId = await seedReadyJobWithFullRes(userId);

    // --- Contract #2: full-res is unavailable before payment (403). ---
    const beforeRes = await page.request.get(`/api/headshots/${jobId}/full-res`);
    expect(beforeRes.status()).toBe(403);
    const beforeBody = await beforeRes.json();
    expect(beforeBody.code).toBe('FORBIDDEN');

    // --- Contract #5: a second user cannot download the first user's job. ---
    const otherCtx = await browser.newContext();
    const otherPage = await otherCtx.newPage();
    await onboard(otherPage, uniqueEmail('unlock-other'));
    const otherRes = await otherPage.request.get(`/api/headshots/${jobId}/full-res`);
    expect(otherRes.status()).toBe(404);
    expect((await otherRes.json()).code).toBe('JOB_NOT_FOUND');
    const otherUnlock = await otherPage.request.post(`/api/headshots/${jobId}/unlock`);
    expect(otherUnlock.status()).toBe(404);
    await otherCtx.close();

    // --- Contract #1: start the real $5 Checkout via the unlock API. ---
    const unlockRes = await page.request.post(`/api/headshots/${jobId}/unlock`);
    expect(unlockRes.ok()).toBeTruthy();
    const payment = (await unlockRes.json()).data as { stripeCheckoutUrl: string };
    expect(payment.stripeCheckoutUrl).toContain('checkout.stripe.com');

    // Navigate the browser to Stripe's REAL hosted Checkout and pay with the
    // standard test card.
    await page.goto(payment.stripeCheckoutUrl);
    const emailField = page.getByRole('textbox', { name: /email/i });
    await emailField.waitFor({ state: 'visible', timeout: 30_000 });
    await emailField.fill(email);
    await page.getByPlaceholder('1234 1234 1234 1234').fill('4242424242424242');
    await page.getByPlaceholder('MM / YY').fill('12 / 34');
    await page.getByPlaceholder('CVC').fill('123');
    const nameField = page.getByPlaceholder('Full name on card');
    if (await nameField.isVisible().catch(() => false)) {
      await nameField.fill('Test Payer');
    }
    // Belt-and-braces: some Checkout variants require an explicit billing name.
    await expect(emailField).toHaveValue(email);
    await page.getByTestId('hosted-payment-submit-button').click();

    // Stripe redirects back to /payments/return?session_id=... which polls the
    // job's unlock status until the webhook lands.
    await page.waitForURL('**/payments/return**', { timeout: 60_000 });
    await expect(page.getByTestId('unlock-status')).toHaveAttribute('data-unlocked', 'true', {
      timeout: 60_000,
    });

    // "View & download your headshots" must land directly on this job's
    // results with working downloads — not a blank/reset upload wizard. The
    // link carries ?job=<id> precisely so a fresh page load (which resets the
    // wizard's in-memory React state) can rehydrate from the server instead.
    await page.getByRole('link', { name: /view.*download.*headshots/i }).click();
    await page.waitForURL('**/headshot?job=**');
    await expect(page.getByTestId('headshot-downloads')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('headshot-download-link')).toHaveCount(3);

    // --- Contract #1 + #3: full-res now available; 3 short-lived presigned URLs. ---
    const fullRes = await page.request.get(`/api/headshots/${jobId}/full-res`);
    expect(fullRes.ok()).toBeTruthy();
    const dtos = (await fullRes.json()).data as { id: string; fullUrl: string }[];
    expect(dtos).toHaveLength(3);

    for (const dto of dtos) {
      // Genuine S3/R2 presigned URL with a signature + a short expiry window.
      expect(dto.fullUrl).toMatch(/X-Amz-(Signature|Credential)/);
      const expiresMatch = dto.fullUrl.match(/X-Amz-Expires=(\d+)/);
      expect(expiresMatch).not.toBeNull();
      expect(Number(expiresMatch?.[1])).toBeLessThanOrEqual(600);

      // …and the object is really downloadable (real 200 from R2), forcing a
      // save-as rather than an inline open — the anchor `download` attribute is
      // silently ignored by browsers for cross-origin URLs, so this must come
      // from the actual Content-Disposition response header.
      const asset = await page.request.get(dto.fullUrl);
      expect(asset.status()).toBe(200);
      expect(asset.headers()['content-disposition']).toMatch(/^attachment/);
    }
  });
});
