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
        deadlineNote: euNote || (euHighRisk ? 'High-risk AI systems must comply with EU AI Act requirements by August 2026' : euIndicators ? `${euIndicators} AI system indicator${euIndicators === 1 ? '' : 's'} detected; review EU AI Act applicability.` : 'Review EU AI Act requirements.'),
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

    // Build Readiness module — systematic project health scan
    const allFiles = report.fileList || report.repositoryInventory?.totalFiles || [];
    const filePaths = Array.isArray(allFiles) ? allFiles : [];
    const lowerPaths = filePaths.map(f => (typeof f === 'string' ? f : f.path || '').toLowerCase());
    const readinessChecks = [
        { name: 'package.json', found: lowerPaths.some(p => p.endsWith('package.json')), critical: true },
        { name: 'README', found: lowerPaths.some(p => /readme\.?/.test(p)), critical: true },
        { name: 'CHANGELOG', found: lowerPaths.some(p => /changelog|changes|history/i.test(p)), critical: false },
        { name: 'Tests', found: lowerPaths.some(p => /test|spec|\.test\.|\.spec\.|__tests__|jest\.config|vitest\.config|cypress/i.test(p)), critical: true },
        { name: 'CI/CD', found: lowerPaths.some(p => /\.github\/workflows|\.gitlab-ci|jenkins|\.circleci|\.travis|azure-pipelines|build\.yml|deploy\.yml/i.test(p)), critical: true },
        { name: 'Docker', found: lowerPaths.some(p => /dockerfile|docker-compose|\.dockerignore/i.test(p)), critical: false },
        { name: 'Linting/Formatting', found: lowerPaths.some(p => /eslint|prettier|\.editorconfig|lint-staged|husky/i.test(p)), critical: false },
        { name: 'TypeScript Config', found: lowerPaths.some(p => /tsconfig|\.ts$/i.test(p)), critical: false },
        { name: 'Build Tool Config', found: lowerPaths.some(p => /(webpack|rollup|vite|esbuild|parcel|babel|gulpfile|gruntfile)/i.test(p)), critical: false },
        { name: '.env.example', found: lowerPaths.some(p => /\.env\.example|\.env\.sample|\.env\.template/i.test(p)), critical: true },
        { name: '.gitignore', found: lowerPaths.some(p => p.includes('.gitignore')), critical: true },
        { name: '.npmignore', found: lowerPaths.some(p => p.includes('.npmignore')), critical: false }
    ];
    const missingCritical = readinessChecks.filter(c => c.critical && !c.found);
    const missingNice = readinessChecks.filter(c => !c.critical && !c.found);
    const readinessScore = Math.round(((readinessChecks.filter(c => c.found).length / readinessChecks.length) * 100));
    const buildReadiness = report.buildReadiness || {
        readinessScore: readinessScore,
        readinessStatus: readinessScore >= 80 ? 'READY' : (readinessScore >= 50 ? 'NEEDS WORK' : 'BLOCKED'),
        checklist: readinessChecks,
        missingCritical: missingCritical.map(c => c.name),
        missingRecommended: missingNice.map(c => c.name),
        totalChecks: readinessChecks.length,
        passedChecks: readinessChecks.filter(c => c.found).length,
        summary: `${readinessScore >= 80 ? 'READY' : (readinessScore >= 50 ? 'NEEDS WORK' : 'BLOCKED')} — ${readinessChecks.filter(c => c.found).length} of ${readinessChecks.length} checklist items present.${missingCritical.length ? ` ${missingCritical.length} critical blocker${missingCritical.length === 1 ? '' : 's'}.` : ''}`,
        recommendations: missingCritical.length > 0 ? ['Add all critical files before production deployment.', 'Start with package.json, README, .gitignore, and .env.example.'] : (missingNice.length > 0 ? ['Add recommended files to improve maintainability.', 'Consider Docker, linting config, and CHANGELOG.'] : ['Project is fully ready for production. All checklist items present.']),
        remediation: missingCritical.length > 0 ? `Missing critical: ${missingCritical.map(c => c.name).join(', ')}.` : (missingNice.length > 0 ? `Missing recommended: ${missingNice.map(c => c.name).join(', ')}.` : 'No remediation needed.')
    };

    // Remediation Phases — computed from scan data for roadmap / certificate generation
    const qs = report.qualityScore ?? null;
    const invalidJson = report.invalidJson ?? report.dataQuality?.invalidJsonCount ?? null;
    const emptyFiles = report.emptyFiles ?? report.dataQuality?.emptyJsonCount ?? null;
    const dupes = report.duplicateGroups ?? report.consolidation?.duplicateGroups ?? null;
    const credFindings = report.credentialFindings ?? enrichedGate?.blockingCount ?? null;
    const euAiActIndicators = report.euAiActFindings ?? report.euAiAct?.aiSystemIndicators ?? null;
    const todoMarkers = report.todoMarkerCount ?? report.roadmap?.todoCount ?? null;
    const phases = [];
    if ((credFindings != null && credFindings > 0) || (enrichedGate?.blockingIssues || []).length > 0) {
        phases.push({ id: 'security', title: 'Phase 1: Security Hardening', severity: 'critical', effort: '1–2 days', description: `Address ${credFindings || 0} credential and production leak finding${credFindings === 1 ? '' : 's'}.`, tasks: [`Rotate ${credFindings || 0} exposed credential${credFindings === 1 ? '' : 's'}`, 'Add .env to .gitignore', 'Re-run gate scan'], progress: 0, status: 'pending' });
    }
    const hasIntegrityMetrics = invalidJson != null || emptyFiles != null;
    if (hasIntegrityMetrics) {
        const allClean = (invalidJson === 0 || invalidJson == null) && (emptyFiles === 0 || emptyFiles == null);
        phases.push({ id: 'integrity', title: `Phase ${phases.length + 1}: Data Integrity`, severity: (invalidJson > 0 || emptyFiles > 0) ? 'high' : 'medium', effort: '2–4 days', description: allClean ? 'Data integrity verified — no structural issues detected.' : `Resolve structural issues${invalidJson > 0 ? ': ' + invalidJson + ' invalid JSON' : ''}${emptyFiles > 0 ? ': ' + emptyFiles + ' empty file' + (emptyFiles === 1 ? '' : 's') : ''}.`, tasks: [...(invalidJson > 0 ? [`Fix ${invalidJson} invalid JSON file${invalidJson === 1 ? '' : 's'}`] : []), ...(emptyFiles > 0 ? [`Remove ${emptyFiles} empty file${emptyFiles === 1 ? '' : 's'}`] : []), 'Validate all JSON', 'Re-run scan'], progress: allClean ? 100 : 0, status: allClean ? 'completed' : 'pending' });
    }
    const hasConsistencyMetrics = dupes != null;
    if (hasConsistencyMetrics) {
        const allClean = dupes === 0 || dupes == null;
        phases.push({ id: 'consistency', title: `Phase ${phases.length + 1}: Consistency & Deduplication`, severity: dupes > 5 ? 'high' : 'medium', effort: '3–5 days', description: allClean ? 'Consistency verified — no duplicates or naming drift.' : `Eliminate redundancy${dupes > 0 ? ': ' + dupes + ' duplicate group' + (dupes === 1 ? '' : 's') : ''}.`, tasks: [...(dupes > 0 ? [`Consolidate ${dupes} duplicate group${dupes === 1 ? '' : 's'}`] : []), 'Standardize naming conventions', 'Document canonical file locations'], progress: allClean ? 100 : 0, status: allClean ? 'completed' : 'pending' });
    }
    if ((licenseCount != null && licenseCount > 0) || (securityCount != null && securityCount > 0)) {
        phases.push({ id: 'compliance', title: `Phase ${phases.length + 1}: Governance & Compliance`, severity: 'medium', effort: '2–3 days', description: `${licenseCount || 0} license file${(licenseCount || 0) === 1 ? '' : 's'}, ${securityCount || 0} security file${(securityCount || 0) === 1 ? '' : 's'}.`, tasks: [...(licenseCount > 0 ? [`Audit ${licenseCount} open-source license file${licenseCount === 1 ? '' : 's'}`] : []), ...(securityCount > 0 ? [`Review ${securityCount} security/governance file${securityCount === 1 ? '' : 's'}`] : []), 'Verify license compatibility', 'Document governance policies'], progress: 0, status: 'pending' });
    }
    if ((euAiActIndicators != null && euAiActIndicators > 0) || report.euAiAct) {
        const s = report.euAiAct || {}, hr = Number(s.highRiskIndicators) || 0, tg = Number(s.transparencyGaps) || 0, ai = Number(s.aiSystemIndicators) || 0;
        const allClean = hr === 0 && tg === 0 && ai === 0;
        phases.push({ id: 'euaiact', title: `Phase ${phases.length + 1}: EU AI Act Compliance`, severity: hr > 0 ? 'critical' : (ai > 0 ? 'high' : 'medium'), effort: '5–10 days', description: `Regulatory readiness: ${ai} AI indicator${ai === 1 ? '' : 's'}, ${hr} high-risk, ${tg} transparency gap${tg === 1 ? '' : 's'}, ${s.documentationArtifacts || 0} artifact${(s.documentationArtifacts || 0) === 1 ? '' : 's'}.`, tasks: [...(hr > 0 ? [`Address ${hr} high-risk indicator${hr === 1 ? '' : 's'}`] : []), ...(tg > 0 ? [`Close ${tg} transparency gap${tg === 1 ? '' : 's'}`] : []), ...(ai > 0 ? [`Review ${ai} AI system indicator${ai === 1 ? '' : 's'} (Art. 6)`] : []), 'Generate documentation artifacts', 'Review AI system classification (Art. 6)', 'Schedule legal review'], progress: allClean ? 100 : 0, status: allClean ? 'completed' : 'pending' });
    }
    if (qs != null && (qs < 95 || (todoMarkers != null && todoMarkers > 0))) {
        phases.push({ id: 'optimization', title: `Phase ${phases.length + 1}: Quality Optimization`, severity: qs < 70 ? 'high' : 'low', effort: 'Ongoing', description: `Drive quality score from ${qs}/100 toward 95+.`, tasks: [...(todoMarkers != null && todoMarkers > 0 ? [`Address ${todoMarkers} TODO/FIXME marker${todoMarkers === 1 ? '' : 's'} in source code`] : []), ...(qs < 85 ? ['Refactor low-quality modules (quality score < 85)'] : []), 'Add test coverage for uncovered modules', 'Install pre-commit hooks for automated scanning', 'Schedule monthly quality gate reviews'], progress: Math.min(100, Math.round(qs)), status: qs >= 95 ? 'completed' : 'in-progress' });
    }
    if (phases.length === 0) {
        phases.push({ id: 'perfect', title: 'All Systems Green', severity: 'low', effort: 'None', description: 'Excellent data quality — no actionable findings in any measured category.', tasks: ['Schedule next scan in 30 days', 'Document quality maintenance procedures'], progress: 100, status: 'completed' });
    }
    const remediationPhases = report.remediationPhases || phases;

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
        buildReadiness,
        remediationPhases,
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
