// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
const logger = require("../lib/production-logger.cjs");
/**
 * POST /api/dynamic-roadmap/build-from-path
 * Register early in Express apps (before static middleware).
 */

const path = require("path");
const fs = require("fs").promises;
const GlobalContextManager = require("../core/GlobalContextManager.cjs");
const RoadmapDataAnalyzer = require("../core/RoadmapDataAnalyzer.cjs");
const {
  appendHistoryEntry,
  setupRoadmapAnalysisHistoryRoutes,
} = require("./roadmap-analysis-history.cjs");
const {
  generateCodeRoadmap,
} = require("../../server/lib/code-roadmap-generator.cjs");
const {
  renderExecutiveHtml,
} = require("../../server/lib/code-roadmap-export.cjs");
const {
  buildHistoryEntryFromRoadmap,
} = require("../../server/lib/roadmap-history-metrics.cjs");

/**
 * Normalize string list.
 * @param {any} value
 * @returns {any}
 */
function normalizeStringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

/**
 * Setup build from path route.
 * @param {any} app
 * @returns {any}
 */
function setupBuildFromPathRoute(app) {
  setupRoadmapAnalysisHistoryRoutes(app);

  app.get("/api/dynamic-roadmap/health", (req, res) => {
    res.json({
      ok: true,
      route: "/api/dynamic-roadmap/build-from-path",
      method: "POST",
    });
  });

  app.get("/api/code-roadmap/analyze", async (req, res) => {
    try {
      const rawPath = req.query.projectPath || path.join(__dirname, "../..");
      const resolvedPath = path.resolve(String(rawPath));
      const stat = await fs.stat(resolvedPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: "Invalid path",
          message: "projectPath must be an existing directory",
        });
      }

      const roadmap = await generateCodeRoadmap(
        resolvedPath,
        {},
        {
          includePaths: normalizeStringList(
            String(req.query.includePaths || "").split(","),
          ),
          excludePatterns: normalizeStringList(
            String(req.query.excludePatterns || "").split(","),
          ),
        },
      );

      res.json({
        success: true,
        projectPath: resolvedPath,
        roadmap,
        timestamp: new Date().toISOString(),
        source: "code-roadmap-generator",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Code roadmap analysis failed",
        message: error.message,
      });
    }
  });

  app.get("/api/code-roadmap/export/html", async (req, res) => {
    try {
      const rawPath = req.query.projectPath || path.join(__dirname, "../..");
      const resolvedPath = path.resolve(String(rawPath));
      const stat = await fs.stat(resolvedPath);
      if (!stat.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: "Invalid path",
          message: "projectPath must be an existing directory",
        });
      }

      const roadmap = await generateCodeRoadmap(
        resolvedPath,
        {},
        {
          includePaths: normalizeStringList(
            String(req.query.includePaths || "").split(","),
          ),
          excludePatterns: normalizeStringList(
            String(req.query.excludePatterns || "").split(","),
          ),
        },
      );

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderExecutiveHtml(roadmap));
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Executive HTML export failed",
        message: error.message,
      });
    }
  });

  app.post("/api/code-roadmap/export/html", (req, res) => {
    try {
      const roadmap = req.body?.roadmap || req.body;
      if (!roadmap || typeof roadmap !== "object") {
        return res.status(400).json({
          success: false,
          error: "roadmap required",
          message: "POST JSON body with roadmap object",
        });
      }

      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.send(renderExecutiveHtml(roadmap));
    } catch (error) {
      res.status(500).json({
        success: false,
        error: "Executive HTML export failed",
        message: error.message,
      });
    }
  });

  app.post("/api/dynamic-roadmap/build-from-path", async (req, res) => {
    try {
      const { projectPath, title, description, includePaths, excludePatterns } =
        req.body || {};

      if (
        !projectPath ||
        typeof projectPath !== "string" ||
        !projectPath.trim()
      ) {
        return res.status(400).json({
          success: false,
          error: "projectPath is required",
          message: "Provide the full path to the software project folder",
        });
      }

      const resolvedPath = path.resolve(projectPath.trim());
      const stat = await fs.stat(resolvedPath);

      if (!stat.isDirectory()) {
        return res.status(400).json({
          success: false,
          error: "Invalid path",
          message: "Path must be an existing directory",
        });
      }

      const normalizedIncludePaths = normalizeStringList(includePaths);
      const normalizedExcludePatterns = normalizeStringList(excludePatterns);

      logger.debug(`🗺️ Building AI roadmap from: ${resolvedPath}`);
      if (normalizedIncludePaths.length) {
        logger.debug(`   Include paths: ${normalizedIncludePaths.join(", ")}`);
      }
      if (normalizedExcludePatterns.length) {
        logger.debug(
          `   Extra excludes: ${normalizedExcludePatterns.join(", ")}`,
        );
      }

      const contextManager = new GlobalContextManager(resolvedPath);
      await contextManager.initialize({ watch: false });

      const analyzer = new RoadmapDataAnalyzer(contextManager, {
        projectRoot: resolvedPath,
        includePaths: normalizedIncludePaths,
        excludePatterns: normalizedExcludePatterns,
      });
      analyzer.analysisCache.clear();
      analyzer.lastAnalysisTime = null;

      const roadmap = await analyzer.analyzeProjectForRoadmap();

      if (title) {
        roadmap.projectTitle = title;
      }
      if (description) {
        roadmap.projectDescription = description;
      }
      roadmap.sourceProjectPath = resolvedPath;
      roadmap.dataSource = "filesystem-scan";
      roadmap.scanOptions = {
        includePaths: normalizedIncludePaths,
        excludePatterns: normalizedExcludePatterns,
      };

      const historyEntry = buildHistoryEntryFromRoadmap(roadmap, {
        projectPath: resolvedPath,
        title: title || roadmap.projectTitle || path.basename(resolvedPath),
        scanOptions: {
          includePaths: normalizedIncludePaths,
          excludePatterns: normalizedExcludePatterns,
        },
      });

      const db = req.app.locals?.db;
      if (db) {
        try {
          await appendHistoryEntry(db, historyEntry);
        } catch (historyError) {
          logger.warn("Roadmap history persist skipped:", historyError.message);
        }
      }

      res.json({
        success: true,
        projectPath: resolvedPath,
        roadmap,
        historyEntry,
        timestamp: new Date().toISOString(),
        source: "dynamic-analysis-from-path",
      });

      logger.debug("✅ Roadmap built from project path");
    } catch (error) {
      logger.error("❌ Failed to build roadmap from path:", error);
      res.status(500).json({
        success: false,
        error: "Failed to build roadmap from path",
        message: error.message,
      });
    }
  });
}

module.exports = setupBuildFromPathRoute;
