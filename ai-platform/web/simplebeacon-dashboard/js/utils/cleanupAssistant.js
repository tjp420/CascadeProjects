/**
 * Cleanup assistant — tier scan results for safe deletion and agent handoff.
 */

import { escapeHtml, formatNumber } from '../utils.js';
import { buildCompleteScanAnalysis } from './completeScanAnalysis.js?v=20260527cleanup1';

export const CLEANUP_ASSISTANT_PREFS_KEY = 'simplebeaconCleanupAssistantPrefs';

export const DEFAULT_PROTECTED_PATHS = [
  'web/data', // simplebeacon:production-leak-intent - legitimate sample data reference for cleanup policy
  'data/mock', // simplebeacon:production-leak-intent - legitimate sample data reference for cleanup policy
  'data-central',
  'data/roadmap',
  'uploads',
  '.git'
];

const DEFAULT_POLICY = {
  protectedPaths: DEFAULT_PROTECTED_PATHS,
  allowNodeModules: true,
  allowSimplebeaconCache: false,
  aggressiveness: 'moderate'
};

function normalizePath(value) {
  return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '').toLowerCase();
}

export function loadCleanupPolicy() {
  try {
    const raw = localStorage.getItem(CLEANUP_ASSISTANT_PREFS_KEY);
    if (!raw) return { ...DEFAULT_POLICY, protectedPaths: [...DEFAULT_PROTECTED_PATHS] };
    const parsed = JSON.parse(raw);
    return {
      ...DEFAULT_POLICY,
      ...parsed,
      protectedPaths: Array.isArray(parsed.protectedPaths) && parsed.protectedPaths.length
        ? parsed.protectedPaths
        : [...DEFAULT_PROTECTED_PATHS]
    };
  } catch {
    return { ...DEFAULT_POLICY, protectedPaths: [...DEFAULT_PROTECTED_PATHS] };
  }
}

export function saveCleanupPolicy(policy) {
  localStorage.setItem(CLEANUP_ASSISTANT_PREFS_KEY, JSON.stringify(policy));
}

export function pathMatchesProtected(relativePath, protectedPaths = []) {
  const norm = normalizePath(relativePath);
  return protectedPaths.some((entry) => {
    const pat = normalizePath(entry);
    if (!pat) return false;
    return norm === pat || norm.startsWith(`${pat}/`) || norm.includes(`/${pat}/`);
  });
}

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

function isSimplebeaconCachePath(relativePath) {
  return normalizePath(relativePath).includes('.simplebeacon/');
}

function isNodeModulesPath(relativePath) {
  const norm = normalizePath(relativePath);
  return norm === 'node_modules' || norm.endsWith('/node_modules') || norm.includes('/node_modules/');
}

function classifyDirectory(entry, policy) {
  const path = entry.path || '';
  if (pathMatchesProtected(path, policy.protectedPaths)) {
    return 'protected';
  }
  if (isSimplebeaconCachePath(path) && !policy.allowSimplebeaconCache) {
    return 'review';
  }
  if (isNodeModulesPath(path) && !policy.allowNodeModules) {
    return 'review';
  }
  return 'safe';
}

function isDirectoryArtifact(finding) {
  return finding?.action === 'safe-to-delete'
    && (finding.kind === 'directory' || / directory$/i.test(String(finding.reason || '')));
}

/** Use enriched plan when present; otherwise synthesize from compact scan payload. */
export function resolveFileReductionPlan(fileReduction) {
  const existing = fileReduction?.fileReductionPlan;
  if (existing?.safeToDelete?.topDirectories?.length || existing?.totals?.safeToDeleteBytes) {
    return existing;
  }

  if (!fileReduction || typeof fileReduction !== 'object') {
    return {};
  }

  const buildArtifacts = fileReduction.findings?.buildArtifacts || [];
  const assetConsolidation = fileReduction.findings?.assetConsolidation || [];
  const buildSummary = fileReduction.scanners?.['build-artifacts'] || {};
  const assetSummary = fileReduction.scanners?.['asset-consolidation'] || {};
  const unusedSummary = fileReduction.scanners?.['unused-files'] || {};

  const safeDirectories = buildArtifacts
    .filter(isDirectoryArtifact)
    .sort((left, right) => (right.sizeBytes || 0) - (left.sizeBytes || 0))
    .slice(0, 12)
    .map((finding) => ({
      path: finding.path,
      bytes: finding.sizeBytes || 0,
      files: finding.fileCount || 0,
      category: finding.category || finding.reason,
      skipped: finding.skipped || false
    }));

  const reviewLogs = buildArtifacts
    .filter((finding) => finding.action === 'review-before-delete' && finding.category === 'logs')
    .slice(0, 10)
    .map((finding) => ({
      path: finding.path,
      bytes: finding.sizeBytes || 0
    }));

  const safeBytes = buildSummary.safeToDeleteBytes
    ?? safeDirectories.reduce((sum, entry) => sum + (entry.bytes || 0), 0);
  const reviewBytes = buildSummary.reviewBeforeDeleteBytes
    ?? reviewLogs.reduce((sum, entry) => sum + (entry.bytes || 0), 0);
  const duplicateBytes = assetSummary.reclaimableBytes
    ?? assetConsolidation.reduce((sum, group) => sum + (group.reclaimableBytes || 0), 0);
  const unusedCandidates = unusedSummary.unusedCandidates
    ?? fileReduction.summary?.unusedFileCandidates
    ?? 0;

  if (!safeDirectories.length && !safeBytes && !unusedCandidates && !duplicateBytes && !reviewLogs.length) {
    return existing || {};
  }

  return {
    scopeNote: existing?.scopeNote || 'Synthesized from scan summaries — re-run file reduction if tiers look incomplete.',
    totals: {
      reclaimableBytes: fileReduction.summary?.reclaimableBytes ?? buildSummary.reclaimableBytes ?? safeBytes + duplicateBytes,
      safeToDeleteBytes: safeBytes,
      reviewBeforeDeleteBytes: reviewBytes,
      duplicateAssetBytes: duplicateBytes,
      estimatedImmediateSavingsBytes: safeBytes + duplicateBytes
    },
    safeToDelete: {
      topDirectories: safeDirectories
    },
    reviewBeforeDelete: {
      logs: reviewLogs
    },
    unusedFiles: {
      candidates: unusedCandidates,
      note: existing?.unusedFiles?.note
        || 'Static analysis only — verify dynamic imports, runtime loaders, and config references before deleting.'
    },
    duplicateAssets: {
      topGroups: assetConsolidation
        .slice()
        .sort((left, right) => (right.reclaimableBytes || 0) - (left.reclaimableBytes || 0))
        .slice(0, 8)
        .map((group) => ({
          keeper: group.keeper,
          duplicates: group.duplicates || [],
          reclaimableBytes: group.reclaimableBytes || 0
        }))
    }
  };
}

export function isCleanupBriefRunnable({ brief, fileReduction, dataQuality } = {}) {
  if (brief?.inventory?.totalFiles != null) return true;
  if (fileReduction?.inventory?.totalFiles != null) return true;
  if (dataQuality?.inventory?.totalFiles != null) return true;
  if (dataQuality?.summary != null) return true;
  if (brief?.scanAnalysis?.dataQuality) return true;
  if (brief?.scanAnalysis?.fileReduction) return true;
  if ((brief?.estimatedReduction?.files || 0) > 0) return true;
  if ((brief?.tiers?.investigate?.files || 0) > 0) return true;
  if ((brief?.dataQualityActions?.length || 0) > 0) return true;
  return false;
}

export function buildCleanupAssistantConclusion(brief) {
  if (!brief) return 'Cleanup assistant complete.';
  const files = brief.estimatedReduction?.files || 0;
  const bytes = brief.estimatedReduction?.bytes || 0;
  const after = brief.projectedInventory?.totalFiles;
  const inventory = brief.inventory?.totalFiles;
  if (files > 0) {
    return `Tiered cleanup plan — ${Number(files).toLocaleString()} files safe now (${formatBytes(bytes)}), ${after != null ? Number(after).toLocaleString() : '—'} projected after phase 1.`;
  }
  if (inventory != null) {
    return `Cleanup brief ready — ${Number(inventory).toLocaleString()} files inventoried; nothing in the safe-now tier under current policy (check investigate + data-quality follow-ups).`;
  }
  return 'Cleanup assistant complete — review tiers and data-quality follow-ups.';
}

export function buildCleanupAssistantBrief({
  projectPath,
  fileReduction,
  dataQuality,
  repositoryInventory,
  policy = loadCleanupPolicy()
} = {}) {
  const plan = resolveFileReductionPlan(fileReduction);
  const enrichedFileReduction = fileReduction && plan && !fileReduction.fileReductionPlan
    ? { ...fileReduction, fileReductionPlan: plan }
    : fileReduction;
  const analysis = buildCompleteScanAnalysis({
    fileReduction: enrichedFileReduction,
    dataQuality,
    projectPath
  });

  const inventory = {
    totalFiles: repositoryInventory?.totalFiles ?? fileReduction?.inventory?.totalFiles ?? null,
    totalFolders: repositoryInventory?.totalFolders ?? fileReduction?.inventory?.totalDirectories ?? null
  };

  const tiers = {
    safeNow: { files: 0, bytes: 0, directories: [] },
    reviewFirst: { files: 0, bytes: 0, items: [] },
    protected: { files: 0, bytes: 0, directories: [] },
    investigate: { files: plan.unusedFiles?.candidates ?? 0, note: plan.unusedFiles?.note || null }
  };
  const skippedArtifactDirectories = [];

  for (const entry of plan.safeToDelete?.topDirectories || []) {
    const tier = classifyDirectory(entry, policy);
    const payload = {
      path: entry.path,
      bytes: entry.bytes || 0,
      files: entry.files || 0,
      category: entry.category || null
    };
    if (payload.bytes === 0 && payload.files === 0 && !entry.skipped) {
      skippedArtifactDirectories.push(payload);
      continue;
    }
    if (tier === 'protected') {
      tiers.protected.files += payload.files;
      tiers.protected.bytes += payload.bytes;
      tiers.protected.directories.push(payload);
    } else if (tier === 'review') {
      tiers.reviewFirst.files += payload.files;
      tiers.reviewFirst.bytes += payload.bytes;
      tiers.reviewFirst.items.push({ ...payload, reason: isNodeModulesPath(entry.path) ? 'node_modules disabled in policy' : 'scan cache disabled in policy' });
    } else {
      tiers.safeNow.files += payload.files;
      tiers.safeNow.bytes += payload.bytes;
      tiers.safeNow.directories.push(payload);
    }
  }

  for (const entry of plan.reviewBeforeDelete?.logs || []) {
    tiers.reviewFirst.files += 1;
    tiers.reviewFirst.bytes += entry.bytes || 0;
    tiers.reviewFirst.items.push({
      path: entry.path,
      bytes: entry.bytes || 0,
      files: 1,
      reason: 'log file — review before delete'
    });
  }

  if (analysis.fileReduction && skippedArtifactDirectories.length && !analysis.fileReduction.skippedArtifactDirectories) {
    analysis.fileReduction.skippedArtifactDirectories = skippedArtifactDirectories.slice(0, 8);
  }

  const estimatedReduction = {
    files: tiers.safeNow.files,
    bytes: tiers.safeNow.bytes,
    percentOfInventory: inventory.totalFiles
      ? Number(((tiers.safeNow.files / inventory.totalFiles) * 100).toFixed(1))
      : null
  };

  const projectedInventory = {
    totalFiles: inventory.totalFiles != null
      ? Math.max(0, inventory.totalFiles - tiers.safeNow.files)
      : null,
    totalFolders: inventory.totalFolders
  };

  const agentInstructions = buildAgentInstructions({
    projectPath,
    policy,
    inventory,
    projectedInventory,
    estimatedReduction,
    tiers,
    analysis
  });

  return {
    type: 'simplebeacon-cleanup-brief',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    projectPath,
    policy,
    inventory,
    projectedInventory,
    estimatedReduction,
    tiers,
    scanAnalysis: analysis,
    duplicateAssets: plan.duplicateAssets?.topGroups?.slice(0, 8) || [],
    dataQualityActions: analysis.priorityActions || [],
    agentInstructions,
    agentPrompt: buildAgentPrompt({ projectPath, estimatedReduction, inventory, projectedInventory, policy }),
    sourceScans: {
      fileReductionPresent: Boolean(fileReduction),
      dataQualityPresent: Boolean(dataQuality),
      fileReductionPlanPresent: Boolean(fileReduction?.fileReductionPlan || plan?.safeToDelete?.topDirectories?.length),
      synthesizedPlan: Boolean(fileReduction && !fileReduction.fileReductionPlan && plan?.safeToDelete?.topDirectories?.length)
    }
  };
}

function resolveCleanupScanInputs(lastResult) {
  if (!lastResult) {
    return {
      projectPath: null,
      fileReduction: null,
      dataQuality: null,
      repositoryInventory: null,
      policy: null
    };
  }

  if (lastResult.kind === 'complete' && Array.isArray(lastResult.steps)) {
    const cleanupStep = lastResult.steps.find((step) => step.id === 'cleanup-assistant') || null;
    const fileReductionStep = lastResult.steps.find((step) => step.id === 'file-reduction') || null;
    const dataQualityStep = lastResult.steps.find((step) => step.id === 'data-quality') || null;
    return {
      projectPath: lastResult.projectPath,
      fileReduction: cleanupStep?.fileReduction || fileReductionStep?.scan || null,
      dataQuality: cleanupStep?.dataQuality || dataQualityStep?.scan || null,
      repositoryInventory: cleanupStep?.repositoryInventory || lastResult.repositoryInventory || null,
      policy: cleanupStep?.policy || lastResult.policy || null
    };
  }

  return {
    projectPath: lastResult.projectPath,
    fileReduction: lastResult.fileReduction || null,
    dataQuality: lastResult.dataQuality || null,
    repositoryInventory: lastResult.repositoryInventory || null,
    policy: lastResult.policy || null
  };
}

export function buildCleanupBriefFromLastResult(lastResult, policy) {
  const inputs = resolveCleanupScanInputs(lastResult);
  if (!inputs.projectPath) return null;
  return buildCleanupAssistantBrief({
    projectPath: inputs.projectPath,
    fileReduction: inputs.fileReduction,
    dataQuality: inputs.dataQuality,
    repositoryInventory: inputs.repositoryInventory,
    policy: policy || inputs.policy || loadCleanupPolicy()
  });
}

function buildAgentInstructions(context) {
  const lines = [
    'Execute cleanup in phases: (1) safeNow directories, (2) duplicate asset consolidation, (3) reviewFirst items only after confirmation.',
    `Never delete paths under protected list: ${context.policy.protectedPaths.join(', ')}.`,
    'Do not bulk-delete unused file candidates — they require static/dynamic import verification.',
    context.policy.allowNodeModules
      ? 'node_modules may be removed and restored with npm install.'
      : 'Do not delete node_modules unless the user explicitly enables it.',
    context.policy.allowSimplebeaconCache
      ? '.simplebeacon scan artifacts may be trimmed or archived.'
      : 'Keep .simplebeacon scan artifacts unless the user opts in.',
    `Target inventory reduction: ~${formatNumber(context.estimatedReduction.files)} files (${formatBytes(context.estimatedReduction.bytes)}).`
  ];
  return lines;
}

export function buildAgentPrompt({ projectPath, estimatedReduction, inventory, projectedInventory, policy }) {
  return [
    `Proceed in agent mode using the attached cleanup brief for: ${projectPath}`,
    '',
    'Deletion policy:',
    `- Safe to delete now: regenerable artifacts only (${formatNumber(estimatedReduction.files)} files, ${formatBytes(estimatedReduction.bytes)}).`,
    `- Protected (never delete): ${policy.protectedPaths.join(', ')}`,
    `- Review first: logs, scan cache, and anything flagged reviewFirst in the brief`,
    `- Do not bulk-delete unused-file candidates without verifying imports`,
    '',
    `Inventory: ${formatNumber(inventory.totalFiles)} files / ${formatNumber(inventory.totalFolders)} folders`,
    `Projected after phase 1: ~${formatNumber(projectedInventory.totalFiles)} files`,
    '',
    'Attach the exported cleanup-brief JSON and execute phase 1 only unless I say otherwise.'
  ].join('\n');
}

function renderTierList(items, emptyLabel) {
  if (!items?.length) {
    return `<li class="text-muted">${escapeHtml(emptyLabel)}</li>`;
  }
  return items.slice(0, 12).map((entry) => `
    <li>
      <code>${escapeHtml(entry.path)}</code>
      <span class="text-muted"> · ${formatBytes(entry.bytes)} · ${formatNumber(entry.files)} file(s)</span>
      ${entry.reason ? `<span class="text-muted"> — ${escapeHtml(entry.reason)}</span>` : ''}
    </li>
  `).join('');
}

export function renderCleanupAssistantPanel(brief, { policy = loadCleanupPolicy() } = {}) {
  if (!brief) return '';

  const protectedValue = (policy.protectedPaths || DEFAULT_PROTECTED_PATHS).join('\n');
  const actions = (brief.dataQualityActions || []).slice(0, 5).map((action) => `
    <li><strong>${escapeHtml(action.title)}</strong> <span class="text-muted">— ${escapeHtml(action.detail)}</span></li>
  `).join('') || '<li class="text-muted">No data-quality actions flagged.</li>';

  return `
    <div class="cleanup-assistant-panel card mb-4">
      <div class="card-header">
        <span class="card-title">Cleanup assistant</span>
        <span class="text-muted" style="font-size: var(--font-size-xs);">Dry-run tiers · export for Cursor agent</span>
      </div>

      <div class="metrics-row mb-4">
        <div class="metric-chip"><strong>${formatNumber(brief.inventory.totalFiles)}</strong> files now</div>
        <div class="metric-chip"><strong>${formatNumber(brief.inventory.totalFolders)}</strong> folders</div>
        <div class="metric-chip"><strong>${formatNumber(brief.estimatedReduction.files)}</strong> safe to remove</div>
        <div class="metric-chip"><strong>${formatNumber(brief.projectedInventory.totalFiles)}</strong> after phase 1</div>
        <div class="metric-chip"><strong>${formatBytes(brief.estimatedReduction.bytes)}</strong> reclaimable</div>
      </div>

      <div class="cleanup-tier-grid mb-4">
        <div class="cleanup-tier-card safe">
          <h3>Safe now</h3>
          <p>${formatNumber(brief.tiers.safeNow.files)} files · ${formatBytes(brief.tiers.safeNow.bytes)}</p>
          <ul>${renderTierList(brief.tiers.safeNow.directories, 'No safe directories after policy filters.')}</ul>
        </div>
        <div class="cleanup-tier-card review">
          <h3>Review first</h3>
          <p>${formatNumber(brief.tiers.reviewFirst.files)} files · ${formatBytes(brief.tiers.reviewFirst.bytes)}</p>
          <ul>${renderTierList(brief.tiers.reviewFirst.items, 'Nothing queued for review.')}</ul>
        </div>
        <div class="cleanup-tier-card protected">
          <h3>Protected</h3>
          <p>${formatNumber(brief.tiers.protected.files)} files · ${formatBytes(brief.tiers.protected.bytes)}</p>
          <ul>${renderTierList(brief.tiers.protected.directories, 'No scanned artifact paths overlap protected roots.')}</ul>
        </div>
      </div>

      <details class="mb-4" open>
        <summary><strong>Deletion policy</strong></summary>
        <div class="cleanup-policy-form mt-4">
          <label class="cleanup-policy-label" for="cleanup-protected-paths">Protected paths (one per line)</label>
          <textarea id="cleanup-protected-paths" class="cleanup-policy-textarea" rows="6" spellcheck="false">${escapeHtml(protectedValue)}</textarea>
          <div class="cleanup-policy-options">
            <label><input type="checkbox" id="cleanup-allow-node-modules" ${policy.allowNodeModules ? 'checked' : ''}> Allow deleting <code>node_modules</code> (restore with npm install)</label>
            <label><input type="checkbox" id="cleanup-allow-simplebeacon" ${policy.allowSimplebeaconCache ? 'checked' : ''}> Allow trimming <code>.simplebeacon/</code> scan cache</label>
          </div>
          <button type="button" class="btn btn-secondary btn-sm" id="cleanup-reapply-policy">Re-tier with policy</button>
        </div>
      </details>

      <details class="mb-4">
        <summary><strong>Data quality follow-ups</strong></summary>
        <ul class="mt-4" style="padding-left: 1.25rem;">${actions}</ul>
        <p class="text-muted mt-2" style="font-size: var(--font-size-xs);">
          Investigate tier: ${formatNumber(brief.tiers.investigate.files)} unused-file candidates (static analysis only — not auto-delete).
        </p>
      </details>

      <div class="cleanup-export-row">
        <button type="button" class="btn btn-primary btn-sm" id="cleanup-brief-export-btn">Export agent brief (JSON)</button>
        <button type="button" class="btn btn-outline-accent btn-sm" id="cleanup-prompt-copy-btn">Copy Cursor prompt</button>
      </div>
      <p class="text-muted mt-2" style="font-size: var(--font-size-xs);">
        Share the JSON or pasted prompt with Cursor agent mode. Phase 1 removes only <strong>Safe now</strong> directories matching your policy.
      </p>
    </div>
  `;
}

export function readCleanupPolicyFromDom(root) {
  const textarea = root?.querySelector('#cleanup-protected-paths');
  const protectedPaths = String(textarea?.value || '')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  return {
    protectedPaths: protectedPaths.length ? protectedPaths : [...DEFAULT_PROTECTED_PATHS],
    allowNodeModules: Boolean(root?.querySelector('#cleanup-allow-node-modules')?.checked),
    allowSimplebeaconCache: Boolean(root?.querySelector('#cleanup-allow-simplebeacon')?.checked),
    aggressiveness: 'moderate'
  };
}
