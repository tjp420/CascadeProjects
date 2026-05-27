# Launch GO Operator Checklist (Current)

Updated: 2026-05-25  
Scope: minimum host-side + rerun steps required to move launch from `NO-GO` to `GO`.

## Current decision snapshot

- Decision: `NO-GO`
- In-repo gate status: compliance/trust checks pass; predeploy fails on production env + Stripe secret requirements.
- Evidence:
  - `.simplebeacon/launch-verify-predeploy.current.txt`
  - `.simplebeacon/launch-verify-production.current.txt`
  - `.simplebeacon/launch-verify-stripe.current.txt`
  - `.simplebeacon/launch-verify-launch-readiness.current.txt`
  - `.simplebeacon/launch-readiness-summary.json`

## 1) Exact host-side values to set (minimum)

Set these in the production host secret manager / `.env.production`:

```bash
JWT_EXPIRES_IN=7d
REFRESH_TOKEN_EXPIRES_IN=30d
STRIPE_SECRET_KEY=<rk_live_or_sk_live_value>
STRIPE_WEBHOOK_SECRET=<whsec_value>
```

Notes:
- Keep `SIMPLEBEACON_MONETIZATION_ENABLED=true` only if Stripe live keys are provisioned.
- Existing price IDs are already present in current env and verifier output.

## 2) Re-run command sequence (exact)

Run from `C:/Users/Trevor/CascadeProjects/ai-platform`:

```bash
npm run verify:stripe
npm run verify:production-deploy
npm run verify:predeploy
npm run verify:launch-readiness
```

## 3) Expected success criteria to declare GO

All of the following must be true:

1. `npm run verify:stripe` exits `0` with no `Missing STRIPE_SECRET_KEY` and no `STRIPE_WEBHOOK_SECRET is required` failure.
2. `npm run verify:production-deploy` exits `0` with no `FAIL` lines.
3. `npm run verify:predeploy` prints `Decision: GO`.
4. `npm run verify:launch-readiness` prints `Decision: GO`.
5. `.simplebeacon/launch-readiness-summary.json` shows:
   - `"decision": "GO"`
   - `"failed": 0`

## 4) Remaining non-repo sign-off gates (cannot be auto-completed here)

- Branch protection + required checks attestation (Repo Admin/DevEx).
- Security/ops/business final launch sign-offs.
- Optional remote trust publish endpoint/token provisioning if strict remote publication is required by policy.
