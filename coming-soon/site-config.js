// SimpleBeacon Site Configuration
window.SIMPLEBEACON_SITE = window.SIMPLEBEACON_SITE || {
  env: 'production',
  githubUrl: 'https://github.com/tjp420/simplebeacon',
  sampleReportUrl: 'sample-report.html',
  sampleCertificateUrl: 'sample-certificate.html',
  sampleEuAiActReportUrl: null,
  pricingUrl: 'pricing.html',
  communityUrl: 'community.html',
  contactUrl: 'contact.html',
  contactPageUrl: 'contact.html',
  termsUrl: 'terms.html',
  privacyUrl: 'privacy.html',
  refundUrl: 'refund.html',
  cloudTeamsUrl: null,
  auditEmail: 'audit@simplebeacon.ai',

  // Unified pricing source of truth
  pricing: {
    free: {
      name: 'Free AI Slop Audit',
      price: 0,
      stripeLink: null,
      testStripeLink: null
    },
    instant: {
      name: 'Instant Website Report',
      price: 19,
      stripeLink: 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07',
      testStripeLink: null
    },
    executive: {
      name: 'Executive Risk Certificate',
      price: 499,
      stripeLink: 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05',
      testStripeLink: null
    },
    euSprint: {
      name: 'EU AI Act Sprint',
      price: 2499,
      stripeLink: 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06',
      testStripeLink: null
    }
  },

  // Legacy aliases for backward compatibility
  instantReportLink: 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07',
  stripePaymentLink: 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05',
  euAiActPackLink: 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06',

  apiBase: (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? '' : 'https://simplebeacon.onrender.com',
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
    executive: {
      label: '$499 Exec Cert',
      price: '$499',
      title: 'Upload Your Scan Report',
      subtitle: 'Full 11-engine analysis + EU AI Act readiness. Certificate ZIP generated locally.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Paste the license token from your $499 payment confirmation email.'
    },
    euai: {
      label: 'EU AI Act Sprint',
      price: '$2,499',
      title: 'Upload Your EU AI Act Scan',
      subtitle: 'Upload your full-coverage scan to generate the EU AI Act Readiness Report.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --complete --gate --offline',
      tokenHelp: 'Paste the license token from your $2,499 EU AI Act Sprint confirmation email.'
    },
    universal: {
      label: 'Operator License',
      price: '',
      title: 'Upload Your Scan Report',
      subtitle: 'Your scan ran locally on your machine. Upload the report JSON to generate your Operator Vault Certificate.',
      showUpload: true,
      scanCommand: 'npx simplebeacon scan --gate --offline',
      tokenHelp: 'Paste any SimpleBeacon license token — works with any tier or custom label.'
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
    instant: ['gate', 'instant'],
    executive: ['gate', 'codebase', 'compliance', 'hygiene', 'complete'],
    euai: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete'],
    universal: ['gate', 'codebase', 'euai', 'compliance', 'hygiene', 'complete']
  },

  // Feature comparison table — pricing.html source of truth
  features: [
    { name: 'Price', free: '$0', instant: '$19', exec: '<strong>$499</strong>', sprint: '<strong>$2,499</strong>' },
    { name: 'Zero-retention', free: '<span class="check">&#10003;</span> CLI only', instant: '<span class="check">&#10003;</span> Browser sandbox', exec: '<span class="check">&#10003;</span> Browser sandbox', sprint: '<span class="check">&#10003;</span> Browser sandbox' },
    { name: 'Gate attestation (credentials, AI slop)', free: '<span class="check">&#10003;</span>', instant: '<span class="check">&#10003;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Consolidation scan (duplicates, monorepo)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Mock data / fixture detection', free: '<span class="cross">&mdash;</span>', instant: '<span class="check">&#10003;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Roadmap markers (TODO/FIXME)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Codebase analysis (file types, LOC)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'File reduction (unused assets, dupes)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Data quality (empty JSON)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Cleanup assistant (debug artifacts)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'npm audit (package.json inventory)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Compliance (license/governance files)', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'EU AI Act readiness assessment', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Certificate ZIP (PDF + 13 JSON files)', free: '<span class="cross">&mdash;</span>', instant: '<span class="check">&#10003;</span> PDF only', exec: '<span class="check">&#10003;</span>', sprint: '<span class="check">&#10003;</span>' },
    { name: 'Analyst access', free: '<span class="cross">&mdash;</span>', instant: '<span class="cross">&mdash;</span>', exec: '<span class="cross">&mdash;</span>', sprint: '<span class="check">&#10003;</span> (30 days)' },
    { name: 'Token validity', free: 'Unlimited', instant: '7 days', exec: '90 days', sprint: '30 days' }
  ],

  // FAQ entries — pricing.html source of truth
  faqs: [
    {
      q: 'What is the $19 Instant Report and how does zero-retention work?',
      a: 'The $19 Instant Code Hygiene Report runs a gate scan on your local repository for credentials, mock data, and AI imports. Pay via Stripe, run the scan in your browser sandbox, and download a PDF certificate within 60 seconds. <strong>Zero-retention means no source code ever leaves your machine.</strong> The scan runs entirely in your browser. We do not store, log, or transmit your source code. Ever.'
    },
    {
      q: 'What is the Free Risk Assessment and what do I get?',
      a: 'The complimentary Risk Assessment runs entirely on your machine using our open-source CLI. You get an A&ndash;F grade, a preliminary risk profile for compliance teams, a list of AI-generated slop and credential leaks, and a remediation checklist. No source code ever leaves your infrastructure. Use it to evaluate SimpleBeacon before purchasing an Executive Certificate.'
    },
    {
      q: 'How is the Executive Risk Certificate different from the Free Risk Assessment?',
      a: 'The Free Risk Assessment runs a lightweight hygiene sweep (gate scan). The $499 Executive Risk Certificate runs all 15 SimpleBeacon analysis engines — gate, consolidation, mock data, roadmap, codebase, file reduction, data quality, cleanup, npm audit, compliance, EU AI Act readiness, dependency vulns, build readiness, AI indicators, and governance. It exports a ZIP containing a printable PDF certificate with cryptographic SHA-256 seal, plus 15 per-module JSON files with full findings. Designed for auditor presentations, due diligence documentation, regulatory filings, and vendor handoff.'
    },
    {
      q: 'Do I need a SaaS subscription to use these deliverables?',
      a: 'No. The $19 Instant Report and $2,499 EU AI Act Sprint are self-service — download your PDF instantly from <a href="certificate-upload.html">certificate-upload.html</a>. Other board deliverables are one-time engagements — you run the scan locally, export anonymized JSON, and download your signed certificate within 48 hours. No recurring SaaS fees, no seat licenses, no feature gates.'
    },
    {
      q: 'How does the EU AI Act Sprint self-service workflow work?',
      a: 'After payment, you receive a license token and dashboard URL instantly. The token unlocks the EU AI Act scanner in your dashboard where you can either upload your source code zip or select a local directory. The scan runs on your machine (no code leaves your infrastructure) and generates an executive PDF immediately. Download your report from <a href="certificate-upload.html">certificate-upload.html</a> — no operator review required.'
    },
    {
      q: 'Is the EU AI Act Sprint a legal conformity certification?',
      a: 'No. It is a <em>standardized technical attestation</em> — an automated cryptographic snapshot proving that as of the scan timestamp, local static-analysis detected specific compliance indicators inside the repository boundary. It scans your codebase for Annex III high-risk AI patterns, Article 50 transparency gaps, and documentation completeness. It produces an executive PDF with findings and a 30-day remediation plan. <strong>It does not make your company legally immune.</strong> For full legal conformity certification, engage a qualified EU legal firm.'
    },
    {
      q: 'How long are license tokens valid?',
      a: 'License tokens expire based on your tier:<br><br><strong>Unlimited</strong> — Free AI Slop Audit (open-source CLI, no expiry)<br><strong>7 days</strong> — $19 Instant Report<br><strong>90 days</strong> — Executive Risk Certificate ($499)<br><strong>30 days</strong> — EU AI Act Sprint ($2,499) &amp; Continuous Shield<br><br>Paid tokens unlock the dashboard immediately after purchase. You can run unlimited scans during the validity period. After expiry, simply purchase a new token or <a href="contact.html?topic=enterprise">contact us</a> for a Continuous Shield subscription with auto-renewal.'
    },
    {
      q: 'What is your refund policy?',
      a: 'License tokens are digital keys consumed immediately upon issuance. For self-service tiers ($19, $499), we offer a <strong>48-hour satisfaction window</strong> — if the scanner fails to process your repository or the deliverable is materially defective, contact us for a replacement token or refund. Enterprise contracts ($2,499+) include a 14-day review period with direct analyst support. See our <a href="refund.html">refund policy</a> for complete terms.'
    },
    {
      q: 'What data does SimpleBeacon transmit during a scan?',
      a: '<strong>Deterministic scan:</strong> Zero transmission. The scan runs entirely on your machine reading local files. No source code, file paths, or credentials are uploaded.<br><br><strong>Optional AI summary:</strong> Only anonymized scan statistics (issue counts, gate pass/fail, redacted path labels like "…/my-project/src") are sent to your chosen AI provider. Full file paths and source code are never included.'
    },
    {
      q: 'Can I pay by invoice or ACH instead of Stripe?',
      a: 'For orders over $5,000 or enterprise contracts, we accept invoice, ACH, and wire transfer. <a href="contact.html?topic=enterprise">Contact us</a> for a tailored proposal and custom billing terms.'
    }
  ]
};

// Override Stripe links from server environment configuration (falls back to hardcoded values above)
(function () {
  try {
    var apiBase = window.SIMPLEBEACON_SITE.apiBase || '';
    fetch(apiBase + '/api/config/pricing')
      .then(function (res) { return res.json(); })
      .then(function (data) {
        if (!data || !data.success || !data.pricing) return;
        var cfg = window.SIMPLEBEACON_SITE;
        var p = data.pricing;
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