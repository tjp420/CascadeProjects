# Production Deploy Gate

## Overview

The production deploy gate ensures all critical checks pass before deployment to simplebeacon.ai.

## Verification Tools

### Pre-Deploy Gate (runs before every deployment)

```bash
npm run verify:predeploy
```

This gate checks:

- Simplebeacon scan gate passes (no blocking issues)
- npm audit clean (no high/critical vulnerabilities)
- Tests passing
- Required production files present
- Lint clean
- Build succeeds with artifacts

### Local Verification

```bash
npm run verify:v1-internal-profile
```

### Production Verification

```bash
npm run verify:production-deploy
```

## Deploy Script

```bash
npm run simplebeacon:deploy
```

## CI/CD Integration

The `predeploy-gate` job runs in GitHub Actions on the `main` branch after all upstream checks (hygiene, tests, security audit) complete. It blocks the `build-test` job if any gate fails.

### Pipeline Flow

```
hygiene-gate → test-coverage → phase2-tests → security-audit
                                                    ↓
                                          predeploy-gate
                                                    ↓
                                              build-test
                                                    ↓
                                              gate-summary
```

## Checklist

- [x] Environment variables configured (`.env.production` present)
- [x] JWT secrets set (64-char production secrets)
- [x] Database connections configured (`POSTGRES_*` vars set)
- [x] Docker compose configuration present (`docker-compose.phase2.yml`)
- [x] Health checks passing (`server/index.cjs` verified)
- [x] Security headers enabled (`HELMET_ENABLED=true`)
- [x] Rate limiting enabled (`RATE_LIMIT_ENABLED=true`)
- [x] Monitoring enabled (`MONITORING_ENABLED=true`, `METRICS_ENABLED=true`)
- [x] Pre-deploy gate wired (`tools/verify-predeploy-sequence.js`)
- [x] Tests passing with coverage (`npm test` + auth-middleware, assessment-controller tests added)
- [x] Docker services configured (`npm run phase2:infra` to start)

## Production Environment

Required files:

- `.env.production` — ✅ configured
- `docker-compose.phase2.yml` — ✅ present
- `scripts/deploy-simplebeacon.sh` — ✅ present
- `docs/v1-internal-runbook.md` — ✅ present
- `tools/verify-predeploy-sequence.js` — ✅ present

## Status

Current: `productionStatus: artifacts_ready`
All checklist items complete. Run `npm run verify:predeploy` then `npm run verify:production-deploy` to confirm before deployment.
