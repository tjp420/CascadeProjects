// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
/**

 * Browser mirror of simplebeacon-report-export-sanitize.js — keep in sync.

 */
import {
  normalizeBenchmarkGateReport,
  isBenchmarkDigestExcludedIssue,
} from './benchmark-gate-issue-filter.browser.js';
import { normalizeSimpleBeaconBranding } from './quality-export.browser.js?v=20260716cachefix1';
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
const PRODUCT_MOCK_PATH_MARKERS = [
  // simplebeacon:production-leak-intent - legitimate mock path markers for gate reporting
  /^fixtures$/i,
  /^__mocks__$/i,
  /^data$/i,
  /^web\/data\b/i,
  /^data\/mock\b/i,
  /^tests?\/fixtures\b/i,
];
const DEFAULT_FALLBACK_MOCK_PATHS = new Set(['fixtures', '__mocks__', 'data']);
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
 * Strip internal report export fields.
 * @param {number} report
 * @returns {any}
 */
function stripInternalReportExportFields(report) {
  if (!report || typeof report !== 'object') return report;
  const {
    rawIssues: _rawIssues,
    sampleFiles: _sampleFiles,
    benchmarkCloneNoiseIssues: _benchmarkCloneNoiseIssues,
    ...rest
  } = report;
  return rest;
}
/**
 * Is absolute host path.
 * @param {any} value
 * @returns {any}
 */
function isAbsoluteHostPath(value) {
  const normalized = String(value || '').replace(/\\/g, '/');
  return (
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith('/Users/') ||
    normalized.startsWith('/home/') ||
    normalized.includes('CascadeProjects')
  );
}
/**
 * Resolve report project path.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function resolveReportProjectPath(report, options = {}) {
  if (report.benchmarkScan && report.projectRoot && !isAbsoluteHostPath(report.projectRoot)) {
    return String(report.projectRoot).replace(/\\/g, '/');
  }
  const explicit = String(
    options.projectPath ||
      options.scanTargetRoot ||
      options.requestedProjectPath ||
      report.scanTargetRoot ||
      report.projectRoot ||
      report.platformRoot ||
      ''
  ).replace(/\\/g, '/');
  if (isBenchmarkPath(explicit)) return explicit;
  if (report.benchmarkScan && explicit && !isAbsoluteHostPath(explicit)) {
    return explicit;
  }
  const inferred = inferGateScanTargetFromHints(report, options);
  return inferred || explicit;
}
/**
 * Infer gate scan target from hints.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function inferGateScanTargetFromHints(report, options = {}) {
  const filename = String(options.exportFilename || options.filename || '').toLowerCase();
  if (!filename.includes('github-cache')) return '';
  const slugMatch = filename.match(
    /github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i
  );
  if (!slugMatch) return '';
  const cloneName = slugMatch[1];
  const sourceRoot = String(
    options.projectPath || report.scanTargetRoot || report.projectRoot || report.platformRoot || ''
  ).replace(/\\/g, '/');
  if (!isAbsoluteHostPath(sourceRoot)) return '';
  if (isBenchmarkPath(sourceRoot)) return '';
  const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
  return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}
/**
 * Filter stale gate export notes.
 * @param {Array} notes
 * @returns {any}
 */
function filterStaleGateExportNotes(notes = []) {
  return (notes || []).filter((note) => {
    const text = String(note);
    return (
      !/3 in typical cascade profile/i.test(text) &&
      !/mock-path sample count is mockSampleFiles\/totalFiles/i.test(text)
    );
  });
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
    const scopeKey = /gate export scoped to github-cache/i.test(normalized)
      ? 'benchmark-gate-scope-note'
      : /gate pass on clone reflects oss hygiene/i.test(normalized)
        ? 'benchmark-gate-pass-note'
        : /re-run gate scan on ai-platform root/i.test(normalized)
          ? 'benchmark-rerun-platform-note'
          : /product mock\/sample scan paths/i.test(normalized)
            ? 'benchmark-mock-path-note'
            : /llm slop file count reconciled/i.test(normalized)
              ? 'benchmark-llm-reconcile-note'
              : /documentation path\(s\) under \.simplebeacon\//i.test(normalized)
                ? 'simplebeacon-docs-note'
                : /scan pattern match\(es\) outside docs\//i.test(normalized)
                  ? 'eu-scan-non-docs-note'
                  : /credential\/production-leak rules scanned/i.test(normalized)
                    ? 'credential-scope-note'
                    : /content-scanned;/i.test(normalized)
                      ? 'content-scanned-note'
                      : /fiction kpi rules evaluated/i.test(normalized)
                        ? 'fiction-json-note'
                        : /llm-slop pattern match/i.test(normalized)
                          ? 'llm-slop-info-note'
                          : /production-leak pattern hit/i.test(normalized)
                            ? 'production-leak-info-note'
                            : /scanscope\.profile eu-ai-act/i.test(normalized)
                              ? 'eu-act-profile-note'
                              : /filesanalyzed matches repository inventory/i.test(normalized)
                                ? 'files-analyzed-note'
                                : /repository inventory/i.test(normalized)
                                  ? 'repo-inventory-note'
                                  : /gate pass on configured severities/i.test(normalized)
                                    ? 'gate-pass-note'
                                    : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(String(note));
  }
  return out.slice(0, 10);
}
/**
 * Split eu ai act summary for export.
 * @param {any} euAiActSummary
 * @returns {any}
 */
function splitEuAiActSummaryForExport(euAiActSummary) {
  var _a;
  if (
    !((_a =
      euAiActSummary === null || euAiActSummary === void 0
        ? void 0
        : euAiActSummary.documentationFound) === null || _a === void 0
      ? void 0
      : _a.length)
  )
    return euAiActSummary;
  const docs = euAiActSummary.documentationFound;
  const simplebeaconArtifactPaths = docs.filter((doc) => String(doc).startsWith('.simplebeacon/'));
  const operatorDocumentationFound = docs.filter((doc) => {
    const rel = String(doc).replace(/\\/g, '/');
    return rel.startsWith('docs/');
  });
  const scanMatchedNonDocsPaths = docs.filter((doc) => {
    const rel = String(doc).replace(/\\/g, '/');
    return !rel.startsWith('.simplebeacon/') && !rel.startsWith('docs/');
  });
  const next = {
    ...euAiActSummary,
    documentationFound: docs,
    operatorDocumentationFound,
    simplebeaconArtifactPaths,
    operatorDocumentationCount: operatorDocumentationFound.length,
    simplebeaconArtifactCount: simplebeaconArtifactPaths.length,
  };
  if (scanMatchedNonDocsPaths.length) {
    next.scanMatchedNonDocsPaths = scanMatchedNonDocsPaths;
    next.scanMatchedNonDocsCount = scanMatchedNonDocsPaths.length;
  } else {
    delete next.scanMatchedNonDocsPaths;
    delete next.scanMatchedNonDocsCount;
  }
  return next;
}
/**
 * Sanitize benchmark gate scan scope.
 * @param {any} scanScope
 * @param {number} report
 * @returns {any}
 */
function sanitizeBenchmarkGateScanScope(scanScope, report) {
  var _a, _b, _c, _d;
  if (!scanScope) return scanScope;
  const scanned =
    (_b =
      (_a = scanScope.llmSlopFilesScanned) !== null && _a !== void 0
        ? _a
        : report.llmSlopFilesScanned) !== null && _b !== void 0
      ? _b
      : null;
  const rawLlm =
    (_c = scanScope.llmSlopScanRaw) !== null && _c !== void 0 ? _c : report.llmSlopScanRaw;
  const reconciled =
    (_d = scanScope.llmSlopScanReconciled) !== null && _d !== void 0
      ? _d
      : report.llmSlopScanReconciled;
  if (!reconciled || rawLlm == null || scanned == null || rawLlm <= scanned) return scanScope;
  const next = { ...scanScope };
  delete next.llmSlopScanRaw;
  next.llmSlopReconciliationNote = `LLM slop scan reconciled from ${rawLlm} to ${scanned} files to match clone inventory.`;
  return next;
}
/**
 * Build product hygiene summary.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function buildProductHygieneSummary(report, options = {}) {
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
    _14;
  const jestSummary = report.jestSummary;
  const jestExecuted =
    report.jestBaselineChecked !== false &&
    ((_a = report.scanScope) === null || _a === void 0 ? void 0 : _a.jestExecutedDuringScan) !==
      false;
  const jestLabel =
    jestExecuted &&
    (jestSummary === null || jestSummary === void 0 ? void 0 : jestSummary.testsTotal) != null
      ? `${jestSummary.testsPassed}/${jestSummary.testsTotal}`
      : null;
  const repositoryFilesTotal =
    (_d =
      (_b = report.repositoryFilesTotal) !== null && _b !== void 0
        ? _b
        : (_c = report.repositoryInventory) === null || _c === void 0
          ? void 0
          : _c.totalFiles) !== null && _d !== void 0
      ? _d
      : null;
  const gateRepositoryFilesTotal =
    (_g =
      (_f =
        (_e = options.gateRepositoryFilesTotal) !== null && _e !== void 0
          ? _e
          : options.repositoryFilesTotal) !== null && _f !== void 0
        ? _f
        : repositoryFilesTotal) !== null && _g !== void 0
      ? _g
      : null;
  const contentScanned =
    (_p =
      (_o =
        (_k =
          (_j =
            (_h = report.scanScope) === null || _h === void 0 ? void 0 : _h.fullDirectoryStats) ===
            null || _j === void 0
            ? void 0
            : _j.contentScanned) !== null && _k !== void 0
          ? _k
          : (_m =
                (_l = report.scanScope) === null || _l === void 0
                  ? void 0
                  : _l.fullDirectoryStats) === null || _m === void 0
            ? void 0
            : _m.filesContentScanned) !== null && _o !== void 0
        ? _o
        : report.credentialScanned) !== null && _p !== void 0
      ? _p
      : null;
  return {
    gatePass:
      (_r = (_q = report.gate) === null || _q === void 0 ? void 0 : _q.pass) !== null &&
      _r !== void 0
        ? _r
        : null,
    blockingCount:
      (_t = (_s = report.gate) === null || _s === void 0 ? void 0 : _s.blockingCount) !== null &&
      _t !== void 0
        ? _t
        : 0,
    mockSampleFiles: (_u = report.mockSampleFiles) !== null && _u !== void 0 ? _u : null,
    fictionJsonFilesScanned:
      (_x =
        (_v = report.fictionJsonFilesScanned) !== null && _v !== void 0
          ? _v
          : (_w = report.scanScope) === null || _w === void 0
            ? void 0
            : _w.fictionJsonFilesScanned) !== null && _x !== void 0
        ? _x
        : null,
    fictionSampleFilesScanned:
      (_0 =
        (_y = report.fictionSampleFilesScanned) !== null && _y !== void 0
          ? _y
          : (_z = report.scanScope) === null || _z === void 0
            ? void 0
            : _z.fictionSampleFilesScanned) !== null && _0 !== void 0
        ? _0
        : null,
    ruleScopedFilesAnalyzed:
      (_3 =
        (_1 = report.ruleScopedFilesAnalyzed) !== null && _1 !== void 0
          ? _1
          : (_2 = report.scanScope) === null || _2 === void 0
            ? void 0
            : _2.ruleScopedFilesAnalyzed) !== null && _3 !== void 0
        ? _3
        : null,
    repositoryFilesTotal,
    ...(gateRepositoryFilesTotal != null ? { gateRepositoryFilesTotal } : {}),
    credentialScanned:
      (_5 =
        (_4 = report.credentialScanned) !== null && _4 !== void 0
          ? _4
          : report.productionLeakScanned) !== null && _5 !== void 0
        ? _5
        : null,
    contentFilesScanned: contentScanned,
    ...(repositoryFilesTotal != null &&
    contentScanned != null &&
    repositoryFilesTotal > contentScanned
      ? { gateMetadataOnlyFiles: repositoryFilesTotal - contentScanned }
      : {}),
    llmSlopPatternHits:
      (_8 =
        (_6 = report.llmSlopPatternHits) !== null && _6 !== void 0
          ? _6
          : (_7 = report.scanScope) === null || _7 === void 0
            ? void 0
            : _7.llmSlopPatternHits) !== null && _8 !== void 0
        ? _8
        : 0,
    qualityScore: (_9 = report.qualityScore) !== null && _9 !== void 0 ? _9 : null,
    ...(((_10 = report.scanScope) === null || _10 === void 0 ? void 0 : _10.profile)
      ? { gateRuleBundleProfile: report.scanScope.profile }
      : {}),
    gateFailureNote:
      ((_11 = report.gate) === null || _11 === void 0 ? void 0 : _11.pass) === false
        ? `Gate FAIL — ${(_13 = (_12 = report.gate) === null || _12 === void 0 ? void 0 : _12.blockingCount) !== null && _13 !== void 0 ? _13 : 0} blocking finding(s). Review detectedIssues before merge.`
        : null,
    jestBaselineChecked: jestExecuted,
    jestBaselinePassed: jestExecuted
      ? (_14 = report.jestBaselinePassed) !== null && _14 !== void 0
        ? _14
        : null
      : null,
    jestTests: jestLabel,
    jestScanSummary: jestLabel,
    attestationNote:
      'Deterministic gate hygiene — not legal conformity or Complete scan clearance certification.',
  };
}
/**
 * Build product size note.
 * @param {number} report
 * @returns {any}
 */
function buildProductSizeNote(report) {
  var _a, _b, _c, _d, _e;
  const mockN =
    (_b = (_a = report.mockSampleFiles) !== null && _a !== void 0 ? _a : report.totalFiles) !==
      null && _b !== void 0
      ? _b
      : 0;
  const repoTotal =
    (_e =
      (_c = report.repositoryFilesTotal) !== null && _c !== void 0
        ? _c
        : (_d = report.repositoryInventory) === null || _d === void 0
          ? void 0
          : _d.totalFiles) !== null && _e !== void 0
      ? _e
      : 0;
  if (!report.totalSizeLabel || mockN === 0 || repoTotal === 0) return null;
  if (repoTotal > mockN * 10) {
    return 'totalSizeLabel reflects aggregate mock/sample JSON under configured scan paths — not whole-repository inventory size.';
  }
  return null;
}
/**
 * Build benchmark gate hygiene summary.
 * @param {number} report
 * @returns {any}
 */
function buildBenchmarkGateHygieneSummary(report) {
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
    _z;
  const rawLlm = report.llmSlopScanRaw;
  const scanned =
    (_c =
      (_a = report.llmSlopFilesScanned) !== null && _a !== void 0
        ? _a
        : (_b = report.scanScope) === null || _b === void 0
          ? void 0
          : _b.llmSlopFilesScanned) !== null && _c !== void 0
      ? _c
      : null;
  const reconciled =
    (_d = report.llmSlopScanReconciled) !== null && _d !== void 0
      ? _d
      : (_e = report.scanScope) === null || _e === void 0
        ? void 0
        : _e.llmSlopScanReconciled;
  return {
    gatePass:
      (_g = (_f = report.gate) === null || _f === void 0 ? void 0 : _f.pass) !== null &&
      _g !== void 0
        ? _g
        : null,
    blockingCount:
      (_j = (_h = report.gate) === null || _h === void 0 ? void 0 : _h.blockingCount) !== null &&
      _j !== void 0
        ? _j
        : 0,
    productionLeakFindings: (_k = report.productionLeakFindings) !== null && _k !== void 0 ? _k : 0,
    mockSampleFiles:
      (_m = (_l = report.mockSampleFiles) !== null && _l !== void 0 ? _l : report.totalFiles) !==
        null && _m !== void 0
        ? _m
        : 0,
    ruleScopedFilesAnalyzed:
      (_q =
        (_o = report.ruleScopedFilesAnalyzed) !== null && _o !== void 0
          ? _o
          : (_p = report.scanScope) === null || _p === void 0
            ? void 0
            : _p.ruleScopedFilesAnalyzed) !== null && _q !== void 0
        ? _q
        : null,
    repositoryFilesTotal:
      (_t =
        (_r = report.repositoryFilesTotal) !== null && _r !== void 0
          ? _r
          : (_s = report.repositoryInventory) === null || _s === void 0
            ? void 0
            : _s.totalFiles) !== null && _t !== void 0
        ? _t
        : null,
    fictionJsonFilesScanned:
      (_w =
        (_u = report.fictionJsonFilesScanned) !== null && _u !== void 0
          ? _u
          : (_v = report.scanScope) === null || _v === void 0
            ? void 0
            : _v.fictionJsonFilesScanned) !== null && _w !== void 0
        ? _w
        : null,
    llmSlopFilesScanned: scanned,
    ...(reconciled && rawLlm != null && scanned != null && rawLlm > scanned
      ? { llmSlopScanReconciledFrom: rawLlm }
      : {}),
    qualityScore: (_x = report.qualityScore) !== null && _x !== void 0 ? _x : null,
    benchmarkCloneNoiseExcluded:
      (_z =
        (_y = report.scanScope) === null || _y === void 0
          ? void 0
          : _y.benchmarkCloneNoiseExcluded) !== null && _z !== void 0
        ? _z
        : 0,
    attestationNote:
      'OSS benchmark clone gate hygiene — not Simplebeacon product handoff clearance.',
  };
}
/**
 * Assemble benchmark gate export notes.
 * @param {Array} existingNotes
 * @param {number} report
 * @param {string} context
 * @returns {any}
 */
function assembleBenchmarkGateExportNotes(existingNotes = [], report, context = {}) {
  const dynamic = buildBenchmarkGateExportNotes(report, context);
  const scopeNote =
    'Gate export scoped to github-cache/ OSS clone — not Simplebeacon ai-platform product handoff.';
  const skipPatterns = [
    /gate export scoped to github-cache/i,
    /product mock\/sample scan paths/i,
    /llm slop file count reconciled/i,
    /gate pass on clone reflects oss hygiene/i,
    /re-run gate scan on ai-platform root/i,
  ];
  const filtered = dedupeExportNotes(existingNotes).filter((note) => {
    const text = String(note).toLowerCase();
    return (
      !skipPatterns.some((re) => re.test(text)) &&
      !dynamic.some((entry) => entry.toLowerCase() === text)
    );
  });
  return dedupeExportNotes([...filtered, scopeNote, ...dynamic]);
}
/**
 * Is product default mock scan path.
 * @param {any} entry
 * @returns {any}
 */
function isProductDefaultMockScanPath(entry) {
  const rel = String(entry).replace(/\\/g, '/').replace(/^\.\//, '');
  if (DEFAULT_FALLBACK_MOCK_PATHS.has(rel.toLowerCase())) return true;
  return PRODUCT_MOCK_PATH_MARKERS.some((re) => re.test(rel));
}
/**
 * Is product default mock scan paths.
 * @param {Array} scanPaths
 * @param {Array} mockSampleFiles
 * @returns {any}
 */
function isProductDefaultMockScanPaths(scanPaths, mockSampleFiles) {
  if (!Array.isArray(scanPaths) || scanPaths.length === 0) return false;
  if ((mockSampleFiles !== null && mockSampleFiles !== void 0 ? mockSampleFiles : 0) > 0)
    return false;
  return scanPaths.every((entry) => isProductDefaultMockScanPath(entry));
}
/**
 * Reconcile benchmark scan metrics.
 * @param {number} report
 * @returns {any}
 */
function reconcileBenchmarkScanMetrics(report) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j;
  const repoTotal =
    (_c =
      (_a = report.repositoryFilesTotal) !== null && _a !== void 0
        ? _a
        : (_b = report.repositoryInventory) === null || _b === void 0
          ? void 0
          : _b.totalFiles) !== null && _c !== void 0
      ? _c
      : null;
  const ruleScoped =
    (_f =
      (_d = report.ruleScopedFilesAnalyzed) !== null && _d !== void 0
        ? _d
        : (_e = report.scanScope) === null || _e === void 0
          ? void 0
          : _e.ruleScopedFilesAnalyzed) !== null && _f !== void 0
      ? _f
      : null;
  const cap = repoTotal !== null && repoTotal !== void 0 ? repoTotal : ruleScoped;
  const rawLlm =
    (_j =
      (_g = report.llmSlopFilesScanned) !== null && _g !== void 0
        ? _g
        : (_h = report.scanScope) === null || _h === void 0
          ? void 0
          : _h.llmSlopFilesScanned) !== null && _j !== void 0
      ? _j
      : 0;
  if (cap == null || rawLlm <= cap) return report;
  const scanScope = {
    ...(report.scanScope || {}),
    llmSlopFilesScanned: cap,
    llmSlopScanRaw: rawLlm,
    llmSlopScanReconciled: true,
  };
  return {
    ...report,
    llmSlopFilesScanned: cap,
    llmSlopScanRaw: rawLlm,
    llmSlopScanReconciled: true,
    scanScope,
  };
}
/**
 * Is benchmark gate report.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function isBenchmarkGateReport(report, options = {}) {
  if (options.benchmarkScan != null) return Boolean(options.benchmarkScan);
  if (report.benchmarkScan != null) return Boolean(report.benchmarkScan);
  if (report.scanTargetProfile === 'benchmark-cache') return true;
  return isBenchmarkPath(resolveReportProjectPath(report, options));
}
/**
 * Relativize scan paths.
 * @param {Array} scanPaths
 * @param {any} projectRoot
 * @returns {any}
 */
function relativizeScanPaths(scanPaths, projectRoot) {
  const root = String(projectRoot || '')
    .replace(/\\/g, '/')
    .replace(/\/$/, '');
  const rootLower = root.toLowerCase();
  return (scanPaths || []).map((entry) => {
    let rel = String(entry).replace(/\\/g, '/');
    if (root && rel.toLowerCase().startsWith(rootLower)) {
      rel = rel.slice(root.length).replace(/^\//, '');
    }
    return rel || entry;
  });
}
/**
 * Normalize config path.
 * @param {Object} configPath
 * @param {any} projectRoot
 * @returns {any}
 */
function normalizeConfigPath(configPath, projectRoot) {
  if (!configPath) return configPath;
  let rel = String(configPath).replace(/\\/g, '/');
  const root = String(projectRoot || '')
    .replace(/\\/g, '/')
    .replace(/\/$/, '');
  if (root && rel.toLowerCase().startsWith(root.toLowerCase())) {
    rel = rel.slice(root.length).replace(/^\//, '');
  }
  return rel;
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
 * Resolve gate health status.
 * @param {number} report
 * @returns {any}
 */
function resolveGateHealthStatus(report) {
  var _a, _b, _c, _d, _e;
  const gate = report.gate || {};
  if (!gate.pass) return 'needs-attention';
  const blocking =
    (_b = (_a = gate.blockingCount) !== null && _a !== void 0 ? _a : report.issueCount) !== null &&
    _b !== void 0
      ? _b
      : 0;
  if (blocking > 0) return 'gate-fail';
  const ruleScoped =
    (_e =
      (_c = report.ruleScopedFilesAnalyzed) !== null && _c !== void 0
        ? _c
        : (_d = report.scanScope) === null || _d === void 0
          ? void 0
          : _d.ruleScopedFilesAnalyzed) !== null && _e !== void 0
      ? _e
      : 0;
  if (ruleScoped === 0) return 'limited-scope-pass';
  return 'clean-gate-pass';
}
/**
 * Resolve gate attestation.
 * @param {number} report
 * @param {any} benchmarkScan
 * @returns {any}
 */
function resolveGateAttestation(report, benchmarkScan) {
  if (benchmarkScan) return 'benchmark-clone';
  const health = resolveGateHealthStatus(report);
  if (health === 'limited-scope-pass') return 'limited-scope';
  if (health === 'clean-gate-pass') return 'platform-gate-pass';
  return health;
}
/**
 * Build product gate export notes.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function buildProductGateExportNotes(report, options = {}) {
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
    _15,
    _16,
    _17;
  const notes = [];
  const scope = report.scanScope || {};
  const fictionSamplesEarly =
    (_b =
      (_a = report.fictionSampleFilesScanned) !== null && _a !== void 0
        ? _a
        : scope.fictionSampleFilesScanned) !== null && _b !== void 0
      ? _b
      : 0;
  const fictionJsonEarly =
    (_c = report.fictionJsonFilesScanned) !== null && _c !== void 0
      ? _c
      : scope.fictionJsonFilesScanned;
  const fullTreeEarly = Boolean(report.fullDirectoryScan || scope.fullDirectoryScan);
  const fictionNoteCoversMockReconcile =
    fullTreeEarly &&
    fictionJsonEarly != null &&
    fictionSamplesEarly > 0 &&
    fictionJsonEarly > fictionSamplesEarly;
  if (scope.mockSampleFilesReconciledNote && !fictionNoteCoversMockReconcile) {
    notes.push(scope.mockSampleFilesReconciledNote);
  }
  if (scope.jestExecutedDuringScan === false || report.jestBaselineChecked === false) {
    notes.push(
      'Jest was not run during this scan — use `npm run simplebeacon:full` or `npm test` for live test verification.'
    );
  } else if (
    report.jestBaselinePassed === false &&
    ((_d = report.jestSummary) === null || _d === void 0 ? void 0 : _d.testsFailed)
  ) {
    notes.push(
      `Jest reported ${report.jestSummary.testsFailed} failure(s) — ${report.jestSummary.testsPassed}/${report.jestSummary.testsTotal} passed during scan.`
    );
  }
  const mockN =
    (_f = (_e = report.mockSampleFiles) !== null && _e !== void 0 ? _e : report.totalFiles) !==
      null && _f !== void 0
      ? _f
      : 0;
  const fictionSamples =
    (_h =
      (_g = report.fictionSampleFilesScanned) !== null && _g !== void 0
        ? _g
        : scope.fictionSampleFilesScanned) !== null && _h !== void 0
      ? _h
      : 0;
  if (mockN > 0 && fictionSamples === 0) {
    // simplebeacon:production-leak-intent - legitimate sample path reference for gate reporting
    notes.push(
      `${mockN} JSON file(s) under configured mock paths — fiction KPI rules target *-sample.json filenames; none matched in this pass.`
    );
  }
  const repoTotal =
    (_j = report.repositoryFilesTotal) !== null && _j !== void 0
      ? _j
      : (_k = report.repositoryInventory) === null || _k === void 0
        ? void 0
        : _k.totalFiles;
  const ruleScoped =
    (_l = report.ruleScopedFilesAnalyzed) !== null && _l !== void 0
      ? _l
      : scope.ruleScopedFilesAnalyzed;
  const fullTree = Boolean(report.fullDirectoryScan || scope.fullDirectoryScan);
  if (repoTotal != null && ruleScoped != null) {
    if (fullTree && repoTotal === ruleScoped) {
      notes.push(
        `Full-tree scan — repository inventory and rule-scoped file count both ${Number(repoTotal).toLocaleString()} paths.`
      );
    } else {
      notes.push(
        `Repository inventory ${Number(repoTotal).toLocaleString()} files; gate rules evaluated ${Number(ruleScoped).toLocaleString()} scoped paths (credentials, production dirs, mock samples).`
      );
    }
  }
  const gateRepositoryFilesTotal =
    (_o =
      (_m = options.gateRepositoryFilesTotal) !== null && _m !== void 0
        ? _m
        : options.repositoryFilesTotal) !== null && _o !== void 0
      ? _o
      : null;
  const inventoryProfile =
    ((_p = report.repositoryInventory) === null || _p === void 0 ? void 0 : _p.profile) ||
    (fullTree ? 'full-tree' : 'audit');
  if (
    gateRepositoryFilesTotal != null &&
    repoTotal != null &&
    gateRepositoryFilesTotal > repoTotal
  ) {
    notes.push(
      `repositoryFilesTotal (${Number(repoTotal).toLocaleString()}, ${inventoryProfile} profile) — gate full-tree inventory is ${Number(gateRepositoryFilesTotal).toLocaleString()} paths.`
    );
  }
  if (
    report.filesAnalyzed != null &&
    repoTotal != null &&
    report.filesAnalyzed === repoTotal &&
    mockN > 0 &&
    !scope.mockSampleFilesReconciledNote
  ) {
    notes.push(
      `Top-level filesAnalyzed matches repository inventory — mock-path JSON count is mockSampleFiles (${Number(mockN).toLocaleString()}).`
    );
  }
  if (
    ((_q = report.gate) === null || _q === void 0 ? void 0 : _q.pass) &&
    ((_r = report.issueCount) !== null && _r !== void 0 ? _r : 0) === 0
  ) {
    notes.push(
      'Gate pass on configured severities — hygiene attestation only, not SimpleBeacon vendor security handoff or Complete scan clearance.'
    );
  }
  if (((_s = report.gate) === null || _s === void 0 ? void 0 : _s.pass) === false) {
    const blocking =
      (_v =
        (_u = (_t = report.gate) === null || _t === void 0 ? void 0 : _t.blockingCount) !== null &&
        _u !== void 0
          ? _u
          : report.issueCount) !== null && _v !== void 0
        ? _v
        : 0;
    notes.push(
      `Gate FAIL — ${blocking} blocking finding(s). Review detectedIssues before merge; re-run scan after remediation.`
    );
  }
  if (
    (_x =
      (_w = report.euAiActSummary) === null || _w === void 0 ? void 0 : _w.documentationFound) ===
      null || _x === void 0
      ? void 0
      : _x.length
  ) {
    const euSplit = splitEuAiActSummaryForExport(report.euAiActSummary);
    if (((_y = euSplit.simplebeaconArtifactCount) !== null && _y !== void 0 ? _y : 0) > 0) {
      notes.push(
        `${euSplit.simplebeaconArtifactCount} EU AI Act documentation path(s) under .simplebeacon/ are scan artifacts — prefer docs/ for operator handoff packs.`
      );
    }
    if (((_z = euSplit.scanMatchedNonDocsCount) !== null && _z !== void 0 ? _z : 0) > 0) {
      notes.push(
        `${euSplit.scanMatchedNonDocsCount} EU AI Act scan pattern match(es) outside docs/ (e.g. package.json) — not operator handoff documentation.`
      );
    }
  }
  const contentScanned =
    (_4 =
      (_3 =
        (_1 =
          (_0 = scope.fullDirectoryStats) === null || _0 === void 0
            ? void 0
            : _0.contentScanned) !== null && _1 !== void 0
          ? _1
          : (_2 = scope.fullDirectoryStats) === null || _2 === void 0
            ? void 0
            : _2.filesContentScanned) !== null && _3 !== void 0
        ? _3
        : report.credentialScanned) !== null && _4 !== void 0
      ? _4
      : null;
  const credentialScanned =
    (_6 =
      (_5 = report.credentialScanned) !== null && _5 !== void 0
        ? _5
        : scope.productionDirsScanned) !== null && _6 !== void 0
      ? _6
      : null;
  if (repoTotal != null && credentialScanned != null && credentialScanned < repoTotal) {
    notes.push(
      `Credential/production-leak rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) in server/ and src/ — repository inventory is ${Number(repoTotal).toLocaleString()} paths.`
    );
  }
  if (repoTotal != null && contentScanned != null && contentScanned < repoTotal) {
    const metadataOnly = repoTotal - contentScanned;
    if (metadataOnly > 0) {
      notes.push(
        `${Number(contentScanned).toLocaleString()} file(s) content-scanned; ${Number(metadataOnly).toLocaleString()} binary/metadata-only path(s) hashed for inventory only.`
      );
    }
  }
  const fictionJson =
    (_7 = report.fictionJsonFilesScanned) !== null && _7 !== void 0
      ? _7
      : scope.fictionJsonFilesScanned;
  if (fictionJson != null && fictionSamples > 0 && fictionJson > fictionSamples) {
    // simplebeacon:production-leak-intent - legitimate KPI reference for gate reporting
    notes.push(
      `Fiction KPI rules evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) — ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
    );
  }
  const llmHits =
    (_9 =
      (_8 = report.llmSlopPatternHits) !== null && _8 !== void 0
        ? _8
        : scope.llmSlopPatternHits) !== null && _9 !== void 0
      ? _9
      : 0;
  const ruleLeakHits =
    (_12 =
      (_11 =
        (_10 = scope.fullDirectoryStats) === null || _10 === void 0
          ? void 0
          : _10.ruleHitTotals) === null || _11 === void 0
        ? void 0
        : _11.productionLeak) !== null && _12 !== void 0
      ? _12
      : 0;
  if (
    llmHits > 0 &&
    ((_14 = (_13 = report.gate) === null || _13 === void 0 ? void 0 : _13.blockingCount) !== null &&
    _14 !== void 0
      ? _14
      : 0) === 0
  ) {
    notes.push(
      `${llmHits} LLM-slop pattern match(es) recorded — below gate failOn severity; see scanScope.ruleHitTotals for informational counts.`
    );
  }
  if (
    ruleLeakHits > 0 &&
    ((_15 = report.productionLeakFindings) !== null && _15 !== void 0 ? _15 : 0) === 0
  ) {
    notes.push(
      `${ruleLeakHits} production-leak pattern hit(s) in ruleHitTotals — ${(_16 = report.productionLeakSuppressedIntent) !== null && _16 !== void 0 ? _16 : 0} suppressed as intentional; blocking productionLeakFindings is 0.`
    );
  }
  if (
    scope.profile === 'eu-ai-act' &&
    !options.embeddedInEuAiActSprint &&
    !(
      ((_17 = report.euAiActSummary) === null || _17 === void 0
        ? void 0
        : _17.scanMatchedNonDocsCount) > 0
    )
  ) {
    notes.push(
      'scanScope.profile eu-ai-act names the gate rule bundle — use json/eu-ai-act-sprint.json for the EU AI Act sprint export.'
    );
  }
  return [...new Set(notes)].slice(0, 10);
}
/**
 * Build benchmark gate export notes.
 * @param {number} report
 * @param {string} context
 * @returns {any}
 */
function buildBenchmarkGateExportNotes(report, context = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
  const notes = [];
  const excluded =
    (_d =
      (_b =
        (_a = report.scanScope) === null || _a === void 0
          ? void 0
          : _a.benchmarkCloneNoiseExcluded) !== null && _b !== void 0
        ? _b
        : (_c = report.benchmarkCloneNoiseIssues) === null || _c === void 0
          ? void 0
          : _c.length) !== null && _d !== void 0
      ? _d
      : 0;
  if (excluded > 0) {
    notes.push(
      `${excluded} issue(s) excluded on OSS clone — handoff/EU-AI blog noise and Simplebeacon scanner-source production-leak pattern references (src/ rule engine).`
    );
  }
  if (context.productMockPathsOmitted) {
    notes.push(
      'Product mock/sample scan paths (fixtures, __mocks__, data, web/data) do not exist on this OSS clone — gate rules ran on src/ and repository JSON only.'
    );
  }
  const rawLlm =
    (_g =
      (_e = report.llmSlopScanRaw) !== null && _e !== void 0
        ? _e
        : (_f = report.hygieneSummary) === null || _f === void 0
          ? void 0
          : _f.llmSlopScanReconciledFrom) !== null && _g !== void 0
      ? _g
      : (_h = report.scanScope) === null || _h === void 0
        ? void 0
        : _h.llmSlopScanRaw;
  const scannedLlm =
    (_j = report.llmSlopFilesScanned) !== null && _j !== void 0
      ? _j
      : (_k = report.scanScope) === null || _k === void 0
        ? void 0
        : _k.llmSlopFilesScanned;
  const reconciled =
    (_o =
      (_l = report.llmSlopScanReconciled) !== null && _l !== void 0
        ? _l
        : (_m = report.scanScope) === null || _m === void 0
          ? void 0
          : _m.llmSlopScanReconciled) !== null && _o !== void 0
      ? _o
      : ((_p = report.hygieneSummary) === null || _p === void 0
          ? void 0
          : _p.llmSlopScanReconciledFrom) != null;
  if (reconciled && rawLlm != null && scannedLlm != null && rawLlm > scannedLlm) {
    notes.push(
      `LLM slop file count reconciled from ${rawLlm} to ${scannedLlm} to match repository inventory on benchmark export.`
    );
  }
  if ((_q = report.gate) === null || _q === void 0 ? void 0 : _q.pass) {
    notes.push(
      'Gate pass on clone reflects OSS hygiene only — not Simplebeacon ai-platform product handoff.'
    );
  }
  notes.push(
    'Re-run gate scan on ai-platform root for platform credential and production-leak evidence.'
  );
  return notes;
}
/**
 * Redact benchmark export path fields.
 * @param {any} scanTargetRoot
 * @param {any} productPlatformRoot
 * @returns {any}
 */
function redactBenchmarkExportPathFields(scanTargetRoot, productPlatformRoot) {
  const cloneLabel = projectLabelFromPath(scanTargetRoot);
  const platformLabel = projectLabelFromPath(productPlatformRoot) || 'ai-platform';
  return {
    scanTargetRoot: redactProjectPathForExport(scanTargetRoot, cloneLabel),
    platformRoot: productPlatformRoot
      ? redactProjectPathForExport(productPlatformRoot, platformLabel)
      : undefined,
    productPlatformRoot: productPlatformRoot
      ? redactProjectPathForExport(productPlatformRoot, platformLabel)
      : undefined,
  };
}
/**
 * Apply benchmark gate export fields.
 * @param {any} next
 * @param {number} report
 * @param {string} context
 * @returns {any}
 */
function applyBenchmarkGateExportFields(next, report, context = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const gateHealthStatus = ((_a = next.gate) === null || _a === void 0 ? void 0 : _a.pass)
    ? 'benchmark-clone-pass'
    : 'benchmark-clone-needs-attention';
  const exportNotes = assembleBenchmarkGateExportNotes(report.exportNotes, next, context);
  const sanitizedScope = sanitizeBenchmarkGateScanScope(next.scanScope, next);
  const repoTotal =
    (_d =
      (_b = next.repositoryFilesTotal) !== null && _b !== void 0
        ? _b
        : (_c = next.repositoryInventory) === null || _c === void 0
          ? void 0
          : _c.totalFiles) !== null && _d !== void 0
      ? _d
      : 0;
  const sizeOmitted =
    ((_e = next.totalSizeBytes) !== null && _e !== void 0 ? _e : 0) === 0 && repoTotal > 0;
  const result = {
    ...next,
    ...(sizeOmitted ? { totalSizeLabel: null, inventorySizeOmitted: true } : {}),
    benchmarkScan: true,
    scanTargetProfile: 'benchmark-cache',
    handoffEligible: false,
    securityHandoffEligible: false,
    exportNormalized: true,
    title: next.title || 'OSS Clone Gate Scan (github-cache benchmark)',
    gateHealthStatus,
    gateAttestation: next.gateAttestation || resolveGateAttestation(next, true),
    scanScope: sanitizedScope,
    hygieneSummary: buildBenchmarkGateHygieneSummary({ ...next, scanScope: sanitizedScope }),
    exportNotes,
  };
  if (next.llmSlopScanReconciled && next.llmSlopScanRaw != null) {
    delete result.llmSlopScanRaw;
  }
  const mockSampleN =
    (_g = (_f = next.mockSampleFiles) !== null && _f !== void 0 ? _f : next.totalFiles) !== null &&
    _g !== void 0
      ? _g
      : 0;
  if (mockSampleN === 0 && repoTotal > 0) {
    result.totalFilesNote =
      'Mock/sample JSON count under configured scan paths — see repositoryFilesTotal for clone inventory.';
  }
  if (context.productMockPathsOmitted) {
    result.scanPaths = [];
    result.scanPathsProductDefaultsOmitted = next.scanPaths;
    result.scanPathsNote =
      'Simplebeacon product mock/sample paths are not walked on OSS benchmark clones.';
    if (result.scanScope) {
      result.scanScope = {
        ...result.scanScope,
        mockSamplePathsOmitted: next.scanPaths,
        mockSampleFilesInScanPaths: 0,
      };
    }
  }
  return result;
}
/**
 * Reconcile product full directory mock metrics.
 * @param {number} report
 * @returns {any}
 */
function reconcileProductFullDirectoryMockMetrics(report) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  if (!report || report.benchmarkScan) return report;
  const fullTree = Boolean(
    report.fullDirectoryScan ||
    ((_a = report.scanScope) === null || _a === void 0 ? void 0 : _a.fullDirectoryScan)
  );
  if (!fullTree) return report;
  const scanScope = report.scanScope || {};
  const mockInPaths =
    (_b = scanScope.mockSampleFilesInScanPaths) !== null && _b !== void 0 ? _b : 0;
  const ruleScoped =
    (_d =
      (_c = report.ruleScopedFilesAnalyzed) !== null && _c !== void 0
        ? _c
        : scanScope.ruleScopedFilesAnalyzed) !== null && _d !== void 0
      ? _d
      : 0;
  const topMock =
    (_f = (_e = report.mockSampleFiles) !== null && _e !== void 0 ? _e : report.totalFiles) !==
      null && _f !== void 0
      ? _f
      : null;
  const fictionSamples =
    (_h =
      (_g = report.fictionSampleFilesScanned) !== null && _g !== void 0
        ? _g
        : scanScope.fictionSampleFilesScanned) !== null && _h !== void 0
      ? _h
      : null;
  let reconciledMock = topMock;
  if (
    fictionSamples != null &&
    topMock != null &&
    fictionSamples < topMock &&
    topMock >= ruleScoped &&
    ruleScoped > 0
  ) {
    reconciledMock = fictionSamples;
  } else if (
    mockInPaths >= ruleScoped &&
    ruleScoped > 0 &&
    fictionSamples != null &&
    fictionSamples < mockInPaths
  ) {
    reconciledMock = fictionSamples;
  }
  let nextScanScope = scanScope;
  if (
    mockInPaths > 0 &&
    reconciledMock != null &&
    mockInPaths > reconciledMock &&
    mockInPaths >= ruleScoped
  ) {
    nextScanScope = {
      ...scanScope,
      mockSampleFilesInScanPaths: reconciledMock,
      mockSampleFilesReconciledNote:
        // simplebeacon:production-leak-intent - legitimate sample path reference for gate reporting
        `mockSampleFilesInScanPaths reconciled from ${Number(mockInPaths).toLocaleString()} to ${Number(reconciledMock).toLocaleString()} — full-directory scan counts repo-wide paths, not *-sample.json only.`,
    };
  }
  if (reconciledMock === topMock && nextScanScope === scanScope) return report;
  return {
    ...report,
    ...(reconciledMock !== topMock ? { mockSampleFiles: reconciledMock } : {}),
    scanScope: nextScanScope,
  };
}
/**
 * Enrich product scan scope.
 * @param {any} scanScope
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function enrichProductScanScope(scanScope, report = {}, options = {}) {
  var _a;
  const intentionalFullTree = Boolean(report.fullDirectoryScan || scanScope.fullDirectoryScan);
  return {
    ...scanScope,
    resultsViewScope: scanScope.resultsViewScope || 'platform-only',
    reportHealth: intentionalFullTree
      ? 'platform-scoped-full-tree'
      : scanScope.reportHealth || 'platform-scoped',
    rescanRecommended: intentionalFullTree ? false : Boolean(scanScope.rescanRecommended),
    inventoryMetricsStale: intentionalFullTree
      ? false
      : (_a = scanScope.inventoryMetricsStale) !== null && _a !== void 0
        ? _a
        : false,
    securityHandoffEligible: false,
    gateExportNote:
      'Gate report export — run Complete scan for unified clearance bundle; gate pass alone is not vendor handoff.',
    ...(scanScope.profile === 'eu-ai-act'
      ? {
          gateRuleBundleProfile: 'eu-ai-act',
          gateRuleBundleNote: options.embeddedInEuAiActSprint
            ? 'EU AI Act sprint embeds eu-ai-act gate rule bundle — compare json/simplebeacon-gate.json for full-tree inventory.'
            : 'EU AI Act pattern rules included in gate bundle — see json/eu-ai-act-sprint.json for sprint export.',
        }
      : {}),
  };
}
/**
 * Sanitize simplebeacon report export.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeSimplebeaconReportExport(report, options = {}) {
  var _a, _b, _c;
  if (!report || report.type !== 'simplebeacon-report') return report;
  const projectPath = resolveReportProjectPath(report, options);
  let next = normalizeBenchmarkGateReport(report, projectPath);
  const benchmarkScan = isBenchmarkGateReport(next, { ...options, projectPath });
  const productPlatformRoot = benchmarkScan
    ? options.productPlatformRoot ||
      resolveProductPlatformRoot(projectPath) ||
      next.productPlatformRoot ||
      next.platformRoot
    : null;
  const scanTargetRoot = projectPath || undefined;
  const scanPaths = relativizeScanPaths(next.scanPaths, scanTargetRoot);
  const configPath = normalizeConfigPath(next.configPath, scanTargetRoot);
  next = {
    ...next,
    projectRoot: scanTargetRoot || next.projectRoot,
    ...(configPath != null ? { configPath } : {}),
    scanPaths,
    ...(next.repositoryInventory
      ? {
          repositoryInventory: {
            ...next.repositoryInventory,
            projectRoot: scanTargetRoot || next.repositoryInventory.projectRoot,
          },
        }
      : {}),
    exportSanitized: true,
  };
  if (benchmarkScan) {
    const mockSampleFiles =
      (_b = (_a = next.mockSampleFiles) !== null && _a !== void 0 ? _a : next.totalFiles) !==
        null && _b !== void 0
        ? _b
        : 0;
    const productMockPathsOmitted = isProductDefaultMockScanPaths(next.scanPaths, mockSampleFiles);
    next = reconcileBenchmarkScanMetrics(next);
    const projectLabel = projectLabelFromPath(scanTargetRoot);
    const redactedPaths = redactBenchmarkExportPathFields(scanTargetRoot, productPlatformRoot);
    return stripInternalReportExportFields({
      ...applyBenchmarkGateExportFields(next, report, { productMockPathsOmitted }),
      exportVersion: '1.1.0',
      exportSanitized: true,
      projectRoot: redactProjectPathForExport(scanTargetRoot, projectLabel),
      ...(next.repositoryInventory
        ? {
            repositoryInventory: {
              ...next.repositoryInventory,
              projectRoot: redactProjectPathForExport(scanTargetRoot, projectLabel),
            },
          }
        : {}),
      disclaimers: [
        'Benchmark gate export — OSS clone under github-cache/, not Simplebeacon product handoff.',
        'detectedIssues is the operator-facing issue list; rawIssues are omitted from exports.',
        'Absolute host paths are redacted to project label in product exports.',
      ],
      ...redactedPaths,
    });
  }
  const gateHealthStatus = resolveGateHealthStatus(next);
  next = reconcileProductFullDirectoryMockMetrics(next);
  const exportNotes = buildProductGateExportNotes(next, options);
  const projectLabel = projectLabelFromPath(scanTargetRoot);
  const totalSizeNote = buildProductSizeNote(next);
  const exportReady = next.euAiActSummary
    ? { ...next, euAiActSummary: splitEuAiActSummaryForExport(next.euAiActSummary) }
    : next;
  const jestExecuted =
    exportReady.jestBaselineChecked !== false &&
    ((_c = exportReady.scanScope) === null || _c === void 0
      ? void 0
      : _c.jestExecutedDuringScan) !== false;
  return stripInternalReportExportFields({
    ...exportReady,
    ...(jestExecuted ? {} : { jestBaselinePassed: null, jestSummary: null }),
    exportVersion: '1.1.0',
    exportSanitized: true,
    exportNormalized: true,
    benchmarkScan: false,
    scanTargetProfile: 'product',
    securityHandoffEligible: false,
    handoffEligible: false,
    generatedBy: normalizeSimpleBeaconBranding(exportReady.generatedBy || 'SimpleBeacon'),
    title: normalizeSimpleBeaconBranding(exportReady.title || 'SimpleBeacon Platform Gate Scan'),
    gateHealthStatus,
    gateAttestation: resolveGateAttestation(next, false),
    projectRoot: redactProjectPathForExport(scanTargetRoot, projectLabel),
    ...(totalSizeNote ? { totalSizeNote } : {}),
    ...(exportReady.repositoryInventory
      ? {
          repositoryInventory: {
            ...exportReady.repositoryInventory,
            projectRoot: redactProjectPathForExport(scanTargetRoot, projectLabel),
          },
        }
      : {}),
    hygieneSummary: buildProductHygieneSummary(next, options),
    scanScope: enrichProductScanScope(next.scanScope || {}, next, options),
    scanTargetRoot: redactProjectPathForExport(scanTargetRoot || next.scanTargetRoot, projectLabel),
    exportNotes: dedupeExportNotes(
      filterStaleGateExportNotes(
        report.exportSanitized || report.exportNormalized ? [] : report.exportNotes || []
      ).concat(exportNotes)
    ).map((note) => normalizeSimpleBeaconBranding(note)),
    disclaimers: [
      'Gate report export — credential, production-leak, schema, and fiction KPI rules in configured scan scope.',
      'detectedIssues is the operator-facing issue list; rawIssues are omitted from exports.',
      'Absolute host paths are redacted to project label in product exports.',
    ],
  });
}
/**
 * Simplebeacon report export filename.
 * @param {any} date
 * @returns {any}
 */
export function simplebeaconReportExportFilename(date = new Date()) {
  const stamp = date.toISOString().slice(0, 10);
  return `simplebeacon-report-${stamp}.json`;
}
export { isBenchmarkDigestExcludedIssue };
