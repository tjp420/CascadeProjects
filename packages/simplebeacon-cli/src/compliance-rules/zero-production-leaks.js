module.exports = function evaluateZeroProductionLeaks(rule, { report }) {
    const findings = report.productionLeakFindings ?? 0;
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: findings === 0 ? 'pass' : 'fail',
        evidence: findings === 0
            ? `Scanned ${report.productionLeakScanned ?? 0} production file(s) — no sample-path leaks`
            : `${findings} production leak(s) — mock/sample paths in prod code`
    };
};
