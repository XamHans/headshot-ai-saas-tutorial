'use client';

import { useMutation, useQuery } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { HeadshotFullResDTO } from '@/modules/headshot/types';
import type { Payment } from '@/modules/payments/types';

/**
 * Starts the one-time $5 Stripe Checkout that unlocks full-res downloads for a
 * job. On success the server returns the Payment (with `stripeCheckoutUrl`);
 * we send the browser straight to Stripe's hosted Checkout page.
 */
export function useUnlockHeadshot(jobId: string) {
  return useMutation<Payment, Error, void>({
    mutationFn: () => fetchApi<Payment>(`/api/headshots/${jobId}/unlock`, { method: 'POST' }),
    onSuccess: (payment) => {
      if (payment.stripeCheckoutUrl) {
        window.location.href = payment.stripeCheckoutUrl;
      }
    },
  });
}

/**
 * Fetches short-lived signed URLs to the clean full-res images for an unlocked
 * job. Only enabled once the job is unlocked — the server denies (FORBIDDEN)
 * otherwise, so there is no point querying before then.
 */
export function useFullResImages(jobId: string, enabled: boolean) {
  return useQuery<HeadshotFullResDTO[], Error>({
    queryKey: ['headshot-full-res', jobId],
    queryFn: () => fetchApi<HeadshotFullResDTO[]>(`/api/headshots/${jobId}/full-res`),
    enabled: enabled && Boolean(jobId),
  });
}
