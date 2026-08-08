# Test Plan: License Seat Management Dashboard

**Branch:** `feature/license-seat-management`
**Date:** 2026-08-08
**Builder:** Devin (Builder mode)

## Objective

Add a self-service license seat management panel that lets team admins invite developers, assign seats, and revoke access — built on top of the existing payment, webhook, and licensing infrastructure.

## Scope

### In Scope
- Backend: 3 new API routes (`/api/license/seats`, `/api/license/seats/invite`, `/api/license/seats/revoke/:seatId`)
- Backend: Tier seat count configuration (developer=1, team_pro=5, enterprise=custom)
- Frontend: `LicenseManagerView.tsx` with seat roster, capacity gauge, invite/revoke controls
- Frontend: Route registration in `App.tsx`
- Edge: Worker proxy guardrails for seat verification lookups via `API_CACHE`

### Out of Scope
- Stripe checkout flow changes (already working)
- JWT license token format changes (already signed with `SIMPLEBEACON_SIGNING_PRIVATE_KEY`)
- Enterprise onboarding rewrite (existing `/api/enterprise/*` routes remain as-is)
- Email sending for invitations (post-MVP)

## Architecture Decision: Reuse Existing Patterns

Per the "No Castles" rule, this feature builds on existing infrastructure:

| Existing | Reused For |
|----------|-----------|
| `enterprise-onboarding.cjs` seat pattern (`provisionSeat`, `seatsUsed/seatCount`) | License seat data model |
| `simplebeacon-subscription-store.cjs` (`upsertSubscription`, `setSubscriptionActive`) | Seat activation/revocation |
| `authorize.cjs` middleware (`authorize('admin:all')`) | Route protection |
| `billing-routes.cjs` router pattern | New route registration |
| `worker.js` API_CACHE pattern | Edge caching for seat verification |
| `EnterpriseView.tsx` seat UI pattern | Frontend seat roster + gauge |

## Files to Modify

| File | Change | Level |
|------|--------|-------|
| `ai-platform/server/config/stripe.cjs` | Add `TIER_SEAT_MAP` constant | L1 |
| `ai-platform/src/api/license-seat-routes.cjs` | **NEW** — 3 route handlers | L1 |
| `ai-platform/server/index.cjs` | Register new routes | L1 |
| `worker-deploy/src/worker.js` | Add seat verification cache guardrails | L1 |
| `ai-platform/web/simplebeacon-dashboard/src/views/LicenseManagerView.tsx` | **NEW** — Frontend view | L2 |
| `ai-platform/web/simplebeacon-dashboard/src/App.tsx` | Register route + import | L2 |

## Check Items

### Level 1 — Deterministic

| ID | Check | Command | Pass Criteria |
|----|-------|---------|---------------|
| L1.1 | `stripe.cjs` syntax valid | `node -c ai-platform/server/config/stripe.cjs` | Exit 0 |
| L1.2 | `license-seat-routes.cjs` syntax valid | `node -c ai-platform/src/api/license-seat-routes.cjs` | Exit 0 |
| L1.3 | `index.cjs` syntax valid | `node -c ai-platform/server/index.cjs` | Exit 0 |
| L1.4 | `worker.js` syntax valid | `node -c worker-deploy/src/worker.js` | Exit 0 |
| L1.5 | `LicenseManagerView.tsx` compiles | `cd ai-platform/web/simplebeacon-dashboard && npx tsc --noEmit` | Exit 0 |
| L1.6 | App.tsx compiles | `cd ai-platform/web/simplebeacon-dashboard && npx tsc --noEmit` | Exit 0 |
| L1.7 | ai-platform tests pass | `cd ai-platform && npm test` | All pass |
| L1.8 | Gate scan clean | `npx simplebeacon scan --gate --format json` | PASS |

### Level 2 — Behavioral

| ID | Check | Method | Pass Criteria |
|----|-------|--------|---------------|
| L2.1 | `GET /api/license/seats` returns seat roster | API call with admin auth | 200 + `{ seats, maxSeats, seatsUsed, pendingInvites }` |
| L2.2 | `GET /api/license/seats` rejects non-admin | API call without admin auth | 403 |
| L2.3 | `POST /api/license/seats/invite` creates invitation | API call with email body | 201 + `{ inviteToken, email, seatId }` |
| L2.4 | `POST /api/license/seats/invite` rejects when full | API call when seatsUsed >= maxSeats | 409 |
| L2.5 | `DELETE /api/license/seats/revoke/:seatId` frees seat | API call with valid seatId | 200 + updated seat counts |
| L2.6 | `DELETE /api/license/seats/revoke/:seatId` 404 on invalid | API call with bogus seatId | 404 |
| L2.7 | LicenseManagerView renders seat table | Visual / DOM check | Table with Seat Status, email, actions |
| L2.8 | Seat capacity gauge shows "X / Y Seats Used" | Visual check | Gauge renders with correct ratio |
| L2.9 | Invite CTA generates copyable link | UI interaction | Click invite → input + copy button |
| L2.10 | Revoke CTA triggers DELETE and refreshes roster | UI interaction | Click revoke → seat removed, roster updates |
| L2.11 | Worker caches `GET /api/license/seats` | `curl -I https://simplebeacon.ai/api/license/seats` | `X-Cache: MISS` then `HIT-FRESH` |

### Level 3 — Self-review

| ID | Check | Pass Criteria |
|----|-------|---------------|
| L3.1 | No new modules unless unavoidable | `license-seat-routes.cjs` is the only new backend file (follows `billing-routes.cjs` pattern) |
| L3.2 | No ghost files referenced | All imports resolve to real files |
| L3.3 | No hallucinated API paths | Routes match existing `/api/license/*` prefix |
| L3.4 | Tier seat counts match pricing page | developer=1, team_pro=5 (per AGENTS.md pricing spec) |
| L3.5 | Worker guardrail uses existing API_CACHE pattern | No new KV namespace needed |

## API Contract

### GET /api/license/seats
```json
// Response 200
{
  "success": true,
  "maxSeats": 5,
  "seatsUsed": 2,
  "seatsRemaining": 3,
  "tier": "team_pro",
  "seats": [
    {
      "seatId": "seat_abc123",
      "email": "dev@team.com",
      "status": "active",
      "invitedAt": "2026-08-08T...",
      "activatedAt": "2026-08-08T..."
    }
  ],
  "pendingInvites": [
    {
      "seatId": "seat_def456",
      "email": "newdev@team.com",
      "status": "pending",
      "inviteToken": "inv_xyz789",
      "invitedAt": "2026-08-08T..."
    }
  ]
}
```

### POST /api/license/seats/invite
```json
// Request
{ "email": "newdev@team.com" }

// Response 201
{
  "success": true,
  "seatId": "seat_def456",
  "email": "newdev@team.com",
  "inviteToken": "inv_xyz789",
  "inviteUrl": "https://simplebeacon.ai/#/activate-license?token=inv_xyz789",
  "seatsUsed": 3,
  "seatsRemaining": 2
}

// Response 409 (no seats available)
{ "error": "no_available_seats", "message": "All 5 seats are in use" }
```

### DELETE /api/license/seats/revoke/:seatId
```json
// Response 200
{
  "success": true,
  "seatId": "seat_abc123",
  "email": "dev@team.com",
  "seatsUsed": 1,
  "seatsRemaining": 4
}

// Response 404
{ "error": "seat_not_found" }
```

## Storage Schema

Seat data stored in `LICENSE_STORE` KV under key `seats:{licenseKey}`:

```json
{
  "licenseKey": "eyJhbGci...",
  "tier": "team_pro",
  "maxSeats": 5,
  "seats": [
    {
      "seatId": "seat_abc123",
      "email": "dev@team.com",
      "status": "active",
      "inviteToken": null,
      "invitedAt": "2026-08-08T...",
      "activatedAt": "2026-08-08T..."
    },
    {
      "seatId": "seat_def456",
      "email": "newdev@team.com",
      "status": "pending",
      "inviteToken": "inv_xyz789",
      "invitedAt": "2026-08-08T...",
      "activatedAt": null
    }
  ],
  "updatedAt": "2026-08-08T..."
}
```

## Implementation Order

1. Add `TIER_SEAT_MAP` to `stripe.cjs` (config foundation)
2. Create `license-seat-routes.cjs` (3 route handlers)
3. Register routes in `index.cjs`
4. Add worker.js edge guardrails (cache seat verification lookups)
5. Build `LicenseManagerView.tsx` (frontend)
6. Register view in `App.tsx`
7. Run Level 1 checks
8. Hand off to Validator

## Approval

**Status:** Awaiting user approval before implementation begins.
