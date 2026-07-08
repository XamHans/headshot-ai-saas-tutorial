---
model: opus            # opus | sonnet | haiku
effort: high           # low | medium | high | xhigh | max
why: The face-detection approach is an open question (client vs server) and the "reject before any Gemini spend" pre-flight gate is the core cost-safety invariant of the whole product — must be pinned hard.
---
# 02 — Upload one photo + pre-flight face gate + R2 store + job creation

> Source plan: `docs/plans/headshot-ai/plan.md` (§5.2, §6-upload, §7). Original PRD: `docs/planning/headshot-ai-prd.md`.

## What to build

The upload step, plus the pre-flight gate that protects the Gemini budget. Introduces the
`modules/headshots` feature slice and its data model.

End-to-end behaviour:

- A verified, consented user (gate from slice 01) uploads **exactly one** image (JPEG/PNG, ≤ ~10MB).
  Client + server validation covers size, mime, extension (reuse `file-upload.ts` / `file-validation.ts`).
- Before any generation is possible, a **pre-flight face check** runs: the photo must contain **exactly one
  clear, front-facing, adequately-lit face**, no sunglasses, sufficient resolution. If it fails, the user
  gets **friendly, specific guidance** ("we couldn't find a clear single face — try a well-lit photo facing
  the camera") and **no job is created and nothing is sent to Gemini**.
- On a passing photo, the source is stored in a **private R2 bucket** under a namespaced key
  (`sources/{userId}/{jobId}.jpg`) and a `headshot_jobs` row is created with `status = 'pending'`.

This slice ends at "job created, source stored". Style-pick + generation is slice 03.

### Data model introduced (per plan §7)

- **`headshot_jobs`**: `id` (text UUID), `userId`, `sourceImageKey`, `styleId` (nullable until 03),
  `status` (`pending`/`generating`/`ready`/`failed`), `unlocked` (bool, default false), `paymentId`
  (nullable), `freeRegenUsed` (bool, default false), `createdAt`/`updatedAt`.
- **`headshot_images`**: `id`, `jobId` (FK), `previewKey`, `fullKey`, `styleVariant`, `createdAt`
  (populated in slice 03; table created here so the migration is done once).

`schema.ts` (Drizzle) and `schemas.ts` (Zod) stay separate per project rules.

## Prerequisites

- [ ] **Cloudflare R2 — private bucket for sources** — stores uploaded biometric photos privately.
  - Required input: `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` — from the
    Cloudflare R2 dashboard. Bucket must **not** be public-read.
  - Verify present: `r2Storage.uploadFile(...)` succeeds and the object is **not** reachable without a
    signed URL.
- [ ] **Face-detection capability** — the pre-flight gate.
  - Required input: a face-detection mechanism. *Default:* a cheap **server-side** check (e.g. a
    lightweight face-detection model / library invoked in the service before any Gemini call) so the gate
    can't be bypassed by a modified client. Override to `face-api.js` client-side + server re-check if you
    prefer. No paid third-party account required for the default.
  - Verify present: a known single-face photo passes; a two-face photo and a sunglasses photo both fail.

## Verification contract (behaviour, in Gherkin)

- [ ] **Scenario: upload a good single-face photo creates a pending job**
  ```gherkin
  Given a verified, consented user on the upload screen
  When they upload one clear, front-facing, well-lit photo under the size limit
  Then the photo is accepted
  And a headshot job is created in a pending state
  And the user proceeds toward style selection
  ```

- [ ] **Scenario: photo with no detectable face is rejected before any spend**
  ```gherkin
  Given a verified, consented user on the upload screen
  When they upload a photo with no clear face
  Then they see friendly guidance to upload a clear, front-facing photo
  And no job is created
  And nothing is sent to the image model
  ```

- [ ] **Scenario: photo with multiple faces is rejected**
  ```gherkin
  Given a verified, consented user on the upload screen
  When they upload a photo containing more than one face
  Then they see guidance that exactly one face is required
  And no job is created
  ```

- [ ] **Scenario: oversized or wrong file type is rejected**
  ```gherkin
  Given a verified, consented user on the upload screen
  When they upload a file over the size limit or a non-image type
  Then they see a validation error naming the limit / accepted types
  And no upload to storage occurs
  ```

- [ ] **Scenario: source is stored privately**
  ```gherkin
  Given a passing photo has just been uploaded
  When one inspects the stored source object without a signed URL
  Then it is not publicly accessible
  ```

## Implementation notes (TDD)

1. Start with the **schema + migration** (`headshot_jobs`, `headshot_images`) — `pnpm db:generate`. Copy the
   `modules/posts` slice shape exactly (UUID `$defaultFn`, timestamps).
2. Red-first on the **pre-flight gate** as a service unit test: the riskiest logic is "reject before spend".
   Pin the invariant that a rejected photo produces **no job row and no model call** (spy/mock the Gemini
   boundary and assert zero calls).
3. Build `headshotService.createJob(input, userId)` returning `Result<Job>`: validate → face-check →
   `r2Storage.uploadFile('sources/{userId}/{jobId}.jpg', ...)` → insert `pending` job. Framework-agnostic
   (no `NextResponse`). Export `createHeadshotService(ctx)` + `headshotService` singleton.
4. Thin route `app/api/headshots/route.ts` (POST) wrapped with `withAuth` — also enforce the slice-01
   verified+consented guard here. Parse with `parseRequestBody`; delegate; return `Result`.
5. UI: `app/(main)/headshots/` uploader component + a `use-headshots` hook (TanStack Query + `fetchApi`).
   Client-side validation via `fileUploadService.validateFile` for instant feedback; server re-validates.
6. If this route ever references the deprecated `lib/api/base.ts`, migrate it to `handlers.ts` (per CLAUDE.md).

## Blocked by

- `01-verified-onboarding-consent.md`
