import type { NextRequest } from 'next/server';
import { withAuth } from '@/lib/api/handlers';
import { parseRequestBody } from '@/lib/validation/parse';
import { createPaymentSchema } from '@/modules/payments/schemas';
import { paymentService } from '@/modules/payments/services/payment.service';
import type { CreatePaymentInput } from '@/modules/payments/types';

/**
 * POST /api/payments/create
 * Create a new payment via Stripe Checkout
 */
export const POST = withAuth(async (session, request: NextRequest) => {
  const bodyResult = await parseRequestBody(request, createPaymentSchema);
  if (!bodyResult.success) return bodyResult;

  return paymentService.createPayment(bodyResult.data as CreatePaymentInput, session.user.id);
});
