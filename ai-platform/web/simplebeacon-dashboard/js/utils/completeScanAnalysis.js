/**
 * Build top-level complete scan analysis for dashboard display and export.
 */

import { escapeHtml } from '../utils.js';

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function buildCompleteScanAnalysis({ fileReduction, dataQuality, projectPath } = {}) {
  const frPlan = fileReduction?.fileReductionPlan;
  const frExec = fileReduction?.executiveSummary;
  const dqExec = dataQuality?.executiveSummary;

  const priorityActions = [
    ...(frExec?.priorityActions || []),
    ...(dqExec?.priorityActions || [])
  ].slice(0, 10);

  return {
    projectPath: projectPath || fileReduction?.projectRoot || '',
    fileReduction: frPlan ? {
      safeToDeleteBytes: frPlan.totals?.safeToDeleteBytes ?? null,
      reviewBeforeDeleteBytes: frPlan.totals?.reviewBeforeDeleteBytes ?? null,
      immediateSavingsBytes: frPlan.totals?.estimatedImmediateSavingsBytes ?? null,
      duplicateAssetBytes: frPlan.totals?.duplicateAssetBytes ?? null,
      unusedFileCandidates: frPlan.unusedFiles?.candidates ?? null,
      topSafeDirectories: frPlan.safeToDelete?.topDirectories?.slice(0, 8) || [],
      reviewLogs: frPlan.reviewBeforeDelete?.logs?.slice(0, 8) || [],
      summaryTable: frPlan.summaryTable || []
    } : null,
    dataQuality: dqExec ? {
      workspacePackages: dqExec.workspace?.packageJsonFiles ?? null,
      unusedDependencies: dqExec.workspace?.unusedDependencies ?? null,
      envInconsistencies: dqExec.workspace?.envInconsistencies ?? null,
      missingEnvKeys: dqExec.workspace?.missingEnvKeys ?? null,
      shapeDriftGroups: dqExec.data?.shapeDriftGroups ?? null,
      credentialsNeedingReview: dqExec.security?.credentialsNeedingReview ?? null,
      piiNeedingReview: dqExec.security?.piiNeedingReview ?? null
    } : null,
    priorityActions,
    notes: [
      ...(frPlan?.scopeNote ? [frPlan.scopeNote] : []),
      ...(frExec?.notes || []),
      ...(dqExec?.notes || [])
    ].filter((note, index, all) => all.indexOf(note) === index).slice(0, 6)
  };
}

export function renderCompleteScanAnalysisPanel(analysis) {
  if (!analysis) return '';

  const fr = analysis.fileReduction;
  const dq = analysis.dataQuality;
  const actions = analysis.priorityActions || [];

  const actionItems = actions.length
    ? actions.slice(0, 6).map((action) => `
        <li><strong>${escapeHtml(action.title)}</strong> <span class="text-muted">— ${escapeHtml(action.detail)}</span></li>
      `).join('')
    : '<li class="text-muted">Re-run complete scan to populate priority actions.</li>';

  const topDirs = (fr?.topSafeDirectories || []).map((entry) => `
    <li><code>${escapeHtml(entry.path)}</code> <span class="text-muted">· ${formatBytes(entry.bytes)} · ${Number(entry.files || 0).toLocaleString()} files</span></li>
  `).join('');

  return `
    <details class="card mb-4" open>
      <summary><strong>Complete scan analysis</strong></summary>
      <div class="mt-4">
        <div class="metrics-row mb-4">
          ${fr ? `
            <div class="metric-chip"><strong>${formatBytes(fr.immediateSavingsBytes)}</strong> immediate savings</div>
            <div class="metric-chip"><strong>${formatBytes(fr.safeToDeleteBytes)}</strong> safe to delete</div>
            <div class="metric-chip"><strong>${formatBytes(fr.reviewBeforeDeleteBytes)}</strong> review first</div>
            <div class="metric-chip"><strong>${Number(fr.unusedFileCandidates || 0).toLocaleString()}</strong> unused files</div>
          ` : ''}
          ${dq ? `
            <div class="metric-chip"><strong>${Number(dq.workspacePackages || 0).toLocaleString()}</strong> workspace packages</div>
            <div class="metric-chip"><strong>${Number(dq.envInconsistencies || 0).toLocaleString()}</strong> env conflicts</div>
            <div class="metric-chip"><strong>${Number(dq.piiNeedingReview || 0).toLocaleString()}</strong> PII need review</div>
          ` : ''}
        </div>
        ${topDirs ? `
          <h3 class="mb-2" style="font-size: var(--font-size-base);">Top safe-to-delete directories</h3>
          <ul class="mb-4" style="padding-left: 1.25rem;">${topDirs}</ul>
        ` : ''}
        <h3 class="mb-2" style="font-size: var(--font-size-base);">Priority actions</h3>
        <ul class="mb-4" style="padding-left: 1.25rem;">${actionItems}</ul>
        ${(analysis.notes || []).length ? `
          <p class="text-muted" style="font-size: var(--font-size-xs);">${analysis.notes.map((note) => escapeHtml(note)).join(' · ')}</p>
        ` : ''}
      </div>
    </details>
  `;
}

export { formatBytes as formatCompleteScanBytes };
