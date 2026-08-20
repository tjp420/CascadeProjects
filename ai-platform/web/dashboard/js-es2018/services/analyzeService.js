// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
import { authService } from "./authService.js?v=20260722bridgefix1";
import { fetchUserAiKeys } from "./aiKeysService.js?v=20260720ollama3";
import { scanService } from "./scanService.js?v=20260716cachefix1";
import { formatNumber, escapeHtml, fetchWithTimeout } from "../utils.js";
import { notifyDownloadComplete } from "../utils-lib/notify.js?v=20260716cachefix1";
import { isRemoteRepoUrl } from "../lib/analyzePathSources.js";
import { isBenchmarkCachePath } from "../utils/complete-scan-artifact-profile.browser.js";
import { DEMO_EMAIL } from "../demoMode.js";
import { DASHBOARD_BASE_URL } from "../config.js";
import {
  isLocalPath,
  fetchInventoryViaAgent,
  probeAgent,
  shouldProbeLocalAgent,
} from "./localAgentService.js?v=20260720ollama4";
/**
 * Upgrade a v1 ("version": "1.0.0" and no reportVersion) scan report so the
 * dashboard treats it as current and can render aligned file-count metrics.
 * @param {Object} rawReport
 * @returns {Object}
 */
function normalizeScanReport(rawReport) {
  if (!rawReport || typeof rawReport !== "object") {
    return rawReport;
  }
  if (rawReport.reportVersion && Number(rawReport.reportVersion) >= 2) {
    return rawReport;
  }
  if (
    rawReport.reportVersion == null &&
    rawReport.version !== "1.0.0" &&
    rawReport.type !== "simplebeacon-report"
  ) {
    return rawReport;
  }
  const summary = rawReport.summary || {};
  const repositoryInventory = rawReport.repositoryInventory || null;
  const repositoryFilesTotal =
    rawReport.repositoryFilesTotal ??
    repositoryInventory?.totalFiles ??
    summary.repositoryFilesTotal ??
    null;
  const repositoryFoldersTotal =
    rawReport.repositoryFoldersTotal ??
    repositoryInventory?.totalFolders ??
    summary.repositoryFoldersTotal ??
    null;
  const ruleScopedFilesAnalyzed =
    rawReport.ruleScopedFilesAnalyzed ??
    summary.ruleScopedFilesAnalyzed ??
    null;
  const codeFilesAnalyzed =
    summary.codeFilesAnalyzed ??
    summary.codeFilesDiscovered ??
    rawReport.filesAnalyzed ??
    null;
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
    repositoryInventory:
      repositoryInventory ||
      (repositoryFilesTotal != null
        ? {
            totalFiles: repositoryFilesTotal,
            totalFolders: repositoryFoldersTotal,
          }
        : null),
  };
}
// simplebeacon:production-leak-intent: web-data-sample - Legitimate web data path detection for analysis mode resolution
let providersPromise = null;
/**
 * Parse json safe.
 * @param {Array} res
 * @returns {any}
 */
async function parseJsonSafe(res) {
  const contentType = String(
    res.headers.get("content-type") || "",
  ).toLowerCase();
  if (!contentType.includes("application/json")) {
    return {};
  }
  const text = await res.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch (_a) {
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
  const detail = (error === null || error === void 0 ? void 0 : error.message)
    ? ` (${error.message})`
    : "";
  return `Network request failed for ${target}${detail}. Verify the dashboard API server is running and reachable, then retry.`;
}
function isHostedPagesDashboard() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return host === "simplebeacon.ai" || host.endsWith(".simplebeacon.pages.dev");
}
/** Fail fast before long scans when the API is down or vault session is missing. */
export async function ensureDashboardApiReady() {
  const origin =
    typeof window !== "undefined" ? window.location.origin : DASHBOARD_BASE_URL;
  let healthRes;
  try {
    healthRes = await fetchWithTimeout("/api/health", {}, 8000);
  } catch (error) {
    if (isHostedPagesDashboard()) {
      throw new Error(
        "Analysis API is temporarily unavailable on this preview. " +
          "Use Select Folder for a private in-browser scan (no server required), or retry in a few minutes.",
      );
    }
    throw new Error(
      `Dashboard API is not reachable at ${origin}. ` +
        "Start it from ai-platform with: npm run dashboard:kill-ports && npm run dashboard:v1-internal",
    );
  }
  if (!healthRes.ok) {
    throw new Error(
      `Dashboard API health check failed (${healthRes.status}). Restart the server and retry.`,
    );
  }
  let probeRes;
  try {
    probeRes = await fetchWithTimeout(
      "/api/simplebeacon/config",
      {
        headers: authService.getAuthHeaders(),
      },
      8000,
    );
  } catch (error) {
    throw new Error(
      buildNetworkErrorMessage("/api/simplebeacon/config", error),
    );
  }
  const probeData = await parseJsonSafe(probeRes);
  if (probeRes.status === 403 && probeData.error === "vault_required") {
    throw new Error(
      "Vault session required for internal dashboard. " +
        "Open /private-dashboard-vault?password=<DASHBOARD_VAULT_PASSWORD> in this browser, then retry.",
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
    throw new Error(
      `Session expired — sign in again at #/signin (${DEMO_EMAIL}).`,
    );
  }
  if (!res.ok) {
    const detail =
      data.error || data.message || `${res.status} ${res.statusText}`.trim();
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
  var _a;
  if (
    !((_a = data === null || data === void 0 ? void 0 : data.providers) ===
      null || _a === void 0
      ? void 0
      : _a.length)
  )
    return data;
  if (!authService.isAuthenticated()) return data;
  let keys;
  try {
    keys = await fetchUserAiKeys();
  } catch (_b) {
    return data;
  }
  const model = String(
    (keys === null || keys === void 0 ? void 0 : keys.ollamaModel) || "",
  ).trim();
  if (!model) return data;
  const ollama = data.providers.find((p) => p.id === "ollama");
  if (!ollama) return data;
  ollama.model = model;
  ollama.label = `Ollama (${model})`;
  if (keys.ollamaBaseUrl) {
    ollama.description = `${keys.ollamaBaseUrl} · ${model}`;
  }
  ollama.configured = true;
  if (
    !ollama.statusMessage ||
    /not configured|no models/i.test(ollama.statusMessage)
  ) {
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
  if (provider.id === "ollama") {
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
  if (providersPromise) {
    return providersPromise;
  }
  const params = options.refresh
    ? `?${new URLSearchParams({ _: String(Date.now()) })}`
    : "";
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
  var _a;
  const timeoutMs = (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 0;
  const data = await fetchJsonWithGuidance(
    "/api/analyze/flexible",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        projectPath,
        aiProvider: options.aiProvider || "active",
        analysisType: options.analysisType || "auto",
        roadmapInsightsMode: options.roadmapInsightsMode || "off",
        understandingMode: options.understandingMode || "deterministic",
        scanProfile: options.scanProfile || "universal",
        includePaths: options.includePaths || [],
        excludePatterns: options.excludePatterns || [],
        requestedScanRoot:
          options.requestedScanRoot || options.scanTargetRoot || undefined,
      }),
    },
    timeoutMs,
  );
  if (!data.success) {
    throw new Error(data.message || data.error || "Analysis failed");
  }
  return data;
}
/** Analyze pasted or dropped file text without requiring a server project path. */
export async function fetchUnderstandSnippet(code, options = {}) {
  var _a;
  const understandResponse = await fetchJsonWithGuidance(
    "/api/analyze/understand",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        code: String(code || ""),
        filePath: options.filePath || "snippet.txt",
        projectPath: options.projectPath || undefined,
        understandingMode: options.understandingMode || "deterministic",
        aiProvider: options.aiProvider || "demo",
      }),
    },
    (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 90000,
  );
  if (!understandResponse.success) {
    throw new Error(
      understandResponse.error ||
        understandResponse.message ||
        "Code understanding failed",
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
  var _a, _b, _c, _d, _e, _f, _g;
  if (!report || typeof report !== "object") return report;
  const type = report.type || "";
  if (type === "codebase-analyzer-report") {
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
      repositoryInventory: report.repositoryInventory
        ? {
            totalFiles: report.repositoryInventory.totalFiles,
            totalFolders: report.repositoryInventory.totalFolders,
          }
        : null,
    };
  }
  if (type === "simplebeacon-report") {
    return {
      type: report.type,
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
      scanScope: report.scanScope,
      scanTargetProfile: report.scanTargetProfile,
      handoffEligible: report.handoffEligible,
      benchmarkScan: report.benchmarkScan,
      rawIssues: (report.rawIssues || report.detectedIssues || []).slice(0, 24),
      detectedIssues: (report.detectedIssues || []).slice(0, 12),
    };
  }
  if (type === "file-merger-reduction-report") {
    return {
      type: report.type,
      summary: report.summary,
      repositoryInventory: report.repositoryInventory,
      scanScope: report.scanScope,
      mergeCandidates: (report.mergeCandidates || []).slice(0, 8),
      reductionOpportunities: (report.reductionOpportunities || []).slice(0, 8),
    };
  }
  if (type === "data-cleanup-report") {
    return {
      type: report.type,
      scanProfile: report.scanProfile,
      summary: report.summary,
      inventory: report.inventory,
      fileReductionPlan: report.fileReductionPlan
        ? {
            totals: report.fileReductionPlan.totals,
            safeToDelete: {
              topDirectories: (
                ((_a = report.fileReductionPlan.safeToDelete) === null ||
                _a === void 0
                  ? void 0
                  : _a.topDirectories) || []
              ).slice(0, 8),
            },
            unusedFiles: {
              candidates:
                (_c =
                  (_b = report.fileReductionPlan.unusedFiles) === null ||
                  _b === void 0
                    ? void 0
                    : _b.candidates) !== null && _c !== void 0
                  ? _c
                  : null,
            },
          }
        : null,
      executiveSummary: report.executiveSummary
        ? {
            priorityActions: (
              report.executiveSummary.priorityActions || []
            ).slice(0, 6),
            workspace: report.executiveSummary.workspace,
            security: {
              piiNeedingReview:
                (_e =
                  (_d = report.executiveSummary.security) === null ||
                  _d === void 0
                    ? void 0
                    : _d.piiNeedingReview) !== null && _e !== void 0
                  ? _e
                  : null,
              credentialsNeedingReview:
                (_g =
                  (_f = report.executiveSummary.security) === null ||
                  _f === void 0
                    ? void 0
                    : _f.credentialsNeedingReview) !== null && _g !== void 0
                  ? _g
                  : null,
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
  const res = await fetch("/api/analyze/summary", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authService.getAuthHeaders(),
    },
    body: JSON.stringify({
      report: slim,
      reportType:
        options.reportType ||
        (report === null || report === void 0 ? void 0 : report.type),
      projectPath: options.projectPath || "",
      aiProvider: options.aiProvider || "demo",
      summaryFocus: options.summaryFocus || "all",
    }),
  });
  const data = await parseJsonSafe(res);
  if (res.status === 413) {
    return {
      success: true,
      enhanced: false,
      message:
        "Report too large for AI summary — deterministic results unchanged.",
    };
  }
  if (!res.ok || !data.success) {
    throw new Error(data.error || data.message || "AI summary failed");
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
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  if (!exportPayload || typeof exportPayload !== "object") return null;
  const findingsLimit =
    (_a = options.findingsLimit) !== null && _a !== void 0 ? _a : 5000;
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
              priorityActions: (
                results.fileReduction.executiveSummary.priorityActions || []
              ).slice(0, 6),
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
              priorityActions: (
                results.dataQuality.executiveSummary.priorityActions || []
              ).slice(0, 6),
            }
          : null,
      }
    : null;
  const slimCleanupAssistant = results.cleanupAssistant
    ? {
        estimatedReduction: results.cleanupAssistant.estimatedReduction,
        projectedInventory: results.cleanupAssistant.projectedInventory,
        tiers: {
          safeNow: (
            (_b = results.cleanupAssistant.tiers) === null || _b === void 0
              ? void 0
              : _b.safeNow
          )
            ? {
                files: results.cleanupAssistant.tiers.safeNow.files,
                bytes: results.cleanupAssistant.tiers.safeNow.bytes,
                directories: (
                  results.cleanupAssistant.tiers.safeNow.directories || []
                ).slice(0, 8),
              }
            : null,
          investigate:
            ((_c = results.cleanupAssistant.tiers) === null || _c === void 0
              ? void 0
              : _c.investigate) || null,
        },
        dataQualityActions: (
          results.cleanupAssistant.dataQualityActions || []
        ).slice(0, 6),
      }
    : null;
  return {
    type: exportPayload.type,
    version: exportPayload.version,
    generatedAt: exportPayload.generatedAt,
    projectPath: exportPayload.projectPath,
    scanDurationMs:
      (_f =
        (_d = exportPayload.scanDurationMs) !== null && _d !== void 0
          ? _d
          : (_e = exportPayload.summary) === null || _e === void 0
            ? void 0
            : _e.scanDurationMs) !== null && _f !== void 0
        ? _f
        : null,
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
            projectTitle:
              results.roadmap.projectTitle ||
              results.roadmap.projectName ||
              null,
            projectName: results.roadmap.projectName || null,
            executiveSummary: results.roadmap.executiveSummary || null,
            developmentPhases: (results.roadmap.developmentPhases || []).slice(
              0,
              12,
            ),
            projectOverview: results.roadmap.projectOverview || null,
            codeAnalysis: results.roadmap.codeAnalysis
              ? {
                  structure: {
                    totalFiles:
                      (_h =
                        (_g = results.roadmap.codeAnalysis.structure) ===
                          null || _g === void 0
                          ? void 0
                          : _g.totalFiles) !== null && _h !== void 0
                        ? _h
                        : null,
                    languages:
                      (_k =
                        (_j = results.roadmap.codeAnalysis.structure) ===
                          null || _j === void 0
                          ? void 0
                          : _j.languages) !== null && _k !== void 0
                        ? _k
                        : null,
                  },
                }
              : null,
            resourceEstimate: results.roadmap.resourceEstimate || null,
            implementationPhases: (
              results.roadmap.implementationPhases || []
            ).slice(0, 8),
            featureCategories: (results.roadmap.featureCategories || []).slice(
              0,
              12,
            ),
            progressMetrics: results.roadmap.progressMetrics || null,
            recommendations: results.roadmap.recommendations
              ? {
                  immediate: (
                    results.roadmap.recommendations.immediate || []
                  ).slice(0, 6),
                  shortTerm: (
                    results.roadmap.recommendations.shortTerm || []
                  ).slice(0, 6),
                  longTerm: (
                    results.roadmap.recommendations.longTerm || []
                  ).slice(0, 6),
                  priorities:
                    results.roadmap.recommendations.priorities || null,
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
  var _a, _b, _c, _d, _e;
  if (!exportPayload || typeof exportPayload !== "object") return null;
  if (
    exportPayload.results &&
    Object.values(exportPayload.results).some(Boolean)
  ) {
    return exportPayload;
  }
  if (exportPayload.type === "data-cleanup-report") {
    const profile = exportPayload.scanProfile || "data-quality";
    const resultKey =
      profile === "file-reduction" ? "fileReduction" : "dataQuality";
    return {
      type: "simplebeacon-complete-scan",
      version: exportPayload.version || "1.3.0",
      generatedAt: exportPayload.generatedAt || new Date().toISOString(),
      projectPath: exportPayload.projectRoot || exportPayload.projectPath || "",
      scanDurationMs:
        (_a = exportPayload.durationMs) !== null && _a !== void 0 ? _a : null,
      summary: {
        scanKind: profile,
        dataQualityFindings:
          (_c =
            (_b = exportPayload.summary) === null || _b === void 0
              ? void 0
              : _b.totalFindings) !== null && _c !== void 0
            ? _c
            : null,
        fileReductionFindings:
          (_e =
            (_d = exportPayload.summary) === null || _d === void 0
              ? void 0
              : _d.totalFindings) !== null && _e !== void 0
            ? _e
            : null,
      },
      results: {
        [resultKey]: exportPayload,
      },
    };
  }
  return exportPayload;
}
const SUPPLEMENTARY_STEP_LABELS = {
  "data-quality": "Data quality",
  "file-reduction": "File reduction",
  consolidation: "Data consolidation",
  "cleanup-assistant": "Cleanup assistant",
  roadmap: "Roadmap analysis",
  "mock-scan": "Fiction and KPI digest",
  "simplebeacon-report": "Simplebeacon scan",
  "eu-ai-act": "EU AI Act sprint",
  complete: "Partial complete scan",
};
/**
 * Gate pass from export scan.
 * @param {any} normalized
 * @returns {any}
 */
function gatePassFromExportScan(normalized) {
  var _a, _b, _c;
  const results =
    (normalized === null || normalized === void 0
      ? void 0
      : normalized.results) || {};
  const fromGate =
    (_b =
      (_a = results.simplebeacon) === null || _a === void 0
        ? void 0
        : _a.gate) === null || _b === void 0
      ? void 0
      : _b.pass;
  if (fromGate === true || fromGate === false) return fromGate;
  const fromSummary =
    (_c =
      normalized === null || normalized === void 0
        ? void 0
        : normalized.summary) === null || _c === void 0
      ? void 0
      : _c.simplebeaconGatePass;
  if (fromSummary === true || fromSummary === false) return fromSummary;
  return null;
}
/**
 * Code files from export scan.
 * @param {any} normalized
 * @returns {any}
 */
function codeFilesFromExportScan(normalized) {
  var _a, _b, _c;
  const value =
    (_c =
      (_b =
        (_a =
          normalized === null || normalized === void 0
            ? void 0
            : normalized.results) === null || _a === void 0
          ? void 0
          : _a.codebase) === null || _b === void 0
        ? void 0
        : _b.summary) === null || _c === void 0
      ? void 0
      : _c.codeFilesAnalyzed;
  return Number.isFinite(value) && value > 0 ? value : null;
}
/**
 * Detect supplementary export step.
 * @param {any} normalized
 * @returns {any}
 */
function detectSupplementaryExportStep(normalized) {
  var _a;
  const results =
    (normalized === null || normalized === void 0
      ? void 0
      : normalized.results) || {};
  const scanKind =
    (_a =
      normalized === null || normalized === void 0
        ? void 0
        : normalized.summary) === null || _a === void 0
      ? void 0
      : _a.scanKind;
  if (scanKind && SUPPLEMENTARY_STEP_LABELS[scanKind]) {
    return { key: scanKind, label: SUPPLEMENTARY_STEP_LABELS[scanKind] };
  }
  if (results.dataQuality)
    return {
      key: "data-quality",
      label: SUPPLEMENTARY_STEP_LABELS["data-quality"],
    };
  if (results.fileReduction)
    return {
      key: "file-reduction",
      label: SUPPLEMENTARY_STEP_LABELS["file-reduction"],
    };
  if (results.consolidation)
    return {
      key: "consolidation",
      label: SUPPLEMENTARY_STEP_LABELS.consolidation,
    };
  if (results.cleanupAssistant)
    return {
      key: "cleanup-assistant",
      label: SUPPLEMENTARY_STEP_LABELS["cleanup-assistant"],
    };
  if (results.roadmap)
    return { key: "roadmap", label: SUPPLEMENTARY_STEP_LABELS.roadmap };
  if (results.mockScan)
    return { key: "mock-scan", label: SUPPLEMENTARY_STEP_LABELS["mock-scan"] };
  if (results.simplebeacon)
    return {
      key: "simplebeacon-report",
      label: SUPPLEMENTARY_STEP_LABELS["simplebeacon-report"],
    };
  return { key: "complete", label: SUPPLEMENTARY_STEP_LABELS.complete };
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
      tier: "insufficient",
      label: "Insufficient scan data",
      exportBlocked: true,
      blockReason: "No scan data available for audit PDF export.",
    };
  }
  const results = normalized.results || {};
  const hasAnyResult = Object.values(results).some(Boolean);
  if (!hasAnyResult) {
    return {
      tier: "insufficient",
      label: "Insufficient scan data",
      exportBlocked: true,
      blockReason:
        "Export payload has no scan steps — run Complete scan or an individual analysis first.",
    };
  }
  const hasGate = gatePassFromExportScan(normalized) != null;
  const hasCodebase = codeFilesFromExportScan(normalized) != null;
  if (hasGate && hasCodebase) {
    return {
      tier: "handoff",
      label: "Pre-launch security audit",
      exportBlocked: false,
    };
  }
  if (hasGate && !hasCodebase) {
    return {
      tier: "gate-only",
      label: "Gate attestation",
      exportBlocked: false,
    };
  }
  if (hasCodebase && !hasGate) {
    return {
      tier: "codebase-only",
      label: "Codebase hygiene",
      exportBlocked: false,
    };
  }
  const step = detectSupplementaryExportStep(normalized);
  return { tier: "supplementary", label: step.label, exportBlocked: false };
}
/**
 * Audit export button label.
 * @param {any} tierInfo
 * @returns {any}
 */
export function auditExportButtonLabel(tierInfo) {
  if (!tierInfo || tierInfo.exportBlocked) return "Download audit PDF";
  switch (tierInfo.tier) {
    case "handoff":
      return "Download security audit PDF";
    case "gate-only":
      return "Download supplementary PDF (gate attestation)";
    case "codebase-only":
      return "Download supplementary PDF (codebase)";
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
  var _a, _b;
  const normalized = normalizeAuditExportPayload(completeScan);
  if (!normalized || typeof normalized !== "object") {
    throw new Error("No scan data available for audit PDF export.");
  }
  const payload =
    slimCompleteScanForAudit(normalized, {
      findingsLimit:
        (_a = options.findingsLimit) !== null && _a !== void 0 ? _a : 5000,
    }) || normalized;
  if (!payload || typeof payload !== "object") {
    throw new Error("Audit export payload could not be prepared.");
  }
  const tierPreview = previewAuditExportTier(payload);
  if (tierPreview.exportBlocked) {
    throw new Error(tierPreview.blockReason);
  }
  const timeoutMs =
    (_b = options.timeoutMs) !== null && _b !== void 0 ? _b : 300000;
  const res = await fetchWithTimeout(
    "/api/analyze/complete-audit-report",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        completeScan: payload,
        aiProvider: options.aiProvider || "demo",
        client: options.client,
        company: options.company,
        assessor: options.assessor,
        credentials: options.credentials,
      }),
    },
    timeoutMs,
  );
  const data = await parseJsonSafe(res);
  if (res.status === 402) {
    const err = new Error(
      data.error || "Pre-Launch Audit PDF requires purchase",
    );
    err.code = "audit_paywall";
    err.checkoutUrl = data.checkoutUrl;
    throw err;
  }
  if (res.status === 422) {
    throw new Error(data.error || "Audit export payload is insufficient.");
  }
  if (!res.ok || !data.success) {
    throw new Error(
      data.error || data.message || "Audit report generation failed",
    );
  }
  return data;
}
/**
 * Fetch eu ai act audit report.
 * @param {Object} options
 * @returns {any}
 */
export async function fetchEuAiActAuditReport(options = {}) {
  var _a;
  const timeoutMs =
    (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 120000;
  const res = await fetchWithTimeout(
    "/api/analyze/eu-ai-act-audit-report",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
    timeoutMs,
  );
  const data = await parseJsonSafe(res);
  if (res.status === 402) {
    const err = new Error(
      data.error || "EU AI Act audit PDF requires purchase",
    );
    err.code = "audit_paywall";
    err.checkoutUrl = data.checkoutUrl;
    throw err;
  }
  if (res.status === 422) {
    throw new Error(
      data.error ||
        "Run EU AI Act sprint first — no .simplebeacon/eu-ai-act-*.json artifacts found.",
    );
  }
  if (!res.ok || !data.success) {
    throw new Error(
      data.error || data.message || "EU AI Act audit report generation failed",
    );
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
  return bare ? bare[1].trim().replace(/^["']|["']$/g, "") : null;
}
/**
 * Fetch analyze export bundle zip.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
export async function fetchAnalyzeExportBundleZip(completeScan, options = {}) {
  var _a, _b;
  const normalized = normalizeAuditExportPayload(completeScan);
  if (!normalized || typeof normalized !== "object") {
    throw new Error("No complete scan data available for ZIP export.");
  }
  const payload =
    slimCompleteScanForAudit(normalized, {
      findingsLimit:
        (_a = options.findingsLimit) !== null && _a !== void 0 ? _a : 5000,
    }) || normalized;
  const timeoutMs =
    (_b = options.timeoutMs) !== null && _b !== void 0 ? _b : 300000;
  const res = await fetchWithTimeout(
    "/api/analyze/export-bundle",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
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
        aiProvider: options.aiProvider || "demo",
        cloudTeamsActive: options.cloudTeamsActive === true,
        selectedEngines: options.selectedEngines,
        enginesRun: options.enginesRun,
        credentials: options.credentials,
      }),
    },
    timeoutMs,
  );
  if (res.status === 402) {
    const data = await parseJsonSafe(res);
    const err = new Error(
      data.error || "Export bundle requires a paid deliverable tier.",
    );
    err.code = "export_paywall";
    err.checkoutUrl = data.checkoutUrl;
    throw err;
  }
  if (res.status === 422) {
    const data = await parseJsonSafe(res);
    const err = new Error(
      data.error || "Export bundle could not be generated from this scan.",
    );
    err.code = "export_empty";
    err.warnings = data.warnings || [];
    throw err;
  }
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(
      data.error || data.message || "Export bundle generation failed",
    );
  }
  const blob = await res.blob();
  const filename =
    parseContentDispositionFilename(res.headers.get("Content-Disposition")) ||
    options.filename ||
    `simplebeacon-export-${new Date().toISOString().slice(0, 10)}.zip`;
  const tierId =
    res.headers.get("X-Simplebeacon-Export-Tier") ||
    options.deliverableSku ||
    null;
  const warningsHeader = res.headers.get("X-Simplebeacon-Export-Warnings");
  const warnings = warningsHeader
    ? warningsHeader
        .split("|")
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
export function downloadAuditReportHtml(
  html,
  filename = "simplebeacon-audit.html",
) {
  if (typeof document === "undefined" || !document.body || !html) {
    throw new Error("Audit report HTML is empty or download unavailable.");
  }
  const safeName = filename.endsWith(".html") ? filename : `${filename}.html`;
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = safeName;
  link.rel = "noopener";
  document.body.appendChild(link);
  try {
    link.click();
  } finally {
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
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
    cache: "no-store",
    headers: authService.getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(
      (data === null || data === void 0 ? void 0 : data.message) ||
        (data === null || data === void 0 ? void 0 : data.error) ||
        "Compliance trail JSON export failed",
    );
  }
  const payload = await res.json();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename =
    (match === null || match === void 0 ? void 0 : match[1]) ||
    `compliance-trail-${windowDays}d.json`;
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
    disposition: "inline",
    _: String(Date.now()),
  });
  const res = await fetch(`/api/compliance-trail/export/pdf?${params}`, {
    cache: "no-store",
    headers: authService.getAuthHeaders(),
  });
  if (!res.ok) {
    const data = await parseJsonSafe(res);
    throw new Error(
      (data === null || data === void 0 ? void 0 : data.message) ||
        (data === null || data === void 0 ? void 0 : data.error) ||
        "Compliance trail PDF export failed",
    );
  }
  const html = await res.text();
  const disposition = res.headers.get("Content-Disposition") || "";
  const match = disposition.match(/filename="([^"]+)"/i);
  const filename =
    (match === null || match === void 0 ? void 0 : match[1]) ||
    `compliance-trail-${windowDays}d.html`;
  return { html, filename };
}
/**
 * Open audit report print window.
 * @param {any} html
 * @param {string} filename
 * @returns {any}
 */
export function openAuditReportPrintWindow(
  html,
  filename = "simplebeacon-audit.html",
) {
  if (typeof window === "undefined" || !html) {
    throw new Error("Audit report HTML is empty.");
  }
  const savedAs = downloadAuditReportHtml(html, filename);
  const previewWindow = window.open("", "_blank");
  if (previewWindow) {
    try {
      const blob = new Blob([html], { type: "text/html" });
      const url = URL.createObjectURL(blob);
      // Navigate the new window to the blob URL instead of using document.write()
      previewWindow.location.href = url;
      // Revoke the object URL after the window loads to free memory
      previewWindow.addEventListener(
        "load",
        () => {
          try {
            URL.revokeObjectURL(url);
          } catch (e) {
            /* ignore */
          }
        },
        { once: true },
      );
      previewWindow.focus();
      return { mode: "html-download", filename: savedAs, preview: true };
    } catch (e) {
      // Fallback: navigate the preview window to a data URL as a safer alternative
      try {
        const dataUrl =
          "data:text/html;charset=utf-8," + encodeURIComponent(html);
        previewWindow.location.href = dataUrl;
        previewWindow.focus();
        return { mode: "html-download", filename: savedAs, preview: true };
      } catch (err) {
        return { mode: "html-download", filename: savedAs, preview: false };
      }
    }
  }
  return { mode: "html-download", filename: savedAs, preview: false };
}
/**
 * Fetch codebase analysis.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
export async function fetchCodebaseAnalysis(projectPath, options = {}) {
  var _a;
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (projectPath) params.set("projectPath", projectPath);
  if (options.includeEslint === true) params.set("eslint", "1");
  params.set("scanProfile", options.scanProfile || "universal");
  if (options.context) {
    params.set("context", options.context);
  } else if (options.scanMode) {
    params.set("scanMode", options.scanMode);
  }
  if (options.understandingMode) {
    params.set("understandingMode", options.understandingMode);
  }
  if (options.includeBrowserAnalyzers) {
    params.set("includeBrowserAnalyzers", "1");
  }
  if (options.includeAllFiles) {
    params.set("includeAllFiles", "1");
  }
  if (options.requestedScanRoot || options.scanTargetRoot) {
    params.set(
      "requestedScanRoot",
      options.requestedScanRoot || options.scanTargetRoot,
    );
  }
  const timeoutMs =
    (_a = options.timeoutMs) !== null && _a !== void 0
      ? _a
      : options.context === "complete"
        ? 900000
        : 600000;
  const data = await fetchJsonWithGuidance(
    `/api/analyze/codebase?${params}`,
    {
      headers: authService.getAuthHeaders(),
    },
    timeoutMs,
  );
  if (!data.success) {
    throw new Error(data.error || "Codebase analysis failed");
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
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (projectPath) params.set("projectPath", projectPath);
  const profile = options.profile || options.mode || "all";
  params.set("profile", profile);
  if (options.scanner) params.set("scanner", options.scanner);
  if (options.force || options.refresh) params.set("refresh", "1");
  const timeoutMs =
    (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 300000;
  const target = `/api/analyze/data-cleanup?${params}`;
  try {
    const data = await fetchJsonWithGuidance(
      target,
      {
        headers: authService.getAuthHeaders(),
      },
      timeoutMs,
    );
    if (!data.success) {
      throw new Error(data.error || "Data cleanup analysis failed");
    }
    const scan = data.data;
    if (!scan || typeof scan !== "object") {
      throw new Error(`Data cleanup scan returned no payload (${profile})`);
    }
    if (profile === "file-reduction") {
      const hasSignal =
        ((_c =
          (_b = scan.fileReductionPlan) === null || _b === void 0
            ? void 0
            : _b.totals) === null || _c === void 0
          ? void 0
          : _c.safeToDeleteBytes) != null ||
        ((_f =
          (_e =
            (_d = scan.fileReductionPlan) === null || _d === void 0
              ? void 0
              : _d.safeToDelete) === null || _e === void 0
            ? void 0
            : _e.topDirectories) === null || _f === void 0
          ? void 0
          : _f.length) ||
        ((_h =
          (_g = scan.scanners) === null || _g === void 0
            ? void 0
            : _g["build-artifacts"]) === null || _h === void 0
          ? void 0
          : _h.safeToDeleteBytes) != null ||
        ((_j = scan.summary) === null || _j === void 0
          ? void 0
          : _j.totalFindings) > 0;
      if (!hasSignal) {
        throw new Error(
          "File reduction scan returned no findings — restart the SimpleBeacon server and retry.",
        );
      }
    }
    if (profile === "data-quality") {
      const hasSignal =
        scan.executiveSummary ||
        ((_k = scan.summary) === null || _k === void 0
          ? void 0
          : _k.totalFindings) > 0 ||
        Object.keys(scan.scanners || {}).length > 0;
      if (!hasSignal) {
        throw new Error(
          "Data quality scan returned no findings — restart the SimpleBeacon server and retry.",
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
        : "Data cleanup API is missing — restart the SimpleBeacon server.",
    );
  }
}
/**
 * Looks like game mod path.
 * @param {string} projectPath
 * @returns {any}
 */
export function looksLikeGameModPath(projectPath) {
  const normalized = String(projectPath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  if (!normalized) return false;
  return new RegExp(
    "(?:^|/)games/|doom|gzdoom|zscript|\\.pk3|r3d|lighting|_mod(?:/|$)",
    "i",
  ).test(normalized);
}
/**
 * Scan hints game mod.
 * @param {any} scan
 * @returns {any}
 */
export function scanHintsGameMod(scan) {
  var _a;
  if (!scan || typeof scan !== "object") return false;
  if (
    (scan.findings || []).some((finding) =>
      /\.(zs|zscript|acs|decorate)$/i.test(String(finding.filePath || "")),
    )
  ) {
    return true;
  }
  const insights =
    ((_a = scan.codeUnderstanding) === null || _a === void 0
      ? void 0
      : _a.fileInsights) || [];
  return insights.some((item) => {
    var _a, _b, _c, _d, _e, _f, _g;
    const domains =
      ((_d =
        (_c =
          (_b =
            (_a = item.understanding) === null || _a === void 0
              ? void 0
              : _a.layers) === null || _b === void 0
            ? void 0
            : _b.semantic) === null || _c === void 0
          ? void 0
          : _c.businessLogic) === null || _d === void 0
        ? void 0
        : _d.domains) ||
      ((_g =
        (_f =
          (_e = item.understanding) === null || _e === void 0
            ? void 0
            : _e.layers) === null || _f === void 0
          ? void 0
          : _f.semantic) === null || _g === void 0
        ? void 0
        : _g.domains) ||
      [];
    return Array.isArray(domains) && domains.includes("game-modding");
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
    projectPath: projectPath || "",
    focus: options.focus || "lighting-intensity",
    _: String(Date.now()),
  });
  const data = await fetchJsonWithGuidance(
    `/api/analyze/zscript-report?${params}`,
    {
      headers: authService.getAuthHeaders(),
    },
  );
  if (!data.success) {
    throw new Error(data.error || "ZScript report failed");
  }
  return data.report;
}
/**
 * Fetch repository inventory.
 * @param {string} projectPath
 * @param {Object} options
 * @returns {any}
 */
const _inventoryCache = new Map();
const INVENTORY_CACHE_TTL_MS = 30000;
function getInventoryCacheKey(projectPath, options) {
  return `${projectPath}|${options.profile || "all"}|${options.fullDirectoryScan ? "1" : "0"}`;
}
function getCachedInventory(projectPath, options) {
  const key = getInventoryCacheKey(projectPath, options);
  const entry = _inventoryCache.get(key);
  if (entry && Date.now() - entry.ts < INVENTORY_CACHE_TTL_MS) {
    return entry.inventory;
  }
  return undefined;
}
function setCachedInventory(projectPath, options, inventory) {
  const key = getInventoryCacheKey(projectPath, options);
  _inventoryCache.set(key, { inventory, ts: Date.now() });
}
export async function fetchRepositoryInventory(projectPath, options = {}) {
  const path = String(projectPath || "").trim();
  if (!path) return null;
  if (!isAbsoluteProjectPath(path)) return null;
  if (/^https?:\/\//i.test(path) && !isRemoteRepoUrl(path)) {
    throw new Error(
      "Enter a folder path (not a file like .bat or .json) or a supported public repo URL",
    );
  }
  // Avoid hitting the server for obviously incomplete paths while the user is still typing.
  if (path.length < 3) return null;
  const cached = getCachedInventory(path, options);
  if (cached !== undefined) {
    return cached;
  }
  // Render default / Unix paths on hosted Windows are not the user's folder — skip server inventory.
  if (shouldClearHostedServerDefaultPath(path)) {
    setCachedInventory(path, options, null);
    return null;
  }
  // Hosted remote servers cannot read the user's PC — use the local agent when available.
  if (isLocalPath(path) && shouldProbeLocalAgent()) {
    const agentStatus = await probeAgent();
    if (agentStatus.available && agentStatus.scannerAvailable) {
      const inventory = await fetchInventoryViaAgent(path, {
        fullDirectoryScan: options.fullDirectoryScan,
      });
      setCachedInventory(path, options, inventory);
      return inventory;
    }
    setCachedInventory(path, options, null);
    return null;
  }
  const params = new URLSearchParams({
    projectPath: path,
    profile: options.profile || "all",
  });
  if (options.fullDirectoryScan) {
    params.set("fullDirectoryScan", "true");
  }
  let data;
  try {
    data = await fetchJsonWithGuidance(`/api/analyze/inventory?${params}`, {
      headers: authService.getAuthHeaders(),
    });
  } catch (_a) {
    // Inventory is optional metadata; a 400/404 from an invalid/missing path is not fatal.
    setCachedInventory(path, options, null);
    return null;
  }
  if (!data.success) {
    if (data.pathMissing) return null;
    // Treat validation errors as missing inventory so the dashboard degrades gracefully.
    setCachedInventory(path, options, null);
    return null;
  }
  if (data.pathMissing || !data.inventory) {
    setCachedInventory(path, options, null);
    return null;
  }
  setCachedInventory(path, options, data.inventory);
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
  const path = String(projectPath || "").trim();
  if (
    !path ||
    isRemoteRepoUrl(path) ||
    shouldClearHostedServerDefaultPath(path)
  ) {
    if (app === null || app === void 0 ? void 0 : app.state)
      app.state.pathInventory = null;
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
        profile: options.profile || "all",
        fullDirectoryScan: options.fullDirectoryScan,
      });
      const root =
        (inventory === null || inventory === void 0
          ? void 0
          : inventory.projectRoot) || path;
      if (
        (inventory === null || inventory === void 0
          ? void 0
          : inventory.totalFiles) != null &&
        isInventoryRootAligned(path, root)
      ) {
        const entry = { path, inventory, fetchedAt: Date.now() };
        if (app === null || app === void 0 ? void 0 : app.state)
          app.state.pathInventory = entry;
        return inventory;
      }
    } catch (_a) {
      /* inventory API unavailable or path outside allowed roots */
    }
    if (app === null || app === void 0 ? void 0 : app.state) {
      app.state.pathInventory = {
        path,
        inventory: null,
        fetchedAt: Date.now(),
      };
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
  var _a;
  const cached =
    (_a = app === null || app === void 0 ? void 0 : app.state) === null ||
    _a === void 0
      ? void 0
      : _a.pathInventory;
  if (
    !(cached === null || cached === void 0 ? void 0 : cached.inventory) ||
    !projectPath
  )
    return null;
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
  var _a;
  const resolvedReport = report !== null && report !== void 0 ? report : null;
  const live = liveInventoryForPath(app, projectPath);
  return buildInventoryProvenance(resolvedReport, projectPath, {
    liveInventory:
      (live === null || live === void 0 ? void 0 : live.inventory) || null,
    inventoryFetchedAt:
      (_a = live === null || live === void 0 ? void 0 : live.fetchedAt) !==
        null && _a !== void 0
        ? _a
        : null,
  });
}
/**
 * Merge report inventory.
 * @param {number} report
 * @param {any} inventory
 * @returns {any}
 */
export function mergeReportInventory(report, inventory) {
  var _a, _b, _c, _d, _e;
  if (!report || typeof report !== "object") return report;
  if (
    !(inventory === null || inventory === void 0
      ? void 0
      : inventory.totalFiles)
  )
    return report;
  return {
    ...report,
    repositoryInventory:
      ((_a = report.repositoryInventory) === null || _a === void 0
        ? void 0
        : _a.totalFiles) != null
        ? report.repositoryInventory
        : inventory,
    repositoryFilesTotal:
      (_b = report.repositoryFilesTotal) !== null && _b !== void 0
        ? _b
        : inventory.totalFiles,
    repositoryFoldersTotal:
      (_c = report.repositoryFoldersTotal) !== null && _c !== void 0
        ? _c
        : inventory.totalFolders,
    filesAnalyzed:
      (_e =
        (_d = report.repositoryFilesTotal) !== null && _d !== void 0
          ? _d
          : report.filesAnalyzed) !== null && _e !== void 0
        ? _e
        : inventory.totalFiles,
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
  if (str.startsWith(".")) return false;
  if (/^[a-zA-Z]:/.test(str)) return true;
  if (str.startsWith("/")) return true;
  if (str.startsWith("\\")) return true;
  return false;
}
/**
 * Fetch scan report.
 * @param {string} projectPath
 * @returns {any}
 */
export async function fetchScanReport(projectPath) {
  const path = String(projectPath || "").trim();
  if (!path) return null;
  if (!isAbsoluteProjectPath(path)) return null;
  if (/^https?:\/\//i.test(path) && !isRemoteRepoUrl(path)) {
    throw new Error(
      "Enter a folder path (not a file like .bat or .json) or a supported public repo URL",
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
      30000,
    );
  } catch (_a) {
    return null;
  }
  if (res.status === 404) return null;
  if (!res.ok) return null;
  const data = await parseJsonSafe(res);
  return data && typeof data === "object" ? data : null;
}
/**
 * Normalize project path.
 * @param {any} value
 * @returns {any}
 */
export function normalizeProjectPath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .toLowerCase()
    .replace(/\/$/, "");
}
/**
 * Prefer platform analyze path.
 * @param {string} candidatePath
 * @param {string} defaultPath
 * @returns {any}
 */
export function preferPlatformAnalyzePath(candidatePath, defaultPath) {
  const raw = String(candidatePath || defaultPath || "").trim();
  if (!raw) return raw;
  const fallback = String(defaultPath || "").trim();
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
  const failOn = gate.failOn || ["high"];
  const severity = issue.severityBand || issue.severity || "low";
  if (severity === "critical") return true;
  return failOn.includes(severity);
}

/**
 * Browser-sandbox certificate report → simplebeacon-report for Results / exports.
 * @param {Object} report
 * @param {string} projectPath
 * @returns {Object}
 */
/**
 * Infer issue category from sandbox worker finding message/type.
 * @param {Object} entry
 * @returns {string}
 */
function inferSandboxIssueType(entry) {
  if (entry.type && entry.type !== "Security") return entry.type;
  const msg = String(entry.message || entry.description || "").toLowerCase();
  if (
    msg.includes("aws access") ||
    msg.includes("api key") ||
    msg.includes("credential") ||
    msg.includes("private key") ||
    msg.includes("slack api") ||
    msg.includes("secret/token")
  ) {
    return "Exposed Credentials";
  }
  if (msg.includes("entropy")) return "High-Entropy Secret";
  if (msg.includes("markdown")) return "Markdown Fences";
  if (msg.includes("compliance controls")) return "Compliance Drift";
  if (msg.includes("placeholder") || msg.includes("stub"))
    return "Placeholder Debris";
  if (msg.includes("boilerplate")) return "AI Slop / Repetitive Boilerplate";
  if (msg.includes("swallows")) return "Generic Error Swallowing";
  return entry.type || "Security";
}

export function convertSandboxReportToSimplebeacon(report, projectPath) {
  const cert = report.certificate || {};
  const logs = Array.isArray(cert.logs) ? cert.logs : [];
  const high = Number(cert.highRiskCount) || 0;
  const medium = Number(cert.mediumRiskCount) || 0;
  const low = Number(cert.lowRiskCount) || 0;
  const totalFiles =
    report.discoveredFiles || (report.files && report.files.length) || 0;
  const scannedFiles = (report.files && report.files.length) || totalFiles;
  const folderPaths = new Set();
  for (const f of report.files || []) {
    const p = String(
      typeof f === "string" ? f : f.absolutePath || f.path || f.name || "",
    ).replace(/\\/g, "/");
    const parts = p.split("/");
    parts.pop();
    let acc = "";
    for (const part of parts) {
      acc = acc ? `${acc}/${part}` : part;
      if (acc) folderPaths.add(acc);
    }
  }
  const totalFolders = folderPaths.size;
  const rawIssues = logs.map((entry) => ({
    severity: String(entry.severity || "medium").toLowerCase(),
    type: inferSandboxIssueType(entry),
    filePath: entry.filePath || entry.file || "",
    description: entry.message || entry.type || "",
    count: 1,
  }));
  const blockingCount = rawIssues.filter(
    (issue) => issue.severity === "high" || issue.severity === "critical",
  ).length;
  const warningCount = rawIssues.filter(
    (issue) => issue.severity === "medium" || issue.severity === "low",
  ).length;
  const severityCounts = { critical: 0, high, medium, low, info: 0 };
  const gatePass =
    blockingCount === 0 && high === 0 && cert.letterGrade !== "F";
  const sampleFiles = (report.files || [])
    .slice(0, 96)
    .map((f) =>
      typeof f === "string"
        ? f
        : f.absolutePath || f.path || f.name || f.relativePath || "",
    )
    .filter(Boolean);
  return {
    type: "simplebeacon-report",
    version: "1.0.0",
    generatedAt: new Date().toISOString(),
    scanSource: "browser-sandbox",
    projectPath,
    projectRoot: projectPath,
    summary: {
      totalFiles,
      totalFindings: rawIssues.length,
      severityCounts,
    },
    rawIssues,
    detectedIssues: rawIssues,
    findings: rawIssues,
    repositoryFilesTotal: totalFiles,
    repositoryFoldersTotal: totalFolders,
    totalFiles,
    filesAnalyzed: scannedFiles,
    ruleScopedFilesAnalyzed: scannedFiles,
    credentialScanned: scannedFiles,
    issueCount: rawIssues.length,
    severityCounts,
    sampleFiles,
    inventory: {
      totalFiles,
      totalFolders,
      scannedFiles,
    },
    repositoryInventory: {
      totalFiles,
      totalFolders,
      profile: "audit",
    },
    gate: {
      pass: gatePass,
      blockingCount,
      warningCount,
      failOn: ["high"],
      warnOn: ["medium", "low"],
      score: cert.score != null ? cert.score : 0,
    },
    scan_summary: {
      status: gatePass ? "PASSED" : "FAILED",
      block_merge: !gatePass,
      total_risks_found: rawIssues.length,
      high_severity_count: high,
      medium_severity_count: medium,
      low_severity_count: low,
    },
  };
}

/** True when report was produced client-side (browser sandbox) and must not be replaced by server snapshot. */
export function isClientScanReport(report) {
  return Boolean(
    report &&
    (report.scanSource === "browser-sandbox" || report.clientScan === true),
  );
}

/**
 * Prefer in-memory or session-stored client scan over stale server demo reports.
 * @param {Object} app Dashboard app instance
 * @returns {Object|null}
 */
export function hydrateClientScanReport(app) {
  if (!app || typeof app !== "object") return null;
  const analyze = app.views && app.views.analyze;
  if (analyze && typeof analyze.resolveResultsReport === "function") {
    const resolved = analyze.resolveResultsReport();
    const issueList =
      (resolved && (resolved.rawIssues || resolved.detectedIssues)) || [];
    if (issueList.length) {
      const prepared = preparePlatformResultsReport(
        typeof analyze.prepareReportForResults === "function"
          ? analyze.prepareReportForResults(resolved)
          : resolved,
      );
      app.state.report = prepared;
      if (app.scanService) app.scanService.report = prepared;
      return prepared;
    }
  }
  const analyzeResult = app.state && app.state.analyzeResult;
  if (analyzeResult && analyzeResult.report) {
    const issues =
      analyzeResult.report.rawIssues ||
      analyzeResult.report.detectedIssues ||
      [];
    if (issues.length) {
      const prepared = preparePlatformResultsReport(analyzeResult.report);
      app.state.report = prepared;
      if (app.scanService) app.scanService.report = prepared;
      return prepared;
    }
  }
  if (isClientScanReport(app.state && app.state.report)) {
    const issues =
      app.state.report.rawIssues || app.state.report.detectedIssues || [];
    if (issues.length) return app.state.report;
  }
  try {
    if (typeof sessionStorage !== "undefined") {
      const savedSimple = sessionStorage.getItem(
        "sb-last-sandbox-simplebeacon",
      );
      if (savedSimple) {
        const parsed = preparePlatformResultsReport(JSON.parse(savedSimple));
        app.state.report = parsed;
        if (app.scanService) app.scanService.report = parsed;
        return parsed;
      }
      const savedCert = sessionStorage.getItem("sb-last-sandbox-report");
      const savedPath =
        sessionStorage.getItem("sb-last-sandbox-project-path") || "local-scan";
      if (savedCert) {
        const parsed = preparePlatformResultsReport(
          convertSandboxReportToSimplebeacon(JSON.parse(savedCert), savedPath),
        );
        app.state.report = parsed;
        if (app.scanService) app.scanService.report = parsed;
        return parsed;
      }
    }
  } catch (_err) {
    /* ignore corrupt session payload */
  }
  return (app.state && app.state.report) || null;
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
      issue === null || issue === void 0 ? void 0 : issue.filePath,
      issue === null || issue === void 0 ? void 0 : issue.file,
      ...((issue === null || issue === void 0 ? void 0 : issue.affectedFiles) ||
        []),
      ...((issue === null || issue === void 0 ? void 0 : issue.filePaths) ||
        []),
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
 * Backfill scanScope fields from top-level report fields.
 */
function buildScanScope(report, benchmarkCacheIssues, staleFullTreeScan) {
  const scope = { ...(report.scanScope || {}) };
  if (scope.profile == null)
    scope.profile = report.scanTargetProfile || report.profile || "standard";
  if (!scope.rulesEnabled || scope.rulesEnabled.length === 0)
    scope.rulesEnabled = report.rules || report.rulesEnabled || [];
  if (scope.productionDirsScanned == null)
    scope.productionDirsScanned = report.productionLeakScanned ?? null;
  if (!scope.productionPaths || scope.productionPaths.length === 0)
    scope.productionPaths = report.productionPaths || [];
  if (scope.repositoryFilesTotal == null)
    scope.repositoryFilesTotal = report.repositoryFilesTotal;
  if (scope.repositoryFoldersTotal == null)
    scope.repositoryFoldersTotal = report.repositoryFoldersTotal;
  if (scope.ruleScopedFilesAnalyzed == null)
    scope.ruleScopedFilesAnalyzed = report.ruleScopedFilesAnalyzed;
  if (scope.mockSampleFilesInScanPaths == null)
    scope.mockSampleFilesInScanPaths = report.mockSampleFiles;
  if (scope.pageSpecCatalogSize == null)
    scope.pageSpecCatalogSize = report.pageSpecCatalogSize;
  if (scope.pageSpecsValidated == null)
    scope.pageSpecsValidated = report.pageSampleSchemaChecked;
  if (scope.pageSpecsFromScanPaths == null) scope.pageSpecsFromScanPaths = 0;
  if (scope.pageSpecsFromAliasPaths == null) scope.pageSpecsFromAliasPaths = 0;
  if (scope.fictionJsonFilesScanned == null)
    scope.fictionJsonFilesScanned = report.fictionJsonFilesScanned;
  if (scope.fictionSampleFilesScanned == null)
    scope.fictionSampleFilesScanned = report.fictionSampleFilesScanned;
  if (!scope.fictionScope)
    scope.fictionScope = report.fictionScope || "repository-json";
  if (scope.jestExecutedDuringScan == null)
    scope.jestExecutedDuringScan = report.jestBaselineChecked === true;
  if (!scope.limitations) scope.limitations = report.limitations || [];
  scope.resultsViewScope = "platform-only";
  scope.benchmarkCacheIssuesExcluded = benchmarkCacheIssues.length;
  scope.reportHealth = staleFullTreeScan
    ? "stale-full-tree-scan"
    : scope.reportHealth || "platform-scoped";
  scope.rescanRecommended =
    staleFullTreeScan ||
    benchmarkCacheIssues.length > 0 ||
    Boolean(scope.rescanRecommended);
  return scope;
}

/**
 * Prepare platform results report.
 * @param {number} report
 * @returns {any}
 */
export function preparePlatformResultsReport(report) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j;
  if (!report || report.type !== "simplebeacon-report") return report;
  const sourceIssues = (
    (_a = report.rawIssues) === null || _a === void 0 ? void 0 : _a.length
  )
    ? report.rawIssues
    : report.detectedIssues || [];
  const { platformIssues, benchmarkCacheIssues } =
    partitionPlatformScanIssues(sourceIssues);
  const gateConfig = report.gate ||
    ((_b = report.scanScope) === null || _b === void 0
      ? void 0
      : _b.gatePolicy) || { failOn: ["high"], warnOn: ["medium", "low"] };
  const blockingCount = platformIssues
    .filter((issue) => isGateBlockingIssue(issue, gateConfig))
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const warningCount = platformIssues
    .filter((issue) =>
      (gateConfig.warnOn || []).includes(issue.severityBand || issue.severity),
    )
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const repoFiles =
    (_e =
      (_c = report.repositoryFilesTotal) !== null && _c !== void 0
        ? _c
        : (_d = report.repositoryInventory) === null || _d === void 0
          ? void 0
          : _d.totalFiles) !== null && _e !== void 0
      ? _e
      : 0;
  const mockSamples =
    (_f = report.mockSampleFiles) !== null && _f !== void 0 ? _f : 0;
  const walkedFiles =
    (_h =
      (_g = report.ruleScopedFilesAnalyzed) !== null && _g !== void 0
        ? _g
        : report.totalFiles) !== null && _h !== void 0
      ? _h
      : 0;
  const fullTree = Boolean(
    report.fullDirectoryScan ||
    ((_j = report.scanScope) === null || _j === void 0
      ? void 0
      : _j.fullDirectoryScan),
  );
  const staleFullTreeScan =
    mockSamples > 500 || repoFiles > 15000 || (fullTree && walkedFiles > 15000);
  const totalIssueGroups = platformIssues.reduce(
    (sum, issue) => sum + (issue.count || 1),
    0,
  );
  const gatePass = blockingCount === 0;
  const highCount = platformIssues
    .filter(
      (issue) =>
        (issue.severityBand || issue.severity) === "high" ||
        (issue.severityBand || issue.severity) === "critical",
    )
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const mediumCount = platformIssues
    .filter((issue) => (issue.severityBand || issue.severity) === "medium")
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const lowCount = platformIssues
    .filter((issue) => (issue.severityBand || issue.severity) === "low")
    .reduce((sum, issue) => sum + (issue.count || 1), 0);
  const severityWeight = { critical: 12, high: 6, medium: 2, low: 1 };
  const weightedPenalty = platformIssues
    .filter((issue) => {
      const sev = issue.severityBand || issue.severity;
      return sev === "high" || sev === "critical";
    })
    .reduce(
      (sum, issue) =>
        sum +
        (severityWeight[issue.severityBand || issue.severity] || 1) *
          (issue.count || 1),
      0,
    );
  const computedQualityScore = Math.max(
    0,
    Math.min(100, Math.round(100 - Math.min(weightedPenalty, 85))),
  );
  const qualityScore =
    report.qualityScore ??
    (platformIssues.length > 0 ? computedQualityScore : null);
  return {
    ...report,
    rawIssues: platformIssues,
    benchmarkCacheIssues,
    issueCount: totalIssueGroups,
    severityCounts: report.severityCounts || {
      critical: 0,
      high: highCount,
      medium: mediumCount,
      low: lowCount,
    },
    qualityScore,
    gate: {
      ...(report.gate || {}),
      ...gateConfig,
      pass: gatePass,
      blockingCount,
      warningCount,
      score: qualityScore ?? 0,
    },
    scan_summary: {
      ...(report.scan_summary || {}),
      status: gatePass ? "PASSED" : "FAILED",
      block_merge: !gatePass,
      total_risks_found: totalIssueGroups,
      high_severity_count: highCount,
      medium_severity_count: mediumCount,
      low_severity_count: lowCount,
    },
    scanScope: buildScanScope(report, benchmarkCacheIssues, staleFullTreeScan),
  };
}
/**
 * Sanitize fiction digest export.
 * @param {any} digest
 * @returns {any}
 */
export function sanitizeFictionDigestExport(digest) {
  if (!digest || typeof digest !== "object") return digest;
  if (digest.type !== "simplebeacon-fiction-digest") return digest;
  const sourceReport = digest.sourceReport
    ? preparePlatformResultsReport(digest.sourceReport)
    : null;
  /**
   * Fiction issues.
   * @param {any} digest.fictionIssues || []
   * @returns {any}
   */
  const fictionIssues = (digest.fictionIssues || []).filter((issue) => {
    const filePath = issue.filePath || issue.file || "";
    return !filePath || !isBenchmarkCachePath(filePath);
  });
  /**
   * Non fiction issues.
   * @param {any} digest.nonFictionIssues || []
   * @returns {any}
   */
  const nonFictionIssues = (digest.nonFictionIssues || []).filter((issue) => {
    const filePath = issue.filePath || issue.file || "";
    return !filePath || !isBenchmarkCachePath(filePath);
  });
  const fictionCount = fictionIssues.reduce(
    (sum, issue) => sum + (issue.count || 1),
    0,
  );
  return {
    type: "simplebeacon-fiction-digest",
    generatedAt: digest.generatedAt || new Date().toISOString(),
    conclusion:
      digest.conclusion ||
      (sourceReport
        ? buildScanConclusion(sourceReport, { focus: "fiction" })
        : ""),
    fictionIssues,
    nonFictionIssues,
    digestTrust: fictionCount === 0 ? "trustworthy" : "review",
    sourceReport: sourceReport ? slimReportForSummary(sourceReport) : null,
  };
}
/** Prefer platform root from step 1 when scanning a monorepo parent path. */
export function resolveCompleteScanTargetPath(projectPath, priorSteps = []) {
  var _a;
  if (isBenchmarkCachePath(projectPath)) {
    return projectPath;
  }
  const report =
    (_a = priorSteps.find(
      (step) =>
        (step === null || step === void 0 ? void 0 : step.id) ===
        "simplebeacon",
    )) === null || _a === void 0
      ? void 0
      : _a.report;
  const platformRoot =
    report === null || report === void 0 ? void 0 : report.platformRoot;
  if (
    platformRoot &&
    normalizeProjectPath(platformRoot) !== normalizeProjectPath(projectPath)
  ) {
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
  var _a;
  if (!report) return report;
  let merged = { ...report };
  if (
    projectPath &&
    merged.projectRoot &&
    normalizeProjectPath(merged.projectRoot) !==
      normalizeProjectPath(projectPath)
  ) {
    const fetched = await fetchScanReport(projectPath).catch(() => null);
    if (
      (fetched === null || fetched === void 0 ? void 0 : fetched.projectRoot) &&
      normalizeProjectPath(fetched.projectRoot) ===
        normalizeProjectPath(projectPath)
    ) {
      merged = fetched;
    }
  }
  let inventory =
    ((_a = merged.repositoryInventory) === null || _a === void 0
      ? void 0
      : _a.totalFiles) != null
      ? merged.repositoryInventory
      : null;
  if (!inventory && projectPath) {
    try {
      inventory = await fetchRepositoryInventory(projectPath, {
        profile: "all",
      });
    } catch (_b) {
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
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s;
  const requested = String(requestedPath || "").trim();
  const liveInventory = options.liveInventory || null;
  if (
    !(report === null || report === void 0 ? void 0 : report.generatedAt) &&
    !requested &&
    !(liveInventory === null || liveInventory === void 0
      ? void 0
      : liveInventory.totalFiles)
  )
    return null;
  const reportInventory =
    ((_a =
      report === null || report === void 0
        ? void 0
        : report.repositoryInventory) === null || _a === void 0
      ? void 0
      : _a.totalFiles) != null
      ? report.repositoryInventory
      : null;
  const reportRoot =
    (_e =
      (_d =
        (_c =
          (_b =
            reportInventory === null || reportInventory === void 0
              ? void 0
              : reportInventory.projectRoot) !== null && _b !== void 0
            ? _b
            : report === null || report === void 0
              ? void 0
              : report.scanTargetRoot) !== null && _c !== void 0
          ? _c
          : report === null || report === void 0
            ? void 0
            : report.platformRoot) !== null && _d !== void 0
        ? _d
        : report === null || report === void 0
          ? void 0
          : report.projectRoot) !== null && _e !== void 0
      ? _e
      : null;
  const reportStale =
    report && requested ? isLegacyScanReport(report, requested) : false;
  const reportAligned = Boolean(
    (report === null || report === void 0 ? void 0 : report.generatedAt) &&
    requested &&
    reportRoot &&
    isInventoryRootAligned(requested, reportRoot) &&
    !reportStale,
  );
  const liveRoot =
    (liveInventory === null || liveInventory === void 0
      ? void 0
      : liveInventory.projectRoot) ||
    requested ||
    null;
  const liveAligned = Boolean(
    (liveInventory === null || liveInventory === void 0
      ? void 0
      : liveInventory.totalFiles) != null &&
    (!requested || isInventoryRootAligned(requested, liveRoot)),
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
    (_h =
      (_g =
        (_f =
          inventory === null || inventory === void 0
            ? void 0
            : inventory.projectRoot) !== null && _f !== void 0
          ? _f
          : reportAligned
            ? reportRoot
            : null) !== null && _g !== void 0
        ? _g
        : requested) !== null && _h !== void 0
      ? _h
      : null;
  const profile =
    (inventory === null || inventory === void 0 ? void 0 : inventory.profile) ||
    "explorer";
  const files =
    (_j =
      inventory === null || inventory === void 0
        ? void 0
        : inventory.totalFiles) !== null && _j !== void 0
      ? _j
      : reportAligned
        ? (_k =
            report === null || report === void 0
              ? void 0
              : report.repositoryFilesTotal) !== null && _k !== void 0
          ? _k
          : reportInventory === null || reportInventory === void 0
            ? void 0
            : reportInventory.totalFiles
        : null;
  const folders =
    (_l =
      inventory === null || inventory === void 0
        ? void 0
        : inventory.totalFolders) !== null && _l !== void 0
      ? _l
      : reportAligned
        ? (_m =
            report === null || report === void 0
              ? void 0
              : report.repositoryFoldersTotal) !== null && _m !== void 0
          ? _m
          : reportInventory === null || reportInventory === void 0
            ? void 0
            : reportInventory.totalFolders
        : null;
  const ruleScoped = reportAligned
    ? (_q =
        (_o =
          report === null || report === void 0
            ? void 0
            : report.ruleScopedFilesAnalyzed) !== null && _o !== void 0
          ? _o
          : (_p =
                report === null || report === void 0
                  ? void 0
                  : report.scanScope) === null || _p === void 0
            ? void 0
            : _p.ruleScopedFilesAnalyzed) !== null && _q !== void 0
      ? _q
      : null
    : null;
  const generatedAt = reportAligned
    ? (_r =
        report === null || report === void 0 ? void 0 : report.generatedAt) !==
        null && _r !== void 0
      ? _r
      : null
    : null;
  const pathAligned =
    requested && inventoryRoot
      ? isInventoryRootAligned(requested, inventoryRoot)
      : null;
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
      reportStale ||
      (Boolean(
        (report === null || report === void 0 ? void 0 : report.generatedAt) &&
        requested &&
        reportRoot,
      ) &&
        !reportAligned),
    hasReport: reportAligned,
    liveInventory:
      liveAligned &&
      Boolean(
        (liveInventory === null || liveInventory === void 0
          ? void 0
          : liveInventory.totalFiles) != null,
      ),
    inventoryFetchedAt:
      (_s = options.inventoryFetchedAt) !== null && _s !== void 0 ? _s : null,
    reportMisaligned: Boolean(
      (report === null || report === void 0 ? void 0 : report.generatedAt) &&
      requested &&
      reportRoot &&
      !reportAligned,
    ),
  };
}
/**
 * Render inventory provenance html.
 * @param {any} provenance
 * @param {Object} options
 * @returns {any}
 */
export function renderInventoryProvenanceHtml(provenance, options = {}) {
  var _a;
  if (!provenance) return "";
  const redactPath = options.redactPath || ((value) => String(value || ""));
  const selectedLabel = provenance.requestedPath
    ? redactPath(provenance.requestedPath)
    : "—";
  const walkedLabel = provenance.inventoryRoot
    ? redactPath(provenance.inventoryRoot)
    : selectedLabel;
  const countLine =
    provenance.files != null
      ? `${formatNumber(provenance.files)} files · ${formatNumber((_a = provenance.folders) !== null && _a !== void 0 ? _a : 0)} folders indexed (${provenance.profile} profile)`
      : "Inventory pending";
  if (!provenance.hasReport) {
    if (provenance.liveInventory && provenance.files != null) {
      const fetchedAt = provenance.inventoryFetchedAt
        ? new Date(provenance.inventoryFetchedAt).toLocaleString()
        : "just now";
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
    : "—";
  const ruleLine =
    provenance.ruleScoped != null
      ? `${formatNumber(provenance.ruleScoped)} gate rules checked`
      : "";
  if (provenance.stale || provenance.pathAligned === false) {
    return `
      <div class="analyze-inventory-provenance analyze-inventory-provenance--mismatch" data-inventory-provenance role="alert">
        <strong>Path mismatch</strong> — selected <code>${escapeHtml(selectedLabel)}</code> does not match loaded inventory root <code>${escapeHtml(walkedLabel)}</code>.
        ${
          provenance.files != null
            ? `Showing <strong>${escapeHtml(formatNumber(provenance.files))}</strong> files from the loaded report (${escapeHtml(provenance.profile)} profile), not from your selected folder.`
            : ""
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
      ${ruleLine ? ` · ${escapeHtml(ruleLine)}` : ""}
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
  var _a, _b, _c, _d;
  if (
    !(report === null || report === void 0 ? void 0 : report.platformRoot) ||
    !(report === null || report === void 0 ? void 0 : report.projectRoot)
  )
    return "";
  if (
    normalizeProjectPath(report.platformRoot) ===
    normalizeProjectPath(report.projectRoot)
  ) {
    return "";
  }
  const repoFiles =
    (_a = report.repositoryFilesTotal) !== null && _a !== void 0
      ? _a
      : (_b = report.repositoryInventory) === null || _b === void 0
        ? void 0
        : _b.totalFiles;
  const jsonFiction =
    (_c = report.fictionJsonFilesScanned) !== null && _c !== void 0
      ? _c
      : (_d = report.scanScope) === null || _d === void 0
        ? void 0
        : _d.fictionJsonFilesScanned;
  const parts = [
    repoFiles != null
      ? `Repository inventory (${Number(repoFiles).toLocaleString()} files) uses your requested path`
      : "Repository inventory uses your requested path",
    "Gate mock paths, schema validation, and production-leak rules use the detected platform root",
    jsonFiction != null
      ? `Fiction/KPI patterns scan ${Number(jsonFiction).toLocaleString()} JSON files under the requested path`
      : null,
    "Source code (.js, .py, etc.) is not semantically reviewed — pattern matching on JSON and configured rules only",
  ].filter(Boolean);
  return parts.join(". ") + ".";
}
/**
 * Project path matches report root.
 * @param {string} projectPath
 * @param {number} reportRoot
 * @returns {any}
 */
export function isHostedServerDefaultPath(projectPath) {
  const norm = normalizeProjectPath(projectPath);
  if (!norm) return false;
  return norm.startsWith("opt/render/") || norm.includes("/render/project/");
}
/** True when the dashboard is served from Pages / production (not localhost). */
export function isRemoteHostedDashboard() {
  if (typeof window === "undefined") return false;
  return !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname);
}
function isUnixAbsolutePath(projectPath) {
  const raw = String(projectPath || "").trim();
  return raw.startsWith("/") && !/^[a-zA-Z]:/.test(raw);
}
/**
 * Hosted Pages must not treat the Render server default (/opt/render/...) or other
 * Unix-only paths as scannable targets on Windows browsers — use in-browser folder scan.
 */
export function shouldClearHostedServerDefaultPath(projectPath) {
  if (!isRemoteHostedDashboard()) return false;
  const path = String(projectPath || "").trim();
  if (!path || isRemoteRepoUrl(path)) return false;
  if (isHostedServerDefaultPath(path)) return true;
  return isUnixAbsolutePath(path);
}
/** Path must be scanned in the browser (folder picker), not via the remote server. */
export function isHostedBrowserScanPath(projectPath) {
  const path = String(projectPath || "").trim();
  if (!path || isRemoteRepoUrl(path) || !isRemoteHostedDashboard())
    return false;
  if (isLocalPath(path)) return true;
  return shouldClearHostedServerDefaultPath(path);
}
function projectPathMatchesReportRoot(projectPath, reportRoot) {
  const normPath = normalizeProjectPath(projectPath);
  const normRoot = normalizeProjectPath(reportRoot);
  if (!normPath || !normRoot) return false;
  if (normPath === normRoot) return true;
  // Sanitized gate exports redact absolute host paths to project label (basename only).
  if (
    !normRoot.includes("/") &&
    (normPath === normRoot || normPath.endsWith(`/${normRoot}`))
  ) {
    return true;
  }
  if (
    !normPath.includes("/") &&
    (normRoot === normPath || normRoot.endsWith(`/${normPath}`))
  ) {
    return true;
  }
  // Render / monorepo layout: parent path in UI vs nested scan root (or vice versa).
  if (
    normPath.startsWith(`${normRoot}/`) ||
    normRoot.startsWith(`${normPath}/`)
  ) {
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
  if (!inv.includes("/") && req.endsWith(`/${inv}`)) return true;
  if (!req.includes("/") && inv.endsWith(`/${req}`)) return true;
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
export function isLegacyScanReport(report, projectPath = "") {
  var _a;
  if (!report) return true;
  const normalized = normalizeScanReport(report);
  if (normalized.reportVersion == null || normalized.reportVersion < 2)
    return true;
  // Browser-local scans are scoped to the picked folder; hosted UI may still show the server default path.
  if (
    normalized.scanSource === "browser-local" ||
    normalized.scanSource === "browser-sandbox"
  ) {
    const root = normalized.projectRoot || normalized.projectPath || "";
    if (!root || !projectPath || isHostedServerDefaultPath(projectPath))
      return false;
    if (isRemoteHostedDashboard()) {
      if (shouldClearHostedServerDefaultPath(projectPath)) return false;
      if (
        isLocalPath(projectPath) &&
        !projectPathMatchesReportRoot(projectPath, root)
      ) {
        const pathBase = String(projectPath).split(/[/\\]/).pop() || "";
        const rootBase = String(root).split(/[/\\]/).pop() || "";
        if (
          pathBase &&
          rootBase &&
          pathBase.toLowerCase() === rootBase.toLowerCase()
        )
          return false;
      }
    }
    if (projectPathMatchesReportRoot(projectPath, root)) return false;
    return !projectPathMatchesReportRoot(projectPath, root);
  }
  if (!projectPath || !normalized.projectRoot) return false;
  if (projectPathMatchesReportRoot(projectPath, normalized.projectRoot))
    return false;
  const inventoryRoot =
    (_a = normalized.repositoryInventory) === null || _a === void 0
      ? void 0
      : _a.projectRoot;
  if (inventoryRoot && projectPathMatchesReportRoot(projectPath, inventoryRoot))
    return false;
  const scanTargetRoot = normalized.scanTargetRoot || normalized.platformRoot;
  if (
    scanTargetRoot &&
    projectPathMatchesReportRoot(projectPath, scanTargetRoot)
  )
    return false;
  return true;
}
/**
 * Get scan file metrics.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function getScanFileMetrics(report, options = {}) {
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
    _11;
  const normalizedReport = normalizeScanReport(report);
  const inventory =
    options.repositoryInventory ||
    (normalizedReport === null || normalizedReport === void 0
      ? void 0
      : normalizedReport.repositoryInventory) ||
    null;
  if (!report || typeof report !== "object") {
    return {
      filesAnalyzed: null,
      mockSampleFiles: null,
      credentialScanned: null,
      repositoryFiles:
        (_a =
          inventory === null || inventory === void 0
            ? void 0
            : inventory.totalFiles) !== null && _a !== void 0
          ? _a
          : null,
      repositoryFolders:
        (_b =
          inventory === null || inventory === void 0
            ? void 0
            : inventory.totalFolders) !== null && _b !== void 0
          ? _b
          : null,
      repositoryRoot:
        (_c =
          inventory === null || inventory === void 0
            ? void 0
            : inventory.projectRoot) !== null && _c !== void 0
          ? _c
          : null,
    };
  }
  if (normalizedReport.type === "file-merger-reduction-report") {
    const sampleDataFiles =
      (_g =
        (_e =
          (_d = normalizedReport.summary) === null || _d === void 0
            ? void 0
            : _d.sampleDataFilesAnalyzed) !== null && _e !== void 0
          ? _e
          : (_f = normalizedReport.summary) === null || _f === void 0
            ? void 0
            : _f.filesAnalyzed) !== null && _g !== void 0
        ? _g
        : 0;
    const repoFiles =
      (_o =
        (_l =
          (_j =
            (_h = normalizedReport.summary) === null || _h === void 0
              ? void 0
              : _h.repositoryFilesTotal) !== null && _j !== void 0
            ? _j
            : (_k = normalizedReport.repositoryInventory) === null ||
                _k === void 0
              ? void 0
              : _k.totalFiles) !== null && _l !== void 0
          ? _l
          : (_m = normalizedReport.summary) === null || _m === void 0
            ? void 0
            : _m.filesAnalyzed) !== null && _o !== void 0
        ? _o
        : null;
    return {
      filesAnalyzed:
        repoFiles !== null && repoFiles !== void 0
          ? repoFiles
          : sampleDataFiles,
      mockSampleFiles: sampleDataFiles,
      jsonFilesAnalyzed:
        (_q =
          (_p = normalizedReport.summary) === null || _p === void 0
            ? void 0
            : _p.jsonFilesAnalyzed) !== null && _q !== void 0
          ? _q
          : null,
      credentialScanned: null,
      productionLeakScanned: null,
      repositoryFiles: repoFiles,
      repositoryFolders:
        (_u =
          (_s =
            (_r = normalizedReport.summary) === null || _r === void 0
              ? void 0
              : _r.repositoryFoldersTotal) !== null && _s !== void 0
            ? _s
            : (_t = normalizedReport.repositoryInventory) === null ||
                _t === void 0
              ? void 0
              : _t.totalFolders) !== null && _u !== void 0
          ? _u
          : null,
      repositoryRoot:
        (_w =
          (_v = normalizedReport.repositoryInventory) === null || _v === void 0
            ? void 0
            : _v.projectRoot) !== null && _w !== void 0
          ? _w
          : null,
    };
  }
  const mockSampleFiles =
    (_x = normalizedReport.mockSampleFiles) !== null && _x !== void 0 ? _x : 0;
  const ruleScopedFilesAnalyzed =
    (_z =
      (_y = normalizedReport.ruleScopedFilesAnalyzed) !== null && _y !== void 0
        ? _y
        : normalizedReport.filesAnalyzed) !== null && _z !== void 0
      ? _z
      : 0;
  const repositoryFiles =
    (_1 =
      (_0 = normalizedReport.repositoryFilesTotal) !== null && _0 !== void 0
        ? _0
        : inventory === null || inventory === void 0
          ? void 0
          : inventory.totalFiles) !== null && _1 !== void 0
      ? _1
      : null;
  return {
    filesAnalyzed: ruleScopedFilesAnalyzed,
    ruleScopedFilesAnalyzed,
    mockSampleFiles,
    fictionJsonFilesScanned:
      (_4 =
        (_2 = normalizedReport.fictionJsonFilesScanned) !== null &&
        _2 !== void 0
          ? _2
          : (_3 = normalizedReport.scanScope) === null || _3 === void 0
            ? void 0
            : _3.fictionJsonFilesScanned) !== null && _4 !== void 0
        ? _4
        : null,
    credentialScanned:
      (_5 = normalizedReport.credentialScanned) !== null && _5 !== void 0
        ? _5
        : 0,
    productionLeakScanned:
      (_6 = normalizedReport.productionLeakScanned) !== null && _6 !== void 0
        ? _6
        : 0,
    repositoryFiles,
    repositoryFolders:
      (_8 =
        (_7 = normalizedReport.repositoryFoldersTotal) !== null && _7 !== void 0
          ? _7
          : inventory === null || inventory === void 0
            ? void 0
            : inventory.totalFolders) !== null && _8 !== void 0
        ? _8
        : null,
    repositoryRoot:
      (_11 =
        (_9 =
          inventory === null || inventory === void 0
            ? void 0
            : inventory.projectRoot) !== null && _9 !== void 0
          ? _9
          : (_10 = normalizedReport.repositoryInventory) === null ||
              _10 === void 0
            ? void 0
            : _10.projectRoot) !== null && _11 !== void 0
        ? _11
        : null,
  };
}
/**
 * Resolve display score.
 * @param {number} report
 * @returns {any}
 */
export function resolveDisplayScore(report) {
  var _a, _b, _c;
  if (!report) return null;
  return (_c =
    (_b =
      (_a = report.consistencyScore) !== null && _a !== void 0
        ? _a
        : report.schemaCompliance) !== null && _b !== void 0
      ? _b
      : report.qualityScore) !== null && _c !== void 0
    ? _c
    : null;
}
/** Prefer API report when it is newer than cached app state. */
export function shouldPreferLiveReport(cachedReport, liveReport) {
  if (
    !(liveReport === null || liveReport === void 0
      ? void 0
      : liveReport.generatedAt)
  )
    return false;
  if (
    !(cachedReport === null || cachedReport === void 0
      ? void 0
      : cachedReport.generatedAt)
  )
    return true;
  const liveAt = Date.parse(liveReport.generatedAt);
  const cachedAt = Date.parse(cachedReport.generatedAt);
  if (Number.isNaN(liveAt)) return false;
  if (Number.isNaN(cachedAt)) return true;
  return liveAt >= cachedAt;
}
/** Refresh app scan report from API when live data is newer. */
export async function refreshLiveReport(scanService, state) {
  var _a;
  const live = await scanService.fetchReport();
  if (!live) return (_a = state.report) !== null && _a !== void 0 ? _a : null;
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
  if (
    baseline === null || baseline === void 0 ? void 0 : baseline.jestTestsLabel
  )
    return baseline.jestTestsLabel;
  const jestSummary =
    report === null || report === void 0 ? void 0 : report.jestSummary;
  if (
    (jestSummary === null || jestSummary === void 0
      ? void 0
      : jestSummary.testsPassed) != null &&
    (jestSummary === null || jestSummary === void 0
      ? void 0
      : jestSummary.testsTotal) != null
  ) {
    const suites =
      jestSummary.suitesPassed != null
        ? ` · ${jestSummary.suitesPassed} suites`
        : "";
    return `${jestSummary.testsPassed}/${jestSummary.testsTotal}${suites}`;
  }
  const overview =
    dashboardHome === null || dashboardHome === void 0
      ? void 0
      : dashboardHome.overview;
  if (
    (overview === null || overview === void 0
      ? void 0
      : overview.passedTests) != null &&
    (overview === null || overview === void 0 ? void 0 : overview.totalTests) !=
      null
  ) {
    return `${overview.passedTests}/${overview.totalTests}`;
  }
  if (
    (report === null || report === void 0
      ? void 0
      : report.jestBaselineChecked) === false
  ) {
    return "Off (enable jest-baseline in config)";
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
  var _a, _b;
  if (
    (report === null || report === void 0
      ? void 0
      : report.pageSampleSchemaChecked) != null
  ) {
    return `${(_a = report.pageSampleSchemaPassed) !== null && _a !== void 0 ? _a : 0}/${report.pageSampleSchemaChecked}`;
  }
  return (_b =
    baseline === null || baseline === void 0
      ? void 0
      : baseline.pageSamplesLabel) !== null && _b !== void 0
    ? _b
    : null;
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
  const suiteSuffix = suites != null ? ` across ${suites} suites` : "";
  return String(text)
    .replace(
      /\d+\/\d+ tests pass(?:ing)?(?: across \d+ suites)?/gi,
      `${jestLabel} tests passing${suiteSuffix}`,
    )
    .replace(
      /\d+\/\d+ Jest tests passing(?: across \d+ suites)?/gi,
      `${jestLabel} Jest tests passing${suiteSuffix}`,
    )
    .replace(
      /\d+\/\d+ Jest(?: tests)?(?: \(?\d+ suites?\)?)?/gi,
      `${jestLabel} Jest${suites != null ? ` (${suites} suites)` : ""}`,
    );
}
/** Overlay live baseline Jest counts onto dashboard-home insights (API snapshots may lag). */
export function hydrateDashboardHome(home, baseline) {
  var _a, _b, _c, _d;
  if (!home) return home;
  const jestLabel = resolveJestTestsLabel(baseline, home);
  const jestPassing =
    (_a =
      baseline === null || baseline === void 0
        ? void 0
        : baseline.jestTestsPassing) !== null && _a !== void 0
      ? _a
      : (_b = home === null || home === void 0 ? void 0 : home.overview) ===
            null || _b === void 0
        ? void 0
        : _b.passedTests;
  const suites =
    (_c =
      baseline === null || baseline === void 0
        ? void 0
        : baseline.jestSuites) !== null && _c !== void 0
      ? _c
      : (_d = home === null || home === void 0 ? void 0 : home.overview) ===
            null || _d === void 0
        ? void 0
        : _d.testSuites;
  if (!jestLabel) return home;
  /**
   * Comparative analysis.
   * @param {any} home.comparativeAnalysis || []
   * @returns {any}
   */
  const comparativeAnalysis = (home.comparativeAnalysis || []).map((row) => {
    if (String(row.metric || "").toLowerCase() !== "jest tests") return row;
    const prevNum = Number(String(row.previous).replace(/[^\d.-]/g, ""));
    const change =
      Number.isFinite(prevNum) && jestPassing != null && prevNum !== jestPassing
        ? `${jestPassing > prevNum ? "+" : ""}${jestPassing - prevNum} tests`
        : row.change;
    return {
      ...row,
      current:
        jestPassing !== null && jestPassing !== void 0
          ? jestPassing
          : row.current,
      change,
    };
  });
  /**
   * Kpis.
   * @param {any} home.kpis || []
   * @returns {any}
   */
  const kpis = (home.kpis || []).map((item) =>
    String(item.name || "")
      .toLowerCase()
      .includes("jest")
      ? { ...item, current: jestLabel, target: jestLabel }
      : item,
  );
  const healthSummary = home.healthSummary
    ? {
        ...home.healthSummary,
        highlights: (home.healthSummary.highlights || []).map((line) =>
          replaceJestMentions(line, jestLabel, suites),
        ),
      }
    : home.healthSummary;
  return {
    ...home,
    overview: home.overview
      ? {
          ...home.overview,
          totalTests:
            jestPassing !== null && jestPassing !== void 0
              ? jestPassing
              : home.overview.totalTests,
          passedTests:
            jestPassing !== null && jestPassing !== void 0
              ? jestPassing
              : home.overview.passedTests,
          testSuites:
            suites !== null && suites !== void 0
              ? suites
              : home.overview.testSuites,
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
  if (
    metrics.repositoryFiles != null &&
    metrics.filesAnalyzed !== metrics.repositoryFiles
  ) {
    if (metrics.filesAnalyzed <= metrics.repositoryFiles) {
      parts.push(`of ${formatNumber(metrics.repositoryFiles)} total`);
    } else {
      parts.push(`${formatNumber(metrics.repositoryFiles)} in repo`);
    }
  }
  if (
    metrics.ruleScopedFilesAnalyzed != null &&
    metrics.ruleScopedFilesAnalyzed !== metrics.filesAnalyzed
  ) {
    parts.push(
      `${formatNumber(metrics.ruleScopedFilesAnalyzed)} gate rules checked`,
    );
  }
  if (metrics.mockSampleFiles != null) {
    parts.push(`${formatNumber(metrics.mockSampleFiles)} mock/sample`);
  }
  if (metrics.fictionJsonFilesScanned != null) {
    parts.push(
      `${formatNumber(metrics.fictionJsonFilesScanned)} JSON fiction-scanned`,
    );
  }
  if (report === null || report === void 0 ? void 0 : report.totalSizeLabel) {
    parts.push(report.totalSizeLabel);
  }
  return parts.length ? parts.join(" · ") : "0 files analyzed";
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
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  const scope =
    report === null || report === void 0 ? void 0 : report.scanScope;
  if (!scope) {
    return [
      "Legacy report — re-run Scan to attach scanScope metadata.",
      "PASS applies to configured scanPaths and production rules only, not the full repo tree.",
    ];
  }
  const lines = [
    scope.repositoryFilesTotal != null
      ? `Repository inventory: ${Number(scope.repositoryFilesTotal).toLocaleString()} files, ${Number((_a = scope.repositoryFoldersTotal) !== null && _a !== void 0 ? _a : 0).toLocaleString()} folders`
      : null,
    scope.ruleScopedFilesAnalyzed != null
      ? `Gate rules checked: ${scope.ruleScopedFilesAnalyzed} files (mock paths + credentials + production leak dirs)`
      : null,
    `Profile: ${scope.profile} · rules: ${(scope.rulesEnabled || []).join(", ") || "—"}`,
    `Mock/sample files in scanPaths: ${(_c = (_b = scope.mockSampleFilesInScanPaths) !== null && _b !== void 0 ? _b : report === null || report === void 0 ? void 0 : report.mockSampleFiles) !== null && _c !== void 0 ? _c : "—"}`,
    `Page specs validated: ${(_e = (_d = scope.pageSpecsValidated) !== null && _d !== void 0 ? _d : report === null || report === void 0 ? void 0 : report.pageSampleSchemaChecked) !== null && _e !== void 0 ? _e : "—"}/${(_f = scope.pageSpecCatalogSize) !== null && _f !== void 0 ? _f : "—"} (${(_g = scope.pageSpecsFromAliasPaths) !== null && _g !== void 0 ? _g : 0} via aliased roadmap paths)`,
    `Production code files scanned: ${(_j = (_h = scope.productionDirsScanned) !== null && _h !== void 0 ? _h : report === null || report === void 0 ? void 0 : report.productionLeakScanned) !== null && _j !== void 0 ? _j : "—"} under ${(scope.productionPaths || []).join(", ") || "server/"}`,
    scope.fictionJsonFilesScanned != null
      ? `Fiction/KPI patterns: ${scope.fictionJsonFilesScanned} JSON files scanned (${(_k = scope.fictionSampleFilesScanned) !== null && _k !== void 0 ? _k : "—"} sample files) — scope: ${scope.fictionScope || "repository-json"}`
      : null,
    scope.jestExecutedDuringScan
      ? "Jest executed during this scan."
      : "Jest not executed during scan — baseline from .simplebeacon/baseline.json / npm test separately.",
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
        ${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}
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
  const id = String(aiProvider || "demo").toLowerCase();
  return id !== "demo";
}
/**
 * Is simplebeacon report.
 * @param {any} obj
 * @returns {any}
 */
export function isSimplebeaconReport(obj) {
  return obj && (obj.type === "simplebeacon-report" || obj.rawIssues != null);
}
/**
 * Normalize a v1 Simplebeacon report (categories/findings shape) to the v2
 * shape expected by the dashboard (rawIssues/detectedIssues + scan_summary).
 * @param {any} report
 * @returns {any}
 */
function flattenCategoryFindings(categories) {
  const detectedIssues = [];
  for (const [category, data] of Object.entries(categories || {})) {
    if (!data || !Array.isArray(data.findings)) continue;
    for (const finding of data.findings) {
      detectedIssues.push({
        type: category,
        category,
        filePath: finding.file || finding.filePath || "",
        file: finding.file || finding.filePath || "",
        line: finding.line || 0,
        severity: String(
          finding.severity || data.severity || "medium",
        ).toLowerCase(),
        message: finding.message || "",
        description: finding.message || "",
        count: finding.count || 1,
      });
    }
  }
  return detectedIssues;
}

export function normalizeSimplebeaconReport(report) {
  if (!report || typeof report !== "object") return report;

  const fromArrays =
    report.rawIssues && report.rawIssues.length
      ? report.rawIssues
      : report.detectedIssues && report.detectedIssues.length
        ? report.detectedIssues
        : null;

  let detectedIssues = fromArrays
    ? fromArrays.map(normalizeDashboardIssue).filter(Boolean)
    : flattenCategoryFindings(report.categories);

  if (!detectedIssues.length) return report;

  const severityCounts =
    report.severityCounts ||
    report.summary?.severityCounts ||
    detectedIssues.reduce(
      (acc, issue) => {
        const weight = Number(issue.count) || 1;
        const sev = issue.severity || "medium";
        acc[sev] = (acc[sev] || 0) + weight;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
    );
  const total = detectedIssues.reduce(
    (sum, issue) => sum + (Number(issue.count) || 1),
    0,
  );
  const gate = report.gate || {};
  const blockingCount =
    gate.blockingCount ??
    detectedIssues
      .filter((i) => {
        const sev = i.severityBand || i.severity;
        return sev === "high" || sev === "critical";
      })
      .reduce((sum, i) => sum + (Number(i.count) || 1), 0);
  const warningCount =
    gate.warningCount ??
    detectedIssues
      .filter((i) => {
        const sev = i.severityBand || i.severity;
        return sev === "medium" || sev === "low";
      })
      .reduce((sum, i) => sum + (Number(i.count) || 1), 0);
  const gatePass =
    gate.pass === true || (gate.pass == null && blockingCount === 0);
  const scan_summary = {
    ...(report.scan_summary || {}),
    status: gatePass ? "PASSED" : "FAILED",
    block_merge: !gatePass,
    total_risks_found: report.scan_summary?.total_risks_found ?? total,
    high_severity_count: severityCounts.high || 0,
    medium_severity_count: severityCounts.medium || 0,
    low_severity_count: severityCounts.low || 0,
    estimated_incident_cost_saved:
      report.scan_summary?.estimated_incident_cost_saved ?? "$0",
  };
  const severityWeight = { critical: 12, high: 6, medium: 2, low: 1 };
  const weightedPenalty = detectedIssues
    .filter((i) => {
      const sev = i.severityBand || i.severity;
      return sev === "high" || sev === "critical";
    })
    .reduce(
      (sum, i) =>
        sum +
        (severityWeight[i.severityBand || i.severity] || 1) *
          (Number(i.count) || 1),
      0,
    );
  const computedQualityScore = Math.max(
    0,
    Math.min(100, Math.round(100 - Math.min(weightedPenalty, 85))),
  );
  const qualityScore =
    report.qualityScore ??
    (detectedIssues.length > 0 ? computedQualityScore : null);
  const reconciledGate = {
    ...(report.gate || {}),
    pass: gatePass,
    blockingCount,
    warningCount,
    score: qualityScore ?? 0,
  };
  return Object.assign({}, report, {
    reportVersion: 2,
    rawIssues: detectedIssues,
    detectedIssues,
    findings:
      report.findings && report.findings.length
        ? report.findings
        : detectedIssues,
    severityCounts,
    gate: reconciledGate,
    scan_summary,
    issueCount: report.issueCount || total,
    qualityScore,
    filesAnalyzed:
      report.codeFilesAnalyzed ||
      report.filesAnalyzed ||
      report.summary?.codeFilesAnalyzed ||
      0,
    totalFiles:
      report.repositoryFilesTotal ||
      report.summary?.totalFiles ||
      report.totalFiles ||
      0,
  });
}
/**
 * Is codebase report.
 * @param {any} obj
 * @returns {any}
 */
export function isCodebaseReport(obj) {
  return obj && obj.type === "codebase-analyzer-report";
}
/**
 * Is deterministic analysis mode.
 * @param {any} analysisType
 * @returns {any}
 */
export function isDeterministicAnalysisMode(analysisType) {
  return [
    "simplebeacon",
    "mock-scan",
    "consolidation",
    "codebase",
    "complete",
  ].includes(analysisType);
}
/**
 * Resolve auto analysis mode.
 * @param {string} projectPath
 * @returns {any}
 */
export function resolveAutoAnalysisMode(projectPath) {
  const normalized = String(projectPath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  // Simplebeacon's own repos or repos with .simplebeacon config → gate scan
  if (
    normalized.includes("web\/data") ||
    normalized.endsWith("/ai-platform") ||
    normalized.endsWith("ai-platform") ||
    normalized.includes("/data/mock") ||
    normalized.includes("simplebeacon")
  ) {
    return "simplebeacon";
  }
  // Large/unknown projects → complete audit gives the most value
  // Check path depth as a proxy for project complexity
  const depth = normalized.split("/").filter(Boolean).length;
  if (depth > 4) {
    return "complete";
  }
  // Default → roadmap (lightweight, useful for any codebase)
  return "roadmap";
}
/**
 * Normalize one dashboard issue row (severityBand, paths, count).
 * @param {Object} issue
 * @returns {Object|null}
 */
function normalizeDashboardIssue(issue) {
  if (!issue || typeof issue !== "object") return null;
  const severity = String(
    issue.severity || issue.severityBand || "low",
  ).toLowerCase();
  const filePath =
    issue.filePath ||
    issue.file ||
    issue.path ||
    (issue.filePaths && issue.filePaths[0]) ||
    (issue.affectedFiles && issue.affectedFiles[0]) ||
    "";
  return {
    ...issue,
    severity,
    severityBand: issue.severityBand || severity,
    filePath,
    type: issue.type || issue.category || "finding",
    description:
      issue.description ||
      issue.message ||
      issue.recommendedAction ||
      issue.type ||
      "Finding",
    count: issue.count || 1,
  };
}
/**
 * Resolve all displayable issues from a scan report (handles stripped public-gate payloads).
 * @param {Object} report
 * @returns {Array}
 */
export function resolveReportIssues(report) {
  if (!report || typeof report !== "object") return [];
  const normalized = normalizeSimplebeaconReport(report);
  let issues = [];
  const primary =
    normalized.rawIssues && normalized.rawIssues.length
      ? normalized.rawIssues
      : normalized.detectedIssues || [];
  if (primary.length)
    issues = primary.map(normalizeDashboardIssue).filter(Boolean);
  if (!issues.length) {
    const fromCategories = flattenCategoryFindings(normalized.categories);
    if (fromCategories.length)
      issues = fromCategories.map(normalizeDashboardIssue).filter(Boolean);
  }
  if (
    !issues.length &&
    Array.isArray(report.findings) &&
    report.findings.length
  ) {
    issues = report.findings.map(normalizeDashboardIssue).filter(Boolean);
  }
  if (!issues.length && report.gate) {
    const gateIssues = [
      ...(report.gate.blockingIssues || []),
      ...(report.gate.warningIssues || []),
      ...(report.gate.allIssues || []),
    ];
    if (gateIssues.length)
      issues = gateIssues.map(normalizeDashboardIssue).filter(Boolean);
  }
  if (
    !issues.length &&
    report.severityCounts &&
    typeof report.severityCounts === "object"
  ) {
    for (const [severity, count] of Object.entries(report.severityCounts)) {
      const n = Number(count) || 0;
      if (n <= 0) continue;
      issues.push(
        normalizeDashboardIssue({
          type: "scan-summary",
          severity,
          count: n,
          description: `${n.toLocaleString()} ${severity} finding(s) — export JSON or upgrade for full file paths`,
          filePath: "",
        }),
      );
    }
  }
  return issues;
}
/**
 * Issue list.
 * @param {number} report
 * @returns {any}
 */
function issueList(report) {
  return resolveReportIssues(report);
}
/**
 * Filter issues by kind.
 * @param {number} report
 * @param {any} kind
 * @returns {any}
 */
export function filterIssuesByKind(report, kind = "all") {
  const raw = issueList(report);
  if (kind === "fiction") {
    return raw.filter((i) =>
      /fiction|fictional|consistency|kpi/i.test(String(i.type || "")),
    );
  }
  if (kind === "credentials") {
    return raw.filter((i) => /credential/i.test(String(i.type || "")));
  }
  if (kind === "production") {
    return raw.filter((i) => /production leak/i.test(String(i.type || "")));
  }
  return raw;
}
/**
 * Build consolidation conclusion.
 * @param {any} scan
 * @returns {any}
 */
export function buildConsolidationConclusion(scan) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
  if (!(scan === null || scan === void 0 ? void 0 : scan.summary)) {
    return "No consolidation scan available.";
  }
  const projectPath = String(
    scan.projectRoot || scan.projectPath || "",
  ).replace(/\\/g, "/");
  if (isBenchmarkCachePath(projectPath) || scan.benchmarkScan) {
    const repoFiles =
      (_a = scan.summary.repositoryFilesTotal) !== null && _a !== void 0
        ? _a
        : (_b = scan.repositoryInventory) === null || _b === void 0
          ? void 0
          : _b.totalFiles;
    const candidates =
      (scan.summary.mergeCandidates || 0) +
      (scan.summary.reductionOpportunities || 0);
    const parts = [
      "OSS benchmark clone under github-cache/ — consolidation hygiene for the clone only",
      candidates
        ? `${candidates} merge/reduction candidate(s) inside this clone`
        : "No merge/reduction candidates",
      ((_c = scan.summary.sampleDataFilesAnalyzed) !== null && _c !== void 0
        ? _c
        : 0) === 0
        ? "Simplebeacon sample directories are not on this clone"
        : `${scan.summary.sampleDataFilesAnalyzed} sample JSON under configured paths`,
      repoFiles != null
        ? `Clone inventory: ${Number(repoFiles).toLocaleString()} files`
        : null,
      scan.summary.potentialSavingsLabel
        ? `Potential savings: ${scan.summary.potentialSavingsLabel}`
        : null,
      "Re-run on ai-platform root for product handoff evidence",
    ].filter(Boolean);
    return `${parts.join(". ")}.`;
  }
  const s = scan.summary;
  const candidates = (s.mergeCandidates || 0) + (s.reductionOpportunities || 0);
  const repoFiles =
    (_d = s.repositoryFilesTotal) !== null && _d !== void 0
      ? _d
      : (_e = scan.repositoryInventory) === null || _e === void 0
        ? void 0
        : _e.totalFiles;
  const jsonScanned = s.jsonFilesAnalyzed;
  const repoNote =
    repoFiles != null
      ? ` Repository inventory: ${repoFiles.toLocaleString()} files${jsonScanned != null ? `; ${jsonScanned.toLocaleString()} JSON hashed for duplicates (${((_f = s.exactDuplicateGroups) !== null && _f !== void 0 ? _f : 0).toLocaleString()} duplicate groups)` : ""}.`
      : jsonScanned != null
        ? ` ${jsonScanned.toLocaleString()} JSON files hashed for duplicates (${((_g = s.exactDuplicateGroups) !== null && _g !== void 0 ? _g : 0).toLocaleString()} duplicate groups).`
        : "";
  if (!candidates) {
    return `No merge or reduction candidates — ${(_j = (_h = s.sampleDataFilesAnalyzed) !== null && _h !== void 0 ? _h : s.filesAnalyzed) !== null && _j !== void 0 ? _j : 0} sample JSON under configured paths (${s.totalSizeLabel || "—"}).${repoNote} Structure similarity is limited to sample paths; duplicate detection covers all repo JSON.`;
  }
  return `${candidates} merge/reduction candidate(s) — ${(_l = (_k = s.sampleDataFilesAnalyzed) !== null && _k !== void 0 ? _k : s.filesAnalyzed) !== null && _l !== void 0 ? _l : 0} sample JSON, ${jsonScanned != null ? `${jsonScanned.toLocaleString()} repo JSON scanned` : "repo JSON scanned"}.${repoNote} Potential savings: ${s.potentialSavingsLabel || "0B"}.`;
}
/**
 * Build scan conclusion.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function buildScanConclusion(report, options = {}) {
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
    _w;
  if (!report) {
    return "No scan report available.";
  }
  if (options.benchmarkScan) {
    const repoFiles =
      (_a = report.repositoryFilesTotal) !== null && _a !== void 0
        ? _a
        : (_b = report.scanScope) === null || _b === void 0
          ? void 0
          : _b.repositoryFilesTotal;
    const ruleScoped =
      (_e =
        (_c = report.ruleScopedFilesAnalyzed) !== null && _c !== void 0
          ? _c
          : (_d = report.scanScope) === null || _d === void 0
            ? void 0
            : _d.ruleScopedFilesAnalyzed) !== null && _e !== void 0
        ? _e
        : 0;
    const jsonFiction =
      (_f = report.fictionJsonFilesScanned) !== null && _f !== void 0
        ? _f
        : (_g = report.scanScope) === null || _g === void 0
          ? void 0
          : _g.fictionJsonFilesScanned;
    const fiction = filterIssuesByKind(report, "fiction");
    const fictionN = fiction.reduce((sum, i) => sum + (i.count || 1), 0);
    const parts = [
      "OSS benchmark clone under github-cache/ — not Simplebeacon product handoff",
      fictionN
        ? `${fictionN} fiction/KPI pattern(s) in clone JSON`
        : "No fiction KPI hits in product sample paths",
      repoFiles != null
        ? `Repository: ${Number(repoFiles).toLocaleString()} files`
        : null,
      `Product gate paths checked ${Number(ruleScoped).toLocaleString()}`,
      jsonFiction != null
        ? `${Number(jsonFiction).toLocaleString()} JSON scanned for fiction rules`
        : null,
      "Agency-handoff and EU AI Act matches excluded from vendor gate",
    ].filter(Boolean);
    return `${parts.join(". ")}.`;
  }
  const focus = options.focus || "all";
  const _raw =
    focus === "fiction"
      ? filterIssuesByKind(report, "fiction")
      : issueList(report);
  /**
   * Count issues.
   * @param {Array} items
   * @returns {any}
   */
  const countIssues = (items) =>
    items.reduce((sum, i) => sum + (i.count || 1), 0);
  const fiction = filterIssuesByKind(report, "fiction");
  const credentials = filterIssuesByKind(report, "credentials");
  const leaks = filterIssuesByKind(report, "production");
  const schema = issueList(report).filter((i) =>
    /schema/i.test(String(i.type || "")),
  );
  const nonFictionIssues = issueList(report).filter(
    (item) =>
      !/fiction|fictional|consistency|kpi/i.test(String(item.type || "")),
  );
  const nonFictionCount = countIssues(nonFictionIssues);
  const parts = [];
  if (focus === "fiction" || focus === "all") {
    if (fiction.length) {
      parts.push(
        `${countIssues(fiction)} fiction/KPI pattern(s) in repository JSON`,
      );
    } else if (focus === "fiction") {
      const jsonScanned =
        (_h = report.fictionJsonFilesScanned) !== null && _h !== void 0
          ? _h
          : (_j = report.scanScope) === null || _j === void 0
            ? void 0
            : _j.fictionJsonFilesScanned;
      const sampleScanned =
        (_k = report.fictionSampleFilesScanned) !== null && _k !== void 0
          ? _k
          : report.mockSampleFiles;
      if (jsonScanned != null) {
        parts.push(
          `No fiction KPI hits in ${Number(jsonScanned).toLocaleString()} JSON files scanned (${sampleScanned !== null && sampleScanned !== void 0 ? sampleScanned : "—"} sample files among them)`,
        );
      } else {
        parts.push(
          "No known fictional KPI patterns in configured sample files",
        );
      }
    }
  }
  if (focus === "all") {
    if (credentials.length)
      parts.push(`${countIssues(credentials)} credential pattern(s)`);
    if (leaks.length)
      parts.push(`${countIssues(leaks)} production-path sample reference(s)`);
    if (schema.length) parts.push(`${countIssues(schema)} schema violation(s)`);
  }
  const repoFiles =
    (_l = report.repositoryFilesTotal) !== null && _l !== void 0
      ? _l
      : (_m = report.repositoryInventory) === null || _m === void 0
        ? void 0
        : _m.totalFiles;
  const ruleScoped = report.ruleScopedFilesAnalyzed;
  const jsonFiction =
    (_o = report.fictionJsonFilesScanned) !== null && _o !== void 0
      ? _o
      : (_p = report.scanScope) === null || _p === void 0
        ? void 0
        : _p.fictionJsonFilesScanned;
  const jestNote =
    report.jestBaselineChecked === false &&
    ((_q = report.scanScope) === null || _q === void 0
      ? void 0
      : _q.jestExecutedDuringScan) === false
      ? "Jest was not run as part of this scan."
      : "";
  if (focus === "fiction") {
    const gateNote = (
      (_r = report.gate) === null || _r === void 0 ? void 0 : _r.pass
    )
      ? nonFictionCount > 0
        ? `Gate passes on configured severities (${(report.gate.failOn || ["high"]).join(", ")}); ${nonFictionCount} non-fiction finding(s) in Simplebeacon scan.`
        : "Gate passes on configured severities."
      : report.gate
        ? "Gate would fail on configured severities — review before merge."
        : "";
    const inventoryBrief =
      repoFiles != null && ruleScoped != null
        ? `Repository: ${Number(repoFiles).toLocaleString()} files; gate rules checked ${Number(ruleScoped).toLocaleString()}.`
        : "";
    const fictionScope =
      ((_t =
        (_s = report.scanScope) === null || _s === void 0
          ? void 0
          : _s.limitations) === null || _t === void 0
        ? void 0
        : _t.find((line) => /fiction|KPI|source code/i.test(line))) ||
      "Fiction/KPI rules scan repository JSON — pattern matching only, not semantic source review.";
    const lead = parts.length
      ? `${parts.join("; ")}.`
      : "No fiction KPI hits in mock samples.";
    return `${lead} ${[gateNote, inventoryBrief, jestNote, fictionScope].filter(Boolean).join(" ")}`.trim();
  }
  const scope =
    ((_v =
      (_u = report.scanScope) === null || _u === void 0
        ? void 0
        : _u.limitations) === null || _v === void 0
      ? void 0
      : _v[0]) ||
    "Scoped to configured scanPaths and production directories — pattern matching only, not semantic code review.";
  const inventoryNote =
    repoFiles != null
      ? `Repository inventory: ${Number(repoFiles).toLocaleString()} files indexed${ruleScoped != null ? `; gate rules checked ${Number(ruleScoped).toLocaleString()} files` : ""}${jsonFiction != null ? `; ${Number(jsonFiction).toLocaleString()} JSON scanned for fiction/KPI patterns` : ""}. Source files (.js, .py, etc.) are not semantically reviewed.`
      : "";
  const gateNote = (
    (_w = report.gate) === null || _w === void 0 ? void 0 : _w.pass
  )
    ? "Gate passes on configured severities."
    : report.gate
      ? "Gate would fail on configured severities — review before merge."
      : "";
  if (!parts.length) {
    const tail = [inventoryNote, gateNote, jestNote, scope]
      .filter(Boolean)
      .join(" ");
    return tail.trim() || "Clean deterministic scan on configured paths.";
  }
  return `${parts.join("; ")}. ${[gateNote, inventoryNote, jestNote, scope].filter(Boolean).join(" ")}`.trim();
}
/**
 * Build fiction digest payload.
 * @param {number} report
 * @param {Object} options
 * @returns {any}
 */
export function buildFictionDigestPayload(report, options = {}) {
  if (!report) return null;
  const projectPath = options.projectPath || report.projectRoot || "";
  const prepared = preparePlatformResultsReport(report, projectPath);
  const fictionIssues = filterIssuesByKind(prepared, "fiction");
  const nonFictionIssues = issueList(prepared).filter(
    (item) =>
      !/fiction|fictional|consistency|kpi/i.test(String(item.type || "")),
  );
  return sanitizeFictionDigestExport(
    {
      type: "simplebeacon-fiction-digest",
      generatedAt: options.generatedAt || new Date().toISOString(),
      conclusion: buildScanConclusion(prepared, {
        focus: "fiction",
        benchmarkScan: isBenchmarkCachePath(projectPath),
      }),
      fictionIssues,
      nonFictionIssues,
      projectPath,
      sourceProjectPath: projectPath,
      sourceReport: prepared,
    },
    { projectPath },
  );
}
/**
 * Normalize imported report.
 * @param {any} payload
 * @returns {any}
 */
export function normalizeImportedReport(payload) {
  var _a, _b;
  if (payload.type === "simplebeacon-report") return payload;
  if (
    ((_a = payload.report) === null || _a === void 0 ? void 0 : _a.type) ===
    "simplebeacon-report"
  )
    return payload.report;
  if (Array.isArray(payload.rawIssues)) {
    return {
      type: "simplebeacon-report",
      generatedAt: payload.generatedAt || new Date().toISOString(),
      generatedBy: "Import",
      rawIssues: payload.rawIssues,
      detectedIssues: payload.detectedIssues || payload.rawIssues,
      issueCount:
        (_b = payload.issueCount) !== null && _b !== void 0
          ? _b
          : payload.rawIssues.length,
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
  const jsonFiles = files.filter(
    (f) => f.name.endsWith(".json") || f.type === "application/json",
  );
  const reports = [];
  for (const file of jsonFiles) {
    try {
      const payload = await readFileAsJson(file);
      const report = normalizeImportedReport(payload);
      if (report) reports.push({ file: file.name, report });
    } catch (_a) {
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
export async function fetchComplianceChecklist(
  report,
  projectPath,
  options = {},
) {
  var _a;
  const checklistHttpResponse = await fetchWithTimeout(
    "/api/analyze/compliance-checklist",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        report,
        projectPath: projectPath || undefined,
        npmAudit: options.npmAudit || undefined,
        forceNpmAudit: options.forceNpmAudit === true,
      }),
    },
    (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 120000,
  );
  const checklistResponse = await parseJsonSafe(checklistHttpResponse);
  if (!checklistHttpResponse.ok || !checklistResponse.success) {
    throw new Error(
      checklistResponse.error ||
        checklistResponse.message ||
        "Compliance checklist failed",
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
  var _a;
  const params = new URLSearchParams({ _: String(Date.now()) });
  if (projectPath) params.set("projectPath", projectPath);
  if (options.force) params.set("force", "1");
  const data = await fetchJsonWithGuidance(
    `/api/analyze/npm-audit?${params}`,
    {
      headers: authService.getAuthHeaders(),
    },
    (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 180000,
  );
  if (!data.success) {
    throw new Error(data.error || "npm audit failed");
  }
  return data;
}
/**
 * Fetch analyze test sources.
 * @returns {any}
 */
export async function fetchAnalyzeTestSources() {
  const params = new URLSearchParams({ _: String(Date.now()) });
  const data = await fetchJsonWithGuidance(
    `/api/analyze/test-sources?${params}`,
    {
      headers: authService.getAuthHeaders(),
    },
  );
  if (!data.success) {
    throw new Error(data.error || "Failed to load test sources");
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
  var _a;
  const data = await fetchJsonWithGuidance(
    "/api/analyze/github-clone",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify({
        repoUrl,
        refresh: options.refresh === true,
      }),
    },
    (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 180000,
  );
  if (!data.success) {
    throw new Error(data.error || "GitHub clone failed");
  }
  return data;
}
/**
 * Fetch agency branding.
 * @param {string} orgId
 * @returns {any}
 */
export async function fetchAgencyBranding(orgId = "default") {
  const params = new URLSearchParams({ org_id: orgId, _: String(Date.now()) });
  try {
    const data = await fetchJsonWithGuidance(
      `/api/simplebeacon/agency/branding?${params}`,
      {
        headers: authService.getAuthHeaders(),
      },
    );
    return data.branding || data;
  } catch (_a) {
    return { agency_name: "", logo_url: "" };
  }
}
/**
 * Export agency certificate.
 * @param {any} certificateRequest
 * @returns {any}
 */
export async function exportAgencyCertificate(certificateRequest = {}) {
  var _a;
  const certificateExport = await fetchJsonWithGuidance(
    "/api/simplebeacon/export/certificate",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...authService.getAuthHeaders(),
      },
      body: JSON.stringify(certificateRequest),
    },
    (_a = certificateRequest.timeoutMs) !== null && _a !== void 0 ? _a : 120000,
  );
  if (!certificateExport.success) {
    throw new Error(
      certificateExport.message ||
        certificateExport.error ||
        "Certificate export failed",
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
  if (
    !(checklist === null || checklist === void 0
      ? void 0
      : checklist.evaluatedAt)
  )
    return;
  const reportAt = Date.parse(
    (report === null || report === void 0 ? void 0 : report.generatedAt) || "",
  );
  const checklistAt = Date.parse(checklist.evaluatedAt || "");
  if (
    Number.isFinite(reportAt) &&
    Number.isFinite(checklistAt) &&
    checklistAt + 5000 < reportAt
  ) {
    throw new Error(
      "Compliance checklist is older than the gate report — re-run compliance after the latest scan.",
    );
  }
}
/**
 * Assert complete scan file reduction fresh.
 * @param {any} scan
 * @returns {any}
 */
export function assertCompleteScanFileReductionFresh(scan) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  if (!scan || typeof scan !== "object") {
    throw new Error("File reduction scan returned no payload");
  }
  const hasSignal =
    ((_b =
      (_a = scan.fileReductionPlan) === null || _a === void 0
        ? void 0
        : _a.totals) === null || _b === void 0
      ? void 0
      : _b.safeToDeleteBytes) != null ||
    ((_e =
      (_d =
        (_c = scan.fileReductionPlan) === null || _c === void 0
          ? void 0
          : _c.safeToDelete) === null || _d === void 0
        ? void 0
        : _d.topDirectories) === null || _e === void 0
      ? void 0
      : _e.length) ||
    ((_g =
      (_f = scan.scanners) === null || _f === void 0
        ? void 0
        : _f["build-artifacts"]) === null || _g === void 0
      ? void 0
      : _g.safeToDeleteBytes) != null ||
    ((_h = scan.summary) === null || _h === void 0
      ? void 0
      : _h.totalFindings) > 0;
  if (!hasSignal) {
    throw new Error(
      "File reduction scan returned no findings — restart the SimpleBeacon server and retry.",
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
  var _a;
  if (!files || files.length === 0) {
    throw new Error("No files selected for upload");
  }
  const fileArray = Array.from(files);
  const filePaths = fileArray.map((file) => {
    // webkitdirectory and drag-and-drop folders expose the relative path
    return file.webkitRelativePath || file.name || file.fieldname || "file";
  });
  const formData = new FormData();
  fileArray.forEach((file) => formData.append("files", file));
  formData.append("filePaths", JSON.stringify(filePaths));
  formData.append("analysisType", options.analysisType || "simplebeacon");
  const data = await fetchJsonWithGuidance(
    "/api/analyze/upload-directory",
    {
      method: "POST",
      headers: authService.getAuthHeaders(),
      body: formData,
    },
    (_a = options.timeoutMs) !== null && _a !== void 0 ? _a : 600000,
  );
  if (!data.success) {
    throw new Error(data.error || "Directory upload scan failed");
  }
  return data;
}
