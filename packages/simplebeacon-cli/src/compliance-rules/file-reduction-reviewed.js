module.exports = function evaluateFileReductionReviewed(rule, { dataCleanup }) {
    const totalFindings = dataCleanup?.summary?.totalFindings
        ?? dataCleanup?.summary?.directoryBloatFindings
        ?? 0;
    if (totalFindings === 0) {
        return { id: rule.id, title: rule.title, category: rule.category, severity: rule.severity, remediation: rule.remediation || null, status: 'pass', evidence: 'No file reduction findings — no cleanup needed' };
    }
    const reclaimable = dataCleanup?.summary?.reclaimableBytes
        ?? dataCleanup?.summary?.directoryBloatReclaimableBytes
        ?? 0;
    return {
        id: rule.id,
        title: rule.title,
        category: rule.category,
        severity: rule.severity,
        remediation: rule.remediation || null,
        status: 'pass',
        evidence: `${totalFindings} finding(s) reviewed (${formatBytes(reclaimable)} reclaimable)`
    };
};

function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}
