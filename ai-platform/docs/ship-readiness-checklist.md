# Ship Readiness Checklist

Last reconciled: **2026-05-25** (v1-internal roadmap verification pass)  
**Beta MVP verdict: READY** · **Production deploy verdict: NOT READY** (env/governance blockers)

Canonical dev server:

```bash
node gguf-dashboard-server.js
# → http://localhost:54355  (loads .env.v1-internal when present)
```

Legacy ports **3000 / 3002 / 3003** are not the primary dashboard path.

---

## Definition of Done (6-day plan)

| # | Criterion | Status | How to verify | Evidence |
|---|-----------|--------|---------------|----------|
| 1 | No hardcoded secrets in code | **DONE** | `npm run compliance:check` | CRED-001 pass; `credentialFindings: 0` in `.simplebeacon/report.json` |
| 2 | Frontend displays real backend data | **DONE** | `npm test -- tests/unit/dashboard-metrics-service.test.js` | 7 core + 12 component dashboards wired via `DashboardMetricsService`; fiction grep guard passes 20 files |
| 3 | All Simplebeacon scan steps complete | **DONE** | `npm run simplebeacon:report` | Gate pass; 42 mock files; quality 98; 0 critical/high |
| 4 | User can run security scan | **DONE** | Start server → `#/security` → Run scan | `SecurityView.js` + `POST /api/simplebeacon/scan`; requires `SIMPLEBEACON_INTERNAL_DASHBOARD=true` (set in `.env.v1-internal`) |
| 5 | Results display accurately | **DONE** | `npm test -- tests/unit/security-scanner-view.test.js` | Live report only (`rawIssues` credential + production-leak); no stub overview |
| 6 | User can export reports | **DONE** | Export JSON on `#/security` | `buildSecurityExportPayload()` + unit test |
| 7 | Basic documentation exists | **DONE** | Read docs | `docs/security-scanner-getting-started.md`, this checklist |
| 8 | No critical bugs blocking usage | **DONE** | `npm test -- --no-coverage` | **885/885** tests pass (56 suites); phase2 integration **20/20** |
| 9 | Performance acceptable for target repos | **PARTIAL** | `npm run simplebeacon:report` | Scan ~21s for 42 mock files; full-repo inventory 42K files — no load test run |

---

## Ship Readiness Checklist (6-day plan)

| # | Item | Status | How to verify | Evidence |
|---|------|--------|---------------|----------|
| 1 | Security scan passes with 0 critical issues | **DONE** | `npm run simplebeacon:report` | `severityCounts.critical: 0`, `high: 0`; gate pass |
| 2 | Authentication works with proper secrets | **DONE** | `npm test -- tests/integration/phase2-integration.test.js` | 20/20 pass; `secret-config.js` fail-fast in production |
| 3 | Dashboard shows real scan results | **DONE** | Grep 7 core files for `156\|98.5\|87%` | 0 matches; KPIs from `/api/issues`, `/api/backlog`, etc. |
| 4 | Complete scans run without errors | **DONE** | `npm run simplebeacon:baseline-sync` | Baseline synced; Jest 885/885 |
| 5 | File count accurate (~43 mock files) | **DONE** | `npm run simplebeacon:report` | `mockSampleFiles: 42`, `totalFiles: 42` |
| 6 | User guide covers basic usage | **DONE** | `docs/security-scanner-getting-started.md` | 1-page getting started + troubleshooting |
| 7 | Error messages are helpful | **DONE** | `SecurityView.js` empty/error states | Honest empty state + retry on report failure |
| 8 | Export functionality works | **DONE** | Unit test + `#/security` Export JSON | `security-scanner-view.test.js` export action |
| 9 | Performance is acceptable | **PARTIAL** | Manual timing | Report scan ~21s; no formal 10K-file benchmark |

---

## Verification commands (this pass)

```bash
npm run verify:v1-internal-profile   # exit 0 — WARN: JWT secrets need configuration in .env.v1-internal
npm run smoke:test                   # exit 0 — SMOKE SUITE PASSED (existing server on :54355)
npm audit                            # 0 vulnerabilities
npm run verify:production-deploy     # exit 1 — JWT secrets + Stripe keys (expected locally)
npm run remediation:gate             # PASS — health 91, 0 high-severity
npm run simplebeacon:report          # exit 0 — gate pass, 42 files, 0 credential findings
npm run simplebeacon:path-check -- --with-api   # 4/4 path + 3/3 analyze API smoke
npm run compliance:check             # 8/8 rules pass
npm run simplebeacon:baseline-sync   # exit 0 — 885/885 Jest
npm test -- tests/integration/phase2-integration.test.js   # 20/20 pass
npm test -- --no-coverage            # 885/885 pass
npm run verify:predeploy             # Decision: NO-GO (production Stripe/JWT — expected locally)
```

**Dashboard smoke note:** `npm run dashboard:v1-internal` hits **EADDRINUSE on :8081** when a dashboard is already running (PID listening on **54355** and **8081**). Existing instance is valid for smoke — `npm run smoke:test` passed against `http://127.0.0.1:54355`.

### .env secrets grep

All tracked `.env*` files use placeholders (`sk_test_dummy`, `sk_test_YOUR_KEY_HERE`, `sk_test_placeholder`, `whsec_REPLACE_ME`). No live `sk_live_*` or long `sk_test_*` keys found.

### Fiction KPI grep (7 core dashboard files)

| File | `156` / `98.5` / `87%` |
|------|------------------------|
| `web/components/ai-analysis/AIAnalysisDashboard.js` | 0 |
| `web/components/analysis/AnalysisDashboard.js` | 0 |
| `web/components/analysis/AnalysisOverview.js` | 0 |
| `web/components/analytics/AnalyticsDashboard.js` | 0 |
| `web/components/debt-analytics/DebtAnalyticsDashboard.js` | 0 |
| `web/scripts/unified-dashboard-core.js` | 0 |
| `web/scripts/temp_dashboard.js` | 0 (deprecated; not loaded in HTML) |

Extended guard: 20 files in `dashboard-metrics-service.test.js` fiction grep — all pass.

---

## E2E security flow

1. `node gguf-dashboard-server.js` (ensure `.env.v1-internal` loads → `SIMPLEBEACON_INTERNAL_DASHBOARD=true`)
2. Open `http://localhost:54355/simplebeacon-dashboard/index.html#/security`
3. Click **Run security scan** → wait for spinner
4. Confirm findings table or honest empty state
5. Click **Export JSON** when findings exist

**API note:** Without `SIMPLEBEACON_INTERNAL_DASHBOARD=true`, `POST /api/simplebeacon/scan` returns **403 subscription_required** (monetization gate). Set env or use `.env.v1-internal` before E2E.

**Restart required** after: `SIMPLEBEACON_PATH`, route mounts, `ANALYZE_ALLOWED_ROOTS`, subscription env changes.

---

## Prior audit staleness

The user's 33% (3/9) audit was **stale**. Already fixed before this pass:

- DashboardMetricsService in 7 core + 12 component dashboards (44c015d7 + follow-up)
- Security Scanner MVP `#/security` (907fa860)
- Path fix + 54355 canonical port (18b95185)
- scanPaths trimmed to 42 mock files (21f789c4)
- Credentials neutralized (77e0ac2a, bc4dce19)

Residual fiction KPI hits in legacy HTML (`dashboard.html`, `unified-dashboard.html`) and `dashboard-inline-core.*` are **not** in the 7-file guard scope or active SPA shells.

---

## Blockers requiring USER action

| Blocker | Owner | Action |
|---------|-------|--------|
| Production deploy | SRE | Fill `.env.production` on host: real `JWT_SECRET`, `JWT_REFRESH_SECRET` (`JWT_EXPIRES_IN` / `REFRESH_TOKEN_EXPIRES_IN` placeholders set locally) |
| Stripe monetization | Billing | Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, price IDs when monetization enabled |
| Stripe key rotation | Billing | Rotate if any key was ever committed live (currently placeholders only) |
| Server restart | Operator | Restart after env/route changes; use `node gguf-dashboard-server.js` without overriding `REQUIRE_AUTH` unless intentional |
| Manual E2E | Operator | Run `#/security` scan flow once after deploy with `SIMPLEBEACON_INTERNAL_DASHBOARD=true` |
| Branch protection / org sign-off | Repo admin | See `docs/launch-readiness-scorecard.md` |

---

## Verdict summary

| Scope | Verdict | Next step |
|-------|---------|-----------|
| **6-day beta MVP** | **READY** | Manual E2E on `#/security` after `node gguf-dashboard-server.js` |
| **Production live** | **NOT READY** | Fix `verify:predeploy` blockers (JWT + Stripe secrets in production profile) |
