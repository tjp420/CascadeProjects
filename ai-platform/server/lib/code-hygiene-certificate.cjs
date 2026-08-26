// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Code Hygiene Certificate — co-branded executive HTML (print → PDF).
 */

const crypto = require("crypto");
const { escapeHtml } = require("./code-roadmap-export.cjs");
const { resolveLogoSrc } = require("./agency-branding-store.cjs");

const SIMPLEBEACON_BADGE_SVG =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxODAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCAxODAgNDAiPjxyZWN0IHdpZHRoPSIxODAiIGhlaWdodD0iNDAiIHJ4PSI4IiBmaWxsPSIjMTExODI3Ii8+PHRleHQgeD0iMTAiIHk9IjI2IiBmaWxsPSIjNTg2NkZmIiBmb250LWZhbWlseT0iSW50ZXIsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iMTQiIGZvbnQtd2VpZ2h0PSI3MDAiPlNpbXBsZUJlYWNvbjwvdGV4dD48dGV4dCB4PSIxMTAiIHk9IjI2IiBmaWxsPSIjOUI5QTA0IiBmb250LWZhbWlseT0iSW50ZXIsIHNhbnMtc2VyaWYiIGZvbnQtc2l6ZT0iOSI+VkVSSUZJRUQ8L3RleHQ+PC9zdmc+";

/**
 * Classify issue.
 * @param {boolean} issue
 * @returns {any}
 */
function classifyIssue(issue = {}) {
  const blob =
    `${issue.type || ""} ${issue.rule || ""} ${issue.description || ""}`.toLowerCase();
  if (/credential|secret|aws|jwt|api.key/.test(blob)) return "credential";
  if (/production.leak|sample.path|mock.path|fixtures-path/.test(blob))
    return "leak";
  if (/fiction|kpi|mock.sample|baseline.drift/.test(blob)) return "fiction";
  return "other";
}

/**
 * Summarize report.
 * @param {number} report
 * @returns {any}
 */
function summarizeReport(report = {}) {
  const issues = Array.isArray(report.rawIssues) ? report.rawIssues : [];
  const buckets = { credential: [], leak: [], fiction: [], other: [] };
  for (const issue of issues) {
    buckets[classifyIssue(issue)].push(issue);
  }

  /**
   * Max severity.
   * @param {any} list
   * @returns {any}
   */
  const maxSeverity = (list) => {
    const order = { critical: 4, high: 3, moderate: 2, medium: 2, low: 1 };
    let max = "none";
    let score = 0;
    for (const item of list) {
      const sev = String(
        item.severity || item.severityBand || "low",
      ).toLowerCase();
      const val = order[sev] || 0;
      if (val > score) {
        score = val;
        max = sev;
      }
    }
    return max;
  };

  const gatePass = report.gate?.pass === true;
  const hasFailures = !gatePass;

  return {
    gatePass,
    hasFailures,
    qualityScore: report.qualityScore ?? 0,
    issueCount: report.issueCount ?? issues.length,
    severityCounts: report.severityCounts || {},
    buckets,
    counts: {
      credential: buckets.credential.length,
      leak: buckets.leak.length,
      fiction: buckets.fiction.length,
      other: buckets.other.length,
    },
    maxSeverity: {
      credential: maxSeverity(buckets.credential),
      leak: maxSeverity(buckets.leak),
      fiction: maxSeverity(buckets.fiction),
    },
    topFindings: issues.slice(0, 12),
  };
}

/**
 * Build certificate model.
 * @param {Object} options
 * @returns {any}
 */
function buildCertificateModel(options = {}) {
  const report = options.report || {};
  const summary = summarizeReport(report);
  const certificateId =
    options.certificate_id ||
    `sb_cert_${crypto.randomBytes(8).toString("hex")}`;

  return {
    certificateId,
    scanId: options.scan_id || certificateId.replace("sb_cert_", "sb_auth_"),
    milestone: String(options.milestone || "release").trim(),
    generatedAt:
      options.generated_at || report.generatedAt || new Date().toISOString(),
    branding: options.branding || {},
    project: {
      client_name:
        options.credentials?.projectName ||
        options.client_name ||
        options.project?.client_name ||
        "Client",
      project_name:
        options.credentials?.projectName ||
        options.project_name ||
        options.project?.project_name ||
        "Project",
      agency_name:
        options.agency_name ||
        options.branding?.agency_name ||
        options.project?.agency_name ||
        "Agency",
    },
    summary,
    verificationUrl:
      options.verification_url ||
      `https://simplebeacon.ai/verify/${certificateId}`,
  };
}

/**
 * Render findings table.
 * @param {Array} findings
 * @returns {any}
 */
function renderFindingsTable(findings = []) {
  if (!findings.length) {
    return '<p class="muted">No issues found — your code passed all checks.</p>';
  }
  const rows = findings
    .map((f) => {
      const sev = escapeHtml(String(f.severity || f.severityBand || "medium"));
      const type = escapeHtml(String(f.type || f.rule || "Finding"));
      const pathText = escapeHtml(String(f.filePath || f.path || "—"));
      const desc = escapeHtml(
        String(f.description || f.message || "").slice(0, 120),
      );
      return `<tr><td>${sev}</td><td>${type}</td><td><code>${pathText}</code></td><td>${desc}</td></tr>`;
    })
    .join("");
  return `<table class="findings"><thead><tr><th>Severity</th><th>Issue type</th><th>File</th><th>What's wrong</th></tr></thead><tbody>${rows}</tbody></table>`;
}

/**
 * Render certificate html.
 * @param {any} model
 * @returns {any}
 */
function renderCertificateHtml(model) {
  const branding = model.branding || {};
  const brandColor = branding.brand_color_hex || "#2563EB";
  const logoSrc = resolveLogoSrc(branding);
  const agencyLogoHtml = logoSrc
    ? `<img src="${escapeHtml(logoSrc)}" alt="${escapeHtml(model.project.agency_name)}" />`
    : `<div class="logo-fallback">${escapeHtml(model.project.agency_name)}</div>`;

  const statusClass = model.summary.hasFailures
    ? "status-review"
    : "status-pass";
  const statusLabel = model.summary.hasFailures
    ? "ACTION REQUIRED — fix issues before release"
    : "PASSED — code is ready for release";
  const dateLabel = new Date(model.generatedAt).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const milestoneLabel =
    model.milestone.charAt(0).toUpperCase() + model.milestone.slice(1);

  const recs = [];
  if (model.summary.counts.credential > 0)
    recs.push(
      "Remove hardcoded passwords and API keys from your code. If any were real, rotate them immediately.",
    );
  if (model.summary.counts.leak > 0)
    recs.push(
      "Remove test/sample data references from production code — these can cause real users to see fake data.",
    );
  if (model.summary.counts.fiction > 0)
    recs.push(
      "Replace AI-generated placeholder values (fake metrics, dummy numbers) with real data from your analytics.",
    );
  if (!recs.length)
    recs.push(
      "Your code passed all quality checks. Keep up the good work through the next release milestone.",
    );

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Code Hygiene Certificate — ${escapeHtml(model.project.client_name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 16mm; }
    body { font-family: 'Inter', sans-serif; color: #1F2937; margin: 0; padding: 0; background: #fff; }
    .page { page-break-after: always; padding: 8mm 0; }
    .page:last-child { page-break-after: auto; }
    .header-table { width: 100%; border-collapse: collapse; margin-bottom: 28px; }
    .agency-logo { text-align: left; vertical-align: middle; }
    .agency-logo img { max-height: 50px; max-width: 220px; }
    .logo-fallback { font-weight: 700; font-size: 18px; color: ${brandColor}; }
    .badge-logo { text-align: right; vertical-align: middle; }
    .badge-logo img { max-height: 42px; }
    .divider { height: 4px; background: ${brandColor}; margin-bottom: 24px; border-radius: 2px; }
    .title { font-size: 28px; font-weight: 800; text-transform: uppercase; letter-spacing: -0.5px; margin: 0 0 8px; }
    .subtitle { color: #6B7280; font-size: 14px; margin: 0 0 28px; }
    .meta-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; background: #F9FAFB; padding: 18px; border-radius: 8px; border: 1px solid #E5E7EB; }
    .meta-grid strong { display: inline-block; min-width: 130px; color: #374151; }
    .status-box { text-align: center; padding: 24px; border-radius: 12px; font-weight: 700; font-size: 22px; margin: 20px 0; }
    .status-pass { background: #DCFCE7; color: #15803D; border: 1px solid #BBF7D0; }
    .status-review { background: #FEF3C7; color: #B45309; border: 1px solid #FDE68A; }
    .muted { color: #6B7280; font-size: 14px; line-height: 1.6; }
    .section-title { font-size: 18px; font-weight: 700; margin: 0 0 12px; color: #111827; }
    .summary-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin: 20px 0; }
    .summary-card { background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 14px; }
    .summary-card strong { display: block; font-size: 22px; color: #111827; }
    .findings { width: 100%; border-collapse: collapse; font-size: 12px; margin-top: 12px; }
    .findings th, .findings td { border: 1px solid #E5E7EB; padding: 8px; text-align: left; vertical-align: top; }
    .findings th { background: #F3F4F6; }
    .findings code { font-size: 11px; word-break: break-all; }
    .rec-list { padding-left: 18px; line-height: 1.7; }
    .value-block { margin-top: 28px; padding: 20px; border-left: 4px solid ${brandColor}; background: #FAFAFA; }
    .print-hint { margin-top: 24px; font-size: 12px; color: #9CA3AF; }
    @media print { .print-hint { display: none; } }
  </style>
</head>
<body>
  <section class="page">
    <table class="header-table"><tr>
      <td class="agency-logo">${agencyLogoHtml}</td>
      <td class="badge-logo"><img src="${SIMPLEBEACON_BADGE_SVG}" alt="SimpleBeacon Verified" /></td>
    </tr></table>
    <div class="divider"></div>
    <h1 class="title">Code Hygiene Certificate</h1>
    <p class="subtitle">Automated Code Quality &amp; Security Assessment</p>
    <div class="meta-grid">
      <div>
        <div><strong>Project Name:</strong> ${escapeHtml(model.project.project_name)}</div>
        <div><strong>Development Agency:</strong> ${escapeHtml(model.project.agency_name)}</div>
        <div><strong>Target Client:</strong> ${escapeHtml(model.project.client_name)}</div>
      </div>
      <div>
        <div><strong>Scan Milestone:</strong> ${escapeHtml(milestoneLabel)}</div>
        <div><strong>Date Generated:</strong> ${escapeHtml(dateLabel)}</div>
        <div><strong>Scan Integrity ID:</strong> ${escapeHtml(model.scanId)}</div>
      </div>
    </div>
    <div class="status-box ${statusClass}">${statusLabel}</div>
    <p class="muted">This codebase was automatically scanned for security risks, code quality issues, and AI-generated errors. The scan checked for hardcoded passwords/keys, test data in production code, and AI placeholder values. Quality score: <strong>${model.summary.qualityScore}/100</strong> · Issues found: <strong>${model.summary.issueCount}</strong>.</p>
    <p class="print-hint">Print this page (Ctrl+P / Cmd+P) → Save as PDF · Recommended filename: <code>${escapeHtml(model.certificateId)}.pdf</code></p>
  </section>

  <section class="page">
    <div class="divider"></div>
    <h2 class="section-title">What Was Checked</h2>
    <p class="muted">${escapeHtml(model.project.client_name)} — ${escapeHtml(model.project.project_name)}</p>
    <div class="summary-grid">
      <div class="summary-card"><span>Hardcoded passwords &amp; API keys</span><strong>${model.summary.counts.credential}</strong><span class="muted">Highest severity: ${escapeHtml(model.summary.maxSeverity.credential)}</span></div>
      <div class="summary-card"><span>Test data in production code</span><strong>${model.summary.counts.leak}</strong><span class="muted">Highest severity: ${escapeHtml(model.summary.maxSeverity.leak)}</span></div>
      <div class="summary-card"><span>AI-generated placeholder values</span><strong>${model.summary.counts.fiction}</strong><span class="muted">Highest severity: ${escapeHtml(model.summary.maxSeverity.fiction)}</span></div>
    </div>
    ${renderFindingsTable(model.summary.topFindings)}
    <h3 class="section-title" style="margin-top:28px">What you should do next</h3>
    <ol class="rec-list">${recs.map((r) => `<li>${escapeHtml(r)}</li>`).join("")}</ol>
  </section>

  <section class="page">
    <div class="divider"></div>
    <div class="value-block">
      <h2 class="section-title">Why this matters for ${escapeHtml(model.project.client_name)}</h2>
      <ul class="rec-list">
        <li><strong>Security:</strong> No hardcoded passwords or API keys were found in the code (or issues were identified and need fixing).</li>
        <li><strong>Quality:</strong> Test data is not leaking into production paths (or issues were identified for cleanup).</li>
        <li><strong>AI hygiene:</strong> AI-generated placeholder values have been checked and documented for review.</li>
        <li><strong>Read-only:</strong> The scan did not modify your code — it only read and analyzed files.</li>
      </ul>
      <p class="muted" style="margin-top:16px">Agency: ${escapeHtml(model.project.agency_name)}${branding.contact_email ? ` · ${escapeHtml(branding.contact_email)}` : ""}</p>
      <p class="muted">SimpleBeacon verification · Certificate ${escapeHtml(model.certificateId)} · ${escapeHtml(model.verificationUrl)}</p>
    </div>
  </section>
</body>
</html>`;
}

module.exports = {
  summarizeReport,
  buildCertificateModel,
  renderCertificateHtml,
};
