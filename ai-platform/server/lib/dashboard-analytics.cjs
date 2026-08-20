/**
 * SimpleBeacon Dashboard Analytics Aggregator
 * Processes repository compliance scan records into scannable analytics dashboards.
 */
"use strict";

const crypto = require("crypto");

/**
 * Computes standard grade thresholds (A-F) based on a numeric compliance score (0-100).
 */
function calculateComplianceGrade(score) {
  if (score >= 90) return "A";
  if (score >= 80) return "B";
  if (score >= 70) return "C";
  if (score >= 60) return "D";
  return "F";
}

/**
 * Generates an idealized anonymized project signature for tracking trends without source code custody.
 */
function anonymizeProjectId(projectName, tenantSalt) {
  return crypto
    .createHmac("sha256", tenantSalt || "simplebeacon_fallback_salt")
    .update(projectName)
    .digest("hex")
    .substring(0, 16);
}

/**
 * Aggregates high-volume scan snapshots into time-series dashboard charts.
 * @param {Array} scanRecords - Raw historical execution objects from database or telemetry streams.
 */
function generateDashboardMetrics(scanRecords = []) {
  const summary = {
    totalScans: scanRecords.length,
    totalFilesAnalyzed: 0,
    totalLinesAnalyzed: 0,
    totalIssuesRemediated: 0,
    developerHoursSaved: 0,
    averageComplianceScore: 0,
    currentGrade: "F",
    severityDistribution: { critical: 0, high: 0, medium: 0, low: 0 },
    timelineData: [], // Organized for line chart injection
  };

  if (scanRecords.length === 0) return summary;

  let totalScoreSum = 0;

  // Process data chronologically to build accurate charts
  const sortedScans = [...scanRecords].sort(
    (a, b) => new Date(a.timestamp) - new Date(b.timestamp),
  );

  for (const scan of sortedScans) {
    summary.totalFilesAnalyzed += scan.filesCount || 0;
    summary.totalLinesAnalyzed += scan.linesCount || 0;
    summary.totalIssuesRemediated += scan.remediationsCount || 0;
    totalScoreSum += scan.complianceScore || 0;

    // Severity mapping
    if (scan.severities) {
      summary.severityDistribution.critical += scan.severities.critical || 0;
      summary.severityDistribution.high += scan.severities.high || 0;
      summary.severityDistribution.medium += scan.severities.medium || 0;
      summary.severityDistribution.low += scan.severities.low || 0;
    }

    // Chart timeline construction
    summary.timelineData.push({
      date: new Date(scan.timestamp).toISOString().split("T")[0],
      score: scan.complianceScore || 0,
      remediations: scan.remediationsCount || 0,
      files: scan.filesCount || 0,
    });
  }

  // Final metric derivations
  summary.averageComplianceScore = Math.round(
    totalScoreSum / scanRecords.length,
  );
  summary.currentGrade = calculateComplianceGrade(
    summary.averageComplianceScore,
  );

  // 1 remediated item roughly equals 12 minutes of senior dev pipeline cleaning slop manually
  summary.developerHoursSaved = parseFloat(
    ((summary.totalIssuesRemediated * 12) / 60).toFixed(1),
  );

  return summary;
}

module.exports = {
  calculateComplianceGrade,
  anonymizeProjectId,
  generateDashboardMetrics,
};
