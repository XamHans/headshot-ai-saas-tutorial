import { eq } from 'drizzle-orm';
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
  HeadshotJob,
  RecordConsentResult,
  RequestMagicLinkResult,
} from '../types';
// Imported as a namespace so the Gemini-call boundary can be spied in tests.
import * as generator from './headshot-generator';

/** Per-Gemini-call hard timeout. Two attempts × 25s ≈ 50s worst case. */
const GENERATION_TIMEOUT_MS = 25_000;

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
        .set({ status: 'ready', updatedAt: new Date() })
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

    if (job.status !== 'pending' && job.status !== 'failed') {
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
