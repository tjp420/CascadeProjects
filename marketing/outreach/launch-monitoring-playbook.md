# Launch Morning Monitoring Playbook

**Purpose:** Real-time monitoring checklist for the first 4 hours after launch
**Use:** Keep this open in a terminal window alongside your reply monitor

---

## Pre-Launch (T-30 min)

### 1. Run the pre-launch verifier

```bash
node marketing/outreach/pre-launch-verify.js
```

**Expected:** `ALL CLEAR — ready to launch` with 0 critical failures and 0 warnings.

If any failure occurs:
- **GitHub repo not public:** `gh repo edit tjp420/CascadeProjects --visibility public`
- **npm package not found:** Republish with `npm publish --workspace=simplebeacon-cli`
- **Website pages not 200:** Check Cloudflare Worker status in dashboard
- **Stale claims in source:** Run `npx simplebeacon scan --gate --offline` and fix blocking findings

### 2. Verify Stripe webhook endpoint is reachable

```bash
# Should return 400 (missing signature) — not 404 or 502
curl -s -o /dev/null -w "%{http_code}" -X POST https://simplebeacon.ai/api/checkout/webhook -H "Content-Type: application/json" -d "{}"
```

**Expected:** `400` (endpoint exists, rejects unsigned events)

### 3. Verify checkout endpoint is reachable

```bash
# Should return 400 (missing fields) — not 404
curl -s -o /dev/null -w "%{http_code}" -X POST https://simplebeacon.ai/api/create-checkout-session -H "Content-Type: application/json" -d "{}"
```

**Expected:** `400`

### 4. Verify email health

```bash
curl -s https://simplebeacon.ai/api/health/email | node -e "process.stdin.resume();process.stdin.on('data',d=>console.log(JSON.parse(d).ok?'Email healthy':'Email DOWN'))"
```

**Expected:** `Email healthy`

### 5. Verify billing status

```bash
curl -s https://simplebeacon.ai/api/billing/status | node -e "process.stdin.resume();process.stdin.on('data',d=>{const j=JSON.parse(d);console.log('Billing:',j.configured?'configured':'NOT configured')})"
```

**Expected:** `Billing: configured`

---

## Launch (T+0)

### Post to Hacker News

1. Go to https://news.ycombinator.com/submit
2. Paste your Show HN title and body from `marketing/outreach/hn-show-post.md`
3. Submit

### Start the reply monitor

```powershell
# Set your webhook URL first (if you have one)
$env:WEBHOOK_URL = "<real Slack or Discord incoming webhook URL>"

# Start the IMAP reply monitor
node marketing/outreach/reply-monitor.js --watch
```

If no webhook URL: run without it — notifications print to terminal only.

```powershell
node marketing/outreach/reply-monitor.js --watch
```

---

## First-Hour Monitoring (T+0 to T+60 min)

### HN traction check (every 15 minutes)

1. Open https://news.ycombinator.com/newest
2. Find your post — check upvotes and comments
3. If on front page (top 30): focus on responding to comments
4. If not gaining traction after 30 min: pivot to outreach pipeline

### Transaction monitoring (every 10 minutes)

Check for webhook failures and email queue errors:

```bash
# Check if any recent checkout sessions were created
curl -s https://simplebeacon.ai/api/billing/status | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"

# Check email health (should stay 'ok')
curl -s https://simplebeacon.ai/api/health/email | node -e "process.stdin.on('data',d=>console.log(JSON.stringify(JSON.parse(d),null,2)))"
```

### What to watch for

| Signal | Severity | Action |
|--------|----------|--------|
| Webhook returns 502 or 503 | Critical | Check Cloudflare dashboard for Worker errors |
| Email health returns `ok: false` | High | Check Resend API key and Zoho SMTP credentials in Cloudflare dashboard |
| Checkout returns 503 "Stripe not configured" | Critical | Verify `STRIPE_SECRET_KEY` is set in Cloudflare Worker environment |
| User reports "no email received" | Medium | Check spam folder, then verify email queue in Cloudflare logs |
| User reports "checkout page won't load" | Medium | Verify Stripe account is active, not in review |
| Rate limit hits (429) | Low | Expected — 3 checkout attempts per IP per hour |

---

## First-Day Monitoring (T+1h to T+24h)

### Stripe dashboard

1. Log into https://dashboard.stripe.com
2. Check Payments tab for successful transactions
3. Check Webhooks tab for failed deliveries
4. If webhook failures: check endpoint URL matches `https://simplebeacon.ai/api/checkout/webhook`

### Cloudflare Worker logs

1. Log into Cloudflare dashboard
2. Go to Workers & Pages → simplebeacon-dashboard-v2
3. Check Real-time Logs for errors
4. Look for: `[CheckoutWebhook]`, `[CreateCheckoutSession]`, `[email]` log lines

### Email delivery

1. Check Resend dashboard: https://resend.com/emails
2. Look for bounced or failed emails
3. If using Zoho SMTP fallback: check Zoho Mail sent folder

### Reply monitor

- Keep `reply-monitor.js --watch` running
- Respond to prospect replies within 2 hours (your SLA)
- Classify intent: demo request, pricing question, technical question, unsubscribe

---

## Incident Response

### If Stripe webhook is failing

1. Check Cloudflare Worker logs for the webhook endpoint
2. Verify `STRIPE_WEBHOOK_SECRET` matches Stripe dashboard webhook signing secret
3. Test with Stripe CLI: `stripe listen --forward-to https://simplebeacon.ai/api/checkout/webhook`
4. Trigger a test event: `stripe trigger checkout.session.completed`

### If email delivery is failing

1. Check Resend API key validity in Cloudflare Worker environment
2. Check Zoho SMTP credentials (`SMTP_HOST`, `SMTP_USER`, `SMTP_PASS`)
3. Emails queue to SQLite/disk if both fail — check queue retry worker
4. Manual fallback: generate token via `node -e "const {generateLicenseToken}=require('./coming-soon/lib/license-utils.cjs');console.log(generateLicenseToken({email:'customer@example.com',tier:'certificate',projectName:'Manual'},process.env.SIMPLEBEACON_LICENSE_SECRET,365*24*60))"`

### If the website goes down

1. Check Cloudflare status page: https://www.cloudflarestatus.com
2. Check Worker deployment: `cd worker-deploy && npx wrangler deploy`
3. Verify DNS: `nslookup simplebeacon.ai`

### If a customer reports a broken checkout

1. Ask for: email used, tier selected, error message
2. Check Stripe dashboard for the session ID
3. Check Cloudflare logs for the checkout request
4. If Stripe issue: contact Stripe support
5. If code issue: fix and redeploy with `cd worker-deploy && npx wrangler deploy`

---

## End-of-Day Checklist

- [ ] All HN comments responded to
- [ ] All prospect replies answered (within 2h SLA)
- [ ] Stripe dashboard checked — no failed payments
- [ ] Webhook deliveries checked — no failures
- [ ] Email delivery checked — no bounces
- [ ] Cloudflare Worker logs checked — no errors
- [ ] Reply monitor still running
- [ ] Note any issues for tomorrow

---

## Quick Reference

| Resource | URL |
|----------|-----|
| Stripe dashboard | https://dashboard.stripe.com |
| Cloudflare dashboard | https://dash.cloudflare.com |
| Resend dashboard | https://resend.com/emails |
| Zoho Mail | https://mail.zoho.com |
| GitHub repo | https://github.com/tjp420/CascadeProjects |
| npm package | https://www.npmjs.com/package/simplebeacon |
| Pre-launch verifier | `node marketing/outreach/pre-launch-verify.js` |
| Reply monitor | `node marketing/outreach/reply-monitor.js --watch` |
| Gate scan | `npx simplebeacon scan --gate --offline` |
| Redeploy website | `cd coming-soon && npm run build && cd ../worker-deploy && npx wrangler deploy` |
