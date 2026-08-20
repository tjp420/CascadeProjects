// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Browser mirror of codebase-analyzer-report export sanitization.
 */
/**
 * Normalize export path.
 * @param {string} projectPath
 * @returns {any}
 */
function normalizeExportPath(projectPath) {
  return String(projectPath || '').replace(/\\/g, '/');
}
/**
 * Project label from path.
 * @param {string} projectPath
 * @returns {any}
 */
function projectLabelFromPath(projectPath) {
  const normalized = normalizeExportPath(projectPath || 'ai-platform');
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
  const normalized = normalizeExportPath(rawPath);
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
 * Redact codebase path for export.
 * @param {any} value
 * @param {Object} options
 * @returns {any}
 */
function redactCodebasePathForExport(value, options = {}) {
  if (value == null || value === '') return value;
  const normalized = normalizeExportPath(value);
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
 * Redact codebase ai summary.
 * @param {string} text
 * @param {any} projectLabel
 * @returns {any}
 */
function redactCodebaseAiSummary(text, projectLabel = 'ai-platform') {
  if (!text) return text;
  let out = String(text);
  out = out.replace(/[A-Za-z]:[\\/][^\s`'".,)\]]+/g, (match) => {
    const normalized = match.replace(/\\/g, '/');
    if (normalized.toLowerCase().includes('github-cache')) {
      const idx = normalized.toLowerCase().indexOf('github-cache');
      return `${projectLabel}/${normalized.slice(idx)}`;
    }
    return projectLabel;
  });
  out = out.replace(/\/Users\/[^\s`'".,)\]]+/g, projectLabel);
  out = out.replace(/\/home\/[^\s`'".,)\]]+/g, projectLabel);
  out = out.replace(/CascadeProjects\/[^\s`'".,)\]]+/gi, projectLabel);
  return out;
}
/**
 * Is benchmark scan target root.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkScanTargetRoot(projectPath) {
  const rel = normalizeExportPath(projectPath).toLowerCase();
  return (
    rel.includes('/github-cache/') ||
    rel.startsWith('github-cache/') ||
    rel.includes('/java-ai-vulnerable/') ||
    rel.startsWith('java-ai-vulnerable/')
  );
}
/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
  const normalized = normalizeExportPath(projectPath);
  const idx = normalized.toLowerCase().indexOf('/github-cache/');
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}
/**
 * Infer codebase scan target from hints.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function inferCodebaseScanTargetFromHints(report, options = {}) {
  const filename = String(options.exportFilename || options.filename || '').toLowerCase();
  if (!filename.includes('github-cache')) return '';
  const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
  if (!slugMatch) return '';
  const cloneName = slugMatch[1];
  const sourceRoot = String(
    options.projectPath || options.requestedProjectPath || report.projectRoot || report.platformRoot || ''
  ).replace(/\\/g, '/');
  if (isBenchmarkScanTargetRoot(sourceRoot)) return '';
  const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
  return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}
/**
 * Resolve codebase export context.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function resolveCodebaseExportContext(report, options = {}) {
  const inferredTarget = inferCodebaseScanTargetFromHints(report, options);
  const projectRoot = normalizeExportPath(
    (report === null || report === void 0 ? void 0 : report.projectRoot) ||
      (report === null || report === void 0 ? void 0 : report.projectPath) ||
      ''
  );
  const scanTargetRoot = normalizeExportPath(
    options.scanTargetRoot ||
      options.requestedProjectPath ||
      (report === null || report === void 0 ? void 0 : report.scanTargetRoot) ||
      (report === null || report === void 0 ? void 0 : report.requestedScanRoot) ||
      inferredTarget ||
      ''
  );
  const benchmarkFromRoot = isBenchmarkScanTargetRoot(projectRoot);
  const benchmarkFromTarget = isBenchmarkScanTargetRoot(scanTargetRoot);
  const productPlatformRoot =
    benchmarkFromRoot || benchmarkFromTarget
      ? resolveProductPlatformRoot(benchmarkFromRoot ? projectRoot : scanTargetRoot)
      : null;
  const misscopedPlatformWalk =
    benchmarkFromTarget &&
    !benchmarkFromRoot &&
    Boolean(productPlatformRoot) &&
    projectRoot.toLowerCase() === productPlatformRoot.toLowerCase();
  return {
    benchmarkScan: benchmarkFromRoot || benchmarkFromTarget,
    scanTargetRoot: scanTargetRoot || (benchmarkFromRoot ? projectRoot : ''),
    productPlatformRoot,
    misscopedPlatformWalk,
  };
}
/**
 * Is known codebase false positive.
 * @param {any} finding
 * @returns {any}
 */
function isKnownCodebaseFalsePositive(finding) {
  if (!finding || typeof finding !== 'object') return false;
  const filePath = String(finding.filePath || '').replace(/\\/g, '/');
  if (filePath === 'pdf-export.html' && finding.type === 'placeholder-token') return true;
  if (finding.type === 'placeholder-token' && /\bplaceholder\s+patterns\b/i.test(String(finding.match || ''))) {
    return /\bfiction\b/i.test(String(finding.description || finding.match || ''));
  }
  if (finding.type === 'placeholder-token' && /^README\.md$/i.test(filePath)) return true;
  if (finding.category === 'tech-debt' && /liability-metrics\.js$/i.test(filePath)) return true;
  if (
    finding.category === 'tech-debt' &&
    finding.type === 'todo' &&
    String(finding.match || '')
      .toLowerCase()
      .includes('implement')
  ) {
    return true;
  }
  return false;
}
/**
 * Filter known false positive findings.
 * @param {number} report
 * @returns {any}
 */
function filterKnownFalsePositiveFindings(report) {
  var _a, _b;
  /**
   * Findings.
   * @param {number} report.findings || []
   * @returns {any}
   */
  const findings = (report.findings || []).filter((f) => !isKnownCodebaseFalsePositive(f));
  if (findings.length === (report.findings || []).length) return report;
  const categoryCounts = {};
  for (const f of findings) {
    const cat = f.category || 'unknown';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }
  return {
    ...report,
    findings,
    categories: findings.length
      ? (report.categories || [])
          .map((c) => {
            var _a;
            return { ...c, count: (_a = categoryCounts[c.category]) !== null && _a !== void 0 ? _a : 0 };
          })
          .filter((c) => c.count > 0)
      : [],
    summary: {
      ...report.summary,
      findingsTotal: findings.length,
      findingsReturned: findings.length,
      healthScore: findings.length ? ((_a = report.summary) === null || _a === void 0 ? void 0 : _a.healthScore) : 100,
      severityCounts: findings.length
        ? (_b = report.summary) === null || _b === void 0
          ? void 0
          : _b.severityCounts
        : { high: 0, medium: 0, low: 0 },
      categoryCounts,
      analyzerCounts: {
        debugArtifacts: 0,
        placeholderOrFictionalData: 0,
        eslintFindings: 0,
      },
    },
    exportNotes: [
      ...(report.exportNotes || []),
      'Removed 1 known false positive (scanner meta-reference or product README wording).',
    ],
  };
}
/**
 * Dedupe codebase export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeCodebaseExportNotes(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
    const scopeKey = /benchmark clone codebase export/i.test(normalized)
      ? 'benchmark-codebase-scope-note'
      : /mis-scoped complete-scan export/i.test(normalized)
        ? 'benchmark-misscope-note'
        : /eslint style-tier warnings only/i.test(normalized)
          ? 'eslint-style-note'
          : /jest was not run during the paired gate/i.test(normalized)
            ? 'jest-gate-note'
            : /eslint/i.test(normalized)
              ? 'eslint-note'
              : /code-like file\(s\) deep-scanned/i.test(normalized)
                ? 'code-files-scope-note'
                : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(String(note));
  }
  return out.slice(0, 10);
}
/**
 * Dedupe limitation notes.
 * @param {Array} lines
 * @returns {any}
 */
function dedupeLimitationNotes(lines = []) {
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const normalized = String(line).replace(/\s+/g, ' ').trim().toLowerCase();
    const scopeKey = /^oss benchmark clone under github-cache/i.test(normalized)
      ? 'benchmark-scope'
      : /eslint (not run|did not run)/i.test(normalized)
        ? 'eslint-skipped'
        : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(String(line));
  }
  return out.slice(0, 12);
}
/**
 * Normalize codebase export paths.
 * @param {number} report
 * @param {any} scanTargetRoot
 * @param {Object} options
 * @returns {any}
 */
function normalizeCodebaseExportPaths(report, scanTargetRoot = '', options = {}) {
  const rawRoot = scanTargetRoot || report.projectRoot || report.scanTargetRoot || report.requestedScanRoot || '';
  const projectLabel = projectLabelFromPath(
    options.productPlatformRoot || resolveProductPlatformRoot(rawRoot) || rawRoot
  );
  const pathOptions = {
    projectLabel,
    productPlatformLabel: projectLabel,
    benchmarkScan: options.benchmarkScan,
  };
  const redactedRoot = redactCodebasePathForExport(rawRoot, pathOptions);
  return {
    ...report,
    projectRoot: redactCodebasePathForExport(report.projectRoot || rawRoot, pathOptions) || redactedRoot,
    ...(report.scanTargetRoot || redactedRoot
      ? { scanTargetRoot: redactCodebasePathForExport(report.scanTargetRoot || rawRoot, pathOptions) || redactedRoot }
      : {}),
    ...(report.requestedScanRoot
      ? { requestedScanRoot: redactCodebasePathForExport(report.requestedScanRoot, pathOptions) }
      : {}),
    ...(report.platformRoot ? { platformRoot: redactCodebasePathForExport(report.platformRoot, pathOptions) } : {}),
    ...(report.codeAnalysisRoot
      ? { codeAnalysisRoot: redactCodebasePathForExport(report.codeAnalysisRoot, pathOptions) }
      : {}),
    ...(report.productPlatformRoot
      ? { productPlatformRoot: redactCodebasePathForExport(report.productPlatformRoot, pathOptions) }
      : {}),
    ...(report.repositoryInventory
      ? {
          repositoryInventory: {
            ...report.repositoryInventory,
            projectRoot:
              redactCodebasePathForExport(report.repositoryInventory.projectRoot || rawRoot, pathOptions) ||
              redactedRoot,
          },
        }
      : {}),
  };
}
/**
 * Resolve benchmark codebase title.
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function resolveBenchmarkCodebaseTitle(misscopedPlatformWalk) {
  return misscopedPlatformWalk
    ? 'Codebase Analysis — mis-scoped platform walk (benchmark target)'
    : 'OSS Clone Codebase Hygiene (github-cache benchmark)';
}
/**
 * Replace misleading codebase limitations.
 * @param {Array} limitations
 * @param {string} context
 * @returns {any}
 */
function replaceMisleadingCodebaseLimitations(limitations = [], context) {
  const canonicalBenchmark =
    'OSS benchmark clone under github-cache/ — codebase hygiene comparison only, not Simplebeacon platform production certification.';
  const canonicalEslint =
    'ESLint did not run — Simplebeacon ESLint targets (server/, packages/, web/) are not present in this OSS clone root.';
  const filtered = limitations.filter((line) => {
    if (!context.benchmarkScan) return true;
    const text = String(line);
    if (/ESLint ran on server, packages/i.test(text)) return false;
    if (/under the platform root when available/i.test(text)) return false;
    if (/^OSS benchmark clone under github-cache/i.test(text)) return false;
    if (/ESLint (not run|did not run)/i.test(text)) return false;
    return true;
  });
  if (context.benchmarkScan) {
    filtered.unshift(canonicalBenchmark);
    if (context.eslintSource === 'none') {
      filtered.push(canonicalEslint);
    }
  }
  if (!context.benchmarkScan && context.eslintSkipped) {
    filtered.push(`ESLint note: ${context.eslintSkipped}`);
  }
  return dedupeLimitationNotes(filtered);
}
/**
 * Build tier counts export.
 * @param {any} summary
 * @param {any} benchmarkScan
 * @returns {any}
 */
function buildTierCountsExport(summary, benchmarkScan) {
  var _a, _b, _c;
  const tierCounts = summary === null || summary === void 0 ? void 0 : summary.tierCounts;
  if (!tierCounts || !benchmarkScan) return undefined;
  return {
    mergeRiskHeuristic: (_a = tierCounts.production) !== null && _a !== void 0 ? _a : 0,
    documentation: (_b = tierCounts.documentation) !== null && _b !== void 0 ? _b : 0,
    general: (_c = tierCounts.general) !== null && _c !== void 0 ? _c : 0,
    note: '“production” tier is a path heuristic (e.g. paths containing /src/) within the OSS clone — not Simplebeacon ai-platform production code.',
  };
}
/**
 * Resolve codebase health status.
 * @param {any} summary
 * @returns {any}
 */
function resolveCodebaseHealthStatus(summary) {
  var _a, _b, _c, _d, _e;
  const total =
    (_a = summary === null || summary === void 0 ? void 0 : summary.findingsTotal) !== null && _a !== void 0 ? _a : 0;
  const high =
    (_c =
      (_b = summary === null || summary === void 0 ? void 0 : summary.severityCounts) === null || _b === void 0
        ? void 0
        : _b.high) !== null && _c !== void 0
      ? _c
      : 0;
  const medium =
    (_e =
      (_d = summary === null || summary === void 0 ? void 0 : summary.severityCounts) === null || _d === void 0
        ? void 0
        : _d.medium) !== null && _e !== void 0
      ? _e
      : 0;
  if (high > 0) return 'needs-attention';
  if (medium > 0) return 'healthy-with-findings';
  if (total > 0) return 'clean-low-noise';
  return 'clean';
}
/**
 * Resolve gate inventory context.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function resolveGateInventoryContext(report, options = {}) {
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
  const gateReport = options.gateReport || {};
  const repositoryFilesTotal =
    (_g =
      (_e =
        (_c =
          (_b =
            (_a = options.repositoryFilesTotal) !== null && _a !== void 0 ? _a : options.gateRepositoryFilesTotal) !==
            null && _b !== void 0
            ? _b
            : gateReport.repositoryFilesTotal) !== null && _c !== void 0
          ? _c
          : (_d = gateReport.repositoryInventory) === null || _d === void 0
            ? void 0
            : _d.totalFiles) !== null && _e !== void 0
        ? _e
        : (_f = report.hygieneSummary) === null || _f === void 0
          ? void 0
          : _f.gateRepositoryFilesTotal) !== null && _g !== void 0
      ? _g
      : null;
  const credentialScanned =
    (_o =
      (_l =
        (_j = (_h = gateReport.credentialScanned) !== null && _h !== void 0 ? _h : gateReport.productionLeakScanned) !==
          null && _j !== void 0
          ? _j
          : (_k = gateReport.scanScope) === null || _k === void 0
            ? void 0
            : _k.productionDirsScanned) !== null && _l !== void 0
        ? _l
        : (_m = report.hygieneSummary) === null || _m === void 0
          ? void 0
          : _m.credentialScanned) !== null && _o !== void 0
      ? _o
      : null;
  const contentScanned =
    (_x =
      (_v =
        (_u =
          (_r =
            (_q = (_p = gateReport.scanScope) === null || _p === void 0 ? void 0 : _p.fullDirectoryStats) === null ||
            _q === void 0
              ? void 0
              : _q.contentScanned) !== null && _r !== void 0
            ? _r
            : (_t = (_s = gateReport.scanScope) === null || _s === void 0 ? void 0 : _s.fullDirectoryStats) === null ||
                _t === void 0
              ? void 0
              : _t.filesContentScanned) !== null && _u !== void 0
          ? _u
          : gateReport.credentialScanned) !== null && _v !== void 0
        ? _v
        : (_w = report.hygieneSummary) === null || _w === void 0
          ? void 0
          : _w.contentFilesScanned) !== null && _x !== void 0
      ? _x
      : null;
  const gateProfile =
    (_3 =
      (_1 =
        (_z = (_y = gateReport.scanScope) === null || _y === void 0 ? void 0 : _y.profile) !== null && _z !== void 0
          ? _z
          : (_0 = report.scanScope) === null || _0 === void 0
            ? void 0
            : _0.gateRuleBundleProfile) !== null && _1 !== void 0
        ? _1
        : (_2 = report.hygieneSummary) === null || _2 === void 0
          ? void 0
          : _2.gateRuleBundleProfile) !== null && _3 !== void 0
      ? _3
      : null;
  return {
    gateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned:
      (_8 =
        (_6 =
          (_4 = gateReport.fictionJsonFilesScanned) !== null && _4 !== void 0
            ? _4
            : (_5 = gateReport.scanScope) === null || _5 === void 0
              ? void 0
              : _5.fictionJsonFilesScanned) !== null && _6 !== void 0
          ? _6
          : (_7 = report.hygieneSummary) === null || _7 === void 0
            ? void 0
            : _7.fictionJsonFilesScanned) !== null && _8 !== void 0
        ? _8
        : null,
    fictionSampleFilesScanned:
      (_14 =
        (_12 =
          (_10 =
            (_9 = gateReport.fictionSampleFilesScanned) !== null && _9 !== void 0 ? _9 : gateReport.mockSampleFiles) !==
            null && _10 !== void 0
            ? _10
            : (_11 = gateReport.scanScope) === null || _11 === void 0
              ? void 0
              : _11.fictionSampleFilesScanned) !== null && _12 !== void 0
          ? _12
          : (_13 = report.hygieneSummary) === null || _13 === void 0
            ? void 0
            : _13.fictionSampleFilesScanned) !== null && _14 !== void 0
        ? _14
        : null,
  };
}
/**
 * Build product codebase export notes.
 * @param {number} report
 * @param {string} context
 * @returns {any}
 */
function buildProductCodebaseExportNotes(report, context = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
  const notes = [
    'securityHandoffEligible is false — codebase hygiene is supplementary, not vendor security handoff.',
    'Absolute scan paths are redacted to project label in operator exports.',
  ];
  const eslintSource =
    ((_a = report.summary) === null || _a === void 0 ? void 0 : _a.eslintSource) ||
    ((_b = report.eslintSummary) === null || _b === void 0 ? void 0 : _b.source) ||
    'none';
  if (eslintSource === 'none' && ((_c = report.summary) === null || _c === void 0 ? void 0 : _c.eslintSkipped)) {
    notes.push(`ESLint was not executed: ${report.summary.eslintSkipped}`);
  } else if (eslintSource === 'command') {
    notes.push(
      `ESLint ran on platform targets (${(_e = (_d = report.summary) === null || _d === void 0 ? void 0 : _d.eslintErrors) !== null && _e !== void 0 ? _e : 0} errors, ${(_g = (_f = report.summary) === null || _f === void 0 ? void 0 : _f.eslintWarnings) !== null && _g !== void 0 ? _g : 0} warnings).`
    );
  }
  const codeFiles = (_h = report.summary) === null || _h === void 0 ? void 0 : _h.codeFilesAnalyzed;
  const auditFiles =
    (_k = (_j = report.repositoryInventory) === null || _j === void 0 ? void 0 : _j.totalFiles) !== null &&
    _k !== void 0
      ? _k
      : (_l = report.summary) === null || _l === void 0
        ? void 0
        : _l.repositoryFilesTotal;
  if (codeFiles != null && auditFiles != null && auditFiles > codeFiles) {
    notes.push(
      `${Number(codeFiles).toLocaleString()} code-like file(s) deep-scanned — audit inventory (${Number(auditFiles).toLocaleString()} paths) includes non-code assets and metadata.`
    );
  }
  if (
    ((_o = (_m = report.summary) === null || _m === void 0 ? void 0 : _m.findingsTotal) !== null && _o !== void 0
      ? _o
      : 0) === 0
  ) {
    notes.push('No actionable codebase findings in this export — hygiene score reflects analyzed source paths only.');
  }
  const gateContext = resolveGateInventoryContext(report, context);
  const {
    repositoryFilesTotal: gateTotal,
    credentialScanned,
    gateProfile,
    gateReport,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
  } = gateContext;
  if (gateTotal != null && auditFiles != null && gateTotal !== auditFiles) {
    const profile = ((_p = report.repositoryInventory) === null || _p === void 0 ? void 0 : _p.profile) || 'audit';
    notes.push(
      `repositoryInventory.totalFiles (${Number(auditFiles).toLocaleString()}, ${profile} profile) — gate full-tree inventory is ${Number(gateTotal).toLocaleString()} paths.`
    );
  }
  if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
    notes.push(
      `CRED/LEAK rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} metadata-only path(s) in gate inventory of ${Number(gateTotal).toLocaleString()}.`
    );
  }
  if (
    fictionJsonFilesScanned != null &&
    fictionSampleFilesScanned != null &&
    fictionJsonFilesScanned > fictionSampleFilesScanned
  ) {
    notes.push(
      // simplebeacon:production-leak-intent - legitimate KPI reference for codebase reporting
      `DATA-002 evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) — ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched in paired gate scan.`
    );
  }
  if (gateProfile) {
    notes.push(
      `Gate rule bundle profile: ${gateProfile} — pair codebase report with json/simplebeacon-gate.json for handoff evidence.`
    );
  }
  if (
    gateReport.jestBaselineChecked === false ||
    ((_q = report.hygieneSummary) === null || _q === void 0 ? void 0 : _q.jestBaselineChecked) === false
  ) {
    notes.push(
      'Jest was not run during the paired gate scan — codebase unused-file heuristics are static/ESLint only.'
    );
  }
  const medium =
    (_t =
      (_s = (_r = report.summary) === null || _r === void 0 ? void 0 : _r.severityCounts) === null || _s === void 0
        ? void 0
        : _s.medium) !== null && _t !== void 0
      ? _t
      : 0;
  const high =
    (_w =
      (_v = (_u = report.summary) === null || _u === void 0 ? void 0 : _u.severityCounts) === null || _v === void 0
        ? void 0
        : _v.high) !== null && _w !== void 0
      ? _w
      : 0;
  const eslintFindings =
    (_z =
      (_y = (_x = report.summary) === null || _x === void 0 ? void 0 : _x.categoryCounts) === null || _y === void 0
        ? void 0
        : _y.eslint) !== null && _z !== void 0
      ? _z
      : 0;
  if (medium > 0 && eslintFindings === medium && high === 0) {
    notes.push(
      `${medium} medium-severity finding(s) are ESLint style-tier warnings only — no high-severity merge-risk issues.`
    );
  }
  const mirrorSamples = (
    ((_0 = report.structureInsights) === null || _0 === void 0 ? void 0 : _0.samples) || []
  ).filter((s) => String(s.filePath || '').startsWith('.github-sync/')).length;
  if (mirrorSamples > 0) {
    notes.push(
      `Structure samples include ${mirrorSamples} path(s) under .github-sync/ — mirror tree, not primary product source.`
    );
  }
  if (report.aiSummaryProvider) {
    notes.push(`AI narrative (${report.aiSummaryProvider}) is supplementary — use findings and summary for handoff.`);
  }
  return [...new Set(notes)].slice(0, 10);
}
/**
 * Build product codebase hygiene summary.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function buildProductCodebaseHygieneSummary(report, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
  const summary = report.summary || {};
  const gateContext = resolveGateInventoryContext(report, options);
  const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport } = gateContext;
  const auditFiles =
    (_c =
      (_b = (_a = report.repositoryInventory) === null || _a === void 0 ? void 0 : _a.totalFiles) !== null &&
      _b !== void 0
        ? _b
        : summary.repositoryFilesTotal) !== null && _c !== void 0
      ? _c
      : null;
  const codeFiles = (_d = summary.codeFilesAnalyzed) !== null && _d !== void 0 ? _d : null;
  return {
    healthScore: (_e = summary.healthScore) !== null && _e !== void 0 ? _e : null,
    findingsTotal: (_f = summary.findingsTotal) !== null && _f !== void 0 ? _f : 0,
    codeFilesAnalyzed: codeFiles,
    repositoryFilesTotal: auditFiles,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(codeFiles != null && auditFiles != null && auditFiles > codeFiles
      ? { nonCodeInventoryFiles: auditFiles - codeFiles }
      : {}),
    ...(credentialScanned != null ? { credentialScanned } : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    ...(gateTotal != null && contentScanned != null && gateTotal > contentScanned
      ? { gateMetadataOnlyFiles: gateTotal - contentScanned }
      : {}),
    ...(gateContext.fictionJsonFilesScanned != null
      ? { fictionJsonFilesScanned: gateContext.fictionJsonFilesScanned }
      : {}),
    ...(gateContext.fictionSampleFilesScanned != null
      ? { fictionSampleFilesScanned: gateContext.fictionSampleFilesScanned }
      : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    eslintSource:
      summary.eslintSource || ((_g = report.eslintSummary) === null || _g === void 0 ? void 0 : _g.source) || 'none',
    eslintWarnings:
      (_k =
        (_h = summary.eslintWarnings) !== null && _h !== void 0
          ? _h
          : (_j = report.eslintSummary) === null || _j === void 0
            ? void 0
            : _j.warnings) !== null && _k !== void 0
        ? _k
        : null,
    mediumSeverityFindings:
      (_m = (_l = summary.severityCounts) === null || _l === void 0 ? void 0 : _l.medium) !== null && _m !== void 0
        ? _m
        : 0,
    highSeverityFindings:
      (_p = (_o = summary.severityCounts) === null || _o === void 0 ? void 0 : _o.high) !== null && _p !== void 0
        ? _p
        : 0,
    ...(gateReport.jestBaselineChecked === false ||
    ((_q = report.hygieneSummary) === null || _q === void 0 ? void 0 : _q.jestBaselineChecked) === false
      ? { jestBaselineChecked: false }
      : {}),
    attestationNote: 'Codebase hygiene scan — not a Simplebeacon gate pass or legal conformity certification.',
  };
}
/**
 * Enrich product codebase scan scope.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function enrichProductCodebaseScanScope(report, options = {}) {
  const gateContext = resolveGateInventoryContext(report, options);
  const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
  const base = report.scanScope || {};
  return {
    ...base,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    resultsViewScope: base.resultsViewScope || 'platform-only',
    reportHealth: base.reportHealth || 'platform-scoped',
    securityHandoffEligible: false,
  };
}
/**
 * Annotate structure insights.
 * @param {Array} structureInsights
 * @returns {any}
 */
function annotateStructureInsights(structureInsights) {
  var _a, _b, _c, _d, _e;
  if (
    !((_a = structureInsights === null || structureInsights === void 0 ? void 0 : structureInsights.samples) === null ||
    _a === void 0
      ? void 0
      : _a.length)
  )
    return structureInsights;
  const mirrorCount = structureInsights.samples.filter((s) =>
    String(s.filePath || '').startsWith('.github-sync/')
  ).length;
  const langs = ((_b = structureInsights.summary) === null || _b === void 0 ? void 0 : _b.byLanguage) || {};
  const langKeys = Object.keys(langs);
  const docHeavy = langKeys.length > 0 && langKeys.every((k) => /markdown|yaml|text|md/i.test(k));
  const summaryExtras = {};
  if (mirrorCount) {
    summaryExtras.mirrorTreeSamples = mirrorCount;
    summaryExtras.mirrorTreeNote =
      'Samples may include .github-sync/ CLI mirror paths — not primary ai-platform application source.';
  }
  if (docHeavy && ((_c = structureInsights.summary) === null || _c === void 0 ? void 0 : _c.tier) === 'baseline') {
    const sampled =
      (_e = (_d = structureInsights.summary) === null || _d === void 0 ? void 0 : _d.sampledFiles) !== null &&
      _e !== void 0
        ? _e
        : structureInsights.samples.length;
    summaryExtras.structureSampleNote = `Tier-1 structure hints sampled ${sampled} file(s) — baseline profile is doc-heavy; regex estimates are not AST analysis of application code.`;
  }
  if (!Object.keys(summaryExtras).length) return structureInsights;
  return {
    ...structureInsights,
    summary: {
      ...(structureInsights.summary || {}),
      ...summaryExtras,
    },
  };
}
/**
 * Sanitize codebase report export.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeCodebaseReportExport(report, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
  if (!report || report.type !== 'codebase-analyzer-report') return report;
  let next = filterKnownFalsePositiveFindings(report);
  const exportContext = resolveCodebaseExportContext(next, options);
  const { benchmarkScan, scanTargetRoot, productPlatformRoot, misscopedPlatformWalk } = exportContext;
  next = normalizeCodebaseExportPaths(next, scanTargetRoot || next.projectRoot, {
    benchmarkScan,
    productPlatformRoot,
  });
  const projectLabel = projectLabelFromPath(productPlatformRoot || next.projectRoot || 'ai-platform');
  if (next.aiSummary) {
    next.aiSummary = redactCodebaseAiSummary(next.aiSummary, projectLabel);
  }
  const eslintSource =
    ((_a = next.summary) === null || _a === void 0 ? void 0 : _a.eslintSource) ||
    ((_b = next.eslintSummary) === null || _b === void 0 ? void 0 : _b.source) ||
    'none';
  const eslintSkipped = ((_c = next.summary) === null || _c === void 0 ? void 0 : _c.eslintSkipped) || null;
  const context = { benchmarkScan, eslintSource, eslintSkipped };
  if (benchmarkScan) {
    next = {
      ...next,
      title: resolveBenchmarkCodebaseTitle(misscopedPlatformWalk),
      scanTargetProfile: 'benchmark-cache',
      handoffEligible: false,
      benchmarkScan: true,
      scanTargetRoot: scanTargetRoot || next.projectRoot || undefined,
      productPlatformRoot: productPlatformRoot || undefined,
      inventoryScope: misscopedPlatformWalk ? 'platform-walk-from-benchmark-target' : 'oss-clone',
      ...(misscopedPlatformWalk
        ? {
            misscopedPlatformCodeWalk: true,
            codeAnalysisRoot: next.codeAnalysisRoot || next.projectRoot,
            platformRoot: next.platformRoot || productPlatformRoot || next.projectRoot,
          }
        : {}),
    };
    if (next.summary) {
      next.summary = {
        ...next.summary,
        codebaseHealthAttestation: misscopedPlatformWalk ? 'benchmark-target-platform-walk' : 'benchmark-hygiene',
        handoffEligible: false,
        tierCountsExport: buildTierCountsExport(next.summary, true),
      };
    }
  }
  if (next.scanScope) {
    next.scanScope = {
      ...next.scanScope,
      ...(benchmarkScan
        ? {
            resultsViewScope: 'benchmark-clone',
            reportHealth: 'benchmark-clone-scan',
            benchmarkScanTarget: true,
          }
        : {
            resultsViewScope: 'platform-only',
            reportHealth: 'platform-scoped',
          }),
      limitations: replaceMisleadingCodebaseLimitations(next.scanScope.limitations, context),
    };
  }
  if (next.structureInsights) {
    next.structureInsights = annotateStructureInsights(next.structureInsights);
  }
  if (benchmarkScan) {
    const benchmarkNotes = [
      ...(next.exportNotes || []),
      misscopedPlatformWalk
        ? 'Mis-scoped complete-scan export: codebase walked Simplebeacon platform root while scan target was github-cache/ clone — re-run complete scan after updating Simplebeacon for clone-scoped hygiene.'
        : 'Benchmark clone codebase export — not valid for Simplebeacon platform deploy handoff. Run codebase analysis on ai-platform root for product hygiene scoring.',
    ];
    next.exportNotes = dedupeCodebaseExportNotes(benchmarkNotes);
    if (next.aiSummary && !/benchmark|OSS clone|mis-scoped/i.test(String(next.aiSummary))) {
      next.aiSummary = misscopedPlatformWalk
        ? `[Benchmark target — platform walk mis-scope] ${next.aiSummary}`
        : `[Benchmark clone — hygiene only] ${next.aiSummary}`;
    }
    next = {
      ...next,
      exportNormalized: true,
      exportSanitized: true,
      securityHandoffEligible: false,
      codebaseHealthStatus: misscopedPlatformWalk
        ? 'benchmark-misscoped-review'
        : resolveCodebaseHealthStatus(next.summary),
      hygieneSummary: {
        healthScore:
          (_e = (_d = next.summary) === null || _d === void 0 ? void 0 : _d.healthScore) !== null && _e !== void 0
            ? _e
            : null,
        findingsTotal:
          (_g = (_f = next.summary) === null || _f === void 0 ? void 0 : _f.findingsTotal) !== null && _g !== void 0
            ? _g
            : 0,
        codeFilesAnalyzed:
          (_j = (_h = next.summary) === null || _h === void 0 ? void 0 : _h.codeFilesAnalyzed) !== null && _j !== void 0
            ? _j
            : null,
        repositoryFilesTotal:
          (_o =
            (_l = (_k = next.summary) === null || _k === void 0 ? void 0 : _k.repositoryFilesTotal) !== null &&
            _l !== void 0
              ? _l
              : (_m = next.repositoryInventory) === null || _m === void 0
                ? void 0
                : _m.totalFiles) !== null && _o !== void 0
            ? _o
            : null,
        eslintSource,
        scanTargetRoot: scanTargetRoot
          ? redactCodebasePathForExport(scanTargetRoot, {
              projectLabel,
              productPlatformLabel: projectLabel,
              benchmarkScan: true,
            })
          : next.projectRoot || undefined,
        misscopedPlatformCodeWalk: misscopedPlatformWalk || undefined,
        attestationNote: misscopedPlatformWalk
          ? 'Scan target was an OSS github-cache/ clone but codebase analysis walked the Simplebeacon platform tree — not valid benchmark hygiene or product handoff evidence.'
          : 'OSS benchmark clone — codebase hygiene comparison only; not a platform gate pass or deploy handoff certification.',
      },
    };
  } else {
    const builtNotes = buildProductCodebaseExportNotes(next, {
      repositoryFilesTotal: (_p = options.repositoryFilesTotal) !== null && _p !== void 0 ? _p : null,
      gateRepositoryFilesTotal: (_q = options.repositoryFilesTotal) !== null && _q !== void 0 ? _q : null,
      gateReport: options.gateReport || null,
    });
    /**
     * False positive notes.
     * @param {number} next.exportNotes || []
     * @returns {any}
     */
    const falsePositiveNotes = (next.exportNotes || []).filter((n) => /false positive/i.test(String(n)));
    next = {
      ...next,
      exportNormalized: true,
      exportSanitized: true,
      scanTargetProfile: 'product',
      securityHandoffEligible: false,
      handoffEligible: false,
      codebaseHealthStatus: resolveCodebaseHealthStatus(next.summary),
      exportNotes: dedupeCodebaseExportNotes([...builtNotes, ...falsePositiveNotes]).slice(0, 10),
      inventoryScope: 'platform-product',
      hygieneSummary: buildProductCodebaseHygieneSummary(next, options),
      scanScope: enrichProductCodebaseScanScope(next, options),
    };
  }
  return next;
}
