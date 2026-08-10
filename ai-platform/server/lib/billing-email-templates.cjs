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
    /* ---- Reset ---- */
    body { margin:0; padding:0; width:100% !important; background:#0a0f1a; -webkit-font-smoothing:antialiased; -moz-osx-font-smoothing:grayscale; }
    table { border-collapse:collapse; }
    img { border:0; outline:none; text-decoration:none; -ms-interpolation-mode:bicubic; }
    a { text-decoration:none; }
    * { box-sizing:border-box; }

    /* ---- Base ---- */
    .body-bg { background:#0a0f1a; padding:32px 16px; }
    .container { max-width:560px; margin:0 auto; background:#ffffff; border-radius:16px; overflow:hidden; box-shadow:0 8px 32px rgba(0,0,0,0.12); }

    /* ---- Hero ---- */
    .hero { background:linear-gradient(160deg,#0f172a 0%,#134e4a 60%,#0d9488 100%); padding:40px 32px 36px; text-align:center; }
    .hero-badge { display:inline-block; background:rgba(94,234,212,0.12); border:1px solid rgba(94,234,212,0.3); border-radius:100px; padding:5px 14px; font-size:11px; color:#5eead4; letter-spacing:1px; text-transform:uppercase; font-weight:600; margin-bottom:18px; }
    .hero-icon { font-size:36px; margin-bottom:10px; line-height:1; }
    .hero h1 { color:#ffffff; font-size:24px; font-weight:700; margin:0 0 8px; letter-spacing:-0.5px; line-height:1.25; }
    .hero p { color:#94a3b8; font-size:14px; margin:0; line-height:1.5; }

    /* ---- Body sections ---- */
    .section { padding:28px 32px 0; }
    .section:last-of-type { padding-bottom:32px; }
    .section p { color:#334155; font-size:15px; line-height:1.65; margin:0 0 14px; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .section strong { color:#0f172a; font-weight:600; }
    .section a { color:#0d9488; font-weight:500; }
    .section-title { color:#0f172a; font-size:13px; font-weight:700; margin:0 0 16px; text-transform:uppercase; letter-spacing:0.8px; }

    /* ---- Token card ---- */
    .token-card { background:#f0fdfa; border:1px solid #99f6e4; border-radius:12px; padding:18px 20px; margin-bottom:6px; }
    .token-card code { font-family:'SF Mono',SF Mono-Regular,Menlo,Consolas,monospace; font-size:11px; color:#0f766e; word-break:break-all; line-height:1.5; display:block; }
    .token-label { font-size:11px; color:#0d9488; font-weight:700; text-transform:uppercase; letter-spacing:0.8px; margin-bottom:8px; }

    /* ---- Step cards ---- */
    .step-card { background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; padding:18px 20px; margin-bottom:12px; }
    .step-card-header { display:table; width:100%; }
    .step-num-cell { display:table-cell; width:32px; vertical-align:top; }
    .step-num { display:inline-block; background:linear-gradient(135deg,#0d9488,#14b8a6); color:#ffffff; width:26px; height:26px; line-height:26px; text-align:center; border-radius:50%; font-size:13px; font-weight:700; }
    .step-title-cell { display:table-cell; vertical-align:middle; padding-left:12px; }
    .step-title { color:#0f172a; font-size:14px; font-weight:600; margin:0; }
    .step-code { background:#0f172a; border-radius:8px; padding:14px 16px; margin-top:12px; overflow-x:auto; }
    .step-code code { font-family:'SF Mono',SF Mono-Regular,Menlo,Consolas,monospace; font-size:12px; color:#e2e8f0; line-height:1.7; white-space:pre; display:block; }
    .step-code .c { color:#5eead4; }

    /* ---- Terminal block ---- */
    .terminal { background:#0f172a; border-radius:12px; overflow:hidden; margin:16px 0 0; }
    .terminal-bar { background:#1e293b; padding:10px 16px; display:table; width:100%; }
    .terminal-dots { display:table-cell; }
    .terminal-dot { display:inline-block; width:11px; height:11px; border-radius:50%; margin-right:6px; }
    .terminal-title { display:table-cell; text-align:right; color:#64748b; font-size:11px; font-family:'SF Mono',Menlo,Consolas,monospace; }
    .terminal-body { padding:16px 20px; }
    .terminal-body pre { margin:0; font-family:'SF Mono',SF Mono-Regular,Menlo,Consolas,monospace; font-size:12px; line-height:1.8; white-space:pre-wrap; word-break:break-all; }
    .terminal-body .c { color:#5eead4; }
    .terminal-body .cmd { color:#e2e8f0; }
    .terminal-body .out { color:#94a3b8; }

    /* ---- Feature grid ---- */
    .feature-grid { width:100%; }
    .feature-cell { width:50%; padding:10px 6px; vertical-align:top; }
    .feature-item { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:14px 16px; }
    .feature-icon { font-size:18px; margin-bottom:6px; display:block; }
    .feature-name { color:#0f172a; font-size:13px; font-weight:600; margin:0 0 2px; }
    .feature-desc { color:#64748b; font-size:12px; margin:0; line-height:1.4; }

    /* ---- Other ways ---- */
    .ways-table { width:100%; }
    .ways-cell { width:33.33%; padding:0 5px; vertical-align:top; text-align:center; }
    .ways-icon { font-size:24px; margin-bottom:8px; display:block; }
    .ways-label { color:#0f172a; font-size:12px; font-weight:600; margin:0 0 4px; }
    .ways-desc { color:#64748b; font-size:11px; line-height:1.4; margin:0; }

    /* ---- CTA ---- */
    .cta-section { padding:28px 32px; text-align:center; }
    .btn-primary { display:inline-block; background:linear-gradient(135deg,#0d9488,#14b8a6); color:#ffffff !important; text-decoration:none; padding:14px 36px; border-radius:10px; font-size:15px; font-weight:600; letter-spacing:0.2px; box-shadow:0 4px 14px rgba(13,148,136,0.3); }
    .btn-secondary { display:inline-block; background:transparent; color:#0d9488 !important; text-decoration:none; padding:14px 28px; border-radius:10px; font-size:14px; font-weight:600; border:1.5px solid #cbd5e1; margin-left:8px; }

    /* ---- Divider ---- */
    .divider { height:1px; background:#e2e8f0; margin:0 32px; }

    /* ---- Footer ---- */
    .footer { padding:28px 32px; background:#0f172a; text-align:center; }
    .footer-brand { color:#5eead4; font-size:14px; font-weight:600; margin:0 0 6px; letter-spacing:0.3px; }
    .footer-links { margin:10px 0; }
    .footer-links a { color:#64748b; font-size:12px; text-decoration:none; margin:0 8px; }
    .footer-copy { color:#475569; font-size:11px; margin:8px 0 0; line-height:1.5; }

    /* ---- Callouts (for other email types) ---- */
    .callout { border-radius:10px; padding:16px 20px; margin:20px 0; }
    .callout-success { background:#f0fdfa; border-left:3px solid #14b8a6; }
    .callout-warning { background:#fef2f2; border-left:3px solid #f43f5e; }
    .callout-info { background:#f0fdfa; border-left:3px solid #14b8a6; }
    .callout p { margin:0; font-size:14px; }
    .callout-success p { color:#134e4a; }
    .callout-warning p { color:#881337; }
    .callout-info p { color:#134e4a; }

    /* ---- Meta (for other email types) ---- */
    .meta { background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; padding:16px; margin:20px 0; }
    .meta-row { padding:6px 0; font-size:14px; border-bottom:1px solid #f1f5f9; }
    .meta-row:last-child { border-bottom:none; }
    .meta-label { color:#64748b; }
    .meta-value { color:#0f172a; font-weight:500; }

    /* ---- Responsive ---- */
    @media only screen and (max-width:480px) {
      .body-bg { padding:16px 8px; }
      .hero { padding:32px 20px 28px; }
      .hero h1 { font-size:20px; }
      .section { padding:24px 20px 0; }
      .section:last-of-type { padding-bottom:24px; }
      .cta-section { padding:24px 20px; }
      .feature-cell { width:100% !important; padding:6px 0; }
      .ways-cell { width:100% !important; padding:8px 0; }
      .btn-secondary { margin-left:0; margin-top:10px; }
      .divider { margin:0 20px; }
    }
  </style>
`;

function wrapHtml(title, bodyContent) {
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="x-apple-disable-message-reformatting">${BASE_STYLES}</head><body>
  <div class="body-bg">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
  <div class="container">
    ${bodyContent}
  </div>
  </td></tr></table>
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
  const text = `Welcome to SimpleBeacon ${tierName}!\n\nThank you for subscribing to SimpleBeacon ${tierName} ($49/month). Your subscription is now active with unlimited scans.${seatInfo}\n\n--- Your License Token ---\n${licenseToken || '(no token generated yet — contact support)'}\n--------------------------\n\nQUICKSTART (3 steps):\n\n1. Install the CLI:\n   npm install -g simplebeacon\n\n2. Activate your license:\n   export SIMPLEBEACON_LICENSE_TOKEN="${licenseToken || '<your-token>'}"\n   # Or save to file:\n   mkdir -p ~/.simplebeacon\n   echo "${licenseToken || '<your-token>'}" > ~/.simplebeacon/license.jwt\n\n3. Run your first scan:\n   simplebeacon scan --gate\n\nThat's it! You now have unlimited scans, CI/CD gate integration, 38 analyzer modules, PDF reports, and all export formats.\n\nOTHER WAYS TO USE SIMPLEBEACON:\n- VS Code extension: Search "simplebeacon" in the Extensions marketplace\n- Dashboard: https://simplebeacon.ai/dashboard\n- CI/CD: Add simplebeacon scan --gate to your pipeline\n\nYour token expires in 1 year (renewed automatically by your subscription).\nRetrieve it anytime: https://simplebeacon.ai\n\nNeed help? Reply to this email or visit https://simplebeacon.ai`;

  // ---- Build body ----
  let body = '';

  // Hero
  body += `
    <div class="hero">
      <div class="hero-badge">Subscription Active</div>
      <div class="hero-icon">&#9889;</div>
      <h1>Welcome to SimpleBeacon ${tierName}</h1>
      <p>Your ${tierName} plan is live. Let's run your first scan.</p>
    </div>`;

  // Welcome + token
  body += `
    <div class="section">
      <p style="font-size:16px;color:#334155;line-height:1.6;margin:0 0 20px;">You're all set. Your subscription includes <strong>unlimited scans</strong>, <strong>38 analyzer engines</strong>, and <strong>CI/CD gate integration</strong>. Here's everything you need to get started.</p>`;
  if (extraSeats > 0) {
    body += `<p style="font-size:14px;color:#64748b;margin:0 0 20px;">Your Team Pro subscription includes 5 base seats plus <strong style="color:#0f172a;">${extraSeats} extra seat${extraSeats === 1 ? '' : 's'}</strong> (${totalSeats} total).</p>`;
  } else if (tier === 'team_pro') {
    body += `<p style="font-size:14px;color:#64748b;margin:0 0 20px;">Your Team Pro subscription includes 5 seats.</p>`;
  }

  // Token card
  if (licenseToken) {
    body += `
      <p class="section-title">Your License Token</p>
      <div class="token-card">
        <div class="token-label">&#128274; Save this token</div>
        <code>${licenseToken}</code>
      </div>
      <p style="font-size:12px;color:#64748b;margin:10px 0 0;line-height:1.5;">Keep this token safe &mdash; you'll need it to activate the CLI. Retrieve it anytime from your <a href="https://simplebeacon.ai">dashboard</a>.</p>
    </div>`;
  } else {
    body += `</div>`;
  }

  // Quickstart steps
  body += `
    <div class="section">
      <p class="section-title">Quickstart &mdash; 3 Steps to Your First Scan</p>

      <!-- Step 1 -->
      <div class="step-card">
        <div class="step-card-header">
          <div class="step-num-cell"><span class="step-num">1</span></div>
          <div class="step-title-cell"><p class="step-title">Install the CLI</p></div>
        </div>
        <div class="step-code"><code><span class="c"># Install globally via npm</span>
npm install -g simplebeacon</code></div>
      </div>

      <!-- Step 2 -->
      <div class="step-card">
        <div class="step-card-header">
          <div class="step-num-cell"><span class="step-num">2</span></div>
          <div class="step-title-cell"><p class="step-title">Activate your license</p></div>
        </div>
        <div class="step-code"><code><span class="c"># Option A: Set as environment variable</span>
export SIMPLEBEACON_LICENSE_TOKEN="${licenseToken ? licenseToken.substring(0, 45) + '...' : '<your-token>'}"

<span class="c"># Option B: Save to file (recommended)</span>
mkdir -p ~/.simplebeacon
echo "&lt;your-token&gt;" &gt; ~/.simplebeacon/license.jwt</code></div>
      </div>

      <!-- Step 3 -->
      <div class="step-card">
        <div class="step-card-header">
          <div class="step-num-cell"><span class="step-num">3</span></div>
          <div class="step-title-cell"><p class="step-title">Run your first scan</p></div>
        </div>
        <div class="terminal">
          <div class="terminal-bar">
            <div class="terminal-dots">
              <span class="terminal-dot" style="background:#ef4444;"></span><span class="terminal-dot" style="background:#f59e0b;"></span><span class="terminal-dot" style="background:#10b981;"></span>
            </div>
            <div class="terminal-title">Terminal</div>
          </div>
          <div class="terminal-body"><pre><span class="c">$</span> <span class="cmd">simplebeacon scan --gate</span>

<span class="out">SimpleBeacon v1.1.2</span>
<span class="out">52 deterministic engines</span>
<span class="out">Scanning 247 files...</span>
<span class="out">&#10003; Gate: PASS (0 critical, 0 high)</span>
<span class="out">&#10003; Report saved to .simplebeacon/report.json</span></pre></div>
        </div>
      </div>
    </div>`;

  // Divider
  body += `<div class="divider"></div>`;

  // What's included — feature grid
  body += `
    <div class="section">
      <p class="section-title">What's Included in Your ${tierName} Plan</p>
      <table role="presentation" class="feature-grid" cellpadding="0" cellspacing="0">
        <tr>
          <td class="feature-cell">
            <div class="feature-item">
              <span class="feature-icon">&#8734;</span>
              <p class="feature-name">Unlimited Scans</p>
              <p class="feature-desc">No daily or monthly caps</p>
            </div>
          </td>
          <td class="feature-cell">
            <div class="feature-item">
              <span class="feature-icon">&#9881;</span>
              <p class="feature-name">38 Analyzers</p>
              <p class="feature-desc">Security, quality, compliance</p>
            </div>
          </td>
        </tr>
        <tr>
          <td class="feature-cell">
            <div class="feature-item">
              <span class="feature-icon">&#9989;</span>
              <p class="feature-name">CI/CD Gate</p>
              <p class="feature-desc">Block bad code in pipelines</p>
            </div>
          </td>
          <td class="feature-cell">
            <div class="feature-item">
              <span class="feature-icon">&#128196;</span>
              <p class="feature-name">PDF Reports</p>
              <p class="feature-desc">Board-ready audit output</p>
            </div>
          </td>
        </tr>
        <tr>
          <td class="feature-cell">
            <div class="feature-item">
              <span class="feature-icon">&#128230;</span>
              <p class="feature-name">All Export Formats</p>
              <p class="feature-desc">JSON, Markdown, HTML, ZIP</p>
            </div>
          </td>
          <td class="feature-cell">
            <div class="feature-item">
              <span class="feature-icon">&#128274;</span>
              <p class="feature-name">1-Year Token</p>
              <p class="feature-desc">Auto-renewed with subscription</p>
            </div>
          </td>
        </tr>
      </table>
    </div>`;

  // Divider
  body += `<div class="divider"></div>`;

  // Other ways to use — 3-column grid
  body += `
    <div class="section">
      <p class="section-title">Other Ways to Use SimpleBeacon</p>
      <table role="presentation" class="ways-table" cellpadding="0" cellspacing="0">
        <tr>
          <td class="ways-cell">
            <span class="ways-icon">&#128187;</span>
            <p class="ways-label">VS Code</p>
            <p class="ways-desc">Search "simplebeacon" in Extensions</p>
          </td>
          <td class="ways-cell">
            <span class="ways-icon">&#127760;</span>
            <p class="ways-label">Web Dashboard</p>
            <p class="ways-desc">Scan in your browser</p>
          </td>
          <td class="ways-cell">
            <span class="ways-icon">&#9881;</span>
            <p class="ways-label">CI/CD Pipeline</p>
            <p class="ways-desc">GitHub Actions &amp; GitLab CI</p>
          </td>
        </tr>
      </table>
    </div>`;

  // CTA section
  body += `
    <div class="cta-section">
      <a href="https://simplebeacon.ai/dashboard" class="btn-primary">Open Dashboard &rarr;</a>
      <a href="https://simplebeacon.ai/docs" class="btn-secondary">Read Docs</a>
    </div>`;

  // Footer
  body += `
    <div class="footer">
      <p class="footer-brand">SimpleBeacon</p>
      <p style="color:#475569;font-size:12px;margin:0 0 12px;">Continuous security scanning for AI-powered development teams.</p>
      <div class="footer-links">
        <a href="https://simplebeacon.ai">Website</a>
        <a href="https://simplebeacon.ai/docs">Docs</a>
        <a href="https://simplebeacon.ai/dashboard">Dashboard</a>
        <a href="mailto:support@simplebeacon.ai">Support</a>
      </div>
      <p class="footer-copy">&copy; 2026 SimpleBeacon, Inc. &middot; You receive this email because you have a SimpleBeacon account.</p>
    </div>`;

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
