# SimpleBeacon Production Deployment Checklist

## Status: Active Deployment Sprint

---

## Track 1: Network Topology (DNS)

- [ ] Log into domain registrar (Cloudflare/Namecheap/GoDaddy)
- [ ] Create A Record: `simplebeacon.ai` → Render load balancer IP
- [ ] Create CNAME: `www.simplebeacon.ai` → `simplebeacon.ai`
- [ ] Set TTL to 300s for rapid propagation
- [ ] Verify: `dig simplebeacon.ai +short`
- [ ] Verify: `nslookup simplebeacon.ai`

## Track 2: Payment Gateway (Stripe Live Mode)

- [ ] Switch Stripe dashboard to **Live Mode**
- [ ] Create product: "AI Slop Cop Pro — Monthly"
- [ ] Create product: "AI Slop Cop Pro — Yearly" (with discount)
- [ ] Copy live `STRIPE_SECRET_KEY` (sk_live_...)
- [ ] Copy Price IDs (price_...) to Render env vars
- [ ] Configure webhook endpoint: `https://simplebeacon.ai/api/stripe/webhook`
- [ ] Enable events:
  - `checkout.session.completed`
  - `customer.subscription.updated`
  - `customer.subscription.deleted`
- [ ] Copy webhook signing secret to Render env vars

## Track 3: Communication Gateway (Resend)

- [ ] Log into Resend dashboard
- [ ] Add domain: `simplebeacon.ai`
- [ ] Complete TXT/MX domain verification
- [ ] Generate live `RESEND_API_KEY`
- [ ] Add to Render environment variables
- [ ] Send test email via `scripts/verify-resend.js`

## Track 4: VS Code Marketplace

- [ ] Register publisher: `simplebeacon`
- [ ] Build extension: `cd coming-soon && npm run build`
- [ ] Package `.vsix`: `npx vsce package`
- [ ] Capture 5 screenshots (1280×800 PNG):
  - [ ] Sidebar panel (dashboard overview)
  - [ ] Expanded findings (severity breakdown)
  - [ ] Settings view (configuration panel)
  - [ ] Full scan results (report view)
  - [ ] Export/share dialog
- [ ] Upload `.vsix` + screenshots to Marketplace
- [ ] Submit for review

## Track 5: CLI Registry Release

- [ ] `cd packages/simplebeacon-cli`
- [ ] Bump version if needed (`npm version patch`)
- [ ] Run prepublish checks: `npm run quality:check`
- [ ] Dry-run pack: `npm run pack:check`
- [ ] Publish: `npm publish --access public`
- [ ] Verify on npm: `npm view simplebeacon versions --json`

---

## Post-Launch Verification

Run automated validation:

```bash
node scripts/validate-production-assets.js --full
```

Expected outputs:

- DNS resolved: `simplebeacon.ai → <IP>`
- Health endpoint: `200 OK`
- Security headers: `strict-transport-security`, `x-content-type-options`
- Stripe webhook: `200 OK` (test mode)
- Resend domain: `verified`
