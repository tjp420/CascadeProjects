// simplebeacon-ignore workspace-health
'use strict';

/**
 * SimpleBeacon proxy re-exports.
 * Centralizes all cross-repo imports from packages/simplebeacon-cli so
 * consumers use a stable local path. If packages/ moves, only this file
 * needs to change.
 *
 * All exports are validated at startup: any undefined export throws
 * immediately so missing imports surface as loud failures instead of
 * silent undefined values in consumers.
 */

// --- Bulk import from CLI package root (re-exports everything) ---
const cli = require('../../../packages/simplebeacon-cli/src/index.js');

const {
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
  formatTextReport,
  formatActionPlanReport,
  compileAuditReportMarkdown,
  generateFileReductionReport,
  aggregateCleanupFindings,
  formatReportDate,
  capitalize,
  pluralize,
  truncate,
  formatGithubComment,
  formatGithubStepSummary,
  postGithubComment,
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
  runScan,
  runFileReductionScan,
  evaluateGate,
  evaluateComplianceChecklist,
  loadSimplebeaconConfig,
  formatJsonReport,
  buildAssessmentReport,
  initSimplebeacon,
  detectProjectProfile,
  resolvePlatformRoot
} = cli;

// --- Deep-path imports for modules not re-exported by CLI index ---
const { syncJestBaseline } = require('../../../packages/simplebeacon-cli/src/baseline-sync.js');
const { isExternalBenchmarkCachePath } = require('../../../packages/simplebeacon-cli/src/lib/benchmark-cache-paths.js');
const { resolveScanProgressPath, readScanProgress } = require('../../../packages/simplebeacon-cli/src/lib/scan-progress.js');
const { verifyLicenseToken } = require('../../../packages/simplebeacon-cli/src/lib/license-token.js');
const { sanitizeComplianceBundleExport } = require('../../../packages/simplebeacon-cli/src/lib/compliance-export-sanitize.js');
const { consolidationCandidateTouchesExcluded, countIntentionalPairExclusions, isConsolidationExcludedPair } = require('../../../packages/simplebeacon-cli/src/lib/consolidation-path-exclusions.js');
const { buildAuditPayload, buildDashboardPayload, buildScanResults, findHistoryEntry } = require('../../../packages/simplebeacon-cli/src/lib/dashboard-payload.js');
const { generateLicenseToken } = require('../../../packages/simplebeacon-cli/src/lib/license-token.js');
const { isPaidTier, getTierCapability } = require('../../../packages/simplebeacon-cli/src/lib/tier-constants');
const { ERROR_TYPE_CODES, SEVERITY_BANDS } = require('../../../packages/simplebeacon-cli/src/lib/anonymized-export.js');
const { RULE_CATALOG, LEAK_PATTERNS } = require('../../../packages/simplebeacon-cli/src/mcp/rule-catalog.js');

/**
 * Passthrough to the CLI syncJestBaseline function.
 * @param {string} baseDir
 * @param {Object} [options={}]
 * @returns {any}
 */
function syncMeasuredBaseline(baseDir, options) {
  if (typeof baseDir !== 'string' || !baseDir) {
    throw new TypeError('baseDir must be a non-empty string');
  }
  const safeOptions = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
  if (typeof syncJestBaseline !== 'function') {
    throw new Error('baseline-sync module does not export syncJestBaseline function');
  }
  return syncJestBaseline(baseDir, safeOptions);
}

const { enrichCleanupReport, compactDataCleanupReportForClient } = require('../../../packages/simplebeacon-cli/src/lib/enrich-cleanup-report.js');

const proxyExports = {
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
  // scan / gate
  runScan,
  runFileReductionScan,
  evaluateGate,
  evaluateComplianceChecklist,
  loadSimplebeaconConfig,
  resolvePlatformRoot,
  // reporters
  formatTextReport,
  formatActionPlanReport,
  formatJsonReport,
  formatGithubComment,
  formatGithubStepSummary,
  postGithubComment,
  buildAssessmentReport,
  compileAuditReportMarkdown,
  generateFileReductionReport,
  aggregateCleanupFindings,
  formatReportDate,
  capitalize,
  pluralize,
  truncate,
  // init / detection
  buildAuditPayload,
  initSimplebeacon,
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
  generateLicenseToken,
  // compliance export
  sanitizeComplianceBundleExport,
  // baseline sync stub (not in CLI index)
  syncMeasuredBaseline,
  // data-cleanup report stubs (not exported by CLI index)
  enrichCleanupReport,
  compactDataCleanupReportForClient,
  // dashboard payload
  buildDashboardPayload,
  buildScanResults,
  findHistoryEntry,
  // tier constants
  isPaidTier,
  getTierCapability,
  // anonymized export
  ERROR_TYPE_CODES,
  SEVERITY_BANDS,
  // rule catalog
  RULE_CATALOG,
  LEAK_PATTERNS
};

for (const [key, value] of Object.entries(proxyExports)) {
  if (value === undefined) {
    throw new ReferenceError(`simplebeacon-proxy.cjs: export "${key}" is undefined (missing import or typo)`);
  }
}

module.exports = Object.freeze(proxyExports);
