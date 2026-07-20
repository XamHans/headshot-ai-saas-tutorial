import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';
import { createLogger } from '@/lib/logger';
import type { ServiceContext } from '@/lib/services/context';
import { getTestDb } from '@/tests/utils/test-database';
import { headshotRateLimits } from '../schema';
import {
  createRateLimitService,
  RATE_LIMIT_MAX,
  RATE_LIMIT_WINDOW_MS,
  type RateLimitService,
} from '../services/rate-limit.service';

/**
 * Unit tests for the DB-backed fixed-window rate limiter used at the generate
 * route boundary. Real test DB (no mocks) so the atomic upsert is exercised.
 */

describe('RateLimitService', () => {
  let service: RateLimitService;
  let db: ServiceContext['db'];

  beforeEach(() => {
    db = getTestDb();
    service = createRateLimitService({ db, logger: createLogger() });
  });

  it('allows attempts up to the limit, then throttles with RATE_LIMITED', async () => {
    const key = 'ip:1.2.3.4|fp:device-abc';

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      const r = await service.check(key);
      expect(r.success).toBe(true);
    }

    const blocked = await service.check(key);
    expect(blocked.success).toBe(false);
    if (!blocked.success) {
      expect(blocked.error.code).toBe('RATE_LIMITED');
      expect(blocked.error.message).toMatch(/try again/i);
    }
  });

  it('keeps distinct keys (different ip/fingerprint) independent', async () => {
    const keyA = 'ip:1.1.1.1|fp:aaa';
    const keyB = 'ip:2.2.2.2|fp:bbb';

    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await service.check(keyA);
    }
    expect((await service.check(keyA)).success).toBe(false);
    // A different key still has its full allowance.
    expect((await service.check(keyB)).success).toBe(true);
  });

  it('resets the counter once the window rolls over', async () => {
    const key = 'ip:9.9.9.9|fp:window';
    for (let i = 0; i < RATE_LIMIT_MAX; i++) {
      await service.check(key);
    }
    expect((await service.check(key)).success).toBe(false);

    // Backdate the stored window past its expiry (instead of faking wall-clock
    // time, which would freeze the real DB driver's async I/O).
    const expired = new Date(Date.now() - RATE_LIMIT_WINDOW_MS - 1000);
    await db
      .update(headshotRateLimits)
      .set({ windowStart: expired })
      .where(eq(headshotRateLimits.key, key));

    // Next attempt sees an expired window and starts fresh.
    expect((await service.check(key)).success).toBe(true);

    const [row] = await db.select().from(headshotRateLimits).where(eq(headshotRateLimits.key, key));
    expect(row.count).toBe(1);
  });
});
