'use client';

import { fetchApi } from '@/lib/api/client';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { Post, CreatePostInput, UpdatePostInput } from '@/modules/posts/types';

export function usePosts(
  filters?: { search?: string; limit?: number; offset?: number; authorId?: string; includeUnpublished?: boolean },
) {
  const params = new URLSearchParams();
  if (filters?.search) params.set('search', filters.search);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));
  if (filters?.authorId) params.set('authorId', filters.authorId);
  if (filters?.includeUnpublished) params.set('includeUnpublished', 'true');

  const queryString = params.toString();
  const url = queryString ? `/api/posts?${queryString}` : '/api/posts';

  return useQuery({
    queryKey: ['posts', filters],
    queryFn: () => fetchApi<Post[]>(url),
  });
}

export function usePost(id: string) {
  return useQuery({
    queryKey: ['posts', id],
    queryFn: () => fetchApi<Post>(`/api/posts/${id}`),
    enabled: !!id,
  });
}

export function useCreatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePostInput) =>
      fetchApi<Post>('/api/posts', { method: 'POST', body: JSON.stringify(data) }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  });
}

export function useUpdatePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...data }: UpdatePostInput & { id: string }) =>
      fetchApi<Post>(`/api/posts/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['posts'] });
      queryClient.invalidateQueries({ queryKey: ['posts', id] });
    },
  });
}

export function useDeletePost() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => fetchApi<void>(`/api/posts/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['posts'] }),
  });
}
