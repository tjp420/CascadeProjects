# API Contract Audit — C:\Users\Trevor\CascadeProjects

## Summary

| Category                 | Finding                                               |
| ------------------------ | ----------------------------------------------------- |
| **REST endpoints**       | 13 defined (coming-soon + mounted ai-platform routes) |
| **Frontend fetch calls** | 7 distinct endpoint patterns                          |
| **Unused endpoints**     | 6 (no frontend call found)                            |
| **GraphQL**              | **None found**                                        |
| **OpenAPI / Swagger**    | **None found**                                        |

---

## 1. REST Endpoints with No Frontend Call

### 1.1 `GET /api/simplebeacon`

**File:** `c:/Users/Trevor/CascadeProjects/coming-soon/server.cjs:160`
**Purpose:** Service info (`{ status: 'ok', service: 'simplebeacon-api', version: '1.3.0' }`)
**Called from frontend?** **No.** No `fetch('/api/simplebeacon')` found in any HTML/JS file.
**Risk:** Low. Harmless info endpoint.
**Action:** Remove or use for a "System Status" footer widget.

---

### 1.2 `GET /health`

**File:** `c:/Users/Trevor/CascadeProjects/coming-soon/server.cjs:165`
**Purpose:** Render/load balancer health check (`{ status: 'ok', uptime: ... }`)
**Called from frontend?** **No.** Only infrastructure probes.
**Risk:** None. Standard ops endpoint.
**Action:** None.

---

### 1.3 `GET /api/analyze/wiring`

**File:** `c:/Users/Trevor/CascadeProjects/coming-soon/server.cjs:170`
**Purpose:** Comprehensive wiring check (DB, email, JWT, Stripe, filesystem, AI platform)
**Called from frontend?** **No.** No fetch call found.
**Risk:** Medium. Exposes internal service status (Stripe key presence, DB connectivity).
**Action:** Add auth or IP whitelist; or wire to an admin dashboard.

---

### 1.4 `POST /api/create-checkout-session`

**File:** `c:/Users/Trevor/CascadeProjects/coming-soon/routes/checkout.cjs:227`
**Purpose:** Creates a real Stripe Checkout Session for Custom Plan purchases.
**Called from frontend?** **No.** `pricing.html` calls `/api/test-checkout` instead (lines 626, 702, 904).
**Risk:** **High.** Dead code path. The "real" Stripe checkout is unreachable from the UI. Users always go through the test/demo checkout.
**Action:** Either:

- **A)** Wire `pricing.html` to call `/api/create-checkout-session` when Stripe is configured, OR
- **B)** Remove `/api/create-checkout-session` if test-checkout is the intended path.

---

### 1.5 `POST /api/subscribe`

**File:** `c:/Users/Trevor/CascadeProjects/coming-soon/routes/subscriptions.cjs:17`
**Purpose:** Newsletter signup (`{ email }` → stores in SQLite)
**Called from frontend?** **No.** No fetch call to `/api/subscribe` found in any HTML/JS file.
**Risk:** Medium. Newsletter form may be submitting to Formspree (external) instead of this endpoint.
**Action:** Check if any newsletter form uses this endpoint. If not, remove or wire the footer newsletter form to it.

---

### 1.6 `POST /api/checkout/webhook`

**File:** `c:/Users/Trevor/CascadeProjects/coming-soon/routes/checkout.cjs:291`
**Purpose:** Stripe webhook receiver (`checkout.session.completed`)
**Called from frontend?** **No.** Stripe servers call this.
**Risk:** None. By design.
**Action:** None.

---

## 2. REST Endpoints WITH Frontend Calls (Verified)

| Endpoint                                      | Frontend Callers                                                 | Status    |
| --------------------------------------------- | ---------------------------------------------------------------- | --------- |
| `POST /api/test-checkout`                     | `pricing.html` (3×)                                              | ✅ Active |
| `GET /api/session-token/:sessionId`           | `certificate-upload.html`                                        | ✅ Active |
| `POST /api/simplebeacon/billing/resend-token` | `certificate-upload.html`, `main.js`                             | ✅ Active |
| `GET /api/free-token`                         | `certificate-upload.html`, `main.js`                             | ✅ Active |
| `GET /api/analyze/progress?scanId=`           | `certificate-upload.html`, `cloud-scan.html`, `scan-status.html` | ✅ Active |
| `POST /api/analyze/upload-directory`          | `cloud-scan.html`                                                | ✅ Active |
| `POST /api/certificate/download`              | `certificate-upload.html` (2×), `cloud-scan.html`                | ✅ Active |

---

## 3. GraphQL — Not Found

**Search scope:** `ai-platform/**/*.js`, `ai-platform/**/*.cjs`, `ai-platform/**/*.ts`, `ai-platform/**/*.graphql`
**Result:** 0 GraphQL schema definitions. No `type Query`, `type Mutation`, or `.graphql` files.
**Conclusion:** This codebase does not use GraphQL.

---

## 4. OpenAPI / Swagger — Not Found

**Search scope:** `C:\Users\Trevor\CascadeProjects/**/*.yaml`, `**/*.yml`, `**/*.openapi.*`
**Result:** 0 OpenAPI spec files.
**Conclusion:** No API contract documentation exists in spec format.

---

## 5. Recommendations

### Immediate (This Week)

| #   | Action                                                                                                             | File                                     |
| --- | ------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| 1   | **Decide on Stripe checkout** — either wire frontend to `/api/create-checkout-session` or delete the dead endpoint | `routes/checkout.cjs:227-280`            |
| 2   | **Wire newsletter form** to `/api/subscribe` or remove the route                                                   | `routes/subscriptions.cjs` + footer HTML |
| 3   | **Add auth to `/api/analyze/wiring`** — it exposes DB/Stripe/JWT status                                            | `server.cjs:170`                         |

### Short Term (Next Sprint)

| #   | Action                                                               | Rationale                                                      |
| --- | -------------------------------------------------------------------- | -------------------------------------------------------------- |
| 4   | Generate an OpenAPI spec (`openapi.yaml`) for all `/api/*` endpoints | Enables auto-generated docs, client SDKs, and contract testing |
| 5   | Add a `/api/openapi.yaml` static serve route                         | Makes spec discoverable                                        |

### Nice to Have

| #   | Action                                                               | Rationale                              |
| --- | -------------------------------------------------------------------- | -------------------------------------- |
| 6   | Add a frontend "System Status" widget that polls `/api/simplebeacon` | Uses the currently unused endpoint     |
| 7   | Add a `/api/routes` introspection endpoint                           | Lists all mounted routes for debugging |

---

## Files Referenced

- `c:/Users/Trevor/CascadeProjects/coming-soon/server.cjs`
- `c:/Users/Trevor/CascadeProjects/coming-soon/routes/checkout.cjs`
- `c:/Users/Trevor/CascadeProjects/coming-soon/routes/certificates.cjs`
- `c:/Users/Trevor/CascadeProjects/coming-soon/routes/free-token.cjs`
- `c:/Users/Trevor/CascadeProjects/coming-soon/routes/subscriptions.cjs`
- `c:/Users/Trevor/CascadeProjects/coming-soon/pricing.html`
- `c:/Users/Trevor/CascadeProjects/coming-soon/certificate-upload.html`
- `c:/Users/Trevor/CascadeProjects/coming-soon/js/dashboard/main.js`
- `c:/Users/Trevor/CascadeProjects/coming-soon/cloud-scan.html`
- `c:/Users/Trevor/CascadeProjects/coming-soon/scan-status.html`
- `c:/Users/Trevor/CascadeProjects/ai-platform/server/routes/flexible-analyze-api.cjs`
- `c:/Users/Trevor/CascadeProjects/ai-platform/src/api/simplebeacon-billing-api.cjs`
