module.exports = function evaluateEuAiActHumanOversight(rule, { report }) {
  const gaps = (report.rawIssues || []).filter((issue) =>
    /human oversight gap/i.test(String(issue.type || "")),
  ).length;
  const highRisk = report.euAiActSummary?.highRiskIndicators ?? 0;
  if (highRisk === 0) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: "pass",
      evidence:
        "No high-risk AI patterns — human oversight rule not applicable",
    };
  }
  const ok = gaps === 0;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: ok ? "pass" : "fail",
    evidence: ok
      ? `${highRisk} high-risk indicator(s) with human oversight signals in code`
      : `${gaps} file(s) with high-risk AI but no human oversight markers`,
  };
};
