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

/** A headshot images row (DB shape). */
import type { headshotImages } from './schema';

export type HeadshotImage = typeof headshotImages.$inferSelect;

/**
 * Client-safe preview DTO. Deliberately carries ONLY the watermarked preview
 * URL — never `fullKey` or any full-resolution reference. This is the single
 * most important invariant of the generation slice: the clean full-res image
 * must never leak into any API response before payment.
 */
export interface HeadshotPreviewDTO {
  id: string;
  styleVariant: string | null;
  previewUrl: string;
}

/**
 * Result of `HeadshotService.generateSet`. Carries the (client-safe) job plus
 * the watermarked preview DTOs. Contains no full-res keys/URLs.
 */
export interface GenerateSetResult {
  job: HeadshotJob;
  previews: HeadshotPreviewDTO[];
}
