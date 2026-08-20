module.exports = function evaluateConsistencyPass(rule, { report }) {
  const checked = report.consistencyChecked ?? 0;
  if (checked === 0) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: "skip",
      evidence: "Consistency anchors not configured for this profile",
    };
  }
  // consistencyPassed may be a boolean legacy value or a count of passing samples
  const passed =
    report.consistencyPassed === true
      ? checked
      : (report.consistencyPassed ?? 0);
  const score =
    report.consistencyScore ??
    (checked ? Math.round((passed / checked) * 100) : 0);
  const ok = score >= 95;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: ok ? "pass" : "fail",
    evidence: ok
      ? `Consistency score ${score}% — no fiction KPI drift`
      : `Consistency score ${score}% — fiction or baseline drift detected`,
  };
};
