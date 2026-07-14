'use client';

import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { GenerateSetResult } from '@/modules/headshot/types';
import { getDeviceFingerprint } from './use-device-fingerprint';

export interface GenerateVars {
  jobId: string;
  styleId: string;
}

/**
 * Runs a synchronous 3-variant generation set for a job. Generation happens
 * server-side (3 parallel Gemini calls + a single whole-set retry), so this
 * mutation can take real wall-clock time; loading/error come from the mutation
 * (`isPending` / `isError` / `error`), never local flags.
 *
 * The response carries only watermarked preview DTOs — no full-res URL.
 */
export function useHeadshotGenerate() {
  return useMutation<GenerateSetResult, Error, GenerateVars>({
    mutationFn: async ({ jobId, styleId }) => {
      // Compute the device fingerprint and send it in the JSON body (never a
      // custom header — fetchApi replaces default headers). The route pairs it
      // with the request IP for rate limiting.
      const fingerprint = await getDeviceFingerprint();
      return fetchApi<GenerateSetResult>(`/api/headshots/${jobId}/generate`, {
        method: 'POST',
        body: JSON.stringify({ styleId, fingerprint }),
      });
    },
  });
}
