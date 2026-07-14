import { eq } from 'drizzle-orm';
import type { NextRequest } from 'next/server';
import { z } from 'zod';
import { withAuth } from '@/lib/api/handlers';
import { db } from '@/lib/db';
import type { Result } from '@/lib/result';
import { parseRequestBody, parseWith } from '@/lib/validation/parse';
import { generateSetSchema } from '@/modules/headshot/schemas';
import { headshotService } from '@/modules/headshot/services/headshot.service';
import { rateLimitService } from '@/modules/headshot/services/rate-limit.service';
import type { GenerateSetResult } from '@/modules/headshot/types';
import { user as userTable } from '@/modules/users/schema';

// Two attempts × 25s hard timeout each can approach ~50s.
export const maxDuration = 60;

const idParamSchema = z.object({ id: z.string().min(1) });

/** Vercel-style client IP from `x-forwarded-for` (first hop), with a fallback. */
function clientIp(req: NextRequest): string {
  const forwarded = req.headers.get('x-forwarded-for');
  return forwarded?.split(',')[0]?.trim() || req.headers.get('x-real-ip')?.trim() || 'unknown';
}

// POST /api/headshots/[id]/generate — run a synchronous 3-variant generation
// set for a pending/failed job and return watermarked preview DTOs.
//
// Auth: `withAuth` requires a session; we additionally re-enforce the slice-01
// verified + consented gate in-route (mirrors app/api/headshots/route.ts).
//
// The response carries ONLY client-safe preview DTOs (`{id, styleVariant,
// previewUrl}`) — the service never returns a fullKey/full-res URL.
export const POST = withAuth<GenerateSetResult>(async (session, req, ctx) => {
  const [row] = await db()
    .select()
    .from(userTable)
    .where(eq(userTable.id, session.user.id))
    .limit(1);

  if (!row || !row.emailVerified) {
    return {
      success: false,
      error: { code: 'FORBIDDEN', message: 'Please verify your email before generating.' },
    } satisfies Result<GenerateSetResult>;
  }
  if (!row.biometricConsentAt) {
    return {
      success: false,
      error: {
        code: 'CONSENT_REQUIRED',
        message: 'Biometric consent is required before generating.',
      },
    } satisfies Result<GenerateSetResult>;
  }

  const params = await ctx.params;
  const idResult = parseWith(idParamSchema, {
    id: Array.isArray(params.id) ? params.id[0] : params.id,
  });
  if (!idResult.success) return idResult;

  const bodyResult = await parseRequestBody(req, generateSetSchema);
  if (!bodyResult.success) return bodyResult;

  // IP + device-fingerprint rate limit — enforced BEFORE the service (and thus
  // before any Gemini spend). A throttled request never reaches generateSet.
  const rateKey = `ip:${clientIp(req)}|fp:${bodyResult.data.fingerprint ?? 'none'}`;
  const limit = await rateLimitService.check(rateKey);
  if (!limit.success) return limit;

  return headshotService.generateSet(idResult.data.id, session.user.id, bodyResult.data.styleId);
});
