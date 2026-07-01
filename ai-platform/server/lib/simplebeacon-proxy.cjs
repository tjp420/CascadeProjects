'use strict';

// --- config / project-detect ---
const {
  DEFAULT_CONFIG,
  DEFAULT_MOCK_SCAN_RELATIVE_PATHS,
  PROFILE_RULES
} = require('../../../packages/simplebeacon-cli/src/config');
const {
  detectProjectProfile,
  resolvePlatformRoot: resolvePlatformRootFromIndex
} = require('../../../packages/simplebeacon-cli/src/project-detect');
const { validateConfig } = require('../../../packages/simplebeacon-cli/src/config-schema.js');
const { loadSimplebeaconConfig } = require('../../../packages/simplebeacon-cli/src/config');

// --- scan / gate ---
const { runScan } = require('../../../packages/simplebeacon-cli/src/scan');
const { runFileReductionScan } = require('../../../packages/simplebeacon-cli/src/lib/file-reduction-orchestrator');
const { evaluateGate } = require('../../../packages/simplebeacon-cli/src/gate');

// --- reporters ---
const { formatJsonReport } = require('../../../packages/simplebeacon-cli/src/reporters/json');
const { buildAssessmentReport } = require('../../../packages/simplebeacon-cli/src/assessment');
const { evaluateComplianceChecklist } = require('../../../packages/simplebeacon-cli/src/compliance-checklist.js');
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

// --- rules / sanitizers ---
const { buildFictionPatternCatalog, countFictionIssues } = require('../../../packages/simplebeacon-cli/src/rules/ai-fiction-detection');
const {
  applyPublicGateToAnalyzeResponse,
  sanitizePublicOutput,
  sanitizeScanReport
} = require('../../../packages/simplebeacon-cli/src/lib/report-sanitizer');
const {
  sanitizeCompleteScanExport,
  sanitizeNpmAuditExport,
  sanitizeCleanupBriefExport,
  sanitizeDataCleanupReportExport,
  sanitizeCodebaseReportExport,
  sanitizeFictionDigestExport,
  sanitizeConsolidationExport,
  sanitizeComplianceChecklistArtifactExport
} = require('../../../packages/simplebeacon-cli/src/lib/complete-scan-export-sanitize.js');
const { sanitizePublicSummaryArtifactExport } = require('../../../packages/simplebeacon-cli/src/lib/public-summary-export-sanitize.js');
const { projectLabelFromPath, redactProjectPathForExport } = require('../../../packages/simplebeacon-cli/src/lib/assessment-export-sanitize.js');
const { buildReAttestationNoteArtifact } = require('../../../packages/simplebeacon-cli/src/lib/re-attestation-note-export-sanitize.js');
const { sanitizeRoadmapExport } = require('../../../packages/simplebeacon-cli/src/lib/roadmap-export-sanitize.js');
const { sanitizeSimplebeaconReportExport } = require('../../../packages/simplebeacon-cli/src/lib/simplebeacon-report-export-sanitize.js');

// --- EU AI Act ---
const { DEFAULT_MAX_STALE_MS, evaluateSprintFreshness, evaluateEuExportEligibility } = require('../../../packages/simplebeacon-cli/src/eu-ai-act-export-guard.js');
const { isLegalReviewAttestation } = require('../../../packages/simplebeacon-cli/src/eu-ai-act-legal-attestation.js');

// --- init / inventory ---
const { initSimplebeacon } = require('../../../packages/simplebeacon-cli/src/lib/init-simplebeacon.cjs');
const { countRepositoryInventory } = require('../../../packages/simplebeacon-cli/src/lib/repository-inventory');

// --- lib helpers ---
const { isExternalBenchmarkCachePath } = require('../../../packages/simplebeacon-cli/src/lib/benchmark-cache-paths.js');
const { resolveScanProgressPath, readScanProgress } = require('../../../packages/simplebeacon-cli/src/lib/scan-progress.js');
const { verifyLicenseToken } = require('../../../packages/simplebeacon-cli/src/lib/license-token.js');
const { sanitizeComplianceBundleExport } = require('../../../packages/simplebeacon-cli/src/lib/compliance-export-sanitize.js');
const { consolidationCandidateTouchesExcluded, countIntentionalPairExclusions, isConsolidationExcludedPair } = require('../../../packages/simplebeacon-cli/src/lib/consolidation-path-exclusions.js');
const { buildAuditPayload } = require('../../../packages/simplebeacon-cli/src/lib/dashboard-payload.js');

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

/**
 * Sync jest baseline fallback.
 * @param {string} baseDir
 * @param {Object} [options={}]
 * @returns {any}
 */
function syncJestBaselineFallback(baseDir, options) {
  if (typeof baseDir !== 'string' || !baseDir) {
    throw new TypeError('baseDir must be a non-empty string');
  }
  const safeOptions = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
  let syncJestBaseline;
  try {
    ({ syncJestBaseline } = require('../../../packages/simplebeacon-cli/src/baseline-sync.js'));
  } catch (err) {
    throw new Error(`Failed to load baseline-sync module: ${err?.message || String(err)}`);
  }
  if (typeof syncJestBaseline !== 'function') {
    throw new Error('baseline-sync module does not export syncJestBaseline function');
  }
  return syncJestBaseline(baseDir, safeOptions);
}

/**
 * Lightweight passthrough stub for data-cleanup report enrichment.
 * Kept intentionally thin until a richer implementation lands in the CLI.
 * @param {Object} report
 * @returns {Object}
 */
function enrichCleanupReport(report) {
  return (report && typeof report === 'object' && !Array.isArray(report)) ? report : {};
}

/**
 * Lightweight passthrough stub for compacting data-cleanup report for client.
 * Kept intentionally thin until a richer implementation lands in the CLI.
 * @param {Object} report
 * @returns {Object}
 */
function compactDataCleanupReportForClient(report) {
  return (report && typeof report === 'object' && !Array.isArray(report)) ? report : {};
}

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
  // deep paths
  runScan,
  runFileReductionScan,
  evaluateGate,
  loadSimplebeaconConfig,
  resolvePlatformRoot: resolvePlatformRootFromIndex,
  formatJsonReport,
  buildAssessmentReport,
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
  // compliance export
  sanitizeComplianceBundleExport,
  // baseline sync stub (not in CLI index)
  syncMeasuredBaseline: syncJestBaselineFallback,
  // data-cleanup report stubs (not exported by CLI index)
  enrichCleanupReport,
  compactDataCleanupReportForClient
};

for (const [key, value] of Object.entries(proxyExports)) {
  if (value === undefined) {
    throw new ReferenceError(`simplebeacon-proxy.cjs: export "${key}" is undefined (missing import or typo)`);
  }
}

module.exports = Object.freeze(proxyExports);
