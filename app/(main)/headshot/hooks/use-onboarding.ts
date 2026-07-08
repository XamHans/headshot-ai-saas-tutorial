'use client';

import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { RecordConsentResult, RequestMagicLinkResult } from '@/modules/headshot/types';

/**
 * Requests a verification magic link for the given email. Disposable domains
 * are rejected server-side, surfaced here as a thrown Error message.
 */
export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (email: string) =>
      fetchApi<RequestMagicLinkResult>('/api/headshot/magic-link', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),
  });
}

/**
 * Records explicit biometric consent for the signed-in, verified user.
 */
export function useRecordConsent() {
  return useMutation({
    mutationFn: () =>
      fetchApi<RecordConsentResult>('/api/headshot/consent', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
  });
}
