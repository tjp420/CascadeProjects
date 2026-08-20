module.exports = function evaluateNpmNoCriticalHigh(rule, { npmAudit }) {
  if (!npmAudit?.summary) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: "skip",
      evidence: "No package.json — npm audit not applicable",
    };
  }
  const critical = npmAudit.summary.critical || 0;
  const high = npmAudit.summary.high || 0;
  const ok = critical === 0 && high === 0;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: ok ? "pass" : "fail",
    evidence: ok
      ? `npm audit: 0 critical, 0 high (${npmAudit.source || "scan"})`
      : `npm audit: ${critical} critical, ${high} high — upgrade dependencies`,
  };
};
