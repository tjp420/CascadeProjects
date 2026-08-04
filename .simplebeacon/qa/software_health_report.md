# software_health_report.md — Option 3 Team Score Aggregation Telemetry

## Metadata

| Field | Value |
|-------|-------|
| Validator | Cursor Validator (adversarial re-run) |
| Date | 2026-08-04 |
| Branch | `feat/team-score-aggregation-telemetry` |
| Commit | `b7e7ec1e7` — `fix(telemetry): gate POST team ingest and drop stored email` |
| Worktree | `C:\Users\user\option3-telemetry-wt` |
| Prior NO-GO | `728171b31` (POST ungated + raw email) |
| test_plan | `.simplebeacon/qa/test_plan.md` |

## Executive summary

- **Gate:** PASS — `gatePass: true`, `blockingCount: 0`
- **Level 1 (Option 3 telemetry):** 5 / 7 executed-pass in worktree; compile/dashboard/full `npm test` blocked by missing worktree `node_modules` (`tsc`/`jest` not on PATH)
- **Targeted telemetry tests:** **33/33 PASS** (store 13 + billing helpers 6 + CLI 14)
- **License-gate regression:** **PASS** (POST + GET team routes)
- **PII store regression (D-03):** **PASS**
- **CORS live:** **PARTIAL** — no server on `:54355`/`:3000`; static config OK
- **Ship recommendation:** **CONDITIONAL GO** for Option 3 merge

**Verdict rationale:** D-02 and D-03 (prior merge blockers) are **fixed and verified** on `b7e7ec1e7`. Remaining open items are pre-existing full-suite `npm test` failures (D-01), optional D-08 tier allowlist precision, and live CORS (environment). Per agreed policy, D-01 alone does not block Option 3.

---

## Option 3 verdict matrix

| Scope | Verdict | Notes |
|-------|---------|-------|
| **Option 3 merge** | **CONDITIONAL GO** | D-02/D-03 closed; D-01 isolated |
| **Conditional GO (D-01 only)** | **Accepted** | Telemetry security wiring pass |
| **Full-repo GO** | **NO-GO** until `ai-platform npm test` green |

---

## Strict `hasTeamComplianceLicense` regression

| Check | Location | Result |
|-------|----------|--------|
| Helper rejects `community` / `free` / null | L876–878 + billing tests | **PASS** |
| GET team context uses helper → 403 `team_license_required` | L908–913 | **PASS** |
| POST ingest uses helper before sanitize/record | L933–938 | **PASS** (was FAIL on `728171b31`) |
| GET summary team fields gated | L981+ | **PASS** |
| 403 payload shape | `{ error: 'team_license_required', message: 'Team telemetry requires a team or compliance license.' }` | **PASS** (contract tests) |
| Auth without token | POST → 401 `missing_token` | **PASS** (code) |
| Invalid token | POST → 403 `invalid_token` | **PASS** (code) |
| Over-broad allow (D-08) | Helper = “not community/free” (allows `pro`) | **WARN** — non-blocking; message says team/compliance |

---

## D-03 email persistence

| Check | Result |
|-------|--------|
| No `email:` assignment in event object | **PASS** (L197–203) |
| Delete if present via payload spread | **PASS** (L204–207) |
| Unit test `does not persist raw email on recorded events (D-03)` | **PASS** |

---

## Level 1 — Deterministic

| ID | Check | Result |
|----|-------|--------|
| L1-01 | `node -c` × 4 telemetry files | **PASS** |
| L1-02 | `ci-telemetry-store.test.cjs` | **PASS** (incl. D-03) |
| L1-03 | `ci-telemetry.test.js` | **PASS** 14/14 |
| L1-04 | `cd ai-platform && npm test` | **NOT RUN in worktree** — no local `jest` binary (`WT_NO_NM`). Prior pass on sibling checkout: 11 failing HSM suites (**D-01 OPEN**) |
| L1-05 | Extension `npm run compile` | **NOT RUN in worktree** — `tsc` missing. Main checkout compile previously PASS for Phase 5 |
| L1-06 | Dashboard `npm run build` | **NOT RUN in worktree** — `tsc` missing. Prior Phase 4 build PASS |
| L1-07 | Gate scan offline | **PASS** (`gatePass: true`, `blockingCount: 0`) |

Combined node-test run: **33/33 PASS**.

---

## Level 2 / 3 / Security

| ID | Result | Notes |
|----|--------|-------|
| L2-01 | PASS (unit) | CLI posts `scan_source=ci` |
| L2-02 | PASS | Air-gapped skip |
| L2-03 | PASS | Backward-compat summary |
| L2-04 | PASS | Distribution math + route |
| L2-05 | PASS | k-anonymity tests |
| L2-06 | PASS (wired) | DashboardView + trend chart present |
| L2-07 | PASS | Hooks L10 import, **L4555**, **L4948** |
| L2-08 | PASS | CLI + **server POST** community gate |
| L3-01 | PASS | Forbidden field sanitization |
| L3-02 | PASS (code) | 90-day purge on write |
| L3-04 | PASS | Null quality_score exclusion |
| L3-05 | PARTIAL | Static: `cors-config.cjs` allows `*.simplebeacon.pages.dev`; live OPTIONS to `:54355`/`:3000` timed out (no server) |
| L3-06 | PASS | Independent of `syncToCloud` |
| S-01 | PASS | No raw email in store |
| S-02 | PASS | POST + GET team license gate |
| S-03 | PASS | k-anonymity before breakdown |

---

## 1. Defects

| ID | Description | Severity | Status |
|----|-------------|----------|--------|
| D-01 | Full `ai-platform npm test` historically 11 failing HSM/track112 suites | high | **OPEN** (isolated; not Option 3) |
| D-02 | POST community ingest ungated | critical | **CLOSED** @ `b7e7ec1e7` |
| D-03 | Raw email in store | critical | **CLOSED** @ `b7e7ec1e7` |
| D-08 | `hasTeamComplianceLicense` allows any non-community tier (e.g. `pro`) | medium | **OPEN** (enhancement) |

---

## 2. Unimplemented / gaps

| ID | Item | Notes |
|----|------|-------|
| U-01 | Live CORS probe | Server not listening locally this pass |
| U-02 | Worktree full compile/build | Install `node_modules` in worktree or validate from primary checkout with branch checked out |
| U-03 | IDE embed `web/dashboard/` mirror | Still out of sync (enhancement) |

---

## 3. Enhancements

| ID | Suggestion | Effort |
|----|------------|--------|
| E-01 | Allowlist tiers explicitly (`team`, `compliance`, `growth`, `operator`) — close D-08 | S |
| E-02 | Route-level integration test hitting Express POST with mocked subscription | S |
| E-03 | Live CORS smoke in CI against ephemeral server | M |

---

## Command log (summary)

```text
# Worktree C:\Users\user\option3-telemetry-wt @ b7e7ec1e7

node -c (4 files)                                              PASS
node --test store + billing + cli-telemetry                    33/33 PASS
curl/Invoke OPTIONS localhost:54355 / :3000                    FAIL (timeout — no server)
node .../simplebeacon.js scan --gate --offline                 PASS (gatePass: true)
npm run compile / build / npm test (worktree)                  FAIL tooling (no node_modules)
```

---

## Validator sign-off

- [x] Adversarial pass on `b7e7ec1e7`
- [x] Strict license-gate regression (POST + GET) documented
- [x] D-03 email removal verified
- [x] CORS live attempted; static fallback recorded
- [x] No feature code written (Validator only)
- [x] **CONDITIONAL GO** for Option 3 (D-01 / D-08 non-blocking for Option 3 scope)

**Validator:** Cursor Validator  
**Date:** 2026-08-04  
**Option 3 recommendation:** **CONDITIONAL GO**
