import { join } from 'node:path';
import { expect, test } from '@playwright/test';
import postgres from 'postgres';

/**
 * E2E for slice 03 — Style pick → generate → watermarked previews.
 *
 * The happy-path + default-style scenarios hit the REAL Gemini API end to end
 * (this is the product's core value), so they take real wall-clock time (up to
 * ~50s with the internal retry) and cost a small amount of real money. That is
 * intended — do not mock Gemini here.
 *
 * Fixture note: `portrait-source.jpg` is a plain forward-facing portrait that
 * both passes the pre-flight face gate AND that Gemini reliably edits into a
 * headshot. `single-face.jpg` passes the gate but Gemini refuses to edit it,
 * so it is unsuitable for a live-generation E2E.
 */

const connectionString = process.env.DATABASE_URL;
const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');

function sql() {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required for the generate e2e tests');
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

async function imageRowsForEmail(email: string): Promise<{ full_key: string | null }[]> {
  const db = sql();
  try {
    return await db<{ full_key: string | null }[]>`
      SELECT i.full_key FROM "headshot_images" i
      JOIN "headshot_jobs" j ON j.id = i.job_id
      JOIN "user" u ON u.id = j.user_id
      WHERE u.email = ${email}
    `;
  } finally {
    await db.end();
  }
}

async function jobForEmail(email: string): Promise<{ free_regen_used: boolean; status: string }> {
  const db = sql();
  try {
    const rows = await db<{ free_regen_used: boolean; status: string }[]>`
      SELECT j.free_regen_used, j.status FROM "headshot_jobs" j
      JOIN "user" u ON u.id = j.user_id
      WHERE u.email = ${email}
      ORDER BY j.created_at DESC LIMIT 1
    `;
    return rows[0];
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

  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: /choose photo/i }).click();
  await (await chooser).setFiles(join(FIXTURES, 'portrait-source.jpg'));

  await expect(page.getByRole('group', { name: /choose a headshot style/i })).toBeVisible({
    timeout: 30000,
  });
}

test.describe('headshot style + generate', () => {
  // Real Gemini calls (with a possible internal retry) can take a while.
  test.setTimeout(180_000);

  test('Scenario: a default style is pre-selected and one tap starts generation', async ({
    page,
  }) => {
    const email = uniqueEmail('gen-default');
    await onboardAndUpload(page, email);

    // The default (Corporate / LinkedIn) is already selected — no tap required.
    const defaultCard = page.getByRole('radio', { name: /corporate/i });
    await expect(defaultCard).toHaveAttribute('aria-checked', 'true');

    // One tap on Generate, without first choosing a style.
    await page.getByRole('button', { name: /^generate$/i }).click();

    // In-progress accessible status, then previews.
    await expect(page.getByRole('status')).toContainText(/generating/i);
    await expect(page.getByTestId('headshot-previews')).toBeVisible({
      timeout: 120_000,
    });
  });

  test('Scenario: pick a style and receive 3 watermarked previews; no clean full-res exposed', async ({
    page,
  }) => {
    const email = uniqueEmail('gen-happy');
    await onboardAndUpload(page, email);

    // Explicitly pick a (non-default) style, then generate.
    await page.getByRole('radio', { name: /executive/i }).click();

    // Capture every network response so we can assert no full-res URL is exposed.
    const responseUrls: string[] = [];
    page.on('response', (res) => responseUrls.push(res.url()));

    await page.getByRole('button', { name: /^generate$/i }).click();

    await expect(page.getByTestId('headshot-previews')).toBeVisible({
      timeout: 120_000,
    });

    // Exactly 3 previews are shown.
    const images = page.getByTestId('headshot-preview-image');
    await expect(images).toHaveCount(3);

    // Every preview <img> points at a signed PREVIEW asset, never a full/ key.
    const srcs = await images.evaluateAll((els) => els.map((el) => (el as HTMLImageElement).src));
    expect(srcs).toHaveLength(3);
    for (const src of srcs) {
      expect(src).toContain('previews/');
      expect(src).not.toContain('full/');
    }

    // No network response URL (JSON payload or asset) referenced a full/ key.
    expect(responseUrls.some((u) => u.includes('full/'))).toBe(false);

    // The full HTML of the results page contains no full/ reference either.
    const html = await page.content();
    expect(html).not.toContain('full/');

    // DB invariant: full-res keys exist server-side (stored, un-unlocked)…
    const rows = await imageRowsForEmail(email);
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.full_key).toMatch(/^full\//);
    }
    // …but the job is not unlocked and the free allowance is untouched.
    const job = await jobForEmail(email);
    expect(job.status).toBe('ready');
    expect(job.free_regen_used).toBe(false);
  });
});
