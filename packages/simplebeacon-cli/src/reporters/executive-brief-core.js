/**
 * Executive brief projection — single normalization boundary for CLI + dashboard.
 * Derives presentation from existing signal fields (lane, fileClass, decision, …).
 * Does not invent a parallel `classification` taxonomy.
 */

const QUALITY_FILE_CLASSES = new Set([
  "test",
  "docs",
  "vendor",
  "generated",
  "sample",
]);

function normalizePosixPath(value) {
  return String(value || "").replace(/\\/g, "/");
}

function issueText(issue) {
  return [
    issue && issue.message,
    issue && issue.description,
    issue && issue.reason,
    issue && issue.type,
    issue && issue.pattern,
  ]
    .filter(Boolean)
    .join(" ");
}

function severityRank(issue) {
  const sev = String(
    (issue && (issue.severity || issue.scannerSeverity || issue.severityBand)) ||
      "low",
  ).toLowerCase();
  if (sev === "critical") return 0;
  if (sev === "high") return 1;
  if (sev === "medium") return 2;
  if (sev === "low") return 3;
  return 4;
}

function isProductionPreferred(issue) {
  if (!issue || typeof issue !== "object") return false;
  if (issue.lane === "quality") return false;
  if (QUALITY_FILE_CLASSES.has(String(issue.fileClass || "").toLowerCase())) {
    return false;
  }
  return true;
}

/**
 * Shallow projection for executive export. Never mutates `source`.
 * Never copies file contents / secret values — path + metadata only.
 */
function projectExecutiveFinding(source) {
  const src = source && typeof source === "object" ? source : {};
  const filePath = normalizePosixPath(
    src.filePath || src.file || src.path || "",
  );
  return {
    filePath,
    line: src.line ?? src.lineNumber ?? null,
    type: src.type || src.rule || src.category || "finding",
    severity: String(
      src.scannerSeverity || src.severity || src.severityBand || "medium",
    ).toLowerCase(),
    description: String(
      src.description || src.message || src.impact || src.reason || "",
    ),
    lane: src.lane != null ? src.lane : null,
    fileClass: src.fileClass != null ? src.fileClass : null,
    decision: src.decision != null ? src.decision : null,
    score:
      src.score != null && Number.isFinite(Number(src.score))
        ? Number(src.score)
        : null,
    category: src.category != null ? src.category : null,
    pathReason: src.pathReason != null ? src.pathReason : null,
    nextAction: src.nextAction != null ? src.nextAction : null,
    verification:
      src.verification != null
        ? src.verification
        : src.verificationStatus != null
          ? src.verificationStatus
          : null,
  };
}

function findingSortKey(a, b) {
  const sev = severityRank(a) - severityRank(b);
  if (sev !== 0) return sev;
  const scoreA = a.score == null ? -1 : Number(a.score);
  const scoreB = b.score == null ? -1 : Number(b.score);
  if (scoreB !== scoreA) return scoreB - scoreA;
  const pathCmp = String(a.filePath).localeCompare(String(b.filePath));
  if (pathCmp !== 0) return pathCmp;
  const lineA = a.line == null ? 0 : Number(a.line) || 0;
  const lineB = b.line == null ? 0 : Number(b.line) || 0;
  if (lineA !== lineB) return lineA - lineB;
  return String(a.type).localeCompare(String(b.type));
}

function collectRawIssues(report) {
  const out = [];
  const seen = new Set();
  const visit = (node, depth) => {
    if (!node || typeof node !== "object" || depth > 5) return;
    const lists = [node.rawIssues, node.detectedIssues, node.findings];
    for (const list of lists) {
      if (!Array.isArray(list) || !list.length) continue;
      if (typeof list[0] !== "object") continue;
      for (const item of list) {
        const key = [
          item.filePath || item.file,
          item.line,
          item.description || item.message,
          item.type || item.pattern,
        ].join("|");
        if (seen.has(key)) continue;
        seen.add(key);
        out.push(item);
      }
    }
    visit(node.simplebeacon, depth + 1);
    visit(node.results && node.results.simplebeacon, depth + 1);
    visit(node.completeScan, depth + 1);
    visit(node.report, depth + 1);
    visit(node.results && node.results.codebase, depth + 1);
  };
  visit(report, 0);
  return out;
}

/**
 * Prefer report.signal (investigate + review). Exclude dismiss.
 * Prefer production lane / non-quality fileClass when any remain.
 *
 * When `report.signal` is absent (legacy JSON), enrich via classifyFinding when
 * provided, but keep production-path critical/high/medium rows — full dismiss
 * filtering applies only to signal-attached reports.
 *
 * @param {object} report
 * @param {{ classifyFinding?: (f: object) => object }} [hooks]
 */
function selectExecutiveSourceFindings(report, hooks = {}) {
  const signal = report && report.signal;
  let rows = [];
  if (
    signal &&
    (Array.isArray(signal.investigate) || Array.isArray(signal.review))
  ) {
    rows = [
      ...(Array.isArray(signal.investigate) ? signal.investigate : []),
      ...(Array.isArray(signal.review) ? signal.review : []),
    ].filter((row) => row && String(row.decision || "") !== "dismiss");
  } else {
    const raw = collectRawIssues(report || {});
    const classify =
      typeof hooks.classifyFinding === "function"
        ? hooks.classifyFinding
        : null;
    const testPath =
      /(?:^|\/)(?:__tests__|tests?|spec|fixtures?|mocks?)(?:\/|$)/i;
    const testFile = /\.(?:spec|test)\.[a-z0-9]+$/i;
    rows = raw
      .map((f) => {
        if (!classify) return f;
        const c = classify(f);
        return {
          ...f,
          lane: c.lane,
          fileClass: c.fileClass,
          decision: c.decision,
          score: c.score,
          category: c.category,
          pathReason: c.pathReason || c.reason,
          nextAction: c.nextAction,
          scannerSeverity: c.scannerSeverity || f.severity,
          description:
            c.description || f.description || f.message || f.impact || "",
        };
      })
      .filter((row) => {
        if (!row) return false;
        if (row.lane === "quality") return false;
        const fc = String(row.fileClass || "").toLowerCase();
        if (fc === "test" || fc === "docs") return false;
        const file = normalizePosixPath(
          row.filePath || row.file || row.path || "",
        );
        if (testPath.test(file) || testFile.test(file)) return false;
        const sev = String(
          row.scannerSeverity || row.severity || row.severityBand || "low",
        ).toLowerCase();
        return (
          row.blocking === true ||
          sev === "critical" ||
          sev === "high" ||
          sev === "medium"
        );
      });
  }

  const production = rows.filter(isProductionPreferred);
  return production.length ? production : rows;
}

/**
 * @param {object} report
 * @param {object} [options]
 * @param {{ classifyFinding?: Function }} [hooks]
 */
function buildExecutiveBriefModel(report, options = {}, hooks = {}) {
  if (!report || typeof report !== "object") {
    throw new Error("report object is required");
  }

  const projectPath =
    report.projectPath != null
      ? report.projectPath
      : report.projectRoot != null
        ? report.projectRoot
        : "";

  const sources = selectExecutiveSourceFindings(report, hooks);
  const findings = sources.map(projectExecutiveFinding).sort(findingSortKey);

  const gate =
    report.gate && typeof report.gate.pass === "boolean" ? report.gate : null;
  const signal =
    report.signal && typeof report.signal === "object"
      ? {
          pipeline: report.signal.pipeline || null,
          scannedCount: report.signal.scannedCount ?? null,
          dismissedCount: report.signal.dismissedCount ?? null,
          reviewCount: report.signal.reviewCount ?? null,
          investigateCount: report.signal.investigateCount ?? null,
          note: report.signal.note || null,
        }
      : null;

  const byDecision = {};
  const byLane = {};
  for (const f of findings) {
    const d = f.decision || "unset";
    const l = f.lane || "unset";
    byDecision[d] = (byDecision[d] || 0) + 1;
    byLane[l] = (byLane[l] || 0) + 1;
  }

  const projectLabel =
    options.client ||
    (typeof projectPath === "string" && projectPath
      ? String(projectPath).split(/[\\/]/).filter(Boolean).pop()
      : null) ||
    "project";

  return {
    reportSchemaVersion: "1.0",
    projectPath,
    projectLabel,
    qualityScore:
      report.qualityScore != null
        ? report.qualityScore
        : report.summary && report.summary.healthScore != null
          ? report.summary.healthScore
          : null,
    repositoryFilesTotal:
      report.repositoryFilesTotal ||
      report.totalFiles ||
      (report.summary && report.summary.repositoryFilesTotal) ||
      (report.summary && report.summary.totalFiles) ||
      null,
    gate: gate
      ? {
          pass: gate.pass,
          blockingCount: gate.blockingCount ?? null,
          warningCount: gate.warningCount ?? null,
        }
      : null,
    signal,
    summary: {
      totalFindings: findings.length,
      byDecision,
      byLane,
    },
    findings,
  };
}

module.exports = {
  QUALITY_FILE_CLASSES,
  normalizePosixPath,
  issueText,
  severityRank,
  isProductionPreferred,
  projectExecutiveFinding,
  collectRawIssues,
  selectExecutiveSourceFindings,
  buildExecutiveBriefModel,
};
