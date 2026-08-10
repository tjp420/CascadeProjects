'use strict';

/**
 * Billing Email Templates — centralized HTML/text email generators for
 * Stripe billing lifecycle events.
 *
 * All templates share a consistent branded layout with:
 * - SimpleBeacon header with gradient accent
 * - Color-coded callout boxes (green=success, red=warning, blue=info)
 * - Responsive inline-styled HTML (works in all email clients)
 * - Plain-text fallback for each template
 *
 * Usage:
 *   const { renderPaymentFailedEmail } = require('./billing-email-templates.cjs');
 *   const { subject, text, html } = renderPaymentFailedEmail({ customerEmail, attemptCount, nextRetry });
 *   await sendEmail({ to: customerEmail, subject, text, html });
 */

const { getTierMonthlyPrice } = require('./proration-calculator.cjs');

const BASE_STYLES = `
  <style>
    body { margin:0; padding:0; background-color:#f4f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif; color:#333333; -webkit-font-smoothing:antialiased; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }

    .wrapper { width:100%; table-layout:fixed; background-color:#f4f5f7; padding-bottom:40px; padding-top:40px; }
    .main { background-color:#ffffff; margin:0 auto; width:100%; max-width:600px; border-spacing:0; border-radius:8px; box-shadow:0 4px 12px rgba(0,0,0,0.05); overflow:hidden; }

    .header { background-color:#0d9488; padding:36px 32px; text-align:center; }
    .header h1 { color:#ffffff; margin:0; font-size:22px; font-weight:600; letter-spacing:-0.3px; }
    .header .tagline { color:rgba(255,255,255,0.8); font-size:13px; margin-top:6px; font-weight:400; }

    .content { padding:32px; }
    .greeting { font-size:18px; font-weight:600; margin-top:0; margin-bottom:16px; color:#111111; }
    .body-text { font-size:15px; line-height:1.6; margin-top:0; margin-bottom:24px; color:#555555; }
    .body-text strong { color:#111111; font-weight:600; }
    .body-text a { color:#0d9488; font-weight:500; }

    .section-label { font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; color:#0d9488; margin:0 0 12px; }

    .card { background-color:#f8f9fa; border:1px solid #e9ecef; border-radius:6px; padding:24px; margin-bottom:24px; }
    .card-row { margin-bottom:12px; font-size:15px; }
    .card-row:last-child { margin-bottom:0; padding-top:12px; border-top:1px dashed #dee2e6; }
    .card-label { color:#666666; }
    .card-value { color:#111111; font-weight:500; }
    .card-value-mono { font-family:'SF Mono',Menlo,Consolas,monospace; font-size:12px; word-break:break-all; line-height:1.5; }

    .code-block { background-color:#1a2332; border-radius:6px; padding:18px 20px; margin-bottom:12px; overflow-x:auto; }
    .code-block pre { margin:0; font-family:'SF Mono',Menlo,Consolas,monospace; font-size:13px; line-height:1.75; color:#e2e8f0; white-space:pre-wrap; word-break:break-all; }
    .code-block .c { color:#5eead4; }
    .code-block .prompt { color:#94a3b8; }

    .step-row { margin-bottom:20px; }
    .step-row:last-child { margin-bottom:0; }
    .step-header { font-size:15px; font-weight:600; color:#111111; margin-bottom:8px; }
    .step-header .num { display:inline-block; background-color:#0d9488; color:#ffffff; width:22px; height:22px; line-height:22px; text-align:center; border-radius:50%; font-size:12px; font-weight:700; margin-right:10px; }

    .features-table { width:100%; }
    .features-table td { padding:10px 0; font-size:14px; color:#555555; border-bottom:1px solid #f1f5f9; }
    .features-table td:last-child { text-align:right; color:#111111; font-weight:500; }
    .features-table tr:last-child td { border-bottom:none; }

    .ways-table { width:100%; }
    .ways-table td { width:33.33%; padding:16px 8px; text-align:center; vertical-align:top; }
    .ways-icon { font-size:22px; margin-bottom:8px; display:block; }
    .ways-label { font-size:13px; font-weight:600; color:#111111; margin:0 0 4px; }
    .ways-desc { font-size:12px; color:#666666; line-height:1.4; margin:0; }

    .btn-container { text-align:center; margin:28px 0; }
    .btn { background-color:#0d9488; color:#ffffff !important; display:inline-block; padding:14px 32px; font-weight:600; text-decoration:none; border-radius:6px; font-size:15px; }
    .btn-secondary { background-color:transparent; color:#0d9488 !important; border:1.5px solid #0d9488; margin-left:8px; }

    .divider { height:1px; background-color:#e9ecef; margin:0 0 24px; }

    .footer { text-align:center; padding:24px 32px; font-size:12px; color:#888888; line-height:1.6; background-color:#f8f9fa; }
    .footer a { color:#0d9488; text-decoration:none; }
    .footer .brand { font-size:14px; font-weight:600; color:#0d9488; margin-bottom:8px; }

    .callout { border-radius:6px; padding:16px 20px; margin:20px 0; }
    .callout-success { background:#f0fdfa; border-left:3px solid #14b8a6; }
    .callout-warning { background:#fef2f2; border-left:3px solid #f43f5e; }
    .callout-info { background:#f0fdfa; border-left:3px solid #14b8a6; }
    .callout p { margin:0; font-size:14px; }
    .callout-success p { color:#134e4a; }
    .callout-warning p { color:#881337; }
    .callout-info p { color:#134e4a; }

    .meta { background:#f8f9fa; border:1px solid #e9ecef; border-radius:6px; padding:16px; margin:20px 0; }
    .meta-row { padding:6px 0; font-size:14px; border-bottom:1px solid #f1f5f9; }
    .meta-row:last-child { border-bottom:none; }
    .meta-label { color:#666666; }
    .meta-value { color:#111111; font-weight:500; }

    @media only screen and (max-width:480px) {
      .wrapper { padding-top:20px; padding-bottom:20px; }
      .header { padding:28px 20px; }
      .header h1 { font-size:19px; }
      .content { padding:24px 20px; }
      .card { padding:18px; }
      .ways-table td { width:100% !important; padding:12px 0; border-bottom:1px solid #f1f5f9; }
      .ways-table tr:last-child td { border-bottom:none; }
      .btn-secondary { margin-left:0; margin-top:10px; }
    }
  </style>
`;

function wrapHtml(title, bodyContent) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">${BASE_STYLES}</head><body>
  <div class="wrapper">
  <table class="main" role="presentation">
    ${bodyContent}
  </table>
  </div>
  </body></html>`;
}

function fmtDate(iso) {
  if (!iso) return 'soon';
  try { return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch { return iso; }
}

const TIER_DISPLAY_NAMES = {
  developer: 'Developer',
  team_pro: 'Team Pro',
  enterprise: 'Enterprise',
  pro: 'Pro (Legacy)',
};

function tierDisplayName(tier) {
  return TIER_DISPLAY_NAMES[tier] || tier;
}

/**
 * Subscription activated email — onboarding quickstart with license token.
 * @param {Object} opts
 * @param {string} opts.tier - Subscription tier
 * @param {string} [opts.licenseToken] - License token (optional)
 * @param {number} [opts.totalSeats] - Total seats for team plans
 * @param {number} [opts.extraSeats] - Extra seats purchased
 * @returns {{subject:string,text:string,html:string}}
 */
function renderSubscriptionActivated(opts = {}) {
  const { tier = 'pro', licenseToken, totalSeats, extraSeats } = opts;
  const tierName = tierDisplayName(tier);
  const seatInfo = extraSeats > 0
    ? `\n\nYour Team Pro subscription includes 5 base seats plus ${extraSeats} extra seat${extraSeats === 1 ? '' : 's'} (${totalSeats} total).`
    : (tier === 'team_pro' ? '\n\nYour Team Pro subscription includes 5 seats.' : '');

  const subject = `Welcome to SimpleBeacon ${tierName} — Your License Token Inside`;
  const monthlyPriceCents = getTierMonthlyPrice(tier);
  const monthlyPriceUsd = monthlyPriceCents > 0 ? `$${(monthlyPriceCents / 100).toFixed(0)}/month` : 'custom pricing';
  const text = `Welcome to SimpleBeacon ${tierName}!\n\nThank you for subscribing to SimpleBeacon ${tierName} (${monthlyPriceUsd}). Your subscription is now active with unlimited scans.${seatInfo}\n\n--- Your License Token ---\n${licenseToken || '(no token generated yet — contact support)'}\n--------------------------\n\nQUICKSTART (3 steps):\n\n1. Install the CLI:\n   npm install -g simplebeacon\n\n2. Activate your license:\n   export SIMPLEBEACON_LICENSE_TOKEN="${licenseToken || '<your-token>'}"\n   # Or save to file:\n   mkdir -p ~/.simplebeacon\n   echo "${licenseToken || '<your-token>'}" > ~/.simplebeacon/license.jwt\n\n3. Run your first scan:\n   simplebeacon scan --gate\n\nThat's it! You now have unlimited scans, CI/CD gate integration, 38 analyzer modules, PDF reports, and all export formats.\n\nOTHER WAYS TO USE SIMPLEBEACON:\n- VS Code extension: Search "simplebeacon" in the Extensions marketplace\n- Dashboard: https://simplebeacon.ai/dashboard\n- CI/CD: Add simplebeacon scan --gate to your pipeline\n\nYour token expires in 1 year (renewed automatically by your subscription).\nRetrieve it anytime: https://simplebeacon.ai\n\nNeed help? Reply to this email or visit https://simplebeacon.ai`;

  // ---- Build body (table-row based for email client compat) ----
  let body = '';

  // Header
  body += `
    <tr>
      <td class="header">
        <h1>SimpleBeacon</h1>
        <div class="tagline">Welcome to the ${tierName} plan</div>
      </td>
    </tr>`;

  // Content
  body += `
    <tr>
      <td class="content">
        <p class="greeting">You're all set &mdash; let's scan.</p>
        <p class="body-text">Your ${tierName} subscription is now active. You have <strong>unlimited scans</strong>, <strong>38 analyzer engines</strong>, and <strong>CI/CD gate integration</strong>. Here's everything you need to run your first scan in under a minute.</p>`;

  if (extraSeats > 0) {
    body += `<p class="body-text">Your Team Pro subscription includes 5 base seats plus <strong>${extraSeats} extra seat${extraSeats === 1 ? '' : 's'}</strong> (${totalSeats} total).</p>`;
  } else if (tier === 'team_pro') {
    body += `<p class="body-text">Your Team Pro subscription includes 5 seats.</p>`;
  }

  // License token card
  if (licenseToken) {
    body += `
      <p class="section-label">Your License Token</p>
      <div class="card">
        <div class="card-row">
          <span class="card-label">Token</span>
          <div class="card-value card-value-mono">${licenseToken}</div>
        </div>
        <div class="card-row" style="padding-top:12px;border-top:1px dashed #dee2e6;">
          <span class="card-label">Expires</span>
          <span class="card-value">1 year (auto-renewed)</span>
        </div>
      </div>
      <p class="body-text" style="font-size:13px;color:#888888;margin-top:-12px;">Keep this token safe. Retrieve it anytime from your <a href="https://simplebeacon.ai">dashboard</a>.</p>`;
  }

  // Quickstart
  body += `
    <div class="divider"></div>
    <p class="section-label">Quickstart &mdash; 3 Steps to Your First Scan</p>

    <div class="step-row">
      <div class="step-header"><span class="num">1</span>Install the CLI</div>
      <div class="code-block"><pre><span class="c"># Install globally via npm</span>
npm install -g simplebeacon</pre></div>
    </div>

    <div class="step-row">
      <div class="step-header"><span class="num">2</span>Activate your license</div>
      <div class="code-block"><pre><span class="c"># Option A: Set as environment variable</span>
export SIMPLEBEACON_LICENSE_TOKEN="${licenseToken ? licenseToken.substring(0, 45) + '...' : '<your-token>'}"

<span class="c"># Option B: Save to file (recommended)</span>
mkdir -p ~/.simplebeacon
echo "&lt;your-token&gt;" &gt; ~/.simplebeacon/license.jwt</pre></div>
    </div>

    <div class="step-row">
      <div class="step-header"><span class="num">3</span>Run your first scan</div>
      <div class="code-block"><pre><span class="prompt">$</span> simplebeacon scan --gate

SimpleBeacon v1.1.2
52 deterministic engines
Scanning 247 files...
&#10003; Gate: PASS (0 critical, 0 high)
&#10003; Report saved to .simplebeacon/report.json</pre></div>
    </div>`;

  // What's included
  body += `
    <div class="divider"></div>
    <p class="section-label">What's Included in Your ${tierName} Plan</p>
    <table class="features-table" role="presentation" cellpadding="0" cellspacing="0">
      <tr><td>Scans</td><td>Unlimited</td></tr>
      <tr><td>Analyzer engines</td><td>38</td></tr>
      <tr><td>CI/CD gate</td><td>Included</td></tr>
      <tr><td>PDF reports</td><td>Included</td></tr>
      <tr><td>Export formats</td><td>All (JSON, MD, HTML, ZIP)</td></tr>
      <tr><td>Token validity</td><td>1 year (auto-renewed)</td></tr>
    </table>`;

  // Other ways to use
  body += `
    <div class="divider"></div>
    <p class="section-label">Other Ways to Use SimpleBeacon</p>
    <table class="ways-table" role="presentation" cellpadding="0" cellspacing="0">
      <tr>
        <td>
          <span class="ways-icon">&#128187;</span>
          <p class="ways-label">VS Code</p>
          <p class="ways-desc">Search "simplebeacon" in the Extensions marketplace</p>
        </td>
        <td>
          <span class="ways-icon">&#127760;</span>
          <p class="ways-label">Web Dashboard</p>
          <p class="ways-desc">Run scans in your browser</p>
        </td>
        <td>
          <span class="ways-icon">&#9881;</span>
          <p class="ways-label">CI/CD Pipeline</p>
          <p class="ways-desc">Add to GitHub Actions or GitLab CI</p>
        </td>
      </tr>
    </table>`;

  // CTA
  body += `
    <div class="btn-container">
      <a href="https://simplebeacon.ai/dashboard" class="btn">Open Dashboard</a>
      <a href="https://simplebeacon.ai/docs" class="btn btn-secondary">Read Docs</a>
    </div>

    <p class="body-text" style="font-size:13px;color:#888888;">Need help? Just reply to this email or visit <a href="https://simplebeacon.ai">simplebeacon.ai</a>.</p>
      </td>
    </tr>`;

  // Footer
  body += `
    <tr>
      <td class="footer">
        <p class="brand">SimpleBeacon</p>
        <p>Continuous security scanning for AI-powered development teams.</p>
        <p><a href="https://simplebeacon.ai">Website</a> &middot; <a href="https://simplebeacon.ai/docs">Docs</a> &middot; <a href="https://simplebeacon.ai/dashboard">Dashboard</a> &middot; <a href="mailto:support@simplebeacon.ai">Support</a></p>
        <p style="margin-top:12px;">&copy; 2026 SimpleBeacon, Inc. &middot; You receive this email because you have a SimpleBeacon account.</p>
      </td>
    </tr>`;

  return { subject, text, html: wrapHtml(`Welcome to SimpleBeacon ${tierName}`, body) };
}

/**
 * Subscription canceled email.
 * @returns {{subject:string,text:string,html:string}}
 */
function renderSubscriptionCanceled() {
  const subject = 'SimpleBeacon Subscription Canceled';
  const text = `Your SimpleBeacon subscription has been canceled.\n\nYou will retain access until the end of your current billing period. After that, your account will revert to the free tier.\n\nWe hope to see you again soon.`;
  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Subscription Canceled</div></td></tr>
    <tr><td class="content">
      <p class="greeting">Your subscription has been canceled.</p>
      <div class="callout callout-info">
        <p>You will retain access until the end of your current billing period. After that, your account will revert to the free tier.</p>
      </div>
      <p class="body-text">We hope to see you again soon. <a href="https://simplebeacon.ai/settings/billing">Reactivate anytime</a>.</p>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;
  return { subject, text, html: wrapHtml('Subscription Canceled', bodyContent) };
}

/**
 * Subscription reactivated email (after successful payment retry).
 * @returns {{subject:string,text:string,html:string}}
 */
function renderSubscriptionReactivated() {
  const subject = 'SimpleBeacon Subscription Reactivated';
  const text = `Your SimpleBeacon subscription has been reactivated following successful payment.\n\nAll features are restored. Thank you for your continued subscription.`;
  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Subscription Reactivated</div></td></tr>
    <tr><td class="content">
      <p class="greeting">Your subscription is reactivated.</p>
      <div class="callout callout-success">
        <p>All features are restored following successful payment. Thank you for your continued subscription.</p>
      </div>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;
  return { subject, text, html: wrapHtml('Subscription Reactivated', bodyContent) };
}

/**
 * Payment failed email.
 * @param {Object} opts
 * @param {number} [opts.attemptCount] - Stripe retry attempt number
 * @param {string|null} [opts.nextRetry] - ISO date of next retry or null if final
 * @returns {{subject:string,text:string,html:string}}
 */
function renderPaymentFailed(opts = {}) {
  const { attemptCount = 1, nextRetry = null } = opts;
  const isFinal = !nextRetry;
  const retryDate = nextRetry ? fmtDate(nextRetry) : null;

  const subject = isFinal
    ? 'SimpleBeacon Subscription — Final Payment Attempt Failed'
    : 'SimpleBeacon Subscription — Payment Failed';

  const retryLine = nextRetry
    ? `Stripe will automatically retry the payment on ${retryDate}.`
    : 'This was the final retry attempt. Your subscription will be deactivated at the end of the current billing period.';

  const text = `A payment for your SimpleBeacon subscription failed (attempt ${attemptCount}).\n\n${retryLine}\n\nPlease update your payment method at https://simplebeacon.ai/settings/billing to avoid service interruption.\n\nIf you believe this is an error, please contact support@simplebeacon.ai.`;

  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Payment Failed</div></td></tr>
    <tr><td class="content">
      <p class="greeting">A payment failed (attempt ${attemptCount})</p>
      <div class="callout callout-warning">
        <p>${retryLine}</p>
      </div>
      <p class="body-text">Please update your payment method to avoid service interruption.</p>
      <div class="btn-container"><a href="https://simplebeacon.ai/settings/billing" class="btn">Update Payment Method</a></div>
      <p class="body-text">If you believe this is an error, please contact <a href="mailto:support@simplebeacon.ai">support@simplebeacon.ai</a>.</p>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;

  return { subject, text, html: wrapHtml('Payment Failed', bodyContent) };
}

/**
 * Trial ending soon email.
 * @param {Object} opts
 * @param {string|null} [opts.trialEnd] - ISO date when trial ends
 * @returns {{subject:string,text:string,html:string}}
 */
function renderTrialEnding(opts = {}) {
  const { trialEnd = null } = opts;
  const trialEndDate = fmtDate(trialEnd);

  const subject = 'SimpleBeacon Trial Ending Soon — Add a Payment Method';
  const text = `Your SimpleBeacon trial will end on ${trialEndDate}.\n\nTo continue using all features without interruption, please add a payment method at https://simplebeacon.ai/settings/billing.\n\nIf you do not add a payment method, your account will revert to the free tier after the trial ends.`;

  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Trial Ending Soon</div></td></tr>
    <tr><td class="content">
      <p class="greeting">Your trial ends on ${trialEndDate}</p>
      <div class="callout callout-info">
        <p>To continue using all features without interruption, please add a payment method.</p>
      </div>
      <div class="btn-container"><a href="https://simplebeacon.ai/settings/billing" class="btn">Add Payment Method</a></div>
      <p class="body-text">If you do not add a payment method, your account will revert to the free tier after the trial ends.</p>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;

  return { subject, text, html: wrapHtml('Trial Ending Soon', bodyContent) };
}

/**
 * Dispute alert email (internal — sent to support team).
 * @param {Object} opts
 * @param {string} opts.chargeId - Stripe charge ID
 * @param {string} [opts.reason] - Dispute reason
 * @param {string} [opts.status] - Dispute status
 * @param {number} [opts.amountCents] - Dispute amount in cents
 * @param {string} [opts.currency] - Currency code
 * @returns {{subject:string,text:string,html:string}}
 */
function renderDisputeAlert(opts = {}) {
  const { chargeId, reason = 'unspecified', status = 'needs_response', amountCents, currency = 'usd' } = opts;
  const amount = amountCents ? (amountCents / 100).toFixed(2) : 'unknown';
  const cur = currency.toUpperCase();

  const subject = `DISPUTE ALERT: ${reason} — $${amount} ${cur}`;
  const text = `A charge dispute has been filed.\n\nCharge ID: ${chargeId}\nReason: ${reason}\nAmount: ${amount} ${cur}\nStatus: ${status}\n\nAction required: Submit evidence in the Stripe Dashboard within 7 days to avoid automatic loss.`;

  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Dispute Alert</div></td></tr>
    <tr><td class="content">
      <p class="greeting">A charge dispute has been filed</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Charge ID</span><span class="meta-value">${chargeId}</span></div>
        <div class="meta-row"><span class="meta-label">Reason</span><span class="meta-value">${reason}</span></div>
        <div class="meta-row"><span class="meta-label">Amount</span><span class="meta-value">${amount} ${cur}</span></div>
        <div class="meta-row"><span class="meta-label">Status</span><span class="meta-value">${status}</span></div>
      </div>
      <div class="callout callout-warning">
        <p><strong>Action required:</strong> Submit evidence in the Stripe Dashboard within 7 days to avoid automatic loss.</p>
      </div>
      <div class="btn-container"><a href="https://dashboard.stripe.com/disputes" class="btn">Open Stripe Dashboard</a></div>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;

  return { subject, text, html: wrapHtml('Charge Dispute Filed', bodyContent) };
}

/**
 * Invoice coming due email — notifies customer of an upcoming subscription charge.
 * @param {Object} opts
 * @param {number} [opts.amountCents] - Invoice amount in cents
 * @param {string} [opts.currency] - Currency code
 * @param {string|null} [opts.dueDate] - ISO date when payment will be collected
 * @param {string} [opts.tier] - Subscription tier
 * @param {string|null} [opts.invoiceNumber] - Stripe invoice number
 * @returns {{subject:string,text:string,html:string}}
 */
function renderInvoiceUpcoming(opts = {}) {
  const { amountCents, currency = 'usd', dueDate = null, tier = 'pro', invoiceNumber = null } = opts;
  const amount = amountCents ? (amountCents / 100).toFixed(2) : 'unknown';
  const cur = currency.toUpperCase();
  const dueDateStr = fmtDate(dueDate);

  const subject = `SimpleBeacon — Upcoming Payment of $${amount} ${cur} on ${dueDateStr}`;
  const text = `Your SimpleBeacon ${tier} subscription payment of $${amount} ${cur} will be charged on ${dueDateStr}.${invoiceNumber ? `\n\nInvoice: ${invoiceNumber}` : ''}\n\nThis is an automated reminder — no action is needed if your payment method is up to date.\n\nTo review or update your payment method, visit https://simplebeacon.ai/settings/billing`;

  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Upcoming Payment</div></td></tr>
    <tr><td class="content">
      <p class="greeting">Payment of $${amount} ${cur} on ${dueDateStr}</p>
      <p class="body-text">Your SimpleBeacon <strong>${tier}</strong> subscription payment will be charged on <strong>${dueDateStr}</strong>.</p>
      ${invoiceNumber ? `<div class="meta"><div class="meta-row"><span class="meta-label">Invoice</span><span class="meta-value">${invoiceNumber}</span></div></div>` : ''}
      <div class="callout callout-info">
        <p>This is an automated reminder &mdash; no action is needed if your payment method is up to date.</p>
      </div>
      <div class="btn-container"><a href="https://simplebeacon.ai/settings/billing" class="btn">Review Payment Method</a></div>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;

  return { subject, text, html: wrapHtml('Upcoming Payment Reminder', bodyContent) };
}

/**
 * Proration notice email — sent when a customer upgrades or downgrades tier mid-cycle.
 * @param {Object} opts
 * @param {string} opts.fromTier - Previous tier name
 * @param {string} opts.toTier - New tier name
 * @param {boolean} [opts.isUpgrade] - Whether this is an upgrade (true) or downgrade (false)
 * @param {number} [opts.daysRemaining] - Days remaining in current billing cycle
 * @param {number} [opts.netAdjustmentCents] - Net adjustment in cents (positive=charge, negative=credit)
 * @param {string} [opts.netAdjustmentDisplay] - Pre-formatted display string (e.g. "$12.34 charge")
 * @param {boolean} [opts.isAnnual] - Whether the subscription is annual
 * @returns {{subject:string,text:string,html:string}}
 */
function renderProrationNotice(opts = {}) {
  const {
    fromTier = 'developer',
    toTier = 'developer',
    isUpgrade = true,
    daysRemaining = 0,
    netAdjustmentCents = 0,
    netAdjustmentDisplay = '$0.00',
    isAnnual = false,
  } = opts;

  const fromName = tierDisplayName(fromTier);
  const toName = tierDisplayName(toTier);
  const cycleLabel = isAnnual ? 'annual' : 'monthly';
  const action = isUpgrade ? 'upgraded' : 'changed';
  const calloutClass = isUpgrade ? 'callout-info' : 'callout-success';
  const direction = netAdjustmentCents > 0 ? 'charged' : 'credited';

  const subject = `SimpleBeacon — Subscription ${isUpgrade ? 'Upgrade' : 'Change'}: ${fromName} → ${toName}`;
  const text = `Your SimpleBeacon subscription has been ${action} from ${fromName} to ${toName}.\n\nProration for remaining ${daysRemaining} days of your ${cycleLabel} billing cycle:\n  Adjustment: ${netAdjustmentDisplay} (${direction} to your next invoice)\n\nYour new ${toName} tier features are now active.\n\nTo review your subscription details, visit https://simplebeacon.ai/settings/billing`;

  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">${isUpgrade ? 'Subscription Upgraded' : 'Subscription Changed'}</div></td></tr>
    <tr><td class="content">
      <p class="greeting">${action.charAt(0).toUpperCase() + action.slice(1)} from ${fromName} to ${toName}</p>
      <div class="meta">
        <div class="meta-row"><span class="meta-label">Previous Plan</span><span class="meta-value">${fromName}</span></div>
        <div class="meta-row"><span class="meta-label">New Plan</span><span class="meta-value">${toName}</span></div>
        <div class="meta-row"><span class="meta-label">Billing Cycle</span><span class="meta-value">${cycleLabel.charAt(0).toUpperCase() + cycleLabel.slice(1)}</span></div>
        <div class="meta-row"><span class="meta-label">Days Remaining</span><span class="meta-value">${daysRemaining}</span></div>
        <div class="meta-row"><span class="meta-label">Proration Adjustment</span><span class="meta-value">${netAdjustmentDisplay}</span></div>
      </div>
      <div class="callout ${calloutClass}">
        <p>The adjustment above will be ${direction} to your next invoice. Your new ${toName} tier features are now active.</p>
      </div>
      <div class="btn-container"><a href="https://simplebeacon.ai/settings/billing" class="btn">Review Subscription</a></div>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;

  return { subject, text, html: wrapHtml(isUpgrade ? 'Subscription Upgraded' : 'Subscription Changed', bodyContent) };
}

/**
 * Subscription paused email — sent when a subscription is paused.
 * @param {Object} opts
 * @param {string} [opts.tier] - Subscription tier
 * @param {string|null} [opts.resumeDate] - ISO date when subscription can resume
 * @returns {{subject:string,text:string,html:string}}
 */
function renderSubscriptionPaused(opts = {}) {
  const { tier = 'pro', resumeDate = null } = opts;
  const tierName = tierDisplayName(tier);
  const resumeStr = fmtDate(resumeDate);

  const subject = 'SimpleBeacon Subscription Paused';
  const text = `Your SimpleBeacon ${tierName} subscription has been paused.\n\nDuring the pause, you will not be billed and your scan features are suspended. Your data and configuration are preserved.\n\nYou can resume your subscription at any time${resumeDate ? ` (no earlier than ${resumeStr})` : ''} by visiting https://simplebeacon.ai/settings/billing`;

  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Subscription Paused</div></td></tr>
    <tr><td class="content">
      <p class="greeting">Your ${tierName} subscription has been paused</p>
      <div class="callout callout-warning">
        <p>During the pause, you will not be billed and your scan features are suspended. Your data and configuration are preserved.</p>
      </div>
      <p class="body-text">You can resume your subscription at any time${resumeDate ? ` (no earlier than <strong>${resumeStr}</strong>)` : ''}.</p>
      <div class="btn-container"><a href="https://simplebeacon.ai/settings/billing" class="btn">Resume Subscription</a></div>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;

  return { subject, text, html: wrapHtml('Subscription Paused', bodyContent) };
}

/**
 * Subscription resumed email — sent when a paused subscription is reactivated.
 * @param {Object} opts
 * @param {string} [opts.tier] - Subscription tier
 * @returns {{subject:string,text:string,html:string}}
 */
function renderSubscriptionResumed(opts = {}) {
  const { tier = 'pro' } = opts;
  const tierName = tierDisplayName(tier);

  const subject = 'SimpleBeacon Subscription Resumed';
  const text = `Your SimpleBeacon ${tierName} subscription has been resumed.\n\nAll features are restored and billing has restarted. Thank you for coming back!`;

  const bodyContent = `
    <tr><td class="header"><h1>SimpleBeacon</h1><div class="tagline">Subscription Resumed</div></td></tr>
    <tr><td class="content">
      <p class="greeting">Your ${tierName} subscription has been resumed</p>
      <div class="callout callout-success">
        <p>All features are restored and billing has restarted. Thank you for coming back!</p>
      </div>
    </td></tr>
    <tr><td class="footer"><p class="brand">SimpleBeacon</p><p>&copy; 2026 SimpleBeacon, Inc.</p></td></tr>`;

  return { subject, text, html: wrapHtml('Subscription Resumed', bodyContent) };
}

module.exports = {
  renderSubscriptionActivated,
  renderSubscriptionCanceled,
  renderSubscriptionReactivated,
  renderPaymentFailed,
  renderTrialEnding,
  renderDisputeAlert,
  renderInvoiceUpcoming,
  renderProrationNotice,
  renderSubscriptionPaused,
  renderSubscriptionResumed
};
