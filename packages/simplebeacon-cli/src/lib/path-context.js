/**
 * Classify a file path as production vs quality (test/fixture/mock) so
 * gate dashboards can hide unpaid test-debt noise without dropping it.
 * File roles also drive the contact-grade filter: docs, lockfiles, and
 * vendor bundles must never look like production HIGH findings.
 */

const QUALITY_DIR =
  /(^|\/)(__tests__|tests?|spec|specs|fixtures?|mocks?|testdata|test-data|molecule|testinfra|e2e|e2e-[^/]+|cypress|playwright|stories|storybook|__mocks__)(\/|$)/i;

const QUALITY_FILE =
  /\.(test|spec|stories)\.[a-z0-9]+$/i;

const GO_LIKE_TEST_FILE = /_test\.(go|rs)$/i;

const QUALITY_NAME =
  /(^|\/)(conftest|loaddata|factory|factories)(\.[a-z0-9]+)?$/i;

const VENDOR_DIR =
  /(^|\/)(node_modules|vendor|third_party|third-party|\.venv|dist|build|coverage|\.next|\.nuxt)(\/|$)/i;

const DOCS_DIR = /(^|\/)(docs?|documentation|examples?|samples?|demo)(\/|$)/i;

const HTTP_SURFACE_DIR =
  /(^|\/)(routes?|controllers?|handlers?|endpoints?|middleware|pages\/api|app\/api|server|socket|websockets?)(\/|$)/i;

const PRODUCTION_DIR =
  /(^|\/)(src|app|server|api|backend|services|packages|lib|internal)(\/|$)/i;

const I18N_DIR = /(^|\/)(i18n|locales?|translations?|lang|options\/locale)(\/|$)/i;

const INTERNAL_TOOLING =
  /(security-pattern-scanner|weak-crypto-scanner|scanner-patterns|findingConverter|remediationProvider|enhancedAIProvider|realtimeMonitor|workspaceAnalyzer)\.(js|ts|mjs|cjs)$/i;

const ROOT_DOC_NAMES =
  /^(CODE_OF_CONDUCT|CHANGELOG|CONTRIBUTING|LICENSE|LICENCE|README|SECURITY|AUTHORS|NOTICE|COPYING|PATENTS|GOVERNANCE)(\.[a-z0-9]+)?$/i;

const LOCKFILE_NAMES =
  /^(package-lock\.json|npm-shrinkwrap\.json|yarn\.lock|pnpm-lock\.yaml|Cargo\.lock|composer\.lock|poetry\.lock|Gemfile\.lock|go\.sum)$/i;

const SOURCE_EXT =
  /\.(cjs|mjs|js|jsx|ts|tsx|py|go|rs|java|kt|rb|php|cs|swift|scala|c|cc|cpp|h|hpp)$/i;

function basename(rel) {
  const parts = String(rel || "").split("/");
  return parts[parts.length - 1] || "";
}

function result(fileRole, lane, reachabilityHint, reason, className, internalTooling) {
  return {
    class: className || fileRole,
    fileRole,
    lane,
    reachabilityHint,
    reason,
    internalTooling,
  };
}

/**
 * @param {string} filePath
 * @returns {{
 *   class: string,
 *   fileRole: string,
 *   lane: 'production'|'quality',
 *   reachabilityHint: 'http-surface-path'|'unknown'|'non-runtime',
 *   reason: string,
 *   internalTooling: boolean
 * }}
 */
function classifyPath(filePath) {
  const rel = String(filePath || "").replace(/\\/g, "/");
  const name = basename(rel);
  const internalTooling = INTERNAL_TOOLING.test(rel);

  if (VENDOR_DIR.test(rel)) {
    return result(
      "vendor",
      "quality",
      "non-runtime",
      "Vendor or generated directory",
      "vendor",
      internalTooling,
    );
  }
  if (
    /\.min\.(js|css)$/i.test(name) ||
    /swagger-ui/i.test(name) ||
    /(^|\/)(static|assets|public)\/.+vendor/i.test(rel)
  ) {
    return result(
      "vendor",
      "quality",
      "non-runtime",
      "Minified or vendored frontend bundle",
      "vendor",
      internalTooling,
    );
  }
  if (LOCKFILE_NAMES.test(name)) {
    return result(
      "generated",
      "quality",
      "non-runtime",
      "Dependency lockfile",
      "generated",
      internalTooling,
    );
  }
  if (
    QUALITY_DIR.test(rel) ||
    QUALITY_FILE.test(rel) ||
    GO_LIKE_TEST_FILE.test(name) ||
    QUALITY_NAME.test(rel)
  ) {
    return result(
      "test",
      "quality",
      "non-runtime",
      "Test, mock, fixture, or molecule path",
      "test",
      internalTooling,
    );
  }
  if (
    DOCS_DIR.test(rel) ||
    ROOT_DOC_NAMES.test(name) ||
    /\.(md|rst|adoc)$/i.test(name)
  ) {
    return result(
      "docs",
      "quality",
      "non-runtime",
      "Documentation or policy file",
      "docs",
      internalTooling,
    );
  }
  if (I18N_DIR.test(rel) && /\.(json|po|mo|ya?ml|xliff)$/i.test(name)) {
    return result(
      "sample",
      "quality",
      "non-runtime",
      "Translation catalog",
      "i18n",
      internalTooling,
    );
  }
  if (HTTP_SURFACE_DIR.test(rel) && SOURCE_EXT.test(name)) {
    return result(
      "app",
      "production",
      "http-surface-path",
      "Path looks like an HTTP or socket entry/handler module",
      "http-surface",
      internalTooling,
    );
  }
  if (PRODUCTION_DIR.test(rel) && SOURCE_EXT.test(name)) {
    return result(
      "app",
      "production",
      "unknown",
      "Production source path",
      "production",
      internalTooling,
    );
  }
  if (SOURCE_EXT.test(name)) {
    return result(
      "app",
      "production",
      "unknown",
      "Source file outside named production directories",
      "production",
      internalTooling,
    );
  }
  if (/\.(ya?ml|toml|ini|cfg|conf|env)$/i.test(name) || /^Dockerfile/i.test(name)) {
    return result(
      "config",
      "production",
      "non-runtime",
      "Configuration or infrastructure file",
      "config",
      internalTooling,
    );
  }
  return result(
    "config",
    "quality",
    "non-runtime",
    "Non-source file — not treated as production application code",
    "other",
    internalTooling,
  );
}

function isQualityPath(filePath) {
  return classifyPath(filePath).lane === "quality";
}

module.exports = {
  classifyPath,
  isQualityPath,
};
