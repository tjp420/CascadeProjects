# Launch Readiness Scorecard

Updated: 2026-05-25  
Framework scope: `simplebeacon.ai` go/no-go (in-repo + operator dependencies)

## Weighted formula

- Technical: 30%
- Security: 25%
- Operational: 20%
- Quality: 15%
- Business: 10%

Overall score formula:

`overall = technical*0.30 + security*0.25 + operational*0.20 + quality*0.15 + business*0.10`

Scoring scale:

- 90-100: Ready to launch
- 75-89: Conditionally ready
- 60-74: Not ready (close blockers first)
- <60: Early/not ready

Current weighted score (today): **66.5 / 100**

## Category score summary

- Technical: **72/100** (IN_PROGRESS)
- Security: **68/100** (IN_PROGRESS)
- Operational: **64/100** (IN_PROGRESS)
- Quality: **84/100** (COMPLETE for in-repo tranche)
- Business: **45/100** (BLOCKED by host/org tasks)

## Evidence-backed checklist

| Category | Item | Weight in Category | Status | Evidence | Owner |
|---|---|---:|---|---|---|
| Technical | Predeploy sequence executable and deterministic | 30% | COMPLETE | `npm run verify:predeploy`, `tools/verify-predeploy-sequence.js`, `.simplebeacon/launch-verify-predeploy.txt` | Platform Eng |
| Technical | Production env validator consistency (no contradictory checks) | 30% | COMPLETE | `tools/verify-production-deploy-readiness.js`, `.simplebeacon/verify-production-deploy.tranche2.txt` | Platform Eng |
| Technical | Docker/Phase2 config verification path | 20% | COMPLETE | `npm run simplebeacon:docker:config`, `.simplebeacon/docker-config.rendered.local.yml` | Platform Eng |
| Technical | Production host env completeness | 20% | BLOCKED | `.simplebeacon/launch-verify-predeploy.txt` (`JWT_EXPIRES_IN`, `REFRESH_TOKEN_EXPIRES_IN`) | SRE/Operations |
| Security | REQUIRE_AUTH fail-fast safety checks | 25% | COMPLETE | `server/bootstrap/phase2-integration.js` | Security + Platform |
| Security | Stripe config diagnostics/fail-fast | 25% | COMPLETE | `tools/verify-stripe-config.js`, `.simplebeacon/verify-stripe.tranche2.txt` | Security + Billing Ops |
| Security | Compliance gate pass | 25% | COMPLETE | `npm run compliance:check`, `.simplebeacon/launch-compliance-check.txt` | Security |
| Security | Live secrets + webhook secret provisioning | 25% | BLOCKED | `.simplebeacon/launch-verify-predeploy.txt` (missing `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) | Security + SRE |
| Operational | CI deploy gate summary includes GO/NO-GO evidence | 25% | COMPLETE | `.github/workflows/deploy-production.yml`, `.simplebeacon/deploy-gate-markers.tranche2.txt` | DevEx |
| Operational | Launch readiness framework artifact generation | 25% | COMPLETE | `npm run verify:launch-readiness`, `.simplebeacon/launch-readiness-summary.json` | Platform Eng |
| Operational | Trust publish local artifact + audit evidence | 25% | COMPLETE | `npm run trust:publish`, `public/trust-verification.json`, `.simplebeacon/trust-publish-audit.json` | Platform Eng |
| Operational | Remote trust publish endpoint/token | 25% | IN_PROGRESS | `.simplebeacon/launch-trust-validate-env.txt` (non-blocking warnings) | DevOps |
| Quality | Trust/compliance precheck green | 50% | COMPLETE | `npm run security:scan` in predeploy flow, `.simplebeacon/launch-verify-predeploy.txt` | QA + Security |
| Quality | Schema/consistency/compliance checks green | 50% | COMPLETE | `.simplebeacon/launch-compliance-check.txt` (8/8 pass) | QA |
| Business | Stripe monetization configuration ready | 40% | BLOCKED | `.simplebeacon/launch-verify-predeploy.txt` | Billing Ops |
| Business | Production branch protection + governance sign-off | 30% | BLOCKED | `docs/production-profile-verification-status.md` blockers | Repo Admin + Security |
| Business | Legal/business launch approvals | 30% | BLOCKED | requires org sign-off (not in repo) | Product/Leadership/Legal |

## PASS/FAIL reconciliation (today)

From current execution artifacts:

- FAIL: predeploy final decision (`Decision: NO-GO`)
  - evidence: `.simplebeacon/launch-verify-predeploy.txt`
- PASS: compliance gate
  - evidence: `.simplebeacon/launch-compliance-check.txt`
- PASS: trust env validation (non-strict mode)
  - evidence: `.simplebeacon/launch-trust-validate-env.txt`
- PASS: trust publish local artifact + audit
  - evidence: `.simplebeacon/launch-trust-publish.txt`, `.simplebeacon/trust-publish-audit.json`
- PASS: trust trend command executes
  - evidence: `.simplebeacon/launch-trust-trend.txt`

Current launch gate interpretation:

- **In-repo quality/compliance/trust checks are largely green.**
- **Launch remains blocked by production env + Stripe secret provisioning and org/ops approvals.**

## Owner placeholders

- Platform Eng: `<owner-platform>`
- Security: `<owner-security>`
- SRE/Operations: `<owner-sre>`
- Billing Ops: `<owner-billing>`
- Repo Admin/DevEx: `<owner-repo-admin>`
- Product/Leadership/Legal: `<owner-business>`
