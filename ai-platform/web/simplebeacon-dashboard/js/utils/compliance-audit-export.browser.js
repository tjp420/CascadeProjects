/**
 * Compliance Audit page export bundle — browser mirror of server/lib/compliance-audit-export.js
 */

import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260601gateexport17';
import {
  npmAuditSummary,
  redactProjectPathForExport,
  sanitizeNpmAuditForQualityExport,
  buildNpmAuditCsv,
  buildQualitySummaryCsv,
  normalizeSimpleBeaconBranding
} from './quality-export.browser.js?v=20260531qualityexport8';

/**
 * L a y e r  l a b e l s.
 */
export const LAYER_LABELS = {
  credentials: 'Credential patterns',
  fictionKpis: 'Fiction & KPI drift',
  schema: 'JSON schema & page samples',
  productionLeaks: 'Production path leaks',
  roadmap: 'Roadmap & duplicates',
  jestBaseline: 'Jest baseline',
  gate: 'Compliance gate'
};

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
 * Parse timestamp.
 * @param {any} value
 * @returns {any}
 */
function parseTimestamp(value) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : null;
}

/**
 * Is benchmark compliance audit.
 * @param {any} audit
 * @returns {any}
 */
function isBenchmarkComplianceAudit(audit = {}) {
  const path = String(audit.report?.projectRoot || '').replace(/\\/g, '/');
  return Boolean(audit.report?.benchmarkScan || audit.report?.scanTargetProfile === 'benchmark-cache')
    || /\/github-cache\//i.test(path);
}

/**
 * Resolve product platform root.
 * @param {any} audit
 * @returns {any}
 */
function resolveProductPlatformRoot(audit = {}) {
  const report = audit.report || {};
  const explicit = String(report.productPlatformRoot || report.platformRoot || '').replace(/\\/g, '/');
  if (explicit && !/\/github-cache\//i.test(explicit)) {
    return explicit;
  }
  const cloneRoot = String(report.projectRoot || '').replace(/\\/g, '/');
  const idx = cloneRoot.toLowerCase().indexOf('/github-cache/');
  if (idx > 0) return cloneRoot.slice(0, idx);
  return audit.npmAudit?.projectPath || audit.npmAudit?.auditRoot || null;
}

/**
 * Resolve live jest label.
 * @param {number} report
 * @returns {any}
 */
function resolveLiveJestLabel(report) {
  if (!report) return null;
  const jestSummary = report.jestSummary;
  if (report.jestBaselineChecked && jestSummary?.testsTotal != null) {
    return `${jestSummary.testsPassed}/${jestSummary.testsTotal}`;
  }
  return null;
}

/**
 * Resolve canonical jest label.
 * @param {any} audit
 * @returns {any}
 */
function resolveCanonicalJestLabel(audit = {}) {
  const liveLabel = resolveLiveJestLabel(audit.report);
  if (liveLabel) return liveLabel;
  const pageSampleAt = parseTimestamp(audit.pageSamples?.baselineComparison?.generatedAt);
  const reportAt = parseTimestamp(audit.report?.generatedAt);
  const pageLabel = audit.pageSamples?.baselineComparison?.overview?.jestTestsLabel
    || audit.baseline?.jestTestsLabel;
  const layerLabel = audit.auditLayers?.jestBaseline?.label;
  const benchmarkScan = isBenchmarkComplianceAudit(audit);
  if (!pageLabel) return layerLabel || null;
  if (!layerLabel || pageLabel === layerLabel) return pageLabel;
  if (pageSampleAt != null && reportAt != null && pageSampleAt >= reportAt) return pageLabel;
  if (benchmarkScan) return pageLabel;
  return layerLabel;
}

/**
 * Resolve canonical page specs label.
 * @param {any} audit
 * @returns {any}
 */
function resolveCanonicalPageSpecsLabel(audit = {}) {
  const pageSampleAt = parseTimestamp(audit.pageSamples?.baselineComparison?.generatedAt);
  const reportAt = parseTimestamp(audit.report?.generatedAt);
  const pageLabel = audit.pageSamples?.baselineComparison?.overview?.pageSamplesLabel
    || audit.baseline?.pageSamplesLabel;
  const report = audit.report || {};
  const reportLabel = report.pageSampleSchemaChecked != null
    ? `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`
    : null;
  if (pageLabel && (!reportLabel || reportLabel === '0/0' || (pageSampleAt != null && reportAt != null && pageSampleAt >= reportAt))) {
    return pageLabel;
  }
  return reportLabel || pageLabel || audit.baseline?.pageSamplesLabel || null;
}

/**
 * Dedupe export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeExportNotes(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes.filter(Boolean)) {
    const text = String(note);
    const key = /gate fail/i.test(text)
      ? 'gate-fail'
      : /jest reported.*failure/i.test(text)
        ? 'jest-failure'
        : /live jest during scan/i.test(text)
          ? 'jest-live-scan'
          : /summary jesttestslabel uses/i.test(text)
            ? 'jest-baseline-note'
            : /repository inventory.*gate rules evaluated/i.test(text)
              ? 'repo-inventory-scoped'
              : /filesanalyzed matches repository inventory/i.test(text)
                ? 'files-analyzed-note'
                : /pagesampleslabel.*catalog baseline/i.test(text)
                  ? 'page-specs-mismatch'
                  : text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.trim());
  }
  return out.slice(0, 8);
}

/**
 * Split documentation paths.
 * @param {any} euAiActSummary
 * @returns {any}
 */
function splitDocumentationPaths(euAiActSummary = {}) {
  const docs = euAiActSummary.documentationFound || [];
  if (!docs.length) return euAiActSummary;
  const operatorDocumentationFound = docs.filter((doc) => {
    const rel = String(doc).replace(/\\/g, '/');
    return rel.startsWith('docs/');
  });
  const simplebeaconArtifactPaths = docs.filter((doc) => String(doc).startsWith('.simplebeacon/'));
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
    simplebeaconArtifactCount: simplebeaconArtifactPaths.length
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
 * Build missing overlay notes.
 * @param {any} audit
 * @returns {any}
 */
function buildMissingOverlayNotes(audit = {}) {
  const notes = [];
  if (!audit.assessment) {
    notes.push('Assessment overlay omitted — run Assess on Compliance Audit page or `npx simplebeacon assess` for checklist metrics.');
  }
  if (!audit.npmAudit) {
    notes.push('npm audit overlay omitted — run npm audit on Compliance Audit page for supply-chain metrics.');
  }
  return notes;
}

/**
 * Build page specs mismatch note.
 * @param {any} audit
 * @param {any} pageSpecsLabel
 * @returns {any}
 */
function buildPageSpecsMismatchNote(audit = {}, pageSpecsLabel) {
  const baselineStatus = audit.dashboard?.baselineStatus || {};
  if (baselineStatus.pageSamplesLabelSource === 'gate-scan-export-reconciled') return null;
  const dashLabel = baselineStatus.pageSamplesLabelRaw || baselineStatus.pageSamplesLabel;
  if (!dashLabel || !pageSpecsLabel || dashLabel === pageSpecsLabel) return null;
  return `Dashboard baselineStatus pageSamplesLabel (${dashLabel}) reflects catalog baseline — gate scan validated ${pageSpecsLabel} page specs.`;
}

/**
 * Resolve project label.
 * @param {any} audit
 * @returns {any}
 */
function resolveProjectLabel(audit = {}) {
  return projectLabelFromPath(
    audit.report?.projectRoot
    || audit.npmAudit?.projectPath
    || audit.assessment?.projectRoot
  );
}

/**
 * Build audit metrics.
 * @param {any} audit
 * @returns {any}
 */
export function buildAuditMetrics(audit = {}) {
  const report = audit.report || {};
  const dash = audit.dashboard?.scanStatus || {};
  const inventory = report.repositoryInventory;

  const consistencyScore = report.consistencyScore
    ?? dash.consistencyScore
    ?? report.schemaCompliance
    ?? dash.qualityScore
    ?? report.qualityScore;

  const pageSpecsChecked = report.pageSampleSchemaChecked;
  const pageSpecsLabel = pageSpecsChecked != null
    ? `${report.pageSampleSchemaPassed ?? 0}/${pageSpecsChecked}`
    : audit.baseline?.pageSamplesLabel ?? null;

  const mockSampleFiles = report.mockSampleFiles ?? dash.mockSampleFiles ?? report.totalFiles;
  const filesAnalyzed = report.filesAnalyzed ?? dash.totalFilesScanned;

  return {
    consistencyScore,
    pageSpecsLabel,
    mockSampleFiles,
    filesAnalyzed,
    schemaChecked: report.schemaChecked,
    schemaPassed: report.schemaPassed,
    lastScan: report.generatedAt ?? dash.lastScan,
    inventoryFiles: inventory?.totalFiles ?? null,
    inventoryFolders: inventory?.totalFolders ?? null,
    inventoryRoot: inventory?.projectRoot ?? report.projectRoot ?? null,
    qualityScore: report.qualityScore ?? dash.qualityScore ?? null,
    ruleScopedFilesAnalyzed: report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? null
  };
}

/**
 * Count layer statuses.
 * @param {Array} auditLayers
 * @returns {any}
 */
function countLayerStatuses(auditLayers = {}) {
  let pass = 0;
  let fail = 0;
  let warn = 0;
  for (const [key, layer] of Object.entries(auditLayers)) {
    if (key === 'gate' || !layer) continue;
    const status = layer.status || (layer.findings > 0 ? 'fail' : 'pass');
    if (status === 'pass') pass += 1;
    else if (status === 'warn' || status === 'warning') warn += 1;
    else fail += 1;
  }
  return { pass, fail, warn };
}

/**
 * Build compliance audit summary.
 * @param {any} audit
 * @returns {any}
 */
export function buildComplianceAuditSummary(audit = {}) {
  const metrics = buildAuditMetrics(audit);
  const layers = audit.auditLayers || {};
  const gate = layers.gate || {};
  const layerCounts = countLayerStatuses(layers);
  const npmStats = audit.npmAudit && !audit.npmAudit.error ? npmAuditSummary(audit.npmAudit) : null;
  const exec = audit.assessment?.executiveSummary || {};
  const checklist = audit.assessment?.complianceChecklist?.summary || {};
  const projectLabel = resolveProjectLabel(audit);
  const benchmarkScan = isBenchmarkComplianceAudit(audit);
  const jestTestsLabel = resolveCanonicalJestLabel(audit);
  const pageSpecsLabel = resolveCanonicalPageSpecsLabel(audit);
  const liveJestLabel = resolveLiveJestLabel(audit.report);
  const layerJest = layers.jestBaseline?.label;
  let jestBaselineNote = null;
  if (liveJestLabel && layerJest && liveJestLabel !== layerJest) {
    jestBaselineNote = `Summary jestTestsLabel uses live Jest during scan (${liveJestLabel}); audit layer cached ${layerJest}.`;
  } else if (jestTestsLabel && layerJest && jestTestsLabel !== layerJest) {
    jestBaselineNote = `Summary jestTestsLabel uses fresher baseline (${jestTestsLabel}); audit layer cached ${layerJest}.`;
  }
  const pageSpecsNote = benchmarkScan && pageSpecsLabel && pageSpecsLabel !== '0/0'
    && metrics.pageSpecsLabel === '0/0'
    ? `Page sample schema not evaluated on OSS clone — summary uses product baseline panel (${pageSpecsLabel}).`
    : null;
  const npmProjectLabel = projectLabelFromPath(audit.npmAudit?.projectPath || audit.npmAudit?.auditRoot);
  const npmAuditScopeNote = benchmarkScan && npmProjectLabel && npmProjectLabel !== projectLabel
    ? `npm audit ran on product platform (${npmProjectLabel}, ${npmStats?.dependencies ?? '?'} dependencies) — gate report scoped to benchmark clone ${projectLabel}.`
    : null;
  const productPlatformRoot = resolveProductPlatformRoot(audit);

  return {
    gatePass: gate.pass ?? null,
    gateBlockingCount: gate.blockingCount ?? null,
    gateWarningCount: gate.warningCount ?? null,
    gateFailureNote: gate.pass === false
      ? `Gate FAIL — ${gate.blockingCount ?? 0} blocking finding(s). Review detectedIssues in report export.`
      : null,
    consistencyScore: metrics.consistencyScore ?? null,
    qualityScore: metrics.qualityScore ?? null,
    pageSpecsLabel,
    jestTestsLabel,
    mockSampleFiles: metrics.mockSampleFiles ?? null,
    filesAnalyzed: metrics.filesAnalyzed ?? null,
    ruleScopedFilesAnalyzed: metrics.ruleScopedFilesAnalyzed ?? null,
    lastScan: metrics.lastScan ?? null,
    inventoryFiles: metrics.inventoryFiles ?? null,
    inventoryFolders: metrics.inventoryFolders ?? null,
    projectRoot: redactProjectPathForExport(metrics.inventoryRoot, projectLabel),
    benchmarkScan,
    ...(benchmarkScan && productPlatformRoot
      ? { productPlatformRoot: redactProjectPathForExport(productPlatformRoot, 'ai-platform') }
      : {}),
    layerPassCount: layerCounts.pass,
    layerWarnCount: layerCounts.warn,
    layerFailCount: layerCounts.fail,
    fictionCatalogPatterns: Array.isArray(audit.fictionCatalog) ? audit.fictionCatalog.length : 0,
    fictionActiveFindings: layers.fictionKpis?.findings ?? null,
    npmDependencies: npmStats?.dependencies ?? null,
    npmVulnerabilities: npmStats?.vulnerabilityTotal ?? null,
    npmAuditAt: npmStats?.generatedAt ?? null,
    npmAuditScope: benchmarkScan && npmProjectLabel !== projectLabel ? 'product-platform' : 'aligned',
    assessmentGateResult: exec.gateResult ?? null,
    assessmentQualityScore: exec.qualityScore ?? null,
    checklistPassed: checklist.passed ?? null,
    checklistFailed: checklist.failed ?? null,
    checklistTotal: checklist.total ?? null,
    ...(jestBaselineNote ? { jestBaselineNote } : {}),
    ...(pageSpecsNote ? { pageSpecsNote } : {}),
    ...(npmAuditScopeNote ? { npmAuditScopeNote } : {})
  };
}

/**
 * Bucket production leaks.
 * @param {Array} issues
 * @returns {any}
 */
function bucketProductionLeaks(issues = []) {
  return issues
    .filter((issue) => /production leak/i.test(String(issue.type || '')))
    .map((issue) => ({
      file: issue.filePath || issue.file || issue.filePaths?.[0] || issue.affectedFiles?.[0] || '—',
      description: issue.description,
      severity: issue.severity,
      count: issue.count || 1,
      recommendedAction: issue.recommendedAction
    }));
}

/**
 * Summarize finding bucket.
 * @param {Array} items
 * @param {string} emptyText
 * @param {number} findingsCount
 * @returns {any}
 */
function summarizeFindingBucket(items, emptyText, findingsCount = items.length) {
  if (items.length) {
    return items.slice(0, 5).map((i) => `${i.file}: ${i.description}`).join('; ');
  }
  if (findingsCount > 0) {
    return `${findingsCount} finding(s) — see detectedIssues in gate report export.`;
  }
  return emptyText;
}

/**
 * Reconcile assessment from report.
 * @param {any} assessment
 * @param {number} report
 * @returns {any}
 */
function reconcileAssessmentFromReport(assessment, report) {
  if (!assessment || !report) return assessment;
  const sourceIssues = report.rawIssues?.length ? report.rawIssues : (report.detectedIssues || []);
  const productionLeaks = bucketProductionLeaks(sourceIssues);
  const sev = report.severityCounts || {};
  const findings = { ...(assessment.findings || {}) };

  if (findings.productionLeaks) {
    const count = report.productionLeakFindings ?? productionLeaks.length;
    findings.productionLeaks = {
      ...findings.productionLeaks,
      findings: count,
      items: productionLeaks.length ? productionLeaks : findings.productionLeaks.items,
      summary: summarizeFindingBucket(
        productionLeaks,
        'No mock/sample path references in production directories.',
        count
      )
    };
  }

  return {
    ...assessment,
    executiveSummary: {
      ...(assessment.executiveSummary || {}),
      gateResult: report.gate?.pass ? 'PASS' : 'FAIL',
      highIssues: sev.high ?? 0,
      mediumIssues: sev.medium ?? 0,
      lowIssues: sev.low ?? 0,
      blockingCount: report.gate?.blockingCount ?? assessment.executiveSummary?.blockingCount ?? 0,
      warningCount: report.gate?.warningCount ?? assessment.executiveSummary?.warningCount ?? 0
    },
    findings
  };
}

/**
 * Sanitize report export.
 * @param {number} report
 * @param {any} projectLabel
 * @param {Object} options
 * @returns {any}
 */
function sanitizeReportExport(report, projectLabel, options = {}) {
  if (!report) return null;
  const sanitized = sanitizeSimplebeaconReportExport(report, {
    projectPath: report.projectRoot || projectLabel,
    exportFilename: options.exportFilename
  });
  const euSummary = sanitized.euAiActSummary?.documentationFound?.length
    ? { euAiActSummary: splitDocumentationPaths(sanitized.euAiActSummary) }
    : {};
  return {
    ...sanitized,
    ...euSummary,
    title: normalizeSimpleBeaconBranding(sanitized.title),
    generatedBy: normalizeSimpleBeaconBranding(sanitized.generatedBy),
    blockingCount: sanitized.gate?.blockingCount ?? sanitized.blockingCount ?? null,
    warningCount: sanitized.gate?.warningCount ?? sanitized.warningCount ?? null
  };
}

/**
 * Sanitize assessment export.
 * @param {any} assessment
 * @param {any} projectLabel
 * @param {number} report
 * @returns {any}
 */
function sanitizeAssessmentExport(assessment, projectLabel, report) {
  if (!assessment) return null;
  const { sourceReport, ...rest } = assessment;
  const reconciled = reconcileAssessmentFromReport(rest, report);
  return {
    ...reconciled,
    title: normalizeSimpleBeaconBranding(reconciled.title),
    generatedBy: normalizeSimpleBeaconBranding(reconciled.generatedBy),
    projectRoot: redactProjectPathForExport(assessment.projectRoot, projectLabel),
    provenance: 'assessment-artifact',
    ...(reconciled.complianceChecklist
      ? {
        complianceChecklist: {
          ...reconciled.complianceChecklist,
          title: normalizeSimpleBeaconBranding(reconciled.complianceChecklist.title)
        }
      }
      : {}),
    ...(sourceReport
      ? {
        sourceReport: {
          generatedAt: sourceReport.generatedAt ?? null,
          duplicateGroups: sourceReport.duplicateGroups ?? null
        }
      }
      : {})
  };
}

/**
 * Sanitize audit layers export.
 * @param {Array} auditLayers
 * @param {any} audit
 * @returns {any}
 */
function sanitizeAuditLayersExport(auditLayers, audit = {}) {
  if (!auditLayers) return null;
  const report = audit.report || {};
  const gate = {
    ...(auditLayers.gate || {}),
    ...(report.gate || {})
  };
  const next = { ...auditLayers, gate };
  const liveJest = resolveLiveJestLabel(report);

  if (next.jestBaseline && liveJest) {
    const layerLabel = next.jestBaseline.label;
    next.jestBaseline = {
      ...next.jestBaseline,
      label: liveJest,
      status: report.jestBaselinePassed === false ? 'fail' : next.jestBaseline.status,
      ...(layerLabel && layerLabel !== liveJest
        ? { labelRaw: layerLabel, labelSource: 'gate-scan-export-reconciled' }
        : {})
    };
  }

  return next;
}

/**
 * Sanitize dashboard export.
 * @param {any} dashboard
 * @param {any} audit
 * @returns {any}
 */
function sanitizeDashboardExport(dashboard, audit = {}) {
  if (!dashboard) return null;
  const { fictionCatalog, ...rest } = dashboard;
  const pageSpecsLabel = resolveCanonicalPageSpecsLabel(audit);
  const report = audit.report || {};
  const gate = report.gate || audit.auditLayers?.gate || {};
  const next = {
    ...rest,
    provenance: 'dashboard-audit-snapshot',
    fictionCatalogOmitted: Array.isArray(fictionCatalog) ? fictionCatalog.length : 0
  };

  if (next.scanStatus) {
    const { lastScanRelative: _lastScanRelative, ...scanStatus } = next.scanStatus;
    next.scanStatus = scanStatus;
  }

  if (next.scanStatus && gate.pass != null) {
    const priorGatePass = next.scanStatus.gatePass;
    next.scanStatus = {
      ...next.scanStatus,
      gatePass: gate.pass,
      issueCount: gate.blockingCount ?? report.issueCount ?? next.scanStatus.issueCount,
      blockingCount: gate.blockingCount ?? next.scanStatus.blockingCount,
      warningCount: gate.warningCount ?? next.scanStatus.warningCount,
      qualityScore: report.qualityScore ?? next.scanStatus.qualityScore,
      ...(priorGatePass != null && priorGatePass !== gate.pass
        ? { gateStatusSource: 'gate-scan-export-reconciled' }
        : {})
    };
  }

  if (next.baselineStatus && pageSpecsLabel) {
    const priorLabel = next.baselineStatus.pageSamplesLabel;
    next.baselineStatus = {
      ...next.baselineStatus,
      pageSamplesLabel: pageSpecsLabel,
      ...(priorLabel && priorLabel !== pageSpecsLabel
        ? {
          pageSamplesLabelRaw: priorLabel,
          pageSamplesLabelSource: 'gate-scan-export-reconciled'
        }
        : {})
    };
  }

  if (next.baselineStatus && gate.pass != null) {
    const priorGatePass = next.baselineStatus.gatePass;
    next.baselineStatus = {
      ...next.baselineStatus,
      gatePass: gate.pass,
      ...(priorGatePass != null && priorGatePass !== gate.pass
        ? { gatePassSource: 'gate-scan-export-reconciled' }
        : {})
    };
  }

  if (next.trends?.aiAdoptionTrend) {
    next.trends = {
      ...next.trends,
      repositoryFileCountTrend: next.trends.aiAdoptionTrend,
      aiAdoptionTrendNote: 'repositoryFileCountTrend tracks repo file inventory snapshots — not AI adoption rate.'
    };
    delete next.trends.aiAdoptionTrend;
  }

  return next;
}

/**
 * Sanitize baseline export.
 * @param {any} baseline
 * @param {string} context
 * @returns {any}
 */
function sanitizeBaselineExport(baseline, context = {}) {
  if (!baseline) return null;
  const { _source, ...rest } = baseline;
  const jestLabel = context.jestTestsLabel;
  let next = { ...rest };
  if (jestLabel && next.jestTestsLabel && next.jestTestsLabel !== jestLabel) {
    next = {
      ...next,
      jestTestsLabel: jestLabel,
      jestTestsLabelRaw: next.jestTestsLabel,
      jestTestsLabelSource: 'gate-scan-export-reconciled'
    };
  }
  return { ...next, provenance: baseline.dataSource || 'repository-audit' };
}

/**
 * Build export provenance.
 * @param {any} audit
 * @returns {any}
 */
function buildExportProvenance(audit = {}) {
  return {
    report: audit.report ? 'live-gate-scan' : 'missing',
    assessment: audit.assessment ? 'assessment-artifact' : 'missing',
    npmAudit: audit.npmAudit?.error ? 'error' : (audit.npmAudit ? 'live-npm-audit' : 'missing'),
    dashboard: audit.dashboard ? 'dashboard-audit-snapshot' : 'missing',
    fictionCatalog: Array.isArray(audit.fictionCatalog) && audit.fictionCatalog.length
      ? 'rejected-fiction-catalog'
      : 'missing'
  };
}

/**
 * Build compliance audit export bundle.
 * @param {any} audit
 * @param {Object} options
 * @returns {any}
 */
export function buildComplianceAuditExportBundle(audit = {}, options = {}) {
  const projectLabel = resolveProjectLabel(audit);
  const benchmarkScan = isBenchmarkComplianceAudit(audit);
  const summary = buildComplianceAuditSummary(audit);
  const sanitizedReport = sanitizeReportExport(audit.report, projectLabel, options);
  const npmAudit = audit.npmAudit && !audit.npmAudit.error
    ? sanitizeNpmAuditForQualityExport(audit.npmAudit, benchmarkScan ? 'ai-platform' : projectLabel)
    : (audit.npmAudit?.error ? { error: audit.npmAudit.error } : audit.npmAudit || null);
  const pageSpecsMismatchNote = buildPageSpecsMismatchNote(audit, summary.pageSpecsLabel);
/**
 * Report export notes.
 * @param {number} sanitizedReport?.exportNotes || []
 * @returns {any}
 */
  const reportExportNotes = (sanitizedReport?.exportNotes || []).filter((note) => {
    const text = String(note);
    if (summary.gateFailureNote && /gate fail/i.test(text)) return false;
    if (summary.jestBaselineNote && /jest reported.*failure/i.test(text)) return false;
    return true;
  });
  const exportNotes = dedupeExportNotes([
    ...buildMissingOverlayNotes(audit),
    benchmarkScan
      ? 'Benchmark clone compliance audit — gate hygiene on github-cache/ OSS target, not SimpleBeacon product handoff.'
      : null,
    summary.jestBaselineNote,
    summary.pageSpecsNote,
    pageSpecsMismatchNote,
    summary.npmAuditScopeNote,
    summary.gateFailureNote,
    !benchmarkScan && summary.gatePass
      ? 'Gate pass on configured severities — hygiene attestation only, not vendor handoff clearance.'
      : null,
    ...reportExportNotes
  ]);

  return {
    type: 'simplebeacon-compliance-audit-export',
    version: '1.1.0',
    exportVersion: '1.1.0',
    generatedBy: 'SimpleBeacon',
    title: 'SimpleBeacon Compliance Audit Export',
    generatedAt: new Date().toISOString(),
    summary,
    provenance: buildExportProvenance(audit),
    disclaimers: [
      ...(benchmarkScan
        ? ['Benchmark clone audit export — gate scan on github-cache/ OSS target, not SimpleBeacon ai-platform product handoff.']
        : []),
      'Compliance audit export bundles gate layers, fiction catalog, and optional assessment/npm audit.',
      'fictionCatalog lists documented rejected-fiction patterns — not active KPI claims.',
      'Gate report export omits rawIssues; use detectedIssues for remediation.',
      'Absolute host paths are redacted to project label in exports.',
      'npm audit and dashboard overlays may reflect product platform scope when gate scan targets a benchmark clone.',
      'Static scan hygiene — not legal conformity or vendor handoff certification.'
    ],
    auditLayers: sanitizeAuditLayersExport(audit.auditLayers, audit),
    fictionCatalog: audit.fictionCatalog || [],
    assessment: sanitizeAssessmentExport(audit.assessment, projectLabel, sanitizedReport),
    npmAudit,
    report: sanitizedReport,
    baseline: sanitizeBaselineExport(audit.baseline, { jestTestsLabel: summary.jestTestsLabel }),
    dashboard: sanitizeDashboardExport(audit.dashboard, audit),
    pageSamples: audit.pageSamples || null,
    sourceGeneratedAt: audit.generatedAt || null,
    sourceType: audit.type || null,
    exportSanitized: true,
    exportNormalized: true,
    benchmarkScan,
    scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'product',
    handoffEligible: false,
    hygieneSummary: {
      gatePass: summary.gatePass,
      blockingCount: summary.gateBlockingCount,
      repositoryFilesTotal: summary.inventoryFiles,
      ruleScopedFilesAnalyzed: summary.ruleScopedFilesAnalyzed,
      jestTestsLabel: summary.jestTestsLabel,
      fictionCatalogPatterns: summary.fictionCatalogPatterns,
      npmVulnerabilities: summary.npmVulnerabilities,
      benchmarkScan,
      attestationNote: benchmarkScan
        ? 'Benchmark clone compliance audit — not SimpleBeacon product handoff clearance.'
        : 'Compliance audit export — hygiene metrics only, not vendor handoff clearance.'
    },
    exportNotes
  };
}

/**
 * Re-sanitize a downloaded compliance audit export JSON.
 * @param {object} bundle
 * @param {object} [options]
 * @returns {object}
 */
/**
 * Sanitize compliance audit export.
 * @param {any} bundle
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeComplianceAuditExport(bundle, options = {}) {
  if (!bundle) return bundle;
  if (bundle.type === 'simplebeacon-compliance-audit-export') {
    return buildComplianceAuditExportBundle({
      type: bundle.sourceType,
      generatedAt: bundle.sourceGeneratedAt,
      report: bundle.report,
      baseline: bundle.baseline,
      dashboard: bundle.dashboard,
      pageSamples: bundle.pageSamples,
      auditLayers: bundle.auditLayers,
      fictionCatalog: bundle.fictionCatalog,
      assessment: bundle.assessment,
      npmAudit: bundle.npmAudit
    }, options);
  }
  return buildComplianceAuditExportBundle(bundle, options);
}

/**
 * Csv escape.
 * @param {any} cell
 * @returns {any}
 */
function csvEscape(cell) {
  return `"${String(cell ?? '').replace(/"/g, '""')}"`;
}

/**
 * Build audit layers csv.
 * @param {Array} auditLayers
 * @returns {any}
 */
export function buildAuditLayersCsv(auditLayers = {}) {
  const keys = Object.keys(auditLayers).filter((key) => key !== 'gate');
  if (!keys.length) return null;

  const header = ['layer', 'label', 'status', 'checked', 'findings', 'compliance'];
  const rows = keys.map((key) => {
    const layer = auditLayers[key] || {};
    const status = layer.status || (layer.findings > 0 ? 'fail' : 'pass');
    const checked = layer.scanned ?? layer.checked ?? layer.label ?? '';
    const findings = layer.findings ?? layer.blockingCount ?? '';
    return [
      key,
      LAYER_LABELS[key] || key,
      status,
      checked,
      findings,
      layer.compliance ?? ''
    ].map(csvEscape).join(',');
  });

  return [header.join(','), ...rows].join('\n');
}

/**
 * Build assessment checklist csv.
 * @param {any} assessment
 * @returns {any}
 */
export function buildAssessmentChecklistCsv(assessment) {
  const rules = assessment?.complianceChecklist?.rules;
  if (!rules?.length) return null;
  const header = ['id', 'title', 'status', 'category', 'severity'];
  const rows = rules.map((rule) => [
    rule.id || '',
    rule.title || '',
    rule.status || '',
    rule.category || '',
    rule.severity || ''
  ].map(csvEscape).join(','));
  return [header.join(','), ...rows].join('\n');
}

/**
 * Build compliance audit summary csv.
 * @param {any} summary
 * @returns {any}
 */
export function buildComplianceAuditSummaryCsv(summary) {
  return buildQualitySummaryCsv({ summary });
}

/**
 * Build compliance audit csv.
 * @param {Object} options
 * @param {any} assessment
 * @param {any} npmAudit
 * @param {any} summary }
 * @returns {any}
 */
export function buildComplianceAuditCsv({ auditLayers, assessment, npmAudit, summary } = {}) {
  const parts = [];
  const layers = buildAuditLayersCsv(auditLayers);
  const checklist = buildAssessmentChecklistCsv(assessment);
  const npm = buildNpmAuditCsv(npmAudit);
  const summaryCsv = !checklist ? buildComplianceAuditSummaryCsv(summary) : null;

  if (layers) parts.push(layers);
  if (summaryCsv) {
    if (parts.length) parts.push('');
    parts.push('Compliance audit summary');
    parts.push(summaryCsv);
  }
  if (checklist) {
    if (parts.length) parts.push('');
    parts.push('Assessment checklist');
    parts.push(checklist);
  }
  if (npm) {
    if (parts.length) parts.push('');
    parts.push('npm audit vulnerabilities');
    parts.push(npm);
  }
  return parts.length ? parts.join('\n') : null;
}

/**
 * Compliance audit export filename.
 * @param {any} ext
 * @returns {any}
 */
export function complianceAuditExportFilename(ext = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (ext === 'csv') return `compliance-audit-metrics-${stamp}.csv`;
  return `compliance-audit-export-${stamp}.json`;
}
