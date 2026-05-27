# Deploy coming-soon (prelaunch)

Upload **this entire folder** (`coming-soon/`) to static hosting.

## Cloudflare redirect loop fix

If `/community` shows “page isn’t redirecting properly”:

1. Upload **`community/index.html`** (included in this folder).
2. Use **`_redirects`** as shipped (downloads only — no `/community` rules).
3. Link to **`/community/#install`** (trailing slash).
4. Use **`_redirects`** only for real redirects (e.g. `/community` → `/`). Do **not** add `/page /page.html 200` rules — Cloudflare Pages pretty URLs already serve `page.html` at `/page`; rewrite rules cause redirect loops.

## Cloudflare Email Routing (business inbox)

Forward **audit@simplebeacon.ai** to **trevor_punt@live.com** (free):

1. Cloudflare → simplebeacon.ai → **Email** → **Email Routing**
2. Add destination `trevor_punt@live.com` → verify
3. Routing rule: `audit@simplebeacon.ai` → forward to verified destination
4. **Add records and enable** (MX/SPF)

Site config uses `auditEmail: 'audit@simplebeacon.ai'` in `site-config.js`. See `OUTREACH.md` for full steps.

## Cloudflare Pages

1. Pages → Create project → Direct Upload (or connect repo).
2. Upload contents of `coming-soon/` (not the parent repo root). Prefer **`coming-soon/`** over stale `cloudflare-deploy/`.
3. Custom domain: `simplebeacon.ai` / `www.simplebeacon.ai`.
4. `_redirects` is included for clean URLs (`/community` → `/`).

## Netlify

Same folder as publish directory. `_redirects` works on Netlify too.

## Week 1 go-live (SimpleBeacon)

1. Rebrand complete — **SimpleBeacon** customer-facing, `simplebeacon` CLI on npm.
2. Legal: `/terms`, `/privacy`, `/refund` — lawyer review before taking live payments.
3. Stripe: see `ai-platform/docs/WEEK1_REVENUE_READINESS.md`
4. Remove `noindex` from `index.html` when DNS is live.
5. Set `site-config.js` → `prelaunch: false` when billing is enabled.

## Before upload — edit `site-config.js`

| Setting | Static prelaunch (recommended) | Full stack on same domain |
|---------|-------------------------------|---------------------------|
| `prelaunch` | `false` when `PAYMENTS_ENABLED` is true | `false` when billing live |
| `staticOnly` | `true` | `false` |
| `appOrigin` | `''` | `''` if dashboard on same host, or `https://app.simplebeacon.ai` |

## What works on static-only prelaunch

- Landing page, pricing, community install (`npm install simplebeacon`)
- Offline tarball at `/downloads/simplebeacon-1.0.0.tgz`
- Waitlist via **Cloudflare Pages Function** at `/api/waitlist` (upload `functions/` folder)
- Optional: bind `WAITLIST_KV` + `WAITLIST_WEBHOOK` (Formspree/Zapier/Make) in Cloudflare dashboard
- Optional email notifications (Resend):
  - `RESEND_API_KEY` (secret)
  - `WAITLIST_NOTIFY_TO` / `AUDIT_NOTIFY_TO` (e.g. `trevor_punt@live.com`)
  - `WAITLIST_NOTIFY_FROM` / `AUDIT_NOTIFY_FROM` (optional; use `onboarding@resend.dev` until domain verified)
- Audit booking form → `POST /api/audit-booking` (requires `functions/api/audit-booking.js`)
  - Local dev: same endpoint on `npm run dashboard:v1-internal` when `RESEND_API_KEY` is in `.env.v1-internal`
  - Setup: `coming-soon/scripts/setup-audit-booking-notify.ps1`
- Helper script (PowerShell):
  - `coming-soon/scripts/setup-waitlist-notify.ps1`
  - Example:
    - `.\scripts\setup-waitlist-notify.ps1 -ProjectName "simplebeacon" -ResendApiKey "re_xxx" -NotifyTo "trevor_punt@live.com"`
- Fallback: mailto if API unavailable (high friction — avoid in production)

## Conversion tracking

- `waitlist.js` logs `form_view`, `form_start`, `form_submit`, `form_success` to localStorage
- Dashboard server persists events to `data/waitlist-events.json` via `POST /api/waitlist/event`
- Signup count: `GET /api/waitlist/count` or `data/waitlist-signups.json`

## What needs the dashboard server

- `/demo` honey-pot dashboard
- `/app` workspace + Stripe checkout
- Live proof metrics from `/api/simplebeacon/report`

Run locally: `cd ai-platform`, `$env:SIMPLEBEACON_LANDING="true"`, `npm run dashboard:v1-internal`.

Open **http://localhost:54355/** — internal dashboard (factory).  
Open **http://localhost:54355/landing** — public paywall preview (`coming-soon/index.html`).  
Open **http://localhost:54355/private-dashboard-vault?password=YOUR_VAULT_PASSWORD** — gated dashboard entry (set `DASHBOARD_VAULT_PASSWORD` in `.env.v1-internal`).

Production (`SIMPLEBEACON_LANDING=true`, not internal): `/` serves the paywall; `/app` redirects to `/`.

## Files to upload

```
coming-soon/
  index.html
  pricing.html
  pricing.js
  waitlist.js
  functions/
    api/
      waitlist.js
  community/
    index.html
  community.html
  styles.css
  app-links.js
  site-config.js
  terms.html
  privacy.html
  refund.html
  robots.txt
  sitemap.xml
  _redirects
  downloads/simplebeacon-1.0.0.tgz
```
