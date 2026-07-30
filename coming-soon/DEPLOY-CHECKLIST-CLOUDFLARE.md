# SimpleBeacon Coming-Soon Cloudflare Deployment Checklist

Date: 2026-07-29
Scope: coming-soon marketing site publish to Cloudflare Pages
Primary path: Deploy static site from public directory using deploy-cloudflare.ps1

## 1. Preflight Checklist

- Confirm you are in repository root and the working tree only contains intended changes.
- Confirm Node.js is installed (prefer Node 20 LTS; Node 23+ can be less stable for large HTTPS bursts on Windows).
- Confirm npm and npx are available.
- Confirm Cloudflare auth is active (wrangler login completed at least once).
- Confirm target project name is simplebeacon unless intentionally changing it.
- Confirm build artifacts are updated if source files were changed.
- Confirm coming-soon/public contains updated files to publish.
- Confirm DNS/custom domain settings in Cloudflare Pages are correct.

## 2. Build And Sanity Checks

Run from repo root:

1. cd coming-soon
2. npm install
3. npm run build
4. npm test
5. node -c server.cjs

Optional quality gate:

6. npm run quality:check

## 3. Publish Commands (Windows PowerShell)

Run from repo root:

1. cd coming-soon
2. npx wrangler login
3. .\deploy-cloudflare.ps1

If using non-default settings:

4. .\deploy-cloudflare.ps1 -ProjectName simplebeacon -Branch main -Directory public

Direct wrangler alternative:

5. npx wrangler pages deploy public --project-name=simplebeacon --branch=main --commit-dirty=true

## 4. Publish Commands (Cross-Platform Alternative)

From coming-soon directory:

1. npm run deploy

## 5. Post-Deploy Validation

Verify URLs return expected content:

- https://simplebeacon.ai/
- https://simplebeacon.ai/roadmap
- https://simplebeacon.ai/sample-report
- https://simplebeacon.ai/pricing
- https://simplebeacon.ai/contact
- https://simplebeacon.ai/faq

Roadmap functional checks:

- Sign in opens modal instead of routing to a 404 page.
- Load Test Report successfully loads dashboard data.
- Skip to content sends focus to visible main content.
- Footer and modal links do not point to dead routes.

Sample report checks:

- No runtime TypeError in browser console.
- Report renders status, hash, metrics table, and findings list.

## 6. Cloudflare Pages Settings Checklist

- Build output directory is public.
- Custom domain simplebeacon.ai is attached and active.
- HTTPS is enforced.
- Any required environment variables are set in Pages.
- Redirects/routing rules are active via public/_redirects and public/_routes.json.

## 7. Rollback Procedure

If deployment is bad:

1. Open Cloudflare Pages dashboard.
2. Select project simplebeacon.
3. Open Deployments.
4. Promote the previous healthy deployment.
5. Re-run URL validation checks.

## 8. Release Notes Snippet

Recommended release note:

- Fixed roadmap auth entry flow to prevent broken sign-in route.
- Added resilient test report loader with embedded fallback data.
- Fixed accessibility issues for skip link and report input labeling.
- Fixed sample report runtime null-reference crash.
- Hardened roadmap rendering path for fallback test reports.
