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

const BASE_STYLES = `
  <style>
    body { margin:0; padding:0; background:#f1f5f9; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .container { max-width:600px; margin:0 auto; background:#fff; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,0.08); }
    .header { background:linear-gradient(135deg,#0f172a 0%,#134e4a 100%); padding:28px 32px; }
    .header h1 { color:#fff; font-size:21px; margin:0; font-weight:600; letter-spacing:-0.3px; }
    .header .logo { color:#5eead4; font-size:12px; margin-top:6px; letter-spacing:0.5px; text-transform:uppercase; }
    .body { padding:32px; }
    .body p { color:#334155; font-size:15px; line-height:1.65; margin:0 0 16px; }
    .body strong { color:#0f172a; }
    .body a { color:#0d9488; }
    .callout { border-radius:8px; padding:16px 20px; margin:20px 0; }
    .callout-success { background:#f0fdfa; border-left:3px solid #14b8a6; }
    .callout-warning { background:#fef2f2; border-left:3px solid #f43f5e; }
    .callout-info { background:#f0fdfa; border-left:3px solid #14b8a6; }
    .callout p { margin:0; font-size:14px; }
    .callout-success p { color:#134e4a; }
    .callout-warning p { color:#881337; }
    .callout-info p { color:#134e4a; }
    .btn { display:inline-block; background:#0d9488; color:#fff !important; text-decoration:none; padding:12px 28px; border-radius:8px; font-size:15px; font-weight:600; margin:16px 0; }
    .btn-secondary { background:transparent; color:#0d9488 !important; border:1.5px solid #0d9488; }
    .meta { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:20px 0; }
    .meta-row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px; border-bottom:1px solid #f1f5f9; }
    .meta-row:last-child { border-bottom:none; }
    .meta-label { color:#64748b; }
    .meta-value { color:#0f172a; font-weight:500; }
    .footer { padding:24px 32px; background:#f8fafc; border-top:1px solid #e2e8f0; }
    .footer p { color:#94a3b8; font-size:12px; margin:0; text-align:center; }
    .footer a { color:#64748b; }
    .section-title { color:#0f172a; font-size:16px; font-weight:600; margin:28px 0 12px; }
    .feature-list { list-style:none; padding:0; margin:12px 0; }
    .feature-list li { padding:8px 0; font-size:14px; color:#334155; border-bottom:1px solid #f1f5f9; }
    .feature-list li:last-child { border-bottom:none; }
    .feature-list li strong { color:#0f172a; }
    .code-block { background:#0f172a; border-radius:8px; padding:20px; margin:16px 0; overflow-x:auto; }
    .code-block pre { margin:0; color:#cbd5e1; font-size:13px; line-height:1.75; font-family:'SF Mono',Menlo,Consolas,monospace; white-space:pre-wrap; word-break:break-all; }
    .code-comment { color:#5eead4; }
    .code-cmd { color:#e2e8f0; }
    .token-box { background:#f0fdfa; border:1px solid #99f6e4; border-radius:8px; padding:14px 16px; margin:12px 0; }
    .token-box code { font-family:'SF Mono',Menlo,Consolas,monospace; font-size:11px; color:#0f766e; word-break:break-all; }
    .step-num { display:inline-block; background:#0d9488; color:#fff; width:22px; height:22px; line-height:22px; text-align:center; border-radius:50%; font-size:12px; font-weight:700; margin-right:8px; }
  </style>
`;

function wrapHtml(title, bodyContent) {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${BASE_STYLES}</head><body>
  <div class="container">
    <div class="header">
      <h1>${title}</h1>
      <div class="logo">SimpleBeacon — Continuous Security Scanning</div>
    </div>
    <div class="body">
      ${bodyContent}
    </div>
    <div class="footer">
      <p>SimpleBeacon, Inc. &middot; <a href="https://simplebeacon.ai">simplebeacon.ai</a> &middot; <a href="mailto:support@simplebeacon.ai">support@simplebeacon.ai</a></p>
      <p style="margin-top:8px">You receive this email because you have a SimpleBeacon account.</p>
    </div>
  </div></body></html>`;
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
  const text = `Welcome to SimpleBeacon ${tierName}!\n\nThank you for subscribing to SimpleBeacon ${tierName} ($49/month). Your subscription is now active with unlimited scans.${seatInfo}\n\n--- Your License Token ---\n${licenseToken || '(no token generated yet — contact support)'}\n--------------------------\n\nQUICKSTART (3 steps):\n\n1. Install the CLI:\n   npm install -g simplebeacon\n\n2. Activate your license:\n   export SIMPLEBEACON_LICENSE_TOKEN="${licenseToken || '<your-token>'}"\n   # Or save to file:\n   mkdir -p ~/.simplebeacon\n   echo "${licenseToken || '<your-token>'}" > ~/.simplebeacon/license.jwt\n\n3. Run your first scan:\n   simplebeacon scan --gate\n\nThat's it! You now have unlimited scans, CI/CD gate integration, 38 analyzer modules, PDF reports, and all export formats.\n\nOTHER WAYS TO USE SIMPLEBEACON:\n- VS Code extension: Search "simplebeacon" in the Extensions marketplace\n- Dashboard: https://simplebeacon.ai/dashboard\n- CI/CD: Add simplebeacon scan --gate to your pipeline\n\nYour token expires in 1 year (renewed automatically by your subscription).\nRetrieve it anytime: https://simplebeacon.ai\n\nNeed help? Reply to this email or visit https://simplebeacon.ai`;

  let bodyContent = `
    <p>Welcome to SimpleBeacon <strong>${tierName}</strong>! Your subscription is now active.</p>`;
  if (extraSeats > 0) {
    bodyContent += `<p>Your Team Pro subscription includes 5 base seats plus <strong>${extraSeats} extra seat${extraSeats === 1 ? '' : 's'}</strong> (${totalSeats} total).</p>`;
  } else if (tier === 'team_pro') {
    bodyContent += `<p>Your Team Pro subscription includes 5 seats.</p>`;
  }

  // License token box
  if (licenseToken) {
    bodyContent += `
    <div style="margin:24px 0;">
      <p style="font-size:13px;color:#64748b;margin:0 0 8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Your License Token</p>
      <div class="token-box">
        <code>${licenseToken}</code>
      </div>
      <p style="font-size:13px;color:#64748b;margin:8px 0 0;">Keep this token safe. Retrieve it anytime from your <a href="https://simplebeacon.ai">dashboard</a>.</p>
    </div>`;
  }

  // Quickstart section
  bodyContent += `
    <p class="section-title">Quickstart — 3 steps to your first scan</p>
    <div class="code-block"><pre><span class="code-comment"># 1. Install the CLI</span>
<span class="code-cmd">npm install -g simplebeacon</span>

<span class="code-comment"># 2. Activate your license</span>
<span class="code-cmd">export SIMPLEBEACON_LICENSE_TOKEN="${licenseToken ? licenseToken.substring(0, 50) + '...' : '<your-token>'}"</span>

<span class="code-comment"># Or save to file (recommended)</span>
<span class="code-cmd">mkdir -p ~/.simplebeacon
echo "&lt;token&gt;" &gt; ~/.simplebeacon/license.jwt</span>

<span class="code-comment"># 3. Run your first scan</span>
<span class="code-cmd">simplebeacon scan --gate</span></pre></div>`;

  // What's included
  bodyContent += `
    <p class="section-title">What's included</p>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Scans</span><span class="meta-value">Unlimited</span></div>
      <div class="meta-row"><span class="meta-label">Analyzer modules</span><span class="meta-value">38 engines</span></div>
      <div class="meta-row"><span class="meta-label">CI/CD gate</span><span class="meta-value">Included</span></div>
      <div class="meta-row"><span class="meta-label">PDF reports</span><span class="meta-value">Included</span></div>
      <div class="meta-row"><span class="meta-label">Export formats</span><span class="meta-value">All formats</span></div>
      <div class="meta-row"><span class="meta-label">Token expires</span><span class="meta-value">1 year (auto-renewed)</span></div>
    </div>`;

  // Other ways to use — clean list, not heavy callout boxes
  bodyContent += `
    <p class="section-title">Other ways to use SimpleBeacon</p>
    <ul class="feature-list">
      <li><strong>VS Code Extension</strong> — Search "simplebeacon" in the Extensions marketplace</li>
      <li><strong>Web Dashboard</strong> — Run scans in your browser at <a href="https://simplebeacon.ai/dashboard">simplebeacon.ai/dashboard</a></li>
      <li><strong>CI/CD Pipeline</strong> — Add <code style="background:#f1f5f9;padding:2px 6px;border-radius:4px;font-size:13px;">simplebeacon scan --gate</code> to your GitHub Actions or GitLab CI</li>
    </ul>`;

  // CTA buttons
  bodyContent += `
    <p style="margin-top:28px;">
      <a href="https://simplebeacon.ai/dashboard" class="btn">Open Dashboard</a>
      <a href="https://simplebeacon.ai/docs" class="btn btn-secondary" style="margin-left:8px;">Read Docs</a>
    </p>`;

  return { subject, text, html: wrapHtml(`Welcome to SimpleBeacon ${tierName}`, bodyContent) };
}

/**
 * Subscription canceled email.
 * @returns {{subject:string,text:string,html:string}}
 */
function renderSubscriptionCanceled() {
  const subject = 'SimpleBeacon Subscription Canceled';
  const text = `Your SimpleBeacon subscription has been canceled.\n\nYou will retain access until the end of your current billing period. After that, your account will revert to the free tier.\n\nWe hope to see you again soon.`;
  const bodyContent = `
    <p>Your SimpleBeacon subscription has been canceled.</p>
    <div class="callout callout-info">
      <p>You will retain access until the end of your current billing period. After that, your account will revert to the free tier.</p>
    </div>
    <p>We hope to see you again soon. <a href="https://simplebeacon.ai/settings/billing">Reactivate anytime</a>.</p>`;
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
    <p>Your SimpleBeacon subscription has been reactivated following successful payment.</p>
    <div class="callout callout-success">
      <p>All features are restored. Thank you for your continued subscription.</p>
    </div>`;
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
    <p>A payment for your SimpleBeacon subscription failed <strong>(attempt ${attemptCount})</strong>.</p>
    <div class="callout callout-warning">
      <p>${retryLine}</p>
    </div>
    <p>Please update your payment method to avoid service interruption.</p>
    <a href="https://simplebeacon.ai/settings/billing" class="btn">Update Payment Method</a>
    <p>If you believe this is an error, please contact <a href="mailto:support@simplebeacon.ai">support@simplebeacon.ai</a>.</p>`;

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
    <p>Your SimpleBeacon trial will end on <strong>${trialEndDate}</strong>.</p>
    <div class="callout callout-info">
      <p>To continue using all features without interruption, please add a payment method.</p>
    </div>
    <a href="https://simplebeacon.ai/settings/billing" class="btn">Add Payment Method</a>
    <p>If you do not add a payment method, your account will revert to the free tier after the trial ends.</p>`;

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
    <p>A charge dispute has been filed.</p>
    <div class="meta">
      <div class="meta-row"><span class="meta-label">Charge ID</span><span class="meta-value">${chargeId}</span></div>
      <div class="meta-row"><span class="meta-label">Reason</span><span class="meta-value">${reason}</span></div>
      <div class="meta-row"><span class="meta-label">Amount</span><span class="meta-value">${amount} ${cur}</span></div>
      <div class="meta-row"><span class="meta-label">Status</span><span class="meta-value">${status}</span></div>
    </div>
    <div class="callout callout-warning">
      <p><strong>Action required:</strong> Submit evidence in the Stripe Dashboard within 7 days to avoid automatic loss.</p>
    </div>
    <a href="https://dashboard.stripe.com/disputes" class="btn">Open Stripe Dashboard</a>`;

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
    <p>Your SimpleBeacon <strong>${tier}</strong> subscription payment of <strong>$${amount} ${cur}</strong> will be charged on <strong>${dueDateStr}</strong>.</p>
    ${invoiceNumber ? `<div class="meta"><div class="meta-row"><span class="meta-label">Invoice</span><span class="meta-value">${invoiceNumber}</span></div></div>` : ''}
    <div class="callout callout-info">
      <p>This is an automated reminder — no action is needed if your payment method is up to date.</p>
    </div>
    <a href="https://simplebeacon.ai/settings/billing" class="btn">Review Payment Method</a>`;

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
    <p>Your SimpleBeacon subscription has been <strong>${action}</strong> from <strong>${fromName}</strong> to <strong>${toName}</strong>.</p>
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
    <a href="https://simplebeacon.ai/settings/billing" class="btn">Review Subscription</a>`;

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
    <p>Your SimpleBeacon <strong>${tierName}</strong> subscription has been paused.</p>
    <div class="callout callout-warning">
      <p>During the pause, you will not be billed and your scan features are suspended. Your data and configuration are preserved.</p>
    </div>
    <p>You can resume your subscription at any time${resumeDate ? ` (no earlier than <strong>${resumeStr}</strong>)` : ''}.</p>
    <a href="https://simplebeacon.ai/settings/billing" class="btn">Resume Subscription</a>`;

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
    <p>Your SimpleBeacon <strong>${tierName}</strong> subscription has been resumed.</p>
    <div class="callout callout-success">
      <p>All features are restored and billing has restarted. Thank you for coming back!</p>
    </div>`;

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
