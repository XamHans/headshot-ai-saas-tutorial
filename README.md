# Fullstack AI Starter

Production-grade Next.js 15 starter for shipping AI SaaS that stays maintainable: spec-driven workflows, typed integrations, and batteries-included tooling from auth to observability.

**⭐️ Star the repo, then clone it and start building.**

## Why teams ship with this starter
- Spec-driven development keeps AI agents aligned and kills rework.
- Multi-provider AI playgrounds stream results with typed, structured output.
- Better Auth, Drizzle, and Neon give you secure login, sessions, and migrations on day one.
- Resend emails, R2 file uploads, Stripe payments, and background jobs are wired for real customer flows.
- Langfuse, Pino, Umami, and Vitest ensure you monitor, log, and test before launch.

## What's inside
- Next.js 16 App Router, TypeScript, Tailwind, and shadcn/ui components.
- Vercel AI SDK preconfigured for OpenAI, Anthropic, Google Gemini, and Claude Code MCP.
- Modular services with dependency injection plus Drizzle ORM schemas and seeds.
- Spec-first QA with Gherkin, Vitest unit/integration suites, Playwright, and Supertest templates.
- Documentation hub covering AI patterns, authentication, database, testing, and analytics.

## Quick start
1. `git clone https://github.com/XamHans/fullstack-ai-starter.git && cd fullstack-ai-starter`
2. Install dependencies: `pnpm install` (or `npm install` if you prefer).
3. `cp .env.example .env.local` and add database, AI provider, auth, storage, and analytics keys.
4. Prime the database: `pnpm db:generate && pnpm db:migrate`.
5. Run the app: `pnpm dev` and visit `http://localhost:3000`.

## Payments (Stripe)

Get started with Stripe Checkout in minutes:

1. Get API keys from [Stripe Dashboard](https://dashboard.stripe.com/apikeys)
2. Add to `.env.local`:
   ```bash
   STRIPE_SECRET_KEY="sk_test_..."
   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY="pk_test_..."
   STRIPE_WEBHOOK_SECRET="whsec_..."
   ```
3. Setup webhook (local dev):
   ```bash
   stripe listen --forward-to http://localhost:3000/api/payments/webhook
   ```
4. Run migrations: `pnpm db:migrate`

The payment slice (`modules/payments`, `app/api/payments`, `app/(main)/payments`) is a complete working reference.

## Keep your fork updated
- Leave `origin` pointing at your fork and add this starter as an `upstream` remote: `git remote add upstream https://github.com/our-org/starter-kit.git`.
- Do feature work on branches off your `main`, then sync with the starter by fetching and rebasing (or merging): `git fetch upstream && git rebase upstream/main`.
- Resolve conflicts locally, run your test suite, then push back to your repo: `git push origin main` (or the feature branch you are updating).
- If you used the GitHub template flow, the “Sync fork” button performs the fetch/merge for you—just pull those changes into your local clone afterward.
- Keep notes on tweaks you reapply each update so future merges stay quick; try the flow on a scratch branch first if you want a dry run.

## Need details?
- Conventions and architecture: `CLAUDE.md` (stack, commands, the feature-slice map, golden rules).
- Layer-specific rules: `.claude/rules/` (`backend.md`, `frontend.md`, `testing.md`) — auto-loaded when you edit matching files.
- Feature workflow: the `/build` and `/implement` skills in `.claude/skills/`.
- Reference implementations: `modules/posts` and `modules/payments`.
