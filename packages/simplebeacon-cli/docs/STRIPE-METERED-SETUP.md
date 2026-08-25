# Stripe Metered Billing Setup Guide

SimpleBeacon now uses **usage-based (metered) billing** for Startup and Growth tiers. This guide walks through creating the required Stripe products and price IDs.

## Products to Create

### 1. Startup Shield — $49/month + metered scans

1. Go to **Stripe Dashboard → Products → Add product**
2. Name: `Startup Shield`
3. Description: `Up to 2,500 pipeline scans per month. Usage-based billing.`
4. Pricing model: **Standard pricing**
   - Price: `$49.00` / month
   - Billing period: **Monthly**
   - This is the **base subscription fee**
5. Save the product. Note the **Price ID** (looks like `price_1ABCDEF...`)
6. Set environment variable:
   ```bash
   STRIPE_PRICE_ID_STARTUP_MONTHLY=price_1ABCDEF...
   ```

### 2. Growth Shield — $149/month + metered scans

1. Go to **Stripe Dashboard → Products → Add product**
2. Name: `Growth Shield`
3. Description: `Up to 10,000 pipeline scans per month. Usage-based billing.`
4. Pricing model: **Standard pricing**
   - Price: `$149.00` / month
   - Billing period: **Monthly**
5. Save the product. Note the **Price ID**
6. Set environment variable:
   ```bash
   STRIPE_PRICE_ID_GROWTH_MONTHLY=price_1GHIJKL...
   ```

## Optional: Annual Discounts

Create annual variants with 17% discount:

- **Startup Annual**: `$490.00` / year
- **Growth Annual**: `$1,490.00` / year

Set env vars:

```bash
STRIPE_PRICE_ID_STARTUP_ANNUAL=price_1...
STRIPE_PRICE_ID_GROWTH_ANNUAL=price_1...
```

## Usage Reporting

The backend tracks scan usage in `.simplebeacon/subscriptions.json`. To report usage to Stripe for metered billing:

```bash
# Run monthly (or via cron)
curl -X POST https://api.stripe.com/v1/subscription_items/{si_xxx}/usage_records \
  -u sk_live_...: \
  -d quantity=2450 \
  -d timestamp=$(date +%s) \
  -d action=set
```

Or use the built-in helper:

```javascript
const {
  reportScanUsageToStripe,
} = require("./ai-platform/server/config/stripe.cjs");
await reportScanUsageToStripe(process.env.STRIPE_SECRET_KEY, "si_xxx", 2450);
```

## Environment Variables Summary

```bash
# Required for new tiers
STRIPE_PRICE_ID_STARTUP_MONTHLY=price_1...
STRIPE_PRICE_ID_GROWTH_MONTHLY=price_1...

# Optional annual variants
STRIPE_PRICE_ID_STARTUP_ANNUAL=price_1...
STRIPE_PRICE_ID_GROWTH_ANNUAL=price_1...

# Required for checkout to work
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

## Testing

Use Stripe test mode Price IDs with the `TEST_` prefix:

```bash
STRIPE_PRICE_ID_STARTUP_MONTHLY=price_test_...
```

Test checkout flow:

```bash
curl -X POST http://localhost:3001/api/simplebeacon/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","product":"startup_shield","mode":"monthly"}'
```
