---
model: opus            # opus | sonnet | haiku
effort: medium         # low | medium | high | xhigh | max
why: Better Auth magic-link config + disposable-domain blocklist + biometric-consent persistence is security-sensitive and net-new to this repo (auth today is only email+password + Google).
---
# 01 — Verified-email onboarding + biometric-consent gate

**TL;DR — Goal:** Build the identity + legal gate — email verification via magic link plus explicit
biometric consent — that every later slice relies on. **Unlocks:** a visitor can sign up, verify their
email, and grant consent; only verified + consented users can ever reach upload/generation.

> Source plan: `docs/plans/headshot-ai/plan.md` (§5.1, §6-abuse, §11). Original PRD: `docs/planning/headshot-ai-prd.md`.

## What to build

The front door of the funnel. A visitor provides an email, verifies it via a **magic link**, and grants
**explicit biometric consent** before they can ever reach the upload/generate flow. This slice establishes
the identity + consent gate that every later slice depends on.

End-to-end behaviour:

- A visitor enters their email on the onboarding screen. Signup is **rejected for disposable/throwaway
  email domains** with friendly guidance.
- A **magic link** is emailed (via the existing `emailService`). Clicking it verifies the email and signs
  the user in. Until verified, the account cannot generate.
- On the same onboarding flow the user must tick an **explicit biometric-consent checkbox** ("I consent to
  my photo being processed as biometric data to generate headshots"). Consent is **persisted** (with a
  timestamp) against the account. Generation is blocked until consent is recorded.
- Any attempt to reach the generation flow (upload/style/generate) while **unverified or unconsented**
  redirects back to onboarding with a clear reason — no upload UI, no job creation, no spend.

This slice does **not** build upload or generation — only the gate that guards them. Downstream slices
assume `session.user` is verified and consented.

## Prerequisites

- [x] **Resend (transactional email)** — magic-link delivery uses the existing `emailService`.
  - Required input: `RESEND_API_KEY`, `RESEND_FROM_EMAIL` — from the Resend dashboard (https://resend.com/api-keys).
  - Verify present: both env vars are set and `emailService.sendEmail(...)` succeeds against a test address.
- [x] **Disposable-domain blocklist source** — a list to reject throwaway domains at signup.
  - Required input: a bundled/blocklist list (e.g. a static list committed to the repo, or a maintained
    package). *Default:* commit a static list under `lib/auth/disposable-domains.ts`; no external service
    needed. Override if you want a live-updating source.
  - Verify present: signing up with `foo@mailinator.com` is rejected; `foo@gmail.com` is accepted.

## Verification contract (behaviour, in Gherkin)

- [x] **Scenario: verify email via magic link, then land consented**
  ```gherkin
  Given a visitor on the onboarding screen with a valid non-disposable email
  When they submit their email, open the magic link, and tick the biometric-consent checkbox
  Then they are signed in as a verified user
  And their biometric consent is recorded
  And they can reach the headshot generation flow
  ```

- [x] **Scenario: disposable email domain is rejected at signup**
  ```gherkin
  Given a visitor on the onboarding screen
  When they submit an email on a disposable domain (e.g. mailinator.com)
  Then signup is rejected with friendly guidance to use a real email
  And no magic link is sent
  And no account is created
  ```

- [x] **Scenario: unverified user cannot reach generation**
  ```gherkin
  Given a visitor who submitted their email but has NOT opened the magic link
  When they navigate directly to the headshot generation flow
  Then they are redirected back to onboarding
  And they see that email verification is required
  ```

- [x] **Scenario: verified-but-unconsented user cannot generate**
  ```gherkin
  Given a user who verified their email but did NOT tick the biometric-consent checkbox
  When they navigate directly to the headshot generation flow
  Then they are redirected back to the consent step
  And no generation is possible until consent is recorded
  ```

## Implementation notes (TDD)

1. Spike the **Better Auth magic-link** plugin first (red: an e2e that expects a magic-link email on
   signup). Wire it into `lib/auth.ts` alongside the existing email/password + Google config; send the link
   through the existing `emailService` + an email template.
2. Add the **disposable-domain check** at the signup boundary (Zod refinement in `schemas.ts` or a Better
   Auth hook) — red-first with the two-email scenario.
3. Persist **consent** — simplest is a `biometricConsentAt` timestamp column on the user (Better Auth
   schema) or a tiny `headshot_consent` table; a `null` timestamp means not consented. Prefer extending the
   user record so the gate is a single field.
4. The **gate** is a shared guard used by the generation routes/pages (server-side `getCurrentUser` +
   `verified && consentedAt != null`). Later slices call this guard; keep it reusable.
5. Invariant the tests must pin: **no magic link and no account for disposable domains**, and **no path to
   generation while unverified or unconsented**.

## Blocked by

- None — can start immediately.
