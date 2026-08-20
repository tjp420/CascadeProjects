# SimpleBeacon Production Deployment Runbook

**Applies to:** PR #563 — 3-tier pricing redesign + Stripe billing alignment
**Target platform:** Render / AWS / Fly.io / Heroku (any Node 22+ host)
**Last updated:** 2026-08-06

---

## Phase 1: Stripe Dashboard Configuration

Before deploying any code, create the new product entities in your live Stripe account.

### 1.1 Seed the Product Catalog

Using the Stripe CLI (targeting your live account):

```bash
stripe login

# 1. Create Developer Product and Prices
stripe products create --id="prod_developer_tier" \
  --name="SimpleBeacon Developer" \
  --description="Zero Data Custody local AI code compliance scanning for individual developers." \
  --metadata[tier]="developer" --metadata[internal_product_key]="developer_tier"

stripe prices create --id="price_developer_monthly" \
  --product="prod_developer_tier" --unit-amount=4900 --currency=usd \
  --recurring[interval]=month --nickname="Developer Monthly"

stripe prices create --id="price_developer_annual" \
  --product="prod_developer_tier" --unit-amount=49000 --currency=usd \
  --recurring[interval]=year --nickname="Developer Annual"

# 2. Create Team Pro Product and Prices
stripe products create --id="prod_team_pro_tier" \
  --name="SimpleBeacon Team Pro" \
  --description="Advanced AI code compliance orchestration and reporting for engineering teams." \
  --metadata[tier]="team_pro" --metadata[internal_product_key]="team_pro_tier"

stripe prices create --id="price_team_pro_monthly" \
  --product="prod_team_pro_tier" --unit-amount=14900 --currency=usd \
  --recurring[interval]=month --nickname="Team Pro Monthly"

stripe prices create --id="price_team_pro_annual" \
  --product="prod_team_pro_tier" --unit-amount=149000 --currency=usd \
  --recurring[interval]=year --nickname="Team Pro Annual"
```

> **Reference:** The catalog schema is at `ai-platform/config/stripe_product_catalog.json`.

### 1.2 Configure the Live Webhook Endpoint

1. Navigate to **Developers > Webhooks** in your Stripe Dashboard.
2. Click **Add Endpoint**.
3. Set the Endpoint URL to your live production server:
   `https://simplebeacon.ai/api/simplebeacon/billing/webhook`
4. Select the event type: `checkout.session.completed`.
5. Reveal and copy the **Webhook Signing Secret** (starts with `whsec_`).

---

## Phase 2: Environment Variable Provisioning

The server entry point contains a fail-fast environment validator
(`server/config/validate-env.cjs`). If you deploy without setting these
variables, the production container will crash and refuse to boot.

Log into your cloud hosting dashboard and set the following:

| Variable                            | Production Value          | Impact if Missing/Invalid                             |
| ----------------------------------- | ------------------------- | ----------------------------------------------------- |
| `NODE_ENV`                          | `production`              | Critical: triggers fatal validator mode               |
| `STRIPE_SECRET_KEY`                 | `sk_live_...`             | Critical: must start with `sk_` or server exits(1)    |
| `STRIPE_WEBHOOK_SECRET`             | `whsec_...`               | Critical: must start with `whsec_` or server exits(1) |
| `STRIPE_PUBLISHABLE_KEY`            | `pk_live_...`             | Required for frontend checkout modal                  |
| `STRIPE_PRICE_ID_DEVELOPER_MONTHLY` | `price_developer_monthly` | Required for Developer tier checkout                  |
| `STRIPE_PRICE_ID_DEVELOPER_ANNUAL`  | `price_developer_annual`  | Required for Developer annual billing                 |
| `STRIPE_PRICE_ID_TEAM_PRO_MONTHLY`  | `price_team_pro_monthly`  | Required for Team Pro tier checkout                   |
| `STRIPE_PRICE_ID_TEAM_PRO_ANNUAL`   | `price_team_pro_annual`   | Required for Team Pro annual billing                  |
| `PURCHASE_ALERT_WEBHOOK`            | Slack/Discord URL         | Optional: leave blank to disable chat alerts          |
| `RESEND_API_KEY`                    | `re_...`                  | Required for transactional email delivery             |
| `RESEND_FROM`                       | `noreply@simplebeacon.ai` | Required for email sender address                     |

> **Full reference:** See `ai-platform/.env.example` for all supported variables.

---

## Phase 3: Deployment Execution

### 3.1 Merge PR #563

Merge `fix/audit-token-flow` to your production branch (`main`).

The `stripe-compliance-check.yml` GitHub Actions workflow will run
automatically, executing:

- 26 webhook tier mapping tests (Node test runner)
- 47 billing & email template tests (Jest)
- Catalog schema validation (4 required price IDs)

### 3.2 Verify Server Boot Sequence

Monitor your container logs during initialization. Look for:

```
[EnvValidator] Environment validation passed: Stripe billing services ready.
[SimpleBeacon] Express engine listening on port 58000
```

If the server exits with code 1, check for:

- Accidental whitespace in env var values
- Missing `sk_` or `whsec_` prefixes
- `NODE_ENV` not set to `production` (validator runs in warn-only mode otherwise)

---

## Phase 4: Smoke Testing the Live Funnel

### 4.1 Verify Storefront

1. Visit `https://simplebeacon.ai/pricing`
2. Confirm the 3-tier layout displays: Developer ($49/mo), Team Pro ($149/mo), Enterprise (Custom)
3. Verify the "Zero Data Custody" compliance banner appears below the grid

### 4.2 Test Enterprise Routing

1. Click **Book Demo** on the Enterprise tier
2. Confirm it redirects to `/contact?topic=enterprise`

### 4.3 Test Stripe Checkout

1. Click **Subscribe** on the Developer or Team Pro tier
2. Confirm the Stripe checkout modal opens with the correct product name and price
3. Use Stripe test card `4242 4242 4242 4242` with any future expiry and CVC
4. Complete the checkout

### 4.4 Verify Post-Checkout Flow

After successful checkout, verify:

- [ ] License activation email arrives in the customer's inbox
- [ ] Slack/Discord alert received (if `PURCHASE_ALERT_WEBHOOK` is set)
- [ ] Alert shows masked email (`j***r@company.com`), tier, and amount
- [ ] Customer appears in the subscription store with correct tier

### 4.5 Test Legacy Backward Compatibility

Existing subscribers on legacy price IDs (`price_startup_monthly`, `price_growth_monthly`) should:

- [ ] Continue to be recognized by the webhook handler
- [ ] Map to `developer` and `team_pro` tiers respectively
- [ ] Receive correct email templates

---

## Phase 5: Rollback Plan

If critical issues arise:

1. **Revert the merge commit** on `main` to return to the previous pricing structure
2. **Legacy price IDs remain active** in Stripe — no action needed in the Dashboard
3. **Environment variables** can remain as-is (they're backward compatible)
4. **Notify existing subscribers** if any billing disruptions occurred

---

## File Reference

| Artifact               | Path                                                  |
| ---------------------- | ----------------------------------------------------- |
| Product catalog schema | `ai-platform/config/stripe_product_catalog.json`      |
| Stripe tier mapping    | `ai-platform/server/config/stripe.cjs`                |
| Email templates        | `ai-platform/src/api/billing/email-templates.cjs`     |
| License utils          | `ai-platform/src/api/billing/license-utils.cjs`       |
| Env validator          | `ai-platform/server/config/validate-env.cjs`          |
| Webhook handler        | `ai-platform/server/routes/stripe-webhook-routes.cjs` |
| Purchase alerts        | `ai-platform/server/lib/purchase-alerts.cjs`          |
| Pricing page           | `coming-soon/public/pricing.html`                     |
| CI workflow            | `.github/workflows/stripe-compliance-check.yml`       |
| Env boilerplate        | `ai-platform/.env.example`                            |
| Webhook test fixtures  | `ai-platform/test-fixtures/stripe/`                   |
| Webhook test script    | `ai-platform/tools/send-test-webhook-3tier.cjs`       |
