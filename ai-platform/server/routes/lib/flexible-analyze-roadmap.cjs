// simplebeacon-ignore workspace-health
const path = require("path");
const fs = require("fs");
const {
  normalizeStringList,
  safeBasename,
} = require("../../lib/flexible-analyze-utils.cjs");
const {
  analyzeStrategicInsights,
} = require("../../lib/strategic-insights-engine.cjs");

// Memory threshold (MB) — abort roadmap scan if heap usage exceeds this to prevent OOM crashes
// on resource-constrained hosting (Render starter = 512MB RAM). V8 default heap limit is ~4GB
// but the container OOM killer fires at the RSS level, so we guard well below 512MB.
// Allow overriding in tests or CI via the `ROADMAP_MEMORY_LIMIT_MB` env var.
const ROADMAP_MEMORY_LIMIT_MB =
  Number(process.env.ROADMAP_MEMORY_LIMIT_MB) || 350;

function checkMemoryLimit() {
  const mem = process.memoryUsage();
  const heapMB = Math.round(mem.heapUsed / 1048576);
  const rssMB = Math.round(mem.rss / 1048576);
  if (rssMB > ROADMAP_MEMORY_LIMIT_MB) {
    throw new Error(
      `Roadmap scan aborted: memory usage (RSS ${rssMB}MB, heap ${heapMB}MB) exceeds limit (${ROADMAP_MEMORY_LIMIT_MB}MB). Use a smaller project path or upgrade server resources.`,
    );
  }
  return { heapMB, rssMB };
}

async function buildRoadmapFromPath(projectPath, options = {}) {
  if (projectPath == null || typeof projectPath !== "string") {
    throw new TypeError("projectPath must be a non-empty string");
  }

  // Pre-flight memory check — abort early if server is already under memory pressure
  checkMemoryLimit();

  const GlobalContextManager = require("../../../src/core/GlobalContextManager.cjs");
  const RoadmapDataAnalyzer = require("../../../src/core/RoadmapDataAnalyzer.cjs");
  const {
    buildHistoryEntryFromRoadmap,
  } = require("../../lib/roadmap-history-metrics.cjs");

  const resolvedPath = path.resolve(projectPath);
  let stat;
  try {
    stat = await fs.promises.stat(resolvedPath);
  } catch (err) {
    throw new Error(`Path does not exist or is inaccessible: ${resolvedPath}`);
  }
  if (!stat.isDirectory()) {
    throw new Error("Path must be an existing directory");
  }

  const includePaths = normalizeStringList(options.includePaths);
  const excludePatterns = normalizeStringList(options.excludePatterns);

  const contextManager = new GlobalContextManager(resolvedPath);
  await contextManager.initialize({ watch: false });

  const analyzer = new RoadmapDataAnalyzer(contextManager, {
    projectRoot: resolvedPath,
    includePaths,
    excludePatterns,
  });
  analyzer.analysisCache.clear();
  analyzer.lastAnalysisTime = null;

  let roadmap;
  try {
    roadmap = await analyzer.analyzeProjectForRoadmap();
  } finally {
    try {
      contextManager.dispose?.();
    } catch {
      /* ignore cleanup errors */
    }
  }
  if (options.title) roadmap.projectTitle = options.title;
  if (options.description) roadmap.projectDescription = options.description;
  roadmap.sourceProjectPath = resolvedPath;
  roadmap.dataSource = "filesystem-scan";
  roadmap.scanOptions = { includePaths, excludePatterns };

  const historyEntry = buildHistoryEntryFromRoadmap(roadmap, {
    projectPath: resolvedPath,
    title: options.title || roadmap.projectTitle || safeBasename(resolvedPath),
    scanOptions: { includePaths, excludePatterns },
  });

  const insightsMode = String(
    options.roadmapInsightsMode || "off",
  ).toLowerCase();
  if (insightsMode !== "off" && insightsMode !== "none") {
    // Memory check before strategic insights (which can allocate significant additional memory)
    checkMemoryLimit();
    const userCredentials = options.userCredentials || null;
    const registry = options.registry || null;
    roadmap.strategicInsights = await analyzeStrategicInsights({
      roadmap,
      mode: insightsMode === "llm" ? "llm" : "deterministic",
      aiProvider: options.aiProvider,
      projectPath: resolvedPath,
      registry,
      userCredentials,
    });
    if (
      roadmap.strategicInsights?.mode === "llm" &&
      roadmap.strategicInsights.llmProvider
    ) {
      roadmap.inferenceMode = `${roadmap.inferenceMode || "filesystem"} + strategic-insights-llm`;
    } else if (roadmap.strategicInsights) {
      roadmap.inferenceMode = `${roadmap.inferenceMode || "filesystem"} + strategic-insights-rules`;
    }
  }

  return { roadmap, projectPath: resolvedPath, historyEntry };
}

module.exports = { buildRoadmapFromPath };
