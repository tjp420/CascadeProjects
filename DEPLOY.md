# SimpleBeacon Deployment Guide

## Option 1: Render (Recommended)

There is **no official `render` CLI**. Render deploys via GitHub-connected web dashboard.

### Steps:

1. **Push your code to GitHub:**

   ```powershell
   git add -A
   git commit -m "Fix deploy: add stripe, Node 22, env vars"
   git push origin main
   ```

2. **Go to [dashboard.render.com](https://dashboard.render.com)** and sign in.

3. **Create a new Web Service:**
   - Click **New +** → **Web Service**
   - Connect your GitHub repo: `tjp420/CascadeProjects`
   - Render will auto-detect `render.yaml`

4. **Set environment variables** in the Render dashboard:

   | Variable                    | Value                               | How to get it                            |
   | --------------------------- | ----------------------------------- | ---------------------------------------- |
   | `STRIPE_SECRET_KEY`         | `sk_live_...`                       | Stripe Dashboard → Developers → API keys |
   | `STRIPE_PRICE_ID_INSTANT`   | `price_...`                         | Stripe Dashboard → Products              |
   | `STRIPE_PRICE_ID_EXECUTIVE` | `price_...`                         | Stripe Dashboard → Products              |
   | `STRIPE_PRICE_ID_EUAI`      | `price_...`                         | Stripe Dashboard → Products              |
   | `RESEND_API_KEY`            | `re_...`                            | Resend Dashboard → API Keys              |
   | `SMTP_PASS`                 | `...`                               | Your email provider                      |
   | `PUBLIC_URL`                | `https://simplebeacon.onrender.com` | Your Render service URL                  |

5. **Deploy:** Render auto-deploys on every push to `main`.

## Option 2: Netlify (Static Frontend Only)

For the frontend only (upload.html, pricing.html, etc.) without the backend API:

```powershell
npx netlify deploy --dir=coming-soon --prod
```

Note: API endpoints (`/api/*`) won't work on Netlify without functions.

## Local Development

```powershell
# From repo root
node coming-soon/server.cjs
```

Server starts on `http://localhost:3001` (or `PORT` env var).

## CLI Usage (Local)

The `simplebeacon` CLI is in this monorepo — NOT on npm:

```powershell
# Correct (local path)
node packages/simplebeacon-cli/bin/simplebeacon.js scan --help

# Wrong (will 404 — package not published)
npm install -g simplebeacon
```
