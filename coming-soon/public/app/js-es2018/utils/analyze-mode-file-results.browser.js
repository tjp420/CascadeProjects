/**
 * Per-file (or per-target) pass/fail rows for Analyze mode pills — from lastResult / report payloads.
 */
import { escapeHtml, formatNumber } from '../utils.js';
const MAX_ROWS = 200;
/**
 * Normalize rel path.
 * @param {any} value
 * @returns {any}
 */
function normalizeRelPath(value) {
    return String(value || '').replace(/\\/g, '/').replace(/^\.\//, '');
}
/**
 * Is excluded analyze path.
 * @param {any} value
 * @returns {any}
 */
function isExcludedAnalyzePath(value) {
    const rel = normalizeRelPath(value);
    return rel.startsWith('.github-sync/') || rel.includes('/.github-sync/');
}
/**
 * Is intentional consolidation candidate.
 * @param {any} item
 * @returns {any}
 */
function isIntentionalConsolidationCandidate(item) {
    /**
     * Paths.
     * @param {string} item?.files || []
     * @returns {any}
     */
    const paths = ((item === null || item === void 0 ? void 0 : item.files) || []).map((file) => normalizeRelPath(typeof file === 'string' ? file : (file.path || file.relativePath || file.name))).filter(Boolean);
    if (paths.some(isExcludedAnalyzePath))
        return true;
    if (paths.length !== 2)
        return false;
    const [a, b] = paths;
    const browserRe = /\.browser\.(js|mjs|cjs|ts|tsx)$/i;
    /**
     * To source.
     * @param {any} p
     * @returns {any}
     */
    const toSource = (p) => p.replace(/\.browser\.(js|mjs|cjs|ts|tsx)$/i, '.$1');
    if ((browserRe.test(a) || browserRe.test(b)) && (toSource(a) === b || toSource(b) === a))
        return true;
    /**
     * Is mcp config.
     * @param {any} p
     * @returns {any}
     */
    const isMcpConfig = (p) => p.endsWith('mcp.json') || /\/examples\/mcp\//.test(p);
    return isMcpConfig(a) && isMcpConfig(b);
}
/**
 * Issue paths.
 * @param {boolean} issue
 * @returns {any}
 */
function issuePaths(issue) {
    const paths = [
        issue === null || issue === void 0 ? void 0 : issue.filePath,
        issue === null || issue === void 0 ? void 0 : issue.file,
        issue === null || issue === void 0 ? void 0 : issue.path,
        ...((issue === null || issue === void 0 ? void 0 : issue.filePaths) || []),
        ...((issue === null || issue === void 0 ? void 0 : issue.affectedFiles) || [])
    ].filter(Boolean).map(normalizeRelPath);
    return [...new Set(paths)];
}
/**
 * Severity to status.
 * @param {any} severity
 * @returns {any}
 */
function severityToStatus(severity) {
    const s = String(severity || '').toLowerCase();
    if (s === 'critical' || s === 'high')
        return 'fail';
    if (s === 'medium' || s === 'low')
        return 'warn';
    return 'warn';
}
/**
 * Upsert row.
 * @param {any} map
 * @param {string} path
 * @param {any} row
 * @returns {any}
 */
function upsertRow(map, path, row) {
    const key = normalizeRelPath(path);
    if (!key)
        return;
    const existing = map.get(key);
    if (!existing) {
        map.set(key, row);
        return;
    }
    if (existing.status === 'fail')
        return;
    if (row.status === 'fail') {
        map.set(key, row);
        return;
    }
    if (existing.status === 'warn' && row.status === 'pass')
        return;
    map.set(key, { ...existing, ...row, detail: [existing.detail, row.detail].filter(Boolean).join(' · ') });
}
/**
 * Rows from issues.
 * @param {Array} issues
 * @param {any} ruleLabel
 * @returns {any}
 */
function rowsFromIssues(issues = [], ruleLabel = 'gate') {
    const map = new Map();
    for (const issue of issues) {
        for (const path of issuePaths(issue)) {
            if (isExcludedAnalyzePath(path))
                continue;
            upsertRow(map, path, {
                path,
                status: severityToStatus(issue.severity || issue.severityBand),
                rule: issue.type || ruleLabel,
                detail: issue.description || issue.recommendedAction || ''
            });
        }
    }
    return [...map.values()];
}
/**
 * Rows from gate report.
 * @param {number} report
 * @returns {any}
 */
function rowsFromGateReport(report) {
    var _a;
    if (!report)
        return [];
    const issues = report.rawIssues || report.detectedIssues || [];
    const rows = rowsFromIssues(issues, 'simplebeacon-gate');
    const docs = ((_a = report.euAiActSummary) === null || _a === void 0 ? void 0 : _a.documentationFound) || [];
    for (const path of docs) {
        upsertRow(rows.reduce((m, r) => { m.set(r.path, r); return m; }, new Map()), path, {
            path: normalizeRelPath(path),
            status: 'pass',
            rule: 'EUAI-003',
            detail: 'Documentation artifact detected'
        });
    }
    return [...rows, ...docs.map((p) => ({
            path: normalizeRelPath(p),
            status: 'pass',
            rule: 'EUAI-003',
            detail: 'Documentation artifact detected'
        }))].reduce((acc, row) => {
        upsertRow(acc, row.path, row);
        return acc;
    }, new Map()).values ? [...new Map([...rowsFromIssues([], ''), ...docs.map((p) => [normalizeRelPath(p), {
                    path: normalizeRelPath(p),
                    status: 'pass',
                    rule: 'EUAI-003',
                    detail: 'Documentation artifact detected'
                }])]).values()] : rows;
}
/**
 * Rows from gate report fixed.
 * @param {number} report
 * @returns {any}
 */
function rowsFromGateReportFixed(report) {
    var _a, _b, _c, _d, _e;
    if (!report)
        return { rows: [], summary: null };
    const map = new Map();
    const issues = report.rawIssues || report.detectedIssues || [];
    for (const issue of issues) {
        for (const path of issuePaths(issue)) {
            upsertRow(map, path, {
                path,
                status: severityToStatus(issue.severity || issue.severityBand),
                rule: issue.type || 'gate',
                detail: issue.description || ''
            });
        }
    }
    for (const path of ((_a = report.euAiActSummary) === null || _a === void 0 ? void 0 : _a.documentationFound) || []) {
        upsertRow(map, path, {
            path: normalizeRelPath(path),
            status: 'pass',
            rule: 'EUAI-003',
            detail: 'Documentation artifact detected'
        });
    }
    const failN = [...map.values()].filter((r) => r.status === 'fail').length;
    const warnN = [...map.values()].filter((r) => r.status === 'warn').length;
    const scoped = (_b = report.ruleScopedFilesAnalyzed) !== null && _b !== void 0 ? _b : (_c = report.scanScope) === null || _c === void 0 ? void 0 : _c.ruleScopedFilesAnalyzed;
    const passImplicit = scoped != null
        ? Math.max(0, scoped - failN - warnN)
        : null;
    return {
        rows: [...map.values()],
        summary: {
            scoped,
            passImplicit,
            repositoryFiles: (_d = report.repositoryFilesTotal) !== null && _d !== void 0 ? _d : (_e = report.scanScope) === null || _e === void 0 ? void 0 : _e.repositoryFilesTotal
        }
    };
}
/**
 * Rows from findings.
 * @param {Array} findings
 * @param {any} rulePrefix
 * @returns {any}
 */
function rowsFromFindings(findings = [], rulePrefix = 'finding') {
    const map = new Map();
    for (const finding of findings) {
        const path = finding.path || finding.filePath || finding.file || finding.id;
        if (!path || String(path).includes(' ') || isExcludedAnalyzePath(path))
            continue;
        upsertRow(map, path, {
            path: normalizeRelPath(path),
            status: severityToStatus(finding.severity),
            rule: finding.scanner || finding.category || finding.type || rulePrefix,
            detail: finding.message || finding.reason || finding.recommendation || ''
        });
    }
    return [...map.values()];
}
/**
 * Rows from consolidation.
 * @param {any} scan
 * @returns {any}
 */
function rowsFromConsolidation(scan) {
    const map = new Map();
    for (const item of (scan === null || scan === void 0 ? void 0 : scan.mergeCandidates) || []) {
        if (isIntentionalConsolidationCandidate(item))
            continue;
        for (const file of item.files || []) {
            const path = file.path || file;
            upsertRow(map, path, {
                path: normalizeRelPath(path),
                status: 'warn',
                rule: 'merge-candidate',
                detail: item.mergeType || 'Similar JSON — review merge'
            });
        }
    }
    for (const item of (scan === null || scan === void 0 ? void 0 : scan.reductionOpportunities) || []) {
        const path = item.path || item.file;
        if (!path)
            continue;
        upsertRow(map, path, {
            path: normalizeRelPath(path),
            status: 'warn',
            rule: 'reduction',
            detail: item.reason || 'Reduction opportunity'
        });
    }
    for (const group of (scan === null || scan === void 0 ? void 0 : scan.exactDuplicateGroups) || []) {
        for (const path of group.paths || group.files || []) {
            upsertRow(map, path, {
                path: normalizeRelPath(typeof path === 'string' ? path : path.path),
                status: 'warn',
                rule: 'duplicate-json',
                detail: 'Exact duplicate content group'
            });
        }
    }
    return [...map.values()];
}
/**
 * Rows from npm audit.
 * @param {any} npmAudit
 * @returns {any}
 */
function rowsFromNpmAudit(npmAudit) {
    var _a, _b;
    const map = new Map();
    const vulns = (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.vulnerabilities) || (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.advisories) || [];
    const list = Array.isArray(vulns) ? vulns : Object.values(vulns || {});
    for (const vuln of list) {
        const name = vuln.name || vuln.module || vuln.packageName;
        if (!name)
            continue;
        upsertRow(map, name, {
            path: name,
            status: ['critical', 'high'].includes(String(vuln.severity).toLowerCase()) ? 'fail' : 'warn',
            rule: 'npm-audit',
            detail: vuln.title || vuln.recommendation || vuln.severity || 'Vulnerability'
        });
    }
    if (!map.size && (npmAudit === null || npmAudit === void 0 ? void 0 : npmAudit.summary)) {
        return [{
                path: 'package.json',
                status: 'pass',
                rule: 'npm-audit',
                detail: `${(_a = npmAudit.summary.total) !== null && _a !== void 0 ? _a : 0} vulnerabilities · ${(_b = npmAudit.summary.dependencies) !== null && _b !== void 0 ? _b : '—'} dependencies`
            }];
    }
    return [...map.values()];
}
/**
 * Rows from compliance.
 * @param {any} checklist
 * @returns {any}
 */
function rowsFromCompliance(checklist) {
    return ((checklist === null || checklist === void 0 ? void 0 : checklist.rules) || []).map((rule) => ({
        path: rule.id,
        status: rule.status === 'pass' ? 'pass' : rule.status === 'fail' ? 'fail' : 'skip',
        rule: rule.id,
        detail: rule.evidence || rule.title || ''
    }));
}
/**
 * Rows from cleanup brief.
 * @param {any} brief
 * @returns {any}
 */
function rowsFromCleanupBrief(brief) {
    var _a, _b, _c;
    const map = new Map();
    const tiers = (brief === null || brief === void 0 ? void 0 : brief.tiers) || {};
    for (const entry of ((_a = tiers.safeNow) === null || _a === void 0 ? void 0 : _a.directories) || []) {
        upsertRow(map, entry.path, {
            path: normalizeRelPath(entry.path),
            status: 'pass',
            rule: 'cleanup-safe',
            detail: `Safe to delete · ${formatNumber(entry.files)} file(s)`
        });
    }
    for (const entry of ((_b = tiers.reviewFirst) === null || _b === void 0 ? void 0 : _b.items) || []) {
        upsertRow(map, entry.path, {
            path: normalizeRelPath(entry.path),
            status: 'warn',
            rule: 'cleanup-review',
            detail: entry.reason || 'Review before delete'
        });
    }
    for (const entry of ((_c = tiers.protected) === null || _c === void 0 ? void 0 : _c.directories) || []) {
        upsertRow(map, entry.path, {
            path: normalizeRelPath(entry.path),
            status: 'pass',
            rule: 'cleanup-protected',
            detail: 'Protected path — do not delete'
        });
    }
    return [...map.values()];
}
/**
 * Step payload.
 * @param {string} lastResult
 * @param {string} stepId
 * @returns {any}
 */
function stepPayload(lastResult, stepId) {
    var _a, _b;
    if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete') {
        return (_b = (_a = lastResult.steps) === null || _a === void 0 ? void 0 : _a.find((step) => step.id === stepId)) !== null && _b !== void 0 ? _b : null;
    }
    return null;
}
/**
 * Resolve payload.
 * @param {any} mode
 * @param {string} lastResult
 * @param {number} report
 * @returns {any}
 */
function resolvePayload(mode, lastResult, report) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
    switch (mode) {
        case 'simplebeacon':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'simplebeacon-report')
                return { kind: 'gate', report: lastResult.report };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'gate', report: (_a = stepPayload(lastResult, 'simplebeacon')) === null || _a === void 0 ? void 0 : _a.report };
            if ((report === null || report === void 0 ? void 0 : report.type) === 'simplebeacon-report')
                return { kind: 'gate', report };
            return null;
        case 'eu-ai-act':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'eu-ai-act')
                return { kind: 'gate', report: (_b = lastResult.sprint) === null || _b === void 0 ? void 0 : _b.report };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'gate', report: (_c = stepPayload(lastResult, 'simplebeacon')) === null || _c === void 0 ? void 0 : _c.report };
            return null;
        case 'mock-scan':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete') {
                const step = stepPayload(lastResult, 'mock-scan');
                return { kind: 'fiction', report: step === null || step === void 0 ? void 0 : step.report, issues: step === null || step === void 0 ? void 0 : step.fictionIssues };
            }
            if (lastResult === null || lastResult === void 0 ? void 0 : lastResult.report)
                return { kind: 'fiction', report: lastResult.report, issues: lastResult.fictionIssues };
            return report ? { kind: 'fiction', report, issues: null } : null;
        case 'consolidation':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'consolidation')
                return { kind: 'consolidation', scan: lastResult.scan };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'consolidation', scan: (_d = stepPayload(lastResult, 'consolidation')) === null || _d === void 0 ? void 0 : _d.scan };
            return null;
        case 'codebase':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'codebase')
                return { kind: 'codebase', scan: lastResult.scan };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'codebase', scan: (_e = stepPayload(lastResult, 'codebase')) === null || _e === void 0 ? void 0 : _e.scan };
            return null;
        case 'file-reduction':
        case 'data-quality':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === mode)
                return { kind: 'cleanup', scan: lastResult.scan };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'cleanup', scan: (_f = stepPayload(lastResult, mode)) === null || _f === void 0 ? void 0 : _f.scan };
            return null;
        case 'cleanup-assistant':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'cleanup-assistant')
                return { kind: 'cleanup-brief', brief: lastResult.brief };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'cleanup-brief', brief: (_g = stepPayload(lastResult, 'cleanup-assistant')) === null || _g === void 0 ? void 0 : _g.brief };
            return null;
        case 'compliance':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'compliance')
                return { kind: 'compliance', checklist: lastResult.checklist };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'compliance', checklist: (_h = stepPayload(lastResult, 'compliance')) === null || _h === void 0 ? void 0 : _h.checklist };
            return null;
        case 'npm-audit':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'npm-audit')
                return { kind: 'npm', npmAudit: lastResult.npmAudit };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'npm', npmAudit: (_j = stepPayload(lastResult, 'npm-audit')) === null || _j === void 0 ? void 0 : _j.npmAudit };
            return null;
        case 'roadmap':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'roadmap')
                return { kind: 'roadmap', data: lastResult.data || lastResult };
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'roadmap', data: (_k = stepPayload(lastResult, 'roadmap')) === null || _k === void 0 ? void 0 : _k.data };
            return null;
        case 'complete':
            if ((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'complete')
                return { kind: 'complete', steps: lastResult.steps };
            return null;
        case 'auto':
            return resolvePayload((lastResult === null || lastResult === void 0 ? void 0 : lastResult.kind) === 'roadmap' ? 'roadmap' : 'simplebeacon', lastResult, report);
        default:
            return null;
    }
}
/**
 * Build rows.
 * @param {any} mode
 * @param {any} payload
 * @returns {any}
 */
function buildRows(mode, payload) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x;
    if (!payload)
        return { rows: [], summary: null, note: null };
    if (payload.kind === 'gate') {
        const { rows, summary } = rowsFromGateReportFixed(payload.report);
        return { rows, summary, note: null };
    }
    if (payload.kind === 'fiction') {
        const issues = payload.issues || (payload.report ? (payload.report.rawIssues || payload.report.detectedIssues || []) : []);
        const fictionOnly = issues.filter((i) => /fiction|fictional|consistency|kpi/i.test(String(i.type || '')));
        return {
            rows: rowsFromIssues(fictionOnly.length ? fictionOnly : issues, 'fiction'),
            summary: {
                scoped: (_b = (_a = payload.report) === null || _a === void 0 ? void 0 : _a.fictionJsonFilesScanned) !== null && _b !== void 0 ? _b : (_d = (_c = payload.report) === null || _c === void 0 ? void 0 : _c.scanScope) === null || _d === void 0 ? void 0 : _d.fictionJsonFilesScanned
            },
            note: null
        };
    }
    if (payload.kind === 'consolidation') {
        return {
            rows: rowsFromConsolidation(payload.scan),
            summary: {
                scoped: (_g = (_f = (_e = payload.scan) === null || _e === void 0 ? void 0 : _e.summary) === null || _f === void 0 ? void 0 : _f.jsonFilesAnalyzed) !== null && _g !== void 0 ? _g : (_j = (_h = payload.scan) === null || _h === void 0 ? void 0 : _h.summary) === null || _j === void 0 ? void 0 : _j.sampleDataFilesAnalyzed
            },
            note: null
        };
    }
    if (payload.kind === 'codebase') {
        return {
            rows: rowsFromFindings(((_k = payload.scan) === null || _k === void 0 ? void 0 : _k.findings) || [], 'codebase'),
            summary: { scoped: (_o = (_m = (_l = payload.scan) === null || _l === void 0 ? void 0 : _l.summary) === null || _m === void 0 ? void 0 : _m.filesScanned) !== null && _o !== void 0 ? _o : (_q = (_p = payload.scan) === null || _p === void 0 ? void 0 : _p.summary) === null || _q === void 0 ? void 0 : _q.codeFilesAnalyzed },
            note: null
        };
    }
    if (payload.kind === 'cleanup') {
        const scan = payload.scan;
        const top = (scan === null || scan === void 0 ? void 0 : scan.topFindings) || [];
        const scannerFindings = [];
        for (const [scannerId, block] of Object.entries((scan === null || scan === void 0 ? void 0 : scan.scanners) || {})) {
            const items = ((_r = block === null || block === void 0 ? void 0 : block.findings) === null || _r === void 0 ? void 0 : _r.items) || (block === null || block === void 0 ? void 0 : block.findings) || [];
            if (Array.isArray(items)) {
                for (const item of items)
                    scannerFindings.push({ ...item, scanner: scannerId });
            }
        }
        return {
            rows: rowsFromFindings([...top, ...scannerFindings], (scan === null || scan === void 0 ? void 0 : scan.scanProfile) || 'cleanup'),
            summary: { scoped: (_t = (_s = scan === null || scan === void 0 ? void 0 : scan.inventory) === null || _s === void 0 ? void 0 : _s.totalFiles) !== null && _t !== void 0 ? _t : (_u = scan === null || scan === void 0 ? void 0 : scan.summary) === null || _u === void 0 ? void 0 : _u.filesScanned },
            note: null
        };
    }
    if (payload.kind === 'cleanup-brief') {
        return { rows: rowsFromCleanupBrief(payload.brief), summary: null, note: null };
    }
    if (payload.kind === 'compliance') {
        return {
            rows: rowsFromCompliance(payload.checklist),
            summary: null,
            note: 'Compliance mode evaluates checklist rules — rows are rules, not individual source files.'
        };
    }
    if (payload.kind === 'npm') {
        return { rows: rowsFromNpmAudit(payload.npmAudit), summary: null, note: 'npm audit rows are packages, not source files.' };
    }
    if (payload.kind === 'roadmap') {
        const phases = ((_w = (_v = payload.data) === null || _v === void 0 ? void 0 : _v.roadmap) === null || _w === void 0 ? void 0 : _w.phases) || ((_x = payload.data) === null || _x === void 0 ? void 0 : _x.phases) || [];
        return {
            rows: phases.slice(0, 20).map((phase, index) => ({
                path: phase.id || phase.name || `phase-${index + 1}`,
                status: 'pass',
                rule: 'roadmap',
                detail: phase.name || phase.title || 'Sprint phase'
            })),
            summary: null,
            note: 'Roadmap mode summarizes sprint phases — not a per-source-file gate.'
        };
    }
    if (payload.kind === 'complete' && payload.steps) {
        const map = new Map();
        for (const step of payload.steps) {
            const subMode = step.id === 'mock-scan' ? 'mock-scan' : step.id;
            const fakeLast = { kind: 'complete', steps: payload.steps, ...step };
            let subPayload = resolvePayload(subMode, fakeLast, null);
            if (subMode === 'simplebeacon')
                subPayload = { kind: 'gate', report: step.report };
            if (subMode === 'mock-scan')
                subPayload = { kind: 'fiction', report: step.report, issues: step.fictionIssues };
            if (subMode === 'consolidation')
                subPayload = { kind: 'consolidation', scan: step.scan };
            if (subMode === 'codebase')
                subPayload = { kind: 'codebase', scan: step.scan };
            if (subMode === 'file-reduction' || subMode === 'data-quality')
                subPayload = { kind: 'cleanup', scan: step.scan };
            if (subMode === 'cleanup-assistant')
                subPayload = { kind: 'cleanup-brief', brief: step.brief };
            if (subMode === 'compliance')
                subPayload = { kind: 'compliance', checklist: step.checklist };
            if (subMode === 'npm-audit')
                subPayload = { kind: 'npm', npmAudit: step.npmAudit };
            if (subMode === 'roadmap')
                subPayload = { kind: 'roadmap', data: step.data };
            const built = buildRows(subMode, subPayload);
            for (const row of built.rows) {
                const detail = String(row.detail || '');
                const path = String(row.path || '');
                const isDotfileNoise = /^\.[a-z]/i.test(path) && detail === '—';
                const isStaleMerge = subMode === 'consolidation' && path.includes('roadmap.html');
                if (isDotfileNoise || isStaleMerge)
                    continue;
                upsertRow(map, `${step.id}:${row.path}`, { ...row, path: row.path, rule: `${step.id} · ${row.rule}` });
            }
        }
        return { rows: [...map.values()], summary: null, note: 'Complete bundle — combined rows from all ten steps.' };
    }
    return { rows: [], summary: null, note: null };
}
/**
 * Status badge.
 * @param {Array} status
 * @returns {any}
 */
function statusBadge(status) {
    if (status === 'pass')
        return '<span class="gate-badge pass">PASS</span>';
    if (status === 'fail')
        return '<span class="gate-badge warn">FAIL</span>';
    if (status === 'warn')
        return '<span class="gate-badge" style="border-color:#f59e0b;color:#fbbf24">WARN</span>';
    if (status === 'skip')
        return '<span class="gate-badge">SKIP</span>';
    return '<span class="gate-badge">—</span>';
}
/**
 * Sort rows.
 * @param {Array} rows
 * @returns {any}
 */
function sortRows(rows) {
    const order = { fail: 0, warn: 1, skip: 2, pass: 3 };
    return [...rows].sort((a, b) => { var _a, _b; return ((_a = order[a.status]) !== null && _a !== void 0 ? _a : 9) - ((_b = order[b.status]) !== null && _b !== void 0 ? _b : 9) || a.path.localeCompare(b.path); });
}
/**
 * @param {string} modeValue
 * @param {{ lastResult?: object, report?: object }} context
 */
/**
 * Render mode file results panel.
 * @param {any} modeValue
 * @param {string} context
 * @returns {any}
 */
export function renderModeFileResultsPanel(modeValue, context = {}) {
    const payload = resolvePayload(modeValue, context.lastResult, context.report);
    const { rows, summary, note } = buildRows(modeValue, payload);
    if (!payload) {
        return `
      <div class="analyze-mode-file-results">
        <h3 class="analyze-mode-scope-title">Per-file / per-target results</h3>
        <p class="text-muted analyze-mode-scope-intro" style="margin:0;">
          Run <strong>${escapeHtml(modeValue)}</strong> analysis to populate pass/fail rows for files, packages, or checklist rules.
        </p>
      </div>
    `;
    }
    const nodeModulesRows = rows.filter((r) => String(r.path).includes('node_modules'));
    const visibleRows = rows.filter((r) => !String(r.path).includes('node_modules'));
    const sorted = sortRows(visibleRows);
    const passN = sorted.filter((r) => r.status === 'pass').length;
    const failN = sorted.filter((r) => r.status === 'fail').length;
    const warnN = sorted.filter((r) => r.status === 'warn').length;
    const shown = sorted.slice(0, MAX_ROWS);
    const hidden = sorted.length - shown.length;
    const implicitNote = (summary === null || summary === void 0 ? void 0 : summary.passImplicit) > 0
        ? `${formatNumber(summary.passImplicit)} additional gate-scoped file(s) passed with no listed findings.`
        : '';
    const scopedNote = (summary === null || summary === void 0 ? void 0 : summary.scoped) != null
        ? `${formatNumber(summary.scoped)} file(s) in scan scope · ${formatNumber(summary.repositoryFiles)} repo inventory.`
        : '';
    return `
    <div class="analyze-mode-file-results" data-mode-file-results="${escapeHtml(modeValue)}">
      <h3 class="analyze-mode-scope-title">Per-file / per-target results</h3>
      <p class="text-muted analyze-mode-scope-intro">
        ${formatNumber(sorted.length)} listed · ${passN} pass · ${failN} fail · ${warnN} warn
        ${nodeModulesRows.length > 0 ? ` · ${formatNumber(nodeModulesRows.length)} node_modules hidden` : ''}
        ${scopedNote ? ` · ${escapeHtml(scopedNote)}` : ''}
      </p>
      ${note ? `<p class="text-muted" style="font-size:var(--font-size-xs);margin:0 0 0.5rem;">${escapeHtml(note)}</p>` : ''}
      ${implicitNote ? `<p class="text-muted" style="font-size:var(--font-size-xs);margin:0 0 0.5rem;">${escapeHtml(implicitNote)}</p>` : ''}
      ${!shown.length ? `
        <p class="text-muted card" style="font-size:var(--font-size-sm);margin:0;">
          No file-level failures listed — scan completed with no targeted findings in the export payload.
          ${(summary === null || summary === void 0 ? void 0 : summary.passImplicit) ? ` ${escapeHtml(implicitNote)}` : ''}
        </p>
      ` : `
        <div class="table-scroll analyze-mode-file-results-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>File / target</th>
                <th>Status</th>
                <th>Rule</th>
                <th>Detail</th>
              </tr>
            </thead>
            <tbody>
              ${shown.map((row) => `
                <tr>
                  <td><code>${escapeHtml(row.path)}</code></td>
                  <td>${statusBadge(row.status)}</td>
                  <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(String(row.rule || '—'))}</td>
                  <td class="text-muted" style="font-size:var(--font-size-xs);">${escapeHtml(String(row.detail || '—'))}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
        ${hidden > 0 ? `<p class="text-muted" style="font-size:var(--font-size-xs);margin:0.5rem 0 0;">+ ${formatNumber(hidden)} more row(s) not shown.</p>` : ''}
      `}
    </div>
  `;
}
