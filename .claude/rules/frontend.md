---
paths:
  - "app/(main)/**"
  - "components/**"
  - "hooks/**"
---

# Frontend rules

Reference: `app/(main)/posts/hooks/use-posts.ts` and `app/(main)/posts/components/`.

## Data fetching — TanStack Query only

- **All server data goes through TanStack Query hooks. Never `fetch`/`useEffect` in components.**
- Put hooks in `app/(main)/{feature}/hooks/use-{feature}.ts` — colocated with the slice, not in `modules/`.
- Call the API only via `fetchApi<T>` (`lib/api/client.ts`). It unwraps `{ success, data }` and throws `Error(message)` on failure, so a query/mutation `error` is already a clean message string.

## Queries and mutations

- **Queries**: stable `queryKey` — list key `['posts', filters]`, detail key `['posts', id]`. Query defaults live in `lib/query/client.ts`.
- **Mutations**: `invalidateQueries` the affected keys in `onSuccess`.
- **Loading/error come from the hook** (`isPending`, `isError`, `error`) — drive skeletons and disabled states off them, not local `useState` flags.

## UI

- Use shadcn/ui primitives from `components/ui/*`. Shared layout/chrome lives in `components/*`; feature-specific components in `app/(main)/{feature}/components/`.
- User feedback via `toast` from `sonner`.
- Client components need `'use client'`.
- Import shared types from `@/modules/{feature}/types` — don't redefine them in the UI.
