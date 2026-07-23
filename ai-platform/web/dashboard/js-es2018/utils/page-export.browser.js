/**
 * SPA portal page exports — browser mirror of server/lib/spa-page-export.js
 */
import { downloadJson, showToast } from '../utils.js';
import { FEATURE_CATALOG } from '../services/platformService.js?v=20260716cachefix1';
import { getScanFileMetrics, resolveDisplayScore, resolveJestTestsLabel, resolvePageSpecsLabel, formatScanScopeSummary } from '../services/analyzeService.js?v=20260716cachefix1';
import { pipelineStats, prospectsWithSentLog, OUTREACH_PROSPECTS } from '../data/outreach-prospects.js?v=20260716cachefix1';
/**
 * Page export filename.
 * @param {string} pageId
 * @returns {any}
 */
export function pageExportFilename(pageId) {
    const stamp = new Date().toISOString().slice(0, 10);
    return `simplebeacon-${pageId}-export-${stamp}.json`;
}
/**
 * Download page export.
 * @param {string} pageId
 * @param {any} payload
 * @returns {any}
 */
export function downloadPageExport(pageId, payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('Nothing to export yet.');
    }
    downloadJson(payload, pageExportFilename(pageId));
}
/**
 * Render page export button.
 * @param {string} pageId
 * @param {Object} options
 * @param {any} label
 * @returns {any}
 */
export function renderPageExportButton(pageId, { disabled = false, label = 'Export reports' } = {}) {
    return `
    <button type="button" class="btn btn-secondary btn-sm" data-page-export="${pageId}" ${disabled ? 'disabled' : ''} title="Download page data as JSON">
      ${label}
    </button>
  `;
}
/**
 * Bind page export button.
 * @param {any} root
 * @param {string} pageId
 * @param {any} buildPayload
 * @param {Object} options
 * @returns {any}
 */
export function bindPageExportButton(root, pageId, buildPayload, options = {}) {
    var _a;
    (_a = root.querySelector(`[data-page-export="${pageId}"]`)) === null || _a === void 0 ? void 0 : _a.addEventListener('click', async () => {
        try {
            const payload = typeof buildPayload === 'function' ? await buildPayload() : buildPayload;
            if (!payload) {
                showToast(options.emptyMessage || 'Nothing to export yet', 'info');
                return;
            }
            downloadPageExport(pageId, payload);
            showToast(options.successMessage || 'Reports exported', 'success');
        }
        catch (err) {
            showToast(err.message, 'error');
        }
    });
}
/**
 * Summarize gate report.
 * @param {number} report
 * @returns {any}
 */
function summarizeGateReport(report) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    if (!report)
        return null;
    return {
        generatedAt: report.generatedAt || null,
        gatePass: (_b = (_a = report.gate) === null || _a === void 0 ? void 0 : _a.pass) !== null && _b !== void 0 ? _b : null,
        issueCount: (_c = report.issueCount) !== null && _c !== void 0 ? _c : null,
        qualityScore: (_d = report.qualityScore) !== null && _d !== void 0 ? _d : null,
        schemaCompliance: (_e = report.schemaCompliance) !== null && _e !== void 0 ? _e : null,
        consistencyScore: (_f = report.consistencyScore) !== null && _f !== void 0 ? _f : null,
        credentialFindings: (_g = report.credentialFindings) !== null && _g !== void 0 ? _g : null,
        productionLeakFindings: (_h = report.productionLeakFindings) !== null && _h !== void 0 ? _h : null
    };
}
/**
 * Summarize baseline.
 * @param {any} baseline
 * @returns {any}
 */
function summarizeBaseline(baseline) {
    var _a;
    if (!baseline)
        return null;
    return {
        syncedAt: baseline.syncedAt || null,
        jestTestsLabel: baseline.jestTestsLabel || null,
        jestSuites: (_a = baseline.jestSuites) !== null && _a !== void 0 ? _a : null,
        pageSamplesLabel: baseline.pageSamplesLabel || null
    };
}
/**
 * Build scan snapshot.
 * @param {number} report
 * @param {any} baseline
 * @param {any} dashboardHome
 * @returns {any}
 */
function buildScanSnapshot(report, baseline, dashboardHome) {
    var _a, _b, _c;
    if (!report)
        return null;
    const metrics = getScanFileMetrics(report);
    return {
        ...summarizeGateReport(report),
        consistency: resolveDisplayScore(report),
        jestTests: resolveJestTestsLabel(baseline, dashboardHome),
        pageSpecs: resolvePageSpecsLabel(report, baseline),
        mockSampleFiles: (_b = (_a = metrics.mockSampleFiles) !== null && _a !== void 0 ? _a : report.totalFiles) !== null && _b !== void 0 ? _b : null,
        repositoryFiles: (_c = metrics.repositoryFiles) !== null && _c !== void 0 ? _c : null,
        scopeSummary: formatScanScopeSummary(report)
    };
}
/**
 * Build trust page export.
 * @param {any} trustData
 * @returns {any}
 */
export function buildTrustPageExport(trustData) {
    return {
        type: 'simplebeacon-trust-page-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        trust: (trustData === null || trustData === void 0 ? void 0 : trustData.live) || trustData,
        publishedAt: (trustData === null || trustData === void 0 ? void 0 : trustData.publishedAt) || null,
        staticHost: Boolean(trustData === null || trustData === void 0 ? void 0 : trustData.staticHost)
    };
}
/**
 * Build tools page export.
 * @param {any} app
 * @returns {any}
 */
export function buildToolsPageExport(app) {
    const { report, baseline, devTools, devWorkflows, mergerReductionScan, npmAudit, dashboardHome } = app.state;
    return {
        type: 'simplebeacon-tools-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        tools: devTools || [],
        workflows: devWorkflows || [],
        consolidationScan: mergerReductionScan || null,
        npmAudit: npmAudit || null,
        scanSnapshot: buildScanSnapshot(report, baseline, dashboardHome),
        baseline: summarizeBaseline(baseline)
    };
}
/**
 * Build help page export.
 * @param {any} app
 * @returns {any}
 */
export function buildHelpPageExport(app) {
    const help = app.state.help || {};
    const { report, baseline, dashboardHome } = app.state;
    return {
        type: 'simplebeacon-help-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        title: help.title || 'Help & Docs',
        overview: help.overview || null,
        quickLinks: help.quickLinks || [],
        documentation: help.documentation || [],
        faq: help.faq || [],
        scanSnapshot: buildScanSnapshot(report, baseline, dashboardHome),
        baseline: summarizeBaseline(baseline)
    };
}
/**
 * Build features page export.
 * @param {any} filter
 * @returns {any}
 */
export function buildFeaturesPageExport(filter = '') {
    const q = String(filter || '').trim().toLowerCase();
    const catalog = !q
        ? FEATURE_CATALOG
        : FEATURE_CATALOG.map((group) => ({
            ...group,
            items: group.items.filter((item) => `${item.label} ${item.description} ${item.route} ${group.group}`.toLowerCase().includes(q))
        })).filter((group) => group.items.length);
    const items = catalog.flatMap((group) => group.items.map((item) => ({ ...item, group: group.group })));
    return {
        type: 'simplebeacon-features-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        filter: q || null,
        groupCount: catalog.length,
        featureCount: items.length,
        routeCount: new Set(items.map((item) => item.route)).size,
        catalog,
        features: items
    };
}
/**
 * Build settings page export.
 * @param {any} app
 * @param {Object} draftConfig
 * @returns {any}
 */
export function buildSettingsPageExport(app, draftConfig = null) {
    const config = draftConfig || app.state.config || null;
    const sanitized = config ? JSON.parse(JSON.stringify(config)) : null;
    if (sanitized) {
        delete sanitized.userAiKeys;
        delete sanitized.secrets;
    }
    return {
        type: 'simplebeacon-settings-page-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        config: sanitized,
        baseline: summarizeBaseline(app.state.baseline),
        scanSnapshot: summarizeGateReport(app.state.report),
        configPath: '.simplebeacon/config.json',
        note: 'AI provider secrets are never included in page exports.'
    };
}
/**
 * Build assessments page export.
 * @param {any} view
 * @returns {any}
 */
export function buildAssessmentsPageExport(view) {
    return {
        type: 'simplebeacon-assessments-portal-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        assessment: view.report || null,
        recentAssessments: view.recent || [],
        gateSnapshot: summarizeGateReport(view.app.state.report)
    };
}
/**
 * Build outreach page export.
 * @param {any} view
 * @returns {any}
 */
export function buildOutreachPageExport(view) {
    var _a, _b, _c, _d, _e;
    const sent = view.sent || [];
    const prospects = prospectsWithSentLog(OUTREACH_PROSPECTS, sent);
    return {
        type: 'simplebeacon-outreach-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        config: view.config || null,
        throttle: ((_a = view.config) === null || _a === void 0 ? void 0 : _a.throttle) || null,
        pipeline: pipelineStats(OUTREACH_PROSPECTS, sent),
        prospectCount: prospects.length,
        sentCount: sent.length,
        sent: sent.slice(0, 100),
        draft: {
            prospectId: ((_b = view.draft) === null || _b === void 0 ? void 0 : _b.prospectId) || '',
            templateId: ((_c = view.draft) === null || _c === void 0 ? void 0 : _c.templateId) || '',
            company: ((_d = view.draft) === null || _d === void 0 ? void 0 : _d.company) || '',
            subject: ((_e = view.draft) === null || _e === void 0 ? void 0 : _e.subject) || ''
        }
    };
}
/**
 * Build deliverables page export.
 * @param {any} view
 * @returns {any}
 */
export function buildDeliverablesPageExport(view) {
    var _a;
    return {
        type: 'simplebeacon-deliverables-export',
        version: '1.0.0',
        generatedAt: new Date().toISOString(),
        products: view.products || [],
        urls: view.urls || {},
        selectedSku: view.activeSecondarySku || view.selectedSku || null,
        intake: { ...view.intake },
        reportPreview: view.reportPreview || summarizeGateReport(view.app.state.report),
        lastWorkspace: view.lastWorkspace || null,
        lastSprint: view.lastSprint || null,
        waitlistCount: (_a = view.waitlistCount) !== null && _a !== void 0 ? _a : null
    };
}
