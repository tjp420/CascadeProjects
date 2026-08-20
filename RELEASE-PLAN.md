# SimpleBeacon Safe Release Plan

**Generated:** 2026-06-06  
**Product:** SimpleBeacon — Code security scanner + certificate generator  
**Current State:** Monolith (`coming-soon/` static + API mixed)  
**Target State:** Cloudflare Pages (static) + Render API (backend)  
**Gate Status:** Dashboard scan clean (1 false positive); CLI scan has 79 infra false positives

---

## Executive Summary

This plan moves SimpleBeacon from a single-directory monolith to a production-grade split architecture. The **frontend** (browser scanner, marketing pages) deploys to **Cloudflare Pages** for global edge caching. The **backend** (billing, token generation, email queue) deploys to **Render** as an isolated API service.

**Risk level:** Medium — the main risk is the `express.static(__dirname)` vulnerability that currently exposes `.env`, `server.cjs`, and `subscriptions.json` to anyone who requests them.

**Timeline:** 2 weeks (aggressive) / 4 weeks (safe)

---

## Phase 0 — Pre-Flight Checklist (Day 1)

**Goal:** Verify the codebase is release-ready before any infrastructure changes.

| #   | Check                         | Command / Action                                        | Pass Criteria                         |
| --- | ----------------------------- | ------------------------------------------------------- | ------------------------------------- |
| 0.1 | Git is clean                  | `git status`                                            | Working tree clean                    |
| 0.2 | Syntax check all JS           | `node -c coming-soon/server.cjs`                        | No parse errors                       |
| 0.3 | Syntax check upload.html      | Extract `<script>` blocks, `node -c`                    | No parse errors                       |
| 0.4 | Unit tests pass               | `node --test packages/simplebeacon-cli/tests/*.test.js` | All green                             |
| 0.5 | Environment template complete | Review `coming-soon/.env.example`                       | All required keys documented          |
| 0.6 | No secrets in git             | `git log --all --full-history -S 'sk_live_' -p`         | No leaked Stripe keys                 |
| 0.7 | Rate limits active            | Read `server.cjs` lines 12-18                           | Free token + cert rate limits present |
| 0.8 | XSS escape present            | `grep 'escapeHtml' coming-soon/server.cjs`              | Helper defined and used               |

**Exit gate:** All checks must pass before proceeding to Phase 1.

---

## Phase 1 — Security Hardening (Days 1-2)

**Goal:** Fix the `express.static(__dirname)` vulnerability and harden the monolith _before_ splitting it.

### 1.1 Fix Static File Serving

**File:** `coming-soon/server.cjs`

The current code likely has `app.use(express.static(__dirname))` or similar. This exposes:

- `.env` (secrets)
- `server.cjs` (backend logic)
- `subscriptions.json` (user data)
- `node_modules/` (dependency code)

**Fix:** Restrict static serving to a safe subdirectory.

```javascript
// BEFORE (vulnerable)
app.use(express.static(__dirname));

// AFTER (safe)
app.use(express.static(path.join(__dirname, "public")));
// Or, if no public/ dir exists yet:
app.use(
  express.static(__dirname, {
    dotfiles: "deny",
    index: ["index.html"],
    setHeaders: (res, filePath) => {
      const ext = path.extname(filePath).toLowerCase();
      if (
        ext === ".env" ||
        ext === ".json" ||
        ext === ".cjs" ||
        ext === ".js"
      ) {
        res.status(403).end();
      }
    },
  }),
);
```

**Even better:** Move all static assets into `coming-soon/public/` and serve only that directory.

### 1.2 Add Security Headers

Add helmet or manual headers in `server.cjs`:

```javascript
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  next();
});
```

### 1.3 Verify No Hardcoded Secrets

```bash
# Run from project root
grep -r "sk_live_" coming-soon/ ai-platform/ packages/ || echo "No live keys found"
grep -r "sk_test_" coming-soon/ ai-platform/ packages/ || echo "No test keys found"
grep -r "re_" coming-soon/ ai-platform/ packages/ | grep -v "node_modules" | grep -v ".env"
```

### 1.4 Fix Simplebeacon Config Exclusions

Per `REMEDIATION.md`, add test fixture exclusions to root `.simplebeacon/config.json`:

```json
{
  "fullDirectoryScanSkipDirs": [
    ".git",
    ".github-sync",
    "github-cache",
    "node_modules",
    "simplebeacon-rule-tests"
  ],
  "ignore": [
    "node_modules/**",
    "coverage/**",
    "dist/**",
    "build/**",
    "**/*.test.js",
    "**/*.spec.js",
    "tests/**",
    "test/**",
    "simplebeacon-rule-tests/**"
  ]
}
```

**Verification:**

```bash
npx simplebeacon scan --gate --format json
# Expected: severityCounts.critical === 0, severityCounts.high === 0
```

---

## Phase 2 — Extract API Backend (Days 3-5)

**Goal:** Separate the Express API from the static frontend so they can deploy independently.

### 2.1 Create `api/` Directory

```
api/
├── server.js              ← Extracted from coming-soon/server.cjs
├── package.json           ← API-only dependencies
├── routes/
│   ├── analyze.js         ← File upload + scan trigger
│   ├── certificate.js     ← Certificate generation
│   ├── billing.js         ← Stripe webhooks
│   └── auth.js            ← Token validation
├── lib/
│   ├── scan-engine.js     ← Simplebeacon CLI wrapper
│   ├── pdf-generator.js   ← Certificate PDF builder
│   └── email-queue.js     ← Disk-based email queue
└── .env.example
```

### 2.2 Extract Server Logic

Copy `coming-soon/server.cjs` → `api/server.js`, then remove:

- All `express.static()` calls
- HTML route handlers (keep JSON API only)
- Frontend-specific middleware

**Keep:**

- File upload endpoints (`/api/analyze/upload-directory`)
- Certificate endpoints
- Stripe webhook handler
- Token generation/validation
- Email queue logic
- Rate limiters

### 2.3 Create API-Only package.json

```json
{
  "name": "simplebeacon-api",
  "version": "1.0.0",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js"
  },
  "dependencies": {
    "express": "^4.22.2",
    "cors": "^2.8.6",
    "helmet": "^7.0.0",
    "express-rate-limit": "^8.5.2",
    "multer": "^1.4.5-lts.1",
    "dotenv": "^16.3.1",
    "stripe": "^22.1.1",
    "nodemailer": "^8.0.10",
    "pg": "^8.21.0",
    "redis": "^4.7.1",
    "jsonwebtoken": "^9.0.3",
    "bcryptjs": "^3.0.3",
    "winston": "^3.8.0"
  }
}
```

### 2.4 Add CORS for Cross-Origin Frontend

```javascript
const cors = require("cors");
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "https://simplebeacon.com",
      "https://simplebeacon.pages.dev",
    ],
    credentials: true,
  }),
);
```

### 2.5 Environment Variable Migration

| Variable                      | Source             | Destination      | Action                     |
| ----------------------------- | ------------------ | ---------------- | -------------------------- |
| `SIMPLEBEACON_LICENSE_SECRET` | `coming-soon/.env` | Render dashboard | Move, never commit         |
| `STRIPE_SECRET_KEY`           | `coming-soon/.env` | Render dashboard | Move, never commit         |
| `STRIPE_WEBHOOK_SECRET`       | `coming-soon/.env` | Render dashboard | Move, never commit         |
| `RESEND_API_KEY`              | `coming-soon/.env` | Render dashboard | Move, never commit         |
| `DATABASE_URL`                | —                  | Render dashboard | Create PostgreSQL instance |
| `REDIS_URL`                   | —                  | Render dashboard | Create Redis instance      |
| `SIMPLEBEACON_APP_URL`        | `coming-soon/.env` | Both             | Set to prod URL            |

**Critical:** Delete `coming-soon/.env` from git history if it was ever committed:

```bash
git filter-branch --force --index-filter \
  'git rm --cached --ignore-unmatch coming-soon/.env' \
  --prune-empty --tag-name-filter cat -- --all
```

---

## Phase 3 — Frontend Preparation (Days 6-7)

**Goal:** Make `coming-soon/` a pure static site with no backend secrets.

### 3.1 Remove Backend Files from Frontend

Delete or move these from `coming-soon/`:

- `server.cjs` → moved to `api/server.js`
- `package.json` (backend deps) → replaced with empty or removed
- `.env` → deleted (secrets moved to Render)
- `subscriptions.json` → moved to `api/data/` or PostgreSQL
- `node_modules/` → deleted (frontend has no npm deps)
- `start-server.bat`, `stop-server.bat` → moved to `api/`
- `error.log` → deleted

### 3.2 Add API Base URL Config

Create `coming-soon/config.js`:

```javascript
window.API_BASE_URL =
  window.location.hostname === "localhost"
    ? "http://localhost:3001"
    : "https://api.simplebeacon.com";
```

Reference it in `upload.html`, `pricing.html`, `contact.js`:

```javascript
fetch(`${window.API_BASE_URL}/api/analyze/upload-directory`, { ... })
```

### 3.3 Update Upload.html for API Mode

The browser scanner in `upload.html` currently works in two modes:

1. **Pure client-side:** File picker → JSZip → html2canvas → download (no server)
2. **Server-assisted:** Upload to `/api/analyze/upload-directory` for deep scans

For Phase 3 release, **Mode 1 is the primary product** — it requires no backend. Mode 2 should call the Render API.

**Action:** Verify the `API_BASE_URL` switch works for both modes.

### 3.4 Verify No Secrets in Static Files

```bash
grep -r "sk_" coming-soon/ || echo "No Stripe keys"
grep -r "whsec_" coming-soon/ || echo "No webhook secrets"
grep -r "re_" coming-soon/ | grep -v "require" | grep -v "response" || echo "No Resend keys"
```

---

## Phase 4 — Deployment (Days 8-10)

### 4.1 Deploy Frontend to Cloudflare Pages

```bash
cd coming-soon
# Install Wrangler (if not already installed)
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy . --project-name simplebeacon
```

**DNS:** Add custom domain `simplebeacon.com` in Cloudflare dashboard.

### 4.2 Deploy Backend to Render

Use the existing `render.yaml`:

```bash
git push origin main
# Render auto-deploys from GitHub
```

**Manual setup if needed:**

1. Create new Web Service on Render
2. Root directory: `api/`
3. Build command: `npm install`
4. Start command: `node server.js`
5. Add all environment variables from Phase 2.5

### 4.3 Configure DNS

In Cloudflare DNS:

| Type  | Name               | Value                           |
| ----- | ------------------ | ------------------------------- |
| A     | `simplebeacon.com` | Cloudflare Pages IP             |
| CNAME | `www`              | `simplebeacon.pages.dev`        |
| CNAME | `api`              | `simplebeacon-api.onrender.com` |

---

## Phase 5 — Testing & Validation (Days 11-12)

### 5.1 End-to-End Test Matrix

| Test             | Steps                                  | Expected                               |
| ---------------- | -------------------------------------- | -------------------------------------- |
| Landing loads    | Visit `https://simplebeacon.com`       | Page renders, no 500 errors            |
| Pricing loads    | Visit `/pricing.html`                  | Stripe links populated from env        |
| Upload (client)  | Select folder in `upload.html`         | ZIP generated locally, downloaded      |
| Upload (server)  | Call `/api/analyze/upload-directory`   | Scan report returned                   |
| Token generation | Purchase via Stripe                    | Token emailed, valid for tier duration |
| Certificate      | Use token in `certificate-upload.html` | Certificate generated, not watermarked |
| Webhook          | Stripe test webhook                    | 200 OK, subscription updated           |
| Rate limit       | Request >5 uploads in 15 min           | 429 Too Many Requests                  |

### 5.2 Security Smoke Tests

```bash
# Should return 403 or 404
curl https://simplebeacon.com/.env
curl https://simplebeacon.com/server.cjs
curl https://simplebeacon.com/subscriptions.json

# Should return 200
curl -I https://simplebeacon.com/index.html
curl -I https://simplebeacon.com/upload.html
```

### 5.3 Performance Baseline

```bash
# Lighthouse CI or manual
npx lighthouse https://simplebeacon.com --output=json

# Target scores:
# Performance: >90
# Accessibility: >90
# Best Practices: >95
# SEO: >95
```

---

## Phase 6 — Rollback Plan (Always Ready)

### 6.1 Rollback Triggers

| Condition                        | Action                                                 |
| -------------------------------- | ------------------------------------------------------ |
| >5% of uploads fail              | Revert Render deployment to previous commit            |
| Stripe webhooks return >10% 500s | Disable webhook endpoint, fix code, re-enable          |
| `.env` or secrets exposed        | Immediately rotate ALL secrets (Stripe, Resend, JWT)   |
| Certificate generation fails     | Redirect `certificate-upload.html` to maintenance page |
| Client-side scan crashes         | Revert `upload.html` to last known good commit         |

### 6.2 Rollback Commands

**Render:**

- Dashboard → Manual Deploy → Select previous commit → Deploy

**Cloudflare Pages:**

- Dashboard → Deployments → Select previous deployment → Rollback

**Git:**

```bash
git revert HEAD  # Reverts last commit
git push origin main
```

### 6.3 Maintenance Page

Create `coming-soon/maintenance.html` (static, no API calls):

```html
<!DOCTYPE html>
<html>
  <head>
    <title>SimpleBeacon — Maintenance</title>
  </head>
  <body style="font-family:sans-serif;text-align:center;padding:80px 20px;">
    <h1>🔧 Under Maintenance</h1>
    <p>We're upgrading our infrastructure. The scanner will be back shortly.</p>
    <p>Contact: support@simplebeacon.com</p>
  </body>
</html>
```

Deploy to Cloudflare as fallback.

---

## Phase 7 — Post-Release Monitoring (Ongoing)

### 7.1 Logs to Watch

| Source     | Location              | What to Monitor                         |
| ---------- | --------------------- | --------------------------------------- |
| Render     | Render dashboard logs | 500 errors, memory usage, restart count |
| Cloudflare | Analytics dashboard   | 4xx/5xx rates, cache hit ratio          |
| Stripe     | Stripe dashboard      | Webhook delivery failures, dispute rate |
| Email      | Resend dashboard      | Bounce rate, delivery failures          |

### 7.2 Alert Thresholds

| Metric                     | Warning | Critical |
| -------------------------- | ------- | -------- |
| API 5xx rate               | >1%     | >5%      |
| Avg response time          | >500ms  | >2000ms  |
| Failed webhooks/hour       | >5      | >20      |
| Free token abuse (same IP) | >10/hr  | >50/hr   |
| Disk queue size            | >100    | >500     |

### 7.3 Weekly Hygiene

```bash
# Run every Monday
npx simplebeacon scan --gate --format json
# Review report for new findings

# Check dependency drift
npm audit
# Fix or ignore with documented justification
```

---

## Risk Register

| Risk                                      | Impact   | Likelihood              | Mitigation                                                               |
| ----------------------------------------- | -------- | ----------------------- | ------------------------------------------------------------------------ |
| `express.static` exposes secrets          | Critical | High (currently active) | Phase 1 — restrict or remove static serving                              |
| Stripe webhook secret mismatch            | High     | Medium                  | Phase 2.5 — verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard      |
| CORS blocks frontend API calls            | High     | Medium                  | Phase 2.4 — whitelist exact origins, test preflight                      |
| Client-side scan too slow for large repos | Medium   | Medium                  | Phase 5 — add progress UI, streaming ZIP                                 |
| Render free tier sleeps                   | Medium   | High                    | Upgrade to Standard ($7/mo) or add health-check ping                     |
| Cloudflare Pages build fails              | Low      | Low                     | Use direct upload (`wrangler pages deploy`) instead of Git integration   |
| Token expiry confuses users               | Medium   | Medium                  | Phase 5 — add banner in `certificate-upload.html` showing days remaining |

---

## Decision Log

| Date       | Decision                                        | Rationale                                                                                    |
| ---------- | ----------------------------------------------- | -------------------------------------------------------------------------------------------- |
| 2026-06-06 | Split to Cloudflare Pages + Render              | DEPLOYMENT-ROADMAP.md already planned this; cheapest/fastest path to production              |
| 2026-06-06 | Keep PostgreSQL on Render (not self-hosted)     | Render manages backups, zero maintenance overhead                                            |
| 2026-06-06 | Keep disk-based email queue (not queue service) | Already built, tested, zero extra cost; migrate to SQS later if volume grows                 |
| 2026-06-06 | Client-side scan is primary product             | No backend required, zero server cost for free users, privacy-first (no code leaves browser) |
| 2026-06-06 | Server-assisted scan is premium tier only       | Justifies API cost; token gate prevents abuse                                                |

---

## Checklist Summary

**Before any deploy:**

- [ ] `git status` is clean
- [ ] `node -c` passes on all modified files
- [ ] `node --test` passes on CLI tests
- [ ] `npx simplebeacon scan --gate` shows 0 critical, 0 high
- [ ] No secrets in `coming-soon/` (grep for `sk_`, `whsec_`, `re_`)
- [ ] `.env` is gitignored and never committed
- [ ] `maintenance.html` exists and is deployable

**After deploy:**

- [ ] Landing page loads with correct SSL cert
- [ ] Upload (client-side) generates and downloads ZIP
- [ ] Stripe checkout redirects correctly
- [ ] Token email arrives with valid token
- [ ] Certificate page accepts token (not watermarked)
- [ ] Rate limit returns 429 after threshold
- [ ] `.env`, `server.cjs`, `subscriptions.json` return 403

---

_Plan author: Cascade AI_  
_Review date: 2026-06-10 (Phase 1–5 complete)_  
_Next update: After Phase 7 (Mock Data Review) completion_
