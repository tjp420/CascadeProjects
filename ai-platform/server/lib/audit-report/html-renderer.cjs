// simplebeacon-ignore test-coverage
/**
 * Complete audit HTML renderer — assembles the full HTML document from section builders.
 */

const { escapeHtml } = require("../code-roadmap-export.cjs");
const { getAuditReportStyles } = require("../audit-report-styles.cjs");
const { markdownToHtml } = require("../audit-report-markdown.cjs");
const {
  formatReportTimestamp,
  formatScanDuration,
} = require("../audit-report-utils.cjs");
const {
  buildVerificationCommand,
} = require("../audit-remediation-recipes.cjs");
const {
  renderCategoryRollupRows,
  renderDeveloperRemediationRows,
} = require("../audit-report-html-rows.cjs");
const { buildDeterministicExecutive } = require("./executive.cjs");
const {
  MAX_REMEDIATION_ROWS,
  buildBusinessRiskCounts,
  redactPathForDisplay,
  formatLedgerFilesScanned,
} = require("./finding-utils.cjs");
const {
  buildCoverPresentation,
  buildExecutiveDashboardBanner,
  buildExecutiveKpiStrip,
} = require("./html-sections.cjs");

/**
 * Render complete audit html.
 * @param {any} model
 * @param {Object} options
 * @returns {any}
 */
function renderCompleteAuditHtml(model, options = {}) {
  const exec = options.executive || buildDeterministicExecutive(model);
  const s = model.summary;
  const risk = model.businessRiskCounts || buildBusinessRiskCounts(model);
  const cover = buildCoverPresentation(model);
  const tier = cover.tier;
  const executiveBanner = buildExecutiveDashboardBanner(model);
  const executiveKpis = buildExecutiveKpiStrip(model);
  const verificationCommand = buildVerificationCommand(model.projectPath);
  const narrativeLine = options.aiEnhanced
    ? `Executive narrative refined by ${escapeHtml(options.aiProvider || "AI")} · all metrics and remediation rows are deterministic from scan JSON`
    : "Deterministic executive narrative and remediation mapping generated directly from complete scan JSON — no AI inference on counts or findings.";

  const platformCell = model.platformRoot
    ? " · platform <code>" +
      escapeHtml(redactPathForDisplay(model.platformRoot)) +
      "</code>"
    : "";
  const scanDurationNote = model.scanDurationMs
    ? " · execution " + escapeHtml(formatScanDuration(model.scanDurationMs))
    : "";
  const qualityScoreCell =
    (s.qualityScore != null ? escapeHtml(String(s.qualityScore)) + "%" : "—") +
    " · code health " +
    (s.codebaseHealth != null
      ? escapeHtml(String(s.codebaseHealth)) + "%"
      : "—") +
    " · audit confidence " +
    (s.confidenceScore != null
      ? escapeHtml(String(s.confidenceScore)) + "/100"
      : "—");
  const section03IntroSuffix =
    s.codebaseFindingsRaw > (model.remediationRows?.length || 0)
      ? " from " +
        Number(s.codebaseFindingsRaw).toLocaleString() +
        " total scan match(es)"
      : "";
  const section03CapCallout =
    (model.remediationRows || []).length >= MAX_REMEDIATION_ROWS
      ? '<div class="callout">Section 03 lists the first <strong>' +
        MAX_REMEDIATION_ROWS +
        "</strong> prioritized runtime-path rows. Every row is complete — nothing is cut mid-sentence. Export the complete-scan JSON for the full match list.</div>"
      : "";
  const tierExclusionCallout =
    s.documentationFindings > 0 || s.generalFindings > 0
      ? '<div class="callout"><strong>' +
        s.documentationFindings.toLocaleString() +
        " documentation-tier</strong> and <strong>" +
        (s.generalFindings || 0).toLocaleString() +
        " tooling/script-tier</strong> markers were excluded from Section 03 — they are tracked for hygiene but not release blockers.</div>"
      : "";
  const categoryScopeNote = s.findingsTruncated
    ? " (" +
      Number(s.codebaseFindingsRaw).toLocaleString() +
      " total scan matches before cap)"
    : "";
  const consolidationMeta = model.consolidationSummary
    ? '<p class="meta">Consolidation: ' +
      escapeHtml(String(model.consolidationSummary.exactDuplicateGroups ?? 0)) +
      " duplicate group(s) · " +
      escapeHtml(String(model.consolidationSummary.jsonFilesAnalyzed ?? "—")) +
      " JSON files hashed.</p>"
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <meta name="theme-color" content="#0d1117">
  <title>${escapeHtml(cover.pageTitle)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>${getAuditReportStyles()}
  </style>
</head>
<body>
  <section class="cover-page">
    <p class="cover-kicker">${escapeHtml(cover.kicker)}</p>
    <h1 class="cover-title">${escapeHtml(model.client)}</h1>
    <p class="cover-sub">${escapeHtml(cover.subtitle)}</p>
    <div class="cover-meta">
      <div><strong>Report ID:</strong> ${escapeHtml(model.reportId)}</div>
      <div><strong>Executed:</strong> ${escapeHtml(formatReportTimestamp(model.generatedAt))}</div>
      <div><strong>Client:</strong> ${escapeHtml(model.company)}</div>
      <div><strong>Assessor:</strong> ${escapeHtml(model.assessor)}</div>
      <div><strong>Engine:</strong> ${escapeHtml(model.engineLabel)}</div>
      <div><strong>Repository:</strong> ${escapeHtml(model.repositoryLabel)} / ${escapeHtml(model.branch)}</div>
    </div>
    <div class="cover-badges">
      ${cover.badges}
    </div>
    ${cover.supplementaryCallout}
    <p class="confidential">Prepared for authorized business and engineering recipients. This document combines executive risk metrics for leadership and deterministic remediation mapping for developers.</p>
  </section>

  <main>
    <section class="section">
      <div class="section-num">Section 01</div>
      <h2>Audit Metadata &amp; Ledger</h2>
      <p class="meta">Establishes consulting authority, scan scope, and performance evidence for this engagement.</p>
      <table class="data-table ledger-table">
        <tr><td>Client name</td><td>${escapeHtml(model.company)}</td></tr>
        <tr><td>Target repository / branch</td><td><code>${escapeHtml(model.repositoryLabel)}</code> / <code>${escapeHtml(model.branch)}</code>${platformCell}</td></tr>
        <tr><td>Timestamp</td><td>${escapeHtml(formatReportTimestamp(model.generatedAt))}</td></tr>
        <tr><td>Engine core version</td><td>${escapeHtml(model.engineLabel)}</td></tr>
        <tr><td>Scan performance ledger</td><td>${escapeHtml(formatLedgerFilesScanned(s))}${scanDurationNote}</td></tr>
        <tr><td>Report assessor</td><td>${escapeHtml(model.assessor)}</td></tr>
        <tr><td>Quality score</td><td>${qualityScoreCell}</td></tr>
      </table>
    </section>

    <section class="section">
      <div class="section-num">Section 02</div>
      <h2>Executive Dashboard (CFO View)</h2>
      <p class="meta">${narrativeLine}</p>
      ${executiveBanner}
      <table class="data-table">
        <tr><th>Risk tier</th><th>Count</th><th>Business meaning</th></tr>
        <tr>
          <td><span class="tier-dot tier-critical"></span>Critical</td>
          <td><strong>${risk.critical.toLocaleString()}</strong></td>
          <td>High-risk cloud exposure — private keys, AWS/Stripe/API tokens in source</td>
        </tr>
        <tr>
          <td><span class="tier-dot tier-high"></span>High</td>
          <td><strong>${risk.high.toLocaleString()}</strong></td>
          <td>Structural release risk — mock/sample paths referenced from production code</td>
        </tr>
        <tr>
          <td><span class="tier-dot tier-medium"></span>Medium</td>
          <td><strong>${risk.medium.toLocaleString()}</strong></td>
          <td>AI-fiction and hygiene patterns — placeholders, fake KPIs, debug artifacts</td>
        </tr>
      </table>
      <div class="exec-box">
        <p>${escapeHtml(exec.intro)}</p>
        <p class="exec-headline">${escapeHtml(exec.headline)}</p>
        <ol>${(exec.priorities || []).map((p) => `<li>${escapeHtml(p)}</li>`).join("")}</ol>
      </div>
      <div class="kpi-strip">
        ${executiveKpis}
      </div>
    </section>

    <section class="section">
      <div class="section-num">Section 03</div>
      <h2>Developer Action Plan (Technical Recipe Book)</h2>
      <p class="meta">Each row maps scan JSON to a full remediation chain: raw file flag → business impact → safe copy-paste fix recipe. Showing up to ${MAX_REMEDIATION_ROWS} prioritized rows${section03IntroSuffix}.</p>
      <table class="data-table remediation-recipe-table">
        <tr><th>Severity</th><th>File &amp; snippet</th><th>Rule triggered</th><th>Why it breaks (impact)</th><th>Safe code fix recipe</th></tr>
        ${renderDeveloperRemediationRows(model.remediationRows || [], s)}
      </table>
      ${section03CapCallout}
      ${tierExclusionCallout}
      <div class="verify-block">
        <h3>Local verification before re-submit</h3>
        <p class="meta">After engineering applies the recipes above, prove a clean gate locally — without waiting for a re-audit.</p>
        <div class="command-box">${escapeHtml(verificationCommand)}</div>
      </div>
      <h3>Category distribution (runtime scope)</h3>
      <p class="meta">Counts below reflect runtime-path findings included in this audit sample${categoryScopeNote}.</p>
      <table class="data-table">
        <tr><th>Category</th><th>Total</th><th>Production paths</th><th>High</th><th>Med / Low</th></tr>
        ${renderCategoryRollupRows(model.categoryRollup)}
      </table>
    </section>

    <section class="section">
      <div class="section-num">Section 04</div>
      <h2>Compliance &amp; Git Gate Recommendations</h2>
      <p class="meta">Continuous evaluation checklist and automated prevention steps for the engineering team.</p>
      <h3>Continuous evaluation checklist</h3>
      ${markdownToHtml(model.markdown.compliance)}
      <h3>Automated next step — local pre-commit hook</h3>
      <div class="command-box">npx simplebeacon hook install</div>
      <p class="meta">Install the open-source local hook so credential, mock-path, and fiction KPI patterns cannot re-enter the repository before commit.</p>
      <h3>Recommended CI gate</h3>
      <div class="command-box">npx simplebeacon scan --gate --format json --output .simplebeacon/report.json</div>
      <p class="meta">Add <code>.github/workflows/simplebeacon-gate.yml</code> from Simplebeacon examples so pull requests fail on configured high-severity findings.</p>
      <div class="disclaimer-box">
        <strong>Independent disclaimer.</strong> This assessment is an opinion-based, static technical review of the source files and configured scan paths at the time of evaluation. It is not a legal compliance guarantee, formal penetration test, SOC 2 attestation, or certification that the system is secure in production. The client remains responsible for remediation, release authorization, and ongoing security posture.
      </div>
    </section>

    ${
      tier.showSignOffBlock
        ? `
    <section class="section signoff-section">
      <div class="section-num">Section 05</div>
      <h2>Simplebeacon production compliance sign-off</h2>
      <p class="meta">Formal handoff seal — complete after remediations and a zero Critical/High re-scan.</p>
      <div class="signoff-grid">
        <span class="signoff-check"><span class="signoff-box" aria-hidden="true"></span> STAGE 1: Line-by-line remediation applied by engineering team.</span>
        <span class="signoff-check"><span class="signoff-box" aria-hidden="true"></span> STAGE 2: Zero-dependency re-scan executed (0 Critical/High flags remaining).</span>
      </div>
      <div class="signoff-signature">
        <span>Approved for production handoff by:</span>
        <span class="signoff-line">&nbsp;</span>
        <span class="signoff-role">CTO / Lead Architect · Date: _______________</span>
      </div>
    </section>
    `
        : `
    <section class="section signoff-section">
      <div class="section-num">Section 05</div>
      <h2>Production compliance sign-off</h2>
      <p class="meta">Not applicable for supplementary deliverables. Run Analyze → Complete (gate + codebase) for a unified handoff PDF, or combine gate attestation and codebase audit exports.</p>
    </section>
    `
    }

    <section class="section">
      <div class="section-num">Appendix</div>
      <h2>Methodology &amp; scan scope</h2>
      <ul>${model.scopeLines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>
      ${consolidationMeta}
    </section>

    <div class="footer">
      <p><strong>Report ID ${escapeHtml(model.reportId)}</strong> · Generated ${escapeHtml(formatReportTimestamp(model.generatedAt))} by Simplebeacon</p>
      <p>Print this document (Ctrl+P / Cmd+P) → Destination: <strong>Save as PDF</strong> · Recommended filename: <code>${escapeHtml(model.reportId)}.pdf</code></p>
    </div>
  </main>
</body>
</html>`;
}

module.exports = {
  renderCompleteAuditHtml,
};
