# Test Plan: Phase 2 — Auth Route Consolidation

**Date:** 2026-07-31
**Branch:** main
**Feature:** Consolidate duplicate auth endpoints and fix security issues.

## Context

The auth audit found 4 auth route files with significant duplication:
- `auth.cjs` (115 lines) — canonical, mounted at `/api/auth` in production
- `auth-routes.cjs` (95 lines) — mounted at `/api/v2/auth` in index.cjs, NO frontend callers
- `auth-inline-routes.cjs` (217 lines) — mounted at `/api` in index.cjs, has license endpoints
- `token-auth.cjs` (807 lines) — mounted at `/auth` in index.cjs, NO frontend callers

Frontend/CLI audit confirmed:
- All frontend auth calls use `/api/auth/*` (served by `auth.cjs`)
- CLI calls `/api/license/validate` (served by `auth-inline-routes.cjs`)
- No calls to `/api/v2/auth/*` or `/tokens/*` found
- Response format: `{ token, user }` for login/register, `{ token }` for refresh

## Changes

### Phase 1: Security fixes + license extraction

1. **Fix logout no-op in `auth.cjs`** (security concern)
   - Currently: `res.json({ success: true, message: 'Logged out successfully' })` — no token invalidation
   - Fix: Add token blocklist check using `token-service.cjs` if available, otherwise keep as client-side discard with a clear comment

2. **Extract license endpoints from `auth-inline-routes.cjs`** to new `license-routes.cjs`
   - Move: `/license/validate`, `/auth/token-status`, `/auth/register-token`, `/tokens/sandbox`
   - This separates auth concerns from license/token management

3. **Add `/api/auth/recover` endpoint to `auth.cjs`**
   - Frontend calls `/api/auth/recover` but it doesn't exist in `auth.cjs`
   - Check if it exists in `auth-inline-routes.cjs` or needs to be created

### Phase 2: Deprecation documentation

4. **Mark `auth-routes.cjs` as deprecated**
   - No frontend callers, duplicate of `auth.cjs` endpoints
   - Add deprecation comment, do NOT delete (may be used by index.cjs deployments)

5. **Keep `token-auth.cjs` as-is**
   - Advanced device-key auth, no overlap with frontend auth
   - Different use case, keep separate

6. **Keep `sso-routes.cjs` as-is**
   - Clean separation, no overlap

## Files to Change

### New file (1)
| File | Purpose |
|------|---------|
| `server/routes/license-routes.cjs` | License token endpoints extracted from auth-inline-routes.cjs |

### Edits (3 files)
| File | Change |
|------|--------|
| `server/routes/auth.cjs` | Fix logout, add recover endpoint if missing |
| `server/routes/auth-inline-routes.cjs` | Remove license endpoints (moved to license-routes.cjs) |
| `server/routes/auth-routes.cjs` | Add deprecation comment |

### Mount point updates (1 file)
| File | Change |
|------|--------|
| `server/index.cjs` | Add mount for license-routes.cjs |

## Objective Check-Items

### Level 1 — Deterministic

| # | Item | Expected |
|---|------|----------|
| L1.1 | `node -c` on all changed files | exit 0 |
| L1.2 | `npx simplebeacon scan --gate` (local CLI) | PASS (exit 0) |
| L1.3 | WebSocket integration test | 16/16 pass |

### Level 2 — Behavioral

| # | Item | Expected |
|---|------|----------|
| L2.1 | POST /api/auth/login works | 200 with `{ token, user }` |
| L2.2 | POST /api/auth/register works | 200 with `{ token, user }` |
| L2.3 | POST /api/auth/logout works | 200 with success message |
| L2.4 | POST /api/auth/refresh works | 200 with `{ token }` |
| L2.5 | GET /api/auth/me works | 200 with `{ success, user }` |
| L2.6 | POST /api/license/validate works | 200 or 400 with validation result |

### Level 3 — Self-review / drift

| # | Item | Expected |
|---|------|----------|
| L3.1 | No mount path changes for existing endpoints | Backward compatible |
| L3.2 | No response format changes | `{ token, user }` preserved |
| L3.3 | License endpoints preserved | CLI continues to work |
| L3.4 | No new dependencies | Uses existing modules |
