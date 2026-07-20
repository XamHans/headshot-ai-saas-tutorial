---
model: opus            # opus | sonnet | haiku
effort: high           # low | medium | high | xhigh | max
why: The core net-new media code — image-to-image, 3 parallel Gemini calls, server-side watermark compositing, ~10s synchronous UX with auto-retry. Highest uncertainty and highest product value.
---
# 03 — Style pick + synchronous generation + watermarked previews

**TL;DR — Goal:** Let the user pick a style and generate 3 AI headshots via Gemini image-to-image in
~10s, returning watermarked previews only. **Unlocks:** the core product experience — upload → style →
3 real headshot previews on screen — while clean full-res stays safely withheld until payment (slice 05).

> Source plan: `docs/plans/headshot-ai/plan.md` (§5.3–5.5, §6-generation, §6-preview, §8-net-new). Original PRD: `docs/planning/headshot-ai-prd.md`.

## What to build

The emotional peak of the product: pick a style, watch 3 professional headshots appear in ~10s, shown
watermarked. This is the meaty AI + media slice.

End-to-end behaviour:

- On a job with a stored source (from slice 02), the user picks **one style** from a visual picker of
  **6–12 presets** (a sensible default is pre-selected so an indecisive user can generate immediately —
  one tap, no wizard).
- Generation runs **synchronously**: **3 parallel** Gemini **image-to-image** calls (source photo as an
  image content part + the preset's style prompt). Target ~10s; **hard timeout ~25s**. The service returns
  `Result<T>`.
- Each output is processed server-side into a **watermarked preview** (diagonal wordmark overlay +
  downscale) **and** a **clean full-resolution** image; both stored in R2 (private), keys recorded on
  `headshot_images` (`previewKey`, `fullKey`, `styleVariant`).
- The UI shows the **3 watermarked previews in-session**. The clean full-res key is **never exposed**
  pre-payment (that unlock is slice 05).
- **Hard failure** (error / timeout / model refusal): **auto-retry once**; a hard failure does **not**
  count against the free allowance. Persistent hard failure shows a friendly retry state.

Free-generation cap + rate limiting are **slice 04** (layered on top). This slice may generate repeatedly
during development; 04 adds the guard.

## Prerequisites

- [x] **Gemini image model access** — the image-to-image generation calls.
  - Required input: the Google Generative AI API key the existing `generate-image` route already uses
    (`GOOGLE_GENERATIVE_AI_API_KEY` or the project's configured equivalent) with access to
    `gemini-2.5-flash-image-preview`.
  - Verify present: the existing `app/api/ai/generate-image` route returns an image; an image-to-image call
    with a source photo returns an identity-preserving result.
  - **Resolved:** the key initially had zero free-tier image-generation quota (verified live, blocked
    `/implement`); once billing/quota was enabled it works. Also, `gemini-2.5-flash-image-preview` 404s on
    this account/SDK — the working model id is **`gemini-2.5-flash-image`**, used throughout this slice's
    code instead.
- [x] **Style-preset prompt templates** — the quality asset.
  - Required input: prompt templates for the presets. *Default (approved for v1):* use the **6 candidate
    presets from plan §9** (Corporate/LinkedIn, Business-casual, Studio B&W, Creative/tech, Executive,
    Approachable) as starter prompts; harden later. No gate — placeholders are acceptable for v1.
  - Verify present: each preset id maps to a prompt template in code.
  - **Resolved:** `modules/headshot/styles.ts` — 6 presets, `corporate-linkedin` pre-selected as default.
- [x] **Watermark design** — for the preview overlay.
  - Required input: a wordmark + opacity + downscale factor. *Default:* an aggressive diagonal text
    wordmark at ~30% opacity, downscaled ~50%. Override if brand assets exist. No external service.
  - Verify present: a generated preview visibly carries the diagonal watermark and is lower-resolution than
    the stored full-res.
  - **Resolved:** `lib/media/watermark.ts` — tiled diagonal "PREVIEW" SVG overlay at 30% opacity over a 50%
    downscale; visually confirmed on a real generated headshot.

## Verification contract (behaviour, in Gherkin)

- [x] **Scenario: pick a style and receive 3 watermarked previews**
  ```gherkin
  Given a user with a pending job whose source photo passed the pre-flight gate
  When they pick a style and start generation
  Then within the timeout they see 3 headshot previews
  And every preview is visibly watermarked
  And no clean full-resolution download is available yet
  ```

- [x] **Scenario: a default style is pre-selected**
  ```gherkin
  Given a user who just reached the style step
  When the style picker renders
  Then one style is already selected by default
  And the user can start generation in a single tap without choosing
  ```

- [x] **Scenario: hard failure auto-retries once and does not consume the free allowance**
  ```gherkin
  Given generation is requested and the image model errors or times out on the first attempt
  When the service auto-retries once and succeeds
  Then the user still receives their 3 watermarked previews
  And the user's free-generation allowance is unchanged
  ```

- [x] **Scenario: persistent hard failure shows a friendly retry state**
  ```gherkin
  Given generation fails on both the initial attempt and the auto-retry
  When the failure surfaces to the user
  Then they see a friendly error with a way to try again
  And the free-generation allowance is unchanged
  And no watermarked previews are shown
  ```

- [x] **Scenario: clean full-res is never exposed before payment**
  ```gherkin
  Given 3 watermarked previews are displayed for an un-unlocked job
  When one inspects the responses and page for image URLs
  Then only watermarked/preview assets are reachable
  And no URL resolves to the clean full-resolution image
  ```

## Implementation notes (TDD)

1. Spike the **image-to-image** call first (riskiest): extend the pattern in
   `app/api/ai/generate-image/route.ts` to pass the source photo as an image content part alongside the
   style prompt via the AI SDK, wrapped in `withAITelemetry`. Red: a test asserting an identity-preserving
   image comes back for a source + prompt.
2. Add **watermark compositing** as a pure, unit-testable function (server-side, e.g. `sharp`): input a
   clean image buffer → output {previewBuffer (watermarked+downscaled), fullBuffer}. Red-first on "preview
   differs from full and is smaller".
3. `headshotService.generateSet(jobId)`: fan out **3 parallel** calls (`Promise.all` with per-call ~25s
   timeout) → composite each → `r2Storage.uploadFile` both preview + full → insert `headshot_images` rows →
   flip job `status` `generating`→`ready`. Return `Result`. **Auto-retry once** on hard failure; pin that a
   retried-then-succeeded run leaves the free-allowance flag untouched.
4. Route: streaming is *not* required here (unlike the chat route) — a normal `Result` response after ~10s
   is fine. Wrap with `withAuth` + slice-01 gate + slice-02 job ownership check.
5. UI: style-picker + results-grid components under `app/(main)/headshots/`; a generate mutation hook that
   shows an in-progress state and renders the 3 previews. Watermarked previews only.
6. Invariant tests must pin: **clean `fullKey` is never returned in any pre-payment API response or page**.

## Blocked by

- `02-upload-preflight-face-gate.md`
