/**
 * Shared domain types for the headshot onboarding slice.
 * `schema.ts` (Drizzle) lives in modules/users — the consent column is on the
 * existing `user` table — so this slice only owns validation + DTO types here.
 */

export interface RequestMagicLinkInput {
  email: string;
}

export interface RequestMagicLinkResult {
  /** Always the same shape regardless of whether the account already existed. */
  sent: true;
}

export interface RecordConsentResult {
  biometricConsentAt: string;
}

import type { headshotJobs } from './schema';

/** A headshot generation job row (DB shape derived from the Drizzle table). */
export type HeadshotJob = typeof headshotJobs.$inferSelect;

/** Allowed job statuses. */
export type HeadshotJobStatus = 'pending' | 'generating' | 'ready' | 'failed';

/**
 * Input to `HeadshotService.createJob`. The route parses multipart/form-data
 * into this plain, framework-agnostic shape before handing it to the service.
 */
export interface CreateJobInput {
  /** Raw image bytes. */
  buffer: Buffer;
  /** Reported MIME type (e.g. `image/jpeg`). Re-validated server-side. */
  contentType: string;
  /** Original filename — used for extension validation. */
  filename: string;
  /** Byte size (re-validated server-side, never trusted from the client). */
  size: number;
}
