/**
 * Browser mirror of npm-audit-export-sanitize.js — keep in sync.
 */
import { redactProjectPathForExport } from './quality-export.browser.js?v=20260716cachefix1';
/**
 * Normalize rel.
 * @param {string} filePath
 * @returns {any}
 */
function normalizeRel(filePath) {
    return String(filePath || '').replace(/\\/g, '/').toLowerCase();
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
 * Is benchmark cache project path.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkCacheProjectPath(projectPath) {
    const rel = normalizeRel(projectPath);
    return rel.includes('/github-cache/') || rel.startsWith('github-cache/');
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
 * Redact npm audit export paths.
 * @param {any} audit
 * @param {string} projectPath
 * @returns {any}
 */
function redactNpmAuditExportPaths(audit, projectPath = '') {
    const raw = String(projectPath || audit.projectPath || audit.auditRoot || '').replace(/\\/g, '/');
    const label = projectLabelFromPath(raw);
    const packageJsonRaw = String(audit.packageJsonPath || '').replace(/\\/g, '/');
    return {
        projectPath: redactProjectPathForExport(raw, label),
        auditRoot: redactProjectPathForExport(audit.auditRoot || raw, label),
        packageJsonPath: packageJsonRaw && /package\.json$/i.test(packageJsonRaw)
            ? `${label}/package.json`
            : (audit.packageJsonPath
                ? redactProjectPathForExport(audit.packageJsonPath, label)
                : undefined),
        productPlatformRoot: audit.productPlatformRoot
            ? redactProjectPathForExport(audit.productPlatformRoot, projectLabelFromPath(audit.productPlatformRoot))
            : undefined
    };
}
/**
 * Resolve supply chain status.
 * @param {any} audit
 * @returns {any}
 */
function resolveSupplyChainStatus(audit) {
    var _a, _b, _c;
    if (!audit || audit.error)
        return 'error';
    if (audit.skipped)
        return 'skipped';
    const summary = audit.summary || {};
    const deps = (_c = (_a = summary.dependencies) !== null && _a !== void 0 ? _a : (_b = audit.dependencies) === null || _b === void 0 ? void 0 : _b.total) !== null && _c !== void 0 ? _c : null;
    if (deps == null)
        return 'not-applicable';
    const critical = Number(summary.critical) || 0;
    const high = Number(summary.high) || 0;
    if (critical === 0 && high === 0)
        return 'pass';
    return 'review';
}
/**
 * Resolve npm audit gate context.
 * @param {any} audit
 * @param {Object} options
 * @returns {any}
 */
function resolveNpmAuditGateContext(audit, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0, _1, _2, _3, _4, _5, _6, _7, _8, _9, _10, _11, _12, _13;
    const gateReport = options.gateReport || {};
    const hygiene = (audit === null || audit === void 0 ? void 0 : audit.hygieneSummary) || {};
    const scanScope = (audit === null || audit === void 0 ? void 0 : audit.scanScope) || {};
    const repositoryFilesTotal = (_f = (_e = (_d = (_b = (_a = options.repositoryFilesTotal) !== null && _a !== void 0 ? _a : gateReport.repositoryFilesTotal) !== null && _b !== void 0 ? _b : (_c = gateReport.repositoryInventory) === null || _c === void 0 ? void 0 : _c.totalFiles) !== null && _d !== void 0 ? _d : scanScope.gateRepositoryFilesTotal) !== null && _e !== void 0 ? _e : hygiene.gateRepositoryFilesTotal) !== null && _f !== void 0 ? _f : null;
    const credentialScanned = (_j = (_h = (_g = gateReport.credentialScanned) !== null && _g !== void 0 ? _g : gateReport.productionLeakScanned) !== null && _h !== void 0 ? _h : hygiene.contentFilesScanned) !== null && _j !== void 0 ? _j : null;
    const contentScanned = (_t = (_s = (_r = (_q = (_m = (_l = (_k = gateReport.scanScope) === null || _k === void 0 ? void 0 : _k.fullDirectoryStats) === null || _l === void 0 ? void 0 : _l.contentScanned) !== null && _m !== void 0 ? _m : (_p = (_o = gateReport.scanScope) === null || _o === void 0 ? void 0 : _o.fullDirectoryStats) === null || _p === void 0 ? void 0 : _p.filesContentScanned) !== null && _q !== void 0 ? _q : gateReport.credentialScanned) !== null && _r !== void 0 ? _r : gateReport.productionLeakScanned) !== null && _s !== void 0 ? _s : hygiene.contentFilesScanned) !== null && _t !== void 0 ? _t : null;
    const gateProfile = (_x = (_w = (_v = (_u = gateReport.scanScope) === null || _u === void 0 ? void 0 : _u.profile) !== null && _v !== void 0 ? _v : scanScope.gateRuleBundleProfile) !== null && _w !== void 0 ? _w : hygiene.gateRuleBundleProfile) !== null && _x !== void 0 ? _x : null;
    const fictionJsonFilesScanned = (_1 = (_0 = (_y = gateReport.fictionJsonFilesScanned) !== null && _y !== void 0 ? _y : (_z = gateReport.scanScope) === null || _z === void 0 ? void 0 : _z.fictionJsonFilesScanned) !== null && _0 !== void 0 ? _0 : hygiene.fictionJsonFilesScanned) !== null && _1 !== void 0 ? _1 : null;
    const fictionSampleFilesScanned = (_6 = (_5 = (_3 = (_2 = gateReport.fictionSampleFilesScanned) !== null && _2 !== void 0 ? _2 : gateReport.mockSampleFiles) !== null && _3 !== void 0 ? _3 : (_4 = gateReport.scanScope) === null || _4 === void 0 ? void 0 : _4.fictionSampleFilesScanned) !== null && _5 !== void 0 ? _5 : hygiene.fictionSampleFilesScanned) !== null && _6 !== void 0 ? _6 : null;
    const gatePass = (_9 = (_8 = (_7 = gateReport.gate) === null || _7 === void 0 ? void 0 : _7.pass) !== null && _8 !== void 0 ? _8 : hygiene.gatePass) !== null && _9 !== void 0 ? _9 : null;
    const blockingCount = (_13 = (_12 = (_11 = (_10 = gateReport.gate) === null || _10 === void 0 ? void 0 : _10.blockingCount) !== null && _11 !== void 0 ? _11 : gateReport.issueCount) !== null && _12 !== void 0 ? _12 : hygiene.blockingCount) !== null && _13 !== void 0 ? _13 : null;
    return {
        gateReport,
        repositoryFilesTotal,
        credentialScanned,
        contentScanned,
        gateProfile,
        fictionJsonFilesScanned,
        fictionSampleFilesScanned,
        gatePass,
        blockingCount
    };
}
/**
 * Build npm audit hygiene summary.
 * @param {any} audit
 * @param {string} context
 * @returns {any}
 */
function buildNpmAuditHygieneSummary(audit, context = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r;
    const gateContext = resolveNpmAuditGateContext(audit, context);
    const { repositoryFilesTotal: gateTotal, credentialScanned, contentScanned, gateProfile, gateReport, fictionJsonFilesScanned, fictionSampleFilesScanned, gatePass, blockingCount } = gateContext;
    const summary = audit.summary || {};
    const deps = (_c = (_a = summary.dependencies) !== null && _a !== void 0 ? _a : (_b = audit.dependencies) === null || _b === void 0 ? void 0 : _b.total) !== null && _c !== void 0 ? _c : null;
    return {
        dependencyTotal: deps,
        prodDependencies: (_f = (_d = summary.prodDependencies) !== null && _d !== void 0 ? _d : (_e = audit.dependencies) === null || _e === void 0 ? void 0 : _e.prod) !== null && _f !== void 0 ? _f : null,
        devDependencies: (_j = (_g = summary.devDependencies) !== null && _g !== void 0 ? _g : (_h = audit.dependencies) === null || _h === void 0 ? void 0 : _h.dev) !== null && _j !== void 0 ? _j : null,
        optionalDependencies: (_m = (_l = (_k = audit.dependencies) === null || _k === void 0 ? void 0 : _k.optional) !== null && _l !== void 0 ? _l : summary.optionalDependencies) !== null && _m !== void 0 ? _m : null,
        critical: Number(summary.critical) || 0,
        high: Number(summary.high) || 0,
        moderate: Number(summary.moderate) || 0,
        low: Number(summary.low) || 0,
        supplyChainStatus: (_o = context.supplyChainStatus) !== null && _o !== void 0 ? _o : resolveSupplyChainStatus(audit),
        auditPackageJson: (_q = (_p = context.packageJsonPath) !== null && _p !== void 0 ? _p : audit.packageJsonPath) !== null && _q !== void 0 ? _q : null,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateTotal != null && credentialScanned != null && gateTotal > credentialScanned
            ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
            : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
        ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        ...(gatePass != null ? { gatePass } : {}),
        ...(blockingCount != null ? { blockingCount } : {}),
        ...(gateReport.jestBaselineChecked === false || ((_r = audit.hygieneSummary) === null || _r === void 0 ? void 0 : _r.jestBaselineChecked) === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote: 'npm audit at product root — SUPPLY-001 hygiene only, not vendor handoff certification.'
    };
}
/**
 * Build product npm audit scan scope.
 * @param {any} audit
 * @param {Object} options
 * @returns {any}
 */
function buildProductNpmAuditScanScope(audit, options = {}) {
    var _a, _b;
    const gateContext = resolveNpmAuditGateContext(audit, options);
    const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
    return {
        ...(audit.scanScope || {}),
        resultsViewScope: 'product-root-npm-audit',
        reportHealth: ((_a = audit.scanScope) === null || _a === void 0 ? void 0 : _a.reportHealth) || 'platform-scoped',
        securityHandoffEligible: false,
        ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        supplyChainNote: ((_b = audit.scanScope) === null || _b === void 0 ? void 0 : _b.supplyChainNote)
            || 'npm audit at product root — SUPPLY-001 hygiene only, not vendor handoff clearance.'
    };
}
/**
 * Build npm audit export notes.
 * @param {any} audit
 * @param {string} context
 * @returns {any}
 */
function buildNpmAuditExportNotes(audit, context = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const { benchmarkScan, skipped, supplyChainStatus, deps, summary = {} } = context;
    const gateContext = resolveNpmAuditGateContext(audit, {
        gateReport: context.gateReport,
        repositoryFilesTotal: context.repositoryFilesTotal
    });
    const { repositoryFilesTotal: gateTotal, credentialScanned, gateProfile, gatePass, blockingCount, fictionJsonFilesScanned, fictionSampleFilesScanned } = gateContext;
    const notes = [
        'Absolute scan paths are redacted to project label in operator exports.',
        'securityHandoffEligible is false — npm audit pass is supply-chain hygiene only, not vendor security handoff.'
    ];
    if (skipped) {
        notes.push(context.scopeNote || 'npm audit was not run for this scan path.');
        return [...new Set(notes)].slice(0, 6);
    }
    if (supplyChainStatus === 'pass' && deps != null) {
        const moderate = Number(summary.moderate) || 0;
        const low = Number(summary.low) || 0;
        notes.push(`npm audit: 0 critical, 0 high across ${deps} dependencies (${Number((_c = (_a = summary.prodDependencies) !== null && _a !== void 0 ? _a : (_b = audit.dependencies) === null || _b === void 0 ? void 0 : _b.prod) !== null && _c !== void 0 ? _c : 0)} prod / ${Number((_f = (_d = summary.devDependencies) !== null && _d !== void 0 ? _d : (_e = audit.dependencies) === null || _e === void 0 ? void 0 : _e.dev) !== null && _f !== void 0 ? _f : 0)} dev).`);
        notes.push(moderate || low
            ? `${moderate} moderate and ${low} low — review SUPPLY-002 policy before handoff.`
            : 'Supply-chain gate: no critical or high npm audit findings at audit root.');
        if (!benchmarkScan && !skipped) {
            notes.push('handoffEligible reflects SUPPLY-001 automation pass — not SimpleBeacon vendor security handoff clearance.');
            notes.push('Single-root npm audit — dependency tree reflects audit-root lockfile and npm workspaces only; standalone nested package.json directories are not included.');
            if (gateTotal != null && deps != null && gateTotal !== deps) {
                notes.push(`Gate full-tree inventory is ${Number(gateTotal).toLocaleString()} repository paths — npm audit resolved ${Number(deps).toLocaleString()} lockfile package(s) at product root.`);
            }
            if (gateTotal != null && credentialScanned != null && credentialScanned < gateTotal) {
                notes.push(`Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`);
            }
            if (fictionJsonFilesScanned != null && fictionSampleFilesScanned != null) {
                notes.push(
                // simplebeacon:production-leak-intent - legitimate KPI reference for npm audit reporting
                `Gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) with ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched — npm audit covers lockfile packages only.`);
            }
            if (gateProfile) {
                notes.push(`Gate rule bundle profile: ${gateProfile} — pair npm audit with json/simplebeacon-gate.json for handoff evidence.`);
            }
            if (gatePass === false && (blockingCount !== null && blockingCount !== void 0 ? blockingCount : 0) > 0) {
                notes.push(`Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) in bundled scan — SUPPLY-001 npm audit pass does not clear production-path gate; see json/simplebeacon-gate.json.`);
            }
            const optional = (_h = (_g = audit.dependencies) === null || _g === void 0 ? void 0 : _g.optional) !== null && _h !== void 0 ? _h : summary.optionalDependencies;
            if (optional != null && optional > 0) {
                notes.push(`${Number(optional).toLocaleString()} optional dependency package(s) in audit metadata — verify before production deploy if optional peers are enabled.`);
            }
            notes.push('npm audit does not run Jest — use gate/complete scan for test attestation.');
        }
    }
    else if (supplyChainStatus === 'review') {
        notes.push(`npm audit: ${summary.critical || 0} critical, ${summary.high || 0} high — upgrade dependencies before client handoff.`);
    }
    else if (supplyChainStatus === 'error') {
        notes.push('npm audit failed or returned an error — re-run at product root before handoff.');
    }
    if (audit.scopeNote && !notes.some((n) => String(n).includes(String(audit.scopeNote)))) {
        notes.push(String(audit.scopeNote));
    }
    return [...new Set(notes)].slice(0, 14);
}
/**
 * Sanitize npm audit export.
 * @param {any} audit
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeNpmAuditExport(audit, projectPath = '', options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
    if (!audit || typeof audit !== 'object')
        return audit;
    const rawPath = String(projectPath || audit.projectPath || '').replace(/\\/g, '/');
    const paths = redactNpmAuditExportPaths(audit, rawPath);
    const benchmarkScan = isBenchmarkCacheProjectPath(rawPath) || Boolean(audit.benchmarkScan);
    const skipped = Boolean(audit.skipped);
    const supplyChainStatus = resolveSupplyChainStatus(audit);
    const summary = { ...(audit.summary || {}) };
    const deps = (_c = (_a = summary.dependencies) !== null && _a !== void 0 ? _a : (_b = audit.dependencies) === null || _b === void 0 ? void 0 : _b.total) !== null && _c !== void 0 ? _c : null;
    const next = {
        ...audit,
        type: audit.type || 'simplebeacon-npm-audit',
        source: audit.source || audit.dataSource || 'npm-audit',
        projectPath: paths.projectPath || audit.projectPath,
        exportNormalized: true,
        exportSanitized: true,
        supplyChainStatus,
        scanTargetProfile: benchmarkScan
            ? 'benchmark-cache'
            : (skipped ? 'non-npm-project' : 'product'),
        securityHandoffEligible: false,
        handoffEligible: !benchmarkScan
            && !skipped
            && supplyChainStatus === 'pass'
    };
    if (!skipped) {
        next.auditRoot = paths.auditRoot || paths.projectPath;
        if (paths.packageJsonPath) {
            next.packageJsonPath = paths.packageJsonPath;
        }
    }
    if (benchmarkScan) {
        next.benchmarkScan = true;
        next.handoffEligible = false;
        next.productPlatformRoot = paths.productPlatformRoot
            || resolveProductPlatformRoot(rawPath)
            || undefined;
        if (next.productPlatformRoot) {
            next.productPlatformRoot = redactProjectPathForExport(next.productPlatformRoot, projectLabelFromPath(next.productPlatformRoot));
        }
        if (!next.scopeNote && skipped) {
            next.scopeNote = 'OSS clone under github-cache/ has no package.json — npm audit was not run (npm would otherwise audit the parent ai-platform lockfile).';
        }
    }
    if (skipped) {
        next.success = audit.success !== false;
        next.summary = {
            info: 0,
            low: 0,
            moderate: 0,
            high: 0,
            critical: 0,
            total: 0,
            vulnerabilityTotal: 0,
            dependencies: null,
            prodDependencies: null,
            devDependencies: null,
            ...summary
        };
        next.exportNotes = buildNpmAuditExportNotes(audit, {
            benchmarkScan,
            skipped: true,
            supplyChainStatus,
            scopeNote: next.scopeNote,
            gateReport: options.gateReport,
            repositoryFilesTotal: options.repositoryFilesTotal
        });
        return next;
    }
    const noteContext = {
        benchmarkScan,
        skipped,
        supplyChainStatus,
        deps,
        summary,
        gateReport: options.gateReport,
        repositoryFilesTotal: (_d = options.repositoryFilesTotal) !== null && _d !== void 0 ? _d : (_e = options.gateReport) === null || _e === void 0 ? void 0 : _e.repositoryFilesTotal
    };
    next.exportNotes = buildNpmAuditExportNotes(audit, noteContext);
    if (supplyChainStatus === 'review') {
        next.handoffEligible = false;
    }
    if (!benchmarkScan && !skipped) {
        next.scanScope = buildProductNpmAuditScanScope(next, options);
        next.hygieneSummary = buildNpmAuditHygieneSummary(next, {
            supplyChainStatus,
            packageJsonPath: next.packageJsonPath,
            gateReport: options.gateReport,
            repositoryFilesTotal: (_f = options.repositoryFilesTotal) !== null && _f !== void 0 ? _f : (_g = options.gateReport) === null || _g === void 0 ? void 0 : _g.repositoryFilesTotal
        });
    }
    next.summary = {
        ...summary,
        total: (_j = (_h = summary.total) !== null && _h !== void 0 ? _h : summary.vulnerabilityTotal) !== null && _j !== void 0 ? _j : 0,
        vulnerabilityTotal: (_l = (_k = summary.vulnerabilityTotal) !== null && _k !== void 0 ? _k : summary.total) !== null && _l !== void 0 ? _l : 0,
        dependencies: deps
    };
    return next;
}
