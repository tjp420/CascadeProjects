module.exports = function evaluateNpmModerateLimit(rule, { npmAudit }) {
  if (!npmAudit?.summary) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: 'skip',
      evidence: 'No package.json — npm audit not applicable',
    };
  }
  const limit = rule.maxModerate ?? 0;
  const moderate = npmAudit.summary.moderate || npmAudit.summary.medium || 0;
  const ok = moderate <= limit;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: ok ? 'pass' : 'fail',
    evidence: ok
      ? `${moderate} moderate (limit ${limit})`
      : `${moderate} moderate exceeds policy limit of ${limit}`,
  };
};
