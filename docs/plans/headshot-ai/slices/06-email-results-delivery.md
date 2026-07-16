---
model: sonnet          # opus | sonnet | haiku
effort: low            # low | medium | high | xhigh | max
why: Established email-service pattern (emailService + templates), localized change layered on the existing unlock flow — well-specified and low-risk.
---
# 06 — Email delivery of results link

**TL;DR — Goal:** Email the buyer a link back to their unlocked results right after payment, sent
exactly once. **Unlocks:** users don't have to stay on the page to get their images — they can close
the tab and come back to their results later via email.

> Source plan: `docs/plans/headshot-ai/plan.md` (§5.8). Original PRD: `docs/planning/headshot-ai-prd.md`.

## What to build

Close the loop after purchase: email the buyer a link back to their unlocked results, for delivery +
remarketing. Reuses the existing `emailService` + templates.

End-to-end behaviour:

- When a job becomes **unlocked** (after the slice-05 webhook flip), the user is sent an email containing a
  link to their results page where the clean full-resolution images can be downloaded.
- The email is sent **once per unlock** (idempotent with the webhook — a re-delivered webhook does not send
  a second email).
- The link lands on the results page which, gated by ownership + `unlocked`, issues the short-lived signed
  URLs from slice 05.

## Prerequisites

- [x] **Resend (transactional email)** — shared with slice 01.
  - Required input: `RESEND_API_KEY`, `RESEND_FROM_EMAIL`.
  - Verify present: `emailService.sendEmail(...)` delivers to a test inbox.

## Verification contract (behaviour, in Gherkin)

- [x] **Scenario: unlocking emails a results link**
  ```gherkin
  Given a user completes the $5 unlock for their job
  When the unlock is confirmed
  Then they receive an email containing a link to their results
  And following the link (while signed in) reaches their downloadable full-resolution images
  ```

- [x] **Scenario: results email is sent once**
  ```gherkin
  Given the unlock webhook for a job has already sent the results email
  When the same unlock event is processed again
  Then no second results email is sent
  ```

## Implementation notes (TDD)

1. Hook the send into `markUnlocked` (or the webhook path) so it fires exactly on the false→true unlock
   transition — reuse the idempotency guard from slice 05 so it can't double-send. Red-first on the
   send-once scenario.
2. Add a results email template alongside the existing templates; pass the results-page URL as a template
   prop. Reuse `emailService.sendEmail({ to, subject, templateName, templateProps })`.
3. Keep it advisory-simple: no new tables. The unlocked transition is the single trigger.

## Blocked by

- `05-stripe-unlock-webhook-delivery.md`
