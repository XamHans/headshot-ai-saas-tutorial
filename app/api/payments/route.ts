import { withAuth } from '@/lib/api/handlers';
import { parseSearchParams } from '@/lib/validation/parse';
import { getPaymentsQuerySchema } from '@/modules/payments/schemas';
import { paymentService } from '@/modules/payments/services/payment.service';

// GET /api/payments - List the current user's payments (requires authentication)
export const GET = withAuth(async (session, req) => {
  const paramsResult = parseSearchParams(req.url, getPaymentsQuerySchema);
  if (!paramsResult.success) return paramsResult;

  return paymentService.getUserPayments({
    ...paramsResult.data,
    userId: session.user.id,
  });
});
