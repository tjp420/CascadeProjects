# Week 1 — Revenue readiness checklist

**Goal by May 31:** Legally take money at `https://simplebeacon.ai`

## Brand (Day 1–2)

- [x] Customer-facing name: **SimpleBeacon** (landing, dashboard, legal)
- [x] CLI/npm stays **`simplebeacon`** (no package rename required)
- [ ] Before go-live: remove `noindex` from `coming-soon/index.html` line 9 → `index, follow`

## Stripe (Day 3–4)

1. Copy `ai-platform/.env.production.example` → `.env.production`
2. Create Stripe products (test mode first):
   ```bash
   cd ai-platform
   STRIPE_SECRET_KEY=sk_test_... node tools/bootstrap-stripe-test-prices.js
   ```
3. Paste printed `price_...` IDs into `.env.production`
4. Set `SIMPLEBEACON_MONETIZATION_ENABLED=true`
5. Verify:
   ```bash
   DOTENV_CONFIG_PATH=.env.production npm run verify:stripe
   ```
6. Run dashboard with production env, complete test checkout on `/pricing`
7. Configure Stripe webhook: `https://simplebeacon.ai/api/simplebeacon/billing/webhook`

## Legal (Day 5)

- [x] `/terms` `/privacy` `/refund` pages (draft — **lawyer review required**)
- [ ] Link footer on all landing pages
- [ ] Add Stripe billing descriptor: `SIMPLEBEACON`

## Deploy (Day 6–7)

### Option A — Full stack (recommended for SaaS + Stripe)

1. Host `ai-platform` on VPS/Railway/Fly with `SIMPLEBEACON_LANDING=true`
2. Point `simplebeacon.ai` DNS to server
3. TLS via Caddy/nginx + Let's Encrypt
4. Env: `.env.production` on server

### Option B — Static landing + app subdomain

1. Cloudflare Pages: upload `coming-soon/` → `simplebeacon.ai`
2. Dashboard API: `app.simplebeacon.ai` → set `site-config.js` `appOrigin`

See `coming-soon/DEPLOY.md`

## Verify before first cold email

```bash
curl -s https://simplebeacon.ai/api/platform/status
curl -s https://simplebeacon.ai/api/optimization/compliance
# Test checkout: /pricing → Subscribe → Stripe test card 4242...
```

## Week 2 starts when

- [ ] Stripe test checkout succeeds end-to-end
- [ ] Legal pages live (even if marked draft)
- [ ] You send 5 Toronto emails (not before)

**Do not build:** fuzzy match, GGUF hints, pattern consolidation, issue-resolution integration.
