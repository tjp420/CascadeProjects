# SimpleBeacon Sales Launch Runbook

Step-by-step instructions for the manual steps required to go from "code ready" to "ready for sales."

## Prerequisites (Already Complete)

- CLI published to npm: `simplebeacon@1.1.5`
- Production site live: `simplebeacon.ai` returns healthy
- Email configured: Resend API + Zoho SMTP both healthy
- Pricing page live: `simplebeacon.ai/pricing.html`
- VSIX packaged: `simplebeacon-vscode-3.0.517.vsix` (17.1MB)
- Pre-launch checklist: 31/31 checks pass
- GitHub Action stress test: clean/dirty/large all pass
- Legal docs: EULA, Privacy, Terms, MIT License
- Launch posts drafted: HN, Product Hunt, Reddit

---

## Step 1: Publish to VS Code Marketplace

### 1.1 Create a Personal Access Token (PAT)

1. Go to https://dev.azure.com
2. Sign in with the Microsoft account associated with your VS Code publisher (`simplebeacon`)
3. Click your profile icon (top right) → **User settings** → **Personal access tokens**
4. Click **New Token**
5. Fill in:
   - **Name**: `vsce-publish-simplebeacon`
   - **Organization**: `All accessible organizations` (or select the one linked to your publisher)
   - **Expiration**: 1 year (or shorter if preferred)
   - **Scopes**: Click "Show all scopes" at the bottom → find **Marketplace** → check **Acquire** and **Manage**
6. Click **Create**
7. Copy the token immediately — it won't be shown again

### 1.2 Publish the extension

```bash
cd simplebeacon-vscode-merged

# Login with your PAT (one-time, cached for future publishes)
npx vsce login simplebeacon
# Paste the PAT when prompted

# Publish to marketplace
npx vsce publish --no-dependencies
```

### 1.3 Verify the listing is live

1. Wait 2-5 minutes for the marketplace to process
2. Check: https://marketplace.visualstudio.com/items?itemName=simplebeacon.simplebeacon-vscode
3. Verify:
   - Extension name and description appear
   - Screenshots render in the README
   - Install button works
   - Version shows 3.0.517

### 1.4 Test install from marketplace

1. Open VS Code on a clean machine
2. Go to Extensions (Ctrl+Shift+X)
3. Search for "SimpleBeacon AI Slop Cop"
4. Click Install
5. Verify the sidebar loads and you can run a scan

---

## Step 2: Validate Stripe Live Checkout

### 2.1 Verify Stripe keys are live in production

```bash
# Check that production has live Stripe keys (not test keys)
# The billing health endpoint should return configured: true
curl https://simplebeacon.ai/api/health/email
# Expected: {"ok":true,"configured":true,...}

# Check billing endpoint (will return 401 without auth — that's expected)
curl -s -o /dev/null -w "%{http_code}" https://simplebeacon.ai/api/billing/health
# Expected: 401 (endpoint exists and requires auth)
```

### 2.2 Run a real test transaction

1. Open https://simplebeacon.ai/pricing.html in your browser
2. Click the Developer tier ($49/mo) checkout button
3. Complete the Stripe checkout with a real credit card
4. Verify:
   - Stripe checkout completes successfully
   - You receive a confirmation email at the registered address
   - The subscription appears in your Stripe dashboard (https://dashboard.stripe.com/subscriptions)
   - The webhook fires (check server logs or Stripe webhook logs)

### 2.3 Verify webhook processing

```bash
# Check Stripe webhook events in the dashboard
# Go to: https://dashboard.stripe.com/webhooks
# Look for: checkout.session.completed event
# Verify: it was delivered successfully (200 response) to your webhook endpoint
```

### 2.4 Verify subscription activation

1. After the webhook processes, check the dashboard at https://simplebeacon.ai/dashboard/
2. Verify your account shows the Developer tier active
3. Verify trial/end date is set correctly (14 days from signup)

### 2.5 Refund the test transaction

1. Go to https://dashboard.stripe.com/payments
2. Find the test payment
3. Click **Refund** → Full refund
4. Verify the subscription is canceled

---

## Step 3: Set Up Production Alerting

### 3.1 Render built-in alerts (if not already configured)

1. Go to https://dashboard.render.com
2. Select your `simplebeacon` web service
3. Go to **Settings** → **Health Checks**
4. Verify health check path is `/health` (should already be set)
5. Go to **Settings** → **Notifications**
6. Add email alert for:
   - **Deploy failures**: `admin@simplebeacon.ai`
   - **Health check failures**: `admin@simplebeacon.ai`
   - **High memory/CPU**: `admin@simplebeacon.ai`

### 3.2 External uptime monitoring (recommended)

Sign up for a free uptime monitor (UptimeRobot, BetterStack, or Pingdom):

#### UptimeRobot (free tier — 50 monitors)

1. Go to https://uptimerobot.com → Sign up
2. Add new monitor:
   - **Monitor type**: HTTP(s)
   - **Friendly name**: `SimpleBeacon Production`
   - **URL**: `https://simplebeacon.ai/api/health`
   - **Monitoring interval**: 5 minutes
3. Add alert contact:
   - **Type**: Email
   - **Email**: `admin@simplebeacon.ai`
4. Add a second monitor for the pricing page:
   - **URL**: `https://simplebeacon.ai/pricing.html`
   - **Interval**: 5 minutes

### 3.3 Stripe webhook monitoring

1. Go to https://dashboard.stripe.com/webhooks
2. Select your webhook endpoint
3. Verify it shows recent successful deliveries
4. Set up Stripe email alerts for failed webhooks:
   - Stripe Dashboard → **Developers** → **Webhooks** → **Settings**
   - Enable email notifications for failed deliveries

---

## Step 4: Customer Journey Smoke Test

### 4.1 CLI journey

```bash
# Install CLI globally
npm install -g simplebeacon

# Verify installation
simplebeacon --version
# Expected: 1.1.5

# Run first scan on a test repo
mkdir /tmp/sb-test && cd /tmp/sb-test
echo "const x = 'TODO: implement this';" > test.js
simplebeacon scan --gate

# Review findings in terminal output
# Expected: shows the TODO/placeholder finding

# Export report
simplebeacon scan --format json --output report.json
# Expected: report.json created with findings

# Verify offline mode
simplebeacon scan --gate --offline
# Expected: same results, no network activity
```

### 4.2 VS Code extension journey

1. Open VS Code
2. Install "SimpleBeacon AI Slop Cop" from marketplace
3. Open a project folder
4. Run scan via command palette: `SimpleBeacon: Scan Workspace`
5. Verify:
   - Sidebar shows scan results
   - Quality score is displayed
   - Gate status (pass/fail) is shown
   - Findings are clickable and navigate to source
6. Export report via command palette: `SimpleBeacon: Export Report`
7. Open the dashboard via status bar click

### 4.3 Upgrade journey

1. From the dashboard or pricing page, click the Developer tier checkout
2. Complete Stripe checkout
3. Verify subscription activates
4. Verify the dashboard shows Developer tier features unlocked
5. Verify scan limits are removed (unlimited files per scan)

---

## Step 5: Final Go/No-Go Checklist

Before any public announcement:

- [ ] VS Code Marketplace listing is live and installable
- [ ] Stripe live checkout works end-to-end (tested with real card)
- [ ] Webhook processes successfully and activates subscription
- [ ] Uptime monitoring is configured for `simplebeacon.ai`
- [ ] Email alerts are configured for deploy/health failures
- [ ] CLI install → scan → export works on a clean machine
- [ ] VS Code extension install → scan → dashboard works
- [ ] Upgrade flow (free → Developer tier) works
- [ ] Pricing page matches actual product tiers and prices
- [ ] Privacy Policy and Terms of Service are accessible from the site
- [ ] Support/FAQ page exists and links work
- [ ] Launch posts (HN, Product Hunt, Reddit) are ready to post

Once all items are checked, you're ready to announce publicly.

---

## Rollback Plan

If something goes wrong post-launch:

1. **Extension issues**: Unpublish from marketplace via `npx vsce unpublish simplebeacon.simplebeacon-vscode`
2. **Billing issues**: Pause Stripe checkout sessions in Stripe dashboard → set pricing page to "coming soon"
3. **Site issues**: Roll back the Render deployment to the previous known-good version
4. **Communication**: Post an update to the launch threads (HN, Product Hunt, Reddit) acknowledging the issue

## Support Channels

- **Customer email**: `admin@simplebeacon.ai`
- **GitHub issues**: https://github.com/tjp420/CascadeProjects/issues
- **Health check**: https://simplebeacon.ai/api/health
- **Email health**: https://simplebeacon.ai/api/health/email
