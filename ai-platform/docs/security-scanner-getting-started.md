# Security Scanner — Getting Started

One-page guide for the Simplebeacon Security Scanner at `#/security`.

## Prerequisites

- Node.js 18+
- From repo root: `ai-platform/`

## 1. Start the dashboard server

```bash
npm run dashboard:v1-internal
# or: node gguf-dashboard-server.js  (auto-loads .env.v1-internal when present)
```

**Canonical dev URL:** `http://localhost:54355`

> Do not use legacy ports 3000 / 3002 / 3003 for this workflow. The gguf dashboard server listens on **54355** by default.

If you changed `SIMPLEBEACON_PATH` or mounted routes, restart the server after edits.

## 2. Open the Security Scanner

```
http://localhost:54355/simplebeacon-dashboard/index.html#/security
```

Or use the root SPA: `http://localhost:54355/#/security`

When `REQUIRE_AUTH=true`, sign in with **dev@simplebeacon.ai** / **demo123**. The SPA stores JWT in `localStorage` as `cascadeAuthToken` (also mirrored to `access_token`, `token`, `authToken` for legacy pages).

## 3. Run a scan

1. Click **Run security scan**
2. Wait for the loading spinner to finish
3. Review the findings table (credential patterns, production leaks)
4. If the gate is clean, you will see an honest empty state

Backend calls:

- `POST /api/simplebeacon/scan` — triggers scan
- `GET /api/simplebeacon/report` — loads live report
- `GET /api/optimization/compliance` — headline compliance metrics only

## 4. Export results

When findings exist, click **Export JSON** to download `simplebeacon-security-scan-export.json`.

## 5. Verify from CLI

```bash
npm test -- tests/unit/security-scanner-view.test.js
npm run simplebeacon:report
```

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| 401 on API calls | Sign in via UI or `POST /api/auth/login`; confirm `cascadeAuthToken` or `access_token` in localStorage |
| Login returns HTML / 404 | Restart with `npm run dashboard:v1-internal`; check server log for JWT bootstrap errors |
| Login OK but stuck on pricing | Start with `.env.v1-internal` so `SIMPLEBEACON_INTERNAL_DASHBOARD=true` |
| Invalid email or password | Use demo credentials: `dev@simplebeacon.ai` / `demo123` |
| Empty report after scan | Restart server; confirm `.simplebeacon/report.json` exists |
| Wrong repo scanned | Set `SIMPLEBEACON_PATH` in `.env`, restart server |
| Page not found | Use port **54355**, not 3000/3002/3003 |

See also: [security-scanner-mvp-status.md](./security-scanner-mvp-status.md)
