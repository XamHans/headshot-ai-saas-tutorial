-- Migration: Raise the per-account free-generation cap from 1 to 3
-- Created: 2026-07-16
-- Description: Replaces the one-time "free generation used" timestamp flag
-- with a counter, since a cap above 1 can no longer be represented by a
-- single used/unused flag.

ALTER TABLE "user" ADD COLUMN IF NOT EXISTS "headshot_free_generation_count" integer NOT NULL DEFAULT 0;

-- Backfill: accounts that already consumed their (former) single free
-- generation keep exactly one consumed slot, rather than starting fresh
-- with 3 new free generations.
UPDATE "user" SET "headshot_free_generation_count" = 1
WHERE "headshot_free_generation_used_at" IS NOT NULL AND "headshot_free_generation_count" = 0;

ALTER TABLE "user" DROP COLUMN IF EXISTS "headshot_free_generation_used_at";
