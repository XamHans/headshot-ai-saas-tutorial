import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { HttpResponse, http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '@/lib/logger';
import type { ServiceContext } from '@/lib/services/context';
import { user } from '@/modules/users/schema';
import { server } from '@/tests/setup';
import { getTestDb } from '@/tests/utils/test-database';
import { headshotImages, headshotJobs } from '../schema';
import type { HeadshotService } from '../services/headshot.service';
import { createHeadshotService, FREE_GENERATION_LIMIT } from '../services/headshot.service';
import * as generator from '../services/headshot-generator';

/**
 * Service tests for the slice-04 abuse controls that live in the SERVICE:
 *   1. FREE_GENERATION_LIMIT free generations per account, ever (per-account cap)
 *   3. free regenerate of a ready job (per-job `freeRegenUsed`)
 *
 * Same discipline as generate-set.service.test.ts: spy ONLY the Gemini boundary
 * (`generateHeadshotImage`); the real test DB + real R2 flow (MSW-intercepted)
 * run end to end. Every "blocked before spend" assertion checks `genSpy` was
 * never called.
 */

const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');
const userId = 'cap-user';

let fakeImage: Buffer;
let sourcePhoto: Buffer;

function okImage(): Awaited<ReturnType<typeof generator.generateHeadshotImage>> {
  return { success: true, data: { buffer: fakeImage, mediaType: 'image/png' } };
}

async function seedUser(db: ServiceContext['db'], overrides: Record<string, unknown> = {}) {
  await db.insert(user).values({
    id: userId,
    email: `${userId}-${crypto.randomUUID()}@example.com`,
    emailVerified: true,
    biometricConsentAt: new Date(),
    ...overrides,
  });
}

async function seedJob(
  db: ServiceContext['db'],
  overrides: Record<string, unknown> = {},
): Promise<string> {
  const jobId = crypto.randomUUID();
  await db.insert(headshotJobs).values({
    id: jobId,
    userId,
    sourceImageKey: `sources/${userId}/${jobId}.jpg`,
    status: 'pending',
    ...overrides,
  });
  return jobId;
}

describe('HeadshotService.generateSet — abuse controls (cap + free regen)', () => {
  let service: HeadshotService;
  let db: ServiceContext['db'];
  let genSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    db = getTestDb();
    service = createHeadshotService({ db, logger: createLogger() });

    const sharp = (await import('sharp')).default;
    fakeImage = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 80, g: 90, b: 160 } },
    })
      .png()
      .toBuffer();

    sourcePhoto = readFileSync(join(FIXTURES, 'portrait-source.jpg'));

    server.use(
      http.get('https://*.r2.cloudflarestorage.com/*', () =>
        HttpResponse.arrayBuffer(sourcePhoto.buffer.slice(0), {
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      ),
    );

    genSpy = vi.spyOn(generator, 'generateHeadshotImage');
    genSpy.mockResolvedValue(okImage());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // Scenario 1
  it('first generation is free and consumes one of the per-account free allowance', async () => {
    await seedUser(db);
    const jobId = await seedJob(db);

    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');

    expect(result.success).toBe(true);
    if (result.success) expect(result.data.job.status).toBe('ready');
    expect(genSpy).toHaveBeenCalledTimes(3);

    const [u] = await db.select().from(user).where(eq(user.id, userId));
    expect(u.headshotFreeGenerationCount).toBe(1);
  });

  it('the second and third generations (new jobs, same account) are also free', async () => {
    await seedUser(db);

    for (let i = 1; i <= FREE_GENERATION_LIMIT; i++) {
      const jobId = await seedJob(db);
      const result = await service.generateSet(jobId, userId, 'corporate-linkedin');
      expect(result.success).toBe(true);

      const [u] = await db.select().from(user).where(eq(user.id, userId));
      expect(u.headshotFreeGenerationCount).toBe(i);
    }
    expect(genSpy).toHaveBeenCalledTimes(3 * FREE_GENERATION_LIMIT);
  });

  // Scenario 2
  it(`a ${FREE_GENERATION_LIMIT + 1}th generation requires payment once the cap is exhausted`, async () => {
    await seedUser(db, { headshotFreeGenerationCount: FREE_GENERATION_LIMIT });
    const jobId = await seedJob(db);

    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('PAYMENT_REQUIRED');
    // Zero model calls, zero image rows, job left pending (no `generating` spend).
    expect(genSpy).not.toHaveBeenCalled();

    const rows = await db.select().from(headshotImages).where(eq(headshotImages.jobId, jobId));
    expect(rows).toHaveLength(0);
    const [job] = await db.select().from(headshotJobs).where(eq(headshotJobs.id, jobId));
    expect(job.status).toBe('pending');
  });

  // Scenario 3
  it('free regenerate of a ready job succeeds without payment and marks freeRegenUsed', async () => {
    // Account already exhausted its free generations.
    await seedUser(db, { headshotFreeGenerationCount: FREE_GENERATION_LIMIT });
    const jobId = await seedJob(db, {
      status: 'ready',
      freeRegenUsed: false,
      styleId: 'corporate-linkedin',
    });

    const result = await service.generateSet(jobId, userId, 'executive');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.job.status).toBe('ready');
      expect(result.data.job.freeRegenUsed).toBe(true);
    }
    expect(genSpy).toHaveBeenCalledTimes(3);

    // The per-account free-generation count is NOT touched by the regen path —
    // it was already at the cap and must remain unchanged.
    const [u] = await db.select().from(user).where(eq(user.id, userId));
    expect(u.headshotFreeGenerationCount).toBe(FREE_GENERATION_LIMIT);
  });

  it('a second regenerate of the same job (freeRegenUsed=true) is blocked as not generatable', async () => {
    await seedUser(db, { headshotFreeGenerationCount: FREE_GENERATION_LIMIT });
    const jobId = await seedJob(db, {
      status: 'ready',
      freeRegenUsed: true,
      styleId: 'corporate-linkedin',
    });

    const result = await service.generateSet(jobId, userId, 'executive');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('JOB_NOT_GENERATABLE');
    expect(genSpy).not.toHaveBeenCalled();
  });

  it('after a free regenerate, a brand-new job still requires payment once the cap is exhausted', async () => {
    await seedUser(db, { headshotFreeGenerationCount: FREE_GENERATION_LIMIT });
    // Regenerate the existing ready job (consumes freeRegenUsed on that job).
    const readyJob = await seedJob(db, { status: 'ready', freeRegenUsed: false });
    const regen = await service.generateSet(readyJob, userId, 'corporate-linkedin');
    expect(regen.success).toBe(true);

    genSpy.mockClear();

    // A brand-new pending job for the same account: no free allowance left.
    const newJob = await seedJob(db);
    const result = await service.generateSet(newJob, userId, 'corporate-linkedin');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('PAYMENT_REQUIRED');
    expect(genSpy).not.toHaveBeenCalled();
  });

  it('retrying a failed job does NOT re-consume the per-account free allowance', async () => {
    // One slot already consumed on the original pending attempt; the job then failed.
    await seedUser(db, { headshotFreeGenerationCount: 1 });
    const jobId = await seedJob(db, { status: 'failed' });

    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');

    // Failed-job retries stay free/unrestricted (no cap re-check).
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.job.status).toBe('ready');
    expect(genSpy).toHaveBeenCalledTimes(3);

    const [u] = await db.select().from(user).where(eq(user.id, userId));
    expect(u.headshotFreeGenerationCount).toBe(1);
  });

  it('concurrent generations for the last free slot: only one wins; the other requires payment', async () => {
    // One slot remaining out of FREE_GENERATION_LIMIT.
    await seedUser(db, { headshotFreeGenerationCount: FREE_GENERATION_LIMIT - 1 });
    const jobA = await seedJob(db);
    const jobB = await seedJob(db);

    const [rA, rB] = await Promise.all([
      service.generateSet(jobA, userId, 'corporate-linkedin'),
      service.generateSet(jobB, userId, 'corporate-linkedin'),
    ]);

    const successes = [rA, rB].filter((r) => r.success);
    const failures = [rA, rB].filter((r) => !r.success);
    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    for (const f of failures) {
      if (!f.success) expect(f.error.code).toBe('PAYMENT_REQUIRED');
    }

    const [u] = await db.select().from(user).where(eq(user.id, userId));
    expect(u.headshotFreeGenerationCount).toBe(FREE_GENERATION_LIMIT);
  });
});
