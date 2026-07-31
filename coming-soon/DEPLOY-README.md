# Deploy SimpleBeacon to Cloudflare Pages

This folder is now configured to deploy the marketing site (`public/`) to Cloudflare Pages as the root site, so URLs like `https://simplebeacon.ai/roadmap.html` and `https://simplebeacon.ai/pricing.html` work without the `/coming-soon/` prefix.

## What changed

- `public/` already uses root-relative paths (`/styles.css`, `/favicon.svg`, etc.).
- `public/site-config.js` now exposes `dashboardUrl` and `dashboardAppUrl` so the marketing site can link to the live dashboard.
- `public/audit.html` and `public/js-es2018/dashboard/main.js` now detect whether they are running on localhost or on the live domain, and point to the right backend/dashboard.
- `public/dashboard/index.html` is a small gateway page at `/dashboard/` that redirects users to the real dashboard app (local server or the Render backend).
- `public/_routes.json` tells Cloudflare Pages to serve `/dashboard/index.html` for any `/dashboard/*` path.
- `wrangler.toml` is a starter config for Cloudflare Pages.
- `deploy-cloudflare.ps1` is a Powershell deploy script.

## Backend (Render)

The dashboard and API backend still live in `simplebeacon-vscode-merged/src/dataServer.ts`. To deploy it:

1. Push the `simplebeacon-vscode-merged` project to Render (Web Service, Node.js).
2. Set environment variables:
    - `NODE_ENV=production`
    - `PORT=10000` (Render sets this automatically)
    - `PUBLIC_URL=https://simplebeacon.onrender.com` (or your custom domain)
    - `ALLOWED_ORIGIN=https://simplebeacon.ai`
    - `SIMPLEBEACON_LICENSE_SECRET=<your-license-secret>`
    - `RESEND_API_KEY=<resend-key>`
    - `RESEND_FROM=certificates@simplebeacon.ai`
3. Render will serve the dashboard at `/dashboard/` and the API at `/api/`.

## Frontend (Cloudflare Pages)

1. Install Wrangler if you haven't:
    ```powershell
    npm install -g wrangler
    wrangler login
    ```
2. Run the deploy script:
    ```powershell
    cd coming-soon
    .\deploy-cloudflare.ps1
    ```
3. In the Cloudflare Pages dashboard:
    - Create a project named `simplebeacon`.
    - Connect the GitHub repo or use direct upload.
    - Build command: `echo "static"` (or leave empty)
    - Build output directory: `public`
    - Add custom domain `simplebeacon.ai`.
    - Force HTTPS.

## Final URLs

- `https://simplebeacon.ai/` — Home
- `https://simplebeacon.ai/pricing.html` — Pricing
- `https://simplebeacon.ai/roadmap.html` — Roadmap
- `https://simplebeacon.ai/audit.html` — Browser audit scanner
- `https://simplebeacon.ai/dashboard/` — Dashboard app (proxied to Render)

## Environment variables for Cloudflare Pages

In the Cloudflare Pages dashboard, add:

- `BACKEND_URL` = `https://simplebeacon.onrender.com` (your Render backend URL)

This feeds the `functions/dashboard/[[path]].js` proxy, which makes the dashboard available at `https://simplebeacon.ai/dashboard/*` without changing the URL.

## Notes

- `public/dashboard/index.html` is a fallback static gateway. When `BACKEND_URL` is set, the Pages Function proxy takes over and the dashboard is served from the same domain.
- If you ever want to disable the proxy, remove or rename the `functions/` directory.
