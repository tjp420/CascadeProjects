/**
 * Dashboard page export bundle — browser mirror of server/lib/dashboard-export.js
 */

import {
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  buildScanConclusion,
} from '../services/analyzeService.js';
import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260716cachefix1';
import {
  stripInternalExportFields,
  resolveSectionProvenance,
  redactProjectPathForExport,
  buildQualitySummaryCsv,
  normalizeSimpleBeaconBranding,
} from './quality-export.browser.js?v=20260716cachefix1';

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
 * Is benchmark dashboard export.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkDashboardExport(report, projectPath) {
  const root = String(report?.projectRoot || projectPath || '').replace(/\\/g, '/');
  return (
    Boolean(report?.benchmarkScan || report?.scanTargetProfile === 'benchmark-cache') ||
    /\/github-cache\//i.test(root)
  );
}

/**
 * Resolve product platform root.
 * @param {number} report
 * @param {Object} config
 * @returns {any}
 */
function resolveProductPlatformRoot(report, config) {
  const explicit = String(report?.productPlatformRoot || report?.platformRoot || '').replace(
    /\\/g,
    '/'
  );
  if (explicit && !/\/github-cache\//i.test(explicit)) return explicit;
  const cloneRoot = String(report?.projectRoot || config?.projectRoot || '').replace(/\\/g, '/');
  const idx = cloneRoot.toLowerCase().indexOf('/github-cache/');
  if (idx > 0) return cloneRoot.slice(0, idx);
  return null;
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
          ? 'jest-live-baseline'
          : /repository inventory.*gate rules evaluated/i.test(text)
            ? 'repo-inventory-scoped'
            : /filesanalyzed matches repository inventory/i.test(text)
              ? 'files-analyzed-note'
              : text.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(text.trim());
  }
  return out.slice(0, 8);
}

const ISSUE_CATEGORY_ICONS = {
  credentials: '🔑',
  schema: '📄',
  production: '🔗',
  consistency: '📊',
  consolidation: '🔀',
  jest: '🧪',
  other: '📁',
};

/**
 * Severity for issues.
 * @param {Array} issues
 * @param {any} defaultSev
 * @returns {any}
 */
function severityForIssues(issues, defaultSev = 'low') {
  if (!issues.length) return 'none';
  if (issues.some((i) => i.severity === 'high' || i.severityBand === 'high')) return 'high';
  if (issues.some((i) => i.severity === 'medium' || i.severityBand === 'medium')) return 'medium';
  return defaultSev;
}

/**
 * Decorate issue categories.
 * @param {Array} categories
 * @returns {any}
 */
function decorateIssueCategories(categories = []) {
  return categories.map((cat) => ({
    ...cat,
    ...(ISSUE_CATEGORY_ICONS[cat.id] ? { icon: ISSUE_CATEGORY_ICONS[cat.id] } : {}),
  }));
}

/**
 * Resolve page specs label.
 * @param {number} report
 * @param {any} baseline
 * @param {any} benchmarkScan
 * @returns {any}
 */
function resolvePageSpecsLabel(report, baseline, benchmarkScan = false) {
  const reportLabel =
    report?.pageSampleSchemaChecked != null
      ? `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`
      : null;
  const baselineLabel = baseline?.pageSamplesLabel ?? null;
  if (benchmarkScan && baselineLabel && (!reportLabel || reportLabel === '0/0')) {
    return baselineLabel;
  }
  return reportLabel || baselineLabel || null;
}

/**
 * Build page specs note.
 * @param {number} report
 * @param {any} baseline
 * @param {any} pageSpecsLabel
 * @param {any} benchmarkScan
 * @returns {any}
 */
function buildPageSpecsNote(report, baseline, pageSpecsLabel, benchmarkScan) {
  if (!pageSpecsLabel || pageSpecsLabel === '0/0') return null;
  const reportLabel =
    report?.pageSampleSchemaChecked != null
      ? `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`
      : null;
  const baselineLabel = baseline?.pageSamplesLabel ?? null;
  if (benchmarkScan && reportLabel === '0/0' && baselineLabel) {
    return `Page sample schema not evaluated on OSS clone — summary uses repository baseline (${pageSpecsLabel}).`;
  }
  if (!benchmarkScan && baselineLabel && reportLabel && baselineLabel !== reportLabel) {
    return `baseline.pageSamplesLabel (${baselineLabel}) is catalog baseline — gate scan validated ${reportLabel} page specs in this export.`;
  }
  return null;
}

/**
 * Build jest not run note.
 * @param {number} report
 * @param {any} scanConclusion
 * @returns {any}
 */
function buildJestNotRunNote(report, scanConclusion) {
  const text = String(scanConclusion || report?.scanScope?.limitations?.join(' ') || '');
  if (
    /jest was not run/i.test(text) ||
    report?.scanScope?.jestExecutedDuringScan === false ||
    report?.jestBaselineChecked === false
  ) {
    return 'Jest was not run during this gate scan — jestTests reflects cached repository baseline, not a live test run.';
  }
  return null;
}

/**
 * Build history scope note.
 * @param {any} history
 * @param {Array} repositoryFiles
 * @param {any} benchmarkScan
 * @returns {any}
 */
function buildHistoryScopeNote(history, repositoryFiles, benchmarkScan) {
  if (!benchmarkScan || !Array.isArray(history) || repositoryFiles == null) return null;
  const misScoped = history.some((entry) => (entry?.totalFilesScanned ?? 0) > repositoryFiles * 2);
  if (!misScoped) return null;
  return 'Scan history includes product-platform file counts — latest gate report scoped to benchmark clone inventory.';
}

/**
 * Build history inventory note.
 * @param {any} history
 * @param {Array} repositoryFiles
 * @returns {any}
 */
function buildHistoryInventoryNote(history, repositoryFiles) {
  if (!Array.isArray(history) || !history.length || repositoryFiles == null) return null;
  const counts = history
    .map((entry) => entry?.totalFilesScanned)
    .filter((value) => Number.isFinite(value));
  if (!counts.length) return null;
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (min === max && max === repositoryFiles) return null;
  return `Scan history totalFilesScanned ranges ${min.toLocaleString('en-US')}–${max.toLocaleString('en-US')} — latest gate scan indexed ${Number(repositoryFiles).toLocaleString('en-US')} repository files.`;
}

/**
 * Split documentation paths.
 * @param {Array} docs
 * @returns {any}
 */
function splitDocumentationPaths(docs = []) {
  const all = Array.isArray(docs) ? docs : [];
  const operatorDocumentationFound = all.filter((doc) => !String(doc).startsWith('.simplebeacon/'));
  const simplebeaconArtifactPaths = all.filter((doc) => String(doc).startsWith('.simplebeacon/'));
  return {
    documentationFound: all,
    operatorDocumentationFound,
    simplebeaconArtifactPaths,
    operatorDocumentationCount: operatorDocumentationFound.length,
    simplebeaconArtifactCount: simplebeaconArtifactPaths.length,
  };
}

/**
 * Resolve jest tests for export.
 * @param {number} report
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
function resolveJestTestsForExport(report, baseline, dashboardHome) {
  const baselineLabel = resolveJestTestsLabel(baseline, dashboardHome);
  const jestSummary = report?.jestSummary;
  if (report?.jestBaselineChecked && jestSummary?.testsTotal != null) {
    const liveLabel = `${jestSummary.testsPassed}/${jestSummary.testsTotal}`;
    if (baselineLabel && baselineLabel !== liveLabel) {
      return {
        jestTests: liveLabel,
        jestBaselineLabel: baselineLabel,
        jestScanNote: `Live Jest during scan: ${liveLabel}; repository baseline documents ${baselineLabel}.`,
      };
    }
    return { jestTests: liveLabel, jestBaselineLabel: baselineLabel || null };
  }
  return { jestTests: baselineLabel, jestBaselineLabel: baselineLabel || null };
}

/**
 * Issue list for categories.
 * @param {number} report
 * @returns {any}
 */
function issueListForCategories(report) {
  if (!report) return [];
  if (Array.isArray(report.detectedIssues) && report.detectedIssues.length) {
    return report.detectedIssues;
  }
  return report.rawIssues || [];
}

/**
 * Build issue categories.
 * @param {number} report
 * @returns {any}
 */
export function buildIssueCategories(report) {
  if (!report) return [];

  const raw = issueListForCategories(report);
  /**
   * Count by type.
   * @param {any} typeMatch
   * @returns {any}
   */
  const countByType = (typeMatch) =>
    raw.filter((i) => typeMatch(i.type)).reduce((s, i) => s + (i.count || 1), 0);
  /**
   * Issues by type.
   * @param {any} typeMatch
   * @returns {any}
   */
  const issuesByType = (typeMatch) => raw.filter((i) => typeMatch(i.type));

  const credCount = report.credentialFindings ?? countByType((t) => /credential/i.test(t));
  const schemaCount = countByType((t) => /schema/i.test(t));
  const prodCount = report.productionLeakFindings ?? countByType((t) => /production leak/i.test(t));
  const fictionCount = countByType((t) => /fiction|consistency|kpi/i.test(t));
  const dupCount = countByType((t) => /duplicate/i.test(t));
  const jestCount = countByType((t) => /jest/i.test(t));
  const categorizedCount =
    credCount + schemaCount + prodCount + fictionCount + dupCount + jestCount;
  const totalRaw = raw.reduce((s, i) => s + (i.count || 1), 0);
  const otherIssues = raw.filter(
    (i) =>
      !/credential|schema|production leak|fiction|consistency|kpi|duplicate|jest/i.test(
        String(i.type || '')
      )
  );
  const otherCount = Math.max(0, totalRaw - categorizedCount);

  return [
    {
      id: 'credentials',
      title: 'Credential Patterns',
      count: credCount,
      severity: credCount ? 'high' : 'none',
    },
    {
      id: 'schema',
      title: 'Schema Violations',
      count: schemaCount,
      severity: schemaCount ? 'high' : 'none',
    },
    {
      id: 'production',
      title: 'Production Leaks',
      count: prodCount,
      severity: prodCount ? 'medium' : 'none',
    },
    {
      id: 'consistency',
      title: 'Consistency Issues',
      count: fictionCount,
      severity: fictionCount
        ? severityForIssues(
            issuesByType((t) => /fiction|consistency|kpi/i.test(t)),
            'medium'
          )
        : 'none',
    },
    {
      id: 'consolidation',
      title: 'Duplicate Data',
      count: dupCount,
      severity: dupCount ? 'low' : 'none',
    },
    {
      id: 'jest',
      title: 'Jest Baseline',
      count: jestCount,
      severity: jestCount
        ? severityForIssues(
            issuesByType((t) => /jest/i.test(t)),
            'high'
          )
        : 'none',
    },
    {
      id: 'other',
      title: 'Other Findings',
      count: otherCount,
      severity: otherCount ? severityForIssues(otherIssues, 'low') : 'none',
    },
  ];
}

/**
 * Build dashboard insights summary.
 * @param {number} report
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
export function buildDashboardInsightsSummary(report, baseline, dashboardHome) {
  const sev = report?.severityCounts || {};
  const gate = report?.gate || {};
  const totalIssues =
    gate.blockingCount != null
      ? gate.blockingCount
      : (sev.high || 0) + (sev.medium || 0) + (sev.low || 0);
  const healthLabel = totalIssues === 0 ? 'Healthy' : totalIssues <= 5 ? 'Review' : 'Attention';

  return {
    openIssues: totalIssues,
    consistencyScore: resolveDisplayScore(report),
    ...resolveJestTestsForExport(report, baseline, dashboardHome),
    healthStatus: healthLabel,
    severityHigh: sev.high ?? 0,
    severityMedium: sev.medium ?? 0,
    severityLow: sev.low ?? 0,
  };
}

/**
 * Dedupe scan conclusion text.
 * @param {string} text
 * @returns {any}
 */
function dedupeScanConclusionText(text) {
  if (!text) return text;
  const sentences = String(text)
    .split(/(?<=[.!?])\s+/)
    .filter(Boolean);
  const seen = new Set();
  let inventorySentenceKept = false;
  const unique = [];
  for (const sentence of sentences) {
    const key = sentence.replace(/\s+/g, ' ').trim().toLowerCase();
    if (seen.has(key)) continue;
    if (/^repository inventory:/i.test(sentence.trim())) {
      if (inventorySentenceKept) continue;
      inventorySentenceKept = true;
    }
    seen.add(key);
    unique.push(sentence.trim());
  }
  return unique.join(' ');
}

/**
 * Build dashboard scan conclusion.
 * @param {number} report
 * @param {any} scanConclusion
 * @returns {any}
 */
function buildDashboardScanConclusion(report, scanConclusion) {
  const text = scanConclusion || buildScanConclusion(report);
  return dedupeScanConclusionText(text);
}

/**
 * Sanitize report for dashboard export.
 * @param {number} report
 * @param {any} projectLabel
 * @param {Object} options
 * @returns {any}
 */
function sanitizeReportForDashboardExport(report, projectLabel = 'ai-platform', options = {}) {
  if (!report) return null;
  const sanitized = sanitizeSimplebeaconReportExport(report, {
    projectPath: report.projectRoot || projectLabel,
    exportFilename: options.exportFilename,
  });
  const euSummary = sanitized.euAiActSummary?.documentationFound?.length
    ? {
        euAiActSummary: {
          ...sanitized.euAiActSummary,
          ...splitDocumentationPaths(sanitized.euAiActSummary.documentationFound),
        },
      }
    : {};
  return {
    ...sanitized,
    ...euSummary,
    title: normalizeSimpleBeaconBranding(sanitized.title),
    generatedBy: normalizeSimpleBeaconBranding(sanitized.generatedBy),
    projectRoot: redactProjectPathForExport(sanitized.projectRoot, projectLabel),
    ...(sanitized.platformRoot
      ? { platformRoot: redactProjectPathForExport(sanitized.platformRoot, 'ai-platform') }
      : {}),
    ...(sanitized.productPlatformRoot
      ? {
          productPlatformRoot: redactProjectPathForExport(
            sanitized.productPlatformRoot,
            'ai-platform'
          ),
        }
      : {}),
    ...(sanitized.scanTargetRoot
      ? { scanTargetRoot: redactProjectPathForExport(sanitized.scanTargetRoot, projectLabel) }
      : {}),
    ...(sanitized.repositoryInventory
      ? {
          repositoryInventory: {
            ...sanitized.repositoryInventory,
            projectRoot: redactProjectPathForExport(
              sanitized.repositoryInventory.projectRoot,
              projectLabel
            ),
          },
        }
      : {}),
  };
}

/**
 * Parse jest tests label.
 * @param {any} label
 * @returns {any}
 */
function parseJestTestsLabel(label) {
  const match = String(label || '').match(/(\d+)\s*\/\s*(\d+)/);
  if (!match) return null;
  return { passedTests: Number(match[1]), totalTests: Number(match[2]) };
}

/**
 * Sanitize dashboard home export.
 * @param {any} dashboardHome
 * @param {string} context
 * @returns {any}
 */
function sanitizeDashboardHomeExport(dashboardHome, context = {}) {
  if (!dashboardHome) return null;
  const { _source, ...rest } = dashboardHome;
  let overview = dashboardHome.overview
    ? stripInternalExportFields(dashboardHome.overview)
    : dashboardHome.overview;
  const repoTotal = context.repositoryFilesTotal;
  const pageSpecsLabel = context.pageSpecsLabel;
  const jestTestsLabel = context.jestTests;
  if (overview && repoTotal != null) {
    const platformFiles = overview.totalFiles;
    if (platformFiles != null && platformFiles !== repoTotal) {
      overview = {
        ...overview,
        totalFiles: repoTotal,
        totalFilesRaw: platformFiles,
        totalFilesNote: context.benchmarkScan
          ? `Dashboard home counted ${Number(platformFiles).toLocaleString('en-US')} files — export uses gate inventory ${Number(repoTotal).toLocaleString('en-US')} on benchmark clone.`
          : `Dashboard home counted ${Number(platformFiles).toLocaleString('en-US')} files — export uses gate inventory ${Number(repoTotal).toLocaleString('en-US')} from latest scan.`,
      };
    }
    if (
      pageSpecsLabel &&
      overview.pageSamplesLabel &&
      overview.pageSamplesLabel !== pageSpecsLabel
    ) {
      overview = {
        ...overview,
        pageSamplesLabel: pageSpecsLabel,
        pageSamplesLabelRaw: overview.pageSamplesLabel,
        pageSamplesLabelSource: 'gate-scan-export-reconciled',
      };
    }
    if (jestTestsLabel && overview.passedTests != null && overview.totalTests != null) {
      const overviewLabel = `${overview.passedTests}/${overview.totalTests}`;
      const parsed = parseJestTestsLabel(jestTestsLabel);
      if (parsed && overviewLabel !== jestTestsLabel) {
        overview = {
          ...overview,
          passedTests: parsed.passedTests,
          totalTests: parsed.totalTests,
          jestTestsRaw: overviewLabel,
          jestTestsSource: 'gate-scan-export-reconciled',
        };
      }
    }
  }
  const provenance =
    dashboardHome.type === 'dashboard-home-model'
      ? 'dashboard-home-model'
      : resolveSectionProvenance(dashboardHome);
  return {
    ...rest,
    provenance,
    overview,
  };
}

/**
 * Sanitize baseline export.
 * @param {any} baseline
 * @param {string} context
 * @returns {any}
 */
function sanitizeBaselineExport(baseline, context = {}) {
  if (!baseline) return null;
  const clean = stripInternalExportFields(baseline);
  const pageSpecsLabel = context.pageSpecsLabel;
  const baselineLabel = clean.pageSamplesLabel;
  const documentedExceptions = Array.isArray(clean.documentedExceptions)
    ? clean.documentedExceptions.map((item) => ({
        ...item,
        reason: item.reason ? normalizeSimpleBeaconBranding(item.reason) : item.reason,
        scope: item.scope ? normalizeSimpleBeaconBranding(item.scope) : item.scope,
      }))
    : clean.documentedExceptions;
  return {
    ...clean,
    ...(documentedExceptions ? { documentedExceptions } : {}),
    provenance: baseline.dataSource || 'repository-audit',
    ...(pageSpecsLabel && baselineLabel && baselineLabel !== pageSpecsLabel
      ? {
          gateValidatedPageSpecsLabel: pageSpecsLabel,
          pageSamplesLabelNote: `Catalog baseline lists ${baselineLabel} page specs — latest gate scan validated ${pageSpecsLabel}.`,
        }
      : {}),
  };
}

/**
 * Sanitize config export.
 * @param {Object} config
 * @param {any} projectLabel
 * @returns {any}
 */
function sanitizeConfigExport(config, projectLabel = 'ai-platform') {
  if (!config) return null;
  return {
    ...stripInternalExportFields(config),
    projectRoot: redactProjectPathForExport(config.projectRoot, projectLabel),
  };
}

/**
 * Build export provenance.
 * @param {Object} options
 * @param {any} baseline
 * @param {any} dashboardHome
 * @param {any} history }
 * @returns {any}
 */
function buildExportProvenance({ report, baseline, dashboardHome, history } = {}) {
  return {
    report: report?.error ? 'error' : report ? 'live-gate-scan' : 'missing',
    baseline: baseline?.dataSource || (baseline ? 'repository-audit' : 'missing'),
    dashboardHome:
      dashboardHome?.type === 'dashboard-home-model'
        ? 'dashboard-home-model'
        : resolveSectionProvenance(dashboardHome),
    history: Array.isArray(history) && history.length ? 'scan-history-store' : 'missing',
  };
}

export function buildDashboardSummary({
  report,
  baseline,
  dashboardHome,
  history,
  scanConclusion,
  projectLabel = 'ai-platform',
  benchmarkScan = false,
  productPlatformRoot = null,
} = {}) {
  const metrics = getScanFileMetrics(report);
  const insights = buildDashboardInsightsSummary(report, baseline, dashboardHome);
  const gate = report?.gate || {};
  const pageSpecsLabel = resolvePageSpecsLabel(report, baseline, benchmarkScan);
  const pageSpecsNote = buildPageSpecsNote(report, baseline, pageSpecsLabel, benchmarkScan);
  const jestNotRunNote = buildJestNotRunNote(report, scanConclusion);
  const historyScopeNote = buildHistoryScopeNote(history, metrics.repositoryFiles, benchmarkScan);
  const historyInventoryNote = buildHistoryInventoryNote(history, metrics.repositoryFiles);

  return {
    gatePass: gate.pass ?? null,
    gateBlockingCount: gate.blockingCount ?? null,
    gateWarningCount: gate.warningCount ?? null,
    gateFailureNote:
      gate.pass === false
        ? `Gate FAIL — ${gate.blockingCount ?? 0} blocking finding(s). Review detectedIssues in report export.`
        : null,
    openIssues: insights.openIssues,
    consistencyScore: insights.consistencyScore,
    displayScore: insights.consistencyScore,
    jestTests: insights.jestTests ?? null,
    jestBaselineLabel: insights.jestBaselineLabel ?? null,
    jestScanNote: insights.jestScanNote ?? jestNotRunNote ?? null,
    pageSpecsLabel,
    healthStatus: insights.healthStatus,
    scanConclusion: buildDashboardScanConclusion(report, scanConclusion),
    mockSampleFiles: metrics.mockSampleFiles,
    ruleScopedFilesAnalyzed: metrics.ruleScopedFilesAnalyzed,
    repositoryFiles: metrics.repositoryFiles,
    repositoryFolders: metrics.repositoryFolders,
    schemaCompliance: report?.schemaCompliance ?? null,
    credentialFindings: report?.credentialFindings ?? null,
    productionLeakFindings: report?.productionLeakFindings ?? null,
    qualityScore: report?.qualityScore ?? null,
    lastScan: report?.generatedAt ?? null,
    historyLength: Array.isArray(history) ? history.length : 0,
    projectRoot: redactProjectPathForExport(
      report?.projectRoot ?? metrics.repositoryRoot,
      projectLabel
    ),
    benchmarkScan,
    ...(benchmarkScan && productPlatformRoot
      ? { productPlatformRoot: redactProjectPathForExport(productPlatformRoot, 'ai-platform') }
      : {}),
    ...(pageSpecsNote ? { pageSpecsNote } : {}),
    ...(historyScopeNote ? { historyScopeNote } : {}),
    ...(historyInventoryNote ? { historyInventoryNote } : {}),
    ...(gate.pass === false && insights.consistencyScore != null
      ? {
          displayScoreNote: `displayScore ${insights.consistencyScore} reflects sample JSON consistency — gate status is driven by detectedIssues (${gate.blockingCount ?? 0} blocking).`,
        }
      : {}),
  };
}

export function buildDashboardExportBundle({
  report,
  baseline,
  config,
  history,
  dashboardHome,
  scanConclusion,
  exportFilename,
} = {}) {
  const rawProjectPath = report?.projectRoot || config?.projectRoot || null;
  const projectLabel = projectLabelFromPath(rawProjectPath);
  const benchmarkScan = isBenchmarkDashboardExport(report, rawProjectPath);
  const productPlatformRoot = resolveProductPlatformRoot(report, config);
  const repositoryFilesTotal =
    report?.repositoryFilesTotal ?? report?.repositoryInventory?.totalFiles ?? null;
  const sanitizedReport = sanitizeReportForDashboardExport(report, projectLabel, {
    exportFilename,
  });
  const categories = decorateIssueCategories(buildIssueCategories(sanitizedReport || report));
  const summary = buildDashboardSummary({
    report: sanitizedReport || report,
    baseline,
    dashboardHome,
    history,
    scanConclusion,
    projectLabel,
    benchmarkScan,
    productPlatformRoot,
  });
  /**
   * Report export notes.
   * @param {number} sanitizedReport?.exportNotes || []
   * @returns {any}
   */
  const reportExportNotes = (sanitizedReport?.exportNotes || []).filter((note) => {
    const text = String(note);
    if (summary.gateFailureNote && /gate fail/i.test(text)) return false;
    if (summary.jestScanNote && /live jest during scan/i.test(text)) return false;
    return true;
  });
  const exportNotes = dedupeExportNotes([
    benchmarkScan
      ? 'Benchmark clone dashboard export — gate hygiene on github-cache/ OSS target, not SimpleBeacon product handoff.'
      : null,
    summary.jestScanNote,
    summary.pageSpecsNote,
    summary.historyScopeNote,
    summary.historyInventoryNote,
    summary.displayScoreNote,
    summary.gateFailureNote,
    !benchmarkScan && summary.gatePass
      ? 'Gate pass on configured severities — hygiene attestation only, not vendor handoff clearance.'
      : null,
    ...reportExportNotes,
  ]);

  return {
    type: 'simplebeacon-dashboard-export',
    version: '1.1.0',
    exportVersion: '1.1.0',
    generatedBy: 'SimpleBeacon',
    title: 'SimpleBeacon Dashboard Export',
    generatedAt: new Date().toISOString(),
    summary,
    issueCategories: categories.map(({ filter: _filter, ...cat }) => cat),
    provenance: buildExportProvenance({ report, baseline, dashboardHome, history }),
    disclaimers: [
      ...(benchmarkScan
        ? [
            'Benchmark clone dashboard export — gate scan on github-cache/ OSS target, not SimpleBeacon ai-platform product handoff.',
          ]
        : []),
      'Dashboard export bundles gate scan hygiene, repository baseline, scan history, and home overview.',
      'detectedIssues is the operator-facing issue list; rawIssues are omitted from exports.',
      'jestTests reflects live Jest when executed during scan; otherwise cached repository baseline.',
      'Scan history may include product-platform runs when the latest gate report targets a benchmark clone.',
      'Absolute host paths are redacted to project label in exports.',
      'baseline.rejectedFiction catalogs documented anti-fiction exceptions — not active KPI claims.',
    ],
    report: sanitizedReport,
    baseline: sanitizeBaselineExport(baseline, { pageSpecsLabel: summary.pageSpecsLabel }),
    config: sanitizeConfigExport(config, projectLabel),
    history: history || [],
    dashboardHome: sanitizeDashboardHomeExport(dashboardHome, {
      benchmarkScan,
      repositoryFilesTotal,
      pageSpecsLabel: summary.pageSpecsLabel,
      jestTests: summary.jestTests,
    }),
    exportSanitized: true,
    exportNormalized: true,
    benchmarkScan,
    scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'product',
    handoffEligible: false,
    hygieneSummary: {
      gatePass: summary.gatePass,
      blockingCount: summary.gateBlockingCount,
      repositoryFilesTotal: summary.repositoryFiles,
      ruleScopedFilesAnalyzed: summary.ruleScopedFilesAnalyzed,
      jestTests: summary.jestTests,
      pageSpecsLabel: summary.pageSpecsLabel,
      benchmarkScan,
      attestationNote: benchmarkScan
        ? 'Benchmark clone dashboard export — not SimpleBeacon product handoff clearance.'
        : 'Dashboard export — hygiene metrics only, not vendor handoff clearance.',
    },
    exportNotes,
  };
}

/**
 * Sanitize dashboard export.
 * @param {any} bundle
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeDashboardExport(bundle, options = {}) {
  if (!bundle) return bundle;
  if (bundle.type === 'simplebeacon-dashboard-export') {
    return buildDashboardExportBundle({
      report: bundle.report,
      baseline: bundle.baseline,
      config: bundle.config,
      history: bundle.history,
      dashboardHome: bundle.dashboardHome,
      scanConclusion: bundle.summary?.scanConclusion,
      exportFilename: options.exportFilename || options.filename,
    });
  }
  return buildDashboardExportBundle(bundle, options);
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
 * Build issue categories csv.
 * @param {Array} categories
 * @returns {any}
 */
export function buildIssueCategoriesCsv(categories) {
  if (!categories?.length) return null;
  const header = ['id', 'title', 'count', 'severity'];
  const rows = categories.map((cat) =>
    [cat.id || '', cat.title || '', cat.count ?? 0, cat.severity || ''].map(csvEscape).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Build scan history csv.
 * @param {any} history
 * @returns {any}
 */
export function buildScanHistoryCsv(history) {
  if (!history?.length) return null;
  const header = [
    'date',
    'issueCount',
    'qualityScore',
    'gatePass',
    'blockingCount',
    'warningCount',
    'totalFilesScanned',
  ];
  const rows = history.map((entry) =>
    [
      entry.date || '',
      entry.issueCount ?? '',
      entry.qualityScore ?? '',
      entry.gatePass ?? '',
      entry.blockingCount ?? '',
      entry.warningCount ?? '',
      entry.totalFilesScanned ?? '',
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Build detected issues csv.
 * @param {number} report
 * @returns {any}
 */
export function buildDetectedIssuesCsv(report) {
  const issues = report?.detectedIssues || [];
  if (!issues.length) return null;
  const header = ['severity', 'type', 'description', 'file', 'count'];
  const rows = issues.map((issue) =>
    [
      issue.severity || '',
      issue.type || '',
      issue.description || '',
      issue.filePath || issue.file || '',
      issue.count ?? 1,
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Build dashboard summary csv.
 * @param {any} summary
 * @returns {any}
 */
function buildDashboardSummaryCsv(summary) {
  return buildQualitySummaryCsv({ summary });
}

/**
 * Build dashboard csv.
 * @param {Object} options
 * @param {any} history
 * @param {number} report
 * @param {any} summary }
 * @returns {any}
 */
export function buildDashboardCsv({ issueCategories, history, report, summary } = {}) {
  const parts = [];
  const categories = buildIssueCategoriesCsv(issueCategories);
  const trend = buildScanHistoryCsv(history);
  const issues = buildDetectedIssuesCsv(report);
  const summaryCsv = !issues ? buildDashboardSummaryCsv(summary) : null;

  if (categories) parts.push(categories);
  if (summaryCsv) {
    if (parts.length) parts.push('');
    parts.push('Dashboard summary');
    parts.push(summaryCsv);
  }
  if (trend) {
    if (parts.length) parts.push('');
    parts.push('Scan history');
    parts.push(trend);
  }
  if (issues) {
    if (parts.length) parts.push('');
    parts.push('Detected issues');
    parts.push(issues);
  }
  return parts.length ? parts.join('\n') : null;
}

/**
 * Dashboard export filename.
 * @param {any} ext
 * @returns {any}
 */
export function dashboardExportFilename(ext = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (ext === 'csv') return `dashboard-metrics-${stamp}.csv`;
  return `dashboard-export-${stamp}.json`;
}
