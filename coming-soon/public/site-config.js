// SimpleBeacon Site Configuration
window.SIMPLEBEACON_SITE = window.SIMPLEBEACON_SITE || {
    env: 'production',
    githubUrl: 'https://github.com/tjp420/simplebeacon',
    // The VSIX and local-agent zip are not served from /downloads because Cloudflare Pages rejects static assets over 25 MiB.
    // Attach both to the latest GitHub release, or replace with R2 public URLs.
    vsixDownloadUrl: 'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon.vsix',
    localAgentDownloadUrl:
        'https://github.com/tjp420/simplebeacon/releases/latest/download/simplebeacon-local-agent-portable.zip',
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

    // Unified pricing source of truth
    pricing: {
        developer: {
            name: 'Free',
            price: 0,
            stripeLink: null,
            testStripeLink: null
        },
        startup: {
            name: 'Pro',
            price: 9,
            stripeLink: null,
            testStripeLink: null
        },
        compliance: {
            name: 'Compliance Suite',
            price: 399,
            stripeLink: null,
            testStripeLink: null
        },
        enterprise: {
            name: 'Enterprise Air-Gapped',
            price: null,
            stripeLink: null,
            testStripeLink: null
        }
    },

    // Legacy aliases for backward compatibility
    instantReportLink: 'https://buy.stripe.com/4gM28q83ZavR50P2GqeEo07',
    stripePaymentLink: 'https://buy.stripe.com/00w5kCbgb47t78X1CmeEo05',
    euAiActPackLink: 'https://buy.stripe.com/fZu28qesn6fB1ODftceEo06',

    apiBase:
        typeof location !== 'undefined' &&
        (location.hostname === 'localhost' ||
            location.hostname === '127.0.0.1' ||
            location.hostname === 'simplebeacon.ai' ||
            location.hostname.endsWith('.simplebeacon.pages.dev') ||
            location.hostname.endsWith('.onrender.com'))
            ? ''
            : 'https://simplebeacon.ai',
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
            subtitle:
                'Gate attestation + full certificate ZIP with all reports (executive summary, findings, remediation checklist, roadmap, explainability, dev guide, and per-module JSON). Unlimited scans. No payment required.',
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
            subtitle:
                'Your scan ran locally on your machine. Upload the report JSON to generate your Operator Vault Certificate.',
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

    // Feature comparison table — pricing.html source of truth
    features: [
        {
            name: 'Price',
            developer: 'Free',
            startup: '<strong>$9/mo</strong>',
            compliance: '<strong>$399/mo</strong>',
            enterprise: '<strong>Custom</strong>'
        },
        {
            name: 'Scans per month',
            developer: '<strong>10 local</strong>',
            startup: '<strong>Unlimited</strong>',
            compliance: '<strong>Unlimited</strong>',
            enterprise: '<strong>Unlimited</strong>'
        },
        {
            name: 'Files per scan',
            developer: '50',
            startup: '<strong>Unlimited</strong>',
            compliance: '<strong>Unlimited</strong>',
            enterprise: '<strong>Unlimited</strong>'
        },
        {
            name: 'Pipeline scans (CI)',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Developers / seats',
            developer: '1 dev',
            startup: '1 dev',
            compliance: '<strong>5 seats</strong>',
            enterprise: '<strong>Unlimited</strong>'
        },
        {
            name: 'Real-time IDE detection',
            developer: '<span class="check">&#10003;</span> 24 rules',
            startup: '<span class="check">&#10003;</span> 38 rules',
            compliance: '<span class="check">&#10003;</span> 52+ rules',
            enterprise: '<span class="check">&#10003;</span> 52+ rules'
        },
        {
            name: 'AI Slop Cop IDE rules',
            developer: '24 real-time rules',
            startup: '<strong>38 IDE rules</strong>',
            compliance: '<strong>52+ IDE rules</strong>',
            enterprise: '<strong>52+ IDE rules</strong>'
        },
        {
            name: 'CLI / Dashboard analyzers',
            developer: '<span class="check">&#10003;</span> Core',
            startup: '<span class="check">&#10003;</span> 38 modules',
            compliance: '<span class="check">&#10003;</span> 60+ engines',
            enterprise: '<span class="check">&#10003;</span> 60+ engines'
        },
        {
            name: 'Placeholder debris detection',
            developer: '<span class="check">&#10003;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Markdown fence detection',
            developer: '<span class="check">&#10003;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Fiction KPI detection',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Token bleed detection',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Custom scanner toggles',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'URL allowlist',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="cross">&mdash;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Findings shown',
            developer: '5 max',
            startup: '<strong>All</strong>',
            compliance: '<strong>All</strong>',
            enterprise: '<strong>All</strong>'
        },
        {
            name: 'Quality score',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Actionable JSON summary',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Full JSON exports',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'CI gate (GitHub Action)',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Team dashboard + trends',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Slack / email alerts',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span> Email',
            compliance: '<span class="check">&#10003;</span> Email + Slack',
            enterprise: '<span class="check">&#10003;</span> Email + Slack'
        },
        {
            name: 'EU AI Act documentation',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="cross">&mdash;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Certificate ZIP (PDF + JSON)',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="cross">&mdash;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Analyst support',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="cross">&mdash;</span>',
            compliance: '<span class="check">&#10003;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Priority support',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="check">&#10003;</span> Email',
            compliance: '<span class="check">&#10003;</span> Email + Slack',
            enterprise: '<span class="check">&#10003;</span> Dedicated engineer'
        },
        {
            name: 'Self-hosted / air-gapped',
            developer: '<span class="cross">&mdash;</span>',
            startup: '<span class="cross">&mdash;</span>',
            compliance: '<span class="cross">&mdash;</span>',
            enterprise: '<span class="check">&#10003;</span>'
        },
        {
            name: 'Support',
            developer: 'Community',
            startup: 'Priority email',
            compliance: 'Priority email + Slack',
            enterprise: 'Dedicated engineer + SLA'
        }
    ],

    // FAQ entries — pricing.html source of truth
    faqs: [
        {
            q: 'What is AI Slop Cop and how does it work?',
            a: 'AI Slop Cop is a local-first code scanner that detects AI-generated slop, exposed credentials, and compliance gaps. It runs entirely on your machine — no source code ever leaves your laptop. Install the free VS Code extension for real-time IDE squiggles with 24 rules, or use the CLI for CI gate integration with 60+ analyzer engines.'
        },
        {
            q: 'What do I get with the Free tier?',
            a: 'The Free tier includes the VS Code extension + CLI for up to 10 local scans per month. Each scan covers up to 50 files. You get real-time detection of placeholder comments, leaked markdown code fences, and empty stubs with 24 AI residue rules. No account or credit card required. Pipeline/CI scans require a paid tier.'
        },
        {
            q: 'What do I get with the Pro tier?',
            a: 'Pro ($9/mo) includes unlimited pipeline scans with unlimited files per scan. All findings are shown, quality score is visible, and you get full JSON exports with an actionable summary. Includes custom scanner toggles via Configuration-as-Code, GitHub Action CI gate, team dashboard, priority email support, and 38 CLI analyzer modules. 7-day money-back guarantee.'
        },
        {
            q: 'What do I get with the Compliance Suite tier?',
            a: 'Compliance Suite ($399/mo) is built for VC-backed startups and scaleups that need board-ready documentation. It includes unlimited scans, EU AI Act and SOC 2 artifacts, a board-ready PDF certificate ZIP, 5 team seats, team dashboard, priority email and Slack support, and quarterly compliance reviews. 7-day money-back guarantee.'
        },
        {
            q: 'What is the $149 one-time Audit Certificate?',
            a: 'The Audit Certificate is a single, corporate-card purchase for a board-ready certificate package. It includes one cryptographic certificate (PDF + JSON + remediation roadmap), EU AI Act and SOC 2 alignment, and is valid for 12 months. No subscription required. Ideal for funding rounds or external audits.'
        },
        {
            q: 'What do you get with the Enterprise Air-Gapped tier?',
            a: 'Enterprise Air-Gapped (custom pricing) is for Fortune 500, government, and healthcare organizations that require on-premise or air-gapped deployment. It includes everything in Compliance Suite plus unlimited network monorepos, SSO/SAML authentication, custom rule development, dedicated support with SLA, NET-30 invoicing, and volume discounts.'
        },
        {
            q: 'Do I need a SaaS subscription?',
            a: 'No. All AI Slop Cop scans run locally on your machine. Pro, Compliance Suite, and Enterprise Air-Gapped subscriptions unlock dashboard access and CI integration, but the scanner itself never uploads your source code. You can run the CLI offline forever.'
        },
        {
            q: 'How does the 7-day money-back guarantee work?',
            a: 'Self-service subscriptions (Pro and Compliance Suite) can be canceled within 7 days for a full refund. The $149 one-time Audit Certificate is non-refundable once the certificate has been generated. Enterprise Air-Gapped contracts include a 14-day review period with analyst support.'
        },
        {
            q: 'Is this EU AI Act compliant?',
            a: 'The Compliance Suite and Enterprise Air-Gapped tiers produce Annex III high-risk AI system documentation, Article 14 Human Oversight evaluation, and Article 50 transparency checks. This is a technical attestation, not a legal certification. For full legal conformity, engage a qualified EU legal firm.'
        },
        {
            q: 'How long are access tokens valid?',
            a: 'Pro, Compliance Suite, and Enterprise Air-Gapped tokens are valid for 1 year and auto-renew with your subscription. The $149 one-time Audit Certificate is valid for 12 months. Free tokens have no expiry. If your subscription lapses, the CLI reverts to free-tier limits.'
        },
        {
            q: 'What is your refund policy?',
            a: 'Self-service subscriptions include a 7-day money-back guarantee. The one-time Audit Certificate is non-refundable once generated. Enterprise Air-Gapped contracts include a 14-day review period with analyst support. See our <a href="refund.html">refund policy</a>.'
        },
        {
            q: 'What data does AI Slop Cop transmit?',
            a: '<strong>Zero transmission during scans.</strong> The deterministic scan runs entirely on your machine reading local files. No source code, file paths, or credentials are uploaded. The optional team dashboard only receives anonymized scan statistics (issue counts, gate pass/fail).'
        },
        {
            q: 'Can I pay by invoice or ACH?',
            a: 'Enterprise contracts support invoice, ACH, wire transfer, and NET-30 terms. <a href="contact.html?topic=enterprise">Contact us</a> for a tailored proposal.'
        },
        {
            q: 'How can I verify that my source code never leaves my machine?',
            a: 'You can independently audit our zero-upload claim in three ways: (1) Open Chrome/Firefox DevTools (F12), go to the Network tab, and run a scan — you will see zero outbound payloads containing code. (2) Run Wireshark or tcpdump during a CLI scan to confirm zero external packet egress. (3) Enable Airplane Mode and verify both the browser sandbox and CLI scanner operate flawlessly offline. See our <a href="security.html">Security & Trust</a> page for detailed audit steps.'
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
            .then(function (res) {
                if (!res.ok) return null;
                return res.json();
            })
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
            .catch(function () {
                /* ignore — fall back to hardcoded values */
            });
    } catch (e) {
        /* ignore */
    }
})();
