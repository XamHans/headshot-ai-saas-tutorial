'use client';

import { useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';

type JobUnlockStatus = { id: string; unlocked: boolean };

/**
 * Polls a headshot job's unlock status by Stripe Checkout session id. The
 * webhook that flips `unlocked` may not have landed when the browser is
 * redirected back to /payments/return, so we poll (every 2s) until it does,
 * then stop. `sessionId` is read from the `session_id` query param that
 * Stripe appends to `success_url`.
 */
export function useJobUnlockPoll(sessionId: string | null) {
  return useQuery<JobUnlockStatus, Error>({
    queryKey: ['job-unlock', sessionId],
    queryFn: () => fetchApi<JobUnlockStatus>(`/api/headshots/by-session/${sessionId}`),
    enabled: Boolean(sessionId),
    refetchInterval: (query) => (query.state.data?.unlocked ? false : 2000),
  });
}
