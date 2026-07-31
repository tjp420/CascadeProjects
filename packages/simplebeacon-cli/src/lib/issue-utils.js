/**
 * Shared issue grouping and severity helpers (avoids scan ↔ gate circular imports).
 */

const INFORMATIONAL_ISSUE_TYPES = new Set([
  'Legacy Fiction Roadmap',
  'Oversized Roadmap File',
  'test-coverage',
  'documentation',
  'workspace-health',
  'governance-marker',
  'ai-indicators',
  'i18n',
  'security-headers',
  'governance',
  'database-patterns',
]);

function isBlockingIssue(issue) {
  return !INFORMATIONAL_ISSUE_TYPES.has(issue.type);
}

function issueSeverityBand(issue) {
  return issue.severityBand || issue.severity || 'low';
}

/** True when issue severity is in gate failOn (critical always fails). */
function isGateFailSeverity(issue, failOn = ['high']) {
  const band = issueSeverityBand(issue);
  if (band === 'critical') return true;
  const failSet = new Set(Array.isArray(failOn) ? failOn : [failOn]);
  return failSet.has(band);
}

function computeQualityScoreFromIssues(issues, gateConfig = {}) {
  const failOn = gateConfig.failOn || ['high'];
  const severityWeight = { critical: 12, high: 6, medium: 2, low: 1 };
  const weightedPenalty = issues
    .filter((issue) => isBlockingIssue(issue) && isGateFailSeverity(issue, failOn))
    .reduce((sum, issue) => {
      const band = issueSeverityBand(issue);
      return sum + (severityWeight[band] || 1) * (issue.count || 1);
    }, 0);
  return Math.max(0, Math.min(100, Math.round(100 - Math.min(weightedPenalty, 85))));
}

function groupIssues(issues) {
  const grouped = new Map();

  for (const issue of issues) {
    const key = issue.id
      ? `${issue.severity}|${issue.type}|${issue.id}`
      : `${issue.severity}|${issue.type}|${issue.description}`;
    const existing = grouped.get(key);
    if (existing) {
      existing.count += 1;
      const nextSeverity = issue.severityBand || issue.severity;
      if (
        nextSeverity === 'critical' ||
        (nextSeverity === 'high' && existing.severity !== 'critical')
      ) {
        existing.severity = nextSeverity;
        existing.severityBand = nextSeverity;
      }
      for (const fileName of issue.affectedFiles || []) {
        if (!existing.affectedFiles.includes(fileName)) {
          existing.affectedFiles.push(fileName);
        }
      }
      for (const filePath of issue.filePaths || issue.metadata?.duplicatePaths || []) {
        if (!existing.filePaths.includes(filePath)) {
          existing.filePaths.push(filePath);
        }
      }
    } else {
      grouped.set(key, {
        severity: issue.severityBand || issue.severity,
        severityBand: issue.severityBand || issue.severity,
        type: issue.type,
        count: 1,
        description: issue.description,
        pattern: issue.pattern || issue.metadata?.patternId || null,
        line: issue.line || issue.metadata?.line || null,
        recommendation: issue.recommendation || issue.recommendedAction || null,
        recommendedAction: issue.recommendedAction || issue.recommendation,
        affectedFiles: [...(issue.affectedFiles || [])],
        filePaths: [
          ...(issue.filePaths ||
            issue.metadata?.duplicatePaths ||
            (issue.filePath ? [issue.filePath] : [])),
        ],
      });
    }
  }

  return [...grouped.values()].map((item) => ({
    ...item,
    file: item.filePaths?.[0] || item.affectedFiles?.[0] || null,
    affectedFiles: item.affectedFiles.slice(0, 8),
  }));
}

function countBySeverity(issues) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    const severityBand = issue.severityBand || issue.severity;
    if (counts[severityBand] != null) {
      counts[severityBand] += issue.count || 1;
    } else if (counts[issue.severity] != null) {
      counts[issue.severity] += issue.count || 1;
    }
  }
  return counts;
}

module.exports = {
  INFORMATIONAL_ISSUE_TYPES,
  isBlockingIssue,
  issueSeverityBand,
  isGateFailSeverity,
  computeQualityScoreFromIssues,
  groupIssues,
  countBySeverity,
};
