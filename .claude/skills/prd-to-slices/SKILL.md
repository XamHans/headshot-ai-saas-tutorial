---
name: prd-to-slices
description: Break a plan, spec, or PRD into tracer-bullet vertical slices, each with a verification contract, written as files into the plan's own folder (plan + slices co-located).
disable-model-invocation: true
---

# PRD → Slices

Break a plan into independently-grabbable **vertical slices** (tracer bullets), each carrying its own
**verification contract**. The plan and its slices live together in **one folder** so the design and its
sliced milestones travel as a unit.

## Folder layout

The plan and its slices are co-located in a single folder. Default location: `docs/plans/<plan-name>/`.

```
docs/plans/<plan-name>/
  plan.md            # the source plan / PRD / concept (move or copy it here if it lives elsewhere)
  slices/
    01-<slug>.md     # one file per slice; numeric prefix = dependency/execution order
    02-<slug>.md
    ...
```

- The **plan** is the design ref (the "how" + rationale). Never rewrite it from this skill.
- Each **slice file** is a thin end-to-end milestone with its verification contract (see template).
- If the plan already exists as a doc (e.g. `docs/SOMETHING-CONCEPT.md`), create the plan folder and
  move or copy that doc in as `plan.md`, leaving the original path referenced.

## Process

### 1. Gather context

Work from whatever is already in the conversation context. If the user passes a plan reference (a path,
or an issue number/URL), read its full body first.

### 2. Explore the codebase (optional)

If you have not already explored the codebase, do so to understand the current state. Slice titles and
descriptions should use the project's domain glossary vocabulary, and respect ADRs in the area you're touching.

Look for opportunities to prefactor the code to make the implementation easier. "Make the change easy, then make the easy change."

### 3. Draft vertical slices

Break the plan into **tracer bullet** slices. Each slice is a thin vertical slice that cuts through ALL
integration layers end-to-end, NOT a horizontal slice of one layer.

<vertical-slice-rules>

- Each slice delivers a narrow but COMPLETE path through every layer (schema, API, UI, tests)
- A completed slice is demoable or verifiable on its own
- Any prefactoring should be done first

</vertical-slice-rules>

For each slice, also assign a **routing** — the `model` + `effort` that `/implement` will spawn its TDD
subagent with. These are **two independent dials**:

<routing-rubric>

**`model`** picks the capability class:

- **`opus`** — demanding work: novel or cross-cutting architecture, ambiguous/underspecified behavior,
  concurrency / data migration / security-sensitive, many seams, or algorithmically tricky.
- **`sonnet`** — standard work: established patterns, localized change, well-specified behavior.
- **`haiku`** — trivial mechanical work (config, copy, pure glue). Optional; use sparingly.

**`effort`** picks the reasoning depth *within* that model:

- **`low`** — mechanical; the path is well-trodden.
- **`medium`** — demanding, but within reach; reason about the key edge cases.
- **`high`** — very hard / lots of unknowns; explore the design space before the first test.
- (`xhigh` / `max` exist for the gnarliest slices if a model supports them.)

So the two dials combine freely — e.g. `opus/medium` for a demanding slice, `opus/high` for a really
hard one; likewise `sonnet/medium` vs `sonnet/high`. When unsure, round **up** on both dials — the cost
of under-powering a tricky slice beats the cost of a slightly over-powered easy one. Give each slice a
one-line `why`.

</routing-rubric>

### 4. Quiz the user

Present the proposed breakdown as a numbered list. For each slice, show:

- **Title**: short descriptive name
- **Routing**: the proposed `model/effort` — e.g. `opus/high`, `opus/medium`, `sonnet/medium`,
  `sonnet/low` — plus a one-line `why`
- **Blocked by**: which other slices (if any) must complete first
- **User stories covered**: which user stories this addresses (if the source material has them)

Ask the user:

- Does the granularity feel right? (too coarse / too fine)
- Are the dependency relationships correct?
- Should any slices be merged or split further?
- Is the routing right for each slice? (adjust either dial — `model` up/down, `effort` up/down)

Iterate until the user approves the breakdown.

### 5. Write the slices into the plan folder

Ensure the plan folder exists (`docs/plans/<plan-name>/`) with the plan as `plan.md`. Write each approved
slice as its own file under `slices/`, numbered in dependency order (blockers first) so the numeric prefix
encodes execution order and the "Blocked by" field can reference real slice filenames.

Each slice file opens with the **routing frontmatter** (`model` / `effort` / `why`) from the approved tier
in step 4. This is what `/implement` reads to choose which TDD subagent (and model) to spawn for the slice.

Also write a **`STATUS.md`** in the plan folder — the progress board `/implement` drives from. List every
slice in execution order with a status marker, and point at the next one:

```
# <plan-name> — status

<one-line goal from the plan>

- [ ] 01 — <title>   (sonnet/low)     👈 NEXT
- [ ] 02 — <title>   (opus/high)
- [ ] 03 — <title>   (opus/medium)
```

Mark a slice `[x]` only once `/implement` has fully completed and merged it. The first `[ ]` slice is NEXT.

Use this template per slice file. The **`## Acceptance criteria`** section IS the verification contract —
it defines "done = verified" for that slice.

<slice-template>
---
model: opus            # opus | sonnet | haiku  (alias — drives /implement's TDD subagent)
effort: high           # low | medium | high | xhigh | max
why: <one line — why this tier (the routing rationale from step 4)>
---
# <NN> — <Title>

## What to build

A concise description of this vertical slice. Describe the end-to-end behavior, not layer-by-layer implementation.

Avoid specific file paths or code snippets — they go stale fast. Exception: if a prototype produced a snippet that encodes a decision more precisely than prose can (state machine, reducer, schema, type shape), inline it here and note briefly that it came from a prototype. Trim to the decision-rich parts — not a working demo, just the important bits.

## Acceptance criteria (verification contract)

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Blocked by

- The blocking slice file (e.g. `01-<slug>.md`)

Or "None - can start immediately" if no blockers.

</slice-template>

Do NOT rewrite or mutate `plan.md` — it is the design ref.

### 6. Ask whether `/implement` should be adapted

`/implement` is what actually drives a plan **one slice at a time** — it reads the per-project
`.claude/implement.md` pointer (active plan → its `STATUS.md`), branches per slice, spawns a TDD subagent
with the slice's routing (`model`/`effort`), merges the finished slice, and ticks `STATUS.md`. This skill
just produced a new plan folder with routed slices and a `STATUS.md`, so the pointer may need to know about it.

End by asking the user:

> Should I also wire `/implement` (the `.claude/implement.md` pointer) to drive these slices —
> i.e. register this plan, point it at `docs/plans/<plan-name>/STATUS.md`, and use the `slices/` files
> (in numeric order, with their routing frontmatter) as the slice sequence?

Do not modify `.claude/implement.md` unless the user says yes.
