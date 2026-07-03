import { withAuth } from '@/lib/api/handlers';
import { paymentService } from '@/modules/payments/services/payment.service';

/**
 * GET /api/payments/[id]
 * Get payment details by ID.
 *
 * Requires authentication. Users can only view their own payments.
 */
export const GET = withAuth(async (session, _req, ctx) => {
  const { id } = await ctx.params;

  const result = await paymentService.getPaymentById(id as string);
  if (!result.success) return result;

  // Authorization - a user can only view their own payments
  if (result.data.userId !== session.user.id) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'You do not have permission to view this payment' },
    };
  }

  return result;
});
