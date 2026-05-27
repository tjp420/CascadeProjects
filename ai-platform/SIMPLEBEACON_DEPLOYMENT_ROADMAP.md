# Simplebeacon.ai Deployment Roadmap

Deployment plan for **simplebeacon.ai**, based on the measured Cascade AI Platform / Simplebeacon stack already in this repository — not a greenfield rewrite.

## Overview

Transform the existing `ai-platform` dashboard into a production SaaS perimeter at **simplebeacon.ai**: Cloudflare front door, Dockerized dashboard, Simplebeacon CI gate, optional Phase 2 Postgres/Redis, and live metrics sync from GitHub Actions.

## Current Infrastructure (measured baseline)

| Component | Status |
|-----------|--------|
| **Domain** | simplebeacon.ai (Cloudflare) |
| **App server** | `gguf-dashboard-server.js` (Express, port **54355**) |
| **Simplebeacon UI** | `/simplebeacon-dashboard/` |
| **API** | `/api/simplebeacon/*`, `/api/ai-validation/*` (aliases) |
| **Docker** | `docker-compose.simplebeacon.yml` (+ dev/full overlays) |
| **CI gate** | `.github/workflows/simplebeacon-perimeter.yml` |
| **Tests** | 596/596 Jest (27 suites), 42/42 page sample specs |
| **Phase 2 DB** | Optional Postgres + Redis (`docker-compose.simplebeacon.full.yml`) |
| **Fiction detection** | `.simplebeacon/baseline.json` → `rejectedFiction` |

**Repository layout:** monorepo root `CascadeProjects/` with app in `ai-platform/`. Deploy from `ai-platform/` unless noted.

**Related docs:**

- [packages/simplebeacon-cli/docs/DOCKER.md](packages/simplebeacon-cli/docs/DOCKER.md)
- [packages/simplebeacon-cli/docs/CI.md](packages/simplebeacon-cli/docs/CI.md)
- [packages/simplebeacon-cli/docs/GITHUB-ACTION-QUICKSTART.md](packages/simplebeacon-cli/docs/GITHUB-ACTION-QUICKSTART.md)

---

## Architecture

```mermaid
graph TD
  CF[Cloudflare DNS + WAF] --> NG[Nginx :443]
  NG --> APP[Dashboard :54355]
  APP --> SB[.simplebeacon state]
  APP --> PG[(Postgres optional)]
  APP --> RD[(Redis optional)]
  GHA[GitHub Actions perimeter] -->|POST /api/simplebeacon/scan| APP
  COL[metrics-collector container] -->|periodic scan| APP
```

---

## Phase 1: DNS & SSL (1–2 days)

### Cloudflare DNS

- [ ] Log into Cloudflare for **simplebeacon.ai**
- [ ] Add records (replace `YOUR_SERVER_IP`):
  - `A` — `simplebeacon.ai` → server IP (proxied)
  - `A` — `www.simplebeacon.ai` → server IP (proxied)
  - `CNAME` — `api.simplebeacon.ai` → `simplebeacon.ai` (proxied, optional)
- [ ] TTL: 3600 during setup; increase after stable
- [ ] Enable proxy (orange cloud)

### SSL/TLS

- [ ] Encryption mode: **Full (strict)** if origin has valid cert; **Full** if using Cloudflare origin cert
- [ ] Enable **Always Use HTTPS**
- [ ] Enable **Automatic HTTPS Rewrites**
- [ ] Minimum TLS **1.2**; enable TLS 1.3

### Redirects

- [ ] Redirect `http://*` → `https://` (Cloudflare **Redirect Rules** or legacy Page Rules)
- [ ] Canonical host: pick `simplebeacon.ai` or `www` and redirect the other

### Optional

- [ ] Enable DNSSEC if plan supports it

---

## Phase 2: Server Preparation (2–3 days)

### Recommended specs

| Resource | Minimum | Recommended |
|----------|---------|-------------|
| CPU | 2 vCPU | 4 vCPU |
| RAM | 4 GB | 8 GB |
| Disk | 40 GB SSD | 80 GB SSD |
| OS | Ubuntu 22.04 LTS | Ubuntu 24.04 LTS |

Providers: DigitalOcean, Hetzner, Linode, AWS EC2 (t3.medium).

### Initial hardening

- [ ] SSH key auth only; disable password login
- [ ] Firewall:
  ```bash
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw enable
  ```
- [ ] Install fail2ban:
  ```bash
  sudo apt install -y fail2ban
  sudo systemctl enable --now fail2ban
  ```
- [ ] Unattended upgrades:
  ```bash
  sudo apt install -y unattended-upgrades
  sudo dpkg-reconfigure -plow unattended-upgrades
  ```

### Runtime dependencies

- [ ] System update: `sudo apt update && sudo apt upgrade -y`
- [ ] Docker Engine + Compose plugin:
  ```bash
  curl -fsSL https://get.docker.com | sudo sh
  sudo usermod -aG docker $USER
  ```
- [ ] Nginx: `sudo apt install -y nginx`
- [ ] Git: `sudo apt install -y git`

Node.js is **inside the Docker image** (`docker/Dockerfile.dashboard`). Host Node is optional (for debugging only).

---

## Phase 3: Application Deployment (1–2 days)

### Clone & paths

```bash
sudo mkdir -p /var/www/simplebeacon
sudo chown $USER:$USER /var/www/simplebeacon
git clone <repository-url> /var/www/simplebeacon
cd /var/www/simplebeacon/ai-platform
```

### Environment

- [ ] Copy templates:
  ```bash
  cp .env.example .env.production
  cp docker/env.simplebeacon.example .env.docker
  ```
- [ ] Production values (adjust secrets):

  ```env
  NODE_ENV=production
  BASE_URL=https://simplebeacon.ai
  CORS_ORIGIN=https://simplebeacon.ai

  # Phase 2 (enable with --profile full)
  ENABLE_DATABASE=true
  ENABLE_REDIS=true
  DATABASE_URL=postgresql://cascade_user:CHANGE_ME@postgres:5432/cascade_ai_platform
  REDIS_URL=redis://redis:6379
  REQUIRE_AUTH=true

  JWT_SECRET=<openssl rand -hex 32>
  JWT_REFRESH_SECRET=<openssl rand -hex 32>
  SESSION_SECRET=<openssl rand -hex 32>

  SIMPLEBEACON_PORT=54355
  SIMPLEBEACON_COLLECT_INTERVAL_SEC=600
  ```

- [ ] Commit **never** includes `.env.production` — file permissions `600`

### Docker deploy (recommended)

From `ai-platform/`:

```bash
# Dashboard only
npm run simplebeacon:docker:detached

# Dashboard + metrics collector + Postgres + Redis
npm run simplebeacon:docker:full
```

Verify:

```bash
docker ps
curl -s http://127.0.0.1:54355/api/simplebeacon/baseline | head
curl -s http://127.0.0.1:54355/api/health
```

**URLs after deploy:**

| Surface | Path |
|---------|------|
| Simplebeacon UI | `https://simplebeacon.ai/simplebeacon-dashboard/` |
| Dashboard API | `https://simplebeacon.ai/api/simplebeacon/dashboard` |
| Health | `https://simplebeacon.ai/api/health` |
| DB health | `https://simplebeacon.ai/api/health/db` (when `ENABLE_DATABASE=true`) |

### Nginx reverse proxy

Create `/etc/nginx/sites-available/simplebeacon`:

```nginx
server {
    listen 80;
    server_name simplebeacon.ai www.simplebeacon.ai;

    location / {
        proxy_pass http://127.0.0.1:54355;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 120s;
    }
}
```

Enable:

```bash
sudo ln -sf /etc/nginx/sites-available/simplebeacon /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

Cloudflare terminates public TLS; origin can stay on HTTP :80 behind Full SSL, or add Let's Encrypt on origin for Full (strict).

### PM2 alternative (non-Docker)

Only if not using Compose:

```bash
cd /var/www/simplebeacon/ai-platform
npm ci --omit=dev
pm2 start gguf-dashboard-server.js --name simplebeacon -i 2
pm2 save && pm2 startup
```

Prefer Docker for parity with local dev and CI.

---

## Phase 4: Database Setup (1 day)

Included in `npm run simplebeacon:docker:full` via Compose profiles.

### Postgres (container)

- [ ] Change default password in `docker-compose.simplebeacon.yml` / `.env.docker`
- [ ] Schema auto-applies when `ENABLE_DATABASE=true` (`server/db/schema-phase2.sql` via `setupPhase2Integration`)
- [ ] Optional demo seed: `SEED_DEMO_USERS=true` (disable in production)

### Backups

```bash
# Example cron (host or docker exec)
0 2 * * * docker exec simplebeacon_postgres pg_dump -U cascade_user cascade_ai_platform | gzip > /backups/simplebeacon_$(date +\%Y\%m\%d).sql.gz
```

- [ ] Retention: 7 daily, 4 weekly, 12 monthly
- [ ] Off-site copy (S3, B2, etc.)

### Redis

- [ ] Enabled with `ENABLE_REDIS=true` in full profile
- [ ] Persistence: configure in production Redis config if moving off default Alpine image

---

## Phase 5: CI/CD Integration (1–2 days)

### Existing workflows (do not duplicate)

| Workflow | Purpose |
|----------|---------|
| `simplebeacon-perimeter.yml` | Full scan + Jest + PR comment + optional dashboard webhook |
| `simplebeacon.yml` | Lightweight composite-action gate |
| `dashboard-ci.yml` | Jest + coverage + Compose config smoke |

### GitHub secrets for live dashboard sync

| Secret | Example |
|--------|---------|
| `SIMPLEBEACON_DASHBOARD_URL` | `https://simplebeacon.ai` |
| `SIMPLEBEACON_DASHBOARD_TOKEN` | Optional Bearer token |

Perimeter workflow POSTs to `/api/simplebeacon/scan` after each run.

### Production deploy workflow (add when server is ready)

Create `.github/workflows/deploy-production.yml` at repo root:

```yaml
name: Deploy Production
on:
  push:
    branches: [main]
    paths: ['ai-platform/**']

jobs:
  gate:
    uses: ./.github/workflows/simplebeacon-perimeter.yml  # or call jobs inline

  deploy:
    needs: gate
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    steps:
      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /var/www/simplebeacon
            git pull origin main
            cd ai-platform
            npm run simplebeacon:docker:full
            curl -fsS https://simplebeacon.ai/api/health
```

- [ ] Add secrets: `SERVER_HOST`, `SERVER_USER`, `SSH_PRIVATE_KEY`
- [ ] Test rollback: `git revert` + re-run `simplebeacon:docker:full`

### Pre-deploy gate (local / CI)

```bash
cd ai-platform
npm run simplebeacon:report    # exits 1 on high-severity gate failure
npm test -- --no-coverage
```

---

## Phase 6: Monitoring & Logging (1 day)

### Health checks

| Endpoint | Use |
|----------|-----|
| `GET /api/health` | Liveness |
| `GET /api/health/db` | Postgres (Phase 2) |
| `GET /api/health/redis` | Redis (Phase 2) |
| `GET /api/simplebeacon/baseline` | Simplebeacon state |

Docker healthcheck already probes `/api/simplebeacon/baseline`.

### External uptime

- [ ] UptimeRobot / Better Stack: monitor `https://simplebeacon.ai/api/health`
- [ ] Alert on 5xx or timeout > 30s

### Logging

- [ ] Winston is a dependency — wire structured logs to `/var/log/simplebeacon/` if not already
- [ ] Logrotate:
  ```
  /var/log/simplebeacon/*.log {
      daily
      rotate 14
      compress
      missingok
      notifempty
  }
  ```
- [ ] Optional: Sentry (`SENTRY_DSN` in env templates)

### Cloudflare

- [ ] Enable analytics and security events dashboard
- [ ] Alert on traffic spikes / WAF blocks

---

## Phase 7: Security Hardening (1–2 days)

### Cloudflare WAF

- [ ] Enable managed rulesets
- [ ] Rate limit `/api/simplebeacon/scan` (POST) — e.g. 10 req/min/IP
- [ ] Bot Fight Mode for public HTML routes

### Application

- [ ] `REQUIRE_AUTH=true` in production
- [ ] Helmet already in dependencies — confirm enabled on dashboard server
- [ ] CORS: restrict to `https://simplebeacon.ai` (see `.env.example`)
- [ ] Rotate JWT/session secrets; never commit `.env.production`

### Simplebeacon gate (fiction / leaks)

```bash
npm run simplebeacon:report   # blocks on high severity with --gate
```

Rejected fiction patterns: 62% completion, 47 features, legacy rejected fiction metrics (confidence not instrumented), etc. (see `.simplebeacon/baseline.json`).

---

## Phase 8: Backup & Disaster Recovery (1 day)

- [ ] Postgres dumps (daily, see Phase 4)
- [ ] Volume backup: `simplebeacon_state` (`.simplebeacon/report.json`, `history.json`, `baseline.json`)
- [ ] Config backup: `.env.production`, Nginx site, Compose overrides
- [ ] Quarterly restore drill
- [ ] Runbook: server loss, DB corruption, credential leak, DDoS

---

## Phase 9: Performance (1–2 days)

### Cloudflare CDN

- [ ] Cache static assets under `/web/` aggressively
- [ ] Bypass cache for `/api/*`
- [ ] Brotli enabled

### Application

- [ ] Redis snapshot cache when `ENABLE_REDIS=true`
- [ ] Metrics collector interval: tune `SIMPLEBEACON_COLLECT_INTERVAL_SEC` (default 600)

### Load test

- [ ] k6 or artillery against `/api/simplebeacon/dashboard` and `/api/health`
- [ ] Target: p95 < 500ms at expected concurrency

---

## Phase 10: Launch Checklist (1 day)

### Pre-launch

- [ ] DNS propagated (`dig simplebeacon.ai`)
- [ ] HTTPS valid end-to-end
- [ ] `npm run simplebeacon:report` clean (0 high issues)
- [ ] `npm test` green (596/596)
- [ ] `GET /api/simplebeacon/dashboard` returns measured data (not fiction KPIs)
- [ ] PR perimeter workflow posts comment + optional webhook
- [ ] `REQUIRE_AUTH` behavior verified
- [ ] Backups running
- [ ] Monitoring alerts tested

### Launch

- [ ] `npm run simplebeacon:docker:full` on production host
- [ ] Smoke: open `/simplebeacon-dashboard/`
- [ ] Trigger manual scan: `curl -X POST https://simplebeacon.ai/api/simplebeacon/scan -H "Content-Type: application/json" -d '{}'`

---

## Post-Launch

| Period | Tasks |
|--------|-------|
| Week 1 | Watch logs, error rate, scan gate failures |
| Month 1 | Review Cloudflare WAF; tune collector interval |
| Ongoing | Dependency updates, baseline sync after Jest count changes, backup verification |

---

## Troubleshooting

| Symptom | Checks |
|---------|--------|
| App won't start | `docker logs simplebeacon_dashboard`; port 54355 free |
| Gate fails in CI | Read `.simplebeacon/report.json` → `rawIssues`; fix fiction KPIs |
| 502 from Nginx | `curl localhost:54355/api/health`; container health |
| DB errors | `docker logs simplebeacon_postgres`; `GET /api/health/db` |
| SSL loop | Cloudflare mode vs origin cert mismatch |

---

## Timeline & Cost

| Phase | Duration |
|-------|----------|
| 1 DNS/SSL | 1–2 days |
| 2 Server | 2–3 days |
| 3 Deploy | 1–2 days |
| 4 Database | 1 day |
| 5 CI/CD | 1–2 days |
| 6 Monitoring | 1 day |
| 7 Security | 1–2 days |
| 8 Backup | 1 day |
| 9 Performance | 1–2 days |
| 10 Launch | 1 day |

**Total:** ~12–17 days

**Estimated monthly cost:** $35–100 (VPS $20–40, backups $0–10, monitoring $0–20, Cloudflare free tier).

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Uptime | 99.9% |
| API p95 latency | < 500ms |
| Simplebeacon gate | 0 high-severity on main |
| Jest baseline | 596/596 passing |
| Page samples | 42/42 repository-audit |
| Backup success | 100% daily |

---

## Next Steps

1. **Today:** Phase 1 — point Cloudflare A records at server IP
2. **Week 1:** Phases 2–3 — server + `npm run simplebeacon:docker:full`
3. **Week 2:** Phases 5–6 — wire `SIMPLEBEACON_DASHBOARD_URL` secret; uptime monitoring
4. **Week 3:** Phases 7–9 — WAF, auth, load test
5. **Week 4:** Phase 10 — launch at `https://simplebeacon.ai/simplebeacon-dashboard/`

---

*Last updated: 2026-05-24 · Version 1.0 · Aligned to measured repo baseline (596/596, 42/42, docker-compose.simplebeacon.yml)*
