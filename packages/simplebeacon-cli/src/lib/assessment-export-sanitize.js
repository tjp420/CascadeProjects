// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
/**
 * Sanitize simplebeacon-assessment-report JSON exports — branding, paths, export metadata.
 */

const path = require("path");
const { isExternalBenchmarkCachePath } = require("./benchmark-cache-paths");

function redactProjectPathForExport(value, projectLabel = "ai-platform") {
  if (value == null || value === "") return value;
  const normalized = String(value).replace(/\\/g, "/");
  if (
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith("/Users/") ||
    normalized.startsWith("/home/") ||
    normalized.includes("CascadeProjects")
  ) {
    return projectLabel;
  }
  return normalized;
}

function projectLabelFromPath(projectPath) {
  const normalized = String(projectPath || "ai-platform").replace(/\\/g, "/");
  return path.basename(normalized) || "ai-platform";
}

function normalizeSimpleBeaconBranding(value) {
  return String(value ?? "").replace(/\bSimplebeacon\b/g, "SimpleBeacon");
}

function normalizeAssessmentTitle(assessment, projectLabel) {
  const raw = String(assessment?.title || "");
  if (/Free Assessment/i.test(raw)) {
    return `SimpleBeacon Free Assessment — ${projectLabel}`;
  }
  if (/EU AI Act Readiness/i.test(raw)) {
    return `SimpleBeacon EU AI Act Readiness — ${projectLabel}`;
  }
  return (
    normalizeSimpleBeaconBranding(raw) ||
    `SimpleBeacon Assessment — ${projectLabel}`
  );
}

function buildFilesScannedNote(executiveSummary = {}) {
  const scoped = executiveSummary.ruleScopedFilesAnalyzed;
  const mock = executiveSummary.mockSampleFiles;
  if (scoped == null || mock == null || mock === 0) return null;
  if (scoped > mock * 10) {
    return "filesScanned reflects gate rule scope — mock-path sample count is mockSampleFiles.";
  }
  return null;
}

function buildAssessmentExportNotes(assessment, projectLabel) {
  const notes = [];
  const exec = assessment.executiveSummary || {};
  const checklist = assessment.complianceChecklist?.summary || {};
  const filesNote = buildFilesScannedNote(exec);
  if (filesNote) notes.push(filesNote);
  if (checklist.supplyChainSkipped && exec.gateResult === "PASS") {
    notes.push(
      "Supply-chain checklist rows skipped — run npm audit on Compliance Audit page for SUPPLY-001/002 evidence.",
    );
  }
  if (exec.gateResult === "PASS" && checklist.readyForAutomation) {
    notes.push(
      "Gate hygiene and applicable checklist rules pass — not vendor handoff or Complete scan clearance.",
    );
  } else if (exec.gateResult === "FAIL") {
    notes.push(
      `Gate FAIL — ${exec.blockingCount ?? 0} blocking finding(s). Review gate report detectedIssues before merge.`,
    );
  }
  if (projectLabel && projectLabel !== "ai-platform") {
    notes.push(`Assessment scoped to ${projectLabel}.`);
  }
  return [...new Set(notes)].slice(0, 6);
}

function reconcileComplianceReady(executiveSummary, checklist, sourceReport) {
  const summary = checklist?.summary || {};
  let ready =
    summary.readyForAutomation ?? executiveSummary.complianceReady ?? false;
  if (!sourceReport) return ready;

  const ruleScoped =
    sourceReport.ruleScopedFilesAnalyzed ??
    sourceReport.scanScope?.ruleScopedFilesAnalyzed ??
    0;
  const coreSecuritySkipped = (checklist?.rules || []).some(
    (r) =>
      ["GATE-001", "CRED-001", "LEAK-001"].includes(r.id) &&
      r.status === "skip",
  );
  const gatePass = Boolean(
    sourceReport.gate?.pass ?? executiveSummary.gateResult === "PASS",
  );

  if (
    gatePass &&
    ruleScoped > 0 &&
    (summary.failed ?? 0) === 0 &&
    (summary.passed ?? 0) > 0 &&
    !coreSecuritySkipped
  ) {
    return true;
  }
  return ready;
}

function reconcileExecutiveSummary(assessment, sourceReport) {
  const exec = { ...(assessment.executiveSummary || {}) };
  const checklist = assessment.complianceChecklist || {};
  exec.complianceReady = reconcileComplianceReady(
    exec,
    checklist,
    sourceReport,
  );
  exec.complianceScore =
    checklist.summary?.score ?? exec.complianceScore ?? null;
  if (exec.filesScannedNote == null) {
    const note = buildFilesScannedNote(exec);
    if (note) exec.filesScannedNote = note;
  }
  return exec;
}

function reconcileChecklistExport(checklist, projectLabel, sourceReport) {
  if (!checklist) return checklist;
  const summary = checklist.summary
    ? {
        ...checklist.summary,
        readyForAutomation: reconcileComplianceReady(
          {},
          checklist,
          sourceReport,
        ),
        headline: normalizeSimpleBeaconBranding(checklist.summary.headline),
      }
    : checklist.summary;
  return {
    ...checklist,
    title: normalizeSimpleBeaconBranding(
      checklist.title || "SimpleBeacon Corporate Safety Checklist",
    ),
    projectRoot: redactProjectPathForExport(
      checklist.projectRoot,
      projectLabel,
    ),
    summary,
  };
}

/**
 * @param {object} assessment
 * @param {object} [options]
 * @param {object} [options.sourceReport] gate report used to build assessment
 * @returns {object}
 */
function sanitizeAssessmentExport(assessment, options = {}) {
  if (!assessment || assessment.type !== "simplebeacon-assessment-report")
    return assessment;

  const sourceReport = options.sourceReport || null;
  const projectLabel = projectLabelFromPath(
    options.projectPath || assessment.projectRoot || sourceReport?.projectRoot,
  );
  const benchmarkScan = Boolean(
    options.benchmarkScan ||
    assessment.benchmarkScan ||
    sourceReport?.benchmarkScan ||
    isExternalBenchmarkCachePath(
      String(assessment.projectRoot || "").replace(/\\/g, "/"),
    ),
  );

  let executiveSummary = reconcileExecutiveSummary(assessment, sourceReport);
  if (sourceReport) {
    const ruleScoped =
      sourceReport.ruleScopedFilesAnalyzed ??
      sourceReport.scanScope?.ruleScopedFilesAnalyzed ??
      null;
    const mockSampleFiles =
      sourceReport.mockSampleFiles ?? sourceReport.totalFiles ?? null;
    executiveSummary = {
      ...executiveSummary,
      filesScanned:
        ruleScoped ??
        sourceReport.filesAnalyzed ??
        sourceReport.repositoryFilesTotal ??
        executiveSummary.filesScanned,
      mockSampleFiles,
      ruleScopedFilesAnalyzed: ruleScoped,
      repositoryFilesTotal:
        sourceReport.repositoryFilesTotal ??
        sourceReport.repositoryInventory?.totalFiles ??
        executiveSummary.repositoryFilesTotal ??
        null,
      gateResult: sourceReport.gate?.pass ? "PASS" : "FAIL",
      blockingCount:
        sourceReport.gate?.blockingCount ?? executiveSummary.blockingCount ?? 0,
      warningCount:
        sourceReport.gate?.warningCount ?? executiveSummary.warningCount ?? 0,
      qualityScore:
        sourceReport.qualityScore ?? executiveSummary.qualityScore ?? null,
    };
    const note = buildFilesScannedNote(executiveSummary);
    if (note) executiveSummary.filesScannedNote = note;
  }

  const exportNotes = buildAssessmentExportNotes(
    { ...assessment, executiveSummary },
    projectLabel,
  );

  const { sourceReport: embeddedSource, ...rest } = assessment;
  const sanitizedSource = embeddedSource
    ? {
        generatedAt: embeddedSource.generatedAt ?? null,
        scanPaths: embeddedSource.scanPaths ?? null,
        duplicateGroups: embeddedSource.duplicateGroups ?? null,
      }
    : undefined;

  return {
    ...rest,
    title: normalizeAssessmentTitle(assessment, projectLabel),
    generatedBy: normalizeSimpleBeaconBranding(
      assessment.generatedBy || "SimpleBeacon",
    ),
    projectRoot: redactProjectPathForExport(
      assessment.projectRoot,
      projectLabel,
    ),
    executiveSummary: {
      ...executiveSummary,
      headline: normalizeSimpleBeaconBranding(executiveSummary.headline),
    },
    complianceChecklist: reconcileChecklistExport(
      assessment.complianceChecklist,
      projectLabel,
      sourceReport,
    ),
    ...(sanitizedSource ? { sourceReport: sanitizedSource } : {}),
    exportVersion: "1.1.0",
    exportSanitized: true,
    exportNormalized: true,
    benchmarkScan,
    scanTargetProfile: benchmarkScan ? "benchmark-cache" : "product",
    handoffEligible: false,
    hygieneSummary: {
      gateResult: executiveSummary.gateResult ?? null,
      complianceScore: executiveSummary.complianceScore ?? null,
      complianceReady: executiveSummary.complianceReady ?? false,
      filesScanned: executiveSummary.filesScanned ?? null,
      mockSampleFiles: executiveSummary.mockSampleFiles ?? null,
      benchmarkScan,
      attestationNote: benchmarkScan
        ? "Benchmark clone assessment — not SimpleBeacon product handoff clearance."
        : "Assessment export — gate hygiene and checklist attestation only, not vendor handoff clearance.",
    },
    exportNotes,
    disclaimers: [
      ...(benchmarkScan
        ? [
            "Benchmark clone assessment — not SimpleBeacon ai-platform product handoff.",
          ]
        : []),
      "Assessment export maps scan signals to deploy-readiness checklist rows — not legal conformity certification.",
      "Findings items may be truncated in exports; use gate report detectedIssues for remediation detail.",
      "Absolute host paths are redacted to project label in exports.",
      "handoffEligible remains false — Complete scan clearance requires operator sign-off.",
    ],
    sanitized: true,
    sanitizedAt: new Date().toISOString(),
  };
}

function assessmentExportFilename(date = new Date()) {
  return `simplebeacon-assessment-${date.toISOString().slice(0, 10)}.json`;
}

module.exports = {
  sanitizeAssessmentExport,
  assessmentExportFilename,
  normalizeSimpleBeaconBranding,
  normalizeAssessmentTitle,
  redactProjectPathForExport,
  projectLabelFromPath,
};
