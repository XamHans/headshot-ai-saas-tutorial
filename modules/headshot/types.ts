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
