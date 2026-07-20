import { eq, inArray } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '@/lib/logger';
import type { ServiceContext } from '@/lib/services/context';
import { r2Storage } from '@/lib/storage/r2-client';
import { user } from '@/modules/users/schema';
import { getTestDb } from '@/tests/utils/test-database';
import { headshotImages, headshotJobs } from '../schema';
import type { HeadshotService } from '../services/headshot.service';
import { createHeadshotService } from '../services/headshot.service';

/**
 * Retention slice (07) unit tests. These pin the two most dangerous
 * invariants of destructive data-minimization:
 *   1. the automatic 30-day cleanup NEVER deletes purchased (unlocked) images,
 *   2. user-initiated deletion is scoped strictly to the acting user.
 *
 * The R2 delete boundary is spied so no real network call is made and the exact
 * set of deleted keys can be asserted.
 */
describe('HeadshotService retention', () => {
  let service: HeadshotService;
  let db: ServiceContext['db'];
  let deleteSpy: ReturnType<typeof vi.spyOn>;

  const userA = 'retention-user-a';
  const userB = 'retention-user-b';

  const THIRTY_ONE_DAYS_AGO = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000);
  const RECENT = new Date(Date.now() - 1 * 24 * 60 * 60 * 1000);

  beforeEach(() => {
    db = getTestDb();
    const ctx: ServiceContext = { db, logger: createLogger() };
    service = createHeadshotService(ctx);
    deleteSpy = vi.spyOn(r2Storage, 'deleteFile').mockResolvedValue(undefined);
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    const jobs = await db
      .select({ id: headshotJobs.id })
      .from(headshotJobs)
      .where(inArray(headshotJobs.userId, [userA, userB]));
    const jobIds = jobs.map((j) => j.id);
    if (jobIds.length > 0) {
      await db.delete(headshotImages).where(inArray(headshotImages.jobId, jobIds));
    }
    await db.delete(headshotJobs).where(inArray(headshotJobs.userId, [userA, userB]));
    await db.delete(user).where(inArray(user.id, [userA, userB]));
  });

  async function seedUser(id: string) {
    await db
      .insert(user)
      .values({ id, email: `${id}@example.com`, emailVerified: true })
      .onConflictDoNothing();
  }

  interface SeedJobOpts {
    id: string;
    userId: string;
    unlocked?: boolean;
    createdAt: Date;
    imageCount?: number;
  }

  async function seedJob(opts: SeedJobOpts) {
    const { id, userId, unlocked = false, createdAt, imageCount = 2 } = opts;
    const sourceImageKey = `sources/${userId}/${id}.jpg`;
    await db.insert(headshotJobs).values({
      id,
      userId,
      sourceImageKey,
      status: 'ready',
      unlocked,
      createdAt,
      updatedAt: createdAt,
    });
    const rows = Array.from({ length: imageCount }, (_, i) => ({
      id: `${id}-img-${i}`,
      jobId: id,
      previewKey: `previews/${userId}/${id}/${i}.jpg`,
      fullKey: `full/${userId}/${id}/${i}.jpg`,
      styleVariant: 'corporate',
    }));
    if (rows.length > 0) await db.insert(headshotImages).values(rows);
    return { sourceImageKey, rows };
  }

  describe('cleanupExpired', () => {
    it('deletes the source + unpurchased outputs of a >30d-old, never-unlocked job and clears their keys', async () => {
      await seedUser(userA);
      const { sourceImageKey, rows } = await seedJob({
        id: 'exp-job',
        userId: userA,
        unlocked: false,
        createdAt: THIRTY_ONE_DAYS_AGO,
      });

      const result = await service.cleanupExpired();
      expect(result.success).toBe(true);

      const deletedKeys = deleteSpy.mock.calls.map((c: [string]) => c[0]);
      expect(deletedKeys).toContain(sourceImageKey);
      for (const row of rows) {
        expect(deletedKeys).toContain(row.previewKey);
        expect(deletedKeys).toContain(row.fullKey);
      }

      // The job's stored image keys no longer resolve: image rows are gone and
      // the source key is cleared on the job.
      const [job] = await db.select().from(headshotJobs).where(eq(headshotJobs.id, 'exp-job'));
      const imgs = await db
        .select()
        .from(headshotImages)
        .where(eq(headshotImages.jobId, 'exp-job'));
      expect(imgs).toHaveLength(0);
      // Source key cleared (job either removed or its source key nulled).
      if (job) expect(job.sourceImageKey === null || job.sourceImageKey === '').toBe(true);
    });

    it('NEVER deletes an unlocked (purchased) job — its full-res images survive even when >30d old', async () => {
      await seedUser(userA);
      const { sourceImageKey, rows } = await seedJob({
        id: 'paid-job',
        userId: userA,
        unlocked: true,
        createdAt: THIRTY_ONE_DAYS_AGO,
      });

      const result = await service.cleanupExpired();
      expect(result.success).toBe(true);

      const deletedKeys = deleteSpy.mock.calls.map((c: [string]) => c[0]);
      // The purchased job's full-res keys must never be handed to deleteFile.
      for (const row of rows) {
        expect(deletedKeys).not.toContain(row.fullKey);
      }
      // The source is also retained — the whole job is out of scope for cleanup.
      expect(deletedKeys).not.toContain(sourceImageKey);

      // Image rows are still present and downloadable via the existing path.
      const imgs = await db
        .select()
        .from(headshotImages)
        .where(eq(headshotImages.jobId, 'paid-job'));
      expect(imgs).toHaveLength(rows.length);
      for (const img of imgs) {
        expect(img.fullKey).toBeTruthy();
      }
    });

    it('does not touch jobs younger than 30 days', async () => {
      await seedUser(userA);
      const { sourceImageKey } = await seedJob({
        id: 'recent-job',
        userId: userA,
        unlocked: false,
        createdAt: RECENT,
      });

      const result = await service.cleanupExpired();
      expect(result.success).toBe(true);

      const deletedKeys = deleteSpy.mock.calls.map((c: [string]) => c[0]);
      expect(deletedKeys).not.toContain(sourceImageKey);

      const imgs = await db
        .select()
        .from(headshotImages)
        .where(eq(headshotImages.jobId, 'recent-job'));
      expect(imgs).toHaveLength(2);
    });
  });

  describe('deleteUserData', () => {
    it("deletes the acting user's sources + all generated images (preview + full) and removes their records", async () => {
      await seedUser(userA);
      const { sourceImageKey, rows } = await seedJob({
        id: 'mine-job',
        userId: userA,
        unlocked: true,
        createdAt: RECENT,
      });

      const result = await service.deleteUserData(userA);
      expect(result.success).toBe(true);

      const deletedKeys = deleteSpy.mock.calls.map((c: [string]) => c[0]);
      expect(deletedKeys).toContain(sourceImageKey);
      for (const row of rows) {
        expect(deletedKeys).toContain(row.previewKey);
        expect(deletedKeys).toContain(row.fullKey);
      }

      const jobs = await db.select().from(headshotJobs).where(eq(headshotJobs.userId, userA));
      expect(jobs).toHaveLength(0);
      const imgs = await db
        .select()
        .from(headshotImages)
        .where(eq(headshotImages.jobId, 'mine-job'));
      expect(imgs).toHaveLength(0);
    });

    it("is scoped to the acting user only — another user's data is untouched", async () => {
      await seedUser(userA);
      await seedUser(userB);
      const mine = await seedJob({
        id: 'a-job',
        userId: userA,
        unlocked: false,
        createdAt: RECENT,
      });
      const theirs = await seedJob({
        id: 'b-job',
        userId: userB,
        unlocked: false,
        createdAt: RECENT,
      });

      const result = await service.deleteUserData(userA);
      expect(result.success).toBe(true);

      const deletedKeys = deleteSpy.mock.calls.map((c: [string]) => c[0]);
      // User B's keys must never be deleted.
      expect(deletedKeys).not.toContain(theirs.sourceImageKey);
      for (const row of theirs.rows) {
        expect(deletedKeys).not.toContain(row.previewKey);
        expect(deletedKeys).not.toContain(row.fullKey);
      }
      // User A's own keys were deleted.
      expect(deletedKeys).toContain(mine.sourceImageKey);

      // User B's records are intact.
      const bJobs = await db.select().from(headshotJobs).where(eq(headshotJobs.userId, userB));
      expect(bJobs).toHaveLength(1);
      const bImgs = await db.select().from(headshotImages).where(eq(headshotImages.jobId, 'b-job'));
      expect(bImgs).toHaveLength(theirs.rows.length);
    });
  });
});
