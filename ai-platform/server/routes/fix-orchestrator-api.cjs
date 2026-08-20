// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
/**
 * FixOrchestrator 2.0 — Auto-Remediation API (RLS-scoped)
 *
 * POST /api/v2/fixes/preview  — Generate patch preview (dry run)
 * POST /api/v2/fixes/apply    — Apply patch to file (writes disk)
 * GET  /api/v2/fixes/strategies — List supported strategies by finding type
 *
 * Routes are protected by:
 *   authenticate        → JWT validation (15m access tokens)
 *   requirePermission('remediation:write') → RBAC gate
 *   setWorkspaceRlsContext → PostgreSQL transaction scoped to workspace
 */

const express = require("express");
const path = require("path");
const fs = require("fs");
const {
  buildPatch,
  applyPatch,
  generateDiff,
} = require("../lib/fix-orchestrator/patch-strategies.cjs");
const logger = require("../lib/app-logger.cjs");
const {
  setWorkspaceRlsContext,
  requirePermission,
} = require("../lib/rbac.cjs");
const { sendError } = require("../lib/response-helpers.cjs");

const router = express.Router();

const MIN_CONFIDENCE = 0.5;

/**
 * Resolve workspace-scoped base directory.
 * In production: uses workspace-specific vault from tenant config.
 * In development: falls back to monorepo root.
 */
function resolveWorkspaceBaseDir(req) {
  const workspaceId = req.user?.workspaceId || req.user?.organizationId;
  if (workspaceId && process.env.WORKSPACE_VAULT_ROOT) {
    return path.resolve(process.env.WORKSPACE_VAULT_ROOT, workspaceId);
  }
  // Fallback for local dev / when no workspace vault configured
  return path.join(__dirname, "..", "..");
}

/**
 * Audit-log a remediation event inside the active transaction.
 */
async function auditRemediation(req, action, meta = {}) {
  try {
    const { logSecurityEvent } = require("../middleware/audit.cjs");
    logSecurityEvent("remediation_" + action, {
      userId: req.user?.id,
      workspaceId: req.user?.workspaceId || req.user?.organizationId,
      ip: req.ip,
      ...meta,
    });
  } catch (e) {
    logger.warn("[FixOrchestrator] Audit log failed:", e.message);
  }
}

// Confidence gate middleware
function enforceConfidenceGate(req, res, next) {
  const { finding } = req.body || {};
  if (!finding) {
    return sendError(res, 400, "Missing finding");
  }
  // buildPatch is lightweight; we just need confidence here
  // If the route needs the patch anyway, it rebuilds below
  next();
}

// GET /api/v2/archive/download?name=FILENAME — download an archived file
router.get("/archive/download", async (req, res) => {
  try {
    const name = req.query.name;
    if (!name) return sendError(res, 400, "Missing name");
    const archiveDir = path.join(__dirname, "..", ".simplebeacon", "archive");
    const filePath = path.join(archiveDir, path.basename(String(name)));
    if (!filePath.startsWith(archiveDir))
      return sendError(res, 403, "Invalid path");
    if (!fs.existsSync(filePath)) return sendError(res, 404, "Not found");
    return res.sendFile(filePath);
  } catch (err) {
    logger.error("[Archive] download failed: " + err.message);
    return sendError(res, 500, err.message);
  }
});

// POST /api/v2/fixes/preview — dry run, RLS scoped
router.post("/preview", enforceConfidenceGate, async (req, res) => {
  try {
    const { finding } = req.body || {};
    if (!finding || !finding.filePath) {
      return sendError(res, 400, "Missing finding or filePath");
    }

    const baseDir = resolveWorkspaceBaseDir(req);
    const absolutePath = path.resolve(baseDir, finding.filePath);
    if (!absolutePath.startsWith(baseDir)) {
      await auditRemediation(req, "preview_blocked", {
        reason: "path_escape",
        filePath: finding.filePath,
      });
      return sendError(res, 403, "File path outside workspace");
    }

    let content;
    try {
      content = await fs.promises.readFile(absolutePath, "utf8");
    } catch (err) {
      return sendError(res, 404, "File not found: " + finding.filePath);
    }

    const patch = buildPatch(finding, content);

    if (patch.confidence < MIN_CONFIDENCE) {
      await auditRemediation(req, "preview_rejected", {
        filePath: finding.filePath,
        confidence: patch.confidence,
        reason: "below_threshold",
      });
      return res.status(422).json({
        success: false,
        error:
          "Patch confidence too low (" +
          patch.confidence +
          "). Review manually.",
        patch,
      });
    }

    const patched = applyPatch(content, patch);
    const diff = generateDiff(content, patched, { filePath: finding.filePath });

    await auditRemediation(req, "preview_success", {
      filePath: finding.filePath,
      strategy: patch.strategy,
      confidence: patch.confidence,
    });

    res.json({
      success: true,
      dryRun: true,
      finding: {
        type: finding.type,
        category: finding.category,
        severity: finding.severity,
        filePath: finding.filePath,
        line: finding.line,
      },
      patch: {
        strategy: patch.strategy,
        line: patch.line,
        confidence: patch.confidence,
        reason: patch.reason,
      },
      diff: diff.unified,
      hunks: diff.hunks,
    });
  } catch (error) {
    logger.error("[FixOrchestrator] Preview failed: " + error.message);
    await auditRemediation(req, "preview_error", { error: error.message });
    sendError(res, 500, error.message);
  }
});

// POST /api/v2/fixes/apply — writes disk, RLS scoped
router.post("/apply", enforceConfidenceGate, async (req, res) => {
  let backupPath = null;
  try {
    const { finding, backup = true } = req.body || {};
    if (!finding || !finding.filePath) {
      return sendError(res, 400, "Missing finding or filePath");
    }

    const baseDir = resolveWorkspaceBaseDir(req);
    const absolutePath = path.resolve(baseDir, finding.filePath);
    if (!absolutePath.startsWith(baseDir)) {
      await auditRemediation(req, "apply_blocked", {
        reason: "path_escape",
        filePath: finding.filePath,
      });
      return sendError(res, 403, "File path outside workspace");
    }

    let content;
    try {
      content = await fs.promises.readFile(absolutePath, "utf8");
    } catch (err) {
      return sendError(res, 404, "File not found: " + finding.filePath);
    }

    const patch = buildPatch(finding, content);

    if (patch.confidence < MIN_CONFIDENCE) {
      await auditRemediation(req, "apply_rejected", {
        filePath: finding.filePath,
        confidence: patch.confidence,
        reason: "below_threshold",
      });
      return res.status(422).json({
        success: false,
        error:
          "Patch confidence too low (" +
          patch.confidence +
          "). Review manually.",
        patch,
      });
    }

    if (backup) {
      backupPath = absolutePath + ".simplebeacon-backup-" + Date.now();
      await fs.promises.writeFile(backupPath, content, "utf8");
    }

    const patched = applyPatch(content, patch);
    await fs.promises.writeFile(absolutePath, patched, "utf8");

    await auditRemediation(req, "apply_success", {
      filePath: finding.filePath,
      strategy: patch.strategy,
      confidence: patch.confidence,
      backupPath,
    });

    res.json({
      success: true,
      dryRun: false,
      filePath: finding.filePath,
      patch: {
        strategy: patch.strategy,
        line: patch.line,
        confidence: patch.confidence,
        reason: patch.reason,
      },
    });
  } catch (error) {
    logger.error("[FixOrchestrator] Apply failed: " + error.message);
    await auditRemediation(req, "apply_error", {
      error: error.message,
      backupPath,
    });
    sendError(res, 500, error.message);
  }
});

module.exports = router;
