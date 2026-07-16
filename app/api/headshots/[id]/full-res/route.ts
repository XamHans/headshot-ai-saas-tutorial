import { z } from 'zod';
import { withAuth } from '@/lib/api/handlers';
import { parseWith } from '@/lib/validation/parse';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import type { HeadshotFullResDTO } from '@/modules/headshot/types';

const idParamSchema = z.object({ id: z.string().min(1) });

// GET /api/headshots/[id]/full-res — return short-lived signed URLs to the
// clean full-res images. Thin route: the service enforces ownership + unlock
// (JOB_NOT_FOUND for missing/non-owned, FORBIDDEN for un-unlocked) and issues
// the signed URLs. Full-res never leaves here before payment.
export const GET = withAuth<HeadshotFullResDTO[]>(async (session, _req, ctx) => {
  const params = await ctx.params;
  const idResult = parseWith(idParamSchema, {
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  if (!idResult.success) return idResult;

  return headshotService.getFullResUrls(idResult.data.id, session.user.id);
});
