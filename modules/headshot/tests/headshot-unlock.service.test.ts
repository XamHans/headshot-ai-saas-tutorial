import { eq } from 'drizzle-orm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createLogger } from '@/lib/logger';
import type { ServiceContext } from '@/lib/services/context';
import { emailService } from '@/lib/services/email';
import { r2Storage } from '@/lib/storage/r2-client';
import { user } from '@/modules/users/schema';
import { getTestDb } from '@/tests/utils/test-database';
import { headshotImages, headshotJobs } from '../schema';
import type { HeadshotService } from '../services/headshot.service';
import { createHeadshotService } from '../services/headshot.service';

/**
 * Unit tests for the unlock/full-res slice. These only touch `headshotJobs`
 * and `headshotImages`, which are test-schema-aware, so they run safely
 * against the test DB. The R2 signing boundary is spied so no real network
 * call is made and the short expiry can be asserted.
 */
describe('HeadshotService unlock + full-res', () => {
  let service: HeadshotService;
  let db: ServiceContext['db'];
  let signedUrlSpy: ReturnType<typeof vi.spyOn>;
  let sendEmailSpy: ReturnType<typeof vi.spyOn>;

  const ownerId = 'unlock-owner-id';
  const otherId = 'unlock-other-id';
  const ownerEmail = 'unlock-owner@example.com';

  beforeEach(() => {
    db = getTestDb();
    const ctx: ServiceContext = { db, logger: createLogger() };
    service = createHeadshotService(ctx);
    signedUrlSpy = vi
      .spyOn(r2Storage, 'getSignedUrl')
      .mockImplementation(async (key: string) => `https://signed.test/${key}?X-Amz-Expires=300`);
    sendEmailSpy = vi
      .spyOn(emailService, 'sendEmail')
      .mockResolvedValue({ success: true, data: { id: 'test-email-id' } });
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await db.delete(headshotImages).where(eq(headshotImages.jobId, 'unlock-job'));
    await db.delete(headshotJobs).where(eq(headshotJobs.id, 'unlock-job'));
    await db.delete(user).where(eq(user.id, ownerId));
  });

  async function seedReadyJob() {
    await db
      .insert(user)
      .values({ id: ownerId, email: ownerEmail, emailVerified: true })
      .onConflictDoNothing();
    await db.insert(headshotJobs).values({
      id: 'unlock-job',
      userId: ownerId,
      sourceImageKey: `sources/${ownerId}/unlock-job.jpg`,
      status: 'ready',
      unlocked: false,
    });
    await db.insert(headshotImages).values([
      {
        id: 'unlock-img-0',
        jobId: 'unlock-job',
        previewKey: `previews/${ownerId}/unlock-job/0.jpg`,
        fullKey: `full/${ownerId}/unlock-job/0.jpg`,
        styleVariant: 'corporate',
      },
      {
        id: 'unlock-img-1',
        jobId: 'unlock-job',
        previewKey: `previews/${ownerId}/unlock-job/1.jpg`,
        fullKey: `full/${ownerId}/unlock-job/1.jpg`,
        styleVariant: 'corporate',
      },
    ]);
  }

  describe('markUnlocked', () => {
    it('flips unlocked to true and stamps paymentId (idempotent: only first call flips)', async () => {
      await seedReadyJob();

      const first = await service.markUnlocked('unlock-job', 'pay-123');
      expect(first.success).toBe(true);
      if (first.success) expect(first.data.flipped).toBe(true);

      const [afterFirst] = await db
        .select()
        .from(headshotJobs)
        .where(eq(headshotJobs.id, 'unlock-job'));
      expect(afterFirst.unlocked).toBe(true);
      expect(afterFirst.paymentId).toBe('pay-123');

      // Redelivery of the same webhook: no-op, does not overwrite paymentId.
      const second = await service.markUnlocked('unlock-job', 'pay-DIFFERENT');
      expect(second.success).toBe(true);
      if (second.success) expect(second.data.flipped).toBe(false);

      const [afterSecond] = await db
        .select()
        .from(headshotJobs)
        .where(eq(headshotJobs.id, 'unlock-job'));
      expect(afterSecond.unlocked).toBe(true);
      expect(afterSecond.paymentId).toBe('pay-123');
    });

    it('is race-safe: two concurrent calls flip the row exactly once', async () => {
      await seedReadyJob();

      // Fire both unlocks concurrently. A check-then-act implementation could
      // let BOTH observe unlocked=false and both flip (and both report
      // flipped=true, with the second clobbering paymentId). The atomic
      // conditional UPDATE guarantees exactly one winner.
      const [a, b] = await Promise.all([
        service.markUnlocked('unlock-job', 'pay-A'),
        service.markUnlocked('unlock-job', 'pay-B'),
      ]);

      expect(a.success).toBe(true);
      expect(b.success).toBe(true);
      const flips = [a, b].filter((r) => r.success && r.data.flipped);
      expect(flips).toHaveLength(1);

      const [row] = await db.select().from(headshotJobs).where(eq(headshotJobs.id, 'unlock-job'));
      expect(row.unlocked).toBe(true);
      // The stamped paymentId is the winner's — never overwritten by the loser.
      expect(['pay-A', 'pay-B']).toContain(row.paymentId);
    });

    it('returns JOB_NOT_FOUND when the job does not exist', async () => {
      const result = await service.markUnlocked('no-such-job', 'pay-x');
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('JOB_NOT_FOUND');
    });

    it('sends the buyer a results email exactly once on the flip; redelivery sends no second email', async () => {
      await seedReadyJob();

      const first = await service.markUnlocked('unlock-job', 'pay-123');
      expect(first.success).toBe(true);
      if (first.success) expect(first.data.flipped).toBe(true);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
      const [call] = sendEmailSpy.mock.calls;
      expect(call[0]).toMatchObject({
        to: ownerEmail,
        templateName: 'headshot-results',
      });
      expect(call[0].templateProps?.url).toContain('/headshot?job=unlock-job');

      // Redelivery of the same webhook: idempotent no-op, no second email.
      const second = await service.markUnlocked('unlock-job', 'pay-DIFFERENT');
      expect(second.success).toBe(true);
      if (second.success) expect(second.data.flipped).toBe(false);

      expect(sendEmailSpy).toHaveBeenCalledTimes(1);
    });

    it('still returns success and flipped:true when the results email fails to send', async () => {
      await seedReadyJob();
      sendEmailSpy.mockResolvedValue({
        success: false,
        error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'Resend is down' },
      });

      const result = await service.markUnlocked('unlock-job', 'pay-123');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.flipped).toBe(true);
        expect(result.data.jobId).toBe('unlock-job');
      }
    });
  });

  describe('getFullResUrls', () => {
    it('returns short-lived signed full-res URLs for an unlocked, owned job', async () => {
      await seedReadyJob();
      await service.markUnlocked('unlock-job', 'pay-123');

      const result = await service.getFullResUrls('unlock-job', ownerId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toHaveLength(2);
        for (const img of result.data) {
          expect(img.fullUrl).toContain('full/');
        }
      }

      // Every signed URL carried a short expiry (minutes, not the 3600s default)
      // AND forced Content-Disposition: attachment — the anchor `download`
      // attribute is silently ignored by browsers for cross-origin R2 URLs, so
      // without a response-header override clicking "Download" just opens the
      // image inline instead of saving it.
      expect(signedUrlSpy).toHaveBeenCalled();
      for (const call of signedUrlSpy.mock.calls) {
        expect(call[0]).toMatch(/^full\//);
        expect(call[1]).toBeLessThanOrEqual(600);
        expect(call[1]).toBeGreaterThan(0);
        expect(call[2]?.responseContentDisposition).toMatch(/^attachment/);
      }
    });

    it('denies full-res for an un-unlocked job with FORBIDDEN and issues no signed URL', async () => {
      await seedReadyJob();

      const result = await service.getFullResUrls('unlock-job', ownerId);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('FORBIDDEN');
      expect(signedUrlSpy).not.toHaveBeenCalled();
    });

    it("denies another user's job with JOB_NOT_FOUND (no existence leak)", async () => {
      await seedReadyJob();
      await service.markUnlocked('unlock-job', 'pay-123');

      const result = await service.getFullResUrls('unlock-job', otherId);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('JOB_NOT_FOUND');
      expect(signedUrlSpy).not.toHaveBeenCalled();
    });

    it('returns JOB_NOT_FOUND for a missing job', async () => {
      const result = await service.getFullResUrls('no-such-job', ownerId);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('JOB_NOT_FOUND');
    });
  });

  describe('getJobWithPreviews', () => {
    it('returns the job and fresh preview URLs for its images', async () => {
      await seedReadyJob();

      const result = await service.getJobWithPreviews('unlock-job', ownerId);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.job.id).toBe('unlock-job');
        expect(result.data.previews).toHaveLength(2);
        for (const preview of result.data.previews) {
          expect(preview.previewUrl).toContain('previews/');
        }
      }

      for (const call of signedUrlSpy.mock.calls) {
        expect(call[0]).toMatch(/^previews\//);
      }
    });

    it("denies another user's job with JOB_NOT_FOUND (no existence leak)", async () => {
      await seedReadyJob();

      const result = await service.getJobWithPreviews('unlock-job', otherId);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('JOB_NOT_FOUND');
      expect(signedUrlSpy).not.toHaveBeenCalled();
    });

    it('returns JOB_NOT_FOUND for a missing job', async () => {
      const result = await service.getJobWithPreviews('no-such-job', ownerId);
      expect(result.success).toBe(false);
      if (!result.success) expect(result.error.code).toBe('JOB_NOT_FOUND');
    });
  });
});
