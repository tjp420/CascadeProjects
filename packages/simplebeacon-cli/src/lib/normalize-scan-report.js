/**
 * Align simplebeacon-report top-level metrics with platform-only issue lists.
 */

const {
  partitionBenchmarkIssues,
  isExternalBenchmarkCachePath,
} = require("./benchmark-cache-paths");
const { evaluateGate } = require("../gate");
const {
  countBySeverity,
  groupIssues,
  computeQualityScoreFromIssues,
} = require("./issue-utils");

function isStaleFullTreeScan(report) {
  const mock = report.mockSampleFiles ?? 0;
  const repoFiles =
    report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? 0;
  const walkedFiles = report.ruleScopedFilesAnalyzed ?? report.totalFiles ?? 0;
  const fullTree = Boolean(
    report.fullDirectoryScan || report.scanScope?.fullDirectoryScan,
  );
  return mock > 500 || repoFiles > 15000 || (fullTree && walkedFiles > 15000);
}

function countIssuesByType(issues, typePattern) {
  return issues
    .filter((issue) => typePattern.test(String(issue.type || "")))
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
}

function recomputeQualityScore(issues, gateConfig = {}) {
  return computeQualityScoreFromIssues(issues, gateConfig);
}

/**
 * SimpleBeacon Gate Status Reconciliation Matrix
 * Ensures absolute alignment between summary state and blocking counts.
 * @param {Object} report Scan report draft or normalized export.
 * @returns {Object} Report with scan_summary, gate.pass, and metrics aligned to blockingCount.
 */
function reconcileScanReport(report) {
  if (!report || typeof report !== "object") return report;

  const gate =
    report.gate && typeof report.gate === "object" ? report.gate : {};
  const blockingIssues = Array.isArray(gate.blockingIssues)
    ? gate.blockingIssues
    : [];
  const blockingCount =
    gate.blockingCount != null
      ? gate.blockingCount
      : blockingIssues.reduce((sum, issue) => sum + (issue.count || 1), 0);
  const hasBlockers = blockingCount > 0 || blockingIssues.length > 0;

  if (!report.scan_summary || typeof report.scan_summary !== "object") {
    report.scan_summary = {};
  }

  const quotaBlocked =
    report.scan_summary.status === "BLOCKED" ||
    report.scan_summary.reason === "scan_quota_exceeded";

  if (hasBlockers) {
    report.scan_summary.status = "FAILED";
    report.scan_summary.block_merge = true;
    report.gate = {
      ...gate,
      pass: false,
      blockingCount:
        blockingCount ||
        blockingIssues.reduce((sum, issue) => sum + (issue.count || 1), 0),
      blockingIssues,
    };
    if (report.metrics && typeof report.metrics === "object") {
      report.metrics.status = "CRITICAL_BLOCK";
    }
    if (report.summary && typeof report.summary === "object") {
      report.summary.gatePass = false;
    }
  } else if (!quotaBlocked) {
    report.scan_summary.status = "PASSED";
    report.scan_summary.block_merge = false;
    report.gate = {
      ...gate,
      pass: true,
      blockingCount: 0,
      blockingIssues,
      ...(Array.isArray(gate.warningIssues)
        ? { warningIssues: gate.warningIssues }
        : {}),
    };
    if (
      report.metrics &&
      typeof report.metrics === "object" &&
      report.metrics.status === "CRITICAL_BLOCK"
    ) {
      report.metrics.status = "OK";
    }
    if (report.summary && typeof report.summary === "object") {
      report.summary.gatePass = true;
    }
  }

  return report;
}

function normalizeReportFinding(finding) {
  if (!finding || typeof finding !== "object") return null;
  const severity = String(
    finding.severity || finding.severityBand || "medium",
  ).toLowerCase();
  const type = finding.category || finding.type || "finding";
  return {
    id: finding.id || null,
    type,
    severity,
    severityBand: severity,
    filePath: finding.file || finding.filePath || finding.path || null,
    line: finding.line || null,
    description:
      finding.message ||
      finding.description ||
      finding.snippet ||
      `${type} finding`,
    count: finding.count || 1,
    affectedFiles: finding.file ? [finding.file] : finding.affectedFiles || [],
    filePaths: finding.file ? [finding.file] : finding.filePaths || [],
  };
}

function collectReportFindings(report) {
  if (!report || typeof report !== "object") return [];
  if (Array.isArray(report.findings) && report.findings.length > 0) {
    return report.findings.map(normalizeReportFinding).filter(Boolean);
  }
  if (report.categories && typeof report.categories === "object") {
    const all = [];
    for (const cat of Object.values(report.categories)) {
      if (cat && Array.isArray(cat.findings)) all.push(...cat.findings);
      else if (Array.isArray(cat)) all.push(...cat);
    }
    return all.map(normalizeReportFinding).filter(Boolean);
  }
  return [];
}

function normalizePlatformScanReport(report, options = {}) {
  if (!report || report.type !== "simplebeacon-report") return report;

  let sourceIssues =
    report.rawIssues && report.rawIssues.length ? report.rawIssues : [];
  if (!sourceIssues.length) {
    sourceIssues = collectReportFindings(report);
  }
  const { platformIssues, benchmarkCacheIssues, excludedScanNoiseIssues } =
    partitionBenchmarkIssues(sourceIssues);
  const deduped = [];
  const seen = new Set();
  for (const issue of platformIssues) {
    const key =
      issue.id ||
      `${issue.severity}|${issue.type}|${issue.filePath}|${issue.line || ""}|${issue.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(issue);
  }

  const severityCounts = countBySeverity(deduped);
  const gateConfig =
    options.gateConfig || report.gate || report.scanScope?.gatePolicy || {};
  const gateEval = evaluateGate({ rawIssues: deduped }, gateConfig);
  const gate = {
    pass: gateEval.pass,
    failOn: gateEval.failOn,
    warnOn: gateEval.warnOn,
    blockingCount: gateEval.blockingIssues.reduce(
      (sum, i) => sum + (i.count || 1),
      0,
    ),
    warningCount: gateEval.warningIssues.reduce(
      (sum, i) => sum + (i.count || 1),
      0,
    ),
    blockingIssues: gateEval.blockingIssues,
    warningIssues: gateEval.warningIssues,
  };
  const issueCount = gate.blockingCount + gate.warningCount;

  const staleFullTreeScan = isStaleFullTreeScan(report);

  const scanScope = {
    ...(report.scanScope || {}),
    resultsViewScope: "platform-only",
    benchmarkCacheIssuesExcluded: benchmarkCacheIssues.length,
    excludedPathsNote: benchmarkCacheIssues.length
      ? `${benchmarkCacheIssues.length} issue(s) from github-cache/ benchmark clones excluded from platform gate scores.`
      : report.scanScope?.excludedPathsNote || null,
    reportHealth: staleFullTreeScan
      ? "stale-full-tree-scan"
      : "platform-scoped",
    rescanRecommended:
      staleFullTreeScan ||
      benchmarkCacheIssues.length > 0 ||
      (Boolean(report.scanScope?.rescanRecommended) &&
        report.scanScope?.reportHealth !== "stale-full-tree-scan"),
  };

  const staleLimitation =
    "This report used a full-repo walk (69k+ files) — re-run scan after updating Simplebeacon to scope mock paths to web/data only.";
  const benchmarkNote =
    "github-cache/ OSS benchmark clones are excluded from platform gate scoring (not your product code).";
  const priorLimitations = (report.scanScope?.limitations || []).filter(
    (line) =>
      line &&
      !/github-cache/.test(line) &&
      line !== staleLimitation &&
      line !== benchmarkNote,
  );
  if (staleFullTreeScan) {
    scanScope.limitations = [
      ...new Set([...priorLimitations, staleLimitation, benchmarkNote]),
    ];
    scanScope.inventoryMetricsStale = true;
  } else {
    scanScope.inventoryMetricsStale = false;
    if (priorLimitations.length) {
      scanScope.limitations = priorLimitations;
    } else {
      delete scanScope.limitations;
    }
  }
  if (excludedScanNoiseIssues.length) {
    scanScope.excludedScanNoiseIssues = excludedScanNoiseIssues.length;
  }

  const normalized = {
    ...report,
    rawIssues: deduped,
    detectedIssues: groupIssues(deduped).slice(0, 12),
    benchmarkCacheIssues,
    issueCount,
    severityCounts,
    qualityScore: recomputeQualityScore(deduped, gateConfig),
    invalidJson: countIssuesByType(deduped, /invalid json/i),
    credentialFindings: countIssuesByType(deduped, /credential/i),
    productionLeakFindings: countIssuesByType(deduped, /production leak/i),
    duplicateGroups: deduped.filter((i) =>
      /duplicate/i.test(String(i.type || "")),
    ).length,
    gate,
    scanScope,
  };

  if (staleFullTreeScan) {
    normalized.mockDataCategories = [
      {
        category: "Stale inventory (full-tree scan)",
        fileCount: normalized.mockSampleFiles,
        totalSize: normalized.totalSizeLabel || null,
        qualityScore: null,
        issues: null,
        confidence: null,
        description:
          "Re-run scan to refresh — current categories reflect an outdated full-repo walk, not web/data samples.",
      },
    ];
  } else if (Array.isArray(report.mockDataCategories)) {
    normalized.mockDataCategories = report.mockDataCategories.filter(
      (cat) =>
        !/Stale inventory \(full-tree scan\)/i.test(
          String(cat?.category || ""),
        ),
    );
  }

  return reconcileScanReport(normalized);
}

module.exports = {
  normalizePlatformScanReport,
  reconcileScanReport,
  isStaleFullTreeScan,
  recomputeQualityScore,
  isExternalBenchmarkCachePath,
};
