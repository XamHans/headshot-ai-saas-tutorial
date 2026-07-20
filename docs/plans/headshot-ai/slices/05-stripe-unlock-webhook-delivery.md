---
model: opus            # opus | sonnet | haiku
effort: medium         # low | medium | high | xhigh | max
why: Mostly reuses modules/payments, but the "clean full-res key is never exposed until unlocked, then only via short-lived signed URL" invariant is security-sensitive and the webhook→state flip must be idempotent.
---
# 05 — $5 unlock via Stripe + webhook `markUnlocked` + full-res signed-URL delivery

**TL;DR — Goal:** Turn a watermarked preview set into a paid ($5) unlock via Stripe Checkout + webhook,
then serve clean full-res images only through short-lived signed URLs. **Unlocks:** the monetization
loop closes — users can actually pay and download their real, watermark-free headshots.

> Source plan: `docs/plans/headshot-ai/plan.md` (§5.6–5.8, §6-payments). Original PRD: `docs/planning/headshot-ai-prd.md`.

## What to build

The paywall unlock: turn a watermarked preview set into downloadable, clean, full-resolution headshots for
a one-time **$5**. Reuses `modules/payments` end-to-end.

End-to-end behaviour:

- On a `ready` job showing watermarked previews, the user clicks **Unlock ($5)**. This calls
  `paymentService.createPayment({ metadata: { jobId } })` (one-time `mode: 'payment'` Checkout) and sends
  them to Stripe Checkout.
- After payment they return to `/payments/return`. The Stripe **webhook**
  `checkout.session.completed` fires → the payment is marked paid → the linked **job's `unlocked` flips to
  `true`** and `paymentId` is set. The flip is **idempotent** (a re-delivered webhook doesn't double-apply).
- Once `unlocked`, the **clean full-resolution** images are served **only** via **short-lived R2 signed
  URLs**. Before unlock (or for a job the user doesn't own), full-res is never served.

## Prerequisites

- [x] **Stripe (one-time Checkout + webhook)** — already used by `modules/payments`.
  - Required input: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (and the publishable key the app already
    uses) — from the Stripe dashboard. A $5 one-time price/amount.
  - Verify present: a test-mode Checkout session can be created and the local webhook endpoint receives a
    signed `checkout.session.completed` event (e.g. via the Stripe CLI `stripe listen`).

## Verification contract (behaviour, in Gherkin)

- [x] **Scenario: paying unlocks clean full-res downloads**
  ```gherkin
  Given a signed-in user viewing their watermarked preview set for a ready job
  When they unlock for $5 and complete Stripe Checkout in test mode
  Then after the confirmation the job is unlocked
  And they can download all 3 clean, watermark-free, full-resolution images
  ```

- [x] **Scenario: full-res is unavailable before payment**
  ```gherkin
  Given a ready job that has not been unlocked
  When the user (or any client) requests the full-resolution images
  Then the request is denied
  And only watermarked previews remain accessible
  ```

- [x] **Scenario: full-res links are short-lived signed URLs**
  ```gherkin
  Given an unlocked job
  When a full-resolution download URL is issued
  Then it is a signed URL that expires after a short window
  And it stops working once expired
  ```

- [x] **Scenario: webhook unlock is idempotent**
  ```gherkin
  Given a completed Checkout whose webhook has already unlocked the job
  When the same checkout.session.completed event is delivered again
  Then the job remains unlocked exactly once
  And no duplicate payment or unlock side effects occur
  ```

- [x] **Scenario: a user cannot unlock or download another user's job**
  ```gherkin
  Given a job belonging to another user
  When the current user attempts to unlock it or fetch its full-res images
  Then the request is denied
  ```

## Implementation notes (TDD)

1. Reuse `modules/payments` `createPayment` with `metadata: { jobId }` — no new payment plumbing. Add a
   thin unlock action on the headshots route/hook that calls it and redirects to the returned Checkout URL.
2. Extend the payments **webhook** handler's `checkout.session.completed` case (or add a headshots-side
   handler it calls) to read `metadata.jobId` and call `headshotService.markUnlocked(jobId, paymentId)`.
   `markUnlocked` must do the flip as a **single atomic conditional UPDATE**
   (`UPDATE headshot_jobs SET unlocked = true, payment_id = $1 WHERE id = $2 AND unlocked = false`) — not
   a read-then-check-then-write — since Stripe can redeliver the same webhook concurrently and a
   check-then-act pattern races. Red-first on the double-delivery scenario.
3. `headshotService.getFullResUrls(jobId, userId)`: return `Result` of short-lived
   `r2Storage.getSignedUrl(fullKey, <short expiry>)` **only** when the job is owned by the user **and**
   `unlocked === true`; otherwise a denied `Result`. Pin the ownership + unlocked checks in unit tests.
4. Invariant tests: **no full-res URL is ever issued for an un-unlocked job**, and signed URLs carry a
   short expiry.
5. On `/payments/return`, don't assume the webhook has already landed by the time the user is redirected
   back — poll the job's `unlocked` status (short interval, TanStack Query `refetchInterval`) until it
   flips, rather than showing a static "processing" message with no reconciliation.

## Blocked by

- `03-style-generate-watermark-preview.md`
  (Runs in parallel with `04-abuse-controls-cap-ratelimit.md`.)
