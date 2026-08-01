# Test Plan — Real-Time Log Stream Interdiction Engine

**Date:** 2026-01-30
**Branch:** feat/agentic-orchestration
**Feature:** In-memory API key block list + auto-interdiction on anomaly thresholds

---

## Objective Check-Items

### Positive Paths

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 1 | `enforceKeyInterdiction()` middleware returns 423 Locked for interdicted keys | L1 | `authorize.cjs` |
| 2 | `enforceKeyInterdiction()` calls `next()` for non-interdicted keys | L1 | `authorize.cjs` |
| 3 | `interdictKey(apiKey, reason, ttlMs)` adds key to block list with expiry | L1 | `authorize.cjs` |
| 4 | `releaseKey(apiKey)` removes key from block list immediately | L1 | `authorize.cjs` |
| 5 | `getInterdictedKeys()` returns list of blocked keys with metadata | L1 | `authorize.cjs` |
| 6 | `recordViolation()` auto-interdicts after threshold is crossed | L1 | `authorize.cjs` |
| 7 | `GET /api/audit/interdiction/status` returns block list (admin-only) | L1 | `audit-routes.cjs` |
| 8 | `POST /api/audit/interdiction/release` releases a key (admin-only) | L1 | `audit-routes.cjs` |
| 9 | `POST /api/audit/interdiction/block` manually blocks a key (admin-only) | L1 | `audit-routes.cjs` |

### Edge Cases

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 10 | Expired interdiction auto-evicts on next request (TTL cleanup on access) | L1 | `authorize.cjs` |
| 11 | Request with no API key passes through interdiction middleware | L1 | `authorize.cjs` |
| 12 | Interdiction store has memory cap to prevent unbounded growth | L1 | `authorize.cjs` |
| 13 | Releasing a non-existent key returns success with `wasBlocked: false` | L1 | `audit-routes.cjs` |

### Security

| # | Check | Level | File/Route |
|---|-------|-------|------------|
| 14 | All interdiction admin routes wrapped with `authorize('admin:all')` | L1 | `audit-routes.cjs` |
| 15 | 423 response does not leak internal block list metadata | L1 | `authorize.cjs` |

---

## Files Touched

| File | Action |
|------|--------|
| `ai-platform/server/middleware/authorize.cjs` | UPDATE — add interdiction store, middleware, and auto-trigger |
| `ai-platform/server/routes/audit-routes.cjs` | UPDATE — add 3 admin routes for interdiction management |
| `ai-platform/server/lib/__tests__/key-interdiction.test.cjs` | NEW — test suite for interdiction engine |

## Design Decisions

1. **In-memory Map** — `interdictedKeys` is a `Map<string, { reason, blockedAt, expiresAt }>`. No external dependencies (Broom Strategy).
2. **TTL cleanup on access** — Expired entries are evicted lazily when `enforceKeyInterdiction()` checks them. No background timer needed.
3. **Auto-interdiction threshold** — When `recordViolation()` detects an org has crossed `orgPartitionViolationAlertThreshold` (default: 5), it automatically interdicts the caller's API key for a configurable TTL (default: 15 minutes).
4. **Memory cap** — Max 10,000 interdicted keys. Oldest entries are evicted when cap is reached.
5. **API key extraction** — Checks `req.headers['x-api-key']`, `req.query.apiKey`, and falls back to `req.user?.id` for token-based auth.
6. **423 Locked response** — Standard HTTP status for locked resources. Response includes `expiresAt` timestamp but no internal metadata.

## Commands

```powershell
node -c ai-platform/server/middleware/authorize.cjs
node -c ai-platform/server/routes/audit-routes.cjs
node -c ai-platform/server/lib/__tests__/key-interdiction.test.cjs
cd ai-platform && npx jest --config jest.config.cjs --ci
npx simplebeacon scan --full --gate --format json
```
