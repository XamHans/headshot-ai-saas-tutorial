import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

/**
 * E2E for slice 02 — Upload + pre-flight face gate.
 *
 * Reuses the slice-01 magic-link onboarding flow to reach a verified +
 * consented state (there is no shared storageState fixture in this repo; the
 * onboarding specs also log in per test by reading the magic-link token from
 * the DB, so we follow that established pattern).
 *
 * Assertions are on observable outcomes only: UI text/state, and whether a
 * headshot_jobs row exists in the DB. Face detection runs server-side, so a
 * rejected photo must leave zero job rows (no spend).
 */

const connectionString = process.env.DATABASE_URL;
const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');

function sql() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the upload e2e tests');
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

async function jobCountForEmail(email: string): Promise<number> {
  const db = sql();
  try {
    const rows = await db<{ count: string }[]>`
      SELECT COUNT(*)::text AS count FROM "headshot_jobs" j
      JOIN "user" u ON u.id = j.user_id
      WHERE u.email = ${email}
    `;
    return Number(rows[0].count);
  } finally {
    await db.end();
  }
}

/** Onboard + consent a fresh user, landing on the gated /headshot upload page. */
async function onboardToUpload(page: import('@playwright/test').Page, email: string) {
  await page.goto('/');
  await page.getByLabel(/email/i).fill(email);
  await page.getByRole('button', { name: /send.*link|continue|get started/i }).click();
  await expect(page.getByText(/we sent a verification link/i)).toBeVisible();

  const token = await readMagicLinkToken(email);
  await page.goto(`/api/auth/magic-link/verify?token=${token}&callbackURL=/`);

  await page.getByRole('checkbox', { name: /biometric/i }).check();
  await page.getByRole('button', { name: /consent|continue|agree/i }).click();

  await page.waitForURL('**/headshot');
  await expect(page.getByRole('heading', { name: /headshot/i })).toBeVisible();
}

test.describe('headshot upload + face gate', () => {
  test('Scenario: good single-face photo creates a pending job', async ({ page }) => {
    const email = uniqueEmail('upload-good');
    await onboardToUpload(page, email);

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /choose photo/i }).click();
    await (await chooser).setFiles(join(FIXTURES, 'single-face.jpg'));

    // Scoped to the persistent inline confirmation (not the transient toast,
    // which uses different wording and can also disappear before the check runs).
    await expect(page.getByText(/style selection is coming next/i)).toBeVisible({
      timeout: 30000,
    });

    expect(await jobCountForEmail(email)).toBe(1);
  });

  test('Scenario: photo with no detectable face is rejected before any spend', async ({ page }) => {
    const email = uniqueEmail('upload-noface');
    await onboardToUpload(page, email);

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /choose photo/i }).click();
    await (await chooser).setFiles(join(FIXTURES, 'no-face.jpg'));

    // role="alert" scopes to the persistent inline error, not the toast (which
    // shows the same text and would otherwise make this locator ambiguous).
    await expect(
      page.getByRole('alert').filter({ hasText: /clear single face|facing the camera/i }),
    ).toBeVisible({ timeout: 30000 });

    expect(await jobCountForEmail(email)).toBe(0);
  });

  test('Scenario: photo with multiple faces is rejected', async ({ page }) => {
    const email = uniqueEmail('upload-multi');
    await onboardToUpload(page, email);

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /choose photo/i }).click();
    await (await chooser).setFiles(join(FIXTURES, 'multiple-faces.jpg'));

    await expect(page.getByRole('alert').filter({ hasText: /more than one face/i })).toBeVisible({
      timeout: 30000,
    });

    expect(await jobCountForEmail(email)).toBe(0);
  });

  test('Scenario: uploaded source is stored privately (not publicly fetchable)', async ({
    page,
    request,
  }) => {
    const email = uniqueEmail('upload-private');
    await onboardToUpload(page, email);

    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /choose photo/i }).click();
    await (await chooser).setFiles(join(FIXTURES, 'single-face.jpg'));
    await expect(page.getByText(/style selection is coming next/i)).toBeVisible({
      timeout: 30000,
    });

    // Read the stored key, build the direct (unsigned) R2 object URL.
    const db = sql();
    let sourceImageKey: string;
    try {
      const rows = await db<{ source_image_key: string }[]>`
        SELECT j.source_image_key FROM "headshot_jobs" j
        JOIN "user" u ON u.id = j.user_id
        WHERE u.email = ${email}
        ORDER BY j.created_at DESC LIMIT 1
      `;
      expect(rows).toHaveLength(1);
      sourceImageKey = rows[0].source_image_key;
    } finally {
      await db.end();
    }

    const accountId = process.env.R2_ACCOUNT_ID;
    const bucket = process.env.R2_BUCKET_NAME;
    const directUrl = `https://${bucket}.${accountId}.r2.cloudflarestorage.com/${sourceImageKey}`;

    // A direct, unauthenticated GET (no signed URL) must NOT succeed.
    const res = await request.get(directUrl, { failOnStatusCode: false });
    expect(res.ok()).toBe(false);
    expect(res.status()).toBeGreaterThanOrEqual(400);
  });

  test('Scenario: wrong file type is rejected client-side with no storage write', async ({
    page,
  }) => {
    const email = uniqueEmail('upload-badtype');
    await onboardToUpload(page, email);

    // A .txt file is blocked by client validation before any upload happens.
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name: /choose photo/i }).click();
    await (await chooser).setFiles({
      name: 'notes.txt',
      mimeType: 'text/plain',
      buffer: Buffer.from('not an image'),
    });

    // "file type ... is not allowed" (not a bare /type/i — that also matches
    // the generated test email's "badtype" substring shown elsewhere on the page).
    await expect(page.getByText(/file type .* is not allowed/i)).toBeVisible();

    expect(await jobCountForEmail(email)).toBe(0);
  });
});
