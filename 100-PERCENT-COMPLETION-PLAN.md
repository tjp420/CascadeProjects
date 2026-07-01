# SimpleBeacon: 100% Completion Plan

**Current:** ~76% | **Target:** 100% | **Estimated Time:** 3–4 days of focused work

This plan moves every workstream to 100% and identifies the critical path to public launch.

---

## 1. Engineering & Product (Current: ~92% → Target: 100%)

### 1.1 Commit the VS Code Extension delta
**Current:** 502 modified/untracked files in `simplebeacon-vscode-merged/`.
- [ ] Review `simplebeacon-vscode-merged/` with `git diff --stat`
- [ ] Stage intentional changes (extension fixes, new providers, dashboard updates)
- [ ] Discard or move test/experiment files (e.g., `test-welcome-*.cjs`, `ts-prune-report*.txt`, `tmp-*.mjs`) to `~/Desktop/` or a scratch folder
- [ ] Ensure `tsc --noEmit` passes from `simplebeacon-vscode-merged/`
- [ ] Commit with a clean message: `feat: finalize vscode extension v3.0.3`
- [ ] Update `.gitignore` to prevent future temp-file noise:
  ```
  # VS Code extension build artifacts
  simplebeacon-vscode-merged/out/
  simplebeacon-vscode-merged/*.vsix
  simplebeacon-vscode-merged/ts-prune-report*.txt
  simplebeacon-vscode-merged/test-welcome-*.cjs
  simplebeacon-vscode-merged/tmp-*
  ```
**Effort:** 1–2 hours | **Owner:** You

### 1.2 Package final `.vsix`
- [ ] Run `npm run compile` (or `npx tsc`) in `simplebeacon-vscode-merged/`
- [ ] Run `npx vsce package` to produce `simplebeacon-3.0.3.vsix`
- [ ] Verify the file size is reasonable (~9 MB)
- [ ] Copy to `sales/marketplace/simplebeacon-latest.vsix`
**Effort:** 15 min | **Owner:** You

### 1.3 Resolve remaining TODO/FIXME markers
- [ ] `ai-platform/server/config/constants.cjs:1` — TODO/FIXME
- [ ] `ai-platform/server/index.cjs:525` — TODO/FIXME
- [ ] `ai-platform/server/lib/codebase-analyzer.cjs:248` — TODO/FIXME
- [ ] `ai-platform/server/lib/eu-ai-act-audit-report.cjs:186` — TODO/FIXME
- [ ] `ai-platform/server/lib/file-audit-context.cjs:100` — TODO/FIXME
- [ ] `ai-platform/server/lib/file-merger-reduction-scanner.cjs:796` — TODO/FIXME
- [ ] `ai-platform/server/lib/language-patterns/universal-baseline-patterns.cjs:8` — TODO/FIXME
- [ ] `ai-platform/server/lib/secret-config.cjs:10` — TODO/FIXME

> **Recommendation:** Do a 30-minute sweep. Most of these are likely tracking markers for known non-blocking items. Convert each into a GitHub issue or delete if already resolved.

**Effort:** 30 min | **Owner:** You

### 1.4 Final CLI publish
- [ ] `cd packages/simplebeacon-cli`
- [ ] `npm run quality:check` (or equivalent pre-publish script)
- [ ] `npm publish --access public`
- [ ] Verify: `npm view simplebeacon version`
**Effort:** 10 min | **Owner:** You

---

## 2. DevOps & Infrastructure (Current: ~43% → Target: 100%)

### 2.1 Security hardening — `express.static` fix
**File:** `coming-soon/server.cjs`

- [ ] Verify `app.use(express.static(__dirname))` is NOT present
- [ ] If it is, restrict to `public/` subdirectory or add deny-list headers:
  ```javascript
  app.use(express.static(path.join(__dirname, 'public'), {
    dotfiles: 'deny',
    setHeaders: (res, fp) => {
      const ext = path.extname(fp).toLowerCase();
      if (['.env', '.cjs', '.js', '.json', '.db'].includes(ext)) {
        res.status(403).end();
      }
    }
  }));
  ```
- [ ] Add security headers middleware (see `RELEASE-PLAN.md` Phase 1.2)
- [ ] Verify no secrets leak with `curl http://localhost:3000/.env` → expect 403

**Effort:** 1–2 hours | **Owner:** You | **Blocker for:** Live deploy

### 2.2 Deploy to Render
- [ ] Ensure `render.yaml` points to correct server path (`ai-platform/simplebeacon-server.cjs`)
- [ ] Push `main` to GitHub
- [ ] In Render dashboard: New + → Blueprint → connect repo
- [ ] Verify build succeeds, health endpoint returns `200 OK`
- [ ] Test: `curl https://<service>.onrender.com/health`

**Effort:** 30 min | **Owner:** You | **Depends on:** 2.1

### 2.3 Domain & DNS
- [ ] Register or verify ownership of `simplebeacon.ai`
- [ ] In Cloudflare/Namecheap DNS:
  - A Record: `simplebeacon.ai` → Render load balancer IP (or CNAME to `*.onrender.com`)
  - CNAME: `www` → `simplebeacon.ai`
- [ ] Set TTL to 300s
- [ ] Verify: `dig simplebeacon.ai +short`
- [ ] Verify: `nslookup simplebeacon.ai`

**Effort:** 15 min | **Owner:** You | **Depends on:** 2.2

### 2.4 CI/CD stress test
- [ ] Create a temporary test repo with intentionally bad code
- [ ] Add the GitHub Action (`github-action/action.yml`) to that repo
- [ ] Trigger workflow, verify it fails the gate on the dirty repo
- [ ] Create a temporary clean repo, trigger workflow, verify it passes
- [ ] (Optional) Run on a large repo (e.g., `lodash` clone) to verify performance

**Effort:** 1–2 hours | **Owner:** You | **Blocker for:** Public confidence

---

## 3. Go-to-Market & Distribution (Current: ~79% → Target: 100%)

### 3.1 VS Code Marketplace
- [ ] Go to https://marketplace.visualstudio.com/manage
- [ ] Register publisher name `simplebeacon`
- [ ] Upload `simplebeacon-3.0.3.vsix`
- [ ] Capture 5 screenshots at **1280×800px** in light theme:
  1. `01-sidebar.png` — Sidebar with scan results + gate status
  2. `02-findings.png` — Expanded findings list
  3. `03-settings.png` — Settings panel
  4. `04-full-scan.png` — Full scan enabled
  5. `05-export.png` — Exported JSON report
- [ ] Upload screenshots to publisher portal
- [ ] Submit for review

**Effort:** 1 hour | **Owner:** You | **Blocker for:** Public availability

### 3.2 npm Registry
- [ ] `cd packages/simplebeacon-cli`
- [ ] `npm publish --access public`
- [ ] Verify: `npm view simplebeacon version`

**Effort:** 5 min | **Owner:** You | **Depends on:** 1.4

### 3.3 Marketing final polish
- [ ] Review `marketing/hn-show-post.md` — ensure it links to `simplebeacon.ai`
- [ ] Review `marketing/product-hunt-launch.md` — ensure screenshots match uploaded ones
- [ ] Review `marketing/reddit-launch.md` — ensure pricing is current
- [ ] (Optional) Schedule posts for simultaneous drop (HN + PH + Reddit)

**Effort:** 30 min | **Owner:** You

---

## 4. Operations & Monetization (Current: ~45% → Target: 100%)

### 4.1 Stripe Live Mode
- [ ] Switch to Live mode in https://dashboard.stripe.com
- [ ] Create products:
  - AI Slop Cop Pro Monthly — $9.00
  - AI Slop Cop Pro Yearly — $90.00
  - AI Slop Cop Enterprise — Custom
- [ ] Copy Price IDs (`price_...`) from each product
- [ ] In Render dashboard, add env vars:
  - `STRIPE_SECRET_KEY=sk_live_...`
  - `STRIPE_PUBLISHABLE_KEY=pk_live_...`
  - `STRIPE_WEBHOOK_SECRET=whsec_...`
  - `STRIPE_PRICE_ID_TEAMS_MONTHLY=price_...`
  - `STRIPE_PRICE_ID_TEAMS_ANNUAL=price_...`
  - `STRIPE_PRICE_ID_EXECUTIVE_CLEARANCE=price_...`
- [ ] Create webhook endpoint:
  - URL: `https://simplebeacon.ai/api/simplebeacon/billing/webhook`
  - Events: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`
- [ ] Copy webhook signing secret to Render env vars

**Effort:** 30 min | **Owner:** You | **Blocker for:** Revenue

### 4.2 Email (Resend)
- [ ] Sign up at https://resend.com
- [ ] Add domain: `simplebeacon.ai`
- [ ] Complete TXT/MX verification in Cloudflare DNS
- [ ] Generate live `RESEND_API_KEY` (starts with `re_`)
- [ ] In Render dashboard, add env vars:
  - `RESEND_API_KEY=re_...`
  - `RESEND_FROM=certificates@simplebeacon.ai`
- [ ] Send test email: `node scripts/verify-resend.js`

**Effort:** 15 min | **Owner:** You | **Depends on:** 2.3 (domain)

### 4.3 Monitoring & Alerts
- [ ] Add health-check ping to prevent Render free-tier sleep (e.g., UptimeRobot or Cron-Job.org every 10 min)
- [ ] Verify `sales/docs/launch-day-runbook.md` alert thresholds match Render/Cloudflare dashboards
- [ ] (Optional) Set up a `#simplebeacon-alerts` Slack channel or email alias

**Effort:** 30 min | **Owner:** You

### 4.4 Final pre-launch validation
- [ ] Run `node scripts/pre-launch-checklist.cjs` (currently 29/30)
- [ ] Manually verify the 1 failing item (screenshots)
- [ ] Run `npx simplebeacon scan --gate --format json` → expect 0 critical, 0 high
- [ ] Run `npm audit` in each package directory → expect 0 high/critical
- [ ] Verify no secrets in `coming-soon/`:
  ```powershell
  Get-ChildItem -Recurse -File coming-soon/ | Select-String -Pattern "sk_live_|whsec_|re_" | Measure-Object
  # Expected: 0 matches
  ```

**Effort:** 20 min | **Owner:** You

---

## Critical Path (Must happen in order)

```
1.1 Commit extension delta
    ↓
1.2 Package final .vsix
    ↓
2.1 Security hardening (express.static fix)
    ↓
2.2 Deploy to Render
    ↓
2.3 Domain & DNS
    ↓
4.2 Email (Resend) domain verification
    ↓
4.1 Stripe Live Mode
    ↓
3.1 VS Code Marketplace publish
    ↓
4.4 Final pre-launch validation
```

**Parallel tracks:** CLI publish (1.4), marketing polish (3.3), TODO cleanup (1.3), and monitoring setup (4.3) can run alongside the critical path.

---

## Quick Wins (do these first for morale)

| Task | Effort | Impact |
|------|--------|--------|
| 1.3 Resolve TODO/FIXME markers | 30 min | Clean bill of health |
| 1.4 CLI publish to npm | 10 min | Public availability |
| 4.4 Pre-launch validation script | 20 min | Confidence check |
| 3.3 Marketing copy review | 30 min | Launch-ready messaging |

---

## Estimated Calendar

| Day | Focus | Deliverable |
|-----|-------|-------------|
| **Day 1** | Commit extension, fix TODOs, publish CLI, harden static serving | Clean repo, npm published, server secure |
| **Day 2** | Deploy to Render, configure DNS, set up Resend + Stripe | Live URL, email working, payments live |
| **Day 3** | Capture screenshots, publish to VS Code Marketplace, CI stress test | Extension public, marketplace live |
| **Day 4** | Final validation, marketing posts, monitor dashboards | 100% complete, launch day |

---

## Exit Criteria for 100%

- [ ] All 4 workstreams at 100%
- [ ] `npx simplebeacon scan --gate` shows **0 critical, 0 high, 0 medium**
- [ ] `simplebeacon.ai` resolves and serves the landing page
- [ ] `npm view simplebeacon version` returns the expected version
- [ ] VS Code Marketplace page is live and installable
- [ ] Stripe test checkout completes end-to-end
- [ ] Resend test email arrives
- [ ] CI action passes on clean repo and fails on dirty repo
- [ ] No uncommitted changes in `main`
- [ ] All TODO/FIXME markers resolved or converted to GitHub issues

**When all boxes are checked, you are at 100%.**
