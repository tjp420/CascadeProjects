module.exports = function evaluateSchemaCompliance(rule, { report }) {
    const checked = report.schemaChecked ?? 0;
    if (!checked) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'skip', evidence: 'No registered page samples in this project' };
    }
    const passed = report.schemaPassed ?? 0;
    const ok = passed === checked;
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: ok ? 'pass' : 'fail',
        evidence: ok
            ? `${passed}/${checked} samples match schema specs`
            : `${passed}/${checked} samples pass schema — fix violations in report`
    };
};
