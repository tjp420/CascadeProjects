#!/usr/bin/env node
/**
 * Generate a simplebeacon-complete-scan JSON payload (same shape as AnalyzeView export).
 * Usage: node tools/generate-complete-scan-export.js [projectPath] [outputPath] [--enriched]
 */

const fs = require('fs');
const path = require('path');
const { runScan, evaluateGate } = require('../packages/simplebeacon-cli/src/index');
const { enrichCompleteScan } = require('../packages/simplebeacon-cli/src/lib/enrich-complete-scan');
const { scanFileMergerReduction } = require('../server/lib/file-merger-reduction-scanner');
const { analyzeCodebase } = require('../server/lib/codebase-analyzer');
const { buildRoadmapFromPath } = require('../server/routes/flexible-analyze-api');
const { runDataCleanupScan } = require('../server/lib/data-cleanup-scan');
const { buildCleanupAssistantBrief } = require('../packages/simplebeacon-cli/src/lib/cleanup-assistant-brief');
const { writeCompleteScanOutput } = require('../server/lib/complete-scan-artifacts');

const COMPLETE_STEP_COUNT = 8;

function filterIssuesByKind(report, kind) {
    const raw = report?.rawIssues || report?.detectedIssues || [];
    if (kind === 'fiction') {
        return raw.filter((item) => /fiction|fictional|consistency|kpi/i.test(String(item.type || '')));
    }
    return raw;
}

function buildCompleteScanExport(projectPath, results) {
    const {
        simplebeacon,
        consolidation,
        roadmap,
        codebase,
        fileReduction,
        dataQuality,
        cleanupAssistant,
        errors = [],
        scanDurationMs = null,
        stepsCompleted = COMPLETE_STEP_COUNT
    } = results;
    const fictionIssues = simplebeacon ? filterIssuesByKind(simplebeacon, 'fiction') : [];
    const mockScan = simplebeacon
        ? {
            type: 'simplebeacon-fiction-digest',
            fictionIssues,
            sourceReport: simplebeacon
        }
        : null;

    const payload = {
        type: 'simplebeacon-complete-scan',
        version: '1.3.0',
        generatedAt: new Date().toISOString(),
        projectPath,
        scanDurationMs,
        errors,
        summary: {
            stepCount: COMPLETE_STEP_COUNT,
            stepsCompleted,
            scanDurationMs,
            simplebeaconGatePass: simplebeacon?.gate?.pass ?? null,
            simplebeaconIssues: simplebeacon?.issueCount ?? simplebeacon?.rawIssues?.length ?? null,
            consolidationDuplicateGroups: consolidation?.summary?.exactDuplicateGroups ?? null,
            fictionKpiHits: fictionIssues.reduce((sum, item) => sum + (item.count || 1), 0),
            roadmapFiles: roadmap?.codeAnalysis?.structure?.totalFiles ?? null,
            codebaseHealthScore: codebase?.summary?.healthScore ?? null,
            codebaseFindings: codebase?.summary?.findingsTotal ?? null,
            fileReductionFindings: fileReduction?.summary?.totalFindings ?? null,
            fileReductionReclaimableBytes: fileReduction?.summary?.reclaimableBytes ?? null,
            fileReductionSafeToDeleteBytes: fileReduction?.fileReductionPlan?.totals?.safeToDeleteBytes
                ?? fileReduction?.scanners?.['build-artifacts']?.safeToDeleteBytes
                ?? null,
            fileReductionImmediateSavingsBytes: fileReduction?.fileReductionPlan?.totals?.estimatedImmediateSavingsBytes ?? null,
            fileReductionUnusedCandidates: fileReduction?.fileReductionPlan?.unusedFiles?.candidates
                ?? fileReduction?.summary?.unusedFileCandidates
                ?? null,
            dataQualityFindings: dataQuality?.summary?.totalFindings ?? null,
            dataQualityWorkspacePackages: dataQuality?.executiveSummary?.workspace?.packageJsonFiles
                ?? dataQuality?.scanners?.['dependency-health']?.packageJsonFiles
                ?? null,
            dataQualityPiiNeedingReview: dataQuality?.executiveSummary?.security?.piiNeedingReview ?? null,
            cleanupSafeFiles: cleanupAssistant?.estimatedReduction?.files ?? null,
            cleanupSafeBytes: cleanupAssistant?.estimatedReduction?.bytes ?? null,
            cleanupProjectedFiles: cleanupAssistant?.projectedInventory?.totalFiles ?? null
        },
        results: {
            simplebeacon,
            consolidation,
            mockScan,
            roadmap,
            codebase,
            fileReduction,
            dataQuality,
            cleanupAssistant
        }
    };

    return payload;
}

async function main() {
    const args = process.argv.slice(2).filter((arg) => arg !== '--enriched');
    const enriched = process.argv.includes('--enriched');
    const projectPath = path.resolve(args[0] || path.join(__dirname, '..'));
    const defaultName = enriched ? 'complete-scan-export.enriched.json' : 'complete-scan-export.json';
    const outputPath = path.resolve(args[1] || path.join(projectPath, defaultName));
    const errors = [];
    const startedAt = Date.now();
    let stepsCompleted = 0;

    let simplebeacon = null;
    try {
        simplebeacon = await runScan(projectPath, { gate: true });
        simplebeacon.gate = evaluateGate(simplebeacon.rawIssues || [], simplebeacon.gate || {});
        stepsCompleted += 1;
    } catch (error) {
        errors.push({ step: 'simplebeacon', message: error.message });
    }

    let consolidation = null;
    try {
        consolidation = await scanFileMergerReduction(projectPath, { scope: 'repository' });
        stepsCompleted += 1;
    } catch (error) {
        errors.push({ step: 'consolidation', message: error.message });
    }

    // Fiction digest reuses the simplebeacon report (AnalyzeView step 2).
    if (simplebeacon) stepsCompleted += 1;

    let roadmap = null;
    try {
        const roadmapResult = await buildRoadmapFromPath(projectPath, { roadmapInsightsMode: 'off' });
        roadmap = roadmapResult.roadmap;
        stepsCompleted += 1;
    } catch (error) {
        errors.push({ step: 'roadmap', message: error.message });
    }

    let codebase = null;
    try {
        codebase = await analyzeCodebase(projectPath, { context: 'complete', includeEslint: true });
        stepsCompleted += 1;
    } catch (error) {
        errors.push({ step: 'codebase', message: error.message });
    }

    let fileReduction = null;
    try {
        fileReduction = await runDataCleanupScan(projectPath, { profile: 'file-reduction', compact: false });
        stepsCompleted += 1;
    } catch (error) {
        errors.push({ step: 'file-reduction', message: error.message });
    }

    let dataQuality = null;
    try {
        dataQuality = await runDataCleanupScan(projectPath, { profile: 'data-quality', compact: false });
        stepsCompleted += 1;
    } catch (error) {
        errors.push({ step: 'data-quality', message: error.message });
    }

    let cleanupAssistant = null;
    try {
        if (!fileReduction && !dataQuality) {
            throw new Error('File reduction and data quality must complete before cleanup assistant');
        }
        cleanupAssistant = buildCleanupAssistantBrief({
            projectPath,
            fileReduction,
            dataQuality,
            repositoryInventory: fileReduction?.inventory || dataQuality?.inventory || null
        });
        stepsCompleted += 1;
    } catch (error) {
        errors.push({ step: 'cleanup-assistant', message: error.message });
    }

    const scanDurationMs = Date.now() - startedAt;
    let payload = buildCompleteScanExport(projectPath, {
        simplebeacon,
        consolidation,
        roadmap,
        codebase,
        fileReduction,
        dataQuality,
        cleanupAssistant,
        errors,
        scanDurationMs,
        stepsCompleted
    });

    if (enriched) {
        payload = enrichCompleteScan(payload);
    }

    const written = writeCompleteScanOutput(outputPath, payload);

    const summary = {
        outputPath: written.outputPath,
        archivePath: written.archivePath,
        enriched,
        errors: errors.length,
        stepsCompleted,
        scanDurationMs,
        simplebeaconGatePass: payload.summary.simplebeaconGatePass,
        simplebeaconIssues: payload.summary.simplebeaconIssues,
        consolidationMergeCandidates: consolidation?.summary?.mergeCandidates ?? null,
        consolidationReductionOpportunities: consolidation?.summary?.reductionOpportunities ?? null,
        codebaseHealthScore: payload.summary.codebaseHealthScore,
        codebaseFindings: payload.summary.codebaseFindings,
        fileReductionFindings: payload.summary.fileReductionFindings,
        dataQualityFindings: payload.summary.dataQualityFindings
    };
    console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
