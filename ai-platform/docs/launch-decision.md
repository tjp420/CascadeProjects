# Launch Decision

Date: 2026-05-25  
Scope: `simplebeacon.ai` production launch decision using current repo evidence

## Today status

Launch now? **NO**

Decision basis:

- `npm run verify:predeploy` returns `Decision: NO-GO`
- compliance and trust checks pass, but production/Stripe predeploy checks fail on required env/secrets

Primary evidence:

- `.simplebeacon/launch-verify-predeploy.txt`
- `.simplebeacon/launch-compliance-check.txt`
- `.simplebeacon/launch-trust-validate-env.txt`
- `.simplebeacon/launch-trust-publish.txt`
- `.simplebeacon/launch-readiness-summary.json`
- `docs/launch-readiness-scorecard.md`

## Minimum tasks to change decision to YES

1. Provision missing required production env values on deploy host:
   - `JWT_EXPIRES_IN`
   - `REFRESH_TOKEN_EXPIRES_IN`
2. Provision Stripe live/billing secrets for enabled monetization:
   - `STRIPE_SECRET_KEY`
   - `STRIPE_WEBHOOK_SECRET`
3. Re-run launch gate and obtain `GO`:
   - `npm run verify:launch-readiness`
   - expected output: `Decision: GO`
4. Confirm branch protection / required checks governance in GitHub.

## Exact blocker mapping

| Blocker | Type | Evidence | Owner |
|---|---|---|---|
| Missing `JWT_EXPIRES_IN` | Host env | `.simplebeacon/launch-verify-predeploy.txt` | SRE/Operations |
| Missing `REFRESH_TOKEN_EXPIRES_IN` | Host env | `.simplebeacon/launch-verify-predeploy.txt` | SRE/Operations |
| Missing `STRIPE_SECRET_KEY` | Secret provisioning | `.simplebeacon/launch-verify-predeploy.txt` | Billing Ops + Security |
| Missing `STRIPE_WEBHOOK_SECRET` | Secret provisioning | `.simplebeacon/launch-verify-predeploy.txt` | Billing Ops + Security |
| Branch protection/required checks not attested | Governance | `docs/production-profile-verification-status.md` | Repo Admin/DevEx |
| Security/ops/org launch sign-offs | Governance | `docs/production-profile-verification-status.md` | Security, SRE, Product/Legal |

## 7-day plan (critical unblock plan)

### Day 1-2 (SRE + Security + Billing Ops)

- Set missing host env/secrets in production secret manager/host config.
- Commands:

```bash
cd C:/Users/Trevor/CascadeProjects/ai-platform
npm run verify:production-deploy
npm run verify:stripe
```

Expected: both commands pass with no blocking FAIL lines.

### Day 3-4 (Platform Eng + QA)

- Re-run full launch gate and ensure deterministic output.
- Commands:

```bash
cd C:/Users/Trevor/CascadeProjects/ai-platform
npm run verify:launch-readiness
npm run verify:predeploy
```

Expected: both show `Decision: GO`.

### Day 5-7 (DevEx + Repo Admin + Security)

- Enforce/verify required workflow checks and document sign-off.
- Commands (evidence regeneration):

```bash
cd C:/Users/Trevor/CascadeProjects/ai-platform
npm run trust:publish
npm run trust:trend
npm run compliance:check
```

Expected: trust/compliance evidence artifacts updated and attached to release review.

## 14-day plan (stabilize and launch)

### Week 2, Days 8-10 (SRE + Platform Eng)

- Perform production dry run deployment and post-deploy smoke.
- Commands:

```bash
cd C:/Users/Trevor/CascadeProjects/ai-platform
npm run verify:launch-readiness
npm run simplebeacon:deploy
npm run smoke:test:production
```

Expected: deploy succeeds, production smoke passes.

### Week 2, Days 11-14 (Security + Product/Legal + Leadership)

- Final governance/legal/ops decision meeting with evidence.
- Commands (fresh decision snapshot):

```bash
cd C:/Users/Trevor/CascadeProjects/ai-platform
npm run verify:launch-readiness
npm run trust:trend
```

Expected: final `GO` decision + owner-confirmed sign-offs recorded.
