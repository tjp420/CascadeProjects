/**
 * Browser mirror of data-cleanup-report export sanitization.
 */
import { normalizeDuplicateGroupForBrief } from './cleanup-brief-export.browser.js?v=20260716cachefix1';
import { redactProjectPathForExport } from './quality-export.browser.js?v=20260716cachefix1';
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
 * Resolve file reduction remediation hint.
 * @param {any} fr
 * @returns {any}
 */
function resolveFileReductionRemediationHint(fr = {}) {
    var _a, _b;
    const safeBytes = (_a = fr.safeToDeleteBytes) !== null && _a !== void 0 ? _a : 0;
    const reviewBytes = (_b = fr.reviewBeforeDeleteBytes) !== null && _b !== void 0 ? _b : 0;
    if (safeBytes > 0) {
        return `Phase 1 safe-delete: ~${Number(safeBytes).toLocaleString()} B in regenerable artifact directories — see fileReductionPlan.safeToDelete before deleting.`;
    }
    if (fr.unusedFileCandidates || fr.duplicateAssetBytes) {
        return 'No measured phase-1 safe-delete bytes — use priorityActions for investigate list and optional duplicate consolidation.';
    }
    if (reviewBytes > 0) {
        return `${Number(reviewBytes).toLocaleString()} B in review-first build artifacts — confirm before deletion.`;
    }
    return 'No file-reduction actions required in this export.';
}
/**
 * Redact data cleanup export paths.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
function redactDataCleanupExportPaths(report, projectPath) {
    var _a, _b;
    const label = projectLabelFromPath(projectPath);
    const redacted = redactProjectPathForExport(projectPath, label);
    let next = {
        ...report,
        projectRoot: redacted,
        ...(report.projectPath ? { projectPath: redacted } : {})
    };
    if ((_b = (_a = next.scannerStatistics) === null || _a === void 0 ? void 0 : _a.project) === null || _b === void 0 ? void 0 : _b.projectRoot) {
        next = {
            ...next,
            scannerStatistics: {
                ...next.scannerStatistics,
                project: {
                    ...next.scannerStatistics.project,
                    projectRoot: redacted
                }
            }
        };
    }
    if (next.productPlatformRoot) {
        next.productPlatformRoot = redactProjectPathForExport(next.productPlatformRoot, projectLabelFromPath(next.productPlatformRoot));
    }
    return next;
}
/**
 * Is benchmark report.
 * @param {number} report
 * @returns {any}
 */
function isBenchmarkReport(report) {
    const root = String((report === null || report === void 0 ? void 0 : report.projectRoot) || (report === null || report === void 0 ? void 0 : report.projectPath) || '').replace(/\\/g, '/').toLowerCase();
    return root.includes('/github-cache/') || root.startsWith('github-cache/');
}
/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
    const normalized = String(projectPath || '').replace(/\\/g, '/');
    const idx = normalized.toLowerCase().indexOf('/github-cache/');
    if (idx <= 0)
        return null;
    return normalized.slice(0, idx);
}
/**
 * Benchmark limitation note.
 * @param {string} profile
 * @returns {any}
 */
function benchmarkLimitationNote(profile) {
    if (profile === 'file-reduction') {
        return 'Scanning OSS benchmark clone under github-cache/ — file-reduction hygiene only; duplicate doc assets across versioned geedocs folders and unused-file hits require manual review.';
    }
    return 'Scanning OSS benchmark clone under github-cache/ — Simplebeacon workspace scanners (package.json, .env) target product layout, not this C++/Python OSS tree.';
}
/**
 * Benchmark export note.
 * @param {string} profile
 * @returns {any}
 */
function benchmarkExportNote(profile) {
    if (profile === 'file-reduction') {
        return 'Benchmark clone file-reduction export — not valid for Simplebeacon platform cleanup handoff. Run file-reduction on ai-platform root for product artifact tiers.';
    }
    return 'Benchmark clone data-quality export — not valid for Simplebeacon platform handoff. Run data-quality on ai-platform root for workspace health.';
}
const BENCHMARK_FILE_REDUCTION_RECOMMENDATIONS = [
    'OSS clone only — compare hygiene metrics against other benchmarks, not Simplebeacon platform cleanup.',
    '.DS_Store under docs/ is safe to remove on macOS checkouts; prebuilt .so under portableglobe/servers/ may be required — verify before delete.',
    'Duplicate PNG assets across docs/geedocs version folders are often intentional — consolidate only when deduplicating doc trees.',
    'Unused-file candidates use static import graphs — HTML entrypoints, Python CGI, and integration tests are frequently loaded dynamically.'
];
/**
 * Resolve file reduction status.
 * @param {number} report
 * @returns {any}
 */
function resolveFileReductionStatus(report) {
    var _a, _b, _c, _d, _e, _f, _g;
    const safeBytes = (_c = (_b = (_a = report.fileReductionPlan) === null || _a === void 0 ? void 0 : _a.totals) === null || _b === void 0 ? void 0 : _b.safeToDeleteBytes) !== null && _c !== void 0 ? _c : 0;
    const unused = (_e = (_d = report.summary) === null || _d === void 0 ? void 0 : _d.unusedFileCandidates) !== null && _e !== void 0 ? _e : 0;
    const dupGroups = (_g = (_f = report.summary) === null || _f === void 0 ? void 0 : _f.duplicateAssetGroups) !== null && _g !== void 0 ? _g : 0;
    if (safeBytes > 0)
        return 'safe-delete-available';
    if (unused > 0 || dupGroups > 0)
        return 'investigate-and-optional-consolidation';
    return 'no-immediate-reclaim';
}
/**
 * Enrich product inventory for export.
 * @param {any} inventory
 * @param {Object} options
 * @param {string} profile
 * @returns {any}
 */
function enrichProductInventoryForExport(inventory, options = {}, profile = '') {
    var _a, _b, _c;
    if (!inventory)
        return inventory;
    const auditFiles = (_b = (_a = options.repositoryFilesTotal) !== null && _a !== void 0 ? _a : options.auditRepositoryFiles) !== null && _b !== void 0 ? _b : null;
    const invFiles = (_c = inventory.totalFiles) !== null && _c !== void 0 ? _c : null;
    const base = {
        ...inventory,
        inventoryScope: 'platform-product'
    };
    if (auditFiles != null && invFiles != null && auditFiles > invFiles) {
        base.auditRepositoryFiles = auditFiles;
        base.inventoryNote = profile === 'file-reduction'
            ? `Workspace file-reduction inventory (${Number(invFiles).toLocaleString()} files) excludes un-walked vendor trees; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`
            : `Workspace inventory (${Number(invFiles).toLocaleString()} files) is smaller than gate audit profile (${Number(auditFiles).toLocaleString()} files) — workspace scans exclude un-walked vendor shells.`;
    }
    else if (invFiles != null && invFiles > 2000) {
        base.inventoryNote = 'Workspace inventory excludes node_modules; counts reflect scanned source and config paths.';
    }
    return base;
}
/**
 * Is mirror cli consumer path.
 * @param {string} consumerPath
 * @returns {any}
 */
function isMirrorCliConsumerPath(consumerPath) {
    const normalized = String(consumerPath || '').replace(/\\/g, '/');
    return normalized.startsWith('.github-sync/') || normalized.startsWith('github-cache/');
}
/**
 * Sanitize data lineage for export.
 * @param {any} dataLineage
 * @returns {any}
 */
function sanitizeDataLineageForExport(dataLineage = []) {
    if (!Array.isArray(dataLineage) || !dataLineage.length) {
        return { dataLineage, mirrorConsumersExcluded: 0 };
    }
    let mirrorConsumersExcluded = 0;
    const rows = dataLineage.map((row) => {
        const consumers = Array.isArray(row.consumers) ? row.consumers : [];
        const primaryConsumers = consumers.filter((consumer) => !isMirrorCliConsumerPath(consumer));
        const rowExcluded = consumers.length - primaryConsumers.length;
        mirrorConsumersExcluded += rowExcluded;
        return {
            ...row,
            consumers: primaryConsumers,
            consumerCount: primaryConsumers.length,
            ...(rowExcluded > 0 ? { mirrorConsumersExcluded: rowExcluded } : {})
        };
    });
    return { dataLineage: rows, mirrorConsumersExcluded };
}
/**
 * Resolve data cleanup gate context.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function resolveDataCleanupGateContext(report, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14, _15, _16, _17;
    const gateReport = options.gateReport || {};
    const repositoryFilesTotal = (_k = (_h = (_f = (_d = (_b = (_a = options.repositoryFilesTotal) !== null && _a !== void 0 ? _a : gateReport.repositoryFilesTotal) !== null && _b !== void 0 ? _b : (_c = gateReport.repositoryInventory) === null || _c === void 0 ? void 0 : _c.totalFiles) !== null && _d !== void 0 ? _d : (_e = report.inventory) === null || _e === void 0 ? void 0 : _e.auditRepositoryFiles) !== null && _f !== void 0 ? _f : (_g = report.hygieneSummary) === null || _g === void 0 ? void 0 : _g.gateRepositoryFilesTotal) !== null && _h !== void 0 ? _h : (_j = report.scanScope) === null || _j === void 0 ? void 0 : _j.gateRepositoryFilesTotal) !== null && _k !== void 0 ? _k : null;
    const credentialScanned = (_r = (_p = (_m = (_l = gateReport.credentialScanned) !== null && _l !== void 0 ? _l : gateReport.productionLeakScanned) !== null && _m !== void 0 ? _m : (_o = gateReport.scanScope) === null || _o === void 0 ? void 0 : _o.productionDirsScanned) !== null && _p !== void 0 ? _p : (_q = report.hygieneSummary) === null || _q === void 0 ? void 0 : _q.credentialScanned) !== null && _r !== void 0 ? _r : null;
    const contentScanned = (_0 = (_y = (_x = (_u = (_t = (_s = gateReport.scanScope) === null || _s === void 0 ? void 0 : _s.fullDirectoryStats) === null || _t === void 0 ? void 0 : _t.contentScanned) !== null && _u !== void 0 ? _u : (_w = (_v = gateReport.scanScope) === null || _v === void 0 ? void 0 : _v.fullDirectoryStats) === null || _w === void 0 ? void 0 : _w.filesContentScanned) !== null && _x !== void 0 ? _x : gateReport.credentialScanned) !== null && _y !== void 0 ? _y : (_z = report.hygieneSummary) === null || _z === void 0 ? void 0 : _z.contentFilesScanned) !== null && _0 !== void 0 ? _0 : null;
    const gateProfile = (_6 = (_4 = (_2 = (_1 = gateReport.scanScope) === null || _1 === void 0 ? void 0 : _1.profile) !== null && _2 !== void 0 ? _2 : (_3 = report.scanScope) === null || _3 === void 0 ? void 0 : _3.gateRuleBundleProfile) !== null && _4 !== void 0 ? _4 : (_5 = report.hygieneSummary) === null || _5 === void 0 ? void 0 : _5.gateRuleBundleProfile) !== null && _6 !== void 0 ? _6 : null;
    return {
        gateReport,
        repositoryFilesTotal,
        credentialScanned,
        contentScanned,
        gateProfile,
        fictionJsonFilesScanned: (_11 = (_9 = (_7 = gateReport.fictionJsonFilesScanned) !== null && _7 !== void 0 ? _7 : (_8 = gateReport.scanScope) === null || _8 === void 0 ? void 0 : _8.fictionJsonFilesScanned) !== null && _9 !== void 0 ? _9 : (_10 = report.hygieneSummary) === null || _10 === void 0 ? void 0 : _10.fictionJsonFilesScanned) !== null && _11 !== void 0 ? _11 : null,
        fictionSampleFilesScanned: (_17 = (_15 = (_13 = (_12 = gateReport.fictionSampleFilesScanned) !== null && _12 !== void 0 ? _12 : gateReport.mockSampleFiles) !== null && _13 !== void 0 ? _13 : (_14 = gateReport.scanScope) === null || _14 === void 0 ? void 0 : _14.fictionSampleFilesScanned) !== null && _15 !== void 0 ? _15 : (_16 = report.hygieneSummary) === null || _16 === void 0 ? void 0 : _16.fictionSampleFilesScanned) !== null && _17 !== void 0 ? _17 : null
    };
}
/**
 * Build data quality hygiene summary.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function buildDataQualityHygieneSummary(report, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4;
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport, fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    const workspaceFiles = (_b = (_a = report.inventory) === null || _a === void 0 ? void 0 : _a.totalFiles) !== null && _b !== void 0 ? _b : null;
    return {
        dataQualityStatus: (_c = report.dataQualityStatus) !== null && _c !== void 0 ? _c : resolveDataQualityStatus(report),
        totalFindings: (_e = (_d = report.summary) === null || _d === void 0 ? void 0 : _d.totalFindings) !== null && _e !== void 0 ? _e : 0,
        workspaceFilesScanned: workspaceFiles,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateTotal != null && workspaceFiles != null && gateTotal > workspaceFiles
            ? { workspaceInventoryNotInGate: gateTotal - workspaceFiles }
            : {}),
        ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
            ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
            : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        packageJsonFiles: (_l = (_h = (_g = (_f = report.scanners) === null || _f === void 0 ? void 0 : _f['dependency-health']) === null || _g === void 0 ? void 0 : _g.packageJsonFiles) !== null && _h !== void 0 ? _h : (_k = (_j = report.scanners) === null || _j === void 0 ? void 0 : _j['config-management']) === null || _k === void 0 ? void 0 : _k.packageJsonFiles) !== null && _l !== void 0 ? _l : null,
        envKeysDefined: (_p = (_o = (_m = report.scanners) === null || _m === void 0 ? void 0 : _m['environment-variables']) === null || _o === void 0 ? void 0 : _o.envKeys) !== null && _p !== void 0 ? _p : null,
        envKeysReferenced: (_s = (_r = (_q = report.scanners) === null || _q === void 0 ? void 0 : _q['environment-variables']) === null || _r === void 0 ? void 0 : _r.referencedKeys) !== null && _s !== void 0 ? _s : null,
        dataLineageSampleFiles: (_y = (_v = (_u = (_t = report.scanners) === null || _t === void 0 ? void 0 : _t['data-lineage']) === null || _u === void 0 ? void 0 : _u.dataFilesTracked) !== null && _v !== void 0 ? _v : (_x = (_w = report.metadata) === null || _w === void 0 ? void 0 : _w.dataLineage) === null || _x === void 0 ? void 0 : _x.length) !== null && _y !== void 0 ? _y : null,
        dataAccessSourceScanned: (_1 = (_0 = (_z = report.scanners) === null || _z === void 0 ? void 0 : _z['data-access-patterns']) === null || _0 === void 0 ? void 0 : _0.sourceFilesScanned) !== null && _1 !== void 0 ? _1 : null,
        mirrorConsumersExcluded: (_3 = (_2 = report.metadata) === null || _2 === void 0 ? void 0 : _2.mirrorConsumersExcluded) !== null && _3 !== void 0 ? _3 : 0,
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(gateReport.jestBaselineChecked === false || ((_4 = report.hygieneSummary) === null || _4 === void 0 ? void 0 : _4.jestBaselineChecked) === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote: 'Data-quality hygiene scan — not gate pass or vendor handoff certification.'
    };
}
/**
 * Enrich product data quality scan scope.
 * @param {any} scanScope
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function enrichProductDataQualityScanScope(scanScope, report, options = {}) {
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        ...(scanScope || {}),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
        resultsViewScope: (scanScope === null || scanScope === void 0 ? void 0 : scanScope.resultsViewScope) || 'platform-only',
        reportHealth: (scanScope === null || scanScope === void 0 ? void 0 : scanScope.reportHealth) || 'platform-scoped',
        securityHandoffEligible: false
    };
}
/**
 * Build file reduction hygiene summary.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function buildFileReductionHygieneSummary(report, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8;
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport, fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    const workspaceFiles = (_b = (_a = report.inventory) === null || _a === void 0 ? void 0 : _a.totalFiles) !== null && _b !== void 0 ? _b : null;
    const unusedScanned = (_h = (_e = (_d = (_c = report.scanners) === null || _c === void 0 ? void 0 : _c['unused-files']) === null || _d === void 0 ? void 0 : _d.sourceFilesScanned) !== null && _e !== void 0 ? _e : (_g = (_f = report.fileReductionPlan) === null || _f === void 0 ? void 0 : _f.unusedFiles) === null || _g === void 0 ? void 0 : _g.sourceFilesScanned) !== null && _h !== void 0 ? _h : null;
    const entryPoints = (_p = (_l = (_k = (_j = report.metadata) === null || _j === void 0 ? void 0 : _j.entryPoints) === null || _k === void 0 ? void 0 : _k.length) !== null && _l !== void 0 ? _l : (_o = (_m = report.scanners) === null || _m === void 0 ? void 0 : _m['unused-files']) === null || _o === void 0 ? void 0 : _o.entryPoints) !== null && _p !== void 0 ? _p : null;
    return {
        fileReductionStatus: (_q = report.fileReductionStatus) !== null && _q !== void 0 ? _q : resolveFileReductionStatus(report),
        workspaceFilesScanned: workspaceFiles,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateTotal != null && workspaceFiles != null && gateTotal > workspaceFiles
            ? { workspaceInventoryNotInGate: gateTotal - workspaceFiles }
            : {}),
        ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
            ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
            : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        safeToDeleteBytes: (_w = (_t = (_s = (_r = report.fileReductionPlan) === null || _r === void 0 ? void 0 : _r.totals) === null || _s === void 0 ? void 0 : _s.safeToDeleteBytes) !== null && _t !== void 0 ? _t : (_v = (_u = report.scanners) === null || _u === void 0 ? void 0 : _u['build-artifacts']) === null || _v === void 0 ? void 0 : _v.safeToDeleteBytes) !== null && _w !== void 0 ? _w : 0,
        duplicateAssetBytes: (_2 = (_z = (_y = (_x = report.fileReductionPlan) === null || _x === void 0 ? void 0 : _x.totals) === null || _y === void 0 ? void 0 : _y.duplicateAssetBytes) !== null && _z !== void 0 ? _z : (_1 = (_0 = report.scanners) === null || _0 === void 0 ? void 0 : _0['asset-consolidation']) === null || _1 === void 0 ? void 0 : _1.reclaimableBytes) !== null && _2 !== void 0 ? _2 : 0,
        unusedFileCandidates: (_4 = (_3 = report.summary) === null || _3 === void 0 ? void 0 : _3.unusedFileCandidates) !== null && _4 !== void 0 ? _4 : 0,
        unusedFilesSourceScanned: unusedScanned,
        assetFilesScanned: (_7 = (_6 = (_5 = report.scanners) === null || _5 === void 0 ? void 0 : _5['asset-consolidation']) === null || _6 === void 0 ? void 0 : _6.assetFilesScanned) !== null && _7 !== void 0 ? _7 : null,
        unusedFileEntryPoints: entryPoints,
        enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(gateReport.jestBaselineChecked === false || ((_8 = report.hygieneSummary) === null || _8 === void 0 ? void 0 : _8.jestBaselineChecked) === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote: 'File-reduction hygiene scan — reclaim guidance only, not vendor handoff clearance.'
    };
}
/**
 * Enrich product file reduction scan scope.
 * @param {any} scanScope
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function enrichProductFileReductionScanScope(scanScope, report, options = {}) {
    var _a;
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        ...(scanScope || {}),
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        enabledScannerCount: Array.isArray(report.enabledScanners) ? report.enabledScanners.length : null,
        resultsViewScope: (scanScope === null || scanScope === void 0 ? void 0 : scanScope.resultsViewScope) || 'platform-only',
        reportHealth: (scanScope === null || scanScope === void 0 ? void 0 : scanScope.reportHealth) || 'platform-scoped',
        securityHandoffEligible: false,
        fileReductionNote: (scanScope === null || scanScope === void 0 ? void 0 : scanScope.fileReductionNote)
            || ((_a = report.scanScope) === null || _a === void 0 ? void 0 : _a.fileReductionNote)
            || 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
    };
}
/**
 * Build product file reduction export notes.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function buildProductFileReductionExportNotes(report, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11;
    const notes = [
        'securityHandoffEligible is false — file-reduction is reclaim guidance only, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    if ((_a = report.inventory) === null || _a === void 0 ? void 0 : _a.inventoryNote) {
        notes.push(String(report.inventory.inventoryNote));
    }
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
        notes.push(`Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`);
    }
    if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
        notes.push(
        // simplebeacon:production-leak-intent - legitimate KPI reference for data cleanup reporting
        `Gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) with ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched — file-reduction profile scans reclaim tiers only.`);
    }
    if (gateProfile) {
        notes.push(`Gate rule bundle profile: ${gateProfile} — pair file-reduction report with json/simplebeacon-gate.json for handoff evidence.`);
    }
    const assetScanned = (_c = (_b = report.scanners) === null || _b === void 0 ? void 0 : _b['asset-consolidation']) === null || _c === void 0 ? void 0 : _c.assetFilesScanned;
    if (assetScanned != null && assetScanned > 0) {
        notes.push(`${Number(assetScanned).toLocaleString()} static asset file(s) hashed for duplicate consolidation — workspace inventory excludes node_modules vendor trees.`);
    }
    const safeBytes = (_f = (_e = (_d = report.fileReductionPlan) === null || _d === void 0 ? void 0 : _d.totals) === null || _e === void 0 ? void 0 : _e.safeToDeleteBytes) !== null && _f !== void 0 ? _f : 0;
    const shells = ((_h = (_g = report.fileReductionPlan) === null || _g === void 0 ? void 0 : _g.safeToDelete) === null || _h === void 0 ? void 0 : _h.topDirectories) || [];
    const zeroByteShells = shells.filter((d) => { var _a; return ((_a = d.bytes) !== null && _a !== void 0 ? _a : 0) === 0 && /^(node_modules|coverage)$/.test(String(d.path)); });
    if (zeroByteShells.length && safeBytes === 0) {
        notes.push(`${zeroByteShells.length} regenerable directory shell(s) listed with 0 B walked — workspace scan excludes vendor tree contents.`);
    }
    const unused = (_k = (_j = report.summary) === null || _j === void 0 ? void 0 : _j.unusedFileCandidates) !== null && _k !== void 0 ? _k : 0;
    if (unused > 0) {
        notes.push(`${unused} unused-file candidates are static-analysis hits — HTML pages, fixtures, and re-export shims are often intentional.`);
    }
    const dupBytes = (_r = (_o = (_m = (_l = report.fileReductionPlan) === null || _l === void 0 ? void 0 : _l.totals) === null || _m === void 0 ? void 0 : _m.duplicateAssetBytes) !== null && _o !== void 0 ? _o : (_q = (_p = report.scanners) === null || _p === void 0 ? void 0 : _p['asset-consolidation']) === null || _q === void 0 ? void 0 : _q.reclaimableBytes) !== null && _r !== void 0 ? _r : 0;
    if (dupBytes > 0) {
        notes.push(`Phase 2 duplicate consolidation ~${dupBytes} B — use keeper paths in fileReductionPlan.duplicateAssets.topGroups.`);
    }
    const reviewBytes = (_u = (_t = (_s = report.fileReductionPlan) === null || _s === void 0 ? void 0 : _s.totals) === null || _t === void 0 ? void 0 : _t.reviewBeforeDeleteBytes) !== null && _u !== void 0 ? _u : 0;
    if (reviewBytes > 0) {
        notes.push(`${reviewBytes} B in review-first build artifacts (logs, maps, generated files) — not auto-deleted.`);
    }
    if (((_v = report.summary) === null || _v === void 0 ? void 0 : _v.estimatedReductionPct) != null) {
        notes.push(`estimatedReductionPct (${report.summary.estimatedReductionPct}%) is finding density vs scanned inventory, not bytes reclaimable.`);
    }
    if (report.compact) {
        notes.push('Compact export — top findings only; fileReductionPlan and summary retain full totals.');
        notes.push('scannerStatistics data-quality shells are zero — enabledScanners lists file-reduction modules only.');
    }
    const unusedScanned = (_1 = (_y = (_x = (_w = report.scanners) === null || _w === void 0 ? void 0 : _w['unused-files']) === null || _x === void 0 ? void 0 : _x.sourceFilesScanned) !== null && _y !== void 0 ? _y : (_0 = (_z = report.fileReductionPlan) === null || _z === void 0 ? void 0 : _z.unusedFiles) === null || _0 === void 0 ? void 0 : _0.sourceFilesScanned) !== null && _1 !== void 0 ? _1 : null;
    const workspaceFiles = (_3 = (_2 = report.inventory) === null || _2 === void 0 ? void 0 : _2.totalFiles) !== null && _3 !== void 0 ? _3 : null;
    if (unusedScanned != null && workspaceFiles != null && unusedScanned < workspaceFiles) {
        notes.push(`Unused-file graph scanned ${Number(unusedScanned).toLocaleString()} source file(s) from ${Number((_9 = (_6 = (_5 = (_4 = report.metadata) === null || _4 === void 0 ? void 0 : _4.entryPoints) === null || _5 === void 0 ? void 0 : _5.length) !== null && _6 !== void 0 ? _6 : (_8 = (_7 = report.scanners) === null || _7 === void 0 ? void 0 : _7['unused-files']) === null || _8 === void 0 ? void 0 : _8.entryPoints) !== null && _9 !== void 0 ? _9 : 0).toLocaleString()} entry point(s) — workspace inventory counted ${Number(workspaceFiles).toLocaleString()} paths.`);
    }
    notes.push('File-reduction scan does not run Jest — use gate/complete scan for test attestation.');
    if (safeBytes > 0) {
        notes.push('Safe-delete tiers are regenerable artifacts only — not SimpleBeacon vendor security handoff clearance.');
    }
    if (((_11 = (_10 = report.summary) === null || _10 === void 0 ? void 0 : _10.totalFindings) !== null && _11 !== void 0 ? _11 : 0) === 0
        && (report.fileReductionStatus === 'no-immediate-reclaim' || !report.fileReductionStatus)) {
        notes.push('No immediate reclaimable bytes or unused-file actions in this export.');
    }
    return [...new Set(notes)].slice(0, 13);
}
/**
 * Sanitize file reduction plan for product.
 * @param {any} plan
 * @returns {any}
 */
function sanitizeFileReductionPlanForProduct(plan) {
    var _a, _b, _c, _d, _e, _f, _g;
    if (!plan || plan.omitted)
        return plan;
    let next = { ...plan, profile: 'file-reduction' };
    if ((_b = (_a = plan.duplicateAssets) === null || _a === void 0 ? void 0 : _a.topGroups) === null || _b === void 0 ? void 0 : _b.length) {
        next.duplicateAssets = {
            ...plan.duplicateAssets,
            topGroups: plan.duplicateAssets.topGroups.map((g) => normalizeDuplicateGroupForBrief(g)).filter(Boolean)
        };
    }
    const safeBytes = (_d = (_c = plan.totals) === null || _c === void 0 ? void 0 : _c.safeToDeleteBytes) !== null && _d !== void 0 ? _d : 0;
    const hasZeroByteShell = (((_e = plan.safeToDelete) === null || _e === void 0 ? void 0 : _e.topDirectories) || []).some((entry) => { var _a; return ((_a = entry.bytes) !== null && _a !== void 0 ? _a : 0) === 0 && /^(node_modules|coverage)$/.test(String(entry.path)); });
    if (safeBytes === 0 && hasZeroByteShell && Array.isArray(plan.recommendations)
        && plan.recommendations.some((r) => /Delete top-level artifact/i.test(r))) {
        next.recommendations = [
            'Regenerable shells (node_modules, coverage) were detected but not size-walked — confirm before delete; restore with `npm install` or re-run tests.',
            'Consolidate duplicate assets using keeper paths in duplicateAssets.topGroups (canonical favicon: web/favicon.svg).',
            'Unused-file hits include HTML entrypoints, fixtures, and re-export shims — verify before deletion.',
            'Run data-quality profile for env keys and sync I/O findings.'
        ];
        next.hygieneSummary = {
            safeToDeleteBytes: 0,
            duplicateAssetBytes: (_g = (_f = plan.totals) === null || _f === void 0 ? void 0 : _f.duplicateAssetBytes) !== null && _g !== void 0 ? _g : 0,
            note: 'No measured safe-delete bytes — regenerable shells were not size-walked; optional duplicate consolidation only.'
        };
    }
    return next;
}
/**
 * Enrich product file reduction executive summary.
 * @param {any} executiveSummary
 * @param {number} _report
 * @returns {any}
 */
function enrichProductFileReductionExecutiveSummary(executiveSummary, _report) {
    var _a;
    if (!executiveSummary)
        return executiveSummary;
    const fr = executiveSummary.fileReduction || {};
    const actions = [...(executiveSummary.priorityActions || [])];
    if (fr.unusedFileCandidates > 0 && !actions.some((a) => /unused/i.test(a.title))) {
        actions.push({
            priority: 'medium',
            title: 'Investigate unused-file candidates',
            detail: `${fr.unusedFileCandidates} static hits — verify HTML entrypoints, fixtures, and dynamic loaders before deleting`
        });
    }
    if (fr.duplicateAssetBytes > 0 && !actions.some((a) => /duplicate/i.test(a.title))) {
        actions.unshift({
            priority: 'low',
            title: 'Review duplicate assets',
            detail: `${fr.duplicateAssetGroups || 1} group(s), ~${fr.duplicateAssetBytes} B — keeper paths listed in fileReductionPlan`
        });
    }
    const safeArtifacts = (((_a = _report === null || _report === void 0 ? void 0 : _report.findings) === null || _a === void 0 ? void 0 : _a.buildArtifacts) || []).filter((f) => f.action === 'safe-to-delete' && !String(f.reason || '').includes('contents not walked'));
    if ((fr.safeToDeleteBytes || 0) === 0 && safeArtifacts.length > 0
        && !actions.some((a) => /shell/i.test(a.title))) {
        actions.push({
            priority: 'low',
            title: 'Regenerable directory shells',
            detail: 'node_modules or coverage detected with 0 B walked — confirm regenerable before delete'
        });
    }
    const fileReductionNotes = [
        'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
    ];
    if (fr.unusedFileCandidates > 0) {
        fileReductionNotes.push(`${fr.unusedFileCandidates} unused-file candidates are static-analysis hits — verify HTML entrypoints and fixtures before deleting.`);
    }
    if ((fr.duplicateAssetBytes || 0) > 0) {
        fileReductionNotes.push(`Duplicate asset consolidation ~${fr.duplicateAssetBytes} B — see fileReductionPlan.duplicateAssets.topGroups for keeper paths.`);
    }
    return {
        ...executiveSummary,
        priorityActions: actions.slice(0, 8),
        exportProfile: 'file-reduction',
        remediationHint: resolveFileReductionRemediationHint(fr),
        notes: fileReductionNotes.slice(0, 6)
    };
}
/**
 * Resolve data quality status.
 * @param {number} report
 * @returns {any}
 */
function resolveDataQualityStatus(report) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const total = (_b = (_a = report.summary) === null || _a === void 0 ? void 0 : _a.totalFindings) !== null && _b !== void 0 ? _b : 0;
    const critical = (_e = (_d = (_c = report.aggregation) === null || _c === void 0 ? void 0 : _c.bySeverity) === null || _d === void 0 ? void 0 : _d.critical) !== null && _e !== void 0 ? _e : 0;
    const high = (_h = (_g = (_f = report.aggregation) === null || _f === void 0 ? void 0 : _f.bySeverity) === null || _g === void 0 ? void 0 : _g.high) !== null && _h !== void 0 ? _h : 0;
    if (critical > 0 || high > 0)
        return 'needs-attention';
    if (total > 0)
        return 'healthy-with-findings';
    return 'clean';
}
/**
 * Build product data quality export notes.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
function buildProductDataQualityExportNotes(report, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13, _14;
    const notes = [
        'securityHandoffEligible is false — data-quality hygiene is supplementary, not vendor security handoff.',
        'Absolute scan paths are redacted to project label in operator exports.'
    ];
    if ((_a = report.inventory) === null || _a === void 0 ? void 0 : _a.inventoryNote) {
        notes.push(String(report.inventory.inventoryNote));
    }
    const gateContext = resolveDataCleanupGateContext(report, options);
    const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gateReport, fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
        notes.push(`Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`);
    }
    const sourceScanned = (_c = (_b = report.scanners) === null || _b === void 0 ? void 0 : _b['data-access-patterns']) === null || _c === void 0 ? void 0 : _c.sourceFilesScanned;
    const workspaceFiles = (_d = report.inventory) === null || _d === void 0 ? void 0 : _d.totalFiles;
    if (sourceScanned != null && workspaceFiles != null && sourceScanned < workspaceFiles) {
        notes.push(`Data-access pattern scan walked ${Number(sourceScanned).toLocaleString()} source file(s) — workspace inventory is ${Number(workspaceFiles).toLocaleString()} paths excluding vendor trees.`);
    }
    const lineageSamples = (_g = (_f = (_e = report.scanners) === null || _e === void 0 ? void 0 : _e['data-lineage']) === null || _f === void 0 ? void 0 : _f.dataFilesTracked) !== null && _g !== void 0 ? _g : (_j = (_h = report.metadata) === null || _h === void 0 ? void 0 : _h.dataLineage) === null || _j === void 0 ? void 0 : _j.length;
    if (lineageSamples != null && fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
        notes.push(
        // simplebeacon:production-leak-intent - legitimate sample path reference for data cleanup reporting
        `Data-lineage tracked ${Number(lineageSamples).toLocaleString()} web/data *-sample.json file(s) — gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON paths with ${Number(fictionSampleFilesScanned).toLocaleString()} KPI samples matched.`);
    }
    const packageJsonFiles = (_m = (_l = (_k = report.scanners) === null || _k === void 0 ? void 0 : _k['dependency-health']) === null || _l === void 0 ? void 0 : _l.packageJsonFiles) !== null && _m !== void 0 ? _m : (_p = (_o = report.scanners) === null || _o === void 0 ? void 0 : _o['config-management']) === null || _p === void 0 ? void 0 : _p.packageJsonFiles;
    if (packageJsonFiles != null && packageJsonFiles > 0) {
        notes.push(`${Number(packageJsonFiles).toLocaleString()} workspace package.json manifest(s) scanned — dependency and env rules exclude node_modules vendor trees.`);
    }
    const missing = (_v = (_s = (_r = (_q = report.scanners) === null || _q === void 0 ? void 0 : _q['environment-variables']) === null || _r === void 0 ? void 0 : _r.missingKeys) !== null && _s !== void 0 ? _s : (_u = (_t = report.findings) === null || _t === void 0 ? void 0 : _t.environmentVariables) === null || _u === void 0 ? void 0 : _u.filter((f) => f.type === 'missing-env-key').length) !== null && _v !== void 0 ? _v : 0;
    const syncIo = (_1 = (_y = (_x = (_w = report.scanners) === null || _w === void 0 ? void 0 : _w['data-access-patterns']) === null || _x === void 0 ? void 0 : _x.patternFindings) !== null && _y !== void 0 ? _y : (_0 = (_z = report.findings) === null || _z === void 0 ? void 0 : _z.dataAccessPatterns) === null || _0 === void 0 ? void 0 : _0.length) !== null && _1 !== void 0 ? _1 : 0;
    if (missing > 0) {
        notes.push(`${missing} env key(s) referenced in code but not defined in workspace .env files — add to .env.example (commented) or local .env.`);
    }
    if (syncIo > 0) {
        notes.push(`${syncIo} sync filesystem read pattern(s) flagged — prefer startup load or cache (see dataAccessPatterns findings).`);
    }
    if (((_2 = report.summary) === null || _2 === void 0 ? void 0 : _2.estimatedReductionPct) != null) {
        notes.push(`estimatedReductionPct (${report.summary.estimatedReductionPct}%) is finding density vs scanned inventory, not disk bytes reclaimable.`);
    }
    if (report.compact) {
        notes.push('Compact export — top findings only; scannerStatistics and summary retain full counts.');
    }
    const mirrorExcluded = (_4 = (_3 = report.metadata) === null || _3 === void 0 ? void 0 : _3.mirrorConsumersExcluded) !== null && _4 !== void 0 ? _4 : 0;
    if (mirrorExcluded > 0) {
        notes.push(`${mirrorExcluded} dataLineage mirror consumer path(s) (.github-sync/) omitted from export — not primary application source.`);
    }
    else {
        const mirrorConsumers = (((_5 = report.metadata) === null || _5 === void 0 ? void 0 : _5.dataLineage) || [])
            .flatMap((row) => (row.consumers || []).filter((c) => isMirrorCliConsumerPath(c)));
        if (mirrorConsumers.length) {
            notes.push('dataLineage consumers may reference .github-sync/ CLI mirror paths — not primary ai-platform application source.');
        }
    }
    if (gateProfile) {
        notes.push(`Gate rule bundle profile: ${gateProfile} — pair data-quality report with json/simplebeacon-gate.json for handoff evidence.`);
    }
    if (gateReport.jestBaselineChecked === false || ((_6 = report.hygieneSummary) === null || _6 === void 0 ? void 0 : _6.jestBaselineChecked) === false) {
        notes.push('Data-quality scan does not run Jest — use gate/complete scan for test attestation.');
    }
    if (((_8 = (_7 = report.summary) === null || _7 === void 0 ? void 0 : _7.totalFindings) !== null && _8 !== void 0 ? _8 : 0) === 0) {
        notes.push('No open data-quality findings on scanned workspace paths in this export.');
    }
    const envKeys = (_11 = (_10 = (_9 = report.scanners) === null || _9 === void 0 ? void 0 : _9['environment-variables']) === null || _10 === void 0 ? void 0 : _10.envKeys) !== null && _11 !== void 0 ? _11 : 0;
    const referencedKeys = (_14 = (_13 = (_12 = report.scanners) === null || _12 === void 0 ? void 0 : _12['environment-variables']) === null || _13 === void 0 ? void 0 : _13.referencedKeys) !== null && _14 !== void 0 ? _14 : 0;
    if (referencedKeys > envKeys && envKeys > 0) {
        notes.push(`referencedKeys (${referencedKeys}) exceeds envKeys (${envKeys}) — static analysis counts code references including CI/Docker/runtime-injected keys.`);
    }
    return [...new Set(notes)].slice(0, 14);
}
/**
 * Fix estimated reduction pct.
 * @param {any} summary
 * @param {any} inventory
 * @returns {any}
 */
function fixEstimatedReductionPct(summary, inventory) {
    if (!summary || !(inventory === null || inventory === void 0 ? void 0 : inventory.totalFiles))
        return summary;
    if (summary.estimatedReductionPct == null || summary.estimatedReductionPct <= 100)
        return summary;
    return {
        ...summary,
        estimatedReductionPct: Math.round(((summary.totalFindings || 0) / inventory.totalFiles) * 1000) / 10
    };
}
/**
 * Repair compact asset findings.
 * @param {number} report
 * @returns {any}
 */
function repairCompactAssetFindings(report) {
    var _a, _b, _c;
    const topGroups = ((_b = (_a = report.fileReductionPlan) === null || _a === void 0 ? void 0 : _a.duplicateAssets) === null || _b === void 0 ? void 0 : _b.topGroups) || [];
    if (!topGroups.length)
        return report.findings;
    /**
     * Repaired.
     * @param {number} report.findings?.assetConsolidation || []
     * @returns {any}
     */
    const repaired = (((_c = report.findings) === null || _c === void 0 ? void 0 : _c.assetConsolidation) || []).map((finding, index) => {
        const group = topGroups[index] || topGroups.find((g) => g.reclaimableBytes === finding.reclaimableBytes);
        return normalizeDuplicateGroupForBrief({ ...finding, ...group }) || finding;
    });
    if (repaired.some((f) => f.keeper || f.path)) {
        return { ...report.findings, assetConsolidation: repaired };
    }
    return report.findings;
}
/**
 * Reaggregate top files.
 * @param {number} report
 * @returns {any}
 */
function reaggregateTopFiles(report) {
    const all = Object.values(report.findings || {}).flat().filter(Boolean);
    const byFile = new Map();
    for (const finding of all) {
        const key = finding.path || finding.keeper || 'unknown';
        if (key === 'unknown')
            continue;
        byFile.set(key, (byFile.get(key) || 0) + 1);
    }
    const topFiles = [...byFile.entries()]
        .sort((a, b) => b[1] - a[1])
        .slice(0, 20)
        .map(([filePath, count]) => ({ filePath, count }));
    if (!topFiles.length)
        return report.aggregation;
    return { ...(report.aggregation || {}), topFiles };
}
/**
 * Sanitize data cleanup report export.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeDataCleanupReportExport(report, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p;
    if (!report || report.type !== 'data-cleanup-report')
        return report;
    const projectPath = options.projectPath || report.projectRoot || report.projectPath || '';
    const benchmarkScan = isBenchmarkReport(report);
    const profile = report.scanProfile || 'data-quality';
    const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(projectPath) : null;
    let next = {
        ...report,
        ...(benchmarkScan ? {
            scanTargetProfile: 'benchmark-cache',
            handoffEligible: false,
            benchmarkScan: true,
            productPlatformRoot: productPlatformRoot || undefined
        } : {})
    };
    if (benchmarkScan) {
        next.scanScope = {
            ...(next.scanScope || {}),
            resultsViewScope: 'benchmark-clone',
            reportHealth: 'benchmark-clone-scan',
            rescanRecommended: false,
            inventoryMetricsStale: false,
            benchmarkScanTarget: true,
            limitations: [benchmarkLimitationNote(profile)]
        };
        if (next.inventory) {
            next.inventory = {
                ...next.inventory,
                inventoryScope: 'oss-clone',
                note: /stale full-tree/i.test(String(next.inventory.note || ''))
                    ? 'OSS clone inventory — large file counts are expected for google-earthenterprise-scale trees.'
                    : (next.inventory.note || 'OSS clone inventory — large file counts are expected.')
            };
        }
    }
    if (next.summary) {
        next.summary = fixEstimatedReductionPct(next.summary, next.inventory);
    }
    if (next.compact && next.findings) {
        next.findings = repairCompactAssetFindings(next);
        next.aggregation = reaggregateTopFiles(next);
    }
    if (profile === 'file-reduction' && next.fileReductionPlan && !benchmarkScan) {
        next.fileReductionPlan = sanitizeFileReductionPlanForProduct(next.fileReductionPlan);
        if (((_b = (_a = next.findings) === null || _a === void 0 ? void 0 : _a.assetConsolidation) === null || _b === void 0 ? void 0 : _b.length) && ((_d = (_c = next.fileReductionPlan.duplicateAssets) === null || _c === void 0 ? void 0 : _c.topGroups) === null || _d === void 0 ? void 0 : _d.length)) {
            next.findings = {
                ...next.findings,
                assetConsolidation: next.fileReductionPlan.duplicateAssets.topGroups.map((group) => ({
                    type: 'asset-duplicate',
                    severity: 'low',
                    action: 'consolidate-duplicates',
                    reclaimableBytes: group.reclaimableBytes,
                    ...group
                }))
            };
            next.aggregation = reaggregateTopFiles(next);
        }
    }
    if (profile === 'data-quality' && next.fileReductionPlan && !next.fileReductionPlan.omitted) {
        next.fileReductionPlan = {
            profile: 'data-quality',
            omitted: true,
            scopeNote: 'File-reduction tiers omitted from data-quality export — run file-reduction profile for artifact and duplicate analysis.'
        };
    }
    if (profile === 'file-reduction' && next.fileReductionPlan && benchmarkScan) {
        next.fileReductionPlan = {
            ...next.fileReductionPlan,
            scopeNote: 'OSS benchmark clone — file-reduction tiers are informational; safeToDelete is empty because product artifact policies do not apply.',
            recommendations: BENCHMARK_FILE_REDUCTION_RECOMMENDATIONS,
            duplicateAssets: next.fileReductionPlan.duplicateAssets
                ? {
                    ...next.fileReductionPlan.duplicateAssets,
                    topGroups: (next.fileReductionPlan.duplicateAssets.topGroups || [])
                        .map((g) => normalizeDuplicateGroupForBrief(g))
                        .filter(Boolean)
                }
                : next.fileReductionPlan.duplicateAssets
        };
    }
    if (benchmarkScan) {
        next.exportNotes = [
            ...(next.exportNotes || []),
            benchmarkExportNote(profile)
        ].filter((note, index, all) => all.indexOf(note) === index);
    }
    else {
        if (profile === 'data-quality' && ((_f = (_e = next.metadata) === null || _e === void 0 ? void 0 : _e.dataLineage) === null || _f === void 0 ? void 0 : _f.length)) {
            const { dataLineage, mirrorConsumersExcluded } = sanitizeDataLineageForExport(next.metadata.dataLineage);
            next = {
                ...next,
                metadata: {
                    ...next.metadata,
                    dataLineage,
                    ...(mirrorConsumersExcluded > 0 ? { mirrorConsumersExcluded } : {})
                }
            };
        }
        const enrichedInventory = enrichProductInventoryForExport(next.inventory, options, profile);
        const statusFields = profile === 'file-reduction'
            ? { fileReductionStatus: resolveFileReductionStatus(next) }
            : profile === 'data-quality'
                ? { dataQualityStatus: resolveDataQualityStatus(next) }
                : {};
        const notesInput = { ...next, inventory: enrichedInventory, ...statusFields };
        const exportNotes = profile === 'file-reduction'
            ? buildProductFileReductionExportNotes(notesInput, options)
            : buildProductDataQualityExportNotes(notesInput, options);
        next = {
            ...next,
            exportNormalized: true,
            exportSanitized: true,
            scanTargetProfile: 'product',
            securityHandoffEligible: false,
            handoffEligible: false,
            ...statusFields,
            exportNotes: exportNotes.length ? exportNotes : undefined,
            inventory: enrichedInventory,
            scanScope: profile === 'data-quality'
                ? enrichProductDataQualityScanScope({
                    ...(next.scanScope || {}),
                    resultsViewScope: ((_g = next.scanScope) === null || _g === void 0 ? void 0 : _g.resultsViewScope) || 'platform-only',
                    reportHealth: ((_h = next.scanScope) === null || _h === void 0 ? void 0 : _h.reportHealth) || 'platform-scoped',
                    securityHandoffEligible: false,
                    dataQualityNote: 'Data-quality export — workspace scanner hygiene only, not vendor handoff clearance.'
                }, next, options)
                : profile === 'file-reduction'
                    ? enrichProductFileReductionScanScope({
                        ...(next.scanScope || {}),
                        resultsViewScope: ((_j = next.scanScope) === null || _j === void 0 ? void 0 : _j.resultsViewScope) || 'platform-only',
                        reportHealth: ((_k = next.scanScope) === null || _k === void 0 ? void 0 : _k.reportHealth) || 'platform-scoped',
                        securityHandoffEligible: false,
                        fileReductionNote: 'File-reduction export — reclaim tiers are guidance only, not vendor handoff clearance.'
                    }, next, options)
                    : {
                        ...(next.scanScope || {}),
                        resultsViewScope: ((_l = next.scanScope) === null || _l === void 0 ? void 0 : _l.resultsViewScope) || 'platform-only',
                        reportHealth: ((_m = next.scanScope) === null || _m === void 0 ? void 0 : _m.reportHealth) || 'platform-scoped',
                        securityHandoffEligible: false
                    },
            ...(profile === 'data-quality'
                ? { hygieneSummary: buildDataQualityHygieneSummary({ ...next, inventory: enrichedInventory }, options) }
                : profile === 'file-reduction'
                    ? { hygieneSummary: buildFileReductionHygieneSummary({ ...next, inventory: enrichedInventory, ...statusFields }, options) }
                    : {})
        };
        if (profile === 'file-reduction') {
            delete next.dataQualityStatus;
        }
        else if (profile === 'data-quality') {
            delete next.fileReductionStatus;
        }
        if (profile === 'data-quality' && next.executiveSummary) {
            next.executiveSummary = {
                ...next.executiveSummary,
                exportProfile: 'data-quality',
                remediationHint: ((_p = (_o = next.summary) === null || _o === void 0 ? void 0 : _o.totalFindings) !== null && _p !== void 0 ? _p : 0) > 0
                    ? 'Address priorityActions and environmentVariables findings before platform handoff.'
                    : 'No open data-quality findings in this export.'
            };
        }
        if (profile === 'file-reduction' && next.executiveSummary) {
            next.executiveSummary = enrichProductFileReductionExecutiveSummary(next.executiveSummary, next);
        }
    }
    return redactDataCleanupExportPaths(next, projectPath);
}
