module.exports = function evaluateCleanupEmptyDirs(rule, { dataCleanup }) {
  const detailedFindings = dataCleanup?.findings?.directoryBloat || [];
  const emptyDirs = detailedFindings.filter(
    (f) => f.category === "Empty directory",
  );
  const bloatCount =
    detailedFindings.length ||
    (dataCleanup?.summary?.directoryBloatFindings ?? 0);
  if (emptyDirs.length === 0 && bloatCount === 0) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: "pass",
      evidence: "No empty directories detected",
    };
  }
  if (emptyDirs.length > 0) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: "pass",
      evidence: `${emptyDirs.length} empty director(ies) detected — safe to remove`,
    };
  }
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: "pass",
    evidence: `${bloatCount} bloat item(s) detected — review for empty directories`,
  };
};
