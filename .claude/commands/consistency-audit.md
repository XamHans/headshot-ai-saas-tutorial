---
description: Audit the codebase for drift from the documented architecture (feature-slice patterns, Result, TanStack Query, thin routes) and report drift as a GitHub issue.
allowed-tools: Bash, Read, Grep, Glob, Task
---

**Objective:** Verify the codebase still adheres to the architecture defined in `CLAUDE.md` and `.claude/rules/{backend,frontend,testing}.md`. Combine deterministic static checks + Biome/typecheck with an LLM reviewer pass, then report any drift as a **GitHub issue** (dedupe against an existing open one). If the repo is clean, close any stale audit issue and post nothing new.

You are running non-interactively. Do **not** edit code — this is read-only auditing. Work through the phases in order and keep a running list of findings, each tagged with a severity: `blocker` (broken/forbidden pattern), `warn` (drift from convention), `note` (minor/style).

---

## Phase 1 — Deterministic static checks (Bash + Grep)

Run these and record any hits as findings. A hit is only a *candidate* — read the surrounding code before deciding severity. Known legitimate exceptions are noted; exclude them.

**Backend**

1. **Services throwing for expected errors** (`blocker` if it's an expected error, not a programmer assertion):
   `grep -rn "throw " modules/*/services/ 2>/dev/null`
   Services must return `Result<T>`. A `throw` in a constructor for a missing dependency is acceptable; a `throw` in business logic is not.

2. **Hand-rolled `NextResponse` in routes** (`blocker`):
   `grep -rn "NextResponse" app/api 2>/dev/null | grep -v "app/api/auth/"`
   Routes must return the service `Result` and let `handleResult` build the response. Exception: the Better Auth catch-all.

3. **Imports from deprecated `lib/api/base.ts`** (`blocker`):
   `grep -rn "lib/api/base" --include="*.ts" --include="*.tsx" . 2>/dev/null | grep -v node_modules`

4. **Routes bypassing Zod boundary parsing** (`warn`):
   `grep -rn "req.json()\|request.json()\|\.nextUrl\.searchParams" app/api 2>/dev/null | grep -v "app/api/payments/webhook"`
   Routes should use `parseRequestBody`/`parseSearchParams` from `lib/validation/parse.ts`. The Stripe webhook (raw body) is exempt.

5. **Routes not wrapped in `withAuth`/`withHandler`** (`blocker`):
   For each `app/api/**/route.ts` (except `app/api/auth/[...all]`), confirm each exported `GET/POST/PUT/DELETE/PATCH` is a `withAuth(...)` or `withHandler(...)` call. Grep the handler exports:
   `grep -rn "export const \(GET\|POST\|PUT\|DELETE\|PATCH\)" app/api 2>/dev/null`
   then read any file whose export isn't obviously a `withAuth`/`withHandler` call.

**Frontend**

6. **Raw `fetch` in UI/hooks** (`blocker`):
   `grep -rn "fetch(" "app/(main)" components hooks 2>/dev/null | grep -v "fetchApi"`
   All server data must go through `fetchApi` + TanStack Query.

7. **`useEffect` used for data fetching** (`warn` — read to confirm it's a fetch, not a legit effect):
   `grep -rn "useEffect" "app/(main)" components 2>/dev/null`

8. **Hooks/components living inside `modules/`** (`blocker`):
   `find modules -path "*/hooks/*" -o -path "*/components/*" 2>/dev/null`
   Must be empty — these belong under `app/(main)/{feature}/`.

9. **`console.*` outside infra bootstrap** (`warn`):
   `grep -rn "console\." app "app/(main)" components hooks modules 2>/dev/null | grep -v "lib/db" | grep -v "lib/logger"`

**Structure**

10. **Each feature slice is complete** (`warn` per missing file):
    For every dir in `modules/*` (excluding `users` if it's auth-owned), confirm `schema.ts`, `schemas.ts`, `types.ts`, and `services/` all exist:
    `for d in modules/*/; do echo "== $d"; ls "$d"; ls "$d"services 2>/dev/null; done`
    `schema.ts` (Drizzle) and `schemas.ts` (Zod) must both exist and be distinct.

## Phase 2 — Biome + typecheck

Run and capture pass/fail + first ~40 lines of any failure:
- `pnpm check` (Biome lint+format) — any error is a `blocker`, warnings are `warn`.
- `pnpm typecheck` (`tsc --noEmit`) — any error is a `blocker`.

## Phase 3 — LLM reviewer pass

Spawn a `general-purpose` (or `Explore`) subagent with this instruction:

> Read `CLAUDE.md`, `.claude/rules/backend.md`, `.claude/rules/frontend.md`, and the reference slice `modules/headshot` (+ `app/api/headshots/[id]/route.ts`, `app/(headshot)/headshot/hooks/`). Then review every **non-reference** feature slice (`modules/payments`, and anything newer) plus its API routes and UI hooks. Judge the fuzzy patterns that grep can't: (a) services export **both** a `createXService(ctx)` factory and an `xService` singleton, and never call `getServiceContext()` internally; (b) services take `ServiceContext` and log via `this.ctx.logger.child(...)`; (c) route handlers are genuinely thin (parse → delegate → return); (d) client components have `'use client'`; (e) TanStack hooks use stable query keys and invalidate the right keys on mutation success; (f) UI imports shared types from `modules/{feature}/types` rather than redefining them. Return a concise list of concrete violations as `{ file, severity, issue }` — no prose, no praise. If a slice fully matches the reference, say nothing about it.

Merge the subagent's findings into the running list.

## Phase 4 — Report to GitHub

Ensure the label exists (idempotent):
`gh label create architecture-audit --color 5319e7 --description "Automated architecture consistency audit" 2>/dev/null || true`

Find the existing open audit issue:
`gh issue list --label architecture-audit --state open --json number,title --jq '.[0].number'`

**If there are findings:**
- Build a markdown body: a one-line summary (`N blockers, M warnings, K notes`), then findings grouped by severity, each as `- \`file:line\` — issue`. Include the run date (UTC) and note it was generated by the daily routine.
- If an open audit issue exists: update it with `gh issue edit <n> --body-file -` (fresh full body) and add a comment `gh issue comment <n> --body "Re-audited <date>: <summary>"`.
- If none exists: `gh issue create --title "🔍 Architecture consistency drift — <date>" --label architecture-audit --body-file -`.

**If there are no findings:**
- If an open audit issue exists, close it: `gh issue comment <n> --body "✅ Re-audited <date>: codebase is back in line with the documented architecture. Closing."` then `gh issue close <n>`.
- Otherwise do nothing.

## Phase 5 — Print a summary

End with a short console summary: total findings by severity, the issue number created/updated/closed (or "clean, no action"), and the single highest-priority item to fix first.
