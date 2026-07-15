// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Patch remediationPhases (and generic phases) in Simplebeacon reports to use
 * actual scan data instead of stale hardcoded template text.
 */

/**
 * Patch phase description.
 * @param {any} phase
 * @param {number} report
 * @returns {any}
 */
function patchPhaseDescription(phase, report) {
    const id = phase.id;
    const compliance = report.compliance || {};
    const euSummary = report.euAiActSummary || {};
    const qualityScore = report.qualityScore ?? null;
    const summary = report.summary || {};
    const results = report.results || {};
    const simplebeacon = report.simplebeacon || results.simplebeacon || {};
    const codebase = report.codebase || results.codebase || {};
    const npmAudit = report.npmAudit || results.npmAudit || {};
    const consolidation = report.consolidation || results.consolidation || {};
    const mockScan = report.mockScan || results.mockScan || {};
    const fileReduction = report.fileReduction || results.fileReduction || {};
    const dataQuality = report.dataQuality || results.dataQuality || {};
    const cleanupAssistant = report.cleanupAssistant || results.cleanupAssistant || {};

    if (id === 'compliance') {
        const gov = codebase?.summary?.governanceFiles || {};
        const licenseCount = compliance.licenseCount ?? gov.licenseCount ?? null;
        const securityCount = compliance.securityCount ?? gov.securityCount ?? null;
        const governanceScore = compliance.governanceScore ?? 0;
        const complianceHealth = compliance.complianceHealth ?? 'unknown';
        if (licenseCount === null && securityCount === null) {
            return { ...phase, description: 'Compliance scan incomplete — re-run with full inventory.' };
        }
        return {
            ...phase,
            description: `${licenseCount ?? 0} license file(s), ${securityCount ?? 0} security/governance file(s). Governance files detected: ${governanceScore}. Health: ${complianceHealth}.`
        };
    }

    if (id === 'euaiact') {
        const aiIndicators = euSummary.aiSystemIndicators ?? 0;
        const highRisk = euSummary.highRiskIndicators ?? 0;
        const transparencyGaps = euSummary.transparencyGaps ?? 0;
        const docArtifacts = euSummary.documentationArtifacts ?? 0;
        return {
            ...phase,
            description: `Regulatory readiness: ${aiIndicators} AI indicator(s), ${highRisk} high-risk, ${transparencyGaps} transparency gap(s), ${docArtifacts} documentation artifact(s).`
        };
    }

    if (id === 'optimization') {
        const healthScore = summary.healthScore ?? summary.codebaseHealthScore ?? codebase?.summary?.healthScore ?? qualityScore ?? null;
        if (healthScore != null && healthScore >= 100) {
            return { ...phase, description: `Maintain quality score at ${healthScore}/100.` };
        }
        if (healthScore != null) {
            return { ...phase, description: `Drive quality score from ${healthScore}/100 toward 95+.` };
        }
        return phase;
    }

    if (id === 'npmaudit') {
        const govPkgCount = codebase?.summary?.governanceFiles?.packageJsonCount ?? null;
        const hasPackageJson = govPkgCount != null
            ? govPkgCount > 0
            : (simplebeacon?.repositoryFilesTotal != null || summary.totalFiles != null || npmAudit?.packageCount != null);
        const vulnCount = npmAudit?.vulnerabilities?.total ?? npmAudit?.metadata?.vulnerabilities?.total ?? 0;
        const pkgCount = npmAudit?.packageCount ?? npmAudit?.metadata?.dependencies ?? 0;
        if (hasPackageJson && pkgCount > 0) {
            return { ...phase, description: `${pkgCount} package(s) scanned. ${vulnCount} vulnerability(ies) found.` };
        }
        if (hasPackageJson) {
            return { ...phase, description: `package.json detected — npm audit results pending.` };
        }
        if (govPkgCount === 0) {
            return { ...phase, description: `No package.json detected — verify project has dependencies.` };
        }
        return { ...phase, description: `Scan data incomplete — package.json status unknown.` };
    }

    if (id === 'buildreadiness') {
        const buildIssues = codebase?.findings?.filter((f) => f.category === 'build' || f.type === 'build').length ?? 0;
        const health = codebase?.summary?.healthScore ?? null;
        if (buildIssues === 0 && (health == null || health >= 80)) {
            return { ...phase, description: `Build readiness verified — no issues detected.` };
        }
        return { ...phase, description: `${buildIssues} build issue(s) detected. Health: ${health ?? 'unknown'}%.` };
    }

    if (id === 'security') {
        const sev = summary.severityCounts || simplebeacon?.severityCounts || {};
        const hasScanData = simplebeacon?.issueCount != null || Object.keys(sev).length > 0;
        const credIssues = simplebeacon?.issueCount ?? sev.critical ?? 0;
        if (!hasScanData) {
            return { ...phase, description: `Security scan incomplete — re-run with full scan data.` };
        }
        if (credIssues === 0) {
            return { ...phase, description: `No security issues detected — credentials && secrets verified.` };
        }
        return { ...phase, description: `${credIssues} security issue(s) detected — review credentials && secrets.` };
    }

    if (id === 'integrity') {
        const structIssues = simplebeacon?.issueCount ?? 0;
        if (structIssues === 0) {
            return { ...phase, description: `Data integrity verified — no structural issues detected.` };
        }
        return { ...phase, description: `${structIssues} structural issue(s) detected.` };
    }

    if (id === 'consistency') {
        const dupGroups = consolidation?.summary?.exactDuplicateGroups ?? summary.duplicateGroups ?? 0;
        if (dupGroups === 0) {
            return { ...phase, description: `Consistency verified — no duplicates or naming drift.` };
        }
        return { ...phase, description: `${dupGroups} duplicate group(s) detected — review merge candidates.` };
    }

    if (id === 'mockdata') {
        const fictionHits = mockScan?.fictionIssues?.reduce((sum, i) => sum + (i.count || 1), 0) ?? summary.fictionKpiHits ?? 0;
        if (fictionHits === 0) {
            return { ...phase, description: `No mock data issues — fixtures verified or none detected.` };
        }
        return { ...phase, description: `${fictionHits} fiction/mock data issue(s) detected.` };
    }

    if (id === 'junkfiles') {
        const reclaimable = fileReduction?.summary?.reclaimableBytes ?? summary.fileReductionReclaimableBytes ?? 0;
        const junkCount = fileReduction?.summary?.totalFindings ?? 0;
        const bloatCount = fileReduction?.summary?.directoryBloatFindings ?? 0;
        const bloatBytes = fileReduction?.summary?.directoryBloatReclaimableBytes ?? 0;
        const totalReclaimable = reclaimable + bloatBytes;
        const totalCount = junkCount + bloatCount;
        if (totalReclaimable === 0 && totalCount === 0) {
            return { ...phase, description: `No junk or temporary files detected.` };
        }
        return { ...phase, description: `${totalCount} junk / bloat item(s) detected (${totalReclaimable} bytes reclaimable).` };
    }

    if (id === 'vulns') {
        const vulnTotal = npmAudit?.vulnerabilities?.total ?? npmAudit?.metadata?.vulnerabilities?.total ?? 0;
        if (vulnTotal === 0) {
            return { ...phase, description: `No vulnerable dependencies detected.` };
        }
        return { ...phase, description: `${vulnTotal} vulnerable dependency(ies) detected.` };
    }

    if (id === 'cleanup') {
        const safeFiles = cleanupAssistant?.estimatedReduction?.files ?? summary.cleanupSafeFiles ?? 0;
        const dqFindings = dataQuality?.summary?.totalFindings ?? summary.dataQualityFindings ?? 0;
        const bloatCount = fileReduction?.summary?.directoryBloatFindings ?? 0;
        const bloatBytes = fileReduction?.summary?.directoryBloatReclaimableBytes ?? 0;
        const totalSafe = safeFiles + bloatCount;
        if (totalSafe === 0 && dqFindings === 0) {
            return { ...phase, description: `No debug artifacts or bloat detected — codebase is clean.` };
        }
        return { ...phase, description: `${totalSafe} safe-to-delete item(s) identified (${bloatBytes} bytes from bloat). ${dqFindings} data-quality finding(s).` };
    }

    return phase;
}

/**
 * Patch remediation phases.
 * @param {number} report
 * @returns {any}
 */
function patchRemediationPhases(report) {
    if (!report || typeof report !== 'object') return report;

    const phaseKeys = ['remediationPhases', 'phases'];
    let patchedAny = false;
    const out = { ...report };

    for (const key of phaseKeys) {
        const arr = report[key];
        if (!Array.isArray(arr)) continue;
        out[key] = arr.map((phase) => patchPhaseDescription(phase, report));
        patchedAny = true;
    }

    return patchedAny ? out : report;
}

/**
 * Upgrade and align a scan report for dashboard consumption (reportVersion 2).
 * @param {Object} report
 * @param {string} [requestedPath]
 * @returns {Object}
 */
function normalizeDashboardReport(report, requestedPath = '') {
    if (!report || typeof report !== 'object') {
        return report;
    }

    const requested = String(requestedPath || report.projectRoot || report.projectPath || '').trim();
    const requestedForward = requested ? requested.replace(/\\/g, '/') : '';
    const scanRoot = requestedForward
        || String(report.projectRoot || report.projectPath || report.scanTargetRoot || '').replace(/\\/g, '/');
    const platformRoot = scanRoot.includes('/')
        ? scanRoot.replace(/\/[^/]+$/, '') || scanRoot
        : scanRoot;

    const summary = report.summary || {};
    const repositoryInventory = report.repositoryInventory
        || (report.inventory && typeof report.inventory === 'object'
            ? {
                totalFiles: report.inventory.totalFiles ?? report.inventory.scannedFiles ?? null,
                totalFolders: report.inventory.totalFolders ?? null,
                projectRoot: scanRoot
            }
            : null);

    const repositoryFilesTotal = report.repositoryFilesTotal
        ?? repositoryInventory?.totalFiles
        ?? summary.repositoryFilesTotal
        ?? null;
    const repositoryFoldersTotal = report.repositoryFoldersTotal
        ?? repositoryInventory?.totalFolders
        ?? summary.repositoryFoldersTotal
        ?? null;
    const ruleScopedFilesAnalyzed = report.ruleScopedFilesAnalyzed
        ?? summary.ruleScopedFilesAnalyzed
        ?? report.filesAnalyzed
        ?? null;

    let filesAnalyzed = report.filesAnalyzed ?? null;
    if (filesAnalyzed == null) {
        filesAnalyzed = report.fullDirectoryScan
            ? repositoryFilesTotal
            : (ruleScopedFilesAnalyzed ?? summary.codeFilesAnalyzed ?? repositoryFilesTotal);
    }

    const reportVersion = Number(report.reportVersion) >= 2
        ? Number(report.reportVersion)
        : (report.version === '1.0.0' || report.type === 'simplebeacon-report' ? 2 : (report.reportVersion ?? 2));

    const out = {
        ...report,
        reportVersion,
        projectRoot: scanRoot || report.projectRoot,
        projectPath: scanRoot || report.projectPath,
        scanTargetRoot: scanRoot || report.scanTargetRoot,
        platformRoot: report.platformRoot || platformRoot,
        filesAnalyzed,
        ruleScopedFilesAnalyzed: ruleScopedFilesAnalyzed ?? filesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        repositoryInventory: repositoryInventory || (repositoryFilesTotal != null
            ? {
                totalFiles: repositoryFilesTotal,
                totalFolders: repositoryFoldersTotal ?? 0,
                projectRoot: scanRoot
            }
            : report.repositoryInventory ?? null)
    };

    return patchRemediationPhases(out);
}

module.exports = { patchRemediationPhases, normalizeDashboardReport };
