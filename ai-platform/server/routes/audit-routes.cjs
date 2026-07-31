'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const { authorize, enforceOrgPartition, getPartitionStats, getPartitionViolations, clearViolations } = require('../middleware/authorize.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const piiPolicyStore = require('../lib/pii-policy-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs').child('audit-routes');

const router = express.Router();

// Shared scrubber registry for stream-mode PII scrubbing lifecycle management.
// Created once at module load; accessible via /api/audit/scrubber-stats.
const scrubberRegistry = piiPolicyStore.createScrubberRegistry({
  maxScrubbers: parseInt(process.env.SCRUBBER_REGISTRY_MAX, 10) || 100,
  ttlMs: parseInt(process.env.SCRUBBER_REGISTRY_TTL_MS, 10) || 5 * 60 * 1000,
});

// Pre-flight stream verification middleware — rejects requests where
// stream-mode scrubbing output doesn't match batch-mode redactText().
const verifyStreamMiddleware = piiPolicyStore.createVerifyStreamMiddleware();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

function getActor(req) {
  return {
    actorId: req.user?.id || 'unknown',
    actorEmail: req.user?.email || 'unknown',
  };
}

// All audit endpoints require authentication
router.use(authenticate);

// ── GET /api/audit/log ──────────────────────────────────────────────────────
//   Query params: action, entity, actorId, startDate, endDate, limit, offset
router.get('/log', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = auditLogger.query({
      orgId,
      action: req.query.action || '',
      entity: req.query.entity || '',
      actorId: req.query.actorId || '',
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, 'audit_query_failed', { message: err.message });
  }
});

// ── GET /api/audit/stats ────────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = auditLogger.getStats(orgId);
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'audit_stats_failed', { message: err.message });
  }
});

// ── GET /api/audit/export ───────────────────────────────────────────────────
//   Export audit log as CSV or JSON
router.get('/export', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const format = (req.query.format || 'csv').toLowerCase();
    const result = auditLogger.query({ orgId, limit: 500, offset: 0 });

    if (format === 'json') {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.json"`);
      res.send(JSON.stringify(result.entries, null, 2));
      return;
    }

    // CSV format
    const headers = ['Timestamp', 'ID', 'Action', 'Entity', 'Entity ID', 'Actor ID', 'Actor Email', 'Changes'];
    const rows = [headers.join(',')];
    for (const e of result.entries) {
      const changes = e.changes.map(c => `${c.field}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.newValue)}`).join('; ');
      rows.push([
        e.timestamp,
        e.id,
        e.action,
        e.entity,
        e.entityId,
        e.actorId,
        e.actorEmail,
        `"${changes.replace(/"/g, '""')}"`,
      ].join(','));
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`);
    res.send(rows.join('\n'));
  } catch (err) {
    sendError(res, 500, 'audit_export_failed', { message: err.message });
  }
});

// ── GET /api/audit/partition-status ─────────────────────────────────────────
router.get('/partition-status', (req, res) => {
  try {
    const stats = getPartitionStats();
    const callerOrgId = getOrgId(req);
    res.json({
      success: true,
      enforcementEnabled: stats.enforcementEnabled,
      alertOnViolation: stats.alertOnViolation,
      violationAlertThreshold: stats.violationAlertThreshold,
      settingsUpdatedAt: stats.settingsUpdatedAt,
      callerOrgId,
      totalViolations: stats.totalViolations,
      recentViolations: stats.recentViolations,
    });
  } catch (err) {
    logger.warn('[Audit] partition_status_failed:', err.message);
    sendError(res, 500, 'partition_status_failed', { message: err.message });
  }
});

// ── GET /api/audit/partition-config ─────────────────────────────────────────
router.get('/partition-config', authorize('admin:all'), (req, res) => {
  try {
    const settingsStore = require('../lib/security-monitor-settings-store.cjs');
    const settings = settingsStore.getSettings();
    res.json({
      success: true,
      config: {
        orgPartitionEnforcementEnabled: settings.orgPartitionEnforcementEnabled !== false,
        orgPartitionAlertOnViolation: settings.orgPartitionAlertOnViolation !== false,
        orgPartitionViolationAlertThreshold: settings.orgPartitionViolationAlertThreshold || 5,
        orgPartitionViolationTtlMs: settings.orgPartitionViolationTtlMs || 24 * 60 * 60 * 1000,
        orgPartitionViolationMaxLog: settings.orgPartitionViolationMaxLog || 1000,
        orgPartitionViolationCleanupIntervalMs: settings.orgPartitionViolationCleanupIntervalMs || 5 * 60 * 1000,
        orgPartitionViolationMemoryGuardMb: settings.orgPartitionViolationMemoryGuardMb || 50,
      },
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    logger.warn('[Audit] partition_config_get_failed:', err.message);
    sendError(res, 500, 'partition_config_get_failed', { message: err.message });
  }
});

// ── PUT /api/audit/partition-config ─────────────────────────────────────────
router.put('/partition-config', authorize('admin:all'), (req, res) => {
  try {
    const settingsStore = require('../lib/security-monitor-settings-store.cjs');
    const updates = {};
    if (req.body.orgPartitionEnforcementEnabled !== undefined) {
      updates.orgPartitionEnforcementEnabled = !!req.body.orgPartitionEnforcementEnabled;
    }
    if (req.body.orgPartitionAlertOnViolation !== undefined) {
      updates.orgPartitionAlertOnViolation = !!req.body.orgPartitionAlertOnViolation;
    }
    if (req.body.orgPartitionViolationAlertThreshold !== undefined) {
      updates.orgPartitionViolationAlertThreshold = parseInt(req.body.orgPartitionViolationAlertThreshold, 10);
    }

    const result = settingsStore.updateSettings(updates);
    if (!result.success) {
      return sendError(res, 400, 'partition_config_update_failed', { message: result.error });
    }

    logger.info(`[Audit] Partition config updated by ${req.user?.email || 'admin'}`);

    try {
      auditLogger.log({
        orgId: getOrgId(req),
        actorId: req.user?.id || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        action: 'partition_config_update',
        entity: 'security_settings',
        entityId: 'partition',
        metadata: updates,
      });
    } catch (logErr) {
      logger.warn('[Audit] Failed to audit-log partition config update:', logErr.message);
    }

    res.json({
      success: true,
      config: {
        orgPartitionEnforcementEnabled: result.settings.orgPartitionEnforcementEnabled !== false,
        orgPartitionAlertOnViolation: result.settings.orgPartitionAlertOnViolation !== false,
        orgPartitionViolationAlertThreshold: result.settings.orgPartitionViolationAlertThreshold || 5,
      },
      updatedAt: result.settings.updatedAt,
    });
  } catch (err) {
    logger.warn('[Audit] partition_config_update_failed:', err.message);
    sendError(res, 500, 'partition_config_update_failed', { message: err.message });
  }
});

// ── GET /api/audit/partition-violations/export ──────────────────────────────
router.get('/partition-violations/export', authorize('admin:all'), (req, res) => {
  try {
    const violations = getPartitionViolations();
    const format = req.query.format || 'json';

    if (format === 'csv') {
      const header = 'timestamp,callerOrgId,clientOrgId,userId,method,path,ip\n';
      const rows = violations
        .map((v) =>
          [v.at, v.callerOrgId, v.clientOrgId, v.userId, v.method, v.path, v.ip || '']
            .map((val) => `"${String(val).replace(/"/g, '""')}"`)
            .join(',')
        )
        .join('\n');
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="partition-violations-${Date.now()}.csv"`);
      res.send(header + rows);
    } else {
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="partition-violations-${Date.now()}.json"`);
      res.json({
        success: true,
        exportedAt: new Date().toISOString(),
        totalViolations: violations.length,
        violations,
      });
    }
  } catch (err) {
    logger.warn('[Audit] partition_violations_export_failed:', err.message);
    sendError(res, 500, 'partition_violations_export_failed', { message: err.message });
  }
});

// ── POST /api/audit/partition-violations/clear ──────────────────────────────
//   Admin-only: clears all violations from the in-memory buffer.
router.post('/partition-violations/clear', authorize('admin:all'), (req, res) => {
  try {
    const cleared = clearViolations();
    logger.info(`[Audit] Partition violations cleared by ${req.user?.email || 'admin'} (${cleared} removed)`);

    try {
      auditLogger.log({
        orgId: getOrgId(req),
        actorId: req.user?.id || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        action: 'partition_violations_clear',
        entity: 'partition_violations',
        entityId: 'all',
        metadata: { clearedCount: cleared },
      });
    } catch (logErr) {
      logger.warn('[Audit] Failed to audit-log partition violations clear:', logErr.message);
    }

    res.json({
      success: true,
      clearedCount: cleared,
      remainingViolations: 0,
    });
  } catch (err) {
    logger.warn('[Audit] partition_violations_clear_failed:', err.message);
    sendError(res, 500, 'partition_violations_clear_failed', { message: err.message });
  }
});

// ── GET /api/audit/partition-retention/config ───────────────────────────────
//   Admin-only: returns the current violation retention policy configuration.
router.get('/partition-retention/config', authorize('admin:all'), (req, res) => {
  try {
    const settingsStore = require('../lib/security-monitor-settings-store.cjs');
    const settings = settingsStore.getSettings();
    const stats = getPartitionStats();
    res.json({
      success: true,
      config: {
        orgPartitionViolationTtlMs: settings.orgPartitionViolationTtlMs || 24 * 60 * 60 * 1000,
        orgPartitionViolationMaxLog: settings.orgPartitionViolationMaxLog || 1000,
        orgPartitionViolationCleanupIntervalMs: settings.orgPartitionViolationCleanupIntervalMs || 5 * 60 * 1000,
        orgPartitionViolationMemoryGuardMb: settings.orgPartitionViolationMemoryGuardMb || 50,
      },
      runtime: {
        estimatedMemoryMb: stats.estimatedMemoryMb,
        lastCleanupRun: stats.lastCleanupRun,
        totalViolations: stats.totalViolations,
      },
      updatedAt: settings.updatedAt,
    });
  } catch (err) {
    logger.warn('[Audit] partition_retention_config_get_failed:', err.message);
    sendError(res, 500, 'partition_retention_config_get_failed', { message: err.message });
  }
});

// ── PUT /api/audit/partition-retention/config ───────────────────────────────
//   Admin-only: updates the violation retention policy configuration.
router.put('/partition-retention/config', authorize('admin:all'), (req, res) => {
  try {
    const settingsStore = require('../lib/security-monitor-settings-store.cjs');
    const updates = {};

    if (req.body.orgPartitionViolationTtlMs !== undefined) {
      updates.orgPartitionViolationTtlMs = parseInt(req.body.orgPartitionViolationTtlMs, 10);
    }
    if (req.body.orgPartitionViolationMaxLog !== undefined) {
      updates.orgPartitionViolationMaxLog = parseInt(req.body.orgPartitionViolationMaxLog, 10);
    }
    if (req.body.orgPartitionViolationCleanupIntervalMs !== undefined) {
      updates.orgPartitionViolationCleanupIntervalMs = parseInt(req.body.orgPartitionViolationCleanupIntervalMs, 10);
    }
    if (req.body.orgPartitionViolationMemoryGuardMb !== undefined) {
      updates.orgPartitionViolationMemoryGuardMb = parseInt(req.body.orgPartitionViolationMemoryGuardMb, 10);
    }

    const result = settingsStore.updateSettings(updates);
    if (!result.success) {
      return sendError(res, 400, 'partition_retention_config_update_failed', { message: result.error });
    }

    logger.info(`[Audit] Partition retention config updated by ${req.user?.email || 'admin'}`);

    try {
      auditLogger.log({
        orgId: getOrgId(req),
        actorId: req.user?.id || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        action: 'partition_retention_config_update',
        entity: 'security_settings',
        entityId: 'partition_retention',
        metadata: updates,
      });
    } catch (logErr) {
      logger.warn('[Audit] Failed to audit-log partition retention config update:', logErr.message);
    }

    res.json({
      success: true,
      config: {
        orgPartitionViolationTtlMs: result.settings.orgPartitionViolationTtlMs,
        orgPartitionViolationMaxLog: result.settings.orgPartitionViolationMaxLog,
        orgPartitionViolationCleanupIntervalMs: result.settings.orgPartitionViolationCleanupIntervalMs,
        orgPartitionViolationMemoryGuardMb: result.settings.orgPartitionViolationMemoryGuardMb,
      },
      updatedAt: result.settings.updatedAt,
    });
  } catch (err) {
    logger.warn('[Audit] partition_retention_config_update_failed:', err.message);
    sendError(res, 500, 'partition_retention_config_update_failed', { message: err.message });
  }
});

// ── GET /api/audit/verify-integrity ─────────────────────────────────────────
//   Admin-only: verifies the audit log hash chain for the caller's org.
//   Returns whether the chain is valid, plus details of any broken links
//   or tampered entries.
router.get('/verify-integrity', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = auditLogger.verifyChain(orgId);
    res.json({
      success: true,
      ...result,
    });
  } catch (err) {
    logger.warn('[Audit] verify_integrity_failed:', err.message);
    sendError(res, 500, 'verify_integrity_failed', { message: err.message });
  }
});

// ── POST /api/audit/heal-chain ──────────────────────────────────────────────
//   Admin-only: heals the audit log hash chain for the caller's org.
//   Detects broken/tampered entries, moves them to quarantine, and re-links
//   the remaining entries with new hashes.
router.post('/heal-chain', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = auditLogger.healChain(orgId);

    logger.info(`[Audit] Chain heal triggered by ${req.user?.email || 'admin'} for org ${orgId}: ${result.quarantined.length} quarantined, ${result.relinked} relinked`);

    try {
      auditLogger.log({
        orgId,
        actorId: req.user?.id || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        action: 'chain_heal',
        entity: 'audit_log',
        entityId: 'chain',
        metadata: {
          healed: result.healed,
          quarantinedCount: result.quarantined.length,
          relinked: result.relinked,
          remaining: result.remaining,
        },
      });
    } catch (logErr) {
      logger.warn('[Audit] Failed to audit-log chain heal:', logErr.message);
    }

    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Audit] heal_chain_failed:', err.message);
    sendError(res, 500, 'heal_chain_failed', { message: err.message });
  }
});

// ── GET /api/audit/quarantine ───────────────────────────────────────────────
//   Admin-only: returns quarantined audit entries (optionally filtered by org).
router.get('/quarantine', authorize('admin:all'), (req, res) => {
  try {
    const orgId = req.query.allOrgs === 'true' ? null : getOrgId(req);
    const result = auditLogger.getQuarantine(orgId);
    res.json({
      success: true,
      totalEntries: result.entries.length,
      entries: result.entries,
      metadata: result.metadata,
    });
  } catch (err) {
    logger.warn('[Audit] quarantine_get_failed:', err.message);
    sendError(res, 500, 'quarantine_get_failed', { message: err.message });
  }
});

// ── GET /api/audit/heal-stats ───────────────────────────────────────────────
//   Admin-only: returns auto-healing worker stats.
router.get('/heal-stats', authorize('admin:all'), (req, res) => {
  try {
    const stats = auditLogger.getHealStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.warn('[Audit] heal_stats_failed:', err.message);
    sendError(res, 500, 'heal_stats_failed', { message: err.message });
  }
});

// ── GET /api/audit/scrubber-stats ───────────────────────────────────────────
//   Admin-only: returns scrubber registry health stats (active scrubbers,
//   memory bounds, TTL config, per-scrubber metrics).
router.get('/scrubber-stats', authorize('admin:all'), (req, res) => {
  try {
    // Run TTL cleanup before reporting stats
    const expired = scrubberRegistry.cleanup();
    if (expired > 0) {
      logger.info(`[Audit] Scrubber registry: expired ${expired} idle scrubbers`);
    }

    const stats = scrubberRegistry.getStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.warn('[Audit] scrubber_stats_failed:', err.message);
    sendError(res, 500, 'scrubber_stats_failed', { message: err.message });
  }
});

// ── POST /api/audit/verify-stream ───────────────────────────────────────────
//   Authenticated: runs pre-flight stream verification on a chunk array.
//   Expects req.body.chunks (array of strings or { text, type }) and
//   optional req.body.orgId (falls back to req.user.id).
//   Returns 200 with verification result on match, 422 on mismatch.
router.post('/verify-stream', authenticate, verifyStreamMiddleware, (req, res) => {
  const result = req.verifiedResult;
  res.json({
    success: true,
    match: result.match,
    streamMatches: result.streamMatches,
    batchMatches: result.batchMatches,
    streamLength: result.streamText.length,
    batchLength: result.batchText.length,
  });
});

module.exports = router;
