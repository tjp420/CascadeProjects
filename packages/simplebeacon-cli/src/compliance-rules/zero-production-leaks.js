module.exports = function evaluateZeroProductionLeaks(rule, { report }) {
    const findings = report.productionLeakFindings ?? 0;
    const scanned = report.productionLeakScanned;
    if ((scanned ?? 0) === 0 && findings === 0) {
        return {
            id: rule.id,
            title: rule.title,
            category: rule.category,
            severity: rule.severity,
            remediation: rule.remediation || null,
            status: 'skip',
            evidence: 'No production files scanned for leaks — rule not evaluated'
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
            ? `Scanned ${scanned ?? '?'} production file(s) — no sample-path leaks`
            : `${findings} production leak(s) — mock/sample paths in prod code`
    };
};
