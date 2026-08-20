# SimpleBeacon Deployment Architecture Roadmap

## Current State

Right now everything lives in `coming-soon/` as a full-stack monolith:

- Static HTML pages (index.html, pricing.html, upload.html)
- Express API server (server.cjs)
- File uploads, scan processing, certificate generation
- Subscriptions, billing webhooks
- Everything deploys to **Render** as one service

## Target Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                      CLOUDFLARE                             │
│                                                             │
│  ┌─────────────────┐    ┌───────────────────────────────┐  │
│  │   Pages         │    │   Workers / Functions         │  │
│  │   (Static)      │    │   (Edge Middleware)           │  │
│  │                 │    │                                │  │
│  │  index.html     │    │  - Rate limiting              │  │
│  │  pricing.html   │    │  - CORS preflight              │  │
│  │  upload.html    │    │  - Simple auth checks          │  │
│  │  styles.css     │    │  - Bot detection              │  │
│  │  app-links.js   │    │  - Geo-routing                 │  │
│  │  contact.js     │    │                                │  │
│  │  (marketing)    │    │                                │  │
│  └────────┬────────┘    └────────────────┬───────────────┘  │
│           │                               │                  │
│           │      ┌────────────────────────┘                  │
│           │      │                                           │
│           │   ┌──┴────────────────────┐                    │
│           └──►│   DNS / CDN / WAF       │◄───────────────────┘
│               │   simplebeacon.com      │
│               └──────────┬────────────┘
│                          │
│                          ▼
│               ┌──────────────────────┐
│               │  Custom Domain       │
│               │  api.simplebeacon.com│
│               └──────────┬───────────┘
└──────────────────────────┼──────────────────────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │     RENDER       │
                  │  (Node.js API)   │
                  │                  │
                  │  server.cjs      │
                  │  - File uploads   │
                  │  - Scan engine   │
                  │  - Certificates  │
                  │  - Billing       │
                  │  - Subscriptions │
                  │  - Email queue   │
                  └──────────────────┘
                           │
                           ▼
                  ┌──────────────────┐
                  │  PostgreSQL      │
                  │  Redis (cache)   │
                  │  S3 / Disk       │
                  └──────────────────┘
```

---

## What Lives Where

### Cloudflare Pages (Static Site)

| File                      | Purpose                                |
| ------------------------- | -------------------------------------- |
| `index.html`              | Landing page                           |
| `pricing.html`            | Pricing + checkout                     |
| `upload.html`             | Report upload + certificate generation |
| `certificate-upload.html` | Certificate download page              |
| `community.html`          | Community page                         |
| `contact.html`            | Contact form                           |
| `landing.html`            | Alternate landing                      |
| `privacy.html`            | Privacy policy                         |
| `terms.html`              | Terms of service                       |
| `refund.html`             | Refund policy                          |
| `sample-report.html`      | Sample report preview                  |
| `sample-certificate.html` | Sample certificate preview             |
| `styles.css`              | All styles                             |
| `app-links.js`            | Frontend utilities                     |
| `contact.js`              | Contact form handler                   |
| `favicon.svg`             | Favicon                                |
| `robots.txt`              | SEO                                    |
| `sitemap.xml`             | SEO                                    |

**No backend logic. No secrets. Pure static HTML/CSS/JS.**

### Cloudflare Workers (Edge Functions)

Optional but recommended:

- **Rate limiting** — protect Render API from abuse
- **Bot detection** — block scrapers before they hit Render
- **CORS** — handle preflight at edge, reduce Render load
- **Geo-routing** — redirect EU users to EU Render region
- **Auth token validation** — lightweight JWT expiry check at edge

### Render (Node.js Backend)

| Service                  | Purpose                           |
| ------------------------ | --------------------------------- |
| `coming-soon/server.cjs` | API server (Express)              |
| File upload handler      | Receives .zip / directory uploads |
| Scan engine              | Runs simplebeacon CLI             |
| Certificate generator    | Creates signed PDFs               |
| Billing webhook          | Stripe webhooks                   |
| Email queue              | Queues certificate emails         |
| Subscription store       | Manages license tokens            |

---

## Phase 1: Separate Frontend from Backend

**Goal**: Make `coming-soon/` a pure static site that calls an API.

### 1.1 Extract Backend to Dedicated Service

Create `api-server/` (or keep in `coming-soon/` but make it API-only):

```
api-server/
├── server.js          ← API-only Express (no static file serving)
├── routes/
│   ├── upload.js      ← File upload endpoint
│   ├── analyze.js     ← Scan trigger endpoint
│   ├── certificate.js ← Certificate generation
│   ├── billing.js     ← Stripe webhooks
│   └── auth.js        ← Token validation
├── lib/
│   ├── scan-engine.js
│   └── pdf-generator.js
└── package.json
```

### 1.2 Update Frontend to Call API

In `coming-soon/upload.html`:

```javascript
// BEFORE: Direct call to same-origin server
fetch('/api/analyze/upload-directory', { ... })

// AFTER: Call Render API with CORS
fetch('https://api.simplebeacon.com/api/analyze/upload-directory', {
    headers: { 'Authorization': `Bearer ${token}` }
})
```

### 1.3 Add CORS to Render API

```javascript
const cors = require("cors");
app.use(
  cors({
    origin: ["https://simplebeacon.com", "https://simplebeacon.pages.dev"],
    credentials: true,
  }),
);
```

---

## Phase 2: Deploy Frontend to Cloudflare Pages

### 2.1 Create wrangler.toml

```toml
name = "simplebeacon"
compatibility_date = "2026-06-01"

[build]
command = "echo 'No build needed'"

[[headers]]
for = "/*"
[headers.values]
X-Frame-Options = "DENY"
X-Content-Type-Options = "nosniff"
Referrer-Policy = "strict-origin-when-cross-origin"
```

### 2.2 Deploy

```bash
cd coming-soon
# Install Wrangler
npm install -g wrangler

# Login
wrangler login

# Deploy
wrangler pages deploy . --project-name simplebeacon
```

---

## Phase 3: Deploy Backend to Render

### 3.1 Create `render.yaml`

```yaml
services:
  - type: web
    name: simplebeacon-api
    runtime: node
    plan: standard
    buildCommand: npm install
    startCommand: node api-server/server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: PORT
        value: 10000
      - key: SIMPLEBEACON_LICENSE_SECRET
        sync: false # Set in Render dashboard
      - key: STRIPE_SECRET_KEY
        sync: false
      - key: RESEND_API_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
      - key: REDIS_URL
        sync: false
```

### 3.2 Update Deploy Script

```bash
# deploy-api.sh
git push origin main
# Render auto-deploys from GitHub
```

---

## Phase 4: Add Cloudflare Workers (Optional)

### 4.1 Create `_worker.js`

```javascript
// coming-soon/_worker.js
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // Rate limiting
    const clientIP = request.headers.get("CF-Connecting-IP");
    const rateLimitKey = `ratelimit:${clientIP}`;

    // Bot detection
    const userAgent = request.headers.get("User-Agent") || "";
    if (isBot(userAgent)) {
      return new Response("Bot detected", { status: 403 });
    }

    // Pass through to Pages static content
    return env.ASSETS.fetch(request);
  },
};
```

### 4.2 Deploy Worker

```bash
wrangler deploy
```

---

## Phase 5: DNS + Custom Domain

### 5.1 Cloudflare DNS

```
A     simplebeacon.com        → 192.0.2.1 (Pages)
CNAME www.simplebeacon.com    → simplebeacon.pages.dev
CNAME api.simplebeacon.com    → simplebeacon-api.onrender.com
```

### 5.2 Page Rules

| Rule                         | Action                            |
| ---------------------------- | --------------------------------- |
| `simplebeacon.com/api/*`     | Forward to `api.simplebeacon.com` |
| `simplebeacon.com/uploads/*` | Forward to `api.simplebeacon.com` |

---

## Migration Checklist

### Files to Move

| From                             | To                                  | Status |
| -------------------------------- | ----------------------------------- | ------ |
| `coming-soon/server.cjs`         | `api-server/server.js`              | ☐      |
| `coming-soon/.env`               | `api-server/.env` + Render env vars | ☐      |
| `coming-soon/subscriptions.json` | `api-server/data/` or PostgreSQL    | ☐      |
| `coming-soon/.simplebeacon/`     | `api-server/.simplebeacon/`         | ☐      |

### Files to Remove from Frontend

| File                          | Reason                              |
| ----------------------------- | ----------------------------------- |
| `server.cjs`                  | Backend logic                       |
| `package.json` (backend deps) | Frontend has no deps                |
| `.env`                        | Secrets don't belong in static site |
| `subscriptions.json`          | User data                           |
| `error.log`                   | Server logs                         |
| `node_modules/`               | Backend dependencies                |
| `start-server.bat`            | Local dev only                      |
| `stop-server.bat`             | Local dev only                      |

### Frontend Changes Needed

| Change       | File                        | Description                             |
| ------------ | --------------------------- | --------------------------------------- |
| API base URL | `upload.html`, `contact.js` | Point to `api.simplebeacon.com`         |
| CORS headers | All fetch calls             | Add `credentials: 'include'`            |
| Stripe keys  | `pricing.html`              | Use publishable key only                |
| WebSocket    | `scan-status.html`          | Connect to `wss://api.simplebeacon.com` |

---

## Security Benefits of This Split

| Risk             | Before (All on Render)                        | After (Split)                  |
| ---------------- | --------------------------------------------- | ------------------------------ |
| .env exposure    | `express.static(__dirname)` serves everything | Cloudflare Pages has no .env   |
| Server code leak | `server.cjs` downloadable                     | Backend not in static deploy   |
| DDoS on API      | Everything on one origin                      | Cloudflare absorbs DDoS        |
| Geo latency      | Render US-East only                           | Cloudflare edge cache globally |
| Secret scanning  | `node_modules` exposed                        | Frontend has no secrets        |

---

## Cost Estimate

| Service            | Plan                 | Monthly    |
| ------------------ | -------------------- | ---------- |
| Cloudflare Pages   | Free                 | $0         |
| Cloudflare Workers | Free tier (100k/day) | $0         |
| Render API         | Standard ($7/mo)     | $7         |
| Render PostgreSQL  | Starter ($7/mo)      | $7         |
| Render Redis       | Free tier            | $0         |
| **Total**          |                      | **$14/mo** |

---

## Order of Operations

1. **Week 1**: Extract API from `coming-soon/server.cjs` into `api-server/`
2. **Week 1**: Update frontend fetch calls to use `API_BASE_URL` environment variable
3. **Week 2**: Deploy frontend to Cloudflare Pages
4. **Week 2**: Deploy backend to Render with `render.yaml`
5. **Week 3**: Configure DNS + custom domain
6. **Week 3**: Add Cloudflare Workers for rate limiting
7. **Week 4**: Test end-to-end (upload → scan → certificate)
8. **Week 4**: Sunset the monolith `coming-soon/server.cjs`

---

## Current Blockers

Before starting migration:

- [ ] Fix `express.static(__dirname)` vulnerability (done today)
- [ ] Resolve 38 gate-blocking scan findings
- [ ] Validate all API endpoints work when called cross-origin
- [ ] Set up PostgreSQL (currently using JSON file for subscriptions)
- [ ] Move secrets from `.env` to Render dashboard environment variables

---

## Quick Start: Do This Now

```bash
# 1. Create API server directory
mkdir api-server
cp coming-soon/server.cjs api-server/server.js

# 2. Strip static file serving from API
# (Remove express.static and frontend route handlers)

# 3. Create frontend-only package.json in coming-soon
# (Remove all backend dependencies)

# 4. Deploy frontend to Cloudflare Pages
wrangler pages deploy coming-soon/

# 5. Deploy backend to Render
git push origin main
```

---

_Generated: 2026-06-05_
_Next review: After gate-blocking issues are resolved_
