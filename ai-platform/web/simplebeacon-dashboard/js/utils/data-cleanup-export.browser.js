/**
 * Browser mirror of data-cleanup-report export sanitization.
 */

import { normalizeDuplicateGroupForBrief } from './cleanup-brief-export.browser.js?v=20260601cleanupbrief9';
import { redactProjectPathForExport } from './quality-export.browser.js?v=20260531qualityexport8';

function projectLabelFromPath(projectPath) {
  const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'ai-platform';
}

function resolveFileReductionRemediationHint(fr = {}) {
  const safeBytes = fr.safeToDeleteBytes ?? 0;
  const reviewBytes = fr.reviewBeforeDeleteBytes ?? 0;
  if (safeBytes > 0) {
    return `Phase 1 safe-delete: ~${Number(safeBytes).toLocaleString()} B in regenerable artifact directories — see fileReductionPlan.safeToDelete before deleting.`;
  }
  if (fr.unusedFileCandidates || fr.duplicateAssetBytes) {
    return 'No measured phase-1 safe-delete bytes — use priorityActions for investigate list and optional duplicate consolidation.';
  }
  if (reviewBytes > 0) {
    return `${Number(reviewBytes).toLocaleString()} B in review-first build artifacts — confirm before deletion.`;
  }
  return 'No file-reduction actions required in this export.';
}

function redactDataCleanupExportPaths(report, projectPath) {
  const label = projectLabelFromPath(projectPath);
  const redacted = redactProjectPathForExport(projectPath, label);
  let next = {
    ...report,
    projectRoot: redacted,
    ...(report.projectPath ? { projectPath: redacted } : {})
  };
  if (next.scannerStatistics?.project?.projectRoot) {
    next = {
      ...next,
      scannerStatistics: {
        ...next.scannerStatistics,
        project: {
          ...next.scannerStatistics.project,
          projectRoot: redacted
        }
      }
    };
  }
  if (next.productPlatformRoot) {
    next.productPlatformRoot = redactProjectPathForExport(
      next.productPlatformRoot,
      projectLabelFromPath(next.productPlatformRoot)
    );
  }
  return next;
}

function isBenchmarkReport(report) {
  const root = String(report?.projectRoot || report?.projectPath || '').replace(/\\/g, '/').toLowerCase();
  return root.includes('/github-cache/') || root.startsWith('github-cache/');
}

function resolveProductPlatformRoot(projectPath) {
  const normalized = String(projectPath || '').replace(/\\/g, '/');
  const idx = normalized.toLowerCase().indexOf('/github-cache/');
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}

function benchmarkLimitationNote(profile) {
  if (profile === 'file-reduction') {
    return 'Scanning OSS benchmark clone under github-cache/ — file-reduction hygiene only; duplicate doc assets across versioned geedocs folders and unused-file hits require manual review.';
  }
  return 'Scanning OSS benchmark clone under github-cache/ — Simplebeacon workspace scanners (package.json, .env) target product layout, not this C++/Python OSS tree.';
}

function benchmarkExportNote(profile) {
  if (profile === 'file-reduction') {
    return 'Benchmark clone file-reduction export — not valid for Simplebeacon platform cleanup handoff. Run file-reduction on ai-platform root for product artifact tiers.';
  }
  return 'Benchmark clone data-quality export — not valid for Simplebeacon platform handoff. Run data-quality on ai-platform root for workspace health.';
}

const BENCHMARK_FILE_REDUCTION_RECOMMENDATIONS = [
  'OSS clone only — compare hygiene metrics against other benchmarks, not Simplebeacon platform cleanup.',
  '.DS_Store under docs/ is safe to remove on macOS checkouts; prebuilt .so under portableglobe/servers/ may be required — verify before delete.',
  'Duplicate PNG assets across docs/geedocs version folders are often intentional — consolidate only when deduplicating doc trees.',
  'Unused-file candidates use static import graphs — HTML entrypoints, Python CGI, and integration tests are frequently loaded dynamically.'
];

function resolveFileReductionStatus(report) {
  const safeBytes = report.fileReductionPlan?.totals?.safeToDeleteBytes ?? 0;
  const unused = report.summary?.unusedFileCandidates ?? 0;
  const dupGroups = report.summary?.duplicateAssetGroups ?? 0;
  if (safeBytes > 0) return 'safe-delete-available';
  if (unused > 0 || dupGroups > 0) return 'investigate-and-optional-consolidation';
  return 'no-immediate-reclaim';
}

function enrichProductInventoryForExport(inventory, options = {}, profile = '') {
  if (!inventory) return inventory;
  const auditFiles = options.repositoryFilesTotal ?? options.auditRepositoryFiles ?? null;
  const invFiles = inventory.totalFiles ?? null;
  const base = {
    ...inventory,
    inventoryScope: 'platform-product'
  };
  if (auditFiles != null && invFiles != null && auditFiles > invFiles) {
    base.auditRepositoryFiles = auditFiles;
    base.inventoryNote = profile === 'file-reduction'
      ? `Workspace file-reduction inventory (${Number(invFiles).toLocaleString()} files) excludes un-walked vendor trees; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`
      : `Workspace inventory (${Number(invFiles).toLocaleString()} files) is smaller than gate audit profile (${Number(auditFiles).toLocaleString()} files) — workspace scans exclude un-walked vendor shells.`;
  } else if (invFiles != null && invFiles > 2000) {
    base.inventoryNote = 'Workspace inventory excludes node_modules; counts reflect scanned source and config paths.';
  }
  return base;
}

function isMirrorCliConsumerPath(consumerPath) {
  const normalized = String(consumerPath || '').replace(/\\/g, '/');
  return normalized.startsWith('.github-sync/') || normalized.startsWith('github-cache/');
}

function sanitizeDataLineageForExport(dataLineage = []) {
  if (!Array.isArray(dataLineage) || !dataLineage.length) {
    return { dataLineage, mirrorConsumersExcluded: 0 };
  }
  let mirrorConsumersExcluded = 0;
  const rows = dataLineage.map((row) => {
    const consumers = Array.isArray(row.consumers) ? row.consumers : [];
    const primaryConsumers = consumers.filter((consumer) => !isMirrorCliConsumerPath(consumer));
    const rowExcluded = consumers.length - primaryConsumers.length;
    mirrorConsumersExcluded += rowExcluded;
    return {
      ...row,
      consumers: primaryConsumers,
      consumerCount: primaryConsumers.length,
      ...(rowExcluded > 0 ? { mirrorConsumersExcluded: rowExcluded } : {})
    };
  });
  return { dataLineage: rows, mirrorConsumersExcluded };
}

function resolveDataCleanupGateContext(report, options = {}) {
  const gateReport = options.gateReport || {};
  const repositoryFilesTotal = options.repositoryFilesTotal
    ?? gateReport.repositoryFilesTotal
    ?? gateReport.repositoryInventory?.totalFiles
    ?? report.inventory?.auditRepositoryFiles
    ?? report.hygieneSummary?.gateRepositoryFilesTotal
    ?? report.scanScope?.gateRepositoryFilesTotal
    ?? null;
  const credentialScanned = gateReport.credentialScanned
    ?? gateReport.productionLeakScanned
    ?? gateReport.scanScope?.productionDirsScanned
    ?? report.hygieneSummary?.credentialScanned
    ?? null;
  const contentScanned = gateReport.scanScope?.fullDirectoryStats?.contentScanned
    ?? gateReport.scanScope?.fullDirectoryStats?.filesContentScanned
    ?? gateReport.credentialScanned
    ?? report.hygieneSummary?.contentFilesScanned
    ?? null;
  const gateProfile = gateReport.scanScope?.profile
    ?? report.scanScope?.gateRuleBundleProfile
    ?? report.hygieneSummary?.gateRuleBundleProfile
    ?? null;
  return {
    gateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned: gateReport.fictionJsonFilesScanned
      ?? gateReport.scanScope?.fictionJsonFilesScanned
      ?? report.hygieneSummary?.fictionJsonFilesScanned
      ?? null,
    fictionSampleFilesScanned: gateReport.fictionSampleFilesScanned
      ?? gateReport.mockSampleFiles
      ?? gateReport.scanScope?.fictionSampleFilesScanned
      ?? report.hygieneSummary?.fictionSampleFilesScanned
      ?? null
  };
}

function buildDataQualityHygieneSummary(report, options = {}) {
  const gateContext = resolveDataCleanupGateContext(report, options);
  const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport,
    fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
  const workspaceFiles = report.inventory?.totalFiles ?? null;
  return {
    dataQualityStatus: report.dataQualityStatus ?? resolveDataQualityStatus(report),
    totalFindings: report.summary?.totalFindings ?? 0,
    workspaceFilesScanned: workspaceFiles,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateTotal != null && workspaceFiles != null && gateTotal > workspaceFiles
      ? { workspaceInventoryNotInGate: gateTotal - workspaceFiles }
      : {}),
    ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    packageJsonFiles: report.scanners?.['dependency-health']?.packageJsonFiles
      ?? report.scanners?.['config-management']?.packageJsonFiles
      ?? null,
    envKeysDefined: report.scanners?.['environment-variables']?.envKeys ?? null,
    envKeysReferenced: report.scanners?.['environment-variables']?.referencedKeys ?? null,
    dataLineageSampleFiles: report.scanners?.['data-lineage']?.dataFilesTracked
      ?? report.metadata?.dataLineage?.length
      ?? null,
    dataAccessSourceScanned: report.scanners?.['data-access-patterns']?.sourceFilesScanned ?? null,
    mirrorConsumersExcluded: report.metadata?.mirrorConsumersExcluded ?? 0,
    ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
    ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false
      ? { jestBaselineChecked: false }
      : {}),
    attestationNote: 'Data-quality hygiene scan — not gate pass or vendor handoff certification.'
  };
}

function enrichProductDataQualityScanScope(scanScope, report, options = {}) {
  const gateContext = resolveDataCleanupGateContext(report, options);
  const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
  return {
    ...(scanScope || {}),
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
    resultsViewScope: scanScope?.resultsViewScope || 'platform-only',
    reportHealth: scanScope?.reportHealth || 'platform-scoped',
    securityHandoffEligible: false
  };
}

function buildFileReductionHygieneSummary(report, options = {}) {
  const gateContext = resolveDataCleanupGateContext(report, options);
  const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport,
    fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
  const workspaceFiles = report.inventory?.totalFiles ?? null;
  const unusedScanned = report.scanners?.['unused-files']?.sourceFilesScanned
    ?? report.fileReductionPlan?.unusedFiles?.sourceFilesScanned
    ?? null;
  const entryPoints = report.metadata?.entryPoints?.length
    ?? report.scanners?.['unused-files']?.entryPoints
    ?? null;
  return {
    fileReductionStatus: report.fileReductionStatus ?? resolveFileReductionStatus(report),
    workspaceFilesScanned: workspaceFiles,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateTotal != null && workspaceFiles != null && gateTotal > workspaceFiles
      ? { workspaceInventoryNotInGate: gateTotal - workspaceFiles }
      : {}),
    ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    safeToDeleteBytes: report.fileReductionPlan?.totals?.safeToDeleteBytes
      ?? report.scanners?.['build-artifacts']?.safeToDeleteBytes
      ?? 0,
    duplicateAssetBytes: report.fileReductionPlan?.totals?.duplicateAssetBytes
      ?? report.scanners?.['asset-consolidation']?.reclaimableBytes
      ?? 0,
    unusedFileCandidates: report.summary?.unusedFileCandidates ?? 0,
    unusedFilesSourceScanned: unusedScanned,
    assetFilesScanned: report.scanners?.['asset-consolidation']?.assetFilesScanned ?? null,
    unusedFileEntryPoints: entryPoints,
    enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
    ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
    ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false
      ? { jestBaselineChecked: false }
      : {}),
    attestationNote: 'File-reduction hygiene scan — reclaim guidance only, not vendor handoff clearance.'
  };
}

function enrichProductFileReductionScanScope(scanScope, report, options = {}) {
  const gateContext = resolveDataCleanupGateContext(report, options);
  const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
  return {
    ...(scanScope || {}),
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
    resultsViewScope: scanScope?.resultsViewScope || 'platform-only',
    reportHealth: scanScope?.reportHealth || 'platform-scoped',
    securityHandoffEligible: false,
    fileReductionNote: scanScope?.fileReductionNote
      || report.scanScope?.fileReductionNote
      || 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
  };
}

function buildProductFileReductionExportNotes(report, options = {}) {
  const notes = [
    'securityHandoffEligible is false — file-reduction is reclaim guidance only, not vendor security handoff.',
    'Absolute scan paths are redacted to project label in operator exports.'
  ];
  if (report.inventory?.inventoryNote) {
    notes.push(String(report.inventory.inventoryNote));
  }
  const gateContext = resolveDataCleanupGateContext(report, options);
  const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile,
    fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
  if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
    notes.push(
      `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
    );
  }
  if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
    notes.push(
      `Gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) with ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched — file-reduction profile scans reclaim tiers only.`
    );
  }
  if (gateProfile) {
    notes.push(`Gate rule bundle profile: ${gateProfile} — pair file-reduction report with json/simplebeacon-gate.json for handoff evidence.`);
  }
  const assetScanned = report.scanners?.['asset-consolidation']?.assetFilesScanned;
  if (assetScanned != null && assetScanned > 0) {
    notes.push(
      `${Number(assetScanned).toLocaleString()} static asset file(s) hashed for duplicate consolidation — workspace inventory excludes node_modules vendor trees.`
    );
  }
  const safeBytes = report.fileReductionPlan?.totals?.safeToDeleteBytes ?? 0;
  const shells = report.fileReductionPlan?.safeToDelete?.topDirectories || [];
  const zeroByteShells = shells.filter((d) => (d.bytes ?? 0) === 0 && /^(node_modules|coverage)$/.test(String(d.path)));
  if (zeroByteShells.length && safeBytes === 0) {
    notes.push(`${zeroByteShells.length} regenerable directory shell(s) listed with 0 B walked — workspace scan excludes vendor tree contents.`);
  }
  const unused = report.summary?.unusedFileCandidates ?? 0;
  if (unused > 0) {
    notes.push(`${unused} unused-file candidates are static-analysis hits — HTML pages, fixtures, and re-export shims are often intentional.`);
  }
  const dupBytes = report.fileReductionPlan?.totals?.duplicateAssetBytes
    ?? report.scanners?.['asset-consolidation']?.reclaimableBytes
    ?? 0;
  if (dupBytes > 0) {
    notes.push(`Phase 2 duplicate consolidation ~${dupBytes} B — use keeper paths in fileReductionPlan.duplicateAssets.topGroups.`);
  }
  const reviewBytes = report.fileReductionPlan?.totals?.reviewBeforeDeleteBytes ?? 0;
  if (reviewBytes > 0) {
    notes.push(`${reviewBytes} B in review-first build artifacts (logs, maps, generated files) — not auto-deleted.`);
  }
  if (report.summary?.estimatedReductionPct != null) {
    notes.push(`estimatedReductionPct (${report.summary.estimatedReductionPct}%) is finding density vs scanned inventory, not bytes reclaimable.`);
  }
  if (report.compact) {
    notes.push('Compact export — top findings only; fileReductionPlan and summary retain full totals.');
    notes.push('scannerStatistics data-quality shells are zero — enabledScanners lists file-reduction modules only.');
  }
  const unusedScanned = report.scanners?.['unused-files']?.sourceFilesScanned
    ?? report.fileReductionPlan?.unusedFiles?.sourceFilesScanned
    ?? null;
  const workspaceFiles = report.inventory?.totalFiles ?? null;
  if (unusedScanned != null && workspaceFiles != null && unusedScanned < workspaceFiles) {
    notes.push(
      `Unused-file graph scanned ${Number(unusedScanned).toLocaleString()} source file(s) from ${Number(report.metadata?.entryPoints?.length ?? report.scanners?.['unused-files']?.entryPoints ?? 0).toLocaleString()} entry point(s) — workspace inventory counted ${Number(workspaceFiles).toLocaleString()} paths.`
    );
  }
  notes.push('File-reduction scan does not run Jest — use gate/complete scan for test attestation.');
  if (safeBytes > 0) {
    notes.push('Safe-delete tiers are regenerable artifacts only — not SimpleBeacon vendor security handoff clearance.');
  }
  if ((report.summary?.totalFindings ?? 0) === 0
    && (report.fileReductionStatus === 'no-immediate-reclaim' || !report.fileReductionStatus)) {
    notes.push('No immediate reclaimable bytes or unused-file actions in this export.');
  }
  return [...new Set(notes)].slice(0, 13);
}

function sanitizeFileReductionPlanForProduct(plan) {
  if (!plan || plan.omitted) return plan;
  let next = { ...plan, profile: 'file-reduction' };
  if (plan.duplicateAssets?.topGroups?.length) {
    next.duplicateAssets = {
      ...plan.duplicateAssets,
      topGroups: plan.duplicateAssets.topGroups.map((g) => normalizeDuplicateGroupForBrief(g)).filter(Boolean)
    };
  }
  const safeBytes = plan.totals?.safeToDeleteBytes ?? 0;
  const hasZeroByteShell = (plan.safeToDelete?.topDirectories || []).some(
    (entry) => (entry.bytes ?? 0) === 0 && /^(node_modules|coverage)$/.test(String(entry.path))
  );
  if (safeBytes === 0 && hasZeroByteShell && Array.isArray(plan.recommendations)
    && plan.recommendations.some((r) => /Delete top-level artifact/i.test(r))) {
    next.recommendations = [
      'Regenerable shells (node_modules, coverage) were detected but not size-walked — confirm before delete; restore with `npm install` or re-run tests.',
      'Consolidate duplicate assets using keeper paths in duplicateAssets.topGroups (canonical favicon: web/favicon.svg).',
      'Unused-file hits include HTML entrypoints, fixtures, and re-export shims — verify before deletion.',
      'Run data-quality profile for env keys and sync I/O findings.'
    ];
    next.hygieneSummary = {
      safeToDeleteBytes: 0,
      duplicateAssetBytes: plan.totals?.duplicateAssetBytes ?? 0,
      note: 'No measured safe-delete bytes — regenerable shells were not size-walked; optional duplicate consolidation only.'
    };
  }
  return next;
}

function enrichProductFileReductionExecutiveSummary(executiveSummary, _report) {
  if (!executiveSummary) return executiveSummary;
  const fr = executiveSummary.fileReduction || {};
  const actions = [...(executiveSummary.priorityActions || [])];
  if (fr.unusedFileCandidates > 0 && !actions.some((a) => /unused/i.test(a.title))) {
    actions.push({
      priority: 'medium',
      title: 'Investigate unused-file candidates',
      detail: `${fr.unusedFileCandidates} static hits — verify HTML entrypoints, fixtures, and dynamic loaders before deleting`
    });
  }
  if (fr.duplicateAssetBytes > 0 && !actions.some((a) => /duplicate/i.test(a.title))) {
    actions.unshift({
      priority: 'low',
      title: 'Review duplicate assets',
      detail: `${fr.duplicateAssetGroups || 1} group(s), ~${fr.duplicateAssetBytes} B — keeper paths listed in fileReductionPlan`
    });
  }
  if ((fr.safeToDeleteBytes || 0) === 0 && (fr.buildArtifactFindings || 0) > 0
    && !actions.some((a) => /shell/i.test(a.title))) {
    actions.push({
      priority: 'low',
      title: 'Regenerable directory shells',
      detail: 'node_modules or coverage detected with 0 B walked — confirm regenerable before delete'
    });
  }
  const fileReductionNotes = [
    'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
  ];
  if (fr.unusedFileCandidates > 0) {
    fileReductionNotes.push(
      `${fr.unusedFileCandidates} unused-file candidates are static-analysis hits — verify HTML entrypoints and fixtures before deleting.`
    );
  }
  if ((fr.duplicateAssetBytes || 0) > 0) {
    fileReductionNotes.push(
      `Duplicate asset consolidation ~${fr.duplicateAssetBytes} B — see fileReductionPlan.duplicateAssets.topGroups for keeper paths.`
    );
  }
  return {
    ...executiveSummary,
    priorityActions: actions.slice(0, 8),
    exportProfile: 'file-reduction',
    remediationHint: resolveFileReductionRemediationHint(fr),
    notes: fileReductionNotes.slice(0, 6)
  };
}

function resolveDataQualityStatus(report) {
  const total = report.summary?.totalFindings ?? 0;
  const critical = report.aggregation?.bySeverity?.critical ?? 0;
  const high = report.aggregation?.bySeverity?.high ?? 0;
  if (critical > 0 || high > 0) return 'needs-attention';
  if (total > 0) return 'healthy-with-findings';
  return 'clean';
}

function buildProductDataQualityExportNotes(report, options = {}) {
  const notes = [
    'securityHandoffEligible is false — data-quality hygiene is supplementary, not vendor security handoff.',
    'Absolute scan paths are redacted to project label in operator exports.'
  ];
  if (report.inventory?.inventoryNote) {
    notes.push(String(report.inventory.inventoryNote));
  }
  const gateContext = resolveDataCleanupGateContext(report, options);
  const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport,
    fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
  if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
    notes.push(
      `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
    );
  }
  const sourceScanned = report.scanners?.['data-access-patterns']?.sourceFilesScanned;
  const workspaceFiles = report.inventory?.totalFiles;
  if (sourceScanned != null && workspaceFiles != null && sourceScanned < workspaceFiles) {
    notes.push(
      `Data-access pattern scan walked ${Number(sourceScanned).toLocaleString()} source file(s) — workspace inventory is ${Number(workspaceFiles).toLocaleString()} paths excluding vendor trees.`
    );
  }
  const lineageSamples = report.scanners?.['data-lineage']?.dataFilesTracked
    ?? report.metadata?.dataLineage?.length;
  if (lineageSamples != null && fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
    notes.push(
      `Data-lineage tracked ${Number(lineageSamples).toLocaleString()} web/data *-sample.json file(s) — gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON paths with ${Number(fictionSampleFilesScanned).toLocaleString()} KPI samples matched.`
    );
  }
  const packageJsonFiles = report.scanners?.['dependency-health']?.packageJsonFiles
    ?? report.scanners?.['config-management']?.packageJsonFiles;
  if (packageJsonFiles != null && packageJsonFiles > 0) {
    notes.push(
      `${Number(packageJsonFiles).toLocaleString()} workspace package.json manifest(s) scanned — dependency and env rules exclude node_modules vendor trees.`
    );
  }
  const missing = report.scanners?.['environment-variables']?.missingKeys
    ?? report.findings?.environmentVariables?.filter((f) => f.type === 'missing-env-key').length
    ?? 0;
  const syncIo = report.scanners?.['data-access-patterns']?.patternFindings
    ?? report.findings?.dataAccessPatterns?.length
    ?? 0;
  if (missing > 0) {
    notes.push(
      `${missing} env key(s) referenced in code but not defined in workspace .env files — add to .env.example (commented) or local .env.`
    );
  }
  if (syncIo > 0) {
    notes.push(`${syncIo} sync filesystem read pattern(s) flagged — prefer startup load or cache (see dataAccessPatterns findings).`);
  }
  if (report.summary?.estimatedReductionPct != null) {
    notes.push(
      `estimatedReductionPct (${report.summary.estimatedReductionPct}%) is finding density vs scanned inventory, not disk bytes reclaimable.`
    );
  }
  if (report.compact) {
    notes.push('Compact export — top findings only; scannerStatistics and summary retain full counts.');
  }
  const mirrorExcluded = report.metadata?.mirrorConsumersExcluded ?? 0;
  if (mirrorExcluded > 0) {
    notes.push(
      `${mirrorExcluded} dataLineage mirror consumer path(s) (.github-sync/) omitted from export — not primary application source.`
    );
  } else {
    const mirrorConsumers = (report.metadata?.dataLineage || [])
      .flatMap((row) => (row.consumers || []).filter((c) => isMirrorCliConsumerPath(c)));
    if (mirrorConsumers.length) {
      notes.push('dataLineage consumers may reference .github-sync/ CLI mirror paths — not primary ai-platform application source.');
    }
  }
  if (gateProfile) {
    notes.push(`Gate rule bundle profile: ${gateProfile} — pair data-quality report with json/simplebeacon-gate.json for handoff evidence.`);
  }
  if (gateReport.jestBaselineChecked === false || report.hygieneSummary?.jestBaselineChecked === false) {
    notes.push('Data-quality scan does not run Jest — use gate/complete scan for test attestation.');
  }
  if ((report.summary?.totalFindings ?? 0) === 0) {
    notes.push('No open data-quality findings on scanned workspace paths in this export.');
  }
  const envKeys = report.scanners?.['environment-variables']?.envKeys ?? 0;
  const referencedKeys = report.scanners?.['environment-variables']?.referencedKeys ?? 0;
  if (referencedKeys > envKeys && envKeys > 0) {
    notes.push(
      `referencedKeys (${referencedKeys}) exceeds envKeys (${envKeys}) — static analysis counts code references including CI/Docker/runtime-injected keys.`
    );
  }
  return [...new Set(notes)].slice(0, 14);
}

function fixEstimatedReductionPct(summary, inventory) {
  if (!summary || !inventory?.totalFiles) return summary;
  if (summary.estimatedReductionPct == null || summary.estimatedReductionPct <= 100) return summary;
  return {
    ...summary,
    estimatedReductionPct: Math.round(((summary.totalFindings || 0) / inventory.totalFiles) * 1000) / 10
  };
}

function repairCompactAssetFindings(report) {
  const topGroups = report.fileReductionPlan?.duplicateAssets?.topGroups || [];
  if (!topGroups.length) return report.findings;
  const repaired = (report.findings?.assetConsolidation || []).map((finding, index) => {
    const group = topGroups[index] || topGroups.find((g) => g.reclaimableBytes === finding.reclaimableBytes);
    return normalizeDuplicateGroupForBrief({ ...finding, ...group }) || finding;
  });
  if (repaired.some((f) => f.keeper || f.path)) {
    return { ...report.findings, assetConsolidation: repaired };
  }
  return report.findings;
}

function reaggregateTopFiles(report) {
  const all = Object.values(report.findings || {}).flat().filter(Boolean);
  const byFile = new Map();
  for (const finding of all) {
    const key = finding.path || finding.keeper || 'unknown';
    if (key === 'unknown') continue;
    byFile.set(key, (byFile.get(key) || 0) + 1);
  }
  const topFiles = [...byFile.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 20)
    .map(([filePath, count]) => ({ filePath, count }));
  if (!topFiles.length) return report.aggregation;
  return { ...(report.aggregation || {}), topFiles };
}

export function sanitizeDataCleanupReportExport(report, options = {}) {
  if (!report || report.type !== 'data-cleanup-report') return report;

  const projectPath = options.projectPath || report.projectRoot || report.projectPath || '';
  const benchmarkScan = isBenchmarkReport(report);
  const profile = report.scanProfile || 'data-quality';
  const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(projectPath) : null;

  let next = {
    ...report,
    ...(benchmarkScan ? {
      scanTargetProfile: 'benchmark-cache',
      handoffEligible: false,
      benchmarkScan: true,
      productPlatformRoot: productPlatformRoot || undefined
    } : {})
  };

  if (benchmarkScan) {
    next.scanScope = {
      ...(next.scanScope || {}),
      resultsViewScope: 'benchmark-clone',
      reportHealth: 'benchmark-clone-scan',
      rescanRecommended: false,
      inventoryMetricsStale: false,
      benchmarkScanTarget: true,
      limitations: [benchmarkLimitationNote(profile)]
    };
    if (next.inventory) {
      next.inventory = {
        ...next.inventory,
        inventoryScope: 'oss-clone',
        note: /stale full-tree/i.test(String(next.inventory.note || ''))
          ? 'OSS clone inventory — large file counts are expected for google-earthenterprise-scale trees.'
          : (next.inventory.note || 'OSS clone inventory — large file counts are expected.')
      };
    }
  }

  if (next.summary) {
    next.summary = fixEstimatedReductionPct(next.summary, next.inventory);
  }

  if (next.compact && next.findings) {
    next.findings = repairCompactAssetFindings(next);
    next.aggregation = reaggregateTopFiles(next);
  }

  if (profile === 'file-reduction' && next.fileReductionPlan && !benchmarkScan) {
    next.fileReductionPlan = sanitizeFileReductionPlanForProduct(next.fileReductionPlan);
    if (next.findings?.assetConsolidation?.length && next.fileReductionPlan.duplicateAssets?.topGroups?.length) {
      next.findings = {
        ...next.findings,
        assetConsolidation: next.fileReductionPlan.duplicateAssets.topGroups.map((group) => ({
          type: 'asset-duplicate',
          severity: 'low',
          action: 'consolidate-duplicates',
          reclaimableBytes: group.reclaimableBytes,
          ...group
        }))
      };
      next.aggregation = reaggregateTopFiles(next);
    }
  }

  if (profile === 'data-quality' && next.fileReductionPlan && !next.fileReductionPlan.omitted) {
    next.fileReductionPlan = {
      profile: 'data-quality',
      omitted: true,
      scopeNote: 'File-reduction tiers omitted from data-quality export — run file-reduction profile for artifact and duplicate analysis.'
    };
  }

  if (profile === 'file-reduction' && next.fileReductionPlan && benchmarkScan) {
    next.fileReductionPlan = {
      ...next.fileReductionPlan,
      scopeNote: 'OSS benchmark clone — file-reduction tiers are informational; safeToDelete is empty because product artifact policies do not apply.',
      recommendations: BENCHMARK_FILE_REDUCTION_RECOMMENDATIONS,
      duplicateAssets: next.fileReductionPlan.duplicateAssets
        ? {
            ...next.fileReductionPlan.duplicateAssets,
            topGroups: (next.fileReductionPlan.duplicateAssets.topGroups || [])
              .map((g) => normalizeDuplicateGroupForBrief(g))
              .filter(Boolean)
          }
        : next.fileReductionPlan.duplicateAssets
    };
  }

  if (benchmarkScan) {
    next.exportNotes = [
      ...(next.exportNotes || []),
      benchmarkExportNote(profile)
    ].filter((note, index, all) => all.indexOf(note) === index);
  } else {
    if (profile === 'data-quality' && next.metadata?.dataLineage?.length) {
      const { dataLineage, mirrorConsumersExcluded } = sanitizeDataLineageForExport(next.metadata.dataLineage);
      next = {
        ...next,
        metadata: {
          ...next.metadata,
          dataLineage,
          ...(mirrorConsumersExcluded > 0 ? { mirrorConsumersExcluded } : {})
        }
      };
    }
    const enrichedInventory = enrichProductInventoryForExport(next.inventory, options, profile);
    const statusFields = profile === 'file-reduction'
      ? { fileReductionStatus: resolveFileReductionStatus(next) }
      : profile === 'data-quality'
        ? { dataQualityStatus: resolveDataQualityStatus(next) }
        : {};
    const notesInput = { ...next, inventory: enrichedInventory, ...statusFields };
    const exportNotes = profile === 'file-reduction'
      ? buildProductFileReductionExportNotes(notesInput, options)
      : buildProductDataQualityExportNotes(notesInput, options);
    next = {
      ...next,
      exportNormalized: true,
      exportSanitized: true,
      scanTargetProfile: 'product',
      securityHandoffEligible: false,
      handoffEligible: false,
      ...statusFields,
      exportNotes: exportNotes.length ? exportNotes : undefined,
      inventory: enrichedInventory,
      scanScope: profile === 'data-quality'
        ? enrichProductDataQualityScanScope({
            ...(next.scanScope || {}),
            resultsViewScope: next.scanScope?.resultsViewScope || 'platform-only',
            reportHealth: next.scanScope?.reportHealth || 'platform-scoped',
            securityHandoffEligible: false,
            dataQualityNote: 'Data-quality export — workspace scanner hygiene only, not vendor handoff clearance.'
          }, next, options)
        : profile === 'file-reduction'
          ? enrichProductFileReductionScanScope({
              ...(next.scanScope || {}),
              resultsViewScope: next.scanScope?.resultsViewScope || 'platform-only',
              reportHealth: next.scanScope?.reportHealth || 'platform-scoped',
              securityHandoffEligible: false,
              fileReductionNote: 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
            }, next, options)
          : {
              ...(next.scanScope || {}),
              resultsViewScope: next.scanScope?.resultsViewScope || 'platform-only',
              reportHealth: next.scanScope?.reportHealth || 'platform-scoped',
              securityHandoffEligible: false
            },
      ...(profile === 'data-quality'
        ? { hygieneSummary: buildDataQualityHygieneSummary({ ...next, inventory: enrichedInventory }, options) }
        : profile === 'file-reduction'
          ? { hygieneSummary: buildFileReductionHygieneSummary({ ...next, inventory: enrichedInventory, ...statusFields }, options) }
          : {})
    };
    if (profile === 'file-reduction') {
      delete next.dataQualityStatus;
    } else if (profile === 'data-quality') {
      delete next.fileReductionStatus;
    }
    if (profile === 'data-quality' && next.executiveSummary) {
      next.executiveSummary = {
        ...next.executiveSummary,
        exportProfile: 'data-quality',
        remediationHint: (next.summary?.totalFindings ?? 0) > 0
          ? 'Address priorityActions and environmentVariables findings before platform handoff.'
          : 'No open data-quality findings in this export.'
      };
    }
    if (profile === 'file-reduction' && next.executiveSummary) {
      next.executiveSummary = enrichProductFileReductionExecutiveSummary(next.executiveSummary, next);
    }
  }

  return redactDataCleanupExportPaths(next, projectPath);
}
