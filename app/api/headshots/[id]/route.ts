import { z } from 'zod';
import { withAuth } from '@/lib/api/handlers';
import { parseWith } from '@/lib/validation/parse';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import type { GenerateSetResult } from '@/modules/headshot/types';

const idParamSchema = z.object({ id: z.string().min(1) });

// GET /api/headshots/[id] — load a job the caller owns, with fresh preview
// URLs. Lets /headshot redisplay results after a fresh page load (e.g. the
// payment-return redirect resets the wizard's in-memory React state) instead
// of restarting the upload flow from scratch.
export const GET = withAuth<GenerateSetResult>(async (session, _req, ctx) => {
  const params = await ctx.params;
  const idResult = parseWith(idParamSchema, {
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  if (!idResult.success) return idResult;

  return headshotService.getJobWithPreviews(idResult.data.id, session.user.id);
});
