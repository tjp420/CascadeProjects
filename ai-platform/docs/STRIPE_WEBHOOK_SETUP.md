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

Production deployment snippets
---------------------------
Below are examples for provisioning `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` on common hosts and CI. Replace the example values with your real secrets and never check secrets into git.

Render (dashboard)
-------------------
- Go to your Render service dashboard → "Environment" → "Environment Variables".
- Add variables:
  - `STRIPE_SECRET_KEY` = `sk_live_...`
  - `STRIPE_WEBHOOK_SECRET` = `whsec_...`
- Deploy or redeploy the service. Test with a Stripe Dashboard test event immediately after deploy.

Render CLI example (for automation):

```bash
render services env create --service-id <SERVICE_ID> --key STRIPE_SECRET_KEY --value sk_live_... --secure
render services env create --service-id <SERVICE_ID> --key STRIPE_WEBHOOK_SECRET --value whsec_... --secure
render services redeploy <SERVICE_ID>
```

Vercel (dashboard / CLI)
------------------------
- In Vercel dashboard: Project → Settings → Environment Variables → Add the two secrets (select `Production` scope).
- CLI example:

```bash
vercel env add STRIPE_SECRET_KEY production
vercel env add STRIPE_WEBHOOK_SECRET production
```

Docker / docker-compose (hosted)
--------------------------------
- For Docker Compose, avoid embedding secrets in `docker-compose.yml` — use an external `.env` or your orchestration secret manager.
- Example `.env.production` (store outside repo):

```
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

`docker-compose.yml` snippet (read from host env):

```yaml
version: '3.8'
services:
  api:
    image: your-image:latest
    environment:
      - STRIPE_SECRET_KEY
      - STRIPE_WEBHOOK_SECRET
    ports:
      - "58000:58000"
```

GitHub Actions (deploy + secrets)
---------------------------------
- Add secrets via the repository UI: `Settings -> Secrets -> Actions`.
  - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` (set as repository or environment secrets).
- Example workflow job step that verifies webhook after deployment (requires `stripe` CLI installed on runner):

```yaml
jobs:
  deploy-and-verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Deploy to host
        run: ./scripts/deploy.sh
        env:
          STRIPE_SECRET_KEY: ${{ secrets.STRIPE_SECRET_KEY }}
          STRIPE_WEBHOOK_SECRET: ${{ secrets.STRIPE_WEBHOOK_SECRET }}
      - name: Verify webhook endpoint
        run: |
          # install stripe CLI if not present
          curl -fsSL https://stripe.com/install.sh | sh || true
          stripe trigger checkout.session.completed --api-key ${{ secrets.STRIPE_SECRET_KEY }} --webhook-signing-secret ${{ secrets.STRIPE_WEBHOOK_SECRET }} --forward-to https://$HOSTNAME/api/simplebeacon/billing/webhook
        env:
          HOSTNAME: ${{ steps.deploy.outputs.host }}
```

Secret rotation checklist (safe rollover)
----------------------------------------
Follow this checklist to rotate `STRIPE_WEBHOOK_SECRET` without disrupting production webhook processing.

1. Create the new webhook secret in Stripe Dashboard:
   - Go to Developers → Webhooks → Select your endpoint → `Reveal signing secret` → `Rotate secret` → **Create new secret**. Stripe will provide a new `whsec_...` value and keep the old secret for a short grace window.

2. Add the new secret to your host's secret store (Render / Vercel / GitHub Actions) as `STRIPE_WEBHOOK_SECRET_NEW` (or place in a new key entry). DO NOT remove the old secret yet.

3. Update your server to accept both old and new secrets for verification (recommended temporary code):

```js
const webhookSecrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_WEBHOOK_SECRET_NEW].filter(Boolean);
let event = null;
for (const s of webhookSecrets) {
  try {
    event = stripe.webhooks.constructEvent(rawBody, sigHeader, s);
    break;
  } catch (err) {
    // try next secret
  }
}
if (!event) throw new Error('Invalid webhook signature');
```

4. Deploy the server with the dual-secret acceptance code (above) while both secrets are present.

5. Wait a short period (monitor logs for errors) to ensure no failed signature validations occur. Monitor Stripe Dashboard delivery logs and your server logs for `invalid_signature` errors.

6. Once confident, replace `STRIPE_WEBHOOK_SECRET` with the new secret in the host secret store and remove `STRIPE_WEBHOOK_SECRET_NEW`. Deploy again with single-secret acceptance.

7. Optionally, rotate the secret in Stripe again to invalidate any remaining old secrets and confirm delivery succeeds.

8. Update your incident runbook with the rotation date, operator, and rollback steps.

Notes on fail-open vs fail-closed
---------------------------------
- Webhook verification should be `fail-closed` — do not accept unsigned requests. During a rotation, accept both secrets temporarily to prevent missed events.
- Keep an idempotency/event-store (`stripe-event-store.cjs`) to ignore duplicate deliveries and make rotation safe.

CI verification job (recommended)
--------------------------------
Add a lightweight CI job that runs after deploy and uses the Stripe CLI or the `tools/send-test-stripe-webhook.cjs` helper to POST a signed event to the live endpoint. This verifies both network reachability and signature handling.

Security reminders
------------------
- Use host-managed secrets (Render / Vercel / GitHub Secrets) and grant access only to deploy pipelines and operations.
- Rotate `STRIPE_SECRET_KEY` (the API key) periodically and keep a limited list of valid API keys in Stripe. Update the `STRIPE_SECRET_KEY` in the same controlled rotation process.
- Log webhook deliveries and keep delivery summaries for 30–90 days for auditing.

