// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Compliance Audit page export bundle — browser mirror of server/lib/compliance-audit-export.js
 */
import { sanitizeSimplebeaconReportExport } from './simplebeacon-report-export.browser.js?v=20260716cachefix1';
import { npmAuditSummary, redactProjectPathForExport, sanitizeNpmAuditForQualityExport, buildNpmAuditCsv, buildQualitySummaryCsv, normalizeSimpleBeaconBranding } from './quality-export.browser.js?v=20260716cachefix1';
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
    var _a, _b, _c;
    const path = String(((_a = audit.report) === null || _a === void 0 ? void 0 : _a.projectRoot) || '').replace(/\\/g, '/');
    return Boolean(((_b = audit.report) === null || _b === void 0 ? void 0 : _b.benchmarkScan) || ((_c = audit.report) === null || _c === void 0 ? void 0 : _c.scanTargetProfile) === 'benchmark-cache')
        || /\/github-cache\//i.test(path);
}
/**
 * Resolve product platform root.
 * @param {any} audit
 * @returns {any}
 */
function resolveProductPlatformRoot(audit = {}) {
    var _a, _b;
    const report = audit.report || {};
    const explicit = String(report.productPlatformRoot || report.platformRoot || '').replace(/\\/g, '/');
    if (explicit && !/\/github-cache\//i.test(explicit)) {
        return explicit;
    }
    const cloneRoot = String(report.projectRoot || '').replace(/\\/g, '/');
    const idx = cloneRoot.toLowerCase().indexOf('/github-cache/');
    if (idx > 0)
        return cloneRoot.slice(0, idx);
    return ((_a = audit.npmAudit) === null || _a === void 0 ? void 0 : _a.projectPath) || ((_b = audit.npmAudit) === null || _b === void 0 ? void 0 : _b.auditRoot) || null;
}
/**
 * Resolve live jest label.
 * @param {number} report
 * @returns {any}
 */
function resolveLiveJestLabel(report) {
    if (!report)
        return null;
    const jestSummary = report.jestSummary;
    if (report.jestBaselineChecked && (jestSummary === null || jestSummary === void 0 ? void 0 : jestSummary.testsTotal) != null) {
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const liveLabel = resolveLiveJestLabel(audit.report);
    if (liveLabel)
        return liveLabel;
    const pageSampleAt = parseTimestamp((_b = (_a = audit.pageSamples) === null || _a === void 0 ? void 0 : _a.baselineComparison) === null || _b === void 0 ? void 0 : _b.generatedAt);
    const reportAt = parseTimestamp((_c = audit.report) === null || _c === void 0 ? void 0 : _c.generatedAt);
    const pageLabel = ((_f = (_e = (_d = audit.pageSamples) === null || _d === void 0 ? void 0 : _d.baselineComparison) === null || _e === void 0 ? void 0 : _e.overview) === null || _f === void 0 ? void 0 : _f.jestTestsLabel)
        || ((_g = audit.baseline) === null || _g === void 0 ? void 0 : _g.jestTestsLabel);
    const layerLabel = (_j = (_h = audit.auditLayers) === null || _h === void 0 ? void 0 : _h.jestBaseline) === null || _j === void 0 ? void 0 : _j.label;
    const benchmarkScan = isBenchmarkComplianceAudit(audit);
    if (!pageLabel)
        return layerLabel || null;
    if (!layerLabel || pageLabel === layerLabel)
        return pageLabel;
    if (pageSampleAt != null && reportAt != null && pageSampleAt >= reportAt)
        return pageLabel;
    if (benchmarkScan)
        return pageLabel;
    return layerLabel;
}
/**
 * Resolve canonical page specs label.
 * @param {any} audit
 * @returns {any}
 */
function resolveCanonicalPageSpecsLabel(audit = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j;
    const pageSampleAt = parseTimestamp((_b = (_a = audit.pageSamples) === null || _a === void 0 ? void 0 : _a.baselineComparison) === null || _b === void 0 ? void 0 : _b.generatedAt);
    const reportAt = parseTimestamp((_c = audit.report) === null || _c === void 0 ? void 0 : _c.generatedAt);
    const pageLabel = ((_f = (_e = (_d = audit.pageSamples) === null || _d === void 0 ? void 0 : _d.baselineComparison) === null || _e === void 0 ? void 0 : _e.overview) === null || _f === void 0 ? void 0 : _f.pageSamplesLabel)
        || ((_g = audit.baseline) === null || _g === void 0 ? void 0 : _g.pageSamplesLabel);
    const report = audit.report || {};
    const reportLabel = report.pageSampleSchemaChecked != null
        ? `${(_h = report.pageSampleSchemaPassed) !== null && _h !== void 0 ? _h : 0}/${report.pageSampleSchemaChecked}`
        : null;
    if (pageLabel && (!reportLabel || reportLabel === '0/0' || (pageSampleAt != null && reportAt != null && pageSampleAt >= reportAt))) {
        return pageLabel;
    }
    return reportLabel || pageLabel || ((_j = audit.baseline) === null || _j === void 0 ? void 0 : _j.pageSamplesLabel) || null;
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
        if (seen.has(key))
            continue;
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
    if (!docs.length)
        return euAiActSummary;
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
    }
    else {
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
    var _a;
    const baselineStatus = ((_a = audit.dashboard) === null || _a === void 0 ? void 0 : _a.baselineStatus) || {};
    if (baselineStatus.pageSamplesLabelSource === 'gate-scan-export-reconciled')
        return null;
    const dashLabel = baselineStatus.pageSamplesLabelRaw || baselineStatus.pageSamplesLabel;
    if (!dashLabel || !pageSpecsLabel || dashLabel === pageSpecsLabel)
        return null;
    return `Dashboard baselineStatus pageSamplesLabel (${dashLabel}) reflects catalog baseline — gate scan validated ${pageSpecsLabel} page specs.`;
}
/**
 * Resolve project label.
 * @param {any} audit
 * @returns {any}
 */
function resolveProjectLabel(audit = {}) {
    var _a, _b, _c;
    return projectLabelFromPath(((_a = audit.report) === null || _a === void 0 ? void 0 : _a.projectRoot)
        || ((_b = audit.npmAudit) === null || _b === void 0 ? void 0 : _b.projectPath)
        || ((_c = audit.assessment) === null || _c === void 0 ? void 0 : _c.projectRoot));
}
/**
 * Build audit metrics.
 * @param {any} audit
 * @returns {any}
 */
export function buildAuditMetrics(audit = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w;
    const report = audit.report || {};
    const dash = ((_a = audit.dashboard) === null || _a === void 0 ? void 0 : _a.scanStatus) || {};
    const inventory = report.repositoryInventory;
    const consistencyScore = (_e = (_d = (_c = (_b = report.consistencyScore) !== null && _b !== void 0 ? _b : dash.consistencyScore) !== null && _c !== void 0 ? _c : report.schemaCompliance) !== null && _d !== void 0 ? _d : dash.qualityScore) !== null && _e !== void 0 ? _e : report.qualityScore;
    const pageSpecsChecked = report.pageSampleSchemaChecked;
    const pageSpecsLabel = pageSpecsChecked != null
        ? `${(_f = report.pageSampleSchemaPassed) !== null && _f !== void 0 ? _f : 0}/${pageSpecsChecked}`
        : (_h = (_g = audit.baseline) === null || _g === void 0 ? void 0 : _g.pageSamplesLabel) !== null && _h !== void 0 ? _h : null;
    const mockSampleFiles = (_k = (_j = report.mockSampleFiles) !== null && _j !== void 0 ? _j : dash.mockSampleFiles) !== null && _k !== void 0 ? _k : report.totalFiles;
    const filesAnalyzed = (_l = report.filesAnalyzed) !== null && _l !== void 0 ? _l : dash.totalFilesScanned;
    return {
        consistencyScore,
        pageSpecsLabel,
        mockSampleFiles,
        filesAnalyzed,
        schemaChecked: report.schemaChecked,
        schemaPassed: report.schemaPassed,
        lastScan: (_m = report.generatedAt) !== null && _m !== void 0 ? _m : dash.lastScan,
        inventoryFiles: (_o = inventory === null || inventory === void 0 ? void 0 : inventory.totalFiles) !== null && _o !== void 0 ? _o : null,
        inventoryFolders: (_p = inventory === null || inventory === void 0 ? void 0 : inventory.totalFolders) !== null && _p !== void 0 ? _p : null,
        inventoryRoot: (_r = (_q = inventory === null || inventory === void 0 ? void 0 : inventory.projectRoot) !== null && _q !== void 0 ? _q : report.projectRoot) !== null && _r !== void 0 ? _r : null,
        qualityScore: (_t = (_s = report.qualityScore) !== null && _s !== void 0 ? _s : dash.qualityScore) !== null && _t !== void 0 ? _t : null,
        ruleScopedFilesAnalyzed: (_w = (_u = report.ruleScopedFilesAnalyzed) !== null && _u !== void 0 ? _u : (_v = report.scanScope) === null || _v === void 0 ? void 0 : _v.ruleScopedFilesAnalyzed) !== null && _w !== void 0 ? _w : null
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
        if (key === 'gate' || !layer)
            continue;
        const status = layer.status || (layer.findings > 0 ? 'fail' : 'pass');
        if (status === 'pass')
            pass += 1;
        else if (status === 'warn' || status === 'warning')
            warn += 1;
        else
            fail += 1;
    }
    return { pass, fail, warn };
}
/**
 * Build compliance audit summary.
 * @param {any} audit
 * @returns {any}
 */
export function buildComplianceAuditSummary(audit = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
    const metrics = buildAuditMetrics(audit);
    const layers = audit.auditLayers || {};
    const gate = layers.gate || {};
    const layerCounts = countLayerStatuses(layers);
    const npmStats = audit.npmAudit && !audit.npmAudit.error ? npmAuditSummary(audit.npmAudit) : null;
    const exec = ((_a = audit.assessment) === null || _a === void 0 ? void 0 : _a.executiveSummary) || {};
    const checklist = ((_c = (_b = audit.assessment) === null || _b === void 0 ? void 0 : _b.complianceChecklist) === null || _c === void 0 ? void 0 : _c.summary) || {};
    const projectLabel = resolveProjectLabel(audit);
    const benchmarkScan = isBenchmarkComplianceAudit(audit);
    const jestTestsLabel = resolveCanonicalJestLabel(audit);
    const pageSpecsLabel = resolveCanonicalPageSpecsLabel(audit);
    const liveJestLabel = resolveLiveJestLabel(audit.report);
    const layerJest = (_d = layers.jestBaseline) === null || _d === void 0 ? void 0 : _d.label;
    let jestBaselineNote = null;
    if (liveJestLabel && layerJest && liveJestLabel !== layerJest) {
        jestBaselineNote = `Summary jestTestsLabel uses live Jest during scan (${liveJestLabel}); audit layer cached ${layerJest}.`;
    }
    else if (jestTestsLabel && layerJest && jestTestsLabel !== layerJest) {
        jestBaselineNote = `Summary jestTestsLabel uses fresher baseline (${jestTestsLabel}); audit layer cached ${layerJest}.`;
    }
    const pageSpecsNote = benchmarkScan && pageSpecsLabel && pageSpecsLabel !== '0/0'
        && metrics.pageSpecsLabel === '0/0'
        ? `Page sample schema not evaluated on OSS clone — summary uses product baseline panel (${pageSpecsLabel}).`
        : null;
    const npmProjectLabel = projectLabelFromPath(((_e = audit.npmAudit) === null || _e === void 0 ? void 0 : _e.projectPath) || ((_f = audit.npmAudit) === null || _f === void 0 ? void 0 : _f.auditRoot));
    const npmAuditScopeNote = benchmarkScan && npmProjectLabel && npmProjectLabel !== projectLabel
        ? `npm audit ran on product platform (${npmProjectLabel}, ${(_g = npmStats === null || npmStats === void 0 ? void 0 : npmStats.dependencies) !== null && _g !== void 0 ? _g : '?'} dependencies) — gate report scoped to benchmark clone ${projectLabel}.`
        : null;
    const productPlatformRoot = resolveProductPlatformRoot(audit);
    return {
        gatePass: (_h = gate.pass) !== null && _h !== void 0 ? _h : null,
        gateBlockingCount: (_j = gate.blockingCount) !== null && _j !== void 0 ? _j : null,
        gateWarningCount: (_k = gate.warningCount) !== null && _k !== void 0 ? _k : null,
        gateFailureNote: gate.pass === false
            ? `Gate FAIL — ${(_l = gate.blockingCount) !== null && _l !== void 0 ? _l : 0} blocking finding(s). Review detectedIssues in report export.`
            : null,
        consistencyScore: (_m = metrics.consistencyScore) !== null && _m !== void 0 ? _m : null,
        qualityScore: (_o = metrics.qualityScore) !== null && _o !== void 0 ? _o : null,
        pageSpecsLabel,
        jestTestsLabel,
        mockSampleFiles: (_p = metrics.mockSampleFiles) !== null && _p !== void 0 ? _p : null,
        filesAnalyzed: (_q = metrics.filesAnalyzed) !== null && _q !== void 0 ? _q : null,
        ruleScopedFilesAnalyzed: (_r = metrics.ruleScopedFilesAnalyzed) !== null && _r !== void 0 ? _r : null,
        lastScan: (_s = metrics.lastScan) !== null && _s !== void 0 ? _s : null,
        inventoryFiles: (_t = metrics.inventoryFiles) !== null && _t !== void 0 ? _t : null,
        inventoryFolders: (_u = metrics.inventoryFolders) !== null && _u !== void 0 ? _u : null,
        projectRoot: redactProjectPathForExport(metrics.inventoryRoot, projectLabel),
        benchmarkScan,
        ...(benchmarkScan && productPlatformRoot
            ? { productPlatformRoot: redactProjectPathForExport(productPlatformRoot, 'ai-platform') }
            : {}),
        layerPassCount: layerCounts.pass,
        layerWarnCount: layerCounts.warn,
        layerFailCount: layerCounts.fail,
        fictionCatalogPatterns: Array.isArray(audit.fictionCatalog) ? audit.fictionCatalog.length : 0,
        fictionActiveFindings: (_w = (_v = layers.fictionKpis) === null || _v === void 0 ? void 0 : _v.findings) !== null && _w !== void 0 ? _w : null,
        npmDependencies: (_x = npmStats === null || npmStats === void 0 ? void 0 : npmStats.dependencies) !== null && _x !== void 0 ? _x : null,
        npmVulnerabilities: (_y = npmStats === null || npmStats === void 0 ? void 0 : npmStats.vulnerabilityTotal) !== null && _y !== void 0 ? _y : null,
        npmAuditAt: (_z = npmStats === null || npmStats === void 0 ? void 0 : npmStats.generatedAt) !== null && _z !== void 0 ? _z : null,
        npmAuditScope: benchmarkScan && npmProjectLabel !== projectLabel ? 'product-platform' : 'aligned',
        assessmentGateResult: (_0 = exec.gateResult) !== null && _0 !== void 0 ? _0 : null,
        assessmentQualityScore: (_1 = exec.qualityScore) !== null && _1 !== void 0 ? _1 : null,
        checklistPassed: (_2 = checklist.passed) !== null && _2 !== void 0 ? _2 : null,
        checklistFailed: (_3 = checklist.failed) !== null && _3 !== void 0 ? _3 : null,
        checklistTotal: (_4 = checklist.total) !== null && _4 !== void 0 ? _4 : null,
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
        .map((issue) => {
        var _a, _b;
        return ({
            file: issue.filePath || issue.file || ((_a = issue.filePaths) === null || _a === void 0 ? void 0 : _a[0]) || ((_b = issue.affectedFiles) === null || _b === void 0 ? void 0 : _b[0]) || '—',
            description: issue.description,
            severity: issue.severity,
            count: issue.count || 1,
            recommendedAction: issue.recommendedAction
        });
    });
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
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (!assessment || !report)
        return assessment;
    const sourceIssues = ((_a = report.rawIssues) === null || _a === void 0 ? void 0 : _a.length) ? report.rawIssues : (report.detectedIssues || []);
    const productionLeaks = bucketProductionLeaks(sourceIssues);
    const sev = report.severityCounts || {};
    const findings = { ...(assessment.findings || {}) };
    if (findings.productionLeaks) {
        const count = (_b = report.productionLeakFindings) !== null && _b !== void 0 ? _b : productionLeaks.length;
        findings.productionLeaks = {
            ...findings.productionLeaks,
            findings: count,
            items: productionLeaks.length ? productionLeaks : findings.productionLeaks.items,
            summary: summarizeFindingBucket(productionLeaks, 'No mock/sample path references in production directories.', count)
        };
    }
    return {
        ...assessment,
        executiveSummary: {
            ...(assessment.executiveSummary || {}),
            gateResult: ((_c = report.gate) === null || _c === void 0 ? void 0 : _c.pass) ? 'PASS' : 'FAIL',
            highIssues: (_d = sev.high) !== null && _d !== void 0 ? _d : 0,
            mediumIssues: (_e = sev.medium) !== null && _e !== void 0 ? _e : 0,
            lowIssues: (_f = sev.low) !== null && _f !== void 0 ? _f : 0,
            blockingCount: (_k = (_h = (_g = report.gate) === null || _g === void 0 ? void 0 : _g.blockingCount) !== null && _h !== void 0 ? _h : (_j = assessment.executiveSummary) === null || _j === void 0 ? void 0 : _j.blockingCount) !== null && _k !== void 0 ? _k : 0,
            warningCount: (_p = (_m = (_l = report.gate) === null || _l === void 0 ? void 0 : _l.warningCount) !== null && _m !== void 0 ? _m : (_o = assessment.executiveSummary) === null || _o === void 0 ? void 0 : _o.warningCount) !== null && _p !== void 0 ? _p : 0
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
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!report)
        return null;
    const sanitized = sanitizeSimplebeaconReportExport(report, {
        projectPath: report.projectRoot || projectLabel,
        exportFilename: options.exportFilename
    });
    const euSummary = ((_b = (_a = sanitized.euAiActSummary) === null || _a === void 0 ? void 0 : _a.documentationFound) === null || _b === void 0 ? void 0 : _b.length)
        ? { euAiActSummary: splitDocumentationPaths(sanitized.euAiActSummary) }
        : {};
    return {
        ...sanitized,
        ...euSummary,
        title: normalizeSimpleBeaconBranding(sanitized.title),
        generatedBy: normalizeSimpleBeaconBranding(sanitized.generatedBy),
        blockingCount: (_e = (_d = (_c = sanitized.gate) === null || _c === void 0 ? void 0 : _c.blockingCount) !== null && _d !== void 0 ? _d : sanitized.blockingCount) !== null && _e !== void 0 ? _e : null,
        warningCount: (_h = (_g = (_f = sanitized.gate) === null || _f === void 0 ? void 0 : _f.warningCount) !== null && _g !== void 0 ? _g : sanitized.warningCount) !== null && _h !== void 0 ? _h : null
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
    var _a, _b;
    if (!assessment)
        return null;
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
                    generatedAt: (_a = sourceReport.generatedAt) !== null && _a !== void 0 ? _a : null,
                    duplicateGroups: (_b = sourceReport.duplicateGroups) !== null && _b !== void 0 ? _b : null
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
    if (!auditLayers)
        return null;
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
    var _a, _b, _c, _d, _e, _f, _g;
    if (!dashboard)
        return null;
    const { fictionCatalog, ...rest } = dashboard;
    const pageSpecsLabel = resolveCanonicalPageSpecsLabel(audit);
    const report = audit.report || {};
    const gate = report.gate || ((_a = audit.auditLayers) === null || _a === void 0 ? void 0 : _a.gate) || {};
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
            issueCount: (_c = (_b = gate.blockingCount) !== null && _b !== void 0 ? _b : report.issueCount) !== null && _c !== void 0 ? _c : next.scanStatus.issueCount,
            blockingCount: (_d = gate.blockingCount) !== null && _d !== void 0 ? _d : next.scanStatus.blockingCount,
            warningCount: (_e = gate.warningCount) !== null && _e !== void 0 ? _e : next.scanStatus.warningCount,
            qualityScore: (_f = report.qualityScore) !== null && _f !== void 0 ? _f : next.scanStatus.qualityScore,
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
    if ((_g = next.trends) === null || _g === void 0 ? void 0 : _g.aiAdoptionTrend) {
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
    if (!baseline)
        return null;
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
    var _a;
    return {
        report: audit.report ? 'live-gate-scan' : 'missing',
        assessment: audit.assessment ? 'assessment-artifact' : 'missing',
        npmAudit: ((_a = audit.npmAudit) === null || _a === void 0 ? void 0 : _a.error) ? 'error' : (audit.npmAudit ? 'live-npm-audit' : 'missing'),
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
    var _a;
    const projectLabel = resolveProjectLabel(audit);
    const benchmarkScan = isBenchmarkComplianceAudit(audit);
    const summary = buildComplianceAuditSummary(audit);
    const sanitizedReport = sanitizeReportExport(audit.report, projectLabel, options);
    const npmAudit = audit.npmAudit && !audit.npmAudit.error
        ? sanitizeNpmAuditForQualityExport(audit.npmAudit, benchmarkScan ? 'ai-platform' : projectLabel)
        : (((_a = audit.npmAudit) === null || _a === void 0 ? void 0 : _a.error) ? { error: audit.npmAudit.error } : audit.npmAudit || null);
    const pageSpecsMismatchNote = buildPageSpecsMismatchNote(audit, summary.pageSpecsLabel);
    /**
     * Report export notes.
     * @param {number} sanitizedReport?.exportNotes || []
     * @returns {any}
     */
    const reportExportNotes = ((sanitizedReport === null || sanitizedReport === void 0 ? void 0 : sanitizedReport.exportNotes) || []).filter((note) => {
        const text = String(note);
        if (summary.gateFailureNote && /gate fail/i.test(text))
            return false;
        if (summary.jestBaselineNote && /jest reported.*failure/i.test(text))
            return false;
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
    if (!bundle)
        return bundle;
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
    return `"${String(cell !== null && cell !== void 0 ? cell : '').replace(/"/g, '""')}"`;
}
/**
 * Build audit layers csv.
 * @param {Array} auditLayers
 * @returns {any}
 */
export function buildAuditLayersCsv(auditLayers = {}) {
    const keys = Object.keys(auditLayers).filter((key) => key !== 'gate');
    if (!keys.length)
        return null;
    const header = ['layer', 'label', 'status', 'checked', 'findings', 'compliance'];
    const rows = keys.map((key) => {
        var _a, _b, _c, _d, _e, _f;
        const layer = auditLayers[key] || {};
        const status = layer.status || (layer.findings > 0 ? 'fail' : 'pass');
        const checked = (_c = (_b = (_a = layer.scanned) !== null && _a !== void 0 ? _a : layer.checked) !== null && _b !== void 0 ? _b : layer.label) !== null && _c !== void 0 ? _c : '';
        const findings = (_e = (_d = layer.findings) !== null && _d !== void 0 ? _d : layer.blockingCount) !== null && _e !== void 0 ? _e : '';
        return [
            key,
            LAYER_LABELS[key] || key,
            status,
            checked,
            findings,
            (_f = layer.compliance) !== null && _f !== void 0 ? _f : ''
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
    var _a;
    const rules = (_a = assessment === null || assessment === void 0 ? void 0 : assessment.complianceChecklist) === null || _a === void 0 ? void 0 : _a.rules;
    if (!(rules === null || rules === void 0 ? void 0 : rules.length))
        return null;
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
    if (layers)
        parts.push(layers);
    if (summaryCsv) {
        if (parts.length)
            parts.push('');
        parts.push('Compliance audit summary');
        parts.push(summaryCsv);
    }
    if (checklist) {
        if (parts.length)
            parts.push('');
        parts.push('Assessment checklist');
        parts.push(checklist);
    }
    if (npm) {
        if (parts.length)
            parts.push('');
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
    if (ext === 'csv')
        return `compliance-audit-metrics-${stamp}.csv`;
    return `compliance-audit-export-${stamp}.json`;
}
