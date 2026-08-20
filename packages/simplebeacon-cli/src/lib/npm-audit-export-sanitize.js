/**
 * Normalize npm audit JSON exports — benchmark clones, skipped paths, product handoff labels.
 */

const { isExternalBenchmarkCachePath } = require("./benchmark-cache-paths");
const {
  redactProjectPathForExport,
  projectLabelFromPath,
} = require("./assessment-export-sanitize");

function redactNpmAuditExportPaths(audit, projectPath = "") {
  const raw = String(
    projectPath || audit.projectPath || audit.auditRoot || "",
  ).replace(/\\/g, "/");
  const label = projectLabelFromPath(raw);
  const packageJsonRaw = String(audit.packageJsonPath || "").replace(
    /\\/g,
    "/",
  );
  return {
    projectPath: redactProjectPathForExport(raw, label),
    auditRoot: redactProjectPathForExport(audit.auditRoot || raw, label),
    packageJsonPath:
      packageJsonRaw && /package\.json$/i.test(packageJsonRaw)
        ? `${label}/package.json`
        : audit.packageJsonPath
          ? redactProjectPathForExport(audit.packageJsonPath, label)
          : undefined,
    productPlatformRoot: audit.productPlatformRoot
      ? redactProjectPathForExport(
          audit.productPlatformRoot,
          projectLabelFromPath(audit.productPlatformRoot),
        )
      : undefined,
  };
}

function isBenchmarkCacheProjectPath(projectPath) {
  return isExternalBenchmarkCachePath(
    String(projectPath || "").replace(/\\/g, "/"),
  );
}

function resolveProductPlatformRoot(projectPath) {
  const normalized = String(projectPath || "").replace(/\\/g, "/");
  const idx = normalized.toLowerCase().indexOf("/github-cache/");
  if (idx <= 0) return null;
  return normalized.slice(0, idx);
}

function resolveSupplyChainStatus(audit) {
  if (!audit || audit.error) return "error";
  if (audit.skipped) return "skipped";
  const summary = audit.summary || {};
  const deps = summary.dependencies ?? audit.dependencies?.total ?? null;
  if (deps == null) return "not-applicable";
  const critical = Number(summary.critical) || 0;
  const high = Number(summary.high) || 0;
  if (critical === 0 && high === 0) return "pass";
  return "review";
}

function resolveNpmAuditGateContext(audit, options = {}) {
  const gateReport = options.gateReport || {};
  const hygiene = audit?.hygieneSummary || {};
  const scanScope = audit?.scanScope || {};
  const repositoryFilesTotal =
    options.repositoryFilesTotal ??
    gateReport.repositoryFilesTotal ??
    gateReport.repositoryInventory?.totalFiles ??
    scanScope.gateRepositoryFilesTotal ??
    hygiene.gateRepositoryFilesTotal ??
    null;
  const credentialScanned =
    gateReport.credentialScanned ??
    gateReport.productionLeakScanned ??
    hygiene.contentFilesScanned ??
    null;
  const contentScanned =
    gateReport.scanScope?.fullDirectoryStats?.contentScanned ??
    gateReport.scanScope?.fullDirectoryStats?.filesContentScanned ??
    gateReport.credentialScanned ??
    gateReport.productionLeakScanned ??
    hygiene.contentFilesScanned ??
    null;
  const gateProfile =
    gateReport.scanScope?.profile ??
    scanScope.gateRuleBundleProfile ??
    hygiene.gateRuleBundleProfile ??
    null;
  const fictionJsonFilesScanned =
    gateReport.fictionJsonFilesScanned ??
    gateReport.scanScope?.fictionJsonFilesScanned ??
    hygiene.fictionJsonFilesScanned ??
    null;
  const fictionSampleFilesScanned =
    gateReport.fictionSampleFilesScanned ??
    gateReport.mockSampleFiles ??
    gateReport.scanScope?.fictionSampleFilesScanned ??
    hygiene.fictionSampleFilesScanned ??
    null;
  const gatePass = gateReport.gate?.pass ?? hygiene.gatePass ?? null;
  const blockingCount =
    gateReport.gate?.blockingCount ??
    gateReport.issueCount ??
    hygiene.blockingCount ??
    null;
  return {
    gateReport,
    repositoryFilesTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
    gatePass,
    blockingCount,
  };
}

function buildNpmAuditHygieneSummary(audit, context = {}) {
  const gateContext = resolveNpmAuditGateContext(audit, context);
  const {
    repositoryFilesTotal: gateTotal,
    credentialScanned,
    contentScanned,
    gateProfile,
    gateReport,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
    gatePass,
    blockingCount,
  } = gateContext;
  const summary = audit.summary || {};
  const deps = summary.dependencies ?? audit.dependencies?.total ?? null;
  return {
    dependencyTotal: deps,
    prodDependencies:
      summary.prodDependencies ?? audit.dependencies?.prod ?? null,
    devDependencies: summary.devDependencies ?? audit.dependencies?.dev ?? null,
    optionalDependencies:
      audit.dependencies?.optional ?? summary.optionalDependencies ?? null,
    critical: Number(summary.critical) || 0,
    high: Number(summary.high) || 0,
    moderate: Number(summary.moderate) || 0,
    low: Number(summary.low) || 0,
    supplyChainStatus:
      context.supplyChainStatus ?? resolveSupplyChainStatus(audit),
    auditPackageJson: context.packageJsonPath ?? audit.packageJsonPath ?? null,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateTotal != null &&
    credentialScanned != null &&
    gateTotal > credentialScanned
      ? { gateMetadataOnlyFiles: gateTotal - credentialScanned }
      : {}),
    ...(contentScanned != null ? { contentFilesScanned: contentScanned } : {}),
    ...(fictionJsonFilesScanned != null ? { fictionJsonFilesScanned } : {}),
    ...(fictionSampleFilesScanned != null ? { fictionSampleFilesScanned } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    ...(gatePass != null ? { gatePass } : {}),
    ...(blockingCount != null ? { blockingCount } : {}),
    ...(gateReport.jestBaselineChecked === false ||
    audit.hygieneSummary?.jestBaselineChecked === false
      ? { jestBaselineChecked: false }
      : {}),
    attestationNote:
      "npm audit at product root — SUPPLY-001 hygiene only, not vendor handoff certification.",
  };
}

function buildProductNpmAuditScanScope(audit, options = {}) {
  const gateContext = resolveNpmAuditGateContext(audit, options);
  const { repositoryFilesTotal: gateTotal, gateProfile } = gateContext;
  return {
    ...(audit.scanScope || {}),
    resultsViewScope: "product-root-npm-audit",
    reportHealth: audit.scanScope?.reportHealth || "platform-scoped",
    securityHandoffEligible: false,
    ...(gateTotal != null ? { gateRepositoryFilesTotal: gateTotal } : {}),
    ...(gateProfile ? { gateRuleBundleProfile: gateProfile } : {}),
    supplyChainNote:
      audit.scanScope?.supplyChainNote ||
      "npm audit at product root — SUPPLY-001 hygiene only, not vendor handoff clearance.",
  };
}

function buildNpmAuditExportNotes(audit, context = {}) {
  const {
    benchmarkScan,
    skipped,
    supplyChainStatus,
    deps,
    summary = {},
  } = context;
  const gateContext = resolveNpmAuditGateContext(audit, {
    gateReport: context.gateReport,
    repositoryFilesTotal: context.repositoryFilesTotal,
  });
  const {
    repositoryFilesTotal: gateTotal,
    credentialScanned,
    gateProfile,
    gatePass,
    blockingCount,
    fictionJsonFilesScanned,
    fictionSampleFilesScanned,
  } = gateContext;
  const notes = [
    "Absolute scan paths are redacted to project label in operator exports.",
    "securityHandoffEligible is false — npm audit pass is supply-chain hygiene only, not vendor security handoff.",
  ];

  if (skipped) {
    notes.push(
      context.scopeNote || "npm audit was not run for this scan path.",
    );
    return [...new Set(notes)].slice(0, 6);
  }

  if (supplyChainStatus === "pass" && deps != null) {
    const moderate = Number(summary.moderate) || 0;
    const low = Number(summary.low) || 0;
    notes.push(
      `npm audit: 0 critical, 0 high across ${deps} dependencies (${Number(summary.prodDependencies ?? audit.dependencies?.prod ?? 0)} prod / ${Number(summary.devDependencies ?? audit.dependencies?.dev ?? 0)} dev).`,
    );
    notes.push(
      moderate || low
        ? `${moderate} moderate and ${low} low — review SUPPLY-002 policy before handoff.`
        : "Supply-chain gate: no critical or high npm audit findings at audit root.",
    );
    if (!benchmarkScan && !skipped) {
      notes.push(
        "handoffEligible reflects SUPPLY-001 automation pass — not SimpleBeacon vendor security handoff clearance.",
      );
      notes.push(
        "Single-root npm audit — dependency tree reflects audit-root lockfile and npm workspaces only; standalone nested package.json directories are not included.",
      );
      if (gateTotal != null && deps != null && gateTotal !== deps) {
        notes.push(
          `Gate full-tree inventory is ${Number(gateTotal).toLocaleString()} repository paths — npm audit resolved ${Number(deps).toLocaleString()} lockfile package(s) at product root.`,
        );
      }
      if (
        gateTotal != null &&
        credentialScanned != null &&
        credentialScanned < gateTotal
      ) {
        notes.push(
          `Gate content-scanned ${Number(credentialScanned).toLocaleString()} production-path file(s) — ${Number(gateTotal - credentialScanned).toLocaleString()} binary/metadata-only path(s) in full-tree inventory of ${Number(gateTotal).toLocaleString()}.`,
        );
      }
      if (
        fictionJsonFilesScanned != null &&
        fictionSampleFilesScanned != null
      ) {
        notes.push(
          `Gate fiction KPI rules evaluated ${Number(fictionJsonFilesScanned).toLocaleString()} repository JSON path(s) with ${Number(fictionSampleFilesScanned).toLocaleString()} *-sample.json KPI file(s) matched — npm audit covers lockfile packages only.`,
        );
      }
      if (gateProfile) {
        notes.push(
          `Gate rule bundle profile: ${gateProfile} — pair npm audit with json/simplebeacon-gate.json for handoff evidence.`,
        );
      }
      if (gatePass === false && (blockingCount ?? 0) > 0) {
        notes.push(
          `Gate FAIL — ${Number(blockingCount).toLocaleString()} blocking finding(s) in bundled scan — SUPPLY-001 npm audit pass does not clear production-path gate; see json/simplebeacon-gate.json.`,
        );
      }
      const optional =
        audit.dependencies?.optional ?? summary.optionalDependencies;
      if (optional != null && optional > 0) {
        notes.push(
          `${Number(optional).toLocaleString()} optional dependency package(s) in audit metadata — verify before production deploy if optional peers are enabled.`,
        );
      }
      notes.push(
        "npm audit does not run Jest — use gate/complete scan for test attestation.",
      );
    }
  } else if (supplyChainStatus === "review") {
    notes.push(
      `npm audit: ${summary.critical || 0} critical, ${summary.high || 0} high — upgrade dependencies before client handoff.`,
    );
  } else if (supplyChainStatus === "error") {
    notes.push(
      "npm audit failed or returned an error — re-run at product root before handoff.",
    );
  }

  if (
    audit.scopeNote &&
    !notes.some((n) => String(n).includes(String(audit.scopeNote)))
  ) {
    notes.push(String(audit.scopeNote));
  }

  return [...new Set(notes)].slice(0, 14);
}

/**
 * @param {object} audit
 * @param {string} [projectPath]
 * @param {object} [options]
 */
function sanitizeNpmAuditExport(audit, projectPath = "", options = {}) {
  if (!audit || typeof audit !== "object") return audit;

  const rawPath = String(projectPath || audit.projectPath || "").replace(
    /\\/g,
    "/",
  );
  const paths = redactNpmAuditExportPaths(audit, rawPath);
  const benchmarkScan =
    isBenchmarkCacheProjectPath(rawPath) || Boolean(audit.benchmarkScan);
  const skipped = Boolean(audit.skipped);
  const supplyChainStatus = resolveSupplyChainStatus(audit);
  const summary = { ...(audit.summary || {}) };
  const deps = summary.dependencies ?? audit.dependencies?.total ?? null;

  const next = {
    ...audit,
    type: audit.type || "simplebeacon-npm-audit",
    source: audit.source || audit.dataSource || "npm-audit",
    projectPath: paths.projectPath || audit.projectPath,
    exportNormalized: true,
    exportSanitized: true,
    supplyChainStatus,
    scanTargetProfile: benchmarkScan
      ? "benchmark-cache"
      : skipped
        ? "non-npm-project"
        : "product",
    securityHandoffEligible: false,
    handoffEligible: !benchmarkScan && !skipped && supplyChainStatus === "pass",
  };

  if (!skipped) {
    next.auditRoot = paths.auditRoot || paths.projectPath;
    if (paths.packageJsonPath) {
      next.packageJsonPath = paths.packageJsonPath;
    }
  }

  if (benchmarkScan) {
    next.benchmarkScan = true;
    next.handoffEligible = false;
    next.productPlatformRoot =
      paths.productPlatformRoot ||
      resolveProductPlatformRoot(rawPath) ||
      undefined;
    if (next.productPlatformRoot) {
      next.productPlatformRoot = redactProjectPathForExport(
        next.productPlatformRoot,
        projectLabelFromPath(next.productPlatformRoot),
      );
    }
    if (!next.scopeNote && skipped) {
      next.scopeNote =
        "OSS clone under github-cache/ has no package.json — npm audit was not run (npm would otherwise audit the parent ai-platform lockfile).";
    }
  }

  if (skipped) {
    next.success = audit.success !== false;
    next.summary = {
      info: 0,
      low: 0,
      moderate: 0,
      high: 0,
      critical: 0,
      total: 0,
      vulnerabilityTotal: 0,
      dependencies: null,
      prodDependencies: null,
      devDependencies: null,
      ...summary,
      dependencies: null,
      prodDependencies: null,
      devDependencies: null,
    };
    next.exportNotes = buildNpmAuditExportNotes(audit, {
      benchmarkScan,
      skipped: true,
      supplyChainStatus,
      scopeNote: next.scopeNote,
      gateReport: options.gateReport,
      repositoryFilesTotal: options.repositoryFilesTotal,
    });
    return next;
  }

  const noteContext = {
    benchmarkScan,
    skipped,
    supplyChainStatus,
    deps,
    summary,
    gateReport: options.gateReport,
    repositoryFilesTotal:
      options.repositoryFilesTotal ?? options.gateReport?.repositoryFilesTotal,
  };

  next.exportNotes = buildNpmAuditExportNotes(audit, noteContext);

  if (supplyChainStatus === "review") {
    next.handoffEligible = false;
  }

  if (!benchmarkScan && !skipped) {
    next.scanScope = buildProductNpmAuditScanScope(next, options);
    next.hygieneSummary = buildNpmAuditHygieneSummary(next, {
      supplyChainStatus,
      packageJsonPath: next.packageJsonPath,
      gateReport: options.gateReport,
      repositoryFilesTotal:
        options.repositoryFilesTotal ??
        options.gateReport?.repositoryFilesTotal,
    });
  }

  next.summary = {
    ...summary,
    total: summary.total ?? summary.vulnerabilityTotal ?? 0,
    vulnerabilityTotal: summary.vulnerabilityTotal ?? summary.total ?? 0,
    dependencies: deps,
  };

  return next;
}

module.exports = {
  isBenchmarkCacheProjectPath,
  resolveProductPlatformRoot,
  resolveSupplyChainStatus,
  resolveNpmAuditGateContext,
  buildNpmAuditExportNotes,
  buildNpmAuditHygieneSummary,
  buildProductNpmAuditScanScope,
  sanitizeNpmAuditExport,
};
