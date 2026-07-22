import { fetchWithTimeout, downloadJson, downloadText, resolveDashboardProjectPath } from '../utils.js';
import { billingService } from './billingService.js';
import { authService } from './authService.js?v=20260721cspapi';
import { isDemoMode, DEMO_API_BASE, isLocalDevHost } from '../demoMode.js';
import { readJsonResponseBody } from '../lib/recoverable-fetch.js';
import { buildDashboardExportBundle } from '../utils/dashboard-export.browser.js?v=20260716cachefix1';
import { isLocalPath, fetchScanProgressViaAgent, fetchScanProgressViaExtensionBridge, hasExtensionBridgeConfigured, probeAgent, shouldProbeLocalAgent } from './localAgentService.js?v=20260716cachefix1';
import { apiBaseUrl } from '../utils-lib/url.js';
/**
 * Upgrade a v1 ("version": "1.0.0" and no reportVersion) scan report so the
 * dashboard treats it as current and can render aligned file-count metrics.
 * @param {Object} rawReport
 * @returns {Object}
 */
function normalizeScanReport(rawReport) {
    if (!rawReport || typeof rawReport !== 'object') {
        return rawReport;
    }
    if (rawReport.reportVersion && Number(rawReport.reportVersion) >= 2) {
        return rawReport;
    }
    if (rawReport.version !== '1.0.0' && rawReport.reportVersion == null) {
        return rawReport;
    }
    const summary = rawReport.summary || {};
    const repositoryInventory = rawReport.repositoryInventory || null;
    const repositoryFilesTotal = rawReport.repositoryFilesTotal
        ?? repositoryInventory?.totalFiles
        ?? summary.repositoryFilesTotal
        ?? null;
    const repositoryFoldersTotal = rawReport.repositoryFoldersTotal
        ?? repositoryInventory?.totalFolders
        ?? summary.repositoryFoldersTotal
        ?? null;
    const ruleScopedFilesAnalyzed = rawReport.ruleScopedFilesAnalyzed
        ?? summary.ruleScopedFilesAnalyzed
        ?? null;
    const codeFilesAnalyzed = summary.codeFilesAnalyzed
        ?? summary.codeFilesDiscovered
        ?? rawReport.filesAnalyzed
        ?? null;
    let filesAnalyzed = rawReport.filesAnalyzed ?? null;
    if (filesAnalyzed == null) {
        filesAnalyzed = rawReport.fullDirectoryScan
            ? repositoryFilesTotal
            : (ruleScopedFilesAnalyzed ?? codeFilesAnalyzed ?? repositoryFilesTotal);
    }
    return {
        ...rawReport,
        reportVersion: 2,
        filesAnalyzed,
        ruleScopedFilesAnalyzed: ruleScopedFilesAnalyzed ?? filesAnalyzed,
        repositoryFilesTotal,
        repositoryFoldersTotal,
        repositoryInventory: repositoryInventory || (repositoryFilesTotal != null
            ? { totalFiles: repositoryFilesTotal, totalFolders: repositoryFoldersTotal }
            : null)
    };
}
/**
 * True if a stored API host is a loopback/localhost server that cannot be reached
 * from a remote / HTTPS dashboard origin.
 */
function _isUnreachableLoopbackHost(value) {
    if (!value || typeof location === 'undefined')
        return false;
    try {
        const url = new URL(value, location.href);
        if (location.protocol === 'https:' && url.protocol === 'http:')
            return true;
        if (!isLocalDevHost() && /^(localhost|127\.0\.0\.1|\[::1\])$/i.test(url.hostname))
            return true;
    }
    catch (_a) { /* ignore malformed */ }
    return false;
}
/**
 * Simplebeacon api base.
 * @returns {any}
 */
function simplebeaconApiBase() {
    if (isDemoMode())
        return DEMO_API_BASE;
    const stored = localStorage.getItem('sb_api_host');
    if (stored && !_isUnreachableLoopbackHost(stored))
        return stored + '/api/simplebeacon';
    // VS Code / Windsurf website mode: sb_api_base points at the extension data-server on localhost.
    const embedBase = apiBaseUrl();
    if (embedBase && embedBase !== '/') {
        try {
            const normalized = embedBase.startsWith('http') ? embedBase : `http://${embedBase}`;
            const parsed = new URL(normalized);
            const host = parsed.hostname.toLowerCase();
            // Allow a developer-provided embed bridge (query param or session flag)
            // to be used even from an HTTPS-hosted page. This is required when the
            // dashboard is opened from the IDE and the extension passes a local
            // loopback API base via query params (sb_api_base) or session storage.
            const isEmbedOverride = (typeof window !== 'undefined') && (function() {
                try {
                    const params = new URLSearchParams(window.location.search || '');
                    if (params.get('sb_api_base') || params.get('sb_notify_base')) return true;
                    if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('sb_website_mode')) return true;
                }
                catch (_b) { /* ignore */ }
                return false;
            })();
            if ((host === '127.0.0.1' || host === 'localhost') && (!_isUnreachableLoopbackHost(parsed.origin) || isEmbedOverride)) {
                return `${parsed.origin}/api/simplebeacon`;
            }
        }
        catch (_a) { /* fall through */ }
    }
    // On Cloudflare Pages / custom domains, the dashboard static files are served without the
    // API backend. Route API calls to the production API instead.
    if (typeof location !== 'undefined' && !/^(localhost|127\.0\.0\.1)$/i.test(location.hostname) && !location.hostname.endsWith('.onrender.com')) {
        if (location.hostname === 'simplebeacon.ai') {
            return `${location.origin}/api/simplebeacon`;
        }
        return 'https://simplebeacon.ai/api/simplebeacon';
    }
    return '/api/simplebeacon';
}
/**
 * Merge auth headers.
 * @param {any} extra
 * @returns {any}
 */
function mergeAuthHeaders(extra = {}) {
    return { ...authService.getAuthHeaders(), ...billingService.getAuthHeaders(), ...extra };
}
/**
 * Fetch simplebeacon.
 * @param {string} url
 * @param {Object} options
 * @param {number} timeout
 * @returns {any}
 */
async function fetchSimplebeacon(url, options = {}, timeout = 30000) {
    const headers = mergeAuthHeaders(options.headers || {});
    let res;
    try {
        res = await fetchWithTimeout(url, { credentials: 'same-origin', ...options, headers }, timeout);
    }
    catch (error) {
        const detail = (error === null || error === void 0 ? void 0 : error.message) ? ` (${error.message})` : '';
        throw new Error(`Network request failed for ${url}${detail}. `
            + 'Verify the dashboard API server is running and reachable, then retry.');
    }
    if (res.status === 403) {
        const forbiddenBody = await readJsonResponseBody(res, {});
        if (forbiddenBody.error === 'demo_readonly') {
            const err = new Error(forbiddenBody.message || 'Demo mode is read-only');
            err.code = 'demo_readonly';
            throw err;
        }
        if (forbiddenBody.error === 'vault_required') {
            const err = new Error(forbiddenBody.message || 'Internal dashboard requires vault authentication.');
            err.code = 'vault_required';
            throw err;
        }
        const err = new Error(forbiddenBody.message || 'Subscription required');
        err.code = 'subscription_required';
        err.details = forbiddenBody;
        throw err;
    }
    if (res.status === 401) {
        const err = new Error('Authentication required');
        err.code = 'auth_required';
        throw err;
    }
    return res;
}
/**
 * Scan service.
 */
export class ScanService {
    constructor() {
        this.report = null;
        this.baseline = null;
        this.config = null;
        this.history = [];
        this._pendingFetches = new Map();
        this._ciMetricsInflight = null;
        this._ciMetricsUnavailable = false;
    }
    async fetchAll(projectPath = null) {
        const [reportR, baselineR, configR, historyR] = await Promise.allSettled([
            this.fetchReport(projectPath),
            this.fetchBaseline(),
            this.fetchConfig(projectPath),
            this.fetchHistory()
        ]);
        const firstError = [reportR, baselineR, configR].find((r) => r.status === 'rejected');
        if (firstError) {
            throw firstError.reason;
        }
        return {
            report: reportR.status === 'fulfilled' ? reportR.value : null,
            baseline: baselineR.status === 'fulfilled' ? baselineR.value : null,
            config: configR.status === 'fulfilled' ? configR.value : null,
            history: historyR.status === 'fulfilled' ? historyR.value : []
        };
    }
    async fetchReport(projectPath) {
        const safePath = resolveDashboardProjectPath(projectPath);
        if (safePath && /^https?:\/\//i.test(safePath)) {
            return null;
        }
        const key = `report:${safePath || ''}`;
        if (this._pendingFetches.has(key)) {
            return this._pendingFetches.get(key);
        }
        const promise = (async () => {
            try {
                const query = new URLSearchParams();
                if (safePath)
                    query.set('projectPath', safePath);
                query.set('_cb', Date.now().toString());
                const params = query.toString() ? `?${query.toString()}` : '';
                const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/report${params}`);
                if (!res.ok)
                    throw new Error('Failed to load scan report — is the dashboard server running?');
                const report = await readJsonResponseBody(res, null);
                if (!report || typeof report !== 'object') {
                    throw new Error('Scan report API unavailable on this host (received HTML instead of JSON).');
                }
                this.report = await this.enrichReport(normalizeScanReport(report));
                return this.report;
            }
            finally {
                this._pendingFetches.delete(key);
            }
        })();
        this._pendingFetches.set(key, promise);
        return promise;
    }
    async importReport(report, projectPath = null) {
        if (!report || typeof report !== 'object') {
            throw new Error('report is required');
        }
        const body = { report };
        if (projectPath)
            body.projectPath = projectPath;
        const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/report/import`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        }, 60000);
        const data = await readJsonResponseBody(res, null);
        if (!res.ok || !data || !data.success) {
            throw new Error((data === null || data === void 0 ? void 0 : data.error) || `Report import failed (${res.status})`);
        }
        this.report = await this.fetchReport(data.projectPath || projectPath || undefined);
        return { response: data, report: this.report };
    }
    async fetchRepositoryInventory(projectPath) {
        const path = resolveDashboardProjectPath(projectPath);
        if (!path)
            return null;
        if (/^https?:\/\//i.test(path) && !/^(git@|ssh:\/\/|https:\/\/(github|gitlab|bitbucket|codeberg)\.)/i.test(path)) {
            return null;
        }
        const params = new URLSearchParams({ projectPath: path, profile: 'explorer' });
        const base = simplebeaconApiBase().replace(/\/api\/simplebeacon$/, '');
        const inventoryHttpResponse = await fetchWithTimeout(`${base}/api/analyze/inventory?${params}`, { headers: mergeAuthHeaders() });
        const inventoryPayload = await readJsonResponseBody(inventoryHttpResponse, {});
        if (!inventoryHttpResponse.ok || !inventoryPayload.success)
            return null;
        return inventoryPayload.inventory;
    }
    async enrichReport(report) {
        var _a;
        if (!(report === null || report === void 0 ? void 0 : report.projectRoot) || ((_a = report.repositoryInventory) === null || _a === void 0 ? void 0 : _a.totalFiles) != null) {
            return report;
        }
        const inventory = await this.fetchRepositoryInventory(report.projectRoot);
        if (!inventory)
            return report;
        return { ...report, repositoryInventory: inventory };
    }
    async fetchBaseline() {
        const res = await fetchWithTimeout(`${simplebeaconApiBase()}/baseline`, { headers: mergeAuthHeaders() });
        if (!res.ok)
            throw new Error('Failed to load baseline');
        this.baseline = await readJsonResponseBody(res, null);
        if (!this.baseline || typeof this.baseline !== 'object') {
            throw new Error('Baseline API unavailable on this host (received HTML instead of JSON).');
        }
        return this.baseline;
    }
    async fetchConfig(projectPath = null) {
        const safePath = resolveDashboardProjectPath(projectPath);
        const qs = safePath ? `?projectPath=${encodeURIComponent(safePath)}` : '';
        const res = await fetchWithTimeout(`${simplebeaconApiBase()}/config${qs}`, { headers: mergeAuthHeaders() });
        if (!res.ok)
            throw new Error('Failed to load config');
        this.config = await readJsonResponseBody(res, null);
        if (!this.config || typeof this.config !== 'object') {
            throw new Error('Config API unavailable on this host (received HTML instead of JSON).');
        }
        return this.config;
    }
    async fetchConfigPresets() {
        const presetsHttpResponse = await fetchWithTimeout(`${simplebeaconApiBase()}/config/presets`, { headers: mergeAuthHeaders() });
        if (!presetsHttpResponse.ok)
            throw new Error('Failed to load config presets');
        const presetsPayload = await readJsonResponseBody(presetsHttpResponse, {});
        return presetsPayload.presets || {};
    }
    async saveConfig(config) {
        var _a;
        const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/config`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        }, 30000);
        const data = await readJsonResponseBody(res, {});
        if (!res.ok) {
            const detail = ((_a = data.errors) === null || _a === void 0 ? void 0 : _a.join('; ')) || data.message || 'Failed to save config';
            throw new Error(detail);
        }
        this.config = data.config;
        return data;
    }
    async fetchHistory() {
        const key = 'history';
        if (this._pendingFetches.has(key)) {
            return this._pendingFetches.get(key);
        }
        const promise = (async () => {
            try {
                const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/history`);
                if (!res.ok)
                    return [];
                const history = await readJsonResponseBody(res, []);
                this.history = Array.isArray(history) ? history : [];
                return this.history;
            }
            finally {
                this._pendingFetches.delete(key);
            }
        })();
        this._pendingFetches.set(key, promise);
        return promise;
    }
    async fetchDashboard() {
        const dashboardHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/dashboard`);
        if (!dashboardHttpResponse.ok)
            throw new Error('Failed to load dashboard aggregate');
        const dashboardPayload = await readJsonResponseBody(dashboardHttpResponse, null);
        if (!dashboardPayload || typeof dashboardPayload !== 'object') {
            throw new Error('Dashboard API unavailable on this host (received HTML instead of JSON).');
        }
        return dashboardPayload;
    }
    async fetchScanResults(scanId = 'latest') {
        const resultsHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/results/${encodeURIComponent(scanId)}`);
        if (!resultsHttpResponse.ok)
            throw new Error('Failed to load scan results');
        const scanResultsPayload = await readJsonResponseBody(resultsHttpResponse, null);
        if (!scanResultsPayload || typeof scanResultsPayload !== 'object') {
            throw new Error('Scan results API unavailable on this host (received HTML instead of JSON).');
        }
        return scanResultsPayload;
    }
    async fetchAudit(includeNpmAudit = false) {
        const query = includeNpmAudit ? '?npmAudit=1' : '';
        const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/audit${query}`, {}, includeNpmAudit ? 120000 : 30000);
        if (!res.ok)
            throw new Error('Failed to load compliance audit');
        const data = await readJsonResponseBody(res, null);
        if (!data || typeof data !== 'object') {
            throw new Error('Audit API unavailable on this host (received HTML instead of JSON).');
        }
        return data;
    }
    async runAssess() {
        const assessHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/assess`, { method: 'POST' }, 60000);
        const assessResponse = await readJsonResponseBody(assessHttpResponse, {});
        if (!assessHttpResponse.ok)
            throw new Error(assessResponse.error || assessResponse.message || 'Assessment failed');
        return assessResponse;
    }
    async runNpmAudit() {
        const npmAuditHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/npm-audit`, { method: 'POST' }, 120000);
        const npmAuditResponse = await readJsonResponseBody(npmAuditHttpResponse, {});
        if (!npmAuditHttpResponse.ok)
            throw new Error(npmAuditResponse.error || npmAuditResponse.message || 'npm audit failed');
        return npmAuditResponse;
    }
    async fetchAssessment() {
        const assessmentHttpResponse = await fetchSimplebeacon(`${simplebeaconApiBase()}/assessment`);
        if (!assessmentHttpResponse.ok)
            throw new Error('Failed to load assessment');
        const assessmentPayload = await readJsonResponseBody(assessmentHttpResponse, null);
        if (!assessmentPayload || typeof assessmentPayload !== 'object') {
            throw new Error('Assessment API unavailable on this host (received HTML instead of JSON).');
        }
        return assessmentPayload;
    }
    async fetchScanProgress(projectPath) {
        const safePath = resolveDashboardProjectPath(projectPath);
        if (!safePath)
            return { active: false };
        if (hasExtensionBridgeConfigured()) {
            try {
                const bridgeProgress = await fetchScanProgressViaExtensionBridge(safePath);
                if (bridgeProgress === null || bridgeProgress === void 0 ? void 0 : bridgeProgress.active) {
                    return bridgeProgress;
                }
            }
            catch (_bridgeErr) {
                /* fall through */
            }
        }
        if (isLocalPath(safePath) && shouldProbeLocalAgent()) {
            try {
                const agentStatus = await probeAgent();
                if (agentStatus.available) {
                    const agentProgress = await fetchScanProgressViaAgent(safePath);
                    if (agentProgress === null || agentProgress === void 0 ? void 0 : agentProgress.active) {
                        return agentProgress;
                    }
                }
            }
            catch (_a) {
                /* fall through to server progress */
            }
        }
        const params = new URLSearchParams({ projectPath: safePath });
        try {
            const res = await fetchWithTimeout(`${simplebeaconApiBase()}/scan/progress?${params}`, { headers: mergeAuthHeaders() }, 15000);
            const data = await readJsonResponseBody(res, {});
            if (res.status === 404) {
                return { active: false, endpointUnavailable: true };
            }
            if (!res.ok)
                return { active: false };
            return data.progress || { active: false };
        }
        catch (_a) {
            return { active: false, endpointUnavailable: true };
        }
    }
    async runScan(projectPath, options = {}) {
        if (isDemoMode()) {
            const err = new Error('Demo mode is read-only');
            err.code = 'demo_readonly';
            throw err;
        }
        const safePath = resolveDashboardProjectPath(projectPath) || undefined;
        if (!safePath) {
            throw new Error('No project path selected. Open a folder or set a project path before scanning.');
        }
        const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/scan`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ projectPath: safePath, fullDirectoryScan: options.fullDirectoryScan !== false })
        }, 600000);
        const data = await readJsonResponseBody(res, {});
        if (!res.ok) {
            if (data.partialReport) {
                this.report = await this.enrichReport(data.partialReport);
                return {
                    ...data,
                    report: this.report,
                    projectPath: projectPath || data.projectPath,
                    gateFailed: true
                };
            }
            throw new Error(data.error || data.message || data.warning || 'Scan failed');
        }
        // Backend may return 200 with a warning/fallback but no real report
        if (data.warning && !data.report) {
            throw new Error(data.warning);
        }
        const resolvedPath = projectPath || data.projectPath || null;
        try {
            this.report = await this.fetchReport(resolvedPath);
        }
        catch (_a) {
            this.report = data.report ? await this.enrichReport(data.report) : null;
        }
        return {
            ...data,
            report: this.report,
            projectPath: resolvedPath || data.projectPath,
            gateFailed: Boolean(data.gateFailed)
        };
    }
    async exportReport(report = this.report) {
        let data = report;
        if (!data) {
            const res = await fetchSimplebeacon(`${simplebeaconApiBase()}/report`);
            data = await readJsonResponseBody(res, null);
            if (!data || typeof data !== 'object') {
                throw new Error('Scan report API unavailable on this host (received HTML instead of JSON).');
            }
        }
        downloadJson(data, `simplebeacon-report-${new Date().toISOString().slice(0, 10)}.json`);
    }
    exportDashboard(options = {}) {
        const bundle = buildDashboardExportBundle({
            report: options.report || this.report || null,
            baseline: options.baseline || this.baseline || null,
            config: options.config || null,
            history: options.history || this.history || [],
            dashboardHome: options.dashboardHome || null,
            exportFilename: options.exportFilename || `simplebeacon-dashboard-${new Date().toISOString().slice(0, 10)}.json`
        });
        downloadJson(bundle, bundle.exportFilename || `simplebeacon-dashboard-${new Date().toISOString().slice(0, 10)}.json`);
    }
    exportFilteredIssues(issues, meta = {}) {
        const payload = {
            type: 'simplebeacon-results-export',
            exportedAt: new Date().toISOString(),
            filters: meta,
            issueCount: issues.length,
            issues
        };
        downloadJson(payload, `simplebeacon-results-${new Date().toISOString().slice(0, 10)}.json`);
    }
    exportIssuesCsv(issues) {
        const header = ['severity', 'type', 'description', 'file', 'count', 'recommendedAction'];
        /**
         * Escape.
         * @param {any} v
         * @returns {any}
         */
        const escape = (v) => `"${String(v !== null && v !== void 0 ? v : '').replace(/"/g, '""')}"`;
        const rows = issues.map((i) => {
            var _a;
            return [
                i.severity,
                i.type,
                i.description,
                i.filePath,
                (_a = i.count) !== null && _a !== void 0 ? _a : 1,
                i.recommendedAction
            ].map(escape).join(',');
        });
        downloadText([header.join(','), ...rows].join('\n'), `simplebeacon-results-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
    }
    getIssueCategories(report = this.report) {
        var _a, _b;
        if (!report)
            return [];
        const raw = report.rawIssues || report.detectedIssues || [];
        /**
         * Count by type.
         * @param {any} typeMatch
         * @returns {any}
         */
        const countByType = (typeMatch) => raw.filter((i) => typeMatch(i.type)).reduce((s, i) => s + (i.count || 1), 0);
        const credCount = (_a = report.credentialFindings) !== null && _a !== void 0 ? _a : countByType((t) => /credential/i.test(t));
        const schemaCount = countByType((t) => /schema/i.test(t));
        const prodCount = (_b = report.productionLeakFindings) !== null && _b !== void 0 ? _b : countByType((t) => /production leak/i.test(t));
        const fictionCount = countByType((t) => /fiction|consistency|kpi/i.test(t));
        const dupCount = countByType((t) => /duplicate/i.test(t));
        const typeSafetyCount = countByType((t) => /type-safety|prop-types|any-type|ts-ignore|ts-expect-error|unsafe-type-assertion/i.test(t));
        const categorizedCount = credCount + schemaCount + prodCount + fictionCount + dupCount + typeSafetyCount;
        const totalRaw = raw.reduce((s, i) => s + (i.count || 1), 0);
        const otherCount = Math.max(0, totalRaw - categorizedCount);
        /**
         * Max severity.
         * @param {number} count
         * @param {any} defaultSev
         * @returns {any}
         */
        const maxSeverity = (count, defaultSev) => {
            if (count === 0)
                return 'none';
            const issues = raw.filter((i) => i.count > 0 || i.severity);
            const relevant = issues.filter((i) => i.severity);
            if (!relevant.length)
                return defaultSev;
            if (relevant.some((i) => i.severity === 'high'))
                return 'high';
            if (relevant.some((i) => i.severity === 'medium'))
                return 'medium';
            return 'low';
        };
        return [
            {
                id: 'credentials',
                icon: '🔑',
                title: 'Credential Patterns',
                count: credCount,
                severity: credCount ? 'high' : 'none',
                filter: (i) => /credential/i.test(i.type)
            },
            {
                id: 'schema',
                icon: '📄',
                title: 'Schema Violations',
                count: schemaCount,
                severity: schemaCount ? 'high' : 'none',
                filter: (i) => /schema/i.test(i.type)
            },
            {
                id: 'production',
                icon: '🔗',
                title: 'Production Leaks',
                count: prodCount,
                severity: prodCount ? 'medium' : 'none',
                filter: (i) => /production leak/i.test(i.type)
            },
            {
                id: 'consistency',
                icon: '📊',
                title: 'Consistency Issues',
                count: fictionCount,
                severity: fictionCount ? maxSeverity(fictionCount, 'medium') : 'none',
                filter: (i) => /fiction|consistency|kpi/i.test(i.type)
            },
            {
                id: 'consolidation',
                icon: '🔀',
                title: 'Duplicate Data',
                count: dupCount,
                severity: dupCount ? 'low' : 'none',
                filter: (i) => /duplicate/i.test(i.type)
            },
            {
                id: 'type-safety',
                icon: '🛡️',
                title: 'Type Safety',
                count: typeSafetyCount,
                severity: typeSafetyCount ? maxSeverity(typeSafetyCount, 'low') : 'none',
                filter: (i) => /type-safety|prop-types|any-type|ts-ignore|ts-expect-error|unsafe-type-assertion/i.test(i.type)
            },
            {
                id: 'other',
                icon: '📁',
                title: 'Other Findings',
                count: otherCount,
                severity: otherCount ? 'low' : 'none',
                filter: (i) => !/credential|schema|production leak|fiction|consistency|kpi|duplicate|type-safety|prop-types|any-type|ts-ignore|ts-expect-error|unsafe-type-assertion/i.test(i.type)
            }
        ];
    }
    formatRelativeTime(isoString) {
        if (!isoString)
            return 'Never';
        const diff = Date.now() - new Date(isoString).getTime();
        const mins = Math.floor(diff / 60000);
        if (mins < 1)
            return 'Just now';
        if (mins < 60)
            return `${mins} minute${mins === 1 ? '' : 's'} ago`;
        const hours = Math.floor(mins / 60);
        if (hours < 24)
            return `${hours} hour${hours === 1 ? '' : 's'} ago`;
        const days = Math.floor(hours / 24);
        return `${days} day${days === 1 ? '' : 's'} ago`;
    }
    basename(filePath) {
        if (!filePath)
            return '—';
        const parts = filePath.replace(/\\/g, '/').split('/');
        return parts[parts.length - 1];
    }

    /**
     * Team CI telemetry summary (paid tier — merges blocked, gates tripped).
     * @param {{ days?: number }} [options]
     * @returns {Promise<Object|null>}
     */
    async fetchCiTeamMetrics(options = {}) {
        if (this._ciMetricsUnavailable) {
            return null;
        }
        if (this._ciMetricsInflight) {
            return this._ciMetricsInflight;
        }
        this._ciMetricsInflight = this._fetchCiTeamMetricsImpl(options).finally(() => {
            this._ciMetricsInflight = null;
        });
        return this._ciMetricsInflight;
    }

    async _fetchCiTeamMetricsImpl(options = {}) {
        const days = options.days || 7;
        try {
            const res = await fetchWithTimeout(`${simplebeaconApiBase()}/ci/telemetry/summary?days=${days}`, {
                headers: mergeAuthHeaders({ Accept: 'application/json' })
            });
            if (res.status === 404) {
                this._ciMetricsUnavailable = true;
                return null;
            }
            if (!res.ok) {
                return null;
            }
            const data = await readJsonResponseBody(res);
            if (!data || typeof data.total_scans !== 'number') {
                return null;
            }
            return data;
        }
        catch {
            return null;
        }
    }
}
/**
 * Scan service.
 */
export const scanService = new ScanService();
