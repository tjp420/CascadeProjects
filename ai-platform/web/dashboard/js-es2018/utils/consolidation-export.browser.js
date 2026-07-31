// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Browser mirror of consolidation-export-sanitize.js — keep in sync.
 */
/**
 * Project label from path.
 * @param {string} projectPath
 * @returns {any}
 */
function projectLabelFromPath(projectPath) {
  const normalized = String(projectPath || 'ai-platform').replace(/\\/g, '/');
  const parts = normalized.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'ai-platform';
}
/**
 * Redact project path for export.
 * @param {string} rawPath
 * @param {any} projectLabel
 * @returns {any}
 */
function redactProjectPathForExport(rawPath, projectLabel = 'ai-platform') {
  if (rawPath == null || rawPath === '') return rawPath;
  const normalized = String(rawPath).replace(/\\/g, '/');
  if (
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith('/Users/') ||
    normalized.startsWith('/home/') ||
    normalized.includes('CascadeProjects')
  ) {
    return projectLabel;
  }
  return normalized;
}
/**
 * Redact consolidation project path.
 * @param {any} value
 * @param {Object} options
 * @returns {any}
 */
function redactConsolidationProjectPath(value, options = {}) {
  if (value == null || value === '') return value;
  const normalized = String(value).replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const githubIdx = lower.indexOf('/github-cache/');
  if (githubIdx >= 0) {
    const suffix = normalized.slice(githubIdx + 1);
    const platformLabel = options.productPlatformLabel || 'ai-platform';
    return `${platformLabel}/${suffix}`;
  }
  const label = options.projectLabel || projectLabelFromPath(normalized);
  return redactProjectPathForExport(normalized, label);
}
/**
 * Apply redacted consolidation paths.
 * @param {any} scan
 * @param {string} projectPath
 * @param {any} productPlatformRoot
 * @returns {any}
 */
function applyRedactedConsolidationPaths(scan, projectPath, productPlatformRoot) {
  const projectLabel = projectLabelFromPath(productPlatformRoot || projectPath || 'ai-platform');
  const pathOptions = { projectLabel, productPlatformLabel: projectLabel };
  /**
   * Redact.
   * @param {any} value
   * @returns {any}
   */
  const redact = (value) => redactConsolidationProjectPath(value, pathOptions);
  return {
    ...scan,
    projectRoot: redact(scan.projectRoot || projectPath),
    scanTargetRoot: redact(scan.scanTargetRoot || projectPath || scan.projectRoot),
    ...(scan.platformRoot ? { platformRoot: redact(scan.platformRoot) } : {}),
    ...(scan.productPlatformRoot ? { productPlatformRoot: redact(scan.productPlatformRoot) } : {}),
    ...(scan.repositoryInventory
      ? {
          repositoryInventory: {
            ...scan.repositoryInventory,
            projectRoot: redact(
              scan.repositoryInventory.projectRoot || scan.projectRoot || projectPath
            ),
          },
        }
      : {}),
  };
}
/**
 * Is benchmark path.
 * @param {string} filePath
 * @returns {any}
 */
function isBenchmarkPath(filePath) {
  const rel = String(filePath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  return rel.includes('/github-cache/') || rel.startsWith('github-cache/');
}
const PRODUCT_PATH_MARKERS = [/^web\/data\b/i, /^data\/roadmap\b/i];
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
  return (
    (a.startsWith(prefix) && b === stripPrefix(a)) || (b.startsWith(prefix) && a === stripPrefix(b))
  );
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
 * Filter fuzzy pairs.
 * @param {Array} pairs
 * @returns {any}
 */
function filterFuzzyPairs(pairs = []) {
  return pairs.filter((pair) => !isConsolidationExcludedPair(pair.fileA, pair.fileB));
}
/**
 * Count excluded fuzzy pairs.
 * @param {Array} pairs
 * @returns {any}
 */
function countExcludedFuzzyPairs(pairs = []) {
  let browserMirrorPairsExcluded = 0;
  let mcpExamplePairsExcluded = 0;
  let monorepoAliasPairsExcluded = 0;
  let ephemeralPathsExcluded = 0;
  let fuzzyPairsExcluded = 0;
  for (const pair of pairs) {
    const pathA = pair === null || pair === void 0 ? void 0 : pair.fileA;
    const pathB = pair === null || pair === void 0 ? void 0 : pair.fileB;
    if (!pathA || !pathB) continue;
    if (!isConsolidationExcludedPair(pathA, pathB)) continue;
    fuzzyPairsExcluded += 1;
    if (isEphemeralConsolidationPath(pathA) || isEphemeralConsolidationPath(pathB)) {
      ephemeralPathsExcluded += 1;
    } else if (isBrowserBuildMirrorPair(pathA, pathB)) {
      browserMirrorPairsExcluded += 1;
    } else if (isIntentionalMcpExamplePair(pathA, pathB)) {
      mcpExamplePairsExcluded += 1;
    } else if (isMonorepoPlatformAliasPair(pathA, pathB)) {
      monorepoAliasPairsExcluded += 1;
    }
  }
  return {
    browserMirrorPairsExcluded,
    mcpExamplePairsExcluded,
    monorepoAliasPairsExcluded,
    ephemeralPathsExcluded,
    fuzzyPairsExcluded,
    intentionalPairsExcluded:
      browserMirrorPairsExcluded +
      mcpExamplePairsExcluded +
      monorepoAliasPairsExcluded +
      ephemeralPathsExcluded,
  };
}
/**
 * Consolidation path touches excluded.
 * @param {string} filePath
 * @returns {any}
 */
function consolidationPathTouchesExcluded(filePath) {
  const rel = String(filePath || '').replace(/\\/g, '/');
  return (
    isEphemeralConsolidationPath(rel) ||
    isBenchmarkPath(rel) ||
    rel.startsWith('deliverables/') ||
    rel.includes('/deliverables/') ||
    rel.startsWith('.github-sync/') ||
    rel.includes('/.github-sync/')
  );
}
/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
  const normalized = String(projectPath || '').replace(/\\/g, '/');
  const idx = normalized.toLowerCase().indexOf('/github-cache/');
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}
/**
 * Resolve consolidation project path.
 * @param {any} scan
 * @param {Object} options
 * @returns {any}
 */
function resolveConsolidationProjectPath(scan, options = {}) {
  var _a;
  const explicit = String(
    options.projectPath ||
      options.scanTargetRoot ||
      options.requestedProjectPath ||
      scan.scanTargetRoot ||
      scan.projectPath ||
      scan.projectRoot ||
      ((_a = scan.repositoryInventory) === null || _a === void 0 ? void 0 : _a.projectRoot) ||
      ''
  ).replace(/\\/g, '/');
  if (isBenchmarkPath(explicit)) return explicit;
  const inferred = inferConsolidationScanTargetFromHints(scan, options);
  return inferred || explicit;
}
/**
 * Infer consolidation scan target from hints.
 * @param {any} scan
 * @param {Object} options
 * @returns {any}
 */
function inferConsolidationScanTargetFromHints(scan, options = {}) {
  var _a;
  const filename = String(options.exportFilename || options.filename || '').toLowerCase();
  if (!filename.includes('github-cache')) return '';
  const slugMatch = filename.match(
    /github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i
  );
  if (!slugMatch) return '';
  const cloneName = slugMatch[1];
  const sourceRoot = String(
    options.projectPath ||
      scan.projectRoot ||
      ((_a = scan.repositoryInventory) === null || _a === void 0 ? void 0 : _a.projectRoot) ||
      ''
  ).replace(/\\/g, '/');
  if (isBenchmarkPath(sourceRoot)) return '';
  const platformRoot =
    resolveProductPlatformRoot(`${sourceRoot.replace(/\/$/, '')}/github-cache/${cloneName}`) ||
    sourceRoot;
  return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}
/**
 * Dedupe export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeExportNotes(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
    const scopeKey = /consolidation export scoped to github-cache/i.test(normalized)
      ? 'benchmark-scope-note'
      : /product sample paths \(web\/data/i.test(normalized)
        ? 'benchmark-sample-path-note'
        : /no actionable merge candidates/i.test(normalized)
          ? 'benchmark-no-merge-note'
          : /measured potential savings are 0b/i.test(normalized)
            ? 'benchmark-zero-savings-note'
            : /re-run consolidation on ai-platform root/i.test(normalized)
              ? 'benchmark-rerun-note'
              : /intentional cjs\/browser mirrors/i.test(normalized)
                ? 'benchmark-intentional-pairs-note'
                : /securityhandoffeligible is false/i.test(normalized)
                  ? 'security-handoff-note'
                  : /gate content-scanned/i.test(normalized)
                    ? 'gate-credential-scope-note'
                    : /json file\(s\) hashed for exact duplicates/i.test(normalized)
                      ? 'json-hash-scope-note'
                      : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(String(note));
  }
  return out.slice(0, 12);
}
/**
 * Resolve intentional pairs excluded count.
 * @param {any} summaryBase
 * @param {Array} pairExclusions
 * @param {number} rawMergeCount
 * @param {number} mergeCandidatesLength
 * @returns {any}
 */
function resolveIntentionalPairsExcludedCount(
  summaryBase,
  pairExclusions,
  rawMergeCount,
  mergeCandidatesLength
) {
  var _a, _b, _c;
  const fromPairs =
    (_a =
      pairExclusions === null || pairExclusions === void 0
        ? void 0
        : pairExclusions.intentionalPairsExcluded) !== null && _a !== void 0
      ? _a
      : 0;
  const fromDiff =
    rawMergeCount > mergeCandidatesLength ? rawMergeCount - mergeCandidatesLength : 0;
  const fromSummary =
    (_b = summaryBase.intentionalPairsExcluded) !== null && _b !== void 0 ? _b : 0;
  const fromFuzzy = (_c = summaryBase.fuzzyPairsExcluded) !== null && _c !== void 0 ? _c : 0;
  return Math.max(fromSummary, fromPairs, fromDiff, fromFuzzy);
}
/**
 * Reconcile legacy consolidation counts.
 * @param {any} summary
 * @returns {any}
 */
function reconcileLegacyConsolidationCounts(summary = {}) {
  var _a, _b, _c;
  let benchmarkCacheCandidatesExcluded =
    (_a = summary.benchmarkCacheCandidatesExcluded) !== null && _a !== void 0 ? _a : 0;
  let fuzzyPairsExcluded = (_b = summary.fuzzyPairsExcluded) !== null && _b !== void 0 ? _b : 0;
  if (
    benchmarkCacheCandidatesExcluded > 0 &&
    ((_c = summary.exactDuplicateGroups) !== null && _c !== void 0 ? _c : 0) === 0 &&
    fuzzyPairsExcluded === 0
  ) {
    fuzzyPairsExcluded = benchmarkCacheCandidatesExcluded;
    benchmarkCacheCandidatesExcluded = 0;
  }
  return { benchmarkCacheCandidatesExcluded, fuzzyPairsExcluded };
}
/**
 * Refresh product consolidation scope limitations.
 * @param {any} scanScope
 * @param {any} summary
 * @returns {any}
 */
function refreshProductConsolidationScopeLimitations(scanScope, summary = {}) {
  if (!scanScope) return scanScope;
  const { benchmarkCacheCandidatesExcluded, fuzzyPairsExcluded } =
    reconcileLegacyConsolidationCounts(summary);
  const staleLimitationRe =
    /benchmark-clone candidate|near-duplicate pair\(s\) excluded \(MCP|duplicate group\(s\) under github-cache/i;
  /**
   * Base.
   * @param {number} scanScope.limitations || []
   * @returns {any}
   */
  const base = (scanScope.limitations || []).filter(
    (line) => !staleLimitationRe.test(String(line))
  );
  const extra = [];
  if (benchmarkCacheCandidatesExcluded > 0) {
    extra.push(
      `${benchmarkCacheCandidatesExcluded} duplicate group(s) under github-cache/ or deliverables/ excluded from platform consolidation scores.`
    );
  }
  if (fuzzyPairsExcluded > 0) {
    extra.push(
      `${fuzzyPairsExcluded} near-duplicate pair(s) excluded (MCP examples, session temps, monorepo mirrors).`
    );
  }
  return { ...scanScope, limitations: [...base, ...extra] };
}
/**
 * Is benchmark consolidation.
 * @param {any} scan
 * @param {Object} options
 * @returns {any}
 */
function isBenchmarkConsolidation(scan, options = {}) {
  if (options.benchmarkScan != null) return Boolean(options.benchmarkScan);
  return isBenchmarkPath(resolveConsolidationProjectPath(scan, options));
}
/**
 * Rewrite product scoped text.
 * @param {string} text
 * @param {any} benchmarkScan
 * @returns {any}
 */
function rewriteProductScopedText(text, benchmarkScan) {
  if (!benchmarkScan || text == null) return text;
  return String(text)
    .replace(
      /trim or archive for dashboard load/gi,
      'trim or archive if no longer needed in this OSS clone'
    )
    .replace(
      /Restart the dashboard server and re-run consolidation for platform-scoped counts \(~2,200 files\)\./gi,
      'Re-run consolidation on ai-platform root for Simplebeacon product sample-path metrics.'
    )
    .replace(/\(includes github-cache\/\)/gi, '(OSS clone under github-cache/)');
}
/**
 * Consolidation candidate touches excluded export.
 * @param {string} candidate
 * @returns {any}
 */
function consolidationCandidateTouchesExcludedExport(candidate) {
  /**
   * Paths.
   * @param {string} candidate?.files || []
   * @returns {any}
   */
  const paths = ((candidate === null || candidate === void 0 ? void 0 : candidate.files) || [])
    .map((file) => file.path || file.relativePath || file.name)
    .filter(Boolean);
  if (consolidationCandidateTouchesExcluded(candidate)) return true;
  if (paths.length === 2 && isConsolidationExcludedPair(paths[0], paths[1])) return true;
  return paths.some((p) => consolidationPathTouchesExcluded(p));
}
/**
 * Should exclude consolidation candidate.
 * @param {string} candidate
 * @param {any} benchmarkScan
 * @returns {any}
 */
function shouldExcludeConsolidationCandidate(candidate, benchmarkScan) {
  if (consolidationCandidateTouchesExcluded(candidate)) return true;
  if (benchmarkScan) return false;
  return consolidationCandidateTouchesExcludedExport(candidate);
}
/**
 * Count intentional pair exclusions.
 * @param {Array} candidates
 * @returns {any}
 */
function countIntentionalPairExclusions(candidates = []) {
  let browserMirrorPairsExcluded = 0;
  let mcpExamplePairsExcluded = 0;
  let intentionalPairsExcluded = 0;
  for (const candidate of candidates) {
    /**
     * Paths.
     * @param {string} candidate?.files || []
     * @returns {any}
     */
    const paths = ((candidate === null || candidate === void 0 ? void 0 : candidate.files) || [])
      .map((file) => file.path || file.relativePath || file.name)
      .filter(Boolean);
    if (paths.length !== 2) continue;
    if (isBrowserBuildMirrorPair(paths[0], paths[1])) {
      browserMirrorPairsExcluded += 1;
      intentionalPairsExcluded += 1;
    } else if (isIntentionalMcpExamplePair(paths[0], paths[1])) {
      mcpExamplePairsExcluded += 1;
      intentionalPairsExcluded += 1;
    }
  }
  return { browserMirrorPairsExcluded, mcpExamplePairsExcluded, intentionalPairsExcluded };
}
/**
 * Filter consolidation recommendations.
 * @param {Array} recommendations
 * @param {any} benchmarkScan
 * @returns {any}
 */
function filterConsolidationRecommendations(recommendations, benchmarkScan) {
  return (recommendations || []).filter((rec) => {
    const files = rec.files || [];
    if (files.length === 2 && isConsolidationExcludedPair(files[0], files[1])) return false;
    if (files.some(isEphemeralConsolidationPath)) return false;
    if (benchmarkScan) return true;
    return !files.some((f) => consolidationPathTouchesExcluded(f));
  });
}
/**
 * Resolve benchmark consolidation health.
 * @param {any} summary
 * @returns {any}
 */
function resolveBenchmarkConsolidationHealth(summary) {
  var _a, _b;
  const mergeN =
    (_a = summary === null || summary === void 0 ? void 0 : summary.mergeCandidates) !== null &&
    _a !== void 0
      ? _a
      : 0;
  const savings =
    (_b = summary === null || summary === void 0 ? void 0 : summary.potentialSavingsBytes) !==
      null && _b !== void 0
      ? _b
      : 0;
  if (mergeN === 0 && savings === 0) return 'benchmark-hygiene-clean';
  if (mergeN > 0) return 'benchmark-review-merge-candidates';
  return 'benchmark-hygiene';
}
/**
 * Build benchmark consolidation export notes.
 * @param {any} summary
 * @param {Array} pairExclusions
 * @returns {any}
 */
function buildBenchmarkConsolidationExportNotes(summary, pairExclusions) {
  var _a, _b, _c, _d, _e, _f;
  const notes = [];
  const intentional = Math.max(
    (_a =
      pairExclusions === null || pairExclusions === void 0
        ? void 0
        : pairExclusions.intentionalPairsExcluded) !== null && _a !== void 0
      ? _a
      : 0,
    (_b = summary === null || summary === void 0 ? void 0 : summary.intentionalPairsExcluded) !==
      null && _b !== void 0
      ? _b
      : 0,
    ((_c = summary === null || summary === void 0 ? void 0 : summary.browserMirrorPairsExcluded) !==
      null && _c !== void 0
      ? _c
      : 0) +
      ((_d = summary === null || summary === void 0 ? void 0 : summary.mcpExamplePairsExcluded) !==
        null && _d !== void 0
        ? _d
        : 0)
  );
  if (intentional > 0) {
    notes.push(
      `${intentional} near-duplicate pair(s) excluded as intentional CJS/browser mirrors or MCP example configs — do not merge.`
    );
  }
  if (
    ((_e = summary === null || summary === void 0 ? void 0 : summary.mergeCandidates) !== null &&
    _e !== void 0
      ? _e
      : 0) === 0
  ) {
    notes.push(
      'No actionable merge candidates on this OSS clone — consolidation is inventory hygiene only.'
    );
  }
  if (
    ((_f = summary === null || summary === void 0 ? void 0 : summary.potentialSavingsBytes) !==
      null && _f !== void 0
      ? _f
      : 0) === 0
  ) {
    notes.push('Measured potential savings are 0B — not a delete/merge approval.');
  }
  notes.push(
    'Re-run consolidation on ai-platform root for Simplebeacon product sample-path deduplication.'
  );
  return notes;
}
/**
 * Assemble benchmark consolidation export notes.
 * @param {Array} existingNotes
 * @param {any} summary
 * @param {Array} pairExclusions
 * @returns {any}
 */
function assembleBenchmarkConsolidationExportNotes(existingNotes = [], summary, pairExclusions) {
  const dynamic = buildBenchmarkConsolidationExportNotes(summary, pairExclusions);
  const scopeNotes = [
    'Consolidation export scoped to github-cache/ OSS clone — not Simplebeacon platform product code.',
    'Product sample paths (web/data, data/roadmap) do not apply on this benchmark target.',
  ];
  const skipPatterns = [
    /consolidation export scoped to github-cache/i,
    /product sample paths \(web\/data/i,
    /no actionable merge candidates/i,
    /measured potential savings are 0b/i,
    /re-run consolidation on ai-platform root/i,
    /intentional cjs\/browser mirrors/i,
  ];
  const filtered = dedupeExportNotes(existingNotes).filter((note) => {
    const text = String(note);
    if (/Restart the dashboard|~2,200 files|includes github-cache\/\)/i.test(text)) return false;
    const lowered = text.toLowerCase();
    return (
      !skipPatterns.some((re) => re.test(lowered)) &&
      !dynamic.some((entry) => entry.toLowerCase() === lowered)
    );
  });
  return dedupeExportNotes([...filtered, ...dynamic, ...scopeNotes]);
}
/**
 * Consolidation candidate touches excluded.
 * @param {string} candidate
 * @returns {any}
 */
function consolidationCandidateTouchesExcluded(candidate) {
  /**
   * Paths.
   * @param {string} candidate?.files || []
   * @returns {any}
   */
  const paths = ((candidate === null || candidate === void 0 ? void 0 : candidate.files) || [])
    .map((file) => file.path || file.relativePath || file.name)
    .filter(Boolean);
  if (paths.length === 2 && isConsolidationExcludedPair(paths[0], paths[1])) return true;
  return paths.some((p) => isEphemeralConsolidationPath(p));
}
/**
 * Filter advanced analysis.
 * @param {Array} analysis
 * @param {any} benchmarkScan
 * @returns {any}
 */
function filterAdvancedAnalysis(analysis, benchmarkScan) {
  var _a, _b;
  if (!analysis) return analysis;
  const fuzzyPairs = filterFuzzyPairs(
    ((_a = analysis.fuzzyNearDuplicates) === null || _a === void 0 ? void 0 : _a.pairs) || []
  ).filter(
    (pair) =>
      benchmarkScan ||
      (!consolidationPathTouchesExcluded(pair.fileA) &&
        !consolidationPathTouchesExcluded(pair.fileB))
  );
  const patternGroups = (
    ((_b = analysis.patternConsolidation) === null || _b === void 0
      ? void 0
      : _b.recommendations) || []
  ).filter(
    (group) =>
      benchmarkScan ||
      !(group.files || []).every((file) => consolidationPathTouchesExcluded(file.path))
  );
  return {
    ...analysis,
    fuzzyNearDuplicates: {
      ...analysis.fuzzyNearDuplicates,
      pairsFound: fuzzyPairs.length,
      pairs: fuzzyPairs,
    },
    patternConsolidation: {
      ...analysis.patternConsolidation,
      groupsFound: patternGroups.length,
      recommendations: patternGroups,
    },
  };
}
/**
 * Resolve product consolidation health.
 * @param {any} summary
 * @returns {any}
 */
function resolveProductConsolidationHealth(summary) {
  var _a, _b;
  const mergeN =
    (_a = summary === null || summary === void 0 ? void 0 : summary.mergeCandidates) !== null &&
    _a !== void 0
      ? _a
      : 0;
  const savings =
    (_b = summary === null || summary === void 0 ? void 0 : summary.potentialSavingsBytes) !==
      null && _b !== void 0
      ? _b
      : 0;
  if (mergeN === 0 && savings === 0) return 'clean-no-merge-candidates';
  if (mergeN > 0) return 'review-merge-candidates';
  return 'platform-scoped';
}
/**
 * Resolve consolidation gate context.
 * @param {any} scan
 * @param {Object} options
 * @returns {any}
 */
function resolveConsolidationGateContext(scan, options = {}) {
  var _a,
    _b,
    _c,
    _d,
    _e,
    _f,
    _g,
    _h,
    _j,
    _k,
    _l,
    _m,
    _o,
    _p,
    _q,
    _r,
    _s,
    _t,
    _u,
    _v,
    _w,
    _x,
    _y,
    _z,
    _0,
    _1,
    _2,
    _3,
    _4,
    _5,
    _6,
    _7,
    _8,
    _9,
    _10,
    _11,
    _12,
    _13,
    _14,
    _15;
  const gateReport = options.gateReport || {};
  const repositoryFilesTotal =
    (_h =
      (_f =
        (_d =
          (_b =
            (_a = options.repositoryFilesTotal) !== null && _a !== void 0
              ? _a
              : gateReport.repositoryFilesTotal) !== null && _b !== void 0
            ? _b
            : (_c = gateReport.repositoryInventory) === null || _c === void 0
              ? void 0
              : _c.totalFiles) !== null && _d !== void 0
          ? _d
          : (_e = scan.hygieneSummary) === null || _e === void 0
            ? void 0
            : _e.gateRepositoryFilesTotal) !== null && _f !== void 0
        ? _f
        : (_g = scan.scanScope) === null || _g === void 0
          ? void 0
          : _g.gateRepositoryFilesTotal) !== null && _h !== void 0
      ? _h
      : null;
  const credentialScanned =
    (_p =
      (_m =
        (_k =
          (_j = gateReport.credentialScanned) !== null && _j !== void 0
            ? _j
            : gateReport.productionLeakScanned) !== null && _k !== void 0
          ? _k
          : (_l = gateReport.scanScope) === null || _l === void 0
            ? void 0
            : _l.productionDirsScanned) !== null && _m !== void 0
        ? _m
        : (_o = scan.hygieneSummary) === null || _o === void 0
          ? void 0
          : _o.credentialScanned) !== null && _p !== void 0
      ? _p
      : null;
  const contentScanned =
    (_y =
      (_w =
        (_v =
          (_s =
            (_r =
              (_q = gateReport.scanScope) === null || _q === void 0
                ? void 0
                : _q.fullDirectoryStats) === null || _r === void 0
              ? void 0
              : _r.contentScanned) !== null && _s !== void 0
            ? _s
            : (_u =
                  (_t = gateReport.scanScope) === null || _t === void 0
                    ? void 0
                    : _t.fullDirectoryStats) === null || _u === void 0
              ? void 0
              : _u.filesContentScanned) !== null && _v !== void 0
          ? _v
          : gateReport.credentialScanned) !== null && _w !== void 0
        ? _w
        : (_x = scan.hygieneSummary) === null || _x === void 0
          ? void 0
          : _x.contentFilesScanned) !== null && _y !== void 0
      ? _y
      : null;
  const gateProfile =
    (_4 =
      (_2 =
        (_0 = (_z = gateReport.scanScope) === null || _z === void 0 ? void 0 : _z.profile) !==
          null && _0 !== void 0
          ? _0
          : (_1 = scan.scanScope) === null || _1 === void 0
            ? void 0
            : _1.gateRuleBundleProfile) !== null && _2 !== void 0
        ? _2
        : (_3 = scan.hygieneSummary) === null || _3 === void 0
          ? void 0
          : _3.gateRuleBundleProfile) !== null && _4 !== void 0
      ? _4
      : null;
  return {
    gateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned:
      (_9 =
        (_7 =
          (_5 = gateReport.fictionJsonFilesScanned) !== null && _5 !== void 0
            ? _5
            : (_6 = gateReport.scanScope) === null || _6 === void 0
              ? void 0
              : _6.fictionJsonFilesScanned) !== null && _7 !== void 0
          ? _7
          : (_8 = scan.hygieneSummary) === null || _8 === void 0
            ? void 0
            : _8.fictionJsonFilesScanned) !== null && _9 !== void 0
        ? _9
        : null,
    fictionSampleFilesScanned:
      (_15 =
        (_13 =
          (_11 =
            (_10 = gateReport.fictionSampleFilesScanned) !== null && _10 !== void 0
              ? _10
              : gateReport.mockSampleFiles) !== null && _11 !== void 0
            ? _11
            : (_12 = gateReport.scanScope) === null || _12 === void 0
              ? void 0
              : _12.fictionSampleFilesScanned) !== null && _13 !== void 0
          ? _13
          : (_14 = scan.hygieneSummary) === null || _14 === void 0
            ? void 0
            : _14.fictionSampleFilesScanned) !== null && _15 !== void 0
        ? _15
        : null,
  };
}
/**
 * Build product consolidation hygiene summary.
 * @param {any} summaryBase
 * @param {any} scan
 * @param {Object} options
 * @returns {any}
 */
function buildProductConsolidationHygieneSummary(summaryBase, scan, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
  const gateContext = resolveConsolidationGateContext(scan, options);
  const {
    repositoryFilesTotal: gateTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    gateReport,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
  } = gateContext;
  const repoTotal =
    (_c =
      (_a = summaryBase.repositoryFilesTotal) !== null && _a !== void 0
        ? _a
        : (_b = scan.repositoryInventory) === null || _b === void 0
          ? void 0
          : _b.totalFiles) !== null && _c !== void 0
      ? _c
      : null;
  const repoAudited =
    (_f =
      (_d = summaryBase.repositoryFilesAudited) !== null && _d !== void 0
        ? _d
        : (_e = scan.scanScope) === null || _e === void 0
          ? void 0
          : _e.repositoryFilesAudited) !== null && _f !== void 0
      ? _f
      : null;
  return {
    consolidationHealthStatus: resolveProductConsolidationHealth(summaryBase),
    mergeCandidates: (_g = summaryBase.mergeCandidates) !== null && _g !== void 0 ? _g : 0,
    potentialSavingsBytes:
      (_h = summaryBase.potentialSavingsBytes) !== null && _h !== void 0 ? _h : 0,
    exactDuplicateGroups:
      (_j = summaryBase.exactDuplicateGroups) !== null && _j !== void 0 ? _j : 0,
    jsonFilesAnalyzed:
      (_m =
        (_k = summaryBase.jsonFilesAnalyzed) !== null && _k !== void 0
          ? _k
          : (_l = scan.scanScope) === null || _l === void 0
            ? void 0
            : _l.jsonFilesAnalyzed) !== null && _m !== void 0
        ? _m
        : null,
    sampleDataFilesAnalyzed:
      (_q =
        (_o = summaryBase.sampleDataFilesAnalyzed) !== null && _o !== void 0
          ? _o
          : (_p = scan.scanScope) === null || _p === void 0
            ? void 0
            : _p.sampleDataFilesAnalyzed) !== null && _q !== void 0
        ? _q
        : null,
    repositoryFilesTotal: repoTotal,
    ...(repoAudited != null ? { repositoryFilesAudited: repoAudited } : {}),
    ...(repoTotal != null && repoAudited != null && repoTotal > repoAudited
      ? { auditInventoryNotMergeWalked: repoTotal - repoAudited }
      : {}),
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
    ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    intentionalPairsExcluded:
      (_s =
        (_r = summaryBase.intentionalPairsExcluded) !== null && _r !== void 0
          ? _r
          : summaryBase.fuzzyPairsExcluded) !== null && _s !== void 0
        ? _s
        : 0,
    ...(gateReport.jestBaselineChecked === false ||
    ((_t = scan.hygieneSummary) === null || _t === void 0 ? void 0 : _t.jestBaselineChecked) ===
      false
      ? { jestBaselineChecked: false }
      : {}),
    attestationNote:
      'File merger/reduction hygiene — not gate pass or vendor handoff certification.',
  };
}
/**
 * Enrich product consolidation scan scope.
 * @param {any} scanScope
 * @param {any} scan
 * @param {Object} options
 * @returns {any}
 */
function enrichProductConsolidationScanScope(scanScope, scan, options = {}) {
  var _a, _b, _c, _d, _e, _f;
  const gateContext = resolveConsolidationGateContext(scan, options);
  const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
  const summary = scan.summary || {};
  return {
    ...(scanScope || {}),
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    mergeWalkFiles:
      (_b =
        (_a = summary.repositoryFilesAudited) !== null && _a !== void 0
          ? _a
          : scanScope === null || scanScope === void 0
            ? void 0
            : scanScope.repositoryFilesAudited) !== null && _b !== void 0
        ? _b
        : null,
    jsonFilesHashed:
      (_d =
        (_c = summary.jsonFilesAnalyzed) !== null && _c !== void 0
          ? _c
          : scanScope === null || scanScope === void 0
            ? void 0
            : scanScope.jsonFilesAnalyzed) !== null && _d !== void 0
        ? _d
        : null,
    sampleDataFilesAnalyzed:
      (_f =
        (_e = summary.sampleDataFilesAnalyzed) !== null && _e !== void 0
          ? _e
          : scanScope === null || scanScope === void 0
            ? void 0
            : scanScope.sampleDataFilesAnalyzed) !== null && _f !== void 0
        ? _f
        : null,
    resultsViewScope:
      (scanScope === null || scanScope === void 0 ? void 0 : scanScope.resultsViewScope) ||
      'platform-only',
    securityHandoffEligible: false,
  };
}
/**
 * Build product consolidation export notes.
 * @param {any} scan
 * @param {any} ephemeralExcluded
 * @param {string} context
 * @returns {any}
 */
function buildProductConsolidationExportNotes(scan, ephemeralExcluded, context = {}) {
  var _a,
    _b,
    _c,
    _d,
    _e,
    _f,
    _g,
    _h,
    _j,
    _k,
    _l,
    _m,
    _o,
    _p,
    _q,
    _r,
    _s,
    _t,
    _u,
    _v,
    _w,
    _x,
    _y,
    _z,
    _0,
    _1;
  const notes = [
    'securityHandoffEligible is false — consolidation is measured duplicate hygiene only, not vendor security handoff.',
    'Absolute scan paths are redacted to project label in operator exports.',
  ];
  const scope = scan.scanScope || {};
  const repoTotal =
    (_b = (_a = scan.summary) === null || _a === void 0 ? void 0 : _a.repositoryFilesTotal) !==
      null && _b !== void 0
      ? _b
      : (_c = scan.repositoryInventory) === null || _c === void 0
        ? void 0
        : _c.totalFiles;
  const repoAudited =
    (_e = (_d = scan.summary) === null || _d === void 0 ? void 0 : _d.repositoryFilesAudited) !==
      null && _e !== void 0
      ? _e
      : scope.repositoryFilesAudited;
  if (repoTotal != null && repoAudited != null && repoTotal !== repoAudited) {
    notes.push(
      `Inventory: ${Number(repoTotal).toLocaleString()} files in audit profile; merge walks used ${Number(repoAudited).toLocaleString()} audit-scoped paths.`
    );
  }
  const gateContext = resolveConsolidationGateContext(scan, context);
  const {
    repositoryFilesTotal: gateTotal,
    credentialScanned,
    gateProfile,
    gateReport,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
  } = gateContext;
  const profile =
    ((_f = scan.repositoryInventory) === null || _f === void 0 ? void 0 : _f.profile) ||
    scope.repositoryInventoryProfile ||
    'audit';
  if (gateTotal != null && repoTotal != null && gateTotal !== repoTotal) {
    notes.push(
      `repositoryFilesTotal (${Number(repoTotal).toLocaleString()}, ${profile} profile) — gate full-tree inventory is ${Number(gateTotal).toLocaleString()} paths.`
    );
  }
  if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
    notes.push(
      `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`
    );
  }
  const jsonN =
    (_h = (_g = scan.summary) === null || _g === void 0 ? void 0 : _g.jsonFilesAnalyzed) !== null &&
    _h !== void 0
      ? _h
      : (_j = scan.scanScope) === null || _j === void 0
        ? void 0
        : _j.jsonFilesAnalyzed;
  const sampleN =
    (_l = (_k = scan.summary) === null || _k === void 0 ? void 0 : _k.sampleDataFilesAnalyzed) !==
      null && _l !== void 0
      ? _l
      : (_m = scan.scanScope) === null || _m === void 0
        ? void 0
        : _m.sampleDataFilesAnalyzed;
  if (jsonN != null && sampleN != null) {
    notes.push(
      `${Number(jsonN).toLocaleString()} JSON file(s) hashed for exact duplicates — ${Number(sampleN).toLocaleString()} under sample paths (web/data, data/roadmap).`
    );
  }
  if (ephemeralExcluded > 0) {
    notes.push(
      `${ephemeralExcluded} near-duplicate pair(s) involving vault/session cookie temps (.tmp-*, cookies.txt) excluded — not merge candidates.`
    );
  }
  const aliasExcluded =
    ((_p =
      (_o = scan.summary) === null || _o === void 0 ? void 0 : _o.monorepoAliasPairsExcluded) !==
      null && _p !== void 0
      ? _p
      : 0) +
    ((_r =
      (_q = scan.summary) === null || _q === void 0 ? void 0 : _q.browserMirrorPairsExcluded) !==
      null && _r !== void 0
      ? _r
      : 0) +
    ((_t = (_s = scan.summary) === null || _s === void 0 ? void 0 : _s.mcpExamplePairsExcluded) !==
      null && _t !== void 0
      ? _t
      : 0);
  if (aliasExcluded > 0) {
    notes.push(
      `${aliasExcluded} pair(s) excluded as monorepo path aliases, browser build mirrors, or intentional MCP example configs.`
    );
  }
  if (
    ((_v = (_u = scan.summary) === null || _u === void 0 ? void 0 : _u.exactDuplicateGroups) !==
      null && _v !== void 0
      ? _v
      : 0) === 0 &&
    ((_x = (_w = scan.summary) === null || _w === void 0 ? void 0 : _w.mergeCandidates) !== null &&
    _x !== void 0
      ? _x
      : 0) === 0
  ) {
    notes.push('No exact duplicate groups or actionable merge candidates in this export.');
  }
  if (
    ((_z = (_y = scan.summary) === null || _y === void 0 ? void 0 : _y.potentialSavingsBytes) !==
      null && _z !== void 0
      ? _z
      : 0) === 0
  ) {
    notes.push(
      'Measured potential savings are 0B — consolidation is informational hygiene, not a delete/merge approval.'
    );
  }
  if (
    fictionJsonFilesScanned != null &&
    fictionSampleFilesScanned != null &&
    fictionJsonFilesScanned > fictionSampleFilesScanned
  ) {
    notes.push(
      // simplebeacon:production-leak-intent - legitimate KPI reference for consolidation reporting
      `DATA-002 evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) — ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched in paired gate scan.`
    );
  }
  if (gateProfile) {
    notes.push(
      `Gate rule bundle profile: ${gateProfile} — pair consolidation report with json/simplebeacon-gate.json for handoff evidence.`
    );
  }
  if (
    gateReport.jestBaselineChecked === false ||
    ((_0 = scan.hygieneSummary) === null || _0 === void 0 ? void 0 : _0.jestBaselineChecked) ===
      false
  ) {
    notes.push(
      'Consolidation scan does not run Jest — use gate/complete scan for test attestation.'
    );
  }
  if ((_1 = scan.rejectedFiction) === null || _1 === void 0 ? void 0 : _1.warning) {
    notes.push(
      `Marketing throughput claims in rejectedFiction are not implemented (${scan.rejectedFiction.warning}).`
    );
  }
  return [...new Set(notes)].slice(0, 12);
}
/**
 * Build product consolidation ai summary.
 * @param {any} scan
 * @returns {any}
 */
function buildProductConsolidationAiSummary(scan) {
  var _a, _b, _c, _d;
  const s = scan.summary || {};
  const repoTotal =
    (_a = s.repositoryFilesTotal) !== null && _a !== void 0
      ? _a
      : (_b = scan.repositoryInventory) === null || _b === void 0
        ? void 0
        : _b.totalFiles;
  const repoAudited =
    (_c = s.repositoryFilesAudited) !== null && _c !== void 0
      ? _c
      : (_d = scan.scanScope) === null || _d === void 0
        ? void 0
        : _d.repositoryFilesAudited;
  const parts = [
    'Platform consolidation scan — no actionable merge candidates',
    s.exactDuplicateGroups != null ? `${s.exactDuplicateGroups} exact duplicate group(s)` : null,
    s.jsonFilesAnalyzed != null
      ? `${Number(s.jsonFilesAnalyzed).toLocaleString()} repo JSON hashed for duplicates`
      : null,
    repoTotal != null ? `inventory ${Number(repoTotal).toLocaleString()} files` : null,
    repoAudited != null && repoAudited !== repoTotal
      ? `${Number(repoAudited).toLocaleString()} audit-scoped for merge logic`
      : null,
    s.potentialSavingsLabel
      ? `potential savings ${s.potentialSavingsLabel}`
      : '0B measured savings',
    'hygiene only — not vendor handoff clearance',
  ].filter(Boolean);
  return `${parts.join('; ')}.`;
}
/**
 * Build benchmark consolidation conclusion.
 * @param {any} scan
 * @returns {any}
 */
function buildBenchmarkConsolidationConclusion(scan) {
  var _a, _b, _c, _d;
  const s = scan.summary || {};
  const repoFiles =
    (_b =
      (_a = s.repositoryFilesTotal) !== null && _a !== void 0 ? _a : s.repositoryFilesAudited) !==
      null && _b !== void 0
      ? _b
      : (_c = scan.repositoryInventory) === null || _c === void 0
        ? void 0
        : _c.totalFiles;
  const candidates = (s.mergeCandidates || 0) + (s.reductionOpportunities || 0);
  const parts = [
    'OSS benchmark clone under github-cache/ — consolidation hygiene for the clone only',
    candidates
      ? `${candidates} merge/reduction candidate(s) inside this clone`
      : 'No merge/reduction candidates',
    ((_d = s.sampleDataFilesAnalyzed) !== null && _d !== void 0 ? _d : 0) === 0
      ? 'Simplebeacon sample paths (web/data, data/roadmap) are not on this clone'
      : `${s.sampleDataFilesAnalyzed} sample JSON under configured paths`,
    repoFiles != null ? `Clone inventory: ${Number(repoFiles).toLocaleString()} files` : null,
    s.potentialSavingsLabel ? `Potential savings: ${s.potentialSavingsLabel}` : null,
    'Re-run on ai-platform root for product handoff evidence',
  ].filter(Boolean);
  return `${parts.join('. ')}.`;
}
/**
 * Sanitize consolidation export.
 * @param {any} scan
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeConsolidationExport(scan, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
  if (!scan || scan.type !== 'file-merger-reduction-report' || !scan.summary) return scan;
  const projectPath = resolveConsolidationProjectPath(scan, options);
  const benchmarkScan = isBenchmarkConsolidation(scan, { ...options, projectPath });
  const repoRaw =
    (_c =
      (_a = scan.summary.repositoryFilesTotal) !== null && _a !== void 0
        ? _a
        : (_b = scan.repositoryInventory) === null || _b === void 0
          ? void 0
          : _b.totalFiles) !== null && _c !== void 0
      ? _c
      : null;
  const staleProductInventory = !benchmarkScan && repoRaw != null && repoRaw > 10000;
  const productPlatformRoot = benchmarkScan
    ? options.productPlatformRoot || resolveProductPlatformRoot(projectPath)
    : null;
  const scanTargetRoot = projectPath || undefined;
  const rawMergeList = scan.mergeCandidates || [];
  const pairExclusions = countIntentionalPairExclusions(rawMergeList);
  let mergeCandidates = rawMergeList.filter(
    (c) => !shouldExcludeConsolidationCandidate(c, benchmarkScan)
  );
  mergeCandidates = mergeCandidates.map((c) => ({
    ...c,
    recommendation: rewriteProductScopedText(c.recommendation, benchmarkScan),
  }));
  let reductionOpportunities = (scan.reductionOpportunities || []).filter(
    (o) => !shouldExcludeConsolidationCandidate(o, benchmarkScan)
  );
  reductionOpportunities = reductionOpportunities.map((o) => ({
    ...o,
    description: rewriteProductScopedText(o.description, benchmarkScan),
  }));
  const benchmarkMergeExcluded = rawMergeList.length - mergeCandidates.length;
  const rawAdvanced = scan.advancedAnalysis;
  const advancedAnalysis = filterAdvancedAnalysis(rawAdvanced, benchmarkScan);
  const rawFuzzyPairExclusions = !benchmarkScan
    ? countExcludedFuzzyPairs(
        ((_d =
          rawAdvanced === null || rawAdvanced === void 0
            ? void 0
            : rawAdvanced.fuzzyNearDuplicates) === null || _d === void 0
          ? void 0
          : _d.pairs) || []
      )
    : {
        fuzzyPairsExcluded: 0,
        intentionalPairsExcluded: 0,
        browserMirrorPairsExcluded: 0,
        mcpExamplePairsExcluded: 0,
        monorepoAliasPairsExcluded: 0,
        ephemeralPathsExcluded: 0,
      };
  const ephemeralFuzzyExcluded = rawFuzzyPairExclusions.ephemeralPathsExcluded;
  const legacyCounts = reconcileLegacyConsolidationCounts(scan.summary);
  const benchmarkCacheCandidatesExcluded =
    legacyCounts.benchmarkCacheCandidatesExcluded + (benchmarkScan ? benchmarkMergeExcluded : 0);
  const fuzzyPairsExcluded =
    legacyCounts.fuzzyPairsExcluded || rawFuzzyPairExclusions.fuzzyPairsExcluded;
  let recommendations = filterConsolidationRecommendations(scan.recommendations, benchmarkScan);
  recommendations = recommendations.map((r) => ({
    ...r,
    description: rewriteProductScopedText(r.description, benchmarkScan),
  }));
  const intentionalPairsExcluded = resolveIntentionalPairsExcludedCount(
    {
      ...scan.summary,
      benchmarkCacheCandidatesExcluded,
      fuzzyPairsExcluded,
    },
    pairExclusions,
    rawMergeList.length,
    mergeCandidates.length
  );
  const summaryBase = {
    ...scan.summary,
    mergeCandidates: mergeCandidates.length,
    reductionOpportunities: reductionOpportunities.length,
    fuzzyNearDuplicatePairs:
      (_f =
        (_e =
          advancedAnalysis === null || advancedAnalysis === void 0
            ? void 0
            : advancedAnalysis.fuzzyNearDuplicates) === null || _e === void 0
          ? void 0
          : _e.pairsFound) !== null && _f !== void 0
        ? _f
        : scan.summary.fuzzyNearDuplicatePairs,
    benchmarkCacheCandidatesExcluded,
    fuzzyPairsExcluded,
    ...(intentionalPairsExcluded > 0
      ? {
          intentionalPairsExcluded,
          browserMirrorPairsExcluded:
            ((_g = scan.summary.browserMirrorPairsExcluded) !== null && _g !== void 0 ? _g : 0) +
            pairExclusions.browserMirrorPairsExcluded +
            rawFuzzyPairExclusions.browserMirrorPairsExcluded,
          mcpExamplePairsExcluded:
            ((_h = scan.summary.mcpExamplePairsExcluded) !== null && _h !== void 0 ? _h : 0) +
            pairExclusions.mcpExamplePairsExcluded +
            rawFuzzyPairExclusions.mcpExamplePairsExcluded,
        }
      : {}),
    ...(ephemeralFuzzyExcluded > 0 || rawFuzzyPairExclusions.ephemeralPathsExcluded > 0
      ? {
          ephemeralPathsExcluded:
            ephemeralFuzzyExcluded || rawFuzzyPairExclusions.ephemeralPathsExcluded,
        }
      : {}),
  };
  const exportNotes = benchmarkScan
    ? assembleBenchmarkConsolidationExportNotes(scan.exportNotes, summaryBase, pairExclusions)
    : dedupeExportNotes(
        (scan.exportSanitized || scan.exportNormalized ? [] : scan.exportNotes || [])
          .filter((note) => {
            if (!benchmarkScan) return true;
            return !/Restart the dashboard|~2,200 files|includes github-cache\/\)/i.test(
              String(note)
            );
          })
          .concat(
            buildProductConsolidationExportNotes(
              { ...scan, summary: summaryBase, advancedAnalysis },
              ephemeralFuzzyExcluded,
              {
                repositoryFilesTotal:
                  (_j = options.repositoryFilesTotal) !== null && _j !== void 0 ? _j : null,
                gateReport: options.gateReport || null,
              }
            ),
            benchmarkMergeExcluded > 0
              ? [
                  `${benchmarkMergeExcluded} merge candidate(s) from github-cache/, deliverables/, or ephemeral session paths excluded from export.`,
                ]
              : []
          )
      );
  const productScanPathsOnBenchmark =
    benchmarkScan &&
    (scan.scanPaths || []).some((p) => PRODUCT_PATH_MARKERS.some((re) => re.test(String(p)))) &&
    ((_l = (_k = scan.summary) === null || _k === void 0 ? void 0 : _k.sampleDataFilesAnalyzed) !==
      null && _l !== void 0
      ? _l
      : 0) === 0;
  const result = {
    ...scan,
    projectRoot:
      scan.projectRoot || projectPath || undefined
        ? String(scan.projectRoot || projectPath).replace(/\\/g, '/')
        : undefined,
    platformRoot:
      productPlatformRoot ||
      (scan.platformRoot ? String(scan.platformRoot).replace(/\\/g, '/') : undefined),
    scanTargetRoot: scanTargetRoot ? String(scanTargetRoot).replace(/\\/g, '/') : undefined,
    ...(scan.repositoryInventory
      ? {
          repositoryInventory: {
            ...scan.repositoryInventory,
            projectRoot: String(
              scan.repositoryInventory.projectRoot || scan.projectRoot || projectPath || ''
            ).replace(/\\/g, '/'),
          },
        }
      : {}),
    advancedAnalysis:
      benchmarkScan &&
      (advancedAnalysis === null || advancedAnalysis === void 0
        ? void 0
        : advancedAnalysis.semanticHints)
        ? {
            ...advancedAnalysis,
            semanticHints: {
              ...advancedAnalysis.semanticHints,
              note: 'Semantic hints disabled on OSS benchmark clone — not used for handoff.',
            },
          }
        : advancedAnalysis,
    mergeCandidates,
    reductionOpportunities,
    recommendations,
    summary: {
      ...summaryBase,
      ...(benchmarkScan
        ? {
            repositoryFilesTotal: repoRaw,
            staleInventoryNote: undefined,
            repositoryFilesTotalRaw: undefined,
          }
        : staleProductInventory
          ? {
              repositoryFilesTotalRaw: repoRaw,
              repositoryFilesTotal:
                (_o =
                  (_m = scan.scanScope) === null || _m === void 0
                    ? void 0
                    : _m.platformRepositoryFilesTotal) !== null && _o !== void 0
                  ? _o
                  : null,
              staleInventoryNote: rewriteProductScopedText(scan.summary.staleInventoryNote, false),
            }
          : {}),
    },
    scanScope: benchmarkScan
      ? {
          ...(scan.scanScope || {}),
          mode: 'benchmark-clone-consolidation',
          resultsViewScope: 'benchmark-clone',
          reportHealth: 'benchmark-clone-consolidation',
          inventoryMetricsStale: false,
          rescanRecommended: false,
          productPlatformRoot: productPlatformRoot || undefined,
          limitations: [
            `OSS benchmark clone inventory: ${repoRaw != null ? Number(repoRaw).toLocaleString() : '—'} files.`,
            'Simplebeacon product sample paths (web/data, data/roadmap) are absent on this clone.',
            'Merge candidates are informational for OSS hygiene — not ai-platform handoff approval.',
          ],
        }
      : enrichProductConsolidationScanScope(
          refreshProductConsolidationScopeLimitations(
            {
              ...(scan.scanScope || {}),
              resultsViewScope: 'platform-only',
              reportHealth: staleProductInventory
                ? 'stale-explorer-inventory'
                : resolveProductConsolidationHealth(summaryBase),
              securityHandoffEligible: false,
              consolidationNote:
                'Measured duplicate/fuzzy merge scan — not Complete scan clearance bundle.',
            },
            summaryBase
          ),
          { ...scan, summary: summaryBase },
          {
            repositoryFilesTotal:
              (_p = options.repositoryFilesTotal) !== null && _p !== void 0 ? _p : null,
            gateReport: options.gateReport || null,
          }
        ),
    aiSummary: benchmarkScan
      ? buildBenchmarkConsolidationConclusion({ ...scan, summary: summaryBase })
      : mergeCandidates.length === 0 &&
          ((_q = summaryBase.potentialSavingsBytes) !== null && _q !== void 0 ? _q : 0) === 0
        ? buildProductConsolidationAiSummary({ ...scan, summary: summaryBase })
        : rewriteProductScopedText(scan.aiSummary, false),
    aiSummaryProvider: scan.aiSummaryProvider
      ? String(scan.aiSummaryProvider).replace(/\bSimplebeacon\b/g, 'SimpleBeacon')
      : scan.aiSummaryProvider,
    ...(benchmarkScan
      ? {
          benchmarkScan: true,
          scanTargetProfile: 'benchmark-cache',
          handoffEligible: false,
          securityHandoffEligible: false,
          exportNormalized: true,
          scanTargetRoot,
          platformRoot: productPlatformRoot || undefined,
          productPlatformRoot: productPlatformRoot || undefined,
          consolidationHealthStatus: resolveBenchmarkConsolidationHealth(summaryBase),
          title: 'OSS Clone Consolidation Scan (github-cache benchmark)',
          hygieneSummary: {
            mergeCandidates: mergeCandidates.length,
            potentialSavingsBytes:
              (_r = summaryBase.potentialSavingsBytes) !== null && _r !== void 0 ? _r : 0,
            intentionalPairsExcluded,
            repositoryFilesTotal:
              (_s =
                repoRaw !== null && repoRaw !== void 0
                  ? repoRaw
                  : summaryBase.repositoryFilesTotal) !== null && _s !== void 0
                ? _s
                : null,
            jsonFilesAnalyzed:
              (_t = summaryBase.jsonFilesAnalyzed) !== null && _t !== void 0 ? _t : null,
            attestationNote:
              'OSS clone consolidation hygiene — not Simplebeacon product handoff clearance.',
          },
        }
      : {
          exportNormalized: true,
          scanTargetProfile: 'product',
          securityHandoffEligible: false,
          handoffEligible: false,
          consolidationHealthStatus: resolveProductConsolidationHealth(summaryBase),
          hygieneSummary: buildProductConsolidationHygieneSummary(summaryBase, scan, {
            repositoryFilesTotal:
              (_u = options.repositoryFilesTotal) !== null && _u !== void 0 ? _u : null,
            gateReport: options.gateReport || null,
          }),
        }),
    exportSanitized: true,
    exportNotes,
  };
  if (productScanPathsOnBenchmark) {
    result.scanPaths = [];
    result.scanPathsProductDefaultsOmitted = scan.scanPaths;
    result.scanPathsNote =
      'Simplebeacon product sample paths (web/data, data/roadmap) are not walked on OSS benchmark clones.';
    if (result.scanScope) {
      result.scanScope = {
        ...result.scanScope,
        sampleDataPaths: [],
        sampleDataPathsOmitted:
          scan.scanPaths ||
          ((_v = result.scanScope) === null || _v === void 0 ? void 0 : _v.sampleDataPaths) ||
          [],
      };
    }
  }
  if (
    benchmarkScan &&
    ((_w = result.implementationPhases) === null || _w === void 0 ? void 0 : _w.length)
  ) {
    result.implementationPhasesOmitted = true;
    delete result.implementationPhases;
  }
  return applyRedactedConsolidationPaths(result, projectPath, productPlatformRoot);
}
