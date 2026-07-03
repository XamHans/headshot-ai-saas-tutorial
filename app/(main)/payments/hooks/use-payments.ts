'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchApi } from '@/lib/api/client';
import type { CreatePaymentInput, Payment } from '@/modules/payments/types';

export function usePayments(filters?: { status?: string; limit?: number; offset?: number }) {
  const params = new URLSearchParams();
  if (filters?.status) params.set('status', filters.status);
  if (filters?.limit) params.set('limit', String(filters.limit));
  if (filters?.offset) params.set('offset', String(filters.offset));

  const queryString = params.toString();
  const url = queryString ? `/api/payments?${queryString}` : '/api/payments';

  return useQuery({
    queryKey: ['payments', filters],
    queryFn: () => fetchApi<Payment[]>(url),
  });
}

export function usePayment(id: string) {
  return useQuery({
    queryKey: ['payments', id],
    queryFn: () => fetchApi<Payment>(`/api/payments/${id}`),
    enabled: !!id,
  });
}

export function useCreatePayment() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreatePaymentInput) =>
      fetchApi<Payment>('/api/payments/create', {
        method: 'POST',
        body: JSON.stringify(data),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['payments'] }),
  });
}
