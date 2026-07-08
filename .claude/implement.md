# /implement — active plan pointer

**Active plan:** headshot-ai
**Status board:** `docs/plans/headshot-ai/STATUS.md`
**Plan / design ref:** `docs/plans/headshot-ai/plan.md`
**Slices:** `docs/plans/headshot-ai/slices/` (numeric order = execution order; routing in each file's frontmatter)

`/implement` drives one slice at a time: read the first unchecked slice in `STATUS.md`, check its
`## Prerequisites` gate (stop and ask if any required input is missing), branch, spawn a TDD subagent
using the slice's `model`/`effort` frontmatter, verify against the slice's `## Verification contract`
(Gherkin scenarios → Playwright tests), merge, then tick `STATUS.md`.

Each slice ends in a manual click-through UI test — confirm it before marking `[x]`.
