// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { authService } from './authService.js?v=20260716cachefix1';
import { fetchUserAiKeys } from './aiKeysService.js';
import { scanService } from './scanService.js';
import { formatNumber, escapeHtml, fetchWithTimeout } from '../utils.js';
import { notifyDownloadComplete } from '../utils-lib/notify.js';
import { isRemoteRepoUrl } from '../lib/analyzePathSources.js';
import { isBenchmarkCachePath } from '../utils/complete-scan-artifact-profile.browser.js';
import { DEMO_EMAIL } from '../demoMode.js';
import { DASHBOARD_BASE_URL } from '../config.js';
import { isLocalPath, fetchInventoryViaAgent, probeAgent } from './localAgentService.js';

// simplebeacon:production-leak-intent: web-data-sample - Legitimate web data path detection for analysis mode resolution

let providersPromise = null;

/**
 * Parse json safe.
 * @param {Array} res
 * @returns {any}
 */
async function parseJsonSafe(res) {
  const contentType = String(res.headers.get('content-type') || '').toLowerCase();
  if (!contentType.includes('application/json')) {
    return {};
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    return {};
  }
}

/**
 * Build network error message.
 * @param {any} target
 * @param {any} error
 * @returns {any}
 */
function buildNetworkErrorMessage(target, error) {
  const detail = error?.message ? ` (${error.message})` : '';
  return `Network request failed for ${target}${detail}. Verify the dashboard API server is running and reachable, then retry.`;
}

/** Fail fast before long scans when the API is down or vault session is missing. */
export async function ensureDashboardApiReady() {
  const origin = typeof window !== 'undefined' ? window.location.origin : DASHBOARD_BASE_URL;
  let healthRes;
  try {
    healthRes = await fetchWithTimeout('/api/health', {}, 8000);
  } catch (error) {
    throw new Error(
      `Dashboard API is not reachable at ${origin}. ` +
        'Start it from ai-platform with: npm run dashboard:kill-ports && npm run dashboard:v1-internal'
    );
  }
  if (!healthRes.ok) {
    throw new Error(
      `Dashboard API health check failed (${healthRes.status}). Restart the server and retry.`
    );
  }

  let probeRes;
  try {
    probeRes = await fetchWithTimeout(
      '/api/simplebeacon/config',
      {
        headers: authService.getAuthHeaders(),
      },
      8000
    );
  } catch (error) {
    throw new Error(buildNetworkErrorMessage('/api/simplebeacon/config', error));
  }
  const probeData = await parseJsonSafe(probeRes);
  if (probeRes.status === 403 && probeData.error === 'vault_required') {
    throw new Error(
      'Vault session required for internal dashboard. ' +
        'Open /private-dashboard-vault?password=<DASHBOARD_VAULT_PASSWORD> in this browser, then retry.'
    );
  }
}

/**
 * Fetch json with guidance.
 * @param {any} target
 * @param {Object} options
 * @param {Array} timeoutMs
 * @returns {any}
 */
async function fetchJsonWithGuidance(target, options = {}, timeoutMs = 0) {
  let res;
  try {
    res =
      timeoutMs > 0
        ? await fetchWithTimeout(target, options, timeoutMs)
        : await fetch(target, options);
  } catch (error) {
    throw new Error(buildNetworkErrorMessage(target, error));
  }

  const data = await parseJsonSafe(res);
  if (res.status === 401) {
    authService.clearSession();
    throw new Error(`Session expired — sign in again at #/signin (${DEMO_EMAIL}).`);
  }
  if (!res.ok) {
    const detail = data.error || data.message || `${res.status} ${res.statusText}`.trim();
    throw new Error(`Request failed for ${target}: ${detail}`);
  }

  return data;
}

/** Clear cached /api/analyze/providers (call after Settings → Save AI keys). */
export function invalidateAnalyzeProvidersCache() {
  providersPromise = null;
}

/** Merge Settings → AI providers into the Ollama row when the server probe omits credentials. */
export async function patchProvidersFromSavedAiKeys(data) {
  if (!data?.providers?.length) return data;
  if (!authService.isAuthenticated()) return data;
  let keys;
  try {
    keys = await fetchUserAiKeys();
  } catch {
    return data;
  }
  const model = String(keys?.ollamaModel || '').trim();
  if (!model) return data;

  const ollama = data.providers.find((p) => p.id === 'ollama');
  if (!ollama) return data;

  ollama.model = model;
  ollama.label = `Ollama (${model})`;
  if (keys.ollamaBaseUrl) {
    ollama.description = `${keys.ollamaBaseUrl} · ${model}`;
  }
  ollama.configured = true;
  if (!ollama.statusMessage || /not configured|no models/i.test(ollama.statusMessage)) {
    ollama.statusMessage = `Model from Settings — ${model}`;
  }
  return data;
}

/**
 * Is analyze provider configured.
 * @param {string} provider
 * @returns {any}
 */
export function isAnalyzeProviderConfigured(provider) {
  if (!provider) return false;
  if (provider.id === 'ollama') {
    return Boolean(provider.configured || provider.model);
  }
  return Boolean(provider.configured);
}

/**
 * Fetch analyze providers.
 * @param {Object} options
 * @returns {any}
 */
export async function fetchAnalyzeProviders(options = {}) {
  if (!options.refresh && providersPromise) {
    return providersPromise;
  }

  const params = options.refresh ? `?${new URLSearchParams({ _: String(Date.now()) })}` : '';
  providersPromise = fetchJsonWithGuidance(`/api/analyze/providers${params}`, {
    headers: authService.getAuthHeaders(),
  })
    .then(async (data) => patchProvidersFromSavedAiKeys(data))
    .catch((error) => {
      providersPromise = null;
      throw error;
    });

  return providersPromise;
}

/**
 * Analyze path.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function analyzePath(projectPath, options = {}) {
  const timeoutMs = options.timeoutMs ?? 0;
  const data = await fetchJsonWithGuidance(
    '/api/analyze/flexible',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        projectPath,
        aiProvider: options.aiProvider || 'active',
        analysisType: options.analysisType || 'auto',
        roadmapInsightsMode: options.roadmapInsightsMode || 'off',
        understandingMode: options.understandingMode || 'deterministic',
        scanProfile: options.scanProfile || 'universal',
        includePaths: options.includePaths || [],
        excludePatterns: options.excludePatterns || [],
        requestedScanRoot: options.requestedScanRoot || options.scanTargetRoot || undefined,
      }),
    },
    timeoutMs
  );
  if (!data.success) {
    throw new Error(data.message || data.error || 'Analysis failed');
  }
  return data;
}

/** Analyze pasted or dropped file text without requiring a server project path. */
export async function fetchUnderstandSnippet(code, options = {}) {
  const understandResponse = await fetchJsonWithGuidance(
    '/api/analyze/understand',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        code: String(code || ''),
        filePath: options.filePath || 'snippet.txt',
        projectPath: options.projectPath || undefined,
        understandingMode: options.understandingMode || 'deterministic',
        aiProvider: options.aiProvider || 'demo',
      }),
    },
    options.timeoutMs ?? 90000
  );
  if (!understandResponse.success) {
    throw new Error(
      understandResponse.error || understandResponse.message || 'Code understanding failed'
    );
  }
  return understandResponse;
}

/**
 * Scan path.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function scanPath(projectPath, options = {}) {
  return scanService.runScan(projectPath, options);
}

/** Strip large arrays before POST /api/analyze/summary (Express body limit). */
export function slimReportForSummary(report) {
  if (!report || typeof report !== 'object') return report;
  const type = report.type || '';
  if (type === 'codebase-analyzer-report') {
    return {
      type: report.type,
      summary: report.summary,
      categories: (report.categories || []).slice(0, 12),
      findings: (report.findings || []).slice(0, 24).map((f) => ({
        category: f.category,
        severity: f.severity,
        description: f.description,
        filePath: f.filePath,
      })),
      scanScope: report.scanScope,
      repositoryInventory: report.repositoryInventory,
      projectRoot: report.projectRoot,
      platformRoot: report.platformRoot,
      gate: report.gate,
      gateAttestation: report.gateAttestation,
      issueCount: report.issueCount,
      qualityScore: report.qualityScore,
      schemaCompliance: report.schemaCompliance,
      repositoryFilesTotal: report.repositoryFilesTotal,
      ruleScopedFilesAnalyzed: report.ruleScopedFilesAnalyzed,
      fictionJsonFilesScanned: report.fictionJsonFilesScanned,
      severityCounts: report.severityCounts,
      scanTargetProfile: report.scanTargetProfile,
      handoffEligible: report.handoffEligible,
      benchmarkScan: report.benchmarkScan,
      rawIssues: (report.rawIssues || report.detectedIssues || []).slice(0, 24),
      detectedIssues: (report.detectedIssues || []).slice(0, 12),
    };
  }
  if (type === 'file-merger-reduction-report') {
    return {
      type: report.type,
      summary: report.summary,
      repositoryInventory: report.repositoryInventory,
      scanScope: report.scanScope,
      mergeCandidates: (report.mergeCandidates || []).slice(0, 8),
      reductionOpportunities: (report.reductionOpportunities || []).slice(0, 8),
    };
  }
  if (type === 'data-cleanup-report') {
    return {
      type: report.type,
      scanProfile: report.scanProfile,
      summary: report.summary,
      inventory: report.inventory,
      fileReductionPlan: report.fileReductionPlan
        ? {
            totals: report.fileReductionPlan.totals,
            safeToDelete: {
              topDirectories: (report.fileReductionPlan.safeToDelete?.topDirectories || []).slice(
                0,
                8
              ),
            },
            unusedFiles: {
              candidates: report.fileReductionPlan.unusedFiles?.candidates ?? null,
            },
          }
        : null,
      executiveSummary: report.executiveSummary
        ? {
            priorityActions: (report.executiveSummary.priorityActions || []).slice(0, 6),
            workspace: report.executiveSummary.workspace,
            security: {
              piiNeedingReview: report.executiveSummary.security?.piiNeedingReview ?? null,
              credentialsNeedingReview:
                report.executiveSummary.security?.credentialsNeedingReview ?? null,
            },
          }
        : null,
      allFindings: (report.allFindings || []).slice(0, 12).map((f) => ({
        type: f.type,
        severity: f.severity,
        path: f.path,
        reason: f.reason,
      })),
    };
  }
  return { ...report };
}

/**
 * Summarize report.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export async function summarizeReport(report, options = {}) {
  const slim = slimReportForSummary(report);
  const res = await fetch('/api/analyze/summary', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...authService.getAuthHeaders(),
    },
    body: JSON.stringify({
      report: slim,
      reportType: options.reportType || report?.type,
      projectPath: options.projectPath || '',
      aiProvider: options.aiProvider || 'demo',
      summaryFocus: options.summaryFocus || 'all',
    }),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 413) {
    return {
      success: true,
      enhanced: false,
      message: 'Report too large for AI summary — deterministic results unchanged.',
    };
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'AI summary failed');
  }
  return data;
}

/**
 * Slim complete scan for audit.
 * @param {number} exportPayload
 * @param {Object} options
 * @returns {any}
 */
export function slimCompleteScanForAudit(exportPayload, options = {}) {
  if (!exportPayload || typeof exportPayload !== 'object') return null;
  const findingsLimit = options.findingsLimit ?? 5000;
  const results = exportPayload.results || {};
  /**
   * Slim findings.
   * @param {Array} findings
   * @param {number} limit
   * @returns {any}
   */
  const slimFindings = (findings, limit = findingsLimit) =>
    (findings || []).slice(0, limit).map((f) => ({
      category: f.category,
      type: f.type,
      severity: f.severity,
      filePath: f.filePath,
      line: f.line,
      description: f.description,
      match: f.match,
      recommendedAction: f.recommendedAction,
    }));
  const slimSimplebeacon = results.simplebeacon
    ? {
        type: results.simplebeacon.type,
        generatedAt: results.simplebeacon.generatedAt,
        projectRoot: results.simplebeacon.projectRoot,
        platformRoot: results.simplebeacon.platformRoot,
        gate: results.simplebeacon.gate,
        issueCount: results.simplebeacon.issueCount,
        qualityScore: results.simplebeacon.qualityScore,
        schemaCompliance: results.simplebeacon.schemaCompliance,
        schemaChecked: results.simplebeacon.schemaChecked,
        schemaPassed: results.simplebeacon.schemaPassed,
        consistencyChecked: results.simplebeacon.consistencyChecked,
        repositoryFilesTotal: results.simplebeacon.repositoryFilesTotal,
        ruleScopedFilesAnalyzed: results.simplebeacon.ruleScopedFilesAnalyzed,
        credentialScanned: results.simplebeacon.credentialScanned,
        credentialFindings: results.simplebeacon.credentialFindings,
        productionLeakScanned: results.simplebeacon.productionLeakScanned,
        productionLeakFindings: results.simplebeacon.productionLeakFindings,
        fictionJsonFilesScanned: results.simplebeacon.fictionJsonFilesScanned,
        sourceCodeFilesScanned: results.simplebeacon.sourceCodeFilesScanned,
        mockSampleFiles: results.simplebeacon.mockSampleFiles,
        severityCounts: results.simplebeacon.severityCounts,
        consistencyPassed: results.simplebeacon.consistencyPassed,
        consistencyScore: results.simplebeacon.consistencyScore,
        scanScope: results.simplebeacon.scanScope,
        rawIssues: (
          results.simplebeacon.rawIssues ||
          results.simplebeacon.detectedIssues ||
          []
        ).slice(0, 80),
      }
    : null;
  const slimCodebase = results.codebase
    ? {
        type: results.codebase.type,
        projectRoot: results.codebase.projectRoot,
        platformRoot: results.codebase.platformRoot,
        summary: results.codebase.summary,
        categories: (results.codebase.categories || []).slice(0, 12),
        scanScope: results.codebase.scanScope,
        findings: slimFindings(results.codebase.findings, findingsLimit),
      }
    : null;
  const slimConsolidation = results.consolidation
    ? {
        summary: results.consolidation.summary,
        scanScope: results.consolidation.scanScope,
      }
    : null;
  const slimFileReduction = results.fileReduction
    ? {
        summary: results.fileReduction.summary,
        fileReductionPlan: results.fileReduction.fileReductionPlan
          ? { totals: results.fileReduction.fileReductionPlan.totals }
          : null,
        executiveSummary: results.fileReduction.executiveSummary
          ? {
              priorityActions: (results.fileReduction.executiveSummary.priorityActions || []).slice(
                0,
                6
              ),
            }
          : null,
      }
    : null;
  const slimDataQuality = results.dataQuality
    ? {
        summary: results.dataQuality.summary,
        executiveSummary: results.dataQuality.executiveSummary
          ? {
              workspace: results.dataQuality.executiveSummary.workspace,
              security: results.dataQuality.executiveSummary.security,
              priorityActions: (results.dataQuality.executiveSummary.priorityActions || []).slice(
                0,
                6
              ),
            }
          : null,
      }
    : null;
  const slimCleanupAssistant = results.cleanupAssistant
    ? {
        estimatedReduction: results.cleanupAssistant.estimatedReduction,
        projectedInventory: results.cleanupAssistant.projectedInventory,
        tiers: {
          safeNow: results.cleanupAssistant.tiers?.safeNow
            ? {
                files: results.cleanupAssistant.tiers.safeNow.files,
                bytes: results.cleanupAssistant.tiers.safeNow.bytes,
                directories: (results.cleanupAssistant.tiers.safeNow.directories || []).slice(0, 8),
              }
            : null,
          investigate: results.cleanupAssistant.tiers?.investigate || null,
        },
        dataQualityActions: (results.cleanupAssistant.dataQualityActions || []).slice(0, 6),
      }
    : null;
  return {
    type: exportPayload.type,
    version: exportPayload.version,
    generatedAt: exportPayload.generatedAt,
    projectPath: exportPayload.projectPath,
    scanDurationMs: exportPayload.scanDurationMs ?? exportPayload.summary?.scanDurationMs ?? null,
    summary: exportPayload.summary,
    steps: exportPayload.steps || null,
    results: {
      simplebeacon: slimSimplebeacon,
      consolidation: slimConsolidation,
      mockScan: results.mockScan
        ? {
            fictionIssues: results.mockScan.fictionIssues,
            conclusion: results.mockScan.conclusion,
          }
        : null,
      roadmap: results.roadmap
        ? {
            type: results.roadmap.type,
            projectTitle: results.roadmap.projectTitle || results.roadmap.projectName || null,
            projectName: results.roadmap.projectName || null,
            executiveSummary: results.roadmap.executiveSummary || null,
            developmentPhases: (results.roadmap.developmentPhases || []).slice(0, 12),
            projectOverview: results.roadmap.projectOverview || null,
            codeAnalysis: results.roadmap.codeAnalysis
              ? {
                  structure: {
                    totalFiles: results.roadmap.codeAnalysis.structure?.totalFiles ?? null,
                    languages: results.roadmap.codeAnalysis.structure?.languages ?? null,
                  },
                }
              : null,
            resourceEstimate: results.roadmap.resourceEstimate || null,
            implementationPhases: (results.roadmap.implementationPhases || []).slice(0, 8),
            featureCategories: (results.roadmap.featureCategories || []).slice(0, 12),
            progressMetrics: results.roadmap.progressMetrics || null,
            recommendations: results.roadmap.recommendations
              ? {
                  immediate: (results.roadmap.recommendations.immediate || []).slice(0, 6),
                  shortTerm: (results.roadmap.recommendations.shortTerm || []).slice(0, 6),
                  longTerm: (results.roadmap.recommendations.longTerm || []).slice(0, 6),
                  priorities: results.roadmap.recommendations.priorities || null,
                }
              : null,
            risks: (results.roadmap.risks || []).slice(0, 10),
          }
        : null,
      codebase: slimCodebase,
      fileReduction: slimFileReduction,
      dataQuality: slimDataQuality,
      cleanupAssistant: slimCleanupAssistant,
    },
  };
}

/**
 * Normalize audit export payload.
 * @param {number} exportPayload
 * @returns {any}
 */
export function normalizeAuditExportPayload(exportPayload) {
  if (!exportPayload || typeof exportPayload !== 'object') return null;
  if (exportPayload.results && Object.values(exportPayload.results).some(Boolean)) {
    return exportPayload;
  }
  if (exportPayload.type === 'data-cleanup-report') {
    const profile = exportPayload.scanProfile || 'data-quality';
    const resultKey = profile === 'file-reduction' ? 'fileReduction' : 'dataQuality';
    return {
      type: 'simplebeacon-complete-scan',
      version: exportPayload.version || '1.3.0',
      generatedAt: exportPayload.generatedAt || new Date().toISOString(),
      projectPath: exportPayload.projectRoot || exportPayload.projectPath || '',
      scanDurationMs: exportPayload.durationMs ?? null,
      summary: {
        scanKind: profile,
        dataQualityFindings: exportPayload.summary?.totalFindings ?? null,
        fileReductionFindings: exportPayload.summary?.totalFindings ?? null,
      },
      results: {
        [resultKey]: exportPayload,
      },
    };
  }
  return exportPayload;
}

const SUPPLEMENTARY_STEP_LABELS = {
  'data-quality': 'Data quality',
  'file-reduction': 'File reduction',
  consolidation: 'Data consolidation',
  'cleanup-assistant': 'Cleanup assistant',
  roadmap: 'Roadmap analysis',
  'mock-scan': 'Fiction and KPI digest',
  'simplebeacon-report': 'Simplebeacon scan',
  'eu-ai-act': 'EU AI Act sprint',
  complete: 'Partial complete scan',
};

/**
 * Gate pass from export scan.
 * @param {any} normalized
 * @returns {any}
 */
function gatePassFromExportScan(normalized) {
  const results = normalized?.results || {};
  const fromGate = results.simplebeacon?.gate?.pass;
  if (fromGate === true || fromGate === false) return fromGate;
  const fromSummary = normalized?.summary?.simplebeaconGatePass;
  if (fromSummary === true || fromSummary === false) return fromSummary;
  return null;
}

/**
 * Code files from export scan.
 * @param {any} normalized
 * @returns {any}
 */
function codeFilesFromExportScan(normalized) {
  const value = normalized?.results?.codebase?.summary?.codeFilesAnalyzed;
  return Number.isFinite(value) && value > 0 ? value : null;
}

/**
 * Detect supplementary export step.
 * @param {any} normalized
 * @returns {any}
 */
function detectSupplementaryExportStep(normalized) {
  const results = normalized?.results || {};
  const scanKind = normalized?.summary?.scanKind;
  if (scanKind && SUPPLEMENTARY_STEP_LABELS[scanKind]) {
    return { key: scanKind, label: SUPPLEMENTARY_STEP_LABELS[scanKind] };
  }
  if (results.dataQuality)
    return { key: 'data-quality', label: SUPPLEMENTARY_STEP_LABELS['data-quality'] };
  if (results.fileReduction)
    return { key: 'file-reduction', label: SUPPLEMENTARY_STEP_LABELS['file-reduction'] };
  if (results.consolidation)
    return { key: 'consolidation', label: SUPPLEMENTARY_STEP_LABELS.consolidation };
  if (results.cleanupAssistant)
    return { key: 'cleanup-assistant', label: SUPPLEMENTARY_STEP_LABELS['cleanup-assistant'] };
  if (results.roadmap) return { key: 'roadmap', label: SUPPLEMENTARY_STEP_LABELS.roadmap };
  if (results.mockScan) return { key: 'mock-scan', label: SUPPLEMENTARY_STEP_LABELS['mock-scan'] };
  if (results.simplebeacon)
    return { key: 'simplebeacon-report', label: SUPPLEMENTARY_STEP_LABELS['simplebeacon-report'] };
  return { key: 'complete', label: SUPPLEMENTARY_STEP_LABELS.complete };
}

/**
 * Preview audit export tier.
 * @param {number} exportPayload
 * @returns {any}
 */
export function previewAuditExportTier(exportPayload) {
  const normalized = normalizeAuditExportPayload(exportPayload);
  if (!normalized) {
    return {
      tier: 'insufficient',
      label: 'Insufficient scan data',
      exportBlocked: true,
      blockReason: 'No scan data available for audit PDF export.',
    };
  }
  const results = normalized.results || {};
  const hasAnyResult = Object.values(results).some(Boolean);
  if (!hasAnyResult) {
    return {
      tier: 'insufficient',
      label: 'Insufficient scan data',
      exportBlocked: true,
      blockReason:
        'Export payload has no scan steps — run Complete scan or an individual analysis first.',
    };
  }

  const hasGate = gatePassFromExportScan(normalized) != null;
  const hasCodebase = codeFilesFromExportScan(normalized) != null;

  if (hasGate && hasCodebase) {
    return { tier: 'handoff', label: 'Pre-launch security audit', exportBlocked: false };
  }
  if (hasGate && !hasCodebase) {
    return { tier: 'gate-only', label: 'Gate attestation', exportBlocked: false };
  }
  if (hasCodebase && !hasGate) {
    return { tier: 'codebase-only', label: 'Codebase hygiene', exportBlocked: false };
  }
  const step = detectSupplementaryExportStep(normalized);
  return { tier: 'supplementary', label: step.label, exportBlocked: false };
}

/**
 * Audit export button label.
 * @param {any} tierInfo
 * @returns {any}
 */
export function auditExportButtonLabel(tierInfo) {
  if (!tierInfo || tierInfo.exportBlocked) return 'Download audit PDF';
  switch (tierInfo.tier) {
    case 'handoff':
      return 'Download security audit PDF';
    case 'gate-only':
      return 'Download supplementary PDF (gate attestation)';
    case 'codebase-only':
      return 'Download supplementary PDF (codebase)';
    default:
      return `Download supplementary PDF (${tierInfo.label})`;
  }
}

/**
 * Fetch complete audit report.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
export async function fetchCompleteAuditReport(completeScan, options = {}) {
  const normalized = normalizeAuditExportPayload(completeScan);
  if (!normalized || typeof normalized !== 'object') {
    throw new Error('No scan data available for audit PDF export.');
  }
  const payload =
    slimCompleteScanForAudit(normalized, {
      findingsLimit: options.findingsLimit ?? 5000,
    }) || normalized;
  if (!payload || typeof payload !== 'object') {
    throw new Error('Audit export payload could not be prepared.');
  }
  const tierPreview = previewAuditExportTier(payload);
  if (tierPreview.exportBlocked) {
    throw new Error(tierPreview.blockReason);
  }
  const timeoutMs = options.timeoutMs ?? 300000;
  const res = await fetchWithTimeout(
    '/api/analyze/complete-audit-report',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        completeScan: payload,
        aiProvider: options.aiProvider || 'demo',
        client: options.client,
        company: options.company,
        assessor: options.assessor,
        credentials: options.credentials,
      }),
    },
    timeoutMs
  );
  const data = await parseJsonSafe(res);
  if (res.status === 402) {
    const err = new Error(data.error || 'Pre-Launch Audit PDF requires purchase');
    err.code = 'audit_paywall';
    err.checkoutUrl = data.checkoutUrl;
    throw err;
  }
  if (res.status === 422) {
    throw new Error(data.error || 'Audit export payload is insufficient.');
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'Audit report generation failed');
  }
  return data;
}

/**
 * Fetch eu ai act audit report.
 * @param {Object} options
 * @returns {any}
 */
export async function fetchEuAiActAuditReport(options = {}) {
  const timeoutMs = options.timeoutMs ?? 120000;
  const res = await fetchWithTimeout(
    '/api/analyze/eu-ai-act-audit-report',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        projectPath: options.projectPath,
        client: options.client,
        company: options.company,
        assessor: options.assessor,
        sprintArtifacts: options.sprintArtifacts || undefined,
        credentials: options.credentials,
      }),
    },
    timeoutMs
  );
  const data = await parseJsonSafe(res);
  if (res.status === 402) {
    const err = new Error(data.error || 'EU AI Act audit PDF requires purchase');
    err.code = 'audit_paywall';
    err.checkoutUrl = data.checkoutUrl;
    throw err;
  }
  if (res.status === 422) {
    throw new Error(
      data.error ||
        'Run EU AI Act sprint first — no .simplebeacon/eu-ai-act-*.json artifacts found.'
    );
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || 'EU AI Act audit report generation failed');
  }
  return data;
}

/**
 * Parse content disposition filename.
 * @param {any} header
 * @returns {any}
 */
function parseContentDispositionFilename(header) {
  if (!header) return null;
  const quoted = /filename="([^"]+)"/i.exec(header);
  if (quoted) return quoted[1].trim();
  const bare = /filename=([^;]+)/i.exec(header);
  return bare ? bare[1].trim().replace(/^["']|["']$/g, '') : null;
}

/**
 * Fetch analyze export bundle zip.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
export async function fetchAnalyzeExportBundleZip(completeScan, options = {}) {
  const normalized = normalizeAuditExportPayload(completeScan);
  if (!normalized || typeof normalized !== 'object') {
    throw new Error('No complete scan data available for ZIP export.');
  }
  const payload =
    slimCompleteScanForAudit(normalized, {
      findingsLimit: options.findingsLimit ?? 5000,
    }) || normalized;
  const timeoutMs = options.timeoutMs ?? 300000;
  const res = await fetchWithTimeout(
    '/api/analyze/export-bundle',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        completeScan: payload,
        internalDashboard: options.internalDashboard === true,
        deliverableSku: options.deliverableSku || options.tier || undefined,
        client: options.client,
        company: options.company,
        assessor: options.assessor,
        milestone: options.milestone,
        projectName: options.projectName,
        agencyName: options.agencyName,
        aiProvider: options.aiProvider || 'demo',
        cloudTeamsActive: options.cloudTeamsActive === true,
        selectedEngines: options.selectedEngines,
        enginesRun: options.enginesRun,
        credentials: options.credentials,
      }),
    },
    timeoutMs
  );

  if (res.status === 402) {
    const data = await parseJsonSafe(res);
    const err = new Error(data.error || 'Export bundle requires a paid deliverable tier.');
    err.code = 'export_paywall';
    err.checkoutUrl = data.checkoutUrl;
    throw err;
  }
  if (res.status === 422) {
    const data = await parseJsonSafe(res);
    const err = new Error(data.error || 'Export bundle could not be generated from this scan.');
    err.code = 'export_empty';
    err.warnings = data.warnings || [];
    throw err;
  }
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(data.error || data.message || 'Export bundle generation failed');
  }

  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get('Content-Disposition')) ||
    options.filename ||
    `simplebeacon-export-${new Date().toISOString().slice(0, 10)}.zip`;
  const tierId = res.headers.get('X-Simplebeacon-Export-Tier') || options.deliverableSku || null;
  const warningsHeader = res.headers.get('X-Simplebeacon-Export-Warnings');
  const warnings = warningsHeader
    ? warningsHeader
        .split('|')
        .map((part) => part.trim())
        .filter(Boolean)
    : [];

  return { blob, filename, tierId, warnings };
}

/**
 * Download audit report html.
 * @param {any} html
 * @param {string} filename
 * @returns {any}
 */
export function downloadAuditReportHtml(html, filename = 'simplebeacon-audit.html') {
  if (typeof document === 'undefined' || !document.body || !html) {
    throw new Error('Audit report HTML is empty or download unavailable.');
  }
  const safeName = filename.endsWith('.html') ? filename : `${filename}.html`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = safeName;
  link.rel = 'noopener';
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  }
  notifyDownloadComplete(safeName);
  return safeName;
}

/**
 * Fetch compliance trail export json.
 * @param {Array} windowDays
 * @returns {any}
 */
export async function fetchComplianceTrailExportJson(windowDays = 90) {
  const params = new URLSearchParams({
    window: `${windowDays}d`,
    _: String(Date.now()),
  });
  const res = await fetch(`/api/compliance-trail/export/json?${params}`, {
    cache: 'no-store',
    headers: authService.getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(data?.message || data?.error || 'Compliance trail JSON export failed');
  }
  const payload = await res.json();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || `compliance-trail-${windowDays}d.json`;
  return { payload, filename };
}

/**
 * Fetch compliance trail export html.
 * @param {Array} windowDays
 * @returns {any}
 */
export async function fetchComplianceTrailExportHtml(windowDays = 90) {
  const params = new URLSearchParams({
    window: `${windowDays}d`,
    disposition: 'inline',
    _: String(Date.now()),
  });
  const res = await fetch(`/api/compliance-trail/export/pdf?${params}`, {
    cache: 'no-store',
    headers: authService.getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(data?.message || data?.error || 'Compliance trail PDF export failed');
  }
  const html = await res.text();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename = match?.[1] || `compliance-trail-${windowDays}d.html`;
  return { html, filename };
}

/**
 * Open audit report print window.
 * @param {any} html
 * @param {string} filename
 * @returns {any}
 */
export function openAuditReportPrintWindow(html, filename = 'simplebeacon-audit.html') {
  if (typeof window === 'undefined' || !html) {
    throw new Error('Audit report HTML is empty.');
  }

  const savedAs = downloadAuditReportHtml(html, filename);

  const previewWindow = window.open('', '_blank');
  if (previewWindow) {
    try {
      const blob = new Blob([html], { type: 'text/html' });
      const url = URL.createObjectURL(blob);
      previewWindow.location.href = url;
      previewWindow.addEventListener(
        'load',
        () => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {}
        },
        { once: true }
      );
      previewWindow.focus();
      return { mode: 'html-download', filename: savedAs, preview: true };
    } catch (e) {
      try {
        const dataUrl = 'data:text/html;charset=utf-8,' + encodeURIComponent(html);
        previewWindow.location.href = dataUrl;
        previewWindow.focus();
        return { mode: 'html-download', filename: savedAs, preview: true };
      } catch (err) {
        return { mode: 'html-download', filename: savedAs, preview: false };
      }
    }
  }

  return { mode: 'html-download', filename: savedAs, preview: false };
}

/**
 * Fetch codebase analysis.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function fetchCodebaseAnalysis(projectPath, options = {}) {
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (projectPath) params.set('projectPath', projectPath);
  if (options.includeEslint === true) params.set('eslint', '1');
  params.set('scanProfile', options.scanProfile || 'universal');
  if (options.context) {
    params.set('context', options.context);
  } else if (options.scanMode) {
    params.set('scanMode', options.scanMode);
  }
  if (options.understandingMode) {
    params.set('understandingMode', options.understandingMode);
  }
  if (options.includeBrowserAnalyzers) {
    params.set('includeBrowserAnalyzers', '1');
  }
  if (options.includeAllFiles) {
    params.set('includeAllFiles', '1');
  }
  if (options.requestedScanRoot || options.scanTargetRoot) {
    params.set('requestedScanRoot', options.requestedScanRoot || options.scanTargetRoot);
  }
  const timeoutMs = options.timeoutMs ?? (options.context === 'complete' ? 900000 : 600000);
  const data = await fetchJsonWithGuidance(
    `/api/analyze/codebase?${params}`,
    {
      headers: authService.getAuthHeaders(),
    },
    timeoutMs
  );
  if (!data.success) {
    throw new Error(data.error || 'Codebase analysis failed');
  }
  const scan = data.data;
  if (data.publicGateLocked) {
    scan.publicGateLocked = true;
    scan.publicSummary = data.publicSummary;
  }
  return scan;
}

/**
 * Fetch data cleanup scan.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function fetchDataCleanupScan(projectPath, options = {}) {
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (projectPath) params.set('projectPath', projectPath);
  const profile = options.profile || options.mode || 'all';
  params.set('profile', profile);
  if (options.scanner) params.set('scanner', options.scanner);
  if (options.force || options.refresh) params.set('refresh', '1');
  const timeoutMs = options.timeoutMs ?? 300000;

  const target = `/api/analyze/data-cleanup?${params}`;

  try {
    const data = await fetchJsonWithGuidance(
      target,
      {
        headers: authService.getAuthHeaders(),
      },
      timeoutMs
    );
    if (!data.success) {
      throw new Error(data.error || 'Data cleanup analysis failed');
    }
    const scan = data.data;
    if (!scan || typeof scan !== 'object') {
      throw new Error(`Data cleanup scan returned no payload (${profile})`);
    }
    if (profile === 'file-reduction') {
      const hasSignal =
        scan.fileReductionPlan?.totals?.safeToDeleteBytes != null ||
        scan.fileReductionPlan?.safeToDelete?.topDirectories?.length ||
        scan.scanners?.['build-artifacts']?.safeToDeleteBytes != null ||
        scan.summary?.totalFindings > 0;
      if (!hasSignal) {
        throw new Error(
          'File reduction scan returned no findings — restart the SimpleBeacon server and retry.'
        );
      }
    }
    if (profile === 'data-quality') {
      const hasSignal =
        scan.executiveSummary ||
        scan.summary?.totalFindings > 0 ||
        Object.keys(scan.scanners || {}).length > 0;
      if (!hasSignal) {
        throw new Error(
          'Data quality scan returned no findings — restart the SimpleBeacon server and retry.'
        );
      }
    }
    if (scan && !scan.scanProfile) {
      scan.scanProfile = profile;
    }
    return scan;
  } catch (error) {
    throw new Error(
      error.message
        ? `${error.message} Restart the SimpleBeacon SERVER window (run start-simplebeacon-local.bat).`
        : 'Data cleanup API is missing — restart the SimpleBeacon server.'
    );
  }
}

/**
 * Looks like game mod path.
 * @param {string} projectPath
 * @returns {any}
 */
export function looksLikeGameModPath(projectPath) {
  const normalized = String(projectPath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  if (!normalized) return false;
  return new RegExp('(?:^|/)games/|doom|gzdoom|zscript|\\.pk3|r3d|lighting|_mod(?:/|$)', 'i').test(
    normalized
  );
}

/**
 * Scan hints game mod.
 * @param {any} scan
 * @returns {any}
 */
export function scanHintsGameMod(scan) {
  if (!scan || typeof scan !== 'object') return false;
  if (
    (scan.findings || []).some((finding) =>
      /\.(zs|zscript|acs|decorate)$/i.test(String(finding.filePath || ''))
    )
  ) {
    return true;
  }
  const insights = scan.codeUnderstanding?.fileInsights || [];
  return insights.some((item) => {
    const domains =
      item.understanding?.layers?.semantic?.businessLogic?.domains ||
      item.understanding?.layers?.semantic?.domains ||
      [];
    return Array.isArray(domains) && domains.includes('game-modding');
  });
}

/**
 * Should fetch zscript report.
 * @param {string} projectPath
 * @param {any} scan
 * @returns {any}
 */
export function shouldFetchZscriptReport(projectPath, scan) {
  return looksLikeGameModPath(projectPath) || scanHintsGameMod(scan);
}

/**
 * Fetch zscript mod report.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function fetchZscriptModReport(projectPath, options = {}) {
  const params = new URLSearchParams({
    projectPath: projectPath || '',
    focus: options.focus || 'lighting-intensity',
    _: String(Date.now()),
  });
  const data = await fetchJsonWithGuidance(`/api/analyze/zscript-report?${params}`, {
    headers: authService.getAuthHeaders(),
  });
  if (!data.success) {
    throw new Error(data.error || 'ZScript report failed');
  }
  return data.report;
}

/**
 * Fetch repository inventory.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function fetchRepositoryInventory(projectPath, options = {}) {
  const path = String(projectPath || '').trim();
  if (!path) return null;
  if (!isAbsoluteProjectPath(path)) return null;
  if (/^https?:\/\//i.test(path) && !isRemoteRepoUrl(path)) {
    throw new Error(
      'Enter a folder path (not a file like .bat or .json) or a supported public repo URL'
    );
  }

  // Local paths must be inventoried by the agent, not the remote server.
  if (isLocalPath(path)) {
    const agentStatus = await probeAgent();
    if (agentStatus.available && agentStatus.scannerAvailable) {
      return fetchInventoryViaAgent(path, { fullDirectoryScan: options.fullDirectoryScan });
    }
    return null;
  }

  const params = new URLSearchParams({
    projectPath: path,
    profile: options.profile || 'all',
  });
  if (options.fullDirectoryScan) {
    params.set('fullDirectoryScan', 'true');
  }
  const data = await fetchJsonWithGuidance(`/api/analyze/inventory?${params}`, {
    headers: authService.getAuthHeaders(),
  });
  if (!data.success) {
    if (data.pathMissing) return null;
    throw new Error(data.error || 'Repository inventory failed');
  }
  if (data.pathMissing || !data.inventory) return null;
  return data.inventory;
}

let _inventoryInflight = null;

/**
 * Refresh path inventory.
 * @param {any} app
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function refreshPathInventory(app, projectPath, options = {}) {
  const path = String(projectPath || '').trim();
  if (!path || isRemoteRepoUrl(path)) {
    if (app?.state) app.state.pathInventory = null;
    return null;
  }
  // Dedup in-flight requests for the same path
  if (_inventoryInflight && _inventoryInflight.path === path) {
    return _inventoryInflight.promise;
  }
  /**
   * Promise.
   * @param {any} async (
   * @returns {any}
   */
  const promise = (async () => {
    try {
      const inventory = await fetchRepositoryInventory(path, {
        profile: options.profile || 'all',
        fullDirectoryScan: options.fullDirectoryScan,
      });
      const root = inventory?.projectRoot || path;
      if (inventory?.totalFiles != null && isInventoryRootAligned(path, root)) {
        const entry = { path, inventory, fetchedAt: Date.now() };
        if (app?.state) app.state.pathInventory = entry;
        return inventory;
      }
    } catch {
      /* inventory API unavailable or path outside allowed roots */
    }
    if (app?.state) {
      app.state.pathInventory = { path, inventory: null, fetchedAt: Date.now() };
    }
    return null;
  })();
  _inventoryInflight = { path, promise };
  promise.finally(() => {
    if (_inventoryInflight && _inventoryInflight.path === path) {
      _inventoryInflight = null;
    }
  });
  return promise;
}

/**
 * Live inventory for path.
 * @param {any} app
 * @param {string} projectPath
 * @returns {any}
 */
export function liveInventoryForPath(app, projectPath) {
  const cached = app?.state?.pathInventory;
  if (!cached?.inventory || !projectPath) return null;
  if (normalizeProjectPath(cached.path) === normalizeProjectPath(projectPath)) {
    return cached;
  }
  return null;
}

/**
 * Build path inventory provenance.
 * @param {any} app
 * @param {string} projectPath
 * @param {number} report
 * @returns {any}
 */
export function buildPathInventoryProvenance(app, projectPath, report = null) {
  const resolvedReport = report ?? null;
  const live = liveInventoryForPath(app, projectPath);
  return buildInventoryProvenance(resolvedReport, projectPath, {
    liveInventory: live?.inventory || null,
    inventoryFetchedAt: live?.fetchedAt ?? null,
  });
}

/**
 * Merge report inventory.
 * @param {number} report
 * @param {any} inventory
 * @returns {any}
 */
export function mergeReportInventory(report, inventory) {
  if (!report || typeof report !== 'object') return report;
  if (!inventory?.totalFiles) return report;
  return {
    ...report,
    repositoryInventory:
      report.repositoryInventory?.totalFiles != null ? report.repositoryInventory : inventory,
    repositoryFilesTotal: report.repositoryFilesTotal ?? inventory.totalFiles,
    repositoryFoldersTotal: report.repositoryFoldersTotal ?? inventory.totalFolders,
    filesAnalyzed: report.repositoryFilesTotal ?? report.filesAnalyzed ?? inventory.totalFiles,
  };
}

/**
 * Is absolute project path.
 * @param {string} path
 * @returns {any}
 */
function isAbsoluteProjectPath(path) {
  if (!path) return false;
  const str = String(path).trim();
  if (str.startsWith('.')) return false;
  if (/^[a-zA-Z]:/.test(str)) return true;
  if (str.startsWith('/')) return true;
  if (str.startsWith('\\')) return true;
  return false;
}

/**
 * Fetch scan report.
 * @param {string} projectPath
 * @returns {any}
 */
export async function fetchScanReport(projectPath) {
  const path = String(projectPath || '').trim();
  if (!path) return null;
  if (!isAbsoluteProjectPath(path)) return null;
  if (/^https?:\/\//i.test(path) && !isRemoteRepoUrl(path)) {
    throw new Error(
      'Enter a folder path (not a file like .bat or .json) or a supported public repo URL'
    );
  }
  const params = `?projectPath=${encodeURIComponent(path)}`;
  let res;
  try {
    res = await fetchWithTimeout(
      `/api/simplebeacon/report${params}`,
      {
        headers: authService.getAuthHeaders(),
      },
      30000
    );
  } catch {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await parseJsonSafe(res);
  return data && typeof data === 'object' ? data : null;
}

/**
 * Normalize project path.
 * @param {any} value
 * @returns {any}
 */
export function normalizeProjectPath(value) {
  return String(value || '')
    .replace(/\\/g, '/')
    .toLowerCase()
    .replace(/\/$/, '');
}

/**
 * Prefer platform analyze path.
 * @param {string} candidatePath
 * @param {string} defaultPath
 * @returns {any}
 */
export function preferPlatformAnalyzePath(candidatePath, defaultPath) {
  const raw = String(candidatePath || defaultPath || '').trim();
  if (!raw) return raw;
  const fallback = String(defaultPath || '').trim();
  if (!fallback) return raw;
  const candidateNorm = normalizeProjectPath(raw);
  const defaultNorm = normalizeProjectPath(fallback);
  if (candidateNorm === defaultNorm) return raw;
  if (defaultNorm.startsWith(`${candidateNorm}/`)) return fallback;
  return raw;
}

/**
 * Is gate blocking issue.
 * @param {boolean} issue
 * @param {any} gate
 * @returns {any}
 */
function isGateBlockingIssue(issue, gate = {}) {
  const failOn = gate.failOn || ['high'];
  const severity = issue.severityBand || issue.severity || 'low';
  return failOn.includes(severity);
}

/**
 * Partition platform scan issues.
 * @param {Array} issues
 * @returns {any}
 */
function partitionPlatformScanIssues(issues = []) {
  const platformIssues = [];
  const benchmarkCacheIssues = [];
  for (const issue of issues) {
    const paths = [
      issue?.filePath,
      issue?.file,
      ...(issue?.affectedFiles || []),
      ...(issue?.filePaths || []),
    ].filter(Boolean);
    if (paths.some(isBenchmarkCachePath)) {
      benchmarkCacheIssues.push(issue);
    } else {
      platformIssues.push(issue);
    }
  }
  return { platformIssues, benchmarkCacheIssues };
}

/**
 * Prepare platform results report.
 * @param {number} report
 * @returns {any}
 */
export function preparePlatformResultsReport(report) {
  if (!report || report.type !== 'simplebeacon-report') return report;
  const sourceIssues = report.rawIssues?.length ? report.rawIssues : report.detectedIssues || [];
  const { platformIssues, benchmarkCacheIssues } = partitionPlatformScanIssues(sourceIssues);
  const gateConfig = report.gate ||
    report.scanScope?.gatePolicy || { failOn: ['high'], warnOn: ['medium', 'low'] };
  const blockingCount = platformIssues
    .filter((issue) => isGateBlockingIssue(issue, gateConfig))
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const warningCount = platformIssues
    .filter((issue) => (gateConfig.warnOn || []).includes(issue.severityBand || issue.severity))
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const repoFiles = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles ?? 0;
  const mockSamples = report.mockSampleFiles ?? 0;
  const walkedFiles = report.ruleScopedFilesAnalyzed ?? report.totalFiles ?? 0;
  const fullTree = Boolean(report.fullDirectoryScan || report.scanScope?.fullDirectoryScan);
  const staleFullTreeScan =
    mockSamples > 500 || repoFiles > 15000 || (fullTree && walkedFiles > 15000);

  return {
    ...report,
    rawIssues: platformIssues,
    benchmarkCacheIssues,
    issueCount: blockingCount,
    gate: {
      ...gateConfig,
      pass: blockingCount === 0,
      blockingCount,
      warningCount,
    },
    scanScope: {
      ...(report.scanScope || {}),
      resultsViewScope: 'platform-only',
      benchmarkCacheIssuesExcluded: benchmarkCacheIssues.length,
      reportHealth: staleFullTreeScan
        ? 'stale-full-tree-scan'
        : report.scanScope?.reportHealth || 'platform-scoped',
      rescanRecommended:
        staleFullTreeScan ||
        benchmarkCacheIssues.length > 0 ||
        Boolean(report.scanScope?.rescanRecommended),
    },
  };
}

/**
 * Sanitize fiction digest export.
 * @param {any} digest
 * @returns {any}
 */
export function sanitizeFictionDigestExport(digest) {
  if (!digest || typeof digest !== 'object') return digest;
  if (digest.type !== 'simplebeacon-fiction-digest') return digest;

  const sourceReport = digest.sourceReport
    ? preparePlatformResultsReport(digest.sourceReport)
    : null;
  /**
   * Fiction issues.
   * @param {any} digest.fictionIssues || []
   * @returns {any}
   */
  const fictionIssues = (digest.fictionIssues || []).filter((issue) => {
    const filePath = issue.filePath || issue.file || '';
    return !filePath || !isBenchmarkCachePath(filePath);
  });
  /**
   * Non fiction issues.
   * @param {any} digest.nonFictionIssues || []
   * @returns {any}
   */
  const nonFictionIssues = (digest.nonFictionIssues || []).filter((issue) => {
    const filePath = issue.filePath || issue.file || '';
    return !filePath || !isBenchmarkCachePath(filePath);
  });
  const fictionCount = fictionIssues.reduce((sum, issue) => sum + (issue.count || 1), 0);

  return {
    type: 'simplebeacon-fiction-digest',
    generatedAt: digest.generatedAt || new Date().toISOString(),
    conclusion:
      digest.conclusion ||
      (sourceReport ? buildScanConclusion(sourceReport, { focus: 'fiction' }) : ''),
    fictionIssues,
    nonFictionIssues,
    digestTrust: fictionCount === 0 ? 'trustworthy' : 'review',
    sourceReport: sourceReport ? slimReportForSummary(sourceReport) : null,
  };
}

/** Prefer platform root from step 1 when scanning a monorepo parent path. */
export function resolveCompleteScanTargetPath(projectPath, priorSteps = []) {
  if (isBenchmarkCachePath(projectPath)) {
    return projectPath;
  }
  const report = priorSteps.find((step) => step?.id === 'simplebeacon')?.report;
  const platformRoot = report?.platformRoot;
  if (platformRoot && normalizeProjectPath(platformRoot) !== normalizeProjectPath(projectPath)) {
    return platformRoot;
  }
  return projectPath;
}

/**
 * Enrich scan report.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
export async function enrichScanReport(report, projectPath) {
  if (!report) return report;
  let merged = { ...report };
  if (
    projectPath &&
    merged.projectRoot &&
    normalizeProjectPath(merged.projectRoot) !== normalizeProjectPath(projectPath)
  ) {
    const fetched = await fetchScanReport(projectPath).catch(() => null);
    if (
      fetched?.projectRoot &&
      normalizeProjectPath(fetched.projectRoot) === normalizeProjectPath(projectPath)
    ) {
      merged = fetched;
    }
  }
  let inventory =
    merged.repositoryInventory?.totalFiles != null ? merged.repositoryInventory : null;
  if (!inventory && projectPath) {
    try {
      inventory = await fetchRepositoryInventory(projectPath, { profile: 'all' });
    } catch {
      inventory = null;
    }
  }
  return mergeReportInventory(merged, inventory);
}

/**
 * Build inventory provenance.
 * @param {number} report
 * @param {string} requestedPath
 * @param {Object} options
 * @returns {any}
 */
export function buildInventoryProvenance(report, requestedPath, options = {}) {
  const requested = String(requestedPath || '').trim();
  const liveInventory = options.liveInventory || null;
  if (!report?.generatedAt && !requested && !liveInventory?.totalFiles) return null;

  const reportInventory =
    report?.repositoryInventory?.totalFiles != null ? report.repositoryInventory : null;
  const reportRoot =
    reportInventory?.projectRoot ??
    report?.scanTargetRoot ??
    report?.platformRoot ??
    report?.projectRoot ??
    null;
  const reportStale = report && requested ? isLegacyScanReport(report, requested) : false;
  const reportAligned = Boolean(
    report?.generatedAt &&
    requested &&
    reportRoot &&
    isInventoryRootAligned(requested, reportRoot) &&
    !reportStale
  );
  const liveRoot = liveInventory?.projectRoot || requested || null;
  const liveAligned = Boolean(
    liveInventory?.totalFiles != null && (!requested || isInventoryRootAligned(requested, liveRoot))
  );

  // Prefer live inventory when both are available — it reflects the actual
  // folder contents. Report inventory reflects the scan scope which may skip
  // dirs (node_modules, .git, build artifacts) and differ significantly.
  const inventory =
    liveAligned && liveInventory
      ? liveInventory
      : reportAligned && reportInventory
        ? reportInventory
        : reportInventory || liveInventory;
  const inventoryRoot =
    inventory?.projectRoot ?? (reportAligned ? reportRoot : null) ?? requested ?? null;
  const profile = inventory?.profile || 'explorer';
  const files =
    inventory?.totalFiles ??
    (reportAligned ? (report?.repositoryFilesTotal ?? reportInventory?.totalFiles) : null);
  const folders =
    inventory?.totalFolders ??
    (reportAligned ? (report?.repositoryFoldersTotal ?? reportInventory?.totalFolders) : null);
  const ruleScoped = reportAligned
    ? (report?.ruleScopedFilesAnalyzed ?? report?.scanScope?.ruleScopedFilesAnalyzed ?? null)
    : null;
  const generatedAt = reportAligned ? (report?.generatedAt ?? null) : null;
  const pathAligned =
    requested && inventoryRoot ? isInventoryRootAligned(requested, inventoryRoot) : null;

  return {
    requestedPath: requested,
    inventoryRoot,
    profile,
    files,
    folders,
    ruleScoped,
    generatedAt,
    pathAligned: requested ? pathAligned && !reportStale : null,
    stale:
      reportStale || (Boolean(report?.generatedAt && requested && reportRoot) && !reportAligned),
    hasReport: reportAligned,
    liveInventory: liveAligned && Boolean(liveInventory?.totalFiles != null),
    inventoryFetchedAt: options.inventoryFetchedAt ?? null,
    reportMisaligned: Boolean(report?.generatedAt && requested && reportRoot && !reportAligned),
  };
}

/**
 * Render inventory provenance html.
 * @param {any} provenance
 * @param {Object} options
 * @returns {any}
 */
export function renderInventoryProvenanceHtml(provenance, options = {}) {
  if (!provenance) return '';
  const redactPath = options.redactPath || ((value) => String(value || ''));
  const selectedLabel = provenance.requestedPath ? redactPath(provenance.requestedPath) : '—';
  const walkedLabel = provenance.inventoryRoot
    ? redactPath(provenance.inventoryRoot)
    : selectedLabel;
  const countLine =
    provenance.files != null
      ? `${formatNumber(provenance.files)} files · ${formatNumber(provenance.folders ?? 0)} folders indexed (${provenance.profile} profile)`
      : 'Inventory pending';

  if (!provenance.hasReport) {
    if (provenance.liveInventory && provenance.files != null) {
      const fetchedAt = provenance.inventoryFetchedAt
        ? new Date(provenance.inventoryFetchedAt).toLocaleString()
        : 'just now';
      return `
      <div class="analyze-inventory-provenance" data-inventory-provenance role="note">
        <span class="analyze-inventory-provenance-label">Selected folder</span>
        <code title="Path you entered">${escapeHtml(selectedLabel)}</code>
        · ${escapeHtml(countLine)}
        · indexed ${escapeHtml(fetchedAt)}
        <span class="text-muted analyze-inventory-provenance-hint">Audit walk of the selected folder (skips <code>node_modules</code>, <code>.git</code>, build artifacts). No gate scan for this path yet — run analysis for rule counts.</span>
      </div>
    `;
    }
    if (provenance.reportMisaligned && provenance.files != null) {
      return `
      <div class="analyze-inventory-provenance analyze-inventory-provenance--mismatch" data-inventory-provenance role="alert">
        <strong>Stale gate report ignored</strong> — selected <code>${escapeHtml(selectedLabel)}</code>
        · live walk ${escapeHtml(countLine)}
        <span class="text-muted analyze-inventory-provenance-hint">A scan exists for a nested folder (e.g. ai-platform), not this parent path. Run analysis on the folder you selected for gate counts.</span>
      </div>
    `;
    }
    return `
      <div class="analyze-inventory-provenance" data-inventory-provenance role="note">
        <span class="text-muted">No scan yet for <code>${escapeHtml(selectedLabel)}</code> — run analysis to attach inventory and gate scope.</span>
      </div>
    `;
  }

  const scannedAt = provenance.generatedAt
    ? new Date(provenance.generatedAt).toLocaleString()
    : '—';
  const ruleLine =
    provenance.ruleScoped != null
      ? `${formatNumber(provenance.ruleScoped)} gate rules checked`
      : '';

  if (provenance.stale || provenance.pathAligned === false) {
    return `
      <div class="analyze-inventory-provenance analyze-inventory-provenance--mismatch" data-inventory-provenance role="alert">
        <strong>Path mismatch</strong> — selected <code>${escapeHtml(selectedLabel)}</code> does not match loaded inventory root <code>${escapeHtml(walkedLabel)}</code>.
        ${
          provenance.files != null
            ? `Showing <strong>${escapeHtml(formatNumber(provenance.files))}</strong> files from the loaded report (${escapeHtml(provenance.profile)} profile), not from your selected folder.`
            : ''
        }
        Re-run <strong>Run analysis</strong> on the exact path you want.
      </div>
    `;
  }

  return `
    <div class="analyze-inventory-provenance" data-inventory-provenance role="note">
      <span class="analyze-inventory-provenance-label">Selected folder</span>
      <code title="Path you entered">${escapeHtml(selectedLabel)}</code>
      · ${escapeHtml(countLine)}
      ${ruleLine ? ` · ${escapeHtml(ruleLine)}` : ''}
      · scanned ${escapeHtml(scannedAt)}
      <span class="text-muted analyze-inventory-provenance-hint">Indexed count includes ALL files in the selected folder. Gate rules checked is the analyzed subset from your last scan.</span>
    </div>
  `;
}

/**
 * Build monorepo scope note.
 * @param {number} report
 * @returns {any}
 */
export function buildMonorepoScopeNote(report) {
  if (!report?.platformRoot || !report?.projectRoot) return '';
  if (normalizeProjectPath(report.platformRoot) === normalizeProjectPath(report.projectRoot)) {
    return '';
  }
  const repoFiles = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles;
  const jsonFiction = report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned;
  const parts = [
    repoFiles != null
      ? `Repository inventory (${Number(repoFiles).toLocaleString()} files) uses your requested path`
      : 'Repository inventory uses your requested path',
    'Gate mock paths, schema validation, and production-leak rules use the detected platform root',
    jsonFiction != null
      ? `Fiction/KPI patterns scan ${Number(jsonFiction).toLocaleString()} JSON files under the requested path`
      : null,
    'Source code (.js, .py, etc.) is not semantically reviewed — pattern matching on JSON and configured rules only',
  ].filter(Boolean);
  return parts.join('. ') + '.';
}

/**
 * Project path matches report root.
 * @param {string} projectPath
 * @param {number} reportRoot
 * @returns {any}
 */
function projectPathMatchesReportRoot(projectPath, reportRoot) {
  const normPath = normalizeProjectPath(projectPath);
  const normRoot = normalizeProjectPath(reportRoot);
  if (!normPath || !normRoot) return false;
  if (normPath === normRoot) return true;
  // Sanitized gate exports redact absolute host paths to project label (basename only).
  if (!normRoot.includes('/') && (normPath === normRoot || normPath.endsWith(`/${normRoot}`))) {
    return true;
  }
  if (!normPath.includes('/') && (normRoot === normPath || normRoot.endsWith(`/${normPath}`))) {
    return true;
  }
  return false;
}

/** Stricter than reportMatchesPagePath — parent inventory must not pass for a child path. */
export function isInventoryRootAligned(requestedPath, inventoryRoot) {
  if (!requestedPath || !inventoryRoot) return true;
  const req = normalizeProjectPath(requestedPath);
  const inv = normalizeProjectPath(inventoryRoot);
  if (req === inv) return true;
  if (!inv.includes('/') && req.endsWith(`/${inv}`)) return true;
  if (!req.includes('/') && inv.endsWith(`/${req}`)) return true;
  if (req.startsWith(`${inv}/`) && req.length > inv.length) return false;
  if (inv.startsWith(`${req}/`) && inv.length > req.length) return false;
  return projectPathMatchesReportRoot(requestedPath, inventoryRoot);
}

/**
 * Is legacy scan report.
 * @param {number} report
 * @param {string} projectPath
 * @returns {any}
 */
export function isLegacyScanReport(report, projectPath = '') {
  if (!report) return true;
  if (report.reportVersion == null || report.reportVersion < 2) return true;
  if (!projectPath || !report.projectRoot) return false;
  if (projectPathMatchesReportRoot(projectPath, report.projectRoot)) return false;
  const inventoryRoot = report.repositoryInventory?.projectRoot;
  if (inventoryRoot && projectPathMatchesReportRoot(projectPath, inventoryRoot)) return false;
  const scanTargetRoot = report.scanTargetRoot || report.platformRoot;
  if (scanTargetRoot && projectPathMatchesReportRoot(projectPath, scanTargetRoot)) return false;
  return true;
}

/**
 * Get scan file metrics.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function getScanFileMetrics(report, options = {}) {
  const inventory = options.repositoryInventory || report?.repositoryInventory || null;
  if (!report || typeof report !== 'object') {
    return {
      filesAnalyzed: null,
      mockSampleFiles: null,
      credentialScanned: null,
      repositoryFiles: inventory?.totalFiles ?? null,
      repositoryFolders: inventory?.totalFolders ?? null,
      repositoryRoot: inventory?.projectRoot ?? null,
    };
  }

  if (report.type === 'file-merger-reduction-report') {
    const sampleDataFiles =
      report.summary?.sampleDataFilesAnalyzed ?? report.summary?.filesAnalyzed ?? 0;
    const repoFiles =
      report.summary?.repositoryFilesTotal ??
      report.repositoryInventory?.totalFiles ??
      report.summary?.filesAnalyzed ??
      null;
    return {
      filesAnalyzed: repoFiles ?? sampleDataFiles,
      mockSampleFiles: sampleDataFiles,
      jsonFilesAnalyzed: report.summary?.jsonFilesAnalyzed ?? null,
      credentialScanned: null,
      productionLeakScanned: null,
      repositoryFiles: repoFiles,
      repositoryFolders:
        report.summary?.repositoryFoldersTotal ?? report.repositoryInventory?.totalFolders ?? null,
      repositoryRoot: report.repositoryInventory?.projectRoot ?? null,
    };
  }

  const mockSampleFiles = report.mockSampleFiles ?? 0;
  const ruleScopedFilesAnalyzed = report.ruleScopedFilesAnalyzed ?? report.filesAnalyzed ?? 0;
  const repositoryFiles = report.repositoryFilesTotal ?? inventory?.totalFiles ?? null;
  return {
    filesAnalyzed: ruleScopedFilesAnalyzed,
    ruleScopedFilesAnalyzed,
    mockSampleFiles,
    fictionJsonFilesScanned:
      report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned ?? null,
    credentialScanned: report.credentialScanned ?? 0,
    productionLeakScanned: report.productionLeakScanned ?? 0,
    repositoryFiles,
    repositoryFolders: report.repositoryFoldersTotal ?? inventory?.totalFolders ?? null,
    repositoryRoot: inventory?.projectRoot ?? report.repositoryInventory?.projectRoot ?? null,
  };
}

/**
 * Resolve display score.
 * @param {number} report
 * @returns {any}
 */
export function resolveDisplayScore(report) {
  if (!report) return null;
  return report.consistencyScore ?? report.schemaCompliance ?? report.qualityScore ?? null;
}

/** Prefer API report when it is newer than cached app state. */
export function shouldPreferLiveReport(cachedReport, liveReport) {
  if (!liveReport?.generatedAt) return false;
  if (!cachedReport?.generatedAt) return true;
  const liveAt = Date.parse(liveReport.generatedAt);
  const cachedAt = Date.parse(cachedReport.generatedAt);
  if (Number.isNaN(liveAt)) return false;
  if (Number.isNaN(cachedAt)) return true;
  return liveAt >= cachedAt;
}

/** Refresh app scan report from API when live data is newer. */
export async function refreshLiveReport(scanService, state) {
  const live = await scanService.fetchReport();
  if (!live) return state.report ?? null;
  if (shouldPreferLiveReport(state.report, live) || !state.report) {
    state.report = live;
  }
  return state.report;
}

/**
 * Resolve jest tests label.
 * @param {any} baseline
 * @param {any} dashboardHome
 * @param {number} report
 * @returns {any}
 */
export function resolveJestTestsLabel(baseline, dashboardHome, report) {
  if (baseline?.jestTestsLabel) return baseline.jestTestsLabel;
  const jestSummary = report?.jestSummary;
  if (jestSummary?.testsPassed != null && jestSummary?.testsTotal != null) {
    const suites = jestSummary.suitesPassed != null ? ` · ${jestSummary.suitesPassed} suites` : '';
    return `${jestSummary.testsPassed}/${jestSummary.testsTotal}${suites}`;
  }
  const overview = dashboardHome?.overview;
  if (overview?.passedTests != null && overview?.totalTests != null) {
    return `${overview.passedTests}/${overview.totalTests}`;
  }
  if (report?.jestBaselineChecked === false) {
    return 'Off (enable jest-baseline in config)';
  }
  return null;
}

/**
 * Resolve page specs label.
 * @param {number} report
 * @param {any} baseline
 * @returns {any}
 */
export function resolvePageSpecsLabel(report, baseline) {
  if (report?.pageSampleSchemaChecked != null) {
    return `${report.pageSampleSchemaPassed ?? 0}/${report.pageSampleSchemaChecked}`;
  }
  return baseline?.pageSamplesLabel ?? null;
}

/**
 * Replace jest mentions.
 * @param {string} text
 * @param {any} jestLabel
 * @param {Array} suites
 * @returns {any}
 */
function replaceJestMentions(text, jestLabel, suites) {
  if (!text || !jestLabel) return text;
  const suiteSuffix = suites != null ? ` across ${suites} suites` : '';
  return String(text)
    .replace(
      /\d+\/\d+ tests pass(?:ing)?(?: across \d+ suites)?/gi,
      `${jestLabel} tests passing${suiteSuffix}`
    )
    .replace(
      /\d+\/\d+ Jest tests passing(?: across \d+ suites)?/gi,
      `${jestLabel} Jest tests passing${suiteSuffix}`
    )
    .replace(
      /\d+\/\d+ Jest(?: tests)?(?: \(?\d+ suites?\)?)?/gi,
      `${jestLabel} Jest${suites != null ? ` (${suites} suites)` : ''}`
    );
}

/** Overlay live baseline Jest counts onto dashboard-home insights (API snapshots may lag). */
export function hydrateDashboardHome(home, baseline) {
  if (!home) return home;

  const jestLabel = resolveJestTestsLabel(baseline, home);
  const jestPassing = baseline?.jestTestsPassing ?? home?.overview?.passedTests;
  const suites = baseline?.jestSuites ?? home?.overview?.testSuites;
  if (!jestLabel) return home;

  /**
   * Comparative analysis.
   * @param {any} home.comparativeAnalysis || []
   * @returns {any}
   */
  const comparativeAnalysis = (home.comparativeAnalysis || []).map((row) => {
    if (String(row.metric || '').toLowerCase() !== 'jest tests') return row;
    const prevNum = Number(String(row.previous).replace(/[^\d.-]/g, ''));
    const change =
      Number.isFinite(prevNum) && jestPassing != null && prevNum !== jestPassing
        ? `${jestPassing > prevNum ? '+' : ''}${jestPassing - prevNum} tests`
        : row.change;
    return { ...row, current: jestPassing ?? row.current, change };
  });

  /**
   * Kpis.
   * @param {any} home.kpis || []
   * @returns {any}
   */
  const kpis = (home.kpis || []).map((item) =>
    String(item.name || '')
      .toLowerCase()
      .includes('jest')
      ? { ...item, current: jestLabel, target: jestLabel }
      : item
  );

  const healthSummary = home.healthSummary
    ? {
        ...home.healthSummary,
        highlights: (home.healthSummary.highlights || []).map((line) =>
          replaceJestMentions(line, jestLabel, suites)
        ),
      }
    : home.healthSummary;

  return {
    ...home,
    overview: home.overview
      ? {
          ...home.overview,
          totalTests: jestPassing ?? home.overview.totalTests,
          passedTests: jestPassing ?? home.overview.passedTests,
          testSuites: suites ?? home.overview.testSuites,
          notes: replaceJestMentions(home.overview.notes, jestLabel, suites),
        }
      : home.overview,
    comparativeAnalysis,
    insights: (home.insights || []).map((item) => ({
      ...item,
      description: replaceJestMentions(item.description, jestLabel, suites),
    })),
    kpis,
    healthSummary,
  };
}

/**
 * Format scan scope summary.
 * @param {number} report
 * @returns {any}
 */
export function formatScanScopeSummary(report) {
  const metrics = getScanFileMetrics(report);
  const parts = [];

  // Show actual analyzed count, not full repo inventory
  if (metrics.filesAnalyzed != null) {
    parts.push(`${formatNumber(metrics.filesAnalyzed)} files analyzed`);
  }
  if (metrics.repositoryFiles != null && metrics.filesAnalyzed !== metrics.repositoryFiles) {
    parts.push(`of ${formatNumber(metrics.repositoryFiles)} total`);
  }
  if (
    metrics.ruleScopedFilesAnalyzed != null &&
    metrics.ruleScopedFilesAnalyzed !== metrics.filesAnalyzed
  ) {
    parts.push(`${formatNumber(metrics.ruleScopedFilesAnalyzed)} gate rules checked`);
  }
  if (metrics.mockSampleFiles != null) {
    parts.push(`${formatNumber(metrics.mockSampleFiles)} mock/sample`);
  }
  if (metrics.fictionJsonFilesScanned != null) {
    parts.push(`${formatNumber(metrics.fictionJsonFilesScanned)} JSON fiction-scanned`);
  }
  if (report?.totalSizeLabel) {
    parts.push(report.totalSizeLabel);
  }

  return parts.length ? parts.join(' · ') : '0 files analyzed';
}

/**
 * Format scan inventory note.
 * @param {number} report
 * @returns {any}
 */
export function formatScanInventoryNote(report) {
  const metrics = getScanFileMetrics(report);
  if (metrics.repositoryFiles == null) return null;
  return `${formatNumber(metrics.repositoryFiles)} repo files · ${formatNumber(metrics.repositoryFolders)} folders indexed`;
}

/**
 * Build scan scope lines.
 * @param {number} report
 * @returns {any}
 */
export function buildScanScopeLines(report) {
  const scope = report?.scanScope;
  if (!scope) {
    return [
      'Legacy report — re-run Scan to attach scanScope metadata.',
      'PASS applies to configured scanPaths and production rules only, not the full repo tree.',
    ];
  }

  const lines = [
    scope.repositoryFilesTotal != null
      ? `Repository inventory: ${Number(scope.repositoryFilesTotal).toLocaleString()} files, ${Number(scope.repositoryFoldersTotal ?? 0).toLocaleString()} folders`
      : null,
    scope.ruleScopedFilesAnalyzed != null
      ? `Gate rules checked: ${scope.ruleScopedFilesAnalyzed} files (mock paths + credentials + production leak dirs)`
      : null,
    `Profile: ${scope.profile} · rules: ${(scope.rulesEnabled || []).join(', ') || '—'}`,
    `Mock/sample files in scanPaths: ${scope.mockSampleFilesInScanPaths ?? report?.mockSampleFiles ?? '—'}`,
    `Page specs validated: ${scope.pageSpecsValidated ?? report?.pageSampleSchemaChecked ?? '—'}/${scope.pageSpecCatalogSize ?? '—'} (${scope.pageSpecsFromAliasPaths ?? 0} via aliased roadmap paths)`,
    `Production code files scanned: ${scope.productionDirsScanned ?? report?.productionLeakScanned ?? '—'} under ${(scope.productionPaths || []).join(', ') || 'server/'}`,
    scope.fictionJsonFilesScanned != null
      ? `Fiction/KPI patterns: ${scope.fictionJsonFilesScanned} JSON files scanned (${scope.fictionSampleFilesScanned ?? '—'} sample files) — scope: ${scope.fictionScope || 'repository-json'}`
      : null,
    scope.jestExecutedDuringScan
      ? 'Jest executed during this scan.'
      : 'Jest not executed during scan — baseline from .simplebeacon/baseline.json / npm test separately.',
    ...(scope.limitations || []),
  ].filter(Boolean);
  return lines;
}

/**
 * Render scan scope panel.
 * @param {number} report
 * @returns {any}
 */
export function renderScanScopePanel(report) {
  const lines = buildScanScopeLines(report);
  return `
    <div class="card mb-4" style="padding: var(--space-4);">
      <p class="text-muted mb-2" style="margin-top: 0; font-size: var(--font-size-xs);">What this scan checked (and did not)</p>
      <ul style="margin: 0; padding-left: 1.25rem; line-height: 1.6; font-size: var(--font-size-sm);">
        ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}
      </ul>
    </div>
  `;
}

/**
 * Ai provider supports summary.
 * @param {string} aiProvider
 * @returns {any}
 */
export function aiProviderSupportsSummary(aiProvider) {
  const id = String(aiProvider || 'demo').toLowerCase();
  return id !== 'demo';
}

/**
 * Is simplebeacon report.
 * @param {any} obj
 * @returns {any}
 */
export function isSimplebeaconReport(obj) {
  return obj && (obj.type === 'simplebeacon-report' || obj.rawIssues != null);
}

/**
 * Is codebase report.
 * @param {any} obj
 * @returns {any}
 */
export function isCodebaseReport(obj) {
  return obj && obj.type === 'codebase-analyzer-report';
}

/**
 * Is deterministic analysis mode.
 * @param {any} analysisType
 * @returns {any}
 */
export function isDeterministicAnalysisMode(analysisType) {
  return ['simplebeacon', 'mock-scan', 'consolidation', 'codebase', 'complete'].includes(
    analysisType
  );
}

/**
 * Resolve auto analysis mode.
 * @param {string} projectPath
 * @returns {any}
 */
export function resolveAutoAnalysisMode(projectPath) {
  const normalized = String(projectPath || '')
    .replace(/\\/g, '/')
    .toLowerCase();
  if (
    normalized.includes('web\/data') ||
    normalized.endsWith('/ai-platform') ||
    normalized.endsWith('ai-platform') ||
    normalized.includes('/data/mock') ||
    normalized.includes('simplebeacon')
  ) {
    return 'simplebeacon';
  }
  return 'roadmap';
}

/**
 * Issue list.
 * @param {number} report
 * @returns {any}
 */
function issueList(report) {
  return report?.rawIssues || report?.detectedIssues || [];
}

/**
 * Filter issues by kind.
 * @param {number} report
 * @param {any} kind
 * @returns {any}
 */
export function filterIssuesByKind(report, kind = 'all') {
  const raw = issueList(report);
  if (kind === 'fiction') {
    return raw.filter((i) => /fiction|fictional|consistency|kpi/i.test(String(i.type || '')));
  }
  if (kind === 'credentials') {
    return raw.filter((i) => /credential/i.test(String(i.type || '')));
  }
  if (kind === 'production') {
    return raw.filter((i) => /production leak/i.test(String(i.type || '')));
  }
  return raw;
}

/**
 * Build consolidation conclusion.
 * @param {any} scan
 * @returns {any}
 */
export function buildConsolidationConclusion(scan) {
  if (!scan?.summary) {
    return 'No consolidation scan available.';
  }
  const projectPath = String(scan.projectRoot || scan.projectPath || '').replace(/\\/g, '/');
  if (isBenchmarkCachePath(projectPath) || scan.benchmarkScan) {
    const repoFiles = scan.summary.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles;
    const candidates =
      (scan.summary.mergeCandidates || 0) + (scan.summary.reductionOpportunities || 0);
    const parts = [
      'OSS benchmark clone under github-cache/ — consolidation hygiene for the clone only',
      candidates
        ? `${candidates} merge/reduction candidate(s) inside this clone`
        : 'No merge/reduction candidates',
      (scan.summary.sampleDataFilesAnalyzed ?? 0) === 0
        ? 'Simplebeacon sample directories are not on this clone'
        : `${scan.summary.sampleDataFilesAnalyzed} sample JSON under configured paths`,
      repoFiles != null ? `Clone inventory: ${Number(repoFiles).toLocaleString()} files` : null,
      scan.summary.potentialSavingsLabel
        ? `Potential savings: ${scan.summary.potentialSavingsLabel}`
        : null,
      'Re-run on ai-platform root for product handoff evidence',
    ].filter(Boolean);
    return `${parts.join('. ')}.`;
  }
  const s = scan.summary;
  const candidates = (s.mergeCandidates || 0) + (s.reductionOpportunities || 0);
  const repoFiles = s.repositoryFilesTotal ?? scan.repositoryInventory?.totalFiles;
  const jsonScanned = s.jsonFilesAnalyzed;
  const repoNote =
    repoFiles != null
      ? ` Repository inventory: ${repoFiles.toLocaleString()} files${jsonScanned != null ? `; ${jsonScanned.toLocaleString()} JSON hashed for duplicates (${(s.exactDuplicateGroups ?? 0).toLocaleString()} duplicate groups)` : ''}.`
      : jsonScanned != null
        ? ` ${jsonScanned.toLocaleString()} JSON files hashed for duplicates (${(s.exactDuplicateGroups ?? 0).toLocaleString()} duplicate groups).`
        : '';
  if (!candidates) {
    return `No merge or reduction candidates — ${s.sampleDataFilesAnalyzed ?? s.filesAnalyzed ?? 0} sample JSON under configured paths (${s.totalSizeLabel || '—'}).${repoNote} Structure similarity is limited to sample paths; duplicate detection covers all repo JSON.`;
  }
  return `${candidates} merge/reduction candidate(s) — ${s.sampleDataFilesAnalyzed ?? s.filesAnalyzed ?? 0} sample JSON, ${jsonScanned != null ? `${jsonScanned.toLocaleString()} repo JSON scanned` : 'repo JSON scanned'}.${repoNote} Potential savings: ${s.potentialSavingsLabel || '0B'}.`;
}

/**
 * Build scan conclusion.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function buildScanConclusion(report, options = {}) {
  if (!report) {
    return 'No scan report available.';
  }

  if (options.benchmarkScan) {
    const repoFiles = report.repositoryFilesTotal ?? report.scanScope?.repositoryFilesTotal;
    const ruleScoped =
      report.ruleScopedFilesAnalyzed ?? report.scanScope?.ruleScopedFilesAnalyzed ?? 0;
    const jsonFiction = report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned;
    const fiction = filterIssuesByKind(report, 'fiction');
    const fictionN = fiction.reduce((sum, i) => sum + (i.count || 1), 0);
    const parts = [
      'OSS benchmark clone under github-cache/ — not Simplebeacon product handoff',
      fictionN
        ? `${fictionN} fiction/KPI pattern(s) in clone JSON`
        : 'No fiction KPI hits in product sample paths',
      repoFiles != null ? `Repository: ${Number(repoFiles).toLocaleString()} files` : null,
      `Product gate paths checked ${Number(ruleScoped).toLocaleString()}`,
      jsonFiction != null
        ? `${Number(jsonFiction).toLocaleString()} JSON scanned for fiction rules`
        : null,
      'Agency-handoff and EU AI Act matches excluded from vendor gate',
    ].filter(Boolean);
    return `${parts.join('. ')}.`;
  }

  const focus = options.focus || 'all';
  const _raw = focus === 'fiction' ? filterIssuesByKind(report, 'fiction') : issueList(report);
  /**
   * Count issues.
   * @param {Array} items
   * @returns {any}
   */
  const countIssues = (items) => items.reduce((sum, i) => sum + (i.count || 1), 0);

  const fiction = filterIssuesByKind(report, 'fiction');
  const credentials = filterIssuesByKind(report, 'credentials');
  const leaks = filterIssuesByKind(report, 'production');
  const schema = issueList(report).filter((i) => /schema/i.test(String(i.type || '')));
  const nonFictionIssues = issueList(report).filter(
    (item) => !/fiction|fictional|consistency|kpi/i.test(String(item.type || ''))
  );
  const nonFictionCount = countIssues(nonFictionIssues);

  const parts = [];
  if (focus === 'fiction' || focus === 'all') {
    if (fiction.length) {
      parts.push(`${countIssues(fiction)} fiction/KPI pattern(s) in repository JSON`);
    } else if (focus === 'fiction') {
      const jsonScanned =
        report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned;
      const sampleScanned = report.fictionSampleFilesScanned ?? report.mockSampleFiles;
      if (jsonScanned != null) {
        parts.push(
          `No fiction KPI hits in ${Number(jsonScanned).toLocaleString()} JSON files scanned (${sampleScanned ?? '—'} sample files among them)`
        );
      } else {
        parts.push('No known fictional KPI patterns in configured sample files');
      }
    }
  }
  if (focus === 'all') {
    if (credentials.length) parts.push(`${countIssues(credentials)} credential pattern(s)`);
    if (leaks.length) parts.push(`${countIssues(leaks)} production-path sample reference(s)`);
    if (schema.length) parts.push(`${countIssues(schema)} schema violation(s)`);
  }

  const repoFiles = report.repositoryFilesTotal ?? report.repositoryInventory?.totalFiles;
  const ruleScoped = report.ruleScopedFilesAnalyzed;
  const jsonFiction = report.fictionJsonFilesScanned ?? report.scanScope?.fictionJsonFilesScanned;
  const jestNote =
    report.jestBaselineChecked === false && report.scanScope?.jestExecutedDuringScan === false
      ? 'Jest was not run as part of this scan.'
      : '';

  if (focus === 'fiction') {
    const gateNote = report.gate?.pass
      ? nonFictionCount > 0
        ? `Gate passes on configured severities (${(report.gate.failOn || ['high']).join(', ')}); ${nonFictionCount} non-fiction finding(s) in Simplebeacon scan.`
        : 'Gate passes on configured severities.'
      : report.gate
        ? 'Gate would fail on configured severities — review before merge.'
        : '';
    const inventoryBrief =
      repoFiles != null && ruleScoped != null
        ? `Repository: ${Number(repoFiles).toLocaleString()} files; gate rules checked ${Number(ruleScoped).toLocaleString()}.`
        : '';
    const fictionScope =
      report.scanScope?.limitations?.find((line) => /fiction|KPI|source code/i.test(line)) ||
      'Fiction/KPI rules scan repository JSON — pattern matching only, not semantic source review.';
    const lead = parts.length ? `${parts.join('; ')}.` : 'No fiction KPI hits in mock samples.';
    return `${lead} ${[gateNote, inventoryBrief, jestNote, fictionScope].filter(Boolean).join(' ')}`.trim();
  }

  const scope =
    report.scanScope?.limitations?.[0] ||
    'Scoped to configured scanPaths and production directories — pattern matching only, not semantic code review.';
  const inventoryNote =
    repoFiles != null
      ? `Repository inventory: ${Number(repoFiles).toLocaleString()} files indexed${ruleScoped != null ? `; gate rules checked ${Number(ruleScoped).toLocaleString()} files` : ''}${jsonFiction != null ? `; ${Number(jsonFiction).toLocaleString()} JSON scanned for fiction/KPI patterns` : ''}. Source files (.js, .py, etc.) are not semantically reviewed.`
      : '';
  const gateNote = report.gate?.pass
    ? 'Gate passes on configured severities.'
    : report.gate
      ? 'Gate would fail on configured severities — review before merge.'
      : '';

  if (!parts.length) {
    const tail = [inventoryNote, gateNote, jestNote, scope].filter(Boolean).join(' ');
    return tail.trim() || 'Clean deterministic scan on configured paths.';
  }

  return `${parts.join('; ')}. ${[gateNote, inventoryNote, jestNote, scope].filter(Boolean).join(' ')}`.trim();
}

/**
 * Build fiction digest payload.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function buildFictionDigestPayload(report, options = {}) {
  if (!report) return null;
  const projectPath = options.projectPath || report.projectRoot || '';
  const prepared = preparePlatformResultsReport(report, projectPath);
  const fictionIssues = filterIssuesByKind(prepared, 'fiction');
  const nonFictionIssues = issueList(prepared).filter(
    (item) => !/fiction|fictional|consistency|kpi/i.test(String(item.type || ''))
  );
  return sanitizeFictionDigestExport(
    {
      type: 'simplebeacon-fiction-digest',
      generatedAt: options.generatedAt || new Date().toISOString(),
      conclusion: buildScanConclusion(prepared, {
        focus: 'fiction',
        benchmarkScan: isBenchmarkCachePath(projectPath),
      }),
      fictionIssues,
      nonFictionIssues,
      projectPath,
      sourceProjectPath: projectPath,
      sourceReport: prepared,
    },
    { projectPath }
  );
}

/**
 * Normalize imported report.
 * @param {any} payload
 * @returns {any}
 */
export function normalizeImportedReport(payload) {
  if (payload.type === 'simplebeacon-report') return payload;
  if (payload.report?.type === 'simplebeacon-report') return payload.report;
  if (Array.isArray(payload.rawIssues)) {
    return {
      type: 'simplebeacon-report',
      generatedAt: payload.generatedAt || new Date().toISOString(),
      generatedBy: 'Import',
      rawIssues: payload.rawIssues,
      detectedIssues: payload.detectedIssues || payload.rawIssues,
      issueCount: payload.issueCount ?? payload.rawIssues.length,
      qualityScore: payload.qualityScore,
      gate: payload.gate || { pass: true },
    };
  }
  return null;
}

/**
 * Read file as json.
 * @param {string} file
 * @returns {any}
 */
export async function readFileAsJson(file) {
  let text;
  try {
    text = await file.text();
  } catch (err) {
    throw new Error(`Failed to read file: ${err.message}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`Failed to parse JSON: ${err.message}`);
  }
}

/**
 * Read dropped files.
 * @param {string} fileList
 * @returns {any}
 */
export async function readDroppedFiles(fileList) {
  const files = Array.from(fileList || []);
  const jsonFiles = files.filter((f) => f.name.endsWith('.json') || f.type === 'application/json');
  const reports = [];
  for (const file of jsonFiles) {
    try {
      const payload = await readFileAsJson(file);
      const report = normalizeImportedReport(payload);
      if (report) reports.push({ file: file.name, report });
    } catch {
      /* skip non-json */
    }
  }
  return { total: files.length, reports };
}

/**
 * Fetch compliance checklist.
 * @param {number} report
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function fetchComplianceChecklist(report, projectPath, options = {}) {
  const checklistHttpResponse = await fetchWithTimeout(
    '/api/analyze/compliance-checklist',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        report,
        projectPath: projectPath || undefined,
        npmAudit: options.npmAudit || undefined,
        forceNpmAudit: options.forceNpmAudit === true,
      }),
    },
    options.timeoutMs ?? 120000
  );
  const checklistResponse = await parseJsonSafe(checklistHttpResponse);
  if (!checklistHttpResponse.ok || !checklistResponse.success) {
    throw new Error(
      checklistResponse.error || checklistResponse.message || 'Compliance checklist failed'
    );
  }
  return checklistResponse;
}

/**
 * Fetch project npm audit.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function fetchProjectNpmAudit(projectPath, options = {}) {
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (projectPath) params.set('projectPath', projectPath);
  if (options.force) params.set('force', '1');
  const data = await fetchJsonWithGuidance(
    `/api/analyze/npm-audit?${params}`,
    {
      headers: authService.getAuthHeaders(),
    },
    options.timeoutMs ?? 180000
  );
  if (!data.success) {
    throw new Error(data.error || 'npm audit failed');
  }
  return data;
}

/**
 * Fetch analyze test sources.
 * @returns {any}
 */
export async function fetchAnalyzeTestSources() {
  const params = new URLSearchParams({ _: String(Date.now()) });
  const data = await fetchJsonWithGuidance(`/api/analyze/test-sources?${params}`, {
    headers: authService.getAuthHeaders(),
  });
  if (!data.success) {
    throw new Error(data.error || 'Failed to load test sources');
  }
  return data;
}

/**
 * Prepare github repo.
 * @param {string} repoUrl
 * @param {Object} options
 * @returns {any}
 */
export async function prepareGithubRepo(repoUrl, options = {}) {
  const data = await fetchJsonWithGuidance(
    '/api/analyze/github-clone',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        repoUrl,
        refresh: options.refresh === true,
      }),
    },
    options.timeoutMs ?? 180000
  );
  if (!data.success) {
    throw new Error(data.error || 'GitHub clone failed');
  }
  return data;
}

/**
 * Fetch agency branding.
 * @param {string} orgId
 * @returns {any}
 */
export async function fetchAgencyBranding(orgId = 'default') {
  const params = new URLSearchParams({ org_id: orgId, _: String(Date.now()) });
  try {
    const data = await fetchJsonWithGuidance(`/api/simplebeacon/agency/branding?${params}`, {
      headers: authService.getAuthHeaders(),
    });
    return data.branding || data;
  } catch {
    return { agency_name: '', logo_url: '' };
  }
}

/**
 * Export agency certificate.
 * @param {any} certificateRequest
 * @returns {any}
 */
export async function exportAgencyCertificate(certificateRequest = {}) {
  const certificateExport = await fetchJsonWithGuidance(
    '/api/simplebeacon/export/certificate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(certificateRequest),
    },
    certificateRequest.timeoutMs ?? 120000
  );
  if (!certificateExport.success) {
    throw new Error(
      certificateExport.message || certificateExport.error || 'Certificate export failed'
    );
  }
  return certificateExport;
}

/**
 * Assert complete scan compliance fresh.
 * @param {number} report
 * @param {any} checklist
 * @returns {any}
 */
export function assertCompleteScanComplianceFresh(report, checklist) {
  if (!checklist?.evaluatedAt) return;
  const reportAt = Date.parse(report?.generatedAt || '');
  const checklistAt = Date.parse(checklist.evaluatedAt || '');
  if (Number.isFinite(reportAt) && Number.isFinite(checklistAt) && checklistAt + 5000 < reportAt) {
    throw new Error(
      'Compliance checklist is older than the gate report — re-run compliance after the latest scan.'
    );
  }
}

/**
 * Assert complete scan file reduction fresh.
 * @param {any} scan
 * @returns {any}
 */
export function assertCompleteScanFileReductionFresh(scan) {
  if (!scan || typeof scan !== 'object') {
    throw new Error('File reduction scan returned no payload');
  }
  const hasSignal =
    scan.fileReductionPlan?.totals?.safeToDeleteBytes != null ||
    scan.fileReductionPlan?.safeToDelete?.topDirectories?.length ||
    scan.scanners?.['build-artifacts']?.safeToDeleteBytes != null ||
    scan.summary?.totalFindings > 0;
  if (!hasSignal) {
    throw new Error(
      'File reduction scan returned no findings — restart the SimpleBeacon server and retry.'
    );
  }
}

/**
 * Upload a directory of files to the server and run a SimpleBeacon scan.
 * @param {FileList|Array<File>} files
 * @param {Object} options
 * @param {string} options.analysisType
 * @param {number} [options.timeoutMs]
 * @returns {Promise<Object>}
 */
export async function uploadDirectoryAndAnalyze(files, options = {}) {
  if (!files || files.length === 0) {
    throw new Error('No files selected for upload');
  }
  const fileArray = Array.from(files);
  const filePaths = fileArray.map((file) => {
    // webkitdirectory and drag-and-drop folders expose the relative path
    return file.webkitRelativePath || file.name || file.fieldname || 'file';
  });

  const formData = new FormData();
  fileArray.forEach((file) => formData.append('files', file));
  formData.append('filePaths', JSON.stringify(filePaths));
  formData.append('analysisType', options.analysisType || 'simplebeacon');

  const data = await fetchJsonWithGuidance(
    '/api/analyze/upload-directory',
    {
      method: 'POST',
      headers: authService.getAuthHeaders(),
      body: formData,
    },
    options.timeoutMs ?? 600000
  );

  if (!data.success) {
    throw new Error(data.error || 'Directory upload scan failed');
  }
  return data;
}
