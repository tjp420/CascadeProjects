module.exports = function evaluateConsistencyPass(rule, { report }) {
    if (report.consistencyChecked == null || report.consistencyChecked === 0) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'skip', evidence: 'Consistency anchors not configured for this profile' };
    }
    const ok = report.consistencyPassed === true || report.consistencyScore >= 95;
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: ok ? 'pass' : 'fail',
        evidence: ok
            ? `Consistency score ${report.consistencyScore ?? '—'}% — no fiction KPI drift`
            : `Consistency score ${report.consistencyScore ?? '—'}% — fiction or baseline drift detected`
    };
};
