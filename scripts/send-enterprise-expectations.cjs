#!/usr/bin/env node
/**
 * Send the "What to expect after buying Enterprise" email.
 *
 * Usage:
 *   RESEND_API_KEY=re_xxx node scripts/send-enterprise-expectations.cjs --to trevor_punt@live.com
 *
 * Or with SMTP (Zoho):
 *   SMTP_HOST=smtp.zohocloud.ca SMTP_USER=admin@simplebeacon.ai SMTP_PASS=xxx \
 *   SMTP_FROM=admin@simplebeacon.ai node scripts/send-enterprise-expectations.cjs --to trevor_punt@live.com
 */

const args = process.argv.slice(2);
let toAddr = null;
for (let i = 0; i < args.length; i++) {
    if (args[i] === '--to' && args[i + 1]) toAddr = args[i + 1];
}
if (!toAddr) {
    console.error('Usage: node send-enterprise-expectations.cjs --to <email>');
    process.exit(1);
}

const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || 'admin@simplebeacon.ai';

const subject = 'What to expect in your inbox after buying SimpleBeacon Enterprise';

const text = `Hi Trevor,

Here's what a customer sees in their inbox after purchasing SimpleBeacon Enterprise tier.

=== 1. Payment confirmation (immediate, from Stripe) ===

Subject: "Your SimpleBeacon Enterprise payment receipt"

- Invoice number, amount, and NET-30 or ACH payment terms
- Breakdown: Enterprise Air-Gapped license + any add-ons (extra seats, EU AI Act Sprint, Executive Risk Certificate)
- Link to Stripe billing portal for invoice download and payment history

=== 2. License token + onboarding kickoff (within 1 business day) ===

Subject: "Your SimpleBeacon Enterprise license + onboarding kickoff"

- Offline license token (single token unlocks CLI, GitHub Actions, and team dashboard)
- Download link for the air-gapped Docker image and VS Code extension (v3.0.505+)
- Calendly link to book the 60-minute onboarding call with your dedicated analyst
- Setup checklist:
  1. Install CLI: npx simplebeacon init --starter --profile enterprise
  2. Apply license token: npx simplebeacon license apply <token>
  3. Configure SSO/SAML (analyst sends metadata URL)
  4. Run first gate scan: npx simplebeacon scan --gate --offline
  5. Review .simplebeacon/agent-brief.md with your analyst

=== 3. SSO/SAML configuration email (within 2 business days) ===

Subject: "SimpleBeacon SSO/SAML setup — action required"

- SAML metadata URL or XML attachment
- Step-by-step instructions for Okta, Azure AD, or Google Workspace
- Test login URL to verify SSO before team rollout
- Dedicated analyst contact for troubleshooting

=== 4. Dedicated analyst introduction (within 1 business day of onboarding call) ===

Subject: "Your SimpleBeacon analyst: [name] — direct contact"

- Analyst name, email, and availability hours
- Slack Connect channel invitation (if requested)
- What the analyst handles: custom rule engines, EU AI Act documentation, board-ready certificate preparation, quarterly review scheduling

=== 5. First scan report + agent brief (after first gate scan) ===

Subject: "Your first SimpleBeacon gate scan report"

- HTML report summary: blocking issues, rule-scoped file count, pipeline metrics
- .simplebeacon/agent-brief.md attached
- .simplebeacon/report.json attached (machine-readable for CI integration)
- Analyst's initial review notes and recommended remediation priorities

=== 6. Board-ready compliance certificate (after analyst review, 5-10 business days) ===

Subject: "Your SimpleBeacon Executive Risk Certificate is ready"

- PDF certificate with project name, scan date, finding count, and analyst signature
- EU AI Act Annex III documentation (if EU AI Act Sprint was purchased)
- Article 14 Human Oversight evaluation
- Article 50 transparency checks
- Audit trail: scan hashes, rule versions, and tamper-evident evidence chain

=== 7. Quarterly review scheduling (recurring) ===

Subject: "SimpleBeacon Q[x] review — schedule your call"

- Quarterly review agenda: gate pass/fail trends, new rule coverage, dependency health, regulatory updates
- Calendly link to book the 30-minute review with your analyst
- Summary of the previous quarter's scan metrics

=== What is NOT in the inbox ===

- No source code or scan artifacts are emailed. All reports are delivered via the on-premise dashboard or attached as PDFs generated locally.
- No third-party marketing emails. SimpleBeacon does not share customer data.
- No surprise charges. Enterprise contracts are fixed annual or NET-30 invoice.

If you have questions before purchasing, reply to this email or book a demo at https://simplebeacon.ai/contact?topic=enterprise.

— SimpleBeacon Team
https://simplebeacon.ai
`;

const html = `
<!DOCTYPE html>
<html><body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 640px; margin: 0 auto; padding: 24px; color: #1a1a1a; line-height: 1.6;">
<h1 style="color: #6366f1; font-size: 1.5rem; margin-bottom: 24px;">What to expect in your inbox after buying SimpleBeacon Enterprise</h1>
<p>Hi Trevor,</p>
<p>Here's what a customer sees in their inbox after purchasing SimpleBeacon Enterprise tier.</p>

<h2 style="color: #312e81; font-size: 1.1rem; margin-top: 28px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px;">1. Payment confirmation <small style="font-weight:400; color:#666;">(immediate, from Stripe)</small></h2>
<p><strong>Subject:</strong> "Your SimpleBeacon Enterprise payment receipt"</p>
<ul>
<li>Invoice number, amount, and NET-30 or ACH payment terms</li>
<li>Breakdown: Enterprise Air-Gapped license + any add-ons (extra seats, EU AI Act Sprint, Executive Risk Certificate)</li>
<li>Link to Stripe billing portal for invoice download and payment history</li>
</ul>

<h2 style="color: #312e81; font-size: 1.1rem; margin-top: 28px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px;">2. License token + onboarding kickoff <small style="font-weight:400; color:#666;">(within 1 business day)</small></h2>
<p><strong>Subject:</strong> "Your SimpleBeacon Enterprise license + onboarding kickoff"</p>
<ul>
<li>Offline license token (single token unlocks CLI, GitHub Actions, and team dashboard)</li>
<li>Download link for the air-gapped Docker image and VS Code extension (v3.0.505+)</li>
<li>Calendly link to book the 60-minute onboarding call with your dedicated analyst</li>
<li>Setup checklist:
  <ol>
    <li><code>npx simplebeacon init --starter --profile enterprise</code></li>
    <li><code>npx simplebeacon license apply &lt;token&gt;</code></li>
    <li>Configure SSO/SAML (analyst sends metadata URL)</li>
    <li><code>npx simplebeacon scan --gate --offline</code></li>
    <li>Review <code>.simplebeacon/agent-brief.md</code> with your analyst</li>
  </ol>
</li>
</ul>

<h2 style="color: #312e81; font-size: 1.1rem; margin-top: 28px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px;">3. SSO/SAML configuration <small style="font-weight:400; color:#666;">(within 2 business days)</small></h2>
<p><strong>Subject:</strong> "SimpleBeacon SSO/SAML setup — action required"</p>
<ul>
<li>SAML metadata URL or XML attachment</li>
<li>Step-by-step instructions for Okta, Azure AD, or Google Workspace</li>
<li>Test login URL to verify SSO before team rollout</li>
<li>Dedicated analyst contact for troubleshooting</li>
</ul>

<h2 style="color: #312e81; font-size: 1.1rem; margin-top: 28px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px;">4. Dedicated analyst introduction <small style="font-weight:400; color:#666;">(within 1 business day of onboarding call)</small></h2>
<p><strong>Subject:</strong> "Your SimpleBeacon analyst: [name] — direct contact"</p>
<ul>
<li>Analyst name, email, and availability hours</li>
<li>Slack Connect channel invitation (if requested)</li>
<li>What the analyst handles: custom rule engines, EU AI Act documentation, board-ready certificate preparation, quarterly review scheduling</li>
</ul>

<h2 style="color: #312e81; font-size: 1.1rem; margin-top: 28px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px;">5. First scan report + agent brief <small style="font-weight:400; color:#666;">(after first gate scan)</small></h2>
<p><strong>Subject:</strong> "Your first SimpleBeacon gate scan report"</p>
<ul>
<li>HTML report summary: blocking issues, rule-scoped file count, pipeline metrics</li>
<li><code>.simplebeacon/agent-brief.md</code> attached</li>
<li><code>.simplebeacon/report.json</code> attached (machine-readable for CI integration)</li>
<li>Analyst's initial review notes and recommended remediation priorities</li>
</ul>

<h2 style="color: #312e81; font-size: 1.1rem; margin-top: 28px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px;">6. Board-ready compliance certificate <small style="font-weight:400; color:#666;">(after analyst review, 5-10 business days)</small></h2>
<p><strong>Subject:</strong> "Your SimpleBeacon Executive Risk Certificate is ready"</p>
<ul>
<li>PDF certificate with project name, scan date, finding count, and analyst signature</li>
<li>EU AI Act Annex III documentation (if EU AI Act Sprint was purchased)</li>
<li>Article 14 Human Oversight evaluation</li>
<li>Article 50 transparency checks</li>
<li>Audit trail: scan hashes, rule versions, and tamper-evident evidence chain</li>
</ul>

<h2 style="color: #312e81; font-size: 1.1rem; margin-top: 28px; border-bottom: 2px solid #e0e7ff; padding-bottom: 6px;">7. Quarterly review scheduling <small style="font-weight:400; color:#666;">(recurring)</small></h2>
<p><strong>Subject:</strong> "SimpleBeacon Q[x] review — schedule your call"</p>
<ul>
<li>Quarterly review agenda: gate pass/fail trends, new rule coverage, dependency health, regulatory updates</li>
<li>Calendly link to book the 30-minute review with your analyst</li>
<li>Summary of the previous quarter's scan metrics</li>
</ul>

<h2 style="color: #991b1b; font-size: 1.1rem; margin-top: 28px;">What is NOT in the inbox</h2>
<ul>
<li><strong>No source code or scan artifacts are emailed.</strong> All reports are delivered via the on-premise dashboard or attached as PDFs generated locally.</li>
<li><strong>No third-party marketing emails.</strong> SimpleBeacon does not share customer data.</li>
<li><strong>No surprise charges.</strong> Enterprise contracts are fixed annual or NET-30 invoice.</li>
</ul>

<p style="margin-top: 32px;">If you have questions before purchasing, reply to this email or book a demo at <a href="https://simplebeacon.ai/contact?topic=enterprise" style="color: #6366f1;">simplebeacon.ai/contact</a>.</p>

<p style="margin-top: 24px; color: #666; font-size: 0.9rem; border-top: 1px solid #eee; padding-top: 16px;">
— SimpleBeacon Team<br>
<a href="https://simplebeacon.ai" style="color: #6366f1;">simplebeacon.ai</a>
</p>
</body></html>
`;

async function main() {
    const hasResend = process.env.RESEND_API_KEY && process.env.RESEND_API_KEY.startsWith('re_');
    const hasSmtp = process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS;

    if (hasResend) {
        const res = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                from: 'SimpleBeacon <admin@simplebeacon.ai>',
                to: [toAddr],
                subject,
                text,
                html
            })
        });
        const data = await res.json();
        if (res.ok) {
            console.log('Email sent via Resend. ID:', data.id);
        } else {
            console.error('Resend error:', JSON.stringify(data));
            process.exit(1);
        }
    } else if (hasSmtp) {
        const nodemailer = require('nodemailer');
        const transporter = nodemailer.createTransport({
            host: process.env.SMTP_HOST,
            port: parseInt(process.env.SMTP_PORT || '465', 10),
            secure: process.env.SMTP_SECURE !== 'false',
            auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        });
        const info = await transporter.sendMail({
            from: `SimpleBeacon <${fromAddr}>`,
            to: toAddr,
            subject,
            text,
            html
        });
        console.log('Email sent via SMTP. Message ID:', info.messageId);
    } else {
        console.error('No email credentials found. Set RESEND_API_KEY or SMTP_HOST/SMTP_USER/SMTP_PASS.');
        console.error('');
        console.error('To preview the email content, see the text/html variables in this script.');
        process.exit(1);
    }
}

main().catch(err => { console.error(err); process.exit(1); });
