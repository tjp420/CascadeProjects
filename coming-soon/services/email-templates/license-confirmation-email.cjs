'use strict';
/**
 * License confirmation email template — premium dark theme with gold accents.
 *
 * Design principles (from luxury brand email research):
 *   - Deep black/navy background with gold accents = sophisticated, premium mood
 *   - Generous whitespace signals value (sparse = exclusive, dense = promotional)
 *   - Typography-led design — oversized headlines carry the visual weight
 *   - One action per section — editorial, not advertising
 *   - High-contrast gold CTA buttons against dark background
 *   - Receipt as trust document — clear payment confirmation
 *
 * Usage:
 *   const { renderLicenseConfirmation } = require('./email-templates/license-confirmation-email.cjs');
 *   const { subject, text, html } = renderLicenseConfirmation({
 *       tierLabel, token, apiKey, ttlLabel, customerEmail, features, dashboardUrl, signInUrl
 *   });
 */

function escapeHtml(s) {
    return String(s || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function renderLicenseConfirmation(opts) {
    const {
        tierLabel = 'SimpleBeacon',
        token = '',
        apiKey = '',
        ttlLabel = '30 days',
        customerEmail = '',
        features = [],
        dashboardUrl = 'https://simplebeacon.ai/dashboard/',
        signInUrl = 'https://simplebeacon.ai/dashboard/#/signin'
    } = opts;

    // Pre-fill links with token + email so the user doesn't need to copy-paste.
    // Use path-based URLs (not hash-based) because many email clients strip # fragments.
    const tokenEncoded = encodeURIComponent(token);
    const emailEncoded = encodeURIComponent(customerEmail);
    const nameEncoded = encodeURIComponent(customerEmail.split('@')[0]);
    // Strip any trailing #/signin from signInUrl and use path-based routing instead
    const signInBase = signInUrl.replace(/\/#\/signin\/?$/, '/signin').replace(/\/#\/signin$/, '/signin');
    const activateUrl = signInBase + (signInBase.includes('?') ? '&' : '?') + 'mode=license&token=' + tokenEncoded;
    const registerUrl =
        signInBase +
        (signInBase.includes('?') ? '&' : '?') +
        'mode=register&email=' +
        emailEncoded +
        '&name=' +
        nameEncoded;
    const loginUrl = signInBase + (signInBase.includes('?') ? '&' : '?') + 'mode=signin&email=' + emailEncoded;
    const dashboardWithToken = dashboardUrl + (dashboardUrl.includes('?') ? '&' : '?') + 'token=' + tokenEncoded;

    const featuresHtml = features
        .map(
            f =>
                '<li style="padding:8px 0 8px 28px;font-size:0.88rem;color:#c4b5fd;position:relative;"><span style="position:absolute;left:0;top:11px;color:#fbbf24;">&#10003;</span>' +
                escapeHtml(f) +
                '</li>'
        )
        .join('');
    const featuresBlock =
        features.length > 0
            ? '<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(251,191,36,0.15);border-radius:12px;padding:24px;margin-bottom:24px;"><div style="font-size:0.7rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#fbbf24;margin-bottom:16px;">Included in your plan</div><ul style="list-style:none;padding:0;margin:0;">' +
              featuresHtml +
              '</ul></div>'
            : '';

    const subject = 'Your ' + tierLabel + ' License Token — Activate in 30 seconds';
    const text =
        'Welcome to ' +
        tierLabel +
        '!\n\n' +
        'Your subscription is active. Choose an option to get started:\n\n' +
        'OPTION 1: Activate your license (instant, no password)\n' +
        activateUrl +
        '\n\n' +
        'OPTION 2: Create an account (email pre-filled)\n' +
        registerUrl +
        '\n\n' +
        'OPTION 3: Sign in to an existing account\n' +
        loginUrl +
        '\n\n' +
        'License Token: ' +
        token +
        '\n' +
        'Valid for: ' +
        ttlLabel +
        '\n\n' +
        'STEP 2: Install the CLI (1 minute)\n' +
        '  npx --yes simplebeacon init --starter\n\n' +
        'STEP 3: Run your first scan (30 seconds)\n' +
        '  npx simplebeacon scan --gate --offline\n\n' +
        'API Key (for CI/CD): ' +
        apiKey +
        '\n' +
        'Dashboard: ' +
        dashboardWithToken +
        '\n\n' +
        'Questions? Reply to this email or contact admin@simplebeacon.ai';

    const html = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif;background:#0a0a0f;color:#e5e7eb;line-height:1.7;-webkit-font-smoothing:antialiased;">

<!-- Outer wrapper -->
<div style="max-width:600px;margin:0 auto;padding:0;">

<!-- Top accent line -->
<div style="height:3px;background:linear-gradient(90deg,#fbbf24 0%,#f59e0b 50%,#d97706 100%);"></div>

<!-- Hero section -->
<div style="background:linear-gradient(180deg,#0a0a0f 0%,#13131f 100%);padding:56px 40px 48px;text-align:center;">
<div style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.2em;color:#fbbf24;margin-bottom:20px;">Payment Confirmed</div>
<h1 style="color:#ffffff;font-size:2rem;font-weight:700;letter-spacing:-0.03em;margin:0 0 12px;line-height:1.2;">Welcome to<br/>${escapeHtml(tierLabel)}</h1>
<p style="color:#9ca3af;font-size:0.95rem;font-weight:400;margin:0;max-width:420px;margin-left:auto;margin-right:auto;">Your subscription is active. Let's get you set up in the next 60 seconds.</p>
</div>

<!-- Body -->
<div style="background:#13131f;padding:40px 40px 32px;">

<!-- Receipt card -->
<div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:24px;margin-bottom:32px;">
<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
<span style="font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:0.1em;color:#6b7280;">Order Receipt</span>
<span style="font-size:0.7rem;color:#fbbf24;font-weight:600;">&#10003; PAID</span>
</div>
<div style="border-top:1px solid rgba(255,255,255,0.06);padding-top:16px;">
<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:0.85rem;color:#9ca3af;">Plan</span><span style="font-size:0.85rem;color:#ffffff;font-weight:600;">${escapeHtml(tierLabel)}</span></div>
<div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:0.85rem;color:#9ca3af;">License validity</span><span style="font-size:0.85rem;color:#ffffff;font-weight:600;">${escapeHtml(ttlLabel)}</span></div>
<div style="display:flex;justify-content:space-between;"><span style="font-size:0.85rem;color:#9ca3af;">Customer</span><span style="font-size:0.85rem;color:#ffffff;font-weight:600;">${escapeHtml(customerEmail)}</span></div>
</div>
</div>

<!-- Primary CTA -->
<div style="text-align:center;margin-bottom:12px;">
<a href="${escapeHtml(activateUrl)}" style="display:inline-block;background:linear-gradient(135deg,#fbbf24 0%,#f59e0b 100%);color:#0a0a0f;text-decoration:none;padding:18px 44px;border-radius:10px;font-weight:700;font-size:1.05rem;letter-spacing:0.01em;box-shadow:0 4px 20px rgba(251,191,36,0.25);">&#9889; Activate My License</a>
</div>
<div style="text-align:center;margin-bottom:32px;">
<span style="font-size:0.8rem;color:#6b7280;">Instant access — your token is pre-filled, no password needed</span>
</div>

<!-- Secondary actions -->
<div style="text-align:center;margin-bottom:32px;">
<a href="${escapeHtml(registerUrl)}" style="display:inline-block;background:transparent;color:#fbbf24;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:0.9rem;border:1px solid rgba(251,191,36,0.3);margin:0 4px 8px;">Create Account</a>
<a href="${escapeHtml(loginUrl)}" style="display:inline-block;background:transparent;color:#9ca3af;text-decoration:none;padding:12px 28px;border-radius:8px;font-weight:600;font-size:0.9rem;border:1px solid rgba(255,255,255,0.1);margin:0 4px 8px;">Sign In</a>
</div>

<!-- Divider -->
<div style="border-top:1px solid rgba(255,255,255,0.06);margin:8px 0 32px;"></div>

<!-- License token card -->
<div style="background:rgba(251,191,36,0.04);border:1px solid rgba(251,191,36,0.12);border-radius:12px;padding:24px;margin-bottom:24px;">
<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#fbbf24;margin-bottom:12px;">Your License Token</div>
<div style="font-family:'SF Mono',Monaco,'Cascadia Code','Fira Code',monospace;font-size:0.78rem;color:#fde68a;background:rgba(0,0,0,0.3);padding:14px 18px;border-radius:8px;border:1px solid rgba(251,191,36,0.08);word-break:break-all;line-height:1.6;">${escapeHtml(token)}</div>
<div style="margin-top:12px;font-size:0.78rem;color:#6b7280;">Valid for <strong style="color:#fbbf24;">${escapeHtml(ttlLabel)}</strong></div>
</div>

<!-- API key card -->
<div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:12px;padding:20px;margin-bottom:32px;">
<div style="font-size:0.65rem;font-weight:700;text-transform:uppercase;letter-spacing:0.12em;color:#6b7280;margin-bottom:10px;">API Key <span style="font-weight:400;text-transform:none;">(for CI/CD)</span></div>
<div style="font-family:'SF Mono',Monaco,'Cascadia Code','Fira Code',monospace;font-size:0.78rem;color:#d1d5db;background:rgba(0,0,0,0.3);padding:12px 16px;border-radius:8px;word-break:break-all;">${escapeHtml(apiKey)}</div>
</div>

<!-- Step-by-step guide -->
<div style="margin-bottom:32px;">
<h2 style="font-size:0.75rem;font-weight:700;text-transform:uppercase;letter-spacing:0.15em;color:#fbbf24;margin:0 0 24px;">Getting Started Guide</h2>

<!-- Step 1 -->
<div style="display:flex;gap:16px;margin-bottom:24px;">
<div style="flex-shrink:0;width:28px;height:28px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0a0a0f;font-weight:700;font-size:0.8rem;">1</div>
<div style="flex:1;">
<h3 style="font-size:0.92rem;font-weight:600;color:#ffffff;margin:0 0 6px;">Activate your license</h3>
<p style="font-size:0.85rem;color:#9ca3af;margin:0 0 8px;">Click <strong style="color:#fbbf24;">Activate My License</strong> above. Your token is pre-filled — you'll land directly in your dashboard. No password needed.</p>
<a href="${escapeHtml(activateUrl)}" style="color:#fbbf24;text-decoration:none;font-size:0.82rem;font-weight:600;">Open dashboard &rarr;</a>
</div>
</div>

<!-- Step 2 -->
<div style="display:flex;gap:16px;margin-bottom:24px;">
<div style="flex-shrink:0;width:28px;height:28px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0a0a0f;font-weight:700;font-size:0.8rem;">2</div>
<div style="flex:1;">
<h3 style="font-size:0.92rem;font-weight:600;color:#ffffff;margin:0 0 8px;">Install the CLI</h3>
<div style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px;margin-bottom:8px;">
<code style="color:#fde68a;font-family:'SF Mono',Monaco,monospace;font-size:0.8rem;">npx --yes simplebeacon init --starter</code>
</div>
<p style="font-size:0.78rem;color:#6b7280;margin:0;">Or: <code style="color:#9ca3af;font-size:0.78rem;">npm install -D simplebeacon</code></p>
</div>
</div>

<!-- Step 3 -->
<div style="display:flex;gap:16px;margin-bottom:24px;">
<div style="flex-shrink:0;width:28px;height:28px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0a0a0f;font-weight:700;font-size:0.8rem;">3</div>
<div style="flex:1;">
<h3 style="font-size:0.92rem;font-weight:600;color:#ffffff;margin:0 0 8px;">Run your first scan</h3>
<div style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px;margin-bottom:8px;">
<code style="color:#fde68a;font-family:'SF Mono',Monaco,monospace;font-size:0.8rem;">npx simplebeacon scan --gate --offline</code>
</div>
<p style="font-size:0.78rem;color:#6b7280;margin:0;">Full compliance: <code style="color:#9ca3af;font-size:0.78rem;">npx simplebeacon scan --complete --gate --offline</code></p>
</div>
</div>

<!-- Step 4 -->
<div style="display:flex;gap:16px;margin-bottom:8px;">
<div style="flex-shrink:0;width:28px;height:28px;background:linear-gradient(135deg,#fbbf24,#f59e0b);border-radius:50%;display:flex;align-items:center;justify-content:center;color:#0a0a0f;font-weight:700;font-size:0.8rem;">4</div>
<div style="flex:1;">
<h3 style="font-size:0.92rem;font-weight:600;color:#ffffff;margin:0 0 8px;">Add CI/CD integration</h3>
<div style="background:#0a0a0f;border:1px solid rgba(255,255,255,0.06);border-radius:8px;padding:14px 16px;">
<code style="color:#fde68a;font-family:'SF Mono',Monaco,monospace;font-size:0.75rem;">env:<br>&nbsp;&nbsp;SIMPLEBEACON_API_KEY: \${{ secrets.SIMPLEBEACON_API_KEY }}<br>run: npx simplebeacon scan --gate --format json</code>
</div>
</div>
</div>
</div>

${featuresBlock}

<!-- Privacy note -->
<div style="background:rgba(251,191,36,0.04);border-left:3px solid #fbbf24;border-radius:0 8px 8px 0;padding:16px 20px;margin-bottom:32px;">
<div style="font-size:0.85rem;color:#d1d5db;line-height:1.6;"><strong style="color:#fbbf24;">Privacy-first.</strong> Your code never leaves your machine. All scanning runs locally — no cloud upload, no LLM calls, no false positives.</div>
</div>

<!-- Support -->
<div style="text-align:center;margin-bottom:8px;">
<span style="font-size:0.85rem;color:#9ca3af;">Questions? </span>
<a href="mailto:admin@simplebeacon.ai" style="color:#fbbf24;text-decoration:none;font-weight:600;font-size:0.85rem;">admin@simplebeacon.ai</a>
</div>
<div style="text-align:center;margin-bottom:0;">
<span style="font-size:0.78rem;color:#4b5563;">Or just reply to this email</span>
</div>
</div>

<!-- Footer -->
<div style="background:#0a0a0f;padding:32px 40px;text-align:center;">
<div style="font-size:0.9rem;font-weight:700;color:#ffffff;margin-bottom:4px;letter-spacing:0.02em;">SimpleBeacon</div>
<div style="font-size:0.7rem;color:#4b5563;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.1em;">Zero-Dependency Static Analysis Engine</div>
<div style="font-size:0.78rem;">
<a href="https://simplebeacon.ai" style="color:#6b7280;text-decoration:none;margin:0 6px;">Website</a>
<span style="color:#374151;">&middot;</span>
<a href="https://simplebeacon.ai/community.html" style="color:#6b7280;text-decoration:none;margin:0 6px;">Docs</a>
<span style="color:#374151;">&middot;</span>
<a href="https://github.com/tjp420/simplebeacon" style="color:#6b7280;text-decoration:none;margin:0 6px;">GitHub</a>
<span style="color:#374151;">&middot;</span>
<a href="mailto:admin@simplebeacon.ai" style="color:#6b7280;text-decoration:none;margin:0 6px;">Support</a>
</div>
</div>

<!-- Bottom accent line -->
<div style="height:2px;background:linear-gradient(90deg,#d97706 0%,#f59e0b 50%,#fbbf24 100%);"></div>

</div>
</body>
</html>`;

    return { subject, text, html };
}

module.exports = { renderLicenseConfirmation };
