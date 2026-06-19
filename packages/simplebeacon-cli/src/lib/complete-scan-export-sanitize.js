/**
 * Sanitize complete-scan export JSON — benchmark clones, hollow gate, compliance summary.
 */

const { isExternalBenchmarkCachePath } = require('./benchmark-cache-paths');
const { sanitizeNpmAuditExport: sanitizeNpmAuditPayload } = require('./npm-audit-export-sanitize');
const {
    hasHollowGateAttestation,
    sanitizeComplianceForExport,
    sanitizeComplianceBundleExport,
    sanitizeComplianceChecklistArtifactExport,
    sanitizeGateReportForComplianceExport
} = require('./compliance-export-sanitize');
const { sanitizeCleanupBriefExport } = require('./cleanup-brief-export-sanitize');
const { sanitizeDataCleanupReportExport } = require('./data-cleanup-export-sanitize');
const { sanitizeCodebaseReportExport } = require('./codebase-export-sanitize');
const { sanitizeFictionDigestExport } = require('./fiction-digest-export-sanitize');
const { sanitizeConsolidationExport } = require('./consolidation-export-sanitize');
const { sanitizeRoadmapExport } = require('./roadmap-export-sanitize');
const { sanitizeSimplebeaconReportExport } = require('./simplebeacon-report-export-sanitize');
const { redactProjectPathForExport, projectLabelFromPath } = require('./assessment-export-sanitize');
const {
    classifyRegenerableArtifacts,
    softenPriorityActions
} = require('./complete-scan-artifact-profile');

function isBenchmarkCacheProjectPath(projectPath) {
    return isExternalBenchmarkCachePath(String(projectPath || '').replace(/\\/g, '/'));
}

function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}

const SIMPLEBEACON_ROADMAP_MARKERS = [
    /docker-compose\.phase2\.yml/i,
    /constants.MS_PER_SECOND\/1000/i,
    /v1-internal/i,
    /simplebeacon:deploy/i,
    /verify:v1-internal-profile/i,
    /verify:production-deploy/i,
    /LLAMA_CPP_BIN/i,
    /simplebeacon\.ai/i,
    /npm run test:coverage/i
];

function lineTouchesSimplebeaconTemplate(line) {
    const text = String(line || '');
    return SIMPLEBEACON_ROADMAP_MARKERS.some((re) => re.test(text));
}

function sanitizeRoadmapForBenchmark(roadmap, productPlatformRoot, scanTargetRoot, repositoryFilesTotal) {
    const { sanitizeRoadmapExport } = require('./roadmap-export-sanitize');
    return sanitizeRoadmapExport(roadmap, {
        benchmarkScan: true,
        productPlatformRoot,
        scanTargetRoot,
        requestedProjectPath: scanTargetRoot,
        repositoryFilesTotal
    });
}

function sanitizeEmbeddedEuAiActSprint(sprint, nestedOptions = {}) {
    if (!sprint || typeof sprint !== 'object' || sprint.ok === false) return sprint;
    try {
        const { sanitizeEuAiActSprintArtifactExport } = require('../../../../server/lib/eu-ai-act-export.js');
const constants = require('../../../../ai-platform/server/config/constants.cjs');
        return sanitizeEuAiActSprintArtifactExport(sprint, nestedOptions);
    } catch {
        const label = projectLabelFromPath(nestedOptions.projectPath || sprint.projectPath || '');
        return {
            ...sprint,
            projectPath: redactProjectPathForExport(sprint.projectPath, label),
            platformRoot: redactProjectPathForExport(sprint.platformRoot, label),
            ...(sprint.artifacts
                ? {
                    artifacts: {
                        ...sprint.artifacts,
                        report: (() => {
                            const value = sprint.artifacts.report;
                            if (value == null || value === '') return value;
                            const normalized = String(value).replace(/\\/g, '/');
                            const projectNormalized = String(nestedOptions.projectPath || sprint.projectPath || '').replace(/\\/g, '/');
                            if (projectNormalized && normalized.startsWith(projectNormalized + '/')) {
                                return normalized.slice(projectNormalized.length + 1);
                            }
                            return redactProjectPathForExport(value, label);
                        })()
                    }
                }
                : {}),
            ...(sprint.report
                ? { report: { ...sprint.report, projectRoot: redactProjectPathForExport(sprint.report.projectRoot, label) } }
                : {}),
            ...(sprint.complianceChecklist
                ? { complianceChecklist: { ...sprint.complianceChecklist, projectRoot: redactProjectPathForExport(sprint.complianceChecklist.projectRoot, label) } }
                : {}),
            ...(sprint.assessment
                ? { assessment: { ...sprint.assessment, projectRoot: redactProjectPathForExport(sprint.assessment.projectRoot, label) } }
                : {})
        };
    }
}

function redactCompleteScanProjectPath(bundle, projectPath) {
    const label = projectLabelFromPath(projectPath);
    const redacted = redactProjectPathForExport(projectPath, label);
    return {
        ...bundle,
        projectPath: redacted,
        ...(bundle.completeScanAnalysis
            ? {
                completeScanAnalysis: {
                    ...bundle.completeScanAnalysis,
                    projectPath: redactProjectPathForExport(bundle.completeScanAnalysis.projectPath || projectPath, label)
                }
            }
            : {})
    };
}

function normalizeBundleProjectPath(projectPath) {
    return String(projectPath || '').replace(/\\/g, '/');
}

function inferCompleteScanTargetFromHints(bundle, options = {}) {
    const filename = String(options.exportFilename || options.filename || '').toLowerCase();
    if (!filename.includes('github-cache')) return '';
    const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
    if (!slugMatch) return '';
    const cloneName = slugMatch[1];
    const sourceRoot = normalizeBundleProjectPath(
        options.projectPath
        || bundle.projectPath
        || bundle.results?.simplebeacon?.projectRoot
        || bundle.results?.simplebeacon?.platformRoot
        || ''
    );
    if (isBenchmarkCacheProjectPath(sourceRoot)) return '';
    const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
    if (!platformRoot) return '';
    return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}

function resolveBenchmarkGateAttestation(sb, hollowGate) {
    if (hollowGate || hasHollowGateAttestation(sb)) return 'limited-benchmark';
    if (sb?.gateAttestation) return sb.gateAttestation;
    if (sb?.gate?.pass === false) return 'benchmark-clone-fail';
    if (sb?.gate?.pass) {
        const ruleScoped = sb.ruleScopedFilesAnalyzed ?? sb.scanScope?.ruleScopedFilesAnalyzed ?? 0;
        return ruleScoped > 0 ? 'benchmark-clone' : 'limited-benchmark';
    }
    return 'not-evaluated';
}

function assembleBenchmarkCompleteScanExportNotes(existingNotes = []) {
    const scopeNote = 'Complete scan export scoped to github-cache/ OSS clone — not Simplebeacon product handoff.';
    const skipPatterns = [
        /complete scan export scoped to github-cache/i,
        /benchmark clone.*not valid for simplebeacon/i,
        /jest was not (executed|run)/i
    ];
    const filteredExisting = dedupeCompleteScanExportNotes(existingNotes).filter((note) => {
        const text = String(note);
        return !skipPatterns.some((re) => re.test(text));
    });
    return dedupeCompleteScanExportNotes([scopeNote, ...filteredExisting]);
}

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

function resolveCompleteScanGateContext(bundle, options = {}) {
    const sb = options.gateReport || bundle.results?.simplebeacon || {};
    const hygiene = bundle.hygieneSummary || {};
    const scanScope = bundle.scanScope || {};
    const repositoryFilesTotal = options.repositoryFilesTotal
        ?? sb.repositoryFilesTotal
        ?? sb.repositoryInventory?.totalFiles
        ?? bundle.summary?.platformScope?.repositoryFilesTotal
        ?? scanScope.gateRepositoryFilesTotal
        ?? hygiene.gateRepositoryFilesTotal
        ?? null;
    const credentialScanned = sb.credentialScanned
        ?? sb.productionLeakScanned
        ?? hygiene.credentialScanned
        ?? hygiene.contentFilesScanned
        ?? null;
    const contentScanned = sb.scanScope?.fullDirectoryStats?.contentScanned
        ?? sb.scanScope?.fullDirectoryStats?.filesContentScanned
        ?? sb.credentialScanned
        ?? sb.productionLeakScanned
        ?? hygiene.contentFilesScanned
        ?? hygiene.credentialScanned
        ?? null;
    const gateProfile = sb.scanScope?.profile
        ?? scanScope.gateRuleBundleProfile
        ?? hygiene.gateRuleBundleProfile
        ?? null;
    const fictionJsonFilesScanned = sb.fictionJsonFilesScanned
        ?? sb.scanScope?.fictionJsonFilesScanned
        ?? hygiene.fictionJsonFilesScanned
        ?? null;
    const fictionSampleFilesScanned = sb.fictionSampleFilesScanned
        ?? sb.mockSampleFiles
        ?? sb.scanScope?.fictionSampleFilesScanned
        ?? hygiene.fictionSampleFilesScanned
        ?? null;
    const gatePass = bundle.summary?.simplebeaconGatePass ?? sb.gate?.pass ?? hygiene.gatePass ?? null;
    const blockingCount = sb.gate?.blockingCount
        ?? sb.issueCount
        ?? bundle.summary?.simplebeaconIssues
        ?? hygiene.blockingCount
        ?? null;
    const jestBaselineChecked = sb.jestBaselineChecked === false
        || sb.scanScope?.jestExecutedDuringScan === false
        || hygiene.jestBaselineChecked === false
        ? false
        : null;
    return {
        gateReport: sb,
        repositoryFilesTotal,
        credentialScanned,
        contentScanned,
        gateProfile,
        fictionJsonFilesScanned,
        fictionSampleFilesScanned,
        gatePass,
        blockingCount,
        jestBaselineChecked,
        complianceFailed: bundle.summary?.complianceFailed ?? null,
        compliancePassed: bundle.summary?.compliancePassed ?? null,
        enginesRun: bundle.enginesRun?.length ?? bundle.summary?.stepCount ?? null
    };
}

function buildProductCompleteScanHygieneSummary(bundle, gateContext = {}) {
    const { repositoryFilesTotal, credentialScanned, contentScanned, gateProfile,
        fictionJsonFilesScanned, fictionSampleFilesScanned, gatePass, blockingCount,
        jestBaselineChecked, complianceFailed, compliancePassed, enginesRun } = gateContext;
    const hygiene = bundle.hygieneSummary || {};
    const completeScanHealthStatus = hygiene.completeScanHealthStatus
        ?? ((gatePass && (complianceFailed ?? bundle.summary?.complianceFailed ?? 1) === 0)
            ? 'hygiene-pass-not-handoff'
            : 'review-required');
    return {
        completeScanHealthStatus,
        enginesRun,
        stepsCompleted: bundle.summary?.stepsCompleted ?? enginesRun ?? null,
        ...(gatePass != null ? { gatePass } : {}),
        ...(blockingCount != null ? { blockingCount } : {}),
        ...(repositoryFilesTotal != null ? { gateRepositoryFilesTotal: repositoryFilesTotal } : {}),
        ...(credentialScanned != null ? { credentialScanned } : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        ...(repositoryFilesTotal != null && credentialScanned != null && repositoryFilesTotal > credentialScanned
            ? { gateMetadataOnlyFiles: repositoryFilesTotal - credentialScanned }
            : {}),
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(compliancePassed != null ? { compliancePassed } : {}),
        ...(complianceFailed != null ? { complianceFailed } : {}),
        ...(bundle.summary?.euAiActIncluded != null ? { euAiActIncluded: bundle.summary.euAiActIncluded } : {}),
        ...(jestBaselineChecked === false ? { jestBaselineChecked: false } : {}),
        attestationNote: 'Complete scan bundle — nested engine exports are hygiene only, not vendor handoff certification.'
    };
}

function buildProductCompleteScanScanScope(bundle, gateContext = {}) {
    const { repositoryFilesTotal, gateProfile } = gateContext;
    return {
        ...(bundle.scanScope || {}),
        resultsViewScope: 'complete-scan-bundle',
        securityHandoffEligible: false,
        ...(repositoryFilesTotal != null ? { gateRepositoryFilesTotal: repositoryFilesTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        completeScanNote: bundle.scanScope?.completeScanNote
            || 'Complete scan bundle — pair with json/simplebeacon-gate.json and per-engine JSON exports for handoff evidence.'
    };
}

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
    return out.slice(0, 14);
}

function resolveRoadmapSummaryFiles(roadmap, auditFiles, summary = {}) {
    const structure = roadmap?.codeAnalysis?.structure;
    const roadmapScoped = structure?.totalFilesRaw
        ?? structure?.totalFiles
        ?? summary.roadmapFilesRaw
        ?? summary.roadmapFiles
        ?? null;
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

function rebuildCompleteScanAnalysis(bundle, benchmarkScan) {
    const fileReduction = bundle.results?.fileReduction;
    const dataQuality = bundle.results?.dataQuality;
    const frPlan = fileReduction?.fileReductionPlan;
    const frExec = fileReduction?.executiveSummary;
    const dqExec = dataQuality?.executiveSummary;

    const priorityActions = [
        ...(frExec?.priorityActions || []),
        ...(dqExec?.priorityActions || [])
    ].slice(0, 10);

    const analysis = {
        projectPath: normalizeBundleProjectPath(bundle.projectPath || fileReduction?.projectRoot || ''),
        fileReduction: frPlan ? {
            safeToDeleteBytes: frPlan.totals?.safeToDeleteBytes ?? null,
            reviewBeforeDeleteBytes: frPlan.totals?.reviewBeforeDeleteBytes ?? null,
            immediateSavingsBytes: frPlan.totals?.estimatedImmediateSavingsBytes ?? null,
            duplicateAssetBytes: frPlan.totals?.duplicateAssetBytes ?? null,
            unusedFileCandidates: frPlan.unusedFiles?.candidates ?? null,
            topSafeDirectories: frPlan.safeToDelete?.topDirectories?.slice(0, 8) || [],
            reviewLogs: frPlan.reviewBeforeDelete?.logs?.slice(0, 8) || [],
            summaryTable: frPlan.summaryTable || []
        } : bundle.completeScanAnalysis?.fileReduction || null,
        dataQuality: dqExec ? {
            workspacePackages: dqExec.workspace?.packageJsonFiles ?? null,
            unusedDependencies: dqExec.workspace?.unusedDependencies ?? null,
            envInconsistencies: dqExec.workspace?.envInconsistencies ?? null,
            missingEnvKeys: dqExec.workspace?.missingEnvKeys ?? null,
            shapeDriftGroups: dqExec.data?.shapeDriftGroups ?? null,
            credentialsNeedingReview: dqExec.security?.credentialsNeedingReview ?? null,
            piiNeedingReview: dqExec.security?.piiNeedingReview ?? null
        } : bundle.completeScanAnalysis?.dataQuality || null,
        priorityActions: priorityActions.length ? priorityActions : (bundle.completeScanAnalysis?.priorityActions || []),
        notes: replaceMisleadingAnalysisNotes(bundle.completeScanAnalysis?.notes || [], benchmarkScan)
    };

    analysis.artifactProfile = classifyRegenerableArtifacts(analysis);
    analysis.priorityActions = softenPriorityActions(analysis.priorityActions, analysis.artifactProfile);
    if (analysis.artifactProfile === 'mixed-no-safe-delete') {
        analysis.artifactProfileNote = 'No safe-to-delete build artifacts — follow data-quality priority actions and optional duplicate consolidation.';
    }
    return analysis;
}

function buildProductCompleteScanExportNotes(bundle, context = {}) {
    const notes = [
        'securityHandoffEligible is false — complete scan bundle is hygiene aggregation only, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    const sb = bundle.results?.simplebeacon;
    const auditFiles = context.repositoryFilesTotal
        ?? sb?.repositoryFilesTotal
        ?? sb?.repositoryInventory?.totalFiles;
    const cleanupInv = bundle.results?.cleanupAssistant?.inventory?.totalFiles
        ?? bundle.summary?.cleanupProjectedFiles;
    if (auditFiles != null && cleanupInv != null && cleanupInv > auditFiles * 2) {
        notes.push(
            `Cleanup brief inventory (${Number(cleanupInv).toLocaleString()} files) includes un-walked regenerable shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`
        );
    }
    if (bundle.completeScanAnalysis?.artifactProfile === 'mixed-no-safe-delete') {
        notes.push('No phase-1 safe-delete bytes — use priorityActions for env keys, sync I/O review, and optional duplicate consolidation.');
    }
    const { credentialScanned, gateProfile, fictionJsonFilesScanned, fictionSampleFilesScanned,
        gatePass, blockingCount, jestBaselineChecked } = context;
    if (auditFiles != null && credentialScanned != null && credentialScanned < auditFiles) {
        notes.push(
            `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(auditFiles - credentialScanned).toLocaleString()} metadata-only path(s) in full-tree inventory of ${Number(auditFiles).toLocaleString()}.`
        );
    }
    if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
        notes.push(
            `Gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) with ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched.`
        );
    }
    if (gateProfile) {
        notes.push(`Gate rule bundle profile: ${gateProfile} — pair complete scan bundle with json/simplebeacon-gate.json for handoff evidence.`);
    }
    if (gatePass === false && (blockingCount ?? 0) > 0) {
        notes.push(
            `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) — complete scan bundle aggregates hygiene only; see json/simplebeacon-gate.json for production-path evidence.`
        );
    } else if (sb?.gate?.pass) {
        notes.push('Complete scan gate pass is a hygiene bundle — not Simplebeacon vendor security handoff clearance by itself.');
    }
    if (jestBaselineChecked === false || sb?.scanScope?.jestExecutedDuringScan === false || sb?.jestBaselineChecked === false) {
        notes.push('Jest was not run during the gate step — run `npm test` or `simplebeacon:full` before vendor handoff sign-off.');
    }
    if (context.complianceHandoffEligible === false) {
        notes.push('Compliance checklist export attests rule rows only — handoffEligible remains false until operator sign-off.');
    }
    return dedupeCompleteScanExportNotes(notes).slice(0, 14);
}

function recomputeCompleteScanSummary(bundle, context = {}) {
    const summary = { ...(bundle.summary || {}) };
    const sb = bundle.results?.simplebeacon;
    const consolidation = bundle.results?.consolidation;
    const mockScan = bundle.results?.mockScan;
    const compliance = bundle.results?.compliance;
    const cleanup = bundle.results?.cleanupAssistant;
    const roadmap = bundle.results?.roadmap;
    const codebase = bundle.results?.codebase;
    const fileReduction = bundle.results?.fileReduction;
    const dataQuality = bundle.results?.dataQuality;

    if (sb) {
        summary.simplebeaconGatePass = sb.gate?.pass ?? summary.simplebeaconGatePass;
        summary.simplebeaconIssues = sb.issueCount
            ?? sb.gate?.blockingCount
            ?? (sb.rawIssues?.length ?? summary.simplebeaconIssues);
        if (context.benchmarkScan) {
            summary.simplebeaconGateAttestation = resolveBenchmarkGateAttestation(sb, context.hollowGate);
        } else if (context.hollowGate) {
            summary.simplebeaconGateAttestation = 'limited-scope';
        } else {
            summary.simplebeaconGateAttestation = sb.gateAttestation
                || (sb.gate?.pass ? 'platform-gate-pass' : sb.gate?.pass === false ? 'fail' : summary.simplebeaconGateAttestation);
        }
    }

    const complianceSummary = compliance?.checklist?.summary ?? compliance?.summary;
    if (complianceSummary) {
        summary.compliancePassed = complianceSummary.passed ?? summary.compliancePassed;
        summary.complianceFailed = complianceSummary.failed ?? summary.complianceFailed;
    }

    if (consolidation?.summary) {
        summary.consolidationDuplicateGroups = consolidation.summary.exactDuplicateGroups
            ?? consolidation.summary.mergeCandidates
            ?? summary.consolidationDuplicateGroups;
    }

    if (mockScan) {
        summary.fictionKpiHits = (mockScan.fictionIssues || []).reduce(
            (sum, issue) => sum + (issue.count || 1),
            0
        );
        summary.fictionDigestTrust = mockScan.digestTrust ?? summary.fictionDigestTrust;
    }

    if (roadmap?.codeAnalysis?.structure?.totalFiles != null || summary.roadmapFiles != null) {
        const auditFiles = sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles ?? null;
        const roadmapSummary = resolveRoadmapSummaryFiles(roadmap, auditFiles, summary);
        summary.roadmapFiles = roadmapSummary.roadmapFiles;
        if (roadmapSummary.roadmapFilesRaw != null) {
            summary.roadmapFilesRaw = roadmapSummary.roadmapFilesRaw;
        }
        if (roadmapSummary.roadmapFilesNote) {
            summary.roadmapFilesNote = roadmapSummary.roadmapFilesNote;
        }
    }

    if (codebase?.summary?.healthScore != null) {
        summary.codebaseHealthScore = codebase.summary.healthScore;
    }
    if (codebase?.summary?.totalFindings != null) {
        summary.codebaseFindings = codebase.summary.totalFindings;
    }

    if (fileReduction?.summary?.totalFindings != null) {
        summary.fileReductionFindings = fileReduction.summary.totalFindings;
    }
    if (fileReduction?.summary?.unusedCandidates != null) {
        summary.fileReductionUnusedCandidates = fileReduction.summary.unusedCandidates;
    }

    if (dataQuality?.summary?.totalFindings != null) {
        summary.dataQualityFindings = dataQuality.summary.totalFindings;
    }

    const auditFiles = sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles ?? null;
    const cleanupExplorer = cleanup?.inventory?.explorerInventoryRaw
        ?? cleanup?.inventory?.totalFiles
        ?? summary.cleanupProjectedFilesRaw
        ?? summary.cleanupProjectedFiles;
    if (auditFiles != null && cleanupExplorer != null && cleanupExplorer > auditFiles) {
        summary.cleanupProjectedFilesRaw = cleanupExplorer;
        summary.cleanupProjectedFiles = auditFiles;
        summary.cleanupProjectedFilesNote = cleanup?.inventory?.inventoryNote
            || `Cleanup inventory (${Number(cleanupExplorer).toLocaleString()} files) includes un-walked shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files on this clone.`;
    } else if (cleanup?.inventory?.auditRepositoryFiles != null) {
        summary.cleanupProjectedFiles = cleanup.inventory.auditRepositoryFiles;
    } else if (cleanup?.inventory?.totalFiles != null) {
        summary.cleanupProjectedFiles = cleanup.inventory.totalFiles;
    }

    if (consolidation?.exportSanitized || consolidation?.exportNormalized) {
        summary.consolidationExportSanitized = true;
    }
    if (roadmap?.exportNormalized) {
        summary.roadmapExportNormalized = true;
    }

    return summary;
}

function applySummaryAttestation(bundle, context) {
    const recomputed = recomputeCompleteScanSummary(bundle, context);
    const sb = bundle.results?.simplebeacon;
    const summary = { ...recomputed };
    const normalizedPath = normalizeBundleProjectPath(bundle.projectPath);

    if (context.benchmarkScan) {
        summary.scanTargetProfile = 'benchmark-cache';
        summary.productPlatformRoot = context.productPlatformRoot || null;
        summary.simplebeaconGateAttestation = resolveBenchmarkGateAttestation(sb, context.hollowGate || hasHollowGateAttestation(sb));
        if (hasHollowGateAttestation(sb)) {
            summary.simplebeaconGatePass = null;
        } else if ((summary.simplebeaconIssues ?? 0) === 0) {
            summary.simplebeaconGatePass = true;
        }
    } else if (context.hollowGate) {
        summary.scanTargetProfile = summary.scanTargetProfile || 'limited-gate-scope';
        summary.simplebeaconGateAttestation = 'limited-scope';
    } else {
        summary.scanTargetProfile = 'product';
        summary.simplebeaconGateAttestation = sb?.gateAttestation
            || (sb?.gate?.pass ? 'platform-gate-pass' : 'not-evaluated');
    }

    summary.handoffEligible = false;
    summary.securityHandoffEligible = false;
    summary.complianceHandoffEligible = context.complianceHandoffEligible ?? false;
    if (context.complianceExportNotes?.length) {
        summary.complianceExportNotes = dedupeCompleteScanExportNotes(context.complianceExportNotes);
    }

    const auditFiles = sb?.repositoryFilesTotal ?? sb?.repositoryInventory?.totalFiles ?? null;
    summary.platformScope = {
        reportHealth: context.benchmarkScan
            ? 'benchmark-clone-scan'
            : (sb?.scanScope?.reportHealth || 'platform-scoped'),
        mockSampleFiles: sb?.mockSampleFiles ?? summary.platformScope?.mockSampleFiles ?? null,
        repositoryFilesTotal: auditFiles,
        scanPaths: sb?.scanPaths || summary.platformScope?.scanPaths || [],
        scanTargetProfile: summary.scanTargetProfile || 'product',
        productPlatformRoot: context.productPlatformRoot || undefined,
        simplebeaconGatePass: summary.simplebeaconGatePass ?? sb?.gate?.pass ?? null,
        simplebeaconGateAttestation: summary.simplebeaconGateAttestation,
        handoffEligible: false,
        securityHandoffEligible: false
    };

    return {
        ...bundle,
        projectPath: redactProjectPathForExport(normalizedPath || bundle.projectPath, projectLabelFromPath(normalizedPath)),
        summary
    };
}

function replaceMisleadingAnalysisNotes(notes = [], benchmarkScan) {
    const filtered = notes.filter((note) => {
        if (!benchmarkScan) return true;
        const text = String(note);
        if (/exclude(s)?\s+github-cache/i.test(text)) return false;
        if (/^Scan target is an OSS clone under github-cache\/ — not Simplebeacon product code\.$/i.test(text.trim())) {
            return false;
        }
        return true;
    });
    if (benchmarkScan) {
        filtered.unshift(
            'Scan target is an OSS clone under github-cache/ — not Simplebeacon product code. Gate rules for ai-platform paths did not apply.'
        );
    }
    return dedupeCompleteScanExportNotes(filtered);
}

/**
 * @param {object} bundle complete-scan export payload
 * @param {object} [options]
 * @returns {object}
 */
function sanitizeCompleteScanExport(bundle, options = {}) {
    if (!bundle || bundle.type !== 'simplebeacon-complete-scan') return bundle;

    const hintedPath = inferCompleteScanTargetFromHints(bundle, options);
    const projectPath = normalizeBundleProjectPath(
        hintedPath
        || options.projectPath
        || bundle.projectPath
        || bundle.results?.simplebeacon?.projectRoot
        || ''
    );
    const benchmarkScan = options.benchmarkScan ?? isBenchmarkCacheProjectPath(projectPath);
    const productPlatformRoot = benchmarkScan
        ? (options.productPlatformRoot || resolveProductPlatformRoot(projectPath))
        : null;
    const nestedOptions = {
        projectPath,
        benchmarkScan,
        productPlatformRoot,
        scanTargetRoot: projectPath,
        requestedProjectPath: projectPath,
        exportFilename: options.exportFilename || options.filename
    };
    const sb = bundle.results?.simplebeacon;
    const hollowGate = options.hollowGate ?? hasHollowGateAttestation(sb);
    const context = { benchmarkScan, hollowGate, productPlatformRoot };

    let next = { ...bundle, results: { ...(bundle.results || {}) }, summary: { ...(bundle.summary || {}) } };

    if (next.results.simplebeacon) {
        next.results.simplebeacon = sanitizeSimplebeaconReportExport(next.results.simplebeacon, nestedOptions);
        context.hollowGate = hasHollowGateAttestation(next.results.simplebeacon);
    }

    const repositoryFilesTotal = next.results.simplebeacon?.repositoryFilesTotal
        ?? next.results.simplebeacon?.repositoryInventory?.totalFiles;
    const sbAfterGate = next.results.simplebeacon;
    const gateReport = sbAfterGate || null;
    const gateSanitizeOpts = {
        projectPath,
        repositoryFilesTotal,
        gateReport
    };
    nestedOptions.repositoryFilesTotal = repositoryFilesTotal;
    nestedOptions.gateReport = gateReport;

    if (next.results.roadmap) {
        next.results.roadmap = sanitizeRoadmapExport(next.results.roadmap, {
            requestedProjectPath: projectPath,
            repositoryFilesTotal,
            gateReport
        });
    }
    if (next.results.npmAudit) {
        next.results.npmAudit = sanitizeNpmAuditExport(next.results.npmAudit, projectPath, {
            repositoryFilesTotal,
            gateReport
        });
    }
    if (next.results.cleanupAssistant) {
        next.results.cleanupAssistant = sanitizeCleanupBriefExport(next.results.cleanupAssistant, gateSanitizeOpts);
    }
    if (next.results.dataQuality) {
        next.results.dataQuality = sanitizeDataCleanupReportExport(next.results.dataQuality, gateSanitizeOpts);
    }
    if (next.results.fileReduction) {
        next.results.fileReduction = sanitizeDataCleanupReportExport(next.results.fileReduction, gateSanitizeOpts);
    }
    if (next.results.codebase) {
        next.results.codebase = sanitizeCodebaseReportExport(next.results.codebase, nestedOptions);
    }
    if (next.results.consolidation) {
        next.results.consolidation = sanitizeConsolidationExport(next.results.consolidation, nestedOptions);
    }
    if (next.results.mockScan) {
        next.results.mockScan = sanitizeFictionDigestExport(next.results.mockScan, nestedOptions);
    }
    if (next.results.sprint) {
        next.results.sprint = sanitizeEmbeddedEuAiActSprint(next.results.sprint, {
            ...nestedOptions,
            gateReport: sbAfterGate,
            npmAudit: next.results.npmAudit || null
        });
    }
    if (next.results.compliance) {
        if (sbAfterGate) {
            const bundled = sanitizeComplianceBundleExport({
                projectPath,
                gateReport: sbAfterGate,
                checklist: next.results.compliance,
                npmAudit: next.results.npmAudit || null
            });
            next.results.compliance = sanitizeComplianceChecklistArtifactExport(bundled.checklist, {
                projectPath,
                gateReport: sbAfterGate,
                npmAudit: next.results.npmAudit || null
            });
            context.complianceHandoffEligible = bundled.handoffEligible;
            context.complianceStatus = bundled.complianceStatus;
            context.complianceExportNotes = bundled.exportNotes;
        } else {
            next.results.compliance = sanitizeComplianceForExport(next.results.compliance, {
                ...context,
                projectPath,
                gateReport: sbAfterGate,
                npmAudit: next.results.npmAudit
            });
        }
    }

    next.completeScanAnalysis = rebuildCompleteScanAnalysis(next, benchmarkScan);
    if (next.completeScanAnalysis) {
        next.completeScanAnalysis = {
            ...next.completeScanAnalysis,
            notes: replaceMisleadingAnalysisNotes(next.completeScanAnalysis.notes, benchmarkScan),
            scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'product',
            projectPath: redactProjectPathForExport(projectPath, projectLabelFromPath(projectPath))
        };
    }

    next = applySummaryAttestation(next, context);

    const scanTargetRoot = normalizeBundleProjectPath(projectPath);

    if (!benchmarkScan) {
        next = redactCompleteScanProjectPath(next, projectPath);
        const gateContext = resolveCompleteScanGateContext(next, {
            repositoryFilesTotal,
            gateReport
        });
        next = {
            ...next,
            exportNormalized: true,
            exportSanitized: true,
            scanTargetProfile: 'product',
            securityHandoffEligible: false,
            handoffEligible: false,
            completeScanHealthStatus: next.summary?.simplebeaconGatePass && (next.summary?.complianceFailed ?? 1) === 0
                ? 'hygiene-pass-not-handoff'
                : 'review-required',
            scanScope: buildProductCompleteScanScanScope(next, gateContext),
            hygieneSummary: buildProductCompleteScanHygieneSummary(next, gateContext),
            exportNotes: buildProductCompleteScanExportNotes(next, { ...context, ...gateContext }),
            ...(context.complianceStatus ? { complianceStatus: context.complianceStatus } : {}),
            ...(context.complianceExportNotes?.length
                ? { complianceExportNotes: context.complianceExportNotes }
                : {})
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
            completeScanHealthStatus: 'benchmark-hygiene-pass',
            hygieneSummary: buildBenchmarkCompleteScanHygieneSummary(next, repositoryFilesTotal),
            exportNotes: assembleBenchmarkCompleteScanExportNotes(next.exportNotes || []),
            summary: {
                ...(next.summary || {}),
                simplebeaconGatePass: true,
                simplebeaconIssues: 0,
                complianceFailed: 0,
                compliancePassed: 0
            }
        };
    }

    return next;
}

function sanitizeNpmAuditExport(audit, projectPath = '', options = {}) {
    return sanitizeNpmAuditPayload(audit, projectPath, options);
}

module.exports = {
    isBenchmarkCacheProjectPath,
    resolveProductPlatformRoot,
    inferCompleteScanTargetFromHints,
    resolveBenchmarkGateAttestation,
    assembleBenchmarkCompleteScanExportNotes,
    resolveCompleteScanGateContext,
    buildProductCompleteScanHygieneSummary,
    buildProductCompleteScanScanScope,
    hasHollowGateAttestation,
    sanitizeRoadmapForBenchmark,
    sanitizeComplianceForExport,
    sanitizeComplianceBundleExport,
    sanitizeComplianceChecklistArtifactExport,
    sanitizeGateReportForComplianceExport,
    sanitizeCompleteScanExport,
    sanitizeNpmAuditExport,
    sanitizeCleanupBriefExport,
    sanitizeDataCleanupReportExport,
    sanitizeCodebaseReportExport,
    sanitizeFictionDigestExport,
    sanitizeConsolidationExport,
    lineTouchesSimplebeaconTemplate
};
