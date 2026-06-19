const { DEFAULT_CONFIG, DEFAULT_MAX_STALE_MS, DEFAULT_MOCK_SCAN_RELATIVE_PATHS, PROFILE_RULES, applyPublicGateToAnalyzeResponse, buildAssessmentReport, buildFictionPatternCatalog, buildReAttestationNoteArtifact, countFictionIssues, countRepositoryInventory, detectProjectProfile, evaluateComplianceChecklist, evaluateEuExportEligibility, evaluateGate, evaluateSprintFreshness, formatJsonReport, initSimplebeacon, isLegalReviewAttestation, loadSimplebeaconConfig, projectLabelFromPath, redactProjectPathForExport, resolveMockDataScanPaths, resolvePlatformRoot: resolvePlatformRootFromIndex, runScan, runFileReductionScan, sanitizeCleanupBriefExport, sanitizeCodebaseReportExport, sanitizeCompleteScanExport, sanitizeComplianceChecklistArtifactExport, sanitizeConsolidationExport, sanitizeDataCleanupReportExport, sanitizeFictionDigestExport, sanitizeNpmAuditExport, sanitizePublicOutput, sanitizePublicSummaryArtifactExport, sanitizeRoadmapExport, sanitizeScanReport, sanitizeSimplebeaconReportExport, validateConfig } = require('../../../packages/simplebeacon-cli/src/index.js');
const { isExternalBenchmarkCachePath } = require('../../../packages/simplebeacon-cli/src/lib/benchmark-cache-paths.js');
const { resolveScanProgressPath, readScanProgress } = require('../../../packages/simplebeacon-cli/src/lib/scan-progress.js');
const { verifyLicenseToken } = require('../../../packages/simplebeacon-cli/src/lib/license-token.js');
const { sanitizeComplianceBundleExport } = require('../../../packages/simplebeacon-cli/src/lib/compliance-export-sanitize.js');
const { consolidationCandidateTouchesExcluded, countIntentionalPairExclusions } = require('../../../packages/simplebeacon-cli/src/lib/consolidation-path-exclusions.js');
const { buildAuditPayload } = require('../../../packages/simplebeacon-cli/src/lib/dashboard-payload.js');
const {
  collectIssues,
  resolveSeverityCounts,
  buildDetailedFindings,
  buildComplianceTable,
  buildHowToFixSection,
  buildPersonalizedActionPlan,
  formatRule,
  defaultRemediation
} = require('../../../packages/simplebeacon-cli/src/reporters/audit-report.js');

// Inline isConsolidationExcludedPair to avoid packages/simplebeacon-cli module resolution issues
/**
 * Normalize relative path.
 * @param {string} relativePath
 * @returns {any}
 */
function normalizeRelativePath(relativePath) {
  return String(relativePath || '').replace(/\\/g, '/');
}
/**
 * Is ephemeral consolidation path.
 * @param {string} filePath
 * @returns {any}
 */
function isEphemeralConsolidationPath(filePath) {
  const rel = normalizeRelativePath(filePath);
  const base = rel.split('/').pop() || '';
  if (/^\.tmp[-.]/i.test(base)) return true;
  if (base === '.tmp-vault-cookies.txt') return true;
  if (base === 'cookies.txt') {
    if (!rel.includes('/')) return true;
    if (/\/\.?tmp/i.test(rel) || /\/vault\//i.test(rel)) return true;
    const dir = rel.includes('/') ? rel.slice(0, rel.lastIndexOf('/')) : '';
    if (dir.split('/').some((seg) => /^\.tmp/i.test(seg))) return true;
  }
  return false;
}
/**
 * Is monorepo platform alias pair.
 * @param {string} pathA
 * @param {string} pathB
 * @param {string} platformDirName
 * @returns {any}
 */
function isMonorepoPlatformAliasPair(pathA, pathB, platformDirName = 'ai-platform') {
  const a = normalizeRelativePath(pathA);
  const b = normalizeRelativePath(pathB);
  if (a === b) return false;
  const prefix = `${platformDirName}/`;
/**
 * Strip prefix.
 * @param {any} p
 * @returns {any}
 */
  const stripPrefix = (p) => (p.startsWith(prefix) ? p.slice(prefix.length) : p);
  return (a.startsWith(prefix) && b === stripPrefix(a)) || (b.startsWith(prefix) && a === stripPrefix(b));
}
/**
 * Is browser build mirror pair.
 * @param {string} pathA
 * @param {string} pathB
 * @returns {any}
 */
function isBrowserBuildMirrorPair(pathA, pathB) {
  const a = normalizeRelativePath(pathA);
  const b = normalizeRelativePath(pathB);
  const browserRe = /\.browser\.(js|mjs|cjs|ts|tsx)$/i;
  if (!browserRe.test(a) && !browserRe.test(b)) return false;
/**
 * To source.
 * @param {any} p
 * @returns {any}
 */
  const toSource = (p) => p.replace(/\.browser\.(js|mjs|cjs|ts|tsx)$/i, '.$1');
  return toSource(a) === b || toSource(b) === a;
}
/**
 * Is intentional mcp example pair.
 * @param {string} pathA
 * @param {string} pathB
 * @returns {any}
 */
function isIntentionalMcpExamplePair(pathA, pathB) {
  const a = normalizeRelativePath(pathA);
  const b = normalizeRelativePath(pathB);
/**
 * Is mcp config.
 * @param {any} p
 * @returns {any}
 */
  const isMcpConfig = (p) => p.endsWith('mcp.json') || /\/examples\/mcp\//.test(p);
  return isMcpConfig(a) && isMcpConfig(b);
}
/**
 * Is consolidation excluded pair.
 * @param {string} pathA
 * @param {string} pathB
 * @returns {any}
 */
function isConsolidationExcludedPair(pathA, pathB) {
  if (isEphemeralConsolidationPath(pathA) || isEphemeralConsolidationPath(pathB)) return true;
  if (isMonorepoPlatformAliasPair(pathA, pathB)) return true;
  if (isBrowserBuildMirrorPair(pathA, pathB)) return true;
  if (isIntentionalMcpExamplePair(pathA, pathB)) return true;
  return false;
}

/**
 * SimpleBeacon proxy re-exports.
 * Centralizes all cross-repo imports from packages/simplebeacon-cli so
 * consumers use a stable local path. If packages/ moves, only this file
 * needs to change.
 */

// --- lib/ ---

// --- top-level / src/ ---

// --- index / reporters / assessment (deep relative paths) ---

/**
 * Sync jest baseline fallback.
 * @param {string} baseDir
 * @param {Object} options
 * @returns {any}
 */
async function syncJestBaselineFallback(baseDir, options = {}) {
  const { syncJestBaseline } = require('../../../packages/simplebeacon-cli/src/baseline-sync.js');
  return syncJestBaseline(baseDir, options);
}

module.exports = {
  // lib/
  countRepositoryInventory,
  applyPublicGateToAnalyzeResponse,
  sanitizePublicOutput,
  sanitizeScanReport,
  sanitizeCompleteScanExport,
  sanitizeComplianceChecklistArtifactExport,
  sanitizeFictionDigestExport,
  sanitizeDataCleanupReportExport,
  sanitizeNpmAuditExport,
  sanitizePublicSummaryArtifactExport,
  buildReAttestationNoteArtifact,
  sanitizeRoadmapExport,
  sanitizeSimplebeaconReportExport,
  sanitizeCleanupBriefExport,
  sanitizeCodebaseReportExport,
  sanitizeConsolidationExport,
  redactProjectPathForExport,
  projectLabelFromPath,
  collectIssues,
  resolveSeverityCounts,
  buildDetailedFindings,
  buildComplianceTable,
  buildHowToFixSection,
  buildPersonalizedActionPlan,
  formatRule,
  defaultRemediation,
  // src/
  validateConfig,
  PROFILE_RULES,
  DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
  DEFAULT_CONFIG,
  buildFictionPatternCatalog,
  countFictionIssues,
  evaluateEuExportEligibility,
  evaluateSprintFreshness,
  DEFAULT_MAX_STALE_MS,
  isLegalReviewAttestation,
  // deep paths
  runScan,
  runFileReductionScan,
  resolveMockDataScanPaths,
  evaluateGate,
  loadSimplebeaconConfig,
  resolvePlatformRoot: resolvePlatformRootFromIndex,
  formatJsonReport,
  buildAssessmentReport,
  buildAuditPayload,
  initSimplebeacon,
  evaluateComplianceChecklist,
  detectProjectProfile,
  // consolidation / benchmark helpers
  isExternalBenchmarkCachePath,
  isConsolidationExcludedPair,
  consolidationCandidateTouchesExcluded,
  countIntentionalPairExclusions,
  // scan-progress helpers
  resolveScanProgressPath,
  readScanProgress,
  // license token
  verifyLicenseToken,
  // compliance export
  sanitizeComplianceBundleExport,
  // baseline sync stub (not in CLI index)
  syncMeasuredBaseline: syncJestBaselineFallback,
  // data-cleanup report stubs (not exported by CLI index)
  enrichCleanupReport(report) { return report; },
  compactDataCleanupReportForClient(report) { return report; }
};
