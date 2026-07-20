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
import { createHeadshotService } from '../services/headshot.service';
import * as generator from '../services/headshot-generator';

/**
 * Service tests for `generateSet`. Per the slice brief, the failure-injection
 * tests spy ONLY the Gemini-call boundary (`generateHeadshotImage`) — R2 and
 * the DB are exercised for real (R2 network calls are intercepted by the global
 * MSW mocks, plus a per-test GET handler that returns the source photo bytes),
 * so the watermark → upload → persist → status path runs end to end with a
 * deterministic, cost-free fake image.
 */

const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');
const userId = 'gen-user';

let fakeImage: Buffer;
let sourcePhoto: Buffer;

function okImage(): Awaited<ReturnType<typeof generator.generateHeadshotImage>> {
  return { success: true, data: { buffer: fakeImage, mediaType: 'image/png' } };
}

function failImage(): Awaited<ReturnType<typeof generator.generateHeadshotImage>> {
  return { success: false, error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'boom' } };
}

async function seedPendingJob(db: ServiceContext['db'], overrides: Record<string, unknown> = {}) {
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

/**
 * Seed the owning user with their one free generation still available, so the
 * slice-04 per-account cap lets a first (`pending`) generation proceed. The cap
 * logic itself is covered exhaustively in generate-cap.service.test.ts.
 */
async function seedFreeUser(db: ServiceContext['db']) {
  await db.insert(user).values({
    id: userId,
    email: `${userId}-${crypto.randomUUID()}@example.com`,
    emailVerified: true,
    biometricConsentAt: new Date(),
  });
}

describe('HeadshotService.generateSet', () => {
  let service: HeadshotService;
  let db: ServiceContext['db'];
  let genSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(async () => {
    db = getTestDb();
    service = createHeadshotService({ db, logger: createLogger() });
    await seedFreeUser(db);

    const sharp = (await import('sharp')).default;
    fakeImage = await sharp({
      create: { width: 200, height: 200, channels: 3, background: { r: 80, g: 90, b: 160 } },
    })
      .png()
      .toBuffer();

    sourcePhoto = readFileSync(join(FIXTURES, 'portrait-source.jpg'));

    // Return the real source-photo bytes for the signed GET the service issues
    // when loading the source (R2 client itself is NOT spied — it really signs;
    // MSW intercepts the resulting network calls).
    server.use(
      http.get('https://*.r2.cloudflarestorage.com/*', () =>
        HttpResponse.arrayBuffer(sourcePhoto.buffer.slice(0), {
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      ),
    );

    genSpy = vi.spyOn(generator, 'generateHeadshotImage');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rejects an unknown styleId with VALIDATION_ERROR and does not call Gemini', async () => {
    const jobId = await seedPendingJob(db);
    const result = await service.generateSet(jobId, userId, 'not-a-real-style');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(genSpy).not.toHaveBeenCalled();
  });

  it('returns JOB_NOT_FOUND when the job belongs to another user (no existence leak)', async () => {
    const jobId = await seedPendingJob(db);
    const result = await service.generateSet(jobId, 'someone-else', 'corporate-linkedin');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('JOB_NOT_FOUND');
    expect(genSpy).not.toHaveBeenCalled();
  });

  it('refuses to generate a ready job whose free regenerate is already used', async () => {
    // A ready job with its one free regenerate available IS generatable (slice
    // 04); only once `freeRegenUsed` is set does it become non-generatable.
    const jobId = await seedPendingJob(db, { status: 'ready', freeRegenUsed: true });
    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');

    expect(result.success).toBe(false);
    if (!result.success) expect(result.error.code).toBe('JOB_NOT_GENERATABLE');
    expect(genSpy).not.toHaveBeenCalled();
  });

  it('happy path: 3 previews, job ready, 3 image rows, and NO fullKey in the result', async () => {
    const jobId = await seedPendingJob(db);
    genSpy.mockResolvedValue(okImage());

    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.previews).toHaveLength(3);
      expect(result.data.job.status).toBe('ready');
      expect(result.data.job.styleId).toBe('corporate-linkedin');
      const serialized = JSON.stringify(result.data);
      expect(serialized).not.toContain('fullKey');
      expect(serialized).not.toContain('full/');
      for (const p of result.data.previews) {
        expect(p.previewUrl).toContain('previews/');
        expect(p.previewUrl).not.toContain('full/');
      }
    }

    const rows = await db.select().from(headshotImages).where(eq(headshotImages.jobId, jobId));
    expect(rows).toHaveLength(3);
    for (const r of rows) {
      expect(r.previewKey).toMatch(/^previews\//);
      expect(r.fullKey).toMatch(/^full\//);
      expect(r.styleVariant).toBe('corporate-linkedin');
    }
    expect(genSpy).toHaveBeenCalledTimes(3);
  });

  it('hard failure auto-retries once and succeeds; free allowance unchanged', async () => {
    const jobId = await seedPendingJob(db);
    let call = 0;
    genSpy.mockImplementation(async () => {
      call++;
      return call <= 3 ? failImage() : okImage();
    });

    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.previews).toHaveLength(3);
      expect(result.data.job.status).toBe('ready');
    }

    const rows = await db.select().from(headshotImages).where(eq(headshotImages.jobId, jobId));
    expect(rows).toHaveLength(3);

    const [job] = await db.select().from(headshotJobs).where(eq(headshotJobs.id, jobId));
    expect(job.freeRegenUsed).toBe(false);
  });

  it('persistent failure: job failed, ZERO image rows, free allowance unchanged', async () => {
    const jobId = await seedPendingJob(db);
    genSpy.mockResolvedValue(failImage());

    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(['GENERATION_FAILED', 'EXTERNAL_SERVICE_ERROR']).toContain(result.error.code);
    }

    const rows = await db.select().from(headshotImages).where(eq(headshotImages.jobId, jobId));
    expect(rows).toHaveLength(0);

    const [job] = await db.select().from(headshotJobs).where(eq(headshotJobs.id, jobId));
    expect(job.status).toBe('failed');
    expect(job.freeRegenUsed).toBe(false);
  });

  it('allows retrying a previously failed job', async () => {
    const jobId = await seedPendingJob(db, { status: 'failed' });
    genSpy.mockResolvedValue(okImage());

    const result = await service.generateSet(jobId, userId, 'corporate-linkedin');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.job.status).toBe('ready');
  });
});
