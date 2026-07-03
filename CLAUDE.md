# CLAUDE.md

Fullstack AI SaaS starter: Next.js 16 (App Router) · TypeScript · Drizzle/Postgres · Better Auth · Vercel AI SDK · TanStack Query · shadcn/ui · Biome · Vitest.

Detailed rules load automatically when you touch matching files — see `.claude/rules/{backend,frontend,testing}.md`.

## Commands

```bash
pnpm dev              # start dev server (localhost:3000)
pnpm build            # production build
pnpm check            # Biome lint + format (run before finishing)
pnpm check:fix        # auto-fix lint + format
pnpm test             # vitest unit tests
pnpm test:integration # vitest integration tests
pnpm test:e2e         # playwright e2e tests (auto-starts the dev server)
pnpm db:generate      # generate migration from schema changes
pnpm db:migrate       # apply migrations
pnpm db:studio        # drizzle studio
```

Package manager is **pnpm**. Path alias: `@/*` → repo root.

## Architecture: the feature slice

Features are vertical slices, layered strictly. **`modules/posts` and `modules/payments` are the reference implementations — copy them.**

1. **DB** — `modules/{feature}/schema.ts`: Drizzle table. IDs are `text` UUIDs via `$defaultFn(() => crypto.randomUUID())`.
2. **Domain** — `modules/{feature}/types.ts` (TS interfaces) + `schemas.ts` (Zod). `schema.ts` = database, `schemas.ts` = validation. Keep them separate.
3. **Service** — `modules/{feature}/services/{feature}.service.ts`: a class holding business logic. Framework-agnostic (no `NextResponse`).
4. **API** — `app/api/{feature}/route.ts`: thin Next.js route handlers.
5. **UI** — `app/(main)/{feature}/` with colocated `hooks/` and `components/`.

Data flows one way: Component → hook (`fetchApi`) → route handler → service → Drizzle. Types are shared top-to-bottom from `modules/{feature}/types.ts`. **Hooks and components live under `app/(main)/{feature}/`, never inside `modules/`.**

## Golden rules (apply everywhere)

- **Return `Result<T>`, never throw for expected errors** (`lib/result.ts`). Backend detail in `.claude/rules/backend.md`.
- **All server data goes through TanStack Query + `fetchApi` — never raw `fetch`/`useEffect` in components.** Frontend detail in `.claude/rules/frontend.md`.
- **Validate all external input with Zod at the boundary** (`schemas.ts` + `lib/validation/parse.ts`).
- **Wrap routes with `withAuth`/`withHandler`** (`lib/api/handlers.ts`) — never hand-roll `NextResponse`.

## Code style

- Biome enforces: 2-space indent, single quotes, semicolons, trailing commas, 100-col width, `const`, template literals, organized imports. Run `pnpm check:fix`.
- TypeScript strict mode. Prefer `type`/`interface` in `modules/{feature}/types.ts`; derive DB row types with `typeof table.$inferSelect`.
- Client components need `'use client'`. No `console.*` (Biome warns; only allowed in infra bootstrap like `lib/db`).

## Gotchas

- **`lib/api/base.ts` is deprecated** and its `withAuthentication` is a broken stub (returns 500). Never import from it. Use `lib/api/handlers.ts` + `lib/validation/parse.ts`. Migrate any AI/upload route that still references it when you touch it.
- The chat route (`app/api/ai/chat/route.ts`) streams via the AI SDK and legitimately does **not** use `Result` — streaming responses are the one exception.

## Workflow

- `/build "<feature>"` scaffolds a full slice (API + UI + tests). `/implement` drives an active plan one slice at a time.
