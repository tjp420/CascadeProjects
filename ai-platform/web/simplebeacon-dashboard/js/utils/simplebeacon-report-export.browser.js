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
  if (!euAiActSummary?.documentationFound?.length) return euAiActSummary;

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
  if (!scanScope) return scanScope;
  const scanned = scanScope.llmSlopFilesScanned ?? report.llmSlopFilesScanned ?? null;
  const rawLlm = scanScope.llmSlopScanRaw ?? report.llmSlopScanRaw;
  const reconciled = scanScope.llmSlopScanReconciled ?? report.llmSlopScanReconciled;
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
  const jestSummary = report.jestSummary;
  const jestExecuted =
    report.jestBaselineChecked !== false && report.scanScope?.jestExecutedDuringScan !== false;
  const jestLabel =
    jestExecuted && jestSummary?.testsTotal != null
      ? `${jestSummary.testsPassed}/${jestSummary.testsTotal}`
      : null;
  const repositoryFilesTotal =
    report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? null;
  const gateRepositoryFilesTotal =
    options.gateRepositoryFilesTotal ??
    options.repositoryFilesTotal ??
    repositoryFilesTotal ??
    null;
  const contentScanned =
    report.scanScope?.fullDirectoryStats?.contentScanned ??
    report.scanScope?.fullDirectoryStats?.filesContentScanned ??
    report.credentialScanned ??
    null;
  return {
    gatePass: report.gate?.pass ?? null,
    blockingCount: report.gate?.blockingCount ?? 0,
    mockSampleFiles: report.mockSampleFiles ?? null,
    fictionJsonFilesScanned:
      report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned ?? null,
    fictionSampleFilesScanned:
      report.fictionSampleFilesScanned ?? report.scanScope?.fictionSampleFilesScanned ?? null,
    ruleScopedFilesAnalyzed:
      report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? null,
    repositoryFilesTotal,
    ...(gateRepositoryFilesTotal != null ? { gateRepositoryFilesTotal } : {}),
    credentialScanned: report.credentialScanned ?? report.productionLeakScanned ?? null,
    contentFilesScanned: contentScanned,
    ...(repositoryFilesTotal != null &&
    contentScanned != null &&
    repositoryFilesTotal > contentScanned
      ? { gateMetadataOnlyFiles: repositoryFilesTotal - contentScanned }
      : {}),
    llmSlopPatternHits: report.llmSlopPatternHits ?? report.scanScope?.llmSlopPatternHits ?? 0,
    qualityScore: report.qualityScore ?? null,
    ...(report.scanScope?.profile ? { gateRuleBundleProfile: report.scanScope.profile } : {}),
    gateFailureNote:
      report.gate?.pass === false
        ? `Gate FAIL — ${report.gate?.blockingCount ?? 0} blocking finding(s). Review detectedIssues before merge.`
        : null,
    jestBaselineChecked: jestExecuted,
    jestBaselinePassed: jestExecuted ? (report.jestBaselinePassed ?? null) : null,
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
  const mockN = report.mockSampleFiles ?? report.totalFiles ?? 0;
  const repoTotal = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? 0;
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
  const rawLlm = report.llmSlopScanRaw;
  const scanned = report.llmSlopFilesScanned ?? report.scanScope?.llmSlopFilesScanned ?? null;
  const reconciled = report.llmSlopScanReconciled ?? report.scanScope?.llmSlopScanReconciled;
  return {
    gatePass: report.gate?.pass ?? null,
    blockingCount: report.gate?.blockingCount ?? 0,
    productionLeakFindings: report.productionLeakFindings ?? 0,
    mockSampleFiles: report.mockSampleFiles ?? report.totalFiles ?? 0,
    ruleScopedFilesAnalyzed:
      report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? null,
    repositoryFilesTotal:
      report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? null,
    fictionJsonFilesScanned:
      report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned ?? null,
    llmSlopFilesScanned: scanned,
    ...(reconciled && rawLlm != null && scanned != null && rawLlm > scanned
      ? { llmSlopScanReconciledFrom: rawLlm }
      : {}),
    qualityScore: report.qualityScore ?? null,
    benchmarkCloneNoiseExcluded: report.scanScope?.benchmarkCloneNoiseExcluded ?? 0,
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

  if ((mockSampleFiles ?? 0) > 0) return false;

  return scanPaths.every((entry) => isProductDefaultMockScanPath(entry));
}

/**
 * Reconcile benchmark scan metrics.
 * @param {number} report
 * @returns {any}
 */
function reconcileBenchmarkScanMetrics(report) {
  const repoTotal = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? null;

  const ruleScoped =
    report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? null;

  const cap = repoTotal ?? ruleScoped;

  const rawLlm = report.llmSlopFilesScanned ?? report.scanScope?.llmSlopFilesScanned ?? 0;

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
  const gate = report.gate || {};

  if (!gate.pass) return 'needs-attention';

  const blocking = gate.blockingCount ?? report.issueCount ?? 0;

  if (blocking > 0) return 'gate-fail';

  const ruleScoped =
    report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? 0;

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
  const notes = [];
  const scope = report.scanScope || {};
  const fictionSamplesEarly =
    report.fictionSampleFilesScanned ?? scope.fictionSampleFilesScanned ?? 0;
  const fictionJsonEarly = report.fictionJsonFilesScanned ?? scope.fictionJsonFilesScanned;
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
  } else if (report.jestBaselinePassed === false && report.jestSummary?.testsFailed) {
    notes.push(
      `Jest reported ${report.jestSummary.testsFailed} failure(s) — ${report.jestSummary.testsPassed}/${report.jestSummary.testsTotal} passed during scan.`
    );
  }
  const mockN = report.mockSampleFiles ?? report.totalFiles ?? 0;
  const fictionSamples = report.fictionSampleFilesScanned ?? scope.fictionSampleFilesScanned ?? 0;
  if (mockN > 0 && fictionSamples === 0) {
    // simplebeacon:production-leak-intent - legitimate sample path reference for gate reporting
    notes.push(
      `${mockN} JSON file(s) under configured mock paths — fiction KPI rules target *-sample.json filenames; none matched in this pass.`
    );
  }
  const repoTotal = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles;
  const ruleScoped = report.ruleScopedFilesAnalyzed ?? scope.ruleScopedFilesAnalyzed;
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
    options.gateRepositoryFilesTotal ?? options.repositoryFilesTotal ?? null;
  const inventoryProfile =
    report.repositoryInventory?.profile || (fullTree ? 'full-tree' : 'audit');
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
  if (report.gate?.pass && (report.issueCount ?? 0) === 0) {
    notes.push(
      'Gate pass on configured severities — hygiene attestation only, not SimpleBeacon vendor security handoff or Complete scan clearance.'
    );
  }
  if (report.gate?.pass === false) {
    const blocking = report.gate?.blockingCount ?? report.issueCount ?? 0;
    notes.push(
      `Gate FAIL — ${blocking} blocking finding(s). Review detectedIssues before merge; re-run scan after remediation.`
    );
  }
  if (report.euAiActSummary?.documentationFound?.length) {
    const euSplit = splitEuAiActSummaryForExport(report.euAiActSummary);
    if ((euSplit.simplebeaconArtifactCount ?? 0) > 0) {
      notes.push(
        `${euSplit.simplebeaconArtifactCount} EU AI Act documentation path(s) under .simplebeacon/ are scan artifacts — prefer docs/ for operator handoff packs.`
      );
    }
    if ((euSplit.scanMatchedNonDocsCount ?? 0) > 0) {
      notes.push(
        `${euSplit.scanMatchedNonDocsCount} EU AI Act scan pattern match(es) outside docs/ (e.g. package.json) — not operator handoff documentation.`
      );
    }
  }
  const contentScanned =
    scope.fullDirectoryStats?.contentScanned ??
    scope.fullDirectoryStats?.filesContentScanned ??
    report.credentialScanned ??
    null;
  const credentialScanned = report.credentialScanned ?? scope.productionDirsScanned ?? null;
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
  const fictionJson = report.fictionJsonFilesScanned ?? scope.fictionJsonFilesScanned;
  if (fictionJson != null && fictionSamples > 0 && fictionJson > fictionSamples) {
    // simplebeacon:production-leak-intent - legitimate KPI reference for gate reporting
    notes.push(
      `Fiction KPI rules evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) — ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
    );
  }
  const llmHits = report.llmSlopPatternHits ?? scope.llmSlopPatternHits ?? 0;
  const ruleLeakHits = scope.fullDirectoryStats?.ruleHitTotals?.productionLeak ?? 0;
  if (llmHits > 0 && (report.gate?.blockingCount ?? 0) === 0) {
    notes.push(
      `${llmHits} LLM-slop pattern match(es) recorded — below gate failOn severity; see scanScope.ruleHitTotals for informational counts.`
    );
  }
  if (ruleLeakHits > 0 && (report.productionLeakFindings ?? 0) === 0) {
    notes.push(
      `${ruleLeakHits} production-leak pattern hit(s) in ruleHitTotals — ${report.productionLeakSuppressedIntent ?? 0} suppressed as intentional; blocking productionLeakFindings is 0.`
    );
  }
  if (
    scope.profile === 'eu-ai-act' &&
    !options.embeddedInEuAiActSprint &&
    !(report.euAiActSummary?.scanMatchedNonDocsCount > 0)
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
  const notes = [];

  const excluded =
    report.scanScope?.benchmarkCloneNoiseExcluded ?? report.benchmarkCloneNoiseIssues?.length ?? 0;

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
    report.llmSlopScanRaw ??
    report.hygieneSummary?.llmSlopScanReconciledFrom ??
    report.scanScope?.llmSlopScanRaw;
  const scannedLlm = report.llmSlopFilesScanned ?? report.scanScope?.llmSlopFilesScanned;
  const reconciled =
    report.llmSlopScanReconciled ??
    report.scanScope?.llmSlopScanReconciled ??
    report.hygieneSummary?.llmSlopScanReconciledFrom != null;
  if (reconciled && rawLlm != null && scannedLlm != null && rawLlm > scannedLlm) {
    notes.push(
      `LLM slop file count reconciled from ${rawLlm} to ${scannedLlm} to match repository inventory on benchmark export.`
    );
  }

  if (report.gate?.pass) {
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
  const gateHealthStatus = next.gate?.pass
    ? 'benchmark-clone-pass'
    : 'benchmark-clone-needs-attention';
  const exportNotes = assembleBenchmarkGateExportNotes(report.exportNotes, next, context);
  const sanitizedScope = sanitizeBenchmarkGateScanScope(next.scanScope, next);
  const repoTotal = next.repositoryFilesTotal ?? next.repositoryInventory?.totalFiles ?? 0;
  const sizeOmitted = (next.totalSizeBytes ?? 0) === 0 && repoTotal > 0;

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

  const mockSampleN = next.mockSampleFiles ?? next.totalFiles ?? 0;
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
  if (!report || report.benchmarkScan) return report;
  const fullTree = Boolean(report.fullDirectoryScan || report.scanScope?.fullDirectoryScan);
  if (!fullTree) return report;

  const scanScope = report.scanScope || {};
  const mockInPaths = scanScope.mockSampleFilesInScanPaths ?? 0;
  const ruleScoped = report.ruleScopedFilesAnalyzed ?? scanScope.ruleScopedFilesAnalyzed ?? 0;
  const topMock = report.mockSampleFiles ?? report.totalFiles ?? null;
  const fictionSamples =
    report.fictionSampleFilesScanned ?? scanScope.fictionSampleFilesScanned ?? null;

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
  const intentionalFullTree = Boolean(report.fullDirectoryScan || scanScope.fullDirectoryScan);
  return {
    ...scanScope,
    resultsViewScope: scanScope.resultsViewScope || 'platform-only',
    reportHealth: intentionalFullTree
      ? 'platform-scoped-full-tree'
      : scanScope.reportHealth || 'platform-scoped',
    rescanRecommended: intentionalFullTree ? false : Boolean(scanScope.rescanRecommended),
    inventoryMetricsStale: intentionalFullTree ? false : (scanScope.inventoryMetricsStale ?? false),
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
    const mockSampleFiles = next.mockSampleFiles ?? next.totalFiles ?? 0;

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
    exportReady.scanScope?.jestExecutedDuringScan !== false;

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
