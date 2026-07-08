# PRD — Headshot AI

**Status:** Draft for build
**Author:** Product planning session
**Last updated:** 2026-07-03
**Related:** builds on the existing feature-slice architecture (`modules/posts`, `modules/payments` reference implementations)

---

## 1. Summary

Headshot AI turns a single amateur photo into professional, realistic headshots. A user uploads **one** photo, picks a style, and receives **3 generated headshots in ~10 seconds**. Previews are shown watermarked for free; the user pays a **one-time $5** charge to unlock full-resolution, watermark-free downloads.

The product competes on **low friction** and **low price** against fine-tuning incumbents (Aragon, Photo AI, etc.) that require 10–20 photos, ~$30–40 upfront, and long waits. Our wedge: see your own face looking professional *before* you pay.

## 2. Problem & positioning

Existing AI headshot tools:
- Require many photos (10–20) and per-user model training.
- Cost $29–40+ and take 20–60 minutes.
- Ask users to pay before seeing any result.

This is high-friction and high-commitment. Many users just want a decent LinkedIn/profile photo quickly and cheaply, and won't commit $40 and an hour on faith.

**Our positioning:** _One photo in, 3 professional headshots out, in seconds. See them free, unlock for $5._

| | Incumbents | Headshot AI |
|---|---|---|
| Photos required | 10–20 | 1 |
| Wait time | 20–60 min | ~10 sec |
| Pay before seeing result | Yes | No (free watermarked preview) |
| Price | $29–40+ | $5 one-time |
| Approach | Per-user fine-tuning | Single-image transformation |

## 3. Goals & non-goals

### Goals
- Deliver a frictionless upload → preview → unlock funnel with instant, in-session results.
- Keep marginal generation cost negligible (~$0.12 per free set) so the free-preview funnel is economically safe.
- Convert on the emotional peak of seeing your own professional headshot.
- Capture verified email for delivery + remarketing.
- Handle biometric data responsibly (GDPR / BIPA compliant) from day one.

### Non-goals (v1)
- Per-user model fine-tuning (explicitly rejected — incompatible with cheap/low-friction).
- Async "email me when ready" generation (latency is ~10s; keep it synchronous).
- Free-text / custom prompts (moderation + quality liability).
- Subscriptions or credit packs (single one-time unlock only).
- Output-side likeness scoring (deferred to fast-follow; see §12).

## 4. Key product decisions (locked)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| 1 | Generation approach | **Single-image transformation** (not fine-tuning) | Only path to cheap + low-friction; enables free preview. |
| 2 | Model | **Gemini 2.5 Flash Image** (`gemini-2.5-flash-image-preview`, "nano banana") | Strong identity-preserving image-to-image, fast, ~$0.039/image. |
| 3 | Paywall mechanic | **Free watermarked preview → pay to unlock full-res** | Low friction; seeing your own result is the top conversion trigger. |
| 4 | What "3 images" varies | **User picks a style before generating** (Option C) | More perceived personalization; kept to one tap. |
| 5 | Auth gate | **Verified email required before generation** | Lead capture + abuse control; magic-link verify. |
| 6 | Abuse control | **Verified email + disposable-domain blocklist + IP/device rate limit + 1 free generation per account** | Email alone is weak; layered defense protects Gemini budget. |
| 7 | Sync vs async | **Synchronous, watch-it-happen** | ~10s latency; keeps user on the emotional peak. |
| 8 | Failure/quality handling | **Pre-flight input guard + forgive hard failures + 1 free regen** | Most bad outputs come from bad inputs; catch before spending. |
| 9 | Unlock price | **$5 one-time** | Impulse-buy zone; ~97% gross margin; undercuts incumbents. |
| 10 | Retention | **Auto-delete source + unpurchased outputs after 30 days** | Balances remarketing with GDPR/BIPA minimization. |
| 11 | Market / legal | **US + EU, full compliance** | Broadest market; explicit biometric consent, DPA-ready. |

## 5. User flow (end to end)

1. **Onboarding / email capture** — user enters email; **magic-link verification** (Better Auth). No verified email → no generation. Explicit **biometric-consent checkbox** shown here.
2. **Upload** — user uploads **one** photo.
   - Client + server validation (size, mime, extension) via existing `file-upload.ts` / `file-validation.ts`.
   - **Pre-flight face check** *before* any Gemini spend: exactly one clear, front-facing, adequately lit face; no sunglasses; sufficient resolution. Reject with friendly guidance otherwise.
   - Store source photo in **R2 (private bucket)**.
3. **Pick a style** — one tap on a visual style card (curated preset library, 6–12 styles). A sensible default is pre-selected so an indecisive user can generate immediately. No multi-step wizard.
4. **Generate (synchronous)** — 3 parallel Gemini image-to-image calls (source photo + style prompt). ~10s. Hard timeout ~25s. Returns `Result<T>`.
   - Hard failure (error/timeout/refusal): auto-retry once; **does not** count against the free allowance.
   - Bad output (subjective): **one free regenerate** of the set; beyond that, paid.
5. **Preview** — show 3 **watermarked** headshots in-session (server-composited diagonal wordmark + downscale, stored in R2).
6. **Unlock ($5)** — `paymentService.createPayment({ metadata: { jobId } })` → Stripe Checkout → return to `/payments/return`.
7. **Confirm** — Stripe **webhook** `checkout.session.completed` flips `unlocked = true` on the job.
8. **Deliver** — full-resolution, watermark-free images via **short-lived R2 signed URLs**, available only when `unlocked`. Also emailed as a results link.
9. **Retention** — scheduled cleanup deletes source photos + unpurchased outputs after 30 days; purchased images kept while the account exists; user has a "delete my data" action.

## 6. Functional requirements

### Upload & validation
- Accept a single image (JPEG/PNG), max ~10MB.
- Pre-flight face detection gate before any paid generation.
- Store source in private R2 with a namespaced key (`sources/{userId}/{jobId}.jpg`).

### Generation
- Extend the current **text-to-image** route to **image-to-image**: pass the user's photo as an image content part alongside the style prompt (Gemini is multimodal via the AI SDK).
- 3 parallel calls, one per selected style variant.
- 25s hard timeout; graceful error + retry states.
- Enforce the **one-free-generation cap** and **rate limit** in the service *before* any Gemini call.

### Preview & watermarking
- Store one clean full-res output per image in R2 (private).
- Generate a preview (diagonal wordmark overlay + downscale) server-side; store separately.
- Serve previews openly; serve clean full-res **only** via short-lived signed URL after `unlocked = true`.
- Never expose the clean R2 key pre-payment.

### Payments & unlock
- One-time Stripe Checkout (`mode: 'payment'`) — already supported by `modules/payments`.
- Link payment to job via `metadata.jobId`.
- Webhook `checkout.session.completed` → `markUnlocked(jobId)`.

### Abuse & rate limiting
- Require verified magic-link email before generation.
- Disposable-domain blocklist at signup.
- IP + browser-fingerprint rate limit at the route boundary.
- One free 3-image generation per verified account, ever; subsequent generations require payment.

### Retention & privacy
- Explicit biometric-consent checkbox at onboarding (US + EU compliance).
- Auto-delete source photos + unpurchased outputs after 30 days (scheduled cleanup via R2 `deleteFile`).
- Keep purchased images while the account exists.
- "Delete my data" user action.

## 7. Data model (`modules/headshots/schema.ts`)

Text-UUID IDs via `$defaultFn(() => crypto.randomUUID())`, per project convention.

**`headshot_jobs`**
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | UUID |
| `userId` | text | owner |
| `sourceImageKey` | text | R2 key of uploaded photo |
| `styleId` | text | selected preset |
| `status` | text | `pending` / `generating` / `ready` / `failed` |
| `unlocked` | boolean | default false; flipped by webhook |
| `paymentId` | text (nullable) | FK to `payments.id` |
| `freeRegenUsed` | boolean | default false |
| `createdAt` / `updatedAt` | timestamp | |

**`headshot_images`**
| Column | Type | Notes |
|---|---|---|
| `id` | text (PK) | UUID |
| `jobId` | text | FK to `headshot_jobs.id` |
| `previewKey` | text | R2 key, watermarked |
| `fullKey` | text | R2 key, clean full-res (private) |
| `styleVariant` | text | which variant/angle |
| `createdAt` | timestamp | |

`schema.ts` (database) and `schemas.ts` (Zod validation) stay separate per project rules.

## 8. Architecture — feature slice `modules/headshots`

Follows the strict vertical slice (DB → Domain → Service → API → UI). `modules/posts` and `modules/payments` are the reference implementations.

- `modules/headshots/schema.ts` — Drizzle tables (§7).
- `modules/headshots/types.ts` — TS interfaces (shared top-to-bottom).
- `modules/headshots/schemas.ts` — Zod boundary validation.
- `modules/headshots/services/headshot.service.ts` — class taking `ServiceContext`, returns `Result<T>`. Methods: `createJob`, `generateSet` (3 parallel Gemini calls + watermark + R2 store), `getJob`, `markUnlocked` (from webhook), plus the free-cap + rate-limit checks. Export factory `createHeadshotService(ctx)` + singleton `headshotService`.
- `app/api/headshots/route.ts` + `app/api/headshots/[id]/route.ts` — thin handlers wrapped with `withAuth`; parse → delegate → return `Result`.
- `app/(main)/headshots/` — colocated `hooks/` (TanStack Query + `fetchApi`) and `components/` (uploader, style picker, results grid, unlock button). Hooks/components never live in `modules/`.

### Reuse map (already in the repo)
| Need | Existing asset |
|---|---|
| Gemini model | `app/api/ai/generate-image/route.ts` (text-to-image today — extend to image-to-image) |
| AI telemetry | `lib/ai/telemetry.ts` (`withAITelemetry`) |
| Image storage | `lib/storage/r2-client.ts` (upload, signed URLs, presigned, delete) |
| Upload + validation | `lib/services/file-upload.ts`, `lib/middleware/file-validation.ts` |
| Payments | `modules/payments` (Stripe Checkout one-time, webhook events) |
| Email | `lib/services/email.ts` + templates |
| Analytics | `lib/services/analytics.ts` |
| Auth | Better Auth (`lib/auth.ts`), `withAuth` in `lib/api/handlers.ts` |
| Result / validation | `lib/result.ts`, `lib/validation/parse.ts` |

### Net-new work (the only genuinely new AI/media code)
1. **Image-to-image extension** — feed the user's photo + style prompt to Gemini (identity-preserving edit) instead of text-only.
2. **Watermark compositing** — server-side overlay + downscale to produce previews.

Everything else is orchestration of existing infrastructure.

## 9. Style presets (content asset — v1 placeholder)

The whole product's quality rides on curated prompt templates. Target **6–12** presets. Starting candidates:
- Corporate / LinkedIn — neutral gray studio backdrop.
- Business-casual — outdoor / natural light.
- Studio black-and-white.
- Creative / tech — soft colored gradient background.
- Executive — dark suit, dramatic lighting.
- Approachable — bright, warm office bokeh.

_Each preset needs a hardened prompt template that reliably produces good results from a single source photo. To be finalized before build (see Open questions)._

## 10. Economics

- Gemini cost: ~$0.039/image → **~$0.12 per free 3-image set**.
- Unlock price: **$5** one-time.
- Gross margin per sale: **~97%**.
- Break-even conversion (covering generation on non-buyers): **~2.4%**. Anything above is profit.
- Structural risk is **not** unit economics; it's **likeness quality** and **preview abuse** — both mitigated (§6, §12).

## 11. Compliance & privacy

- Face photos are **biometric data** under GDPR Art. 9 and Illinois BIPA (statutory damages per violation).
- Explicit consent checkbox at onboarding, before upload.
- Data minimization: 30-day auto-delete of source + unpurchased outputs.
- DPA-ready; document processors (Google/Gemini, Cloudflare R2, Stripe).
- User-facing "delete my data" action.
- Note: Gemini image output carries **SynthID watermarking** and Google content policies apply.

## 12. Risks & mitigations

| Risk | Mitigation |
|---|---|
| Poor likeness / uncanny output from single photo | Pre-flight input gate; one free regen; **output-side face-similarity scoring** as a fast-follow once we have real data. |
| Preview abuse burning Gemini budget | Verified email + disposable blocklist + IP/device rate limit + 1 free generation/account. |
| Users screenshotting watermarked previews | Aggressive diagonal watermark + downscale; full-res clean download worth $5 to real users. |
| Gemini refusals / safety filters | Auto-retry once; friendly error; refusals don't burn free allowance. |
| Biometric-data legal exposure | Explicit consent, 30-day deletion, US+EU compliance posture. |
| Latency spikes > 25s | Hard timeout + clean error/retry state; consider async fallback only if data demands it. |

## 13. Fast-follow / v2 candidates

- Output-side likeness scoring (auto-discard low-similarity results before showing).
- Paid upsells: extra styles, "generate more like #2", higher-res / print sizes.
- Per-style outfit/background color options.
- Batch / team plans.
- Geo/latency-based async fallback.

## 14. Open questions (resolve before build)

1. Finalize the 6–12 style presets and their hardened prompt templates (the key quality asset).
2. Exact pre-flight face-check implementation (client-side `face-api.js` vs. cheap server check).
3. Watermark design (wordmark, opacity, downscale factor).
4. Fingerprinting library choice for the rate limiter.
5. Scheduled-cleanup mechanism for 30-day deletion (cron vs. scheduled job).

## 15. Suggested build sequence

1. `modules/headshots` schema + migration (`headshot_jobs`, `headshot_images`).
2. Image-to-image extension of the Gemini generation route.
3. `headshot.service.ts` — job creation, generation, free-cap + rate limit.
4. Upload + pre-flight face gate + R2 storage.
5. Watermark compositing + preview/full-res split.
6. Style picker + results UI (`app/(main)/headshots/`).
7. Stripe unlock wiring + webhook → `markUnlocked`.
8. Email delivery + remarketing hooks.
9. Retention cleanup job + "delete my data".

Scaffold with `/build "headshots"`, then drive slice-by-slice with `/implement`.
