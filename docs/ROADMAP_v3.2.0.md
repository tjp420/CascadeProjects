# v3.2.0 Roadmap — Deployment Architecture Split

> **Goal**: Separate the `coming-soon/` monolith into a pure static frontend (Cloudflare Pages) and a dedicated API backend (Render).

Milestone: **v3.2.0**

## Background

The `coming-soon/` directory currently contains both static HTML/CSS/JS and a 1546-line `server.cjs` that serves static files, handles API routes, manages billing, runs scans, and generates certificates. This creates security risks (`.env` exposure via `express.static`), performance limitations (single origin for all traffic), and deployment coupling.

## Phase 1: Extract API to `api-server/` (Week 1)

### 1.1 Create `api-server/` structure

```
api-server/
├── server.js              ← API-only Express (no static file serving)
├── routes/
│   ├── index.js           ← Route aggregator
│   ├── scan.js            ← /api/simplebeacon/scan, /api/scan-directory
│   ├── analyze.js         ← /api/analyze-directory, /api/analyze/wiring
│   ├── certificates.js    ← Certificate generation endpoints
│   ├── billing.js         ← Stripe checkout + subscription webhooks
│   ├── auth.js            ← Login, registration, token validation
│   ├── contact.js         ← Contact form endpoint
│   ├── dashboard.js       ← Dashboard stats, reports, customer lookup
│   ├── free-token.js      ← Free token generation
│   ├── referral.js        ← Referral tracking + webhooks
│   ├── token-chain.js     ← Token chain endpoints
│   ├── admin.js           ← Admin routes
│   ├── email.js           ← Email retry worker, resend, webhooks
│   └── health.js          ← /health, /api/health
├── lib/                   ← Symlink or copy from coming-soon/lib/
├── services/              ← Symlink or copy from coming-soon/services/
├── package.json           ← Backend dependencies only
├── render.yaml            ← Render deployment manifest
└── .env.example           ← Template for environment variables
```

### 1.2 Key changes in `server.js`

- **No `express.static()`** — API responses only, no HTML serving
- **CORS middleware** — Allow origins from `simplebeacon.com`, `simplebeacon.pages.dev`, `localhost`
- **API_BASE_URL** — Frontend reads from env var or hardcoded `https://api.simplebeacon.com`
- **Health check** — `/health` endpoint for Render load balancer
- **JSON error handler** — All errors return JSON, not HTML

### 1.3 Route extraction

Routes currently in `server.cjs` and `coming-soon/routes/*.cjs` will be moved to `api-server/routes/`. The route handler logic stays the same; only the mounting changes.

## Phase 2: Deploy Frontend to Cloudflare Pages (Week 2)

### 2.1 Frontend-only `coming-soon/`

- Remove `server.cjs`, backend `package.json` deps, `.env`, `node_modules/`
- Keep: HTML, CSS, JS, `wrangler.toml`, `_headers`, `_redirects`, `functions/`
- Update fetch calls to use `API_BASE_URL` environment variable

### 2.2 Cloudflare Pages deployment

```bash
wrangler pages deploy coming-soon/public --project-name=simplebeacon
```

## Phase 3: Deploy Backend to Render (Week 2)

### 3.1 `render.yaml`

```yaml
services:
  - type: web
    name: simplebeacon-api
    runtime: node
    plan: standard
    buildCommand: npm install
    startCommand: node server.js
    envVars:
      - key: NODE_ENV
        value: production
      - key: SIMPLEBEACON_LICENSE_SECRET
        sync: false
      - key: STRIPE_SECRET_KEY
        sync: false
      - key: DATABASE_URL
        sync: false
```

## Phase 4: DNS + Custom Domain (Week 3)

- `simplebeacon.com` → Cloudflare Pages
- `api.simplebeacon.com` → Render service
- Page rules for `/api/*` forwarding

## Current Blockers

- [ ] Validate all API endpoints work cross-origin
- [ ] Set up PostgreSQL (currently using SQLite via `lib/db.cjs`)
- [ ] Move secrets to Render dashboard

## Success Criteria

- [ ] `api-server/` runs independently with `node server.js`
- [ ] All API tests pass against `api-server/`
- [ ] `coming-soon/` has no backend dependencies
- [ ] Frontend deployed to Cloudflare Pages
- [ ] Backend deployed to Render
- [ ] End-to-end: upload → scan → certificate works across origins
