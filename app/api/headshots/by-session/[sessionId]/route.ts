import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { withAuth } from '@/lib/api/handlers';
import { db } from '@/lib/db';
import type { Result } from '@/lib/result';
import { parseWith } from '@/lib/validation/parse';
import { headshotJobs } from '@/modules/headshot/schema';
import { paymentService } from '@/modules/payments/services/payment.service';

const paramSchema = z.object({ sessionId: z.string().min(1) });

type JobUnlockStatus = { id: string; unlocked: boolean };

// GET /api/headshots/by-session/[sessionId] — resolve a Stripe Checkout session
// back to its headshot job's unlock status, so the /payments/return page can
// poll until the webhook lands. Reads `metadata.jobId` off the payment row
// (stored at createPayment time), verifies the job belongs to the caller, and
// returns `{ id, unlocked }`. A non-owned/missing job is `JOB_NOT_FOUND`.
export const GET = withAuth<JobUnlockStatus>(async (session, _req, ctx) => {
  const params = await ctx.params;
  const parsed = parseWith(paramSchema, {
    sessionId: Array.isArray(params.sessionId) ? params.sessionId[0] : params.sessionId,
  });
  if (!parsed.success) return parsed;

  const payment = await paymentService.getPaymentByStripeSessionId(parsed.data.sessionId);
  const jobId =
    payment?.metadata && typeof payment.metadata === 'object'
      ? (payment.metadata as Record<string, unknown>).jobId
      : undefined;

  if (!payment || typeof jobId !== 'string') {
    return {
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' },
    } satisfies Result<JobUnlockStatus>;
  }

  const [job] = await db()
    .select({ id: headshotJobs.id, userId: headshotJobs.userId, unlocked: headshotJobs.unlocked })
    .from(headshotJobs)
    .where(eq(headshotJobs.id, jobId))
    .limit(1);

  if (!job || job.userId !== session.user.id) {
    return {
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' },
    } satisfies Result<JobUnlockStatus>;
  }

  return { success: true, data: { id: job.id, unlocked: job.unlocked } };
});
