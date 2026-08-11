// simplebeacon-ignore test-coverage
/**
 * Sample / demo report generation for marketing.
 */

const { buildLaunchReadiness, calculateAuditConfidence, buildDeterministicExecutive } = require('./executive.cjs');
const { buildBusinessRiskCounts, enrichFindings } = require('./finding-utils.cjs');
const { renderCompleteAuditHtml } = require('./html-renderer.cjs');
const { enrichRemediationRow } = require('../audit-remediation-recipes.cjs');
// simplebeacon:production-leak-intent: fixtures-path - Legitimate fixture data for audit report generation in development/demo mode
const { buildSampleAuditReportModel: buildSampleAuditReportModelFromFixtures } = require('../fixtures/sample-audit-report-data.cjs');

const ENGINE_VERSION = '1.1.0';

/**
 * Build sample audit report model.
 * @returns {any}
 */
function buildSampleAuditReportModel() {
    const model = buildSampleAuditReportModelFromFixtures(ENGINE_VERSION);
    model.readiness = buildLaunchReadiness(model);
    model.summary.confidenceScore = calculateAuditConfidence(model.summary, {
        credentialScanned: 342,
        productionLeakScanned: 298,
        schemaChecked: 12,
        schemaPassed: 12,
        ruleScopedFilesAnalyzed: 342
    });
    model.businessRiskCounts = buildBusinessRiskCounts(model);
    model.remediationRows = (model.remediationRows || []).map(enrichRemediationRow);
    return model;
}

/**
 * Build sample audit report html.
 * @param {Object} options
 * @returns {any}
 */
function buildSampleAuditReportHtml(options = {}) {
    const model = buildSampleAuditReportModel();
    const auditHtml = renderCompleteAuditHtml(model, {
        executive: buildDeterministicExecutive(model)
    });

    if (options.siteChrome === false) {
        return auditHtml;
    }

    const siteStyles = `
    .sample-site-bar {
      position: sticky; top: 0; z-index: 20;
      background: rgba(210, 153, 34, 0.12);
      border-bottom: 1px solid rgba(210, 153, 34, 0.35);
      padding: 10px 16px; font-size: 10pt; color: #e3b341;
    }
    .sample-site-bar strong { color: #f0c14b; }
    .sample-site-bar a { color: #79c0ff; font-weight: 600; margin-left: 12px; text-decoration: none; }
    .sample-site-nav {
      display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between;
      gap: 8px 16px; max-width: 920px; margin: 0 auto 0; padding: 12px 52px;
      background: rgba(13, 17, 23, 0.92);
      border-bottom: 1px solid #21262d;
      color: #e6edf3; font-size: 10pt;
      backdrop-filter: blur(12px);
    }
    .sample-site-nav .brand { font-weight: 700; letter-spacing: -0.02em; }
    .sample-site-nav a { color: #8b949e; text-decoration: none; margin-left: 14px; }
    .sample-site-nav a:hover { color: #e6edf3; }
    @media print {
      .sample-site-bar, .sample-site-nav { display: none !important; }
    }`;

    const siteBar = `
    <div class="sample-site-bar" role="status">
      <strong>Sample deliverable only.</strong> Fictional client and redacted paths.
      Paid audits use this same dark layout with your repository&rsquo;s actual findings.
      <a href="/">Home</a><a href="/pricing">Pricing</a><a href="/" data-stripe-checkout>Book audit &mdash; $499</a>
    </div>
    <div class="sample-site-nav">
      <span class="brand">🛡️ SimpleBeacon</span>
      <span><a href="/">Home</a><a href="/sample-report">Sample report</a><a href="mailto:admin@simplebeacon.ai">admin@simplebeacon.ai</a></span>
    </div>`;

    return auditHtml
        .replace('</head>', `<style>${siteStyles}</style></head>`)
        .replace('<body>', `<body>${siteBar}`);
}

/**
 * Wrap sample report for website.
 * @param {any} _fullHtml
 * @returns {any}
 */
function wrapSampleReportForWebsite(_fullHtml) {
    return buildSampleAuditReportHtml({ siteChrome: true });
}

module.exports = {
    buildSampleAuditReportModel,
    buildSampleAuditReportHtml,
    wrapSampleReportForWebsite
};
