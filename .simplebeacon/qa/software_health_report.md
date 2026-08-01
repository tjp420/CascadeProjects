# Software Health Report — Auto-Purge Metrics in Stats API & Dashboard

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** Expose _lifecyclePurgeStats via GET /retention/stats and surface in frontend
**Validator:** Devin (Validator mode)

---

## Level 1 — Deterministic Checks

| Check | Result | Notes |
|-------|--------|-------|
| `node -c audit-logger.cjs` | PASS | Syntax clean — async + test hooks + aliases (user-modified) |
| `node -c audit-routes.cjs` | PASS | Syntax clean — autoPurgeStats added to stats response (user-modified) |
| `node -c SecurityView.js` | PASS | Syntax clean — Background Worker Activity section added |
| `node -c audit-logger-auto-purge.test.cjs` | PASS | Syntax clean — 18 tests updated to async |
| `node -c audit-lifecycle-worker.test.cjs` | PASS | Syntax clean — 4 tests (user-created, fixed shim compatibility) |
| Full test suite (all suites) | PASS | 1801/1801 tests pass (4 new from lifecycle-worker suite) |
| SimpleBeacon gate scan | PASS | 0 critical, 0 high, 0 medium; quality score 100; gatePass: true |

---

## Level 2 — Behavioral Verification

| Test Plan # | Check | Result | Notes |
|-------------|-------|--------|-------|
| 1 | GET /retention/stats response includes `autoPurgeStats` object | PASS | audit-routes.cjs line 767-774 |
| 2 | `autoPurgeStats` contains totalSweeps, totalPurged, totalArchived, lastResult, lastRun | PASS | Plus user-friendly aliases: runs, purged, archived, failed, lastRun |
| 3 | Frontend retention card renders "Background Worker Activity" section | PASS | SecurityView.js line 668-689 |
| 4 | Worker activity section shows totalSweeps, totalPurged, totalArchived | PASS | 4-column grid: Total Sweeps, Auto-Purged, Auto-Archived, Last Sweep |
| 5 | Worker activity section shows lastRun timestamp (human-readable) | PASS | toLocaleString() or "Never" when null |
| 6 | Stats refresh button also refreshes auto-purge metrics | PASS | loadRetention() fetches stats which now includes autoPurgeStats |
| 7 | Worker activity section shows "Never" when lastRun is null | PASS | formattedLastRun = autoPurge.lastRun ? ... : 'Never' |
| 8 | Worker activity section shows "0" counts when no sweeps have run | PASS | String(autoPurge.runs \|\| 0) |
| 9 | Existing stats fields (total, purgeableCount, oldest, newest) still present | PASS | Unchanged — autoPurgeStats is additive |
| 10 | Endpoint still wrapped with authorize('admin:all') | PASS | Line 762 |
| 11 | Auto-purge stats fields escaped with escapeHtml() in frontend | PASS | All 4 fields use escapeHtml(String(...)) |

**Test plan items: 11/11 PASS**

---

## Level 3 — Spec Drift & Edge Cases

| Item | Status | Notes |
|------|--------|-------|
| Spec: Extend existing GET /retention/stats (no new endpoint) | MATCH | autoPurgeStats nested in response |
| Spec: Frontend "Background Worker Activity" card | MATCH | Between stats grid and policy form |
| Spec: No new service function | MATCH | fetchRetentionStats() already returns full body |
| Spec: Human-readable lastRun | MATCH | toLocaleString() or "Never" |
| Spec: escapeHtml on all dynamic fields | MATCH | 4 escapeHtml calls in worker section |
| No ghost files | CONFIRMED | All files exist at expected paths |
| No new dependencies | CONFIRMED | Uses only existing modules |
| No spec drift | CONFIRMED | All test plan items map to implementation |

---

## Defects

None found. All tests pass, gate passes, no syntax errors.

### Fixes During Validation

1. **Async test suite** — User made `runAutonomousLifecyclePurge()` async, which broke the 18 existing tests that didn't `await` the result. Fixed by adding `async` to all `it()` callbacks and `await` to all `runAutonomousLifecyclePurge()` calls.

2. **Timer tick promise handling** — The `setInterval` callback used `try/catch` which doesn't catch rejected promises from async functions. Fixed by adding `.catch()` to the async call.

3. **audit-lifecycle-worker.test.cjs shim compatibility** — User-created test file used `test()` from `node:test` directly, which the Jest shim doesn't support. Fixed by converting to `describe/it` pattern matching the codebase convention. Also removed `t.skip()` / `t.comment()` (Node test runner features) in favor of early returns.

---

## Unimplemented

None. All 11 test plan items implemented and verified.

---

## Enhancements (Debt/Perf)

1. **User-friendly aliases** — `getLifecyclePurgeStats()` now returns both legacy names (`totalSweeps`, `totalPurged`, `totalArchived`) and user-friendly aliases (`runs`, `purged`, `archived`, `failed`, `lastRun`). This allows the frontend to use short, readable keys while maintaining backward compatibility.

2. **Failed counter** — Added `failed` field to `_lifecyclePurgeStats` that tracks cumulative errors across sweeps. Frontend shows a warning indicator when `failed > 0`.

3. **Test hooks** — Added `__testInject()` function that allows tests to mock `getAllOrgIds`, `purgeOldEntries`, and `log` without touching the filesystem. This enables the user-created `audit-lifecycle-worker.test.cjs` to test orchestration logic in isolation.

4. **Async refactor** — `runAutonomousLifecyclePurge()` is now async, using `Promise.resolve()` to support both sync and async injected functions. This future-proofs the worker for async storage backends.

5. **Error border indicator** — The "Last Sweep" field in the frontend shows a red bottom border when `failed > 0`, giving admins immediate visual feedback of worker issues.

---

## Future Roadmap

1. **Auto-purge history log** — Show a chronological list of recent auto-purge events (timestamp, org, count) in the dashboard.

2. **Worker health alerts** — Send a notification when the auto-purge worker encounters repeated failures.

3. **Configurable purge interval** — Allow separate interval for lifecycle purge vs. heal/re-key.

4. **Compliance report exporter** — Generate SOC 2 / GDPR / ISO 27001 reports from audit log + retention metadata.

5. **Archive search API** — Search archived entries for compliance investigations.

---

## Validator Sign-off

- [x] All Level 1 checks pass (syntax, 1801 tests, gate 0/0/0, quality 100, gatePass: true)
- [x] All Level 2 behavioral checks pass (11/11 test plan items)
- [x] No spec drift (all spec items match implementation)
- [x] No ghost files or hallucinated API paths
- [x] Endpoint still wrapped with authorize('admin:all')
- [x] All dynamic fields escaped with escapeHtml()
- [x] Existing stats fields unchanged (autoPurgeStats is additive)
- [x] Frontend shows "Never" when lastRun is null
- [x] Frontend shows "0" counts when no sweeps have run
- [x] Async test suite fixed (18 tests + 4 new = 22 total in auto-purge suites)
- [x] Timer tick handles async promise rejection
- [x] No new dependencies added

**Verdict:** READY FOR COMMIT
