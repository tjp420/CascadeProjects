# SimpleBeacon Referral Launch Changelog

**Release identity:** v1.4.0-Referral-Core  
**Deployment anchor:** Commit `2c7516ad` (routing hardened)  
**Prior feature anchor:** Commit `93faffb4` (six-track integration)  
**System status:** Production live and verified on `https://simplebeacon.ai`  
**Date:** 2026-07-29

---

## Executive summary

SimpleBeacon shipped a six-track referral and growth engine connecting marketing entry, edge attribution, dashboard sharing, Stripe conversion credits, lifecycle email, and CLI distribution. The Render API backend, Cloudflare Pages edge layer, and `simplebeacon refer` CLI subcommand are synchronized on `main` and validated against live traffic.

---

## 1. Multi-track architecture map

```
                         ┌──────────────────────────┐
                         │  1. Marketing entry      │
                         │  ?ref=CODE on landing    │
                         └────────────┬─────────────┘
                                      │
                         ┌────────────▼─────────────┐
                         │  2. Edge / middleware    │
                         │  sb_ref cookie + capture │
                         └────────────┬─────────────┘
              ┌────────────────────────┴────────────────────────┐
              ▼ (Track A: Web)                                  ▼ (Track F: CLI)
   ┌──────────────────────────┐               ┌──────────────────────────┐
   │  3. Dashboard banner     │               │  6. simplebeacon refer   │
   │  Grade ≥ B → share box   │               │  --from / --email / link │
   └────────────┬─────────────┘               └────────────┬─────────────┘
                │                                          │
                └────────────────────┬─────────────────────┘
                                     │ signup / paid conversion
                         ┌───────────▼───────────┐
                         │  5. Lifecycle email   │
                         │  invite / welcome /   │
                         │  conversion alerts    │
                         └───────────┬───────────┘
                         ┌───────────▼───────────┐
                         │  4. Stripe webhook    │
                         │  $49 cert credit      │
                         └───────────────────────┘
                                     │
                         ┌───────────▼───────────┐
                         │  SQLite ledger        │
                         │  (Render backend)     │
                         └───────────────────────┘

[Visitor browser] ──► [Cloudflare Pages + _routes.json]
                              │
                              ├── static: /js-es2018/referral-capture.js
                              ├── functions: /api/* → Render proxy
                              └── functions: _middleware.js → sb_ref cookie

[CLI client] ──► https://simplebeacon.ai/api/referral/* ──► [Render Express]
                                                              └── coming-soon/lib/db.cjs
```

**Share URL format:** `https://simplebeacon.ai/?ref={partnerCode}`

---

## 2. Track-by-track code index

### Track 1 — Database ledger

| File                     | Role                                                                                                                         |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| `coming-soon/lib/db.cjs` | Tables: `referrers`, `referral_links`, `referral_attributions`, `referral_rewards` + indexes                                 |
|                          | Helpers: `getOrCreateReferrer`, `createReferralAttribution`, `markReferralAttributionConverted`, `grantReferralReward`, etc. |
|                          | Idempotent conversion via `attribution_id` constraint (no double-credit on webhook retry)                                    |

### Track 2 — Edge capture and routing

| File                                               | Role                                                                                                       |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `coming-soon/js/referral-capture.js`               | Source: reads `?ref=`, writes `localStorage sb_ref_slug`, POSTs capture                                    |
| `coming-soon/public/js-es2018/referral-capture.js` | Deployed asset (committed path; avoids gitignored `public/js/`)                                            |
| `coming-soon/functions/_middleware.js`             | Sets HttpOnly 30-day `sb_ref` cookie; async backend capture on `?ref=`                                     |
| `coming-soon/lib/referral-tracking.cjs`            | Cookie middleware + IP hash helpers for Express                                                            |
| `coming-soon/public/_routes.json`                  | Functions on `/api/*`, `/dashboard/*`, `/app/*`; static bypass for `/js-es2018/*`, `/js/*`, `/css/*`, etc. |
| `coming-soon/build-public.js`                      | Injects `/js-es2018/referral-capture.js` on marketing pages and dashboard shell                            |

### Track 3 — Dashboard UI

| File                                                                              | Role                                                    |
| --------------------------------------------------------------------------------- | ------------------------------------------------------- |
| `ai-platform/web/simplebeacon-dashboard/src/lib/gradeFromScore.ts`                | Maps quality score → letter grade (B+ passes)           |
| `ai-platform/web/simplebeacon-dashboard/src/components/ResultsReferralBanner.tsx` | Copy-ready share box + Email Link action                |
| `ai-platform/web/simplebeacon-dashboard/src/views/ResultsView.tsx`                | Renders banner when grade ≥ B and user is authenticated |

### Track 4 — Stripe webhook bridge

| File                                               | Role                                                                                         |
| -------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `coming-soon/lib/referral-webhook.cjs`             | `processStripeReferralAttribution`, `buildReferralCheckoutMetadata`, `processReferralSignup` |
| `ai-platform/src/api/simplebeacon-billing-api.cjs` | Production webhook hook + checkout metadata merge                                            |
| `coming-soon/routes/checkout.cjs`                  | Legacy/alternate checkout webhook path                                                       |
| `coming-soon/routes/subscriptions-billing.cjs`     | Subscription billing webhook path                                                            |
| `coming-soon/routes/auth.cjs`                      | Signup advances attribution `clicked` → `signed_up`                                          |
| `ai-platform/server/routes/auth.cjs`               | Production register hook for referral signup                                                 |

**Conversion reward:** `cert_credit_cents += 4900` ($49 certificate export credit) on paid checkout.

### Track 5 — Lifecycle email mesh

| File                                 | Role                                                                                                         |
| ------------------------------------ | ------------------------------------------------------------------------------------------------------------ |
| `coming-soon/lib/referral-email.cjs` | `sendReferrerLinkEmail`, `sendReferralInviteEmail`, `sendReferralConversionEmail`, `sendRefereeWelcomeEmail` |
| `coming-soon/routes/referral.cjs`    | Invite rate limit: 10 emails/hour per referrer                                                               |

Uses existing `coming-soon/services/email.cjs` (Resend/SMTP). Requires `RESEND_API_KEY` on Render for live delivery.

### Track 6 — CLI subcommand

| File                                                   | Role                                  |
| ------------------------------------------------------ | ------------------------------------- |
| `packages/simplebeacon-cli/src/lib/referral-cli.js`    | API client + identity resolution      |
| `packages/simplebeacon-cli/bin/simplebeacon.js`        | `refer` command registration and help |
| `packages/simplebeacon-cli/tests/referral-cli.test.js` | 3 regression tests (identity chain)   |

**Identity resolution order:** `--from` → `SIMPLEBEACON_REFERRER_EMAIL` → `SIMPLEBEACON_EMAIL` → JWT in `~/.simplebeacon/license.jwt`

---

## 3. Production wiring (Render + auth gate)

Production backend entry: `ai-platform/simplebeacon-server.cjs` (Render `render.yaml`).

| Integration             | File                                                                                                 |
| ----------------------- | ---------------------------------------------------------------------------------------------------- |
| Referral routes mounted | `ai-platform/simplebeacon-server.cjs` → `coming-soon/routes/referral.cjs`                            |
| Public API whitelist    | `ai-platform/server/bootstrap/public-api-routes.cjs` → `referral/capture`, `link`, `stats`, `invite` |
| Stripe conversion       | `ai-platform/src/api/simplebeacon-billing-api.cjs`                                                   |
| Register attribution    | `ai-platform/server/routes/auth.cjs`                                                                 |

With `REQUIRE_AUTH=true`, referral endpoints bypass the global auth gate via the public allowlist above.

---

## 4. API reference

| Method | Path                            | Auth   | Description                                               |
| ------ | ------------------------------- | ------ | --------------------------------------------------------- |
| `POST` | `/api/referral/capture`         | Public | Record click from `?ref=` or client payload               |
| `GET`  | `/api/referral/link?email=...`  | Public | Generate or fetch partner link; optional `sendEmail=true` |
| `GET`  | `/api/referral/stats?email=...` | Public | Referrer metrics + share URL                              |
| `POST` | `/api/referral/invite`          | Public | Send invite email (rate limited)                          |

**Example stats response:**

```json
{
  "success": true,
  "partnerCode": "abc123",
  "clicks": 12,
  "attributions": 4,
  "conversions": 1,
  "shareUrl": "https://simplebeacon.ai/?ref=abc123"
}
```

---

## 5. CLI reference

```bash
# Generate share link (text or JSON)
simplebeacon refer --from developer@domain.com --link
simplebeacon refer --from developer@domain.com --link --format json

# Send invite email via API
simplebeacon refer --from developer@domain.com --email partner@target.com

# Optional flags
#   --message "Custom note"   --send-email   --format json
#   SIMPLEBEACON_API_URL=https://simplebeacon.ai  (default)
```

---

## 6. Deployment topology

| Layer                  | Target                                       | Deploy method                          |
| ---------------------- | -------------------------------------------- | -------------------------------------- |
| Static + Functions     | Cloudflare Pages project `simplebeacon`      | `cd coming-soon && npm run deploy`     |
| API + webhooks + email | Render (`cascadeprojects-yzzd.onrender.com`) | Git push to `main`                     |
| Custom domains         | `simplebeacon.ai`, `www.simplebeacon.ai`     | Cloudflare Pages custom domain binding |

**Build pipeline:** `npm run build` in `coming-soon` → copies dashboard to `public/`, injects referral script tags.

---

## 7. Post-deployment validation

Automated checks: `coming-soon/scripts/verify-production.ps1`

```powershell
cd coming-soon
.\scripts\verify-production.ps1
```

| #   | Check                            | Expected                                     |
| --- | -------------------------------- | -------------------------------------------- |
| 1   | `/js-es2018/referral-capture.js` | HTTP 200, `Content-Type: javascript`         |
| 2   | Root HTML script tag             | `/js-es2018/referral-capture.js`             |
| 3   | `/api/referral/stats?email=...`  | JSON `{ "success": true }`                   |
| 4   | HSTS header                      | `Strict-Transport-Security` present          |
| 5   | API cache policy                 | `CF-Cache-Status: DYNAMIC` (not edge-cached) |

**Manual curl equivalents:**

```powershell
curl -sI "https://simplebeacon.ai/js-es2018/referral-capture.js"
curl -s "https://simplebeacon.ai/" | findstr referral-capture
curl -s "https://simplebeacon.ai/api/referral/stats?email=you@company.com"
```

---

## 8. Commits in this release

| Commit     | Summary                                                             |
| ---------- | ------------------------------------------------------------------- |
| `93faffb4` | Six-track referral engine (DB, edge, dashboard, Stripe, email, CLI) |
| `5d8c7cfd` | Production auth whitelist + Stripe billing hooks                    |
| `4fff55cf` | Serve capture script from committed `js-es2018` path                |
| `2c7516ad` | Harden `_routes.json` + add `verify-production.ps1`                 |

---

## 9. Follow-up roadmap

| Priority | Epic                             | Notes                                                                                          |
| -------- | -------------------------------- | ---------------------------------------------------------------------------------------------- |
| P0       | **Resend activation**            | Set `RESEND_API_KEY` + `RESEND_FROM` on Render; run `coming-soon/tools/setup-email.cjs --send` |
| P1       | **Referral analytics dashboard** | User-facing stats panel under Profile/Settings                                                 |
| P2       | **Post-scan CLI nudge**          | Suggest `simplebeacon refer --link` after gate pass (grade ≥ B)                                |
| P3       | **Email deliverability audit**   | Extend `coming-soon/scripts/verify-dns.ps1` with Resend delivery trace                         |

---

## 10. Sign-off checklist

- [x] Edge capture script live on `simplebeacon.ai` (`/js-es2018/referral-capture.js`)
- [x] Referral API public routes whitelisted under `REQUIRE_AUTH=true`
- [x] Stripe checkout metadata carries referral attribution
- [x] CLI `refer` subcommand tested against live API
- [x] `_routes.json` static bypass hardened
- [x] `verify-production.ps1` passes all 5 checks
- [ ] Live invite email delivery confirmed (requires Render `RESEND_API_KEY`)
- [ ] End-to-end conversion test (ref link → signup → paid checkout → credit grant)

---

_Generated as part of the SimpleBeacon v1.4.0 referral launch. For QA framework artifacts see `.simplebeacon/qa/`._
