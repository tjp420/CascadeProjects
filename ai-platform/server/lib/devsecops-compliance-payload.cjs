/**
 * DevSecOps compliance payload — gate + repository health unified scoring.
 */

const { buildTrustVerificationPayload } = require('./trust-verification-payload.cjs');
const { buildRepositoryHealthPayload } = require('./repository-health-payload.cjs');

/**
 * Optimization compliance label.
 * @param {any} healthHeadline
 * @returns {any}
 */
function optimizationComplianceLabel(healthHeadline) {
  if (!healthHeadline) return 'unknown';
  const score = healthHeadline.repositoryHealthScore ?? 0;
  if (score >= 85) return 'good';
  if (score >= 70) return 'partial';
  return 'needs_attention';
}

/**
 * Build dev sec ops compliance payload.
 * @param {Object} options
 * @returns {any}
 */
function buildDevSecOpsCompliancePayload(options = {}) {
  const trust = buildTrustVerificationPayload(options);
  const health = trust.repositoryHealth || buildRepositoryHealthPayload(options);
  const gate = trust.headline || {};
  const repo = health.headline || {};

  const securityScore = gate.qualityScore ?? null;
  const repositoryHealthScore = repo.repositoryHealthScore ?? null;
  const optimizationCompliance = optimizationComplianceLabel(repo);

  return {
    type: 'simplebeacon-devsecops-compliance',
    generatedAt: new Date().toISOString(),
    verificationId: trust.verificationId,
    headlineSource: trust.headlineSource || null,
    headlineReason: trust.headlineReason || null,
    securityScore,
    repositoryHealthScore,
    optimizationCompliance,
    gatePass: gate.gatePass ?? null,
    securityIssues: gate.issueCount ?? null,
    technicalDebtItems: repo.reductionOpportunities ?? null,
    duplicateGroups: repo.duplicateGroups ?? null,
    optimizationPotential: repo.optimizationPotential ?? null,
    remediationAvailable: Boolean((repo.mergeCandidates ?? 0) > 0),
    mergePreviewAvailable: true,
    mergeAutoDeleteEnabled: false,
    complianceNote: 'Repository optimization uses preview + confirmation — no auto-delete.',
    trust,
    repositoryHealth: health,
  };
}

/**
 * Esc.
 * @param {any} value
 * @returns {any}
 */
function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Compliance status class.
 * @param {any} label
 * @returns {any}
 */
function complianceStatusClass(label) {
  if (label === 'good') return 'pass';
  if (label === 'partial') return 'warn';
  return 'review';
}

/**
 * Build compliance html.
 * @param {any} payload
 * @returns {any}
 */
function buildComplianceHtml(payload) {
  const gate = payload.gatePass ? 'pass' : 'review';
  const gateLabel = payload.gatePass ? 'GATE PASS' : 'GATE REVIEW';
  const optClass = complianceStatusClass(payload.optimizationCompliance);
  const trust = payload.trust || {};
  const disclaimers = [...(trust.disclaimers || []), payload.complianceNote].filter(Boolean);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SimpleBeacon DevSecOps Compliance</title>
  <style>
    :root { color-scheme: dark; }
    body { font-family: Inter, Segoe UI, sans-serif; background: #0d1117; color: #e6edf3; margin: 0; line-height: 1.5; }
    .wrap { max-width: 880px; margin: 0 auto; padding: 24px 20px 48px; }
    h1 { font-size: 1.5rem; margin: 0 0 8px; }
    h2 { font-size: 1rem; margin: 0 0 8px; }
    .muted { color: #8b949e; font-size: 0.875rem; }
    .row { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-bottom: 8px; }
    .pill { font-size: 0.75rem; font-weight: 600; padding: 4px 10px; border-radius: 999px; }
    .pill.pass { background: #238636; color: #fff; }
    .pill.warn { background: #9e6a03; color: #fff; }
    .pill.review { background: #da3633; color: #fff; }
    .card { background: #161b22; border: 1px solid #30363d; border-radius: 12px; padding: 16px; margin-bottom: 16px; }
    .metrics { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 12px; margin-top: 12px; }
    .metrics div { background: #0d1117; border-radius: 8px; padding: 10px; }
    .metrics dt { font-size: 0.7rem; color: #8b949e; margin: 0; }
    .metrics dd { font-size: 1.05rem; font-weight: 600; margin: 4px 0 0; }
    ul { margin: 8px 0 0; padding-left: 1.2rem; color: #c9d1d9; font-size: 0.875rem; }
    .links { display: flex; flex-wrap: wrap; gap: 12px; margin-top: 16px; }
    a { color: #58a6ff; }
    code { font-family: ui-monospace, monospace; font-size: 0.85em; }
  </style>
</head>
<body>
  <div class="wrap">
    <div class="row">
      <h1>DevSecOps compliance snapshot</h1>
      <span class="pill ${gate}">${gateLabel}</span>
    </div>
    <p class="muted">Verification ID <code>${esc(payload.verificationId)}</code> · Generated ${esc((payload.generatedAt || '').replace('T', ' ').slice(0, 19))} UTC</p>
    <p class="muted">Headline source: <code>${esc(payload.headlineSource || 'n/a')}</code> · ${esc(payload.headlineReason || '')}</p>

    <section class="card">
      <h2>Unified scores</h2>
      <dl class="metrics">
        <div><dt>Security quality (monorepo headline)</dt><dd>${esc(payload.securityScore)}%</dd></div>
        <div><dt>Security issues</dt><dd>${esc(payload.securityIssues)}</dd></div>
        <div><dt>Repository health</dt><dd>${esc(payload.repositoryHealthScore)}/100</dd></div>
        <div><dt>Optimization compliance</dt><dd><span class="pill ${optClass}">${esc(payload.optimizationCompliance)}</span></dd></div>
        <div><dt>Savings potential</dt><dd>${esc(payload.optimizationPotential)}</dd></div>
        <div><dt>Duplicate groups</dt><dd>${esc(payload.duplicateGroups)}</dd></div>
        <div><dt>Reduction ops</dt><dd>${esc(payload.technicalDebtItems)}</dd></div>
        <div><dt>Merge preview</dt><dd>${payload.mergePreviewAvailable ? 'available' : '—'}</dd></div>
      </dl>
    </section>

    <section class="card">
      <h2>Platform gate (sample paths)</h2>
      <p class="muted">${esc(trust.platform?.scopeNote || '—')}</p>
      <dl class="metrics">
        <div><dt>Quality</dt><dd>${esc(trust.platform?.qualityScore)}%</dd></div>
        <div><dt>Issues</dt><dd>${esc(trust.platform?.issueCount)}</dd></div>
        <div><dt>Gate</dt><dd>${trust.platform?.gatePass ? 'PASS' : 'REVIEW'}</dd></div>
      </dl>
    </section>

    <section class="card">
      <h2>Monorepo (full-tree fiction sweep)</h2>
      <p class="muted">${esc(trust.monorepo?.scopeNote || '—')}</p>
      <dl class="metrics">
        <div><dt>Quality</dt><dd>${esc(trust.monorepo?.qualityScore)}%</dd></div>
        <div><dt>Issues</dt><dd>${esc(trust.monorepo?.issueCount)}</dd></div>
        <div><dt>Fiction JSON scanned</dt><dd>${esc(trust.monorepo?.fictionJsonFilesScanned)}</dd></div>
        <div><dt>High severity</dt><dd>${esc(trust.monorepo?.severityCounts?.high)}</dd></div>
      </dl>
    </section>

    <section class="card">
      <h2>Scope &amp; disclaimers</h2>
      <ul>${disclaimers.map((d) => `<li>${esc(d)}</li>`).join('')}</ul>
    </section>

    <div class="links">
      <a href="/app#/trust">Trust dashboard</a>
      <a href="/app#/repository-health">Repository health</a>
      <a href="/api/trust/verify?format=html">Trust verify</a>
      <a href="/api/optimization/compliance?format=json">JSON payload</a>
    </div>
  </div>
</body>
</html>`;
}

module.exports = {
  buildDevSecOpsCompliancePayload,
  buildComplianceHtml,
  optimizationComplianceLabel,
};
