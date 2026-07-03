import { boolean, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/**
 * Payments table - stores all payment transactions via Stripe Checkout
 */
export const payments = pgTable('payments', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Stripe integration
  stripePaymentIntentId: text('stripe_payment_intent_id').unique(),
  stripeCheckoutSessionId: text('stripe_checkout_session_id').unique().notNull(),
  stripeCheckoutUrl: text('stripe_checkout_url'),

  // Payment details
  amount: text('amount').notNull(), // Store as string to avoid precision issues
  currency: text('currency').notNull(), // ISO 4217 code: EUR, USD, GBP, etc.
  description: text('description').notNull(),
  status: text('status').notNull(), // requires_payment_method, processing, succeeded, canceled, etc.

  // User relationship
  userId: text('user_id').notNull(),

  // Metadata (orderId, productId, etc.)
  metadata: jsonb('metadata'),

  // Timestamps
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
  updatedAt: timestamp('updated_at')
    .$defaultFn(() => new Date())
    .notNull(),
  paidAt: timestamp('paid_at'),
  failedAt: timestamp('failed_at'),
  expiresAt: timestamp('expires_at'),
});

/**
 * Webhook events table - audit trail for all webhook callbacks from Stripe
 */
export const webhookEvents = pgTable('webhook_events', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),

  // Webhook data
  paymentId: text('payment_id')
    .references(() => payments.id)
    .notNull(),
  stripePaymentIntentId: text('stripe_payment_intent_id'),
  stripeCheckoutSessionId: text('stripe_checkout_session_id').notNull(),
  eventType: text('event_type').notNull(), // checkout.session.completed, payment_intent.succeeded, etc.
  status: text('status').notNull(),

  // Processing
  processed: boolean('processed').default(false).notNull(),
  processedAt: timestamp('processed_at'),

  // Raw webhook payload (for debugging)
  payload: jsonb('payload'),

  // Timestamps
  createdAt: timestamp('created_at')
    .$defaultFn(() => new Date())
    .notNull(),
});
