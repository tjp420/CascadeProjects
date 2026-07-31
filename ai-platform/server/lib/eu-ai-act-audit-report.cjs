// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Live EU AI Act readiness PDF/HTML from .simplebeacon/eu-ai-act-*.json artifacts.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const { readJsonFileCached } = require('./json-file-cache.cjs');
const { resolvePlatformRoot } = require('./simplebeacon-proxy.cjs');

const ARTIFACT_NAMES = {
  report: 'eu-ai-act-report.json',
  compliance: 'eu-ai-act-compliance.json',
  assessment: 'eu-ai-act-assessment.json',
};

/**
 * Escape html.
 * @param {any} value
 * @returns {any}
 */
function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Read json sync.
 * @param {string} filePath
 * @returns {any}
 */
function readJsonSync(filePath) {
  return readJsonFileCached(filePath);
}

/**
 * Resolve platform root for path.
 * @param {string} inputPath
 * @param {any} fallbackRoot
 * @returns {any}
 */
function resolvePlatformRootForPath(inputPath, fallbackRoot) {
  const raw = String(inputPath || '').trim();
  if (!raw) return path.resolve(fallbackRoot || process.cwd());
  try {
    const { platformRoot } = resolvePlatformRoot(path.resolve(raw));
    return platformRoot;
  } catch {
    return path.resolve(raw);
  }
}

/**
 * Load eu ai act artifacts.
 * @param {Object} options
 * @returns {any}
 */
async function loadEuAiActArtifacts(options = {}) {
  const platformRoot = resolvePlatformRootForPath(options.projectPath, options.platformRoot);
  const simplebeaconDir = path.join(platformRoot, '.simplebeacon');
  const report = readJsonSync(path.join(simplebeaconDir, ARTIFACT_NAMES.report));
  const compliance = readJsonSync(path.join(simplebeaconDir, ARTIFACT_NAMES.compliance));
  const assessment = readJsonSync(path.join(simplebeaconDir, ARTIFACT_NAMES.assessment));

  if (!report && !compliance && !assessment) {
    const err = new Error(
      'No EU AI Act sprint artifacts found. Run Analyze → EU AI Act sprint first ' +
        '(writes .simplebeacon/eu-ai-act-*.json).'
    );
    err.code = 'eu_ai_act_artifacts_missing';
    throw err;
  }

  return { platformRoot, report, compliance, assessment };
}

/**
 * Unique eu items.
 * @param {Array} items
 * @param {number} limit
 * @returns {any}
 */
function uniqueEuItems(items, limit = 8) {
  const seen = new Set();
  const out = [];
  for (const item of items || []) {
    const key = `${item.file || item.filePath}:${item.description || item.type}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(item);
    if (out.length >= limit) break;
  }
  return out;
}

/**
 * Collect eu finding items.
 * @param {number} report
 * @param {any} assessment
 * @returns {any}
 */
function collectEuFindingItems(report, assessment) {
  const fromAssessment = assessment?.findings?.euAiAct?.items;
  if (Array.isArray(fromAssessment) && fromAssessment.length) {
    return uniqueEuItems(fromAssessment, 8);
  }
  const raw = report?.rawIssues || report?.detectedIssues || [];
  return uniqueEuItems(
    raw
      .filter((issue) =>
        /eu ai act|ai system|semantic integration/i.test(
          String(issue.type || issue.description || '')
        )
      )
      .map((issue) => ({
        file: issue.file || issue.filePath || (issue.affectedFiles || [])[0] || '—',
        description: issue.description || issue.type || 'EU AI Act signal',
        recommendedAction:
          issue.recommendedAction ||
          issue.recommendation ||
          'Review EU AI Act transparency obligations',
      })),
    8
  );
}

/**
 * Build report id.
 * @returns {any}
 */
function buildReportId() {
  const stamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const suffix = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `SB-EUAI-${stamp}-${suffix}`;
}

/**
 * Resolve client label.
 * @param {Object} options
 * @param {number} report
 * @param {any} assessment
 * @returns {any}
 */
function resolveClientLabel(options = {}, report, assessment) {
  if (options.clientName) return options.clientName;
  const root = report?.projectRoot || assessment?.projectRoot || options.projectPath || '';
  const base = path.basename(String(root).replace(/\\/g, '/')) || 'repository';
  return base;
}

/**
 * Build eu ai act audit html.
 * @param {any} input
 * @returns {any}
 */
function buildEuAiActAuditHtml(input = {}) {
  const { compliance, assessment, report, clientName, reportId } = input;
  const rawSummary = compliance?.summary || assessment?.complianceChecklist?.summary || null;
  const euSummary = report?.euAiActSummary || assessment?.euAiActSummary || {};
  const euItems = collectEuFindingItems(report, assessment);
  const rawRules = compliance?.rules || assessment?.complianceChecklist?.rules || null;
  const generatedAt = new Date(
    compliance?.evaluatedAt || assessment?.generatedAt || report?.generatedAt || Date.now()
  ).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const creds = input.credentials || {};
  const title = resolveClientLabel(
    { clientName: creds.projectName || clientName },
    report,
    assessment
  );
  const id = reportId || buildReportId();
  const gatePass = report?.gate?.pass === true;

  // Derive checklist from gate report when dedicated compliance artifact is absent
  const gateBlocking = report?.gate?.blockingCount ?? 0;
  const gateWarnings = report?.gate?.warningCount ?? 0;
  const docCount = euSummary.documentationArtifacts ?? 0;
  const qualityScore = report?.qualityScore ?? null;

  let rules = rawRules || [];
  let summary = rawSummary || {};

  if (!rawSummary || !rawRules) {
    const syntheticRules = [
      {
        id: 'GATE-01',
        title: 'SimpleBeacon gate pass',
        status: gatePass ? 'pass' : 'fail',
        evidence: gatePass
          ? 'Gate passed with no blocking issues'
          : `Gate failed — ${gateBlocking} blocking, ${gateWarnings} warnings`,
      },
      {
        id: 'EUAI-01',
        title: 'EU AI Act scan executed',
        status: (report?.euAiActScanned ?? 0) > 0 ? 'pass' : 'skip',
        evidence: `${report?.euAiActScanned ?? 0} files scanned for EU AI Act patterns`,
      },
      {
        id: 'EUAI-02',
        title: 'Documentation artifacts present',
        status: docCount > 0 ? 'pass' : 'warn',
        evidence: `${docCount} documentation artifact(s) detected`,
      },
      {
        id: 'EUAI-03',
        title: 'No critical/high security findings',
        status: gateBlocking === 0 ? 'pass' : 'fail',
        evidence:
          gateBlocking === 0
            ? 'Zero blocking findings in gate'
            : `${gateBlocking} blocking issue(s) require remediation`,
      },
    ];
    const passed = syntheticRules.filter((r) => r.status === 'pass').length;
    const failed = syntheticRules.filter((r) => r.status === 'fail').length;
    const total = syntheticRules.length;
    summary = {
      score: qualityScore ?? Math.round((passed / total) * 100),
      passed,
      failed,
      total,
      headline: `Gate ${gatePass ? 'PASS' : 'FAIL'} · ${gateBlocking} blocking · ${gateWarnings} warning(s)`,
    };
    rules = syntheticRules;
  }

  const score = summary.score ?? qualityScore ?? '—';

  const ruleRows = rules
    .map((rule) => {
      const statusClass =
        rule.status === 'pass'
          ? 'badge-pass'
          : rule.status === 'fail'
            ? 'badge-blocked'
            : 'badge-warn';
      const statusLabel =
        rule.status === 'pass' ? 'PASS' : rule.status === 'fail' ? 'FAIL' : 'SKIP';
      return `<tr>
      <td><code>${escapeHtml(rule.id)}</code> ${escapeHtml(rule.title)}</td>
      <td><span class="badge ${statusClass}">${statusLabel}</span></td>
      <td>${escapeHtml(rule.evidence)}</td>
    </tr>`;
    })
    .join('\n');

  const findingRows = euItems.length
    ? euItems
        .map(
          (item) => `<tr>
      <td><span class="sev sev-medium">MEDIUM</span></td>
      <td><code>${escapeHtml(item.file)}</code></td>
      <td>${escapeHtml(item.description)}</td>
      <td>${escapeHtml(item.recommendedAction)}</td>
    </tr>`
        )
        .join('\n')
    : '<tr><td colspan="4" class="text-muted">No prioritized EU pattern findings in sprint artifacts.</td></tr>';

  const gateBannerClass = Number(summary.failed) > 0 || !gatePass ? 'fail' : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="dark">
  <title>EU AI Act Readiness Assessment — ${escapeHtml(title)}</title>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    @page { margin: 14mm 16mm; background: #0d1117; }
    body { font-family: Inter, system-ui, sans-serif; background: #0d1117; color: #e6edf3; margin: 0; line-height: 1.55; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .cover-page { min-height: 90vh; padding: 48px 52px; background: linear-gradient(160deg, #010409, #0d1117 45%, #161b22); border-bottom: 1px solid #30363d; page-break-after: always; }
    .cover-kicker { letter-spacing: 0.14em; text-transform: uppercase; font-size: 10pt; color: #8b949e; }
    .cover-title { font-size: 30pt; font-weight: 700; margin: 12px 0; max-width: 720px; }
    .cover-sub { color: #c9d1d9; max-width: 640px; }
    .cover-meta { font-size: 10pt; color: #8b949e; margin-top: 24px; line-height: 1.7; }
    .badge { display: inline-block; padding: 6px 14px; border-radius: 999px; font-size: 10pt; font-weight: 700; border: 1px solid #30363d; margin-right: 8px; }
    .badge-pass { background: rgba(46,164,79,.14); color: #3fb950; }
    .badge-blocked { background: rgba(248,81,73,.14); color: #f85149; }
    .badge-warn { background: rgba(210,153,34,.14); color: #d29922; }
    .badge-gold { background: rgba(210,153,34,.12); color: #e3b341; }
    main { padding: 36px 52px 48px; max-width: 920px; margin: 0 auto; }
    .section { margin-bottom: 32px; page-break-inside: avoid; }
    .section-num { color: #d29922; font-size: 10pt; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
    h2 { font-size: 20pt; margin: 0 0 12px; }
    .meta { color: #8b949e; font-size: 10pt; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 10pt; margin: 12px 0; }
    .data-table th, .data-table td { border: 1px solid #30363d; padding: 8px 10px; text-align: left; vertical-align: top; }
    .data-table th { background: #161b22; }
    .gate-banner { border: 1px solid #30363d; border-radius: 12px; padding: 16px 20px; margin: 16px 0; background: #161b22; }
    .gate-banner.fail { border-color: rgba(248,81,73,.45); }
    .gate-banner-value { font-size: 24pt; font-weight: 700; color: ${Number(summary.failed) > 0 ? '#f85149' : '#3fb950'}; }
    .kpi-strip { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 12px; margin: 16px 0; }
    .kpi { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 12px; text-align: center; }
    .kpi strong { display: block; font-size: 18pt; }
    .sev { font-size: 9pt; font-weight: 700; padding: 2px 8px; border-radius: 4px; }
    .sev-medium { background: rgba(210,153,34,.2); color: #d29922; }
    .pdf-print-hint { background: #161b22; border: 1px solid #30363d; padding: 12px 16px; border-radius: 8px; margin: 12px 52px; }
    .shield-callout { background: rgba(210,153,34,.1); border: 1px solid rgba(210,153,34,.35); border-radius: 8px; padding: 12px 16px; font-size: 10pt; color: #e3b341; max-width: 52rem; margin: 0 auto 1rem; padding-left: 52px; padding-right: 52px; }
    .disclaimer-box { border: 1px solid #30363d; background: #010409; padding: 16px; border-radius: 8px; font-size: 10pt; color: #8b949e; }
    .deadline-banner { background: rgba(210,153,34,.12); border: 1px solid rgba(210,153,34,.35); color: #e3b341; padding: 12px 16px; border-radius: 8px; margin: 16px 0; font-weight: 600; }
  </style>
</head>
<body>
  <p class="pdf-print-hint" role="note"><strong>Save as PDF:</strong> Ctrl+P (Cmd+P) → Save as PDF → enable Background graphics.</p>
  <p class="shield-callout"><strong>Reference only.</strong> EU AI Act sprint is not on our active product ladder. Active offers: $499 PDF and agency packs.</p>
  <section class="cover-page">
    <p class="cover-kicker">SimpleBeacon · EU AI Act Readiness Assessment</p>
    <h1 class="cover-title">${escapeHtml(title)}</h1>
    <p class="cover-sub">Live scan output — Annex III classification signals, Article 50 transparency, documentation completeness, and AI logging accountability. Static technical review only; not legal advice.</p>
    <div class="cover-meta">
      <div><strong>Report ID:</strong> ${escapeHtml(id)}</div>
      <div><strong>Executed:</strong> ${escapeHtml(generatedAt)}</div>
      <div><strong>Assessor:</strong> ${escapeHtml(creds.signatoryName || 'SimpleBeacon (automated + operator template)')}</div>
      <div><strong>Deadline:</strong> August 2, 2026 (EU AI Act high-risk compliance)</div>
      <div><strong>Repository:</strong> ${escapeHtml(report?.projectRoot || assessment?.projectRoot || title)}</div>
    </div>
    <div style="margin-top:24px">
      <span class="badge badge-gold">REFERENCE ONLY</span>
      <span class="badge ${gatePass ? 'badge-pass' : 'badge-blocked'}">GATE ${gatePass ? 'PASS' : 'FAIL'}</span>
      <span class="badge badge-warn">COMPLIANCE ${escapeHtml(String(score))}%</span>
      <span class="badge badge-warn">${summary.passed ?? 0}/${summary.total ?? 0} RULES PASS</span>
    </div>
  </section>
  <main>
    <section class="section">
      <div class="section-num">Section 01</div>
      <h2>EU AI Act executive summary</h2>
      <div class="deadline-banner">High-risk AI systems must comply with EU AI Act requirements by August 2026 — enterprises face fines up to 7% of global turnover.</div>
      <div class="gate-banner ${gateBannerClass}">
        <div>Readiness score</div>
        <div class="gate-banner-value">${escapeHtml(String(score))}%</div>
        <p class="meta">${escapeHtml(summary.headline || assessment?.executiveSummary?.headline || '')}</p>
      </div>
      <div class="kpi-strip">
        <div class="kpi"><strong>${euSummary.highRiskIndicators ?? 0}</strong><span>Annex III indicators</span></div>
        <div class="kpi"><strong>${euSummary.aiSystemIndicators ?? 0}</strong><span>AI integrations</span></div>
        <div class="kpi"><strong>${euSummary.transparencyGaps ?? 0}</strong><span>Art. 50 gaps</span></div>
        <div class="kpi"><strong>${euSummary.documentationArtifacts ?? 0}</strong><span>Doc artifacts</span></div>
        <div class="kpi"><strong>${report?.euAiActScanned ?? report?.ruleScopedFilesAnalyzed ?? '—'}</strong><span>Files scanned</span></div>
      </div>
      <p class="meta">Gate ${gatePass ? 'PASS' : 'FAIL'} · ${report?.gate?.blockingCount ?? 0} blocking · ${report?.gate?.warningCount ?? report?.euAiActFindings ?? 0} EU/warning signals.</p>
    </section>
    <section class="section">
      <div class="section-num">Section 02</div>
      <h2>EU AI Act compliance checklist</h2>
      <table class="data-table"><thead><tr><th>Rule</th><th>Status</th><th>Evidence</th></tr></thead><tbody>${ruleRows || '<tr><td colspan="3">No checklist in artifacts.</td></tr>'}</tbody></table>
    </section>
    <section class="section">
      <div class="section-num">Section 03</div>
      <h2>EU AI Act findings (prioritized)</h2>
      <table class="data-table"><thead><tr><th>Severity</th><th>File</th><th>Finding</th><th>Remediation</th></tr></thead><tbody>${findingRows}</tbody></table>
    </section>
    <section class="section">
      <div class="section-num">Section 04</div>
      <h2>Recommended CI gate</h2>
      <pre style="background:#010409;border:1px solid #30363d;padding:12px;border-radius:8px;overflow:auto">npx simplebeacon init --profile eu-ai-act
npx simplebeacon scan --gate
npx simplebeacon compliance --checklist eu-ai-act --gate</pre>
      <div class="disclaimer-box">This assessment is a static technical pattern review — not legal advice, formal conformity assessment, or certification under Regulation (EU) 2024/1689. Client remains responsible for legal classification and regulatory compliance.</div>
    </section>
  </main>
</body>
</html>`;
}

/**
 * Build eu ai act audit report.
 * @param {Object} options
 * @returns {any}
 */
async function buildEuAiActAuditReport(options = {}) {
  let artifacts;
  if (options.artifacts) {
    const platformRoot = options.artifacts.platformRoot || options.projectPath || process.cwd();
    artifacts = {
      platformRoot,
      report: options.artifacts.report || null,
      compliance: options.artifacts.complianceChecklist || options.artifacts.compliance || null,
      assessment: options.artifacts.assessment || null,
    };
  } else {
    artifacts = await loadEuAiActArtifacts(options);
  }
  const reportId = buildReportId();
  const html = buildEuAiActAuditHtml({
    ...artifacts,
    clientName: options.clientName,
    reportId,
  });
  return {
    html,
    filename: `${reportId}.html`,
    reportId,
    exportTier: 'eu-ai-act',
    exportTierLabel: 'EU AI Act readiness (reference)',
    platformRoot: artifacts.platformRoot,
  };
}

module.exports = {
  ARTIFACT_NAMES,
  loadEuAiActArtifacts,
  buildEuAiActAuditHtml,
  buildEuAiActAuditReport,
};
