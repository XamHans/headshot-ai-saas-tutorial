# Deployment-Checkliste: Headshot AI → Vercel / Neon / Stripe / Resend

Stand: 2026-07-16. Bezieht sich auf `fullstack-ai-starter`, Feature-Plan `docs/plans/headshot-ai/`.

**Legende:** `[!]` Blocker (muss vor Go-Live erledigt sein) · `[ ]` normale Aufgabe · `[opt]` optional / kann nach Launch nachgezogen werden.

**Slice-Stand laut `docs/plans/headshot-ai/STATUS.md`:** 01–05 fertig, **06 (E-Mail-Zustellung) und 07 (30-Tage-Löschjob) offen**. Slice 07 ist wegen biometrischer Daten (Gesichtsfotos) datenschutzrechtlich relevant — siehe Abschnitt 7.

---

## 0. Code-Blocker (vor jedem Deploy fixen)

- [!] `package.json` → `db:migrate` zeigt auf `lib/db/scripts/migrate.ts`, die Datei **existiert nicht** (nur `scripts/verify-db.ts` und `scripts/verify-r2.ts` sind vorhanden). Skript entweder nachbauen oder Zeile ersetzen durch:
  ```json
  "db:migrate": "drizzle-kit migrate"
  ```
- [!] `db:seed` zeigt ebenfalls auf eine nicht existierende Datei (`lib/db/scripts/seed.ts`). Falls kein Seed benötigt wird, Skript entfernen; sonst nachbauen.
- [ ] `next.config.mjs`: `images.remotePatterns` enthält nur `api.microlink.io`. Falls Preview-/Vollbilder per `next/image` von der R2/Cloudflare-Domain geladen werden, die Domain hier ergänzen — sonst wirft `next/image` in Prod einen Fehler.
- [ ] Kein `vercel.json` vorhanden → falls Slice 07 den Cleanup-Cron braucht, muss diese Datei vor Aktivierung des Jobs angelegt werden (Vorlage siehe Abschnitt 7).

---

## 1. Neon (Datenbank)

- [!] Neon-Projekt anlegen (oder Vercel-Marketplace-Integration „Neon" nutzen, die `DATABASE_URL` automatisch pro Environment setzt)
- [!] **Pooled** Connection String (Endpoint mit `-pooler`) für `DATABASE_URL` verwenden, nicht den direkten — Next.js/Serverless-Functions brauchen Connection Pooling, sonst laufen euch bei Traffic die Connections voll
- [ ] `sslmode=require` im Connection String bestätigen (steht schon so in `.env.example`)
- [opt] Separate Neon-Branches pro Environment: `main` (Prod), `preview` (für Vercel-Preview-Deployments), `dev` (lokal). Die Vercel-Neon-Integration kann automatisch einen Neon-Branch pro Preview-Deployment erzeugen — spart manuelles Anlegen
- [!] Migrationsstand vor Go-Live: 6 Migrationsdateien in `lib/db/migrations/`, chronologisch:
  1. `0000_stormy_dark_beast.sql` — initiales Schema (User/Session/Posts etc.)
  2. `0001_add_payments_tables.sql` — `payments`, `webhookEvents`
  3. `0002_add_biometric_consent.sql` — `biometricConsentAt`-Spalte (Slice 01)
  4. `0003_add_headshot_tables.sql` — `headshotJobs`, `headshotImages` (Slice 02/03)
  5. `0004_add_abuse_controls.sql` — `headshotRateLimits`, `headshotFreeGenerationUsedAt` (Slice 04)
  6. `0005_raise_free_generation_cap.sql` — Gratis-Limit auf 3 Generierungen angehoben (neueste)
  Gegen die **Prod-DB einmalig manuell ausführen**, bevor der erste Vercel-Prod-Deploy live geschaltet wird:
  ```bash
  DATABASE_URL="<prod-url>" pnpm exec drizzle-kit migrate
  ```
- [!] Migrations-Workflow für die Zukunft festlegen: entweder (a) Migrationen manuell vor jedem Release gegen Prod ausführen, oder (b) als Vercel Build-Step / GitHub-Actions-Schritt automatisieren. **Nicht** `db:push` für Prod verwenden — das schreibt das Schema direkt ohne Versionshistorie und kann bei Abweichungen Daten verlieren; `db:push` ist nur für lokale Iteration gedacht
- [opt] Backups/Point-in-Time-Recovery in Neon aktivieren (abhängig vom gebuchten Plan)
- [opt] Connection-Limit/Autoscaling-Compute-Größe für Prod im Neon-Dashboard prüfen, falls mit nennenswertem Traffic gerechnet wird

---

## 2. Stripe

- [!] Von Test-Mode- auf Live-Mode-Keys wechseln
- [!] Live-Webhook-Endpoint im Stripe-Dashboard (`dashboard.stripe.com/webhooks`) anlegen:
  - URL: `https://<prod-domain>/api/payments/webhook`
  - Events: `checkout.session.completed`, `payment_intent.succeeded`, `payment_intent.payment_failed`
  - Erzeugtes `whsec_...`-Secret in Vercel Prod-Env als `STRIPE_WEBHOOK_SECRET` eintragen (**nicht** das lokale `stripe listen`-Secret weiterverwenden)
- [!] Sicherstellen, dass die Webhook-Route (`app/api/payments/webhook/route.ts`) auf **Node.js-Runtime** läuft, nicht Edge — die Signaturprüfung braucht den rohen Body und `crypto`, was auf Edge nicht zuverlässig funktioniert
- [ ] Testkauf im Live-Mode mit einer echten (kleinen) Zahlung durchführen und verifizieren, dass `markUnlocked` triggert und die Vollauflösungsbilder freigeschaltet werden
- [opt] `price_data` (aktuell inline im Code, kein festes Stripe-Product) auf ein im Dashboard verwaltetes Product/Price umstellen — nur nötig, falls sauberes Umsatz-Reporting/Rechnungsstellung über Stripe-Produkte gewünscht ist
- [opt] Stripe Tax aktivieren, falls Umsatzsteuer/VAT für Endkunden abgeführt werden muss
- [opt] Radar-Regeln/Fraud-Schutz-Einstellungen für den Live-Mode prüfen

---

## 3. Resend (E-Mail)

- [!] Absender-Domain in Resend hinzufügen und verifizieren (SPF, DKIM, ggf. DMARC als DNS-Records beim Domain-Provider setzen)
- [!] `RESEND_API_KEY` (Live-Key) und `RESEND_FROM_EMAIL` (verifizierte Domain, z.B. `noreply@eure-domain.de`) in Vercel Prod-Env setzen
- [!] **Slice 06 (E-Mail-Zustellung des Ergebnislinks) fertigstellen**, bevor das Produkt live geht — sonst bekommt der Kunde nach Kauf keine E-Mail mit dem Link zum Vollauflösungs-Ergebnis
- [opt] Domain-Reputation/Deliverability-Warmup beachten, falls größeres Sendevolumen ab Tag 1 erwartet wird

---

## 4. Google Gemini (Bildgenerierung)

- [!] Google-Cloud-Billing für das Projekt/den API-Key aktivieren — ohne Billing gibt es laut Slice-03-Notiz **0 Freikontingent** für Bildgenerierung, der Live-Betrieb würde sofort mit Fehlern brechen
- [!] Produktions-`GOOGLE_GENERATIVE_AI_API_KEY` von einem separaten Dev-Key trennen
- [opt] Kostenlimit/Budget-Alert im Google Cloud Billing einrichten (Bildgenerierung kann bei Missbrauch schnell teuer werden — ergänzt die Abuse-Controls aus Slice 04)
- [opt] `OPENAI_API_KEY` nur setzen, falls der Chat-/Playground-Bereich des Starters in Prod überhaupt aktiv bleiben soll

---

## 5. Cloudflare R2 (Storage)

- [!] Produktions-Bucket getrennt vom Dev/Test-Bucket anlegen
- [!] Bucket **privat** halten (kein Public-Read) — Vollauflösungsbilder dürfen laut Slice-05-Sicherheitsinvariante ausschließlich über kurzlebige signierte URLs ausgeliefert werden
- [!] R2-API-Token mit **minimalen Rechten** (nur Lese-/Schreibzugriff auf den einen Prod-Bucket) erstellen unter `dash.cloudflare.com → R2 → Manage R2 API Tokens`
- [ ] `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME` in Vercel Prod-Env setzen
- [opt] CORS-Konfiguration am Bucket prüfen, falls Uploads direkt vom Browser per Presigned-URL laufen (nicht über eine Server-Route proxied)
- [opt] Lifecycle-Regel im R2-Bucket erwägen als zusätzliches Sicherheitsnetz zu Slice 07 (z.B. Objekte automatisch nach 60 Tagen löschen, falls der App-seitige Job mal ausfällt)

---

## 6. Vercel (Hosting/Deploy)

- [!] Projekt aus dem Git-Repo importieren, Framework-Preset „Next.js"
- [!] Environment-Variablen **getrennt für Production und Preview** pflegen (siehe Tabelle unten) — Preview sollte Stripe-Test-Keys und eine separate Neon-Branch nutzen, damit Preview-Deployments nicht gegen Live-Daten laufen
- [!] `NEXT_PUBLIC_APP_URL` auf die finale Produktionsdomain setzen (wird für Stripe-Success-/Cancel-Redirects verwendet)
- [!] `BETTER_AUTH_URL` exakt auf `https://<prod-domain>` setzen. **Fehlt aktuell in `.env.example`**, wird aber von Better Auth für Magic-Link-Redirects benötigt — laut `CLAUDE.md:53` führt ein falscher Wert zu „connection refused" beim Klick auf den Magic-Link
- [ ] Custom Domain verbinden, SSL-Zertifikat prüfen (Vercel macht das automatisch, kurz verifizieren)
- [ ] Google OAuth Redirect-URI in der Google Cloud Console um die Prod-Domain erweitern (`https://<prod-domain>/api/auth/callback/google` o.ä., je nach Better-Auth-Routing)
- [opt] `vercel.json` mit Cron-Job anlegen, sobald Slice 07 steht:
  ```json
  {
    "crons": [
      { "path": "/api/headshots/cleanup", "schedule": "0 3 * * *" }
    ]
  }
  ```
  Zugehörig: `CRON_SECRET` als Env-Var setzen und den Cleanup-Endpoint damit absichern (Vercel Cron sendet den Wert als `Authorization: Bearer <CRON_SECRET>`-Header)

---

## 7. Datenschutz / Retention (Slice 07 — noch offen)

- [!] Slice 07 implementieren, bevor echte Nutzerfotos in Prod verarbeitet werden: automatische Löschung nicht gekaufter Jobs nach 30 Tagen (DB-Einträge **und** R2-Objekte), plus „Delete my data"-Funktion für Nutzer
- [!] Bis Slice 07 fertig ist: keine echten (nicht-synthetischen) Testfotos in der Prod-Umgebung verarbeiten, da sonst unbegrenzt biometrische Daten ohne Löschmechanismus gespeichert werden (DSGVO Art. 9 / ggf. BIPA-relevant)
- [opt] Datenschutzerklärung/Consent-Text (Slice 01 hat schon ein Consent-Gate) juristisch gegenprüfen lassen, falls das Produkt öffentlich vermarktet wird

---

## 8. Sicherheit / Abuse

- [ ] `BETTER_AUTH_SECRET` für Prod **neu generieren** (≥32 Zeichen, zufällig) — nicht den Dev-Wert wiederverwenden
- [opt] Rate-Limiting läuft aktuell rein über die DB-Tabelle `headshot_rate_limits` (kein Upstash/Redis aktiv, obwohl `@upstash/redis` als Dependency vorhanden ist). Für den Start ausreichend; bei höherem Traffic auf Redis umstellen
- [opt] Zusätzlichen Bot-Schutz (z.B. Vercel Firewall, Cloudflare Turnstile) vor dem Gratis-Upload-Endpunkt erwägen, da die 3 kostenlosen Generierungen pro Nutzer leicht durch Mehrfach-Accounts umgangen werden können

---

## 9. CI / Tests (kein GitHub-Actions-Workflow vorhanden)

- [opt] Minimal-Pipeline einrichten, die vor jedem Merge/Deploy läuft: `pnpm typecheck && pnpm lint:biome && pnpm test && pnpm build` (Vercel selbst führt bei Deploy nur `next build` aus, keine Tests)
- [opt] E2E-Suite (`pnpm test:e2e`) einmal manuell gegen eine Staging-URL mit Stripe-Test-Keys laufen lassen, bevor auf Live-Keys umgeschaltet wird — Playwright startet dafür lokal die Stripe CLI (`stripe listen`), das läuft nicht automatisch in Vercel

---

## 10. Observability / Analytics — optional, kann nach Launch nachgezogen werden

- [opt] Langfuse (`LANGFUSE_SECRET_KEY`, `LANGFUSE_PUBLIC_KEY`, `LANGFUSE_BASEURL`) für Prod einrichten, um Gemini-Kosten und -Traces zu überwachen
- [opt] Umami (`NEXT_PUBLIC_UMAMI_WEBSITE_ID`, `NEXT_PUBLIC_UMAMI_URL`) für die Prod-Domain konfigurieren
- [opt] Log-Level für Prod auf `info` oder `warn` setzen (`LOG_LEVEL`), `debug` erzeugt unnötig viel Output
- [opt] Alerting für fehlgeschlagene Stripe-Webhooks/`payment_intent.payment_failed` einrichten

---

## Env-Var-Referenz: was wo pflegen

**Quelle der Wahrheit für alle bekannten Variablen:** `.env.example` im Repo-Root (bis auf `BETTER_AUTH_URL` und `CRON_SECRET`, die dort fehlen, siehe Anmerkungen).

Pflege-Ort:
- **Lokal:** `.env.local` (nicht committen, ist bereits in `.env`/`.env.local` vorhanden)
- **Vercel:** Project Settings → Environment Variables, jeweils mit Scope `Production` / `Preview` / `Development` einzeln setzen

| Variable | Pflicht? | Production-Wert kommt von | Preview/Dev-Wert |
|---|---|---|---|
| `DATABASE_URL` | ✅ | Neon Prod-Branch, pooled Endpoint | Neon Preview-/Dev-Branch |
| `YOUR_NEON_API_KEY` | optional (nur MCP-Tooling) | Neon Account Settings | gleich wie Dev |
| `OPENAI_API_KEY` | nur falls Chat-Playground live bleibt | platform.openai.com | eigener Dev-Key |
| `GOOGLE_GENERATIVE_AI_API_KEY` | ✅ | Google AI Studio / Cloud Console, **mit aktivem Billing** | eigener Dev-Key, kleines Kontingent |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` | ✅ (falls Google-Login aktiv) | Google Cloud Console → OAuth Client | eigener Dev-Client mit `localhost`-Redirect |
| `BETTER_AUTH_SECRET` | ✅ | neu generieren, 32+ Zeichen | eigener Dev-Wert |
| `BETTER_AUTH_URL` | ✅ (fehlt in `.env.example`!) | `https://<prod-domain>` | `http://localhost:3000` |
| `RESEND_API_KEY` | ✅ | resend.com Dashboard, Live-Key | Test-/Sandbox-Key |
| `RESEND_FROM_EMAIL` | ✅ | verifizierte Prod-Domain | z.B. `onboarding@resend.dev` für Tests |
| `STRIPE_SECRET_KEY` | ✅ | Stripe Dashboard, Live-Mode | Test-Mode-Key |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | ✅ | Stripe Dashboard, Live-Mode | Test-Mode-Key |
| `STRIPE_WEBHOOK_SECRET` | ✅ | Live-Webhook-Endpoint im Dashboard | `stripe listen --print-secret` lokal |
| `NEXT_PUBLIC_APP_URL` | ✅ | `https://<prod-domain>` | Vercel-Preview-URL bzw. `http://localhost:3000` |
| `R2_ACCOUNT_ID` / `R2_ACCESS_KEY_ID` / `R2_SECRET_ACCESS_KEY` / `R2_BUCKET_NAME` | ✅ | Cloudflare Dashboard, Prod-Bucket-Token | eigener Dev-Bucket |
| `CRON_SECRET` | ✅ sobald Slice 07 aktiv | selbst generieren, in Vercel + Cron-Header nutzen | eigener Dev-Wert |
| `LANGFUSE_*` | optional | cloud.langfuse.com | optional, kann leer bleiben |
| `NEXT_PUBLIC_UMAMI_*` | optional | umami.is Dashboard | optional, kann leer bleiben |
| `LOG_LEVEL` | optional | `info`/`warn` für Prod | `debug` für Dev |
| `NODE_ENV` | wird von Vercel automatisch gesetzt | — | — |
| `RATE_LIMIT_MAX_REQUESTS` / `RATE_LIMIT_WINDOW_MS` / `REDIS_URL` | optional, aktuell ungenutzt | nur falls auf Redis-Rate-Limiting umgestellt wird | — |

---

## Kurz-Fazit: was ist der eigentliche Go-Live-Blocker?

1. Slice 06 (E-Mail-Zustellung) fertigstellen
2. Slice 07 (Retention/Löschjob) fertigstellen — datenschutzrechtlich kein „nice to have"
3. `db:migrate`-Skript reparieren und Migrationen 0000–0005 einmal gegen die Prod-Neon-DB laufen lassen
4. `BETTER_AUTH_URL` und `CRON_SECRET` als Env-Vars ergänzen (fehlen aktuell im Template)
5. Stripe Live-Webhook + Google-Billing + Resend-Domain-Verifizierung einrichten

Alles unter „optional" (Observability, CI-Pipeline, Redis-Rate-Limiting, feste Stripe-Price-Objekte) kann nach dem ersten Launch nachgezogen werden.
