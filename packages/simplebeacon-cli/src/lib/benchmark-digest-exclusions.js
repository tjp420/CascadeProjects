/**
 * Benchmark gate issue exclusions for fiction-digest and gate exports.
 */

const SCANNER_IMPL_PATH_RE =
  /(?:^|\/)packages\/simplebeacon-cli\/src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)|(?:^|\/)src\/(?:rules|reporters|analyzers|lib|proxy|mcp)(?:\/|$)/;
const OSS_SCANNER_ROOT_FILES = new Set([
  "src/scan.js",
  "src/config.js",
  "src/project-detect.js",
  "src/index.js",
]);

const SUPPRESSED_PRODUCTION_LEAK_INTENTS = new Set([
  "scanner-meta",
  "repository-audit-loader",
  "repository-audit-stub-loader",
  "config-metadata",
  "demo-tool-sample",
]);

function normalizeRel(filePath) {
  return String(filePath || "").replace(/\\/g, "/");
}

function isScannerImplementationPath(relativePath) {
  const rel = normalizeRel(relativePath);
  if (SCANNER_IMPL_PATH_RE.test(rel.toLowerCase())) return true;
  if (OSS_SCANNER_ROOT_FILES.has(rel)) return true;
  return false;
}

function isBenchmarkCloneNoiseIssue(issue) {
  if (!issue) return false;
  const pattern = String(issue.pattern || issue.metadata?.patternId || "");
  const category = String(issue.category || issue.metadata?.category || "");
  const type = String(issue.type || "");
  if (/SB-HANDOFF/i.test(pattern) || category === "handoff-integrity")
    return true;
  if (/EUAI-/i.test(pattern) || /EU AI Act/i.test(type)) return true;
  return false;
}

function isBenchmarkScannerMetaIssue(issue) {
  if (!issue) return false;
  const intent = String(issue.metadata?.intent || issue.intent || "");
  if (intent && SUPPRESSED_PRODUCTION_LEAK_INTENTS.has(intent)) return true;
  if (!/production leak/i.test(String(issue.type || ""))) return false;
  const filePath = issue.filePath || issue.file || issue.filePaths?.[0] || "";
  return filePath ? isScannerImplementationPath(filePath) : false;
}

function isBenchmarkDigestExcludedIssue(issue, benchmarkScan) {
  if (!benchmarkScan || !issue) return false;
  if (isBenchmarkCloneNoiseIssue(issue)) return true;
  return isBenchmarkScannerMetaIssue(issue);
}

module.exports = {
  isScannerImplementationPath,
  isBenchmarkCloneNoiseIssue,
  isBenchmarkScannerMetaIssue,
  isBenchmarkDigestExcludedIssue,
};
