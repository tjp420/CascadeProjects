/**
 * Platform page export bundle — browser mirror of server/lib/platform-export.js
 */
import { resolveJestTestsLabel } from '../services/analyzeService.js';
import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260601gateexport17';
import { stripInternalExportFields, resolveSectionProvenance, redactProjectPathForExport, sanitizeCoverageExport, sanitizeSecurityExport, sanitizeQualityExport, normalizeSimpleBeaconBranding } from './quality-export.browser.js?v=20260531qualityexport8';
/**
 * Parse numeric.
 * @param {any} value
 * @returns {any}
 */
function parseNumeric(value) {
    if (value == null)
        return null;
    const match = String(value).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
    return match ? Number(match[0]) : null;
}
/**
 * Format signed delta.
 * @param {any} delta
 * @param {any} unit
 * @returns {any}
 */
function formatSignedDelta(delta, unit = '') {
    if (!Number.isFinite(delta))
        return '—';
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
    if ((security === null || security === void 0 ? void 0 : security.securityScore) != null) {
        const num = Number(security.securityScore);
        if (Number.isFinite(num))
            return `${num}/100`;
        return String(security.securityScore);
    }
    if ((overview === null || overview === void 0 ? void 0 : overview.securityScore) != null)
        return String(overview.securityScore);
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
    var _a;
    const coverageLabel = (coverage === null || coverage === void 0 ? void 0 : coverage.jestTestsLabel)
        || ((coverage === null || coverage === void 0 ? void 0 : coverage.passedTests) != null && (coverage === null || coverage === void 0 ? void 0 : coverage.totalTests) != null
            ? `${coverage.passedTests}/${coverage.totalTests}`
            : null);
    const baselineLabel = resolveJestTestsLabel(baseline, dashboardHome);
    if (!coverageLabel)
        return baselineLabel;
    if (!baselineLabel)
        return coverageLabel;
    const covAt = coverage === null || coverage === void 0 ? void 0 : coverage.testCountGeneratedAt;
    const baseAt = (_a = baseline === null || baseline === void 0 ? void 0 : baseline.syncedAt) !== null && _a !== void 0 ? _a : dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.baselineSyncedAt;
    if (covAt && baseAt && Date.parse(covAt) >= Date.parse(baseAt))
        return coverageLabel;
    const covN = parseNumeric(coverageLabel.split('/')[0]);
    const baseN = parseNumeric(baselineLabel.split('/')[0]);
    if (covN != null && baseN != null && covN !== baseN)
        return coverageLabel;
    return baselineLabel;
}
/**
 * Is benchmark platform export.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkPlatformExport(report, projectPath) {
    const path = String((report === null || report === void 0 ? void 0 : report.projectRoot) || projectPath || '').replace(/\\/g, '/');
    return Boolean((report === null || report === void 0 ? void 0 : report.benchmarkScan) || (report === null || report === void 0 ? void 0 : report.scanTargetProfile) === 'benchmark-cache')
        || /\/github-cache\//i.test(path);
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
        if (seen.has(scopeKey))
            continue;
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
    var _a, _b;
    const reportLabel = (report === null || report === void 0 ? void 0 : report.pageSampleSchemaChecked) != null
        ? `${(_a = report.pageSampleSchemaPassed) !== null && _a !== void 0 ? _a : 0}/${report.pageSampleSchemaChecked}`
        : null;
    const baselineLabel = (_b = baseline === null || baseline === void 0 ? void 0 : baseline.pageSamplesLabel) !== null && _b !== void 0 ? _b : null;
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
    var _a, _b;
    if (!pageSpecsLabel || pageSpecsLabel === '0/0')
        return null;
    const reportLabel = (report === null || report === void 0 ? void 0 : report.pageSampleSchemaChecked) != null
        ? `${(_a = report.pageSampleSchemaPassed) !== null && _a !== void 0 ? _a : 0}/${report.pageSampleSchemaChecked}`
        : null;
    const baselineLabel = (_b = baseline === null || baseline === void 0 ? void 0 : baseline.pageSamplesLabel) !== null && _b !== void 0 ? _b : null;
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
export function sanitizeReportForPlatformExport(report, projectLabel = 'ai-platform', options = {}) {
    if (!report)
        return null;
    const sanitized = sanitizeSimplebeaconReportExport(report, {
        projectPath: report.projectRoot || report.platformRoot,
        exportFilename: options.exportFilename,
        ...options
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
                    projectRoot: redactProjectPathForExport(next.repositoryInventory.projectRoot, projectLabel)
                }
            }
            : {})
    };
}
/**
 * Sanitize dashboard home export.
 * @param {any} dashboardHome
 * @param {string} context
 * @returns {any}
 */
function sanitizeDashboardHomeExport(dashboardHome, context = {}) {
    if (!dashboardHome)
        return null;
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
                    : `Dashboard home counted ${Number(platformFiles).toLocaleString('en-US')} files — export uses gate inventory ${Number(repoTotal).toLocaleString('en-US')} from latest scan.`
            };
        }
        if (pageSpecsLabel && overview.pageSamplesLabel && overview.pageSamplesLabel !== pageSpecsLabel) {
            overview = {
                ...overview,
                pageSamplesLabel: pageSpecsLabel,
                pageSamplesLabelRaw: overview.pageSamplesLabel,
                pageSamplesLabelSource: 'gate-scan-export-reconciled'
            };
        }
    }
    const provenance = dashboardHome.type === 'dashboard-home-model'
        ? 'dashboard-home-model'
        : resolveSectionProvenance(dashboardHome);
    return {
        ...rest,
        provenance,
        overview
    };
}
/**
 * Sanitize baseline export.
 * @param {any} baseline
 * @param {string} context
 * @returns {any}
 */
function sanitizeBaselineExport(baseline, context = {}) {
    if (!baseline)
        return null;
    const clean = stripInternalExportFields(baseline);
    const pageSpecsLabel = context.pageSpecsLabel;
    const baselineLabel = clean.pageSamplesLabel;
    return {
        ...clean,
        provenance: baseline.dataSource || 'repository-audit',
        ...(pageSpecsLabel && baselineLabel && baselineLabel !== pageSpecsLabel
            ? {
                gateValidatedPageSpecsLabel: pageSpecsLabel,
                pageSamplesLabelNote: `Catalog baseline lists ${baselineLabel} page specs — latest gate scan validated ${pageSpecsLabel}.`
            }
            : {})
    };
}
/**
 * Sanitize config export.
 * @param {Object} config
 * @param {any} projectLabel
 * @returns {any}
 */
function sanitizeConfigExport(config, projectLabel = 'ai-platform') {
    if (!config)
        return null;
    return {
        ...stripInternalExportFields(config),
        projectRoot: redactProjectPathForExport(config.projectRoot, projectLabel)
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
export function buildPlatformMetrics(home, report, baseline, security, coverage, pageSpecsLabel = null) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const overview = (home === null || home === void 0 ? void 0 : home.overview) || {};
    return {
        mockScanFiles: (_b = (_a = report === null || report === void 0 ? void 0 : report.mockSampleFiles) !== null && _a !== void 0 ? _a : report === null || report === void 0 ? void 0 : report.totalFiles) !== null && _b !== void 0 ? _b : overview.totalFiles,
        qualityScore: (_c = report === null || report === void 0 ? void 0 : report.qualityScore) !== null && _c !== void 0 ? _c : parseNumeric(overview.codeQuality),
        schemaPassRate: (_d = report === null || report === void 0 ? void 0 : report.schemaCompliance) !== null && _d !== void 0 ? _d : overview.schemaPassRate,
        scannerIssues: (_e = report === null || report === void 0 ? void 0 : report.issueCount) !== null && _e !== void 0 ? _e : overview.scannerIssues,
        securityScore: formatSecurityScoreForDisplay(security, overview),
        jestTests: resolveCanonicalJestLabel(baseline, home, coverage),
        pageSamples: (_f = pageSpecsLabel !== null && pageSpecsLabel !== void 0 ? pageSpecsLabel : baseline === null || baseline === void 0 ? void 0 : baseline.pageSamplesLabel) !== null && _f !== void 0 ? _f : overview.pageSamplesLabel,
        sampleJsonFiles: (_h = (_g = report === null || report === void 0 ? void 0 : report.mockSampleFiles) !== null && _g !== void 0 ? _g : report === null || report === void 0 ? void 0 : report.totalFiles) !== null && _h !== void 0 ? _h : overview.sampleJsonFiles
    };
}
/**
 * Build comparative rows.
 * @param {any} home
 * @param {Array} metrics
 * @returns {any}
 */
export function buildComparativeRows(home, metrics) {
    var _a, _b;
    const staticRows = (home === null || home === void 0 ? void 0 : home.comparativeAnalysis) || [];
    const liveByMetric = {
        'jest tests': {
            current: (_b = parseNumeric((_a = metrics.jestTests) === null || _a === void 0 ? void 0 : _a.split('/')[0])) !== null && _b !== void 0 ? _b : parseNumeric(metrics.jestTests),
            format: (v) => (v == null ? '—' : String(v))
        },
        'sample json files': {
            current: metrics.sampleJsonFiles,
            format: (v) => (v == null ? '—' : String(v))
        },
        'mock / sample files': {
            current: metrics.mockScanFiles,
            format: (v) => (v == null ? '—' : String(v))
        },
        'schema pass rate': {
            current: metrics.schemaPassRate,
            format: (v) => (v == null ? '—' : `${v}%`)
        },
        'security posture': {
            current: metrics.securityScore,
            format: (v) => (v == null ? '—' : String(v))
        }
    };
    return staticRows.map((row) => {
        const key = String(row.metric || '').toLowerCase();
        const live = liveByMetric[key];
        const previous = row.previous;
        const current = (live === null || live === void 0 ? void 0 : live.current) != null ? live.format(live.current) : row.current;
        const prevNum = parseNumeric(previous);
        const curNum = (live === null || live === void 0 ? void 0 : live.current) != null ? live.current : parseNumeric(current);
        let change = row.change;
        if (prevNum != null && curNum != null && prevNum !== curNum) {
            const unitMatch = String(row.change || '').match(/\s([a-z]+)$/i);
            const unit = (unitMatch === null || unitMatch === void 0 ? void 0 : unitMatch[1]) || '';
            if (String(row.metric).toLowerCase().includes('rate') || String(previous).includes('%')) {
                change = formatSignedDelta(curNum - prevNum, '%');
            }
            else if (String(row.metric).toLowerCase().includes('security')) {
                change = formatSignedDelta(curNum - prevNum, 'pts');
            }
            else {
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
function buildExportProvenance({ dashboardHome, report, baseline, coverage, security, quality } = {}) {
    return {
        dashboardHome: (dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.type) === 'dashboard-home-model'
            ? 'dashboard-home-model'
            : resolveSectionProvenance(dashboardHome),
        baseline: (baseline === null || baseline === void 0 ? void 0 : baseline.dataSource) || (baseline ? 'repository-audit' : 'missing'),
        report: (report === null || report === void 0 ? void 0 : report.error) ? 'error' : (report ? 'live-gate-scan' : 'missing'),
        coverage: resolveSectionProvenance(coverage),
        security: resolveSectionProvenance(security),
        quality: resolveSectionProvenance(quality)
    };
}
export function buildPlatformExportBundle({ dashboardHome, report, baseline, config, coverage, security, quality, exportFilename } = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17, _18;
    const rawProjectPath = (report === null || report === void 0 ? void 0 : report.projectRoot) || (config === null || config === void 0 ? void 0 : config.projectRoot) || null;
    const projectLabel = projectLabelFromPath(rawProjectPath);
    const benchmarkScan = isBenchmarkPlatformExport(report, rawProjectPath);
    const repositoryFilesTotal = (_c = (_a = report === null || report === void 0 ? void 0 : report.repositoryFilesTotal) !== null && _a !== void 0 ? _a : (_b = report === null || report === void 0 ? void 0 : report.repositoryInventory) === null || _b === void 0 ? void 0 : _b.totalFiles) !== null && _c !== void 0 ? _c : null;
    const pageSpecsLabel = resolvePageSpecsLabel(report, baseline, benchmarkScan);
    const pageSpecsNote = buildPageSpecsNote(report, baseline, pageSpecsLabel, benchmarkScan);
    const metrics = buildPlatformMetrics(dashboardHome, report, baseline, security, coverage, pageSpecsLabel);
    const comparativeAnalysis = buildComparativeRows(dashboardHome, metrics);
    const scanPaths = (report === null || report === void 0 ? void 0 : report.scanPaths) || (config === null || config === void 0 ? void 0 : config.scanPaths) || [];
    const sanitizedReport = sanitizeReportForPlatformExport(report, projectLabel, { exportFilename });
    const sanitizedCoverage = sanitizeCoverageExport(coverage);
    const sanitizedSecurity = sanitizeSecurityExport(security);
    const sanitizedQuality = sanitizeQualityExport(quality, coverage, report);
    const baselineLabel = resolveJestTestsLabel(baseline, dashboardHome);
    const jestNote = metrics.jestTests && baselineLabel && metrics.jestTests !== baselineLabel
        ? `Summary jestTests uses coverage snapshot (${metrics.jestTests}); baseline panel cached ${baselineLabel}.`
        : null;
    const securityNote = (security === null || security === void 0 ? void 0 : security.securityScore) != null
        && ((_d = dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.overview) === null || _d === void 0 ? void 0 : _d.securityScore) != null
        && String(formatSecurityScoreForDisplay(security, {})) !== String(dashboardHome.overview.securityScore)
        ? `Security score uses live overlay (${formatSecurityScoreForDisplay(security, {})}); dashboard home showed ${dashboardHome.overview.securityScore}.`
        : null;
    const defaultSubtitle = 'Engineering baseline from repository audit + SimpleBeacon scan';
    const subtitle = normalizeSimpleBeaconBranding(benchmarkScan
        ? 'OSS benchmark clone baseline — github-cache/ gate hygiene, not SimpleBeacon product handoff'
        : ((dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.subtitle) || defaultSubtitle));
    return {
        type: 'simplebeacon-platform-export',
        version: '1.1.0',
        exportVersion: '1.1.0',
        generatedBy: 'SimpleBeacon',
        title: 'SimpleBeacon Platform Baseline Export',
        generatedAt: new Date().toISOString(),
        subtitle,
        summary: {
            mockScanFiles: (_e = metrics.mockScanFiles) !== null && _e !== void 0 ? _e : null,
            qualityScore: (_f = metrics.qualityScore) !== null && _f !== void 0 ? _f : null,
            schemaPassRate: (_g = metrics.schemaPassRate) !== null && _g !== void 0 ? _g : null,
            scannerIssues: (_h = metrics.scannerIssues) !== null && _h !== void 0 ? _h : null,
            securityScore: (_j = metrics.securityScore) !== null && _j !== void 0 ? _j : null,
            jestTests: (_k = metrics.jestTests) !== null && _k !== void 0 ? _k : null,
            pageSamples: (_l = metrics.pageSamples) !== null && _l !== void 0 ? _l : null,
            sampleJsonFiles: (_m = metrics.sampleJsonFiles) !== null && _m !== void 0 ? _m : null,
            scanPathCount: scanPaths.length,
            baselineSyncedAt: (_p = (_o = baseline === null || baseline === void 0 ? void 0 : baseline.syncedAt) !== null && _o !== void 0 ? _o : dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.baselineSyncedAt) !== null && _p !== void 0 ? _p : null,
            lineCoverage: (_r = (_q = coverage === null || coverage === void 0 ? void 0 : coverage.overallCoverage) !== null && _q !== void 0 ? _q : coverage === null || coverage === void 0 ? void 0 : coverage.lineCoverage) !== null && _r !== void 0 ? _r : null,
            branchCoverage: (_s = coverage === null || coverage === void 0 ? void 0 : coverage.branchCoverage) !== null && _s !== void 0 ? _s : null,
            qualityOverviewScore: (_u = (_t = quality === null || quality === void 0 ? void 0 : quality.overallScore) !== null && _t !== void 0 ? _t : quality === null || quality === void 0 ? void 0 : quality.qualityScore) !== null && _u !== void 0 ? _u : null,
            gatePass: (_y = (_w = (_v = report === null || report === void 0 ? void 0 : report.gate) === null || _v === void 0 ? void 0 : _v.pass) !== null && _w !== void 0 ? _w : (_x = sanitizedReport === null || sanitizedReport === void 0 ? void 0 : sanitizedReport.gate) === null || _x === void 0 ? void 0 : _x.pass) !== null && _y !== void 0 ? _y : null,
            gateAttestation: (_z = sanitizedReport === null || sanitizedReport === void 0 ? void 0 : sanitizedReport.gateAttestation) !== null && _z !== void 0 ? _z : null,
            benchmarkScan,
            repositoryFilesTotal,
            ruleScopedFilesAnalyzed: (_2 = (_0 = report === null || report === void 0 ? void 0 : report.ruleScopedFilesAnalyzed) !== null && _0 !== void 0 ? _0 : (_1 = report === null || report === void 0 ? void 0 : report.scanScope) === null || _1 === void 0 ? void 0 : _1.ruleScopedFilesAnalyzed) !== null && _2 !== void 0 ? _2 : null,
            reportGeneratedAt: (_3 = report === null || report === void 0 ? void 0 : report.generatedAt) !== null && _3 !== void 0 ? _3 : null,
            coverageLastRun: (_4 = coverage === null || coverage === void 0 ? void 0 : coverage.lastRun) !== null && _4 !== void 0 ? _4 : null,
            jestResultAt: (_5 = coverage === null || coverage === void 0 ? void 0 : coverage.testCountGeneratedAt) !== null && _5 !== void 0 ? _5 : null,
            pageSpecCatalogSize: (_8 = (_7 = (_6 = report === null || report === void 0 ? void 0 : report.scanScope) === null || _6 === void 0 ? void 0 : _6.pageSpecCatalogSize) !== null && _7 !== void 0 ? _7 : baseline === null || baseline === void 0 ? void 0 : baseline.pageSampleSpecCount) !== null && _8 !== void 0 ? _8 : null,
            ...(jestNote ? { jestTestsNote: jestNote } : {}),
            ...(securityNote ? { securityScoreNote: securityNote } : {}),
            ...(pageSpecsNote ? { pageSamplesNote: pageSpecsNote } : {}),
            ...((sanitizedQuality === null || sanitizedQuality === void 0 ? void 0 : sanitizedQuality.staleRelativeToCoverage) && (sanitizedQuality === null || sanitizedQuality === void 0 ? void 0 : sanitizedQuality.testCountNote)
                ? { qualityPanelNote: sanitizedQuality.testCountNote }
                : {})
        },
        projectRoot: redactProjectPathForExport(rawProjectPath, projectLabel),
        scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'product',
        ...(benchmarkScan && (sanitizedReport === null || sanitizedReport === void 0 ? void 0 : sanitizedReport.productPlatformRoot)
            ? { productPlatformRoot: redactProjectPathForExport(sanitizedReport.productPlatformRoot, 'ai-platform') }
            : {}),
        scanPaths,
        metrics,
        provenance: buildExportProvenance({ dashboardHome, report, baseline, coverage, security, quality }),
        disclaimers: [
            ...(benchmarkScan
                ? ['Benchmark clone export — gate scan on github-cache/ OSS target, not SimpleBeacon ai-platform product handoff.']
                : []),
            'Platform export bundles gate scan hygiene, repository baseline, and live dashboard overlays.',
            'Security score reflects SimpleBeacon gate/schema compliance — not penetration testing or npm audit alone.',
            'Coverage from Istanbul collectCoverageFrom scope — not whole-repository line coverage.',
            'Absolute host paths are redacted to project label in exports.',
            'baseline.rejectedFiction catalogs documented anti-fiction exceptions — not active KPI claims.',
            'Summary jestTests prefers fresher coverage Jest snapshot when baseline panel counts lag.',
            'Summary pageSamples prefers gate-validated page spec counts over catalog baseline labels when they differ.'
        ].map((line) => normalizeSimpleBeaconBranding(line)),
        comparativeAnalysis,
        insights: (dashboardHome === null || dashboardHome === void 0 ? void 0 : dashboardHome.insights) || [],
        mockDataCategories: (report === null || report === void 0 ? void 0 : report.mockDataCategories) || [],
        dashboardHome: sanitizeDashboardHomeExport(dashboardHome, {
            benchmarkScan,
            repositoryFilesTotal,
            pageSpecsLabel
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
            gatePass: (_10 = (_9 = sanitizedReport === null || sanitizedReport === void 0 ? void 0 : sanitizedReport.gate) === null || _9 === void 0 ? void 0 : _9.pass) !== null && _10 !== void 0 ? _10 : null,
            gateAttestation: (_11 = sanitizedReport === null || sanitizedReport === void 0 ? void 0 : sanitizedReport.gateAttestation) !== null && _11 !== void 0 ? _11 : null,
            repositoryFilesTotal,
            ruleScopedFilesAnalyzed: (_14 = (_12 = report === null || report === void 0 ? void 0 : report.ruleScopedFilesAnalyzed) !== null && _12 !== void 0 ? _12 : (_13 = report === null || report === void 0 ? void 0 : report.scanScope) === null || _13 === void 0 ? void 0 : _13.ruleScopedFilesAnalyzed) !== null && _14 !== void 0 ? _14 : null,
            jestTests: (_15 = metrics.jestTests) !== null && _15 !== void 0 ? _15 : null,
            lineCoverage: (_17 = (_16 = coverage === null || coverage === void 0 ? void 0 : coverage.overallCoverage) !== null && _16 !== void 0 ? _16 : coverage === null || coverage === void 0 ? void 0 : coverage.lineCoverage) !== null && _17 !== void 0 ? _17 : null,
            securityScore: (_18 = metrics.securityScore) !== null && _18 !== void 0 ? _18 : null,
            attestationNote: benchmarkScan
                ? 'Platform baseline on OSS benchmark clone — not SimpleBeacon product handoff clearance.'
                : 'Platform baseline export — hygiene metrics only, not vendor handoff clearance.'
        },
        exportNotes: dedupeExportNotes([
            pageSpecsNote,
            jestNote,
            securityNote,
            (sanitizedCoverage === null || sanitizedCoverage === void 0 ? void 0 : sanitizedCoverage.freshnessNote) || null,
            (sanitizedQuality === null || sanitizedQuality === void 0 ? void 0 : sanitizedQuality.testCountNote) || null
        ].map((note) => normalizeSimpleBeaconBranding(note)))
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
    if (!bundle || bundle.type !== 'simplebeacon-platform-export')
        return bundle;
    return buildPlatformExportBundle({
        dashboardHome: bundle.dashboardHome,
        report: bundle.report,
        baseline: bundle.baseline,
        config: bundle.config,
        coverage: bundle.coverage,
        security: bundle.security,
        quality: bundle.quality,
        exportFilename: options.exportFilename || options.filename
    });
}
/**
 * Csv escape.
 * @param {any} cell
 * @returns {any}
 */
function csvEscape(cell) {
    return `"${String(cell !== null && cell !== void 0 ? cell : '').replace(/"/g, '""')}"`;
}
/**
 * Build comparative csv.
 * @param {Array} comparativeRows
 * @returns {any}
 */
export function buildComparativeCsv(comparativeRows) {
    if (!(comparativeRows === null || comparativeRows === void 0 ? void 0 : comparativeRows.length))
        return null;
    const header = ['metric', 'previous', 'current', 'change'];
    const rows = comparativeRows.map((row) => {
        var _a, _b, _c;
        return [
            row.metric || '',
            (_a = row.previous) !== null && _a !== void 0 ? _a : '',
            (_b = row.current) !== null && _b !== void 0 ? _b : '',
            (_c = row.change) !== null && _c !== void 0 ? _c : ''
        ].map(csvEscape).join(',');
    });
    return [header.join(','), ...rows].join('\n');
}
/**
 * Build mock categories csv.
 * @param {Array} categories
 * @returns {any}
 */
export function buildMockCategoriesCsv(categories) {
    if (!(categories === null || categories === void 0 ? void 0 : categories.length))
        return null;
    const header = ['category', 'fileCount', 'totalSize', 'qualityScore', 'issues'];
    const rows = categories.map((row) => {
        var _a, _b, _c, _d;
        return [
            row.category || '',
            (_a = row.fileCount) !== null && _a !== void 0 ? _a : '',
            (_b = row.totalSize) !== null && _b !== void 0 ? _b : '',
            (_c = row.qualityScore) !== null && _c !== void 0 ? _c : '',
            (_d = row.issues) !== null && _d !== void 0 ? _d : ''
        ].map(csvEscape).join(',');
    });
    return [header.join(','), ...rows].join('\n');
}
/**
 * Build platform summary csv.
 * @param {any} bundle
 * @returns {any}
 */
export function buildPlatformSummaryCsv(bundle) {
    if (!(bundle === null || bundle === void 0 ? void 0 : bundle.summary))
        return null;
    const header = ['metric', 'value'];
    const rows = Object.entries(bundle.summary).map(([key, value]) => [
        key,
        value == null ? '' : String(value)
    ].map(csvEscape).join(','));
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
    if (comparative)
        parts.push(comparative);
    if (summary) {
        if (parts.length)
            parts.push('');
        parts.push('Platform Summary');
        parts.push(summary);
    }
    if (categories) {
        if (parts.length)
            parts.push('');
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
    if (ext === 'csv')
        return `platform-baseline-metrics-${stamp}.csv`;
    return `platform-baseline-export-${stamp}.json`;
}
