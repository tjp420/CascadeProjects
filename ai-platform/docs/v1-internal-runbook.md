# v1.0-internal Deploy Runbook (Solo Maintainer)

Measured scope for an internal dashboard host — not a multi-FTE enterprise rollout.

## Prerequisites

- Node 20.x, `npm ci`

### Port matrix

| Profile | Env file | Default port | Start command |
|---------|----------|--------------|---------------|
| **v1-internal dashboard** | `.env.v1-internal` | **54355** | `npm run dashboard:v1-internal` |
| Legacy API server | `.env` | 3000 | `node server/index.js` (or project server script) |

The dashboard binds **54355** in `simplebeacon-server.js`. Root `.env` / `.env.example` use **3000** for the legacy API — do not point Analyze or SPA tabs at 3000 when running v1-internal.

**URLs:** `http://localhost:54355/app` · vault: `/private-dashboard-vault?password=…` · health: `GET /api/health`
- `npm test` → 560/560 passing
- `node tools/verify-roadmap-alignment.js` → all OK
- `node tools/verify-mock-scan.js` → `issues: 0` (server running)

## 1. Configure environment

```bash
cp .env.v1-internal.example .env.v1-internal
# Edit JWT_SECRET and JWT_REFRESH_SECRET — do not use demo defaults on a shared host
```

## 2. Optional Postgres + Redis

```bash
npm run phase2:infra
```

Uncomment `ENABLE_DATABASE`, `DATABASE_URL`, `ENABLE_REDIS`, and `REDIS_URL` in `.env.v1-internal`.

### Database backup (local dev)

When `ENABLE_DATABASE=true` and PostgreSQL is running:

```bash
npm run backup:database
```

- Writes `./backups/postgresql/cascade_ai_platform_<timestamp>.sql`
- Requires `pg_dump` on PATH (PostgreSQL client tools)
- Keeps backups for 7 days, then prunes older files
- No-op when the database is disabled

### Query logging (debugging)

Log every SQL query from `DatabaseAdapter` (not just slow queries):

```bash
LOG_QUERIES=true npm run dashboard
```

Slow queries (>100ms) are still logged when `LOG_QUERIES` is unset. Override threshold with `DB_SLOW_QUERY_MS`.

## 3. Start with auth required

```bash
# PowerShell
$env:DOTENV_CONFIG_PATH='.env.v1-internal'
node -r dotenv/config simplebeacon-server.js

# Bash
DOTENV_CONFIG_PATH=.env.v1-internal node -r dotenv/config simplebeacon-server.js
```

Or: `npm run dashboard:v1-internal` (loads `.env.v1-internal` when present; auto-enables ephemeral JWT secrets when placeholders remain).

### Login troubleshooting (local)

| Symptom | Cause | Fix |
|---------|-------|-----|
| Server exits or logs `Phase 2 bootstrap failed` | Placeholder `JWT_SECRET` with `REQUIRE_AUTH=true` | Run `npm run dashboard:v1-internal` (not raw `node` with `REQUIRE_AUTH=false`) |
| `POST /api/auth/login` returns 404 | Auth routes never mounted after bootstrap failure | Same as above; check console for JWT secret errors |
| Login succeeds but UI sends you to pricing | Server started without `SIMPLEBEACON_INTERNAL_DASHBOARD=true` | Use `npm run dashboard:v1-internal` / `.env.v1-internal` |
| 401 on API calls after "login" | Token not in storage | SPA stores `cascadeAuthToken`; legacy pages also accept `access_token`, `token`, `authToken` |
| Invalid email or password | Wrong credentials | Demo user: `dev@simplebeacon.ai` / `demo123` |

**Working login (PowerShell):**

```powershell
$body = @{ email = 'dev@simplebeacon.ai'; password = 'demo123' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:54355/api/auth/login' -ContentType 'application/json' -Body $body
```

Expected: HTTP 200, JSON with `token` and `user.email` = `dev@simplebeacon.ai`.

**Dashboard URL after login:** `http://localhost:54355/` or `http://localhost:54355/#/dashboard`

## 4. Smoke checks

| Check | Expected |
|-------|----------|
| `GET /api/platform/status` | `authRequired: true` |
| `GET /api/health` | `200`, no token |
| `POST /api/auth/login` with demo user | JWT returned |
| Protected `/api/*` without `Authorization` | `401` |
| Dashboard `http://localhost:54355/` | Simplebeacon SPA loads after login |
| `GET /api/simplebeacon/billing/plan` | Pricing tiers JSON (public) |
| Legacy `/dashboard-new.html` | `301` redirect to `/` |

Demo credentials (file-backed when DB disabled): `dev@simplebeacon.ai` / `demo123` — rotate or disable for production-like hosts.

## 5. Rollback

1. Stop the Node process.
2. Restore previous `.env.v1-internal` or set `REQUIRE_AUTH=false`.
3. Redeploy prior git tag / backup.

## 6. Sign-off checklist

- [ ] Secrets not committed to git
- [ ] `REQUIRE_AUTH=true` verified via integration tests (`npm test -- tests/integration/phase2-integration.test.js`)
- [ ] Local profile verified (`npm run verify:v1-internal-profile`)
- [ ] Maintainer accepts solo scope (no enterprise RBAC matrix required)

## 7. Production deploy (simplebeacon.ai)

### Pre-flight on the host

```bash
cp .env.production.example .env.production
# Edit required values listed in docs/production-operator-predeploy-checklist.md
npm run verify:predeploy
```

Reference: `docs/production-operator-predeploy-checklist.md` is the canonical Week 1-2 operator checklist.

### Docker Phase2 production verification

```bash
# Render and validate merged production compose config
npm run simplebeacon:docker:config

# Start full stack in detached mode (dashboard + collector + postgres + redis)
npm run simplebeacon:docker:full

# Verify container health and auth posture
docker compose -f docker-compose.simplebeacon.yml -f docker-compose.simplebeacon.full.yml --profile full ps
curl -fsS http://127.0.0.1:54355/api/platform/status | jq '.phase, .authRequired, .database, .redis'
curl -i http://127.0.0.1:54355/api/analyze/providers | head -n 1
```

Expected:
- `simplebeacon:docker:config` exits `0`
- `docker compose ... ps` shows `dashboard`, `postgres`, `redis` as `healthy`
- `/api/platform/status` includes `"authRequired": true`
- anonymous `/api/analyze/providers` returns `HTTP/1.1 401` when `REQUIRE_AUTH=true`

Teardown:

```bash
npm run simplebeacon:docker:down
```

### Deploy

**Option A — Docker on origin**

```bash
npm run simplebeacon:deploy
```

**Option B — Cloudflare Tunnel**

```bash
# See docker/cloudflared/config.yml
cloudflared tunnel login
cloudflared tunnel create simplebeacon
cloudflared tunnel route dns simplebeacon simplebeacon.ai
docker compose -f docker-compose.simplebeacon.yml -f docker/cloudflared/docker-compose.cloudflared.yml up -d
```

### Stripe webhook

Register `https://simplebeacon.ai/api/simplebeacon/billing/webhook` in Stripe Dashboard.

### Production smoke test

1. https://simplebeacon.ai — login (no demo users)
2. Run scan from Analyze or Dashboard
3. Pricing page → checkout → webhook confirms subscription

When smoke test passes, roadmap **deploy sign-off** gate is cleared.
