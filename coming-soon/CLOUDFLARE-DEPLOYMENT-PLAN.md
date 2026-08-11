# Cloudflare Deployment Plan — SimpleBeacon Coming-Soon

> Generated: 2026-06-06  
> Target: Deploy `coming-soon/` to Cloudflare (Pages + Workers)  
> Status: Dev plan — not yet deployed

---

## 1. Quick Decision Matrix

| Approach | Effort | Best For | Your Current Fit |
|---|---|---|---|
| **A. Pages (static) + Render (API)** | Low (1–2 hrs) | Fastest path, keep Express backend | **Recommended now** |
| **B. Pages + Workers (hybrid)** | Medium (1–2 days) | API on Cloudflare, static on Pages | Do after A is live |
| **C. Full Workers rewrite** | High (3–5 days) | Everything on Cloudflare edge | Future milestone |

**Recommendation:** Start with **Option A** (Pages static + Render API). You get CDN speed + zero backend refactoring. Then migrate APIs to Workers later if needed.

---

## 2. What the Project Actually Needs

### 2.1 Static Assets (safe for Cloudflare Pages)
- `index.html`, `landing.html`, `pricing.html`, `community.html`
- `contact.html`, `contact.js`
- `styles.css`, `favicon.svg`, `robots.txt`, `sitemap.xml`
- `app-links.js`, `site-config.js`
- `sample-report.html`, `sample-certificate.html`, `certificate-upload.html`
- `email-template-universal.html`

### 2.2 API Endpoints (need backend — not pure static)
| Endpoint | Purpose | Calls From |
|---|---|---|
| `GET /api/config/pricing` | Load Stripe links | `site-config.js` |
| `GET /api/free-token` | Generate free license | `certificate-upload.html`, `upload.html` |
| `POST /api/certificate/download` | ZIP certificate generation | `certificate-upload.html`, `upload.html` |
| `POST /api/analyze/upload-directory` | File upload for scan | `certificate-upload.html` |
| `GET /api/analyze/progress` | Scan progress polling | `certificate-upload.html` |
| `POST /api/simplebeacon/billing/resend-token` | Resend license email | `certificate-upload.html`, `upload.html` |
| `POST /api/test-checkout` | Stripe-less checkout test | `pricing.html` |
| `POST /api/subscribe` | Newsletter signup | `index.html` (implied) |
| `GET /health` | Health check | Render, monitoring |

### 2.3 Server Backend Capabilities (in `server.cjs`)
- **Express.js** web server
- **Email sending** (Resend → SMTP → disk queue fallback)
- **Token generation** (HMAC-signed JWT-like tokens)
- **ZIP generation** (archiver for certificates)
- **Rate limiting** (in-memory `Map` — not persistent)
- **File system writes** (`subscriptions.json`, `.simplebeacon/email-queue/`)
- **Cross-project imports** (`../ai-platform/src/api/...`, `../ai-platform/server/routes/...`)

---

## 3. Option A — Pages Static + Render API (Recommended)

### Why this first
- Zero backend code changes
- Cloudflare Pages serves HTML/CSS/JS globally via CDN
- Render continues running `server.cjs` for APIs
- Same `render.yaml` you already have

### 3.1 What you need to do

#### Step A1: Create a `public/` build directory for Pages
Move all static files into a folder Cloudflare Pages can deploy:

```
coming-soon/public/
├── index.html
├── landing.html
├── pricing.html
├── styles.css
├── app-links.js
├── site-config.js
├── contact.html
├── contact.js
├── certificate-upload.html
├── upload.html
├── cloud-scan.html
├── scan-status.html
├── community.html
├── sample-report.html
├── sample-certificate.html
├── email-template-universal.html
├── favicon.svg
├── robots.txt
├── sitemap.xml
├── downloads/
└── (all other static assets)
```

**Do NOT include:**
- `server.cjs` — runs on Render
- `package.json` / `package-lock.json` — Render handles these
- `test-*.js` — dev/test only
- `node_modules/` — will be rebuilt on Render
- `subscriptions.json` — runtime data
- `.simplebeacon/` — runtime data

#### Step A2: Update API_BASE references
Cloudflare Pages and Render will be on different domains. Update every HTML file that calls `/api/...` to use an absolute `API_BASE`:

**Current (assumes same origin):**
```js
fetch('/api/free-token')
fetch('/api/certificate/download')
```

**Change to:**
```js
const API_BASE = 'https://simplebeacon.onrender.com'; // or your custom domain
fetch(API_BASE + '/api/free-token')
```

**Files to check/edit:**
- `certificate-upload.html` — lines ~814, ~1168, ~1227, ~1278, ~1316
- `upload.html` — lines ~2912, ~2944
- `pricing.html` — lines ~444, ~517
- `site-config.js` — line ~59 (`fetch('/api/config/pricing')`)

> **Tip:** Make `API_BASE` configurable via `window.SIMPLEBEACON_SITE.apiBase` so you can switch between dev and prod without editing files.

#### Step A3: Set up Cloudflare Pages
1. Go to [dash.cloudflare.com](https://dash.cloudflare.com)
2. Navigate to **Pages** → **Create a project**
3. Connect your GitHub repo
4. Set build settings:
   - **Build command:** `echo "No build step"` (pure static)
   - **Build output directory:** `public` (or root if you skip Step A1)
5. Add environment variable (optional):
   - `NODE_ENV = production`
6. Deploy

#### Step A4: Configure Render backend
Your `render.yaml` already exists. Verify:
- `startCommand: node coming-soon/server.cjs`
- `healthCheckPath: /health`
- Add CORS origin for your Cloudflare Pages domain:

```yaml
envVars:
  - key: ALLOWED_ORIGIN
    value: "https://simplebeacon.pages.dev"  # or your custom domain
```

#### Step A5: Update DNS (custom domain)
If you want `simplebeacon.ai` on Cloudflare:
1. In Cloudflare DNS, create a CNAME:
   - `www` → `your-project.pages.dev`
   - `app` or `api` → `simplebeacon.onrender.com` (if splitting)
2. In Pages settings, add custom domain
3. In Render settings, add custom domain (optional)

### 3.2 Pre-deployment Checklist — Option A

| # | Task | Status | Notes |
|---|---|---|---|
| 1 | Move static files to `public/` | ☐ | Exclude server, tests, node_modules |
| 2 | Update `API_BASE` in all HTML/JS | ☐ | Must point to Render |
| 3 | Verify `site-config.js` fetches from correct origin | ☐ | `/api/config/pricing` → absolute URL |
| 4 | Add CORS headers on Render for Pages domain | ☐ | `ALLOWED_ORIGIN` env var |
| 5 | Create Cloudflare Pages project | ☐ | Connect GitHub |
| 6 | Deploy to Pages (test domain) | ☐ | `*.pages.dev` |
| 7 | Test all API calls from Pages domain | ☐ | Free token, checkout, certificate |
| 8 | Add custom domain to Pages | ☐ | Optional |
| 9 | Set up HTTPS redirect (always) | ☐ | Cloudflare does this by default |
| 10 | Remove debug artifacts (console.log) | ✅ | Already done |

---

## 4. Option B — Pages + Workers (API Migration)

> Do this **after** Option A is live and stable.

### Why migrate APIs later
- Edge location = lower latency for users
- No server to maintain (no Render)
- Pay only for requests (vs. always-on server)

### What needs to change

#### Workers can't do:
| Feature | Current (Express) | Workers Equivalent |
|---|---|---|
| File system writes | `subscriptions.json`, `email-queue/` | **D1 DB** or **KV** |
| In-memory rate limit | `Map()` | **KV** (with TTL) |
| ZIP generation (archiver) | `archiver('zip')` | **JSZip** (WASM build) |
| `require()` modules | `require('express')` | **ESM imports** only |
| `../ai-platform/` imports | Cross-dir requires | **Monorepo package** or copy-paste |
| Email sending (SMTP) | `nodemailer` | **Resend HTTP API** (already works) |
| File uploads (multer) | `multer` middleware | **FormData** parsing in Workers |

#### Workers CAN do:
- `fetch()` outbound (Resend API, Stripe webhooks)
- Crypto (HMAC token signing — already using `crypto`)
- HTML generation (certificate HTML builder)
- Static file serving (if using Pages Functions)

### 4.1 Migration Steps (future work)

1. **Install Wrangler CLI**
   ```bash
   npm install -g wrangler
   wrangler login
   ```

2. **Create `wrangler.toml`**
   ```toml
   name = "simplebeacon-api"
   main = "worker/index.ts"
   compatibility_date = "2026-06-06"

   [env.production]
   routes = [{ pattern = "api.simplebeacon.ai/*", custom_domain = true }]

   [[d1_databases]]
   binding = "DB"
   database_name = "simplebeacon"
   database_id = "your-d1-id"

   [[kv_namespaces]]
   binding = "RATE_LIMIT"
   id = "your-kv-id"
   ```

3. **Replace storage:**
   - `subscriptions.json` → D1 SQL table
   - `freeTokenLog` Map → KV with TTL
   - `certRateLog` Map → KV with TTL

4. **Replace ZIP generation:**
   - Swap `archiver` for `JSZip` (works in Workers)

5. **Replace email queue:**
   - Disk queue → D1 table (`email_queue`)
   - Or use Resend directly (simpler)

6. **Mount routes:**
   - Use **Hono** framework (Express-like for Workers)
   - Port each Express route to Hono handlers

---

## 5. Shared Pre-Deploy Tasks (All Options)

### 5.1 Security Hardening
- [ ] Ensure `SIMPLEBEACON_LICENSE_SECRET` is strong (≥32 chars, random)
- [ ] Set `NODE_ENV=production` on all deploy targets
- [ ] Verify `ALLOWED_ORIGIN` restricts CORS to your domains only
- [ ] Add Content Security Policy headers (via Cloudflare Transform Rules)
- [ ] Enable Cloudflare WAF (Web Application Firewall)

### 5.2 Environment Variables (need these on deploy target)
| Variable | Required For | Source |
|---|---|---|
| `NODE_ENV` | All | `production` |
| `PUBLIC_URL` | All | Your live domain |
| `SIMPLEBEACON_LICENSE_SECRET` | Token gen/verify | Generate once, keep secret |
| `RESEND_API_KEY` | Email sending | [Resend dashboard](https://resend.com) |
| `RESEND_FROM` | Email "from" | `admin@simplebeacon.ai` |
| `STRIPE_LINK_*` | Checkout links | Stripe dashboard |
| `ALLOWED_ORIGIN` | CORS | Cloudflare Pages domain |

### 5.3 Files to Remove/Exclude from Deploy
```
.git/          # Git history
test-*.js      # Test runners
node_modules/  # Rebuilt by install
server.cjs     # If using Pages-only (Option A)
subscriptions.json   # Runtime data
.simplebeacon/       # Runtime data
error.log      # Runtime logs
.env           # Secrets (use env vars instead)
```

### 5.4 Performance Checklist
- [ ] Images optimized (WebP/AVIF if possible)
- [ ] CSS minified (Cloudflare auto-minifies)
- [ ] JS bundles small enough
- [ ] Fonts using `display=swap`
- [ ] `preload` critical CSS/JS

---

## 6. Testing Plan (Before Going Live)

### 6.1 Smoke Tests
```bash
# 1. Static site loads
curl -s https://YOUR_PAGES_DOMAIN/ | grep -o '<title>.*</title>'

# 2. API health check
curl https://YOUR_RENDER_DOMAIN/health

# 3. Free token endpoint
curl https://YOUR_RENDER_DOMAIN/api/free-token

# 4. Pricing config
curl https://YOUR_RENDER_DOMAIN/api/config/pricing

# 5. Newsletter signup (POST)
curl -X POST https://YOUR_RENDER_DOMAIN/api/subscribe \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com"}'

# 6. Certificate download (POST with token)
curl -X POST https://YOUR_RENDER_DOMAIN/api/certificate/download \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TEST_TOKEN" \
  -d '{"reportJson":{"type":"simplebeacon-report","gate":{"pass":true}}}'
```

### 6.2 Browser Tests
- [ ] All pages load without 404s
- [ ] Contact form submits (Formspree)
- [ ] Stripe checkout links work
- [ ] Free token button populates input
- [ ] Certificate upload → download ZIP works end-to-end
- [ ] No console errors in browser DevTools

---

## 7. Estimated Timeline

| Phase | Task | Estimate | Depends On |
|---|---|---|---|
| **P0** | Clean up debug artifacts | 30 min | ✅ Done |
| **P1** | Reorganize into `public/` + API split | 1–2 hrs | — |
| **P2** | Update `API_BASE` in frontend | 30 min | P1 |
| **P3** | Deploy Pages (test) + Render (prod) | 1 hr | P2 |
| **P4** | Smoke test all endpoints | 1 hr | P3 |
| **P5** | Custom domain + DNS | 30 min | P4 |
| **P6** | Workers API migration | 1–2 days | P5 (optional) |

**Total to "go live" (Option A):** ~4–6 hours of focused work  
**Total to full Cloudflare (Option C):** ~2–3 days

---

## 8. Next Actions for You

1. **Decide:** Do you want Option A (Pages + Render) or jump straight to Workers?
2. **Create `public/` folder** and move static files (I can do this for you)
3. **Buy/configure domain** in Cloudflare if you haven't already
4. **Set up Resend** (if not already) — email is required for certificates
5. **Generate a real license secret** — replace `simplebeacon-dev-insecure`

Want me to start on any of these steps?
