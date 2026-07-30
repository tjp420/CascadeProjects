module.exports = function evaluateZeroCredentialFindings(rule, { report }) {
    const findings = report.credentialFindings ?? 0;
    const scanned = report.credentialScanned;
    if ((scanned ?? 0) === 0 && findings === 0) {
        return {
            id: rule.id,
            title: rule.title,
            category: rule.category,
            severity: rule.severity,
            remediation: rule.remediation || null,
            status: 'skip',
            evidence: 'No paths scanned for credentials — rule not evaluated'
        };
    }
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: findings === 0 ? 'pass' : 'fail',
        evidence: findings === 0
            ? `Scanned ${scanned ?? '?'} path(s) — no credential patterns`
            : `${findings} credential pattern(s) detected`
    };
};
