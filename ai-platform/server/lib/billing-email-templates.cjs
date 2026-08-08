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
    body { margin:0; padding:0; background:#f4f5f7; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif; }
    .container { max-width:600px; margin:0 auto; background:#fff; border-radius:8px; overflow:hidden; }
    .header { background:linear-gradient(135deg,#1e293b 0%,#334155 100%); padding:24px 32px; }
    .header h1 { color:#fff; font-size:20px; margin:0; font-weight:600; }
    .header .logo { color:#94a3b8; font-size:13px; margin-top:4px; }
    .body { padding:32px; }
    .body p { color:#374151; font-size:15px; line-height:1.6; margin:0 0 16px; }
    .body strong { color:#111827; }
    .callout { border-radius:8px; padding:16px 20px; margin:20px 0; }
    .callout-success { background:#ecfdf5; border-left:4px solid #10b981; }
    .callout-warning { background:#fef2f2; border-left:4px solid #ef4444; }
    .callout-info { background:#eff6ff; border-left:4px solid #3b82f6; }
    .callout p { margin:0; font-size:14px; }
    .callout-success p { color:#065f46; }
    .callout-warning p { color:#991b1b; }
    .callout-info p { color:#1e40af; }
    .btn { display:inline-block; background:#3b82f6; color:#fff !important; text-decoration:none; padding:12px 28px; border-radius:6px; font-size:15px; font-weight:600; margin:16px 0; }
    .meta { background:#f9fafb; border-radius:6px; padding:16px; margin:20px 0; }
    .meta-row { display:flex; justify-content:space-between; padding:4px 0; font-size:14px; }
    .meta-label { color:#6b7280; }
    .meta-value { color:#111827; font-weight:500; }
    .footer { padding:24px 32px; background:#f9fafb; }
    .footer p { color:#9ca3af; font-size:12px; margin:0; text-align:center; }
    .footer a { color:#6b7280; }
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

/**
 * Subscription activated email.
 * @param {Object} opts
 * @param {string} opts.tier - Subscription tier
 * @param {string} [opts.licenseToken] - License token (optional)
 * @param {number} [opts.totalSeats] - Total seats for team plans
 * @param {number} [opts.extraSeats] - Extra seats purchased
 * @returns {{subject:string,text:string,html:string}}
 */
function renderSubscriptionActivated(opts = {}) {
  const { tier = 'pro', licenseToken, totalSeats, extraSeats } = opts;
  const seatInfo = extraSeats > 0
    ? `\n\nYour Team Pro subscription includes 5 base seats plus ${extraSeats} extra seat${extraSeats === 1 ? '' : 's'} (${totalSeats} total).`
    : (tier === 'team_pro' ? '\n\nYour Team Pro subscription includes 5 seats.' : '');

  const subject = 'SimpleBeacon Subscription Activated';
  const text = `Your SimpleBeacon ${tier} subscription is now active.\n\nYou can start using all ${tier} tier features immediately.${seatInfo}\n\nThank you for your purchase.${licenseToken ? `\n\n--- Your License Key ---\n${licenseToken}\n------------------------\n\nKeep this key safe. You can use it to activate SimpleBeacon in your editor or CLI.\n\nYou can also retrieve it anytime from your dashboard: https://simplebeacon.ai` : ''}`;

  let bodyContent = `
    <p>Your SimpleBeacon <strong>${tier}</strong> subscription is now active.</p>
    <p>You can start using all ${tier} tier features immediately.</p>`;
  if (extraSeats > 0) {
    bodyContent += `<p>Your Team Pro subscription includes 5 base seats plus <strong>${extraSeats} extra seat${extraSeats === 1 ? '' : 's'}</strong> (${totalSeats} total).</p>`;
  } else if (tier === 'team_pro') {
    bodyContent += `<p>Your Team Pro subscription includes 5 seats.</p>`;
  }
  if (licenseToken) {
    bodyContent += `
    <div class="callout callout-info">
      <p><strong>Your License Key</strong></p>
      <p style="font-family:monospace;font-size:12px;word-break:break-all;margin-top:8px">${licenseToken}</p>
      <p style="margin-top:8px">Keep this key safe. You can use it to activate SimpleBeacon in your editor or CLI.<br>You can also retrieve it anytime from your <a href="https://simplebeacon.ai">dashboard</a>.</p>
    </div>`;
  }
  bodyContent += `<p>Thank you for your purchase.</p>`;

  return { subject, text, html: wrapHtml('Subscription Activated', bodyContent) };
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

module.exports = {
  renderSubscriptionActivated,
  renderSubscriptionCanceled,
  renderSubscriptionReactivated,
  renderPaymentFailed,
  renderTrialEnding,
  renderDisputeAlert
};
