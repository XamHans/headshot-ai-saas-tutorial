import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { withAuth } from '@/lib/api/handlers';
import { db } from '@/lib/db';
import type { Result } from '@/lib/result';
import { parseWith } from '@/lib/validation/parse';
import { headshotJobs } from '@/modules/headshot/schema';
import { paymentService } from '@/modules/payments/services/payment.service';
import type { Payment } from '@/modules/payments/types';

const idParamSchema = z.object({ id: z.string().min(1) });

// POST /api/headshots/[id]/unlock — start a one-time $5 Stripe Checkout that,
// once paid, unlocks the clean full-res downloads for this job.
//
// Ownership is verified BEFORE any Stripe call: a missing or non-owned job gets
// `JOB_NOT_FOUND` (no existence leak, no Stripe session created). The returned
// Payment carries `stripeCheckoutUrl` so the client can redirect the browser.
export const POST = withAuth<Payment>(async (session, _req, ctx) => {
  const params = await ctx.params;
  const idResult = parseWith(idParamSchema, {
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  if (!idResult.success) return idResult;

  const jobId = idResult.data.id;

  const [job] = await db().select().from(headshotJobs).where(eq(headshotJobs.id, jobId)).limit(1);

  if (!job || job.userId !== session.user.id) {
    return {
      success: false,
      error: { code: 'JOB_NOT_FOUND', message: 'Job not found.' },
    } satisfies Result<Payment>;
  }

  return paymentService.createPayment(
    {
      amount: '5.00',
      currency: 'USD',
      description: 'Headshot AI — full-resolution downloads',
      metadata: { jobId },
    },
    session.user.id,
  );
});
