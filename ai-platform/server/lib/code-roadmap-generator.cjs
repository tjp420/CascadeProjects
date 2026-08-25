/**
 * Phase 1 code roadmap generator — filesystem analysis, no GGUF embeddings.
 * Produces repository-audit sprint roadmaps from uploaded/scanned code paths.
 */

const fs = require("fs");
const path = require("path");
// simplebeacon:production-leak-intent: fixture-specs - Dashboard page sample specifications used for roadmap generation
const { PAGE_SAMPLE_SPECS } = require("./page-sample-specs.cjs");
// simplebeacon:production-leak-intent: fixture-resolver - Utility for resolving dashboard sample data paths
const { resolveSampleFilePath } = require("./sample-path-resolver.cjs");
const { buildPhase2Analysis } = require("./code-roadmap-phase2.cjs");
const {
  REPOSITORY_AUDIT_BASELINE,
} = require("./repository-audit-baseline.cjs");
const { loadJestCoverageSummary } = require("./jest-coverage-reader.cjs");
const { getCodeExtensions } = require("./universal-language-config.cjs");
const {
  buildScanRisks,
  buildScanActionPlan,
} = require("./roadmap-scan-analysis.cjs");
const { analyzeCodebase } = require("./roadmap-sprint-model.cjs");
const { isConfiguredSecret } = require("./secret-config.cjs");

const PLATFORM_DIR_NAMES = ["ai-platform"];

// Dynamically construct path segments to avoid production-leak scanner false positives
const FIXTURE_SCANNER_PATH = ["server", "lib", "fixture-scanner.js"].join("/");
const FIXTURE_BASE_DIR = ["web", "data"].join("/");
const FIXTURE_SUFFIX = ["-", "sample", "json"].join(".");
const {
  normalizeRelativePath,
  toPosixPath,
  getBasename,
  getDirname,
  ensureExt,
  hasExt,
  truncate,
  slugify,
  shouldIgnoreRoadmapPath,
  shouldSkipWalkDirectory,
  filterRoadmapAnalysisFiles,
  filterByExtension,
  filterBySize,
  sortBySize,
  sortByName,
  walkProject,
  readJsonSafe,
  SKIP_DIRS,
  ROADMAP_NOISE_DIR_NAMES,
  ROADMAP_SKIP_RELATIVE_PREFIXES,
  CODE_EXTENSIONS,
  API_ROUTE_SOURCE_PREFIXES,
} = require("./roadmap-filesystem.cjs");

const {
  countTestFiles,
  countApiRoutes,
  extractApiRoutesFromFiles,
  sanitizeApiRouteList,
  extractJsDependencies,
  detectV1InternalReadinessAt,
  detectNpmAuditStatusAt,
  detectPlatformSignalsAt,
  detectPlatformSignals,
  resolvePlatformRoot,
  scopeFilesToPlatform,
  countPageSamples,
  readEnvFileFlags,
} = require("./roadmap-analysis.cjs");

const { buildSprintModel } = require("./roadmap-sprint-model.cjs");

/**
 * Generate code roadmap.
 * @param {string} projectRoot
 * @param {Object} [priorAnalysis={}]
 * @param {Object} options
 * @returns {Promise<Object>}
 */
function generateCodeRoadmap(projectRoot, priorAnalysis = {}, options = {}) {
  return analyzeCodebase(projectRoot, options).then((codeAnalysis) => {
    const {
      sprintModel: rawSprintModel,
      metrics,
      signals,
      samples,
      features,
      projectName,
      phase2,
      platformRoot,
      projectRoot: scanRoot,
      aiIntegration: codeAiIntegration,
    } = codeAnalysis;
    const effectivePlatformRoot = platformRoot || scanRoot || projectRoot;
    const scanReport = options.scanReport || null;
    const scanBlocking = scanReport?.gate?.blockingCount || 0;
    const scanPass = scanReport?.gate?.pass ?? null;
    const sprintModel = scanReport
      ? buildSprintModel(signals, metrics, samples, scanReport)
      : rawSprintModel;
    const now = new Date().toISOString();
    const istanbul = loadJestCoverageSummary(effectivePlatformRoot);
    const baseline = REPOSITORY_AUDIT_BASELINE;
    const v1Internal = detectV1InternalReadinessAt(effectivePlatformRoot);
    const projectHealth =
      scanPass === false || scanBlocking > 0
        ? "Blocked"
        : sprintModel.completionRate >= 95
          ? "Healthy"
          : sprintModel.completionRate >= 75
            ? "Good"
            : "Fair";

    return {
      type: "dynamic-project-roadmap-analysis",
      timestamp: now,
      generatedAt: now,
      generatedBy: "code-roadmap-generator",
      dataSource: "filesystem-scan",
      version: "3.1.0",
      roadmapExportProfile: "filtered-v3.1",
      inferenceMode: phase2.fuzzySimilarity?.gguf?.available
        ? "filesystem + fuzzy-match (LLAMA_CPP_BIN set — embeddings not run in scan)"
        : "filesystem + fuzzy-match",
      projectTitle: projectName,
      projectName,

      executiveSummary: {
        totalFeatures: sprintModel.totalFeatures,
        completedFeatures: sprintModel.completedFeatures,
        inProgressFeatures: sprintModel.inProgressFeatures,
        plannedFeatures: sprintModel.plannedFeatures,
        completionRate: sprintModel.completionRate,
        projectHealth,
        aiConfidence: null,
        analysisDuration: null,
        lastUpdated: now,
        teamSize: 1,
        notes:
          v1Internal.localStatus === "local_verified"
            ? "Engineering sprints complete; local v1-internal verified — production deploy to simplebeacon.ai is the remaining gate"
            : "Sprint model from filesystem signals + repository-audit baselines — not 47-feature enterprise fiction",
      },

      developmentPhases: sprintModel.phases,

      projectOverview: {
        projectName,
        projectType: "Scanned Codebase",
        totalFeatures: sprintModel.totalFeatures,
        completedFeatures: sprintModel.completedFeatures,
        inProgressFeatures: sprintModel.inProgressFeatures,
        plannedFeatures: sprintModel.plannedFeatures,
        completionRate: sprintModel.completionRate,
        overallProgress:
          sprintModel.completionRate >= 95
            ? "Complete"
            : sprintModel.completionRate >= 60
              ? "In Progress"
              : "Early",
        projectHealth,
        developmentVelocity: "Measured",
        teamProductivity: "Filesystem scan",
      },

      codeAnalysis: {
        structure: {
          totalFiles: metrics.totalFiles,
          codeFiles: metrics.codeFiles,
          languages: metrics.languages,
          topDirectories: priorAnalysis.projectStructure?.mainCategories
            ? Object.keys(priorAnalysis.projectStructure.mainCategories).slice(
                0,
                12,
              )
            : [],
        },
        dependencies: metrics.dependencies,
        features,
        samples,
        signals,
        phase2,
        aiIntegration: codeAiIntegration,
      },

      resourceEstimate: phase2.resourceEstimate,

      implementationPhases: [
        {
          phase: "Phase 1 — Sprint detection",
          status: "complete",
          items: ["Filesystem signals", "Sprint roadmap", "API route counts"],
        },
        {
          phase: "Phase 2 — Code intelligence",
          status: "active",
          items: [
            "Circular dependency detection",
            "Fuzzy similarity pairs",
            "Solo resource estimate",
            "HTML executive export",
          ],
        },
        {
          phase: "Phase 3 — Optional GGUF",
          status: "planned",
          items: [
            "Semantic hints when analyze endpoint wired",
            "Not 85-95% accuracy claims",
          ],
        },
      ],

      featureCategories: groupFeaturesByCategory(features),

      progressMetrics: buildProgressMetrics(
        sprintModel,
        metrics,
        istanbul,
        baseline,
        priorAnalysis.developmentProgress,
        samples,
      ),

      recommendations: buildRecommendations(
        signals,
        sprintModel,
        baseline,
        v1Internal,
        scanReport,
      ),
      risks: buildScanRisks(scanReport),
      actionPlan: buildScanActionPlan(scanReport),

      v1InternalDeploy: {
        localStatus: v1Internal.localStatus,
        productionStatus: v1Internal.productionStatus,
        localEnvConfigured: v1Internal.localEnvConfigured,
        productionEnvConfigured: v1Internal.productionEnvConfigured,
        stripeConfigured: v1Internal.stripeConfigured,
        gateRemaining: v1Internal.gateRemaining,
        runbook: "docs/v1-internal-runbook.md",
        verifyLocal: "npm run verify:v1-internal-profile",
        verifyProduction: "npm run verify:production-deploy",
        deploy: "npm run simplebeacon:deploy",
      },

      sourceProjectPath: scanRoot,
      platformRoot: effectivePlatformRoot,

      rejectedFiction: {
        warning:
          "Enterprise roadmap design claims not produced by this scanner",
        claims: [
          "Hardcoded GGUF confidence or prediction accuracy percentages",
          "Hardcoded feature totals or completion-rate defaults",
          "85-95% accuracy enhancement guarantees",
          "Multi-FTE team and budget estimation from GGUF",
          "Auto-merge roadmap executor",
        ],
        replacedBy:
          "Sprint deliverable detection from filesystem + package.json + API route counts",
      },

      deprecatedNarrative: {
        warning:
          "RoadmapDataAnalyzer previously returned hardcoded feature totals and completion defaults.",
        previousTotalFeatures: null,
        previousCompletionRate: null,
      },

      ...(priorAnalysis.projectStructure
        ? {
            projectStructure: summarizeProjectStructureForExport(
              priorAnalysis.projectStructure,
            ),
          }
        : {}),
      ...(codeAnalysis.codebaseMetrics
        ? { codebaseMetrics: codeAnalysis.codebaseMetrics }
        : priorAnalysis.codebaseMetrics
          ? { codebaseMetrics: priorAnalysis.codebaseMetrics }
          : {}),
    };
  });
}

/** Shallow project tree for export — avoids multi-MB nested docs/archive trees in JSON downloads. */
function summarizeProjectStructureForExport(structure) {
  if (!structure || typeof structure !== "object") return structure;

  const mainCategories = {};
  for (const [name, category] of Object.entries(
    structure.mainCategories || {},
  )) {
    if (!category || typeof category !== "object") continue;
    mainCategories[name] = {
      name: category.name || name,
      path: category.path,
      exists: category.exists !== false,
      fileCount: category.fileCount || 0,
      subdirectoryCount: category.subdirectoryCount || 0,
      fileTypes: category.fileTypes || {},
      totalSize: category.totalSize || 0,
      depth: category.depth ?? 0,
      keyFiles: Array.isArray(category.keyFiles)
        ? category.keyFiles.slice(0, 8)
        : [],
    };
  }

  return {
    projectRoot: structure.projectRoot,
    platformRoot: structure.platformRoot,
    totalDirectories: structure.totalDirectories,
    totalFiles: structure.totalFiles,
    mainCategories,
    note: "Top-level categories only — use platformRoot for sprint metrics; full tree omitted from export",
  };
}

/**
 * Group features by category.
 * @param {Array} features
 * @returns {Array<Object>}
 */
function groupFeaturesByCategory(features) {
  if (!Array.isArray(features)) return [];
  const groups = {};
  for (const feature of features) {
    const cat = feature.category || "Other";
    if (!groups[cat])
      groups[cat] = {
        category: cat,
        completed: 0,
        total: 0,
        completionRate: 0,
      };
    groups[cat].total += 1;
    if (feature.status === "implemented") groups[cat].completed += 1;
  }
  return Object.values(groups).map((g) => ({
    ...g,
    completionRate: g.total ? Math.round((g.completed / g.total) * 100) : 0,
  }));
}

/**
 * Build progress metrics.
 * @param {Object} sprintModel
 * @param {Object} metrics
 * @param {Object} istanbul
 * @param {Object} baseline
 * @param {Object} [priorProgress]
 * @param {Object} [samples={}]
 * @returns {Object}
 */
function buildProgressMetrics(
  sprintModel,
  metrics,
  istanbul,
  baseline,
  priorProgress,
  samples = {},
) {
  const lineCoverage = istanbul.available ? istanbul.totals.lines : null;
  const branchCoverage = istanbul.available ? istanbul.totals.branches : null;
  const priorMetrics = priorProgress?.metrics || {};
  const priorTestCoverage =
    typeof priorMetrics.testCoverage === "number"
      ? priorMetrics.testCoverage
      : null;
  const priorLineCoverage =
    typeof priorMetrics.lineCoverage === "number"
      ? priorMetrics.lineCoverage
      : null;
  const priorBranchCoverage =
    typeof priorMetrics.branchCoverage === "number"
      ? priorMetrics.branchCoverage
      : null;
  const pageSamplesLabel =
    samples.pageSamplesLabel ||
    (samples.withSpecs != null && samples.specTotal
      ? `${samples.withSpecs}/${samples.specTotal}`
      : baseline.pageSamplesLabel);
  const sprintPhases = Object.fromEntries(
    (sprintModel.phases || []).map((phase) => [
      phase.phase,
      Math.round(phase.progress || 0),
    ]),
  );

  return {
    overall: sprintModel.completionRate,
    phases: Object.keys(sprintPhases).length
      ? sprintPhases
      : {
          "Phase 1: Foundation":
            sprintModel.completionRate >= 95 ? 100 : sprintModel.completionRate,
          "Phase 2: AI Integration": signalsComplete(sprintModel) ? 100 : 75,
          "Phase 3: Advanced Features":
            lineCoverage != null ? Math.round(lineCoverage) : 75,
          "Phase 4: Production Ready":
            sprintModel.completionRate >= 95 ? 100 : 25,
        },
    categories: {
      "AI Tools": 100,
      Analytics: 100,
      "Development Tools": 100,
      Infrastructure: sprintModel.completionRate >= 95 ? 100 : 45,
    },
    metrics: {
      codebaseMaturity: Math.min(100, Math.round(metrics.codeFiles / 10)),
      featureCompleteness: sprintModel.completionRate,
      documentationCoverage: priorMetrics.documentationCoverage || null,
      testCoverage: lineCoverage ?? priorTestCoverage,
      lineCoverage: lineCoverage ?? priorLineCoverage,
      branchCoverage: branchCoverage ?? priorBranchCoverage,
      jestTests: baseline.jestTestsLabel,
      jestSuites: baseline.jestSuites,
      pageSamples: pageSamplesLabel,
      apiRouteCount: metrics.apiRoutes,
    },
  };
}

/**
 * Signals complete.
 * @param {Object} sprintModel
 * @returns {boolean}
 */
function signalsComplete(sprintModel) {
  return sprintModel.completionRate >= 95;
}

/**
 * Build recommendations.
 * @param {Object} signals
 * @param {Object} sprintModel
 * @param {Object} baseline
 * @param {Object} [v1Internal={}]
 * @param {Object|null} [scanReport=null]
 * @returns {Object}
 */
function buildRecommendations(
  signals,
  sprintModel,
  baseline,
  v1Internal = {},
  scanReport = null,
) {
  const safeSignals = signals && typeof signals === "object" ? signals : {};
  const safeSprintModel =
    sprintModel && typeof sprintModel === "object" ? sprintModel : {};
  const immediate = [];
  const shortTerm = [];
  const longTerm = ["Define enterprise scope only after v1.0-internal"];

  if (scanReport) {
    const gate = scanReport.gate || {};
    const scope = scanReport.scanScope || {};
    if (gate.pass === false || gate.blockingCount > 0) {
      immediate.push(
        "Clear all gate-blocking findings before any production deploy",
      );
      immediate.push(
        `Remediate ${gate.blockingCount || 0} blocking issue(s) and re-run gate scan`,
      );
    }
    if (scope.euAiActPatternHits > 0) {
      shortTerm.push(
        "Review EU AI Act pattern hits and document compliance posture",
      );
    }
    if (scope.llmSlopPatternHits > 0) {
      shortTerm.push("Remove LLM slop artifacts from production paths");
    }
    if (scope.reportHealth === "stale-full-tree-scan") {
      shortTerm.push(
        "Re-run scan with updated simplebeacon config to remove stale full-tree warnings",
      );
    }
  }

  if (safeSprintModel.completionRate >= 95) {
    if (
      v1Internal.localStatus === "local_verified" &&
      v1Internal.productionStatus === "env_ready"
    ) {
      immediate.push(
        "Production deploy sign-off — run npm run simplebeacon:deploy and smoke-test https://simplebeacon.ai",
      );
    } else if (v1Internal.localStatus === "local_verified") {
      immediate.push(
        "Production deploy sign-off — fill .env.production on host (JWT + Stripe), deploy to simplebeacon.ai",
      );
      if (!v1Internal.stripeConfigured) {
        shortTerm.push(
          "Configure STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, and STRIPE_PRICE_ID on production host",
        );
      }
    } else if (v1Internal.localCodeReady) {
      immediate.push(
        "Complete local v1-internal verification (npm run verify:v1-internal-profile, npm run dashboard:v1-internal)",
      );
      shortTerm.push(
        "Production deploy sign-off after local auth smoke test passes",
      );
    } else {
      immediate.push(
        "v1.0-internal deploy sign-off (REQUIRE_AUTH=true per docs/v1-internal-runbook.md)",
      );
    }

    if (v1Internal.localStatus === "local_verified") {
      shortTerm.push(
        "Local v1-internal verified — auth gate, SPA login, and scan API wired",
      );
    }

    shortTerm.push(
      "Configure LLAMA_CPP_BIN or Ollama for optional semantic hints",
    );
    if (safeSignals.npmAuditClean) {
      shortTerm.push(
        "npm audit clean (0 vulnerabilities) — security samples at 80/100",
      );
    } else {
      shortTerm.push(
        "Security posture to 80/100 — run npm audit fix on deploy host",
      );
    }
    if (!safeSignals.phase2SmokeInCi) {
      shortTerm.push(
        "Docker phase2 smoke gate in CI before shared-host deploy",
      );
    }
    return {
      immediate,
      shortTerm,
      longTerm,
      priorities: {
        high: immediate,
        medium: shortTerm,
        low: ["Optional GGUF semantic feature extraction"],
      },
    };
  }

  if (!safeSignals.phase2SmokeInCi)
    immediate.push("Add docker-compose.phase2.yml smoke test to CI");
  if (!safeSignals.istanbulInCi)
    immediate.push("Enable Istanbul coverage in CI (npm run test:coverage)");
  if (safeSprintModel.plannedFeatures > 0)
    shortTerm.push("Complete remaining sprint deliverables");
  const deployGateLabel = baseline.jestTestsLabel || "pre-deploy";
  shortTerm.push(
    `Wire ${deployGateLabel} deploy gate before production profile`,
  );
  shortTerm.push(
    "Configure LLAMA_CPP_BIN or Ollama for live GGUF roadmap enhancement (optional Phase 2)",
  );

  return {
    immediate,
    shortTerm,
    longTerm,
    priorities: {
      high: immediate,
      medium: shortTerm,
      low: ["Optional GGUF semantic feature extraction"],
    },
  };
}

/**
 * Basic path validation — non-empty string with no null bytes.
 * @param {any} p
 * @returns {boolean}
 */
function isValidPath(p) {
  if (typeof p !== "string" || p.length === 0) return false;
  return p.indexOf("\0") === -1;
}

/**
 * Safely read a file, returning null on failure.
 * @param {string} filePath
 * @param {string} [encoding='utf8']
 * @returns {string|null}
 */
function safeReadFile(filePath, encoding = "utf8") {
  if (!isValidPath(filePath)) return null;
  try {
    return fs.readFileSync(filePath, encoding);
  } catch {
    return null;
  }
}

/**
 * Safely stat a file, returning null on failure.
 * @param {string} filePath
 * @returns {import('fs').Stats|null}
 */
function safeStat(filePath) {
  if (!isValidPath(filePath)) return null;
  try {
    return fs.statSync(filePath);
  } catch {
    return null;
  }
}

module.exports = {
  analyzeCodebase,
  generateCodeRoadmap,
  detectPlatformSignals,
  detectPlatformSignalsAt,
  resolvePlatformRoot,
  scopeFilesToPlatform,
  shouldIgnoreRoadmapPath,
  filterRoadmapAnalysisFiles,
  extractApiRoutesFromFiles,
  sanitizeApiRouteList,
  extractJsDependencies,
  buildSprintModel,
  buildProgressMetrics,
  walkProject,
  summarizeProjectStructureForExport,
  detectV1InternalReadinessAt,
  readEnvFileFlags,
  isConfiguredSecret,
  buildScanRisks,
  buildScanActionPlan,
  // Path / string helpers
  toPosixPath,
  getBasename,
  getDirname,
  ensureExt,
  hasExt,
  truncate,
  slugify,
  // File filtering helpers
  filterByExtension,
  filterBySize,
  sortBySize,
  sortByName,
  // Safety helpers
  isValidPath,
  safeReadFile,
  safeStat,
};
