/**
 * JSON reporter for simplebeacon scan results.
 * Enriches raw scan data with module objects and detailed gate findings
 * for certificate generation and downstream analysis.
 */

const { sanitizeScanReport } = require('../lib/report-sanitizer');

function formatJsonReport(report, gateResult = null) {
    const totalFiles = report.totalFiles || report.filesAnalyzed || report.repositoryFilesTotal || 0;
    const totalLines = report.totalLines || 0;

    // Derive gate pass from actual findings to handle inconsistent upstream data
    const rawGate = gateResult || report.gate || {};
    const hasBlockingFindings = (rawGate.blockingCount || 0) > 0 || (rawGate.blockingIssues || []).length > 0;
    const derivedPass = hasBlockingFindings ? false : (rawGate.pass ?? null);

    // Build enriched gate with detailed findings and remediation
    const enrichedGate = {
        pass: derivedPass,
        failOn: rawGate.failOn,
        warnOn: rawGate.warnOn,
        blockingCount: (rawGate.blockingIssues || []).reduce((sum, i) => sum + (i.count || 1), 0),
        warningCount: (rawGate.warningIssues || []).reduce((sum, i) => sum + (i.count || 1), 0),
        blockingIssues: rawGate.blockingIssues || [],
        warningIssues: rawGate.warningIssues || [],
        status: derivedPass === true ? 'PASS' : (derivedPass === false ? 'BLOCKED' : 'REVIEW'),
        severityColor: derivedPass === true ? '#34D399' : (derivedPass === false ? '#EF4444' : '#60A5FA'),
        summary: (derivedPass === false && rawGate.summary && /passed|clear|green/i.test(rawGate.summary))
            ? 'Gate blocked — review findings before release.'
            : (rawGate.summary || (derivedPass === true
                ? 'Gate passed — no blocking credentials found.'
                : (() => { const bc = (rawGate.blockingIssues || []).reduce((sum, i) => sum + (i.count || 1), 0); return `Gate blocked — ${bc} blocking issue${bc === 1 ? '' : 's'} detected. Review before release.`; })())),
        blockingFindings: (rawGate.blockingIssues || []).slice(0, 10).map(i => ({
            severity: i.severity,
            type: i.type,
            count: i.count || 0,
            filePath: i.filePath,
            rule: i.rule,
            impact: i.impact,
            fix: i.fix
        })),
        remediation: [...new Set((rawGate.blockingIssues || []).filter(i => i.fix).map(i => i.fix))].slice(0, 3)
    };

    // Build module objects from existing report data
    const consolidation = report.consolidation || {
        monorepoMarkers: report.scanScope?.monorepoMarkers || 0,
        duplicateGroups: report.duplicateGroups || 0,
        summary: report.duplicateGroups
            ? `${report.duplicateGroups} duplicate file group${report.duplicateGroups === 1 ? '' : 's'} detected.`
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
            ? `${totalFiles.toLocaleString()} file${totalFiles === 1 ? '' : 's'} analyzed, ${totalLines.toLocaleString()} line${totalLines === 1 ? '' : 's'} of code.`
            : 'No files analyzed.'
    };

    const dataQuality = report.dataQuality || {
        emptyJsonCount: report.emptyFiles || 0,
        invalidJsonCount: report.invalidJson || 0,
        severity: (report.emptyFiles || report.invalidJson) ? 'high' : 'low',
        severityColor: (report.emptyFiles || report.invalidJson) ? '#EF4444' : '#34D399',
        summary: (report.emptyFiles || report.invalidJson)
            ? `${(report.emptyFiles || 0) + (report.invalidJson || 0)} data quality issue${(report.emptyFiles || 0) + (report.invalidJson || 0) === 1 ? '' : 's'} detected.`
            : 'No data quality issues.',
        remediation: (report.emptyFiles || report.invalidJson)
            ? 'Review empty or invalid JSON files.'
            : null
    };

    // Cleanup: look at detectedIssues for debug artifacts, fall back to pattern hits
    const debugIssue = (report.detectedIssues || []).find(i => i.type === 'Debug Artifact');
    const debugArtifactCount = debugIssue ? (debugIssue.count || 0) : ((report.llmSlopPatternHits || 0) + (report.sourceFictionPatternHits || 0));
    const cleanup = report.cleanup || {
        debugArtifactCount: debugArtifactCount,
        severity: debugArtifactCount > 20 ? 'high' : debugArtifactCount > 0 ? 'medium' : 'low',
        severityColor: debugArtifactCount > 20 ? '#EF4444' : debugArtifactCount > 0 ? '#F59E0B' : '#34D399',
        summary: debugArtifactCount
            ? `${debugArtifactCount} debug artifact${debugArtifactCount === 1 ? '' : 's'} detected — remove console.log, debugger, TODO markers before production.`
            : 'No cleanup issues.',
        remediation: debugArtifactCount
            ? 'Remove console.log, debugger statements, and TODO markers before production builds.'
            : null
    };

    // Compliance: look at detectedIssues for governance markers
    const govIssue = (report.detectedIssues || []).find(i => i.type === 'License/Governance Marker');
    const govCount = govIssue ? (govIssue.count || 0) : 0;
    // If report has compliance with zero counts but detected governance markers, use the marker count
    const hasStaleCompliance = report.compliance && report.compliance.licenseCount === 0 && report.compliance.securityCount === 0 && govCount > 0;
    const licenseCount = hasStaleCompliance ? govCount : (report.compliance?.licenseCount ?? govCount);
    const securityCount = report.compliance?.securityCount ?? 0;
    const complianceSummary = (licenseCount || securityCount)
        ? `${licenseCount} license file${licenseCount === 1 ? '' : 's'}, ${securityCount} security/governance file${securityCount === 1 ? '' : 's'} detected.`
        : 'No governance files detected.';
    const complianceRemediation = (licenseCount || securityCount)
        ? 'Verify license compatibility with your distribution model.'
        : 'Consider adding LICENSE and SECURITY.md.';
    const govScore = licenseCount + securityCount;
    const health = govScore >= 5 ? 'excellent' : (govScore >= 2 ? 'good' : (govScore >= 1 ? 'fair' : 'poor'));
    const recs = [];
    if (licenseCount === 0) recs.push('Add a LICENSE file to clarify distribution terms.');
    if (securityCount === 0) recs.push('Add SECURITY.md to disclose vulnerability reporting.');
    const compliance = report.compliance ? {
        ...report.compliance,
        licenseCount: licenseCount,
        securityCount: securityCount,
        governanceScore: govScore,
        summary: report.compliance.summary || complianceSummary,
        remediation: report.compliance.remediation || complianceRemediation,
        complianceHealth: health,
        recommendations: recs.slice(0, 4)
    } : {
        licenseCount: licenseCount,
        securityCount: securityCount,
        governanceScore: govScore,
        summary: complianceSummary,
        remediation: complianceRemediation,
        complianceHealth: health,
        recommendations: recs.slice(0, 4)
    };

    const fileReduction = report.fileReduction || {
        duplicateGroups: report.duplicateGroups || 0,
        summary: report.duplicateGroups
            ? `${report.duplicateGroups} duplicate content group${report.duplicateGroups === 1 ? '' : 's'} found.`
            : 'No file reduction opportunities.',
        remediation: report.duplicateGroups
            ? 'Consolidate duplicate files into shared modules.'
            : null
    };

    // npm Audit module
    const npmAudit = report.npmAudit || {
        packageJsonCount: report.packageJsonCount || 0,
        dependencyCount: report.dependencyCount || 0,
        summary: (report.packageJsonCount || 0)
            ? `${report.packageJsonCount} package.json file${report.packageJsonCount === 1 ? '' : 's'} found with ${(report.dependencyCount || 0).toLocaleString()} total dependenc${(report.dependencyCount || 0) === 1 ? 'y' : 'ies'}.`
            : 'No package.json files found.'
    };

    // Roadmap module
    const roadmap = report.roadmap || {
        todoCount: report.roadmapSchemaChecked || 0,
        summary: (report.roadmapSchemaChecked || 0)
            ? `${report.roadmapSchemaChecked} file${report.roadmapSchemaChecked === 1 ? '' : 's'} ${report.roadmapSchemaChecked === 1 ? 'contains' : 'contain'} TODO/FIXME markers.`
            : 'No roadmap markers found.'
    };

    // Mock Data module
    const mockData = report.mockData || {
        fileCount: report.mockSampleFiles || 0,
        summary: (report.mockSampleFiles || 0)
            ? `${report.mockSampleFiles} mock/fixture file${report.mockSampleFiles === 1 ? '' : 's'} detected.`
            : 'No mock data found.'
    };

    // EU AI Act module
    const euControls = report.euAiActControls || (report.euAiAct?.controls) || [];
    const euHighRisk = report.euAiActHighRisk || (report.euAiAct?.highRiskIndicators) || 0;
    const euTransparency = report.euAiActTransparency || (report.euAiAct?.transparencyGaps) || 0;
    const euDocs = report.euAiActDocumentation || (report.euAiAct?.documentationArtifacts) || 0;
    const euIndicators = report.euAiActFindings || (report.euAiAct?.aiSystemIndicators) || 0;
    const euDocFound = report.euAiActDocFound || (report.euAiAct?.documentationFound) || [];
    const euNote = report.euAiActDeadlineNote || (report.euAiAct?.deadlineNote) || '';
    const euAiAct = report.euAiAct || {
        aiSystemIndicators: euIndicators,
        highRiskIndicators: euHighRisk,
        transparencyGaps: euTransparency,
        documentationArtifacts: euDocs,
        documentationFound: euDocFound,
        controls: euControls.slice(0, 10),
        deadlineNote: euNote || ((euIndicators || euHighRisk) ? 'High-risk AI systems must comply with EU AI Act requirements by August 2026' : 'Review EU AI Act requirements.'),
        summary: (euIndicators || euHighRisk)
            ? `${euIndicators} AI system indicator${euIndicators === 1 ? '' : 's'} detected; ${euHighRisk} high-risk, ${euTransparency} transparency gap${euTransparency === 1 ? '' : 's'}.`
            : 'No EU AI Act indicators found.'
    };

    // Dependency Audit module
    const depVulns = report.dependencyAudit || {};
    const vulnCount = depVulns.vulnerabilityCount || 0;
    const dependencyAudit = report.dependencyAudit || {
        vulnerabilityCount: vulnCount,
        critical: depVulns.critical || 0,
        high: depVulns.high || 0,
        moderate: depVulns.moderate || 0,
        low: depVulns.low || 0,
        affectedPackages: depVulns.affectedPackages || [],
        outdatedPackages: depVulns.outdatedPackages || [],
        summary: vulnCount
            ? `${vulnCount} dependency issue${vulnCount === 1 ? '' : 's'} detected${(depVulns.critical || 0) ? ` (${depVulns.critical} critical)` : ''}.`
            : 'No dependency vulnerabilities found.'
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
        npmAudit,
        roadmap,
        mockData,
        euAiAct,
        dependencyAudit,
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
