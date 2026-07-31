module.exports = function evaluateCleanupBloatReviewed(rule, { dataCleanup }) {
  const detailedFindings = dataCleanup?.findings?.directoryBloat || [];
  const bloatCount = detailedFindings.length || (dataCleanup?.summary?.directoryBloatFindings ?? 0);
  const reclaimableBytes =
    dataCleanup?.summary?.reclaimableBytes ??
    dataCleanup?.summary?.directoryBloatReclaimableBytes ??
    0;
  if (bloatCount === 0) {
    return {
      id: rule.id,
      title: rule.title,
      category: rule.category,
      severity: rule.severity,
      remediation: rule.remediation || null,
      status: 'pass',
      evidence: 'No directory bloat detected — codebase is clean',
    };
  }
  const safeToDelete = detailedFindings.filter((f) => f.action === 'safe-to-delete').length;
  return {
    id: rule.id,
    title: rule.title,
    category: rule.category,
    severity: rule.severity,
    remediation: rule.remediation || null,
    status: safeToDelete > 0 ? 'pass' : 'review',
    evidence:
      safeToDelete > 0
        ? `${bloatCount} bloat item(s) found (${formatBytes(reclaimableBytes)} reclaimable) — ${safeToDelete} marked safe-to-delete`
        : `${bloatCount} bloat item(s) found (${formatBytes(reclaimableBytes)} reclaimable) — review before cleanup`,
  };
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
