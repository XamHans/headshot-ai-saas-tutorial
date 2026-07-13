-- Migration: Add headshot_jobs and headshot_images tables
-- Description: Slice 02 — source-photo upload + pre-flight face gate.
--   headshot_jobs holds one generation job per accepted source photo.
--   headshot_images is created here for the one-time migration; rows are only
--   written in the later generation slice.

CREATE TABLE IF NOT EXISTS "headshot_jobs" (
  "id" text PRIMARY KEY NOT NULL,
  "user_id" text NOT NULL,
  "source_image_key" text NOT NULL,
  "style_id" text,
  "status" text DEFAULT 'pending' NOT NULL,
  "unlocked" boolean DEFAULT false NOT NULL,
  "payment_id" text,
  "free_regen_used" boolean DEFAULT false NOT NULL,
  "created_at" timestamp NOT NULL,
  "updated_at" timestamp NOT NULL
);

CREATE TABLE IF NOT EXISTS "headshot_images" (
  "id" text PRIMARY KEY NOT NULL,
  "job_id" text NOT NULL,
  "preview_key" text,
  "full_key" text,
  "style_variant" text,
  "created_at" timestamp NOT NULL,
  CONSTRAINT "headshot_images_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "headshot_jobs"("id") ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS "idx_headshot_jobs_user_id" ON "headshot_jobs"("user_id");
CREATE INDEX IF NOT EXISTS "idx_headshot_jobs_status" ON "headshot_jobs"("status");
CREATE INDEX IF NOT EXISTS "idx_headshot_images_job_id" ON "headshot_images"("job_id");
