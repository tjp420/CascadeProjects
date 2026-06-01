import { escapeHtml, formatNumber } from '../utils.js';

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

const SCANNER_LABELS = {
  'build-artifacts': 'Build artifacts',
  'asset-consolidation': 'Duplicate assets',
  'unused-files': 'Unused files',
  'config-management': 'Config sprawl',
  'dependency-health': 'Dependencies',
  'environment-variables': 'Environment keys',
  'data-freshness': 'Stale data',
  'data-access-patterns': 'Sync I/O patterns',
  'data-privacy': 'Privacy & secrets',
  'data-lineage': 'Orphaned data',
  'data-consistency': 'Shape drift'
};

const PRIORITY_LABELS = {
  critical: 'Critical',
  high: 'High',
  medium: 'Medium',
  low: 'Low'
};

function profileTitle(profile) {
  if (profile === 'file-reduction') return 'File reduction';
  if (profile === 'data-quality') return 'Data quality';
  return 'Data cleanup';
}

function renderFileReductionPlan(scan, profile) {
  const plan = scan.fileReductionPlan;
  if (!plan) return '';

  const effectiveProfile = profile || scan.scanProfile || 'all';
  if (effectiveProfile !== 'file-reduction' && effectiveProfile !== 'all') return '';

  const totals = plan.totals || {};
  const safe = plan.safeToDelete || {};
  const review = plan.reviewBeforeDelete || {};
  const duplicates = plan.duplicateAssets || {};
  const unused = plan.unusedFiles || {};

  const topDirs = (safe.topDirectories || []).map((entry) => `
    <li>
      <code>${escapeHtml(entry.path)}</code>
      <span class="text-muted"> · ${formatBytes(entry.bytes)} · ${formatNumber(entry.files)} file(s)</span>
    </li>
  `).join('');

  const reviewLogs = (review.logs || []).map((entry) => `
    <li><code>${escapeHtml(entry.path)}</code> <span class="text-muted">· ${formatBytes(entry.bytes)}</span></li>
  `).join('');

  const summaryRows = (plan.summaryTable || []).map((row) => `
    <tr>
      <td>${escapeHtml(row.category)}</td>
      <td>${formatNumber(row.files)}</td>
      <td>${row.bytes == null ? '—' : formatBytes(row.bytes)}</td>
      <td>${escapeHtml(row.action)}</td>
    </tr>
  `).join('');

  return `
    <details class="card mb-4" open>
      <summary><strong>Reduction plan</strong></summary>
      <div class="mt-4">
        <div class="metrics-row mb-4">
          <div class="metric-chip"><strong>${formatBytes(totals.estimatedImmediateSavingsBytes)}</strong> immediate savings</div>
          <div class="metric-chip"><strong>${formatBytes(totals.safeToDeleteBytes)}</strong> safe to delete</div>
          <div class="metric-chip"><strong>${formatBytes(totals.reviewBeforeDeleteBytes)}</strong> review first</div>
          <div class="metric-chip"><strong>${formatNumber(duplicates.groups)}</strong> duplicate groups</div>
          <div class="metric-chip"><strong>${formatNumber(unused.candidates)}</strong> unused candidates</div>
        </div>
        <p class="text-muted mb-4" style="font-size: var(--font-size-xs);">${escapeHtml(plan.scopeNote || '')}</p>
        <table class="table mb-4" style="width:100%; font-size: var(--font-size-sm);">
          <thead>
            <tr><th>Category</th><th>Files</th><th>Size</th><th>Action</th></tr>
          </thead>
          <tbody>${summaryRows}</tbody>
        </table>
        ${topDirs ? `
          <h3 class="mb-2" style="font-size: var(--font-size-base);">Top safe-to-delete directories</h3>
          <ul class="mb-4" style="padding-left: 1.25rem;">${topDirs}</ul>
        ` : ''}
        ${reviewLogs ? `
          <h3 class="mb-2" style="font-size: var(--font-size-base);">Review before delete (logs)</h3>
          <ul class="mb-4" style="padding-left: 1.25rem;">${reviewLogs}</ul>
        ` : ''}
        ${(plan.recommendations || []).length ? `
          <p class="text-muted" style="font-size: var(--font-size-xs);">
            ${plan.recommendations.map((item) => escapeHtml(item)).join(' · ')}
          </p>
        ` : ''}
      </div>
    </details>
  `;
}

function renderScannerStatistics(scan, profile) {
  const stats = scan.scannerStatistics;
  if (!stats?.scanners) return '';

  const effectiveProfile = profile || scan.scanProfile || 'all';
  const isDataQuality = effectiveProfile === 'data-quality' || effectiveProfile === 'all';
  if (!isDataQuality) return '';

  const rows = [
    ['Config Management', stats.scanners['config-management']],
    ['Dependency Health', stats.scanners['dependency-health']],
    ['Environment Variables', stats.scanners['environment-variables']],
    ['Data Freshness', stats.scanners['data-freshness']],
    ['Data Access Patterns', stats.scanners['data-access-patterns']],
    ['Data Privacy', stats.scanners['data-privacy']],
    ['Data Lineage', stats.scanners['data-lineage']],
    ['Data Consistency', stats.scanners['data-consistency']]
  ].filter(([, block]) => block);

  const statLines = rows.map(([label, block]) => {
    const pairs = Object.entries(block.stats || {})
      .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').trim()}: ${formatNumber(value)}`)
      .join(' · ');
    const findingPairs = Object.entries(block.findings || {})
      .filter(([key]) => key !== 'total')
      .map(([key, value]) => `${key.replace(/([A-Z])/g, ' $1').trim()}: ${formatNumber(value)}`)
      .join(' · ');
    return `
      <div class="consolidation-card card mb-2">
        <div class="consolidation-meta">${escapeHtml(label)} · ${formatNumber(block.findings?.total)} finding(s)</div>
        <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(pairs)}</p>
        ${findingPairs ? `<p class="text-muted" style="font-size: var(--font-size-xs);">Findings: ${escapeHtml(findingPairs)}</p>` : ''}
      </div>
    `;
  }).join('');

  const piiCategories = scan.executiveSummary?.security?.piiByCategory || [];
  const piiBlock = piiCategories.length ? `
    <h3 class="mb-2 mt-4" style="font-size: var(--font-size-base);">PII triage</h3>
    <div class="metrics-row mb-2">
      ${piiCategories.map((entry) => `
        <div class="metric-chip" title="${escapeHtml(entry.categoryLabel)}">
          <strong>${formatNumber(entry.count)}</strong> ${escapeHtml(entry.categoryLabel)}
        </div>
      `).join('')}
      <div class="metric-chip"><strong>${formatNumber(scan.executiveSummary?.security?.piiNeedingReview)}</strong> need review</div>
    </div>
  ` : '';

  return `
    <details class="card mb-4">
      <summary><strong>Scanner statistics</strong> <span class="text-muted">(workspace-scoped)</span></summary>
      <div class="mt-4">
        <p class="text-muted mb-4" style="font-size: var(--font-size-xs);">${escapeHtml(stats.scopeNote || '')}</p>
        ${statLines}
        ${piiBlock}
      </div>
    </details>
  `;
}

function renderExecutiveSummary(scan, profile) {
  const summary = scan.executiveSummary;
  if (!summary) return '';

  const effectiveProfile = profile || scan.scanProfile || 'all';
  const showFileReduction = effectiveProfile === 'file-reduction' || effectiveProfile === 'all';
  const showDataQuality = effectiveProfile === 'data-quality' || effectiveProfile === 'all';
  const actions = summary.priorityActions || [];
  const credentials = summary.security?.credentials || [];
  const notes = summary.notes || [];

  const actionItems = actions.length
    ? actions.map((action) => `
        <li>
          <span class="consolidation-meta">${escapeHtml(PRIORITY_LABELS[action.priority] || action.priority)}</span>
          <strong>${escapeHtml(action.title)}</strong>
          <span class="text-muted"> — ${escapeHtml(action.detail)}</span>
        </li>
      `).join('')
    : '<li class="text-muted">No immediate actions — review top findings below.</li>';

  const credentialItems = credentials.length
    ? credentials.map((item) => `
        <li>
          <code>${escapeHtml(item.path || '—')}${item.line ? `:${item.line}` : ''}</code>
          <span class="text-muted"> · ${escapeHtml(item.categoryLabel || item.category || 'Review required')}</span>
        </li>
      `).join('')
    : '';

  const workspace = summary.workspace || {};
  const data = summary.data || {};
  const fileReduction = summary.fileReduction || {};

  const workspaceRows = showDataQuality ? `
    <div class="metrics-row mb-2">
      <div class="metric-chip" title="Workspace package.json files only"><strong>${formatNumber(workspace.packageJsonFiles)}</strong> workspace packages</div>
      <div class="metric-chip"><strong>${formatNumber(workspace.unusedDependencies)}</strong> unused deps</div>
      <div class="metric-chip"><strong>${formatNumber(workspace.versionDrift)}</strong> version drift</div>
      <div class="metric-chip"><strong>${formatNumber(workspace.envFiles)}</strong> env files</div>
      <div class="metric-chip"><strong>${formatNumber(workspace.envInconsistencies)}</strong> env conflicts</div>
      <div class="metric-chip"><strong>${formatNumber(workspace.missingEnvKeys)}</strong> missing env keys</div>
    </div>
    <div class="metrics-row mb-2">
      <div class="metric-chip"><strong>${formatNumber(summary.security?.credentialHits)}</strong> credential hits</div>
      <div class="metric-chip"><strong>${formatNumber(summary.security?.credentialsNeedingReview)}</strong> need review</div>
      <div class="metric-chip"><strong>${formatNumber(summary.security?.piiHits)}</strong> PII hits</div>
      <div class="metric-chip"><strong>${formatNumber(summary.security?.piiNeedingReview)}</strong> PII need review</div>
      <div class="metric-chip"><strong>${formatNumber(data.orphanedDataFiles)}</strong> orphaned data</div>
      <div class="metric-chip"><strong>${formatNumber(data.shapeDriftGroups)}</strong> shape drift</div>
      <div class="metric-chip"><strong>${formatNumber(data.syncIoPatterns)}</strong> sync I/O</div>
    </div>
  ` : '';

  const fileReductionRows = showFileReduction ? `
    <div class="metrics-row mb-2">
      <div class="metric-chip"><strong>${formatBytes(fileReduction.estimatedImmediateSavingsBytes || fileReduction.safeToDeleteBytes || fileReduction.reclaimableBytes)}</strong> immediate savings</div>
      <div class="metric-chip"><strong>${formatBytes(fileReduction.safeToDeleteBytes || 0)}</strong> safe to delete</div>
      <div class="metric-chip"><strong>${formatBytes(fileReduction.reviewBeforeDeleteBytes || 0)}</strong> review first</div>
      <div class="metric-chip"><strong>${formatNumber(fileReduction.unusedFileCandidates)}</strong> unused files</div>
    </div>
  ` : '';

  return `
    <details class="card mb-4" open>
      <summary><strong>Executive summary</strong></summary>
      <div class="mt-4">
        ${fileReductionRows}
        ${workspaceRows}
        <h3 class="mb-2" style="font-size: var(--font-size-base);">Priority actions</h3>
        <ul class="mb-4" style="padding-left: 1.25rem;">
          ${actionItems}
        </ul>
        ${credentialItems ? `
          <h3 class="mb-2" style="font-size: var(--font-size-base);">Credential hits</h3>
          <ul class="mb-4" style="padding-left: 1.25rem;">
            ${credentialItems}
          </ul>
        ` : ''}
        ${notes.length ? `
          <p class="text-muted" style="font-size: var(--font-size-xs);">
            ${notes.map((note) => escapeHtml(note)).join(' · ')}
          </p>
        ` : ''}
      </div>
    </details>
  `;
}

export function renderDataCleanupPanel({ scan, profile, loading, error } = {}) {
  if (loading) {
    return '<p class="text-muted"><span class="loading-spinner"></span> Running cleanup scanners…</p>';
  }
  if (error) {
    return `<p class="text-danger">${escapeHtml(error)}</p>`;
  }
  if (!scan?.summary) {
    return '<p class="text-muted card">No cleanup scan yet — run file reduction or data quality to see reclaimable space and hygiene findings.</p>';
  }

  const s = scan.summary;
  const inv = scan.inventory || {};
  const sev = scan.aggregation?.bySeverity || {};
  const enabled = scan.enabledScanners || Object.keys(scan.scanners || {});
  const effectiveProfile = profile || scan.scanProfile || 'all';
  const topFindings = (scan.allFindings || []).slice(0, 8);

  const fileReductionChips = [
    `<div class="metric-chip"><strong>${formatNumber(s.buildArtifactFindings)}</strong> build artifacts</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.duplicateAssetGroups)}</strong> duplicate groups</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.unusedFileCandidates)}</strong> unused files</div>`
  ];

  const dataQualityChips = [
    `<div class="metric-chip"><strong>${formatNumber(s.configFindings)}</strong> config</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.dependencyFindings)}</strong> deps</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.environmentFindings)}</strong> env keys</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.dataFreshnessFindings)}</strong> stale data</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.dataAccessFindings)}</strong> sync I/O</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.dataPrivacyFindings)}</strong> privacy</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.dataLineageFindings)}</strong> orphaned</div>`,
    `<div class="metric-chip"><strong>${formatNumber(s.dataConsistencyFindings)}</strong> shape drift</div>`
  ];

  const metricChips = effectiveProfile === 'file-reduction'
    ? fileReductionChips
    : effectiveProfile === 'data-quality'
      ? dataQualityChips
      : [...fileReductionChips, ...dataQualityChips];

  return `
    ${renderExecutiveSummary(scan, effectiveProfile)}
    ${renderFileReductionPlan(scan, effectiveProfile)}
    ${renderScannerStatistics(scan, effectiveProfile)}
    <div class="metrics-row mb-4">
      <div class="metric-chip" title="Files walked for this scan"><strong>${formatNumber(inv.totalFiles)}</strong> files scanned</div>
      <div class="metric-chip"><strong>${formatNumber(s.totalFindings)}</strong> findings</div>
      <div class="metric-chip"><strong>${formatBytes(s.reclaimableBytes)}</strong> reclaimable</div>
      ${sev.critical ? `<div class="metric-chip"><strong>${formatNumber(sev.critical)}</strong> critical</div>` : ''}
      ${sev.high ? `<div class="metric-chip"><strong>${formatNumber(sev.high)}</strong> high</div>` : ''}
      ${sev.medium ? `<div class="metric-chip"><strong>${formatNumber(sev.medium)}</strong> medium</div>` : ''}
      ${scan.durationMs != null ? `<div class="metric-chip"><strong>${Math.round(scan.durationMs / 1000)}s</strong> runtime</div>` : ''}
    </div>
    <div class="metrics-row mb-4">
      ${metricChips.join('')}
    </div>
    <p class="text-muted mb-4" style="font-size: var(--font-size-xs);">
      ${escapeHtml(profileTitle(effectiveProfile))} · dry-run only · workspace-scoped dep/config counts · scanners:
      ${enabled.map((id) => escapeHtml(SCANNER_LABELS[id] || id)).join(' · ')}
    </p>
    ${!topFindings.length ? `
      <p class="text-muted card">No findings — ${formatNumber(inv.totalFiles)} files scanned under ${escapeHtml(profileTitle(effectiveProfile))} profile.</p>
    ` : `
      <h3 class="mb-2" style="font-size: var(--font-size-base);">Top findings</h3>
      <div class="consolidation-list mb-4">
        ${topFindings.map((finding) => `
          <div class="consolidation-card card">
            <div class="consolidation-meta">${escapeHtml(finding.severity || 'info')} · ${escapeHtml(finding.category || finding.type || 'finding')}${finding.scanner ? ` · ${escapeHtml(SCANNER_LABELS[finding.scanner] || finding.scanner)}` : ''}</div>
            <p><code>${escapeHtml(finding.path || finding.file || finding.id || '—')}</code></p>
            <p class="text-muted" style="font-size: var(--font-size-sm);">${escapeHtml(finding.message || finding.reason || finding.recommendation || '')}</p>
            ${finding.reclaimableBytes || finding.sizeBytes ? `<p class="text-muted" style="font-size: var(--font-size-xs);">${formatBytes(finding.reclaimableBytes || finding.sizeBytes)} reclaimable</p>` : ''}
          </div>
        `).join('')}
      </div>
    `}
  `;
}

export function buildDataCleanupConclusion(scan, profile) {
  if (!scan?.summary) {
    return 'No data cleanup scan available.';
  }
  const s = scan.summary;
  const inv = scan.inventory || {};
  const label = profileTitle(profile || scan.scanProfile || 'all');
  const sev = scan.aggregation?.bySeverity || {};
  const severityNote = (sev.critical || sev.high)
    ? ` ${formatNumber(sev.critical)} critical, ${formatNumber(sev.high)} high severity.`
    : '';
  const exec = scan.executiveSummary;
  const reviewNote = exec?.security?.credentialsNeedingReview
    ? ` ${formatNumber(exec.security.credentialsNeedingReview)} credential hit(s) need manual review.`
    : exec?.security?.credentialHits
      ? ' Credential hits are documented examples or test fixtures.'
      : '';
  const piiNote = exec?.security?.piiNeedingReview
    ? ` ${formatNumber(exec.security.piiNeedingReview)} PII hit(s) need manual review.`
    : exec?.security?.piiHits
      ? ' PII hits are in docs, reports, or mock/sample data.'
      : '';
  return `${label}: ${formatNumber(s.totalFindings)} finding(s) across ${formatNumber(inv.totalFiles)} files — ${formatBytes(s.reclaimableBytes)} potentially reclaimable (dry-run).${severityNote}${reviewNote}${piiNote}`;
}
