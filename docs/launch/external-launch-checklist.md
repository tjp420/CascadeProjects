# SimpleBeacon Launch Checklist — External Setup Only

**Status as of 2026-08-18:** Code-ready. All code-level blockers fixed in commits `8aaec1b66` and `a009081a2`. Remaining gate is operational.

## How to use this checklist

Each item has:
- **Action** — what to do
- **Verify** — how to confirm it worked
- **Block** — what breaks if you skip it

Work top to bottom. Items within each phase can be done in parallel.

---

## Phase 1: DNS + Domain

### 1.1 Point simplebeacon.ai to Cloudflare

- [ ] **Action:** Add `simplebeacon.ai` to Cloudflare (or verify it's already there)
- [ ] **Action:** Point nameservers to Cloudflare
- [ ] **Verify:** `dig simplebeacon.ai` returns Cloudflare IPs
- [ ] **Block:** Nothing else works without this

### 1.2 Configure www subdomain

- [ ] **Action:** Add `www.simplebeacon.ai` CNAME to `simplebeacon.ai` (or Cloudflare redirect)
- [ ] **Verify:** `curl -I https://www.simplebeacon.ai` returns 200 or 301 to `simplebeacon.ai`
- [ ] **Block:** Worker route for www won't function

---

## Phase 2: Render Backend

### 2.1 Deploy to Render

- [ ] **Action:** Connect repo to Render (or use existing `render.yaml`)
- [ ] **Action:** Set service name to `simplebeacon` (so URL is `simplebeacon.onrender.com`)
- [ ] **Action:** Create Postgres database `simplebeacon-db`
- [ ] **Action:** Trigger first deploy
- [ ] **Verify:** `curl https://simplebeacon.onrender.com/health` returns 200
- [ ] **Block:** No backend for API calls, webhooks, or auth

### 2.2 Set required env vars in Render

These are marked `sync: false` in `render.yaml` — they must be set manually in Render dashboard:

- [ ] `STRIPE_SECRET_KEY` — must start with `sk_live_`
- [ ] `STRIPE_PUBLISHABLE_KEY` — must start with `pk_live_`
- [ ] `STRIPE_WEBHOOK_SECRET` — must start with `whsec_`
- [ ] `RESEND_API_KEY` — must start with `re_`
- [ ] `SMTP_USER` — Zoho SMTP username
- [ ] `SMTP_PASS` — Zoho SMTP password
- [ ] `DASHBOARD_VAULT_PASSWORD` — internal dashboard access
- [ ] `REPORT_SIGNING_KEY` — tamper-evident report signing
- [ ] `OPENAI_API_KEY` — optional, for AI features (skip if using Ollama)
- [ ] `ANTHROPIC_API_KEY` — optional, for AI features (skip if using Ollama)

- [ ] **Verify:** `node ai-platform/scripts/verify-prod-env.js` exits 0 (run on Render shell or locally with production env loaded)
- [ ] **Block:** Billing, email, and auth will fail silently

### 2.3 Decide on Ollama

`render.yaml` currently sets `OLLAMA_BASE_URL=http://127.0.0.1:11434` and `SIMPLEBEACON_OFFLINE=true`.

- [ ] **Option A (keep offline):** Leave as-is. AI features use local Ollama if available, otherwise degrade gracefully. No action needed.
- [ ] **Option B (cloud AI):** Set `SIMPLEBEACON_OFFLINE=false`, set `OPENAI_API_KEY` and/or `ANTHROPIC_API_KEY`, remove or ignore `OLLAMA_*` vars.
- [ ] **Verify:** If Option B, `curl https://simplebeacon.onrender.com/api/ai/health` returns 200
- [ ] **Block:** AI-powered features (analyze, explain finding) won't work without a valid LLM backend

---

## Phase 3: Stripe

### 3.1 Switch to live mode

- [ ] **Action:** In Stripe Dashboard, ensure you're in live mode (not test mode)
- [ ] **Action:** Create products/prices if not already created (Agent $25/mo $250/yr, Developer $49/mo $490/yr). Note: checkout uses `price_data` (inline), so pre-created price IDs are not required.
- [ ] **Action:** Copy live secret key (`sk_live_...`) to Render env var `STRIPE_SECRET_KEY`
- [ ] **Action:** Copy live publishable key (`pk_live_...`) to Render env var `STRIPE_PUBLISHABLE_KEY`
- [ ] **Verify:** `curl https://simplebeacon.onrender.com/api/billing/health` returns 200 (or no Stripe errors in logs)
- [ ] **Block:** All payments fail

### 3.2 Configure webhook endpoint

- [ ] **Action:** In Stripe Dashboard, create webhook endpoint:
  - URL: `https://simplebeacon.onrender.com/api/stripe/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`
- [ ] **Action:** Copy signing secret (`whsec_...`) to Render env var `STRIPE_WEBHOOK_SECRET`
- [ ] **Verify:** Send test event from Stripe Dashboard → check Render logs for `[SubscriptionWebhook]` entry
- [ ] **Block:** Subscriptions won't activate, emails won't send, licenses won't mint

### 3.3 Test real checkout (small amount)

- [ ] **Action:** Use a real card via Stripe's test live mode (or use a $0 coupon if available)
- [ ] **Action:** Complete checkout for Agent tier ($25/mo)
- [ ] **Verify:** Stripe Dashboard shows successful payment
- [ ] **Verify:** Render logs show webhook received and processed
- [ ] **Verify:** Email receipt arrives (validates Stripe + email integration)
- [ ] **Verify:** License token is minted and valid
- [ ] **Block:** Can't trust the billing flow without a real transaction

---

## Phase 4: Email (Resend)

### 4.1 Verify sending domain

- [ ] **Action:** In Resend Dashboard, add domain `simplebeacon.ai`
- [ ] **Action:** Add DNS records Resend provides (DKIM, SPF, DMARC) to Cloudflare DNS
- [ ] **Verify:** Resend Dashboard shows domain as "Verified"
- [ ] **Block:** Emails go to spam or are rejected

### 4.2 Set API key

- [ ] **Action:** Create Resend API key (`re_...`)
- [ ] **Action:** Set in Render env var `RESEND_API_KEY`
- [ ] **Verify:** `node coming-soon/tools/setup-email.cjs --to your@email.com --send` succeeds (run from Render shell or locally with production env)
- [ ] **Block:** No emails sent (receipts, welcome, password reset, notifications)

### 4.3 Configure sender address

`render.yaml` defaults `RESEND_FROM` and `SMTP_FROM` to `admin@simplebeacon.ai`.

- [ ] **Action:** If `admin@simplebeacon.ai` is the correct sender, no change needed
- [ ] **Action:** If using a different sender (e.g. `noreply@simplebeacon.ai`), update `RESEND_FROM` and `SMTP_FROM` in Render env vars
- [ ] **Verify:** Send test email, check `From` header in received email
- [ ] **Block:** Emails may fail DMARC alignment if sender domain doesn't match verified domain

### 4.4 Configure Zoho SMTP fallback (optional but recommended)

`render.yaml` defaults to `smtp.zohocloud.ca:465`.

- [ ] **Action:** Create Zoho mail account for `admin@simplebeacon.ai` (or chosen sender)
- [ ] **Action:** Set `SMTP_USER` and `SMTP_PASS` in Render env vars
- [ ] **Verify:** `node scripts/test-zoho-smtp.cjs` succeeds
- [ ] **Block:** If Resend is down, no email fallback

---

## Phase 5: Cloudflare Worker

### 5.1 Deploy Worker

- [ ] **Action:** `cd worker-deploy && npx wrangler deploy`
- [ ] **Verify:** `curl https://simplebeacon.ai/` returns the marketing page (served from Worker assets)
- [ ] **Verify:** `curl https://simplebeacon.ai/dashboard/` returns the dashboard
- [ ] **Block:** Site doesn't load on production domain

### 5.2 Set Worker secrets

The Worker needs these secrets (set via `npx wrangler secret put`):

- [ ] `SIGNING_PRIVATE_KEY` — ECDSA P-256 JWK for certificate signing (generate with `node worker-deploy/scripts/generate-signing-keys.cjs`)
- [ ] `SIGNING_PUBLIC_KEY` — matching public key JWK
- [ ] `SIMPLEBEACON_LICENSE_SECRET` — license validation HMAC secret (can be same as Render's)
- [ ] `STRIPE_WEBHOOK_SECRET` — same as Render's, for edge webhook verification

- [ ] **Verify:** `curl https://simplebeacon.ai/api/v1/certify/public-key` returns a valid JWK
- [ ] **Block:** Certificate signing and license validation fail

### 5.3 Verify Worker → Backend proxy

- [ ] **Verify:** `curl https://simplebeacon.ai/api/stripe/webhook -X POST` reaches Render backend (check Render logs)
- [ ] **Verify:** `curl https://simplebeacon.ai/api/health` returns backend health status
- [ ] **Block:** API calls from the dashboard go nowhere

---

## Phase 6: VS Code Marketplace

### 6.1 Create publisher

- [ ] **Action:** Go to https://marketplace.visualstudio.com/manage/publishers/
- [ ] **Action:** Create publisher with ID `simplebeacon`
- [ ] **Action:** `cd simplebeacon-vscode-merged && npx @vscode/vsce login simplebeacon`
- [ ] **Block:** Can't publish extension

### 6.2 Build and publish VSIX

- [ ] **Action:** `cd simplebeacon-vscode-merged && npm run package:vsix`
- [ ] **Action:** Verify `.vsix` file is created
- [ ] **Action:** `npx @vscode/vsce publish`
- [ ] **Verify:** Extension appears at https://marketplace.visualstudio.com/items?itemName=simplebeacon.simplebeacon-vscode
- [ ] **Block:** Users can't install from Marketplace

### 6.3 Add marketplace listing assets

- [ ] **Action:** Add screenshots (at least 3: scan results, gate status, dashboard)
- [ ] **Action:** Add repository URL, license, and README content
- [ ] **Action:** Verify listing renders correctly
- [ ] **Block:** Listing looks unprofessional, reduces install conversion

---

## Phase 7: npm CLI

### 7.1 Publish CLI

- [ ] **Action:** `cd packages/simplebeacon-cli && npm run pack:check` (verify package contents)
- [ ] **Action:** `npm login` (if not already logged in)
- [ ] **Action:** `npm publish` (or `npm publish --access public`)
- [ ] **Verify:** `npm view simplebeacon version` returns `1.1.5`
- [ ] **Verify:** `npx simplebeacon --version` works in a clean directory
- [ ] **Block:** Users can't install CLI via npm

---

## Phase 8: Final Smoke Test

### 8.1 Full customer journey

- [ ] **Action:** Visit `https://simplebeacon.ai` — marketing page loads
- [ ] **Action:** Click "Pricing" — pricing page loads with correct tiers
- [ ] **Action:** Click "Subscribe" on Agent tier — Stripe Checkout opens
- [ ] **Action:** Complete checkout with real card
- [ ] **Action:** Check email — receipt/welcome email arrives
- [ ] **Action:** Click dashboard link in email — dashboard loads
- [ ] **Action:** Run a scan from the dashboard — scan completes
- [ ] **Action:** Export report JSON — download succeeds, JSON parses
- [ ] **Verify:** All steps complete without errors
- [ ] **Block:** Don't market until this works end-to-end

### 8.2 CLI smoke test

- [ ] **Action:** `npm install -g simplebeacon`
- [ ] **Action:** `simplebeacon scan --gate --offline` in a test repo
- [ ] **Action:** `simplebeacon gate status`
- [ ] **Verify:** Gate scan completes, report generates, gate status prints
- [ ] **Block:** CLI users hit runtime errors

### 8.3 Extension smoke test

- [ ] **Action:** Install extension from Marketplace in a clean VS Code
- [ ] **Action:** Open a workspace with a known issue (e.g. hardcoded secret)
- [ ] **Action:** Run "SimpleBeacon: Scan Workspace"
- [ ] **Action:** Verify findings appear in sidebar
- [ ] **Action:** Export report JSON
- [ ] **Verify:** Scan completes, findings show, export parses
- [ ] **Block:** Extension users hit errors on first use

---

## Go / No-Go Decision

**GO** when all of the following are true:
- [ ] Phase 1: DNS resolves to Cloudflare
- [ ] Phase 2: Render backend healthy, all env vars set
- [ ] Phase 3: Stripe live, webhook verified, real checkout tested
- [ ] Phase 4: Resend verified, test email delivered
- [ ] Phase 5: Worker deployed, secrets set, proxy works
- [ ] Phase 6: VSIX published to Marketplace
- [ ] Phase 7: CLI published to npm
- [ ] Phase 8: Full customer journey works end-to-end

**NO-GO** if any of the above are incomplete. Do not start outbound marketing until all items are checked.

---

## Quick Reference: Required Secrets

| Secret | Where | Format | Set in |
|--------|-------|--------|--------|
| `STRIPE_SECRET_KEY` | Stripe Dashboard | `sk_live_...` | Render env |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard | `pk_live_...` | Render env |
| `STRIPE_WEBHOOK_SECRET` | Stripe Dashboard | `whsec_...` | Render env + Worker secret |
| `RESEND_API_KEY` | Resend Dashboard | `re_...` | Render env |
| `SIGNING_PRIVATE_KEY` | `generate-signing-keys.cjs` | ECDSA JWK | Worker secret |
| `SIGNING_PUBLIC_KEY` | `generate-signing-keys.cjs` | ECDSA JWK | Worker secret |
| `SIMPLEBEACON_LICENSE_SECRET` | Random 32+ char string | String | Render env + Worker secret |
| `SMTP_USER` | Zoho Mail | Email | Render env |
| `SMTP_PASS` | Zoho Mail | Password | Render env |
| `DASHBOARD_VAULT_PASSWORD` | Random string | String | Render env |
| `REPORT_SIGNING_KEY` | Random 32+ char string | String | Render env |

## Quick Reference: Verification Commands

```bash
# Check required env vars are set
node ai-platform/scripts/verify-prod-env.js

# Test email delivery
node coming-soon/tools/setup-email.cjs --to your@email.com --send

# Test Zoho SMTP fallback
node scripts/test-zoho-smtp.cjs

# Test payment flow (stubbed, no real charges)
node scripts/test-payment-sim.cjs

# Validate production assets
node scripts/validate-production-assets.js

# Pre-launch checklist
node scripts/pre-launch-checklist.cjs

# Deploy Worker
cd worker-deploy && npx wrangler deploy

# Generate signing keys
node worker-deploy/scripts/generate-signing-keys.cjs

# Build VSIX
cd simplebeacon-vscode-merged && npm run package:vsix

# Check CLI package contents
cd packages/simplebeacon-cli && npm run pack:check
```
