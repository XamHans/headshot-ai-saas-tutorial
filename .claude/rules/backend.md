---
paths:
  - "modules/**"
  - "app/api/**"
  - "lib/**"
---

# Backend rules

Reference: `modules/posts` (service + tests) and `app/api/posts/route.ts`.

## Result, not exceptions

- Services and route handlers return `Result<T>` (`lib/result.ts`): `{ success: true, data }` or `{ success: false, error: { code, message, cause? } }`. Never throw for expected errors.
- `error.code` is an `ErrorCode` from `lib/errors.ts` — add new codes there; each maps to an HTTP status via `errorCodeToStatus`.
- **Never leak `error.cause` to the client** — it is logged server-side only.

## Services

- A service is a class holding business logic in `modules/{feature}/services/{feature}.service.ts`. Framework-agnostic: no `NextResponse`, no request/response objects.
- Take `ServiceContext` via constructor (`{ db, logger }`). Export **both**:
  - a factory `createXService(ctx)` — for tests,
  - a singleton `export const xService = new XService(getServiceContext())` — for routes.
- Never call `getServiceContext()` inside a service.
- Log through `this.ctx.logger.child({ service })` with a structured `{ operation, ...context }` object.

## Routes

- Keep handlers to a few lines: parse → delegate to service → return.
- Wrap them — don't hand-roll: `withAuth` for authenticated routes (gives you `session`), `withHandler` for public ones (`lib/api/handlers.ts`).
- Return the service `Result` directly; `handleResult` turns it into the HTTP response. Do **not** build `NextResponse` yourself.
- Validate input at the boundary with Zod: `parseRequestBody(req, schema)` / `parseSearchParams(req.url, schema)` (`lib/validation/parse.ts`). Bail on `!result.success`.
- Never import from `lib/api/base.ts` (deprecated stub).

## Database

- `modules/{feature}/schema.ts` = Drizzle tables. IDs are `text` UUIDs via `$defaultFn(() => crypto.randomUUID())`.
- After changing a schema: `pnpm db:generate` then `pnpm db:migrate`.
- `schema.ts` (database) and `schemas.ts` (Zod validation) are separate files — keep them that way.
