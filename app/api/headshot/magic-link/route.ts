import { withHandler } from '@/lib/api/handlers';
import { auth } from '@/lib/auth';
import type { Result } from '@/lib/result';
import { parseRequestBody } from '@/lib/validation/parse';
import { requestMagicLinkSchema } from '@/modules/headshot/schemas';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import type { RequestMagicLinkResult } from '@/modules/headshot/types';

// POST /api/headshot/magic-link — send a verification magic link (public).
// Disposable domains are rejected before any account or verification row is
// created, and before any email is sent.
export const POST = withHandler<RequestMagicLinkResult>(async (req) => {
  const bodyResult = await parseRequestBody(req, requestMagicLinkSchema);
  if (!bodyResult.success) return bodyResult;

  const { email } = bodyResult.data;

  const policy = headshotService.assertOnboardableEmail(email);
  if (!policy.success) return policy;

  try {
    await auth.api.signInMagicLink({
      body: { email, callbackURL: '/' },
      headers: req.headers,
    });
  } catch (error) {
    const failure: Result<RequestMagicLinkResult> = {
      success: false,
      error: {
        code: 'EXTERNAL_SERVICE_ERROR',
        message: 'Could not send the verification email. Please try again.',
        cause: error,
      },
    };
    return failure;
  }

  return { success: true, data: { sent: true } };
});
