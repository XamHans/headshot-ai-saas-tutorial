import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '@/lib/logger';
import type { ServiceContext } from '@/lib/services/context';
import { r2Storage } from '@/lib/storage/r2-client';
import { getTestDb } from '@/tests/utils/test-database';
import { headshotJobs } from '../schema';
import type { HeadshotService } from '../services/headshot.service';
import { createHeadshotService } from '../services/headshot.service';
import type { CreateJobInput } from '../types';

const FIXTURES = join(process.cwd(), 'modules/headshot/tests/fixtures');

function fixtureInput(name: string, overrides: Partial<CreateJobInput> = {}): CreateJobInput {
  return {
    buffer: readFileSync(join(FIXTURES, name)),
    contentType: 'image/jpeg',
    filename: name,
    size: readFileSync(join(FIXTURES, name)).byteLength,
    ...overrides,
  };
}

describe('HeadshotService.createJob', () => {
  let service: HeadshotService;
  let db: ServiceContext['db'];
  // Spy on the R2 boundary so we can assert it is NOT touched on a rejected
  // photo (proxy for "no spend"): no storage write, and — since createJob is
  // the only path to a job row — no job created means no downstream generation.
  let uploadSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    db = getTestDb();
    const ctx: ServiceContext = { db, logger: createLogger() };
    service = createHeadshotService(ctx);
    uploadSpy = vi
      .spyOn(r2Storage, 'uploadFile')
      .mockResolvedValue('https://example.test/stored-object');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const userId = 'test-user-id';

  it('rejects a photo with no face BEFORE any storage write or job row', async () => {
    const result = await service.createJob(fixtureInput('no-face.jpg'), userId);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('NO_FACE_DETECTED');
    }
    // Budget invariant: nothing was stored, no job row exists.
    expect(uploadSpy).not.toHaveBeenCalled();
    const rows = await db.select().from(headshotJobs).where(eq(headshotJobs.userId, userId));
    expect(rows).toHaveLength(0);
  });

  it('rejects a photo with multiple faces before any spend', async () => {
    const result = await service.createJob(fixtureInput('multiple-faces.jpg'), userId);

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('MULTIPLE_FACES_DETECTED');
    }
    expect(uploadSpy).not.toHaveBeenCalled();
    const rows = await db.select().from(headshotJobs).where(eq(headshotJobs.userId, userId));
    expect(rows).toHaveLength(0);
  });

  it('rejects an oversized file with VALIDATION_ERROR and no face-gate/spend', async () => {
    const result = await service.createJob(
      fixtureInput('single-face.jpg', { size: 20 * 1024 * 1024 }),
      userId,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(uploadSpy).not.toHaveBeenCalled();
    const rows = await db.select().from(headshotJobs).where(eq(headshotJobs.userId, userId));
    expect(rows).toHaveLength(0);
  });

  it('rejects a wrong file type with VALIDATION_ERROR', async () => {
    const result = await service.createJob(
      fixtureInput('single-face.jpg', { contentType: 'application/pdf', filename: 'resume.pdf' }),
      userId,
    );

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.code).toBe('VALIDATION_ERROR');
    }
    expect(uploadSpy).not.toHaveBeenCalled();
  });

  it('accepts a clear single face: stores the source and creates a pending job', async () => {
    const result = await service.createJob(fixtureInput('single-face.jpg'), userId);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.status).toBe('pending');
      expect(result.data.userId).toBe(userId);
      expect(result.data.sourceImageKey).toBe(`sources/${userId}/${result.data.id}.jpg`);
      expect(result.data.unlocked).toBe(false);
    }

    // Source stored exactly once, under the private sources/ prefix.
    expect(uploadSpy).toHaveBeenCalledTimes(1);
    const [key] = uploadSpy.mock.calls[0];
    expect(key).toMatch(new RegExp(`^sources/${userId}/.+\\.jpg$`));

    const rows = await db.select().from(headshotJobs).where(eq(headshotJobs.userId, userId));
    expect(rows).toHaveLength(1);
    expect(rows[0].status).toBe('pending');
  });
});
