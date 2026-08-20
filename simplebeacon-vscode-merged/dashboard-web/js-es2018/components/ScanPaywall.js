import { escapeHtml, formatNumber } from '../utils.js';
const DEFAULT_CHECKOUT = 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';
/**
 * Build preview findings from scan result.
 * Extracts top findings grouped by type/severity for teaser display.
 * @param {any} lastResult
 * @returns {any}
 */
function buildPreviewFindings(lastResult) {
  var _a, _b, _c, _d;
  const simplebeacon =
    ((_b =
      (_a = lastResult === null || lastResult === void 0 ? void 0 : lastResult.steps) === null || _a === void 0
        ? void 0
        : _a.find((s) => s.id === 'simplebeacon')) === null || _b === void 0
      ? void 0
      : _b.report) || (lastResult === null || lastResult === void 0 ? void 0 : lastResult.report);
  const codebase =
    ((_d =
      (_c = lastResult === null || lastResult === void 0 ? void 0 : lastResult.steps) === null || _c === void 0
        ? void 0
        : _c.find((s) => s.id === 'codebase')) === null || _d === void 0
      ? void 0
      : _d.scan) || (lastResult === null || lastResult === void 0 ? void 0 : lastResult.scan);
  const issues = [
    ...((simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.rawIssues) ||
      (simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.detectedIssues) ||
      []),
    ...((codebase === null || codebase === void 0 ? void 0 : codebase.findings) || []),
  ];
  // Group by type + severity, count occurrences
  const grouped = issues.reduce((acc, issue) => {
    const type = String(issue.type || issue.category || 'Unknown').trim();
    const severity = String(issue.severity || 'low').toLowerCase();
    const key = `${severity}::${type}`;
    if (!acc[key]) acc[key] = { type, severity, count: 0, instances: 0 };
    acc[key].count += issue.count || 1;
    acc[key].instances += 1;
    return acc;
  }, {});
  // Sort: critical first, then high, then by count
  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
  return Object.values(grouped)
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity] || b.count - a.count)
    .slice(0, 5);
}
/**
 * Build trust signals from scan result.
 * @param {any} lastResult
 * @returns {any}
 */
function buildTrustSignals(lastResult) {
  var _a, _b, _c, _d, _e, _f;
  const steps = (lastResult === null || lastResult === void 0 ? void 0 : lastResult.steps) || [];
  const simplebeacon = (_a = steps.find((s) => s.id === 'simplebeacon')) === null || _a === void 0 ? void 0 : _a.report;
  const codebase = (_b = steps.find((s) => s.id === 'codebase')) === null || _b === void 0 ? void 0 : _b.scan;
  const repoInv = lastResult === null || lastResult === void 0 ? void 0 : lastResult.repositoryInventory;
  const filesScanned =
    (_f =
      (_e =
        (_c = repoInv === null || repoInv === void 0 ? void 0 : repoInv.totalFiles) !== null && _c !== void 0
          ? _c
          : (_d = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _d === void 0
            ? void 0
            : _d.codeFilesAnalyzed) !== null && _e !== void 0
        ? _e
        : simplebeacon === null || simplebeacon === void 0
          ? void 0
          : simplebeacon.ruleScopedFilesAnalyzed) !== null && _f !== void 0
      ? _f
      : null;
  const enginesRun = steps.filter((s) => s.status === 'done' || s.status === 'running').length;
  return { filesScanned, enginesRun: enginesRun || steps.length };
}
/**
 * Build public summary from scan.
 * @param {string} lastResult
 * @returns {any}
 */
export function buildPublicSummaryFromScan(lastResult) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
  if (lastResult === null || lastResult === void 0 ? void 0 : lastResult.publicSummary) return lastResult.publicSummary;
  const simplebeacon =
    ((_b =
      (_a = lastResult === null || lastResult === void 0 ? void 0 : lastResult.steps) === null || _a === void 0
        ? void 0
        : _a.find((s) => s.id === 'simplebeacon')) === null || _b === void 0
      ? void 0
      : _b.report) || (lastResult === null || lastResult === void 0 ? void 0 : lastResult.report);
  const codebase =
    ((_d =
      (_c = lastResult === null || lastResult === void 0 ? void 0 : lastResult.steps) === null || _c === void 0
        ? void 0
        : _c.find((s) => s.id === 'codebase')) === null || _d === void 0
      ? void 0
      : _d.scan) || (lastResult === null || lastResult === void 0 ? void 0 : lastResult.scan);
  const issues = [
    ...((simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.rawIssues) ||
      (simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.detectedIssues) ||
      []),
    ...((codebase === null || codebase === void 0 ? void 0 : codebase.findings) || []),
  ];
  const severityCounts = issues.reduce(
    (acc, issue) => {
      const band = String(issue.severity || 'low').toLowerCase();
      if (acc[band] != null) acc[band] += issue.count || 1;
      else acc.low += issue.count || 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
  const gatePass =
    (_e = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.gate) === null || _e === void 0
      ? void 0
      : _e.pass;
  return {
    summary: {
      filesScanned:
        (_h =
          (_g =
            (_f = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _f === void 0
              ? void 0
              : _f.codeFilesAnalyzed) !== null && _g !== void 0
            ? _g
            : simplebeacon === null || simplebeacon === void 0
              ? void 0
              : simplebeacon.ruleScopedFilesAnalyzed) !== null && _h !== void 0
          ? _h
          : null,
      status: gatePass === true ? 'PASS' : gatePass === false ? 'FAIL' : 'REVIEW',
      totalIssuesFound: issues.length,
      gatePass: gatePass !== null && gatePass !== void 0 ? gatePass : null,
      qualityScore:
        (_j = simplebeacon === null || simplebeacon === void 0 ? void 0 : simplebeacon.qualityScore) !== null &&
        _j !== void 0
          ? _j
          : null,
      codeHealth:
        (_l =
          (_k = codebase === null || codebase === void 0 ? void 0 : codebase.summary) === null || _k === void 0
            ? void 0
            : _k.healthScore) !== null && _l !== void 0
          ? _l
          : null,
    },
    severityCounts,
    publicGateLocked: true,
    previewFindings: buildPreviewFindings(lastResult),
    trustSignals: buildTrustSignals(lastResult),
  };
}
/**
 * Is deliverable locked.
 * @param {Array} entitlements
 * @param {string} lastResult
 * @returns {any}
 */
export function isDeliverableLocked(entitlements, lastResult) {
  if (
    (entitlements === null || entitlements === void 0 ? void 0 : entitlements.hasAuditDeliverableAccess) ||
    (entitlements === null || entitlements === void 0 ? void 0 : entitlements.bypass)
  )
    return false;
  if (entitlements === null || entitlements === void 0 ? void 0 : entitlements.publicGateLocked) return true;
  return Boolean(lastResult === null || lastResult === void 0 ? void 0 : lastResult.publicGateLocked);
}
/**
 * Render scan paywall.
 * @param {any} publicSummary
 * @param {Object} options
 * @returns {any}
 */
export function renderScanPaywall(publicSummary, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const summary = (publicSummary === null || publicSummary === void 0 ? void 0 : publicSummary.summary) || {};
  const counts = (publicSummary === null || publicSummary === void 0 ? void 0 : publicSummary.severityCounts) || {};
  const previewFindings =
    (publicSummary === null || publicSummary === void 0 ? void 0 : publicSummary.previewFindings) || [];
  const trust = (publicSummary === null || publicSummary === void 0 ? void 0 : publicSummary.trustSignals) || {};
  const checkoutUrl = options.checkoutUrl || DEFAULT_CHECKOUT;
  const priceLabel = options.auditPriceLabel || '$499';
  const status = summary.status || 'REVIEW';
  const total = (_a = summary.totalIssuesFound) !== null && _a !== void 0 ? _a : '—';
  const hasCritical = ((_b = counts.critical) !== null && _b !== void 0 ? _b : 0) > 0;
  const hasHigh = ((_c = counts.high) !== null && _c !== void 0 ? _c : 0) > 0;
  const urgencyBanner = hasCritical
    ? `<div class="paywall-urgency-banner paywall-urgency-critical">
        <span class="paywall-urgency-icon">🚨</span>
        <div>
          <strong>${counts.critical} critical production risk${counts.critical === 1 ? '' : 's'} detected</strong>
          <span class="paywall-urgency-sub">These should be fixed before your next release. The full audit includes exact file paths and step-by-step remediation.</span>
        </div>
      </div>`
    : hasHigh
      ? `<div class="paywall-urgency-banner paywall-urgency-high">
          <span class="paywall-urgency-icon">⚠️</span>
          <div>
            <strong>${counts.high} high-risk issue${counts.high === 1 ? '' : 's'} found</strong>
            <span class="paywall-urgency-sub">Left unresolved, these can become blocking production defects. See the full remediation plan in the paid audit.</span>
          </div>
        </div>`
      : '';
  const previewCards = previewFindings.length
    ? previewFindings
        .map(
          (f) => `
      <div class="paywall-preview-card paywall-preview-${escapeHtml(f.severity)}">
        <div class="paywall-preview-meta">
          <span class="pill ${escapeHtml(f.severity)}">${escapeHtml(f.severity)}</span>
          <span class="paywall-preview-count">${formatNumber(f.count)} hit${f.count === 1 ? '' : 's'}</span>
        </div>
        <div class="paywall-preview-type">${escapeHtml(f.type)}</div>
        <div class="paywall-preview-files">${formatNumber(f.instances)} file${f.instances === 1 ? '' : 's'} affected</div>
      </div>
    `
        )
        .join('')
    : '';
  const trustBar =
    trust.filesScanned != null
      ? `<div class="paywall-trust-bar">
        <span class="paywall-trust-item">📁 ${formatNumber(trust.filesScanned)} files analyzed</span>
        <span class="paywall-trust-item">⚙️ ${trust.enginesRun} scan engines</span>
        <span class="paywall-trust-item">🔒 SHA-256 signed report</span>
      </div>`
      : '';
  return `
    <div class="scan-results-container">
      <!-- Urgency -->
      ${urgencyBanner}

      <!-- Summary -->
      <div class="summary-dashboard-card card mb-4">
        <h2>Scan analysis complete: ${escapeHtml(status)}</h2>
        <p class="text-muted">Found <strong>${escapeHtml(String(total))}</strong> production data risks in this repository profile.</p>
        <div class="paywall-metrics-grid">
          <div class="paywall-metric critical">Critical leaks: <strong>${escapeHtml(String((_d = counts.critical) !== null && _d !== void 0 ? _d : 0))}</strong></div>
          <div class="paywall-metric high">High risks: <strong>${escapeHtml(String((_e = counts.high) !== null && _e !== void 0 ? _e : 0))}</strong></div>
          <div class="paywall-metric medium">Medium issues: <strong>${escapeHtml(String((_f = counts.medium) !== null && _f !== void 0 ? _f : 0))}</strong></div>
        </div>
        ${summary.filesScanned != null ? `<p class="text-muted text-sm mt-2">${Number(summary.filesScanned).toLocaleString()} files scanned · code health ${(_g = summary.codeHealth) !== null && _g !== void 0 ? _g : '—'}%</p>` : ''}
      </div>

      <!-- Preview findings -->
      ${
        previewCards
          ? `
        <div class="card mb-4">
          <div class="paywall-section-header">
            <h3>Top findings preview</h3>
            <span class="text-muted text-sm">File names and line numbers are hidden</span>
          </div>
          <div class="paywall-preview-grid">
            ${previewCards}
          </div>
        </div>
      `
          : ''
      }

      <!-- What's locked -->
      <div class="card mb-4">
        <div class="paywall-section-header">
          <h3>What's in the full audit</h3>
        </div>
        <div class="paywall-compare-grid">
          <div class="paywall-compare-col">
            <h4 class="paywall-compare-title">Free scan</h4>
            <ul class="paywall-compare-list">
              <li><span class="paywall-check">✓</span> Severity counts</li>
              <li><span class="paywall-check">✓</span> Category preview</li>
              <li><span class="paywall-check">✓</span> Gate pass/fail</li>
              <li><span class="paywall-dash">—</span> File paths</li>
              <li><span class="paywall-dash">—</span> Line numbers</li>
              <li><span class="paywall-dash">—</span> Remediation steps</li>
              <li><span class="paywall-dash">—</span> PDF export</li>
              <li><span class="paywall-dash">—</span> Code hygiene certificate</li>
            </ul>
          </div>
          <div class="paywall-compare-col paywall-compare-highlight">
            <h4 class="paywall-compare-title">Full audit PDF <span class="paywall-compare-badge">${escapeHtml(priceLabel)}</span></h4>
            <ul class="paywall-compare-list">
              <li><span class="paywall-check">✓</span> Everything in free scan</li>
              <li><span class="paywall-check">✓</span> Exact file paths &amp; lines</li>
              <li><span class="paywall-check">✓</span> Step-by-step fix guides</li>
              <li><span class="paywall-check">✓</span> Prioritized task list</li>
              <li><span class="paywall-check">✓</span> Roadmap JSON export</li>
              <li><span class="paywall-check">✓</span> Compliance checklist</li>
              <li><span class="paywall-check">✓</span> Signed PDF report</li>
              <li><span class="paywall-check">✓</span> Co-branded certificate</li>
            </ul>
          </div>
        </div>
      </div>

      <!-- Certificate teaser -->
      <div class="card mb-4 paywall-cert-teaser">
        <div class="paywall-cert-icon">📜</div>
        <div class="paywall-cert-body">
          <h4>Code Hygiene Certificate</h4>
          <p class="text-muted text-sm">Generate a co-branded client deliverable for milestone handoffs — alpha, beta, release, or warranty.</p>
          <p class="text-muted text-sm">Included with every full audit.</p>
        </div>
        <div class="paywall-cert-lock">
          <span>🔒</span>
          <span class="text-muted text-xs">Unlock with audit</span>
        </div>
      </div>

      <!-- Trust bar -->
      ${trustBar}

      <!-- CTA block -->
      <div class="paywall-cta-block card mb-4">
        <div class="paywall-cta-primary">
          <h3>Unlock the full pre-launch audit</h3>
          <p class="text-muted">Get exact file paths, line numbers, step-by-step fixes, and a signed PDF report you can share with stakeholders.</p>
          <a href="${escapeHtml(checkoutUrl)}" class="btn btn-accent cta-pay-button" target="_blank" rel="noopener noreferrer">
            Purchase full audit (${escapeHtml(priceLabel)})
          </a>
        </div>
        <div class="paywall-cta-divider">
          <span>or</span>
        </div>
        <div class="paywall-cta-secondary">
          <h4>Not ready to buy?</h4>
          <p class="text-muted text-sm">Send me a sample audit report so I can see the detail level first.</p>
          <form class="paywall-email-form" onsubmit="event.preventDefault(); window.dispatchEvent(new CustomEvent('simplebeacon:paywall-email', { detail: { email: this.querySelector('input').value } }));">
            <input type="email" class="analyze-path-input" placeholder="your@email.com" required />
            <button type="submit" class="btn btn-secondary btn-sm">Send sample</button>
          </form>
        </div>
      </div>

      <!-- Locked overlay (retained for visual continuity) -->
      <div class="detailed-table-wrapper locked-state">
        <div class="paywall-overlay-banner">
          <h3>Detailed remediation log locked</h3>
          <p>File paths, line numbers, matching regex blocks, and step-by-step fix guides are reserved for paid audit clients.</p>
          <a href="${escapeHtml(checkoutUrl)}" class="btn btn-accent cta-pay-button" target="_blank" rel="noopener noreferrer">
            Unlock full audit (${escapeHtml(priceLabel)})
          </a>
        </div>
        <div class="blurred-ui-rows" aria-hidden="true">
          <div class="dummy-row"></div>
          <div class="dummy-row"></div>
          <div class="dummy-row"></div>
          <div class="dummy-row"></div>
        </div>
      </div>
    </div>
  `;
}
