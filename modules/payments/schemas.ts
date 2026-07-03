import { z } from 'zod';

export const getPaymentsQuerySchema = z.object({
  status: z.string().optional(),
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
});

export const createPaymentSchema = z.object({
  amount: z.string().regex(/^\d+\.\d{2}$/, 'Amount must be in format: 10.00'),
  currency: z.enum(['EUR', 'USD', 'GBP', 'CHF', 'PLN'], {
    errorMap: () => ({ message: 'Invalid currency' }),
  }),
  description: z.string().min(1, 'Description required'),
  metadata: z.record(z.any()).optional(),
});

export type GetPaymentsQuery = z.infer<typeof getPaymentsQuerySchema>;
export type CreatePaymentSchema = z.infer<typeof createPaymentSchema>;
