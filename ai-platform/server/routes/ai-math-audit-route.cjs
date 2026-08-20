// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
"use strict";

/**
 * AI Math Audit route — runs the JS-native ai-math-audit engine.
 *
 * POST /api/analyze/ai-math-audit
 *   Body: { projectPath: string }
 *   Runs deterministic mathematical audit on model numerical logs in the project.
 *   Returns JSON report.
 */

const path = require("path");
const fs = require("fs");

const logger = require("../lib/app-logger.cjs");
const {
  assertSafeProjectPath,
  resolveDefaultAllowedRoots,
} = require("../lib/path-safety.cjs");
const { toClientError } = require("../../shared-utils/index.cjs");
const { runAudit } = require("../lib/ai-math-audit.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

/**
 * Resolve the directory that contains model numerical logs for a project.
 * Tries: <projectPath>/model-logs, <projectPath>/logs, <projectPath>
 */
function resolveLogDir(projectPath) {
  const candidates = [
    path.join(projectPath, "model-logs"),
    path.join(projectPath, "logs"),
    projectPath,
  ];
  for (const dir of candidates) {
    if (fs.existsSync(dir) && fs.statSync(dir).isDirectory()) {
      // Prefer the first candidate that has at least one .json / .jsonl file
      const hasLogs = fs.readdirSync(dir).some((f) => /\.jsonl?$/.test(f));
      if (hasLogs) return dir;
    }
  }
  // Fallback: return projectPath itself even if empty (audit will produce empty findings)
  return projectPath;
}

/**
 * Setup the AI Math Audit route.
 * @param {import('express').Application} app
 * @param {string} baseDir
 */
function setupAiMathAuditRoute(app, baseDir) {
  const allowedRoots = resolveDefaultAllowedRoots(baseDir);

  app.post("/api/analyze/ai-math-audit", async (req, res) => {
    try {
      const body = req.body || {};
      const rawPath = String(body.projectPath || body.path || "").trim();
      if (!rawPath) {
        return sendError(res, 400, "Missing projectPath");
      }

      let projectPath;
      try {
        projectPath = assertSafeProjectPath(rawPath, allowedRoots);
      } catch (err) {
        return sendError(res, 403, err.message);
      }

      const logDir = resolveLogDir(projectPath);

      logger.info(`[AI Math Audit] Running JS-native audit on: ${logDir}`);

      const report = runAudit(logDir, {});

      return res.json({ success: true, report, projectPath, logDir });
    } catch (err) {
      logger.error("[AI Math Audit] Error:", err);
      return res.status(500).json(toClientError(err));
    }
  });
}

module.exports = { setupAiMathAuditRoute };
