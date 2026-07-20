import type { NextRequest } from 'next/server';
import { withHandler } from '@/lib/api/handlers';
import type { Result } from '@/lib/result';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import type { CleanupResult } from '@/modules/headshot/types';

/**
 * GET/POST /api/headshots/cleanup — the scheduled 30-day retention sweep.
 *
 * Invoked by Vercel Cron (see `vercel.json`) via a GET request, with NO session
 * — so this is deliberately NOT a `withAuth` route. Instead it is guarded by a
 * shared cron secret: Vercel Cron sends `Authorization: Bearer $CRON_SECRET`.
 * Any request that does not present the exact secret is rejected with
 * `UNAUTHORIZED` and no deletion is performed. POST is kept for manual
 * triggering with the same secret.
 */
const runCleanup = withHandler<CleanupResult>(async (req: NextRequest) => {
  const secret = process.env.CRON_SECRET;
  const authorized = Boolean(secret) && req.headers.get('authorization') === `Bearer ${secret}`;

  if (!authorized) {
    return {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Invalid cron secret.' },
    } satisfies Result<CleanupResult>;
  }

  return headshotService.cleanupExpired();
});

export const GET = runCleanup;
export const POST = runCleanup;
