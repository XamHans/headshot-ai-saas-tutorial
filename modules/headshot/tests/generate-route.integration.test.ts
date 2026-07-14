import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { ServiceContext } from '@/lib/services/context';
import { user } from '@/modules/users/schema';
import { getTestDb } from '@/tests/utils/test-database';
import { headshotImages, headshotJobs } from '../schema';
import * as generator from '../services/headshot-generator';
import { RATE_LIMIT_MAX } from '../services/rate-limit.service';

/**
 * Route-boundary integration test for slice-04 scenario 4: rapid repeated
 * attempts from the same IP + fingerprint are throttled BEFORE any spend.
 *
 * The auth boundary (`auth.api.getSession`), the `db()` singleton, and the
 * service context are pointed at the real test DB; the Gemini boundary is spied
 * so we can assert throttled requests make ZERO model calls. No real Gemini
 * spend — the rate limit blocks before the service is ever reached, and the
 * seeded user has already spent its free generation so even un-throttled
 * requests bail cheaply at PAYMENT_REQUIRED.
 */

const userId = 'rl-route-user';

vi.mock('@/lib/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(async () => ({
        user: { id: userId, email: 'rl@example.com', name: 'RL' },
      })),
    },
  },
}));

vi.mock('@/lib/db', async () => {
  const { getTestDb } = await import('@/tests/utils/test-database');
  return { db: () => getTestDb() };
});

vi.mock('@/lib/services', async () => {
  const actual = await vi.importActual<typeof import('@/lib/services')>('@/lib/services');
  const { getTestDb } = await import('@/tests/utils/test-database');
  const { createLogger } = await import('@/lib/logger');
  // `db` is resolved lazily via a Proxy: the service singletons capture this
  // context at import time (before the test DB is ready), so every db access
  // must dereference the CURRENT test DB, not whatever existed at that instant.
  const lazyDb = new Proxy(
    {},
    {
      get(_t, prop) {
        // biome-ignore lint/suspicious/noExplicitAny: forwarding to the live test db.
        return (getTestDb() as any)[prop];
      },
    },
  );
  return {
    ...actual,
    // biome-ignore lint/suspicious/noExplicitAny: proxied test db.
    getServiceContext: () => ({ db: lazyDb as any, logger: createLogger() }),
  };
});

function makeRequest(jobId: string, fingerprint: string, ip = '203.0.113.7') {
  return new NextRequest(`http://localhost/api/headshots/${jobId}/generate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-for': ip },
    body: JSON.stringify({ styleId: 'corporate-linkedin', fingerprint }),
  });
}

async function seedPendingJob(db: ServiceContext['db']): Promise<string> {
  const jobId = crypto.randomUUID();
  await db.insert(headshotJobs).values({
    id: jobId,
    userId,
    sourceImageKey: `sources/${userId}/${jobId}.jpg`,
    status: 'pending',
  });
  return jobId;
}

describe('POST /api/headshots/[id]/generate — rate limiting', () => {
  let db: ServiceContext['db'];
  let genSpy: ReturnType<typeof vi.spyOn>;
  // biome-ignore lint/suspicious/noExplicitAny: dynamically imported route module.
  let POST: any;

  beforeEach(async () => {
    db = getTestDb();
    ({ POST } = await import('../../../app/api/headshots/[id]/generate/route'));
    genSpy = vi.spyOn(generator, 'generateHeadshotImage');

    await db.insert(user).values({
      id: userId,
      email: `${userId}-${crypto.randomUUID()}@example.com`,
      emailVerified: true,
      biometricConsentAt: new Date(),
      headshotFreeGenerationUsedAt: new Date(),
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('throttles rapid attempts from the same IP+fingerprint before any spend', async () => {
    const fp = 'device-fp-throttle';

    const codes: string[] = [];
    for (let i = 0; i < RATE_LIMIT_MAX + 3; i++) {
      const jobId = await seedPendingJob(db);
      const res = await POST(makeRequest(jobId, fp), { params: Promise.resolve({ id: jobId }) });
      const json = await res.json();
      codes.push(json.success ? 'OK' : json.code);
    }

    // The tail of attempts (beyond the window limit) is throttled with 429.
    const throttled = codes.filter((c) => c === 'RATE_LIMITED');
    expect(throttled.length).toBeGreaterThan(0);

    // Throttled requests never reach the model — and neither does anything else
    // here (free generation already spent), so zero Gemini calls, zero rows.
    expect(genSpy).not.toHaveBeenCalled();
    const rows = await db.select().from(headshotImages);
    expect(rows).toHaveLength(0);
  });

  it('a different fingerprint is not throttled by another device hitting the limit', async () => {
    const jobA = await seedPendingJob(db);

    for (let i = 0; i < RATE_LIMIT_MAX + 1; i++) {
      await POST(makeRequest(jobA, 'device-A'), { params: Promise.resolve({ id: jobA }) });
    }

    const jobB = await seedPendingJob(db);
    const res = await POST(makeRequest(jobB, 'device-B'), {
      params: Promise.resolve({ id: jobB }),
    });
    const json = await res.json();
    // Same IP, different fingerprint → still has its allowance (bails at
    // PAYMENT_REQUIRED, not RATE_LIMITED).
    expect(json.code).not.toBe('RATE_LIMITED');
  });
});
