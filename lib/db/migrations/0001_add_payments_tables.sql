-- Migration: Add payments and webhook_events tables
-- Created: 2026-01-11
-- Description: Adds support for Stripe payment integration

-- Create payments table
CREATE TABLE IF NOT EXISTS "payments" (
  "id" text PRIMARY KEY NOT NULL,
  "stripe_payment_intent_id" text UNIQUE,
  "stripe_checkout_session_id" text UNIQUE NOT NULL,
  "stripe_checkout_url" text,
  "amount" text NOT NULL,
  "currency" text NOT NULL,
  "description" text NOT NULL,
  "status" text NOT NULL,
  "user_id" text NOT NULL,
  "metadata" jsonb,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL,
  "paid_at" timestamp,
  "failed_at" timestamp,
  "expires_at" timestamp
);

-- Create webhook_events table
CREATE TABLE IF NOT EXISTS "webhook_events" (
  "id" text PRIMARY KEY NOT NULL,
  "payment_id" text NOT NULL,
  "stripe_payment_intent_id" text,
  "stripe_checkout_session_id" text NOT NULL,
  "event_type" text NOT NULL,
  "status" text NOT NULL,
  "processed" boolean DEFAULT false NOT NULL,
  "processed_at" timestamp,
  "payload" jsonb,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "webhook_events_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE CASCADE
);

-- Create indexes for payments table
CREATE INDEX IF NOT EXISTS "idx_payments_user_id" ON "payments"("user_id");
CREATE INDEX IF NOT EXISTS "idx_payments_status" ON "payments"("status");
CREATE INDEX IF NOT EXISTS "idx_payments_created_at" ON "payments"("created_at" DESC);
CREATE INDEX IF NOT EXISTS "idx_payments_stripe_payment_intent_id" ON "payments"("stripe_payment_intent_id");
CREATE INDEX IF NOT EXISTS "idx_payments_stripe_checkout_session_id" ON "payments"("stripe_checkout_session_id");

-- Create indexes for webhook_events table
CREATE INDEX IF NOT EXISTS "idx_webhook_events_payment_id" ON "webhook_events"("payment_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_processed" ON "webhook_events"("processed");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_stripe_payment_intent_id" ON "webhook_events"("stripe_payment_intent_id");
CREATE INDEX IF NOT EXISTS "idx_webhook_events_stripe_checkout_session_id" ON "webhook_events"("stripe_checkout_session_id");
