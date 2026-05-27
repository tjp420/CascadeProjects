import { escapeHtml } from '../utils.js';

const DEFAULT_CHECKOUT = 'mailto:audit@simplebeacon.ai?subject=Unlock%20Pre-Launch%20Audit%20Report';

export function buildPublicSummaryFromScan(lastResult) {
  if (lastResult?.publicSummary) return lastResult.publicSummary;
  const simplebeacon = lastResult?.steps?.find((s) => s.id === 'simplebeacon')?.report
    || lastResult?.report;
  const codebase = lastResult?.steps?.find((s) => s.id === 'codebase')?.scan
    || lastResult?.scan;
  const issues = [
    ...(simplebeacon?.rawIssues || simplebeacon?.detectedIssues || []),
    ...(codebase?.findings || [])
  ];
  const severityCounts = issues.reduce((acc, issue) => {
    const band = String(issue.severity || 'low').toLowerCase();
    if (acc[band] != null) acc[band] += issue.count || 1;
    else acc.low += issue.count || 1;
    return acc;
  }, { critical: 0, high: 0, medium: 0, low: 0 });
  const gatePass = simplebeacon?.gate?.pass;
  return {
    summary: {
      filesScanned: codebase?.summary?.codeFilesAnalyzed ?? simplebeacon?.ruleScopedFilesAnalyzed ?? null,
      status: gatePass === true ? 'PASS' : gatePass === false ? 'FAIL' : 'REVIEW',
      totalIssuesFound: issues.length,
      gatePass: gatePass ?? null,
      qualityScore: simplebeacon?.qualityScore ?? null,
      codeHealth: codebase?.summary?.healthScore ?? null
    },
    severityCounts,
    publicGateLocked: true
  };
}

export function isDeliverableLocked(entitlements, lastResult) {
  if (entitlements?.hasAuditDeliverableAccess) return false;
  if (entitlements?.publicGateLocked) return true;
  return Boolean(lastResult?.publicGateLocked);
}

export function renderScanPaywall(publicSummary, options = {}) {
  const summary = publicSummary?.summary || {};
  const counts = publicSummary?.severityCounts || {};
  const checkoutUrl = options.checkoutUrl || DEFAULT_CHECKOUT;
  const priceLabel = options.auditPriceLabel || '$499';
  const status = summary.status || 'REVIEW';
  const total = summary.totalIssuesFound ?? '—';

  return `
    <div class="scan-results-container">
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

      <div class="detailed-table-wrapper locked-state">
        <div class="paywall-overlay-banner">
          <h3>Detailed remediation log locked</h3>
          <p>File paths, line numbers, matching regex blocks, and step-by-step fix guides are reserved for paid audit clients.</p>
          <a href="${escapeHtml(checkoutUrl)}" class="btn btn-accent cta-pay-button" target="_blank" rel="noopener noreferrer">
            Unlock full pre-launch audit PDF (${escapeHtml(priceLabel)})
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
