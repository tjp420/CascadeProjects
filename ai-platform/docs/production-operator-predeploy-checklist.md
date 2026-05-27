# Production Operator Predeploy Checklist (Week 1-2)

Use this single checklist before deploying to `simplebeacon.ai`.

## 1) Required environment variables (`.env.production`)

Authentication and safety:

- `NODE_ENV=production`
- `REQUIRE_AUTH=true`
- `JWT_SECRET` (real secret, non-placeholder, >=32 chars)
- `JWT_REFRESH_SECRET` (real secret, non-placeholder, >=32 chars)
- `JWT_EXPIRES_IN` (example: `7d`)
- `REFRESH_TOKEN_EXPIRES_IN` (example: `30d`)
- `SEED_DEMO_USERS=false`
- `ALLOW_LEGACY_LOGIN=false` (or unset)
- `SIMPLEBEACON_APP_URL=https://simplebeacon.ai`

Stripe (required only when `SIMPLEBEACON_MONETIZATION_ENABLED=true`):

- `SIMPLEBEACON_MONETIZATION_ENABLED=true`
- `STRIPE_SECRET_KEY` (`rk_live_...` recommended; `sk_live_...` accepted)
- `STRIPE_PRICE_ID_TEAMS_MONTHLY` (or `STRIPE_PRICE_ID`)
- `STRIPE_WEBHOOK_SECRET` (`whsec_...`)
- `STRIPE_PUBLISHABLE_KEY` (recommended for frontend flows)

Optional Stripe price IDs:

- `STRIPE_PRICE_ID_TEAMS_ANNUAL`
- `STRIPE_PRICE_ID_ENTERPRISE_SETUP`
- `STRIPE_PRICE_ID_ENTERPRISE_RETAINER`

Infra:

- `ENABLE_DATABASE=true`
- `ENABLE_REDIS=true`
- `DATABASE_URL` (or `DB_HOST` + `DB_PASSWORD`) when database enabled
- `REDIS_URL` when Redis enabled
- `CORS_ORIGINS=https://simplebeacon.ai,https://www.simplebeacon.ai` (comma-separated, https only)

## 2) Single pre-deploy verification command

Run from `ai-platform/`:

```bash
npm run verify:predeploy
```

This runs, in order:

1. `npm run verify:stripe`
2. `npm run verify:production-deploy`
3. `npm run security:scan` (trust/compliance precheck)

Expected release decision:

- `Decision: GO` -> proceed
- `Decision: NO-GO` -> fix failing step(s), re-run

## 3) Targeted diagnostics commands

```bash
# Stripe wiring and live-mode/price checks
npm run verify:stripe

# Production env and deployment safety checks
npm run verify:production-deploy

# Trust/compliance gate artifacts
npm run security:scan
```

## 4) Deploy command

Only after `verify:predeploy` returns `Decision: GO`:

```bash
npm run simplebeacon:deploy
```

## 5) Owner-tagged blockers (host-side)

- **Operations/SRE**: provision and secure `.env.production` values on host secret store; enforce file permissions and rotation.
- **Security**: approve Stripe key mode and permissions (`rk_live_` least-privilege policy) and webhook secret management.
- **Billing/Finance Ops**: create and verify live Stripe `price_` IDs for enabled products.
- **Repo Admin/DevEx**: enforce required deploy workflow checks in branch protection.
