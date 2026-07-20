import { sql } from 'drizzle-orm';
import type { Result } from '@/lib/result';
import { getServiceContext, type ServiceContext } from '@/lib/services';
import { headshotRateLimits } from '../schema';

/**
 * Fixed-window rate limit for the generation endpoint. A handful of attempts
 * per minute per `ip + fingerprint` is plenty for a legitimate user (each real
 * generation is a deliberate, ~minute-long action) while blocking scripted
 * abuse well before any Gemini spend.
 */
export const RATE_LIMIT_MAX = 5;
export const RATE_LIMIT_WINDOW_MS = 60_000;

/**
 * DB-backed fixed-window rate limiter. The counter lives in `headshot_rate_limits`
 * (one row per key). Each `check` is a single atomic upsert: on conflict it
 * either rolls the window over (resetting the count to 1) if the stored window
 * has expired, or increments in place — so concurrent requests can't race past
 * the limit via a read-then-write gap.
 */
export class RateLimitService {
  constructor(private ctx: ServiceContext) {}

  private get logger() {
    return this.ctx.logger.child({ service: 'RateLimitService' });
  }

  /**
   * Register one attempt against `key`. Returns a success Result while the key
   * is within its per-window allowance, or a `RATE_LIMITED` error Result once
   * the window's attempts exceed {@link RATE_LIMIT_MAX}.
   */
  async check(key: string): Promise<Result<void>> {
    const now = new Date();
    // ISO strings cast to `timestamp` (the column type) inside SQL — passing raw
    // Date objects makes the driver bind them as `timestamptz`, which the column
    // comparison rejects.
    const nowIso = now.toISOString();
    const cutoffIso = new Date(now.getTime() - RATE_LIMIT_WINDOW_MS).toISOString();
    const nowExpr = sql`${nowIso}::timestamp`;
    const cutoffExpr = sql`${cutoffIso}::timestamp`;

    // Atomic fixed-window upsert: reset to a fresh window when the stored one
    // has expired, otherwise increment in place. RETURNING gives us the count
    // as seen by THIS request, so the decision below is race-free.
    const [row] = await this.ctx.db
      .insert(headshotRateLimits)
      .values({ key, windowStart: now, count: 1 })
      .onConflictDoUpdate({
        target: headshotRateLimits.key,
        set: {
          windowStart: sql`case when ${headshotRateLimits.windowStart} < ${cutoffExpr} then ${nowExpr} else ${headshotRateLimits.windowStart} end`,
          count: sql`case when ${headshotRateLimits.windowStart} < ${cutoffExpr} then 1 else ${headshotRateLimits.count} + 1 end`,
        },
      })
      .returning({ count: headshotRateLimits.count });

    if (row && row.count > RATE_LIMIT_MAX) {
      this.logger.info('Generation attempt rate-limited', { operation: 'check', key });
      return {
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: "You're going a little fast — please wait a moment and try again.",
        },
      };
    }

    return { success: true, data: undefined };
  }
}

/** Factory for tests — inject a test ServiceContext. */
export function createRateLimitService(ctx: ServiceContext): RateLimitService {
  return new RateLimitService(ctx);
}

/** Singleton for production use — import this directly in API routes. */
export const rateLimitService = new RateLimitService(getServiceContext());
