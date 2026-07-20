import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, type Page, test } from '@playwright/test';
import postgres from 'postgres';
import { r2Storage } from '@/lib/storage/r2-client';

/**
 * E2E for slice 07 — retention: 30-day cleanup + "delete my data".
 *
 * Real R2 is used throughout (no mocking): objects are uploaded to the source /
 * preview / full keys, and after cleanup/deletion we assert the presigned URLs
 * no longer resolve (404) — or, for purchased images, still resolve (200).
 *
 * Verification contract covered here:
 *   #1 30-day cleanup deletes source + unpurchased outputs (keys stop resolving).
 *   #2 purchased images survive the cleanup (still downloadable).
 *   #3 user deletes their own data (storage + records gone).
 *   #4 cleanup endpoint rejects unauthenticated triggers (no deletion).
 *   #5 deletion is scoped to the acting user (the other user is untouched).
 */

const connectionString = process.env.DATABASE_URL;
const CRON_SECRET = process.env.CRON_SECRET;
const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');
const BYTES = readFileSync(join(FIXTURES, 'portrait-source.jpg'));

function sql() {
  if (!connectionString) throw new Error('DATABASE_URL is required for the retention e2e test');
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

interface SeededJob {
  jobId: string;
  sourceImageKey: string;
  keys: { previewKey: string; fullKey: string }[];
}

/**
 * Seed a `ready` job for `userId` with real R2 objects behind the source key and
 * every preview/full key, so presigned URLs resolve to a real 200 before
 * cleanup/deletion. `ageDays` back-dates `created_at`; `unlocked` marks it
 * purchased.
 */
async function seedJob(
  userId: string,
  opts: { ageDays: number; unlocked: boolean },
): Promise<SeededJob> {
  const jobId = crypto.randomUUID();
  const sourceImageKey = `sources/${userId}/${jobId}.jpg`;
  const keys = [0, 1, 2].map((i) => ({
    previewKey: `previews/${userId}/${jobId}/${i}.jpg`,
    fullKey: `full/${userId}/${jobId}/${i}.jpg`,
  }));

  await r2Storage.uploadFile(sourceImageKey, BYTES, 'image/jpeg');
  for (const k of keys) {
    await r2Storage.uploadFile(k.previewKey, BYTES, 'image/jpeg');
    await r2Storage.uploadFile(k.fullKey, BYTES, 'image/jpeg');
  }

  const createdAt = new Date(Date.now() - opts.ageDays * 24 * 60 * 60 * 1000);
  const db = sql();
  try {
    await db`
      INSERT INTO "headshot_jobs" (id, user_id, source_image_key, style_id, status, unlocked, free_regen_used, created_at, updated_at)
      VALUES (${jobId}, ${userId}, ${sourceImageKey}, 'corporate-linkedin', 'ready', ${opts.unlocked}, false, ${createdAt}, ${createdAt})
    `;
    for (const k of keys) {
      await db`
        INSERT INTO "headshot_images" (id, job_id, preview_key, full_key, style_variant, created_at)
        VALUES (${crypto.randomUUID()}, ${jobId}, ${k.previewKey}, ${k.fullKey}, 'corporate-linkedin', ${createdAt})
      `;
    }
  } finally {
    await db.end();
  }
  return { jobId, sourceImageKey, keys };
}

/** True if the R2 object behind `key` resolves to a real 200 via a presigned GET. */
async function keyResolves(page: Page, key: string): Promise<boolean> {
  const url = await r2Storage.getSignedUrl(key, 120);
  const res = await page.request.get(url);
  return res.status() === 200;
}

async function imageRowCount(jobId: string): Promise<number> {
  const db = sql();
  try {
    const rows = await db<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "headshot_images" WHERE job_id = ${jobId}
    `;
    return rows[0].n;
  } finally {
    await db.end();
  }
}

async function jobRowCount(userId: string): Promise<number> {
  const db = sql();
  try {
    const rows = await db<{ n: number }[]>`
      SELECT count(*)::int AS n FROM "headshot_jobs" WHERE user_id = ${userId}
    `;
    return rows[0].n;
  } finally {
    await db.end();
  }
}

test.describe('headshot retention (30-day cleanup + delete my data)', () => {
  test.setTimeout(120_000);

  test('Scenario #4: cleanup endpoint rejects triggers without the cron secret and deletes nothing', async ({
    page,
  }) => {
    const userId = await onboard(page, uniqueEmail('retention-noauth'));
    const expired = await seedJob(userId, { ageDays: 31, unlocked: false });

    // No secret at all → rejected.
    const noAuth = await page.request.post('/api/headshots/cleanup');
    expect(noAuth.status()).toBe(401);

    // Wrong secret → rejected.
    const wrong = await page.request.post('/api/headshots/cleanup', {
      headers: { authorization: 'Bearer nope' },
    });
    expect(wrong.status()).toBe(401);

    // The expired job's objects are untouched — no deletion occurred.
    expect(await keyResolves(page, expired.sourceImageKey)).toBe(true);
    expect(await keyResolves(page, expired.keys[0].fullKey)).toBe(true);
    expect(await imageRowCount(expired.jobId)).toBe(3);
  });

  test('Scenario #1 + #2: cleanup deletes expired unpurchased data but purchased images survive', async ({
    page,
  }) => {
    if (!CRON_SECRET) throw new Error('CRON_SECRET must be set for the retention e2e test');
    const userId = await onboard(page, uniqueEmail('retention-cleanup'));

    const unpurchased = await seedJob(userId, { ageDays: 31, unlocked: false });
    const purchased = await seedJob(userId, { ageDays: 31, unlocked: true });

    // Sanity: everything resolves before the sweep.
    expect(await keyResolves(page, unpurchased.sourceImageKey)).toBe(true);
    expect(await keyResolves(page, purchased.keys[0].fullKey)).toBe(true);

    const res = await page.request.post('/api/headshots/cleanup', {
      headers: { authorization: `Bearer ${CRON_SECRET}` },
    });
    expect(res.ok()).toBeTruthy();

    // #1: the expired, un-purchased job's source + outputs no longer resolve,
    // and its image rows are gone.
    expect(await keyResolves(page, unpurchased.sourceImageKey)).toBe(false);
    for (const k of unpurchased.keys) {
      expect(await keyResolves(page, k.previewKey)).toBe(false);
      expect(await keyResolves(page, k.fullKey)).toBe(false);
    }
    expect(await imageRowCount(unpurchased.jobId)).toBe(0);

    // #2: the purchased job's full-res images are retained and still downloadable.
    for (const k of purchased.keys) {
      expect(await keyResolves(page, k.fullKey)).toBe(true);
    }
    expect(await imageRowCount(purchased.jobId)).toBe(3);
    const fullRes = await page.request.get(`/api/headshots/${purchased.jobId}/full-res`);
    expect(fullRes.ok()).toBeTruthy();
    const dtos = (await fullRes.json()).data as { id: string; fullUrl: string }[];
    expect(dtos).toHaveLength(3);
    for (const dto of dtos) {
      const asset = await page.request.get(dto.fullUrl);
      expect(asset.status()).toBe(200);
    }
  });

  test('Scenario #3 + #5: a user deletes their own data; the other user is untouched', async ({
    page,
    browser,
  }) => {
    const userA = await onboard(page, uniqueEmail('retention-delete-a'));
    const jobA = await seedJob(userA, { ageDays: 1, unlocked: true });

    // A second user with their own data.
    const otherCtx = await browser.newContext();
    const otherPage = await otherCtx.newPage();
    const userB = await onboard(otherPage, uniqueEmail('retention-delete-b'));
    const jobB = await seedJob(userB, { ageDays: 1, unlocked: true });

    // User A invokes "delete my data" through the UI confirm step.
    await page.goto('/headshot');
    await page.getByTestId('delete-my-data-button').click();
    await expect(page.getByTestId('delete-my-data-dialog')).toBeVisible();
    await page.getByTestId('delete-my-data-confirm').click();
    await expect(page.getByText(/your headshot data has been deleted/i)).toBeVisible({
      timeout: 15_000,
    });

    // #3: user A's storage + records are gone.
    expect(await keyResolves(page, jobA.sourceImageKey)).toBe(false);
    for (const k of jobA.keys) {
      expect(await keyResolves(page, k.previewKey)).toBe(false);
      expect(await keyResolves(page, k.fullKey)).toBe(false);
    }
    expect(await jobRowCount(userA)).toBe(0);

    // #5: user B's data is completely untouched.
    expect(await keyResolves(otherPage, jobB.sourceImageKey)).toBe(true);
    for (const k of jobB.keys) {
      expect(await keyResolves(otherPage, k.fullKey)).toBe(true);
    }
    expect(await jobRowCount(userB)).toBe(1);
    expect(await imageRowCount(jobB.jobId)).toBe(3);

    await otherCtx.close();
  });
});
