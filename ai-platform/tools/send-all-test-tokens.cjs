#!/usr/bin/env node
// simplebeacon-ignore: CLI tool — generates and emails test tokens for all tiers
/**
 * Generate license tokens for every tier offered on the website and email
 * them to admin@simplebeacon.ai for feature testing.
 *
 * Tiers generated:
 *   1. community (free)       — 24h, 100 scans
 *   2. sandbox                 — 14d, browser scan sandbox
 *   3. developer              — 365d, unlimited scans, CI gate, 48 analyzers
 *   4. team_pro               — 365d, EU AI Act, SOC 2, board-ready certs, 5 seats
 *   5. enterprise             — 365d, air-gapped, SSO/SAML, dedicated analyst
 *   6. pro (legacy)           — 365d, 500 scans
 *   7. executive_clearance    — 90d, one-time certificate pass
 *   8. eu_ai_act_sprint       — 30d, EU AI Act compliance sprint
 *   9. one_time_certificate   — 7d, single certificate
 */

const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

// Load env from coming-soon/.env
const envPath = path.join(__dirname, "..", "..", "coming-soon", ".env");
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, "utf8");
  content.split("\n").forEach((line) => {
    const m = line.match(/^([^#=\s]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  });
}

const SECRET = process.env.SIMPLEBEACON_LICENSE_SECRET;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const SMTP_FROM = process.env.SMTP_FROM || "admin@simplebeacon.ai";
const TO_EMAIL = process.argv[2] || "admin@simplebeacon.ai";

if (!SECRET) {
  console.error("ERROR: SIMPLEBEACON_LICENSE_SECRET not set in coming-soon/.env");
  process.exit(1);
}
if (!RESEND_API_KEY) {
  console.error("ERROR: RESEND_API_KEY not set in coming-soon/.env");
  process.exit(1);
}

// ── Token engine (mirrors packages/simplebeacon-cli/src/lib/license-token.js) ──

function base64UrlEncode(buf) {
  return Buffer.from(buf).toString("base64url");
}

function buildHeader() {
  return base64UrlEncode(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
}

function sign(data, secret) {
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(data);
  return base64UrlEncode(hmac.digest());
}

function generateLicenseToken(claims, secret, ttlMinutes) {
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: "simplebeacon.ai",
    aud: "simplebeacon-cli",
    sub: claims.email || "unknown",
    email: claims.email || "",
    tier: claims.tier || "developer",
    product: claims.product || claims.tier || "",
    features: claims.features || ["scan"],
    clientName: claims.clientName || claims.email || "Test User",
    projectName: claims.projectName || "Test Project",
    scanQuota: claims.scanQuota || 100,
    iat: now,
    exp: now + ttlMinutes * 60,
    jti: crypto.randomBytes(16).toString("hex"),
  };
  const header = buildHeader();
  const data = base64UrlEncode(Buffer.from(JSON.stringify(payload)));
  const sig = sign(`${header}.${data}`, secret);
  return `${header}.${data}.${sig}`;
}

// ── Tier definitions (matched to pricing.html + dashboard TIER_CAPABILITIES) ──
//
// Sources verified:
//   - coming-soon/public/pricing.html  (advertised prices, features, validity)
//   - useFeatureAccess.ts TIER_CAPABILITIES (dashboard feature gating)
//   - subscriptions-billing.cjs tierConfig (server-side Stripe prices)
//   - license-token.js TIER_QUOTAS (CLI-side quota enforcement)
//
// Tiers marked "website" are purchasable on the pricing page.
// Tiers marked "internal" exist in the backend but are not sold to new customers.

const TIERS = [
  // ── Purchasable on pricing.html ──

  {
    tier: "community",
    label: "Free / Community",
    price: "$0",
    ttlMinutes: 24 * 60, // 24 hours (free-token route default)
    features: ["scan", "browser-scan"],
    scanQuota: 3, // dashboard TIER_CAPABILITIES.community.maxScans = 3
    description: "Free tier — 3 scans/mo, browser-local scans, 38 analyzer modules. No CI gate, no certs, no PDF exports.",
    color: "#6b7280",
    source: "website",
  },
  {
    tier: "developer",
    label: "Developer ($49/mo or $490/yr)",
    price: "$49/mo",
    ttlMinutes: 365 * 24 * 60, // 365 days
    features: ["scan", "ci-gate", "pdf-report", "certificate", "advanced-analyzers", "cve-scanner", "secret-scanner"],
    scanQuota: Infinity, // website: "Unlimited pipeline scans with unlimited files per scan"
    description: "Developer tier — unlimited scans, CI/CD gate, 38 CLI analyzer modules, CVE dependency scanner, git history secret scanner, PDF reports, certificates. 14-day free trial.",
    color: "#10b981",
    source: "website",
  },
  {
    tier: "team_pro",
    label: "Team Pro ($149/mo or $1,490/yr)",
    price: "$149/mo",
    ttlMinutes: 365 * 24 * 60,
    features: ["scan", "ci-gate", "pdf-report", "certificate", "advanced-analyzers", "eu-ai-act", "soc2", "board-cert", "sso", "5-seats", "cyclonedx-sbom"],
    scanQuota: Infinity,
    description: "Team Pro tier — everything in Developer + EU AI Act & SOC 2 mapping, board-ready PDF certificate ZIP, CycloneDX SBOM, 5 team seats, SSO, quarterly compliance reviews. 14-day free trial.",
    color: "#10b981",
    source: "website",
  },
  {
    tier: "enterprise",
    label: "Enterprise / Corporate Governance ($499/mo or Custom)",
    price: "$499/mo (Custom on website)",
    ttlMinutes: 365 * 24 * 60,
    features: ["scan", "ci-gate", "pdf-report", "certificate", "advanced-analyzers", "eu-ai-act", "soc2", "board-cert", "sso", "saml", "air-gapped", "dedicated-analyst", "unlimited-seats", "custom-rules", "sla"],
    scanQuota: Infinity,
    description: "Enterprise tier — everything in Team Pro + self-hosted/air-gapped, unlimited seats, SSO/SAML, dedicated compliance analyst, custom rule engines, EU AI Act Annex III + Art 14 + Art 50, 24/7 SLA. Contact sales.",
    color: "#6366f1",
    source: "website",
  },
  {
    tier: "one_time_certificate",
    label: "Audit Certificate ($149 one-time)",
    price: "$149 one-time",
    ttlMinutes: 365 * 24 * 60, // 365 days — website says "Valid for 12 months"
    features: ["scan", "certificate", "pdf-report", "eu-ai-act-alignment", "soc2-alignment"],
    scanQuota: 1, // website: "1 cryptographic certificate"
    description: "One-time pass — 1 board-ready certificate, PDF + JSON + remediation roadmap, EU AI Act + SOC 2 alignment. Valid for 12 months. No subscription.",
    color: "#6366f1",
    source: "website",
  },
  {
    tier: "executive_clearance",
    label: "Executive Risk Certificate ($499 one-time)",
    price: "$499 one-time",
    ttlMinutes: 90 * 24 * 60, // 90 days — website says "Valid for 90 days"
    features: ["scan", "certificate", "pdf-report", "executive-clearance", "hygiene-grade", "liability-estimate", "remediation-checklist", "evidence-pack"],
    scanQuota: 1, // one signed executive risk certificate
    description: "One-time executive pass — signed Executive Risk Certificate, A–F hygiene grade + liability estimate, remediation checklist + evidence pack. Valid for 90 days.",
    color: "#6366f1",
    source: "website",
  },
  {
    tier: "eu_ai_act_sprint",
    label: "EU AI Act Sprint ($2,499 one-time)",
    price: "$2,499 one-time",
    ttlMinutes: 30 * 24 * 60, // 30 days — website says "30-day analyst support"
    features: ["scan", "eu-ai-act", "compliance", "pdf-report", "certificate", "annex-iii", "article-14", "article-50", "evidence-pack", "analyst-support"],
    scanQuota: 20,
    description: "One-time EU AI Act sprint — readiness audit, Annex III + Article 14 + Article 50 checks, verified evidence pack (PDF + JSON), 30-day analyst support.",
    color: "#6366f1",
    source: "website",
  },

  // ── Internal / backend-only (not sold on pricing page) ──

  {
    tier: "sandbox",
    label: "Sandbox (Audit Page Demo Only — NOT SOLD)",
    price: "$0 (internal)",
    ttlMinutes: 14 * 24 * 60, // 14 days (sandbox token route default)
    features: ["scan", "browser-scan", "sandbox"],
    scanQuota: 50,
    description: "Internal sandbox token — generated by the audit page for browser-local demo scans. Not a purchasable tier. 14-day token for testing the audit page only.",
    color: "#f59e0b",
    source: "internal",
  },
  {
    tier: "pro",
    label: "Pro Legacy ($9/mo — BACKWARD COMPAT ONLY, NOT SOLD)",
    price: "$9/mo (legacy)",
    ttlMinutes: 365 * 24 * 60,
    features: ["scan", "ci-gate", "pdf-report"],
    scanQuota: 500, // CLI TIER_QUOTAS.pro = 500
    description: "Legacy Pro tier — 500 scans, CI gate, PDF reports. Kept in server tierConfig for existing customers only. Not offered to new customers on pricing page.",
    color: "#f59e0b",
    source: "internal",
  },
];

// ── Generate tokens ──

const email = TO_EMAIL;
const tokens = TIERS.map((t) => {
  const token = generateLicenseToken(
    {
      email,
      tier: t.tier,
      product: t.tier,
      features: t.features,
      clientName: "Admin Test",
      projectName: "Feature Test",
      scanQuota: t.scanQuota,
    },
    SECRET,
    t.ttlMinutes,
  );
  return { ...t, token };
});

// ── Build email HTML ──

const rows = tokens
  .map(
    (t) => `
    <tr style="border-bottom:1px solid #e5e7eb;">
      <td style="padding:16px 12px;vertical-align:top;">
        <div style="font-weight:700;color:${t.color};font-size:14px;">${t.label}</div>
        <div style="font-size:11px;margin-top:2px;">
          <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;background:${t.source === "website" ? "#dbeafe" : "#fef3c7"};color:${t.source === "website" ? "#1e40af" : "#92400e"};">${t.source === "website" ? "Purchasable" : "Internal"}</span>
          <span style="color:#6b7280;font-size:11px;margin-left:6px;">${t.price}</span>
        </div>
        <div style="font-size:12px;color:#6b7280;margin-top:4px;">${t.description}</div>
        <div style="font-size:11px;color:#9ca3af;margin-top:4px;">
          <strong>Features:</strong> ${t.features.join(", ")}<br/>
          <strong>Quota:</strong> ${t.scanQuota === Infinity ? "Unlimited" : t.scanQuota} scan${t.scanQuota === 1 ? "" : "s"}<br/>
          <strong>Expires:</strong> ${Math.round(t.ttlMinutes / (60 * 24))} days
        </div>
      </td>
      <td style="padding:16px 12px;vertical-align:top;width:50%;">
        <div style="background:#f3f4f6;border-radius:8px;padding:12px;font-family:monospace;font-size:11px;word-break:break-all;color:#374151;max-height:120px;overflow:auto;">
          ${t.token}
        </div>
        <div style="margin-top:8px;">
          <a href="https://simplebeacon.ai/dashboard/#/license-manager?token=${encodeURIComponent(t.token)}"
             style="display:inline-block;padding:6px 14px;background:#6366f1;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;">
            Activate in Dashboard
          </a>
          <a href="https://simplebeacon.ai/audit?token=${encodeURIComponent(t.token)}"
             style="display:inline-block;padding:6px 14px;background:#10b981;color:#fff;text-decoration:none;border-radius:6px;font-size:12px;font-weight:600;margin-left:8px;">
            Use in Audit Page
          </a>
        </div>
      </td>
    </tr>
  `,
  )
  .join("");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>SimpleBeacon Test Tokens — All Tiers</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:800px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <!-- Header -->
    <div style="background:linear-gradient(135deg,#6366f1,#4f46e5);padding:32px 24px;text-align:center;">
      <h1 style="margin:0;color:#fff;font-size:24px;font-weight:700;">SimpleBeacon Test Tokens</h1>
      <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">${tokens.filter((t) => t.source === "website").length} purchasable tiers + ${tokens.filter((t) => t.source === "internal").length} internal — for feature testing</p>
    </div>

    <!-- Intro -->
    <div style="padding:24px;border-bottom:1px solid #e5e7eb;">
      <p style="margin:0 0 8px;font-size:14px;color:#374151;">
        <strong>How to test:</strong> Click "Activate in Dashboard" to load each token into the dashboard,
        or paste a token into the audit page's token gate.
      </p>
      <p style="margin:0;font-size:13px;color:#6b7280;">
        Each token is signed with the production license secret and will be accepted by the live server.
        Tokens are time-limited as noted per tier.
      </p>
    </div>

    <!-- Token table -->
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr style="background:#f9fafb;border-bottom:2px solid #e5e7eb;">
          <th style="padding:12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;">Tier</th>
          <th style="padding:12px;text-align:left;font-size:12px;text-transform:uppercase;color:#6b7280;letter-spacing:0.5px;">Token & Actions</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <!-- Footer -->
    <div style="padding:24px;background:#f9fafb;border-top:1px solid #e5e7eb;">
      <p style="margin:0;font-size:12px;color:#9ca3af;text-align:center;">
        Generated by SimpleBeacon token generator • ${new Date().toISOString()}<br/>
        Sent to ${email} • Do not share — these are test tokens for feature verification
      </p>
    </div>
  </div>
</body>
</html>`;

const text = `SimpleBeacon Test Tokens — All Tiers

${tokens
  .map(
    (t) => `
=== ${t.label} (${t.price}) [${t.source.toUpperCase()}] ===
${t.description}
Features: ${t.features.join(", ")}
Quota: ${t.scanQuota === Infinity ? "Unlimited" : t.scanQuota} scan${t.scanQuota === 1 ? "" : "s"}
Expires: ${Math.round(t.ttlMinutes / (60 * 24))} days

Token:
${t.token}

Dashboard: https://simplebeacon.ai/dashboard/#/license-manager?token=${encodeURIComponent(t.token)}
Audit: https://simplebeacon.ai/audit?token=${encodeURIComponent(t.token)}
`,
  )
  .join("\n")}
`;

// ── Send email via Resend API ──

async function sendEmail() {
  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: `SimpleBeacon <${SMTP_FROM}>`,
      to: [email],
      subject: `SimpleBeacon Test Tokens — All ${tokens.length} Tiers`,
      text,
      html,
    }),
  });

  const data = await resp.json();
  if (!resp.ok) {
    console.error("Email send failed:", resp.status, JSON.stringify(data));
    process.exit(1);
  }
  console.log("Email sent successfully!");
  console.log("Message ID:", data.id);
  console.log(`Sent ${tokens.length} tier tokens to ${email}`);
}

sendEmail().catch((err) => {
  console.error("Failed to send email:", err.message);
  process.exit(1);
});
