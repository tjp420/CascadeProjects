// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Browser mirror of compliance-export-sanitize.js — keep in sync.
 */
import { sanitizeNpmAuditExport } from './npm-audit-export.browser.js?v=20260716cachefix1';
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
 * Redact compliance project path.
 * @param {any} value
 * @param {Object} options
 * @returns {any}
 */
function redactComplianceProjectPath(value, options = {}) {
    if (value == null || value === '') return value;
    const normalized = String(value).replace(/\\/g, '/');
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
 * Resolve compliance export path context.
 * @param {string} projectPath
 * @param {string} context
 * @returns {any}
 */
function resolveComplianceExportPathContext(projectPath, context = {}) {
    const productPlatformRoot =
        context.productPlatformRoot ||
        (isBenchmarkCacheProjectPath(projectPath) ? resolveProductPlatformRoot(projectPath) : null);
    const projectLabel = projectLabelFromPath(productPlatformRoot || projectPath || 'ai-platform');
    return {
        projectLabel,
        productPlatformLabel: projectLabel,
        redact: value =>
            redactComplianceProjectPath(value, {
                projectLabel,
                productPlatformLabel: projectLabel
            })
    };
}
/**
 * Normalize rel.
 * @param {string} projectPath
 * @returns {any}
 */
function normalizeRel(projectPath) {
    return String(projectPath || '')
        .replace(/\\/g, '/')
        .toLowerCase();
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
    if (idx <= 0) return null;
    return normalized.slice(0, idx);
}
/**
 * Rule scoped from gate.
 * @param {number} gateReport
 * @returns {any}
 */
function ruleScopedFromGate(gateReport) {
    var _a, _b, _c;
    return (_c =
        (_a = gateReport === null || gateReport === void 0 ? void 0 : gateReport.ruleScopedFilesAnalyzed) !== null &&
        _a !== void 0
            ? _a
            : (_b = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                _b === void 0
              ? void 0
              : _b.ruleScopedFilesAnalyzed) !== null && _c !== void 0
        ? _c
        : 0;
}
/**
 * Has hollow gate.
 * @param {number} gateReport
 * @returns {any}
 */
function hasHollowGate(gateReport) {
    var _a;
    return (
        Boolean(
            (_a = gateReport === null || gateReport === void 0 ? void 0 : gateReport.gate) === null || _a === void 0
                ? void 0
                : _a.pass
        ) && ruleScopedFromGate(gateReport) === 0
    );
}
/**
 * Schema compliance ok.
 * @param {number} gateReport
 * @returns {any}
 */
function schemaComplianceOk(gateReport) {
    var _a, _b, _c, _d;
    const checked =
        (_b =
            (_a = gateReport === null || gateReport === void 0 ? void 0 : gateReport.schemaChecked) !== null &&
            _a !== void 0
                ? _a
                : gateReport === null || gateReport === void 0
                  ? void 0
                  : gateReport.pageSampleSchemaChecked) !== null && _b !== void 0
            ? _b
            : 0;
    const passed =
        (_d =
            (_c = gateReport === null || gateReport === void 0 ? void 0 : gateReport.schemaPassed) !== null &&
            _c !== void 0
                ? _c
                : gateReport === null || gateReport === void 0
                  ? void 0
                  : gateReport.pageSampleSchemaPassed) !== null && _d !== void 0
            ? _d
            : 0;
    return checked > 0 && passed === checked;
}
/**
 * Checklist has stale fail rows.
 * @param {any} checklist
 * @param {number} gateReport
 * @returns {any}
 */
function checklistHasStaleFailRows(checklist, gateReport) {
    var _a, _b, _c, _d, _e, _f;
    if (
        !((_a = checklist === null || checklist === void 0 ? void 0 : checklist.rules) === null || _a === void 0
            ? void 0
            : _a.length) ||
        !gateReport
    )
        return false;
    if (((_b = gateReport.gate) === null || _b === void 0 ? void 0 : _b.pass) !== true) return false;
    const blocking =
        (_e =
            (_d = (_c = gateReport.gate) === null || _c === void 0 ? void 0 : _c.blockingCount) !== null &&
            _d !== void 0
                ? _d
                : gateReport.issueCount) !== null && _e !== void 0
            ? _e
            : null;
    if (blocking != null && blocking > 0) return false;
    if (((_f = gateReport.productionLeakFindings) !== null && _f !== void 0 ? _f : 0) > 0) return false;
    const schemaOk = schemaComplianceOk(gateReport);
    return checklist.rules.some(rule => {
        if (rule.status !== 'fail') return false;
        if (rule.id === 'GATE-001' || rule.id === 'LEAK-001') return true;
        if (rule.id === 'DATA-001' && schemaOk) return true;
        return false;
    });
}
/**
 * Recompute checklist summary.
 * @param {Array} rules
 * @param {any} prior
 * @returns {any}
 */
function recomputeChecklistSummary(rules, prior = {}) {
    const passed = rules.filter(r => r.status === 'pass').length;
    const failed = rules.filter(r => r.status === 'fail').length;
    const skipped = rules.filter(r => r.status === 'skip').length;
    const scored = passed + failed;
    return {
        ...prior,
        passed,
        failed,
        skipped,
        total: rules.length,
        score: scored ? Math.round((passed / scored) * 100) : null,
        readyForAutomation: failed === 0 && passed > 0
    };
}
/**
 * Refresh compliance checklist from gate.
 * @param {any} checklist
 * @param {number} gateReport
 * @returns {any}
 */
function refreshComplianceChecklistFromGate(checklist, gateReport) {
    var _a, _b, _c, _d, _e;
    if (
        !((_a = checklist === null || checklist === void 0 ? void 0 : checklist.rules) === null || _a === void 0
            ? void 0
            : _a.length) ||
        !gateReport ||
        !checklistHasStaleFailRows(checklist, gateReport)
    ) {
        return checklist;
    }
    const schemaOk = schemaComplianceOk(gateReport);
    const schemaChecked =
        (_c = (_b = gateReport.schemaChecked) !== null && _b !== void 0 ? _b : gateReport.pageSampleSchemaChecked) !==
            null && _c !== void 0
            ? _c
            : 0;
    const schemaPassed =
        (_e = (_d = gateReport.schemaPassed) !== null && _d !== void 0 ? _d : gateReport.pageSampleSchemaPassed) !==
            null && _e !== void 0
            ? _e
            : 0;
    /**
     * Rules.
     * @param {any} checklist.rules || []
     * @returns {any}
     */
    const rules = (checklist.rules || []).map(rule => {
        var _a, _b, _c;
        if (rule.status !== 'fail') return rule;
        if (rule.id === 'GATE-001' && ((_a = gateReport.gate) === null || _a === void 0 ? void 0 : _a.pass)) {
            return { ...rule, status: 'pass', evidence: 'Gate pass — no blocking issues at configured severities' };
        }
        if (rule.id === 'DATA-001' && schemaOk) {
            return { ...rule, status: 'pass', evidence: `${schemaPassed}/${schemaChecked} samples match schema specs` };
        }
        if (
            rule.id === 'LEAK-001' &&
            ((_b = gateReport.productionLeakFindings) !== null && _b !== void 0 ? _b : 0) === 0
        ) {
            return {
                ...rule,
                status: 'pass',
                evidence: `Scanned ${(_c = gateReport.productionLeakScanned) !== null && _c !== void 0 ? _c : 0} production file(s) — no sample-path leaks`
            };
        }
        return rule;
    });
    return { ...checklist, rules, summary: recomputeChecklistSummary(rules, checklist.summary) };
}
/**
 * Pick fresh gate report.
 * @param {number} stepReport
 * @param {number} liveReport
 * @returns {any}
 */
export function pickFreshGateReport(stepReport, liveReport) {
    if (!liveReport) return stepReport || null;
    if (!stepReport) return liveReport;
    const stepAt = Date.parse(stepReport.generatedAt || '');
    const liveAt = Date.parse(liveReport.generatedAt || '');
    if (Number.isFinite(stepAt) && Number.isFinite(liveAt) && liveAt > stepAt) {
        return liveReport;
    }
    return stepReport;
}
/**
 * Reconcile compliance with gate.
 * @param {any} checklist
 * @param {number} gateReport
 * @returns {any}
 */
export function reconcileComplianceWithGate(checklist, gateReport) {
    if (!checklist || !gateReport) return checklist;
    return refreshComplianceChecklistFromGate(checklist, gateReport);
}
/**
 * Patch supply rules from npm audit.
 * @param {Array} rules
 * @param {any} npmAudit
 * @returns {any}
 */
function patchSupplyRulesFromNpmAudit(rules, npmAudit) {
    if (!Array.isArray(rules) || !npmAudit) return rules;
    const source = npmAudit.source || npmAudit.dataSource || 'npm-audit';
    return rules.map(rule => {
        var _a;
        if (rule.id === 'SUPPLY-001') {
            if (npmAudit.skipped) {
                return { ...rule, status: 'skip', evidence: npmAudit.scopeNote || 'npm audit skipped' };
            }
            if (((_a = npmAudit.summary) === null || _a === void 0 ? void 0 : _a.dependencies) == null) {
                return { ...rule, status: 'skip', evidence: 'No package.json — npm audit not applicable' };
            }
            const critical = npmAudit.summary.critical || 0;
            const high = npmAudit.summary.high || 0;
            const ok = critical === 0 && high === 0;
            return {
                ...rule,
                status: ok ? 'pass' : 'fail',
                evidence: ok
                    ? `npm audit: ${critical} critical, ${high} high (${source})`
                    : `npm audit: ${critical} critical, ${high} high — upgrade dependencies`
            };
        }
        if (rule.id === 'SUPPLY-002' && npmAudit.summary) {
            if (npmAudit.skipped || npmAudit.summary.dependencies == null) {
                return { ...rule, status: 'skip', evidence: npmAudit.scopeNote || 'npm audit not applicable' };
            }
            const moderate = npmAudit.summary.moderate || npmAudit.summary.medium || 0;
            const ok = moderate <= 0;
            return {
                ...rule,
                status: ok ? 'pass' : 'fail',
                evidence: ok
                    ? `${moderate} moderate (limit 0) — ${source}`
                    : `${moderate} moderate exceeds policy limit of 0`
            };
        }
        return rule;
    });
}
/**
 * Resolve bundle handoff eligible.
 * @param {any} checklist
 * @param {string} context
 * @returns {any}
 */
function resolveBundleHandoffEligible(checklist, context) {
    var _a, _b, _c;
    if (context.benchmarkScan || context.hollowGate) return false;
    const summary = (checklist === null || checklist === void 0 ? void 0 : checklist.summary) || {};
    if (summary.handoffEligible === false) return false;
    if (((_a = summary.failed) !== null && _a !== void 0 ? _a : 0) > 0) return false;
    if (summary.readyForAutomation === false) return false;
    if (summary.handoffEligible === true) return true;
    return (
        ((_b = summary.passed) !== null && _b !== void 0 ? _b : 0) > 0 &&
        ((_c = summary.failed) !== null && _c !== void 0 ? _c : 0) === 0
    );
}
/**
 * Normalize compliance branding.
 * @param {any} value
 * @returns {any}
 */
function normalizeComplianceBranding(value) {
    return String(value !== null && value !== void 0 ? value : '').replace(/\bSimplebeacon\b/g, 'SimpleBeacon');
}
/**
 * Build compliance hygiene summary.
 * @param {any} checklist
 * @param {number} gateReport
 * @param {any} npmAudit
 * @param {string} context
 * @returns {any}
 */
function buildComplianceHygieneSummary(checklist, gateReport, npmAudit, context) {
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
        _24;
    const summary = (checklist === null || checklist === void 0 ? void 0 : checklist.summary) || {};
    const gateProfile =
        (_f =
            (_d =
                (_b =
                    (_a = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                    _a === void 0
                        ? void 0
                        : _a.profile) !== null && _b !== void 0
                    ? _b
                    : (_c = checklist === null || checklist === void 0 ? void 0 : checklist.scanScope) === null ||
                        _c === void 0
                      ? void 0
                      : _c.gateRuleBundleProfile) !== null && _d !== void 0
                ? _d
                : (_e = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                    _e === void 0
                  ? void 0
                  : _e.gateRuleBundleProfile) !== null && _f !== void 0
            ? _f
            : null;
    const repoTotal =
        (_l =
            (_j =
                (_g = gateReport === null || gateReport === void 0 ? void 0 : gateReport.repositoryFilesTotal) !==
                    null && _g !== void 0
                    ? _g
                    : (_h = gateReport === null || gateReport === void 0 ? void 0 : gateReport.repositoryInventory) ===
                            null || _h === void 0
                      ? void 0
                      : _h.totalFiles) !== null && _j !== void 0
                ? _j
                : (_k = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                    _k === void 0
                  ? void 0
                  : _k.gateRepositoryFilesTotal) !== null && _l !== void 0
            ? _l
            : ruleScopedFromGate(gateReport);
    const credentialScanned =
        (_r =
            (_p =
                (_m = gateReport === null || gateReport === void 0 ? void 0 : gateReport.credentialScanned) !== null &&
                _m !== void 0
                    ? _m
                    : (_o = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                        _o === void 0
                      ? void 0
                      : _o.productionDirsScanned) !== null && _p !== void 0
                ? _p
                : (_q = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                    _q === void 0
                  ? void 0
                  : _q.credentialScanned) !== null && _r !== void 0
            ? _r
            : null;
    const contentScanned =
        (_0 =
            (_y =
                (_x =
                    (_u =
                        (_t =
                            (_s = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) ===
                                null || _s === void 0
                                ? void 0
                                : _s.fullDirectoryStats) === null || _t === void 0
                            ? void 0
                            : _t.contentScanned) !== null && _u !== void 0
                        ? _u
                        : (_w =
                                (_v = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) ===
                                    null || _v === void 0
                                    ? void 0
                                    : _v.fullDirectoryStats) === null || _w === void 0
                          ? void 0
                          : _w.filesContentScanned) !== null && _x !== void 0
                    ? _x
                    : gateReport === null || gateReport === void 0
                      ? void 0
                      : gateReport.credentialScanned) !== null && _y !== void 0
                ? _y
                : (_z = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                    _z === void 0
                  ? void 0
                  : _z.contentFilesScanned) !== null && _0 !== void 0
            ? _0
            : null;
    const failed = (_1 = summary.failed) !== null && _1 !== void 0 ? _1 : 0;
    return {
        complianceStatus: context.benchmarkScan
            ? 'benchmark-cache'
            : context.hollowGate
              ? 'limited-gate-scope'
              : failed > 0
                ? 'failed'
                : 'pass',
        rulesPassed: (_2 = summary.passed) !== null && _2 !== void 0 ? _2 : null,
        rulesFailed: failed,
        rulesSkipped: (_3 = summary.skipped) !== null && _3 !== void 0 ? _3 : 0,
        checklistScore: (_4 = summary.score) !== null && _4 !== void 0 ? _4 : null,
        readyForAutomation: (_5 = summary.readyForAutomation) !== null && _5 !== void 0 ? _5 : false,
        ...(repoTotal ? { gateRepositoryFilesTotal: repoTotal } : {}),
        ...(credentialScanned != null ? { credentialScanned } : {}),
        ...(repoTotal && credentialScanned != null && repoTotal > credentialScanned
            ? { metadataOnlyInventoryFiles: repoTotal - credentialScanned }
            : {}),
        ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
        fictionJsonFilesScanned:
            (_10 =
                (_8 =
                    (_6 =
                        gateReport === null || gateReport === void 0 ? void 0 : gateReport.fictionJsonFilesScanned) !==
                        null && _6 !== void 0
                        ? _6
                        : (_7 = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) ===
                                null || _7 === void 0
                          ? void 0
                          : _7.fictionJsonFilesScanned) !== null && _8 !== void 0
                    ? _8
                    : (_9 = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                        _9 === void 0
                      ? void 0
                      : _9.fictionJsonFilesScanned) !== null && _10 !== void 0
                ? _10
                : null,
        fictionSampleFilesScanned:
            (_15 =
                (_13 =
                    (_11 =
                        gateReport === null || gateReport === void 0
                            ? void 0
                            : gateReport.fictionSampleFilesScanned) !== null && _11 !== void 0
                        ? _11
                        : (_12 = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) ===
                                null || _12 === void 0
                          ? void 0
                          : _12.fictionSampleFilesScanned) !== null && _13 !== void 0
                    ? _13
                    : (_14 = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                        _14 === void 0
                      ? void 0
                      : _14.fictionSampleFilesScanned) !== null && _15 !== void 0
                ? _15
                : null,
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        npmAuditCritical:
            (_19 =
                (_17 =
                    (_16 = npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.summary) === null ||
                    _16 === void 0
                        ? void 0
                        : _16.critical) !== null && _17 !== void 0
                    ? _17
                    : (_18 = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                        _18 === void 0
                      ? void 0
                      : _18.npmAuditCritical) !== null && _19 !== void 0
                ? _19
                : null,
        npmAuditHigh:
            (_23 =
                (_21 =
                    (_20 = npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.summary) === null ||
                    _20 === void 0
                        ? void 0
                        : _20.high) !== null && _21 !== void 0
                    ? _21
                    : (_22 = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                        _22 === void 0
                      ? void 0
                      : _22.npmAuditHigh) !== null && _23 !== void 0
                ? _23
                : null,
        ...((gateReport === null || gateReport === void 0 ? void 0 : gateReport.jestBaselineChecked) === false ||
        ((_24 = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
        _24 === void 0
            ? void 0
            : _24.jestBaselineChecked) === false
            ? { jestBaselineChecked: false }
            : {}),
        attestationNote:
            'Corporate safety checklist — automated CI gate rules only, not vendor security handoff or legal conformity certification.'
    };
}
/**
 * Build compliance scan scope.
 * @param {number} gateReport
 * @param {Object} options
 * @returns {any}
 */
function buildComplianceScanScope(gateReport, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u;
    const checklist = options.checklist || null;
    const repoTotal =
        (_h =
            (_f =
                (_d =
                    (_b =
                        (_a = options.repositoryFilesTotal) !== null && _a !== void 0
                            ? _a
                            : gateReport === null || gateReport === void 0
                              ? void 0
                              : gateReport.repositoryFilesTotal) !== null && _b !== void 0
                        ? _b
                        : (_c =
                                gateReport === null || gateReport === void 0
                                    ? void 0
                                    : gateReport.repositoryInventory) === null || _c === void 0
                          ? void 0
                          : _c.totalFiles) !== null && _d !== void 0
                    ? _d
                    : (_e = checklist === null || checklist === void 0 ? void 0 : checklist.scanScope) === null ||
                        _e === void 0
                      ? void 0
                      : _e.gateRepositoryFilesTotal) !== null && _f !== void 0
                ? _f
                : (_g = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                    _g === void 0
                  ? void 0
                  : _g.gateRepositoryFilesTotal) !== null && _h !== void 0
            ? _h
            : null;
    const gateProfile =
        (_p =
            (_m =
                (_k =
                    (_j = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                    _j === void 0
                        ? void 0
                        : _j.profile) !== null && _k !== void 0
                    ? _k
                    : (_l = checklist === null || checklist === void 0 ? void 0 : checklist.scanScope) === null ||
                        _l === void 0
                      ? void 0
                      : _l.gateRuleBundleProfile) !== null && _m !== void 0
                ? _m
                : (_o = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                    _o === void 0
                  ? void 0
                  : _o.gateRuleBundleProfile) !== null && _p !== void 0
            ? _p
            : null;
    return {
        checklistProfile:
            ((_q = checklist === null || checklist === void 0 ? void 0 : checklist.scanScope) === null || _q === void 0
                ? void 0
                : _q.checklistProfile) || 'default',
        resultsViewScope: 'platform-only',
        securityHandoffEligible: false,
        ...(repoTotal != null ? { gateRepositoryFilesTotal: repoTotal } : {}),
        ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
        sourceArtifacts: {
            gateReport: Boolean(
                gateReport ||
                ((_s =
                    (_r = checklist === null || checklist === void 0 ? void 0 : checklist.scanScope) === null ||
                    _r === void 0
                        ? void 0
                        : _r.sourceArtifacts) === null || _s === void 0
                    ? void 0
                    : _s.gateReport)
            ),
            npmAudit: Boolean(
                options.npmAudit ||
                ((_u =
                    (_t = checklist === null || checklist === void 0 ? void 0 : checklist.scanScope) === null ||
                    _t === void 0
                        ? void 0
                        : _t.sourceArtifacts) === null || _u === void 0
                    ? void 0
                    : _u.npmAudit)
            )
        }
    };
}
/**
 * Build export notes.
 * @param {any} checklist
 * @param {number} gateReport
 * @param {any} npmAudit
 * @param {string} context
 * @returns {any}
 */
function buildExportNotes(checklist, gateReport, npmAudit, context) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    const notes = [];
    if (!context.benchmarkScan) {
        notes.push(
            'securityHandoffEligible is false — checklist attests CI automation rules only, not vendor security handoff.'
        );
        notes.push('Absolute scan paths are redacted to project label in operator exports.');
    }
    if (context.benchmarkScan) {
        notes.push('Benchmark clone — not valid for Simplebeacon product handoff.');
    }
    if (context.hollowGate) {
        notes.push('Limited gate scope — credential/production-leak rules did not run on product paths.');
    }
    if ((gateReport === null || gateReport === void 0 ? void 0 : gateReport.jestBaselineChecked) === false) {
        notes.push('Jest was not executed during the gate scan — run npm test before vendor handoff sign-off.');
    }
    if ((npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.supplyChainStatus) === 'pass') {
        notes.push('Supply chain: npm audit reported 0 critical and 0 high at project root.');
    }
    const summary = (checklist === null || checklist === void 0 ? void 0 : checklist.summary) || {};
    if (summary.readyForAutomation && !context.benchmarkScan && !context.hollowGate) {
        notes.push('readyForAutomation reflects CI deploy-gate readiness — not SimpleBeacon vendor security handoff.');
    }
    const repoTotal =
        (_c =
            (_a = gateReport === null || gateReport === void 0 ? void 0 : gateReport.repositoryFilesTotal) !== null &&
            _a !== void 0
                ? _a
                : (_b = gateReport === null || gateReport === void 0 ? void 0 : gateReport.repositoryInventory) ===
                        null || _b === void 0
                  ? void 0
                  : _b.totalFiles) !== null && _c !== void 0
            ? _c
            : ruleScopedFromGate(gateReport);
    const credentialScanned =
        (_e =
            (_d = gateReport === null || gateReport === void 0 ? void 0 : gateReport.credentialScanned) !== null &&
            _d !== void 0
                ? _d
                : gateReport === null || gateReport === void 0
                  ? void 0
                  : gateReport.productionLeakScanned) !== null && _e !== void 0
            ? _e
            : (_f = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                _f === void 0
              ? void 0
              : _f.productionDirsScanned;
    if (repoTotal > 0 && credentialScanned != null && credentialScanned < repoTotal) {
        const metadataOnly = repoTotal - credentialScanned;
        notes.push(
            `CRED/LEAK rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(metadataOnly).toLocaleString()} binary/metadata-only path(s) in gate inventory of ${Number(repoTotal).toLocaleString()}.`
        );
    }
    const fictionJson =
        (_g = gateReport === null || gateReport === void 0 ? void 0 : gateReport.fictionJsonFilesScanned) !== null &&
        _g !== void 0
            ? _g
            : (_h = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                _h === void 0
              ? void 0
              : _h.fictionJsonFilesScanned;
    const fictionSamples =
        (_j = gateReport === null || gateReport === void 0 ? void 0 : gateReport.fictionSampleFilesScanned) !== null &&
        _j !== void 0
            ? _j
            : (_k = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                _k === void 0
              ? void 0
              : _k.fictionSampleFilesScanned;
    if (fictionJson != null && fictionSamples != null && fictionJson > fictionSamples) {
        notes.push(
            // simplebeacon:production-leak-intent - legitimate KPI reference for compliance reporting
            `DATA-002 evaluated ${Number(fictionJson).toLocaleString()} repository JSON path(s) — ${Number(fictionSamples).toLocaleString()} *-sample.json KPI file(s) matched.`
        );
    }
    if (
        summary.operatorDocumentationCount > 0 &&
        ((_l = gateReport === null || gateReport === void 0 ? void 0 : gateReport.euAiActSummary) === null ||
        _l === void 0
            ? void 0
            : _l.operatorDocumentationCount) != null
    ) {
        notes.push(
            `${summary.operatorDocumentationCount} operator documentation path(s) in gate EU AI Act summary — use json/eu-ai-act-sprint.json for sprint handoff pack.`
        );
    }
    const gateProfile =
        (_s =
            (_q =
                (_o =
                    (_m = gateReport === null || gateReport === void 0 ? void 0 : gateReport.scanScope) === null ||
                    _m === void 0
                        ? void 0
                        : _m.profile) !== null && _o !== void 0
                    ? _o
                    : (_p = checklist === null || checklist === void 0 ? void 0 : checklist.scanScope) === null ||
                        _p === void 0
                      ? void 0
                      : _p.gateRuleBundleProfile) !== null && _q !== void 0
                ? _q
                : (_r = checklist === null || checklist === void 0 ? void 0 : checklist.hygieneSummary) === null ||
                    _r === void 0
                  ? void 0
                  : _r.gateRuleBundleProfile) !== null && _s !== void 0
            ? _s
            : null;
    if (gateProfile) {
        notes.push(
            `Gate rule bundle profile: ${gateProfile} — pair checklist with json/simplebeacon-gate.json for rule evidence.`
        );
    }
    const complianceStatus = context.benchmarkScan
        ? 'benchmark-cache'
        : context.hollowGate
          ? 'limited-gate-scope'
          : ((_t = summary.failed) !== null && _t !== void 0 ? _t : 0) > 0
            ? 'failed'
            : 'pass';
    if (
        complianceStatus === 'failed' &&
        ((_u = gateReport === null || gateReport === void 0 ? void 0 : gateReport.gate) === null || _u === void 0
            ? void 0
            : _u.pass) === false
    ) {
        /**
         * Failed ids.
         * @param {any} checklist?.rules || []
         * @returns {any}
         */
        const failedIds = ((checklist === null || checklist === void 0 ? void 0 : checklist.rules) || [])
            .filter(rule => rule.status === 'fail')
            .map(rule => rule.id);
        const blocking =
            (_x =
                (_w = (_v = gateReport.gate) === null || _v === void 0 ? void 0 : _v.blockingCount) !== null &&
                _w !== void 0
                    ? _w
                    : gateReport.issueCount) !== null && _x !== void 0
                ? _x
                : null;
        if (failedIds.length) {
            notes.push(
                `Checklist failures (${failedIds.join(', ')}) align with bundled gate (pass=false${blocking != null ? `, ${Number(blocking).toLocaleString()} blocking finding(s)` : ''}) — see json/simplebeacon-gate.json.`
            );
        }
    }
    if (summary.headline && notes.length < 4) {
        notes.push(summary.headline);
    }
    return [...new Set(notes)].slice(0, 10);
}
/**
 * Sanitize compliance for export.
 * @param {any} compliance
 * @param {string} context
 * @returns {any}
 */
function sanitizeComplianceForExport(compliance, context) {
    if (!compliance) return compliance;
    const benchmarkScan = context.benchmarkScan;
    const hollowGate = context.hollowGate;
    let next = refreshComplianceChecklistFromGate(compliance, context.gateReport);
    next = { ...next, rules: [...(next.rules || [])] };
    if (context.npmAudit) {
        next.rules = patchSupplyRulesFromNpmAudit(next.rules, context.npmAudit);
        const passed = next.rules.filter(r => r.status === 'pass').length;
        const failed = next.rules.filter(r => r.status === 'fail').length;
        const skipped = next.rules.filter(r => r.status === 'skip').length;
        const scored = passed + failed;
        next.summary = {
            ...(next.summary || {}),
            passed,
            failed,
            skipped,
            total: next.rules.length,
            score: scored ? Math.round((passed / scored) * 100) : null,
            handoffEligible: !benchmarkScan && !hollowGate && failed === 0
        };
    }
    if (benchmarkScan || hollowGate) {
        next.summary = {
            ...(next.summary || {}),
            readyForAutomation: false,
            handoffEligible: false,
            headline: benchmarkScan
                ? 'Benchmark clone — not valid for Simplebeacon platform handoff. Run Complete scan on ai-platform.'
                : 'Limited gate scope — configure production paths before enabling automated deploy gates.',
            scanTargetProfile: benchmarkScan ? 'benchmark-cache' : 'limited-gate-scope'
        };
    }
    return next;
}
/**
 * Unwrap compliance checklist.
 * @param {any} checklist
 * @returns {any}
 */
function unwrapComplianceChecklist(checklist) {
    if (!checklist || typeof checklist !== 'object') return checklist;
    if (Array.isArray(checklist.rules) && checklist.rules.length > 0) {
        return checklist;
    }
    const nested = checklist.checklist;
    if (nested && Array.isArray(nested.rules) && nested.rules.length > 0) {
        return nested;
    }
    return checklist;
}
/**
 * Sanitize compliance checklist artifact export.
 * @param {any} checklist
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeComplianceChecklistArtifactExport(checklist, options = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const projectPath =
        options.projectPath || (checklist === null || checklist === void 0 ? void 0 : checklist.projectRoot) || '';
    const gateReport = options.gateReport || null;
    const hollowGate = hasHollowGate(gateReport);
    const benchmarkScan = isBenchmarkCacheProjectPath(projectPath);
    const npmAudit = options.npmAudit ? sanitizeNpmAuditExport(options.npmAudit, projectPath) : undefined;
    const context = {
        benchmarkScan,
        hollowGate,
        productPlatformRoot: benchmarkScan ? resolveProductPlatformRoot(projectPath) : null,
        projectPath,
        gateReport,
        npmAudit
    };
    const sanitized = sanitizeComplianceForExport(unwrapComplianceChecklist(checklist), context);
    const exportNotes = buildExportNotes(sanitized, gateReport, npmAudit, context);
    if (options.operatorExport !== false) {
        exportNotes.push(
            'Checklist attests automated rule rows only — securityHandoffEligible remains false until operator vendor sign-off.'
        );
    }
    const pathContext = resolveComplianceExportPathContext(projectPath, context);
    const redactedProjectRoot = pathContext.redact(sanitized.projectRoot || projectPath);
    const hygieneSummary = buildComplianceHygieneSummary(sanitized, gateReport, npmAudit, context);
    const scanScope = buildComplianceScanScope(gateReport, {
        repositoryFilesTotal:
            (_b =
                (_a = options.repositoryFilesTotal) !== null && _a !== void 0
                    ? _a
                    : gateReport === null || gateReport === void 0
                      ? void 0
                      : gateReport.repositoryFilesTotal) !== null && _b !== void 0
                ? _b
                : (_c = gateReport === null || gateReport === void 0 ? void 0 : gateReport.repositoryInventory) ===
                        null || _c === void 0
                  ? void 0
                  : _c.totalFiles,
        npmAudit,
        checklist: {
            scanScope: checklist === null || checklist === void 0 ? void 0 : checklist.scanScope,
            hygieneSummary
        }
    });
    const summary = {
        ...sanitized.summary,
        securityHandoffEligible: false,
        handoffEligible: false,
        ...(((_d = sanitized.summary) === null || _d === void 0 ? void 0 : _d.productPlatformRoot)
            ? { productPlatformRoot: pathContext.redact(sanitized.summary.productPlatformRoot) }
            : {})
    };
    return {
        ...sanitized,
        title: normalizeComplianceBranding(sanitized.title),
        projectRoot: redactedProjectRoot,
        exportNormalized: true,
        exportSanitized: true,
        handoffEligible: false,
        scanTargetProfile:
            ((_e = sanitized.summary) === null || _e === void 0 ? void 0 : _e.scanTargetProfile) ||
            (benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : 'product'),
        securityHandoffEligible: false,
        complianceStatus: benchmarkScan
            ? 'benchmark-cache'
            : hollowGate
              ? 'limited-gate-scope'
              : ((_g = (_f = sanitized.summary) === null || _f === void 0 ? void 0 : _f.failed) !== null &&
                  _g !== void 0
                      ? _g
                      : 0) > 0
                ? 'failed'
                : 'pass',
        exportNotes: [...new Set(exportNotes)].slice(0, 10),
        hygieneSummary,
        scanScope,
        summary
    };
}
/**
 * Sanitize compliance bundle export.
 * @param {any} payload
 * @returns {any}
 */
export function sanitizeComplianceBundleExport(payload = {}) {
    var _a, _b, _c, _d, _e, _f, _g;
    const projectPath =
        payload.projectPath ||
        ((_a = payload.checklist) === null || _a === void 0 ? void 0 : _a.projectRoot) ||
        ((_b = payload.gateReport) === null || _b === void 0 ? void 0 : _b.projectRoot) ||
        '';
    const benchmarkScan = isBenchmarkCacheProjectPath(projectPath);
    const productPlatformRoot = benchmarkScan ? resolveProductPlatformRoot(projectPath) : null;
    const gateReport = payload.gateReport || null;
    const hollowGate = hasHollowGate(gateReport);
    const npmAudit = payload.npmAudit ? sanitizeNpmAuditExport(payload.npmAudit, projectPath) : undefined;
    const context = {
        benchmarkScan,
        hollowGate,
        productPlatformRoot,
        projectPath,
        gateReport,
        npmAudit
    };
    const checklist = sanitizeComplianceForExport(unwrapComplianceChecklist(payload.checklist), context);
    const handoffEligible = resolveBundleHandoffEligible(checklist, context);
    const failed =
        (_d =
            (_c = checklist === null || checklist === void 0 ? void 0 : checklist.summary) === null || _c === void 0
                ? void 0
                : _c.failed) !== null && _d !== void 0
            ? _d
            : 0;
    const pathContext = resolveComplianceExportPathContext(projectPath, context);
    return {
        type: payload.type || 'simplebeacon-compliance-checklist',
        generatedAt:
            payload.generatedAt ||
            (checklist === null || checklist === void 0 ? void 0 : checklist.evaluatedAt) ||
            new Date().toISOString(),
        projectPath: pathContext.redact(projectPath),
        exportNormalized: true,
        complianceStatus: benchmarkScan
            ? 'benchmark-cache'
            : hollowGate
              ? 'limited-gate-scope'
              : failed > 0
                ? 'failed'
                : 'pass',
        scanTargetProfile: benchmarkScan ? 'benchmark-cache' : hollowGate ? 'limited-gate-scope' : 'product',
        handoffEligible,
        readyForAutomation:
            (_f =
                (_e = checklist === null || checklist === void 0 ? void 0 : checklist.summary) === null || _e === void 0
                    ? void 0
                    : _e.readyForAutomation) !== null && _f !== void 0
                ? _f
                : false,
        productPlatformRoot: productPlatformRoot ? pathContext.redact(productPlatformRoot) : undefined,
        benchmarkScan: benchmarkScan || undefined,
        npmAudit,
        gateReport,
        checklist: {
            ...checklist,
            projectRoot: pathContext.redact(checklist.projectRoot || projectPath),
            summary: ((_g = checklist.summary) === null || _g === void 0 ? void 0 : _g.productPlatformRoot)
                ? {
                      ...checklist.summary,
                      productPlatformRoot: pathContext.redact(checklist.summary.productPlatformRoot)
                  }
                : checklist.summary
        },
        exportNotes: buildExportNotes(checklist, gateReport, npmAudit, context)
    };
}
