// simplebeacon-ignore documentation
import { escapeHtml, formatNumber } from '../utils.js';

const DEFAULT_CHECKOUT = 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';

/**
 * Build preview findings from scan result.
 * Extracts top findings grouped by type/severity for teaser display.
 * @param {any} lastResult
 * @returns {any}
 */
function buildPreviewFindings(lastResult) {
  const simplebeacon = lastResult?.steps?.find((s) => s.id === 'simplebeacon')?.report || lastResult?.report;
  const codebase = lastResult?.steps?.find((s) => s.id === 'codebase')?.scan || lastResult?.scan;
  const issues = [...(simplebeacon?.rawIssues || simplebeacon?.detectedIssues || []), ...(codebase?.findings || [])];

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
  const steps = lastResult?.steps || [];
  const simplebeacon = steps.find((s) => s.id === 'simplebeacon')?.report;
  const codebase = steps.find((s) => s.id === 'codebase')?.scan;
  const repoInv = lastResult?.repositoryInventory;
  const filesScanned =
    repoInv?.totalFiles ?? codebase?.summary?.codeFilesAnalyzed ?? simplebeacon?.ruleScopedFilesAnalyzed ?? null;
  const enginesRun = steps.filter((s) => s.status === 'done' || s.status === 'running').length;
  return { filesScanned, enginesRun: enginesRun || steps.length };
}

/**
 * Build public summary from scan.
 * @param {string} lastResult
 * @returns {any}
 */
export function buildPublicSummaryFromScan(lastResult) {
  if (lastResult?.publicSummary) return lastResult.publicSummary;
  const simplebeacon = lastResult?.steps?.find((s) => s.id === 'simplebeacon')?.report || lastResult?.report;
  const codebase = lastResult?.steps?.find((s) => s.id === 'codebase')?.scan || lastResult?.scan;
  const issues = [...(simplebeacon?.rawIssues || simplebeacon?.detectedIssues || []), ...(codebase?.findings || [])];
  const severityCounts = issues.reduce(
    (acc, issue) => {
      const band = String(issue.severity || 'low').toLowerCase();
      if (acc[band] != null) acc[band] += issue.count || 1;
      else acc.low += issue.count || 1;
      return acc;
    },
    { critical: 0, high: 0, medium: 0, low: 0 }
  );
  const gatePass = simplebeacon?.gate?.pass;
  return {
    summary: {
      filesScanned: codebase?.summary?.codeFilesAnalyzed ?? simplebeacon?.ruleScopedFilesAnalyzed ?? null,
      status: gatePass === true ? 'PASS' : gatePass === false ? 'FAIL' : 'REVIEW',
      totalIssuesFound: issues.length,
      gatePass: gatePass ?? null,
      qualityScore: simplebeacon?.qualityScore ?? null,
      codeHealth: codebase?.summary?.healthScore ?? null,
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
  if (entitlements?.hasAuditDeliverableAccess || entitlements?.bypass) return false;
  if (entitlements?.publicGateLocked) return true;
  return Boolean(lastResult?.publicGateLocked);
}

/**
 * Render scan paywall.
 * @param {any} publicSummary
 * @param {Object} options
 * @returns {any}
 */
export function renderScanPaywall(publicSummary, options = {}) {
  const summary = publicSummary?.summary || {};
  const counts = publicSummary?.severityCounts || {};
  const previewFindings = publicSummary?.previewFindings || [];
  const trust = publicSummary?.trustSignals || {};
  const checkoutUrl = options.checkoutUrl || DEFAULT_CHECKOUT;
  const priceLabel = options.auditPriceLabel || '$499';
  const status = summary.status || 'REVIEW';
  const total = summary.totalIssuesFound ?? '—';
  const hasCritical = (counts.critical ?? 0) > 0;
  const hasHigh = (counts.high ?? 0) > 0;

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
          <div class="paywall-metric critical">Critical leaks: <strong>${escapeHtml(String(counts.critical ?? 0))}</strong></div>
          <div class="paywall-metric high">High risks: <strong>${escapeHtml(String(counts.high ?? 0))}</strong></div>
          <div class="paywall-metric medium">Medium issues: <strong>${escapeHtml(String(counts.medium ?? 0))}</strong></div>
        </div>
        ${summary.filesScanned != null ? `<p class="text-muted text-sm mt-2">${Number(summary.filesScanned).toLocaleString()} files scanned · code health ${summary.codeHealth ?? '—'}%</p>` : ''}
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
