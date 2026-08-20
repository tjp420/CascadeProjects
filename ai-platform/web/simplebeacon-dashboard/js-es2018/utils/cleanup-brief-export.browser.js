// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
import { formatNumber } from "../utils.js";
/**
 * Browser mirror of cleanup-brief export sanitization (packages/simplebeacon-cli).
 */
/**
 * Redact project path for export.
 * @param {string} rawPath
 * @param {any} projectLabel
 * @returns {any}
 */
function redactProjectPathForExport(rawPath, projectLabel = "ai-platform") {
  if (rawPath == null || rawPath === "") return rawPath;
  const normalized = String(rawPath).replace(/\\/g, "/");
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
/**
 * Resolve redacted brief project path.
 * @param {any} brief
 * @param {Object} options
 * @returns {any}
 */
function resolveRedactedBriefProjectPath(brief, options = {}) {
  var _a;
  const rawPath =
    options.projectPath ||
    brief.projectPath ||
    ((_a = brief.scanAnalysis) === null || _a === void 0
      ? void 0
      : _a.projectPath) ||
    "";
  const label = projectLabelFromPath(rawPath);
  return {
    label,
    projectPath: redactProjectPathForExport(rawPath, label),
  };
}
/**
 * Is benchmark cache project path.
 * @param {string} projectPath
 * @returns {any}
 */
function isBenchmarkCacheProjectPath(projectPath) {
  const rel = String(projectPath || "")
    .replace(/\\/g, "/")
    .toLowerCase();
  return rel.includes("/github-cache/") || rel.startsWith("github-cache/");
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
const BENCHMARK_PROTECTED_PATHS = [".git", ".simplebeacon", "docs", "LICENSE"];
/**
 * Format bytes.
 * @param {Array} bytes
 * @returns {any}
 */
function formatBytes(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
/**
 * Resolve projected inventory note.
 * @param {any} next
 * @param {Array} auditFiles
 * @returns {any}
 */
function resolveProjectedInventoryNote(next, auditFiles) {
  var _a, _b, _c, _d, _e, _f, _g, _h;
  const safeFiles =
    (_e =
      (_b =
        (_a = next.estimatedReduction) === null || _a === void 0
          ? void 0
          : _a.files) !== null && _b !== void 0
        ? _b
        : (_d =
              (_c = next.tiers) === null || _c === void 0
                ? void 0
                : _c.safeNow) === null || _d === void 0
          ? void 0
          : _d.files) !== null && _e !== void 0
      ? _e
      : 0;
  const projectedTotal =
    (_f = next.projectedInventory) === null || _f === void 0
      ? void 0
      : _f.totalFiles;
  if (
    auditFiles != null &&
    ((_h =
      (_g = next.inventory) === null || _g === void 0
        ? void 0
        : _g.totalFiles) !== null && _h !== void 0
      ? _h
      : 0) >
      auditFiles * 2
  ) {
    if (safeFiles > 0 && projectedTotal != null) {
      return `After phase 1: ~${formatNumber(projectedTotal)} files — inventory total still includes un-walked regenerable shells.`;
    }
    return "Projected file count unchanged until phase 1 identifies safe-delete bytes.";
  }
  return undefined;
}
/**
 * Normalize duplicate group for brief.
 * @param {any} group
 * @returns {any}
 */
export function normalizeDuplicateGroupForBrief(group) {
  var _a;
  if (!group || typeof group !== "object") return null;
  let keeper =
    group.keeper ||
    group.path ||
    (Array.isArray(group.paths) && group.paths[0]) ||
    null;
  let duplicates = (
    ((_a = group.duplicates) === null || _a === void 0 ? void 0 : _a.length)
      ? group.duplicates
      : Array.isArray(group.paths) && group.paths.length > 1
        ? group.paths.slice(1)
        : []
  ).filter(Boolean);
  if (
    keeper &&
    !String(keeper).includes("/") &&
    duplicates.some((d) => String(d).includes("/"))
  ) {
    const nested = duplicates.find((d) => String(d).includes("/"));
    if (nested) {
      duplicates = [keeper, ...duplicates.filter((d) => d !== nested)];
      keeper = nested;
    }
  }
  const reclaimableBytes = group.reclaimableBytes || 0;
  if (!keeper && !duplicates.length && !reclaimableBytes) return null;
  const normalized = {
    keeper,
    duplicates: duplicates.slice(0, 12),
    duplicateCount: duplicates.length,
    reclaimableBytes,
  };
  if (!duplicates.length && reclaimableBytes > 0) {
    normalized.pathsOmitted = true;
    normalized.note =
      "Compact scan omitted duplicate paths — re-run file reduction or use full cleanup export for keeper/duplicate paths.";
  }
  return normalized;
}
/**
 * Duplicate stats from brief.
 * @param {any} brief
 * @returns {any}
 */
function duplicateStatsFromBrief(brief) {
  var _a, _b, _c, _d;
  const fr =
    (_a = brief.scanAnalysis) === null || _a === void 0
      ? void 0
      : _a.fileReduction;
  const table = (fr === null || fr === void 0 ? void 0 : fr.summaryTable) || [];
  const dupRow = table.find((row) =>
    /duplicate assets/i.test(String(row.category || "")),
  );
  return {
    reclaimableBytes:
      (_c =
        (_b =
          fr === null || fr === void 0 ? void 0 : fr.duplicateAssetBytes) !==
          null && _b !== void 0
          ? _b
          : dupRow === null || dupRow === void 0
            ? void 0
            : dupRow.bytes) !== null && _c !== void 0
        ? _c
        : null,
    duplicateFiles:
      (_d = dupRow === null || dupRow === void 0 ? void 0 : dupRow.files) !==
        null && _d !== void 0
        ? _d
        : null,
  };
}
/**
 * Prune duplicate assets for export.
 * @param {Array} groups
 * @param {any} brief
 * @returns {any}
 */
function pruneDuplicateAssetsForExport(groups = [], brief) {
  const normalized = groups
    .map(normalizeDuplicateGroupForBrief)
    .filter(Boolean);
  const withPaths = normalized.filter((g) => {
    var _a;
    return (
      ((_a = g.duplicates) === null || _a === void 0 ? void 0 : _a.length) >
        0 && g.keeper
    );
  });
  if (withPaths.length) {
    return {
      duplicateAssets: withPaths.slice(0, 8),
      duplicateAssetsSummary: null,
    };
  }
  const stats = duplicateStatsFromBrief(brief);
  if (!stats.reclaimableBytes && !normalized.length) {
    return { duplicateAssets: [], duplicateAssetsSummary: null };
  }
  return {
    duplicateAssets: [],
    duplicateAssetsSummary: {
      reclaimableBytes: stats.reclaimableBytes,
      duplicateFiles: stats.duplicateFiles,
      topGroupCount: normalized.length,
      pathsOmitted: true,
      note: "Duplicate savings are totals-only in this export — compact file-reduction payload omitted per-group paths. Re-run file reduction before agent consolidation.",
    },
  };
}
/**
 * Replace misleading brief notes.
 * @param {Array} notes
 * @param {any} benchmarkScan
 * @returns {any}
 */
function replaceMisleadingBriefNotes(notes = [], benchmarkScan) {
  const filtered = notes.filter((note) => {
    if (!benchmarkScan) return true;
    return !/exclude(s)?\s+github-cache/i.test(String(note));
  });
  if (benchmarkScan) {
    filtered.unshift(
      "Scan target is an OSS clone under github-cache/ — not Simplebeacon product code. Simplebeacon platform protected paths do not apply.",
    );
  }
  return [...new Set(filtered)].slice(0, 10);
}
/**
 * Build benchmark agent prompt.
 * @param {any} brief
 * @returns {any}
 */
function buildBenchmarkAgentPrompt(brief) {
  const { projectPath } = brief;
  const inventory = brief.inventory || {};
  const estimatedReduction = brief.estimatedReduction || {};
  const dup = estimatedReduction.phase2DuplicateBytes;
  const dupFiles = estimatedReduction.phase2DuplicateFiles;
  return [
    `Proceed in agent mode using the attached cleanup brief for: ${projectPath}`,
    "",
    "Scope: OSS benchmark clone under github-cache/ — hygiene comparison only, not Simplebeacon platform cleanup or deploy handoff.",
    "",
    "Deletion policy:",
    `- Phase 1 (safeNow): ${formatNumber(estimatedReduction.files)} files, ${formatBytes(estimatedReduction.bytes)} — no auto-safe directories in this clone.`,
    dup
      ? `- Phase 2 (optional duplicate consolidation): ~${formatNumber(dupFiles)} files, ${formatBytes(dup)} — verify keeper paths; do not bulk-delete without paths in the brief.`
      : "- Phase 2: no duplicate consolidation totals in this export.",
    `- Protected on this clone: ${brief.policy.protectedPaths.join(", ")}`,
    "- Do not bulk-delete unused-file candidates without verifying imports.",
    "",
    // simplebeacon:production-leak-intent: template-sample - Cleanup brief inventory summary
    `Inventory: ${formatNumber(inventory.totalFiles)} files / ${formatNumber(inventory.totalFolders)} folders`,
    "",
    // simplebeacon:production-leak-intent: web-data-sample - Cleanup brief product path exclusion notice
    "Do not apply Simplebeacon product paths (web/data, data-central) — they are not part of this OSS tree.",
    "For platform cleanup, re-run Complete scan on the ai-platform root and export a new brief.",
  ].join("\n");
}
/**
 * Build benchmark agent instructions.
 * @param {any} brief
 * @returns {any}
 */
function buildBenchmarkAgentInstructions(brief) {
  var _a;
  const dup =
    (_a = brief.estimatedReduction) === null || _a === void 0
      ? void 0
      : _a.phase2DuplicateBytes;
  return [
    "OSS benchmark clone under github-cache/ — optional hygiene only; not valid for Simplebeacon platform agent cleanup handoff.",
    "Phase 1 (safeNow): no regenerable build-artifact directories were classified safe-to-delete in this clone.",
    dup
      ? `Phase 2 (optional): duplicate asset consolidation may reclaim ~${formatBytes(dup)} — require keeper/duplicate paths in the brief before deleting.`
      : "Phase 2: duplicate consolidation paths were omitted from compact scan data — re-run file reduction for actionable groups.",
    `Never delete: ${brief.policy.protectedPaths.join(", ")}.`,
    "Do not bulk-delete unused file candidates — static analysis only.",
    "Ignore Simplebeacon product protected paths listed in policy.productProtectedPathsAdvisory (not present in OSS clone).",
  ];
}
/**
 * Resolve artifact profile for export.
 * @param {Array} scanAnalysis
 * @param {Array} tiers
 * @param {any} estimatedReduction
 * @returns {any}
 */
function resolveArtifactProfileForExport(
  scanAnalysis = {},
  tiers = {},
  estimatedReduction = {},
) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  const profile = scanAnalysis.artifactProfile || "mixed";
  const fr = scanAnalysis.fileReduction || {};
  const investigate =
    (_c =
      (_b =
        (_a = tiers.investigate) === null || _a === void 0
          ? void 0
          : _a.files) !== null && _b !== void 0
        ? _b
        : fr.unusedFileCandidates) !== null && _c !== void 0
      ? _c
      : 0;
  const dupBytes =
    (_e =
      (_d = fr.duplicateAssetBytes) !== null && _d !== void 0
        ? _d
        : fr.immediateSavingsBytes) !== null && _e !== void 0
      ? _e
      : 0;
  const safeFiles =
    (_h =
      (_f = estimatedReduction.files) !== null && _f !== void 0
        ? _f
        : (_g = tiers.safeNow) === null || _g === void 0
          ? void 0
          : _g.files) !== null && _h !== void 0
      ? _h
      : 0;
  const hasFollowUp =
    investigate > 0 ||
    dupBytes > 0 ||
    ((_k =
      (_j = tiers.reviewFirst) === null || _j === void 0
        ? void 0
        : _j.files) !== null && _k !== void 0
      ? _k
      : 0) > 0;
  if (safeFiles > 0) return "mixed-safe-delete-available";
  if (profile === "empty" && hasFollowUp) return "mixed-no-safe-delete";
  if (profile === "empty") return "no-reclaimable-artifacts";
  return profile;
}
/**
 * Resolve cleanup status.
 * @param {any} brief
 * @returns {any}
 */
function resolveCleanupStatus(brief) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k;
  const safeFiles =
    (_e =
      (_b =
        (_a = brief.estimatedReduction) === null || _a === void 0
          ? void 0
          : _a.files) !== null && _b !== void 0
        ? _b
        : (_d =
              (_c = brief.tiers) === null || _c === void 0
                ? void 0
                : _c.safeNow) === null || _d === void 0
          ? void 0
          : _d.files) !== null && _e !== void 0
      ? _e
      : 0;
  const dupBytes =
    (_g =
      (_f = brief.estimatedReduction) === null || _f === void 0
        ? void 0
        : _f.phase2DuplicateBytes) !== null && _g !== void 0
      ? _g
      : 0;
  const investigate =
    (_k =
      (_j =
        (_h = brief.tiers) === null || _h === void 0
          ? void 0
          : _h.investigate) === null || _j === void 0
        ? void 0
        : _j.files) !== null && _k !== void 0
      ? _k
      : 0;
  if (brief.benchmarkScan) return "benchmark-hygiene";
  if (safeFiles > 0) return "safe-delete-available";
  if (dupBytes > 0 || investigate > 0)
    return "review-and-optional-consolidation";
  return "no-immediate-safe-delete";
}
const STALE_NO_SAFE_DELETE_NOTE =
  /No regenerable build-artifact directories are currently classified safe-to-delete/i;
/**
 * Resolve file reduction workspace files.
 * @param {any} brief
 * @param {Object} options
 * @returns {any}
 */
function resolveFileReductionWorkspaceFiles(brief, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g;
  return (_g =
    (_d =
      (_c =
        (_b =
          (_a = options.fileReductionReport) === null || _a === void 0
            ? void 0
            : _a.inventory) === null || _b === void 0
          ? void 0
          : _b.totalFiles) !== null && _c !== void 0
        ? _c
        : options.fileReductionInventoryFiles) !== null && _d !== void 0
      ? _d
      : (_f =
            (_e = brief.scanAnalysis) === null || _e === void 0
              ? void 0
              : _e.fileReduction) === null || _f === void 0
        ? void 0
        : _f.workspaceFilesScanned) !== null && _g !== void 0
    ? _g
    : null;
}
/**
 * Count data quality open findings.
 * @param {any} dataQuality
 * @returns {any}
 */
function countDataQualityOpenFindings(dataQuality = {}) {
  var _a, _b, _c, _d, _e, _f;
  return (
    ((_a = dataQuality.unusedDependencies) !== null && _a !== void 0 ? _a : 0) +
    ((_b = dataQuality.envInconsistencies) !== null && _b !== void 0 ? _b : 0) +
    ((_c = dataQuality.missingEnvKeys) !== null && _c !== void 0 ? _c : 0) +
    ((_d = dataQuality.shapeDriftGroups) !== null && _d !== void 0 ? _d : 0) +
    ((_e = dataQuality.credentialsNeedingReview) !== null && _e !== void 0
      ? _e
      : 0) +
    ((_f = dataQuality.piiNeedingReview) !== null && _f !== void 0 ? _f : 0)
  );
}
/**
 * Resolve gate inventory context.
 * @param {any} brief
 * @param {Object} options
 * @returns {any}
 */
function resolveGateInventoryContext(brief, options = {}) {
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
    _11,
    _12,
    _13,
    _14,
    _15,
    _16;
  const gateReport = options.gateReport || {};
  const repositoryFilesTotal =
    (_j =
      (_g =
        (_e =
          (_c =
            (_b =
              (_a = options.repositoryFilesTotal) !== null && _a !== void 0
                ? _a
                : options.auditRepositoryFiles) !== null && _b !== void 0
              ? _b
              : gateReport.repositoryFilesTotal) !== null && _c !== void 0
            ? _c
            : (_d = gateReport.repositoryInventory) === null || _d === void 0
              ? void 0
              : _d.totalFiles) !== null && _e !== void 0
          ? _e
          : (_f = brief.inventory) === null || _f === void 0
            ? void 0
            : _f.auditRepositoryFiles) !== null && _g !== void 0
        ? _g
        : (_h = brief.hygieneSummary) === null || _h === void 0
          ? void 0
          : _h.gateRepositoryFilesTotal) !== null && _j !== void 0
      ? _j
      : null;
  const credentialScanned =
    (_q =
      (_o =
        (_l =
          (_k = gateReport.credentialScanned) !== null && _k !== void 0
            ? _k
            : gateReport.productionLeakScanned) !== null && _l !== void 0
          ? _l
          : (_m = gateReport.scanScope) === null || _m === void 0
            ? void 0
            : _m.productionDirsScanned) !== null && _o !== void 0
        ? _o
        : (_p = brief.hygieneSummary) === null || _p === void 0
          ? void 0
          : _p.credentialScanned) !== null && _q !== void 0
      ? _q
      : null;
  const contentScanned =
    (_z =
      (_x =
        (_w =
          (_t =
            (_s =
              (_r = gateReport.scanScope) === null || _r === void 0
                ? void 0
                : _r.fullDirectoryStats) === null || _s === void 0
              ? void 0
              : _s.contentScanned) !== null && _t !== void 0
            ? _t
            : (_v =
                  (_u = gateReport.scanScope) === null || _u === void 0
                    ? void 0
                    : _u.fullDirectoryStats) === null || _v === void 0
              ? void 0
              : _v.filesContentScanned) !== null && _w !== void 0
          ? _w
          : gateReport.credentialScanned) !== null && _x !== void 0
        ? _x
        : (_y = brief.hygieneSummary) === null || _y === void 0
          ? void 0
          : _y.contentFilesScanned) !== null && _z !== void 0
      ? _z
      : null;
  const gateProfile =
    (_5 =
      (_3 =
        (_1 =
          (_0 = gateReport.scanScope) === null || _0 === void 0
            ? void 0
            : _0.profile) !== null && _1 !== void 0
          ? _1
          : (_2 = brief.scanScope) === null || _2 === void 0
            ? void 0
            : _2.gateRuleBundleProfile) !== null && _3 !== void 0
        ? _3
        : (_4 = brief.hygieneSummary) === null || _4 === void 0
          ? void 0
          : _4.gateRuleBundleProfile) !== null && _5 !== void 0
      ? _5
      : null;
  return {
    gateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned:
      (_10 =
        (_8 =
          (_6 = gateReport.fictionJsonFilesScanned) !== null && _6 !== void 0
            ? _6
            : (_7 = gateReport.scanScope) === null || _7 === void 0
              ? void 0
              : _7.fictionJsonFilesScanned) !== null && _8 !== void 0
          ? _8
          : (_9 = brief.hygieneSummary) === null || _9 === void 0
            ? void 0
            : _9.fictionJsonFilesScanned) !== null && _10 !== void 0
        ? _10
        : null,
    fictionSampleFilesScanned:
      (_16 =
        (_14 =
          (_12 =
            (_11 = gateReport.fictionSampleFilesScanned) !== null &&
            _11 !== void 0
              ? _11
              : gateReport.mockSampleFiles) !== null && _12 !== void 0
            ? _12
            : (_13 = gateReport.scanScope) === null || _13 === void 0
              ? void 0
              : _13.fictionSampleFilesScanned) !== null && _14 !== void 0
          ? _14
          : (_15 = brief.hygieneSummary) === null || _15 === void 0
            ? void 0
            : _15.fictionSampleFilesScanned) !== null && _16 !== void 0
        ? _16
        : null,
  };
}
/**
 * Build cleanup brief hygiene summary.
 * @param {any} brief
 * @param {Object} options
 * @returns {any}
 */
function buildCleanupBriefHygieneSummary(brief, options = {}) {
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
    _u;
  const gateContext = resolveGateInventoryContext(brief, options);
  const {
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    gateReport,
  } = gateContext;
  const frWorkspace = resolveFileReductionWorkspaceFiles(brief, options);
  const dq =
    ((_a = brief.scanAnalysis) === null || _a === void 0
      ? void 0
      : _a.dataQuality) || {};
  return {
    cleanupStatus: resolveCleanupStatus(brief),
    explorerInventoryFiles:
      (_c =
        (_b = brief.inventory) === null || _b === void 0
          ? void 0
          : _b.totalFiles) !== null && _c !== void 0
        ? _c
        : null,
    ...(repositoryFilesTotal != null
      ? { gateRepositoryFilesTotal: repositoryFilesTotal }
      : {}),
    ...(frWorkspace != null
      ? { fileReductionWorkspaceFiles: frWorkspace }
      : {}),
    phase1SafeDeleteFiles:
      (_h =
        (_e =
          (_d = brief.estimatedReduction) === null || _d === void 0
            ? void 0
            : _d.files) !== null && _e !== void 0
          ? _e
          : (_g =
                (_f = brief.tiers) === null || _f === void 0
                  ? void 0
                  : _f.safeNow) === null || _g === void 0
            ? void 0
            : _g.files) !== null && _h !== void 0
        ? _h
        : 0,
    phase1SafeDeleteBytes:
      (_o =
        (_k =
          (_j = brief.estimatedReduction) === null || _j === void 0
            ? void 0
            : _j.bytes) !== null && _k !== void 0
          ? _k
          : (_m =
                (_l = brief.tiers) === null || _l === void 0
                  ? void 0
                  : _l.safeNow) === null || _m === void 0
            ? void 0
            : _m.bytes) !== null && _o !== void 0
        ? _o
        : 0,
    phase2DuplicateBytes:
      (_q =
        (_p = brief.estimatedReduction) === null || _p === void 0
          ? void 0
          : _p.phase2DuplicateBytes) !== null && _q !== void 0
        ? _q
        : 0,
    investigateFiles:
      (_t =
        (_s =
          (_r = brief.tiers) === null || _r === void 0
            ? void 0
            : _r.investigate) === null || _s === void 0
          ? void 0
          : _s.files) !== null && _t !== void 0
        ? _t
        : 0,
    dataQualityOpenFindings: countDataQualityOpenFindings(dq),
    ...(credentialScanned != null ? { credentialScanned } : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    ...(repositoryFilesTotal != null &&
    contentScanned != null &&
    repositoryFilesTotal > contentScanned
      ? { gateMetadataOnlyFiles: repositoryFilesTotal - contentScanned }
      : {}),
    ...(gateContext.fictionJsonFilesScanned != null
      ? { fictionJsonFilesScanned: gateContext.fictionJsonFilesScanned }
      : {}),
    ...(gateContext.fictionSampleFilesScanned != null
      ? { fictionSampleFilesScanned: gateContext.fictionSampleFilesScanned }
      : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(gateReport.jestBaselineChecked === false ||
    ((_u = brief.hygieneSummary) === null || _u === void 0
      ? void 0
      : _u.jestBaselineChecked) === false
      ? { jestBaselineChecked: false }
      : {}),
    attestationNote:
      "Cleanup brief hygiene — agent deletion guidance only, not gate pass or vendor handoff certification.",
  };
}
/**
 * Build cleanup brief scan scope.
 * @param {any} brief
 * @param {Object} options
 * @returns {any}
 */
function buildCleanupBriefScanScope(brief, options = {}) {
  var _a, _b, _c;
  const gateContext = resolveGateInventoryContext(brief, options);
  const { repositoryFilesTotal, gateProfile } = gateContext;
  const explorerFiles =
    (_b =
      (_a = brief.inventory) === null || _a === void 0
        ? void 0
        : _a.totalFiles) !== null && _b !== void 0
      ? _b
      : null;
  const frWorkspace = resolveFileReductionWorkspaceFiles(brief, options);
  const monorepoShells =
    repositoryFilesTotal != null &&
    explorerFiles != null &&
    explorerFiles > repositoryFilesTotal * 2;
  return {
    inventoryScope:
      ((_c = brief.inventory) === null || _c === void 0
        ? void 0
        : _c.inventoryScope) || "platform-product",
    ...(monorepoShells
      ? { explorerInventoryProfile: "monorepo-root-with-shells" }
      : {}),
    ...(frWorkspace != null
      ? { fileReductionWorkspaceFiles: frWorkspace }
      : {}),
    ...(repositoryFilesTotal != null
      ? { gateRepositoryFilesTotal: repositoryFilesTotal }
      : {}),
    sourceScans: brief.sourceScans || {},
    resultsViewScope: "platform-only",
    securityHandoffEligible: false,
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
  };
}
/**
 * Build product export notes.
 * @param {any} brief
 * @param {Object} options
 * @returns {any}
 */
function buildProductExportNotes(brief, options = {}) {
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
  const notes = [
    "securityHandoffEligible is false — cleanup brief is agent guidance only, not vendor security handoff.",
    "Absolute scan paths are redacted to project label in operator exports.",
  ];
  if (
    (_a = brief.inventory) === null || _a === void 0 ? void 0 : _a.inventoryNote
  ) {
    notes.push(String(brief.inventory.inventoryNote));
  }
  const frWorkspace = resolveFileReductionWorkspaceFiles(brief, options);
  const explorerFiles =
    (_b = brief.inventory) === null || _b === void 0 ? void 0 : _b.totalFiles;
  if (
    frWorkspace != null &&
    explorerFiles != null &&
    explorerFiles > frWorkspace * 1.5
  ) {
    notes.push(
      `File-reduction workspace walk counted ${formatNumber(frWorkspace)} files — repository inventory (${formatNumber(explorerFiles)} paths) includes un-walked regenerable shells.`,
    );
  }
  const gateContext = resolveGateInventoryContext(brief, options);
  const {
    repositoryFilesTotal,
    credentialScanned,
    gateProfile,
    gateReport,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
  } = gateContext;
  if (
    repositoryFilesTotal != null &&
    credentialScanned != null &&
    credentialScanned < repositoryFilesTotal
  ) {
    notes.push(
      `CRED/LEAK rules scanned ${formatNumber(credentialScanned)} production-path file(s) — ${formatNumber(repositoryFilesTotal - credentialScanned)} metadata-only path(s) in gate inventory of ${formatNumber(repositoryFilesTotal)}.`,
    );
  }
  if (
    fictionJsonFilesScanned != null &&
    fictionSampleFilesScanned != null &&
    fictionJsonFilesScanned > fictionSampleFilesScanned
  ) {
    notes.push(
      // simplebeacon:production-leak-intent: template-sample - legitimate KPI reference for cleanup brief reporting
      `DATA-002 evaluated ${formatNumber(fictionJsonFilesScanned)} repository JSON path(s) — ${formatNumber(fictionSampleFilesScanned)} *-sample.json KPI file(s) matched in paired gate scan.`,
    );
  }
  if (gateProfile) {
    notes.push(
      `Gate rule bundle profile: ${gateProfile} — pair cleanup brief with json/simplebeacon-gate.json for handoff evidence.`,
    );
  }
  if (gateReport.jestBaselineChecked === false) {
    notes.push(
      "Jest was not run during the paired gate scan — use `npm run simplebeacon:full` or `npm test` before treating unused-file static analysis as complete.",
    );
  }
  const cleanupStatus = resolveCleanupStatus(brief);
  if (cleanupStatus === "no-immediate-safe-delete") {
    notes.push(
      "No phase-1 safe deletes under current policy — review data-quality actions in json/data-quality.json before optional duplicate consolidation.",
    );
  } else if (cleanupStatus === "review-and-optional-consolidation") {
    notes.push(
      "Phase 1 has no safe deletes — optional phase 2 duplicate consolidation or investigate-tier follow-ups only.",
    );
  }
  const dqOpen = countDataQualityOpenFindings(
    ((_c = brief.scanAnalysis) === null || _c === void 0
      ? void 0
      : _c.dataQuality) || {},
  );
  if (
    ((_d = brief.sourceScans) === null || _d === void 0
      ? void 0
      : _d.dataQualityPresent) &&
    dqOpen === 0
  ) {
    notes.push(
      "Data-quality scan reported zero open workspace findings — no dependency, env, or credential follow-ups in this export.",
    );
  }
  const fr =
    ((_e = brief.scanAnalysis) === null || _e === void 0
      ? void 0
      : _e.fileReduction) || {};
  const skipped = fr.skippedArtifactDirectories || [];
  const safeFiles =
    (_k =
      (_g =
        (_f = brief.estimatedReduction) === null || _f === void 0
          ? void 0
          : _f.files) !== null && _g !== void 0
        ? _g
        : (_j =
              (_h = brief.tiers) === null || _h === void 0
                ? void 0
                : _h.safeNow) === null || _j === void 0
          ? void 0
          : _j.files) !== null && _k !== void 0
      ? _k
      : 0;
  const safeBytes =
    (_q =
      (_m =
        (_l = brief.estimatedReduction) === null || _l === void 0
          ? void 0
          : _l.bytes) !== null && _m !== void 0
        ? _m
        : (_p =
              (_o = brief.tiers) === null || _o === void 0
                ? void 0
                : _o.safeNow) === null || _p === void 0
          ? void 0
          : _p.bytes) !== null && _q !== void 0
      ? _q
      : 0;
  if (skipped.length) {
    notes.push(
      `${skipped.length} regenerable directory shell(s) (e.g. node_modules, coverage) appear in tier lists with 0 B walked — inventory file count may still include them.`,
    );
  }
  if (cleanupStatus === "safe-delete-available" && safeFiles > 0) {
    notes.push(
      `Phase 1 safe-to-delete: ${formatNumber(safeFiles)} files (${formatBytes(safeBytes)}) in regenerable artifact directories — restore with npm install / rebuild after delete.`,
    );
  } else if (
    String(
      ((_r = brief.scanAnalysis) === null || _r === void 0
        ? void 0
        : _r.artifactProfile) || "",
    ).startsWith("mixed") &&
    cleanupStatus !== "safe-delete-available"
  ) {
    notes.push(
      "No regenerable build-artifact directories are currently classified safe-to-delete — follow data-quality actions and optional phase 2.",
    );
  }
  if (
    ((_t =
      (_s = brief.tiers) === null || _s === void 0
        ? void 0
        : _s.investigate) === null || _t === void 0
      ? void 0
      : _t.files) > 0
  ) {
    notes.push(
      `${brief.tiers.investigate.files} unused-file candidates require import verification — not safe to bulk-delete.`,
    );
  }
  if (
    ((_u = brief.estimatedReduction) === null || _u === void 0
      ? void 0
      : _u.phase2DuplicateBytes) > 0 &&
    ((_v = brief.duplicateAssets) === null || _v === void 0
      ? void 0
      : _v.length)
  ) {
    notes.push(
      `Phase 2 duplicate consolidation may reclaim ${formatBytes(brief.estimatedReduction.phase2DuplicateBytes)} — use listed keeper/duplicate paths only.`,
    );
  }
  const deduped = [...new Set(notes)].slice(0, 10);
  if (cleanupStatus === "safe-delete-available") {
    return deduped.filter(
      (note) => !STALE_NO_SAFE_DELETE_NOTE.test(String(note)),
    );
  }
  return deduped;
}
/**
 * Enrich product agent prompt.
 * @param {any} brief
 * @returns {any}
 */
function enrichProductAgentPrompt(brief) {
  var _a, _b, _c, _d, _e;
  const { projectPath, tiers } = brief;
  const estimatedReduction = brief.estimatedReduction || {};
  const inventory = brief.inventory || {};
  const projectedInventory = brief.projectedInventory || inventory;
  const policy = brief.policy || { protectedPaths: [] };
  const protectedPaths = policy.protectedPaths || [];
  const investigate =
    (_b =
      (_a = tiers === null || tiers === void 0 ? void 0 : tiers.investigate) ===
        null || _a === void 0
        ? void 0
        : _a.files) !== null && _b !== void 0
      ? _b
      : 0;
  const dupBytes =
    (_c = estimatedReduction.phase2DuplicateBytes) !== null && _c !== void 0
      ? _c
      : 0;
  const dupFiles =
    (_d = estimatedReduction.phase2DuplicateFiles) !== null && _d !== void 0
      ? _d
      : 0;
  const safeFiles =
    (_e = estimatedReduction.files) !== null && _e !== void 0 ? _e : 0;
  const lines = [
    `Proceed in agent mode using the attached cleanup brief for: ${projectPath}`,
    "",
    "Deletion policy:",
    `- Safe to delete now (phase 1): ${formatNumber(safeFiles)} files, ${formatBytes(estimatedReduction.bytes)}.`,
    `- Protected (never delete): ${protectedPaths.join(", ")}`,
    "- Review first: logs, scan cache, and anything flagged reviewFirst in the brief",
    "- Do not bulk-delete unused-file candidates without verifying imports",
  ];
  if (investigate > 0) {
    lines.push(
      `- Investigate only (not auto-delete): ${formatNumber(investigate)} unused-file candidates — static analysis`,
    );
  }
  if (dupBytes > 0) {
    lines.push(
      `- Phase 2 optional: consolidate ~${formatNumber(dupFiles)} duplicate file(s), ${formatBytes(dupBytes)} — paths listed in duplicateAssets`,
    );
  }
  lines.push(
    "",
    `Inventory: ${formatNumber(inventory.totalFiles)} files / ${formatNumber(inventory.totalFolders)} folders (may include un-walked node_modules shells)`,
    `Projected after phase 1: ~${formatNumber(projectedInventory.totalFiles)} files`,
    "",
    safeFiles > 0 || dupBytes > 0
      ? "Attach the exported cleanup-brief JSON. Execute phase 1 only unless I authorize phase 2 or investigate deletions."
      : "Attach the exported cleanup-brief JSON. Phase 1 has no safe deletes — address data-quality actions; run phase 2 only if duplicate paths are listed.",
  );
  return lines.join("\n");
}
/**
 * Enrich product agent instructions.
 * @param {any} brief
 * @returns {any}
 */
function enrichProductAgentInstructions(brief) {
  var _a, _b, _c, _d, _e, _f, _g;
  const policy = brief.policy || {
    protectedPaths: [],
    allowNodeModules: false,
    allowSimplebeaconCache: false,
  };
  const protectedPaths = policy.protectedPaths || [];
  const investigate =
    (_c =
      (_b =
        (_a = brief.tiers) === null || _a === void 0
          ? void 0
          : _a.investigate) === null || _b === void 0
        ? void 0
        : _b.files) !== null && _c !== void 0
      ? _c
      : 0;
  const dupBytes =
    (_e =
      (_d = brief.estimatedReduction) === null || _d === void 0
        ? void 0
        : _d.phase2DuplicateBytes) !== null && _e !== void 0
      ? _e
      : 0;
  const lines = [
    "Execute cleanup in phases: (1) safeNow directories, (2) duplicate asset consolidation, (3) reviewFirst items only after confirmation.",
    `Never delete paths under protected list: ${protectedPaths.join(", ")}.`,
    "Do not bulk-delete unused file candidates — they require static/dynamic import verification.",
  ];
  if (investigate > 0) {
    lines.push(
      `${investigate} unused-file candidates are investigate-only — verify imports before any deletion.`,
    );
  }
  if (dupBytes > 0) {
    lines.push(
      `Phase 2 may reclaim ~${formatBytes(dupBytes)} from duplicate assets when keeper paths are confirmed.`,
    );
  }
  lines.push(
    policy.allowNodeModules
      ? "node_modules may be removed and restored with npm install."
      : "Do not delete node_modules unless the user explicitly enables it.",
    policy.allowSimplebeaconCache
      ? ".simplebeacon scan artifacts may be trimmed or archived."
      : "Keep .simplebeacon scan artifacts unless the user opts in.",
    `Phase 1 target reduction: ~${formatNumber((_f = brief.estimatedReduction) === null || _f === void 0 ? void 0 : _f.files)} files (${formatBytes((_g = brief.estimatedReduction) === null || _g === void 0 ? void 0 : _g.bytes)}).`,
  );
  return lines;
}
/**
 * Sanitize cleanup brief export.
 * @param {any} brief
 * @param {Object} options
 * @returns {any}
 */
export function sanitizeCleanupBriefExport(brief, options = {}) {
  var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
  if (!brief || brief.type !== "simplebeacon-cleanup-brief") return brief;
  const projectPath = brief.projectPath || "";
  const auditFiles =
    (_b =
      (_a = options.repositoryFilesTotal) !== null && _a !== void 0
        ? _a
        : options.auditRepositoryFiles) !== null && _b !== void 0
      ? _b
      : null;
  const benchmarkScan = isBenchmarkCacheProjectPath(projectPath);
  const productPlatformRoot = benchmarkScan
    ? resolveProductPlatformRoot(projectPath)
    : null;
  const dupStats = duplicateStatsFromBrief(brief);
  const pruned = pruneDuplicateAssetsForExport(
    brief.duplicateAssets || [],
    brief,
  );
  let next = {
    ...brief,
    duplicateAssets: pruned.duplicateAssets,
    ...(pruned.duplicateAssetsSummary
      ? { duplicateAssetsSummary: pruned.duplicateAssetsSummary }
      : {}),
    estimatedReduction: {
      ...(brief.estimatedReduction || {}),
      phase2DuplicateBytes: dupStats.reclaimableBytes,
      phase2DuplicateFiles: dupStats.duplicateFiles,
    },
    tiers: {
      ...(brief.tiers || {}),
      duplicateConsolidation: dupStats.reclaimableBytes
        ? {
            bytes: dupStats.reclaimableBytes,
            files: dupStats.duplicateFiles,
            note:
              ((_c = pruned.duplicateAssetsSummary) === null || _c === void 0
                ? void 0
                : _c.note) ||
              "Manual review — consolidate only when keeper and duplicate paths are listed.",
          }
        : null,
    },
  };
  if (next.scanAnalysis) {
    const notes = replaceMisleadingBriefNotes(
      next.scanAnalysis.notes,
      benchmarkScan,
    );
    next.scanAnalysis = {
      ...next.scanAnalysis,
      notes,
      ...(benchmarkScan
        ? {
            scanTargetProfile: "benchmark-cache",
            artifactProfile:
              next.scanAnalysis.artifactProfile === "empty"
                ? "oss-clone-hygiene"
                : next.scanAnalysis.artifactProfile,
          }
        : {}),
    };
  }
  if (!benchmarkScan) {
    const artifactProfile = resolveArtifactProfileForExport(
      next.scanAnalysis || {},
      next.tiers || {},
      next.estimatedReduction || {},
    );
    const exportNotes = buildProductExportNotes(
      {
        ...next,
        inventory: {
          ...(next.inventory || {}),
          inventoryScope: "platform-product",
          ...(auditFiles != null &&
          ((_e =
            (_d = next.inventory) === null || _d === void 0
              ? void 0
              : _d.totalFiles) !== null && _e !== void 0
            ? _e
            : 0) >
            auditFiles * 2
            ? {
                auditRepositoryFiles: auditFiles,
                inventoryNote: `Cleanup inventory (${Number(next.inventory.totalFiles).toLocaleString()} files) includes un-walked regenerable shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`,
              }
            : ((_f = next.inventory) === null || _f === void 0
                  ? void 0
                  : _f.totalFiles) > 5000
              ? {
                  inventoryNote:
                    "File count may include node_modules and other shells not size-walked for safe deletion.",
                }
              : {}),
        },
      },
      options,
    );
    const projectedNote = resolveProjectedInventoryNote(next, auditFiles);
    const { projectPath: redactedProjectPath } =
      resolveRedactedBriefProjectPath(next, options);
    const frWorkspace = resolveFileReductionWorkspaceFiles(next, options);
    const briefForExport = { ...next, projectPath: redactedProjectPath };
    const hygieneSummary = buildCleanupBriefHygieneSummary(
      briefForExport,
      options,
    );
    const scanScope = buildCleanupBriefScanScope(briefForExport, options);
    return {
      ...briefForExport,
      exportNormalized: true,
      exportSanitized: true,
      scanTargetProfile: "product",
      cleanupStatus: resolveCleanupStatus(next),
      agentBriefReady: Boolean(
        ((_g = next.sourceScans) === null || _g === void 0
          ? void 0
          : _g.fileReductionPresent) ||
        ((_h = next.sourceScans) === null || _h === void 0
          ? void 0
          : _h.dataQualityPresent),
      ),
      securityHandoffEligible: false,
      handoffEligible: false,
      hygieneSummary,
      scanScope,
      inventory: {
        ...(briefForExport.inventory || next.inventory || {}),
        inventoryScope: "platform-product",
        ...(auditFiles != null &&
        ((_k =
          (_j = next.inventory) === null || _j === void 0
            ? void 0
            : _j.totalFiles) !== null && _k !== void 0
          ? _k
          : 0) >
          auditFiles * 2
          ? {
              auditRepositoryFiles: auditFiles,
              inventoryNote: `Cleanup inventory (${Number(next.inventory.totalFiles).toLocaleString()} files) includes un-walked regenerable shells; gate audit profile counted ${Number(auditFiles).toLocaleString()} files.`,
            }
          : ((_l = next.inventory) === null || _l === void 0
                ? void 0
                : _l.totalFiles) > 5000
            ? {
                inventoryNote:
                  "File count may include node_modules and other shells not size-walked for safe deletion.",
              }
            : {}),
      },
      projectedInventory: {
        ...(next.projectedInventory || {}),
        ...(projectedNote ? { projectedNote } : {}),
      },
      agentPrompt: enrichProductAgentPrompt(briefForExport),
      agentInstructions: enrichProductAgentInstructions(briefForExport),
      exportNotes,
      scanAnalysis: next.scanAnalysis
        ? {
            ...next.scanAnalysis,
            projectPath: redactedProjectPath,
            artifactProfile,
            ...(frWorkspace != null && next.scanAnalysis.fileReduction
              ? {
                  fileReduction: {
                    ...next.scanAnalysis.fileReduction,
                    workspaceFilesScanned: frWorkspace,
                  },
                }
              : {}),
            artifactProfileNote:
              artifactProfile === "mixed-safe-delete-available"
                ? "Phase 1 lists regenerable artifact directories safe to delete under current policy."
                : artifactProfile === "empty" ||
                    artifactProfile === "no-reclaimable-artifacts"
                  ? "No safe-to-delete build artifacts — see investigate tier and data-quality actions."
                  : undefined,
          }
        : next.scanAnalysis,
    };
  }
  const priorPolicy = brief.policy || {};
  const { projectPath: redactedClonePath } = resolveRedactedBriefProjectPath(
    next,
    options,
  );
  const redactedPlatformRoot = productPlatformRoot
    ? redactProjectPathForExport(
        productPlatformRoot,
        projectLabelFromPath(productPlatformRoot),
      )
    : undefined;
  return {
    ...next,
    projectPath: redactedClonePath,
    scanTargetProfile: "benchmark-cache",
    handoffEligible: false,
    benchmarkScan: true,
    exportNormalized: true,
    exportSanitized: true,
    productPlatformRoot: redactedPlatformRoot || undefined,
    policy: {
      ...priorPolicy,
      protectedPaths: BENCHMARK_PROTECTED_PATHS,
      productProtectedPathsAdvisory: priorPolicy.protectedPaths || [],
      policyScopeNote:
        "Protected paths adjusted for OSS clone under github-cache/ — Simplebeacon platform data directories do not exist in this tree.",
    },
    inventory: {
      ...(next.inventory || {}),
      inventoryScope: "oss-clone",
    },
    scanAnalysis: next.scanAnalysis
      ? { ...next.scanAnalysis, projectPath: redactedClonePath }
      : next.scanAnalysis,
    agentPrompt: buildBenchmarkAgentPrompt({
      ...next,
      projectPath: redactedClonePath,
    }),
    agentInstructions: buildBenchmarkAgentInstructions(next),
    exportNotes: [
      ...(next.exportNotes || []),
      "Benchmark clone brief — phase 1 safeNow reflects product-tier policy on OSS tree; duplicate totals are informational unless paths are listed.",
    ].filter((note, index, all) => all.indexOf(note) === index),
  };
}
