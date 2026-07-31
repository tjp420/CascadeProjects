module.exports = function evaluateEuAiActLogging(rule, { report }) {
  const gaps = (report.rawIssues || []).filter((issue) =>
    /logging gap/i.test(String(issue.type || ''))
  ).length;
  const aiHits =
    (report.euAiActSummary?.aiSystemIndicators ?? 0) +
    (report.euAiActSummary?.highRiskIndicators ?? 0);
  if (aiHits === 0) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: 'pass',
      evidence: 'No AI decision paths detected',
    };
  }
  const ok = gaps === 0;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: ok ? 'pass' : 'fail',
    evidence: ok
      ? 'AI decision paths include audit/logging signals'
      : `${gaps} AI decision path(s) without logging markers — add inference audit trail`,
  };
};
