---
model: opus            # opus | sonnet | haiku
effort: medium         # low | medium | high | xhigh | max
status: optional        # optional post-enhancement — not part of the required 01–07 sequence
why: Sits on the real-money path (Stripe Checkout) and changes the free-cap gate from slice 04 — a
  mis-wired bypass could let generation happen unpaid, or a mis-wired guard could charge a user twice.
---
# 08 — Guided paywall UX when the free-generation limit is reached (OPTIONAL)

> **Optional post-enhancement.** Not required for the core plan (01–07) to be considered done. Build this
> only when explicitly requested — `/implement` should not auto-pick it as NEXT.

**TL;DR — Goal:** Replace the generic "couldn't generate" error a user sees when `PAYMENT_REQUIRED` fires
with a clear, guided $5 paywall that lets them pay and generate their photos in one continuous flow.
**Unlocks:** the free-cap edge case (slice 04) stops looking like a broken app and becomes the product's
actual monetization moment for repeat users.

> Source plan: `docs/plans/headshot-ai/plan.md` (§5.6, §6-payments). Builds on `04-abuse-controls-cap-ratelimit.md`
> (produces `PAYMENT_REQUIRED`) and `05-stripe-unlock-webhook-delivery.md` (Stripe Checkout + webhook +
> `markUnlocked` + signed full-res delivery).

## What to build

Today, once a user's one free generation is spent, a **new** (`pending`) job's `generateSet` call returns
`PAYMENT_REQUIRED` before any Gemini spend (slice 04) — but the UI has no dedicated handling for that: it
falls into the same generic alert as a hard failure ("We couldn't generate your headshots. Please try
again."), with a "Try again" button that will fail identically forever. This slice closes that gap with a
guided pay-then-generate path, distinct from slice 05's *post-generation* "unlock full-res" flow:

End-to-end behaviour:

- When `generateSet` returns `PAYMENT_REQUIRED` for a `pending` job, the UI shows a dedicated **paywall
  card** (not the generic error alert): clear framing of what $5 buys (3 new full-resolution, watermark-free
  headshots — no separate unlock step afterward) and a single **Pay $5 & generate** CTA.
- The CTA calls the same `paymentService.createPayment({ metadata: { jobId } })` Stripe Checkout flow slice
  05 wires up, scoped to this **not-yet-generated** job, and sends the user to Stripe Checkout.
- On return (`/payments/return` after `checkout.session.completed`), the job is now `unlocked` (via slice
  05's idempotent webhook → `markUnlocked`). The flow **automatically resumes generation** for that job —
  no second manual "Generate" click required.
- The free-generation-cap check in `HeadshotService.generateSet` is extended: a `pending` job whose
  `unlocked === true` **skips** the free-cap consumption entirely (payment already substitutes for the
  free allowance) and proceeds straight to the Gemini calls.
- Because the job was paid **before** generation, the resulting images are already unlocked — the results
  view shows full-resolution, watermark-free images immediately (via slice 05's `getFullResUrls`), with no
  separate "unlock" click needed on top of the payment that already happened.
- If the user abandons or cancels Checkout, the job stays `pending`/un-unlocked and the paywall card is
  shown again on the next attempt — no partial or duplicate charge, no orphaned "half-paid" state.

## Prerequisites

- [ ] **Stripe Checkout + webhook** — already required by, and satisfied once, `05-stripe-unlock-webhook-delivery.md`
  is live. No new external setup for this slice.
  - Verify present: `paymentService.createPayment` succeeds in test mode and the webhook flips a job's
    `unlocked` flag (same check as slice 05).

## Verification contract (behaviour, in Gherkin)

- [ ] **Scenario: hitting the free limit shows a guided paywall, not a generic error**
  ```gherkin
  Given a user who has already used their one free generation
  When they attempt to generate a new set and are told payment is required
  Then they see a dedicated paywall explaining the $5 price and what it unlocks
  And they do NOT see the generic "couldn't generate, try again" error
  ```

- [ ] **Scenario: paying generates the set in one continuous flow**
  ```gherkin
  Given a user on the free-limit paywall for a pending job
  When they pay $5 via Stripe Checkout in test mode and return to the app
  Then generation starts automatically without a second manual step
  And they receive 3 full-resolution, watermark-free headshots
  ```

- [ ] **Scenario: a paid-for pending job bypasses the free-generation cap**
  ```gherkin
  Given a job that has been marked unlocked via payment but not yet generated
  When generateSet runs for that job
  Then the free-generation cap is not consumed or re-checked
  And generation proceeds using the payment, not the free allowance
  ```

- [ ] **Scenario: abandoning checkout leaves the paywall retryable, not broken**
  ```gherkin
  Given a user who reaches Stripe Checkout for the free-limit paywall
  When they cancel or abandon checkout without paying
  Then the job remains pending and un-unlocked
  And returning to the app shows the paywall again, ready to retry
  And no generation or charge has occurred
  ```

## Implementation notes (TDD)

1. Red-first on the service invariant: a `pending` job with `unlocked === true` must not touch
   `consumeFreeGeneration` and must not return `PAYMENT_REQUIRED` — pin this alongside the existing slice-04
   cap tests (`generate-cap.service.test.ts`) so the two paths don't regress each other.
2. Client: a new UI state keyed on `error.code === 'PAYMENT_REQUIRED'` in the generate mutation's error
   handling, rendered as a distinct paywall component — not the shared generic-error alert in
   `headshot-flow.tsx`. Reuse slice 05's unlock-CTA/Checkout-redirect pattern rather than inventing a second
   payment entry point.
3. Auto-resume on return: after `/payments/return` confirms the job's `unlocked` flag (poll or re-fetch the
   job), trigger `generateSet` automatically for that job instead of waiting on another user click. Guard
   against double-triggering (e.g. on repeated focus/visibility events) — this must be idempotent since
   `generateSet` on an already-`generating`/`ready` job is guarded by `loadGeneratableJob`'s existing status
   checks.
4. Invariant tests: cancelled/abandoned Checkout leaves `unlocked = false` and the job `pending` — no
   generation call, no charge, and the paywall is shown again (not a dead-end error state).

## Blocked by

- `04-abuse-controls-cap-ratelimit.md` (produces the `PAYMENT_REQUIRED` trigger this slice handles)
- `05-stripe-unlock-webhook-delivery.md` (provides the Stripe Checkout + webhook + `markUnlocked` +
  full-res delivery this slice reuses)
