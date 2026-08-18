// SimpleBeacon Site Configuration
window.SIMPLEBEACON_SITE = window.SIMPLEBEACON_SITE || {
  env: 'production',
  githubUrl: 'https://github.com/tjp420/simplebeacon',
  // The VSIX is no longer served from /downloads because Cloudflare Pages rejects static assets over 25 MiB.
  // Attach the VSIX to the latest GitHub release as `simplebeacon.vsix`, or replace this with an R2 public URL.
  vsixDownloadUrl: 'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon.vsix',
  // Intentional demo content URLs — these are sample pages for the marketing site,
  // not mock/fixture data embedded in production application code. simplebeacon-ignore
  sampleReportUrl: 'sample-report.html', // simplebeacon:production-leak-intent: demo-content - sample URL for marketing site, not production fixture
  sampleCertificateUrl: 'sample-certificate.html', // simplebeacon-ignore
  sampleEuAiActReportUrl: null,
  pricingUrl: 'pricing.html',
  communityUrl: 'community.html',
  contactUrl: 'contact.html',
  contactPageUrl: 'contact.html',
  termsUrl: 'terms.html',
  privacyUrl: 'privacy.html',
  refundUrl: 'refund.html',
  cloudTeamsUrl: null,
  // auditEmail removed from client bundle — loaded from /api/config/contact endpoint
  // to avoid exposing a static contact address in the JS bundle (privacy/PII best practice)
  auditEmail: null,

  // Unified pricing source of truth — 3-tier model (2026-08-18)
  pricing: {
    free: {
      name: 'Free',
      price: 0,
      stripeLink: null,
      testStripeLink: null
    },
    agent: {
      name: 'Agent',
      price: 25,
      stripeLink: null,
      testStripeLink: null
    },
    developer: {
      name: 'Developer',
      price: 49,
      stripeLink: null,
      testStripeLink: null
    }
  },

  // Legacy aliases for backward compatibility
  instantReportLink: 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07',
  stripePaymentLink: 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05',
  euAiActPackLink: 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06',

  apiBase: (typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1' || location.hostname === 'simplebeacon.ai' || location.hostname.endsWith('.simplebeacon.pages.dev') || location.hostname.endsWith('.onrender.com'))) ? '' : 'https://simplebeacon.ai',
  dashboardUrl: '/dashboard/',
  dashboardAppUrl: '/dashboard/',
  stagingMode: false,
  paymentsEnabled: true,
  closedSource: false,

  // Unified product configuration — single source of truth for upload.html + certificate-upload.html
  products: {
    instant: {
      label: '$19 Instant',
      price: '$19',
      title: 'Upload Your Scan Report',
      subtitle: 'Gate attestation + mock-data detection. Scan runs locally in your browser sandbox.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Paste your $19 payment token to unlock the scanner. Valid 7 days.'
    },
    community: {
      label: 'Free Audit',
      price: '$0',
      title: 'Free Audit',
      subtitle: 'Gate attestation + full certificate ZIP with all reports (executive summary, findings, remediation checklist, roadmap, explainability, dev guide, and per-module JSON). Unlimited scans. No payment required.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Free community token. Run the scan locally — no payment required.'
    },
    pro: {
      label: 'Simplebeacon Pro',
      price: '$9/mo',
      title: 'Upload Your Scan Report',
      subtitle: 'Unlimited scans, CI integration, exportable reports. Certificate ZIP generated locally.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Paste your Simplebeacon Pro access token.'
    },
    compliance: {
      label: 'Compliance Suite',
      price: '$399/mo',
      title: 'Upload Your Scan Report',
      subtitle: 'EU AI Act documentation, SOC 2 artifacts, quarterly compliance certificates, analyst support.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --complete --gate --offline',
      tokenHelp: 'Paste your Compliance Suite access token.'
    },
    enterprise: {
      label: 'Enterprise Air-Gapped',
      price: 'Custom',
      title: 'Upload Your Scan Report',
      subtitle: 'On-premise, air-gapped, and Fortune 500 deployments. Custom contracts and SLA.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --complete --gate --offline',
      tokenHelp: 'Paste your Enterprise Air-Gapped access token.'
    },
    one_time_certificate: {
      label: 'Audit Certificate',
      price: '$149',
      title: 'Upload Your Scan Report',
      subtitle: 'Generate a single board-ready certificate. No subscription required.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Paste your one-time Audit Certificate token.'
    },
    custom: {
      label: 'Custom Plan',
      price: '',
      title: 'Upload Your Scan Report',
      subtitle: 'Custom module selection. Scan runs locally in your browser.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Paste your custom plan access token to unlock selected modules.'
    },
    universal: {
      label: 'Operator Access',
      price: '',
      title: 'Upload Your Scan Report',
      subtitle: 'Your scan ran locally on your machine. Upload the report JSON to generate your Operator Vault Certificate.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Paste any SimpleBeacon access token — works with any tier or custom label.'
    }
  },

  // Analysis types per tier — certificate-upload.html source of truth
  analysisTypes: {
    community: [
      { id: 'simplebeacon', label: '🛡️ Simplebeacon Gate' },
      { id: 'complete', label: '🔬 Complete Scan' }
    ],
    instant: [
      { id: 'simplebeacon', label: '🛡️ Simplebeacon Gate' },
      { id: 'mock-scan', label: '🔍 Mock data' },
      { id: 'codebase', label: '🧹 Codebase' }
    ],
    executive: [
      { id: 'simplebeacon', label: '🛡️ Simplebeacon Gate' },
      { id: 'consolidation', label: '🔀 Consolidation' },
      { id: 'mock-scan', label: '🔍 Mock data' },
      { id: 'roadmap', label: '🗺️ Roadmap' },
      { id: 'codebase', label: '🧹 Codebase' },
      { id: 'file-reduction', label: '📦 File reduction' },
      { id: 'data-quality', label: '🧪 Data quality' },
      { id: 'cleanup-assistant', label: '🗂️ Cleanup assistant' },
      { id: 'npm-audit', label: '📦 npm audit' },
      { id: 'compliance', label: '✅ Compliance' },
      { id: 'complete', label: '🔬 Complete Scan' }
    ],
    euai: [
      { id: 'simplebeacon', label: '🛡️ Simplebeacon Gate' },
      { id: 'complete', label: '🔬 Complete Scan' },
      { id: 'eu-ai-act', label: '🇪🇺 EU AI Act sprint' },
      { id: 'compliance', label: '✅ Compliance' }
    ],
    universal: [
      { id: 'simplebeacon', label: '🛡️ Simplebeacon Gate' },
      { id: 'consolidation', label: '🔀 Consolidation' },
      { id: 'mock-scan', label: '🔍 Mock data' },
      { id: 'roadmap', label: '🗺️ Roadmap' },
      { id: 'codebase', label: '🧹 Codebase' },
      { id: 'file-reduction', label: '📦 File reduction' },
      { id: 'data-quality', label: '🧪 Data quality' },
      { id: 'cleanup-assistant', label: '🗂️ Cleanup assistant' },
      { id: 'npm-audit', label: '📦 npm audit' },
      { id: 'compliance', label: '✅ Compliance' },
      { id: 'complete', label: '🔬 Complete Scan' }
    ]
  },

  // Tier profiles — upload.html source of truth
  tierProfiles: {
    locked: [],
    community: ['gate'],
    instant: ['gate', 'instant', 'mock-data'],
    aislopcop: ['gate', 'aislopcop', 'complete'],
    executive: ['gate', 'codebase', 'compliance', 'hygiene', 'complete'],
    euai: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete'],
    universal: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete']
  },

  // Feature comparison table — pricing.html source of truth (3-tier model)
  features: [
    { name: 'Price', free: 'Free', agent: '<strong>$25/mo</strong>', developer: '<strong>$49/mo</strong>' },
    { name: 'verify_before_write', free: '<span class="check">&#10003;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'verify_completion', free: '<span class="check">&#10003;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'watch_project', free: '<span class="check">&#10003;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'supercharge_agent', free: '<span class="check">&#10003;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'solve_problem + diagnose_error', free: '<span class="check">&#10003;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'Snippet scans / day', free: '<strong>20</strong>', agent: '<strong>Unlimited</strong>', developer: '<strong>Unlimited</strong>' },
    { name: 'scan_file (fix loop)', free: '<span class="cross">&mdash;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'propose_fix + verify_fix', free: '<span class="cross">&mdash;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'agent_status + explain_finding', free: '<span class="cross">&mdash;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'MCP integration', free: '<span class="check">&#10003;</span>', agent: '<span class="check">&#10003;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'scan_staged (pre-commit)', free: '<span class="cross">&mdash;</span>', agent: '<span class="cross">&mdash;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'CI gate (GitHub Action)', free: '<span class="cross">&mdash;</span>', agent: '<span class="cross">&mdash;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'get_action_plan', free: '<span class="cross">&mdash;</span>', agent: '<span class="cross">&mdash;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'CVE + git history scanners', free: '<span class="cross">&mdash;</span>', agent: '<span class="cross">&mdash;</span>', developer: '<span class="check">&#10003;</span>' },
    { name: 'Agent hosts', free: 'All', agent: 'All', developer: 'All' },
    { name: 'Support', free: 'Community', agent: 'Priority email', developer: 'Priority email + Slack' }
  ],

  // FAQ entries — pricing.html source of truth (3-tier model)
  faqs: [
    {
      q: 'What is SimpleBeacon and how does it work?',
      a: 'SimpleBeacon is a verification layer for AI coding agents. It catches phantom APIs, swallowed exceptions, hallucinated imports, and LLM slop locally &mdash; before merge. It works with Cursor, Claude Code, Cline, Windsurf, GitHub Copilot, Aider, and Continue via MCP. Three core tools (verify_before_write, verify_completion, watch_project) are free. No source code ever leaves your machine.'
    },
    {
      q: 'What do I get with the Free tier?',
      a: 'The Free tier includes verify_before_write, verify_completion, watch_project, supercharge_agent, solve_problem, diagnose_error, install_agent_plugin, and 20 snippet scans per day. Works with all supported AI coding agents via MCP. No account or credit card required.'
    },
    {
      q: 'What do I get with the Agent tier ($25/mo)?',
      a: 'Agent ($25/mo or $250/yr) unlocks the fix loop for AI coding agents: scan_file, propose_fix, verify_fix, agent_status, explain_finding, and unlimited scans. The agent can now scan files on disk, propose fixes, verify the fix worked, and explain findings &mdash; all locally. 7-day money-back guarantee.'
    },
    {
      q: 'What do I get with the Developer tier ($49/mo)?',
      a: 'Developer ($49/mo or $490/yr) includes everything in Agent plus scan_staged (pre-commit gate), get_action_plan, CI gate (GitHub Action), CVE scanner, git history scanner, and priority email + Slack support. Built for engineers who want SimpleBeacon in their CI pipeline. 7-day money-back guarantee.'
    },
    {
      q: 'Which AI coding agents does SimpleBeacon support?',
      a: 'SimpleBeacon works with any MCP-compatible AI coding agent: Cursor, Claude Code, Cline, Windsurf, GitHub Copilot, Aider, Continue, and Universal (via AGENTS.md). Wire any agent with one call: <code>npx simplebeacon init --starter --hosts all</code>. The VS Code extension provides real-time IDE feedback for all agents.'
    },
    {
      q: 'What failure patterns does SimpleBeacon catch?',
      a: 'SimpleBeacon catches the top AI coding agent failure patterns identified by Columbia DAPLab 2025 and CodeHalu (AAAI 2025): (1) Phantom APIs &mdash; hallucinated method calls on real libraries like fs.readFilePromise, JSON.tryParse, Promise.retry. (2) Swallowed exceptions &mdash; empty catch blocks, except: pass, return nil without wrapping. (3) Hallucinated imports &mdash; imports that don\'t exist, wrong export names. (4) LLM slop &mdash; markdown fences in code, TODO: implement, sample/mock production paths, fiction KPIs.'
    },
    {
      q: 'Do I need a SaaS subscription?',
      a: 'No. All SimpleBeacon scans run locally on your machine. Agent and Developer subscriptions unlock additional MCP tools (scan_file, propose_fix, verify_fix, scan_staged, CI gate), but the scanner itself never uploads your source code. You can run the CLI offline forever.'
    },
    {
      q: 'How does the 7-day money-back guarantee work?',
      a: 'Agent and Developer subscriptions can be canceled within 7 days for a full refund. No questions asked.'
    },
    {
      q: 'How long are access tokens valid?',
      a: 'Agent and Developer tokens are valid for 1 year and auto-renew with your subscription. Free tokens have no expiry. If your subscription lapses, the CLI reverts to free-tier limits.'
    },
    {
      q: 'What is your refund policy?',
      a: 'Agent and Developer subscriptions include a 7-day money-back guarantee. See our <a href="refund.html">refund policy</a>.'
    },
    {
      q: 'What data does SimpleBeacon transmit?',
      a: '<strong>Zero transmission during scans.</strong> The deterministic scan runs entirely on your machine reading local files. No source code, file paths, or credentials are uploaded. The optional team dashboard only receives anonymized scan statistics (issue counts, gate pass/fail).'
    },
    {
      q: 'Can I pay by invoice or ACH?',
      a: 'Enterprise contracts support invoice, ACH, wire transfer, and NET-30 terms. <a href="contact.html?topic=enterprise">Contact us</a> for a tailored proposal.'
    },
    {
      q: 'How can I verify that my source code never leaves my machine?',
      a: 'You can independently audit our zero-upload claim in three ways: (1) Open Chrome/Firefox DevTools (F12), go to the Network tab, and run a scan &mdash; you will see zero outbound payloads containing code. (2) Run Wireshark or tcpdump during a CLI scan to confirm zero external packet egress. (3) Enable Airplane Mode and verify both the browser sandbox and CLI scanner operate flawlessly offline. See our <a href="security.html">Security & Trust</a> page for detailed audit steps.'
    },
    {
      q: 'Does SimpleBeacon use a Content Security Policy (CSP)?',
      a: 'Yes. Our production site enforces strict <code>connect-src</code> CSP headers that restrict outbound connections to auth and billing endpoints only (https://simplebeacon.ai, Stripe, Cloudflare Insights). The browser itself hard-blocks any accidental or rogue code upload attempt that violates this policy. You can inspect our headers with <code>curl -I https://simplebeacon.ai/dashboard/</code>.'
    }
  ]
};

// Override Stripe links from server environment configuration (falls back to hardcoded values above)
(function () {
  try {
    const apiBase = window.SIMPLEBEACON_SITE.apiBase || '';
    fetch(apiBase + '/api/config/pricing')
      .then(function (res) { if (!res.ok) return null; return res.json(); })
      .then(function (data) {
        if (!data || !data.success || !data.pricing) return;
        const cfg = window.SIMPLEBEACON_SITE;
        const p = data.pricing;
        if (p.instant && p.instant.stripeLink) {
          cfg.pricing.instant.stripeLink = p.instant.stripeLink;
          cfg.instantReportLink = p.instant.stripeLink;
        }
        if (p.executive && p.executive.stripeLink) {
          cfg.pricing.executive.stripeLink = p.executive.stripeLink;
          cfg.stripePaymentLink = p.executive.stripeLink;
        }
        if (p.euSprint && p.euSprint.stripeLink) {
          cfg.pricing.euSprint.stripeLink = p.euSprint.stripeLink;
          cfg.euAiActPackLink = p.euSprint.stripeLink;
        }
      })
      .catch(function () { /* ignore — fall back to hardcoded values */ });
  } catch (e) { /* ignore */ }
})();