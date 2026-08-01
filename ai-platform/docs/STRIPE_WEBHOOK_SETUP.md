Stripe webhook setup and local testing
====================================

Overview
--------
This document explains how to configure Stripe webhook signing secrets in production and how to verify the billing webhook locally.

Production steps
----------------
- In your production host (Render, Vercel, Docker swarm, etc.) set the following secrets:
  - `STRIPE_SECRET_KEY` — your Stripe secret key (sk_live_...)
  - `STRIPE_WEBHOOK_SECRET` — the webhook signing secret for the endpoint `/api/simplebeacon/billing/webhook`

- Point Stripe Dashboard webhook endpoint to:
  - `https://<your-host>/api/simplebeacon/billing/webhook`

- Verify in Stripe Dashboard: send a test event (e.g. `checkout.session.completed` and `invoice.paid`).

Local testing (no real Stripe account required)
---------------------------------------------
1. Start the local server with a temporary webhook secret. From the repo root run:

```powershell
cd ai-platform
$env:STRIPE_WEBHOOK_SECRET = 'whsec_test_local'
node simplebeacon-server.cjs
```

2. In a separate shell, run the provided test helper to send two signed events (checkout + invoice):

```powershell
cd ai-platform
STRIPE_WEBHOOK_SECRET=whsec_test_local node tools/send-test-stripe-webhook.cjs
```

The helper uses the installed `stripe` package to generate a realistic `Stripe-Signature` header and posts the raw JSON body to `http://127.0.0.1:58000/api/simplebeacon/billing/webhook` by default.

If the server responds with HTTP 200 and `{ received: true }`, signature validation and handler processing succeeded.

Using the Stripe CLI (recommended for live testing)
-------------------------------------------------
1. Install Stripe CLI: https://stripe.com/docs/stripe-cli
2. Log in: `stripe login`
3. Listen and forward to your local server (replace the URL if different):

```bash
stripe listen --forward-to http://127.0.0.1:58000/api/simplebeacon/billing/webhook
```

4. In the Stripe Dashboard send test events to your listener (or use `stripe trigger checkout.session.completed`).

Notes
-----
- The webhook handler uses `stripe.webhooks.constructEvent(req.body, req.headers['stripe-signature'], webhookSecret)` (Stripe SDK) to validate signatures. Keep `STRIPE_WEBHOOK_SECRET` private and rotate it if leaked.
- Do not commit real signing secrets into the repository. Use host secret managers or CI/CD repository secrets.
