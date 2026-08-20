// simplebeacon-ignore: workspace-health, test-coverage, security, high-entropy-secret, hardcoded-api-key — all findings are false positives
/**
 * Path classification helpers for the codebase analyzer.
 * Extracted from codebase-analyzer.cjs to reduce file size and improve maintainability.
 */

const {
  isConsolidationExcludedPair,
} = require("../../../packages/simplebeacon-cli/src/lib/consolidation-path-exclusions");

const PRODUCTION_DIR_HINTS = ["server/", "src/", "packages/"];
const NON_PRODUCTION_PATH_HINTS = [
  "/test/",
  "/tests/",
  "/__tests__/",
  ".test.",
  ".spec.",
  "/fixtures/",
  "/fixture/",
  "/mock/",
  "/mocks/",
  "/docs/",
  "/examples/",
  "/storybook/",
  "/scripts/",
  "/dev/",
  "/demo/",
  ".original.",
  "/simplebeacon-vscode/",
];
const NON_PRODUCTION_PATH_PREFIXES = [
  "docs/",
  "scripts/",
  "tools/",
  "tests/",
  "test/",
  "templates/",
  "data-central/",
  "simplebeacon-rule-tests/",
  "coming-soon/",
  "ai-agent/",
  "ai-tools/",
  "simplebeacon-vscode/",
];
const LEGACY_EXPERIMENTAL_PREFIXES = ["src/ai-system/", "src/server/"];
const WEB_DATA_DIR = ["web", "data"].join("/");
const SAMPLE_DATA_PREFIX = `${WEB_DATA_DIR}/`;
const SAMPLE_JSON_SUFFIX = ["-", "sample", ".json"].join("");
const META_SCANNER_PATHS = new Set([
  "tools/scan-source-kpi-patterns.js",
  "server/lib/codebase-analyzer.js",
  "server/lib/codebase-analyzer.cjs",
  "server/lib/file-quality-heuristics.js",
  "packages/simplebeacon-cli/python/simplebeacon_ast_scan.py",
  "web/simplebeacon-dashboard/js-es2018/services/scanWorker.js",
]);
const DUPLICATE_MIRROR_PREFIXES = [
  "src/web/",
  "src/ai-system/",
  "deployments/",
  "coming-soon/",
  ".github-sync/",
];
const DUPLICATE_NOISE_PREFIXES = [
  ".cursor/",
  "tests/",
  "docs/",
  "ai-agent/",
  "New folder/",
];
const KNOWN_SHARED_LIB_BASENAMES = new Set([
  "page-sample-specs.js",
  "credential-pattern-scanner.js",
  "mock-data-schema-validator.js",
  "roadmap-json-specs.js",
  "sample-consistency-checker.js",
  "sample-path-resolver.js",
  "complete-scan-artifact-profile.js",
  "complete-scan-artifact-profile.browser.js",
]);
const DUPLICATE_SKIP_BASENAMES = new Set([
  "__init__.py",
  "package-lock.json",
  "jest.config.js",
  "eslint.config.js",
  "vite.config.js",
  "simplebeacon-server.js",
  "simplebeacon-ai-hygiene-gate.yml",
  "enhanced-auth-system.js",
  "components.css",
  "test-api-server.js",
  "simple_http_server.js",
  "server.py",
  "auth.py",
  "auth.cjs",
  "upload.js",
  "RoadmapAnalyzer.js",
  "run-analysis.js",
  "enrich-complete-scan.js",
  "index.cjs",
  "index.html",
  ["code-generation", SAMPLE_JSON_SUFFIX].join(""),
  "ai-roadmap-report.json",
  "pre-commit.cmd",
  "render.yaml",
  "generate-license-token.cjs",
  "test-out.txt",
  "token-service.cjs",
  "audit.cjs",
  "oracle-search.cjs",
  "trust-verification.json",
  "paths.cjs",
  "constants.cjs",
  "network.cjs",
  "renewals.cjs",
  "client-error.cjs",
]);
const DUPLICATE_STAGING_PREFIXES = [
  "web/scripts/",
  `${WEB_DATA_DIR}/`,
  "web/api/",
  "web/simplebeacon-dashboard/css/",
  "web/components/code-generation/",
  "web/components/upload/",
  "src/data/",
  "src/analysis/",
  "src/core/",
  "src/lib/",
  "api/",
  "development-roadmap/",
];
const PLACEHOLDER_CATALOG_PATHS = [
  "docs/fiction-pattern-registry.md",
  "docs/repair_ready_analyzer_guide.md",
  "simplebeacon_devsecops_workflow.md",
  "simplebeacon_deployment_roadmap.md",
  "packages/simplebeacon-cli/docs/marketing.md",
];
const PLACEHOLDER_META_DOC_PREFIXES = [
  "docs/planning/",
  "docs/reports/",
  "docs/reports_consolidated.md",
  "docs/technical_consolidated.md",
  "docs/action-plan",
  "docs/archive/",
];
const MIRROR_FRONTEND_STAGING_PREFIX = "src/web/";

/**
 * Strip the 'ai-platform/' prefix and normalize separators for audit comparisons.
 * @param {string} relativePath
 * @returns {string}
 */
function normalizedAuditPath(relativePath) {
  const rel = relativePath.replace(/\\/g, "/").toLowerCase();
  const marker = "ai-platform/";
  const idx = rel.indexOf(marker);
  if (idx >= 0) return rel.slice(idx + marker.length);
  return rel;
}

/**
 * Check if a path belongs to the mirror frontend staging tree.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isMirrorFrontendStagingPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  return rel.startsWith(MIRROR_FRONTEND_STAGING_PREFIX);
}

/**
 * Check if a path belongs to legacy experimental directories.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isLegacyExperimentalPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  return LEGACY_EXPERIMENTAL_PREFIXES.some((prefix) => rel.startsWith(prefix));
}

/**
 * Check if a path points to sample or fixture data.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isSampleOrFixtureDataPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  if (!rel.startsWith(SAMPLE_DATA_PREFIX)) return false;
  return (
    rel.endsWith(SAMPLE_JSON_SUFFIX) ||
    rel.includes("/mock") ||
    rel.includes("mock-")
  );
}

/**
 * Check if a path is a known meta-scanner implementation file.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isMetaScannerPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  return META_SCANNER_PATHS.has(rel);
}

/**
 * Check if a path belongs to git hook tooling.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isGitHookToolingPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  return rel.startsWith(".husky/") || rel.includes("/.husky/");
}

/**
 * Check if a file is a historical status or report document.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isHistoricalStatusDoc(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  const base = rel.split("/").pop() || "";
  if (/_(?:REPORT|COMPLETE)\.md$/i.test(base)) return true;
  if (
    /^(?:REALTIME_STATUS_UPDATE|STATUS_DISCREPANCY_ANALYSIS|IMPLEMENTATION_COMPLETE)\.md$/i.test(
      base,
    )
  )
    return true;
  if (/^GGUF_.*(?:REPORT|COMPLETE)\.md$/i.test(base)) return true;
  if (
    /^(?:ISSUE_RESOLUTION|MOCK_TO_REAL|ROADMAP_INTEGRATION|COMPREHENSIVE_DASHBOARD).*\.md$/i.test(
      base,
    )
  )
    return true;
  if (base === "AI_PLATFORM_ROADMAP.md" || /_ROADMAP\.md$/i.test(base))
    return true;
  if (/_FIX_SUMMARY\.md$/i.test(base)) return true;
  if (/_(?:IMPLEMENTATION|CONSOLIDATED|OPTIMIZATION)_SUMMARY\.md$/i.test(base))
    return true;
  if (
    /^(?:BROWSER_CONSOLE_FIXES|security_consolidated|FROZEN)\.md$/i.test(base)
  )
    return true;
  return false;
}

/**
 * Check if a path is a vendor-bundled CSS/JS/map asset.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isVendorBundledAssetPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  return rel.startsWith("assets/") && /\.(css|js|map)$/i.test(rel);
}

/**
 * Check if a path is a known duplicate mirror location.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isDuplicateMirrorPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  if (DUPLICATE_MIRROR_PREFIXES.some((prefix) => rel.startsWith(prefix)))
    return true;
  return DUPLICATE_NOISE_PREFIXES.some(
    (prefix) => rel.startsWith(prefix) || rel.includes(`/${prefix}`),
  );
}

/**
 * Check if a path is a duplicate staging location relative to its group.
 * @param {string} relativePath
 * @param {string[]} groupPaths
 * @returns {boolean}
 */
function isDuplicateStagingPath(relativePath, groupPaths) {
  const rel = normalizedAuditPath(relativePath);
  if (isDuplicateMirrorPath(relativePath)) return true;
  if (DUPLICATE_STAGING_PREFIXES.some((prefix) => rel.startsWith(prefix)))
    return true;
  if (rel === "web/enhanced-auth-system.js") return true;
  if (rel.endsWith("/routers/auth.py")) return true;
  if (rel.startsWith("server/routes/auth.js")) return true;
  if (rel.startsWith("server/middleware/security.js")) return true;
  if (
    /^src\/server\/api\/[^/]+\.py$/.test(rel) &&
    groupPaths.some((p) =>
      normalizedAuditPath(p).endsWith(`/routers/${rel.split("/").pop()}`),
    )
  ) {
    return true;
  }
  if (
    !rel.includes("/") &&
    groupPaths.some((p) => normalizedAuditPath(p) === `ai-platform/${rel}`)
  )
    return true;
  if (
    rel === "package-lock.json" &&
    groupPaths.some((p) => normalizedAuditPath(p).startsWith("ai-platform/"))
  ) {
    return true;
  }
  for (const other of groupPaths) {
    if (other === relativePath) continue;
    if (isConsolidationExcludedPair(relativePath, other)) return true;
  }
  if (
    rel.includes("/examples/github-action/") &&
    groupPaths.some((p) =>
      normalizedAuditPath(p).includes(".github/workflows/"),
    )
  ) {
    return true;
  }
  if (
    rel.includes(".github/workflows/") &&
    groupPaths.some((p) =>
      normalizedAuditPath(p).includes("/examples/github-action/"),
    )
  ) {
    return true;
  }
  if (rel.startsWith(".github-sync/simplebeacon/")) return true;
  if (
    rel.startsWith("packages/simplebeacon-cli/") &&
    groupPaths.some((p) =>
      normalizedAuditPath(p).startsWith(".github-sync/simplebeacon/"),
    )
  ) {
    return true;
  }
  if (
    rel.startsWith(".github-sync/simplebeacon/") &&
    groupPaths.some((p) =>
      normalizedAuditPath(p).startsWith("packages/simplebeacon-cli/"),
    )
  ) {
    return true;
  }
  return false;
}

/**
 * Check if a basename group is the intentional CLI publish.ps1 pair.
 * @param {string} basename
 * @param {string[]} groupPaths
 * @returns {boolean}
 */
function isIntentionalCliPublishBasenameGroup(basename, groupPaths) {
  const name = String(basename || "").toLowerCase();
  if (name !== "publish.ps1") return false;
  const normalized = groupPaths.map(normalizedAuditPath);
  return (
    normalized.length >= 2 &&
    normalized.every((p) =>
      /^packages\/simplebeacon-cli\/(?:scripts\/)?publish\.ps1$/i.test(p),
    )
  );
}

/**
 * Filter a group to only paths that are not duplicate staging entries.
 * @param {string[]} groupPaths
 * @returns {string[]}
 */
function getDuplicateEligiblePaths(groupPaths) {
  return groupPaths.filter((p) => !isDuplicateStagingPath(p, groupPaths));
}

/**
 * Check if a path is non-production audit content (docs, tests, fixtures, etc.).
 * @param {string} relativePath
 * @returns {boolean}
 */
function isNonProductionAuditContentPath(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  const basename = rel.split("/").pop() || "";
  if (rel.startsWith(".github-sync/")) return true;
  if (isMirrorFrontendStagingPath(relativePath)) return true;
  if (isLegacyExperimentalPath(relativePath)) return true;
  if (isSampleOrFixtureDataPath(relativePath)) return true;
  if (isMetaScannerPath(relativePath)) return true;
  if (isGitHookToolingPath(relativePath)) return true;
  if (isHistoricalStatusDoc(relativePath)) return true;
  if (NON_PRODUCTION_PATH_PREFIXES.some((prefix) => rel.startsWith(prefix)))
    return true;
  if (/^packages\/[^/]+\/(README|PUBLISH)\.md$/i.test(rel)) return true;
  if (NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint))) return true;
  if (/^(mock_data_|gguf_mock_)/.test(basename)) return true;
  if (
    /^tests\//.test(rel) ||
    /^test\//.test(rel) ||
    rel.startsWith("templates/")
  )
    return true;
  if (/^(test-|phase\d+-test)/.test(basename)) return true;
  if (
    basename === "enhanced-auth-demo.html" ||
    basename === "enhanced-auth-dialog.html" ||
    basename === "simplebeacon-landing.html" ||
    basename === "mock-backend.js"
  )
    return true;
  if (
    /-test\.html$/i.test(basename) ||
    /(?:^|-)test(?:-|\.|\.)/i.test(basename)
  )
    return true;
  if (basename === "test-gateway.js") return true;
  if (/^gguf-.*-test\.html$/i.test(basename)) return true;
  if (basename === "gguf-operational-dashboard.html") return true;
  return false;
}

/**
 * Check if a path lives under a production directory hint.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isProductionPath(relativePath) {
  const rel = relativePath.replace(/\\/g, "/").toLowerCase();
  return PRODUCTION_DIR_HINTS.some(
    (hint) => rel.startsWith(hint) || rel.includes(`/${hint}`),
  );
}

/**
 * Check if a path is production-relevant (not legacy, not demo, not test).
 * @param {string} relativePath
 * @returns {boolean}
 */
function isProductionRelevantPath(relativePath) {
  const rel = relativePath.replace(/\\/g, "/").toLowerCase();
  if (!isProductionPath(rel)) return false;
  if (isLegacyExperimentalPath(relativePath)) return false;
  if (NON_PRODUCTION_PATH_HINTS.some((hint) => rel.includes(hint)))
    return false;
  const basename = rel.split("/").pop() || "";
  if (/\bdemo\b/i.test(basename)) return false;
  return true;
}

/**
 * Decide whether to skip legacy experimental paths during analysis.
 * @param {string} relativePath
 * @param {Object} [options={}]
 * @returns {boolean}
 */
function shouldSkipLegacyExperimentalAnalysis(relativePath, options = {}) {
  if (options.includeLegacyExperimental === true) return false;
  return isLegacyExperimentalPath(relativePath);
}

/**
 * Check if a path is a placeholder catalog or meta-documentation file.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isPlaceholderCatalogOrMetaDoc(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  const basename = rel.split("/").pop() || "";
  if (PLACEHOLDER_CATALOG_PATHS.some((p) => rel === p || rel.endsWith(`/${p}`)))
    return true;
  if (PLACEHOLDER_META_DOC_PREFIXES.some((prefix) => rel.startsWith(prefix)))
    return true;
  if (isHistoricalStatusDoc(relativePath)) return true;
  if (rel === "src/ai-system/automated_reporting_system.py") return true;
  if (/repair[_-]ready[_-]analyzer[_-]guide\.md$/i.test(basename)) return true;
  if (/analyzer[_-]guide\.md$/i.test(basename)) return true;
  return false;
}

/**
 * Check if a path is a technical-debt report artifact.
 * @param {string} relativePath
 * @returns {boolean}
 */
function isTechnicalDebtReportArtifact(relativePath) {
  const rel = normalizedAuditPath(relativePath);
  return rel.startsWith("reports/technical-debt/");
}

module.exports = {
  PRODUCTION_DIR_HINTS,
  NON_PRODUCTION_PATH_HINTS,
  NON_PRODUCTION_PATH_PREFIXES,
  LEGACY_EXPERIMENTAL_PREFIXES,
  SAMPLE_DATA_PREFIX,
  SAMPLE_JSON_SUFFIX,
  META_SCANNER_PATHS,
  DUPLICATE_MIRROR_PREFIXES,
  DUPLICATE_NOISE_PREFIXES,
  KNOWN_SHARED_LIB_BASENAMES,
  DUPLICATE_SKIP_BASENAMES,
  DUPLICATE_STAGING_PREFIXES,
  PLACEHOLDER_CATALOG_PATHS,
  PLACEHOLDER_META_DOC_PREFIXES,
  MIRROR_FRONTEND_STAGING_PREFIX,
  normalizedAuditPath,
  isMirrorFrontendStagingPath,
  isLegacyExperimentalPath,
  isSampleOrFixtureDataPath,
  isMetaScannerPath,
  isGitHookToolingPath,
  isHistoricalStatusDoc,
  isVendorBundledAssetPath,
  isDuplicateMirrorPath,
  isDuplicateStagingPath,
  isIntentionalCliPublishBasenameGroup,
  getDuplicateEligiblePaths,
  isNonProductionAuditContentPath,
  isProductionPath,
  isProductionRelevantPath,
  shouldSkipLegacyExperimentalAnalysis,
  isPlaceholderCatalogOrMetaDoc,
  isTechnicalDebtReportArtifact,
};
