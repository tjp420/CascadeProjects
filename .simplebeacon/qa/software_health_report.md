# Software Health Report — Audit Policy & Retention Engine

**Date:** 2026-07-31
**Branch:** feat/agentic-orchestration
**Feature:** Per-org audit retention policies with purge, archive, and stats
**Validator:** Devin (Validator mode)

---

## Level 1 — Deterministic Checks

| Check | Result | Notes |
|-------|--------|-------|
| `node -c audit-policy-store.cjs` | PASS | Syntax clean — new module |
| `node -c audit-logger.cjs` | PASS | Syntax clean — purgeOldEntries + getRetentionStats added |
| `node -c audit-routes.cjs` | PASS | Syntax clean — 4 retention routes added |
| `node -c audit-policy-store.test.cjs` | PASS | Syntax clean — 12 tests |
| `node -c audit-logger-retention.test.cjs` | PASS | Syntax clean — 11 tests |
| Full test suite (all suites) | PASS | 1779/1779 tests pass (23 new) |
| SimpleBeacon gate scan | PASS | 0 critical, 0 high, 0 medium; quality score 100 |

---

## Level 2 — Behavioral Verification

| Test Plan # | Check | Result | Notes |
|-------------|-------|--------|-------|
| 1 | `audit-policy-store.cjs` loads/saves per-org config | PASS | Test: "should persist policy to disk" |
| 2 | `getPolicy(orgId)` returns retention days, max entries, archive | PASS | Test: "should return default policy…" |
| 3 | `setPolicy(orgId, policy)` validates and persists | PASS | Test: "should accept valid partial updates" |
| 4 | `purgeOldEntries(orgId)` removes entries older than retention | PASS | Test: "should purge entries older than retention days" |
| 5 | `purgeOldEntries` re-links hash chain after removal | PASS | Test: "should re-link hash chain after purge" |
| 6 | `getRetentionStats(orgId)` returns total, oldest, newest, purgeable | PASS | Test: "should return total, oldest, newest for entries" |
| 7 | `GET /retention/config` returns policy | PASS | Route at line 721, authorize('admin:all') |
| 8 | `PUT /retention/config` updates policy | PASS | Route at line 733, audit-logged |
| 9 | `POST /retention/purge` triggers purge | PASS | Route at line 774, audit-logged |
| 10 | `GET /retention/stats` returns stats | PASS | Route at line 762 |
| 11 | `purgeOldEntries` on empty store returns 0 | PASS | Test: "should return 0 purged for empty store" |
| 12 | `purgeOldEntries` with no policy uses default (90 days) | PASS | Test: "should use default policy (90 days)…" |
| 13 | `setPolicy` rejects negative retentionDays | PASS | Test: "should reject negative retentionDays" |
| 14 | `setPolicy` rejects maxEntries < 100 | PASS | Test: "should reject maxEntries < 100" |
| 15 | Purge preserves at least maxEntries most recent | PASS | Test: "should preserve at least maxEntries…" |
| 16 | Hash chain valid after purge | PASS | Test: "should re-link hash chain after purge" |
| 17 | All retention routes wrapped with authorize('admin:all') | PASS | Verified at lines 721, 733, 762, 774 |
| 18 | Purge action audit-logged with actor and count | PASS | action: 'retention_purge' at line 784 |
| 19 | Policy updates audit-logged | PASS | action: 'retention_policy_update' at line 746 |
| 20 | `purgeOldEntries` does not cross org boundaries | PASS | Test: "should not cross org boundaries" |

**Test plan items: 20/20 PASS**

---

## Level 3 — Spec Drift & Edge Cases

| Item | Status | Notes |
|------|--------|-------|
| Spec: Per-org policy store | MATCH | JSON file at AUDIT_POLICY_PATH with orgId → policy map |
| Spec: Default 90 days / 10,000 max entries / no archive | MATCH | DEFAULT_POLICY in audit-policy-store.cjs |
| Spec: Hash chain re-linking after purge | MATCH | Same pattern as healChain() |
| Spec: Archive vs delete | MATCH | When archive: true, entries moved to audit-archive-{orgId}.json |
| Spec: Purge safety floor | MATCH | Preserves most recent maxEntries entries when total > maxEntries |
| Spec: No background timer | MATCH | Purge triggered manually via API |
| No ghost files | CONFIRMED | All 5 files exist at expected paths |
| No new dependencies | CONFIRMED | Uses only existing fs, path, crypto modules |
| No spec drift | CONFIRMED | All test plan items map to implementation |
| Safety floor logic fix | DOCUMENTED | Fixed: safety floor only applies when total > maxEntries |

---

## Defects

None found. All tests pass, gate passes, no syntax errors.

---

## Unimplemented

None. All 20 test plan items implemented and verified.

---

## Enhancements (Debt/Perf)

1. **Safety floor logic fix** — Initial implementation had a bug where the safety floor protected ALL entries when total <= maxEntries, preventing any purges. Fixed: safety floor only applies when total entries exceed maxEntries; otherwise, all entries are eligible for age-based purge.

2. **Direct file write in tests** — The `writeEntryDirectly()` helper bypasses `log()` to inject entries with custom timestamps. The `log()` function always uses `now()` for timestamps, which is correct for production but prevents testing retention with old entries.

3. **Policy store cache reset** — Tests use `_resetCache()` after writing policies directly to disk to ensure the audit-logger module reads fresh policy data. This avoids module cache issues where `jest.resetModules()` can create separate instances of audit-policy-store.cjs.

4. **Archive file per org** — Archived entries are stored in `audit-archive-{orgId}.json` alongside the main audit log. This keeps archived data separate from the active chain while preserving it for compliance audits.

---

## Future Roadmap

1. **Frontend retention dashboard** — Add a retention management card to SecurityView.js showing per-org policy, stats, and manual purge trigger.

2. **Automated purge schedule** — Wire purgeOldEntries() into the existing auto-heal worker to run periodically (e.g., daily) without manual API calls.

3. **Archive search API** — Add a route to search archived entries for compliance investigations.

4. **Graduated retention** — Different retention periods per action type (e.g., security events kept longer than routine updates).

5. **Purge preview** — Add a "dry run" mode to preview what would be purged without actually deleting.

---

## Validator Sign-off

- [x] All Level 1 checks pass (syntax, 1779 tests, gate 0/0/0, quality 100)
- [x] All Level 2 behavioral checks pass (20/20 test plan items)
- [x] No spec drift (all spec items match implementation)
- [x] No ghost files or hallucinated API paths
- [x] All 4 retention routes wrapped with `authorize('admin:all')`
- [x] Purge and policy update actions audit-logged
- [x] Hash chain re-linking verified (verifyChain passes after purge)
- [x] Safety floor preserves most recent maxEntries entries
- [x] No cross-org purge (org boundary isolation verified)
- [x] No new dependencies added

**Verdict:** READY FOR COMMIT
