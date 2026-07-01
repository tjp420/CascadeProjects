module.exports = function evaluateZeroCredentialFindings(rule, { report }) {
    const findings = report.credentialFindings ?? 0;
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: findings === 0 ? 'pass' : 'fail',
        evidence: findings === 0
            ? `Scanned ${report.credentialScanned ?? 0} path(s) — no credential patterns`
            : `${findings} credential pattern(s) detected`
    };
};
