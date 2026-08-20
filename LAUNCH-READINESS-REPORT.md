# SimpleBeacon Launch Readiness Report

**Analysis Date:** 2026-07-01  
**Current Completion:** ~82% (code complete, 6 external account steps remaining)

---

## Executive Summary

**Verdict: NOT READY for external deployment until 2 code issues are fixed.**

All external account setup (npm, Render, DNS, Stripe, Resend, Marketplace) depends on the code being production-correct. I found **2 issues** that must be resolved first, plus **1 concern** to verify.

---

## 1. npm Publish — ✅ READY (after minor fix)

| Check                  | Status | Detail                                                                              |
| ---------------------- | ------ | ----------------------------------------------------------------------------------- |
| `package.json` name    | ✅     | `simplebeacon`                                                                      |
| `package.json` version | ✅     | `1.1.1`                                                                             |
| `bin` entries          | ✅     | 4 entries: `simplebeacon`, `simplebeacon-proxy`, `simplebeacon-mcp`, `samplebeacon` |
| `publishConfig.access` | ✅     | `public`                                                                            |
| `homepage`             | ✅     | `https://simplebeacon.ai`                                                           |
| `repository`           | ✅     | `github.com/tjp420/simplebeacon`                                                    |
| `files` array          | ✅     | `bin/`, `src/`, `LICENSE`, `README.md` (excludes tests)                             |
| `prepublishOnly`       | ✅     | Runs tests + MCP smoke test                                                         |
| Syntax validation      | ✅     | `bin/simplebeacon.js` passes `node -c`                                              |
| `engines`              | ✅     | Node `>=22.0.0`, npm `>=10.0.0`                                                     |

**Issue:** None blocking. CLI is ready to publish.

**Action needed:**

1. Create granular token at npmjs.com → add to `C:\Users\Trevor\.npmrc`
2. `cd packages/simplebeacon-cli && npm publish --access public`

---

## 2. Render Deploy — ⚠️ NEEDS 2 FIXES

### Verified Correct

| Check                | Status | Detail                                                                                                      |
| -------------------- | ------ | ----------------------------------------------------------------------------------------------------------- |
| `render.yaml` exists | ✅     | Present at repo root                                                                                        |
| `buildCommand`       | ✅     | `cd ai-platform && npm install`                                                                             |
| `startCommand`       | ✅     | `node ai-platform/simplebeacon-server.cjs`                                                                  |
| `healthCheckPath`    | ✅     | `/health`                                                                                                   |
| Health endpoint      | ✅     | Returns `{status: 'ok', uptime, timestamp}`                                                                 |
| Security headers     | ✅     | CSP, HSTS, X-Frame-Options, nosniff, Referrer-Policy                                                        |
| `express.static`     | ✅     | Restricted to `public/` with `dotfiles: 'deny', index: false`                                               |
| Billing webhook      | ✅     | Mounted at `/api/simplebeacon/billing/webhook` with raw body + signature verification                       |
| Stripe client        | ✅     | Reads `STRIPE_SECRET_KEY` from env                                                                          |
| Email service        | ✅     | `email-service.cjs` correctly uses `api.resend.com/emails` with fallback chain (Resend → SMTP → disk queue) |

### Issues Found

#### 🔴 Issue 1: Dead webhook file with WRONG Resend endpoint

**File:** `ai-platform/server/webhooks.cjs`

**Problem:** Line 43 calls `fetch('https://resend.com', ...)` — **wrong API endpoint**. The correct Resend API is `https://api.resend.com/emails`.

**Impact:** This file appears to be **dead code** — not imported by `simplebeacon-server.cjs` or `server/index.cjs`. The active webhook handler is in `src/api/simplebeacon-billing-api.cjs` which is correct. However, this dead file could confuse future developers or accidentally get imported.

**Fix:** Delete `ai-platform/server/webhooks.cjs` (it's superseded by `simplebeacon-billing-api.cjs`):

```powershell
Remove-Item ai-platform\server\webhooks.cjs
```

#### 🟡 Issue 2: Version badge mismatch in VS Code README

**File:** `simplebeacon-vscode-merged/README.md`

**Problem:** Line 3 shows badge `version-3.0.344-blue` but actual `package.json` version is `3.0.347`.

**Fix:**

```powershell
# In simplebeacon-vscode-merged/README.md
# Change: version-3.0.344 → version-3.0.347
```

---

## 3. DNS — ✅ READY (pending domain purchase)

| Check                                | Status | Detail                                                                       |
| ------------------------------------ | ------ | ---------------------------------------------------------------------------- |
| Hardcoded domain references          | ✅     | `simplebeacon.ai` used consistently across site-config, pricing, render.yaml |
| `ALLOWED_ORIGIN` in render.yaml      | ✅     | `https://simplebeacon.ai,https://simplebeacon.onrender.com`                  |
| `RESEND_FROM`                        | ✅     | `certificates@simplebeacon.ai`                                               |
| No localhost hardcoded in prod paths | ✅     | Public URLs use `simplebeacon.ai`                                            |

**Action needed:**

1. Purchase/verify `simplebeacon.ai`
2. In Cloudflare/Namecheap DNS:
   - A Record: `simplebeacon.ai` → Render load balancer IP
   - CNAME: `www` → `simplebeacon.ai`

---

## 4. Stripe Live Mode — ✅ READY (pending dashboard config)

| Check                           | Status | Detail                                                                                                     |
| ------------------------------- | ------ | ---------------------------------------------------------------------------------------------------------- |
| Webhook handler                 | ✅     | `simplebeacon-billing-api.cjs` — signature verification, event parsing, license generation, email dispatch |
| Webhook endpoint                | ✅     | `POST /api/simplebeacon/billing/webhook` with `express.raw()` body parser                                  |
| Webhook exempt from auth        | ✅     | `req.path.startsWith('/api/simplebeacon/billing/webhook')` skips auth middleware                           |
| Checkout session creation       | ✅     | `coming-soon/routes/checkout.cjs` creates Stripe checkout sessions with `price_data`                       |
| Price configuration             | ✅     | `SCAN_OPTION_MAP` defines prices: Gate Scan $29, Instant Report $499, etc.                                 |
| `STRIPE_SECRET_KEY` env var     | ✅     | Read from env in both `simplebeacon-billing-api.cjs` and `checkout.cjs`                                    |
| `STRIPE_WEBHOOK_SECRET` env var | ✅     | Required for webhook signature verification                                                                |
| License token generation        | ✅     | Uses `SIMPLEBEACON_LICENSE_SECRET` with JWT                                                                |
| Email fulfillment               | ✅     | Sends license token via email after `checkout.session.completed`                                           |

**Action needed:**

1. Stripe dashboard → Live mode → create products → copy Price IDs to Render env vars
2. Create webhook endpoint: `https://simplebeacon.ai/api/simplebeacon/billing/webhook`
3. Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`

---

## 5. Resend Email — ✅ READY (pending dashboard signup)

| Check               | Status | Detail                                                      |
| ------------------- | ------ | ----------------------------------------------------------- |
| Resend API endpoint | ✅     | `email-service.cjs` uses `api.resend.com/emails` (correct)  |
| API key validation  | ✅     | Checks `startsWith('re_')`                                  |
| From address        | ✅     | Defaults to `certificates@simplebeacon.ai`                  |
| Fallback chain      | ✅     | Resend → SMTP (nodemailer) → disk queue                     |
| Disk queue dir      | ✅     | `.simplebeacon/email-queue/` with JSON files                |
| Render env vars     | ✅     | `RESEND_API_KEY`, `RESEND_FROM` documented in `render.yaml` |

**Action needed:**

1. Sign up at resend.com
2. Add domain `simplebeacon.ai` → verify TXT/MX records
3. Copy API key to Render dashboard env vars

---

## 6. VS Code Marketplace — ✅ READY (pending screenshots + account)

| Check                   | Status | Detail                                                                  |
| ----------------------- | ------ | ----------------------------------------------------------------------- |
| `.vsix` packaged        | ✅     | `simplebeacon-3.0.347.vsix` (18.44 MB)                                  |
| `package.json` metadata | ✅     | Name `simplebeacon-vscode`, version `3.0.347`, publisher `simplebeacon` |
| `README.md`             | ✅     | Present with features, installation, usage instructions                 |
| Icon                    | ✅     | `media/icon.svg` exists and is >1KB                                     |
| `engines.vscode`        | ✅     | `^1.90.0`                                                               |
| `keywords`              | ✅     | 12 keywords including "mcp", "cursor", "model-context-protocol"         |
| `displayName`           | ✅     | "SimpleBeacon AI Slop Cop"                                              |

**Issue:** Version badge in README says `3.0.344` instead of `3.0.347` (cosmetic).

**Action needed:**

1. Fix badge version in README
2. Capture 5 screenshots at 1280×800 in light theme
3. Register publisher `simplebeacon` at marketplace.visualstudio.com
4. Upload `.vsix` + screenshots

---

## Critical Path to 100%

### Must Fix Before Any External Step

```
1. Delete dead webhook file: ai-platform/server/webhooks.cjs
2. Fix README version badge: 3.0.344 → 3.0.347
3. Commit these fixes
```

### Then External Steps (any order, ~90 min total)

```
A. npm publish (10 min)
B. Render deploy (15 min)
C. DNS (10 min) — depends on B
D. Stripe live (30 min) — depends on B
E. Resend email (15 min) — depends on C (domain verification)
F. VS Code Marketplace (1 hour) — independent, but needs 5 screenshots
```

---

## Detailed Issue Tracking

| #   | File                                   | Line | Issue                                                                                    | Severity | Fix                      |
| --- | -------------------------------------- | ---- | ---------------------------------------------------------------------------------------- | -------- | ------------------------ |
| 1   | `ai-platform/server/webhooks.cjs`      | 43   | `fetch('https://resend.com')` — wrong endpoint. Correct: `https://api.resend.com/emails` | 🔴 High  | Delete file (dead code)  |
| 2   | `simplebeacon-vscode-merged/README.md` | 3    | Badge version `3.0.344` ≠ actual `3.0.347`                                               | 🟡 Low   | Replace `344` with `347` |

---

## Post-Launch Verification Commands

After completing all steps, run these to verify:

```bash
# 1. npm published
npm view simplebeacon version

# 2. Render health
 curl https://simplebeacon.ai/health

# 3. DNS resolution
dig simplebeacon.ai +short

# 4. Security headers
curl -I https://simplebeacon.ai
# Expect: strict-transport-security, x-content-type-options: nosniff

# 5. No secrets exposed
curl https://simplebeacon.ai/.env
# Expect: 404 or 403

# 6. Stripe webhook test
curl -X POST https://simplebeacon.ai/api/simplebeacon/billing/webhook \
  -H "Content-Type: application/json" \
  -d '{"type":"test"}'
# Expect: 400 (invalid signature) — NOT 404

# 7. Resend test email
node scripts/verify-resend.js

# 8. Pre-launch checklist
node scripts/pre-launch-checklist.cjs
# Expect: 31/31 passing
```

---

**Bottom line:** You're ~82% done. Fix 2 small code issues, then it's purely external account setup. The hard engineering work is complete.
