Production secrets and deployment checklist
=======================================

Required environment variables (minimum):

- `STRIPE_SECRET_KEY` — your live Stripe secret (starts with `sk_live_...`).
- `STRIPE_WEBHOOK_SECRET` — signing secret for the live webhook endpoint (`whsec_...`).
- `RESEND_API_KEY` — Resend production API key (`re_...`).
- `RESEND_FROM` — verified sender address (e.g., `noreply@yourdomain.com`).

Optional rollover keys (recommended for zero-downtime rotation):

- `STRIPE_WEBHOOK_SECRET_2` or `STRIPE_WEBHOOK_SECRET_NEW`
- `RESEND_API_KEY_2` or `RESEND_API_KEY_NEW`

Quick guidance
--------------

- Always set production secrets in your hosting provider's secure secrets store (Render, Vercel, Netlify, or GitHub Actions Secrets). Do NOT commit secrets to the repo.
- Use the `ai-platform/scripts/verify-prod-env.js` script as a CI/deploy step to assert required variables exist and look sane.
- Example: add a GitHub Actions step that injects repository secrets and runs the verification (we include `./.github/workflows/verify-prod-env.yml`).

Host-specific notes
-------------------

- Vercel: use the Vercel dashboard or `vercel env add` to set `production` variables. Then redeploy.
- Render: set environment variables in the Service's Dashboard (Environment → Add Environment Variable) or via the Render API.
- Docker/Kubernetes: provide secrets via the orchestration platform's secret store and mount as env vars in the deployment manifest.

Rotation strategy (recommended)
-------------------------------

1. Add new secret fields alongside the existing ones (`*_NEW` or `_2`).
2. Update your verification / startup logic to check for either key and prefer the `*_NEW` value if present.
3. Deploy with both keys present; verify traffic and signed events using the new key.
4. Remove the old key after a successful verification window.
