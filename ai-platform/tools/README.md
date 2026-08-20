**Smoke Test: Billing + Webhook Utilities**

This file documents local smoke-test steps and required environment flags for the billing/webhook helpers in this folder.

**Prerequisites**

- **Server**: Run the platform server on `http://127.0.0.1:58000` (default). If you run on a different port, set `PORT` accordingly.
- **Node**: Node >= 22 (project requires Node >=22).

**Required environment variables**

- **`STRIPE_SECRET_KEY`**: a test Stripe secret key (or `sk_test_placeholder` for local runs). Required for `getStripeClient()` to be non-null.
- **`STRIPE_WEBHOOK_SECRET`**: webhook signing secret used to validate incoming webhooks (e.g. `whsec_test_secret_placeholder_54200`).
- **`PORT`** (optional): override server port (default `58000` for local runs used in scripts).

**Why a .cjs wrapper exists**
The repository sets `"type": "module"` so `.js` files are treated as ESM. The original `tools/test-billing-pipeline.js` uses CommonJS `require()`; a `.cjs` copy (`tools/test-billing-pipeline.cjs`) was added so the smoke test can be executed without changing package scope.

**Common workflows**

- Start server (PowerShell example):

  ```powershell
  # from repo root
  Set-Location .\ai-platform
  $env:STRIPE_SECRET_KEY='sk_test_placeholder'
  $env:STRIPE_WEBHOOK_SECRET='whsec_test_secret_placeholder_54200'
  Start-Process -NoNewWindow -FilePath cmd -ArgumentList '/c','npm run start' -WorkingDirectory (Get-Location)
  ```

- Send a signed test Stripe webhook (creates/upserts subscription):

  ```powershell
  Set-Location .\ai-platform
  $env:STRIPE_SECRET_KEY='sk_test_placeholder'
  $env:STRIPE_WEBHOOK_SECRET='whsec_test_secret_placeholder_54200'
  node tools/send-custom-stripe-webhook.cjs
  ```

- Run the CommonJS billing pipeline smoke test (wrapper):

  ```powershell
  # ensure server is running; optionally set PORT
  $env:PORT='58000'
  node tools/test-billing-pipeline.cjs
  ```

- Upload a test report using a server-issued license token (manual token):

  ```powershell
  # Obtain the token via GET /api/simplebeacon/billing/license?email=you@example.com
  $env:LICENSE_TOKEN='<server-issued-token>'
  node tools/upload-test-report.cjs
  ```

**Expected outcomes**

- Webhook processing: `checkout.session.completed` and `invoice.paid` should return `200 {"received":true}` when `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` are set.
- License lookup: `GET /api/simplebeacon/billing/license?email=...` returns a JSON object with `licenseToken` and `tier`.
- Report upload: a file is written to `.simplebeacon/report-deliveries/` and an email job is queued in `.simplebeacon/email-queue/`.

**Troubleshooting**

- If you see `503 {"error":"Webhook not configured"}`: ensure `STRIPE_SECRET_KEY` is set in the environment before starting the server.
- If server logs show `Invalid API Key provided`: the server attempted to call Stripe with a placeholder key — replace `STRIPE_SECRET_KEY` with a real test key to exercise line-item lookups.

**Files created by these helpers**

- `tools/send-custom-stripe-webhook.cjs` — sends signed webhook payloads.
- `tools/test-billing-pipeline.cjs` — CommonJS smoke test wrapper.
- `tools/upload-test-report.cjs` — helper to upload a report using a license token.

**Where to go next**

- To fully automate this in CI, add a small wrapper step that starts the server with the required env vars, runs the webhook sender, runs the `test-billing-pipeline.cjs`, then cleans up the generated artifacts.
