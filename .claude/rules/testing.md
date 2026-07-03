---
paths:
  - "**/*.test.ts"
  - "**/*.test.tsx"
  - "e2e/**"
  - "tests/**"
---

# Testing rules

## Service / unit tests (Vitest)

- Test services against a real test DB: build a `ServiceContext` with `getTestDb()` + `createLogger()`, then `createXService(ctx)`. See `modules/posts/tests/post.service.test.ts`.
- Assert on the `Result` shape: check `result.success`, then narrow before reading `data` or `error.code`.
- Tests use the `test` Postgres schema when `NODE_ENV=test` (see `modules/*/schema.ts`).
- Location: `modules/{feature}/tests/`. Run with `pnpm test` (or `pnpm test:integration`).

## E2E tests (Playwright)

- Live in `e2e/*.spec.ts` (config: `playwright.config.ts`), kept separate from Vitest (which excludes `e2e/**`).
- `webServer` boots `pnpm dev` automatically on port `3131` (override with `PORT`/`PLAYWRIGHT_BASE_URL`) so it never collides with a `pnpm dev` already on `3000`.
- Prefer role/text locators (`getByRole`, `getByText`). For authenticated flows use a `storageState` fixture rather than logging in per test.
- The `@playwright/mcp` server (`.mcp.json`) lets an agent drive the browser to explore and author these tests.
- Run with `pnpm test:e2e` (or `pnpm test:e2e:ui` / `pnpm test:e2e:codegen`).

## When to write which

- **Integration/API tests**: after the route works — the primary safety net.
- **Unit tests**: only for complex service logic with edge cases.
- **E2E**: rarely — only critical multi-step flows (checkout, signup), once the feature is stable.
