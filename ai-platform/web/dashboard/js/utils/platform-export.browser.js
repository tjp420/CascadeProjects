/**
 * Platform page export bundle — browser mirror of server/lib/platform-export.js
 */

import { resolveJestTestsLabel } from '../services/analyzeService.js';
import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260716cachefix1';
import {
  stripInternalExportFields,
  resolveSectionProvenance,
  redactProjectPathForExport,
  sanitizeCoverageExport,
  sanitizeSecurityExport,
  sanitizeQualityExport,
  normalizeSimpleBeaconBranding,
} from './quality-export.browser.js?v=20260716cachefix1';

/**
 * Parse numeric.
 * @param {any} value
 * @returns {any}
 */
function parseNumeric(value) {
  if (value == null) return null;
  const match = String(value)
    .replace(/,/g, '')
    .match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

/**
 * Format signed delta.
 * @param {any} delta
 * @param {any} unit
 * @returns {any}
 */
function formatSignedDelta(delta, unit = '') {
  if (!Number.isFinite(delta)) return '—';
  const sign = delta > 0 ? '+' : delta < 0 ? '' : '';
  const suffix = unit ? ` ${unit}` : '';
  return `${sign}${delta}${suffix}`;
}

/**
 * Format security score for display.
 * @param {any} security
 * @param {any} overview
 * @returns {any}
 */
export function formatSecurityScoreForDisplay(security, overview) {
  if (security?.securityScore != null) {
    const num = Number(security.securityScore);
    if (Number.isFinite(num)) return `${num}/100`;
    return String(security.securityScore);
  }
  if (overview?.securityScore != null) return String(overview.securityScore);
  return null;
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
 * Resolve canonical jest label.
 * @param {any} baseline
 * @param {any} dashboardHome
 * @param {any} coverage
 * @returns {any}
 */
function resolveCanonicalJestLabel(baseline, dashboardHome, coverage) {
  const coverageLabel =
    coverage?.jestTestsLabel ||
    (coverage?.passedTests != null && coverage?.totalTests != null
      ? `${coverage.passedTests}/${coverage.totalTests}`
      : null);
  const baselineLabel = resolveJestTestsLabel(baseline, dashboardHome);
  if (!coverageLabel) return baselineLabel;
  if (!baselineLabel) return coverageLabel;
  const covAt = coverage?.testCountGeneratedAt;
  const baseAt = baseline?.syncedAt ?? dashboardHome?.baselineSyncedAt;
  if (covAt && baseAt && Date.parse(covAt) >= Date.parse(baseAt)) return coverageLabel;
  const covN = parseNumeric(coverageLabel.split('/')[0]);
  const baseN = parseNumeric(baselineLabel.split('/')[0]);
  if (covN != null && baseN != null && covN !== baseN) return coverageLabel;
  return baselineLabel;
}

/**
 * Is benchmark platform export.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkPlatformExport(report, projectPath) {
  const path = String(report?.projectRoot || projectPath || '').replace(/\\/g, '/');
  return (
    Boolean(report?.benchmarkScan || report?.scanTargetProfile === 'benchmark-cache') ||
    /\/github-cache\//i.test(path)
  );
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
    const normalized = text.replace(/\s+/g, ' ').trim().toLowerCase();
    const scopeKey = /baseline\.pagesampleslabel .* catalog baseline/i.test(normalized)
      ? 'page-samples-note'
      : /summary jesttests uses coverage snapshot/i.test(normalized)
        ? 'jest-baseline-note'
        : /security score uses live overlay/i.test(normalized)
          ? 'security-overlay-note'
          : /jest counts refreshed .* istanbul summary lastrun/i.test(normalized)
            ? 'coverage-freshness-note'
            : /quality panel cached/i.test(normalized)
              ? 'quality-stale-note'
              : /quality panel shows/i.test(normalized)
                ? 'quality-pass-mismatch-note'
                : /quality \(.*\) and coverage/i.test(normalized)
                  ? 'quality-coverage-diff-note'
                  : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(normalizeSimpleBeaconBranding(text.trim()));
  }
  return out.slice(0, 8);
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
 * Sanitize report for platform export.
 * @param {number} report
 * @param {any} projectLabel
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeReportForPlatformExport(
  report,
  projectLabel = 'ai-platform',
  options = {}
) {
  if (!report) return null;
  const sanitized = sanitizeSimplebeaconReportExport(report, {
    projectPath: report.projectRoot || report.platformRoot,
    exportFilename: options.exportFilename,
    ...options,
  });
  const next = { ...sanitized };
  if (next.llmSlopScanReconciled && next.llmSlopScanRaw != null) {
    delete next.llmSlopScanRaw;
  }
  return {
    ...next,
    projectRoot: redactProjectPathForExport(next.projectRoot, projectLabel),
    ...(next.platformRoot
      ? { platformRoot: redactProjectPathForExport(next.platformRoot, 'ai-platform') }
      : {}),
    ...(next.productPlatformRoot
      ? { productPlatformRoot: redactProjectPathForExport(next.productPlatformRoot, 'ai-platform') }
      : {}),
    ...(next.scanTargetRoot
      ? { scanTargetRoot: redactProjectPathForExport(next.scanTargetRoot, projectLabel) }
      : {}),
    ...(next.repositoryInventory
      ? {
          repositoryInventory: {
            ...next.repositoryInventory,
            projectRoot: redactProjectPathForExport(
              next.repositoryInventory.projectRoot,
              projectLabel
            ),
          },
        }
      : {}),
  };
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
  return {
    ...clean,
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
 * Build platform metrics.
 * @param {any} home
 * @param {number} report
 * @param {any} baseline
 * @param {any} security
 * @param {any} coverage
 * @param {any} pageSpecsLabel
 * @returns {any}
 */
export function buildPlatformMetrics(
  home,
  report,
  baseline,
  security,
  coverage,
  pageSpecsLabel = null
) {
  const overview = home?.overview || {};
  return {
    mockScanFiles: report?.mockSampleFiles ?? report?.totalFiles ?? overview.totalFiles,
    qualityScore: report?.qualityScore ?? parseNumeric(overview.codeQuality),
    schemaPassRate: report?.schemaCompliance ?? overview.schemaPassRate,
    scannerIssues: report?.issueCount ?? overview.scannerIssues,
    securityScore: formatSecurityScoreForDisplay(security, overview),
    jestTests: resolveCanonicalJestLabel(baseline, home, coverage),
    pageSamples: pageSpecsLabel ?? baseline?.pageSamplesLabel ?? overview.pageSamplesLabel,
    sampleJsonFiles: report?.mockSampleFiles ?? report?.totalFiles ?? overview.sampleJsonFiles,
  };
}

/**
 * Build comparative rows.
 * @param {any} home
 * @param {Array} metrics
 * @returns {any}
 */
export function buildComparativeRows(home, metrics) {
  const staticRows = home?.comparativeAnalysis || [];
  const liveByMetric = {
    'jest tests': {
      current: parseNumeric(metrics.jestTests?.split('/')[0]) ?? parseNumeric(metrics.jestTests),
      format: (v) => (v == null ? '—' : String(v)),
    },
    'sample json files': {
      current: metrics.sampleJsonFiles,
      format: (v) => (v == null ? '—' : String(v)),
    },
    'mock / sample files': {
      current: metrics.mockScanFiles,
      format: (v) => (v == null ? '—' : String(v)),
    },
    'schema pass rate': {
      current: metrics.schemaPassRate,
      format: (v) => (v == null ? '—' : `${v}%`),
    },
    'security posture': {
      current: metrics.securityScore,
      format: (v) => (v == null ? '—' : String(v)),
    },
  };

  return staticRows.map((row) => {
    const key = String(row.metric || '').toLowerCase();
    const live = liveByMetric[key];
    const previous = row.previous;
    const current = live?.current != null ? live.format(live.current) : row.current;
    const prevNum = parseNumeric(previous);
    const curNum = live?.current != null ? live.current : parseNumeric(current);

    let change = row.change;
    if (prevNum != null && curNum != null && prevNum !== curNum) {
      const unitMatch = String(row.change || '').match(/\s([a-z]+)$/i);
      const unit = unitMatch?.[1] || '';
      if (String(row.metric).toLowerCase().includes('rate') || String(previous).includes('%')) {
        change = formatSignedDelta(curNum - prevNum, '%');
      } else if (String(row.metric).toLowerCase().includes('security')) {
        change = formatSignedDelta(curNum - prevNum, 'pts');
      } else {
        change = formatSignedDelta(curNum - prevNum, unit);
      }
    }

    return { ...row, current, change };
  });
}

/**
 * Build export provenance.
 * @param {Object} options
 * @param {number} report
 * @param {any} baseline
 * @param {any} coverage
 * @param {any} security
 * @param {any} quality }
 * @returns {any}
 */
function buildExportProvenance({
  dashboardHome,
  report,
  baseline,
  coverage,
  security,
  quality,
} = {}) {
  return {
    dashboardHome:
      dashboardHome?.type === 'dashboard-home-model'
        ? 'dashboard-home-model'
        : resolveSectionProvenance(dashboardHome),
    baseline: baseline?.dataSource || (baseline ? 'repository-audit' : 'missing'),
    report: report?.error ? 'error' : report ? 'live-gate-scan' : 'missing',
    coverage: resolveSectionProvenance(coverage),
    security: resolveSectionProvenance(security),
    quality: resolveSectionProvenance(quality),
  };
}

export function buildPlatformExportBundle({
  dashboardHome,
  report,
  baseline,
  config,
  coverage,
  security,
  quality,
  exportFilename,
} = {}) {
  const rawProjectPath = report?.projectRoot || config?.projectRoot || null;
  const projectLabel = projectLabelFromPath(rawProjectPath);
  const benchmarkScan = isBenchmarkPlatformExport(report, rawProjectPath);
  const repositoryFilesTotal =
    report?.repositoryFilesTotal ?? report?.repositoryInventory?.totalFiles ?? null;
  const pageSpecsLabel = resolvePageSpecsLabel(report, baseline, benchmarkScan);
  const pageSpecsNote = buildPageSpecsNote(report, baseline, pageSpecsLabel, benchmarkScan);
  const metrics = buildPlatformMetrics(
    dashboardHome,
    report,
    baseline,
    security,
    coverage,
    pageSpecsLabel
  );
  const comparativeAnalysis = buildComparativeRows(dashboardHome, metrics);
  const scanPaths = report?.scanPaths || config?.scanPaths || [];
  const sanitizedReport = sanitizeReportForPlatformExport(report, projectLabel, { exportFilename });
  const sanitizedCoverage = sanitizeCoverageExport(coverage);
  const sanitizedSecurity = sanitizeSecurityExport(security);
  const sanitizedQuality = sanitizeQualityExport(quality, coverage, report);
  const baselineLabel = resolveJestTestsLabel(baseline, dashboardHome);
  const jestNote =
    metrics.jestTests && baselineLabel && metrics.jestTests !== baselineLabel
      ? `Summary jestTests uses coverage snapshot (${metrics.jestTests}); baseline panel cached ${baselineLabel}.`
      : null;
  const securityNote =
    security?.securityScore != null &&
    dashboardHome?.overview?.securityScore != null &&
    String(formatSecurityScoreForDisplay(security, {})) !==
      String(dashboardHome.overview.securityScore)
      ? `Security score uses live overlay (${formatSecurityScoreForDisplay(security, {})}); dashboard home showed ${dashboardHome.overview.securityScore}.`
      : null;
  const defaultSubtitle = 'Engineering baseline from repository audit + SimpleBeacon scan';
  const subtitle = normalizeSimpleBeaconBranding(
    benchmarkScan
      ? 'OSS benchmark clone baseline — github-cache/ gate hygiene, not SimpleBeacon product handoff'
      : dashboardHome?.subtitle || defaultSubtitle
  );

  return {
    type: 'simplebeacon-platform-export',
    version: '1.1.0',
    exportVersion: '1.1.0',
    generatedBy: 'SimpleBeacon',
    title: 'SimpleBeacon Platform Baseline Export',
    generatedAt: new Date().toISOString(),
    subtitle,
    summary: {
      mockScanFiles: metrics.mockScanFiles ?? null,
      qualityScore: metrics.qualityScore ?? null,
      schemaPassRate: metrics.schemaPassRate ?? null,
      scannerIssues: metrics.scannerIssues ?? null,
      securityScore: metrics.securityScore ?? null,
      jestTests: metrics.jestTests ?? null,
      pageSamples: metrics.pageSamples ?? null,
      sampleJsonFiles: metrics.sampleJsonFiles ?? null,
      scanPathCount: scanPaths.length,
      baselineSyncedAt: baseline?.syncedAt ?? dashboardHome?.baselineSyncedAt ?? null,
      lineCoverage: coverage?.overallCoverage ?? coverage?.lineCoverage ?? null,
      branchCoverage: coverage?.branchCoverage ?? null,
      qualityOverviewScore: quality?.overallScore ?? quality?.qualityScore ?? null,
      gatePass: report?.gate?.pass ?? sanitizedReport?.gate?.pass ?? null,
      gateAttestation: sanitizedReport?.gateAttestation ?? null,
      benchmarkScan,
      repositoryFilesTotal,
      ruleScopedFilesAnalyzed:
        report?.ruleScopedFilesAnalyzed ?? report?.scanScope?.ruleScopedFilesAnalyzed ?? null,
      reportGeneratedAt: report?.generatedAt ?? null,
      coverageLastRun: coverage?.lastRun ?? null,
      jestResultAt: coverage?.testCountGeneratedAt ?? null,
      pageSpecCatalogSize:
        report?.scanScope?.pageSpecCatalogSize ?? baseline?.pageSampleSpecCount ?? null,
      ...(jestNote ? { jestTestsNote: jestNote } : {}),
      ...(securityNote ? { securityScoreNote: securityNote } : {}),
      ...(pageSpecsNote ? { pageSamplesNote: pageSpecsNote } : {}),
      ...(sanitizedQuality?.staleRelativeToCoverage && sanitizedQuality?.testCountNote
        ? { qualityPanelNote: sanitizedQuality.testCountNote }
        : {}),
    },
    projectRoot: redactProjectPathForExport(rawProjectPath, projectLabel),
    scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'product',
    ...(benchmarkScan && sanitizedReport?.productPlatformRoot
      ? {
          productPlatformRoot: redactProjectPathForExport(
            sanitizedReport.productPlatformRoot,
            'ai-platform'
          ),
        }
      : {}),
    scanPaths,
    metrics,
    provenance: buildExportProvenance({
      dashboardHome,
      report,
      baseline,
      coverage,
      security,
      quality,
    }),
    disclaimers: [
      ...(benchmarkScan
        ? [
            'Benchmark clone export — gate scan on github-cache/ OSS target, not SimpleBeacon ai-platform product handoff.',
          ]
        : []),
      'Platform export bundles gate scan hygiene, repository baseline, and live dashboard overlays.',
      'Security score reflects SimpleBeacon gate/schema compliance — not penetration testing or npm audit alone.',
      'Coverage from Istanbul collectCoverageFrom scope — not whole-repository line coverage.',
      'Absolute host paths are redacted to project label in exports.',
      'baseline.rejectedFiction catalogs documented anti-fiction exceptions — not active KPI claims.',
      'Summary jestTests prefers fresher coverage Jest snapshot when baseline panel counts lag.',
      'Summary pageSamples prefers gate-validated page spec counts over catalog baseline labels when they differ.',
    ].map((line) => normalizeSimpleBeaconBranding(line)),
    comparativeAnalysis,
    insights: dashboardHome?.insights || [],
    mockDataCategories: report?.mockDataCategories || [],
    dashboardHome: sanitizeDashboardHomeExport(dashboardHome, {
      benchmarkScan,
      repositoryFilesTotal,
      pageSpecsLabel,
    }),
    baseline: sanitizeBaselineExport(baseline, { pageSpecsLabel }),
    report: sanitizedReport,
    config: sanitizeConfigExport(config, projectLabel),
    coverage: sanitizedCoverage,
    security: sanitizedSecurity,
    quality: sanitizedQuality,
    exportSanitized: true,
    exportNormalized: true,
    benchmarkScan,
    handoffEligible: false,
    securityHandoffEligible: false,
    hygieneSummary: {
      gatePass: sanitizedReport?.gate?.pass ?? null,
      gateAttestation: sanitizedReport?.gateAttestation ?? null,
      repositoryFilesTotal,
      ruleScopedFilesAnalyzed:
        report?.ruleScopedFilesAnalyzed ?? report?.scanScope?.ruleScopedFilesAnalyzed ?? null,
      jestTests: metrics.jestTests ?? null,
      lineCoverage: coverage?.overallCoverage ?? coverage?.lineCoverage ?? null,
      securityScore: metrics.securityScore ?? null,
      attestationNote: benchmarkScan
        ? 'Platform baseline on OSS benchmark clone — not SimpleBeacon product handoff clearance.'
        : 'Platform baseline export — hygiene metrics only, not vendor handoff clearance.',
    },
    exportNotes: dedupeExportNotes(
      [
        pageSpecsNote,
        jestNote,
        securityNote,
        sanitizedCoverage?.freshnessNote || null,
        sanitizedQuality?.testCountNote || null,
      ].map((note) => normalizeSimpleBeaconBranding(note))
    ),
  };
}

/**
 * Re-sanitize a downloaded platform baseline export JSON.
 * @param {object} bundle
 * @param {object} [options]
 * @returns {object}
 */
/**
 * Sanitize platform export.
 * @param {any} bundle
 * @param {Object} options
 * @returns {any}
 */
export function sanitizePlatformExport(bundle, options = {}) {
  if (!bundle || bundle.type !== 'simplebeacon-platform-export') return bundle;
  return buildPlatformExportBundle({
    dashboardHome: bundle.dashboardHome,
    report: bundle.report,
    baseline: bundle.baseline,
    config: bundle.config,
    coverage: bundle.coverage,
    security: bundle.security,
    quality: bundle.quality,
    exportFilename: options.exportFilename || options.filename,
  });
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
 * Build comparative csv.
 * @param {Array} comparativeRows
 * @returns {any}
 */
export function buildComparativeCsv(comparativeRows) {
  if (!comparativeRows?.length) return null;
  const header = ['metric', 'previous', 'current', 'change'];
  const rows = comparativeRows.map((row) =>
    [row.metric || '', row.previous ?? '', row.current ?? '', row.change ?? '']
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Build mock categories csv.
 * @param {Array} categories
 * @returns {any}
 */
export function buildMockCategoriesCsv(categories) {
  if (!categories?.length) return null;
  const header = ['category', 'fileCount', 'totalSize', 'qualityScore', 'issues'];
  const rows = categories.map((row) =>
    [
      row.category || '',
      row.fileCount ?? '',
      row.totalSize ?? '',
      row.qualityScore ?? '',
      row.issues ?? '',
    ]
      .map(csvEscape)
      .join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Build platform summary csv.
 * @param {any} bundle
 * @returns {any}
 */
export function buildPlatformSummaryCsv(bundle) {
  if (!bundle?.summary) return null;
  const header = ['metric', 'value'];
  const rows = Object.entries(bundle.summary).map(([key, value]) =>
    [key, value == null ? '' : String(value)].map(csvEscape).join(',')
  );
  return [header.join(','), ...rows].join('\n');
}

/**
 * Build platform csv.
 * @param {Object} options
 * @param {Array} comparativeRows
 * @param {any} mockDataCategories }
 * @returns {any}
 */
export function buildPlatformCsv({ bundle, comparativeRows, mockDataCategories } = {}) {
  const parts = [];
  const comparative = buildComparativeCsv(comparativeRows);
  const categories = buildMockCategoriesCsv(mockDataCategories);
  const summary = !comparative ? buildPlatformSummaryCsv(bundle) : null;

  if (comparative) parts.push(comparative);
  if (summary) {
    if (parts.length) parts.push('');
    parts.push('Platform Summary');
    parts.push(summary);
  }
  if (categories) {
    if (parts.length) parts.push('');
    parts.push('Mock Data Categories');
    parts.push(categories);
  }
  return parts.length ? parts.join('\n') : null;
}

/**
 * Platform export filename.
 * @param {any} ext
 * @returns {any}
 */
export function platformExportFilename(ext = 'json') {
  const stamp = new Date().toISOString().slice(0, 10);
  if (ext === 'csv') return `platform-baseline-metrics-${stamp}.csv`;
  return `platform-baseline-export-${stamp}.json`;
}
