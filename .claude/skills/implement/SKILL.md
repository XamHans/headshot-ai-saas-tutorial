---
name: implement
description: Drive the current project's active plan one SLICE at a time. Reads a per-project pointer (.claude/implement.md) naming the active plan + its STATUS.md, renders a visual board, branches per slice, spawns a routed TDD subagent (model + effort from the slice's frontmatter), verifies, merges the finished slice into the plan's feature branch, updates STATUS, and suggests /compact before the next slice. The skill is global; all state is per-project, so running /implement in two repos at once never conflicts. Use when the user types /implement (optionally /implement <plan-name> to switch tracks).
---

# /implement — per-project plan driver (one slice per run)

`/implement` advances the current project's active plan by **exactly one slice**, then stops. The skill
itself is global and read-only at runtime; **all mutable state lives inside the current project** (its
`.claude/implement.md` pointer, its `STATUS.md`, and its git branches). So running `/implement` in two
repos in parallel never conflicts — each session only reads and writes under its own project root.

Each slice runs on its own git branch and is implemented by a **TDD subagent routed by the slice's
`model`/`effort` frontmatter** (see `prd-to-slices`). The orchestrator (this skill, in the main loop)
stays the dispatcher, verifier, and committer; the subagent does the red→green→refactor.

## 0 · Locate the project pointer

- Project root = `git rev-parse --show-toplevel` (fallback: current working directory).
- Read `<root>/.claude/implement.md` — the per-project pointer. Its `active:` field names the current
  plan; its **Plans** table maps each name → its `STATUS.md` (and slices folder).
- **No pointer file?** → jump to *Bootstrap (no pointer yet)* at the bottom.
- If the user's message names a plan in the table (e.g. `/implement learning-injection`), rewrite the
  single `active:` line to that name before continuing.
- Open the active plan's `STATUS.md`. **This is the source of truth — never drive from memory or the
  conversation summary.** Load any project rules under `<root>/.claude/rules/` (e.g. a TDD rule or a
  workflow rule for the surface you're touching).

## 1 · Render the board (always, first)

Print a compact board inside a code fence so the user sees the plan at a glance:

```
━━ /implement · <plan name> ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  <one-line goal from STATUS.md>

  <NN> ✅ <done slice>            (sonnet/low)
  <NN> 👉 <next slice>            (opus/high)     ← NEXT
  <NN> ☐  <todo slice>           (opus/medium)

  ▸ next: <NN> — <title> · routed <model>/<effort> · <its verify>
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
```

- List slices in numeric (execution) order with their real markers and routing.
- **Next slice** = the first incomplete (`☐`/unchecked) slice in `STATUS.md`. Respect `Blocked by`: if
  the next slice's blockers aren't all `✅`, say so and stop.

## 2 · Set up the slice branch (git)

- **Safety first.** Run `git status --porcelain`. If the tree has uncommitted changes unrelated to this
  plan, **stop and ask** — do not switch branches over a dirty tree.
- **Plan feature branch** = `feature/<plan-name>`. If it doesn't exist, create it off the current HEAD
  (the branch you're on now becomes the base). Then `git checkout feature/<plan-name>`.
- If the feature branch has an upstream remote, `git pull --ff-only` it. If there's no remote/upstream,
  skip the pull silently.
- **Slice branch** = `slice/<NN>-<slug>` (from the slice filename). Create and check it out **off the
  feature branch**: `git checkout -b slice/<NN>-<slug>`.

## 3 · Drive exactly one slice via a routed TDD subagent

- Read the NEXT slice file (`slices/<NN>-<slug>.md`) including its **routing frontmatter** (`model`,
  `effort`).
- **Pick the subagent by `effort`:** `low` → `tdd-low`, `medium` → `tdd-medium`,
  `high`/`xhigh`/`max` → `tdd-high`. If frontmatter is missing, default to `tdd-medium`.
- **Spawn it via the Agent tool**, passing the slice's `model` (alias `opus`/`sonnet`/`haiku`) as the
  `model` parameter (omit to let it inherit if no frontmatter model). The prompt must contain:
  - the slice's **What to build** and **all its acceptance criteria** (the verification contract),
  - the project's **verify command(s)** for this surface,
  - the red-first TDD contract (one test → one impl, vertical, no horizontal slicing),
  - any applicable project rules under `<root>/.claude/rules/` (or tell it to read them),
  - the hard constraints: **do not run git, do not commit/branch, do not edit STATUS/plan docs; return
    a structured report.**
- **No slice frontmatter at all** (e.g. a hand-written plan) → fall back to the red-first TDD loop in
  the main loop yourself, on the slice branch.

## 4 · Verify (the orchestrator owns the gate)

- **Re-run the slice's verify command(s) yourself.** The subagent's report is a claim, not proof —
  trust but verify.
- If anything fails (or a verify can't run, e.g. a missing env var), say so plainly, **do not merge or
  mark the slice done**, stay on the slice branch, and stop. Never imply an unrun check passed.

## 5 · Commit, merge, push

- Stage **only the files changed for this slice** (tests, impl). Never `git add -A`; never stage or
  revert the project's unrelated dirty files. Commit on the slice branch with a message tracing to the
  slice.
- Update `STATUS.md` (flip the slice to `✅`, advance the NEXT marker) and tick the slice file's
  acceptance-criteria boxes. Commit that on the slice branch too. Keep it honest — only mark done if
  verify actually passed in §4.
- **Merge the slice branch into the feature branch**: `git checkout feature/<plan-name>` then
  `git merge --no-ff slice/<NN>-<slug>` (a visible merge commit per slice).
- If a remote exists, `git push` the feature branch (and optionally the slice branch). **Never
  force-push. Never push or merge into `main`/`master`/the base branch** — promoting the feature branch
  to main is a separate, human-initiated step.
- Optionally delete the now-merged local slice branch (`git branch -d slice/<NN>-<slug>`).
- **Refresh the dashboard, if present.** If `docs/plans/<plan-name>/planstatus.html` exists, regenerate
  `planstatus.json` + `planstatus.data.js` per the `/planstatus` data schema (slice now `done`, its
  `did` summary from this slice's commits) so a served board updates live. Do not rebuild the HTML.

## 6 · Stop, report, suggest a context reset

- Re-print the board (the slice now `✅`) and one line:
  `<NN> done & merged into feature/<plan-name>. Next: <NN> — <title>.`
- Then suggest a clean break before the next slice:
  `Run /compact (or /new) to clear context, then /implement for the next slice.`
- Stop — **one slice per invocation.**

## Bootstrap (no pointer yet)

If `<root>/.claude/implement.md` is missing, this project hasn't been wired for the slice driver:
- If the user pointed at a PRD / issue / plan / STATUS doc, implement that one piece via the red-first
  TDD loop in §3 (main loop), on a `feature/<plan-name>` branch, then commit (classic implement
  behavior). Re-running `prd-to-slices` first is the better path if the work is more than one slice.
- Then offer to create `<root>/.claude/implement.md` so future `/implement` is automatic — an `active:`
  field plus a **Plans** table mapping plan name → its `STATUS.md` → slices folder. Ask which plan to
  track only if it isn't obvious from the repo.

## Guardrails

- Only read/write files under the current project root. Never write outside it; the global skill file
  is read-only at runtime.
- **Git discipline:** only ever create/switch/merge the plan's own branches (`feature/<plan-name>`,
  `slice/<NN>-<slug>`). Never touch `main`/`master`/the base except as the branch-off point; never
  force-push; push only when a remote is configured. Never switch branches over a dirty unrelated tree —
  stop and ask. Preserve unrelated working-tree changes.
- **Honest verification:** the subagent's report is not proof — re-run the verify yourself (§4) before
  marking anything done.
- If the next slice needs a product decision its acceptance criteria don't answer, ask one question
  instead of guessing.
- One slice per invocation, then stop and suggest a context reset.
