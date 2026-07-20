import { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Route-boundary integration test for the "delete my data" endpoint.
 *
 * The route uses `withAuth` and must scope deletion strictly to the session's
 * own user id — never a client-supplied id. This pins:
 *   - an unauthenticated caller is rejected (401) and nothing is deleted,
 *   - an authenticated caller triggers deletion for THEIR id only.
 */

const sessionUserId = 'delete-route-session-user';

const getSessionMock = vi.fn();
vi.mock('@/lib/auth', () => ({
  auth: { api: { getSession: getSessionMock } },
}));

vi.mock('@/modules/headshot/services/headshot.service', () => ({
  headshotService: {
    deleteUserData: vi.fn(async () => ({
      success: true,
      data: { jobsDeleted: 1, keysDeleted: 3 },
    })),
  },
}));

function makeRequest() {
  return new NextRequest('http://localhost/api/headshot/delete-my-data', { method: 'POST' });
}

describe('POST /api/headshot/delete-my-data — scoped account deletion', () => {
  // biome-ignore lint/suspicious/noExplicitAny: dynamically imported route module.
  let POST: any;
  // biome-ignore lint/suspicious/noExplicitAny: spied singleton.
  let deleteSpy: any;

  beforeEach(async () => {
    ({ POST } = await import('../../../app/api/headshot/delete-my-data/route'));
    const { headshotService } = await import('../services/headshot.service');
    deleteSpy = headshotService.deleteUserData;
    deleteSpy.mockClear();
    getSessionMock.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('rejects an unauthenticated request and deletes nothing', async () => {
    getSessionMock.mockResolvedValue(null);
    const res = await POST(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(401);
    expect(deleteSpy).not.toHaveBeenCalled();
  });

  it("deletes only the session user's data", async () => {
    getSessionMock.mockResolvedValue({
      user: { id: sessionUserId, email: 'me@example.com', name: 'Me' },
    });
    const res = await POST(makeRequest(), { params: Promise.resolve({}) });
    expect(res.status).toBe(200);
    expect(deleteSpy).toHaveBeenCalledTimes(1);
    expect(deleteSpy).toHaveBeenCalledWith(sessionUserId);
  });
});
