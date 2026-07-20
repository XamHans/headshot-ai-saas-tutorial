'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { DeleteUserDataResult } from '@/modules/headshot/types';

/**
 * "Delete my data": permanently removes the signed-in user's source photos and
 * generated images (preview + full) from storage and their headshot records.
 * Scoped server-side to the session user; the route uses `withAuth`.
 *
 * On success we drop any cached headshot queries so the UI reflects the wipe.
 */
export function useDeleteMyData() {
  const queryClient = useQueryClient();
  return useMutation<DeleteUserDataResult, Error, void>({
    mutationFn: () =>
      fetchApi<DeleteUserDataResult>('/api/headshot/delete-my-data', { method: 'POST' }),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['headshot'] });
      queryClient.removeQueries({ queryKey: ['headshot-full-res'] });
    },
  });
}
