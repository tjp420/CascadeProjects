# Sprint Plan: Next Engineering Priorities

Generated from codebase audit on 2026-08-14.

## Sprint Goal

Close critical gaps in the billing/license/user-management stack shipped this session, plus add the missing server-side endpoints the dashboard already expects.

---

## P0 — Critical (blocks paying customers)

### 1. Add `/api/session-token/:sessionId` endpoint to ai-platform server

**Problem:** The dashboard's License Manager (`LicenseManagerView.tsx:218`) calls `apiUrl("/session-token/${sessionId}")` after Stripe checkout redirect. The coming-soon Pages app has this endpoint (`checkout.cjs:433`), but the ai-platform Render server does NOT. Customers who pay via the production server (`simplebeacon.ai`) get a 404 when the dashboard tries to auto-retrieve their license token post-checkout.

**Fix:** Add a route in `ai-platform/simplebeacon-server.cjs` (or `server/routes/`) that:
- Accepts `GET /api/session-token/:sessionId`
- Reads from the same in-memory store used by `simplebeacon-billing-api.cjs:437`
- Returns `{ success: true, token, email, projectName, tier }`
- Falls back gracefully if the store is empty (Render restart)

**Files:**
- `ai-platform/simplebeacon-server.cjs` — add route
- `ai-platform/src/api/simplebeacon-billing-api.cjs` — verify store is shared
- `coming-soon/routes/session-token-store.cjs` — may need to be shared module

**Test:** `node scripts/test-payment-sim.cjs` + manual checkout flow test

---

### 2. License token revocation endpoint

**Problem:** When an admin generates a license token (via the new Admin Licenses tab), there's no way to revoke it without rotating `SIMPLEBEACON_LICENSE_SECRET` (which invalidates ALL customers). The agent review link exposed a 30-day Enterprise token with no revocation path.

**Fix:** Add `POST /api/admin/licenses/revoke` endpoint that:
- Takes `{ jti }` (token ID from JWT payload) or `{ email }`
- Adds the jti to a revocation list (SQLite table or file)
- `validateLicenseToken()` checks the revocation list before returning valid
- Admin UI shows a "Revoke" button next to generated tokens

**Files:**
- `ai-platform/server/routes/admin-api.cjs` — new endpoint
- `packages/simplebeacon-cli/src/lib/license-token.js` — check revocation list
- `ai-platform/web/simplebeacon-dashboard/src/views/AdminView.tsx` — revoke button

---

### 3. Tests for new admin billing endpoint

**Problem:** `GET /api/admin/billing/subscriptions` (added this session) has no tests. The existing admin-api test file (`server/__tests__/admin-api.test.cjs`) doesn't cover billing.

**Fix:** Add tests for:
- Empty billing data (no subscriptions)
- Active/inactive/refunded subscription enrichment
- Revenue calculation (monthly vs annual, MRR math)
- Forbidden for non-admin users
- SQLite unavailable (graceful degradation)

**Files:**
- `ai-platform/server/__tests__/admin-api.test.cjs` — add billing test suite

---

## P1 — High (improves reliability)

### 4. Webhook → session-token-store integration on ai-platform

**Problem:** `stripe-webhook-routes.cjs` handles `checkout.session.completed` but does NOT store the license token in the session-token store. Only `simplebeacon-billing-api.cjs:437` does. If a customer's checkout goes through the webhook path (not the billing API path), the post-checkout redirect can't retrieve the token.

**Fix:** In `stripe-webhook-routes.cjs`, after generating the license token on `checkout.session.completed`, also call `sessionTokenStore.set(session.id, { token, email, tier })`.

**Files:**
- `ai-platform/server/routes/stripe-webhook-routes.cjs` — add store call
- Verify `coming-soon/routes/session-token-store.cjs` is importable

---

### 5. Admin user search + pagination

**Problem:** The Admin Users tab loads all users with no search or pagination. The server already supports `?page=1&limit=50&search=email` (`admin-api.cjs:914`), but the dashboard doesn't use it.

**Fix:** Add a search input and pagination controls to the Users tab. Wire to the existing server-side pagination.

**Files:**
- `ai-platform/web/simplebeacon-dashboard/src/views/AdminView.tsx` — add search/pagination UI
- Verify `fetchData()` passes search params

---

### 6. Production cache purge automation

**Problem:** `simplebeacon.ai` has historically served stale dashboard assets after Pages deployments. The team has to manually purge the Cloudflare cache.

**Fix:** Add a post-deploy script that calls the Cloudflare cache purge API for `simplebeacon.ai/dashboard/*` after every `wrangler pages deploy`.

**Files:**
- `scripts/purge-cloudflare-cache.cjs` — new script
- `package.json` — add `deploy:dashboard` script that deploys + purges

---

## P2 — Medium (marketing + DX)

### 7. FAQ entry: "Does SimpleBeacon solve the black box problem?"

**Problem:** No FAQ entry addresses the AI interpretability question. Technical buyers need to see the honest framing.

**Fix:** Add to `coming-soon/public/faq.html`:

> **Does SimpleBeacon solve the AI "black box" problem?**
> No. The black box problem is about understanding why a neural network makes a specific decision — that's model interpretability research, not what we do. SimpleBeacon verifies what comes OUT of the black box. You can't see inside the black box. SimpleBeacon makes sure you don't have to trust it blindly.

**Files:**
- `coming-soon/public/faq.html` — add Q&A

---

### 8. GitHub Actions CI example for "fail build on AI slop"

**Problem:** No documented CI example showing developers how to fail a build when SimpleBeacon flags AI slop. The scanner supports `--gate` mode but there's no public example.

**Fix:** Add a reusable GitHub Action workflow file and document it in the README.

**Files:**
- `.github/workflows/simplebeacon-ci-example.yml` — example workflow
- `README.md` — add CI integration section

---

### 9. Agent access page (replace URL token embedding)

**Problem:** Current agent review links embed JWT + license token in URL query params. This is insecure for sharing.

**Fix:** Create a `/agent-access` page that:
- Admin logs in normally
- Clicks "Generate Agent Review Link"
- Server creates a short-lived single-use token (5 min TTL)
- Returns a URL like `/dashboard/?sb_agent_token=abc123`
- Dashboard exchanges `sb_agent_token` for auth + license tokens via API
- Tokens go into localStorage, URL params are clean

**Files:**
- `ai-platform/server/routes/admin-api.cjs` — new `POST /agent-access-token` endpoint
- `ai-platform/web/simplebeacon-dashboard/src/views/AgentAccessView.tsx` — new view
- `ai-platform/web/simplebeacon-dashboard/src/config.ts` — exchange logic

---

## Sprint Backlog Summary

| # | Priority | Task | Effort | Blocks customers? |
|---|----------|------|--------|-------------------|
| 1 | P0 | session-token endpoint on ai-platform | Small | Yes |
| 2 | P0 | License revocation endpoint | Medium | No (but security) |
| 3 | P0 | Tests for billing endpoint | Small | No |
| 4 | P1 | Webhook → session-token-store | Small | Edge case |
| 5 | P1 | Admin user search + pagination | Medium | No |
| 6 | P1 | Cloudflare cache purge automation | Small | No |
| 7 | P2 | FAQ: black box framing | Small | No |
| 8 | P2 | CI example for AI slop gate | Small | No |
| 9 | P2 | Agent access page (no URL tokens) | Medium | No |

## Recommended order

1. **#1 first** — it's blocking paying customers right now
2. **#4** — same area, do together
3. **#2 + #3** — security + tests for the work shipped this session
4. **#5** — admin UX improvement
5. **#6** — deployment reliability
6. **#7 + #8** — marketing/DX
7. **#9** — replace the hacky URL token approach
