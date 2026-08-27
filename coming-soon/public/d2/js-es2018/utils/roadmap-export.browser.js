// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Browser mirror of roadmap export sanitization (keep in sync with roadmap-export-sanitize.js).
 */
import { redactProjectPathForExport } from "./quality-export.browser.js?v=20260716cachefix1";
/**
 * Project label from path.
 * @param {string} projectPath
 * @returns {any}
 */
function projectLabelFromPath(projectPath) {
  const normalized = String(projectPath || "ai-platform").replace(/\\/g, "/");
  const parts = normalized.split("/").filter(Boolean);
  return parts[parts.length - 1] || "ai-platform";
}
const SIMPLEBEACON_ROADMAP_MARKERS = [
  /docker-compose\.phase2\.yml/i,
  /1000\/1000/i,
  /v1-internal/i,
  /simplebeacon:deploy/i,
  /verify:v1-internal-profile/i,
  /verify:production-deploy/i,
  /LLAMA_CPP_BIN/i,
  /simplebeacon\.ai/i,
  /npm run test:coverage/i,
  /PAGE_SAMPLE_SPECS/i,
  /dashboard-stub-api/i,
  /REQUIRE_AUTH production profile/i,
  /Istanbul coverage in CI/i,
];
const BENCHMARK_TEMPLATE_PHRASES = [
  /Complete remaining sprint deliverables/i,
  /Define enterprise scope only after v1/i,
  /Improve documentation coverage/i,
  /Expand Jest\/Istanbul/i,
  /enterprise diligence thresholds/i,
  /critical server paths/i,
  /Sprint \d+:\s/i,
  /Stub APIs & Tests/i,
  /Honest Dashboard Data/i,
  /Production Profile/i,
  /phase2-smoke/i,
  /0\/50 page samples/i,
];
const INTENTIONAL_MIRROR_PAIRS = [
  [
    "complete-scan-artifact-profile.js",
    "complete-scan-artifact-profile.browser.js",
  ],
];
/**
 * Matches roadmap template.
 * @param {string} text
 * @returns {any}
 */
function matchesRoadmapTemplate(text) {
  const value = String(text || "");
  return (
    SIMPLEBEACON_ROADMAP_MARKERS.some((re) => re.test(value)) ||
    BENCHMARK_TEMPLATE_PHRASES.some((re) => re.test(value))
  );
}
/**
 * Is benchmark product narrative.
 * @param {string} text
 * @returns {any}
 */
function isBenchmarkProductNarrative(text) {
  const value = String(text || "");
  return (
    matchesRoadmapTemplate(value) ||
    /simplebeacon-platform/i.test(value) ||
    /SOC 2/i.test(value) ||
    /\btest coverage \([0-9.]+%\)/i.test(value) ||
    (/\b\d{2,3}\.[0-9]+%\b/.test(value) && /coverage|compliance/i.test(value))
  );
}
/**
 * Infer scan target root from hints.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
function inferScanTargetRootFromHints(roadmap, options = {}) {
  const filename = String(
    options.exportFilename || options.filename || "",
  ).toLowerCase();
  if (!filename.includes("github-cache")) return "";
  const slugMatch = filename.match(
    /github-cache[-_]([a-z0-9._-]+?)(?:-\d{4}-\d{2}-\d{2}|\(\d+\)|\.json)/i,
  );
  if (!slugMatch) return "";
  const cloneName = slugMatch[1];
  const sourceRoot = normalizeExportPath(
    (roadmap === null || roadmap === void 0
      ? void 0
      : roadmap.sourceProjectPath) ||
      (roadmap === null || roadmap === void 0 ? void 0 : roadmap.projectRoot) ||
      "",
  );
  if (isBenchmarkScanTargetRoot(sourceRoot)) return "";
  const platformRoot =
    resolveProductPlatformRoot(
      `${sourceRoot.replace(/\/$/, "")}/github-cache/${cloneName}`,
    ) || sourceRoot;
  return `${platformRoot.replace(/\/$/, "")}/github-cache/${cloneName}`;
}
/**
 * Resolve benchmark project label.
 * @param {any} scanTargetRoot
 * @returns {any}
 */
function resolveBenchmarkProjectLabel(scanTargetRoot) {
  const parts = normalizeExportPath(scanTargetRoot).split("/");
  return parts[parts.length - 1] || "oss-benchmark-clone";
}
/**
 * Sanitize project identity for benchmark.
 * @param {any} next
 * @param {any} scanTargetRoot
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeProjectIdentityForBenchmark(
  next,
  scanTargetRoot,
  misscopedPlatformWalk,
) {
  const label = resolveBenchmarkProjectLabel(scanTargetRoot);
  const title = misscopedPlatformWalk
    ? `${label} (benchmark target — platform walk mis-scope)`
    : `${label} (OSS benchmark clone)`;
  next.projectTitle = title;
  next.projectName = label;
  if (next.projectOverview) {
    next.projectOverview = {
      ...next.projectOverview,
      projectName: label,
      completionRate: null,
      overallProgress: misscopedPlatformWalk
        ? "Mis-scoped platform walk"
        : "Benchmark scan",
      projectHealth: "Benchmark hygiene",
      developmentVelocity: "Filesystem scan",
      teamProductivity: "OSS clone comparison",
    };
  }
  return next;
}
/**
 * Normalize export path.
 * @param {string} projectPath
 * @returns {any}
 */
function normalizeExportPath(projectPath) {
  return String(projectPath || "").replace(/\\/g, "/");
}
/**
 * Dedupe roadmap export notes.
 * @param {Array} notes
 * @returns {any}
 */
function dedupeRoadmapExportNotes(notes = []) {
  const seen = new Set();
  const out = [];
  for (const note of notes) {
    const normalized = String(note).replace(/\s+/g, " ").trim().toLowerCase();
    const scopeKey = /mis-scoped complete-scan export/i.test(normalized)
      ? "benchmark-misscope-note"
      : /v1-internal deploy block/i.test(normalized)
        ? "benchmark-v1-note"
        : normalized;
    if (seen.has(scopeKey)) continue;
    seen.add(scopeKey);
    out.push(String(note));
  }
  return out.slice(0, 10);
}
/**
 * Is stale empty codebase metrics.
 * @param {Array} metrics
 * @returns {any}
 */
function isStaleEmptyCodebaseMetrics(metrics) {
  var _a, _b, _c, _d;
  if (!metrics || typeof metrics !== "object") return true;
  const loc =
    (_a = metrics.totalLinesOfCode) !== null && _a !== void 0 ? _a : 0;
  const cov = (_b = metrics.testCoverage) !== null && _b !== void 0 ? _b : 0;
  const docs =
    (_d =
      (_c = metrics.documentation) === null || _c === void 0
        ? void 0
        : _c.totalDocs) !== null && _d !== void 0
      ? _d
      : 0;
  return loc === 0 && cov === 0 && docs === 0;
}
/**
 * Is absolute export path.
 * @param {any} value
 * @returns {any}
 */
function isAbsoluteExportPath(value) {
  const normalized = normalizeExportPath(value);
  return (
    /^[a-zA-Z]:\//.test(normalized) ||
    normalized.startsWith("/Users/") ||
    normalized.startsWith("/home/") ||
    /CascadeProjects/i.test(normalized)
  );
}
/**
 * Redact roadmap subpath.
 * @param {any} value
 * @param {any} label
 * @returns {any}
 */
function redactRoadmapSubpath(value, label) {
  const normalized = normalizeExportPath(value);
  if (!normalized || !isAbsoluteExportPath(normalized)) return normalized;
  const parts = normalized.split("/");
  const labelIdx = parts.findIndex(
    (part) => part.toLowerCase() === String(label).toLowerCase(),
  );
  if (labelIdx >= 0) {
    return parts.slice(labelIdx).join("/");
  }
  return label;
}
/**
 * Redact product roadmap paths.
 * @param {any} roadmap
 * @param {any} label
 * @returns {any}
 */
function redactProductRoadmapPaths(roadmap, label) {
  /**
   * Redact root.
   * @param {any} value
   * @returns {any}
   */
  const redactRoot = (value) => redactProjectPathForExport(value, label);
  /**
   * Redact sub.
   * @param {any} value
   * @returns {any}
   */
  const redactSub = (value) => redactRoadmapSubpath(value, label);
  const next = { ...roadmap };
  for (const field of [
    "sourceProjectPath",
    "platformRoot",
    "scanTargetRoot",
    "requestedScanRoot",
    "projectRoot",
    "codeAnalysisRoot",
  ]) {
    if (next[field]) next[field] = redactRoot(next[field]);
  }
  if (next.projectStructure) {
    const mainCategories = next.projectStructure.mainCategories
      ? Object.fromEntries(
          Object.entries(next.projectStructure.mainCategories).map(
            ([key, category]) => [
              key,
              {
                ...category,
                path: redactSub(category.path || `${label}/${key}`),
              },
            ],
          ),
        )
      : next.projectStructure.mainCategories;
    next.projectStructure = {
      ...next.projectStructure,
      projectRoot: redactRoot(next.projectStructure.projectRoot),
      platformRoot: redactRoot(next.projectStructure.platformRoot),
      mainCategories,
    };
  }
  return next;
}
/**
 * Is stale roadmap coverage metrics.
 * @param {Array} metrics
 * @returns {any}
 */
function isStaleRoadmapCoverageMetrics(metrics = {}) {
  if (metrics.testCoverage == null && metrics.lineCoverage == null)
    return false;
  return metrics.jestTests == null && metrics.jestSuites == null;
}
/**
 * Strip fiction coverage from text.
 * @param {string} text
 * @returns {any}
 */
function stripFictionCoverageFromText(text) {
  if (typeof text !== "string" || !text) return text;
  let out = text
    .replace(
      /Test coverage at \d+(?:\.\d+)?%\s*[—–-][^.]*\.?/gi,
      "Test coverage requires live Jest/Istanbul — not inferred by roadmap LLM.",
    )
    .replace(
      /test coverage remains at \d+(?:\.\d+)?%[^.]*\.?/gi,
      "Test coverage was not measured in this scan — run npm test with Istanbul for baseline.",
    )
    .replace(
      /The current \d+(?:\.\d+)?% test coverage[^.]*\.?/gi,
      "Live test coverage was not measured in this scan — pair with gate Jest output before citing % in handoffs.",
    )
    .replace(
      /(?:Improve|improve) test coverage to at least \d+(?:\.\d+)?%[^.]*\.?/gi,
      "Improve test coverage — establish live Jest/Istanbul baseline before citing % targets.",
    )
    .replace(/Test coverage \(\d+(?:\.\d+)?%\)[^.]*\./gi, "")
    .replace(
      /high test coverage \(\d+(?:\.\d+)?%\)/gi,
      "filesystem-scan metrics (coverage not cited)",
    )
    .replace(
      /current test coverage \(\d+(?:\.\d+)?%\)/gi,
      "coverage requires live Jest run",
    )
    .replace(
      /(?:^|\*\s)[^*\n]*test coverage[^*\n]*\d+(?:\.\d+)?%[^*\n]*/gim,
      "* Test coverage percentages require live Jest/Istanbul — not inferred by roadmap LLM.",
    )
    .replace(
      /\b\d{1,3}(?:\.\d+)?%\b(?: is above the recommended threshold of \d+%)?[^.]*\./gi,
      (match) =>
        /coverage/i.test(match)
          ? "Coverage percentages require live Jest/Istanbul — not inferred by roadmap LLM."
          : match,
    );
  if (/SOC 2/i.test(text) && /\d+(?:\.\d+)?%/.test(text)) {
    out = out.replace(
      /Test coverage \(\d+(?:\.\d+)?%\) supports SOC 2[^.]*\./i,
      "SOC 2 change-management evidence requires Simplebeacon gate scans — not roadmap-inferred coverage %.",
    );
  }
  out = out
    .replace(
      /Moderate risk associated with low(?: test coverage)?/gi,
      "Moderate risk — live test coverage not measured in this scan (pair with gate Jest output).",
    )
    .replace(
      /high risk associated with low test coverage/gi,
      "maintainability risk until live Jest/Istanbul baseline is established",
    )
    .replace(
      /address the maintainability risk until live Jest\/Istanbul baseline is established and lack of documentation coverage/gi,
      "establish live Jest/Istanbul and documentation baselines before compliance sign-off",
    )
    .replace(
      /prioritizing test coverage improvements,\s*/gi,
      "establishing a live Jest baseline, ",
    );
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
/**
 * Resolve gate inventory totals.
 * @param {number} gateReport
 * @param {any} hygiene
 * @returns {any}
 */
function resolveGateInventoryTotals(gateReport, hygiene = null) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  const repositoryFilesTotal =
    (_d =
      (_c =
        (_a =
          gateReport === null || gateReport === void 0
            ? void 0
            : gateReport.repositoryFilesTotal) !== null && _a !== void 0
          ? _a
          : (_b =
                gateReport === null || gateReport === void 0
                  ? void 0
                  : gateReport.repositoryInventory) === null || _b === void 0
            ? void 0
            : _b.totalFiles) !== null && _c !== void 0
        ? _c
        : hygiene === null || hygiene === void 0
          ? void 0
          : hygiene.gateRepositoryFilesTotal) !== null && _d !== void 0
      ? _d
      : null;
  const credentialScanned =
    (_k =
      (_j =
        (_h =
          (_f =
            (_e =
              gateReport === null || gateReport === void 0
                ? void 0
                : gateReport.credentialScanned) !== null && _e !== void 0
              ? _e
              : gateReport === null || gateReport === void 0
                ? void 0
                : gateReport.productionLeakScanned) !== null && _f !== void 0
            ? _f
            : (_g =
                  gateReport === null || gateReport === void 0
                    ? void 0
                    : gateReport.scanScope) === null || _g === void 0
              ? void 0
              : _g.productionDirsScanned) !== null && _h !== void 0
          ? _h
          : hygiene === null || hygiene === void 0
            ? void 0
            : hygiene.credentialScanned) !== null && _j !== void 0
        ? _j
        : hygiene === null || hygiene === void 0
          ? void 0
          : hygiene.contentFilesScanned) !== null && _k !== void 0
      ? _k
      : null;
  return { repositoryFilesTotal, credentialScanned };
}
/**
 * Resolve roadmap gate context.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
function resolveRoadmapGateContext(roadmap, options = {}) {
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
    _8;
  const gateReport = options.gateReport || {};
  const hygiene =
    (roadmap === null || roadmap === void 0
      ? void 0
      : roadmap.hygieneSummary) || {};
  const scanScope =
    (roadmap === null || roadmap === void 0 ? void 0 : roadmap.scanScope) || {};
  const {
    repositoryFilesTotal: gateTotalFromReport,
    credentialScanned: credFromReport,
  } = resolveGateInventoryTotals(gateReport, hygiene);
  const repositoryFilesTotal =
    (_c =
      (_b =
        (_a = options.repositoryFilesTotal) !== null && _a !== void 0
          ? _a
          : gateTotalFromReport) !== null && _b !== void 0
        ? _b
        : scanScope.gateRepositoryFilesTotal) !== null && _c !== void 0
      ? _c
      : null;
  const credentialScanned = credFromReport;
  const contentScanned =
    (_o =
      (_m =
        (_l =
          (_k =
            (_j =
              (_f =
                (_e =
                  (_d = gateReport.scanScope) === null || _d === void 0
                    ? void 0
                    : _d.fullDirectoryStats) === null || _e === void 0
                  ? void 0
                  : _e.contentScanned) !== null && _f !== void 0
                ? _f
                : (_h =
                      (_g = gateReport.scanScope) === null || _g === void 0
                        ? void 0
                        : _g.fullDirectoryStats) === null || _h === void 0
                  ? void 0
                  : _h.filesContentScanned) !== null && _j !== void 0
              ? _j
              : gateReport.credentialScanned) !== null && _k !== void 0
            ? _k
            : gateReport.productionLeakScanned) !== null && _l !== void 0
          ? _l
          : hygiene.contentFilesScanned) !== null && _m !== void 0
        ? _m
        : hygiene.credentialScanned) !== null && _o !== void 0
      ? _o
      : null;
  const gateProfile =
    (_s =
      (_r =
        (_q =
          (_p = gateReport.scanScope) === null || _p === void 0
            ? void 0
            : _p.profile) !== null && _q !== void 0
          ? _q
          : scanScope.gateRuleBundleProfile) !== null && _r !== void 0
        ? _r
        : hygiene.gateRuleBundleProfile) !== null && _s !== void 0
      ? _s
      : null;
  const fictionJsonFilesScanned =
    (_w =
      (_v =
        (_t = gateReport.fictionJsonFilesScanned) !== null && _t !== void 0
          ? _t
          : (_u = gateReport.scanScope) === null || _u === void 0
            ? void 0
            : _u.fictionJsonFilesScanned) !== null && _v !== void 0
        ? _v
        : hygiene.fictionJsonFilesScanned) !== null && _w !== void 0
      ? _w
      : null;
  const fictionSampleFilesScanned =
    (_1 =
      (_0 =
        (_y =
          (_x = gateReport.fictionSampleFilesScanned) !== null && _x !== void 0
            ? _x
            : gateReport.mockSampleFiles) !== null && _y !== void 0
          ? _y
          : (_z = gateReport.scanScope) === null || _z === void 0
            ? void 0
            : _z.fictionSampleFilesScanned) !== null && _0 !== void 0
        ? _0
        : hygiene.fictionSampleFilesScanned) !== null && _1 !== void 0
      ? _1
      : null;
  const gatePass =
    (_4 =
      (_3 =
        (_2 = gateReport.gate) === null || _2 === void 0 ? void 0 : _2.pass) !==
        null && _3 !== void 0
        ? _3
        : hygiene.gatePass) !== null && _4 !== void 0
      ? _4
      : null;
  const blockingCount =
    (_8 =
      (_7 =
        (_6 =
          (_5 = gateReport.gate) === null || _5 === void 0
            ? void 0
            : _5.blockingCount) !== null && _6 !== void 0
          ? _6
          : gateReport.issueCount) !== null && _7 !== void 0
        ? _7
        : hygiene.blockingCount) !== null && _8 !== void 0
      ? _8
      : null;
  const jestBaselineChecked =
    gateReport.jestBaselineChecked === false ||
    hygiene.jestBaselineChecked === false
      ? false
      : null;
  const effectiveGateReport =
    Object.keys(gateReport).length > 0
      ? gateReport
      : {
          repositoryFilesTotal,
          credentialScanned,
          fictionJsonFilesScanned,
          fictionSampleFilesScanned,
          jestBaselineChecked,
          ...(gatePass != null
            ? { gate: { pass: gatePass, blockingCount } }
            : {}),
          ...(gateProfile ? { scanScope: { profile: gateProfile } } : {}),
        };
  return {
    gateReport: effectiveGateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
    gatePass,
    blockingCount,
    jestBaselineChecked,
  };
}
/**
 * Has fiction coverage in strategic insights.
 * @param {Array} insights
 * @returns {any}
 */
function hasFictionCoverageInStrategicInsights(insights) {
  var _a;
  if (!insights || typeof insights !== "object") return false;
  const sm = insights.sourceMetrics;
  if (sm && (sm.testCoverage != null || sm.lineCoverage != null)) return true;
  const parts = [
    insights.executiveSummary,
    insights.llmSummary,
    insights.complianceNarrative,
    ...(
      ((_a = insights.riskAssessment) === null || _a === void 0
        ? void 0
        : _a.riskFactors) || []
    ).flatMap((f) => [f.description, f.recommendation]),
  ].filter(Boolean);
  const blob = parts.join("\n");
  return (
    /test coverage[^.\n]{0,80}\d+(?:\.\d+)?%/i.test(blob) ||
    /coverage[^.\n]{0,40}\d+(?:\.\d+)?%/i.test(blob) ||
    /\d+(?:\.\d+)?%[^.\n]{0,40}coverage/i.test(blob)
  );
}
/**
 * Sanitize product strategic insights for export.
 * @param {Array} insights
 * @returns {any}
 */
function sanitizeProductStrategicInsightsForExport(insights) {
  var _a;
  if (!insights || typeof insights !== "object") return insights;
  const next = { ...insights };
  if (next.sourceMetrics) {
    next.sourceMetrics = {
      ...next.sourceMetrics,
      testCoverage: null,
      lineCoverage: null,
      testCoverageNote:
        "Coverage % stripped on export — pair with live Jest result or gate JSON for handoff evidence.",
    };
  }
  for (const field of [
    "executiveSummary",
    "llmSummary",
    "complianceNarrative",
  ]) {
    if (typeof next[field] === "string") {
      next[field] = stripFictionCoverageFromText(next[field]);
    }
  }
  if (
    (_a = next.riskAssessment) === null || _a === void 0
      ? void 0
      : _a.riskFactors
  ) {
    next.riskAssessment = {
      ...next.riskAssessment,
      riskFactors: next.riskAssessment.riskFactors.map((factor) => {
        const text = `${factor.description || ""} ${factor.recommendation || ""}`;
        if (!/\d+(?:\.\d+)?%/.test(text) || !/coverage/i.test(text))
          return factor;
        return {
          ...factor,
          description: stripFictionCoverageFromText(factor.description || ""),
          recommendation: stripFictionCoverageFromText(
            factor.recommendation || "",
          ),
        };
      }),
    };
  }
  if (Array.isArray(next.recommendations)) {
    next.recommendations = next.recommendations.map((rec) => {
      if (!rec || typeof rec !== "object" || typeof rec.action !== "string")
        return rec;
      if (
        !/test coverage/i.test(rec.action) ||
        !/\d+(?:\.\d+)?%/.test(rec.action)
      )
        return rec;
      return { ...rec, action: stripFictionCoverageFromText(rec.action) };
    });
  }
  next.llmAdvisoryOnly = true;
  const disclaimer = String(next.llmDisclaimer || "").trim();
  next.llmDisclaimer = disclaimer.includes("Coverage percentages")
    ? disclaimer
    : `${disclaimer} Coverage percentages in LLM fields are not handoff evidence unless paired with live Jest output.`.trim();
  return next;
}
/**
 * Sanitize product coverage for export.
 * @param {any} roadmap
 * @returns {any}
 */
function sanitizeProductCoverageForExport(roadmap) {
  var _a, _b, _c;
  const metrics =
    (_a = roadmap.progressMetrics) === null || _a === void 0
      ? void 0
      : _a.metrics;
  const staleProgressMetrics = isStaleRoadmapCoverageMetrics(metrics);
  const fictionInInsights = hasFictionCoverageInStrategicInsights(
    roadmap.strategicInsights,
  );
  const needsCoverageSanitize = staleProgressMetrics || fictionInInsights;
  if (!needsCoverageSanitize) {
    const next = {
      ...roadmap,
      coverageEvidenceSource:
        (_b = roadmap.coverageEvidenceSource) !== null && _b !== void 0
          ? _b
          : (metrics === null || metrics === void 0
                ? void 0
                : metrics.testCoverage) != null
            ? "jest-coverage-summary"
            : null,
    };
    if (next.strategicInsights) {
      next.strategicInsights = sanitizeProductStrategicInsightsForExport(
        next.strategicInsights,
      );
    }
    return next;
  }
  const next = { ...roadmap };
  if (
    staleProgressMetrics &&
    ((_c = next.progressMetrics) === null || _c === void 0
      ? void 0
      : _c.metrics)
  ) {
    next.progressMetrics = {
      ...next.progressMetrics,
      metrics: {
        ...next.progressMetrics.metrics,
        testCoverage: null,
        lineCoverage: null,
        branchCoverage: null,
        testCoverageNote:
          "Coverage % omitted — no live Jest baseline paired in this scan; run npm test with Istanbul before citing in handoffs.",
      },
    };
  }
  if (next.strategicInsights) {
    next.strategicInsights = sanitizeProductStrategicInsightsForExport(
      next.strategicInsights,
    );
  }
  next.coverageEvidenceSource = "omitted-stale-prior";
  return next;
}
/**
 * Build product roadmap hygiene summary.
 * @param {any} roadmap
 * @param {string} gateContext
 * @returns {any}
 */
function buildProductRoadmapHygieneSummary(roadmap, gateContext = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
  /**
   * Jest feature.
   * @param {any} roadmap.codeAnalysis?.features || []
   * @returns {any}
   */
  const jestFeature = (
    ((_a = roadmap.codeAnalysis) === null || _a === void 0
      ? void 0
      : _a.features) || []
  ).find((f) =>
    /jest test files/i.test(
      String((f === null || f === void 0 ? void 0 : f.name) || ""),
    ),
  );
  const {
    repositoryFilesTotal: gateTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
    gatePass,
    blockingCount,
    jestBaselineChecked,
  } = gateContext;
  return {
    roadmapAuditFiles:
      (_d =
        (_c =
          (_b = roadmap.codeAnalysis) === null || _b === void 0
            ? void 0
            : _b.structure) === null || _c === void 0
          ? void 0
          : _c.totalFiles) !== null && _d !== void 0
        ? _d
        : null,
    gateRepositoryFilesTotal: gateTotal,
    sprintCompletionRate:
      (_f =
        (_e = roadmap.executiveSummary) === null || _e === void 0
          ? void 0
          : _e.completionRate) !== null && _f !== void 0
        ? _f
        : null,
    coverageEvidenceSource:
      (_g = roadmap.coverageEvidenceSource) !== null && _g !== void 0
        ? _g
        : ((_j =
              (_h = roadmap.progressMetrics) === null || _h === void 0
                ? void 0
                : _h.metrics) === null || _j === void 0
              ? void 0
              : _j.testCoverage) != null
          ? "jest-coverage-summary"
          : "none",
    apiRouteCount:
      (_p =
        (_m =
          (_l =
            (_k = roadmap.codeAnalysis) === null || _k === void 0
              ? void 0
              : _k.aiIntegration) === null || _l === void 0
            ? void 0
            : _l.apiRouteCount) !== null && _m !== void 0
          ? _m
          : (_o = roadmap.aiIntegration) === null || _o === void 0
            ? void 0
            : _o.apiRouteCount) !== null && _p !== void 0
        ? _p
        : null,
    jestFilesOnDisk:
      (_q =
        jestFeature === null || jestFeature === void 0
          ? void 0
          : jestFeature.count) !== null && _q !== void 0
        ? _q
        : null,
    ...(credentialScanned != null ? { credentialScanned } : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    ...(gateTotal != null &&
    credentialScanned != null &&
    gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
    ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(gatePass != null ? { gatePass } : {}),
    ...(blockingCount != null ? { blockingCount } : {}),
    ...(jestBaselineChecked === false ? { jestBaselineChecked: false } : {}),
    roadmapHealthStatus: roadmap.roadmapHealthStatus || "product-advisory",
    attestationNote:
      "Filesystem roadmap + LLM advisory — gate JSON is source of truth for vendor handoff.",
  };
}
/**
 * Build product roadmap scan scope.
 * @param {any} scanScope
 * @param {any} roadmap
 * @param {string} gateContext
 * @returns {any}
 */
function buildProductRoadmapScanScope(scanScope, roadmap, gateContext = {}) {
  var _a;
  const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
  return {
    ...(scanScope || {}),
    resultsViewScope: "filesystem-roadmap-advisory",
    securityHandoffEligible: false,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    roadmapNote:
      (scanScope === null || scanScope === void 0
        ? void 0
        : scanScope.roadmapNote) ||
      ((_a =
        roadmap === null || roadmap === void 0 ? void 0 : roadmap.scanScope) ===
        null || _a === void 0
        ? void 0
        : _a.roadmapNote) ||
      "Roadmap metrics are filesystem-derived — strategicInsights LLM narrative is advisory only.",
  };
}
/**
 * Sanitize product development phases.
 * @param {Array} phases
 * @param {Array} codeAnalysis
 * @returns {any}
 */
function sanitizeProductDevelopmentPhases(phases, codeAnalysis) {
  if (!Array.isArray(phases)) return phases;
  /**
   * Jest feature.
   * @param {any} codeAnalysis?.features || []
   * @returns {any}
   */
  const jestFeature = (
    (codeAnalysis === null || codeAnalysis === void 0
      ? void 0
      : codeAnalysis.features) || []
  ).find((f) =>
    /jest test files/i.test(
      String((f === null || f === void 0 ? void 0 : f.name) || ""),
    ),
  );
  const testCount =
    jestFeature === null || jestFeature === void 0 ? void 0 : jestFeature.count;
  if (testCount == null) return phases;
  return phases.map((phase) => {
    if (!/Sprint 2/i.test(String(phase.phase || ""))) return phase;
    /**
     * Features.
     * @param {any} phase.features || []
     * @returns {any}
     */
    const features = (phase.features || []).map((entry) => {
      const text = String(entry);
      if (/tests pending/i.test(text)) {
        return `${testCount} test files on disk (run Jest for live suite count)`;
      }
      return entry;
    });
    return features.some((feature, index) => {
      var _a;
      return (
        feature !==
        ((_a = phase.features) === null || _a === void 0 ? void 0 : _a[index])
      );
    })
      ? { ...phase, features }
      : phase;
  });
}
/**
 * Build product roadmap export notes.
 * @param {any} roadmap
 * @param {string} context
 * @returns {any}
 */
function buildProductRoadmapExportNotes(roadmap, context = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
  const notes = [
    "securityHandoffEligible is false — roadmap is filesystem/LLM advisory; gate JSON is required for vendor security handoff.",
    "Absolute scan paths are redacted to project label in operator exports.",
  ];
  if (roadmap.coverageEvidenceSource === "omitted-stale-prior") {
    notes.push(
      "progressMetrics coverage % removed — no Jest baseline label was paired in this scan (likely prior-progress or disk cache).",
    );
  }
  if (
    (_a = roadmap.strategicInsights) === null || _a === void 0
      ? void 0
      : _a.llmAdvisoryOnly
  ) {
    notes.push(
      "strategicInsights LLM narrative is advisory — deterministic codeAnalysis and gate exports are source of truth.",
    );
  }
  if (
    (_b = roadmap.rejectedFiction) === null || _b === void 0
      ? void 0
      : _b.warning
  ) {
    notes.push(
      "rejectedFiction block documents claims this scanner does not produce — do not cite LLM coverage % in compliance handoffs.",
    );
  }
  const repoTotal =
    (_c = context.repositoryFilesTotal) !== null && _c !== void 0 ? _c : null;
  const auditFiles =
    (_e =
      (_d = roadmap.codeAnalysis) === null || _d === void 0
        ? void 0
        : _d.structure) === null || _e === void 0
      ? void 0
      : _e.totalFiles;
  const credentialScanned =
    (_f = context.credentialScanned) !== null && _f !== void 0 ? _f : null;
  const gateProfile =
    (_g = context.gateProfile) !== null && _g !== void 0 ? _g : null;
  const fictionJsonFilesScanned =
    (_h = context.fictionJsonFilesScanned) !== null && _h !== void 0
      ? _h
      : null;
  const fictionSampleFilesScanned =
    (_j = context.fictionSampleFilesScanned) !== null && _j !== void 0
      ? _j
      : null;
  const gatePass =
    (_k = context.gatePass) !== null && _k !== void 0 ? _k : null;
  const blockingCount =
    (_l = context.blockingCount) !== null && _l !== void 0 ? _l : null;
  const jestBaselineChecked = context.jestBaselineChecked;
  if (repoTotal != null && auditFiles != null && repoTotal !== auditFiles) {
    notes.push(
      `codeAnalysis.structure.totalFiles (${Number(auditFiles).toLocaleString()}) is roadmap audit scope — gate repository inventory is ${Number(repoTotal).toLocaleString()} paths.`,
    );
  }
  if (
    repoTotal != null &&
    credentialScanned != null &&
    credentialScanned < repoTotal
  ) {
    notes.push(
      `CRED/LEAK rules scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(repoTotal - credentialScanned).toLocaleString()} metadata-only path(s) in gate inventory of ${Number(repoTotal).toLocaleString()}.`,
    );
  }
  if (
    fictionJsonFilesScanned != null &&
    fictionSampleFilesScanned != null &&
    fictionJsonFilesScanned > fictionSampleFilesScanned
  ) {
    notes.push(
      // simplebeacon:production-leak-intent - legitimate KPI reference for roadmap reporting
      `DATA-002 evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) — ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched.`,
    );
  }
  if (gateProfile) {
    notes.push(
      `Gate rule bundle profile: ${gateProfile} — pair roadmap advisory with json/simplebeacon-gate.json for handoff evidence.`,
    );
  }
  if (
    gatePass === false &&
    (blockingCount !== null && blockingCount !== void 0 ? blockingCount : 0) > 0
  ) {
    notes.push(
      `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) — roadmap advisory does not clear production-path gate; see json/simplebeacon-gate.json.`,
    );
  }
  if (
    roadmap.coverageEvidenceSource === "omitted-stale-prior" ||
    jestBaselineChecked === false
  ) {
    notes.push(
      "Roadmap scan did not pair live Jest — use gate/complete scan for test attestation.",
    );
  }
  notes.push(
    "Sprint completion % is filesystem-derived — not vendor handoff clearance.",
  );
  return dedupeRoadmapExportNotes(notes).slice(0, 12);
}
/**
 * Sanitize product roadmap export.
 * @param {any} next
 * @param {Object} options
 * @returns {any}
 */
function sanitizeProductRoadmapExport(next, options = {}) {
  var _a;
  const rawPath =
    options.requestedProjectPath ||
    options.projectPath ||
    next.sourceProjectPath ||
    next.platformRoot ||
    "";
  const label = projectLabelFromPath(rawPath);
  let roadmap = redactProductRoadmapPaths(next, label);
  roadmap = sanitizeProductCoverageForExport(roadmap);
  if (roadmap.developmentPhases) {
    roadmap.developmentPhases = sanitizeProductDevelopmentPhases(
      roadmap.developmentPhases,
      roadmap.codeAnalysis,
    );
  }
  if (isStaleEmptyCodebaseMetrics(roadmap.codebaseMetrics)) {
    delete roadmap.codebaseMetrics;
  }
  if (
    roadmap.projectStructure &&
    ((_a = roadmap.codeAnalysis) === null || _a === void 0
      ? void 0
      : _a.structure)
  ) {
    const walkFiles = roadmap.projectStructure.totalFiles;
    const auditFiles = roadmap.codeAnalysis.structure.totalFiles;
    if (walkFiles != null && auditFiles != null && walkFiles !== auditFiles) {
      roadmap.projectStructure = {
        ...roadmap.projectStructure,
        note: `Top-level categories only (${walkFiles} immediate files walked) — codeAnalysis.structure.totalFiles (${auditFiles}) is audit-scoped inventory for sprint metrics.`,
      };
    }
  }
  roadmap.exportNormalized = true;
  roadmap.exportSanitized = true;
  roadmap.scanTargetProfile = "product";
  roadmap.securityHandoffEligible = false;
  roadmap.handoffEligible = false;
  roadmap.roadmapHealthStatus =
    roadmap.roadmapHealthStatus || "product-advisory";
  const gateContext = resolveRoadmapGateContext(roadmap, options);
  roadmap.scanScope = buildProductRoadmapScanScope(
    roadmap.scanScope,
    roadmap,
    gateContext,
  );
  roadmap.hygieneSummary = buildProductRoadmapHygieneSummary(
    roadmap,
    gateContext,
  );
  roadmap.exportNotes = buildProductRoadmapExportNotes(roadmap, gateContext);
  return roadmap;
}
/**
 * Build benchmark roadmap export notes.
 * @param {Array} existingNotes
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function buildBenchmarkRoadmapExportNotes(
  existingNotes = [],
  misscopedPlatformWalk = false,
) {
  const canonical = misscopedPlatformWalk
    ? "Mis-scoped complete-scan export: roadmap walked Simplebeacon platform root while scan target was github-cache/ clone — re-run after updating Simplebeacon for clone-scoped metrics."
    : "Simplebeacon v1-internal deploy block, template sprint phases, and CI recommendations removed or replaced for github-cache/ benchmark target.";
  const filtered = dedupeRoadmapExportNotes(existingNotes).filter((note) => {
    if (misscopedPlatformWalk)
      return !/mis-scoped complete-scan export/i.test(String(note));
    return !/v1-internal deploy block/i.test(String(note));
  });
  return dedupeRoadmapExportNotes([...filtered, canonical]);
}
/**
 * Normalize roadmap export paths.
 * @param {any} roadmap
 * @param {any} scanTargetRoot
 * @returns {any}
 */
function normalizeRoadmapExportPaths(roadmap, scanTargetRoot = "") {
  const root = normalizeExportPath(
    scanTargetRoot || roadmap.scanTargetRoot || roadmap.sourceProjectPath || "",
  );
  const next = {
    ...roadmap,
    sourceProjectPath: root || normalizeExportPath(roadmap.sourceProjectPath),
    scanTargetRoot: root || normalizeExportPath(roadmap.scanTargetRoot),
    platformRoot: normalizeExportPath(
      roadmap.platformRoot || roadmap.productPlatformRoot || "",
    ),
    ...(roadmap.productPlatformRoot
      ? {
          productPlatformRoot: normalizeExportPath(roadmap.productPlatformRoot),
        }
      : {}),
  };
  if (next.projectStructure) {
    const mainCategories = next.projectStructure.mainCategories
      ? Object.fromEntries(
          Object.entries(next.projectStructure.mainCategories).map(
            ([key, category]) => [
              key,
              { ...category, path: normalizeExportPath(category.path || "") },
            ],
          ),
        )
      : next.projectStructure.mainCategories;
    next.projectStructure = {
      ...next.projectStructure,
      projectRoot:
        root || normalizeExportPath(next.projectStructure.projectRoot),
      platformRoot: normalizeExportPath(
        next.projectStructure.platformRoot || next.platformRoot,
      ),
      mainCategories,
    };
  }
  return next;
}
/**
 * Phases are equivalent.
 * @param {any} left
 * @param {any} right
 * @returns {any}
 */
function phasesAreEquivalent(left = [], right = []) {
  if (!Array.isArray(left) || !Array.isArray(right)) return false;
  return JSON.stringify(left) === JSON.stringify(right);
}
/**
 * Collapse duplicate benchmark phases.
 * @param {any} roadmap
 * @returns {any}
 */
function collapseDuplicateBenchmarkPhases(roadmap) {
  const dev = roadmap.developmentPhases;
  const bench = roadmap.benchmarkSprintModel;
  if (!bench || bench.phasesRef || !Array.isArray(bench.phases)) return roadmap;
  if (!phasesAreEquivalent(dev, bench.phases)) return roadmap;
  const { phases, ...rest } = bench;
  return {
    ...roadmap,
    benchmarkSprintModel: {
      ...rest,
      phasesRef: "developmentPhases",
      phaseCount: phases.length,
    },
  };
}
/**
 * Align project structure inventory.
 * @param {string} projectStructure
 * @param {string} structure
 * @returns {any}
 */
function alignProjectStructureInventory(projectStructure, structure) {
  if (
    !projectStructure ||
    !(structure === null || structure === void 0
      ? void 0
      : structure.totalFiles)
  )
    return projectStructure;
  const topLevelSum = projectStructure.totalFiles;
  const needsScopeNote =
    topLevelSum != null && topLevelSum !== structure.totalFiles;
  return {
    ...projectStructure,
    totalFiles: structure.totalFiles,
    ...(needsScopeNote
      ? {
          totalFilesTopLevel: topLevelSum,
          inventoryScopeNote:
            "totalFiles is full clone inventory; totalFilesTopLevel is immediate category file count only.",
        }
      : {}),
  };
}
/**
 * Sanitize codebase metrics for benchmark.
 * @param {Array} metrics
 * @param {string} structure
 * @returns {any}
 */
function sanitizeCodebaseMetricsForBenchmark(metrics, structure) {
  var _a, _b, _c, _d, _e, _f;
  if (!structure) return metrics;
  const languages =
    structure.languages && Object.keys(structure.languages).length
      ? structure.languages
      : metrics === null || metrics === void 0
        ? void 0
        : metrics.languages;
  return {
    ...metrics,
    totalLinesOfCode:
      (metrics === null || metrics === void 0
        ? void 0
        : metrics.totalLinesOfCode) || null,
    languages: languages || {},
    testCoverage: null,
    complexity:
      (metrics === null || metrics === void 0 ? void 0 : metrics.complexity) ||
      {},
    documentation: {
      readmeFiles:
        (_d =
          (_b =
            (_a = structure.languages) === null || _a === void 0
              ? void 0
              : _a[".md"]) !== null && _b !== void 0
            ? _b
            : (_c =
                  metrics === null || metrics === void 0
                    ? void 0
                    : metrics.documentation) === null || _c === void 0
              ? void 0
              : _c.readmeFiles) !== null && _d !== void 0
          ? _d
          : 0,
      totalDocs:
        (_f =
          (_e = structure.languages) === null || _e === void 0
            ? void 0
            : _e[".md"]) !== null && _f !== void 0
          ? _f
          : 0,
      coverage: null,
    },
    benchmarkMetricsNote:
      "Product codebaseMetrics template omitted on OSS clone — see codeAnalysis.structure.",
  };
}
/**
 * Sanitize ai integration for benchmark.
 * @param {any} aiIntegration
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeAiIntegrationForBenchmark(
  aiIntegration,
  misscopedPlatformWalk = false,
) {
  var _a;
  if (!aiIntegration) return aiIntegration;
  if (misscopedPlatformWalk) {
    return {
      ...aiIntegration,
      apiRouteCount: null,
      apis: [],
      notes:
        "API route inventory omitted — mis-scoped platform walk on benchmark target.",
    };
  }
  return {
    level: "inventory-only",
    apis: aiIntegration.apis || [],
    apiRouteCount:
      (_a = aiIntegration.apiRouteCount) !== null && _a !== void 0 ? _a : 0,
    confidence: null,
    notes:
      aiIntegration.notes || "No route handlers found under server/ or src/",
    benchmarkAiNote:
      "Generic AI capability flags omitted on OSS benchmark clone — route inventory only.",
  };
}
const BENCHMARK_DELIVERY_FICTION =
  /production readiness|revenue and compliance|unblocks production/i;
/**
 * Sanitize benchmark recommendation items.
 * @param {Array} recommendations
 * @returns {any}
 */
function sanitizeBenchmarkRecommendationItems(recommendations = []) {
  return recommendations.map((rec) => {
    if (!rec || typeof rec !== "object") return rec;
    const blob = `${rec.estimatedImpact || ""} ${rec.businessValue || ""}`;
    if (!BENCHMARK_DELIVERY_FICTION.test(blob)) return rec;
    return {
      ...rec,
      category: rec.category === "delivery" ? "benchmark" : rec.category,
      estimatedImpact: "Benchmark hygiene comparison only",
      businessValue: "Accurate OSS baseline — not product deploy evidence",
    };
  });
}
/**
 * Is benchmark scan target root.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkScanTargetRoot(projectPath) {
  const rel = normalizeExportPath(projectPath).toLowerCase();
  return (
    rel.includes("/github-cache/") ||
    rel.startsWith("github-cache/") ||
    rel.includes("/java-ai-vulnerable/") ||
    rel.startsWith("java-ai-vulnerable/")
  );
}
/**
 * Resolve roadmap export context.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
function resolveRoadmapExportContext(roadmap, options = {}) {
  var _a;
  const sourceRoot = normalizeExportPath(
    (roadmap === null || roadmap === void 0
      ? void 0
      : roadmap.sourceProjectPath) ||
      (roadmap === null || roadmap === void 0 ? void 0 : roadmap.projectRoot) ||
      ((_a =
        roadmap === null || roadmap === void 0
          ? void 0
          : roadmap.projectStructure) === null || _a === void 0
        ? void 0
        : _a.projectRoot) ||
      "",
  );
  const scanTargetRoot = normalizeExportPath(
    options.scanTargetRoot ||
      options.requestedProjectPath ||
      (roadmap === null || roadmap === void 0
        ? void 0
        : roadmap.scanTargetRoot) ||
      (roadmap === null || roadmap === void 0
        ? void 0
        : roadmap.requestedScanRoot) ||
      inferScanTargetRootFromHints(roadmap, options) ||
      "",
  );
  const benchmarkFromSource = isBenchmarkScanTargetRoot(sourceRoot);
  const benchmarkFromTarget = isBenchmarkScanTargetRoot(scanTargetRoot);
  const productPlatformRoot =
    benchmarkFromSource || benchmarkFromTarget
      ? resolveProductPlatformRoot(
          benchmarkFromSource ? sourceRoot : scanTargetRoot,
        )
      : null;
  const misscopedPlatformWalk =
    benchmarkFromTarget &&
    !benchmarkFromSource &&
    Boolean(productPlatformRoot) &&
    sourceRoot.toLowerCase() === productPlatformRoot.toLowerCase();
  return {
    benchmarkScan: benchmarkFromSource || benchmarkFromTarget,
    scanTargetRoot: scanTargetRoot || (benchmarkFromSource ? sourceRoot : ""),
    productPlatformRoot,
    misscopedPlatformWalk,
  };
}
/**
 * Resolve product platform root.
 * @param {string} projectPath
 * @returns {any}
 */
function resolveProductPlatformRoot(projectPath) {
  const normalized = String(projectPath || "").replace(/\\/g, "/");
  const idx = normalized.toLowerCase().indexOf("/github-cache/");
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}
/**
 * Filter template lines.
 * @param {any} list
 * @returns {any}
 */
function filterTemplateLines(list = []) {
  return (list || []).filter((line) => !matchesRoadmapTemplate(String(line)));
}
/**
 * Filter template recommendations.
 * @param {Array} recs
 * @returns {any}
 */
function filterTemplateRecommendations(recs = []) {
  return (recs || []).filter((item) => {
    const text =
      typeof item === "string"
        ? item
        : (item === null || item === void 0 ? void 0 : item.action) || "";
    return !matchesRoadmapTemplate(String(text));
  });
}
/**
 * Recommendations need benchmark replace.
 * @param {any} rec
 * @returns {any}
 */
function recommendationsNeedBenchmarkReplace(rec) {
  if (!rec) return true;
  return matchesRoadmapTemplate(JSON.stringify(rec));
}
/**
 * Benchmark recommendations.
 * @returns {any}
 */
function benchmarkRecommendations() {
  return {
    immediate: [
      "Review OSS clone hygiene — Simplebeacon product deploy steps do not apply to github-cache/ targets",
    ],
    shortTerm: [
      "Compare findings against ai-platform product scans separately",
    ],
    longTerm: ["Use benchmark clones for engineering comparison only"],
    priorities: {
      high: ["Review OSS clone hygiene — not Simplebeacon product code"],
      medium: [
        "Re-run Complete scan on ai-platform root for vendor handoff evidence",
      ],
      low: ["Archive or refresh github-cache/ clone when disk space is needed"],
    },
  };
}
/**
 * Sanitize strategic insights.
 * @param {Array} insights
 * @param {any} benchmarkScan
 * @returns {any}
 */
function sanitizeStrategicInsights(insights, benchmarkScan) {
  if (!insights || typeof insights !== "object") return insights;
  const next = { ...insights };
  if (benchmarkScan) {
    const filteredRecs = filterTemplateRecommendations(next.recommendations);
    next.recommendations = sanitizeBenchmarkRecommendationItems(
      filteredRecs.length
        ? filteredRecs
        : [
            {
              priority: "LOW",
              category: "benchmark",
              action:
                "Treat roadmap as OSS hygiene comparison — run product scans on ai-platform root",
              estimatedEffort: "N/A",
              estimatedImpact: "Avoid mis-applying Simplebeacon sprint fiction",
              businessValue: "Accurate benchmark baselines",
            },
          ],
    );
    if (next.riskAssessment) {
      /**
       * Factors.
       * @param {any} next.riskAssessment.riskFactors || []
       * @returns {any}
       */
      const factors = (next.riskAssessment.riskFactors || []).filter(
        (factor) => {
          const text = `${factor.description || ""} ${factor.recommendation || ""}`;
          return !matchesRoadmapTemplate(text);
        },
      );
      next.riskAssessment = {
        ...next.riskAssessment,
        overallRisk: factors.length ? next.riskAssessment.overallRisk : "LOW",
        riskFactors: factors.length
          ? factors
          : [
              {
                category: "benchmark",
                severity: "low",
                description:
                  "OSS benchmark clone — product sprint and coverage metrics are not handoff evidence",
                recommendation:
                  "Run Complete scan and gate on ai-platform root for platform risk assessment",
                estimatedImpact:
                  "Prevents mis-reading template sprint fiction as clone health",
              },
            ],
        benchmarkRiskNote:
          "Product test-coverage and sprint risk factors omitted on github-cache/ clones.",
      };
    }
    if (next.sourceMetrics) {
      next.sourceMetrics = {
        ...next.sourceMetrics,
        testCoverage: null,
        lineCoverage: null,
        completionRate: null,
        featureCompleteness: null,
        immediateActions: filterTemplateLines(
          next.sourceMetrics.immediateActions,
        ),
        shortTermActions: filterTemplateLines(
          next.sourceMetrics.shortTermActions,
        ),
        longTermActions: filterTemplateLines(
          next.sourceMetrics.longTermActions,
        ),
      };
    }
    for (const field of [
      "executiveSummary",
      "llmSummary",
      "complianceNarrative",
    ]) {
      if (
        typeof next[field] === "string" &&
        isBenchmarkProductNarrative(next[field])
      ) {
        next[field] =
          "OSS benchmark clone — Simplebeacon product sprint and deploy guidance omitted. Deterministic filesystem metrics remain authoritative.";
      }
    }
    const disclaimer = String(next.llmDisclaimer || "").trim();
    next.llmDisclaimer = disclaimer.includes("Benchmark clone")
      ? disclaimer
      : `${disclaimer} Benchmark clone: ignore Simplebeacon CI/deploy recommendations.`.trim();
  }
  return next;
}
/**
 * Sanitize progress metrics.
 * @param {Array} metrics
 * @param {any} benchmarkScan
 * @param {Array} codeMetrics
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeProgressMetrics(
  metrics,
  benchmarkScan,
  codeMetrics,
  misscopedPlatformWalk = false,
) {
  var _a, _b, _c;
  if (!metrics || !benchmarkScan) return metrics;
  return {
    ...metrics,
    overall: null,
    phases: { "OSS filesystem scan": 100 },
    categories: {
      "OSS source": (
        codeMetrics === null || codeMetrics === void 0
          ? void 0
          : codeMetrics.codeFiles
      )
        ? Math.min(100, Math.round(codeMetrics.codeFiles / 20))
        : null,
      Documentation:
        (_b =
          (_a = metrics.categories) === null || _a === void 0
            ? void 0
            : _a.Documentation) !== null && _b !== void 0
          ? _b
          : null,
    },
    metrics: {
      ...(metrics.metrics || {}),
      jestTests:
        (codeMetrics === null || codeMetrics === void 0
          ? void 0
          : codeMetrics.codeFiles) != null
          ? `${(_c = codeMetrics.testFiles) !== null && _c !== void 0 ? _c : "—"} test files on disk (product Jest gate metric not applicable)`
          : null,
      jestSuites: null,
      pageSamples: "N/A (Simplebeacon PAGE_SAMPLE_SPECS)",
      testCoverage: null,
      lineCoverage: null,
      branchCoverage: null,
      featureCompleteness: null,
      featureCompletenessNote:
        "Sprint completion % reflects Simplebeacon template sprints — not valid for OSS clones; see benchmarkSprintModel.",
      ...(misscopedPlatformWalk
        ? {
            apiRouteCount: null,
            apiRouteCountNote:
              "Simplebeacon platform API route count omitted on mis-scoped benchmark export.",
          }
        : {}),
    },
  };
}
const PRODUCT_INVENTORY_FEATURE_MARKERS = [
  /117\/117/i,
  /dashboard server/i,
  /stub api/i,
  /phase 2 jwt/i,
  /page_sample/i,
  /page samples/i,
  /npm audit wired/i,
];
/**
 * Overlay misscoped structure inventory.
 * @param {string} structure
 * @param {string} repositoryFilesTotal
 * @returns {any}
 */
function overlayMisscopedStructureInventory(structure, repositoryFilesTotal) {
  if (!structure || repositoryFilesTotal == null) return structure;
  return {
    ...structure,
    totalFilesRaw: structure.totalFiles,
    totalFiles: repositoryFilesTotal,
    inventoryScopeNote:
      "Gate audit file count on github-cache/ clone; platform walk preserved in totalFilesRaw.",
  };
}
/**
 * Sanitize code analysis for benchmark.
 * @param {Array} codeAnalysis
 * @param {any} misscopedPlatformWalk
 * @returns {any}
 */
function sanitizeCodeAnalysisForBenchmark(
  codeAnalysis,
  misscopedPlatformWalk = false,
) {
  var _a, _b;
  if (!codeAnalysis || typeof codeAnalysis !== "object") return codeAnalysis;
  const next = { ...codeAnalysis };
  if (Array.isArray(next.features)) {
    if (misscopedPlatformWalk) {
      next.features = [];
      next.featuresNote =
        "Product feature inventory omitted — roadmap walked Simplebeacon platform root instead of github-cache/ clone.";
    } else {
      next.features = next.features.filter((feature) => {
        const label = String(
          (feature === null || feature === void 0 ? void 0 : feature.label) ||
            (feature === null || feature === void 0 ? void 0 : feature.name) ||
            "",
        );
        if (
          /1000\/1000/.test(label) ||
          Number(
            feature === null || feature === void 0 ? void 0 : feature.count,
          ) === 1000
        )
          return false;
        return !PRODUCT_INVENTORY_FEATURE_MARKERS.some((re) => re.test(label));
      });
      if (!next.features.length) {
        next.featuresNote =
          "Product Jest gate metric omitted on OSS benchmark clone.";
      }
    }
  }
  const pairs =
    (_b =
      (_a = next.phase2) === null || _a === void 0
        ? void 0
        : _a.fuzzySimilarity) === null || _b === void 0
      ? void 0
      : _b.pairs;
  if (Array.isArray(pairs)) {
    next.phase2 = {
      ...next.phase2,
      fuzzySimilarity: {
        ...next.phase2.fuzzySimilarity,
        pairs: pairs.map((pair) => {
          const a = String(pair.fileA || "")
            .split("/")
            .pop();
          const b = String(pair.fileB || "")
            .split("/")
            .pop();
          const isMirror = INTENTIONAL_MIRROR_PAIRS.some(
            ([left, right]) =>
              (a === left && b === right) || (a === right && b === left),
          );
          return isMirror
            ? {
                ...pair,
                recommendation: "Intentional CJS/browser mirror — do not merge",
                intentionalMirror: true,
              }
            : pair;
        }),
      },
    };
  }
  return next;
}
/**
 * Sanitize resource estimate for benchmark.
 * @param {any} estimate
 * @returns {any}
 */
function sanitizeResourceEstimateForBenchmark(estimate) {
  if (!estimate || typeof estimate !== "object") return estimate;
  return {
    ...estimate,
    remainingSprints: 0,
    sprintBreakdown: [],
    budgetNote:
      "OSS benchmark clone — internal notional estimate only; product sprint breakdown omitted.",
  };
}
/**
 * Sanitize executive summary for benchmark.
 * @param {any} summary
 * @param {Array} codeMetrics
 * @returns {any}
 */
function sanitizeExecutiveSummaryForBenchmark(summary, codeMetrics) {
  var _a;
  if (!summary || typeof summary !== "object") return summary;
  return {
    ...summary,
    totalFeatures: null,
    completedFeatures: null,
    plannedFeatures: null,
    completionRate: null,
    projectHealth: "Benchmark hygiene",
    notes:
      "OSS benchmark clone under github-cache/ — not Simplebeacon platform product code. Sprint completion % uses product template signals and is not handoff evidence.",
    codeFilesAnalyzed:
      (_a =
        codeMetrics === null || codeMetrics === void 0
          ? void 0
          : codeMetrics.codeFiles) !== null && _a !== void 0
        ? _a
        : summary.codeFilesAnalyzed,
  };
}
/**
 * Sanitize roadmap export.
 * @param {any} roadmap
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeRoadmapExport(roadmap, options = {}) {
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
    _v;
  if (!roadmap || roadmap.type !== "dynamic-project-roadmap-analysis")
    return roadmap;
  const exportContext = resolveRoadmapExportContext(roadmap, options);
  const {
    benchmarkScan,
    scanTargetRoot,
    productPlatformRoot,
    misscopedPlatformWalk,
  } = exportContext;
  let next = { ...roadmap };
  if (!benchmarkScan) {
    return sanitizeProductRoadmapExport(next, options);
  }
  next = normalizeRoadmapExportPaths(next, scanTargetRoot);
  delete next.v1InternalDeploy;
  next.benchmarkScan = true;
  next.scanTargetProfile = "benchmark-cache";
  next.handoffEligible = false;
  next.roadmapExportProfile = misscopedPlatformWalk
    ? "benchmark-misscoped"
    : "benchmark-clone";
  next.productPlatformRoot = productPlatformRoot || undefined;
  next.scanTargetRoot =
    scanTargetRoot ||
    next.sourceProjectPath ||
    next.projectRoot ||
    next.platformRoot;
  next.platformRoot =
    productPlatformRoot || next.platformRoot || next.scanTargetRoot;
  if (misscopedPlatformWalk) {
    next.misscopedPlatformCodeWalk = true;
    next.codeAnalysisRoot = next.sourceProjectPath || next.codeAnalysisRoot;
  }
  next = sanitizeProjectIdentityForBenchmark(
    next,
    next.scanTargetRoot,
    misscopedPlatformWalk,
  );
  if (
    misscopedPlatformWalk &&
    options.repositoryFilesTotal != null &&
    ((_a = next.codeAnalysis) === null || _a === void 0 ? void 0 : _a.structure)
  ) {
    next.codeAnalysis = {
      ...next.codeAnalysis,
      structure: overlayMisscopedStructureInventory(
        next.codeAnalysis.structure,
        options.repositoryFilesTotal,
      ),
    };
  }
  if (next.aiIntegration) {
    next.aiIntegration = sanitizeAiIntegrationForBenchmark(
      next.aiIntegration,
      misscopedPlatformWalk,
    );
  }
  if (next.recommendations) {
    const rec = next.recommendations;
    const filtered = {
      immediate: filterTemplateLines(rec.immediate),
      shortTerm: filterTemplateLines(rec.shortTerm),
      longTerm: filterTemplateLines(rec.longTerm),
      priorities: {
        high: filterTemplateLines(
          ((_b = rec.priorities) === null || _b === void 0
            ? void 0
            : _b.high) || rec.immediate,
        ),
        medium: filterTemplateLines(
          ((_c = rec.priorities) === null || _c === void 0
            ? void 0
            : _c.medium) || rec.shortTerm,
        ),
        low: filterTemplateLines(
          ((_d = rec.priorities) === null || _d === void 0 ? void 0 : _d.low) ||
            rec.longTerm,
        ),
      },
    };
    const hasAny =
      filtered.immediate.length ||
      filtered.shortTerm.length ||
      filtered.longTerm.length;
    next.recommendations =
      hasAny && !recommendationsNeedBenchmarkReplace(filtered)
        ? filtered
        : benchmarkRecommendations();
  } else {
    next.recommendations = benchmarkRecommendations();
  }
  if (
    ((_e = next.developmentPhases) === null || _e === void 0
      ? void 0
      : _e.length) &&
    matchesRoadmapTemplate(JSON.stringify(next.developmentPhases))
  ) {
    if (!next.developmentPhasesTemplate) {
      next.developmentPhasesTemplate = next.developmentPhases;
    }
    next.developmentPhases = (
      ((_f = next.benchmarkSprintModel) === null || _f === void 0
        ? void 0
        : _f.phases) || [
        {
          phase: "OSS clone filesystem scan",
          status: "completed",
          progress: 100,
          description:
            "github-cache benchmark — Simplebeacon four-sprint product model does not apply",
          features: [
            `${(_j = (_h = (_g = next.codeAnalysis) === null || _g === void 0 ? void 0 : _g.structure) === null || _h === void 0 ? void 0 : _h.codeFiles) !== null && _j !== void 0 ? _j : "—"} code-like files analyzed`,
            `${(_m = (_l = (_k = next.codeAnalysis) === null || _k === void 0 ? void 0 : _k.structure) === null || _l === void 0 ? void 0 : _l.totalFiles) !== null && _m !== void 0 ? _m : "—"} files inventoried`,
          ],
          milestones: [
            "Compare against other OSS benchmarks or ai-platform product scans",
          ],
        },
      ]
    ).slice(0, 4);
  }
  if (
    (_o = next.implementationPhases) === null || _o === void 0
      ? void 0
      : _o.length
  ) {
    const alreadyBenchmark =
      next.implementationPhases.length === 1 &&
      String(
        ((_p = next.implementationPhases[0]) === null || _p === void 0
          ? void 0
          : _p.phase) || "",
      )
        .toLowerCase()
        .includes("benchmark filesystem");
    if (!alreadyBenchmark) {
      if (!next.implementationPhasesTemplate) {
        next.implementationPhasesTemplate = next.implementationPhases;
      }
      next.implementationPhases = [
        {
          phase: "Benchmark filesystem scan",
          status: "complete",
          items: [
            "Inventory",
            "Dependency graph",
            "Fuzzy similarity (informational)",
          ],
        },
      ];
    }
  }
  if (next.executiveSummary && typeof next.executiveSummary === "object") {
    next.executiveSummary = sanitizeExecutiveSummaryForBenchmark(
      next.executiveSummary,
      (_q = next.codeAnalysis) === null || _q === void 0
        ? void 0
        : _q.structure,
    );
  }
  if (
    typeof next.llmSummary === "string" &&
    isBenchmarkProductNarrative(next.llmSummary)
  ) {
    next.llmSummary =
      "OSS benchmark clone scan — Simplebeacon product sprint guidance omitted.";
  }
  if (
    next.projectOverview &&
    (matchesRoadmapTemplate(JSON.stringify(next.projectOverview)) ||
      /simplebeacon-platform/i.test(JSON.stringify(next.projectOverview)))
  ) {
    next.projectOverview = {
      ...next.projectOverview,
      completionRate: null,
      overallProgress: "Benchmark scan",
      projectHealth: "Benchmark hygiene",
      developmentVelocity: "Filesystem scan",
      teamProductivity: "OSS clone comparison",
    };
  }
  next.progressMetrics = sanitizeProgressMetrics(
    next.progressMetrics,
    true,
    (_r = next.codeAnalysis) === null || _r === void 0 ? void 0 : _r.structure,
    misscopedPlatformWalk,
  );
  if (next.codeAnalysis) {
    next.codeAnalysis = sanitizeCodeAnalysisForBenchmark(
      next.codeAnalysis,
      misscopedPlatformWalk,
    );
  }
  if (next.resourceEstimate) {
    next.resourceEstimate = sanitizeResourceEstimateForBenchmark(
      next.resourceEstimate,
    );
  }
  if (
    (_t =
      (_s = next.codeAnalysis) === null || _s === void 0
        ? void 0
        : _s.phase2) === null || _t === void 0
      ? void 0
      : _t.resourceEstimate
  ) {
    next.codeAnalysis.phase2.resourceEstimate =
      sanitizeResourceEstimateForBenchmark(
        next.codeAnalysis.phase2.resourceEstimate,
      );
  }
  if (next.projectStructure) {
    next.projectStructure = alignProjectStructureInventory(
      {
        ...next.projectStructure,
        projectRoot: next.scanTargetRoot,
        platformRoot: productPlatformRoot || next.projectStructure.platformRoot,
        note: misscopedPlatformWalk
          ? "Roadmap walked Simplebeacon platform root while scan target was github-cache/ clone — re-run complete scan for clone-scoped roadmap."
          : "Top-level categories only — scanTargetRoot is the OSS clone; platformRoot is ai-platform product root when set.",
      },
      (_u = next.codeAnalysis) === null || _u === void 0
        ? void 0
        : _u.structure,
    );
  }
  if (next.codebaseMetrics) {
    next.codebaseMetrics = sanitizeCodebaseMetricsForBenchmark(
      next.codebaseMetrics,
      (_v = next.codeAnalysis) === null || _v === void 0
        ? void 0
        : _v.structure,
    );
  }
  next = collapseDuplicateBenchmarkPhases(next);
  if (next.strategicInsights) {
    next.strategicInsights = sanitizeStrategicInsights(
      next.strategicInsights,
      true,
    );
  }
  if (next.developmentPhasesTemplate) {
    next.developmentPhasesTemplateOmitted = true;
    delete next.developmentPhasesTemplate;
  }
  if (next.implementationPhasesTemplate) {
    next.implementationPhasesTemplateOmitted = true;
    delete next.implementationPhasesTemplate;
  }
  next.exportSanitized = true;
  next.exportNormalized = true;
  next.roadmapHealthStatus = misscopedPlatformWalk
    ? "benchmark-misscoped-review"
    : "benchmark-hygiene";
  next.exportNotes = buildBenchmarkRoadmapExportNotes(
    next.exportNotes,
    misscopedPlatformWalk,
  );
  return next;
}
