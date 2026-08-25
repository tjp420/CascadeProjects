// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * Complete-scan executive audit report — thin facade.
 *
 * Imports focused sub-modules from `audit-report/` and re-exports
 * the full public API for backward compatibility.
 */

const logger = require("../../src/lib/app-logger.cjs");
const {
  assessAuditExportTier,
  resolveAuditClientName,
} = require("./audit-export-tier.cjs");
const {
  formatReportTimestamp,
  formatScanDuration,
  buildReportId,
} = require("./audit-report-utils.cjs");
const {
  buildComplianceTable,
  buildDetailedFindings,
  buildHowToFixSection,
  buildPersonalizedActionPlan,
} = require("./simplebeacon-proxy.cjs");

const {
  collectIssues,
  enrichFindings,
  resolveTierCounts,
  countBySeverity,
  countProductionSeverity,
  buildCategoryRollupFromScan,
  normalizeSimplebeaconForCompliance,
  buildDeveloperRemediationRows,
  dedupeFindings,
  sortBySeverity,
  redactPathForDisplay,
  isProductionCodePath,
  isAuditProductionRuntimePath,
  isPlaceholderExecutiveText,
  buildBusinessRiskCounts,
} = require("./audit-report/finding-utils.cjs");

const {
  buildDeterministicExecutive,
  buildLaunchReadiness,
  calculateAuditConfidence,
  buildExecutivePriorities,
  buildCodebaseActionPlan,
  buildCompleteAuditPrompt,
  parseAiExecutive,
  mergeExecutiveSummary,
} = require("./audit-report/executive.cjs");

const { renderCompleteAuditHtml } = require("./audit-report/html-renderer.cjs");
const {
  buildSampleAuditReportModel,
  buildSampleAuditReportHtml,
  wrapSampleReportForWebsite,
} = require("./audit-report/sample-report.cjs");

const { getAuditReportStyles } = require("./audit-report-styles.cjs");
const { markdownToHtml } = require("./audit-report-markdown.cjs");
const {
  buildCleanScanRemediationMessage,
} = require("./audit-report-html-rows.cjs");

const ENGINE_VERSION = "1.1.0";

/**
 * Normalize complete scan input.
 * @param {any} completeScan
 * @returns {any}
 */
function normalizeCompleteScanInput(completeScan) {
  if (!completeScan || typeof completeScan !== "object") return null;
  if (
    completeScan.results &&
    Object.values(completeScan.results).some(Boolean)
  ) {
    return completeScan;
  }
  if (completeScan.type === "data-cleanup-report") {
    const profile = completeScan.scanProfile || "data-quality";
    const resultKey =
      profile === "file-reduction" ? "fileReduction" : "dataQuality";
    return {
      type: "simplebeacon-complete-scan",
      version: completeScan.version || "1.3.0",
      generatedAt: completeScan.generatedAt || new Date().toISOString(),
      projectPath: completeScan.projectRoot || completeScan.projectPath || "",
      scanDurationMs: completeScan.durationMs ?? null,
      summary: {
        scanKind: profile,
        dataQualityFindings: completeScan.summary?.totalFindings ?? null,
        fileReductionFindings: completeScan.summary?.totalFindings ?? null,
      },
      results: {
        [resultKey]: completeScan,
      },
    };
  }
  return hydrateCompleteScanFromSteps(completeScan);
}

/**
 * Hydrate complete scan from steps.
 * @param {any} completeScan
 * @returns {any}
 */
function hydrateCompleteScanFromSteps(completeScan) {
  if (!completeScan || typeof completeScan !== "object") return null;
  const steps = Array.isArray(completeScan.steps) ? completeScan.steps : [];
  if (!steps.length) return completeScan;

  const byId = new Map(steps.filter(Boolean).map((step) => [step.id, step]));
  const results = { ...(completeScan.results || {}) };
  const assign = (engineId, resultKey, ...fields) => {
    if (results[resultKey]) return;
    const step = byId.get(engineId);
    if (!step) return;
    for (const field of fields) {
      if (step[field]) {
        results[resultKey] = step[field];
        return;
      }
    }
  };

  assign("simplebeacon", "simplebeacon", "report");
  assign("consolidation", "consolidation", "scan");
  assign("mock-scan", "mockScan", "report");
  assign("roadmap", "roadmap", "roadmap", "data");
  assign("codebase", "codebase", "scan");
  assign("file-reduction", "fileReduction", "scan");
  assign("data-quality", "dataQuality", "scan");
  assign("cleanup-assistant", "cleanupAssistant", "brief");
  assign("compliance", "compliance", "checklist");
  assign("npm-audit", "npmAudit", "npmAudit");
  assign("eu-ai-act", "sprint", "sprint");

  if (results.roadmap?.roadmap && !results.roadmap.codeAnalysis) {
    results.roadmap = results.roadmap.roadmap;
  }

  return {
    ...completeScan,
    type: completeScan.type || "simplebeacon-complete-scan",
    results,
  };
}

/**
 * Complete scan has exportable results.
 * @param {any} completeScan
 * @returns {any}
 */
function completeScanHasExportableResults(completeScan) {
  const normalized = normalizeCompleteScanInput(completeScan);
  if (!normalized) return false;
  if (normalized.results && Object.values(normalized.results).some(Boolean))
    return true;
  return (
    Array.isArray(normalized.steps) &&
    normalized.steps.some(
      (step) =>
        step &&
        (step.report ||
          step.scan ||
          step.checklist ||
          step.npmAudit ||
          step.sprint ||
          step.brief ||
          step.roadmap ||
          step.data?.roadmap),
    )
  );
}

/**
 * Build complete audit model.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
async function buildCompleteAuditModel(completeScan, options = {}) {
  const normalizedScan =
    normalizeCompleteScanInput(completeScan) || completeScan;
  const results = normalizedScan?.results || {};
  const dataQuality = results.dataQuality || null;
  const fileReduction = results.fileReduction || null;
  const simplebeacon = results.simplebeacon || null;
  const codebase = results.codebase || null;
  const consolidation = results.consolidation || null;
  const mockScan = results.mockScan || null;
  const issues = collectIssues(simplebeacon || { rawIssues: [] });
  const severityCounts = { critical: 0, high: 0, medium: 0, low: 0 };
  for (const issue of issues) {
    const band = String(
      issue.severity || issue.severityBand || "low",
    ).toLowerCase();
    if (severityCounts[band] !== undefined)
      severityCounts[band] += issue.count || 1;
  }
  await new Promise((resolve) => setImmediate(resolve));
  const allCodeFindings = enrichFindings(codebase?.findings || []);
  const tierCounts = resolveTierCounts(codebase?.summary, allCodeFindings);
  const priorityFindings = sortBySeverity(
    allCodeFindings.filter((f) => f.tier === "production"),
  ).slice(0, 15);
  const appendixFindings = sortBySeverity(
    allCodeFindings.filter((f) => f.tier !== "production"),
  ).slice(0, 8);
  const dedupedSeverity = countBySeverity(allCodeFindings);
  const productionSeverity = countProductionSeverity(allCodeFindings);
  const rawTotal = codebase?.summary?.findingsTotal ?? allCodeFindings.length;
  const dedupedTotal = codebase?.summary?.tierCounts
    ? tierCounts.production + tierCounts.documentation + tierCounts.general
    : allCodeFindings.length;
  const truncated = Boolean(codebase?.summary?.findingsTruncated);

  const scopeLines = [
    ...(simplebeacon?.scanScope?.limitations || []),
    ...(codebase?.scanScope?.limitations || []),
    ...(consolidation?.scanScope?.limitations || []),
  ].filter(Boolean);

  const normalizedSimplebeacon =
    normalizeSimplebeaconForCompliance(simplebeacon);
  const projectPath =
    normalizedScan?.projectPath ||
    simplebeacon?.projectRoot ||
    dataQuality?.projectRoot ||
    "";
  const creds = options.credentials || {};
  const resolvedClient =
    creds.projectName ||
    resolveAuditClientName(
      { ...options, projectName: options.projectName },
      projectPath || redactPathForDisplay(projectPath),
    );

  const model = {
    reportId: buildReportId(normalizedScan?.generatedAt),
    projectPath,
    platformRoot: simplebeacon?.platformRoot || codebase?.platformRoot || null,
    generatedAt: normalizedScan?.generatedAt || new Date().toISOString(),
    client: resolvedClient,
    company: creds.projectName || resolvedClient,
    assessor:
      creds.signatoryName ||
      options.assessor ||
      "Simplebeacon Security Audit Service",
    branch: options.branch || normalizedScan?.branch || "main",
    engineLabel: `Simplebeacon Engine v${normalizedScan?.version || ENGINE_VERSION} (Zero-Dependency)`,
    scanDurationMs:
      normalizedScan?.scanDurationMs ??
      normalizedScan?.summary?.scanDurationMs ??
      dataQuality?.durationMs ??
      fileReduction?.durationMs ??
      null,
    repositoryLabel: redactPathForDisplay(
      normalizedScan?.projectPath || simplebeacon?.projectRoot || "",
    ),
    summary: {
      gatePass:
        simplebeacon?.gate?.pass ??
        normalizedScan?.summary?.simplebeaconGatePass ??
        null,
      simplebeaconIssues: simplebeacon?.issueCount ?? issues.length,
      qualityScore: simplebeacon?.qualityScore ?? null,
      repositoryFiles:
        simplebeacon?.repositoryFilesTotal ??
        dataQuality?.inventory?.totalFiles ??
        fileReduction?.inventory?.totalFiles ??
        codebase?.summary?.repositoryFilesTotal ??
        consolidation?.summary?.repositoryFilesTotal ??
        null,
      ruleScopedFiles:
        simplebeacon?.ruleScopedFilesAnalyzed ??
        simplebeacon?.scanScope?.ruleScopedFilesAnalyzed ??
        null,
      codebaseHealth:
        codebase?.summary?.healthScore ??
        normalizedScan?.summary?.codebaseHealthScore ??
        null,
      codebaseFindingsRaw: rawTotal,
      codebaseFindingsDeduped: dedupedTotal,
      findingsTruncated: truncated,
      productionFindings: tierCounts.production,
      documentationFindings: tierCounts.documentation,
      generalFindings: tierCounts.general,
      codeFilesAnalyzed: codebase?.summary?.codeFilesAnalyzed ?? null,
      codeFilesDiscovered: codebase?.summary?.codeFilesDiscovered ?? null,
      duplicateGroups: consolidation?.summary?.exactDuplicateGroups ?? null,
      fictionKpiHits:
        mockScan?.fictionIssues?.reduce((sum, i) => sum + (i.count || 1), 0) ??
        null,
      dataQualityFindings:
        dataQuality?.summary?.totalFindings ??
        normalizedScan?.summary?.dataQualityFindings ??
        null,
      fileReductionFindings:
        fileReduction?.summary?.totalFindings ??
        normalizedScan?.summary?.fileReductionFindings ??
        null,
      orphanedDataFiles:
        dataQuality?.executiveSummary?.data?.orphanedDataFiles ?? null,
      fileReductionReclaimableBytes:
        fileReduction?.summary?.reclaimableBytes ??
        normalizedScan?.summary?.fileReductionReclaimableBytes ??
        null,
      roadmapCompletion:
        results.roadmap?.executiveSummary?.completionRate ??
        normalizedScan?.summary?.roadmapCompletion ??
        null,
      roadmapSprints:
        results.roadmap?.executiveSummary?.totalFeatures ??
        normalizedScan?.summary?.roadmapSprints ??
        null,
      roadmapFiles:
        results.roadmap?.codeAnalysis?.structure?.totalFiles ??
        normalizedScan?.summary?.roadmapFiles ??
        null,
      cleanupSafeFiles:
        results.cleanupAssistant?.estimatedReduction?.files ??
        normalizedScan?.summary?.cleanupSafeFiles ??
        null,
      scanKind: normalizedScan?.summary?.scanKind ?? null,
      severityCounts,
      codeSeverity: dedupedSeverity,
      productionSeverity,
    },
    simplebeacon: normalizedSimplebeacon,
    dataQualitySummary: dataQuality?.executiveSummary || null,
    fileReductionSummary: fileReduction?.executiveSummary || null,
    issues,
    allCodeFindings,
    priorityFindings,
    appendixFindings,
    categoryRollup: buildCategoryRollupFromScan(codebase, allCodeFindings),
    consolidationSummary: consolidation?.summary || null,
    scopeLines: [...new Set(scopeLines)].slice(0, 10),
    markdown: {
      detailedFindings: buildDetailedFindings(issues),
      howToFix: buildHowToFixSection(issues, options.assessment),
      gateActionPlan: buildPersonalizedActionPlan(issues, options.assessment),
      compliance: normalizedSimplebeacon
        ? buildComplianceTable(
            normalizedSimplebeacon,
            options.assessment,
            completeScan?.projectPath ||
              normalizedSimplebeacon.projectRoot ||
              "",
          )
        : "| Checklist item | Status | Notes |\n|----------------|--------|-------|\n| Simplebeacon gate | N/A | Gate scan not included |",
    },
  };
  model.readiness = buildLaunchReadiness(model);
  model.summary.confidenceScore = calculateAuditConfidence(
    model.summary,
    normalizedSimplebeacon,
  );
  model.codebaseActionPlan = buildCodebaseActionPlan(model);
  model.businessRiskCounts = buildBusinessRiskCounts(model);
  model.remediationRows = buildDeveloperRemediationRows(model);
  model.exportTier = assessAuditExportTier(normalizedScan);
  return model;
}

/**
 * Build complete audit report.
 * @param {any} completeScan
 * @param {Object} options
 * @returns {any}
 */
async function buildCompleteAuditReport(completeScan, options = {}) {
  const normalizedScan =
    normalizeCompleteScanInput(completeScan) || completeScan;
  const model = await buildCompleteAuditModel(normalizedScan, options);
  await new Promise((resolve) => setImmediate(resolve));
  const deterministic = buildDeterministicExecutive(model);
  let executive = deterministic;
  let aiEnhanced = false;
  const aiProvider = options.aiProvider || "demo";
  const allowAiExecutive =
    options.enhanceExecutive === true &&
    aiProvider &&
    aiProvider !== "demo" &&
    options.summarizeFn;

  if (allowAiExecutive) {
    try {
      const prompt = buildCompleteAuditPrompt(model);
      const result = await options.summarizeFn(
        aiProvider,
        { prompt, projectPath: model.projectPath },
        options,
      );
      const parsed = parseAiExecutive(result?.summary);
      if (parsed) {
        executive = mergeExecutiveSummary(deterministic, parsed);
        aiEnhanced = true;
      }
    } catch (aiErr) {
      if (typeof logger !== "undefined" && logger?.warn) {
        logger.warn(
          "[AuditReport] AI executive enhancement failed:",
          aiErr?.message || String(aiErr),
        );
      }
      executive = deterministic;
    }
  }

  await new Promise((resolve) => setImmediate(resolve));
  const html = renderCompleteAuditHtml(model, {
    executive,
    aiEnhanced,
    aiProvider: aiEnhanced ? aiProvider : "deterministic",
  });

  const slug = redactPathForDisplay(model.projectPath)
    .replace(/[^\w.-]+/g, "-")
    .slice(0, 40);
  const _date = new Date(model.generatedAt).toISOString().slice(0, 10);

  return {
    html,
    filename: `${model.reportId}-${slug}.html`,
    model,
    aiEnhanced,
    aiProvider: aiEnhanced ? aiProvider : "deterministic",
    tier: model.exportTier?.tier || "handoff",
    exportTierLabel: model.exportTier?.label || "Pre-launch security audit",
    missingForHandoff: model.exportTier?.missingForHandoff || [],
  };
}

module.exports = {
  buildCompleteAuditModel,
  buildCompleteAuditPrompt,
  buildDeterministicExecutive,
  renderCompleteAuditHtml,
  buildCompleteAuditReport,
  buildSampleAuditReportModel,
  buildSampleAuditReportHtml,
  wrapSampleReportForWebsite,
  getAuditReportStyles,
  markdownToHtml,
  dedupeFindings,
  enrichFindings,
  isProductionCodePath,
  isAuditProductionRuntimePath,
  mergeExecutiveSummary,
  normalizeSimplebeaconForCompliance,
  isPlaceholderExecutiveText,
  normalizeCompleteScanInput,
  hydrateCompleteScanFromSteps,
  completeScanHasExportableResults,
  buildLaunchReadiness,
  calculateAuditConfidence,
  buildExecutivePriorities,
  buildCleanScanRemediationMessage,
};
