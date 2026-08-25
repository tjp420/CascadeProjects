/**
 * Build top-level complete scan analysis for dashboard display and export.
 */

import { escapeHtml } from '../utils.js';
import {
    classifyRegenerableArtifacts,
    softenPriorityActions,
    partitionArtifactDirectoryEntries,
    isBenchmarkCachePath
} from './complete-scan-artifact-profile.browser.js';
import { sanitizeCleanupBriefExport } from './cleanup-brief-export.browser.js?v=20260716cachefix1';
import { sanitizeDataCleanupReportExport } from './data-cleanup-export.browser.js?v=20260716cachefix1';
import { sanitizeCodebaseReportExport } from './codebase-export.browser.js?v=20260716cachefix1';
import { sanitizeRoadmapExport as applyBenchmarkRoadmapSanitize } from './roadmap-export.browser.js?v=20260716cachefix1';
import { sanitizeConsolidationExport as sanitizeConsolidationExportCore } from './consolidation-export.browser.js?v=20260716cachefix1';
import { sanitizeNpmAuditExport } from './npm-audit-export.browser.js?v=20260716cachefix1';
import { sanitizeComplianceBundleExport } from './compliance-export.browser.js?v=20260716cachefix1';
import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260716cachefix1';

/**
 * Format bytes.
 * @param {Array} bytes
 * @returns {any}
 */
function formatBytes(bytes) {
    if (bytes == null || Number.isNaN(Number(bytes))) return '—';
    const n = Number(bytes);
    if (n === 0) return '0 B';
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export { classifyRegenerableArtifacts, softenPriorityActions } from './complete-scan-artifact-profile.browser.js';

/**
 * Build complete scan analysis.
 * @param {Object} options
 * @param {any} dataQuality
 * @param {string} projectPath }
 * @returns {any}
 */
export function buildCompleteScanAnalysis({ fileReduction, dataQuality, projectPath } = {}) {
    const frPlan = fileReduction?.fileReductionPlan;
    const frExec = fileReduction?.executiveSummary;
    const dqExec = dataQuality?.executiveSummary;
    const benchmarkScan = isBenchmarkScanTarget(projectPath);

    const priorityActions = [...(frExec?.priorityActions || []), ...(dqExec?.priorityActions || [])].slice(0, 10);

    const rawTopDirs = frPlan?.safeToDelete?.topDirectories || [];
    const { measurable: topSafeDirectories, skippedShells: skippedArtifactDirectories } =
        partitionArtifactDirectoryEntries(rawTopDirs);
    const benchmarkDirsExcluded = rawTopDirs.filter(entry => isBenchmarkCachePath(entry.path)).length;

    const analysis = {
        projectPath: projectPath || fileReduction?.projectRoot || '',
        fileReduction: frPlan
            ? {
                  safeToDeleteBytes: frPlan.totals?.safeToDeleteBytes ?? null,
                  reviewBeforeDeleteBytes: frPlan.totals?.reviewBeforeDeleteBytes ?? null,
                  immediateSavingsBytes: frPlan.totals?.estimatedImmediateSavingsBytes ?? null,
                  duplicateAssetBytes: frPlan.totals?.duplicateAssetBytes ?? null,
                  unusedFileCandidates: frPlan.unusedFiles?.candidates ?? null,
                  topSafeDirectories: topSafeDirectories.slice(0, 8),
                  skippedArtifactDirectories: skippedArtifactDirectories.slice(0, 8),
                  benchmarkDirsExcluded,
                  reviewLogs: frPlan.reviewBeforeDelete?.logs?.slice(0, 8) || [],
                  summaryTable: frPlan.summaryTable || []
              }
            : null,
        dataQuality: dqExec
            ? {
                  workspacePackages: dqExec.workspace?.packageJsonFiles ?? null,
                  unusedDependencies: dqExec.workspace?.unusedDependencies ?? null,
                  envInconsistencies: dqExec.workspace?.envInconsistencies ?? null,
                  missingEnvKeys: dqExec.workspace?.missingEnvKeys ?? null,
                  shapeDriftGroups: dqExec.data?.shapeDriftGroups ?? null,
                  credentialsNeedingReview: dqExec.security?.credentialsNeedingReview ?? null,
                  piiNeedingReview: dqExec.security?.piiNeedingReview ?? null
              }
            : null,
        priorityActions,
        notes: [
            ...(frPlan?.scopeNote ? [frPlan.scopeNote] : []),
            ...(skippedArtifactDirectories.length
                ? [
                      `${skippedArtifactDirectories.length} regenerable directory shell(s) (for example node_modules, coverage) were detected but not size-walked — review-first totals are the measured reclaimable bytes.`
                  ]
                : []),
            ...(benchmarkDirsExcluded
                ? [
                      `${benchmarkDirsExcluded} github-cache/ benchmark directory row(s) excluded from safe-to-delete recommendations (OSS clones, not product code).`
                  ]
                : []),
            ...(benchmarkScan
                ? []
                : [
                      'File reduction and roadmap walks exclude github-cache/, deliverables/, and .simplebeacon/ artifact trees.'
                  ]),
            ...(benchmarkScan
                ? ['Scan target is an OSS clone under github-cache/ — not Simplebeacon product code.']
                : []),
            ...(frExec?.notes || []),
            ...(dqExec?.notes || [])
        ]
            .filter((note, index, all) => all.indexOf(note) === index)
            .slice(0, 8)
    };

    analysis.artifactProfile = classifyRegenerableArtifacts(analysis);
    analysis.priorityActions = softenPriorityActions(analysis.priorityActions, analysis.artifactProfile);
    return analysis;
}

/**
 * Render complete scan analysis panel.
 * @param {Array} analysis
 * @returns {any}
 */
export function renderCompleteScanAnalysisPanel(analysis) {
    if (!analysis) return '';

    const fr = analysis.fileReduction;
    const dq = analysis.dataQuality;
    const artifactProfile = analysis.artifactProfile || classifyRegenerableArtifacts(analysis);
    const actions = analysis.priorityActions || [];
    const showRegenerableCallout = artifactProfile === 'regenerableOnly';

    const actionItems = actions.length
        ? actions
              .slice(0, 6)
              .map(
                  action => `
        <li><strong>${escapeHtml(action.title)}</strong> <span class="text-muted">— ${escapeHtml(action.detail)}</span></li>
      `
              )
              .join('')
        : '<li class="text-muted">Re-run complete scan to populate priority actions.</li>';

    /**
     * Top dirs.
     * @param {string} fr?.topSafeDirectories || []
     * @returns {any}
     */
    const topDirs = (fr?.topSafeDirectories || [])
        .map(
            entry => `
    <li><code>${escapeHtml(entry.path)}</code> <span class="text-muted">· ${formatBytes(entry.bytes)} · ${Number(entry.files || 0).toLocaleString()} files</span></li>
  `
        )
        .join('');

    const skippedDirNames = (fr?.skippedArtifactDirectories || [])
        .map(entry => entry.path || entry.category)
        .filter(Boolean);
    const skippedDirsNote = skippedDirNames.length
        ? `<p class="text-muted mb-4" style="font-size: var(--font-size-sm);">Regenerable directories detected but not size-walked: ${skippedDirNames.map(name => `<code>${escapeHtml(name)}</code>`).join(', ')}. Sizes are omitted for performance — delete and reinstall when you need disk space.</p>`
        : '';

    return `
    <details class="card mb-4" open>
      <summary><strong>Complete scan analysis</strong></summary>
      <div class="mt-4">
        ${
            showRegenerableCallout
                ? `
          <p class="analyze-info-callout mb-4">Regenerable build artifacts only (typically <code>node_modules</code> after <code>npm install</code>). Safe to delete when you need disk space — run <code>npm install</code> to restore. Not a gate failure.</p>
        `
                : ''
        }
        <div class="metrics-row mb-4">
          ${
              fr
                  ? `
            <div class="metric-chip"><strong>${formatBytes(fr.immediateSavingsBytes)}</strong> immediate savings</div>
            <div class="metric-chip"><strong>${formatBytes(fr.safeToDeleteBytes)}</strong> safe to delete</div>
            <div class="metric-chip"><strong>${formatBytes(fr.reviewBeforeDeleteBytes)}</strong> review first</div>
            <div class="metric-chip"><strong>${Number(fr.unusedFileCandidates || 0).toLocaleString()}</strong> unused files</div>
          `
                  : ''
          }
          ${
              dq
                  ? `
            <div class="metric-chip"><strong>${Number(dq.workspacePackages || 0).toLocaleString()}</strong> workspace packages</div>
            <div class="metric-chip"><strong>${Number(dq.envInconsistencies || 0).toLocaleString()}</strong> env conflicts</div>
            <div class="metric-chip"><strong>${Number(dq.piiNeedingReview || 0).toLocaleString()}</strong> PII need review</div>
          `
                  : ''
          }
        </div>
        ${
            topDirs
                ? `
          <h3 class="mb-2" style="font-size: var(--font-size-base);">Top safe-to-delete directories</h3>
          <ul class="mb-4" style="padding-left: 1.25rem;">${topDirs}</ul>
        `
                : ''
        }
        ${skippedDirsNote}
        <h3 class="mb-2" style="font-size: var(--font-size-base);">Priority actions</h3>
        <ul class="mb-4" style="padding-left: 1.25rem;">${actionItems}</ul>
        ${
            (analysis.notes || []).length
                ? `
          <p class="text-muted" style="font-size: var(--font-size-xs);">${analysis.notes.map(note => escapeHtml(note)).join(' · ')}</p>
        `
                : ''
        }
      </div>
    </details>
  `;
}

export { formatBytes as formatCompleteScanBytes };

/**
 * Is benchmark scan target.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkScanTarget(projectPath) {
    const rel = String(projectPath || '')
        .replace(/\\/g, '/')
        .toLowerCase();
    return (
        rel.includes('/github-cache/') ||
        rel.startsWith('github-cache/') ||
        rel.includes('/java-ai-vulnerable/') ||
        rel.startsWith('java-ai-vulnerable/')
    );
}

/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}

/**
 * Has hollow gate from report.
 * @param {any} sb
 * @returns {any}
 */
function hasHollowGateFromReport(sb) {
    const ruleScoped = sb?.ruleScopedFilesAnalyzed ?? sb?.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    return Boolean(sb?.gate?.pass) && ruleScoped === 0;
}

/**
 * Infer complete scan target from hints.
 * @param {any} bundle
 * @param {Object} options
 * @returns {any}
 */
function inferCompleteScanTargetFromHints(bundle, options = {}) {
    const filename = String(options.exportFilename || options.filename || '').toLowerCase();
    if (!filename.includes('github-cache')) return '';
    const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
    if (!slugMatch) return '';
    const cloneName = slugMatch[1];
    const sourceRoot = String(
        options.projectPath ||
            bundle.projectPath ||
            bundle.results?.simplebeacon?.projectRoot ||
            bundle.results?.simplebeacon?.platformRoot ||
            ''
    ).replace(/\\/g, '/');
    if (isBenchmarkScanTarget(sourceRoot)) return '';
    const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
    if (!platformRoot) return '';
    return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}

/**
 * Resolve benchmark gate attestation.
 * @param {any} sb
 * @param {any} hollowGate
 * @returns {any}
 */
function resolveBenchmarkGateAttestation(sb, hollowGate) {
    if (hollowGate || hasHollowGateFromReport(sb)) return 'limited-benchmark';
    if (sb?.gateAttestation) return sb.gateAttestation;
    if (sb?.gate?.pass === false) return 'benchmark-clone-fail';
    if (sb?.gate?.pass) {
        const ruleScoped = sb.ruleScopedFilesAnalyzed ?? sb.scanScope?.ruleScopedFilesAnalyzed ?? 0;
        return ruleScoped > 0 ? 'benchmark-clone' : 'limited-benchmark';
    }
    return 'not-evaluated';
}

/**
 * Assemble benchmark complete scan export notes.
 * @param {Array} existingNotes
 * @returns {any}
 */
function assembleBenchmarkCompleteScanExportNotes(existingNotes = []) {
    const scopeNote = 'Complete scan export scoped to github-cache/ OSS clone — not Simplebeacon product handoff.';
    const skipPatterns = [
        /complete scan export scoped to github-cache/i,
        /benchmark clone.*not valid for simplebeacon/i,
        /jest was not (executed|run)/i
    ];
    const filteredExisting = dedupeCompleteScanExportNotes(existingNotes).filter(note => {
        const text = String(note);
        return !skipPatterns.some(re => re.test(text));
    });
    return dedupeCompleteScanExportNotes([scopeNote, ...filteredExisting]);
}

/**
 * Build benchmark complete scan hygiene summary.
 * @param {any} bundle
 * @param {Array} auditFiles
 * @returns {any}
 */
function buildBenchmarkCompleteScanHygieneSummary(bundle, auditFiles) {
    const sb = bundle.results?.simplebeacon;
    const rawLlm = sb?.llmSlopScanRaw ?? sb?.scanScope?.llmSlopScanRaw;
    const scannedLlm = sb?.llmSlopFilesScanned ?? sb?.scanScope?.llmSlopFilesScanned ?? null;
    const reconciledLlm = sb?.llmSlopScanReconciled ?? sb?.scanScope?.llmSlopScanReconciled;
    return {
        simplebeaconGatePass: bundle.summary?.simplebeaconGatePass ?? null,
        simplebeaconGateAttestation: bundle.summary?.simplebeaconGateAttestation ?? null,
        simplebeaconIssues: bundle.summary?.simplebeaconIssues ?? 0,
        complianceFailed: bundle.summary?.complianceFailed ?? 0,
        repositoryFilesTotal: bundle.summary?.platformScope?.repositoryFilesTotal ?? auditFiles ?? null,
        roadmapFiles: bundle.summary?.roadmapFiles ?? null,
        cleanupProjectedFiles: bundle.summary?.cleanupProjectedFiles ?? null,
        ...(bundle.summary?.cleanupProjectedFilesRaw != null
            ? { cleanupProjectedFilesRaw: bundle.summary.cleanupProjectedFilesRaw }
            : {}),
        roadmapMisscoped: bundle.results?.roadmap?.misscopedPlatformCodeWalk === true,
        codebaseMisscoped: bundle.results?.codebase?.misscopedPlatformCodeWalk === true,
        fictionJsonFilesScanned: sb?.fictionJsonFilesScanned ?? sb?.scanScope?.fictionJsonFilesScanned ?? null,
        llmSlopFilesScanned: scannedLlm,
        ...(reconciledLlm && rawLlm != null && scannedLlm != null && rawLlm > scannedLlm
            ? { llmSlopScanReconciledFrom: rawLlm }
            : {}),
        attestationNote: 'Complete scan on OSS benchmark clone — not Simplebeacon product handoff clearance.'
    };
}

/**
 * Sanitize compliance for complete scan.
 * @param {any} compliance
 * @param {number} gateReport
 * @param {string} projectPath
 * @param {string} context
 * @returns {any}
 */
function sanitizeComplianceForCompleteScan(compliance, gateReport, projectPath, context = {}) {
    if (!compliance) return compliance;
    const { benchmarkScan, hollowGate, productPlatformRoot } = context;
    if (!benchmarkScan && !hollowGate) return compliance;
    const summary = {
        ...(compliance.summary || {}),
        readyForAutomation: false,
        handoffEligible: false,
        benchmarkScan: benchmarkScan || undefined,
        hollowGate: hollowGate || undefined,
        scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'limited-gate-scope',
        productPlatformRoot: productPlatformRoot || undefined,
        headline: benchmarkScan
            ? 'Benchmark clone — not valid for Simplebeacon platform handoff. Run Complete scan on ai-platform.'
            : 'Limited gate scope — configure production paths before automated deploy gates.'
    };
    let rules = [...(compliance.rules || [])];
    const ruleScoped = gateReport?.ruleScopedFilesAnalyzed ?? gateReport?.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    if (ruleScoped === 0) {
        rules = rules.map(rule => {
            if (rule.id === 'GATE-001' && rule.status === 'pass') {
                return {
                    ...rule,
                    status: 'skip',
                    evidence: 'No gate-rule production paths configured for this scan target'
                };
            }
            if (
                (rule.id === 'CRED-001' || rule.id === 'LEAK-001') &&
                rule.status === 'pass' &&
                /Scanned 0 path/i.test(rule.evidence || '')
            ) {
                return {
                    ...rule,
                    status: 'skip',
                    evidence:
                        rule.id === 'CRED-001'
                            ? 'Credential rules did not scan any paths in this profile'
                            : 'Production leak rules did not scan any paths in this profile'
                };
            }
            return rule;
        });
        const passed = rules.filter(r => r.status === 'pass').length;
        const failed = rules.filter(r => r.status === 'fail').length;
        const skipped = rules.filter(r => r.status === 'skip').length;
        const scored = passed + failed;
        summary.passed = passed;
        summary.failed = failed;
        summary.skipped = skipped;
        summary.score = scored ? Math.round((passed / scored) * 100) : null;
    }
    return { ...compliance, summary, rules };
}

/**
 * Dedupe complete scan export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeCompleteScanExportNotes(notes = []) {
    const seen = new Set();
    const out = [];
    for (const note of notes) {
        const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
        const scopeKey = /complete scan export scoped to github-cache/i.test(normalized)
            ? 'benchmark-complete-scope-note'
            : /benchmark clone.*not valid for simplebeacon/i.test(normalized)
              ? 'benchmark-handoff-note'
              : /jest was not (executed|run)/i.test(normalized)
                ? 'jest-not-run-note'
                : /scan target is an oss clone under github-cache/i.test(normalized)
                  ? 'benchmark-oss-clone-note'
                  : normalized;
        if (seen.has(scopeKey)) continue;
        seen.add(scopeKey);
        out.push(String(note));
    }
    return out.slice(0, 10);
}

/**
 * Resolve roadmap summary files.
 * @param {any} roadmap
 * @param {Array} auditFiles
 * @param {any} summary
 * @returns {any}
 */
function resolveRoadmapSummaryFiles(roadmap, auditFiles, summary = {}) {
    const structure = roadmap?.codeAnalysis?.structure;
    const roadmapScoped =
        structure?.totalFilesRaw ?? structure?.totalFiles ?? summary.roadmapFilesRaw ?? summary.roadmapFiles ?? null;
    const misscoped = roadmap?.misscopedPlatformCodeWalk === true;
    if (auditFiles == null || roadmapScoped == null) {
        return {
            roadmapFiles: structure?.totalFiles ?? summary.roadmapFiles,
            roadmapFilesRaw: summary.roadmapFilesRaw,
            roadmapFilesNote: summary.roadmapFilesNote
        };
    }
    if (misscoped || roadmapScoped > auditFiles * 2) {
        return {
            roadmapFiles: auditFiles,
            roadmapFilesRaw: roadmapScoped,
            roadmapFilesNote: misscoped
                ? `Roadmap step walked Simplebeacon platform root (${Number(roadmapScoped).toLocaleString()} files) while scan target was github-cache/ clone (${Number(auditFiles).toLocaleString()} files) — re-run complete scan after updating Simplebeacon.`
                : `Roadmap walk included github-cache/ clones (${Number(roadmapScoped).toLocaleString()} files). Gate inventory: ${Number(auditFiles).toLocaleString()} files on this clone.`
        };
    }
    return {
        roadmapFiles: structure?.totalFiles ?? roadmapScoped,
        roadmapFilesRaw: summary.roadmapFilesRaw,
        roadmapFilesNote: summary.roadmapFilesNote
    };
}

/** Align complete-scan export summary with platform-scoped gate report (excludes github-cache noise). */
export function sanitizeCompleteScanBundle(bundle, options = {}) {
    if (!bundle || bundle.type !== 'simplebeacon-complete-scan') return bundle;
    const prepare = options.preparePlatformResultsReport;
    const hintedPath = inferCompleteScanTargetFromHints(bundle, options);
    const resolvedProjectPath = String(hintedPath || options.projectPath || bundle.projectPath || '').replace(
        /\\/g,
        '/'
    );
    const benchmarkScan = isBenchmarkScanTarget(resolvedProjectPath);
    const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(resolvedProjectPath) : null;
    let next = {
        ...bundle,
        projectPath: resolvedProjectPath || bundle.projectPath,
        results: { ...(bundle.results || {}) },
        summary: { ...(bundle.summary || {}) }
    };

    const nestedOptions = {
        projectPath: next.projectPath,
        benchmarkScan,
        productPlatformRoot,
        scanTargetRoot: next.projectPath,
        requestedProjectPath: next.projectPath,
        exportFilename: options.exportFilename || options.filename
    };

    if (next.results.simplebeacon && typeof prepare === 'function') {
        next.results.simplebeacon = prepare(next.results.simplebeacon, nestedOptions) || next.results.simplebeacon;
    } else if (next.results.simplebeacon) {
        next.results.simplebeacon = sanitizeSimplebeaconReportExport(next.results.simplebeacon, nestedOptions);
    }

    const repositoryFilesTotal =
        next.results.simplebeacon?.repositoryFilesTotal ?? next.results.simplebeacon?.repositoryInventory?.totalFiles;

    if (next.results.consolidation && typeof options.sanitizeConsolidationExport === 'function') {
        next.results.consolidation = options.sanitizeConsolidationExport(next.results.consolidation, nestedOptions);
    }
    if (next.results.roadmap) {
        next.results.roadmap = applyBenchmarkRoadmapSanitize(next.results.roadmap, {
            ...nestedOptions,
            repositoryFilesTotal,
            gateReport: next.results.simplebeacon || null
        });
    }
    if (next.results.mockScan && typeof options.sanitizeFictionDigestExport === 'function') {
        next.results.mockScan = options.sanitizeFictionDigestExport(next.results.mockScan, nestedOptions);
    }

    const sb = next.results.simplebeacon;
    const hollowGate = hasHollowGateFromReport(sb);
    nestedOptions.repositoryFilesTotal = sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles;
    nestedOptions.gateReport = sb || null;
    const platformRepo = sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles ?? null;
    next.summary.platformScope = {
        reportHealth: benchmarkScan ? 'benchmark-clone-scan' : sb?.scanScope?.reportHealth || 'platform-scoped',
        mockSampleFiles: sb?.mockSampleFiles ?? null,
        repositoryFilesTotal: platformRepo,
        scanPaths: sb?.scanPaths || [],
        scanTargetProfile: benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : 'product',
        productPlatformRoot: productPlatformRoot || undefined,
        simplebeaconGatePass:
            benchmarkScan && hollowGate ? null : (sb?.gate?.pass ?? next.summary.simplebeaconGatePass ?? null),
        simplebeaconGateAttestation:
            benchmarkScan && hollowGate
                ? 'limited-benchmark'
                : benchmarkScan
                  ? resolveBenchmarkGateAttestation(sb, hollowGate)
                  : hollowGate
                    ? 'limited-scope'
                    : sb?.gateAttestation ||
                      (sb?.gate?.pass ? 'platform-gate-pass' : sb?.gate?.pass === false ? 'fail' : 'not-evaluated'),
        handoffEligible: false
    };
    if (benchmarkScan) {
        next.summary.scanTargetProfile = 'benchmark-cache';
        next.summary.productPlatformRoot = productPlatformRoot;
        next.summary.handoffEligible = false;
        next.summary.simplebeaconGateAttestation = resolveBenchmarkGateAttestation(sb, hollowGate);
        if (hollowGate) {
            next.summary.simplebeaconGatePass = null;
        }
    } else if (hollowGate) {
        next.summary.scanTargetProfile = 'limited-gate-scope';
        next.summary.simplebeaconGateAttestation = 'limited-scope';
        next.summary.handoffEligible = false;
    }

    const roadmapSummary = resolveRoadmapSummaryFiles(next.results.roadmap, platformRepo, next.summary);
    next.summary.roadmapFiles = roadmapSummary.roadmapFiles;
    if (roadmapSummary.roadmapFilesRaw != null) {
        next.summary.roadmapFilesRaw = roadmapSummary.roadmapFilesRaw;
    }
    if (roadmapSummary.roadmapFilesNote) {
        next.summary.roadmapFilesNote = roadmapSummary.roadmapFilesNote;
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
        const profile = next.completeScanAnalysis?.artifactProfile;
        if (profile === 'mixed-no-safe-delete') {
            next.completeScanAnalysis.artifactProfileNote =
                'No safe-to-delete build artifacts — follow data-quality priority actions and optional duplicate consolidation.';
        }
        if (benchmarkScan && next.completeScanAnalysis) {
            /**
             * Notes.
             * @param {any} next.completeScanAnalysis.notes || []
             * @returns {any}
             */
            const notes = (next.completeScanAnalysis.notes || []).filter(note => {
                const text = String(note);
                if (/exclude(s)?\s+github-cache/i.test(text)) return false;
                if (
                    /^Scan target is an OSS clone under github-cache\/ — not Simplebeacon product code\.$/i.test(
                        text.trim()
                    )
                ) {
                    return false;
                }
                return true;
            });
            notes.unshift(
                'Scan target is an OSS clone under github-cache/ — not Simplebeacon product code. Gate rules for ai-platform paths did not apply.'
            );
            next.completeScanAnalysis = {
                ...next.completeScanAnalysis,
                scanTargetProfile: 'benchmark-cache',
                notes: dedupeCompleteScanExportNotes(notes)
            };
        } else if (next.completeScanAnalysis) {
            next.completeScanAnalysis = {
                ...next.completeScanAnalysis,
                scanTargetProfile: 'product',
                projectPath: String(next.projectPath || '').replace(/\\/g, '/')
            };
        }
    }

    if (next.results.npmAudit) {
        next.results.npmAudit = sanitizeNpmAuditExport(next.results.npmAudit, next.projectPath, {
            repositoryFilesTotal: sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles,
            gateReport: sb || null
        });
    }

    if (next.results.compliance && sb) {
        const bundled = sanitizeComplianceBundleExport({
            projectPath: next.projectPath,
            gateReport: sb,
            checklist: next.results.compliance,
            npmAudit: next.results.npmAudit || null
        });
        next.results.compliance = bundled.checklist;
        next.summary = {
            ...next.summary,
            complianceStatus: bundled.complianceStatus,
            complianceHandoffEligible: false,
            complianceExportNotes: bundled.exportNotes
        };
    } else if (next.results.compliance) {
        next.results.compliance = sanitizeComplianceForCompleteScan(next.results.compliance, sb, next.projectPath, {
            benchmarkScan,
            hollowGate,
            productPlatformRoot
        });
    }

    if (next.results.cleanupAssistant) {
        next.results.cleanupAssistant = sanitizeCleanupBriefExport(next.results.cleanupAssistant, {
            projectPath: next.projectPath,
            repositoryFilesTotal: sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles,
            gateReport: sb || null
        });
    }
    if (next.results.dataQuality) {
        next.results.dataQuality = sanitizeDataCleanupReportExport(next.results.dataQuality, {
            projectPath: next.projectPath,
            repositoryFilesTotal: sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles,
            gateReport: sb || null
        });
    }
    if (next.results.fileReduction) {
        next.results.fileReduction = sanitizeDataCleanupReportExport(next.results.fileReduction, {
            projectPath: next.projectPath,
            repositoryFilesTotal: sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles,
            gateReport: sb || null
        });
    }
    if (next.results.codebase) {
        next.results.codebase = sanitizeCodebaseReportExport(next.results.codebase, nestedOptions);
    }

    next.projectPath = String(next.projectPath || '').replace(/\\/g, '/');
    const scanTargetRoot = next.projectPath;
    const sbFinal = next.results.simplebeacon;
    const complianceResult = next.results.compliance;
    const consolidationResult = next.results.consolidation;
    const mockScanResult = next.results.mockScan;
    const cleanupResult = next.results.cleanupAssistant;

    next.summary = {
        ...next.summary,
        handoffEligible: false,
        securityHandoffEligible: false,
        ...(sbFinal
            ? {
                  simplebeaconGatePass: sbFinal.gate?.pass ?? next.summary.simplebeaconGatePass,
                  simplebeaconIssues:
                      sbFinal.issueCount ??
                      sbFinal.gate?.blockingCount ??
                      sbFinal.rawIssues?.length ??
                      next.summary.simplebeaconIssues
              }
            : {}),
        ...(complianceResult?.summary || complianceResult?.checklist?.summary
            ? {
                  compliancePassed:
                      (complianceResult.checklist?.summary ?? complianceResult.summary).passed ??
                      next.summary.compliancePassed,
                  complianceFailed:
                      (complianceResult.checklist?.summary ?? complianceResult.summary).failed ??
                      next.summary.complianceFailed
              }
            : {}),
        ...(consolidationResult?.summary
            ? {
                  consolidationDuplicateGroups:
                      consolidationResult.summary.exactDuplicateGroups ??
                      consolidationResult.summary.mergeCandidates ??
                      next.summary.consolidationDuplicateGroups
              }
            : {}),
        ...(mockScanResult
            ? {
                  fictionKpiHits: (mockScanResult.fictionIssues || []).reduce(
                      (sum, issue) => sum + (issue.count || 1),
                      0
                  ),
                  fictionDigestTrust: mockScanResult.digestTrust ?? next.summary.fictionDigestTrust
              }
            : {})
    };

    if (next.summary.platformScope) {
        next.summary.platformScope = {
            ...next.summary.platformScope,
            handoffEligible: false,
            securityHandoffEligible: false,
            scanPaths: sbFinal?.scanPaths || next.summary.platformScope.scanPaths,
            simplebeaconGatePass: next.summary.simplebeaconGatePass ?? sbFinal?.gate?.pass ?? null,
            simplebeaconGateAttestation:
                benchmarkScan && hollowGate
                    ? 'limited-benchmark'
                    : benchmarkScan
                      ? resolveBenchmarkGateAttestation(sbFinal, hollowGate)
                      : sbFinal?.gateAttestation ||
                        (sbFinal?.gate?.pass
                            ? 'platform-gate-pass'
                            : sbFinal?.gate?.pass === false
                              ? 'fail'
                              : next.summary.simplebeaconGateAttestation)
        };
    }

    const auditFiles = sbFinal?.repositoryFilesTotal ?? sbFinal?.repositoryInventory?.totalFiles;
    const cleanupExplorer =
        cleanupResult?.inventory?.explorerInventoryRaw ??
        cleanupResult?.inventory?.totalFiles ??
        next.summary.cleanupProjectedFilesRaw ??
        next.summary.cleanupProjectedFiles;
    if (auditFiles != null && cleanupExplorer != null && cleanupExplorer > auditFiles) {
        next.summary.cleanupProjectedFilesRaw = cleanupExplorer;
        next.summary.cleanupProjectedFiles = auditFiles;
        next.summary.cleanupProjectedFilesNote =
            cleanupResult?.inventory?.inventoryNote ||
            `Cleanup inventory (${Number(cleanupExplorer).toLocaleString()} files) includes un-walked shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files on this clone.`;
    } else if (cleanupResult?.inventory?.auditRepositoryFiles != null) {
        next.summary.cleanupProjectedFiles = cleanupResult.inventory.auditRepositoryFiles;
    } else if (cleanupResult?.inventory?.totalFiles != null) {
        next.summary.cleanupProjectedFiles = cleanupResult.inventory.totalFiles;
    }

    const roadmapSummaryFinal = resolveRoadmapSummaryFiles(next.results.roadmap, auditFiles, next.summary);
    next.summary.roadmapFiles = roadmapSummaryFinal.roadmapFiles;
    if (roadmapSummaryFinal.roadmapFilesRaw != null) {
        next.summary.roadmapFilesRaw = roadmapSummaryFinal.roadmapFilesRaw;
    }
    if (roadmapSummaryFinal.roadmapFilesNote) {
        next.summary.roadmapFilesNote = roadmapSummaryFinal.roadmapFilesNote;
    }
    if (next.summary.complianceExportNotes?.length) {
        next.summary.complianceExportNotes = dedupeCompleteScanExportNotes(next.summary.complianceExportNotes);
    }

    if (!benchmarkScan) {
        const exportNotes = [];
        exportNotes.push(
            'securityHandoffEligible is false — complete scan bundle is hygiene aggregation only, not vendor security handoff.'
        );
        exportNotes.push('Absolute scan paths are redacted to project label in operator exports.');
        if (auditFiles != null && cleanupExplorer != null && cleanupExplorer > auditFiles * 2) {
            exportNotes.push(
                `Cleanup brief inventory (${Number(cleanupExplorer).toLocaleString()} files) includes un-walked regenerable shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`
            );
        }
        if (next.completeScanAnalysis?.artifactProfile === 'mixed-no-safe-delete') {
            exportNotes.push(
                'No phase-1 safe-delete bytes — use priorityActions for env keys, sync I/O review, and optional duplicate consolidation.'
            );
        }
        const credentialScanned = sbFinal?.credentialScanned ?? sbFinal?.productionLeakScanned ?? null;
        const gateProfile = sbFinal?.scanScope?.profile ?? null;
        if (auditFiles != null && credentialScanned != null && credentialScanned < auditFiles) {
            exportNotes.push(
                `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(auditFiles - credentialScanned).toLocaleString()} metadata-only path(s) in full-tree inventory of ${Number(auditFiles).toLocaleString()}.`
            );
        }
        const fictionJson = sbFinal?.fictionJsonFilesScanned ?? sbFinal?.scanScope?.fictionJsonFilesScanned;
        const fictionSamples = sbFinal?.fictionSampleFilesScanned ?? sbFinal?.mockSampleFiles;
        if (fictionJson != null && fictionSamples != null) {
            exportNotes.push(
                // simplebeacon:production-leak-intent - legitimate KPI reference for gate scan reporting
                `Gate fiction KPI rules evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) with ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
            );
        }
        if (gateProfile) {
            exportNotes.push(
                `Gate rule bundle profile: ${gateProfile} — pair complete scan bundle with json/simplebeacon-gate.json for handoff evidence.`
            );
        }
        const blockingCount = sbFinal?.gate?.blockingCount ?? sbFinal?.issueCount ?? null;
        if (sbFinal?.gate?.pass === false && (blockingCount ?? 0) > 0) {
            exportNotes.push(
                `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) — complete scan bundle aggregates hygiene only; see json/simplebeacon-gate.json for production-path evidence.`
            );
        } else if (sbFinal?.gate?.pass) {
            exportNotes.push(
                'Complete scan gate pass is a hygiene bundle — not Simplebeacon vendor security handoff clearance by itself.'
            );
        }
        if (sbFinal?.scanScope?.jestExecutedDuringScan === false || sbFinal?.jestBaselineChecked === false) {
            exportNotes.push(
                'Jest was not run during the gate step — run `npm test` or `simplebeacon:full` before vendor handoff sign-off.'
            );
        }
        exportNotes.push(
            'Compliance checklist attests rule rows only — handoffEligible remains false until operator sign-off.'
        );
        const hygieneSummary = {
            completeScanHealthStatus:
                next.summary.simplebeaconGatePass && (next.summary.complianceFailed ?? 1) === 0
                    ? 'hygiene-pass-not-handoff'
                    : 'review-required',
            enginesRun: next.enginesRun?.length ?? next.summary?.stepCount ?? null,
            stepsCompleted: next.summary?.stepsCompleted ?? null,
            gatePass: next.summary.simplebeaconGatePass ?? sbFinal?.gate?.pass ?? null,
            blockingCount,
            gateRepositoryFilesTotal: auditFiles,
            ...(credentialScanned != null ? { credentialScanned } : {}),
            ...(credentialScanned != null ? { contentFilesScanned: credentialScanned } : {}),
            ...(auditFiles != null && credentialScanned != null && auditFiles > credentialScanned
                ? { gateMetadataOnlyFiles: auditFiles - credentialScanned }
                : {}),
            ...(fictionJson != null ? { fictionJsonFilesScanned: fictionJson } : {}),
            ...(fictionSamples != null ? { fictionSampleFilesScanned: fictionSamples } : {}),
            ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
            compliancePassed: next.summary.compliancePassed ?? null,
            complianceFailed: next.summary.complianceFailed ?? null,
            euAiActIncluded: next.summary.euAiActIncluded ?? null,
            jestBaselineChecked: sbFinal?.jestBaselineChecked === false ? false : undefined,
            attestationNote:
                'Complete scan bundle — nested engine exports are hygiene only, not vendor handoff certification.'
        };
        next = {
            ...next,
            exportNormalized: true,
            exportSanitized: true,
            scanTargetProfile: 'product',
            securityHandoffEligible: false,
            handoffEligible: false,
            completeScanHealthStatus:
                next.summary.simplebeaconGatePass && (next.summary.complianceFailed ?? 1) === 0
                    ? 'hygiene-pass-not-handoff'
                    : 'review-required',
            scanScope: {
                resultsViewScope: 'complete-scan-bundle',
                securityHandoffEligible: false,
                ...(auditFiles != null ? { gateRepositoryFilesTotal: auditFiles } : {}),
                ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
                completeScanNote:
                    'Complete scan bundle — pair with json/simplebeacon-gate.json and per-engine JSON exports for handoff evidence.'
            },
            hygieneSummary,
            exportNotes: dedupeCompleteScanExportNotes(exportNotes).slice(0, 14)
        };
    } else {
        next = {
            ...next,
            exportSanitized: true,
            exportNormalized: true,
            benchmarkScan: true,
            scanTargetProfile: 'benchmark-cache',
            scanTargetRoot,
            platformRoot: productPlatformRoot || scanTargetRoot,
            productPlatformRoot: productPlatformRoot || undefined,
            handoffEligible: false,
            securityHandoffEligible: false,
            completeScanHealthStatus: next.summary.simplebeaconGatePass
                ? 'benchmark-hygiene-pass'
                : 'benchmark-review-required',
            hygieneSummary: buildBenchmarkCompleteScanHygieneSummary(next, auditFiles),
            exportNotes: assembleBenchmarkCompleteScanExportNotes(next.exportNotes || [])
        };
    }

    return next;
}

/** Strip github-cache/deliverables noise; benchmark-clone scope for OSS exports. */
export function sanitizeConsolidationExport(scan, options = {}) {
    return sanitizeConsolidationExportCore(scan, options);
}

/**
 * Roadmap path touches benchmark.
 * @param {string} filePath
 * @returns {any}
 */
function roadmapPathTouchesBenchmark(filePath) {
    const rel = String(filePath || '').replace(/\\/g, '/');
    return (
        rel.startsWith('github-cache/') ||
        rel.includes('/github-cache/') ||
        rel.startsWith('deliverables/') ||
        rel.includes('/deliverables/')
    );
}

/**
 * Filter roadmap top directories export.
 * @param {Array} dirNames
 * @returns {any}
 */
function filterRoadmapTopDirectoriesExport(dirNames) {
    const skip = new Set([
        'github-cache',
        'deliverables',
        'data-central',
        'docs',
        'archive',
        'node_modules',
        '.simplebeacon'
    ]);
    return dirNames.filter(name => !skip.has(name));
}

/** Strip github-cache noise from roadmap exports; flag stale 41k+ file walks. */
export function sanitizeRoadmapExport(roadmap, options = {}) {
    if (!roadmap || roadmap.type !== 'dynamic-project-roadmap-analysis') return roadmap;

    const benchmarkScan =
        options.benchmarkScan ||
        isBenchmarkCachePath(options.scanTargetRoot || options.requestedProjectPath || '') ||
        isBenchmarkCachePath(roadmap.scanTargetRoot || roadmap.requestedScanRoot || '') ||
        isBenchmarkCachePath(roadmap.sourceProjectPath || roadmap.projectStructure?.projectRoot || '');

    const structure = roadmap.codeAnalysis?.structure || {};
    const repoRaw = structure.totalFiles ?? null;
    const staleWalk = repoRaw != null && repoRaw > 14000;

    const deps = roadmap.codeAnalysis?.dependencies;
    const sampleInternal = (deps?.sampleInternal || []).filter(
        edge => !roadmapPathTouchesBenchmark(String(edge).split(' -> ')[0])
    );

    const phase2 = roadmap.codeAnalysis?.phase2;
    let nextPhase2 = phase2;
    if (phase2?.dependencyGraph?.edges) {
        const edges = phase2.dependencyGraph.edges.filter(
            edge => !roadmapPathTouchesBenchmark(edge.from) && !roadmapPathTouchesBenchmark(edge.to)
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

    let next = {
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
                          staleWalkNote: `Filesystem walk counted ${Number(repoRaw).toLocaleString()} files (github-cache/ included). Platform structure inventory: ${Number(roadmap.projectStructure.totalFiles).toLocaleString()} files — restart server and re-run roadmap.`
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

    if (staleWalk || sampleInternal.length !== (deps?.sampleInternal || []).length || benchmarkScan) {
        next.exportSanitized = true;
        next.exportNotes = [
            ...(roadmap.exportNotes || []),
            ...(benchmarkScan
                ? ['Simplebeacon v1-internal deploy block removed for github-cache/ benchmark target.']
                : []),
            ...(staleWalk && !benchmarkScan ? [next.codeAnalysis.structure.staleWalkNote] : []),
            ...(staleWalk && benchmarkScan
                ? [
                      `Filesystem walk counted ${Number(repoRaw).toLocaleString()} files in this OSS clone — not ai-platform product inventory.`
                  ]
                : []),
            ...(sampleInternal.length !== (deps?.sampleInternal || []).length
                ? ['github-cache/ and deliverables/ dependency samples removed from export.']
                : [])
        ].filter((note, index, all) => all.indexOf(note) === index);
    }

    return applyBenchmarkRoadmapSanitize(next, options);
}
