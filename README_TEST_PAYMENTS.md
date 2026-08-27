Stripe Test Payments — local test flow (no real money)

Overview
--------
This scaffold provides a minimal local server to exercise Stripe Checkout and webhook handling in Test Mode. It avoids real money by using Stripe test keys and the Stripe CLI for webhook forwarding.

Files added
-----------
- server/index.js — minimal Express server to create Checkout Sessions and receive webhooks
- server/setup_public.js — helper that creates public/success.html and public/cancel.html
- .env.example — environment variable template

Quick start
-----------
1. Copy environment variables:
   cp .env.example .env
   Fill in STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET (test keys from the Stripe Dashboard). Use STRIPE_SECRET_KEY that starts with `sk_test_`.

2. Create public pages (writes public/):
   node server/setup_public.js

3. Install dependencies (in repo root or server folder):
   npm install express stripe body-parser dotenv

4. Start the server:
   node server/index.js

5. In a separate terminal, use the Stripe CLI to forward webhooks to your local server (requires stripe CLI installed and logged in):
   stripe listen --forward-to localhost:4242/webhook
   The CLI will print the webhook signing secret ("Signing secret for localhost:..."), copy that into your .env as STRIPE_WEBHOOK_SECRET.

6. Create a Checkout Session (example using curl):
   curl -s -X POST http://localhost:4242/create-checkout-session \ 
     -H "Content-Type: application/json" \
     -d '{"amount":500, "product_name":"Test Item", "domain":"http://localhost:4242"}'

   The response will include a `url` you can open in the browser to complete the test checkout. Use Stripe test card 4242 4242 4242 4242 with any future expiry and CVC.

Refunds and testing
-------------------
- To test refunds (no money moved in Test Mode), find the Charge ID in the Stripe dashboard (or via the API) and issue a refund with the Stripe Dashboard or API. Test refunds will not return money.
- Example (using stripe CLI or API):
  stripe refunds create --charge ch_12345

Security notes
--------------
- Never use live secret keys in this local test environment. Keep .env out of commits.
- This scaffold is for local testing only and is intentionally minimal. Do not expose this server to the public internet.

Troubleshooting
---------------
- If the hosted Checkout page shows an error about the success/cancel URL, ensure public/success.html and public/cancel.html exist. Run `node server/setup_public.js` to generate them.
- If webhook signature verification fails, ensure the STRIPE_WEBHOOK_SECRET matches the one displayed by `stripe listen` (it's different from your secret key).

Next steps
----------
- (Optional) Add an npm script: `"stripe-test": "node server/index.js"` to package.json
- (Optional) Add logging or a small UI to display session IDs and webhook events saved to disk

