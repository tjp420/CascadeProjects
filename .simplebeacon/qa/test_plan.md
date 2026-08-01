# Test Plan — Autonomous Background Ledger Re-Keying Worker

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** Background re-keying migration wired into auto-heal timer

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `runAutonomousReKeying()` returns a result object with migrated/skipped/failed counts | L1 | `audit-logger.cjs` |
| 2 | When no rotation is active, returns `{ migrated: 0, skipped: 0, failed: 0, purged: false }` | L2 | `audit-logger.cjs` |
| 3 | After rotation, quarantine files are re-keyed to active key | L2 | `audit-logger.cjs` |
| 4 | After successful migration, previous key is purged from key ring | L2 | `audit-logger.cjs` |
| 5 | `getReKeyStats()` returns migration statistics | L1 | `audit-logger.cjs` |
| 6 | Auto-heal timer calls `runAutonomousReKeying()` during each tick | L2 | `audit-logger.cjs` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 7 | No quarantine files for org → skipped, not failed | L2 | `audit-logger.cjs` |
| 8 | Grace window expired → migration skipped, purge attempt made | L2 | `audit-logger.cjs` |
| 9 | Re-keying with no orgs in audit log → empty result | L1 | `audit-logger.cjs` |
| 10 | Corrupted quarantine file → failed count incremented, no crash | L2 | `audit-logger.cjs` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 11 | Re-keyed quarantine file is still encrypted (sb-dir: prefix) | L2 | `audit-logger.cjs` |
| 12 | Re-keyed quarantine file is still readable with correct orgId | L2 | `audit-logger.cjs` |
| 13 | Re-key stats don't expose raw key material | L2 | `audit-logger.cjs` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/lib/audit-logger.cjs` | UPDATE — add `runAutonomousReKeying()`, `getReKeyStats()`, wire into timer |
| `ai-platform/server/lib/__tests__/autonomous-rekey.test.cjs` | NEW — test suite |
| `.github/workflows/security-regression-tests.yml` | UPDATE — path filters + test regex |

## Commands

```powershell
node -c ai-platform/server/lib/audit-logger.cjs
cd ai-platform && npx jest --config jest.config.cjs --testPathPatterns="autonomous-rekey"
npx simplebeacon scan --full --gate --format json
```
