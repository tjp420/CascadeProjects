// SPDX-License-Identifier: MIT
/**
 * JSON reporter for simplebeacon scan results.
 * Enriches raw scan data with module objects and detailed gate findings
 * for certificate generation and downstream analysis.
 */

const { sanitizeScanReport } = require('../lib/report-sanitizer');
const { detectTier } = require('../lib/tier-detector');

function formatJsonReport(report, gateResult = null) {
    const tierInfo = detectTier();
    const isPaid = tierInfo.paid;
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
        allIssues: rawGate.warningIssues || [],
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
            ? `${debugArtifactCount} debug artifact${debugArtifactCount === 1 ? '' : 's'} detected — remove console.log, debugger, and pending-task markers before production.`
            : 'No cleanup issues.',
        remediation: debugArtifactCount
            ? 'Remove console.log, debugger statements, and pending-task markers before production builds.'
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
    const health = govScore >= 10 ? 'excellent' : (govScore >= 5 ? 'good' : (govScore >= 2 ? 'fair' : 'poor'));
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
    const allFiles = report.fileList || report.sampleFiles || report.repositoryInventory?.files || [];
    const filePaths = Array.isArray(allFiles) ? allFiles : [];
    const lowerPaths = filePaths.map(f => (typeof f === 'string' ? f : f.path || '').toLowerCase());
    // Fallback: check filesystem at projectRoot when scanPaths don't include root-level files
    const rootDir = report.projectRoot || report.scanTargetRoot || '';
    const fs = require('fs');
    const path = require('path');
    const hasFile = (re) => {
        if (lowerPaths.some(p => re.test(p))) return true;
        if (!rootDir) return false;
        let checkDir = rootDir;
        while (checkDir && fs.existsSync(checkDir)) {
            try {
                const entries = fs.readdirSync(checkDir);
                if (entries.some(e => re.test(e.toLowerCase()))) return true;
            } catch { /* ignore */ }
            const parent = path.dirname(checkDir);
            if (parent === checkDir) break;
            checkDir = parent;
        }
        return false;
    };
    const hasDeep = (re) => {
        if (lowerPaths.some(p => re.test(p))) return true;
        if (!rootDir) return false;
        let checkDir = rootDir;
        while (checkDir && fs.existsSync(checkDir)) {
            try {
                const walk = (dir) => {
                    const entries = fs.readdirSync(dir, { withFileTypes: true });
                    for (const ent of entries) {
                        if (ent.isDirectory() && !/^(node_modules|\.git|\.simplebeacon)$/.test(ent.name)) {
                            if (walk(path.join(dir, ent.name))) return true;
                        } else if (re.test(ent.name.toLowerCase())) {
                            return true;
                        }
                    }
                    return false;
                };
                if (walk(checkDir)) return true;
            } catch { /* ignore */ }
            const parent = path.dirname(checkDir);
            if (parent === checkDir) break;
            checkDir = parent;
        }
        return false;
    };
    const readinessChecks = [
        { name: 'package.json', found: hasFile(/package\.json$/), critical: true },
        { name: 'README', found: hasFile(/^readme/), critical: true },
        { name: 'CHANGELOG', found: hasFile(/changelog|changes|history/), critical: false },
        { name: 'Tests', found: hasDeep(/test|spec|\.test\.|\.spec\.|__tests__|jest\.config|vitest\.config|cypress/), critical: true },
        { name: 'CI/CD', found: hasDeep(/\.github|\.gitlab-ci|jenkins|\.circleci|\.travis|azure-pipelines|ci\.(yml|yaml)|build\.(yml|yaml)|deploy\.(yml|yaml)/), critical: true },
        { name: 'Docker', found: hasFile(/dockerfile|docker-compose|\.dockerignore/), critical: false },
        { name: 'Linting/Formatting', found: hasFile(/eslint|prettier|\.editorconfig|lint-staged|husky/), critical: false },
        { name: 'TypeScript Config', found: hasFile(/tsconfig|\.ts$/), critical: false },
        { name: 'Build Tool Config', found: hasFile(/webpack|rollup|vite|esbuild|parcel|babel|gulpfile|gruntfile/), critical: false },
        { name: '.env.example', found: hasFile(/\.env\.example|\.env\.sample|\.env\.template/), critical: true },
        { name: '.gitignore', found: hasFile(/\.gitignore/), critical: true },
        { name: '.npmignore', found: hasFile(/\.npmignore/), critical: false }
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
    // Phase 1: Data Integrity
    const integrityClean = (invalidJson === 0 || invalidJson == null) && (emptyFiles === 0 || emptyFiles == null);
    const integrityTasks = [];
    if (credFindings != null && credFindings > 0) {
        integrityTasks.push({ description: `Rotate ${credFindings} exposed credential${credFindings === 1 ? '' : 's'}`, type: 'fix', done: false, isStructured: true });
        integrityTasks.push({ description: 'Add .env to .gitignore', type: 'fix', done: false, isStructured: true });
    }
    if (invalidJson > 0) integrityTasks.push({ description: `Fix ${invalidJson} invalid JSON file${invalidJson === 1 ? '' : 's'}`, type: 'fix', done: false, isStructured: true });
    if (emptyFiles > 0) integrityTasks.push({ description: `Remove ${emptyFiles} empty file${emptyFiles === 1 ? '' : 's'}`, type: 'fix', done: false, isStructured: true });
    integrityTasks.push({ description: 'Validate all JSON', type: 'verify', done: integrityClean, isStructured: true });
    integrityTasks.push({ description: 'Re-run scan', type: 'verify', done: integrityClean, isStructured: true });
    phases.push({
        id: 'integrity',
        title: 'Phase 1: Data Integrity',
        severity: (invalidJson > 0 || emptyFiles > 0) ? 'high' : 'medium',
        effort: '2–4 days',
        description: integrityClean ? 'Data integrity verified — no structural issues detected.' : `Resolve structural issues${invalidJson > 0 ? ': ' + invalidJson + ' invalid JSON' : ''}${emptyFiles > 0 ? ': ' + emptyFiles + ' empty file' + (emptyFiles === 1 ? '' : 's') : ''}.`,
        tasks: integrityTasks,
        progress: integrityClean ? 100 : 0,
        status: integrityClean ? 'completed' : 'pending'
    });

    // Phase 2: Consistency & Deduplication
    const consistencyClean = dupes === 0 || dupes == null;
    const consistencyTasks = [];
    if (dupes > 0) consistencyTasks.push({ description: `Consolidate ${dupes} duplicate group${dupes === 1 ? '' : 's'}`, type: 'fix', done: false, isStructured: true });
    consistencyTasks.push({ description: 'Standardize naming conventions', type: 'doc', done: consistencyClean, isStructured: true });
    consistencyTasks.push({ description: 'Document canonical file locations', type: 'doc', done: consistencyClean, isStructured: true });
    const consistencyProgress = consistencyClean ? 100 : (dupes <= 5 ? 75 : (dupes <= 20 ? 50 : (dupes <= 50 ? 25 : 0)));
    phases.push({
        id: 'consistency',
        title: 'Phase 2: Consistency & Deduplication',
        severity: dupes > 5 ? 'high' : 'medium',
        effort: '3–5 days',
        description: consistencyClean ? 'Consistency verified — no duplicates or naming drift.' : `Eliminate redundancy: ${dupes} duplicate group${dupes === 1 ? '' : 's'}.`,
        tasks: consistencyTasks,
        progress: consistencyProgress,
        status: consistencyClean ? 'completed' : (consistencyProgress > 0 ? 'in-progress' : 'pending')
    });

    // Phase 3: Governance & Compliance
    const govTasks = [];
    if (licenseCount > 0) govTasks.push({ description: `Audit ${licenseCount} open-source license file${licenseCount === 1 ? '' : 's'}`, type: 'review', done: true, isStructured: true });
    if (securityCount > 0) govTasks.push({ description: `Review ${securityCount} security/governance file${securityCount === 1 ? '' : 's'}`, type: 'review', done: true, isStructured: true });
    govTasks.push({ description: 'Verify license compatibility with distribution model', type: 'verify', done: govScore >= 2, isStructured: true });
    govTasks.push({ description: 'Add LICENSE and SECURITY.md if missing', type: 'fix', done: govScore >= 2, isStructured: true });
    govTasks.push({ description: 'Document governance policies', type: 'doc', done: govScore >= 2, isStructured: true });
    const govProgress = govScore >= 2 ? 100 : (govScore >= 1 ? 50 : 0);
    phases.push({
        id: 'compliance',
        title: 'Phase 3: Governance & Compliance',
        severity: 'medium',
        effort: '2–3 days',
        description: `${licenseCount || 0} license file${(licenseCount || 0) === 1 ? '' : 's'}, ${securityCount || 0} security file${(securityCount || 0) === 1 ? '' : 's'}. Governance score: ${govScore}.`,
        tasks: govTasks,
        progress: govProgress,
        status: govProgress >= 100 ? 'completed' : (govProgress > 0 ? 'in-progress' : 'pending')
    });

    // Phase 4: EU AI Act Compliance
    const eu = report.euAiAct || {};
    const hr = Number(eu.highRiskIndicators) || 0;
    const tg = Number(eu.transparencyGaps) || 0;
    const ai = Number(eu.aiSystemIndicators) || 0;
    const euClean = hr === 0 && tg === 0 && ai === 0;
    const euHasBlocking = hr > 0 || tg > 0;
    const euTasks = [];
    if (ai > 0) euTasks.push({ description: `Review ${ai} AI system indicator${ai === 1 ? '' : 's'} (Art. 6)`, type: 'review', done: false, isStructured: true });
    euTasks.push({ description: 'Generate documentation artifacts', type: 'doc', done: euClean, isStructured: true });
    euTasks.push({ description: 'Review AI system classification (Art. 6)', type: 'review', done: euClean, isStructured: true });
    euTasks.push({ description: 'Schedule legal review', type: 'review', done: euClean, isStructured: true });
    const euProgress = euClean ? 100 : (euHasBlocking ? 25 : (ai > 0 ? 50 : 0));
    phases.push({
        id: 'euaiact',
        title: 'Phase 4: EU AI Act Compliance',
        severity: hr > 0 ? 'critical' : (ai > 0 ? 'high' : 'medium'),
        effort: '5–10 days',
        description: `Regulatory readiness: ${ai} AI indicator${ai === 1 ? '' : 's'}, ${hr} high-risk, ${tg} transparency gap${tg === 1 ? '' : 's'}, ${eu.documentationArtifacts || 0} artifact${(eu.documentationArtifacts || 0) === 1 ? '' : 's'}.`,
        tasks: euTasks,
        progress: euProgress,
        status: euClean ? 'completed' : (euProgress > 0 ? 'in-progress' : 'pending')
    });

    // Phase 5: Quality Optimization
    const optTasks = [];
    if (todoMarkers != null && todoMarkers > 0) optTasks.push({ description: `Address ${todoMarkers} pending-task marker${todoMarkers === 1 ? '' : 's'} in source code`, type: 'fix', done: false, isStructured: true });
    if (qs < 85) optTasks.push({ description: 'Refactor low-quality modules (quality score < 85)', type: 'fix', done: false, isStructured: true });
    optTasks.push({ description: 'Add test coverage for uncovered modules', type: 'fix', done: qs >= 95, isStructured: true });
    optTasks.push({ description: 'Install pre-commit hooks for automated scanning', type: 'fix', done: qs >= 95, isStructured: true });
    optTasks.push({ description: 'Schedule monthly quality gate reviews', type: 'review', done: qs >= 95, isStructured: true });
    phases.push({
        id: 'optimization',
        title: 'Phase 5: Quality Optimization',
        severity: qs < 70 ? 'high' : 'low',
        effort: 'Ongoing',
        description: `Drive quality score from ${qs}/100 toward 95+.`,
        tasks: optTasks,
        progress: Math.min(100, Math.round(qs)),
        status: qs >= 95 ? 'completed' : 'in-progress'
    });

    const remediationPhases = report.remediationPhases || phases;

    // Remove free tier limitations - show all findings
    // const freeLimit = 5;
    // if (!isPaid) {
    //     enrichedGate.blockingIssues = (enrichedGate.blockingIssues || []).slice(0, freeLimit);
    //     enrichedGate.blockingFindings = (enrichedGate.blockingFindings || []).slice(0, freeLimit);
    //     enrichedGate.remediation = (enrichedGate.remediation || []).slice(0, 1);
    // }

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
            qualityScore: report.qualityScore || 0, // Show quality score for all users
            totalFiles: totalFiles,
            totalLines: totalLines
        },
        tier: tierInfo.tier,
        // ...(!isPaid ? {
        //     upgradeUrl: 'https://simplebeacon.ai/pricing',
        //     upgradeMessage: 'Upgrade to Executive Clearance ($499) for full findings, quality score, and board-ready PDF certificate.'
        // } : {})
    };

    return sanitizeScanReport(payload);
}

module.exports = {
    formatJsonReport
};
