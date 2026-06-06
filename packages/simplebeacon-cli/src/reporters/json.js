/**
 * JSON reporter for simplebeacon scan results.
 * Enriches raw scan data with module objects and detailed gate findings
 * for certificate generation and downstream analysis.
 */

const { sanitizeScanReport } = require('../lib/report-sanitizer');

function formatJsonReport(report, gateResult = null) {
    const totalFiles = report.totalFiles || report.filesAnalyzed || report.repositoryFilesTotal || 0;
    const totalLines = report.totalLines || 0;

    // Build enriched gate with detailed findings and remediation
    const enrichedGate = gateResult
        ? {
            pass: gateResult.pass,
            failOn: gateResult.failOn,
            warnOn: gateResult.warnOn,
            blockingCount: gateResult.blockingIssues.reduce((sum, i) => sum + (i.count || 1), 0),
            warningCount: gateResult.warningIssues.reduce((sum, i) => sum + (i.count || 1), 0),
            blockingIssues: gateResult.blockingIssues,
            warningIssues: gateResult.warningIssues,
            status: gateResult.pass === true ? 'PASS' : (gateResult.pass === false ? 'BLOCKED' : 'REVIEW'),
            severityColor: gateResult.pass === true ? '#34D399' : (gateResult.pass === false ? '#EF4444' : '#60A5FA'),
            summary: gateResult.pass === true
                ? 'Gate passed — no blocking credentials found.'
                : `${gateResult.blockingIssues.reduce((sum, i) => sum + (i.count || 1), 0)} blocking issue(s) detected. Review before release.`,
            blockingFindings: (gateResult.blockingIssues || []).slice(0, 10).map(i => ({
                severity: i.severity,
                type: i.type,
                count: i.count || 0,
                filePath: i.filePath,
                rule: i.rule,
                impact: i.impact,
                fix: i.fix
            })),
            remediation: [...new Set((gateResult.blockingIssues || []).filter(i => i.fix).map(i => i.fix))].slice(0, 3)
        }
        : report.gate;

    // Build module objects from existing report data
    const consolidation = report.consolidation || {
        monorepoMarkers: report.scanScope?.monorepoMarkers || 0,
        duplicateGroups: report.duplicateGroups || 0,
        summary: report.duplicateGroups
            ? `${report.duplicateGroups} duplicate file groups detected.`
            : 'No duplicate files detected.',
        remediation: report.duplicateGroups
            ? 'Consolidate duplicate files into shared modules or remove redundant copies.'
            : null
    };

    const codebase = report.codebase || {
        totalFiles: totalFiles,
        totalLines: totalLines,
        averageLinesPerFile: totalFiles > 0 ? Math.round(totalLines / totalFiles) : 0,
        summary: totalFiles
            ? `${totalFiles.toLocaleString()} files analyzed, ${totalLines.toLocaleString()} lines of code.`
            : 'No files analyzed.'
    };

    const dataQuality = report.dataQuality || {
        emptyJsonCount: report.emptyFiles || 0,
        invalidJsonCount: report.invalidJson || 0,
        severity: (report.emptyFiles || report.invalidJson) ? 'high' : 'low',
        severityColor: (report.emptyFiles || report.invalidJson) ? '#EF4444' : '#34D399',
        summary: (report.emptyFiles || report.invalidJson)
            ? `${(report.emptyFiles || 0) + (report.invalidJson || 0)} data quality issue(s) detected.`
            : 'No data quality issues.',
        remediation: (report.emptyFiles || report.invalidJson)
            ? 'Review empty or invalid JSON files.'
            : null
    };

    const cleanup = report.cleanup || {
        debugArtifactCount: (report.llmSlopPatternHits || 0) + (report.sourceFictionPatternHits || 0),
        severity: ((report.llmSlopPatternHits || 0) + (report.sourceFictionPatternHits || 0)) > 20 ? 'high' : 'medium',
        severityColor: ((report.llmSlopPatternHits || 0) + (report.sourceFictionPatternHits || 0)) > 20 ? '#EF4444' : '#F59E0B',
        summary: ((report.llmSlopPatternHits || 0) + (report.sourceFictionPatternHits || 0))
            ? `${(report.llmSlopPatternHits || 0) + (report.sourceFictionPatternHits || 0)} pattern hits detected.`
            : 'No cleanup issues.',
        remediation: ((report.llmSlopPatternHits || 0) + (report.sourceFictionPatternHits || 0))
            ? 'Review LLM slop and fiction patterns in source.'
            : null
    };

    const compliance = report.compliance || {
        licenseCount: report.credentialFindings || 0,
        securityCount: report.productionLeakFindings || 0,
        governanceScore: (report.credentialFindings || 0) + (report.productionLeakFindings || 0),
        summary: (report.credentialFindings || report.productionLeakFindings)
            ? `${report.credentialFindings || 0} credential findings, ${report.productionLeakFindings || 0} production leak findings.`
            : 'No compliance issues.',
        remediation: (report.credentialFindings || report.productionLeakFindings)
            ? 'Review credentials and production leaks.'
            : null
    };

    const fileReduction = report.fileReduction || {
        duplicateGroups: report.duplicateGroups || 0,
        summary: report.duplicateGroups
            ? `${report.duplicateGroups} duplicate content groups found.`
            : 'No file reduction opportunities.',
        remediation: report.duplicateGroups
            ? 'Consolidate duplicate files into shared modules.'
            : null
    };

    const payload = {
        ...report,
        gate: enrichedGate,
        consolidation,
        codebase,
        dataQuality,
        cleanup,
        compliance,
        fileReduction,
        summary: {
            gatePass: enrichedGate?.pass ?? null,
            qualityScore: report.qualityScore || 0,
            totalFiles: totalFiles,
            totalLines: totalLines
        }
    };

    return sanitizeScanReport(payload);
}

module.exports = {
    formatJsonReport
};
