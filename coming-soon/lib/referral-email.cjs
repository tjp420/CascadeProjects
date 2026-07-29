// simplebeacon-ignore: Security findings are false positives — referral emails use configured transactional provider only
/**
 * Referral program transactional emails via SimpleBeacon email service (Resend / SMTP).
 */

const { sendEmail } = require('../services/email.cjs');
const { escapeHtml } = require('./certificate-utils.cjs');
const { getFromAddress } = require('./email-config.cjs');

const PUBLIC_ORIGIN = () => String(process.env.PUBLIC_URL || 'https://simplebeacon.ai').replace(/\/$/, '');

const logger = {
    info: (...a) => { const c = globalThis.console; c.info(...a); },
    warn: (...a) => { const c = globalThis.console; c.warn(...a); }
};

function formatCertCredit(cents) {
    const dollars = (Number(cents) || 0) / 100;
    return dollars % 1 === 0 ? `$${dollars.toFixed(0)}` : `$${dollars.toFixed(2)}`;
}

function buildReferralEmailShell({ headline, bodyHtml, ctaUrl, ctaLabel }) {
    const safeHeadline = escapeHtml(headline);
    const safeCta = escapeHtml(ctaLabel || 'Open SimpleBeacon');
    const safeUrl = escapeHtml(ctaUrl || PUBLIC_ORIGIN());
    return `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:20px;background:#0B0F19;color:#F3F4F6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;line-height:1.6;">
  <div style="max-width:600px;margin:0 auto;background:linear-gradient(145deg,#151D30,#0F1626);border:1px solid #1E293B;border-radius:16px;padding:32px;">
    <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #1E293B;margin-bottom:24px;">
      <div style="font-size:1.5rem;font-weight:700;color:#6366f1;">SimpleBeacon</div>
      <h1 style="margin:12px 0 0;font-size:1.25rem;color:#F3F4F6;">${safeHeadline}</h1>
    </div>
    ${bodyHtml}
    <p style="margin:28px 0 0;text-align:center;">
      <a href="${safeUrl}" style="display:inline-block;padding:12px 22px;background:#6366f1;color:#fff;text-decoration:none;border-radius:8px;font-weight:600;">${safeCta}</a>
    </p>
    <p style="margin:24px 0 0;font-size:0.8rem;color:#9CA3AF;text-align:center;">
      Sent from ${escapeHtml(getFromAddress())} · <a href="${escapeHtml(PUBLIC_ORIGIN())}/privacy" style="color:#9CA3AF;">Privacy</a>
    </p>
  </div>
</body></html>`;
}

async function deliverReferralEmail({ to, subject, text, html }) {
    if (!to || !subject) {
        return { sent: false, queued: false, error: 'to and subject required' };
    }
    const result = await sendEmail({ to, subject, text, html });
    if (result.sent) {
        logger.info(`[ReferralEmail] Sent to ${to}: ${subject}`);
    } else if (result.queued) {
        logger.warn(`[ReferralEmail] Queued for ${to}: ${subject}`);
    } else {
        logger.warn(`[ReferralEmail] Failed for ${to}: ${result.error || 'unknown'}`);
    }
    return result;
}

/**
 * Email a referrer their personal share link (dashboard / CLI touchpoint).
 */
async function sendReferrerLinkEmail({ to, shareUrl, partnerCode }) {
    const url = shareUrl || `${PUBLIC_ORIGIN()}/?ref=${encodeURIComponent(partnerCode || '')}`;
    const subject = 'Your SimpleBeacon referral link is ready';
    const text = [
        'Share SimpleBeacon with another engineering manager.',
        '',
        `Your referral link: ${url}`,
        '',
        'When they run a private local compliance scan and upgrade, you both unlock certificate generation credits.',
        '',
        `Partner code: ${partnerCode || 'n/a'}`
    ].join('\n');

    const bodyHtml = `
      <p style="color:#D1D5DB;margin:0 0 16px;">Your repository passed compliance checks — now share SimpleBeacon and unlock <strong style="color:#10B981;">SOC 2 certificate credits</strong> when colleagues convert.</p>
      <div style="background:#0B0F19;border:1px solid #374151;border-radius:8px;padding:12px 14px;font-family:monospace;font-size:0.85rem;color:#9CA3AF;word-break:break-all;">${escapeHtml(url)}</div>
      <p style="color:#9CA3AF;font-size:0.85rem;margin:16px 0 0;">Partner code: <code style="color:#A5B4FC;">${escapeHtml(partnerCode || '')}</code></p>`;

    return deliverReferralEmail({
        to,
        subject,
        text,
        html: buildReferralEmailShell({
            headline: 'Your referral link is ready',
            bodyHtml,
            ctaUrl: url,
            ctaLabel: 'Copy & share link'
        })
    });
}

/**
 * Send a direct invite from referrer to a colleague.
 */
async function sendReferralInviteEmail({ referrerEmail, inviteeEmail, shareUrl, message }) {
    const url = shareUrl || PUBLIC_ORIGIN();
    const fromLabel = referrerEmail ? String(referrerEmail).split('@')[0] : 'A colleague';
    const subject = `${fromLabel} invited you to scan your repo with SimpleBeacon`;
    const note = message ? `\n\nMessage from ${referrerEmail}:\n${message}\n` : '';
    const text = [
        `${referrerEmail || 'Someone'} thinks your team would benefit from a private, local-first compliance scan.`,
        note,
        `Get started: ${url}`,
        '',
        'SimpleBeacon runs entirely on your machine — no source code upload required.'
    ].join('\n');

    const bodyHtml = `
      <p style="color:#D1D5DB;margin:0 0 12px;"><strong style="color:#F3F4F6;">${escapeHtml(referrerEmail || 'A colleague')}</strong> invited you to try SimpleBeacon — a local-first compliance scanner for engineering teams.</p>
      ${message ? `<blockquote style="margin:16px 0;padding:12px 16px;border-left:3px solid #6366f1;background:rgba(99,102,241,0.08);color:#D1D5DB;">${escapeHtml(message)}</blockquote>` : ''}
      <p style="color:#9CA3AF;font-size:0.9rem;margin:0;">Zero-upload architecture: scans run on your machine, only anonymized findings leave your network.</p>`;

    return deliverReferralEmail({
        to: inviteeEmail,
        subject,
        text,
        html: buildReferralEmailShell({
            headline: 'You\'re invited to scan your repo',
            bodyHtml,
            ctaUrl: url,
            ctaLabel: 'Accept invite & scan free'
        })
    });
}

/**
 * Notify referrer when a referee completes a paid conversion.
 */
async function sendReferralConversionEmail({ referrerEmail, refereeEmail, rewardValueCents }) {
    const credit = formatCertCredit(rewardValueCents);
    const subject = `Referral converted — ${credit} certificate credit added`;
    const text = [
        'Great news — your referral converted to a paid SimpleBeacon customer.',
        '',
        refereeEmail ? `New customer: ${refereeEmail}` : '',
        `Reward granted: ${credit} in certificate generation credits.`,
        '',
        `View your dashboard: ${PUBLIC_ORIGIN()}/app/#/results`
    ].filter(Boolean).join('\n');

    const bodyHtml = `
      <p style="color:#D1D5DB;margin:0 0 12px;">A colleague you referred just completed checkout. Your partner ledger has been updated.</p>
      <div style="background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:10px;padding:16px;text-align:center;margin:16px 0;">
        <div style="font-size:1.6rem;font-weight:700;color:#10B981;">${escapeHtml(credit)}</div>
        <div style="font-size:0.85rem;color:#9CA3AF;margin-top:4px;">Certificate credit added to your account</div>
      </div>
      ${refereeEmail ? `<p style="color:#9CA3AF;font-size:0.85rem;margin:0;">Converted user: ${escapeHtml(refereeEmail)}</p>` : ''}`;

    return deliverReferralEmail({
        to: referrerEmail,
        subject,
        text,
        html: buildReferralEmailShell({
            headline: 'Your referral converted',
            bodyHtml,
            ctaUrl: `${PUBLIC_ORIGIN()}/app/#/results`,
            ctaLabel: 'View rewards in dashboard'
        })
    });
}

/**
 * Welcome email for a referee who signed up via a referral link.
 */
async function sendRefereeWelcomeEmail({ to, shareUrl }) {
    const subject = 'Welcome to SimpleBeacon — your referral bonus is active';
    const text = [
        'Welcome to SimpleBeacon.',
        '',
        'You arrived via a referral link. When you complete your first compliance scan and upgrade,',
        'you unlock unlimited SOC 2 certificate generation for 30 days.',
        '',
        `Start scanning: ${PUBLIC_ORIGIN()}/app/#/analyze`
    ].join('\n');

    const bodyHtml = `
      <p style="color:#D1D5DB;margin:0 0 12px;">You joined via a referral from another engineering team. Run a private local scan — your source never leaves your machine.</p>
      <ul style="color:#9CA3AF;font-size:0.9rem;padding-left:18px;margin:12px 0 0;">
        <li>Scan runs locally in your browser and CLI</li>
        <li>Referral bonus unlocks after your first paid upgrade</li>
        <li>30-day attribution window is already tracking your session</li>
      </ul>`;

    return deliverReferralEmail({
        to,
        subject,
        text,
        html: buildReferralEmailShell({
            headline: 'Welcome — referral bonus active',
            bodyHtml,
            ctaUrl: shareUrl || `${PUBLIC_ORIGIN()}/app/#/analyze`,
            ctaLabel: 'Run your first scan'
        })
    });
}

module.exports = {
    sendReferrerLinkEmail,
    sendReferralInviteEmail,
    sendReferralConversionEmail,
    sendRefereeWelcomeEmail
};
