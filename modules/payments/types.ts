import type { payments, webhookEvents } from './schema';

/**
 * Payment database record type
 */
export type Payment = typeof payments.$inferSelect;

/**
 * New payment insert type
 */
export type NewPayment = typeof payments.$inferInsert;

/**
 * Webhook event database record type
 */
export type WebhookEvent = typeof webhookEvents.$inferSelect;

/**
 * New webhook event insert type
 */
export type NewWebhookEvent = typeof webhookEvents.$inferInsert;

/**
 * Input for creating a new payment
 */
export interface CreatePaymentInput {
  amount: string; // Format: "10.00"
  currency: string; // ISO 4217 currency code (EUR, USD, GBP, CHF, PLN, etc.)
  description: string;
  metadata?: {
    orderId?: string;
    productId?: string;
    [key: string]: unknown;
  };
}

/**
 * Filters for querying user payments
 */
export interface PaymentFilters {
  userId?: string;
  status?: string;
  limit?: number;
  offset?: number;
}
