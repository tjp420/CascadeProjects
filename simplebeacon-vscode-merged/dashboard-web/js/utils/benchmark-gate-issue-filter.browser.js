/**
 * Browser mirror of benchmark gate issue exclusions — keep in sync with fiction-digest-export-sanitize.js.
 */

const SCANNER_IMPL_PATH_RE =
  /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)|(?:^|\/)src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)/;
const OSS_SCANNER_ROOT_FILES = new Set(['src/scan.js', 'src/config.js', 'src/project-detect.js', 'src/index.js']);

const SUPPRESSED_PRODUCTION_LEAK_INTENTS = new Set([
  'scanner-meta',
  'repository-audit-loader',
  'repository-audit-stub-loader',
  'config-metadata',
  'demo-tool-sample',
]);

/**
 * Normalize rel.
 * @param {string} filePath
 * @returns {any}
 */
function normalizeRel(filePath) {
  return String(filePath || '').replace(/\\/g, '/');
}

/**
 * Is scanner implementation path.
 * @param {string} relativePath
 * @returns {any}
 */
export function isScannerImplementationPath(relativePath) {
  const rel = normalizeRel(relativePath);
  if (SCANNER_IMPL_PATH_RE.test(rel.toLowerCase())) return true;
  if (OSS_SCANNER_ROOT_FILES.has(rel)) return true;
  return false;
}

/**
 * Is benchmark clone noise issue.
 * @param {boolean} issue
 * @returns {any}
 */
export function isBenchmarkCloneNoiseIssue(issue) {
  if (!issue) return false;
  const pattern = String(issue.pattern || issue.metadata?.patternId || '');
  const category = String(issue.category || issue.metadata?.category || '');
  const type = String(issue.type || '');
  if (/SB-HANDOFF/i.test(pattern) || category === 'handoff-integrity') return true;
  if (/EUAI-/i.test(pattern) || /EU AI Act/i.test(type)) return true;
  return false;
}

/**
 * Is benchmark scanner meta issue.
 * @param {boolean} issue
 * @returns {any}
 */
export function isBenchmarkScannerMetaIssue(issue) {
  if (!issue) return false;
  const intent = String(issue.metadata?.intent || issue.intent || '');
  if (intent && SUPPRESSED_PRODUCTION_LEAK_INTENTS.has(intent)) return true;
  if (!/production leak/i.test(String(issue.type || ''))) return false;
  const filePath = issue.filePath || issue.file || issue.filePaths?.[0] || '';
  return filePath ? isScannerImplementationPath(filePath) : false;
}

/**
 * Is benchmark digest excluded issue.
 * @param {boolean} issue
 * @param {any} benchmarkScan
 * @returns {any}
 */
export function isBenchmarkDigestExcludedIssue(issue, benchmarkScan) {
  if (!benchmarkScan || !issue) return false;
  if (isBenchmarkCloneNoiseIssue(issue)) return true;
  return isBenchmarkScannerMetaIssue(issue);
}

/**
 * Filter benchmark gate issues.
 * @param {Array} issues
 * @param {any} benchmarkScan
 * @returns {any}
 */
export function filterBenchmarkGateIssues(issues = [], benchmarkScan) {
  if (!benchmarkScan) return issues;
  return issues.filter((issue) => !isBenchmarkDigestExcludedIssue(issue, true));
}

/**
 * Recompute gate from issues.
 * @param {Array} issues
 * @param {Object} gateConfig
 * @returns {any}
 */
export function recomputeGateFromIssues(issues, gateConfig = {}) {
  const failOn = gateConfig.failOn || ['high'];
  const warnOn = gateConfig.warnOn || ['medium', 'low'];
  const blockingCount = issues
    .filter((issue) => failOn.includes(issue.severityBand || issue.severity))
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const warningCount = issues
    .filter((issue) => warnOn.includes(issue.severityBand || issue.severity))
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  return {
    ...gateConfig,
    pass: blockingCount === 0,
    blockingCount,
    warningCount,
  };
}

/**
 * Normalize benchmark gate report.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
export function normalizeBenchmarkGateReport(report, projectPath) {
  if (!report || report.type !== 'simplebeacon-report') return report;
  const projectKey = normalizeRel(projectPath || report.projectRoot || '');
  const isBenchmark = /\/github-cache\//i.test(projectKey) || projectKey.startsWith('github-cache/');
  if (!isBenchmark) return report;

  const sourceIssues = report.rawIssues?.length ? report.rawIssues : report.detectedIssues || [];
  const benchmarkCloneNoiseIssues = [];
  const deduped = [];
  const seen = new Set();
  for (const issue of sourceIssues) {
    const key = issue.id || `${issue.severity}|${issue.type}|${issue.filePath}|${issue.description}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isBenchmarkDigestExcludedIssue(issue, true)) {
      benchmarkCloneNoiseIssues.push(issue);
      continue;
    }
    deduped.push(issue);
  }

  const gateConfig = report.gate || report.scanScope?.gatePolicy || { failOn: ['high'], warnOn: ['medium', 'low'] };
  const gate = recomputeGateFromIssues(deduped, gateConfig);
  const productionLeakFindings = deduped
    .filter((i) => /production leak/i.test(String(i.type || '')))
    .reduce((sum, i) => sum + (i.count || 1), 0);

  return {
    ...report,
    projectRoot: projectKey || report.projectRoot,
    rawIssues: deduped,
    detectedIssues: deduped.slice(0, 12),
    benchmarkCloneNoiseIssues: benchmarkCloneNoiseIssues.length ? benchmarkCloneNoiseIssues : undefined,
    issueCount: gate.blockingCount + gate.warningCount,
    productionLeakFindings,
    gate,
    benchmarkScan: true,
    scanTargetProfile: 'benchmark-cache',
    handoffEligible: false,
    scanScope: {
      ...(report.scanScope || {}),
      resultsViewScope: 'benchmark-clone',
      reportHealth: 'benchmark-clone-scan',
      benchmarkScanTarget: true,
      benchmarkCloneNoiseExcluded: benchmarkCloneNoiseIssues.length || undefined,
      rescanRecommended: false,
      limitations: [
        'Scanning OSS benchmark clone under github-cache/ — Simplebeacon product gate paths were not evaluated.',
      ],
    },
  };
}
