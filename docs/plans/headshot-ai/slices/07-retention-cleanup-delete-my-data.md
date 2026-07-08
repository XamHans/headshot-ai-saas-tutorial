---
model: opus            # opus | sonnet | haiku
effort: medium         # low | medium | high | xhigh | max
why: Destructive data deletion + a scheduled-job mechanism (open question) — deletion safety (never delete purchased data, never delete another user's data) must be pinned hard; irreversible if wrong.
---
# 07 — Retention: 30-day cleanup job + "delete my data"

> Source plan: `docs/plans/headshot-ai/plan.md` (§5.9, §6-retention, §11). Original PRD: `docs/planning/headshot-ai-prd.md`.

## What to build

The GDPR/BIPA data-minimization posture: automatic 30-day deletion of source photos + unpurchased outputs,
a user-initiated "delete my data" action, and retention of purchased images while the account exists.

End-to-end behaviour:

- A **scheduled cleanup** runs periodically and deletes, for jobs older than **30 days**, the **source
  photo** and any **unpurchased (un-unlocked) outputs** from R2, and clears their keys. **Purchased
  (unlocked) images are kept** while the account exists.
- A user can invoke **"delete my data"**: their source photos and generated images (preview + full) are
  deleted from R2 and their job/image records removed (or anonymized), promptly.
- Deletion uses `r2Storage.deleteFile` and is safe: it never touches another user's data and never deletes
  purchased images via the automatic job (only via explicit account deletion).

## Prerequisites

- [ ] **Scheduled-job mechanism** — runs the 30-day cleanup.
  - Required input: a scheduler. *Default:* **Vercel Cron** hitting an authenticated internal cleanup route
    (protected by a cron secret), since the app targets Vercel. Override to another scheduler/queue if the
    deployment differs. Required input for the default: `CRON_SECRET`.
  - Verify present: the cleanup route runs on schedule (or via a manual trigger with the secret) and only it
    can invoke the deletion.

## Verification contract (behaviour, in Gherkin)

- [ ] **Scenario: 30-day cleanup deletes source + unpurchased outputs**
  ```gherkin
  Given a job older than 30 days that was never unlocked
  When the scheduled cleanup runs
  Then its source photo and its unpurchased output images are deleted from storage
  And the job's stored image keys no longer resolve
  ```

- [ ] **Scenario: purchased images survive the cleanup**
  ```gherkin
  Given an unlocked (purchased) job older than 30 days
  When the scheduled cleanup runs
  Then its full-resolution images are retained
  And the user can still download them
  ```

- [ ] **Scenario: user deletes their own data**
  ```gherkin
  Given a signed-in user with source photos and generated images
  When they invoke "delete my data" and confirm
  Then their source photos and generated images are deleted from storage
  And their headshot records are removed
  ```

- [ ] **Scenario: cleanup endpoint rejects unauthenticated triggers**
  ```gherkin
  Given the scheduled cleanup endpoint
  When it is called without the valid cron secret
  Then it is rejected
  And no deletion occurs
  ```

- [ ] **Scenario: deletion is scoped to the acting user**
  ```gherkin
  Given two users each with headshot data
  When one user invokes "delete my data"
  Then only that user's data is deleted
  And the other user's data is untouched
  ```

## Implementation notes (TDD)

1. Red-first on the **selection query**: "jobs older than 30 days AND not unlocked" — pin that an unlocked
   job is **never** selected by the automatic cleanup (the most dangerous mistake). Mock the R2 delete
   boundary and assert exactly the right keys are deleted.
2. `headshotService.cleanupExpired()` and `headshotService.deleteUserData(userId)` returning `Result`; both
   call `r2Storage.deleteFile` per key and remove/anonymize DB rows. Keep them framework-agnostic.
3. Cleanup route (`app/api/headshots/cleanup` or similar) guarded by a **cron secret**, not `withAuth`
   (Vercel Cron has no session) — red-first on the unauthenticated-rejection scenario. The "delete my data"
   route uses `withAuth` and scopes strictly to `session.user.id`.
4. Invariants tests must pin: **automatic cleanup never deletes unlocked/purchased images**, and **user
   deletion is scoped to the acting user only**.

## Blocked by

- `03-style-generate-watermark-preview.md`
  (Best sequenced after `05-stripe-unlock-webhook-delivery.md` so "unlocked ⇒ retained" is real.)
