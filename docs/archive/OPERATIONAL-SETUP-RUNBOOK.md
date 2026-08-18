# SimpleBeacon Operational Setup Runbook

One-page guide to configure all external services required for launch.

---

## 1. Domain & DNS (~15 min)

### 1.1 Verify domain ownership
Ensure you own `simplebeacon.ai` (or register it).

### 1.2 Create DNS records

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `simplebeacon.ai` | Render load balancer IP (get from Render dashboard after deploy) | 300 |
| CNAME | `www` | `simplebeacon.pages.dev` (or your Pages domain) | 300 |

### 1.3 Verify resolution

```bash
dig simplebeacon.ai +short
nslookup simplebeacon.ai
```

---

## 2. Stripe Live Mode (~30 min)

### 2.1 Switch to Live Mode
Go to https://dashboard.stripe.com → toggle **Live mode**.

### 2.2 Create products + get Price IDs

| Product | Price | Price ID |
|---------|-------|----------|
| AI Slop Cop Pro — Monthly | $9.00 | `price_...` (copy from Stripe) |
| AI Slop Cop Pro — Yearly | $90.00 | `price_...` (copy from Stripe) |
| AI Slop Cop Enterprise | Custom | `price_...` (copy from Stripe) |

### 2.3 Add secrets to Render environment variables

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_TEAMS_MONTHLY=price_...
STRIPE_PRICE_ID_TEAMS_ANNUAL=price_...
STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE=price_...
STRIPE_PRICE_ID_INSTANT_REPORT=price_...
STRIPE_PRICE_ID_EU_AI_ACT_SPRINT=price_...
STRIPE_PRICE_ID_CONTINUOUS_SHIELD=price_...
STRIPE_PRICE_ID_RUNTIME_SHIELD=price_...
```

### 2.4 Create webhook endpoint

| Setting | Value |
|---------|-------|
| Endpoint URL | `https://simplebeacon.ai/api/stripe/webhook` |
| Events | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |

After creating, copy the **webhook signing secret** (`whsec_...`) and add it to Render env vars as `STRIPE_WEBHOOK_SECRET`.

---

## 3. Resend Email (~10 min)

### 3.1 Sign up & verify domain
- Go to https://resend.com → sign up (free tier: 100 emails/day)
- Add domain: `simplebeacon.ai`
- Complete TXT/MX verification

### 3.2 Generate API key
Generate a live API key starting with `re_`.

### 3.3 Add to Render environment variables

```
RESEND_API_KEY=re_...
RESEND_FROM=certificates@simplebeacon.ai
```

### 3.4 Send test email

```bash
cd coming-soon
node scripts/verify-resend.js
```

(Or create a quick test: `node -e "require('./services/email.cjs').sendEmail({to:'you@email.com',subject:'Test',html:'<p>Works</p>'})"`)

---

## 4. Render Deployment (~5 min)

### 4.1 Deploy via Blueprint

1. Go to https://dashboard.render.com → **New +** → **Blueprint**
2. Connect your GitHub repo
3. Render reads `render.yaml` and auto-creates the service
4. Fill in `sync: false` env vars (Stripe, Resend, etc.) after creation

### 4.2 Verify health endpoint

```bash
curl https://simplebeacon.ai/health
# Expected: {"status":"ok"}
```

---

## 5. VS Code Marketplace (~20 min)

### 5.1 Register publisher
1. Go to https://marketplace.visualstudio.com/manage
2. Create Microsoft account (if needed)
3. Register publisher name: `simplebeacon`

### 5.2 Upload extension
- Extension file: `simplebeacon-vscode-merged/simplebeacon-3.0.347.vsix`
- Upload 5 screenshots to `sales/marketplace/screenshots/` (see `screenshots/README.md`)
  - `01-sidebar.png` — Sidebar with scan results
  - `02-findings.png` — Expanded findings
  - `03-settings.png` — Settings panel
  - `04-full-scan.png` — Full scan results
  - `05-export.png` — Exported report
- Add captions for each screenshot

### 5.3 Submit for review

---

## 6. npm Registry (~10 min)

### 6.1 Ensure auth token

Check `.npmrc` has your auth token, or run:

```bash
npm login
```

### 6.2 Publish

```bash
cd packages/simplebeacon-cli
npm publish --access public
```

### 6.3 Verify

```bash
npm view simplebeacon version
```

---

## 7. Final Validation

Run all automated checks:

```bash
# Local pre-launch checklist (should be 31/31 after screenshots)
node scripts/pre-launch-checklist.cjs

# Production smoke tests (after DNS resolves)
node scripts/validate-production-assets.cjs --full
```

### Manual checklist

- [ ] `https://simplebeacon.ai` loads with valid SSL
- [ ] `https://simplebeacon.ai/.env` returns 403/404
- [ ] `https://simplebeacon.ai/server.cjs` returns 403/404
- [ ] `https://simplebeacon.ai/api/health` returns 200
- [ ] Stripe checkout redirect works
- [ ] Token email arrives after purchase
- [ ] Certificate generates without watermark
- [ ] Rate limit triggers 429 after 6 uploads in 15 min

---

## Quick Reference: All Render Env Vars

```
NODE_ENV=production
NODE_VERSION=22
PORT=10000
SIMPLEBEACON_LICENSE_SECRET=<generated-or-set>
ALLOWED_ORIGIN=https://simplebeacon.ai,https://simplebeacon.onrender.com
PUBLIC_URL=https://simplebeacon.ai
PUBLIC_APP_URL=https://simplebeacon.ai
STRIPE_SECRET_KEY=sk_live_...
STRIPE_PUBLISHABLE_KEY=pk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_ID_TEAMS_MONTHLY=price_...
STRIPE_PRICE_ID_TEAMS_ANNUAL=price_...
STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE=price_...
STRIPE_PRICE_ID_INSTANT_REPORT=price_...
STRIPE_PRICE_ID_EU_AI_ACT_SPRINT=price_...
STRIPE_PRICE_ID_CONTINUOUS_SHIELD=price_...
STRIPE_PRICE_ID_RUNTIME_SHIELD=price_...
RESEND_API_KEY=re_...
RESEND_FROM=certificates@simplebeacon.ai
SMTP_HOST=(optional)
SMTP_PORT=587
SMTP_USER=(optional)
SMTP_PASS=(optional)
SMTP_FROM=certificates@simplebeacon.ai
SIMPLEBEACON_LANDING=true
SIMPLEBEACON_APP_URL=https://simplebeacon.ai
```

---

## Estimated Time Summary

| Task | Time |
|------|------|
| Domain + DNS | 15 min |
| Stripe Live Mode | 30 min |
| Resend Email | 10 min |
| Render Deploy | 5 min |
| VS Code Marketplace | 20 min |
| npm Publish | 10 min |
| Final Validation | 15 min |
| **Total** | **~2 hours** |
