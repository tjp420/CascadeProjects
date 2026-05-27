# Frontend–Backend Wiring Status

**Verified:** 2026-05-25 (subagent pass)  
**Server:** `node gguf-dashboard-server.js` → **http://localhost:54355**  
**Legacy pages:** `/dashboard.html`, `/code-upload.html`

## Executive summary

Prior subagent fixes **did land** in the frontend (script tags, `CodeUploadService`, `dashboard-mock-wiring.js`), but the **gguf-dashboard-server on port 54355 was missing the repository scanner routes** that live in `server/index.js` (port 3000). With `REQUIRE_AUTH=true`, those missing routes returned **401** before any handler ran, which made the UI look disconnected/fake.

This pass **mounted scanner APIs on 54355**, whitelisted read-only dashboard routes in `public-api-routes.js`, added **`GET /api/upload/history`**, and removed mock upload-history fallback data.

## Connected vs still static

| Surface | Status | Data source |
|---------|--------|-------------|
| `dashboard.html` script loading | **Connected** | `dashboard-inline-core.js`, `dashboard-mock-wiring.js`, etc. (lines 1192–1195) |
| Mock analyzer stats (`—` placeholders) | **Connected** | `GET /api/mock-analysis`, `POST /api/models/active/analyze` |
| Mock analyzer action buttons | **Connected** | `/api/mock-conversion`, `/api/mock-validation`, `/api/mock-cleaning` |
| Default stats grid (`#default-stats-grid`) | **Connected on load** | `GET /api/project-structure` → `loadProjectStructureStats()` |
| Mock issue grid (TODO/FIXME) | **Connected on load** | `GET /api/backlog` → `loadBacklogStats()` |
| `code-upload.html` file drop | **Connected** | `POST /api/upload/files` via `CodeUploadService` |
| Upload recent list + stat cards | **Connected** | sessionStorage + `GET /api/upload/history` (auth when `REQUIRE_AUTH=true`) |
| `simulateUpload` | **Removed** | Not present anywhere in `web/` |
| Hardcoded **347 / 234** in `dashboard.html` | **Gone** | Replaced with `—` loading placeholders |
| Default stats HTML (892, 94.2%, …) | **Static until JS runs** | Overwritten when `/api/project-structure` returns |
| Cleaning metrics (42 files, 23.4%, …) | **Still static HTML** | Not wired to API |
| Roadmap / AI tools / chart widgets | **Still static** | Sample data or inline-core stubs |
| `CodeUploadDashboard` fallback mock uploads | **Fallback only** | Used if `loadData()` throws; main page UI bypasses `render()` |

## Wired endpoints (port 54355)

### Dashboard

| UI | Method | Path | Auth (`REQUIRE_AUTH=true`) |
|----|--------|------|----------------------------|
| Page load stats | GET | `/api/project-structure` | Public (optional auth) |
| Backlog issue counts | GET | `/api/backlog` | Public |
| Mock analyzer refresh | GET | `/api/mock-analysis` | Public |
| Deep analyze | POST | `/api/models/active/analyze` | **JWT required** |
| Convert / validate / clean | GET | `/api/mock-conversion`, `/api/mock-validation`, `/api/mock-cleaning` | Public |

### Upload

| Action | Method | Path | Auth |
|--------|--------|------|------|
| Upload files | POST | `/api/upload/files` | JWT when `REQUIRE_AUTH=true` |
| History | GET | `/api/upload/history` | JWT when `REQUIRE_AUTH=true` |
| Git import | POST | `/api/upload/git` | JWT when `REQUIRE_AUTH=true` |

Mount point in `gguf-dashboard-server.js`:

```javascript
setupRepositoryScannerAPIs(app, { platformRoot: __dirname });
app.use('/api/upload', uploadAuth, uploadSecurity, contentValidation, uploadRoutes);
```

## Smoke test results (2026-05-25)

With server started using real `JWT_SECRET` / `JWT_REFRESH_SECRET` (≥32 chars):

| Check | Result |
|-------|--------|
| `GET /api/health` | 200 |
| `GET /api/project-structure` | 200 (live file scan) |
| `GET /api/mock-analysis` | 200 (`filesFound` ≈ 3600+) |
| `POST /api/auth/login` (demo user) | 200, field **`token`** (not `accessToken`) |
| `POST /api/upload/files` + Bearer | 200, `{ success: true, uploadId }` |
| `GET /api/upload/history` + Bearer | 200, `{ uploads: [...] }` |

## Server restart requirements

**Restart required** after changes to:

- `gguf-dashboard-server.js`
- `server/routes/repository-scanner-api.js`
- `server/routes/upload.js`
- `server/bootstrap/public-api-routes.js`

```powershell
# Windows — kill existing listener then start
Get-NetTCPConnection -LocalPort 54355 -State Listen | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Generate secrets (required when REQUIRE_AUTH=true and NODE_ENV=production)
$jwt = node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
$env:JWT_SECRET = $jwt
$env:JWT_REFRESH_SECRET = $jwt
$env:REQUIRE_AUTH = 'true'
$env:NODE_ENV = 'development'
node ai-platform/gguf-dashboard-server.js
```

**Note:** `.env.v1-internal` sets `NODE_ENV=production` and placeholder `JWT_SECRET=YOUR_JWT_SECRET_HERE`, which **blocks startup** unless real secrets are configured. Use generated secrets or a dev profile with `NODE_ENV=development`.

## Auth requirements

| Variable | Effect |
|----------|--------|
| `REQUIRE_AUTH=true` | Global `/api/*` gate; scanner GET routes listed in `public-api-routes.js` stay open |
| `JWT_SECRET`, `JWT_REFRESH_SECRET` | Required (non-placeholder, ≥32 chars) when auth enforced |
| Demo login | `dev@simplebeacon.ai` / `demo123` from `server/db/demo-users.json` (when seeding enabled) |
| Browser token storage | `CodeUploadService` reads `access_token`, `token`, or `authToken` from localStorage/sessionStorage |

Login response uses **`token`**, not `accessToken`. Store as `localStorage.setItem('token', …)` or `access_token` for upload XHR.

## Manual test checklist

1. Start server on **54355** with valid JWT secrets (see above).
2. Open **http://localhost:54355/dashboard.html** → Network tab shows **200** for `/api/project-structure`, `/api/backlog`, `/api/mock-analysis`; mock stats show live counts (not `347`/`234`).
3. Click **Analyze Mock Data** → status banner shows success or model-analyze fallback message.
4. Open **http://localhost:54355/code-upload.html** → if `REQUIRE_AUTH=true`, login via `POST /api/auth/login`, save `token` to localStorage, upload a `.js` file → **200** on `/api/upload/files`.
5. Refresh upload page → recent uploads list shows the upload; stat cards update from history (not `156` / `12,567` fiction).

## Unit tests

```bash
cd ai-platform
npm test -- tests/unit/dashboard-mock-wiring.test.js
```

## Remaining work (estimate)

| Item | Effort |
|------|--------|
| Replace default-stats HTML placeholders with `—` (avoid flash of 892/94.2%) | ~30 min |
| Wire cleaning-metrics section to `/api/mock-cleaning` on load | ~1 h |
| Auth UX: login page or auto-store JWT for legacy HTML pages | ~2 h |
| Refactor `server/index.js` to reuse `repository-scanner-api.js` (DRY) | ~1 h |
| Full roadmap / sidebar sections → stub or live APIs | ~1–2 days |

**Total to “fully live” legacy dashboard:** ~2–3 days; **core dashboard + upload path:** done after server restart.
