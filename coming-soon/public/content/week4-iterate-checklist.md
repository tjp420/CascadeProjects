# Week 4: Iterate — Metrics & Onboarding Friction Checklist

## Goal
Review conversion data, fix onboarding friction, and optimize pricing before the next outreach batch.

---

## Part 1: Conversion Metrics to Review

Run these queries against your data at the end of Week 3 (or whenever you have ~50 installs + some conversions).

### 1.1 Extension Install → Tier Conversion

```javascript
// From Stripe dashboard or your checkout DB
const conversions = {
  totalInstalls: 0,        // VS Code Marketplace installs (weekly report)
  activeFreeUsers: 0,      // Users who ran at least 1 scan (telemetry)
  teamPurchases: 0,        // Stripe checkout: product = 'team'
  enterprisePurchases: 0,  // Stripe checkout: product = 'enterprise'
};

const freeToTeamRate = conversions.teamPurchases / conversions.activeFreeUsers;
const freeToEnterpriseRate = conversions.enterprisePurchases / conversions.activeFreeUsers;

console.log(`Free → Team: ${(freeToTeamRate * 100).toFixed(2)}%`);
console.log(`Free → Enterprise: ${(freeToEnterpriseRate * 100).toFixed(2)}%`);
```

**Benchmarks:**
- Free → Team: 3–8% is healthy for developer tools
- Free → Enterprise: 0.5–2% is healthy
- If both are <1%, you have a pricing or onboarding problem

### 1.2 Revenue Mix

| Tier | Price | Units | MRR |
|------|-------|-------|-----|
| Team | $49/mo | _ | _ |
| Enterprise | $499/mo | _ | _ |
| One-time (Clearance) | $499 | _ | N/A |
| One-time (EU Sprint) | $2,499 | _ | N/A |

**Questions:**
- Is MRR growing week-over-week?
- Are one-time purchases cannibalizing subscriptions?
- Should you push subscriptions harder or keep one-time as a gateway?

### 1.3 Funnel Drop-Off

Track where users abandon:

```
Install Extension (100%)
  ↓
Run First Scan (~60% — check: did diagnostics populate?)
  ↓
See Upgrade Banner (~40% — did they hit a Team/Enterprise rule?)
  ↓
Click "Upgrade" (~10% — is the CTA clear?)
  ↓
Visit Pricing Page (~5% — did the deep link work?)
  ↓
Start Checkout (~2% — is Stripe loading?)
  ↓
Complete Payment (~1% — any payment failures?)
```

**How to track:**
- Extension: Use VS Code's built-in telemetry (opt-in) or log to your own endpoint
- Website: Google Analytics 4 events on pricing page + Stripe checkout funnel

---

## Part 2: Onboarding Friction Checklist

### 2.1 Token Paste Confusion

**Hypothesis:** Users don't know where to paste their license token.

**Test:**
- [ ] Ask 3 friends to install the extension and "upgrade to Pro"
- [ ] Watch them. Do they:
  - [ ] Find the "Set License Token" command within 30 seconds?
  - [ ] Understand that the token goes in VS Code settings, not the website?
  - [ ] Know they need to restart anything? (they shouldn't — but do they think they do?)

**Fixes if friction is high:**
- Add a "Paste Your License Token" button directly in the sidebar webview (next to the upgrade banner)
- Auto-detect if a token is in clipboard on upgrade and prompt to paste
- Add a 10-second onboarding tooltip the first time the sidebar opens

### 2.2 Free Tier Value Not Clear

**Hypothesis:** Users install, see no issues, and uninstall because they think it's broken.

**Test:**
- [ ] Check uninstall rate within 24 hours of install (Marketplace dashboard)
- [ ] If >30%, you have a value-perception problem

**Fixes:**
- On first install, scan the active file automatically and show a "clean" badge if nothing found
- If the file IS clean, show a celebratory message: "No slop detected! Your code looks clean."
- Add a "Test with sample file" button that injects a deliberate placeholder so users see the extension work

### 2.3 Pricing Page Confusion

**Hypothesis:** Users don't understand the difference between CLI scans and the VS Code extension.

**Test:**
- [ ] Hotjar or Microsoft Clarity session recordings on `pricing.html`
- [ ] Do users scroll past the extension section to the CLI section?
- [ ] Do they click "Install Free" expecting a download instead of Marketplace redirect?

**Fixes:**
- Add a visual diagram at the top of pricing: "IDE Extension (real-time) → CLI (deep scan) → Dashboard (certificate)"
- Make the extension cards visually distinct from the CLI/cert cards
- Add a "Which one do I need?" FAQ item

### 2.4 Checkout Abandonment

**Hypothesis:** Users start checkout but don't complete because they expected instant access without email.

**Test:**
- [ ] Stripe checkout funnel: what's the abandonment rate at "enter email"?

**Fixes:**
- Pre-fill email if they're logged in (requires auth — maybe overkill)
- Add trust badges: "Token delivered in 30 seconds", "14-day refund guarantee"
- Offer a "test token" for $0 that lasts 1 hour so they can verify it works before buying

---

## Part 3: Pricing Experiments

### 3.1 Test: Annual Discount

**Current:** Team $49/mo, $490/yr (17% discount)

**Test A:** Keep current
**Test B:** $39/mo, $390/yr (25% discount, anchor higher)
**Test C:** $49/mo only, no annual option (reduce decision fatigue)

**Metric:** Conversion rate + LTV

### 3.2 Test: Free Trial

**Current:** No free trial. Free tier is the trial.

**Test:** Offer 7-day Team trial (no credit card)
- At day 3: email with "You're using 12/39 rules — here's what you're missing"
- At day 6: email with "Trial ends tomorrow — 40% off first month if you upgrade now"

**Metric:** Trial-to-paid conversion rate

### 3.3 Test: Enterprise Price

**Current:** $499/mo

**Test A:** $499/mo with "Contact Sales" CTA
**Test B:** $299/mo self-serve + $499/mo with "Includes analyst call" CTA
**Test C:** Only "Contact Sales" — hide price entirely

**Metric:** Enterprise leads + average deal size

---

## Part 4: Product Improvements Based on Feedback

### 4.1 Most-Requested Features (Survey)

Send a 1-question survey to active free users:

> "What's the #1 thing preventing you from upgrading to Team?"
> [ ] Price is too high
> [ ] Free rules are enough for my needs
> [ ] I don't understand what Team adds
> [ ] I can't get approval from my manager
> [ ] Something else: __________

### 4.2 Rule Accuracy Review

Every week, review false positives:
- [ ] Check GitHub issues / Discord / email for "This rule flagged my legitimate code"
- [ ] Adjust rule regexes or add exclusions
- [ ] Publish a "changelog" of rule improvements to build trust

### 4.3 Performance

- [ ] Extension activation time < 100ms (measure with VS Code profiler)
- [ ] Scan time < 500ms for a 500-line file
- [ ] Batch CLI scan < 5 minutes for a 10,000-file repo

---

## Part 5: 30-Day Review Template

Fill this out at the end of Month 1:

```
## Month 1 Review — SimpleBeacon GTM

### Numbers
- Extension installs: ___
- Active free users (scanned at least 1 file): ___
- Team purchases: ___
- Enterprise purchases: ___
- One-time purchases (Clearance/Sprint): ___
- MRR: $___
- Total revenue: $___

### Conversion Rates
- Install → Active: ___%
- Active → Team: ___%
- Active → Enterprise: ___%
- Team → Enterprise upgrade: ___%

### Outreach
- Touch 1 emails sent: ___
- Open rate: ___%
- Reply rate: ___%
- Meetings booked: ___
- Audits completed: ___
- Conversions from outbound: ___

### What Worked
1. ___
2. ___
3. ___

### What Didn't
1. ___
2. ___
3. ___

### Changes for Month 2
1. ___
2. ___
3. ___
```

---

## Quick Wins (Do These First)

1. **Add a "Where do I paste my token?" tooltip** in the extension sidebar (30 min)
2. **Send the case study to 5 warm prospects** (friends, ex-colleagues, existing LinkedIn network) (1 hour)
3. **Post the Hacker News Show HN** on a Tuesday at 10am ET for maximum visibility (30 min)
4. **Set up Google Analytics 4** on simplebeacon.ai to track pricing page conversions (1 hour)
5. **Create a "test token" endpoint** so users can try Team features for 1 hour before buying (2 hours)

---

*Review this checklist every Friday. Ship one improvement per week minimum.*
