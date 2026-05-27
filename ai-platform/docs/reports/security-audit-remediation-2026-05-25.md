# Security Audit Remediation — 2026-05-25

Verification and in-repo remediation for the CascadeProjects / ai-platform security analysis.

## Executive summary

Critical and high findings were verified against source. In-repo fixes applied for secret handling, JWT fail-fast, DB password defaults, path/repo validation, CORS restriction, client error sanitization, deprecated crypto API, and env file neutralization. **Operator action is required** to rotate any secrets that were previously committed (Stripe test key, JWT secrets) and to configure production secrets via a secrets manager.

---

## Verified findings

| # | Finding | Status | Action taken |
|---|---------|--------|--------------|
| 1 | Hardcoded secrets in `.env`, `.env.production`, `.env.v1-internal` | **CONFIRMED** | Replaced real values with `REPLACE_ME` / placeholder patterns; expanded root `.gitignore` for env files |
| 2 | JWT random fallback in `auth.js`, `security.js` | **CONFIRMED** | Centralized `server/lib/secret-config.js` — fail-fast in production/`REQUIRE_AUTH`; dev ephemeral only with `ALLOW_DEV_EPHEMERAL_SECRETS=true` |
| 3 | Weak DB default password in `database.js` | **CONFIRMED** | Removed `secure_password` default; throws when DB enabled without `DB_PASSWORD`/`DATABASE_URL` password |
| 4 | Command injection in upload/assessment/analyzer/npm-audit/model-inference | **PARTIAL** | `upload.js`: unused `exec` removed (**FALSE_POSITIVE** for active shell injection). `AssessmentController`: `execFile` + `validateRepoUrl`. `codebase-analyzer`/`npm-audit-runner`: fixed argv, no user shell (**LOW**). `model-inference-service`: absolute-path validation for `LLAMA_CPP_BIN` |
| 5 | Permissive CORS in `dashboard-server.js`, `server/index.js` | **CONFIRMED** | `server/lib/cors-config.js` — env allowlist; production rejects `*` and empty origins |
| 6 | Missing input validation on analyze/assessment APIs | **CONFIRMED** | `server/lib/path-safety.js` — `assertSafeProjectPath`, `validateRepoUrl`; wired into flexible-analyze + AssessmentController |
| 7 | In-memory session Maps in `auth.js`, `sso-service.js` | **CONFIRMED** | **DEFERRED** — requires Redis/DB session store design |
| 8 | Information disclosure in error messages | **CONFIRMED** | `server/lib/client-error.js`; applied in `auth.js`, `dashboard-server.js`, flexible-analyze, AssessmentController |
| 9 | Weak CSP (`unsafe-inline`) | **CONFIRMED** | **DEFERRED** — dashboard uses inline scripts/CDNs; nonce/hash strategy needs frontend pass |
| 10 | Incomplete rate limiting | **PARTIAL** | Phase2 login/refresh limits existed; added auth login rate limit to `server/index.js` |
| 11 | Weak auth (`optionalAuthenticate`, no lockout) | **PARTIAL** | `optionalAuthenticate` retained for public API routes by design; rate limits mitigate brute force; account lockout **DEFERRED** |
| 12 | Deprecated `createCipher` in `security.js` | **CONFIRMED** | Replaced with `createCipheriv` / `createDecipheriv` for AES-256-GCM |
| 13 | File upload gaps (size/type/MIME) | **PARTIAL** | Multer limits exist in upload/local-models routes; virus scan & content sniffing **DEFERRED** |
| 14 | Missing security headers on some servers | **PARTIAL** | Phase2 `applyApiSecurityHeaders` exists; legacy `dashboard-server.js` lacks full helmet stack **DEFERRED** |
| 15 | Cookie security flags | **PARTIAL** | Configured in `security.js` session cookie when express-session used; not universal **DEFERRED** |
| 16 | Hardcoded config (ports, URLs) | **LOW** | Env-driven in production paths; examples in `.env.*.example` |
| 17 | Dependency vulnerabilities | **OPERATOR_ACTION** | Run `npm audit` / simplebeacon gate in CI; not auto-fixed in this pass |
| 18 | Verbose logging / auth debug | **PARTIAL** | Already gated by `LOG_AUTH` / `AUTH_DEBUG`; audit logs remain server-side |
| 19 | MFA not enforced end-to-end | **DEFERRED** | MFA helpers exist in `auth.js`; enforcement path incomplete |
| 20 | SSO in-memory caches | **DEFERRED** | Same as #7 |
| 21 | Directory watch arbitrary path (`upload.js`) | **CONFIRMED** | **DEFERRED** — route appears unused in production gate; needs auth + path allowlist if enabled |
| 22 | `config/.env` Stripe placeholder | **FALSE_POSITIVE** | Already `sk_test_placeholder` |
| 23 | Assessment `projectPath` for authenticated users | **CONFIRMED** | Now constrained to `ANALYZE_ALLOWED_ROOTS` (default: platform root) |
| 24 | Simplebeacon credential scanner coverage | **CONFIRMED** | Existing gate; re-run after remediation |
| 25 | Production leak rules | **CONFIRMED** | Existing `production-leak.js` / credential-pattern-scanner; no change required |

---

## Files changed

### New modules
- `ai-platform/server/lib/secret-config.js`
- `ai-platform/server/lib/cors-config.js`
- `ai-platform/server/lib/client-error.js`
- `ai-platform/server/lib/path-safety.js`

### Updated
- `ai-platform/server/middleware/auth.js`
- `ai-platform/server/config/security.js`
- `ai-platform/server/config/database.js`
- `ai-platform/server/bootstrap/phase2-integration.js`
- `ai-platform/server/dashboard-server.js`
- `ai-platform/server/index.js`
- `ai-platform/server/routes/flexible-analyze-api.js`
- `ai-platform/server/routes/upload.js`
- `ai-platform/server/api/assessment/AssessmentController.js`
- `ai-platform/server/services/model-inference-service.js`
- `ai-platform/.env.production`
- `ai-platform/.env.v1-internal`
- `.gitignore`

### Tests added/updated
- `ai-platform/tests/unit/secret-config.test.js`
- `ai-platform/tests/unit/path-safety.test.js`
- `ai-platform/tests/unit/client-error.test.js`
- `ai-platform/tests/unit/phase2-database-config.test.js`

---

## Operator actions required

1. **Rotate Stripe test key** if `sk_test_51TPbzq...` was ever committed or shared — revoke in [Stripe Dashboard](https://dashboard.stripe.com/apikeys) and issue a new restricted test key.
2. **Rotate JWT secrets** that were in `.env.production` / `.env.v1-internal` — treat as compromised if repo was ever public or widely cloned.
3. **Set production secrets** via host env or secrets manager (not committed files):
   - `JWT_SECRET`, `JWT_REFRESH_SECRET` (≥64 random bytes each)
   - `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`
   - `DB_PASSWORD` or `DATABASE_URL` when `ENABLE_DATABASE=true`
   - `ENCRYPTION_KEY`, `SESSION_SECRET` if encryption/session features are enabled
4. **Configure CORS** for production: `CORS_ORIGINS=https://simplebeacon.ai` (comma-separated allowlist).
5. **Optional local dev**: `ALLOW_DEV_EPHEMERAL_SECRETS=true` only on developer machines when secrets are not set.
6. **Optional analysis roots**: `ANALYZE_ALLOWED_ROOTS=/path/to/allowed/roots` for multi-root scan hosts.

---

## Deferred items (next tranche)

| Priority | Item | Rationale |
|----------|------|-----------|
| High | Redis-backed sessions + token revocation | Architectural; in-memory Maps don't scale or survive restarts |
| High | CSP nonce/hash for dashboard static assets | Requires frontend build pipeline changes |
| Medium | Account lockout after N failed logins | Needs persistent store (Redis/DB) |
| Medium | Upload directory watch + git clone URL allowlist in `upload.js` | Routes need auth gate review |
| Medium | Helmet/CSP on `dashboard-server.js` | Align with phase2 header middleware |
| Low | Dependency audit remediation | Track via simplebeacon gate / `npm audit fix` PRs |
| Low | MFA enforcement for gold trust level | Product decision + UX flow |

---

## Verification commands

```bash
cd ai-platform

# Unit tests for changed modules
npm test -- tests/unit/secret-config.test.js tests/unit/path-safety.test.js tests/unit/client-error.test.js tests/unit/phase2-database-config.test.js tests/unit/phase2-integration-bootstrap.test.js

# Credential pattern scan
npm run scan:credentials:repo

# Simplebeacon gate (broader)
npm run simplebeacon:report
```

---

## Notes

- `.env.example` / `.env.*.example` files remain the canonical templates; local overrides should copy from examples.
- Real secrets must never be re-committed. If env files were historically tracked, consider `git filter-repo` or BFG after rotation (operator decision outside this pass).
- Phase2 bootstrap already enforced `assertAuthConfiguration` when `REQUIRE_AUTH=true`; middleware-level JWT init now aligns with the same policy.

---

## Credential-only fix verification (2026-05-25 follow-up)

| File | Status | Notes |
|------|--------|-------|
| `.env.v1-internal` | **Updated** | Stripe → `sk_test_YOUR_KEY_HERE` + dashboard comment; JWT → `YOUR_JWT_SECRET_HERE` / `YOUR_JWT_REFRESH_SECRET_HERE` + generation comment |
| `.env.production` | **Updated** | JWT placeholders aligned to `YOUR_JWT_*_HERE` + generation comment |
| `server/middleware/auth.js` | **Already fixed** | Uses `resolveSecret('JWT_SECRET')` via `server/lib/secret-config.js` (fail-fast in production/`REQUIRE_AUTH`) |
| `server/config/security.js` | **Already fixed** | JWT, encryption, session secrets use `resolveSecret()` — no random fallback at init |
| `server/config/database.js` | **Already fixed** | Throws when DB enabled without `DB_PASSWORD`/`DATABASE_URL` password; empty password when DB disabled |
| `.gitignore` | **Already fixed** | `.env`, `.env.production`, `.env.v1-internal` (root + `ai-platform/`) listed |
| `.env.example` | **Updated** | Documents JWT generation command, Stripe key source, DB password requirement |

Prior `REPLACE_ME` / `replace-with-64-char-*` placeholders were equivalent to the new `YOUR_*_HERE` patterns; `secret-config.js` `PLACEHOLDER_PATTERN` treats both as non-configured.

**Required env vars (production / `REQUIRE_AUTH=true`):**

- `JWT_SECRET`, `JWT_REFRESH_SECRET` — 64+ random bytes each
- `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` — when monetization enabled
- `DB_PASSWORD` or `DATABASE_URL` with password — when `ENABLE_DATABASE=true`
- `ENCRYPTION_KEY`, `SESSION_SECRET` — when encryption/session features are used

**No real secrets found** in tracked env files after grep (`sk_test_51*`, `sk_live_51*`, 64+ hex JWT patterns).
