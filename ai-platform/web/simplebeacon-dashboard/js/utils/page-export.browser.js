/**
 * SPA portal page exports — browser mirror of server/lib/spa-page-export.js
 */

import { downloadJson, showToast } from '../utils.js';
import { FEATURE_CATALOG } from '../services/platformService.js?v=20260531pageexport1';
import {
  getScanFileMetrics,
  resolveDisplayScore,
  resolveJestTestsLabel,
  resolvePageSpecsLabel,
  formatScanScopeSummary
} from '../services/analyzeService.js';
import { pipelineStats, prospectsWithSentLog, OUTREACH_PROSPECTS } from '../data/outreach-prospects.js?v=20260531pageexport1';

export function pageExportFilename(pageId) {
  const stamp = new Date().toISOString().slice(0, 10);
  return `simplebeacon-${pageId}-export-${stamp}.json`;
}

export function downloadPageExport(pageId, payload) {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Nothing to export yet.');
  }
  downloadJson(payload, pageExportFilename(pageId));
}

export function renderPageExportButton(pageId, { disabled = false, label = 'Export reports' } = {}) {
  return `
    <button type="button" class="btn btn-secondary btn-sm" data-page-export="${pageId}" ${disabled ? 'disabled' : ''} title="Download page data as JSON">
      ${label}
    </button>
  `;
}

export function bindPageExportButton(root, pageId, buildPayload, options = {}) {
  root.querySelector(`[data-page-export="${pageId}"]`)?.addEventListener('click', async () => {
    try {
      const payload = typeof buildPayload === 'function' ? await buildPayload() : buildPayload;
      if (!payload) {
        showToast(options.emptyMessage || 'Nothing to export yet', 'info');
        return;
      }
      downloadPageExport(pageId, payload);
      showToast(options.successMessage || 'Reports exported', 'success');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });
}

function summarizeGateReport(report) {
  if (!report) return null;
  return {
    generatedAt: report.generatedAt || null,
    gatePass: report.gate?.pass ?? null,
    issueCount: report.issueCount ?? null,
    qualityScore: report.qualityScore ?? null,
    schemaCompliance: report.schemaCompliance ?? null,
    consistencyScore: report.consistencyScore ?? null,
    credentialFindings: report.credentialFindings ?? null,
    productionLeakFindings: report.productionLeakFindings ?? null
  };
}

function summarizeBaseline(baseline) {
  if (!baseline) return null;
  return {
    syncedAt: baseline.syncedAt || null,
    jestTestsLabel: baseline.jestTestsLabel || null,
    jestSuites: baseline.jestSuites ?? null,
    pageSamplesLabel: baseline.pageSamplesLabel || null
  };
}

function buildScanSnapshot(report, baseline, dashboardHome) {
  if (!report) return null;
  const metrics = getScanFileMetrics(report);
  return {
    ...summarizeGateReport(report),
    consistency: resolveDisplayScore(report),
    jestTests: resolveJestTestsLabel(baseline, dashboardHome),
    pageSpecs: resolvePageSpecsLabel(report, baseline),
    mockSampleFiles: metrics.mockSampleFiles ?? report.totalFiles ?? null,
    repositoryFiles: metrics.repositoryFiles ?? null,
    scopeSummary: formatScanScopeSummary(report)
  };
}

export function buildTrustPageExport(trustData) {
  return {
    type: 'simplebeacon-trust-page-export',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    trust: trustData?.live || trustData,
    publishedAt: trustData?.publishedAt || null,
    staticHost: Boolean(trustData?.staticHost)
  };
}

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

export function buildFeaturesPageExport(filter = '') {
  const q = String(filter || '').trim().toLowerCase();
  const catalog = !q
    ? FEATURE_CATALOG
    : FEATURE_CATALOG.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        `${item.label} ${item.description} ${item.route} ${group.group}`.toLowerCase().includes(q))
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

export function buildOutreachPageExport(view) {
  const sent = view.sent || [];
  const prospects = prospectsWithSentLog(OUTREACH_PROSPECTS, sent);
  return {
    type: 'simplebeacon-outreach-export',
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    config: view.config || null,
    throttle: view.config?.throttle || null,
    pipeline: pipelineStats(OUTREACH_PROSPECTS, sent),
    prospectCount: prospects.length,
    sentCount: sent.length,
    sent: sent.slice(0, 100),
    draft: {
      prospectId: view.draft?.prospectId || '',
      templateId: view.draft?.templateId || '',
      company: view.draft?.company || '',
      subject: view.draft?.subject || ''
    }
  };
}

export function buildDeliverablesPageExport(view) {
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
    waitlistCount: view.waitlistCount ?? null
  };
}
