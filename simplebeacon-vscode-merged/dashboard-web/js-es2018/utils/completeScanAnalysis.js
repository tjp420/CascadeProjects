/**
 * Build top-level complete scan analysis for dashboard display and export.
 */
import { escapeHtml } from '../utils.js';
import {
  classifyRegenerableArtifacts,
  softenPriorityActions,
  partitionArtifactDirectoryEntries,
  isBenchmarkCachePath,
} from './complete-scan-artifact-profile.browser.js';
import { sanitizeCleanupBriefExport } from './cleanup-brief-export.browser.js?v=20260716cachefix1';
import { sanitizeDataCleanupReportExport } from './data-cleanup-export.browser.js?v=20260716cachefix1';
import { sanitizeCodebaseReportExport } from './codebase-export.browser.js?v=20260716cachefix1';
// Fallbackable imports: roadmap & consolidation exporters may be missing on some hosted builds.
let applyBenchmarkRoadmapSanitize = (x) => x;
let sanitizeConsolidationExportCore = (x) => x;
(function tryLoadOptionalExports() {
  try {
    // Dynamic import — if it fails, keep the no-op defaults so UI degrades gracefully.
    import('./roadmap-export.browser.js?v=20260716cachefix1')
      .then((mod) => {
        if (mod && typeof mod.sanitizeRoadmapExport === 'function')
          applyBenchmarkRoadmapSanitize = mod.sanitizeRoadmapExport;
      })
      .catch((e) => {
        console['warn']('[completeScanAnalysis] roadmap-export not available, using noop fallback.', e);
      });
    import('./consolidation-export.browser.js?v=20260716cachefix1')
      .then((mod) => {
        if (mod && typeof mod.sanitizeConsolidationExport === 'function')
          sanitizeConsolidationExportCore = mod.sanitizeConsolidationExport;
      })
      .catch((e) => {
        console['warn']('[completeScanAnalysis] consolidation-export not available, using noop fallback.', e);
      });
  } catch (e) {
    console['warn']('[completeScanAnalysis] failed to initiate optional exports import', e);
  }
})();
import { sanitizeNpmAuditExport } from './npm-audit-export.browser.js?v=20260716cachefix1';
import { sanitizeComplianceBundleExport } from './compliance-export.browser.js?v=20260716cachefix1';
import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260716cachefix1';
/**
 * Format bytes.
 * @param {Array} bytes
 * @returns {any}
 */
function formatBytes(bytes) {
  if (bytes == null || Number.isNaN(Number(bytes))) return '—';
  const n = Number(bytes);
  if (n === 0) return '0 B';
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
export { classifyRegenerableArtifacts, softenPriorityActions } from './complete-scan-artifact-profile.browser.js';
/**
 * Build complete scan analysis.
 * @param {Object} options
 * @param {any} dataQuality
 * @param {string} projectPath }
 * @returns {any}
 */
export function buildCompleteScanAnalysis({ fileReduction, dataQuality, projectPath } = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2;
  const frPlan = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.fileReductionPlan;
  const frExec = fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.executiveSummary;
  const dqExec = dataQuality === null || dataQuality === void 0 ? void 0 : dataQuality.executiveSummary;
  const benchmarkScan = isBenchmarkScanTarget(projectPath);
  const priorityActions = [
    ...((frExec === null || frExec === void 0 ? void 0 : frExec.priorityActions) || []),
    ...((dqExec === null || dqExec === void 0 ? void 0 : dqExec.priorityActions) || []),
  ].slice(0, 10);
  const rawTopDirs =
    ((_a = frPlan === null || frPlan === void 0 ? void 0 : frPlan.safeToDelete) === null || _a === void 0
      ? void 0
      : _a.topDirectories) || [];
  const { measurable: topSafeDirectories, skippedShells: skippedArtifactDirectories } =
    partitionArtifactDirectoryEntries(rawTopDirs);
  const benchmarkDirsExcluded = rawTopDirs.filter((entry) => isBenchmarkCachePath(entry.path)).length;
  const analysis = {
    projectPath:
      projectPath || (fileReduction === null || fileReduction === void 0 ? void 0 : fileReduction.projectRoot) || '',
    fileReduction: frPlan
      ? {
          safeToDeleteBytes:
            (_c = (_b = frPlan.totals) === null || _b === void 0 ? void 0 : _b.safeToDeleteBytes) !== null &&
            _c !== void 0
              ? _c
              : null,
          reviewBeforeDeleteBytes:
            (_e = (_d = frPlan.totals) === null || _d === void 0 ? void 0 : _d.reviewBeforeDeleteBytes) !== null &&
            _e !== void 0
              ? _e
              : null,
          immediateSavingsBytes:
            (_g = (_f = frPlan.totals) === null || _f === void 0 ? void 0 : _f.estimatedImmediateSavingsBytes) !==
              null && _g !== void 0
              ? _g
              : null,
          duplicateAssetBytes:
            (_j = (_h = frPlan.totals) === null || _h === void 0 ? void 0 : _h.duplicateAssetBytes) !== null &&
            _j !== void 0
              ? _j
              : null,
          unusedFileCandidates:
            (_l = (_k = frPlan.unusedFiles) === null || _k === void 0 ? void 0 : _k.candidates) !== null &&
            _l !== void 0
              ? _l
              : null,
          topSafeDirectories: topSafeDirectories.slice(0, 8),
          skippedArtifactDirectories: skippedArtifactDirectories.slice(0, 8),
          benchmarkDirsExcluded,
          reviewLogs:
            ((_o = (_m = frPlan.reviewBeforeDelete) === null || _m === void 0 ? void 0 : _m.logs) === null ||
            _o === void 0
              ? void 0
              : _o.slice(0, 8)) || [],
          summaryTable: frPlan.summaryTable || [],
        }
      : null,
    dataQuality: dqExec
      ? {
          workspacePackages:
            (_q = (_p = dqExec.workspace) === null || _p === void 0 ? void 0 : _p.packageJsonFiles) !== null &&
            _q !== void 0
              ? _q
              : null,
          unusedDependencies:
            (_s = (_r = dqExec.workspace) === null || _r === void 0 ? void 0 : _r.unusedDependencies) !== null &&
            _s !== void 0
              ? _s
              : null,
          envInconsistencies:
            (_u = (_t = dqExec.workspace) === null || _t === void 0 ? void 0 : _t.envInconsistencies) !== null &&
            _u !== void 0
              ? _u
              : null,
          missingEnvKeys:
            (_w = (_v = dqExec.workspace) === null || _v === void 0 ? void 0 : _v.missingEnvKeys) !== null &&
            _w !== void 0
              ? _w
              : null,
          shapeDriftGroups:
            (_y = (_x = dqExec.data) === null || _x === void 0 ? void 0 : _x.shapeDriftGroups) !== null && _y !== void 0
              ? _y
              : null,
          credentialsNeedingReview:
            (_0 = (_z = dqExec.security) === null || _z === void 0 ? void 0 : _z.credentialsNeedingReview) !== null &&
            _0 !== void 0
              ? _0
              : null,
          piiNeedingReview:
            (_2 = (_1 = dqExec.security) === null || _1 === void 0 ? void 0 : _1.piiNeedingReview) !== null &&
            _2 !== void 0
              ? _2
              : null,
        }
      : null,
    priorityActions,
    notes: [
      ...((frPlan === null || frPlan === void 0 ? void 0 : frPlan.scopeNote) ? [frPlan.scopeNote] : []),
      ...(skippedArtifactDirectories.length
        ? [
            `${skippedArtifactDirectories.length} regenerable directory shell(s) (for example node_modules, coverage) were detected but not size-walked — review-first totals are the measured reclaimable bytes.`,
          ]
        : []),
      ...(benchmarkDirsExcluded
        ? [
            `${benchmarkDirsExcluded} github-cache/ benchmark directory row(s) excluded from safe-to-delete recommendations (OSS clones, not product code).`,
          ]
        : []),
      ...(benchmarkScan
        ? []
        : [
            'File reduction and roadmap walks exclude github-cache/, deliverables/, and .simplebeacon/ artifact trees.',
          ]),
      ...(benchmarkScan ? ['Scan target is an OSS clone under github-cache/ — not Simplebeacon product code.'] : []),
      ...((frExec === null || frExec === void 0 ? void 0 : frExec.notes) || []),
      ...((dqExec === null || dqExec === void 0 ? void 0 : dqExec.notes) || []),
    ]
      .filter((note, index, all) => all.indexOf(note) === index)
      .slice(0, 8),
  };
  analysis.artifactProfile = classifyRegenerableArtifacts(analysis);
  analysis.priorityActions = softenPriorityActions(analysis.priorityActions, analysis.artifactProfile);
  return analysis;
}
/**
 * Render complete scan analysis panel.
 * @param {Array} analysis
 * @returns {any}
 */
export function renderCompleteScanAnalysisPanel(analysis) {
  if (!analysis) return '';
  const fr = analysis.fileReduction;
  const dq = analysis.dataQuality;
  const artifactProfile = analysis.artifactProfile || classifyRegenerableArtifacts(analysis);
  const actions = analysis.priorityActions || [];
  const showRegenerableCallout = artifactProfile === 'regenerableOnly';
  const actionItems = actions.length
    ? actions
        .slice(0, 6)
        .map(
          (action) => `
        <li><strong>${escapeHtml(action.title)}</strong> <span class="text-muted">— ${escapeHtml(action.detail)}</span></li>
      `
        )
        .join('')
    : '<li class="text-muted">Re-run complete scan to populate priority actions.</li>';
  /**
   * Top dirs.
   * @param {string} fr?.topSafeDirectories || []
   * @returns {any}
   */
  const topDirs = ((fr === null || fr === void 0 ? void 0 : fr.topSafeDirectories) || [])
    .map(
      (entry) => `
    <li><code>${escapeHtml(entry.path)}</code> <span class="text-muted">· ${formatBytes(entry.bytes)} · ${Number(entry.files || 0).toLocaleString()} files</span></li>
  `
    )
    .join('');
  const skippedDirNames = ((fr === null || fr === void 0 ? void 0 : fr.skippedArtifactDirectories) || [])
    .map((entry) => entry.path || entry.category)
    .filter(Boolean);
  const skippedDirsNote = skippedDirNames.length
    ? `<p class="text-muted mb-4" style="font-size: var(--font-size-sm);">Regenerable directories detected but not size-walked: ${skippedDirNames.map((name) => `<code>${escapeHtml(name)}</code>`).join(', ')}. Sizes are omitted for performance — delete and reinstall when you need disk space.</p>`
    : '';
  return `
    <details class="card mb-4" open>
      <summary><strong>Complete scan analysis</strong></summary>
      <div class="mt-4">
        ${
          showRegenerableCallout
            ? `
          <p class="analyze-info-callout mb-4">Regenerable build artifacts only (typically <code>node_modules</code> after <code>npm install</code>). Safe to delete when you need disk space — run <code>npm install</code> to restore. Not a gate failure.</p>
        `
            : ''
        }
        <div class="metrics-row mb-4">
          ${
            fr
              ? `
            <div class="metric-chip"><strong>${formatBytes(fr.immediateSavingsBytes)}</strong> immediate savings</div>
            <div class="metric-chip"><strong>${formatBytes(fr.safeToDeleteBytes)}</strong> safe to delete</div>
            <div class="metric-chip"><strong>${formatBytes(fr.reviewBeforeDeleteBytes)}</strong> review first</div>
            <div class="metric-chip"><strong>${Number(fr.unusedFileCandidates || 0).toLocaleString()}</strong> unused files</div>
          `
              : ''
          }
          ${
            dq
              ? `
            <div class="metric-chip"><strong>${Number(dq.workspacePackages || 0).toLocaleString()}</strong> workspace packages</div>
            <div class="metric-chip"><strong>${Number(dq.envInconsistencies || 0).toLocaleString()}</strong> env conflicts</div>
            <div class="metric-chip"><strong>${Number(dq.piiNeedingReview || 0).toLocaleString()}</strong> PII need review</div>
          `
              : ''
          }
        </div>
        ${
          topDirs
            ? `
          <h3 class="mb-2" style="font-size: var(--font-size-base);">Top safe-to-delete directories</h3>
          <ul class="mb-4" style="padding-left: 1.25rem;">${topDirs}</ul>
        `
            : ''
        }
        ${skippedDirsNote}
        <h3 class="mb-2" style="font-size: var(--font-size-base);">Priority actions</h3>
        <ul class="mb-4" style="padding-left: 1.25rem;">${actionItems}</ul>
        ${
          (analysis.notes || []).length
            ? `
          <p class="text-muted" style="font-size: var(--font-size-xs);">${analysis.notes.map((note) => escapeHtml(note)).join(' · ')}</p>
        `
            : ''
        }
      </div>
    </details>
  `;
}
export { formatBytes as formatCompleteScanBytes };
/**
 * Is benchmark scan target.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkScanTarget(projectPath) {
  const rel = String(projectPath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
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
  const normalized = String(projectPath || '').replace(/\\/g, '/');
  const idx = normalized.toLowerCase().indexOf('/github-cache/');
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}
/**
 * Has hollow gate from report.
 * @param {any} sb
 * @returns {any}
 */
function hasHollowGateFromReport(sb) {
  var _a, _b, _c, _d;
  const ruleScoped =
    (_c =
      (_a = sb === null || sb === void 0 ? void 0 : sb.ruleScopedFilesAnalyzed) !== null && _a !== void 0
        ? _a
        : (_b = sb === null || sb === void 0 ? void 0 : sb.scanScope) === null || _b === void 0
          ? void 0
          : _b.ruleScopedFilesAnalyzed) !== null && _c !== void 0
      ? _c
      : 0;
  return (
    Boolean((_d = sb === null || sb === void 0 ? void 0 : sb.gate) === null || _d === void 0 ? void 0 : _d.pass) &&
    ruleScoped === 0
  );
}
/**
 * Infer complete scan target from hints.
 * @param {any} bundle
 * @param {Object} options
 * @returns {any}
 */
function inferCompleteScanTargetFromHints(bundle, options = {}) {
  var _a, _b, _c, _d;
  const filename = String(options.exportFilename || options.filename || '').toLowerCase();
  if (!filename.includes('github-cache')) return '';
  const slugMatch = filename.match(/github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i);
  if (!slugMatch) return '';
  const cloneName = slugMatch[1];
  const sourceRoot = String(
    options.projectPath ||
      bundle.projectPath ||
      ((_b = (_a = bundle.results) === null || _a === void 0 ? void 0 : _a.simplebeacon) === null || _b === void 0
        ? void 0
        : _b.projectRoot) ||
      ((_d = (_c = bundle.results) === null || _c === void 0 ? void 0 : _c.simplebeacon) === null || _d === void 0
        ? void 0
        : _d.platformRoot) ||
      ''
  ).replace(/\\/g, '/');
  if (isBenchmarkScanTarget(sourceRoot)) return '';
  const platformRoot = resolveProductPlatformRoot(sourceRoot) || sourceRoot;
  if (!platformRoot) return '';
  return `${platformRoot.replace(/\/$/, '')}/github-cache/${cloneName}`;
}
/**
 * Resolve benchmark gate attestation.
 * @param {any} sb
 * @param {any} hollowGate
 * @returns {any}
 */
function resolveBenchmarkGateAttestation(sb, hollowGate) {
  var _a, _b, _c, _d, _e;
  if (hollowGate || hasHollowGateFromReport(sb)) return 'limited-benchmark';
  if (sb === null || sb === void 0 ? void 0 : sb.gateAttestation) return sb.gateAttestation;
  if (((_a = sb === null || sb === void 0 ? void 0 : sb.gate) === null || _a === void 0 ? void 0 : _a.pass) === false)
    return 'benchmark-clone-fail';
  if ((_b = sb === null || sb === void 0 ? void 0 : sb.gate) === null || _b === void 0 ? void 0 : _b.pass) {
    const ruleScoped =
      (_e =
        (_c = sb.ruleScopedFilesAnalyzed) !== null && _c !== void 0
          ? _c
          : (_d = sb.scanScope) === null || _d === void 0
            ? void 0
            : _d.ruleScopedFilesAnalyzed) !== null && _e !== void 0
        ? _e
        : 0;
    return ruleScoped > 0 ? 'benchmark-clone' : 'limited-benchmark';
  }
  return 'not-evaluated';
}
/**
 * Assemble benchmark complete scan export notes.
 * @param {Array} existingNotes
 * @returns {any}
 */
function assembleBenchmarkCompleteScanExportNotes(existingNotes = []) {
  const scopeNote = 'Complete scan export scoped to github-cache/ OSS clone — not Simplebeacon product handoff.';
  const skipPatterns = [
    /complete scan export scoped to github-cache/i,
    /benchmark clone.*not valid for simplebeacon/i,
    /jest was not (executed|run)/i,
  ];
  const filteredExisting = dedupeCompleteScanExportNotes(existingNotes).filter((note) => {
    const text = String(note);
    return !skipPatterns.some((re) => re.test(text));
  });
  return dedupeCompleteScanExportNotes([scopeNote, ...filteredExisting]);
}
/**
 * Build benchmark complete scan hygiene summary.
 * @param {any} bundle
 * @param {Array} auditFiles
 * @returns {any}
 */
function buildBenchmarkCompleteScanHygieneSummary(bundle, auditFiles) {
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
    _7;
  const sb = (_a = bundle.results) === null || _a === void 0 ? void 0 : _a.simplebeacon;
  const rawLlm =
    (_b = sb === null || sb === void 0 ? void 0 : sb.llmSlopScanRaw) !== null && _b !== void 0
      ? _b
      : (_c = sb === null || sb === void 0 ? void 0 : sb.scanScope) === null || _c === void 0
        ? void 0
        : _c.llmSlopScanRaw;
  const scannedLlm =
    (_f =
      (_d = sb === null || sb === void 0 ? void 0 : sb.llmSlopFilesScanned) !== null && _d !== void 0
        ? _d
        : (_e = sb === null || sb === void 0 ? void 0 : sb.scanScope) === null || _e === void 0
          ? void 0
          : _e.llmSlopFilesScanned) !== null && _f !== void 0
      ? _f
      : null;
  const reconciledLlm =
    (_g = sb === null || sb === void 0 ? void 0 : sb.llmSlopScanReconciled) !== null && _g !== void 0
      ? _g
      : (_h = sb === null || sb === void 0 ? void 0 : sb.scanScope) === null || _h === void 0
        ? void 0
        : _h.llmSlopScanReconciled;
  return {
    simplebeaconGatePass:
      (_k = (_j = bundle.summary) === null || _j === void 0 ? void 0 : _j.simplebeaconGatePass) !== null &&
      _k !== void 0
        ? _k
        : null,
    simplebeaconGateAttestation:
      (_m = (_l = bundle.summary) === null || _l === void 0 ? void 0 : _l.simplebeaconGateAttestation) !== null &&
      _m !== void 0
        ? _m
        : null,
    simplebeaconIssues:
      (_p = (_o = bundle.summary) === null || _o === void 0 ? void 0 : _o.simplebeaconIssues) !== null && _p !== void 0
        ? _p
        : 0,
    complianceFailed:
      (_r = (_q = bundle.summary) === null || _q === void 0 ? void 0 : _q.complianceFailed) !== null && _r !== void 0
        ? _r
        : 0,
    repositoryFilesTotal:
      (_v =
        (_u =
          (_t = (_s = bundle.summary) === null || _s === void 0 ? void 0 : _s.platformScope) === null || _t === void 0
            ? void 0
            : _t.repositoryFilesTotal) !== null && _u !== void 0
          ? _u
          : auditFiles) !== null && _v !== void 0
        ? _v
        : null,
    roadmapFiles:
      (_x = (_w = bundle.summary) === null || _w === void 0 ? void 0 : _w.roadmapFiles) !== null && _x !== void 0
        ? _x
        : null,
    cleanupProjectedFiles:
      (_z = (_y = bundle.summary) === null || _y === void 0 ? void 0 : _y.cleanupProjectedFiles) !== null &&
      _z !== void 0
        ? _z
        : null,
    ...(((_0 = bundle.summary) === null || _0 === void 0 ? void 0 : _0.cleanupProjectedFilesRaw) != null
      ? { cleanupProjectedFilesRaw: bundle.summary.cleanupProjectedFilesRaw }
      : {}),
    roadmapMisscoped:
      ((_2 = (_1 = bundle.results) === null || _1 === void 0 ? void 0 : _1.roadmap) === null || _2 === void 0
        ? void 0
        : _2.misscopedPlatformCodeWalk) === true,
    codebaseMisscoped:
      ((_4 = (_3 = bundle.results) === null || _3 === void 0 ? void 0 : _3.codebase) === null || _4 === void 0
        ? void 0
        : _4.misscopedPlatformCodeWalk) === true,
    fictionJsonFilesScanned:
      (_7 =
        (_5 = sb === null || sb === void 0 ? void 0 : sb.fictionJsonFilesScanned) !== null && _5 !== void 0
          ? _5
          : (_6 = sb === null || sb === void 0 ? void 0 : sb.scanScope) === null || _6 === void 0
            ? void 0
            : _6.fictionJsonFilesScanned) !== null && _7 !== void 0
        ? _7
        : null,
    llmSlopFilesScanned: scannedLlm,
    ...(reconciledLlm && rawLlm != null && scannedLlm != null && rawLlm > scannedLlm
      ? { llmSlopScanReconciledFrom: rawLlm }
      : {}),
    attestationNote: 'Complete scan on OSS benchmark clone — not Simplebeacon product handoff clearance.',
  };
}
/**
 * Sanitize compliance for complete scan.
 * @param {any} compliance
 * @param {number} gateReport
 * @param {string} projectPath
 * @param {string} context
 * @returns {any}
 */
function sanitizeComplianceForCompleteScan(compliance, gateReport, projectPath, context = {}) {
  var _a, _b, _c;
  if (!compliance) return compliance;
  const { benchmarkScan, hollowGate, productPlatformRoot } = context;
  if (!benchmarkScan && !hollowGate) return compliance;
  const summary = {
    ...(compliance.summary || {}),
    readyForAutomation: false,
    handoffEligible: false,
    benchmarkScan: benchmarkScan || undefined,
    hollowGate: hollowGate || undefined,
    scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'limited-gate-scope',
    productPlatformRoot: productPlatformRoot || undefined,
    headline: benchmarkScan
      ? 'Benchmark clone — not valid for Simplebeacon platform handoff. Run Complete scan on ai-platform.'
      : 'Limited gate scope — configure production paths before automated deploy gates.',
  };
  let rules = [...(compliance.rules || [])];
  const ruleScoped =
    (_c =
      (_a = gateReport === null || gateReport === void 0 ? void 0 : gateReport.ruleScopedFilesAnalyzed) !== null &&
      _a !== void 0
        ? _a
        : (_b = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null || _b === void 0
          ? void 0
          : _b.ruleScopedFilesAnalyzed) !== null && _c !== void 0
      ? _c
      : 0;
  if (ruleScoped === 0) {
    rules = rules.map((rule) => {
      if (rule.id === 'GATE-001' && rule.status === 'pass') {
        return { ...rule, status: 'skip', evidence: 'No gate-rule production paths configured for this scan target' };
      }
      if (
        (rule.id === 'CRED-001' || rule.id === 'LEAK-001') &&
        rule.status === 'pass' &&
        /Scanned 0 path/i.test(rule.evidence || '')
      ) {
        return {
          ...rule,
          status: 'skip',
          evidence:
            rule.id === 'CRED-001'
              ? 'Credential rules did not scan any paths in this profile'
              : 'Production leak rules did not scan any paths in this profile',
        };
      }
      return rule;
    });
    const passed = rules.filter((r) => r.status === 'pass').length;
    const failed = rules.filter((r) => r.status === 'fail').length;
    const skipped = rules.filter((r) => r.status === 'skip').length;
    const scored = passed + failed;
    summary.passed = passed;
    summary.failed = failed;
    summary.skipped = skipped;
    summary.score = scored ? Math.round((passed / scored) * 100) : null;
  }
  return { ...compliance, summary, rules };
}
/**
 * Dedupe complete scan export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeCompleteScanExportNotes(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    const normalized = String(note).replace(/\s+/g, ' ').trim().toLowerCase();
    const scopeKey = /complete scan export scoped to github-cache/i.test(normalized)
      ? 'benchmark-complete-scope-note'
      : /benchmark clone.*not valid for simplebeacon/i.test(normalized)
        ? 'benchmark-handoff-note'
        : /jest was not (executed|run)/i.test(normalized)
          ? 'jest-not-run-note'
          : /scan target is an oss clone under github-cache/i.test(normalized)
            ? 'benchmark-oss-clone-note'
            : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(String(note));
  }
  return out.slice(0, 10);
}
/**
 * Resolve roadmap summary files.
 * @param {any} roadmap
 * @param {Array} auditFiles
 * @param {any} summary
 * @returns {any}
 */
function resolveRoadmapSummaryFiles(roadmap, auditFiles, summary = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  const structure =
    (_a = roadmap === null || roadmap === void 0 ? void 0 : roadmap.codeAnalysis) === null || _a === void 0
      ? void 0
      : _a.structure;
  const roadmapScoped =
    (_e =
      (_d =
        (_c =
          (_b = structure === null || structure === void 0 ? void 0 : structure.totalFilesRaw) !== null && _b !== void 0
            ? _b
            : structure === null || structure === void 0
              ? void 0
              : structure.totalFiles) !== null && _c !== void 0
          ? _c
          : summary.roadmapFilesRaw) !== null && _d !== void 0
        ? _d
        : summary.roadmapFiles) !== null && _e !== void 0
      ? _e
      : null;
  const misscoped = (roadmap === null || roadmap === void 0 ? void 0 : roadmap.misscopedPlatformCodeWalk) === true;
  if (auditFiles == null || roadmapScoped == null) {
    return {
      roadmapFiles:
        (_f = structure === null || structure === void 0 ? void 0 : structure.totalFiles) !== null && _f !== void 0
          ? _f
          : summary.roadmapFiles,
      roadmapFilesRaw: summary.roadmapFilesRaw,
      roadmapFilesNote: summary.roadmapFilesNote,
    };
  }
  if (misscoped || roadmapScoped > auditFiles * 2) {
    return {
      roadmapFiles: auditFiles,
      roadmapFilesRaw: roadmapScoped,
      roadmapFilesNote: misscoped
        ? `Roadmap step walked Simplebeacon platform root (${Number(roadmapScoped).toLocaleString()} files) while scan target was github-cache/ clone (${Number(auditFiles).toLocaleString()} files) — re-run complete scan after updating Simplebeacon.`
        : `Roadmap walk included github-cache/ clones (${Number(roadmapScoped).toLocaleString()} files). Gate inventory: ${Number(auditFiles).toLocaleString()} files on this clone.`,
    };
  }
  return {
    roadmapFiles:
      (_g = structure === null || structure === void 0 ? void 0 : structure.totalFiles) !== null && _g !== void 0
        ? _g
        : roadmapScoped,
    roadmapFilesRaw: summary.roadmapFilesRaw,
    roadmapFilesNote: summary.roadmapFilesNote,
  };
}
/** Align complete-scan export summary with platform-scoped gate report (excludes github-cache noise). */
export function sanitizeCompleteScanBundle(bundle, options = {}) {
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
    _17,
    _18,
    _19,
    _20,
    _21,
    _22,
    _23,
    _24,
    _25,
    _26,
    _27,
    _28,
    _29,
    _30,
    _31,
    _32,
    _33,
    _34,
    _35,
    _36,
    _37,
    _38,
    _39,
    _40,
    _41,
    _42,
    _43,
    _44,
    _45,
    _46,
    _47,
    _48,
    _49,
    _50,
    _51,
    _52,
    _53,
    _54,
    _55,
    _56,
    _57,
    _58,
    _59,
    _60,
    _61,
    _62,
    _63,
    _64;
  if (!bundle || bundle.type !== 'simplebeacon-complete-scan') return bundle;
  const prepare = options.preparePlatformResultsReport;
  const hintedPath = inferCompleteScanTargetFromHints(bundle, options);
  const resolvedProjectPath = String(hintedPath || options.projectPath || bundle.projectPath || '').replace(/\\/g, '/');
  const benchmarkScan = isBenchmarkScanTarget(resolvedProjectPath);
  const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(resolvedProjectPath) : null;
  let next = {
    ...bundle,
    projectPath: resolvedProjectPath || bundle.projectPath,
    results: { ...(bundle.results || {}) },
    summary: { ...(bundle.summary || {}) },
  };
  const nestedOptions = {
    projectPath: next.projectPath,
    benchmarkScan,
    productPlatformRoot,
    scanTargetRoot: next.projectPath,
    requestedProjectPath: next.projectPath,
    exportFilename: options.exportFilename || options.filename,
  };
  if (next.results.simplebeacon && typeof prepare === 'function') {
    next.results.simplebeacon = prepare(next.results.simplebeacon, nestedOptions) || next.results.simplebeacon;
  } else if (next.results.simplebeacon) {
    next.results.simplebeacon = sanitizeSimplebeaconReportExport(next.results.simplebeacon, nestedOptions);
  }
  const repositoryFilesTotal =
    (_b = (_a = next.results.simplebeacon) === null || _a === void 0 ? void 0 : _a.repositoryFilesTotal) !== null &&
    _b !== void 0
      ? _b
      : (_d = (_c = next.results.simplebeacon) === null || _c === void 0 ? void 0 : _c.repositoryInventory) === null ||
          _d === void 0
        ? void 0
        : _d.totalFiles;
  if (next.results.consolidation && typeof options.sanitizeConsolidationExport === 'function') {
    next.results.consolidation = options.sanitizeConsolidationExport(next.results.consolidation, nestedOptions);
  }
  if (next.results.roadmap) {
    next.results.roadmap = applyBenchmarkRoadmapSanitize(next.results.roadmap, {
      ...nestedOptions,
      repositoryFilesTotal,
      gateReport: next.results.simplebeacon || null,
    });
  }
  if (next.results.mockScan && typeof options.sanitizeFictionDigestExport === 'function') {
    next.results.mockScan = options.sanitizeFictionDigestExport(next.results.mockScan, nestedOptions);
  }
  const sb = next.results.simplebeacon;
  const hollowGate = hasHollowGateFromReport(sb);
  nestedOptions.repositoryFilesTotal =
    (_e = sb === null || sb === void 0 ? void 0 : sb.repositoryFilesTotal) !== null && _e !== void 0
      ? _e
      : (_f = sb === null || sb === void 0 ? void 0 : sb.repositoryInventory) === null || _f === void 0
        ? void 0
        : _f.totalFiles;
  nestedOptions.gateReport = sb || null;
  const platformRepo =
    (_j =
      (_g = sb === null || sb === void 0 ? void 0 : sb.repositoryFilesTotal) !== null && _g !== void 0
        ? _g
        : (_h = sb === null || sb === void 0 ? void 0 : sb.repositoryInventory) === null || _h === void 0
          ? void 0
          : _h.totalFiles) !== null && _j !== void 0
      ? _j
      : null;
  next.summary.platformScope = {
    reportHealth: benchmarkScan
      ? 'benchmark-clone-scan'
      : ((_k = sb === null || sb === void 0 ? void 0 : sb.scanScope) === null || _k === void 0
          ? void 0
          : _k.reportHealth) || 'platform-scoped',
    mockSampleFiles:
      (_l = sb === null || sb === void 0 ? void 0 : sb.mockSampleFiles) !== null && _l !== void 0 ? _l : null,
    repositoryFilesTotal: platformRepo,
    scanPaths: (sb === null || sb === void 0 ? void 0 : sb.scanPaths) || [],
    scanTargetProfile: benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : 'product',
    productPlatformRoot: productPlatformRoot || undefined,
    simplebeaconGatePass:
      benchmarkScan && hollowGate
        ? null
        : (_p =
              (_o =
                (_m = sb === null || sb === void 0 ? void 0 : sb.gate) === null || _m === void 0 ? void 0 : _m.pass) !==
                null && _o !== void 0
                ? _o
                : next.summary.simplebeaconGatePass) !== null && _p !== void 0
          ? _p
          : null,
    simplebeaconGateAttestation:
      benchmarkScan && hollowGate
        ? 'limited-benchmark'
        : benchmarkScan
          ? resolveBenchmarkGateAttestation(sb, hollowGate)
          : hollowGate
            ? 'limited-scope'
            : (sb === null || sb === void 0 ? void 0 : sb.gateAttestation) ||
              (((_q = sb === null || sb === void 0 ? void 0 : sb.gate) === null || _q === void 0 ? void 0 : _q.pass)
                ? 'platform-gate-pass'
                : ((_r = sb === null || sb === void 0 ? void 0 : sb.gate) === null || _r === void 0
                      ? void 0
                      : _r.pass) === false
                  ? 'fail'
                  : 'not-evaluated'),
    handoffEligible: false,
  };
  if (benchmarkScan) {
    next.summary.scanTargetProfile = 'benchmark-cache';
    next.summary.productPlatformRoot = productPlatformRoot;
    next.summary.handoffEligible = false;
    next.summary.simplebeaconGateAttestation = resolveBenchmarkGateAttestation(sb, hollowGate);
    if (hollowGate) {
      next.summary.simplebeaconGatePass = null;
    }
  } else if (hollowGate) {
    next.summary.scanTargetProfile = 'limited-gate-scope';
    next.summary.simplebeaconGateAttestation = 'limited-scope';
    next.summary.handoffEligible = false;
  }
  const roadmapSummary = resolveRoadmapSummaryFiles(next.results.roadmap, platformRepo, next.summary);
  next.summary.roadmapFiles = roadmapSummary.roadmapFiles;
  if (roadmapSummary.roadmapFilesRaw != null) {
    next.summary.roadmapFilesRaw = roadmapSummary.roadmapFilesRaw;
  }
  if (roadmapSummary.roadmapFilesNote) {
    next.summary.roadmapFilesNote = roadmapSummary.roadmapFilesNote;
  }
  if ((_s = next.results.mockScan) === null || _s === void 0 ? void 0 : _s.digestTrust) {
    next.summary.fictionDigestTrust = next.results.mockScan.digestTrust;
  }
  if ((_t = next.results.consolidation) === null || _t === void 0 ? void 0 : _t.exportSanitized) {
    next.summary.consolidationExportSanitized = true;
  }
  if ((_u = next.results.roadmap) === null || _u === void 0 ? void 0 : _u.exportNormalized) {
    next.summary.roadmapExportNormalized = true;
  }
  if (next.results.fileReduction || next.results.dataQuality) {
    next.completeScanAnalysis = buildCompleteScanAnalysis({
      fileReduction: next.results.fileReduction,
      dataQuality: next.results.dataQuality,
      projectPath: next.projectPath,
    });
    const profile = (_v = next.completeScanAnalysis) === null || _v === void 0 ? void 0 : _v.artifactProfile;
    if (profile === 'mixed-no-safe-delete') {
      next.completeScanAnalysis.artifactProfileNote =
        'No safe-to-delete build artifacts — follow data-quality priority actions and optional duplicate consolidation.';
    }
    if (benchmarkScan && next.completeScanAnalysis) {
      /**
       * Notes.
       * @param {any} next.completeScanAnalysis.notes || []
       * @returns {any}
       */
      const notes = (next.completeScanAnalysis.notes || []).filter((note) => {
        const text = String(note);
        if (/exclude(s)?\s+github-cache/i.test(text)) return false;
        if (/^Scan target is an OSS clone under github-cache\/ — not Simplebeacon product code\.$/i.test(text.trim())) {
          return false;
        }
        return true;
      });
      notes.unshift(
        'Scan target is an OSS clone under github-cache/ — not Simplebeacon product code. Gate rules for ai-platform paths did not apply.'
      );
      next.completeScanAnalysis = {
        ...next.completeScanAnalysis,
        scanTargetProfile: 'benchmark-cache',
        notes: dedupeCompleteScanExportNotes(notes),
      };
    } else if (next.completeScanAnalysis) {
      next.completeScanAnalysis = {
        ...next.completeScanAnalysis,
        scanTargetProfile: 'product',
        projectPath: String(next.projectPath || '').replace(/\\/g, '/'),
      };
    }
  }
  if (next.results.npmAudit) {
    next.results.npmAudit = sanitizeNpmAuditExport(next.results.npmAudit, next.projectPath, {
      repositoryFilesTotal:
        (_w = sb === null || sb === void 0 ? void 0 : sb.repositoryFilesTotal) !== null && _w !== void 0
          ? _w
          : (_x = sb === null || sb === void 0 ? void 0 : sb.repositoryInventory) === null || _x === void 0
            ? void 0
            : _x.totalFiles,
      gateReport: sb || null,
    });
  }
  if (next.results.compliance && sb) {
    const bundled = sanitizeComplianceBundleExport({
      projectPath: next.projectPath,
      gateReport: sb,
      checklist: next.results.compliance,
      npmAudit: next.results.npmAudit || null,
    });
    next.results.compliance = bundled.checklist;
    next.summary = {
      ...next.summary,
      complianceStatus: bundled.complianceStatus,
      complianceHandoffEligible: false,
      complianceExportNotes: bundled.exportNotes,
    };
  } else if (next.results.compliance) {
    next.results.compliance = sanitizeComplianceForCompleteScan(next.results.compliance, sb, next.projectPath, {
      benchmarkScan,
      hollowGate,
      productPlatformRoot,
    });
  }
  if (next.results.cleanupAssistant) {
    next.results.cleanupAssistant = sanitizeCleanupBriefExport(next.results.cleanupAssistant, {
      projectPath: next.projectPath,
      repositoryFilesTotal:
        (_y = sb === null || sb === void 0 ? void 0 : sb.repositoryFilesTotal) !== null && _y !== void 0
          ? _y
          : (_z = sb === null || sb === void 0 ? void 0 : sb.repositoryInventory) === null || _z === void 0
            ? void 0
            : _z.totalFiles,
      gateReport: sb || null,
    });
  }
  if (next.results.dataQuality) {
    next.results.dataQuality = sanitizeDataCleanupReportExport(next.results.dataQuality, {
      projectPath: next.projectPath,
      repositoryFilesTotal:
        (_0 = sb === null || sb === void 0 ? void 0 : sb.repositoryFilesTotal) !== null && _0 !== void 0
          ? _0
          : (_1 = sb === null || sb === void 0 ? void 0 : sb.repositoryInventory) === null || _1 === void 0
            ? void 0
            : _1.totalFiles,
      gateReport: sb || null,
    });
  }
  if (next.results.fileReduction) {
    next.results.fileReduction = sanitizeDataCleanupReportExport(next.results.fileReduction, {
      projectPath: next.projectPath,
      repositoryFilesTotal:
        (_2 = sb === null || sb === void 0 ? void 0 : sb.repositoryFilesTotal) !== null && _2 !== void 0
          ? _2
          : (_3 = sb === null || sb === void 0 ? void 0 : sb.repositoryInventory) === null || _3 === void 0
            ? void 0
            : _3.totalFiles,
      gateReport: sb || null,
    });
  }
  if (next.results.codebase) {
    next.results.codebase = sanitizeCodebaseReportExport(next.results.codebase, nestedOptions);
  }
  next.projectPath = String(next.projectPath || '').replace(/\\/g, '/');
  const scanTargetRoot = next.projectPath;
  const sbFinal = next.results.simplebeacon;
  const complianceResult = next.results.compliance;
  const consolidationResult = next.results.consolidation;
  const mockScanResult = next.results.mockScan;
  const cleanupResult = next.results.cleanupAssistant;
  next.summary = {
    ...next.summary,
    handoffEligible: false,
    securityHandoffEligible: false,
    ...(sbFinal
      ? {
          simplebeaconGatePass:
            (_5 = (_4 = sbFinal.gate) === null || _4 === void 0 ? void 0 : _4.pass) !== null && _5 !== void 0
              ? _5
              : next.summary.simplebeaconGatePass,
          simplebeaconIssues:
            (_8 =
              (_6 = sbFinal.issueCount) !== null && _6 !== void 0
                ? _6
                : (_7 = sbFinal.gate) === null || _7 === void 0
                  ? void 0
                  : _7.blockingCount) !== null && _8 !== void 0
              ? _8
              : (_10 = (_9 = sbFinal.rawIssues) === null || _9 === void 0 ? void 0 : _9.length) !== null &&
                  _10 !== void 0
                ? _10
                : next.summary.simplebeaconIssues,
        }
      : {}),
    ...((complianceResult === null || complianceResult === void 0 ? void 0 : complianceResult.summary) ||
    ((_11 = complianceResult === null || complianceResult === void 0 ? void 0 : complianceResult.checklist) === null ||
    _11 === void 0
      ? void 0
      : _11.summary)
      ? {
          compliancePassed:
            (_14 = (
              (_13 = (_12 = complianceResult.checklist) === null || _12 === void 0 ? void 0 : _12.summary) !== null &&
              _13 !== void 0
                ? _13
                : complianceResult.summary
            ).passed) !== null && _14 !== void 0
              ? _14
              : next.summary.compliancePassed,
          complianceFailed:
            (_17 = (
              (_16 = (_15 = complianceResult.checklist) === null || _15 === void 0 ? void 0 : _15.summary) !== null &&
              _16 !== void 0
                ? _16
                : complianceResult.summary
            ).failed) !== null && _17 !== void 0
              ? _17
              : next.summary.complianceFailed,
        }
      : {}),
    ...((consolidationResult === null || consolidationResult === void 0 ? void 0 : consolidationResult.summary)
      ? {
          consolidationDuplicateGroups:
            (_19 =
              (_18 = consolidationResult.summary.exactDuplicateGroups) !== null && _18 !== void 0
                ? _18
                : consolidationResult.summary.mergeCandidates) !== null && _19 !== void 0
              ? _19
              : next.summary.consolidationDuplicateGroups,
        }
      : {}),
    ...(mockScanResult
      ? {
          fictionKpiHits: (mockScanResult.fictionIssues || []).reduce((sum, issue) => sum + (issue.count || 1), 0),
          fictionDigestTrust:
            (_20 = mockScanResult.digestTrust) !== null && _20 !== void 0 ? _20 : next.summary.fictionDigestTrust,
        }
      : {}),
  };
  if (next.summary.platformScope) {
    next.summary.platformScope = {
      ...next.summary.platformScope,
      handoffEligible: false,
      securityHandoffEligible: false,
      scanPaths:
        (sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.scanPaths) || next.summary.platformScope.scanPaths,
      simplebeaconGatePass:
        (_23 =
          (_21 = next.summary.simplebeaconGatePass) !== null && _21 !== void 0
            ? _21
            : (_22 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gate) === null || _22 === void 0
              ? void 0
              : _22.pass) !== null && _23 !== void 0
          ? _23
          : null,
      simplebeaconGateAttestation:
        benchmarkScan && hollowGate
          ? 'limited-benchmark'
          : benchmarkScan
            ? resolveBenchmarkGateAttestation(sbFinal, hollowGate)
            : (sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gateAttestation) ||
              ((
                (_24 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gate) === null || _24 === void 0
                  ? void 0
                  : _24.pass
              )
                ? 'platform-gate-pass'
                : ((_25 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gate) === null || _25 === void 0
                      ? void 0
                      : _25.pass) === false
                  ? 'fail'
                  : next.summary.simplebeaconGateAttestation),
    };
  }
  const auditFiles =
    (_26 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.repositoryFilesTotal) !== null && _26 !== void 0
      ? _26
      : (_27 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.repositoryInventory) === null || _27 === void 0
        ? void 0
        : _27.totalFiles;
  const cleanupExplorer =
    (_32 =
      (_31 =
        (_29 =
          (_28 = cleanupResult === null || cleanupResult === void 0 ? void 0 : cleanupResult.inventory) === null ||
          _28 === void 0
            ? void 0
            : _28.explorerInventoryRaw) !== null && _29 !== void 0
          ? _29
          : (_30 = cleanupResult === null || cleanupResult === void 0 ? void 0 : cleanupResult.inventory) === null ||
              _30 === void 0
            ? void 0
            : _30.totalFiles) !== null && _31 !== void 0
        ? _31
        : next.summary.cleanupProjectedFilesRaw) !== null && _32 !== void 0
      ? _32
      : next.summary.cleanupProjectedFiles;
  if (auditFiles != null && cleanupExplorer != null && cleanupExplorer > auditFiles) {
    next.summary.cleanupProjectedFilesRaw = cleanupExplorer;
    next.summary.cleanupProjectedFiles = auditFiles;
    next.summary.cleanupProjectedFilesNote =
      ((_33 = cleanupResult === null || cleanupResult === void 0 ? void 0 : cleanupResult.inventory) === null ||
      _33 === void 0
        ? void 0
        : _33.inventoryNote) ||
      `Cleanup inventory (${Number(cleanupExplorer).toLocaleString()} files) includes un-walked shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files on this clone.`;
  } else if (
    ((_34 = cleanupResult === null || cleanupResult === void 0 ? void 0 : cleanupResult.inventory) === null ||
    _34 === void 0
      ? void 0
      : _34.auditRepositoryFiles) != null
  ) {
    next.summary.cleanupProjectedFiles = cleanupResult.inventory.auditRepositoryFiles;
  } else if (
    ((_35 = cleanupResult === null || cleanupResult === void 0 ? void 0 : cleanupResult.inventory) === null ||
    _35 === void 0
      ? void 0
      : _35.totalFiles) != null
  ) {
    next.summary.cleanupProjectedFiles = cleanupResult.inventory.totalFiles;
  }
  const roadmapSummaryFinal = resolveRoadmapSummaryFiles(next.results.roadmap, auditFiles, next.summary);
  next.summary.roadmapFiles = roadmapSummaryFinal.roadmapFiles;
  if (roadmapSummaryFinal.roadmapFilesRaw != null) {
    next.summary.roadmapFilesRaw = roadmapSummaryFinal.roadmapFilesRaw;
  }
  if (roadmapSummaryFinal.roadmapFilesNote) {
    next.summary.roadmapFilesNote = roadmapSummaryFinal.roadmapFilesNote;
  }
  if ((_36 = next.summary.complianceExportNotes) === null || _36 === void 0 ? void 0 : _36.length) {
    next.summary.complianceExportNotes = dedupeCompleteScanExportNotes(next.summary.complianceExportNotes);
  }
  if (!benchmarkScan) {
    const exportNotes = [];
    exportNotes.push(
      'securityHandoffEligible is false — complete scan bundle is hygiene aggregation only, not vendor security handoff.'
    );
    exportNotes.push('Absolute scan paths are redacted to project label in operator exports.');
    if (auditFiles != null && cleanupExplorer != null && cleanupExplorer > auditFiles * 2) {
      exportNotes.push(
        `Cleanup brief inventory (${Number(cleanupExplorer).toLocaleString()} files) includes un-walked regenerable shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`
      );
    }
    if (
      ((_37 = next.completeScanAnalysis) === null || _37 === void 0 ? void 0 : _37.artifactProfile) ===
      'mixed-no-safe-delete'
    ) {
      exportNotes.push(
        'No phase-1 safe-delete bytes — use priorityActions for env keys, sync I/O review, and optional duplicate consolidation.'
      );
    }
    const credentialScanned =
      (_39 =
        (_38 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.credentialScanned) !== null && _38 !== void 0
          ? _38
          : sbFinal === null || sbFinal === void 0
            ? void 0
            : sbFinal.productionLeakScanned) !== null && _39 !== void 0
        ? _39
        : null;
    const gateProfile =
      (_41 =
        (_40 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.scanScope) === null || _40 === void 0
          ? void 0
          : _40.profile) !== null && _41 !== void 0
        ? _41
        : null;
    if (auditFiles != null && credentialScanned != null && credentialScanned < auditFiles) {
      exportNotes.push(
        `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(auditFiles - credentialScanned).toLocaleString()} metadata-only path(s) in full-tree inventory of ${Number(auditFiles).toLocaleString()}.`
      );
    }
    const fictionJson =
      (_42 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.fictionJsonFilesScanned) !== null &&
      _42 !== void 0
        ? _42
        : (_43 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.scanScope) === null || _43 === void 0
          ? void 0
          : _43.fictionJsonFilesScanned;
    const fictionSamples =
      (_44 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.fictionSampleFilesScanned) !== null &&
      _44 !== void 0
        ? _44
        : sbFinal === null || sbFinal === void 0
          ? void 0
          : sbFinal.mockSampleFiles;
    if (fictionJson != null && fictionSamples != null) {
      exportNotes.push(
        // simplebeacon:production-leak-intent - legitimate KPI reference for gate scan reporting
        `Gate fiction KPI rules evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) with ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
      );
    }
    if (gateProfile) {
      exportNotes.push(
        `Gate rule bundle profile: ${gateProfile} — pair complete scan bundle with json/simplebeacon-gate.json for handoff evidence.`
      );
    }
    const blockingCount =
      (_47 =
        (_46 =
          (_45 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gate) === null || _45 === void 0
            ? void 0
            : _45.blockingCount) !== null && _46 !== void 0
          ? _46
          : sbFinal === null || sbFinal === void 0
            ? void 0
            : sbFinal.issueCount) !== null && _47 !== void 0
        ? _47
        : null;
    if (
      ((_48 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gate) === null || _48 === void 0
        ? void 0
        : _48.pass) === false &&
      (blockingCount !== null && blockingCount !== void 0 ? blockingCount : 0) > 0
    ) {
      exportNotes.push(
        `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) — complete scan bundle aggregates hygiene only; see json/simplebeacon-gate.json for production-path evidence.`
      );
    } else if (
      (_49 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gate) === null || _49 === void 0
        ? void 0
        : _49.pass
    ) {
      exportNotes.push(
        'Complete scan gate pass is a hygiene bundle — not Simplebeacon vendor security handoff clearance by itself.'
      );
    }
    if (
      ((_50 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.scanScope) === null || _50 === void 0
        ? void 0
        : _50.jestExecutedDuringScan) === false ||
      (sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.jestBaselineChecked) === false
    ) {
      exportNotes.push(
        'Jest was not run during the gate step — run `npm test` or `simplebeacon:full` before vendor handoff sign-off.'
      );
    }
    exportNotes.push(
      'Compliance checklist attests rule rows only — handoffEligible remains false until operator sign-off.'
    );
    const hygieneSummary = {
      completeScanHealthStatus:
        next.summary.simplebeaconGatePass &&
        ((_51 = next.summary.complianceFailed) !== null && _51 !== void 0 ? _51 : 1) === 0
          ? 'hygiene-pass-not-handoff'
          : 'review-required',
      enginesRun:
        (_55 =
          (_53 = (_52 = next.enginesRun) === null || _52 === void 0 ? void 0 : _52.length) !== null && _53 !== void 0
            ? _53
            : (_54 = next.summary) === null || _54 === void 0
              ? void 0
              : _54.stepCount) !== null && _55 !== void 0
          ? _55
          : null,
      stepsCompleted:
        (_57 = (_56 = next.summary) === null || _56 === void 0 ? void 0 : _56.stepsCompleted) !== null && _57 !== void 0
          ? _57
          : null,
      gatePass:
        (_60 =
          (_58 = next.summary.simplebeaconGatePass) !== null && _58 !== void 0
            ? _58
            : (_59 = sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.gate) === null || _59 === void 0
              ? void 0
              : _59.pass) !== null && _60 !== void 0
          ? _60
          : null,
      blockingCount,
      gateRepositoryFilesTotal: auditFiles,
      ...(credentialScanned != null ? { credentialScanned } : {}),
      ...(credentialScanned != null ? { contentFilesScanned: credentialScanned } : {}),
      ...(auditFiles != null && credentialScanned != null && auditFiles > credentialScanned
        ? { gateMetadataOnlyFiles: auditFiles - credentialScanned }
        : {}),
      ...(fictionJson != null ? { fictionJsonFilesScanned: fictionJson } : {}),
      ...(fictionSamples != null ? { fictionSampleFilesScanned: fictionSamples } : {}),
      ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
      compliancePassed: (_61 = next.summary.compliancePassed) !== null && _61 !== void 0 ? _61 : null,
      complianceFailed: (_62 = next.summary.complianceFailed) !== null && _62 !== void 0 ? _62 : null,
      euAiActIncluded: (_63 = next.summary.euAiActIncluded) !== null && _63 !== void 0 ? _63 : null,
      jestBaselineChecked:
        (sbFinal === null || sbFinal === void 0 ? void 0 : sbFinal.jestBaselineChecked) === false ? false : undefined,
      attestationNote:
        'Complete scan bundle — nested engine exports are hygiene only, not vendor handoff certification.',
    };
    next = {
      ...next,
      exportNormalized: true,
      exportSanitized: true,
      scanTargetProfile: 'product',
      securityHandoffEligible: false,
      handoffEligible: false,
      completeScanHealthStatus:
        next.summary.simplebeaconGatePass &&
        ((_64 = next.summary.complianceFailed) !== null && _64 !== void 0 ? _64 : 1) === 0
          ? 'hygiene-pass-not-handoff'
          : 'review-required',
      scanScope: {
        resultsViewScope: 'complete-scan-bundle',
        securityHandoffEligible: false,
        ...(auditFiles != null ? { gateRepositoryFilesTotal: auditFiles } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        completeScanNote:
          'Complete scan bundle — pair with json/simplebeacon-gate.json and per-engine JSON exports for handoff evidence.',
      },
      hygieneSummary,
      exportNotes: dedupeCompleteScanExportNotes(exportNotes).slice(0, 14),
    };
  } else {
    next = {
      ...next,
      exportSanitized: true,
      exportNormalized: true,
      benchmarkScan: true,
      scanTargetProfile: 'benchmark-cache',
      scanTargetRoot,
      platformRoot: productPlatformRoot || scanTargetRoot,
      productPlatformRoot: productPlatformRoot || undefined,
      handoffEligible: false,
      securityHandoffEligible: false,
      completeScanHealthStatus: next.summary.simplebeaconGatePass
        ? 'benchmark-hygiene-pass'
        : 'benchmark-review-required',
      hygieneSummary: buildBenchmarkCompleteScanHygieneSummary(next, auditFiles),
      exportNotes: assembleBenchmarkCompleteScanExportNotes(next.exportNotes || []),
    };
  }
  return next;
}
/** Strip github-cache/deliverables noise; benchmark-clone scope for OSS exports. */
export function sanitizeConsolidationExport(scan, options = {}) {
  return sanitizeConsolidationExportCore(scan, options);
}
/**
 * Roadmap path touches benchmark.
 * @param {string} filePath
 * @returns {any}
 */
function roadmapPathTouchesBenchmark(filePath) {
  const rel = String(filePath || '').replace(/\\/g, '/');
  return (
    rel.startsWith('github-cache/') ||
    rel.includes('/github-cache/') ||
    rel.startsWith('deliverables/') ||
    rel.includes('/deliverables/')
  );
}
/**
 * Filter roadmap top directories export.
 * @param {Array} dirNames
 * @returns {any}
 */
function filterRoadmapTopDirectoriesExport(dirNames) {
  const skip = new Set([
    'github-cache',
    'deliverables',
    'data-central',
    'docs',
    'archive',
    'node_modules',
    '.simplebeacon',
  ]);
  return dirNames.filter((name) => !skip.has(name));
}
/** Strip github-cache noise from roadmap exports; flag stale 41k+ file walks. */
export function sanitizeRoadmapExport(roadmap, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  if (!roadmap || roadmap.type !== 'dynamic-project-roadmap-analysis') return roadmap;
  const benchmarkScan =
    options.benchmarkScan ||
    isBenchmarkCachePath(options.scanTargetRoot || options.requestedProjectPath || '') ||
    isBenchmarkCachePath(roadmap.scanTargetRoot || roadmap.requestedScanRoot || '') ||
    isBenchmarkCachePath(
      roadmap.sourceProjectPath ||
        ((_a = roadmap.projectStructure) === null || _a === void 0 ? void 0 : _a.projectRoot) ||
        ''
    );
  const structure = ((_b = roadmap.codeAnalysis) === null || _b === void 0 ? void 0 : _b.structure) || {};
  const repoRaw = (_c = structure.totalFiles) !== null && _c !== void 0 ? _c : null;
  const staleWalk = repoRaw != null && repoRaw > 14000;
  const deps = (_d = roadmap.codeAnalysis) === null || _d === void 0 ? void 0 : _d.dependencies;
  const sampleInternal = ((deps === null || deps === void 0 ? void 0 : deps.sampleInternal) || []).filter(
    (edge) => !roadmapPathTouchesBenchmark(String(edge).split(' -> ')[0])
  );
  const phase2 = (_e = roadmap.codeAnalysis) === null || _e === void 0 ? void 0 : _e.phase2;
  let nextPhase2 = phase2;
  if (
    (_f = phase2 === null || phase2 === void 0 ? void 0 : phase2.dependencyGraph) === null || _f === void 0
      ? void 0
      : _f.edges
  ) {
    const edges = phase2.dependencyGraph.edges.filter(
      (edge) => !roadmapPathTouchesBenchmark(edge.from) && !roadmapPathTouchesBenchmark(edge.to)
    );
    nextPhase2 = {
      ...phase2,
      dependencyGraph: {
        ...phase2.dependencyGraph,
        edges,
        edgeCount: edges.length,
      },
    };
  }
  const topDirectories = filterRoadmapTopDirectoriesExport(structure.topDirectories || []);
  const mainCategories = {};
  for (const [name, category] of Object.entries(
    ((_g = roadmap.projectStructure) === null || _g === void 0 ? void 0 : _g.mainCategories) || {}
  )) {
    if (roadmapPathTouchesBenchmark(name)) continue;
    mainCategories[name] = category;
  }
  let next = {
    ...roadmap,
    codeAnalysis: {
      ...(roadmap.codeAnalysis || {}),
      structure: {
        ...structure,
        topDirectories,
        ...(staleWalk && ((_h = roadmap.projectStructure) === null || _h === void 0 ? void 0 : _h.totalFiles) != null
          ? {
              totalFilesRaw: repoRaw,
              totalFiles: roadmap.projectStructure.totalFiles,
              staleWalkNote: `Filesystem walk counted ${Number(repoRaw).toLocaleString()} files (github-cache/ included). Platform structure inventory: ${Number(roadmap.projectStructure.totalFiles).toLocaleString()} files — restart server and re-run roadmap.`,
            }
          : {}),
      },
      dependencies: deps ? { ...deps, sampleInternal } : deps,
      phase2: nextPhase2,
    },
    ...(roadmap.projectStructure
      ? {
          projectStructure: {
            ...roadmap.projectStructure,
            mainCategories,
          },
        }
      : {}),
  };
  if (
    ((_j = next.strategicInsights) === null || _j === void 0 ? void 0 : _j.sourceMetrics) &&
    staleWalk &&
    ((_k = next.projectStructure) === null || _k === void 0 ? void 0 : _k.totalFiles) != null
  ) {
    next.strategicInsights = {
      ...next.strategicInsights,
      sourceMetrics: {
        ...next.strategicInsights.sourceMetrics,
        totalFilesRaw: repoRaw,
        totalFiles: next.projectStructure.totalFiles,
      },
    };
  }
  if (
    staleWalk ||
    sampleInternal.length !== ((deps === null || deps === void 0 ? void 0 : deps.sampleInternal) || []).length ||
    benchmarkScan
  ) {
    next.exportSanitized = true;
    next.exportNotes = [
      ...(roadmap.exportNotes || []),
      ...(benchmarkScan ? ['Simplebeacon v1-internal deploy block removed for github-cache/ benchmark target.'] : []),
      ...(staleWalk && !benchmarkScan ? [next.codeAnalysis.structure.staleWalkNote] : []),
      ...(staleWalk && benchmarkScan
        ? [
            `Filesystem walk counted ${Number(repoRaw).toLocaleString()} files in this OSS clone — not ai-platform product inventory.`,
          ]
        : []),
      ...(sampleInternal.length !== ((deps === null || deps === void 0 ? void 0 : deps.sampleInternal) || []).length
        ? ['github-cache/ and deliverables/ dependency samples removed from export.']
        : []),
    ].filter((note, index, all) => all.indexOf(note) === index);
  }
  return applyBenchmarkRoadmapSanitize(next, options);
}
