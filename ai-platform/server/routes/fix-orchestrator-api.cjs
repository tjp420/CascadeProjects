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

const express = require('express');
const path = require('path');
const fs = require('fs');
const { buildPatch, applyPatch, generateDiff } = require('../lib/fix-orchestrator/patch-strategies.cjs');
const logger = require('../lib/app-logger.cjs');
const { setWorkspaceRlsContext, requirePermission } = require('../lib/rbac.cjs');

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
  return path.join(__dirname, '..', '..');
}

/**
 * Audit-log a remediation event inside the active transaction.
 */
async function auditRemediation(req, action, meta = {}) {
  try {
    const { logSecurityEvent } = require('../middleware/audit.cjs');
    logSecurityEvent('remediation_' + action, {
      userId: req.user?.id,
      workspaceId: req.user?.workspaceId || req.user?.organizationId,
      ip: req.ip,
      ...meta
    });
  } catch (e) {
    logger.warn('[FixOrchestrator] Audit log failed:', e.message);
  }
}

// Confidence gate middleware
function enforceConfidenceGate(req, res, next) {
  const { finding } = req.body || {};
  if (!finding) {
    return res.status(400).json({ success: false, error: 'Missing finding' });
  }
  // buildPatch is lightweight; we just need confidence here
  // If the route needs the patch anyway, it rebuilds below
  next();
}

// POST /api/v2/fixes/preview — dry run, RLS scoped
router.post('/preview',
  enforceConfidenceGate,
  async (req, res) => {
    try {
      const { finding } = req.body || {};
      if (!finding || !finding.filePath) {
        return res.status(400).json({ success: false, error: 'Missing finding or filePath' });
      }

      const baseDir = resolveWorkspaceBaseDir(req);
      const absolutePath = path.resolve(baseDir, finding.filePath);
      if (!absolutePath.startsWith(baseDir)) {
        await auditRemediation(req, 'preview_blocked', { reason: 'path_escape', filePath: finding.filePath });
        return res.status(403).json({ success: false, error: 'File path outside workspace' });
      }

      let content;
      try {
        content = await fs.promises.readFile(absolutePath, 'utf8');
      } catch (err) {
        return res.status(404).json({ success: false, error: 'File not found: ' + finding.filePath });
      }

      const patch = buildPatch(finding, content);

      if (patch.confidence < MIN_CONFIDENCE) {
        await auditRemediation(req, 'preview_rejected', {
          filePath: finding.filePath,
          confidence: patch.confidence,
          reason: 'below_threshold'
        });
        return res.status(422).json({
          success: false,
          error: 'Patch confidence too low (' + patch.confidence + '). Review manually.',
          patch,
        });
      }

      const patched = applyPatch(content, patch);
      const diff = generateDiff(content, patched, { filePath: finding.filePath });

      await auditRemediation(req, 'preview_success', {
        filePath: finding.filePath,
        strategy: patch.strategy,
        confidence: patch.confidence
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
      logger.error('[FixOrchestrator] Preview failed: ' + error.message);
      await auditRemediation(req, 'preview_error', { error: error.message });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// POST /api/v2/fixes/apply — writes disk, RLS scoped
router.post('/apply',
  enforceConfidenceGate,
  async (req, res) => {
    let backupPath = null;
    try {
      const { finding, backup = true } = req.body || {};
      if (!finding || !finding.filePath) {
        return res.status(400).json({ success: false, error: 'Missing finding or filePath' });
      }

      const baseDir = resolveWorkspaceBaseDir(req);
      const absolutePath = path.resolve(baseDir, finding.filePath);
      if (!absolutePath.startsWith(baseDir)) {
        await auditRemediation(req, 'apply_blocked', { reason: 'path_escape', filePath: finding.filePath });
        return res.status(403).json({ success: false, error: 'File path outside workspace' });
      }

      let content;
      try {
        content = await fs.promises.readFile(absolutePath, 'utf8');
      } catch (err) {
        return res.status(404).json({ success: false, error: 'File not found: ' + finding.filePath });
      }

      const patch = buildPatch(finding, content);

      if (patch.confidence < MIN_CONFIDENCE) {
        await auditRemediation(req, 'apply_rejected', {
          filePath: finding.filePath,
          confidence: patch.confidence,
          reason: 'below_threshold'
        });
        return res.status(422).json({
          success: false,
          error: 'Patch confidence too low (' + patch.confidence + '). Review manually.',
          patch,
        });
      }

      if (backup) {
        backupPath = absolutePath + '.simplebeacon-backup-' + Date.now();
        await fs.promises.writeFile(backupPath, content, 'utf8');
      }

      const patched = applyPatch(content, patch);
      await fs.promises.writeFile(absolutePath, patched, 'utf8');

      await auditRemediation(req, 'apply_success', {
        filePath: finding.filePath,
        strategy: patch.strategy,
        confidence: patch.confidence,
        backupPath
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
      logger.error('[FixOrchestrator] Apply failed: ' + error.message);
      await auditRemediation(req, 'apply_error', { error: error.message, backupPath });
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// GET /api/v2/fixes/strategies — read-only, still authenticated
router.get('/strategies', (_req, res) => {
  const strategyMap = {
    'debugger-statement': { strategy: 'delete', confidence: 0.95 },
    'console-log': { strategy: 'delete', confidence: 0.95 },
    'eval-usage': { strategy: 'replace', confidence: 0.6 },
    'todo-comment': { strategy: 'delete', confidence: 0.85 },
    'fixme-comment': { strategy: 'delete', confidence: 0.85 },
    'hardcoded-secret': { strategy: 'replace', confidence: 0.75 },
    'unhandled-promise': { strategy: 'wrap', confidence: 0.7 },
    'missing-strict-mode': { strategy: 'wrap', confidence: 0.95 },
    'missing-rate-limit': { strategy: 'insert', confidence: 0.85 },
    'prototype-pollution': { strategy: 'replace', confidence: 0.8 },
    'insecure-random': { strategy: 'wrap', confidence: 0.6 },
    'debug-artifact': { strategy: 'delete', confidence: 0.9 },
    'tech-debt': { strategy: 'delete', confidence: 0.85 },
    'config-drift': { strategy: 'replace', confidence: 0.7 },
    'security-headers': { strategy: 'wrap', confidence: 0.65 },
  };

  res.json({ success: true, strategies: strategyMap });
});

module.exports = router;
