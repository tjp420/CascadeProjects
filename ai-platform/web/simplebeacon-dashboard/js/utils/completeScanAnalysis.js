/**
 * Build top-level complete scan analysis for dashboard display and export.
 */

import { escapeHtml } from '../utils.js';
import {
  classifyRegenerableArtifacts,
  softenPriorityActions,
  filterPlatformArtifactPaths,
  isBenchmarkCachePath
} from './complete-scan-artifact-profile.browser.js';

function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export { classifyRegenerableArtifacts, softenPriorityActions } from './complete-scan-artifact-profile.browser.js';

export function buildCompleteScanAnalysis({ fileReduction, dataQuality, projectPath } = {}) {
  const frPlan = fileReduction?.fileReductionPlan;
  const frExec = fileReduction?.executiveSummary;
  const dqExec = dataQuality?.executiveSummary;

  const priorityActions = [
    ...(frExec?.priorityActions || []),
    ...(dqExec?.priorityActions || [])
  ].slice(0, 10);

  const rawTopDirs = frPlan?.safeToDelete?.topDirectories || [];
  const topSafeDirectories = filterPlatformArtifactPaths(rawTopDirs).slice(0, 8);
  const benchmarkDirsExcluded = rawTopDirs.filter((entry) => isBenchmarkCachePath(entry.path)).length;

  const analysis = {
    projectPath: projectPath || fileReduction?.projectRoot || '',
    fileReduction: frPlan ? {
      safeToDeleteBytes: frPlan.totals?.safeToDeleteBytes ?? null,
      reviewBeforeDeleteBytes: frPlan.totals?.reviewBeforeDeleteBytes ?? null,
      immediateSavingsBytes: frPlan.totals?.estimatedImmediateSavingsBytes ?? null,
      duplicateAssetBytes: frPlan.totals?.duplicateAssetBytes ?? null,
      unusedFileCandidates: frPlan.unusedFiles?.candidates ?? null,
      topSafeDirectories,
      benchmarkDirsExcluded,
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
      ...(benchmarkDirsExcluded
        ? [`${benchmarkDirsExcluded} github-cache/ benchmark directory row(s) excluded from safe-to-delete recommendations (OSS clones, not product code).`]
        : []),
      'File reduction and roadmap walks exclude github-cache/, deliverables/, and .simplebeacon/ artifact trees.',
      ...(frExec?.notes || []),
      ...(dqExec?.notes || [])
    ].filter((note, index, all) => all.indexOf(note) === index).slice(0, 8)
  };

  analysis.artifactProfile = classifyRegenerableArtifacts(analysis);
  analysis.priorityActions = softenPriorityActions(analysis.priorityActions, analysis.artifactProfile);
  return analysis;
}

export function renderCompleteScanAnalysisPanel(analysis) {
  if (!analysis) return '';

  const fr = analysis.fileReduction;
  const dq = analysis.dataQuality;
  const artifactProfile = analysis.artifactProfile || classifyRegenerableArtifacts(analysis);
  const actions = analysis.priorityActions || [];
  const showRegenerableCallout = artifactProfile === 'regenerableOnly';

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
        ${showRegenerableCallout ? `
          <p class="analyze-info-callout mb-4">Regenerable build artifacts only (typically <code>node_modules</code> after <code>npm install</code>). Safe to delete when you need disk space — run <code>npm install</code> to restore. Not a gate failure.</p>
        ` : ''}
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

/** Align complete-scan export summary with platform-scoped gate report (excludes github-cache noise). */
export function sanitizeCompleteScanBundle(bundle, options = {}) {
  if (!bundle || bundle.type !== 'simplebeacon-complete-scan') return bundle;
  const prepare = options.preparePlatformResultsReport;
  const next = {
    ...bundle,
    results: { ...(bundle.results || {}) },
    summary: { ...(bundle.summary || {}) }
  };

  if (next.results.simplebeacon && typeof prepare === 'function') {
    next.results.simplebeacon = prepare(next.results.simplebeacon) || next.results.simplebeacon;
  }

  if (next.results.consolidation && typeof options.sanitizeConsolidationExport === 'function') {
    next.results.consolidation = options.sanitizeConsolidationExport(next.results.consolidation);
  }
  if (next.results.roadmap && typeof options.sanitizeRoadmapExport === 'function') {
    next.results.roadmap = options.sanitizeRoadmapExport(next.results.roadmap);
  }
  if (next.results.mockScan && typeof options.sanitizeFictionDigestExport === 'function') {
    next.results.mockScan = options.sanitizeFictionDigestExport(next.results.mockScan);
  }

  const sb = next.results.simplebeacon;
  const platformRepo = sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles ?? null;
  const roadmapRaw = next.summary.roadmapFiles;
  next.summary.platformScope = {
    reportHealth: sb?.scanScope?.reportHealth || 'platform-scoped',
    mockSampleFiles: sb?.mockSampleFiles ?? null,
    repositoryFilesTotal: platformRepo,
    scanPaths: sb?.scanPaths || [],
    simplebeaconGatePass: sb?.gate?.pass ?? next.summary.simplebeaconGatePass ?? null
  };

  const roadmapScoped = next.results.roadmap?.codeAnalysis?.structure?.totalFiles ?? roadmapRaw;
  if (roadmapScoped != null && platformRepo != null && roadmapScoped > platformRepo * 2) {
    next.summary.roadmapFilesRaw = roadmapScoped;
    next.summary.roadmapFiles = platformRepo;
    next.summary.roadmapFilesNote = `Roadmap walk included github-cache/ clones (${Number(roadmapScoped).toLocaleString()} files). Platform inventory: ${Number(platformRepo).toLocaleString()} files — re-run complete scan after updating Simplebeacon.`;
  } else if (roadmapScoped != null) {
    next.summary.roadmapFiles = roadmapScoped;
  }

  if (next.results.mockScan?.digestTrust) {
    next.summary.fictionDigestTrust = next.results.mockScan.digestTrust;
  }
  if (next.results.consolidation?.exportSanitized) {
    next.summary.consolidationExportSanitized = true;
  }
  if (next.results.roadmap?.exportNormalized) {
    next.summary.roadmapExportNormalized = true;
  }

  if (next.results.fileReduction || next.results.dataQuality) {
    next.completeScanAnalysis = buildCompleteScanAnalysis({
      fileReduction: next.results.fileReduction,
      dataQuality: next.results.dataQuality,
      projectPath: next.projectPath
    });
  }

  return next;
}

function isExcludedConsolidationExportPath(filePath) {
  const rel = String(filePath || '').replace(/\\/g, '/');
  return rel.startsWith('github-cache/')
    || rel.includes('/github-cache/')
    || rel.startsWith('deliverables/')
    || rel.includes('/deliverables/')
    || rel.startsWith('java-ai-vulnerable/')
    || rel.includes('/java-ai-vulnerable/');
}

function consolidationCandidateTouchesExcluded(candidate) {
  return (candidate?.files || []).some((file) =>
    isExcludedConsolidationExportPath(file.path || file.relativePath || file.name)
  );
}

function filterConsolidationAdvancedAnalysis(analysis) {
  if (!analysis) return analysis;
  const fuzzyPairs = (analysis.fuzzyNearDuplicates?.pairs || [])
    .filter((pair) => !isExcludedConsolidationExportPath(pair.fileA) && !isExcludedConsolidationExportPath(pair.fileB));
  const patternGroups = (analysis.patternConsolidation?.recommendations || [])
    .filter((group) => !(group.files || []).every((file) => isExcludedConsolidationExportPath(file.path)));
  return {
    ...analysis,
    fuzzyNearDuplicates: {
      ...analysis.fuzzyNearDuplicates,
      pairsFound: fuzzyPairs.length,
      pairs: fuzzyPairs
    },
    patternConsolidation: {
      ...analysis.patternConsolidation,
      groupsFound: patternGroups.length,
      recommendations: patternGroups
    }
  };
}

/** Strip github-cache/deliverables noise from consolidation exports; flag stale explorer inventory. */
export function sanitizeConsolidationExport(scan) {
  if (!scan?.summary) return scan;

  const repoRaw = scan.summary.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles ?? null;
  const mergeCandidates = (scan.mergeCandidates || []).filter((c) => !consolidationCandidateTouchesExcluded(c));
  const reductionOpportunities = (scan.reductionOpportunities || []).filter((o) => !consolidationCandidateTouchesExcluded(o));
  const benchmarkMergeExcluded = (scan.mergeCandidates || []).length - mergeCandidates.length;
  const platformDedupeGroups = reductionOpportunities.filter((o) => o.type === 'duplicate-removal').length;
  const dedupeGroupsExcluded = (scan.reductionOpportunities || []).filter((o) => o.type === 'duplicate-removal').length
    - platformDedupeGroups;
  const staleInventory = repoRaw != null && repoRaw > 10000;

  const next = {
    ...scan,
    mergeCandidates,
    reductionOpportunities,
    advancedAnalysis: filterConsolidationAdvancedAnalysis(scan.advancedAnalysis),
    summary: {
      ...scan.summary,
      mergeCandidates: mergeCandidates.length,
      exactDuplicateGroups: platformDedupeGroups,
      exactDuplicateGroupsRaw: dedupeGroupsExcluded > 0 || benchmarkMergeExcluded > 0
        ? scan.summary.exactDuplicateGroups
        : undefined,
      benchmarkCacheCandidatesExcluded: (scan.summary.benchmarkCacheCandidatesExcluded ?? 0)
        + benchmarkMergeExcluded
        + dedupeGroupsExcluded
    },
    scanScope: {
      ...(scan.scanScope || {}),
      reportHealth: staleInventory ? 'stale-explorer-inventory' : (scan.scanScope?.reportHealth || 'platform-scoped'),
      inventoryProfile: scan.scanScope?.inventoryProfile || (staleInventory ? 'explorer' : 'audit')
    }
  };

  if (staleInventory) {
    next.summary.repositoryFilesTotalRaw = repoRaw;
    next.summary.repositoryFilesTotal = scan.scanScope?.platformRepositoryFilesTotal ?? null;
    next.summary.staleInventoryNote =
      `Explorer inventory counted ${Number(repoRaw).toLocaleString()} files (includes github-cache/). Restart the dashboard server and re-run consolidation for platform-scoped counts (~2,200 files).`;
  }

  if (benchmarkMergeExcluded > 0 || dedupeGroupsExcluded > 0 || staleInventory) {
    next.exportSanitized = true;
    next.exportNotes = [
      ...(scan.exportNotes || []),
      ...(benchmarkMergeExcluded > 0
        ? [`${benchmarkMergeExcluded} merge candidate(s) from github-cache/ or deliverables/ excluded from export.`]
        : []),
      ...(dedupeGroupsExcluded > 0
        ? [`${dedupeGroupsExcluded} duplicate group(s) from github-cache/ or deliverables/ excluded from export.`]
        : []),
      ...(staleInventory ? [next.summary.staleInventoryNote] : [])
    ].filter((note, index, all) => all.indexOf(note) === index);
  }

  return next;
}

function roadmapPathTouchesBenchmark(filePath) {
  const rel = String(filePath || '').replace(/\\/g, '/');
  return rel.startsWith('github-cache/')
    || rel.includes('/github-cache/')
    || rel.startsWith('deliverables/')
    || rel.includes('/deliverables/');
}

function filterRoadmapTopDirectoriesExport(dirNames) {
  const skip = new Set([
    'github-cache', 'deliverables', 'data-central', 'docs', 'archive', 'node_modules', '.simplebeacon'
  ]);
  return dirNames.filter((name) => !skip.has(name));
}

/** Strip github-cache noise from roadmap exports; flag stale 41k+ file walks. */
export function sanitizeRoadmapExport(roadmap) {
  if (!roadmap || roadmap.type !== 'dynamic-project-roadmap-analysis') return roadmap;

  const structure = roadmap.codeAnalysis?.structure || {};
  const repoRaw = structure.totalFiles ?? null;
  const staleWalk = repoRaw != null && repoRaw > 14000;

  const deps = roadmap.codeAnalysis?.dependencies;
  const sampleInternal = (deps?.sampleInternal || []).filter(
    (edge) => !roadmapPathTouchesBenchmark(String(edge).split(' -> ')[0])
  );

  const phase2 = roadmap.codeAnalysis?.phase2;
  let nextPhase2 = phase2;
  if (phase2?.dependencyGraph?.edges) {
    const edges = phase2.dependencyGraph.edges.filter(
      (edge) => !roadmapPathTouchesBenchmark(edge.from) && !roadmapPathTouchesBenchmark(edge.to)
    );
    nextPhase2 = {
      ...phase2,
      dependencyGraph: {
        ...phase2.dependencyGraph,
        edges,
        edgeCount: edges.length
      }
    };
  }

  const topDirectories = filterRoadmapTopDirectoriesExport(structure.topDirectories || []);
  const mainCategories = {};
  for (const [name, category] of Object.entries(roadmap.projectStructure?.mainCategories || {})) {
    if (roadmapPathTouchesBenchmark(name)) continue;
    mainCategories[name] = category;
  }

  const next = {
    ...roadmap,
    codeAnalysis: {
      ...(roadmap.codeAnalysis || {}),
      structure: {
        ...structure,
        topDirectories,
        ...(staleWalk && roadmap.projectStructure?.totalFiles != null
          ? {
              totalFilesRaw: repoRaw,
              totalFiles: roadmap.projectStructure.totalFiles,
              staleWalkNote:
                `Filesystem walk counted ${Number(repoRaw).toLocaleString()} files (github-cache/ included). Platform structure inventory: ${Number(roadmap.projectStructure.totalFiles).toLocaleString()} files — restart server and re-run roadmap.`
            }
          : {})
      },
      dependencies: deps ? { ...deps, sampleInternal } : deps,
      phase2: nextPhase2
    },
    ...(roadmap.projectStructure
      ? {
          projectStructure: {
            ...roadmap.projectStructure,
            mainCategories
          }
        }
      : {})
  };

  if (next.strategicInsights?.sourceMetrics && staleWalk && next.projectStructure?.totalFiles != null) {
    next.strategicInsights = {
      ...next.strategicInsights,
      sourceMetrics: {
        ...next.strategicInsights.sourceMetrics,
        totalFilesRaw: repoRaw,
        totalFiles: next.projectStructure.totalFiles
      }
    };
  }

  if (staleWalk || sampleInternal.length !== (deps?.sampleInternal || []).length) {
    next.exportSanitized = true;
    next.exportNotes = [
      ...(roadmap.exportNotes || []),
      ...(staleWalk ? [next.codeAnalysis.structure.staleWalkNote] : []),
      ...(sampleInternal.length !== (deps?.sampleInternal || []).length
        ? ['github-cache/ and deliverables/ dependency samples removed from export.']
        : [])
    ].filter((note, index, all) => all.indexOf(note) === index);
  }

  return next;
}
