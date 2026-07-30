# SimpleBeacon Edge Launch Runbook

## Scope
This runbook covers the production launch sequence for the edge-native webhook signer and license delivery flow.

- Worker project: `worker-deploy/`
- Live host: `https://simplebeacon.ai`
- Worker webhook route: `/api/stripe-webhook`
- License polling route: `/api/license?session_id=...`

## 1) Preflight Checks
Run from repository root:

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npx wrangler --version
npx wrangler whoami
Pop-Location
```

Expected:
- Wrangler prints version.
- Cloudflare account/auth details are returned.

If auth fails:

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
Remove-Item Env:CLOUDFLARE_API_TOKEN -ErrorAction SilentlyContinue
npx wrangler login
Pop-Location
```

## 2) KV Namespace Setup
Create namespace:

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npx wrangler kv namespace create LICENSE_STORE
Pop-Location
```

Expected:
- Success message with namespace id.
- `worker-deploy/wrangler.jsonc` contains `kv_namespaces` binding for `LICENSE_STORE`.

Current known namespace id:
- `5a5a2125a7e14bf6b3e9b7b6d1e4441c`

## 3) Secret Provisioning (Required)
Set secrets (interactive; type values directly in terminal):

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npx wrangler secret put SIMPLEBEACON_SIGNING_PRIVATE_KEY
npx wrangler secret put STRIPE_WEBHOOK_SECRET
Pop-Location
```

Verify they exist:

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npx wrangler secret list
Pop-Location
```

Expected:
- At least two entries are listed.

## 4) Deploy Worker

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npx wrangler deploy
Pop-Location
```

Expected:
- Deployment succeeds.
- Routes include:
  - `simplebeacon.ai/*`
  - `www.simplebeacon.ai/*`

## 5) Post-Secret Validation Commands
Set local signing secret for test script parity:

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
$env:STRIPE_WEBHOOK_SECRET="whsec_your_production_secret_here"
Pop-Location
```

### 5.1 Positive webhook flow (expects 200 + minted token)

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npm run validate:webhook -- --base https://simplebeacon.ai --origin https://simplebeacon.ai
Pop-Location
```

Expected JSON fields:
- `ok: true`
- `webhookStatus: 200`
- `licenseStatus: "COMPLETED"`
- `tier` and `capabilities` present

### 5.2 Negative signature rejection (expects 400)

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npm run validate:webhook:negative -- --base https://simplebeacon.ai --origin https://simplebeacon.ai
Pop-Location
```

Expected JSON fields:
- `ok: true`
- `negativeSignature: true`
- `webhookStatus: 400`

### 5.3 Frontend polling simulation

```powershell
Push-Location "c:/Users/user/CascadeProjects/worker-deploy"
npm run validate:license -- --base https://simplebeacon.ai --origin https://simplebeacon.ai --session cs_test_active_id_here
Pop-Location
```

Expected JSON fields:
- `ok: true`
- `status: "COMPLETED"`
- `tier` present

## 6) Stripe Endpoint Configuration
In Stripe dashboard, configure production webhook destination to Worker host:

- Destination: `https://simplebeacon.ai/api/stripe-webhook`
- Subscribe only to:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
  - `invoice.paid`

## 7) Route Segmentation Policy

### Edge Worker (primary for Stripe webhooks)
- Accepts and verifies `Stripe-Signature`
- Signs JWT license using worker secret
- Stores token by `session_id` in KV
- Serves token retrieval via `/api/license`

### Render Backend (application API)
- Pricing/config APIs
- Checkout/session creation APIs
- General app logic
- Not primary Stripe webhook ingress for this architecture

## 8) Required Runtime Variables

### Worker vars in `worker-deploy/wrangler.jsonc`
- `ALLOWED_ORIGINS`
- `PRICE_ID_AGENCY`
- `PRICE_ID_ENTERPRISE`

### Worker secrets (Cloudflare)
- `SIMPLEBEACON_SIGNING_PRIVATE_KEY`
- `STRIPE_WEBHOOK_SECRET`

### Render secrets/env (backend)
- `RESEND_API_KEY`
- `RESEND_FROM`
- `STRIPE_SECRET_KEY`
- `STRIPE_WEBHOOK_SECRET`

## 9) Troubleshooting Quick Map

- Error: Missing `STRIPE_WEBHOOK_SECRET` in validator
  - Fix: Export `$env:STRIPE_WEBHOOK_SECRET` in current shell.

- Error: 403 from `/api/license`
  - Fix: Add calling origin to `ALLOWED_ORIGINS` and redeploy.

- Error: Webhook 400 in positive mode
  - Fix: Confirm local env secret equals deployed Worker webhook secret.

- Error: No token found in polling script
  - Fix: Use a real session id from successful webhook event and retry.

## 10) Files Touched in This Phase
- `worker-deploy/src/worker.js`
- `worker-deploy/wrangler.jsonc`
- `worker-deploy/package.json`
- `worker-deploy/scripts/validate-edge-webhook.mjs`
- `worker-deploy/scripts/validate-success-poll.mjs`
- `coming-soon/public/dashboard/success.html`
- `coming-soon/public/_redirects`
- `coming-soon/_redirects`
- `ai-platform/docs/outreach-cc-campaign.md`
