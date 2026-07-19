## Billing setup and local checkout verification

This document explains how to enable and verify Stripe checkout in local development.

1) Copy example env

```
cd coming-soon
cp .env.example .env
```

2) Fill Stripe test values
- `STRIPE_SECRET_KEY` — use a Stripe **test** secret (starts with `sk_test_...`).
- `STRIPE_WEBHOOK_SECRET` — optional for webhook verification in dev.
- Replace `STRIPE_PRICE_ID_*` with your test price IDs.

3) Restart the server

The `coming-soon` server loads `coming-soon/.env` on startup. Restart your server so it picks up the new variables.

4) Verify monetization is enabled

Run the diagnostic used earlier to confirm environment values:

```powershell
node -e "const s=require('./ai-platform/server/lib/simplebeacon-subscription-store.cjs'); console.log('MONETIZATION_FLAG', process.env.SIMPLEBEACON_MONETIZATION_ENABLED); try{console.log('isMonetizationEnabled', s.isMonetizationEnabled());}catch(e){console.error('MON_ERROR',e.message)}; console.log('HAS_STRIPE_SECRET', !!process.env.STRIPE_SECRET_KEY)"
```

5) Test checkout endpoint

Use `curl` to call the checkout API. Replace `<email>` and `<priceId>` accordingly.

```bash
curl -X POST http://localhost:3000/api/simplebeacon/billing/checkout \
  -H "Content-Type: application/json" \
  -d '{"priceId":"price_XXXXXXXX","email":"you@example.com"}'
```

Expected result: a JSON body with a Stripe session ID or a 200/201 response from the billing API. If you get a 503, ensure `STRIPE_SECRET_KEY` is set and restart the server.

6) If you cannot or do not want to use real Stripe keys locally

- Consider a dev-mode checkout stub: I can add a small, gated stub that returns a fake session when `NODE_ENV !== 'production'` and `STRIPE_SECRET_KEY` is absent. Confirm if you want that.
