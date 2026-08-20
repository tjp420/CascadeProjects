const fs = require("fs");
const path = require("path");
const {
  resolvePlatformRoot,
  detectPlatformSignalsAt,
  countPageSamples,
  extractJsDependencies,
  extractApiRoutesFromFiles,
  countTestFiles,
} = require("./roadmap-analysis.cjs");
const {
  walkProject,
  filterRoadmapAnalysisFiles,
  readJsonSafe,
  CODE_EXTENSIONS,
} = require("./roadmap-filesystem.cjs");
const {
  REPOSITORY_AUDIT_BASELINE,
} = require("./repository-audit-baseline.cjs");
const { buildPhase2Analysis } = require("./code-roadmap-phase2.cjs");

/**
 * Build sprint model.
 * @param {Object} signals
 * @param {Object} metrics
 * @param {Object} samples
 * @param {Object|null} [scanReport=null]
 * @returns {Object}
 */
function buildSprintModel(signals, metrics, samples, scanReport = null) {
  const safeSignals = signals && typeof signals === "object" ? signals : {};
  const safeMetrics = metrics && typeof metrics === "object" ? metrics : {};
  const safeSamples = samples && typeof samples === "object" ? samples : {};
  const scanBlocking = scanReport?.gate?.blockingCount || 0;
  const scanPass = scanReport?.gate?.pass ?? null;
  const hygieneSprint =
    scanPass === false || scanBlocking > 0
      ? [
          {
            id: "sprint-0",
            phase: "Sprint 0: Hygiene & Compliance",
            deliverables: [],
            weight: 3,
          },
        ]
      : [];
  const sprints = [
    ...hygieneSprint,
    {
      id: "sprint-1",
      phase: "Sprint 1: Server & Auth",
      deliverables: ["serverEntry", "phase2Auth"],
      weight: 2,
    },
    {
      id: "sprint-2",
      phase: "Sprint 2: Stub APIs & Tests",
      deliverables: ["stubApi", "buildFromPath"],
      weight: 2,
      testSignal: safeMetrics.testFiles,
    },
    {
      id: "sprint-3",
      phase: "Sprint 3: Honest Dashboard Data",
      deliverables: [
        "fixtureScanner",
        "npmAudit",
        "fileMergerScanner",
        "codeRoadmapGenerator",
      ],
      weight: 4,
      sampleTarget: safeSamples.specTotal || safeSamples.onDisk,
    },
    {
      id: "sprint-4",
      phase: "Sprint 4: Production Profile",
      deliverables: [
        "dockerPhase2",
        "githubCi",
        "istanbulInCi",
        "phase2SmokeInCi",
      ],
      weight: 4,
    },
  ];

  let completedWeight = 0;
  let totalWeight = 0;
  const phases = [];

  for (const sprint of sprints) {
    totalWeight += sprint.weight;
    const checks = sprint.deliverables.map((key) => Boolean(safeSignals[key]));
    let progress = checks.filter(Boolean).length / Math.max(checks.length, 1);

    if (sprint.id === "sprint-2" && safeMetrics.jestTestsPassing > 0) {
      progress = Math.max(progress, 1);
    }
    if (
      sprint.id === "sprint-3" &&
      safeSamples.withSpecs > 0 &&
      safeSamples.specTotal
    ) {
      progress = Math.max(
        progress,
        safeSamples.withSpecs / safeSamples.specTotal,
      );
    }
    if (sprint.id === "sprint-4" && safeSignals.githubCi) {
      progress = Math.max(progress, 0.5);
      if (safeSignals.phase2SmokeInCi && safeSignals.istanbulInCi) progress = 1;
    }

    progress = Math.round(progress * 100);
    if (progress >= 100) completedWeight += sprint.weight;
    else if (progress >= 50) completedWeight += sprint.weight * 0.5;

    let status = "planned";
    if (progress >= 100) status = "completed";
    else if (progress > 0) status = "in-progress";
    if (sprint.id === "sprint-0" && (scanPass === false || scanBlocking > 0)) {
      status = "in-progress";
      progress = 0;
    }

    phases.push({
      phase: sprint.phase,
      status,
      progress,
      description: sprintDeliverableDescription(
        sprint.id,
        safeSignals,
        safeSamples,
        safeMetrics,
      ),
      features: sprintFeatureList(
        sprint.id,
        safeSignals,
        safeSamples,
        safeMetrics,
      ),
      milestones: sprintMilestones(sprint.id, safeSignals, safeMetrics),
    });
  }

  const overallPct = Math.round((completedWeight / totalWeight) * 100);
  const completed = phases.filter((p) => p.status === "completed").length;
  const inProgress = phases.filter((p) => p.status === "in-progress").length;
  const planned = phases.filter((p) => p.status === "planned").length;

  return {
    phases,
    totalFeatures: sprints.length,
    completedFeatures: completed,
    inProgressFeatures: inProgress,
    plannedFeatures: planned,
    completionRate: overallPct,
  };
}

/**
 * Sprint deliverable description.
 * @param {string} sprintId
 * @param {Object} signals
 * @param {Object} samples
 * @param {Object} metrics
 * @returns {string}
 */
function sprintDeliverableDescription(sprintId, signals, samples, metrics) {
  if (sprintId === "sprint-1")
    return "Canonical server entry and optional JWT auth";
  if (sprintId === "sprint-2") {
    return `Stub API routes (${metrics.apiRoutes} detected) and ${metrics.jestTestsLabel} Jest tests (${metrics.jestSuites} suites)`;
  }
  if (sprintId === "sprint-3") {
    // simplebeacon:production-leak-intent: sprint-desc - References page sample counts for roadmap generation
    return `${samples.withSpecs}/${samples.specTotal || samples.onDisk} page samples with repository-audit analyzers`;
  }
  return "Docker Phase2, CI smoke test, Istanbul coverage, production profile";
}

/**
 * Sprint feature list.
 * @param {string} sprintId
 * @param {Object} signals
 * @param {Object} samples
 * @param {Object} metrics
 * @returns {Array<string>}
 */
function sprintFeatureList(sprintId, signals, samples, metrics) {
  if (sprintId === "sprint-1") {
    return [
      signals.serverEntry ? "Root server delegate" : "Server entry pending",
      signals.phase2Auth ? "Phase 2 JWT auth" : "Auth pending",
    ];
  }
  if (sprintId === "sprint-2") {
    return [
      signals.stubApi ? "Tier-1 stub API routes" : "Stub API pending",
      metrics.jestTestsPassing
        ? `${metrics.jestTestsLabel} Jest tests (${metrics.jestSuites} suites)`
        : "Tests pending",
    ];
  }
  if (sprintId === "sprint-3") {
    return [
      `${samples.withSpecs}/${samples.specTotal || "?"} PAGE_SAMPLE_SPECS samples`,
      signals.npmAudit
        ? "SEC-004 npm audit wired to Security page"
        : "npm audit pending",
      signals.fixtureScanner
        ? "Mock-data scanner with schema validation"
        : "Mock scanner pending",
      signals.fileMergerScanner
        ? "File merger reduction scanner"
        : "Merger scanner pending",
    ];
  }
  return [
    signals.dockerPhase2
      ? "docker-compose.phase2.yml present"
      : "Docker compose pending",
    signals.istanbulInCi ? "Istanbul collected in CI" : "Istanbul pending",
    "GGUF inference (LLAMA_CPP_BIN/Ollama) — optional",
    signals.phase2Auth
      ? "REQUIRE_AUTH production profile ready"
      : "REQUIRE_AUTH production profile",
  ];
}

/**
 * Sprint milestones.
 * @param {string} sprintId
 * @param {Object} signals
 * @param {Object} metrics
 * @returns {Array<string>}
 */
function sprintMilestones(sprintId, signals, metrics) {
  if (sprintId === "sprint-1")
    return ["Single server entry", "Auth routes live"];
  if (sprintId === "sprint-2")
    return [
      "dashboard-stub-api.js",
      metrics.jestTestsLabel || `${metrics.testFiles} tests`,
    ];
  if (sprintId === "sprint-3")
    return ["Repository-audit samples", "Mock-data + merger scanners"];
  return ["phase2-smoke CI job", "Production runbook"];
}

/**
 * Analyze codebase.
 * @param {string} projectRoot
 * @param {Object} options
 * @returns {Promise<Object>}
 */
async function analyzeCodebase(projectRoot, options = {}) {
  const { scanRoot, platformRoot } = resolvePlatformRoot(projectRoot);
  const walkRoot = platformRoot;
  const walkOptions = {
    projectRoot: walkRoot,
    includePaths: options.includePaths || [],
    excludePatterns: options.excludePatterns || [],
  };

  const files = await walkProject(walkRoot, walkOptions);
  const analysisFiles = filterRoadmapAnalysisFiles(files);
  const pkg =
    readJsonSafe(path.join(platformRoot, "package.json")) ||
    readJsonSafe(path.join(scanRoot, "package.json"));
  const signals = detectPlatformSignalsAt(platformRoot);
  const samples = countPageSamples(platformRoot);
  const dependencies = extractJsDependencies(analysisFiles, platformRoot);
  const apiPaths = extractApiRoutesFromFiles(analysisFiles);
  const baseline = REPOSITORY_AUDIT_BASELINE;
  const testFilesOnDisk = countTestFiles(analysisFiles);

  const codebaseMetrics = computeCodebaseMetrics(analysisFiles);
  const metrics = {
    totalFiles: analysisFiles.length,
    codeFiles: analysisFiles.filter((f) => CODE_EXTENSIONS.has(f.ext)).length,
    testFiles: testFilesOnDisk,
    jestTestsPassing: baseline.jestTestsPassing,
    jestTestsLabel: baseline.jestTestsLabel,
    jestSuites: baseline.jestSuites,
    apiRoutes: apiPaths.length,
    languages: countByExtension(analysisFiles),
    dependencies,
    codebaseMetrics,
  };

  const sprintModel = buildSprintModel(signals, metrics, samples);
  const phase2 = buildPhase2Analysis(analysisFiles, platformRoot, sprintModel);

  return {
    projectRoot: scanRoot,
    platformRoot,
    projectName: pkg?.name || path.basename(platformRoot),
    signals,
    metrics,
    samples,
    sprintModel,
    phase2,
    features: extractDetectedFeatures(signals, metrics, samples),
    codebaseMetrics,
    aiIntegration: {
      apis: apiPaths,
      apiRouteCount: apiPaths.length,
      notes: apiPaths.length
        ? "Routes scraped from server/ and src/ — docs and archive paths excluded"
        : "No route handlers found under server/ or src/",
    },
    filesScanned: analysisFiles.length,
  };
}

/**
 * Count by extension.
 * @param {Array} files
 * @returns {Object<string,number>}
 */
function countByExtension(files) {
  if (!Array.isArray(files)) return {};
  const counts = {};
  for (const file of files) {
    const ext = file.ext || "other";
    counts[ext] = (counts[ext] || 0) + 1;
  }
  return counts;
}

/**
 * Count items by a key extracted from each item.
 * @param {Array} items
 * @param {(item:any)=>string} keyFn
 * @returns {Object<string, number>}
 */
function countByKey(items, keyFn) {
  if (!Array.isArray(items) || typeof keyFn !== "function") return {};
  const counts = {};
  for (const item of items) {
    const key = String(keyFn(item));
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

/**
 * Group items by a key extracted from each item.
 * @param {Array} items
 * @param {(item:any)=>string} keyFn
 * @returns {Map<string, Array>}
 */
function groupByKey(items, keyFn) {
  const map = new Map();
  if (!Array.isArray(items) || typeof keyFn !== "function") return map;
  for (const item of items) {
    const key = String(keyFn(item));
    if (map.has(key)) {
      map.get(key).push(item);
    } else {
      map.set(key, [item]);
    }
  }
  return map;
}

/**
 * Sum numeric values extracted from items.
 * @param {Array} items
 * @param {(item:any)=>number} keyFn
 * @returns {number}
 */
function sumBy(items, keyFn) {
  if (!Array.isArray(items)) return 0;
  let total = 0;
  for (const item of items) {
    const val = typeof keyFn === "function" ? keyFn(item) : item;
    const n = Number(val);
    if (Number.isFinite(n)) total += n;
  }
  return total;
}

/**
 * Arithmetic mean of numeric values extracted from items.
 * @param {Array} items
 * @param {(item:any)=>number} keyFn
 * @returns {number}
 */
function meanBy(items, keyFn) {
  if (!Array.isArray(items) || items.length === 0) return 0;
  return sumBy(items, keyFn) / items.length;
}

/**
 * Return top N items by extracted key.
 * @param {Array} items
 * @param {number} n
 * @param {(item:any)=>number} keyFn
 * @param {'asc'|'desc'} [order='desc']
 * @returns {Array}
 */
function topN(items, n, keyFn, order = "desc") {
  if (
    !Array.isArray(items) ||
    items.length === 0 ||
    typeof keyFn !== "function"
  )
    return [];
  const sorted = [...items].sort((a, b) => {
    const ka = keyFn(a);
    const kb = keyFn(b);
    if (typeof ka === "number" && typeof kb === "number") return ka - kb;
    return String(ka).localeCompare(String(kb));
  });
  if (order === "desc") sorted.reverse();
  const limit = Math.max(0, Math.floor(Number(n) || 0));
  return sorted.slice(0, limit);
}

/**
 * Compute codebase metrics.
 * @param {Array} files
 * @returns {Object}
 */
function computeCodebaseMetrics(files) {
  if (!Array.isArray(files))
    return {
      totalLinesOfCode: 0,
      languages: {},
      testFiles: 0,
      documentation: { readmeFiles: 0, totalDocs: 0, coverage: 0 },
    };
  const CODE_EXTS = new Set([".js", ".cjs", ".mjs", ".ts", ".py", ".sql"]);
  // simplebeacon-ignore data-access-pattern — readFileSync is inside the for/of loop below, not in this filter callback
  const codeFiles = files
    .filter((f) => CODE_EXTS.has(f.ext) && f.size < 300000)
    .slice(0, 200);
  let totalLines = 0;
  const languages = {};
  for (const file of codeFiles) {
    let content;
    try {
      content = fs.readFileSync(file.path, "utf8");
    } catch {
      continue;
    }
    const lines = content.split("\n").length;
    totalLines += lines;
    const ext = file.ext || "other";
    if (!languages[ext]) languages[ext] = { files: 0, lines: 0 };
    languages[ext].files += 1;
    languages[ext].lines += lines;
  }
  const docFiles = files.filter((f) => /\.(md|rst|txt)$/i.test(f.name)).length;
  const testFiles = files.filter((f) =>
    /\.(test|spec)\.(js|ts|jsx|tsx)$/i.test(f.name),
  ).length;
  const total = files.length || 1;
  return {
    totalLinesOfCode: totalLines,
    languages,
    testFiles,
    documentation: {
      readmeFiles: docFiles,
      totalDocs: docFiles,
      coverage: Math.round((docFiles / total) * 100),
    },
  };
}

/**
 * Extract detected features.
 * @param {Object} signals
 * @param {Object} metrics
 * @param {Object} samples
 * @returns {Array<Object>}
 */
function extractDetectedFeatures(signals, metrics, samples) {
  const list = [];
  if (signals.serverEntry)
    list.push({
      name: "Dashboard Server",
      category: "Infrastructure",
      status: "implemented",
    });
  if (signals.phase2Auth)
    list.push({
      name: "Phase 2 JWT Auth",
      category: "Security",
      status: "implemented",
    });
  if (signals.stubApi)
    list.push({
      name: "Dashboard Stub API",
      category: "API",
      status: "implemented",
    });
  if (signals.fixtureScanner)
    list.push({
      name: "Mock Data Scanner",
      category: "Analysis",
      status: "implemented",
    });
  if (signals.npmAudit)
    list.push({
      name: "npm Audit Runner",
      category: "Security",
      status: "implemented",
    });
  if (signals.fileMergerScanner)
    list.push({
      name: "File Merger Scanner",
      category: "Analysis",
      status: "implemented",
    });
  if (signals.codeRoadmapGenerator)
    list.push({
      name: "Code Roadmap Generator",
      category: "Planning",
      status: "implemented",
    });
  if (signals.assessmentApi)
    list.push({
      name: "Assessment API",
      category: "API",
      status: "implemented",
    });
  if (samples.withSpecs)
    list.push({
      name: "Page Sample Baselines",
      category: "Data",
      status: "implemented",
      count: samples.withSpecs,
    });
  if (metrics.jestTestsPassing) {
    list.push({
      name: "Jest Test Suite",
      category: "Testing",
      status: "implemented",
      count: metrics.jestTestsPassing,
      label: metrics.jestTestsLabel,
      suites: metrics.jestSuites,
    });
  } else if (metrics.testFiles) {
    list.push({
      name: "Jest Test Files",
      category: "Testing",
      status: "implemented",
      count: metrics.testFiles,
    });
  }
  if (signals.dockerPhase2)
    list.push({
      name: "Phase2 Docker Compose",
      category: "Infrastructure",
      status: signals.phase2SmokeInCi ? "implemented" : "partial",
    });
  if (signals.githubCi)
    list.push({
      name: "GitHub Actions CI",
      category: "CI",
      status: signals.istanbulInCi ? "implemented" : "partial",
    });
  return list;
}
module.exports = {
  buildSprintModel,
  analyzeCodebase,
};
