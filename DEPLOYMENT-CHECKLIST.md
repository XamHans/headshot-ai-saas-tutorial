# Deployment Checklist: Headshot AI → Vercel / Neon / Stripe / Resend

As of 2026-07-20. Refers to `fullstack-ai-starter`, feature plan `docs/plans/headshot-ai/`.

**Legend:** `[!]` blocker (must be done before go-live) · `[ ]` normal task · `[x]` done · `[opt]` optional / can follow after launch.

**Slice status per `docs/plans/headshot-ai/STATUS.md`:** **01–07 done — core plan complete.** Slice 06 (email delivery) and slice 07 (30-day cleanup job + "delete my data") are implemented and merged; the only remaining slice-07 task is setting `CRON_SECRET` in the Vercel production env (see sections 6/7).

---

## 0. Code blockers (fix before any deploy)

- [!] `package.json` → `db:migrate` points to `lib/db/scripts/migrate.ts`, which **does not exist** (only `scripts/verify-db.ts` and `scripts/verify-r2.ts` are present). Either build the script or replace the line with:
  ```json
  "db:migrate": "drizzle-kit migrate"
  ```
- [!] `db:seed` also points to a non-existent file (`lib/db/scripts/seed.ts`). Remove the script if no seed is needed; otherwise build it.
- [ ] `next.config.mjs`: `images.remotePatterns` only contains `api.microlink.io`. If preview/full-res images are loaded via `next/image` from the R2/Cloudflare domain, add that domain here — otherwise `next/image` throws in prod.
- [x] ~~No `vercel.json` present~~ → **done with slice 07**: `vercel.json` exists and contains the cleanup cron (`/api/headshots/cleanup`, daily 03:00 UTC).

---

## 1. Neon (database)

- [!] Create the Neon project (or use the Vercel Marketplace "Neon" integration, which sets `DATABASE_URL` automatically per environment)
- [!] Use the **pooled** connection string (endpoint with `-pooler`) for `DATABASE_URL`, not the direct one — Next.js/serverless functions need connection pooling, otherwise connections pile up under traffic
- [ ] Confirm `sslmode=require` in the connection string (already set that way in `.env.example`)
- [opt] Separate Neon branches per environment: `main` (prod), `preview` (for Vercel preview deployments), `dev` (local). The Vercel–Neon integration can automatically create a Neon branch per preview deployment — saves manual setup
- [!] Migration state before go-live: 6 migration files in `lib/db/migrations/`, chronologically:
  1. `0000_stormy_dark_beast.sql` — initial schema (user/session/posts etc.)
  2. `0001_add_payments_tables.sql` — `payments`, `webhookEvents`
  3. `0002_add_biometric_consent.sql` — `biometricConsentAt` column (slice 01)
  4. `0003_add_headshot_tables.sql` — `headshotJobs`, `headshotImages` (slices 02/03)
  5. `0004_add_abuse_controls.sql` — `headshotRateLimits`, `headshotFreeGenerationUsedAt` (slice 04)
  6. `0005_raise_free_generation_cap.sql` — free limit raised to 3 generations (latest)
  Run them **once manually against the prod DB** before the first Vercel prod deploy goes live:
  ```bash
  DATABASE_URL="<prod-url>" pnpm exec drizzle-kit migrate
  ```
- [!] Decide on a migration workflow going forward: either (a) run migrations manually against prod before each release, or (b) automate them as a Vercel build step / GitHub Actions step. Do **not** use `db:push` for prod — it writes the schema directly without version history and can lose data on divergence; `db:push` is for local iteration only
- [opt] Enable backups/point-in-time recovery in Neon (depends on the plan you're on)
- [opt] Review connection limit / autoscaling compute size for prod in the Neon dashboard if meaningful traffic is expected

---

## 2. Stripe

- [!] Switch from test-mode to live-mode keys
- [!] Create the live webhook endpoint in the Stripe dashboard (`dashboard.stripe.com/webhooks`):
  - URL: `https://<prod-domain>/api/payments/webhook`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
  - Put the generated `whsec_...` secret into the Vercel prod env as `STRIPE_WEBHOOK_SECRET` (do **not** reuse the local `stripe listen` secret)
- [!] Make sure the webhook route (`app/api/payments/webhook/route.ts`) runs on the **Node.js runtime**, not Edge — signature verification needs the raw body and `crypto`, which is unreliable on Edge
- [ ] Do a live-mode test purchase with a real (small) payment and verify that `markUnlocked` triggers and the full-resolution images are unlocked
- [opt] Move `price_data` (currently inline in code, no fixed Stripe product) to a dashboard-managed product/price — only needed if you want clean revenue reporting/invoicing via Stripe products
- [opt] Enable Stripe Tax if VAT/sales tax must be collected from end customers
- [opt] Review Radar rules / fraud-protection settings for live mode

---

## 3. Resend (email)

- [!] Add and verify the sender domain in Resend (set SPF, DKIM, optionally DMARC DNS records at your domain provider)
- [!] Set `RESEND_API_KEY` (live key) and `RESEND_FROM_EMAIL` (verified domain, e.g. `noreply@your-domain.com`) in the Vercel prod env
- [x] ~~**Finish slice 06 (email delivery of the results link)**~~ — **done**: buyers receive a one-time email with the results link after unlock (`lib/email/templates/headshot-results.tsx`)
- [opt] Mind domain reputation / deliverability warm-up if larger sending volume is expected from day 1

---

## 4. Google Gemini (image generation)

- [!] Enable Google Cloud billing for the project/API key — without billing there is **zero free quota** for image generation per the slice-03 note; live operation would immediately break with errors
- [!] Keep the production `GOOGLE_GENERATIVE_AI_API_KEY` separate from a dev key
- [opt] Set up a cost limit / budget alert in Google Cloud billing (image generation can get expensive fast under abuse — complements the slice-04 abuse controls)
- [opt] Only set `OPENAI_API_KEY` if the starter's chat/playground area should stay active in prod at all

---

## 5. Cloudflare R2 (storage)

- [!] Create a production bucket separate from the dev/test bucket
- [!] Keep the bucket **private** (no public read) — per the slice-05 security invariant, full-resolution images must only ever be delivered via short-lived signed URLs
- [!] Create an R2 API token with **minimal permissions** (read/write on the one prod bucket only) at `dash.cloudflare.com → R2 → Manage R2 API Tokens`
- [ ] Set `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` in the Vercel prod env
- [opt] Review the bucket's CORS configuration if uploads go directly from the browser via presigned URL (not proxied through a server route)
- [opt] Consider a lifecycle rule on the R2 bucket as an extra safety net alongside slice 07 (e.g. auto-delete objects after 60 days in case the app-side job ever fails)

---

## 6. Vercel (hosting/deploy)

- [!] Import the project from the git repo, framework preset "Next.js"
- [!] Maintain environment variables **separately for Production and Preview** (see table below) — Preview should use Stripe test keys and a separate Neon branch so preview deployments never run against live data
- [!] Set `NEXT_PUBLIC_APP_URL` to the final production domain (used for Stripe success/cancel redirects)
- [!] Set `BETTER_AUTH_URL` to exactly `https://<prod-domain>`. **Currently missing from `.env.example`**, but required by Better Auth for magic-link redirects — per `CLAUDE.md`, a wrong value causes "connection refused" when clicking the magic link
- [ ] Connect the custom domain, verify the SSL certificate (Vercel handles this automatically, just double-check)
- [ ] Add the prod domain to the Google OAuth redirect URIs in the Google Cloud Console (`https://<prod-domain>/api/auth/callback/google` or similar, depending on Better Auth routing)
- [x] ~~Create `vercel.json` with the cron job once slice 07 lands~~ — **done with slice 07**: `vercel.json` is in the repo (`/api/headshots/cleanup`, daily `0 3 * * *`); the endpoint checks `Authorization: Bearer <CRON_SECRET>` (GET and POST)
- [!] Set `CRON_SECRET` in the Vercel **prod env** (Vercel Cron sends it automatically as an `Authorization: Bearer <CRON_SECRET>` header). A generated value already exists locally in `.env.local`; generate a **separate** value for prod (e.g. `openssl rand -hex 32`). Without this env var the cleanup endpoint rejects every call and the 30-day deletion job never runs

---

## 7. Privacy / retention (slice 07 — implemented, 2026-07-20)

- [x] ~~Implement slice 07~~ — **done**: automatic 30-day sweep (`headshotService.cleanupExpired`, deletes source photos + unpurchased outputs from R2 plus the image rows; purchased/unlocked jobs are **never** touched by the sweep) plus a "delete my data" button on `/headshot` (`headshotService.deleteUserData`, strictly scoped to the signed-in user). Covered by unit, integration, and Playwright tests
- [!] The sweep only runs in prod once `CRON_SECRET` is set in the Vercel env (see section 6) — until then the old rule still applies: do not process real user photos in prod (GDPR Art. 9 / potentially BIPA-relevant)
- [opt] Have the privacy policy / consent copy (slice 01 already has a consent gate) legally reviewed if the product is marketed publicly

---

## 8. Security / abuse

- [ ] **Regenerate** `BETTER_AUTH_SECRET` for prod (≥32 characters, random) — do not reuse the dev value
- [opt] Rate limiting currently runs purely via the `headshot_rate_limits` DB table (no Upstash/Redis active, although `@upstash/redis` is a dependency). Fine for launch; switch to Redis at higher traffic
- [opt] Consider additional bot protection (e.g. Vercel Firewall, Cloudflare Turnstile) in front of the free upload endpoint, since the 3 free generations per user are easy to bypass with multiple accounts

---

## 9. CI / tests (no GitHub Actions workflow present)

- [opt] Set up a minimal pipeline that runs before every merge/deploy: `pnpm typecheck && pnpm lint:biome && pnpm test && pnpm build` (Vercel itself only runs `next build` on deploy, no tests)
- [opt] Run the e2e suite (`pnpm test:e2e`) once manually against a staging URL with Stripe test keys before switching to live keys — Playwright starts the Stripe CLI locally (`stripe listen`), which does not run automatically on Vercel

---

## 10. Observability / analytics — optional, can follow after launch

- [opt] Set up Langfuse (`LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASEURL`) for prod to monitor Gemini costs and traces
- [opt] Configure Umami (`NEXT_PUBLIC_UMAMI_WEBSITE_ID`, `NEXT_PUBLIC_UMAMI_URL`) for the prod domain
- [opt] Set the prod log level to `info` or `warn` (`LOG_LEVEL`); `debug` produces unnecessary output
- [opt] Set up alerting for failed Stripe webhooks / `payment_intent.payment_failed`

---

## Env var reference: what to maintain where

**Source of truth for all known variables:** `.env.example` in the repo root (except `BETTER_AUTH_URL`, which is still missing there — see notes; `CRON_SECRET` was added with slice 07).

Where to maintain:
- **Local:** `.env.local` (do not commit; already present as `.env`/`.env.local`)
- **Vercel:** Project Settings → Environment Variables, set individually per scope `Production` / `Preview` / `Development`

| Variable | Required? | Production value comes from | Preview/dev value |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Neon prod branch, pooled endpoint | Neon preview/dev branch |
| `YOUR_NEON_API_KEY` | optional (MCP tooling only) | Neon account settings | same as dev |
| `OPENAI_API_KEY` | only if the chat playground stays live | platform.openai.com | own dev key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | Google AI Studio / Cloud Console, **with billing enabled** | own dev key, small quota |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ (if Google login is active) | Google Cloud Console → OAuth client | own dev client with `localhost` redirect |
| `BETTER_AUTH_SECRET` | ✅ | regenerate, 32+ characters | own dev value |
| `BETTER_AUTH_URL` | ✅ (missing from `.env.example`!) | `https://<prod-domain>` | `http://localhost:3000` |
| `RESEND_API_KEY` | ✅ | resend.com dashboard, live key | test/sandbox key |
| `RESEND_FROM_EMAIL` | ✅ | verified prod domain | e.g. `onboarding@resend.dev` for testing |
| `STRIPE_SECRET_KEY` | ✅ | Stripe dashboard, live mode | test-mode key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe dashboard, live mode | test-mode key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | live webhook endpoint in the dashboard | `stripe listen --print-secret` locally |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://<prod-domain>` | Vercel preview URL or `http://localhost:3000` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | ✅ | Cloudflare dashboard, prod bucket token | own dev bucket |
| `CRON_SECRET` | ✅ (slice 07 is live) | generate yourself (e.g. `openssl rand -hex 32`), set in Vercel | own dev value (already in `.env.local`) |
| `LANGFUSE_*` | optional | cloud.langfuse.com | optional, can stay empty |
| `NEXT_PUBLIC_UMAMI_*` | optional | umami.is dashboard | optional, can stay empty |
| `LOG_LEVEL` | optional | `info`/`warn` for prod | `debug` for dev |
| `NODE_ENV` | set automatically by Vercel | — | — |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` / `REDIS_URL` | optional, currently unused | only if switching to Redis rate limiting | — |

---

## Bottom line: what actually blocks go-live?

1. ~~Finish slice 06 (email delivery)~~ — **done**
2. ~~Finish slice 07 (retention/deletion job)~~ — **done in code**; remaining: set `CRON_SECRET` in the Vercel prod env, otherwise the deletion job never runs (privacy-wise not a "nice to have")
3. Fix the `db:migrate` script and run migrations 0000–0005 once against the prod Neon DB
4. Add `BETTER_AUTH_URL` as an env var (still missing from the template); set `CRON_SECRET` in Vercel
5. Set up the Stripe live webhook + Google billing + Resend domain verification

Everything under "optional" (observability, CI pipeline, Redis rate limiting, fixed Stripe price objects) can follow after the first launch.
