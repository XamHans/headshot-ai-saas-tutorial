import { z } from 'zod';

export const paginationSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  search: z.string().optional(),
});

export const idParamSchema = z.object({
  id: z.string().uuid(),
});

export const amountSchema = z.string().regex(/^\d+\.\d{2}$/, 'Format: 10.00');
export const currencySchema = z.enum(['EUR', 'USD', 'GBP', 'CHF']);
