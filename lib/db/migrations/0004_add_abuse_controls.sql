-- Migration: Abuse controls — one-free-generation cap + IP/device rate limit
-- Description: Slice 04.
--   * user.headshot_free_generation_used_at: per-account "free generation used"
--     marker, consumed via a race-safe conditional UPDATE (set only when NULL).
--   * headshot_rate_limits: fixed-window counters keyed on `ip + fingerprint`
--     for the generation endpoint, incremented atomically (upsert).

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "headshot_free_generation_used_at" timestamp;

CREATE TABLE IF NOT EXISTS "headshot_rate_limits" (
  "key" text PRIMARY KEY NOT NULL,
  "window_start" timestamp NOT NULL,
  "count" integer DEFAULT 0 NOT NULL
);
