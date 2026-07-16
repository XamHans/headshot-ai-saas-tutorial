# headshot-ai — status

One photo in, 3 professional headshots out in ~10s. See them free (watermarked), unlock full-res for $5.

Plan: `docs/plans/headshot-ai/plan.md` · Slices: `docs/plans/headshot-ai/slices/`

Dependency shape: `01 → 02 → 03 → {04, 05, 07}`, then `05 → 06`. After 03, tracks 04 / 05(→06) / 07 run in parallel.

- [x] 01 — Verified-email onboarding + biometric-consent gate   (opus/medium)
- [x] 02 — Upload one photo + pre-flight face gate + R2 store + job creation   (opus/high)
- [x] 03 — Style pick + synchronous generation + watermarked previews   (opus/high)
- [x] 04 — Abuse controls: 1-free-generation cap + IP/device rate limit   (opus/medium)
- [x] 05 — $5 unlock via Stripe + webhook markUnlocked + full-res signed-URL delivery   (opus/medium)
- [ ] 06 — Email delivery of results link   (sonnet/low)   👈 NEXT
- [ ] 07 — Retention: 30-day cleanup job + "delete my data"   (opus/medium)

Mark a slice `[x]` only once `/implement` has fully completed and merged it. The first `[ ]` slice among
01–07 is NEXT. **The core plan is complete once 01–07 are all `[x]` — slice 08 below is optional.**

## Optional / post-enhancement (not required for core plan completion)

Not part of the required 01–07 sequence — build only if/when explicitly requested. `/implement` should
not auto-pick this as NEXT; drive it with `/implement headshot-ai` only once named explicitly, or treat it
as a standalone follow-up after the core plan ships.

- [ ] 08 — Guided paywall UX when the free-generation limit is reached   (opus/medium)   *(optional — blocked by 04, 05)*
