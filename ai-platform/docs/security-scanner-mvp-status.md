# Security Scanner MVP — Status

Last updated: 2026-05-25

## Success criteria (14-day ship plan)

- [x] Dedicated Security Scanner page in Simplebeacon SPA (`#/security`)
- [x] Scan trigger calls live backend (`POST /api/simplebeacon/scan` via dashboard `runScan`)
- [x] Results from live report only (credential + production-leak `rawIssues` — no `/api/security/overview` stubs)
- [x] Severity bands, issue type, file, recommendation columns
- [x] Loading / scanning progress UI
- [x] Honest empty state when gate is clean
- [x] Honest error state when report API fails
- [x] JSON export of security findings
- [x] Unit test for security finding extraction and view wiring
- [ ] PDF export (deferred — not in MVP)
- [ ] CSV export (optional — use Results page CSV for full issue set)

## What's done

| Area | Status |
|------|--------|
| Backend scan (credential + production-leak rules) | Already working via Simplebeacon CLI + `/api/simplebeacon/scan` |
| Frontend route | `#/security` → `SecurityView.js` |
| API wired | Scan: `POST /api/simplebeacon/scan`; report: `GET /api/simplebeacon/report`; headline: `GET /api/optimization/compliance` |
| Static/fake data removed from this page | Does not call stub `/api/security/overview` |
| Nav + feature catalog | Sidebar + All Features entry |

## What's remaining (post-MVP)

- Wire Quality page security overview off stubs (still uses `/api/security/overview` snapshot)
- PDF report template
- Filter by severity on Security page (Results page already supports filters)

## How to run (manual E2E)

1. From `ai-platform/` start the dashboard server:
   ```bash
   node gguf-dashboard-server.js
   ```
2. Open `http://localhost:54355/simplebeacon-dashboard/index.html#/security`
3. Click **Run security scan** — wait for spinner to finish
4. Verify findings table (or empty state if gate clean)
5. Click **Export JSON** when findings exist
6. Optional: confirm compliance headline loads (`GET /api/optimization/compliance`)

## Files changed (MVP slice)

- `web/simplebeacon-dashboard/js/services/securityService.js` (new)
- `web/simplebeacon-dashboard/js/views/SecurityView.js` (new)
- `web/simplebeacon-dashboard/js/main.js`
- `web/simplebeacon-dashboard/js/router.js`
- `web/simplebeacon-dashboard/index.html`
- `web/simplebeacon-dashboard/js/services/platformService.js`
- `tests/unit/security-scanner-view.test.js` (new)
- `jest.config.js`
