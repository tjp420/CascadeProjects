// simplebeacon-ignore: Dashboard code — all findings are false positives in scanner definitions
/**
 * CLI Report Adapter
 *
 * Normalizes SimpleBeacon CLI JSON report output into the shape that
 * dashboard widgets (DashboardView, ScanStatus, TrendChart,
 * TeamGatePassTrendChart) expect.
 *
 * The CLI produces a rich, flat JSON report with 100+ fields. The
 * dashboard widgets expect a smaller, nested shape with specific
 * field names. This adapter bridges that gap.
 *
 * Usage:
 *   import { adaptCliReport, adaptCliReportHistory } from './cli-report-adapter.js';
 *   const dashboardReport = adaptCliReport(cliJsonReport);
 *   const trendData = adaptCliReportHistory([report1, report2, report3]);
 */

/**
 * Adapt a single CLI JSON report into dashboard-compatible format.
 *
 * @param {object} cliReport - Raw CLI JSON report from `simplebeacon scan --format json`
 * @returns {object} Normalized report with fields dashboard widgets expect
 */
export function adaptCliReport(cliReport) {
  if (!cliReport || typeof cliReport !== 'object') {
    return _emptyReport();
  }

  const raw = cliReport;
  const gate = raw.gate || {};
  const rawIssues = Array.isArray(raw.rawIssues) ? raw.rawIssues : [];
  // Prefer detectedIssues, but fall back to rawIssues if detectedIssues is empty
  const detectedIssues =
    Array.isArray(raw.detectedIssues) && raw.detectedIssues.length > 0 ? raw.detectedIssues : rawIssues;

  // Normalize detected issues for dashboard consumption
  const normalizedIssues = detectedIssues.map(_normalizeIssue);

  // Build severity counts from issues if not present in report
  const rawSev = raw.severityCounts || {};
  const severityCounts =
    rawSev.critical !== undefined || rawSev.high !== undefined
      ? { critical: rawSev.critical || 0, high: rawSev.high || 0, medium: rawSev.medium || 0, low: rawSev.low || 0 }
      : _countSeverities(normalizedIssues);

  // Compute quality score if missing (uses computed severityCounts)
  const qualityScore = _resolveQualityScore(raw, severityCounts, gate);

  // File metrics
  const filesAnalyzed = raw.ruleScopedFilesAnalyzed || raw.filesAnalyzed || 0;
  const repoTotal = raw.repositoryFilesTotal || raw.totalFiles || 0;

  // Scan scope info
  const projectRoot = raw.projectRoot || raw.platformRoot || 'Unknown';
  const scanPaths = Array.isArray(raw.scanPaths) ? raw.scanPaths : [];
  const generatedAt = raw.generatedAt || new Date().toISOString();

  // Gate status — synthesize blocking/warning counts from severity if missing
  const gatePass = gate.pass === true;
  const blockingCount =
    gate.blockingCount !== undefined ? gate.blockingCount : severityCounts.critical + severityCounts.high;
  const warningCount = gate.warningCount !== undefined ? gate.warningCount : severityCounts.medium + severityCounts.low;

  // Rule coverage — which analyzers ran and their finding counts
  const ruleCoverage = _extractRuleCoverage(raw);

  // Build the normalized report
  return {
    // Core identity
    type: 'simplebeacon-cli-scan',
    reportVersion: raw.reportVersion || 1,
    generatedAt,
    generatedBy: raw.generatedBy || 'simplebeacon-cli',

    // Project info
    projectRoot,
    platformRoot: raw.platformRoot || projectRoot,
    configPath: raw.configPath || null,
    scanPaths,

    // File metrics
    totalFiles: raw.totalFiles || 0,
    totalLines: raw.totalLines || 0,
    filesAnalyzed,
    ruleScopedFilesAnalyzed: filesAnalyzed,
    repositoryFilesTotal: repoTotal,
    repositoryFoldersTotal: raw.repositoryFoldersTotal || 0,
    totalSizeBytes: raw.totalSizeBytes || 0,
    totalSizeLabel: raw.totalSizeLabel || '',

    // Issue metrics
    issueCount: raw.issueCount || normalizedIssues.length,
    severityCounts,

    // Quality score
    qualityScore,
    qualityScoreHidden: raw.qualityScoreHidden || false,

    // Gate
    gate: {
      pass: gatePass,
      blockingCount,
      warningCount,
      blockingIssues: gate.blockingIssues || [],
      warningIssues: gate.warningIssues || [],
      status: gate.status || (gatePass ? 'PASSED' : blockingCount > 0 ? 'BLOCKED' : 'REVIEW'),
      failOn: gate.failOn || [],
      warnOn: gate.warnOn || [],
      score: qualityScore,
    },

    // Issues
    rawIssues: normalizedIssues,
    detectedIssues: normalizedIssues,

    // Rule coverage
    ruleCoverage,

    // Scan timing
    totalScanTimeMs: raw.totalScanTimeMs || 0,
    totalScanDurationMs: raw.totalScanDurationMs || 0,
    ruleTimings: raw.ruleTimings || {},
    slowestRule: raw.slowestRule || null,

    // Compliance
    compliance: raw.compliance || null,
    euAiAct: raw.euAiAct || null,
    euAiActSummary: raw.euAiActSummary || null,

    // Additional sections
    npmAudit: raw.npmAudit || null,
    remediationPhases: raw.remediationPhases || null,
    buildReadiness: raw.buildReadiness || null,
    qualityScorecard: raw.qualityScorecard || null,

    // Scan errors
    scanErrors: raw.scanErrors || [],

    // Tier info
    tier: raw.tier || 'unknown',
    tierLimitation: raw.tierLimitation || null,

    // Sanitization
    sanitized: raw.sanitized || false,
    sanitizedAt: raw.sanitizedAt || null,
  };
}

/**
 * Adapt an array of CLI reports into trend data for TrendChart and
 * TeamGatePassTrendChart.
 *
 * @param {object[]} cliReports - Array of CLI JSON reports (oldest first)
 * @returns {{trendHistory: object[], gateTrend: object[]}}
 *   trendHistory: [{date, issueCount, qualityScore}] for TrendChart
 *   gateTrend: [{date, gate_pass_rate, scan_count}] for TeamGatePassTrendChart
 */
export function adaptCliReportHistory(cliReports) {
  if (!Array.isArray(cliReports) || cliReports.length === 0) {
    return { trendHistory: [], gateTrend: [] };
  }

  const sorted = [...cliReports].sort((a, b) => {
    const da = new Date(a.generatedAt || 0).getTime();
    const db = new Date(b.generatedAt || 0).getTime();
    return da - db;
  });

  // Group by date for gate pass rate calculation
  const byDate = {};
  for (const r of sorted) {
    const dateKey = (r.generatedAt || new Date().toISOString()).slice(0, 10);
    if (!byDate[dateKey]) byDate[dateKey] = [];
    byDate[dateKey].push(r);
  }

  const trendHistory = sorted.map((r) => {
    const adapted = adaptCliReport(r);
    return {
      date: r.generatedAt || new Date().toISOString(),
      issueCount: adapted.issueCount,
      qualityScore: adapted.qualityScore,
    };
  });

  const gateTrend = Object.entries(byDate).map(([date, reports]) => {
    const passed = reports.filter((r) => r.gate && r.gate.pass === true).length;
    const total = reports.length;
    return {
      date,
      gate_pass_rate: total > 0 ? passed / total : 0,
      scan_count: total,
    };
  });

  return { trendHistory, gateTrend };
}

/**
 * Extract a summary of rule coverage from the CLI report.
 * Returns an array of {rule, filesScanned, findings} for each analyzer.
 */
function _extractRuleCoverage(raw) {
  const rules = [
    { key: 'credentialScanned', findingsKey: 'credentialFindings', name: 'Credential Scanner' },
    { key: 'productionLeakScanned', findingsKey: 'productionLeakFindings', name: 'Production Leak' },
    { key: 'sourceCodeFilesScanned', findingsKey: 'sourceFictionPatternHits', name: 'Source Fiction' },
    { key: 'llmSlopFilesScanned', findingsKey: 'llmSlopPatternHits', name: 'LLM Slop' },
    { key: 'securityPatternFilesScanned', findingsKey: 'securityPatternFindings', name: 'Security Patterns' },
    { key: 'hardcodedUrlFilesScanned', findingsKey: 'hardcodedUrlFindings', name: 'Hardcoded URLs' },
    { key: 'weakCryptoFilesScanned', findingsKey: 'weakCryptoFindings', name: 'Weak Crypto' },
    { key: 'secretInCommentsFilesScanned', findingsKey: 'secretInCommentsFindings', name: 'Secret in Comments' },
    { key: 'syncIoFilesScanned', findingsKey: 'syncIoFindings', name: 'Sync I/O' },
    { key: 'envInGitFilesScanned', findingsKey: 'envInGitFindings', name: 'Env in Git' },
    { key: 'redosFilesScanned', findingsKey: 'redosFindings', name: 'ReDoS' },
    { key: 'piiLoggingFilesScanned', findingsKey: 'piiLoggingFindings', name: 'PII Logging' },
    { key: 'deadCodeFilesScanned', findingsKey: 'deadCodeFindings', name: 'Dead Code' },
    { key: 'memoryLeakFilesScanned', findingsKey: 'memoryLeakFindings', name: 'Memory Leak' },
    { key: 'typeSafetyFilesScanned', findingsKey: 'typeSafetyFindings', name: 'Type Safety' },
    { key: 'hallucinatedImportFilesScanned', findingsKey: 'hallucinatedImportFindings', name: 'Hallucinated Imports' },
    { key: 'astStructuralFilesScanned', findingsKey: 'astStructuralFindings', name: 'AST Structural' },
    { key: 'euAiActScanned', findingsKey: 'euAiActFindings', name: 'EU AI Act' },
  ];

  return rules
    .filter((r) => raw[r.key] !== undefined)
    .map((r) => ({
      rule: r.name,
      filesScanned: raw[r.key] || 0,
      findings: raw[r.findingsKey] || 0,
    }));
}

/**
 * Resolve the quality score from a CLI report, computing it if missing.
 */
function _resolveQualityScore(raw, sev, gate) {
  // If the report has an explicit quality score, use it
  if (typeof raw.qualityScore === 'number' && raw.qualityScore >= 0) {
    return raw.qualityScore;
  }

  // If the gate has a score, use it
  if (typeof gate.score === 'number' && gate.score >= 0) {
    return gate.score;
  }

  // Check qualityScorecard
  if (raw.qualityScorecard && typeof raw.qualityScorecard.overall === 'number') {
    return raw.qualityScorecard.overall;
  }

  // Compute from severity counts
  const critical = sev.critical || 0;
  const high = sev.high || 0;
  const medium = sev.medium || 0;
  const low = sev.low || 0;
  const total = critical + high + medium + low;

  if (total === 0) return 100;
  return Math.max(0, Math.min(100, 100 - (critical * 20 + high * 10 + medium * 5 + low * 2)));
}

/**
 * Normalize a single issue from CLI format to dashboard format.
 */
function _normalizeIssue(issue) {
  if (!issue || typeof issue !== 'object') return issue;

  return {
    id: issue.id || '',
    severity: (issue.severity || 'low').toLowerCase(),
    severityBand: issue.severityBand || issue.severity || 'low',
    type: issue.type || issue.pattern || 'issue',
    pattern: issue.pattern || issue.type || '',
    filePath: issue.filePath || issue.file || '',
    file: issue.file || issue.filePath || '',
    line: issue.line || null,
    description: issue.description || issue.message || '',
    humanReadable: issue.humanReadable || issue.description || '',
    recommendedAction: issue.recommendedAction || issue.suggestion || '',
    affectedFiles: issue.affectedFiles || [],
    count: issue.count || 1,
    confidence: issue.confidence || (issue.metadata && issue.metadata.confidence) || null,
    metadata: issue.metadata || {},
    matches: issue.matches || [],
  };
}

/**
 * Count issues by severity.
 */
function _countSeverities(issues) {
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    const sev = (issue.severity || 'low').toLowerCase();
    if (counts[sev] !== undefined) counts[sev]++;
    else counts.low++;
  }
  return counts;
}

/**
 * Return an empty report for null/invalid input.
 */
function _emptyReport() {
  return {
    type: 'simplebeacon-cli-scan',
    reportVersion: 1,
    generatedAt: new Date().toISOString(),
    generatedBy: 'simplebeacon-cli',
    projectRoot: 'Unknown',
    platformRoot: 'Unknown',
    configPath: null,
    scanPaths: [],
    totalFiles: 0,
    totalLines: 0,
    filesAnalyzed: 0,
    ruleScopedFilesAnalyzed: 0,
    repositoryFilesTotal: 0,
    repositoryFoldersTotal: 0,
    totalSizeBytes: 0,
    totalSizeLabel: '',
    issueCount: 0,
    severityCounts: { critical: 0, high: 0, medium: 0, low: 0 },
    qualityScore: 100,
    qualityScoreHidden: false,
    gate: {
      pass: true,
      blockingCount: 0,
      warningCount: 0,
      blockingIssues: [],
      warningIssues: [],
      status: 'PASSED',
      failOn: [],
      warnOn: [],
      score: 100,
    },
    rawIssues: [],
    detectedIssues: [],
    ruleCoverage: [],
    totalScanTimeMs: 0,
    totalScanDurationMs: 0,
    ruleTimings: {},
    slowestRule: null,
    compliance: null,
    euAiAct: null,
    euAiActSummary: null,
    npmAudit: null,
    remediationPhases: null,
    buildReadiness: null,
    qualityScorecard: null,
    scanErrors: [],
    tier: 'unknown',
    tierLimitation: null,
    sanitized: false,
    sanitizedAt: null,
  };
}
