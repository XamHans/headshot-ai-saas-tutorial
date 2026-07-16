import { and, eq, lt, sql } from 'drizzle-orm';
import { isDisposableEmail } from '@/lib/auth/disposable-domains';
import { compositeWatermark } from '@/lib/media/watermark';
import type { Result } from '@/lib/result';
import { getServiceContext, type ServiceContext } from '@/lib/services';
import { r2Storage } from '@/lib/storage/r2-client';
import { type FaceGateResult, runFaceGate } from '@/lib/vision/face-detection';
import { user } from '@/modules/users/schema';
import { headshotImages, headshotJobs } from '../schema';
import { createJobInputSchema } from '../schemas';
import { getHeadshotStyle, HEADSHOT_VARIANT_COUNT, isValidStyleId } from '../styles';
import type {
  CreateJobInput,
  GenerateSetResult,
  HeadshotFullResDTO,
  HeadshotJob,
  RecordConsentResult,
  RequestMagicLinkResult,
} from '../types';
// Imported as a namespace so the Gemini-call boundary can be spied in tests.
import * as generator from './headshot-generator';

/** Per-Gemini-call hard timeout. Two attempts × 25s ≈ 50s worst case. */
const GENERATION_TIMEOUT_MS = 25_000;

/** Per-account free-generation cap — how many new (`pending`) jobs a single account may generate for free, ever. */
export const FREE_GENERATION_LIMIT = 3;

/**
 * Expiry (seconds) for the post-unlock full-res signed URLs. Deliberately
 * short — minutes, not the R2 client's 3600s default — so a leaked URL is
 * useless almost immediately.
 */
const FULL_RES_URL_EXPIRY_SECONDS = 300;

/** Race a promise against a timeout; a timeout resolves to a Result error. */
async function withTimeout<T>(promise: Promise<Result<T>>, ms: number): Promise<Result<T>> {
  let timer: ReturnType<typeof setTimeout>;
  const timeout = new Promise<Result<T>>((resolve) => {
    timer = setTimeout(
      () =>
        resolve({
          success: false,
          error: { code: 'EXTERNAL_SERVICE_ERROR', message: 'Image generation timed out.' },
        }),
      ms,
    );
  });
  try {
    return await Promise.race([promise, timeout]);
  } finally {
    // biome-ignore lint/style/noNonNullAssertion: timer is always assigned synchronously above.
    clearTimeout(timer!);
  }
}

/** Face-gate rejection reason → friendly, specific client guidance. */
function faceGateMessage(gate: FaceGateResult): string {
  switch (gate.reason) {
    case 'multiple_faces':
      return 'We found more than one face — please upload a photo with just you in it.';
    case 'low_resolution':
      return 'This image is too small — please upload a higher-resolution photo of your face.';
    case 'undecodable':
      return "We couldn't read that image — please upload a valid JPEG or PNG photo.";
    default:
      return "We couldn't find a clear single face — try a well-lit photo facing the camera, with no sunglasses.";
  }
}

/**
 * Business logic for the onboarding gate: guards magic-link requests against
 * disposable domains and persists biometric consent against the account.
 *
 * The actual magic-link dispatch + email verification is owned by Better Auth
 * (see `lib/auth.ts`); this service adds the disposable-domain policy and the
 * consent persistence that Better Auth doesn't know about.
 */
export class HeadshotService {
  constructor(private ctx: ServiceContext) {}

  private get logger() {
    return this.ctx.logger.child({ service: 'HeadshotService' });
  }

  /**
   * Policy check performed before any magic link is sent or account created.
   * Returns an error Result for disposable domains so the caller can bail
   * before touching Better Auth.
   */
  assertOnboardableEmail(email: string): Result<RequestMagicLinkResult> {
    if (isDisposableEmail(email)) {
      this.logger.info('Rejected disposable email at onboarding', {
        operation: 'assertOnboardableEmail',
      });
      return {
        success: false,
        error: {
          code: 'DISPOSABLE_EMAIL',
          message:
            'Please use a real, permanent email address — disposable inboxes are not allowed.',
        },
      };
    }
    return { success: true, data: { sent: true } };
  }

  /**
   * Records explicit biometric consent for a verified user by stamping
   * `biometricConsentAt`. Idempotent — re-consenting refreshes the timestamp.
   */
  async recordBiometricConsent(userId: string): Promise<Result<RecordConsentResult>> {
    this.logger.info('Recording biometric consent', {
      operation: 'recordBiometricConsent',
      userId,
    });

    try {
      const consentedAt = new Date();
      const [updated] = await this.ctx.db
        .update(user)
        .set({ biometricConsentAt: consentedAt, updatedAt: consentedAt })
        .where(eq(user.id, userId))
        .returning();

      if (!updated) {
        return {
          success: false,
          error: { code: 'USER_NOT_FOUND', message: 'User not found' },
        };
      }

      return {
        success: true,
        data: { biometricConsentAt: consentedAt.toISOString() },
      };
    } catch (error) {
      this.logger.error('Failed to record biometric consent', {
        error,
        operation: 'recordBiometricConsent',
        userId,
      });
      return {
        success: false,
        error: {
          code: 'DATABASE_ERROR',
          message: 'Failed to record consent',
          cause: error,
        },
      };
    }
  }

  /**
   * Creates a headshot job from an uploaded source photo. Runs strictly:
   *   1. re-validate file metadata (size/mime/extension) — never trust client
   *   2. pre-flight face gate on the pixels — BEFORE any R2/DB write and BEFORE
   *      any image-generation model could ever be contacted
   *   3. on pass: store source privately in R2, insert a `pending` job row
   *
   * A photo that fails validation or the face gate produces zero job rows and
   * zero storage writes — the core budget-protecting invariant of this slice.
   */
  async createJob(input: CreateJobInput, userId: string): Promise<Result<HeadshotJob>> {
    this.logger.info('Creating headshot job', {
      operation: 'createJob',
      userId,
      contentType: input.contentType,
      size: input.size,
    });

    // 1. Re-validate file metadata server-side (independent of the client).
    const parsed = createJobInputSchema.safeParse({
      contentType: input.contentType,
      filename: input.filename,
      size: input.size,
    });
    if (!parsed.success) {
      return {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: parsed.error.issues[0]?.message ?? 'Invalid upload.',
          details: {
            issues: parsed.error.issues.map((i) => ({
              path: i.path.join('.'),
              message: i.message,
            })),
          },
        },
      };
    }

    // 2. Pre-flight face gate — runs on the buffer BEFORE any I/O or spend.
    const gate = await runFaceGate(input.buffer);
    if (gate.reason !== 'ok') {
      this.logger.info('Photo rejected by face gate', {
        operation: 'createJob',
        userId,
        reason: gate.reason,
        faceCount: gate.faceCount,
      });
      return {
        success: false,
        error: {
          code: gate.reason === 'multiple_faces' ? 'MULTIPLE_FACES_DETECTED' : 'NO_FACE_DETECTED',
          message: faceGateMessage(gate),
        },
      };
    }

    // 3. Passed — store the source privately in R2, then insert a pending job.
    const jobId = crypto.randomUUID();
    const sourceImageKey = `sources/${userId}/${jobId}.jpg`;

    try {
      await r2Storage.uploadFile(sourceImageKey, input.buffer, input.contentType);
    } catch (error) {
      this.logger.error('Failed to upload source image to R2', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'createJob',
        userId,
        sourceImageKey,
      });
      return {
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'Failed to store your photo — please try again.',
          cause: error,
        },
      };
    }

    try {
      const [job] = await this.ctx.db
        .insert(headshotJobs)
        .values({ id: jobId, userId, sourceImageKey, status: 'pending' })
        .returning();

      this.logger.info('Headshot job created', {
        operation: 'createJob',
        userId,
        jobId: job.id,
      });

      return { success: true, data: job };
    } catch (error) {
      this.logger.error('Failed to insert headshot job', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'createJob',
        userId,
        jobId,
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to create job', cause: error },
      };
    }
  }

  /**
   * Runs a full 3-variant generation set for a pending/failed job:
   *   1. Load + own the job; guard status (pending/failed only).
   *   2. Validate the styleId against the known presets.
   *   3. Flip status → generating, persist styleId.
   *   4. Fan out 3 parallel Gemini image-to-image calls (each timeout-bounded).
   *      If the whole attempt fails, retry the whole attempt once.
   *   5. On success: watermark each output, upload preview + full to R2 under
   *      distinct keys, insert one image row each, flip status → ready.
   *   6. On persistent failure: status → failed, ZERO image rows written.
   *
   * Returns only client-safe preview DTOs — never a fullKey/full-res URL.
   */
  async generateSet(
    jobId: string,
    userId: string,
    styleId: string,
  ): Promise<Result<GenerateSetResult>> {
    this.logger.info('Generating headshot set', {
      operation: 'generateSet',
      userId,
      jobId,
      styleId,
    });

    // 1-2. Ownership + style + status guards (see helper).
    const guard = await this.loadGeneratableJob(jobId, userId, styleId);
    if (!guard.success) return guard;
    const { job, style } = guard.data;

    // A `pending` job is a brand-new (never-attempted) generation — this is the
    // one place the per-account `FREE_GENERATION_LIMIT` free-generation cap is
    // consumed. Failed-job retries and free-regens of a `ready` job skip this
    // entirely.
    const isFirstAttempt = job.status === 'pending';
    // A `ready` job that reaches here still had `freeRegenUsed === false` (the
    // guard enforced that) — this attempt is the single free regenerate.
    const isFreeRegen = job.status === 'ready';

    if (isFirstAttempt) {
      const claimed = await this.consumeFreeGeneration(userId);
      if (!claimed) {
        // Slot already taken. Leave the job `pending` (no `generating`, no
        // spend) so a later paid path can still run it.
        this.logger.info('Free generation cap reached — payment required', {
          operation: 'generateSet',
          userId,
          jobId,
        });
        return {
          success: false,
          error: {
            code: 'PAYMENT_REQUIRED',
            message: "You've used all your free generations. Unlock more with a purchase.",
          },
        };
      }
    }

    // 3. Flip to generating + persist styleId.
    await this.ctx.db
      .update(headshotJobs)
      .set({ status: 'generating', styleId, updatedAt: new Date() })
      .where(eq(headshotJobs.id, jobId));

    // Load the source photo once (reused across both attempts).
    let sourceBuffer: Buffer;
    try {
      sourceBuffer = await this.loadSource(job.sourceImageKey);
    } catch (error) {
      await this.markFailed(jobId);
      this.logger.error('Failed to load source image for generation', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'generateSet',
        userId,
        jobId,
      });
      return {
        success: false,
        error: { code: 'GENERATION_FAILED', message: 'Could not load your source photo.' },
      };
    }

    // 4. Attempt (with a single whole-set retry).
    let buffers = await this.runAttempt(sourceBuffer, style.prompt, {
      userId,
      jobId,
      styleId,
    });
    if (!buffers) {
      this.logger.info('First generation attempt failed — retrying once', {
        operation: 'generateSet',
        userId,
        jobId,
      });
      buffers = await this.runAttempt(sourceBuffer, style.prompt, { userId, jobId, styleId });
    }

    if (!buffers) {
      await this.markFailed(jobId);
      this.logger.error('Generation failed after retry', {
        operation: 'generateSet',
        userId,
        jobId,
      });
      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: "We couldn't generate your headshots — please try again.",
        },
      };
    }

    // 5. Watermark + upload + persist. On any failure here, mark failed and do
    // not leave partial image rows.
    try {
      const previews: GenerateSetResult['previews'] = [];
      const imageRows: (typeof headshotImages.$inferInsert)[] = [];

      for (let i = 0; i < buffers.length; i++) {
        const { previewBuffer, fullBuffer } = await compositeWatermark(buffers[i]);
        const previewKey = `previews/${userId}/${jobId}/${i}.jpg`;
        const fullKey = `full/${userId}/${jobId}/${i}.jpg`;

        await r2Storage.uploadFile(previewKey, previewBuffer, 'image/jpeg');
        await r2Storage.uploadFile(fullKey, fullBuffer, 'image/jpeg');

        const imageId = crypto.randomUUID();
        imageRows.push({
          id: imageId,
          jobId,
          previewKey,
          fullKey,
          styleVariant: styleId,
        });

        // Signed URL for the PREVIEW only — the full-res key is never signed
        // or returned here (that happens post-payment in a later slice).
        const previewUrl = await r2Storage.getSignedUrl(previewKey);
        previews.push({ id: imageId, styleVariant: styleId, previewUrl });
      }

      await this.ctx.db.insert(headshotImages).values(imageRows);

      const [updated] = await this.ctx.db
        .update(headshotJobs)
        .set({
          status: 'ready',
          updatedAt: new Date(),
          // A successful free regenerate consumes the per-job allowance so the
          // same job can't be regenerated for free again.
          ...(isFreeRegen ? { freeRegenUsed: true } : {}),
        })
        .where(eq(headshotJobs.id, jobId))
        .returning();

      this.logger.info('Headshot set generated', {
        operation: 'generateSet',
        userId,
        jobId,
        count: previews.length,
      });

      return { success: true, data: { job: updated, previews } };
    } catch (error) {
      await this.markFailed(jobId);
      this.logger.error('Failed to persist generated headshots', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'generateSet',
        userId,
        jobId,
      });
      return {
        success: false,
        error: {
          code: 'GENERATION_FAILED',
          message: "We couldn't finish preparing your headshots — please try again.",
        },
      };
    }
  }

  /**
   * Atomically unlock a job once its one-time payment succeeds. Called from the
   * Stripe webhook, which Stripe can redeliver (and can deliver concurrently
   * with a redelivery). Idempotency is enforced by a single conditional UPDATE
   * that only matches a still-locked row:
   *
   *   UPDATE headshot_jobs SET unlocked = true, payment_id = $1
   *   WHERE id = $2 AND unlocked = false
   *
   * An empty `returning()` means the row was already unlocked — a correct
   * no-op, NOT an error (`flipped: false`). A missing job is `JOB_NOT_FOUND`.
   */
  async markUnlocked(
    jobId: string,
    paymentId: string,
  ): Promise<Result<{ jobId: string; flipped: boolean }>> {
    this.logger.info('Marking job unlocked', {
      operation: 'markUnlocked',
      jobId,
      paymentId,
    });

    try {
      const flipped = await this.ctx.db
        .update(headshotJobs)
        .set({ unlocked: true, paymentId, updatedAt: new Date() })
        .where(and(eq(headshotJobs.id, jobId), eq(headshotJobs.unlocked, false)))
        .returning({ id: headshotJobs.id });

      if (flipped.length > 0) {
        return { success: true, data: { jobId, flipped: true } };
      }

      // No row flipped: either already unlocked (idempotent no-op) or the job
      // doesn't exist. Distinguish so a genuinely missing job surfaces clearly.
      const [existing] = await this.ctx.db
        .select({ id: headshotJobs.id })
        .from(headshotJobs)
        .where(eq(headshotJobs.id, jobId))
        .limit(1);

      if (!existing) {
        return { success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } };
      }

      this.logger.info('Job already unlocked — no-op', {
        operation: 'markUnlocked',
        jobId,
      });
      return { success: true, data: { jobId, flipped: false } };
    } catch (error) {
      this.logger.error('Failed to mark job unlocked', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'markUnlocked',
        jobId,
        paymentId,
      });
      return {
        success: false,
        error: { code: 'DATABASE_ERROR', message: 'Failed to unlock job', cause: error },
      };
    }
  }

  /**
   * Post-unlock: issue short-lived signed URLs to the CLEAN full-res images.
   *
   * Ownership/unlock guards (mirrors `loadGeneratableJob` — no existence leak):
   *   - missing job OR not owned → `JOB_NOT_FOUND`
   *   - owned but not unlocked   → `FORBIDDEN`
   *
   * Never issues a full-res URL for an un-unlocked or non-owned job. Each URL
   * carries a short expiry (`FULL_RES_URL_EXPIRY_SECONDS`), not the R2 default.
   */
  async getFullResUrls(jobId: string, userId: string): Promise<Result<HeadshotFullResDTO[]>> {
    this.logger.info('Issuing full-res URLs', {
      operation: 'getFullResUrls',
      jobId,
      userId,
    });

    try {
      const [job] = await this.ctx.db
        .select()
        .from(headshotJobs)
        .where(eq(headshotJobs.id, jobId))
        .limit(1);

      if (!job || job.userId !== userId) {
        return { success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } };
      }

      if (job.unlocked !== true) {
        return {
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Unlock this job to download full-resolution images.',
          },
        };
      }

      const images = await this.ctx.db
        .select()
        .from(headshotImages)
        .where(eq(headshotImages.jobId, jobId));

      const dtos: HeadshotFullResDTO[] = [];
      for (let i = 0; i < images.length; i++) {
        const image = images[i];
        if (!image.fullKey) continue;
        // Force a real download rather than an inline open: the anchor `download`
        // attribute is silently ignored by browsers for cross-origin URLs (R2's
        // domain differs from the app's), so without this response-header
        // override clicking "Download" just opens the image in the browser.
        const filename = `headshot-${image.styleVariant ?? 'photo'}-${i + 1}.jpg`;
        const fullUrl = await r2Storage.getSignedUrl(image.fullKey, FULL_RES_URL_EXPIRY_SECONDS, {
          responseContentDisposition: `attachment; filename="${filename}"`,
        });
        dtos.push({ id: image.id, styleVariant: image.styleVariant, fullUrl });
      }

      return { success: true, data: dtos };
    } catch (error) {
      this.logger.error('Failed to issue full-res URLs', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'getFullResUrls',
        jobId,
        userId,
      });
      return {
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'Failed to prepare your downloads — please try again.',
          cause: error,
        },
      };
    }
  }

  /**
   * Load a job the caller owns, with fresh signed preview URLs for its images.
   * Used to redisplay results/downloads on a fresh page load of `/headshot`
   * (e.g. after the payment-return redirect), where the wizard's in-memory
   * React state has been reset and there's nothing else to hydrate it from.
   */
  async getJobWithPreviews(jobId: string, userId: string): Promise<Result<GenerateSetResult>> {
    this.logger.info('Loading job with previews', {
      operation: 'getJobWithPreviews',
      jobId,
      userId,
    });

    try {
      const [job] = await this.ctx.db
        .select()
        .from(headshotJobs)
        .where(eq(headshotJobs.id, jobId))
        .limit(1);

      if (!job || job.userId !== userId) {
        return { success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } };
      }

      const images = await this.ctx.db
        .select()
        .from(headshotImages)
        .where(eq(headshotImages.jobId, jobId));

      const previews: GenerateSetResult['previews'] = [];
      for (const image of images) {
        if (!image.previewKey) continue;
        const previewUrl = await r2Storage.getSignedUrl(image.previewKey);
        previews.push({ id: image.id, styleVariant: image.styleVariant, previewUrl });
      }

      return { success: true, data: { job, previews } };
    } catch (error) {
      this.logger.error('Failed to load job with previews', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'getJobWithPreviews',
        jobId,
        userId,
      });
      return {
        success: false,
        error: {
          code: 'EXTERNAL_SERVICE_ERROR',
          message: 'Failed to load your headshots — please try again.',
          cause: error,
        },
      };
    }
  }

  /**
   * Guard preamble for `generateSet`: loads the job, enforces ownership (a
   * non-owner gets `JOB_NOT_FOUND` — no existence leak), validates the styleId,
   * and enforces the status guard (only `pending`/`failed` may generate).
   */
  private async loadGeneratableJob(
    jobId: string,
    userId: string,
    styleId: string,
  ): Promise<Result<{ job: HeadshotJob; style: { id: string; prompt: string } }>> {
    const [job] = await this.ctx.db
      .select()
      .from(headshotJobs)
      .where(eq(headshotJobs.id, jobId))
      .limit(1);

    if (!job || job.userId !== userId) {
      return { success: false, error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' } };
    }

    const style = isValidStyleId(styleId) ? getHeadshotStyle(styleId) : undefined;
    if (!style) {
      return { success: false, error: { code: 'VALIDATION_ERROR', message: 'Unknown style.' } };
    }

    // Generatable statuses: `pending` (first attempt), `failed` (free retry),
    // and `ready` ONLY when the one free regenerate hasn't been used yet.
    const isFreeRegenAvailable = job.status === 'ready' && job.freeRegenUsed === false;
    if (job.status !== 'pending' && job.status !== 'failed' && !isFreeRegenAvailable) {
      return {
        success: false,
        error: {
          code: 'JOB_NOT_GENERATABLE',
          message:
            job.status === 'generating'
              ? 'Generation is already in progress.'
              : 'This job has already been generated.',
        },
      };
    }

    return { success: true, data: { job, style } };
  }

  /** Load the private source photo bytes from R2 via a signed URL fetch. */
  private async loadSource(sourceImageKey: string): Promise<Buffer> {
    const signedUrl = await r2Storage.getSignedUrl(sourceImageKey);
    const res = await fetch(signedUrl);
    if (!res.ok) {
      throw new Error(`Failed to fetch source (${res.status})`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * One whole attempt: 3 parallel, timeout-bounded Gemini calls. Returns the
   * array of clean image buffers on full success, or `null` if ANY call fails
   * (so the caller can retry the whole attempt).
   */
  private async runAttempt(
    sourceBuffer: Buffer,
    prompt: string,
    telemetry: { userId: string; jobId: string; styleId: string },
  ): Promise<Buffer[] | null> {
    const results = await Promise.all(
      Array.from({ length: HEADSHOT_VARIANT_COUNT }, () =>
        withTimeout(
          generator.generateHeadshotImage({
            sourceBuffer,
            sourceMediaType: 'image/jpeg',
            prompt,
            telemetry,
          }),
          GENERATION_TIMEOUT_MS,
        ),
      ),
    );

    if (results.some((r) => !r.success)) {
      return null;
    }
    return results.map((r) => (r.success ? r.data.buffer : Buffer.alloc(0)));
  }

  /**
   * Race-safe consumption of one of the account's `FREE_GENERATION_LIMIT` free
   * generation slots. A single conditional UPDATE increments
   * `headshotFreeGenerationCount` only while it is still below the cap; the
   * `RETURNING` row proves this caller won a slot. Postgres serializes
   * concurrent UPDATEs on the same row, so once the cap is reached no more
   * callers can win — exactly `FREE_GENERATION_LIMIT` total across any number
   * of concurrent first-generations. Returns `true` if this call claimed a slot.
   */
  private async consumeFreeGeneration(userId: string): Promise<boolean> {
    const claimed = await this.ctx.db
      .update(user)
      .set({
        headshotFreeGenerationCount: sql`${user.headshotFreeGenerationCount} + 1`,
        updatedAt: new Date(),
      })
      .where(and(eq(user.id, userId), lt(user.headshotFreeGenerationCount, FREE_GENERATION_LIMIT)))
      .returning({ id: user.id });
    return claimed.length > 0;
  }

  /** Flip a job to `failed` (best-effort; swallow secondary errors). */
  private async markFailed(jobId: string): Promise<void> {
    try {
      await this.ctx.db
        .update(headshotJobs)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(headshotJobs.id, jobId));
    } catch (error) {
      this.logger.error('Failed to mark job failed', {
        error: error instanceof Error ? error : new Error(String(error)),
        operation: 'markFailed',
        jobId,
      });
    }
  }
}

/**
 * Factory for tests — inject a test ServiceContext.
 */
export function createHeadshotService(ctx: ServiceContext): HeadshotService {
  return new HeadshotService(ctx);
}

/**
 * Singleton for production use — import this directly in API routes.
 */
export const headshotService = new HeadshotService(getServiceContext());
