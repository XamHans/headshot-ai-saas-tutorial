---
model: opus            # opus | sonnet | haiku
effort: medium         # low | medium | high | xhigh | max
why: Enforced in-service before any Gemini call; the fingerprint library is an open question and the cap/rate-limit logic is abuse- and concurrency-sensitive (must not be racy or bypassable).
---
# 04 — Abuse controls: 3-free-generation cap + IP/device rate limit

**TL;DR — Goal:** Enforce a per-account free-generation cap (`FREE_GENERATION_LIMIT`, currently 3) plus
IP/device rate limiting, all checked before any Gemini call. **Unlocks:** the free tier can be opened to
real users without runaway Gemini cost — repeat or abusive generation attempts are blocked before a
single dollar is spent.

> Source plan: `docs/plans/headshot-ai/plan.md` (§4-#6, §6-abuse, §12). Original PRD: `docs/planning/headshot-ai-prd.md`.
> Note: the plan/PRD prose still says "one free generation" — the cap was raised to 3 post-launch (see
> `modules/headshot/services/headshot.service.ts`'s `FREE_GENERATION_LIMIT`); this slice doc reflects the
> current behaviour.

## What to build

The layered defense that protects the Gemini budget, enforced **before** any model call. Builds on the
working generation from slice 03.

End-to-end behaviour:

- **Up to `FREE_GENERATION_LIMIT` (3) free 3-image generations per verified account, ever.** Each of a
  user's first `FREE_GENERATION_LIMIT` new (`pending`) jobs generates for free; once the cap is reached,
  any further generation attempt is blocked and routed to payment (`requires payment`), **before** any
  Gemini spend. The single **free regenerate** of a set (from the plan's failure handling) is honoured
  separately via `freeRegenUsed` (per job) and does not count against the per-account cap.
- **IP + device-fingerprint rate limit** at the route boundary: too many generation attempts from the same
  IP/fingerprint in a window are throttled with a friendly "try again later", before spend.
- All checks run in the service/route **before** the image-to-image calls, so a blocked request incurs
  **zero Gemini cost**.

## Prerequisites

- [x] **Device-fingerprint capability** — the per-device half of the rate limit.
  - Required input: a fingerprinting approach. *Default:* a standard client fingerprint library (e.g.
    FingerprintJS open-source) producing a stable visitor id sent with the generation request, combined
    with server-side IP. Override to a different library/service if preferred. No paid account required for
    the default.
  - Verify present: two requests from the same browser carry the same fingerprint; the rate limiter reads
    both IP and fingerprint.
- [x] **Rate-limit store** — where counters live.
  - Required input: a store for rate-limit counters. *Default:* reuse the app's existing datastore (DB) or
    an in-process/edge counter; no new external service. Override to Redis/Upstash if higher throughput is
    needed later.
  - Verify present: repeated attempts increment a counter that resets after the window.

## Verification contract (behaviour, in Gherkin)

- [x] **Scenario: first generation is free**
  ```gherkin
  Given a verified, consented user who has never generated before
  When they generate a set of headshots
  Then generation proceeds without any payment
  And one of their free allowance is now consumed
  ```

- [x] **Scenario: the 2nd and 3rd generations (new jobs) are also free**
  ```gherkin
  Given a user who has consumed fewer than FREE_GENERATION_LIMIT free generations
  When they generate another new set
  Then generation proceeds without any payment
  And their free-generation count increments by one
  ```

- [x] **Scenario: a further generation requires payment once the cap is exhausted**
  ```gherkin
  Given a user who has already used all FREE_GENERATION_LIMIT free generations
  When they attempt to generate a new set
  Then they are told their free generations are used and are routed to payment
  And no new images are generated
  And nothing is sent to the image model
  ```

- [x] **Scenario: free regenerate of a failed/poor set does not count as a new free generation**
  ```gherkin
  Given a user whose first generation produced a set and who has not used their free regenerate
  When they trigger the one free regenerate of that set
  Then a fresh set is generated without payment
  And the free regenerate is now marked used
  And a subsequent brand-new generation still requires payment
  ```

- [x] **Scenario: rapid repeated attempts are rate-limited before spend**
  ```gherkin
  Given many generation attempts from the same IP and device in a short window
  When the attempts exceed the limit
  Then further attempts are throttled with a friendly try-again-later message
  And no image-model calls are made for the throttled attempts
  ```

## Implementation notes (TDD)

1. Red-first on the **cap** as a service unit test: mock the Gemini boundary, assert that a generation
   attempt once the cap (`FREE_GENERATION_LIMIT`) is exhausted makes **zero** model calls and returns a
   `requires-payment` result. Guard against races (a user firing concurrent generations) — enforce the cap
   with a single atomic conditional UPDATE (`count = count + 1 WHERE count < limit`, race-safe under
   Postgres row locking), not a read-then-write gap.
2. Distinguish the two allowances: **free generation** (per account, up to `FREE_GENERATION_LIMIT`, via a
   counter column) vs **free regenerate** (`freeRegenUsed` per job, once) — they are separate counters.
   Pin both in tests.
3. Add the **rate limiter** at the route boundary (before delegating to the service): key on `IP +
   fingerprint`, sliding/fixed window, friendly 429-style `Result` error. Fingerprint arrives from the
   client hook; IP from the request.
4. Keep every check **before** the model call. Invariant tests: **blocked/throttled requests produce no
   image-model calls and no new `headshot_images` rows**.

## Blocked by

- `03-style-generate-watermark-preview.md`
