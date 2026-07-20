import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-boundary integration test for the scheduled cleanup endpoint.
 *
 * The endpoint is protected by a shared cron secret (Vercel Cron has no
 * session, so it does NOT use `withAuth`). This pins the security invariant:
 * without the valid secret the request is rejected AND the deletion service is
 * never invoked.
 *
 * The service singleton's `cleanupExpired` is spied so we can assert exactly
 * whether deletion was attempted — no DB or R2 access is needed for the auth
 * behaviour.
 */

const CRON_SECRET = 'test-cron-secret';

vi.mock('@/modules/headshot/services/headshot.service', () => ({
  headshotService: {
    cleanupExpired: vi.fn(async () => ({ success: true, data: { jobsSwept: 0, keysDeleted: 0 } })),
  },
}));

function makeRequest(authHeader?: string, method: 'GET' | 'POST' = 'POST') {
  const headers: Record<string, string> = {};
  if (authHeader !== undefined) headers.authorization = authHeader;
  return new NextRequest('http://localhost/api/headshots/cleanup', { method, headers });
}

describe('GET/POST /api/headshots/cleanup — cron-secret guard', () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamically imported route module.
  let GET: any;
  // biome-ignore lint/suspicious/noExplicitAny: dynamically imported route module.
  let POST: any;
  // biome-ignore lint/suspicious/noExplicitAny: spied singleton.
  let cleanupSpy: any;

  beforeEach(async () => {
    vi.stubEnv('CRON_SECRET', CRON_SECRET);
    ({ GET, POST } = await import('../../../app/api/headshots/cleanup/route'));
    const { headshotService } = await import('../services/headshot.service');
    cleanupSpy = headshotService.cleanupExpired;
    cleanupSpy.mockClear();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.clearAllMocks();
  });

  it('rejects a request with no authorization header and performs no deletion', async () => {
    const res = await POST(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(cleanupSpy).not.toHaveBeenCalled();
  });

  it('rejects a request with a wrong secret and performs no deletion', async () => {
    const res = await POST(makeRequest('Bearer wrong-secret'), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(cleanupSpy).not.toHaveBeenCalled();
  });

  it('runs the cleanup when the valid cron secret is presented', async () => {
    const res = await POST(makeRequest(`Bearer ${CRON_SECRET}`), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  // Vercel Cron invokes the path with a GET request — the guard must hold there too.
  it('rejects an unauthenticated GET and performs no deletion', async () => {
    const res = await GET(makeRequest(undefined, 'GET'), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(cleanupSpy).not.toHaveBeenCalled();
  });

  it('runs the cleanup on a GET with the valid cron secret', async () => {
    const res = await GET(makeRequest(`Bearer ${CRON_SECRET}`, 'GET'), {
      params: Promise.resolve({}),
    });
    expect(res.status).toBe(200);
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });
});
