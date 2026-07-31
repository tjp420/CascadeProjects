module.exports = function evaluateGatePass(rule, { report }) {
    const pass = Boolean(report.gate?.pass);
    const filesScanned = report.totalFiles ?? report.filesAnalyzed ?? report.repositoryFilesTotal ?? 0;
    if (filesScanned === 0 && !pass) {
        return {
            id: rule.id,
            title: rule.title,
            category: rule.category,
            severity: rule.severity,
            remediation: rule.remediation || null,
            status: 'skip',
            evidence: 'No files scanned — gate not evaluated'
        };
    }
    if (filesScanned === 0 && pass) {
        return {
            id: rule.id,
            title: rule.title,
            category: rule.category,
            severity: rule.severity,
            remediation: rule.remediation || null,
            status: 'pass',
            evidence: 'Gate pass — no blocking issues at configured severities'
        };
    }
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: pass ? 'pass' : 'fail',
        evidence: pass
            ? 'Gate pass — no blocking issues at configured severities'
            : `Gate fail — ${report.gate?.blockingCount ?? report.severityCounts?.high ?? '?'} blocking issue(s)`
    };
};
