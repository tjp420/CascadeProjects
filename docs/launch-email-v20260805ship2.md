# Launch Announcement Email — SimpleBeacon v20260805ship2

**Subject:** Sub-second browser-local scans + Zero Data Custody — SimpleBeacon is live
**From:** team@simplebeacon.ai
**Audience:** Mailing list, trial users, waitlist

---

## Plain-text version

---

Hi there,

SimpleBeacon just shipped its biggest update yet — and it fundamentally changes what "secure code scanning" means for your team.

**What's new:**

1. **Sub-second drag-and-drop scans.** Drop your entire repository folder onto the dashboard and the compliance scan starts in milliseconds, not seconds. We bypassed the slow network-probe path and route directly into the browser's local Web Worker engine.

2. **Zero Data Custody — proven, not promised.** Your source code never leaves your machine. The scanning engine runs 100% in your browser sandbox. No cloud inference. No hidden API calls. No data leakage.

   **We dare you to test it:** Load the dashboard, unplug your internet connection entirely, and run a scan. It works at full speed with zero network connectivity. Open DevTools → Network tab → drop your repo → watch zero requests fire during the scan.

3. **New 3-tier pricing:**
   - **Developer** — $49/mo: unlimited scans, CI gate, 38 analyzers
   - **Team Pro** — $149/mo: EU AI Act + SOC 2 board-ready certs, 5 seats
   - **Enterprise** — Custom: air-gapped, SSO/SAML, dedicated analyst

4. **Offline status badge.** The dashboard now shows a green "Local Sandbox Active" indicator when your browser is disconnected — real-time proof that scans run locally.

**Why this matters for enterprise:**

Traditional cloud-based code analysis platforms require 6-12 month security reviews, SOC 2 certificates, and lengthy Data Processing Agreements. SimpleBeacon bypasses all of it — because we never receive, store, or process your source code. The procurement conversation shifts from "How do you protect our data?" to "What data?"

**Try it now:** https://simplebeacon.ai/dashboard/#/analyze

**Read the security one-pager:** https://simplebeacon.ai/docs/SECURITY-PRIVACY-ONE-PAGER

To your shipping velocity,
The SimpleBeacon Team

---

## HTML version

```html
<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon — Sub-second scans + Zero Data Custody</title>
</head>
<body style="margin:0;padding:0;background:#0a0e18;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:#e5e7eb;">

  <div style="max-width:600px;margin:0 auto;padding:32px 24px;">

    <h1 style="font-size:24px;font-weight:700;color:#fff;margin:0 0 24px;">
      SimpleBeacon just shipped its biggest update yet.
    </h1>

    <p style="font-size:16px;line-height:1.6;color:#9ca3af;margin:0 0 28px;">
      It fundamentally changes what "secure code scanning" means for your team.
    </p>

    <!-- Feature 1 -->
    <div style="margin-bottom:28px;padding:20px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
      <h2 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 8px;">Sub-second drag-and-drop scans</h2>
      <p style="font-size:14px;line-height:1.6;color:#9ca3af;margin:0;">
        Drop your entire repository folder onto the dashboard and the compliance scan starts in milliseconds, not seconds. We bypassed the slow network-probe path and route directly into the browser's local Web Worker engine.
      </p>
    </div>

    <!-- Feature 2 -->
    <div style="margin-bottom:28px;padding:20px;background:rgba(34,197,94,0.06);border-radius:12px;border:1px solid rgba(34,197,94,0.2);">
      <h2 style="font-size:18px;font-weight:600;color:#22c55e;margin:0 0 8px;">Zero Data Custody — proven, not promised</h2>
      <p style="font-size:14px;line-height:1.6;color:#9ca3af;margin:0 0 12px;">
        Your source code never leaves your machine. The scanning engine runs 100% in your browser sandbox. No cloud inference. No hidden API calls. No data leakage.
      </p>
      <p style="font-size:14px;line-height:1.6;color:#e5e7eb;margin:0;font-weight:500;">
        We dare you: Load the dashboard, unplug your internet entirely, and run a scan. It works at full speed with zero network connectivity.
      </p>
    </div>

    <!-- Feature 3 -->
    <div style="margin-bottom:28px;padding:20px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
      <h2 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 12px;">New 3-tier pricing</h2>
      <ul style="font-size:14px;line-height:1.8;color:#9ca3af;margin:0;padding-left:20px;">
        <li><strong style="color:#e5e7eb;">Developer</strong> — $49/mo: unlimited scans, CI gate, 38 analyzers</li>
        <li><strong style="color:#e5e7eb;">Team Pro</strong> — $149/mo: EU AI Act + SOC 2 board-ready certs, 5 seats</li>
        <li><strong style="color:#e5e7eb;">Enterprise</strong> — Custom: air-gapped, SSO/SAML, dedicated analyst</li>
      </ul>
    </div>

    <!-- Feature 4 -->
    <div style="margin-bottom:32px;padding:20px;background:rgba(255,255,255,0.04);border-radius:12px;border:1px solid rgba(255,255,255,0.08);">
      <h2 style="font-size:18px;font-weight:600;color:#fff;margin:0 0 8px;">Offline status badge</h2>
      <p style="font-size:14px;line-height:1.6;color:#9ca3af;margin:0;">
        The dashboard now shows a green "Local Sandbox Active" indicator when your browser is disconnected — real-time proof that scans run locally.
      </p>
    </div>

    <!-- CTA -->
    <div style="text-align:center;margin:32px 0;">
      <a href="https://simplebeacon.ai/dashboard/#/analyze" style="display:inline-block;padding:14px 32px;background:#22c55e;color:#0a0e18;font-weight:700;font-size:16px;text-decoration:none;border-radius:10px;">
        Try it now — disconnect &amp; scan
      </a>
    </div>

    <!-- Enterprise callout -->
    <div style="margin:32px 0;padding:16px 20px;background:rgba(99,102,241,0.08);border-radius:10px;border:1px solid rgba(99,102,241,0.2);">
      <p style="font-size:13px;line-height:1.6;color:#9ca3af;margin:0;">
        <strong style="color:#a5b4fc;">Why this matters for enterprise:</strong> Traditional cloud code analysis platforms require 6-12 month security reviews, SOC 2 certificates, and lengthy DPAs. SimpleBeacon bypasses all of it — because we never receive your source code. The procurement conversation shifts from "How do you protect our data?" to "What data?"
      </p>
    </div>

    <hr style="border:none;border-top:1px solid rgba(255,255,255,0.08);margin:32px 0;">

    <p style="font-size:13px;color:#6b7280;margin:0;">
      To your shipping velocity,<br>
      <strong style="color:#9ca3af;">The SimpleBeacon Team</strong>
    </p>

    <p style="font-size:12px;color:#4b5563;margin:24px 0 0;">
      You're receiving this because you signed up at simplebeacon.ai.
      <a href="https://simplebeacon.ai/unsubscribe" style="color:#6b7280;">Unsubscribe</a>
    </p>

  </div>
</body>
</html>
```

---

## Sending instructions

- **Plain-text:** Use as the fallback body in your email provider (Resend, SendGrid, etc.)
- **HTML:** Use as the primary body. Inline styles are intentional for email client compatibility.
- **Sending via Resend:**

```bash
# Set RESEND_API_KEY in your environment first
npx resend emails send \
  --from "team@simplebeacon.ai" \
  --to "your-mailing-list@simplebeacon.ai" \
  --subject "Sub-second browser-local scans + Zero Data Custody — SimpleBeacon is live" \
  --html docs/launch-email-v20260805ship2.html
```

- **A/B test suggestion:** Test two subject lines:
  1. "Sub-second browser-local scans + Zero Data Custody — SimpleBeacon is live"
  2. "We dare you: unplug your internet and run a scan"
