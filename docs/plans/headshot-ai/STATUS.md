# headshot-ai — status

One photo in, 3 professional headshots out in ~10s. See them free (watermarked), unlock full-res for $5.

Plan: `docs/plans/headshot-ai/plan.md` · Slices: `docs/plans/headshot-ai/slices/`

Dependency shape: `01 → 02 → 03 → {04, 05, 07}`, then `05 → 06`. After 03, tracks 04 / 05(→06) / 07 run in parallel.

- [x] 01 — Verified-email onboarding + biometric-consent gate   (opus/medium)
- [x] 02 — Upload one photo + pre-flight face gate + R2 store + job creation   (opus/high)
- [ ] 03 — Style pick + synchronous generation + watermarked previews   (opus/high)   👈 NEXT
- [ ] 04 — Abuse controls: 1-free-generation cap + IP/device rate limit   (opus/medium)
- [ ] 05 — $5 unlock via Stripe + webhook markUnlocked + full-res signed-URL delivery   (opus/medium)
- [ ] 06 — Email delivery of results link   (sonnet/low)
- [ ] 07 — Retention: 30-day cleanup job + "delete my data"   (opus/medium)

Mark a slice `[x]` only once `/implement` has fully completed and merged it. The first `[ ]` slice is NEXT.
