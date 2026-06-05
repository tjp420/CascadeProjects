# Production Deploy Gate

## Overview

The production deploy gate ensures all critical checks pass before deployment to simplebeacon.ai.

## Verification Tools

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

## Checklist

- [ ] Environment variables configured
- [ ] JWT secrets set
- [ ] Database connections tested
- [ ] Docker services running
- [ ] Health checks passing
- [ ] Tests passing with coverage

## Production Environment

Required files:
- `.env.production`
- `docker-compose.phase2.yml`
- `scripts/deploy-simplebeacon.sh`

## Status

Current: `productionStatus: artifacts_ready`
Target: `productionStatus: env_ready`
