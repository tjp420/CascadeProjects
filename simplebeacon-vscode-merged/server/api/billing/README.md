# Stripe Billing Environment Variables

These environment variables power the zero-fail post-payment pipeline.

## Required

| Variable | Description | Example |
|----------|-------------|---------|
| `STRIPE_SECRET_KEY` | Stripe secret key (sk_live_* or sk_test_*) | `sk_test_51Hx...` |
| `STRIPE_WEBHOOK_SECRET` | Webhook endpoint secret from Stripe Dashboard | `whsec_...` |
| `STRIPE_PRICE_PRO` | Stripe Price ID for the Pro tier | `price_1ABC...` |
| `STRIPE_PRICE_ENTERPRISE` | Stripe Price ID for the Enterprise tier | `price_1DEF...` |
| `STRIPE_PRICE_TEAM` | Stripe Price ID for the Team tier | `price_1GHI...` |

## Optional

| Variable | Description | Default |
|----------|-------------|---------|
| `DASHBOARD_ORIGIN` | Origin URL used in checkout redirect URLs | `http://localhost:3456` |
| `NODE_ENV` | When set to `development`, checkout errors include stack traces | — |

## Webhook Endpoint Setup

1. In the Stripe Dashboard, create an endpoint pointing to:
   ```
   https://your-domain.com/api/billing/stripe-webhook
   ```
2. Select the events to listen for:
   - `checkout.session.completed`
   - `invoice.payment_failed`
   - `customer.subscription.deleted`
3. Copy the webhook signing secret into `STRIPE_WEBHOOK_SECRET`.

## Checkout Session Metadata Pinning

When creating a checkout session, the backend passes:
```js
metadata: {
  userId: String(userId),
  targetTier: String(targetTier)
}
```

The webhook handler extracts these fields to know which account to upgrade.

## Local Testing with Stripe CLI

```bash
# Forward webhooks to your local server
stripe listen --forward-to localhost:3000/api/billing/stripe-webhook

# Trigger a test checkout completion
stripe trigger checkout.session.completed \
  --add checkout_session:metadata.userId=user_local_123 \
  --add checkout_session:metadata.targetTier=pro
```

## Route Mount Examples

### Express
```js
const express = require('express');
const app = express();
const { handleStripeWebhook } = require('./server/api/billing/webhook.js');
const { createCheckoutSession } = require('./server/api/billing/checkout.js');

app.post('/api/billing/stripe-webhook',
  express.raw({ type: 'application/json' }),
  handleStripeWebhook
);

app.post('/api/billing/checkout-session',
  express.json(),
  createCheckoutSession
);
```

### Fastify
```js
const { handleStripeWebhook } = require('./server/api/billing/webhook.js');
const { createCheckoutSession } = require('./server/api/billing/checkout.js');

fastify.post('/api/billing/stripe-webhook', {
  config: { rawBody: true }
}, handleStripeWebhook);

fastify.post('/api/billing/checkout-session', createCheckoutSession);
```

## Next Steps

1. Wire `atomicUpgradeUser()` in `webhook.js` to your database ORM.
2. Wire `regenerateLicense()` in `webhook.js` to your license engine.
3. Call `billingService.verifySessionEntitlementWithGrace()` from the post-checkout landing page.
4. Set `metadata.userId` and `metadata.targetTier` in every `stripe.checkout.sessions.create()` call.
