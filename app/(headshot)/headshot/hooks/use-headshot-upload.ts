'use client';

import { useMutation } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { HeadshotJob } from '@/modules/headshot/types';

/**
 * Uploads a single source photo to create a headshot job. Server-side the
 * upload passes the pre-flight face gate before any job/storage write, so a
 * rejected photo surfaces here as a thrown Error with friendly guidance.
 *
 * Uses `fetchApi` with an empty `headers` object so the browser sets the
 * multipart boundary itself (the default JSON content-type would break the
 * upload).
 */
export function useHeadshotUpload() {
  return useMutation<HeadshotJob, Error, File>({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return fetchApi<HeadshotJob>('/api/headshots', {
        method: 'POST',
        body: formData,
        headers: {},
      });
    },
  });
}
