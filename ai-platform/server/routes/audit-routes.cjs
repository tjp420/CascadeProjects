'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const { authorize, enforceOrgPartition, getPartitionStats, getPartitionViolations, clearViolations, interdictKey, releaseKey, getInterdictedKeys, recordStreamFailure, getStreamFailureStats, clearStreamFailures } = require('../middleware/authorize.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const auditPolicyStore = require('../lib/audit-policy-store.cjs');
const piiPolicyStore = require('../lib/pii-policy-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs').child('audit-routes');
const clusterSync = require('../lib/cluster-keyring-sync.cjs');
const coldArchiveSearch = require('../lib/cold-archive-search.cjs');
const { middleware: adminThrottle } = require('../lib/admin-throttle.cjs');

const router = express.Router();

// Initialize cluster keyring sync if CLUSTER_NODES is configured.
process.nextTick(() => { try { clusterSync.init(); } catch (err) { logger.warn('[Audit] cluster-keyring-sync init failed:', err.message); } });

// Shared scrubber registry for stream-mode PII scrubbing lifecycle management.
// Created once at module load; accessible via /api/audit/scrubber-stats.
const scrubberRegistry = piiPolicyStore.createScrubberRegistry({
  maxScrubbers: parseInt(process.env.SCRUBBER_REGISTRY_MAX, 10) || 100,
  ttlMs: parseInt(process.env.SCRUBBER_REGISTRY_TTL_MS, 10) || 5 * 60 * 1000,
});

// Pre-flight stream verification middleware — rejects requests where
// stream-mode scrubbing output doesn't match batch-mode redactText().
const verifyStreamMiddleware = piiPolicyStore.createVerifyStreamMiddleware();

// Lazy-load agentic-orchestration-routes to access the replay detector
// for telemetry aggregation. Lazy to avoid loading the full router at
// module init time (and potential circular dependency issues).
let _agenticRoutes = null;
function getAgenticRoutes() {
  if (!_agenticRoutes) {
    try {
      _agenticRoutes = require('./agentic-orchestration-routes.cjs');
    } catch (e) {
      logger.warn('[Audit] Could not load agentic-orchestration-routes for telemetry:', e.message);
    }
  }
  return _agenticRoutes;
}

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

// Apply token-bucket defense to all audit routes
router.use(adminThrottle);

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

    // Record stream failure if chain is invalid — feeds the real-time
    // interdiction engine to auto-block keys with repeated chain violations
    if (!result.valid) {
      const apiKey = req.headers['x-api-key'] || req.user?.id || orgId;
      recordStreamFailure(apiKey, 'chain_verification', `brokenLinks=${result.brokenLinks.length}, tampered=${result.tamperedEntries.length}`);
    }

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

// ── POST /api/audit/quarantine/verify-entry ─────────────────────────────────
//   Admin-only: verifies the cryptographic integrity of a single quarantined entry.
//   Body: { entryId: string, orgId?: string }
//   If orgId is omitted, uses the caller's org.
router.post('/quarantine/verify-entry', authorize('admin:all'), (req, res) => {
  try {
    const { entryId } = req.body || {};
    if (!entryId) {
      sendError(res, 400, 'missing_entry_id', { message: 'entryId is required' });
      return;
    }
    const orgId = req.body.orgId || getOrgId(req);
    const result = auditLogger.verifyQuarantineEntry(orgId, entryId);
    if (!result.found) {
      sendError(res, 404, 'entry_not_found', { message: `Quarantine entry ${entryId} not found for org ${orgId}` });
      return;
    }
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Audit] quarantine_verify_failed:', err.message);
    sendError(res, 500, 'quarantine_verify_failed', { message: err.message });
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

// ── GET /api/audit/telemetry ────────────────────────────────────────────────
//   Admin-only: aggregates security telemetry from all subsystems:
//     - Scrubber registry (active scrubbers, eviction/expiry stats)
//     - Replay detector (total checked, replays, org count)
//     - Audit log integrity (chain status, quarantine count)
//     - PII policy stats (enabled policies, by severity)
router.get('/telemetry', authorize('admin:all'), (req, res) => {
  try {
    // Run TTL cleanup on scrubber registry before reporting
    scrubberRegistry.cleanup();

    // Scrubber registry stats
    const scrubberStats = scrubberRegistry.getStats();

    // Replay detector stats (from agentic-orchestration-routes)
    let replayStats = null;
    const agenticRoutes = getAgenticRoutes();
    if (agenticRoutes && agenticRoutes.replayDetector) {
      replayStats = agenticRoutes.replayDetector.getStats();
    }

    // Audit log integrity stats
    let auditStats = null;
    try {
      const orgId = getOrgId(req);
      const chainVerification = auditLogger.verifyChain(orgId);
      const quarantine = auditLogger.getQuarantine ? auditLogger.getQuarantine(orgId) : [];
      auditStats = {
        chainValid: chainVerification.valid,
        totalEntries: chainVerification.totalEntries,
        verifiedEntries: chainVerification.verifiedEntries || 0,
        brokenLinks: (chainVerification.brokenLinks || []).length,
        tamperedEntries: (chainVerification.tamperedEntries || []).length,
        quarantinedCount: Array.isArray(quarantine) ? quarantine.length : 0,
      };
    } catch (e) {
      auditStats = { error: e.message };
    }

    // PII policy stats
    let piiStats = null;
    try {
      const orgId = getOrgId(req);
      piiStats = piiPolicyStore.getStats(orgId);
    } catch (e) {
      piiStats = { error: e.message };
    }

    res.json({
      success: true,
      timestamp: Date.now(),
      scrubber: scrubberStats,
      replay: replayStats,
      audit: auditStats,
      pii: piiStats,
    });
  } catch (err) {
    logger.warn('[Audit] telemetry_failed:', err.message);
    sendError(res, 500, 'telemetry_failed', { message: err.message });
  }
});

// ── Key Rotation Management Routes ──────────────────────────────────────────
//   All routes require admin:all authorization.
//   These endpoints expose the key-rotation-store and autonomous re-keying
//   worker for administrative dashboard control.

// Lazy-load key-rotation-store to avoid circular dependency issues
let _keyRotationStore = null;
function getKeyRotationStore() {
  if (!_keyRotationStore) {
    try {
      _keyRotationStore = require('../lib/key-rotation-store.cjs');
    } catch (e) {
      logger.warn('[Audit] Could not load key-rotation-store:', e.message);
    }
  }
  return _keyRotationStore;
}

// GET /api/audit/key/status — Live keyring status with truncated fingerprints
router.get('/key/status', authorize('admin:all'), (req, res) => {
  try {
    const store = getKeyRotationStore();
    if (!store) {
      sendError(res, 503, 'key_rotation_unavailable', { message: 'Key rotation store not loaded' });
      return;
    }
    const status = store.getRotationStatus();
    res.json({ success: true, status });
  } catch (err) {
    logger.warn('[Audit] key_status_failed:', err.message);
    sendError(res, 500, 'key_status_failed', { message: err.message });
  }
});

// POST /api/audit/key/rotate — Trigger a master key rotation
//   Body: { newKeyRaw: string, graceMs?: number }
router.post('/key/rotate', authorize('admin:all'), (req, res) => {
  try {
    const store = getKeyRotationStore();
    if (!store) {
      sendError(res, 503, 'key_rotation_unavailable', { message: 'Key rotation store not loaded' });
      return;
    }
    const { newKeyRaw, graceMs } = req.body || {};
    if (!newKeyRaw) {
      sendError(res, 400, 'invalid_key', { message: 'newKeyRaw is required' });
      return;
    }
    if (typeof newKeyRaw === 'string' && newKeyRaw.length < 32) {
      sendError(res, 400, 'invalid_key', { message: 'newKeyRaw must be at least 32 characters' });
      return;
    }
    if (Buffer.isBuffer(newKeyRaw) && newKeyRaw.length < 32) {
      sendError(res, 400, 'invalid_key', { message: 'newKeyRaw must be at least 32 bytes' });
      return;
    }
    store.rotateKey(newKeyRaw, graceMs);
    logger.info('[Audit] key_rotation_triggered by user:', getActor(req).actorEmail);
    res.json({ success: true, message: 'Global master key rotation initialized successfully.' });
  } catch (err) {
    logger.warn('[Audit] key_rotate_failed:', err.message);
    sendError(res, 500, 'key_rotate_failed', { message: err.message });
  }
});

// POST /api/audit/key/rekey-now — Force an out-of-band re-keying sweep
router.post('/key/rekey-now', authorize('admin:all'), (req, res) => {
  try {
    const result = auditLogger.runAutonomousReKeying();
    logger.info('[Audit] manual_rekey_triggered by user:', getActor(req).actorEmail, 'result:', JSON.stringify(result));
    res.json({ success: true, result });
  } catch (err) {
    logger.warn('[Audit] rekey_now_failed:', err.message);
    sendError(res, 500, 'rekey_now_failed', { message: err.message });
  }
});

// GET /api/audit/key/rekey-stats — Background re-keying migration statistics
router.get('/key/rekey-stats', authorize('admin:all'), (req, res) => {
  try {
    const stats = auditLogger.getReKeyStats();
    res.json({ success: true, stats });
  } catch (err) {
    logger.warn('[Audit] rekey_stats_failed:', err.message);
    sendError(res, 500, 'rekey_stats_failed', { message: err.message });
  }
});

// POST /api/audit/key/purge — Purge stale/retired keys past their grace window
//   Body: { force?: boolean } — If true, purge regardless of grace window
router.post('/key/purge', authorize('admin:all'), (req, res) => {
  try {
    const store = getKeyRotationStore();
    if (!store) {
      sendError(res, 503, 'key_rotation_unavailable', { message: 'Key rotation store not loaded' });
      return;
    }
    const { force } = req.body || {};
    const statusBefore = store.getRotationStatus();
    const hadPrevious = statusBefore.hasPrevious;
    const graceExpired = statusBefore.graceExpired;

    const purged = store.purgeExpiredKeys(force === true);
    const statusAfter = store.getRotationStatus();

    logger.info('[Audit] key_purge_triggered by user:', getActor(req).actorEmail, 'purged:', purged, 'force:', force === true);

    res.json({
      success: true,
      purged: purged ? 1 : 0,
      hadPrevious,
      graceExpired,
      status: statusAfter,
    });
  } catch (err) {
    logger.warn('[Audit] key_purge_failed:', err.message);
    sendError(res, 500, 'key_purge_failed', { message: err.message });
  }
});

// ── Key Interdiction Management Routes ──────────────────────────────────────
//   Admin-only routes for managing the real-time API key block list.

// GET /api/audit/interdiction/status — List interdicted keys and stats
router.get('/interdiction/status', authorize('admin:all'), (req, res) => {
  try {
    const result = getInterdictedKeys();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Audit] interdiction_status_failed:', err.message);
    sendError(res, 500, 'interdiction_status_failed', { message: err.message });
  }
});

// POST /api/audit/interdiction/block — Manually block an API key
//   Body: { apiKey: string, reason?: string, ttlMs?: number }
router.post('/interdiction/block', authorize('admin:all'), (req, res) => {
  try {
    const { apiKey, reason, ttlMs } = req.body || {};
    if (!apiKey) {
      sendError(res, 400, 'missing_api_key', { message: 'apiKey is required' });
      return;
    }
    const result = interdictKey(apiKey, reason || 'manual_admin_block', ttlMs, 'manual');
    logger.info('[Audit] manual_interdiction by user:', getActor(req).actorEmail, 'key:', apiKey.slice(0, 4) + '…');
    res.json({ success: true, ...result, expiresAt: new Date(result.expiresAt).toISOString() });
  } catch (err) {
    logger.warn('[Audit] interdiction_block_failed:', err.message);
    sendError(res, 500, 'interdiction_block_failed', { message: err.message });
  }
});

// POST /api/audit/interdiction/release — Release an interdicted API key
//   Body: { apiKey: string }
router.post('/interdiction/release', authorize('admin:all'), (req, res) => {
  try {
    const { apiKey } = req.body || {};
    if (!apiKey) {
      sendError(res, 400, 'missing_api_key', { message: 'apiKey is required' });
      return;
    }
    const result = releaseKey(apiKey);
    logger.info('[Audit] interdiction_released by user:', getActor(req).actorEmail, 'wasBlocked:', result.wasBlocked);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Audit] interdiction_release_failed:', err.message);
    sendError(res, 500, 'interdiction_release_failed', { message: err.message });
  }
});

// ── Stream Interdiction Routes ──────────────────────────────────────────────
//   Multi-axis sliding-window failure tracker with auto-interdiction.

// GET /api/audit/interdiction/stream/status — Stream failure stats and config
router.get('/interdiction/stream/status', authorize('admin:all'), (req, res) => {
  try {
    const result = getStreamFailureStats();
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Audit] stream_interdiction_status_failed:', err.message);
    sendError(res, 500, 'stream_interdiction_status_failed', { message: err.message });
  }
});

// POST /api/audit/interdiction/stream/clear — Clear all stream failures
router.post('/interdiction/stream/clear', authorize('admin:all'), (req, res) => {
  try {
    const cleared = clearStreamFailures();
    logger.info('[Audit] stream_failures_cleared by user:', getActor(req).actorEmail, 'count:', cleared);
    res.json({ success: true, cleared });
  } catch (err) {
    logger.warn('[Audit] stream_interdiction_clear_failed:', err.message);
    sendError(res, 500, 'stream_interdiction_clear_failed', { message: err.message });
  }
});

// POST /api/audit/interdiction/stream/record — Manually record a stream failure
//   Body: { apiKey: string, failureType: string, detail?: string }
router.post('/interdiction/stream/record', authorize('admin:all'), (req, res) => {
  try {
    const { apiKey, failureType, detail } = req.body || {};
    if (!apiKey) {
      sendError(res, 400, 'missing_api_key', { message: 'apiKey is required' });
      return;
    }
    if (!failureType) {
      sendError(res, 400, 'missing_failure_type', { message: 'failureType is required' });
      return;
    }
    const result = recordStreamFailure(apiKey, failureType, detail);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Audit] stream_interdiction_record_failed:', err.message);
    sendError(res, 500, 'stream_interdiction_record_failed', { message: err.message });
  }
});

// ── Audit Retention Policy Routes ───────────────────────────────────────────
//   Admin-only routes for configuring and triggering audit log retention.

// GET /api/audit/retention/config — Get retention policy for caller's org
router.get('/retention/config', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const policy = auditPolicyStore.getPolicy(orgId);
    res.json({ success: true, orgId, policy });
  } catch (err) {
    logger.warn('[Audit] retention_config_get_failed:', err.message);
    sendError(res, 500, 'retention_config_get_failed', { message: err.message });
  }
});

// PUT /api/audit/retention/config — Update retention policy for caller's org
router.put('/retention/config', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = auditPolicyStore.setPolicy(orgId, req.body || {});
    if (!result.success) {
      return sendError(res, 400, 'retention_config_update_failed', { message: result.error });
    }
    logger.info(`[Audit] Retention policy updated by ${req.user?.email || 'admin'} for org ${orgId}`);
    try {
      auditLogger.log({
        orgId,
        actorId: req.user?.id || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        action: 'retention_policy_update',
        entity: 'audit_settings',
        entityId: 'retention',
        metadata: result.policy,
      });
    } catch (logErr) {
      logger.warn('[Audit] Failed to audit-log retention policy update:', logErr.message);
    }
    res.json({ success: true, orgId, policy: result.policy });
  } catch (err) {
    logger.warn('[Audit] retention_config_update_failed:', err.message);
    sendError(res, 500, 'retention_config_update_failed', { message: err.message });
  }
});

// GET /api/audit/retention/stats — Get retention stats for caller's org
router.get('/retention/stats', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = auditLogger.getRetentionStats(orgId);
    // Attach autonomous lifecycle purge stats (global worker telemetry)
    let autoPurgeStats = null;
    try {
      if (typeof auditLogger.getLifecyclePurgeStats === 'function') {
        autoPurgeStats = auditLogger.getLifecyclePurgeStats();
      }
    } catch (e) {
      logger.warn('[Audit] failed to fetch lifecycle purge stats:', e.message);
    }
    res.json({ success: true, orgId, ...stats, autoPurgeStats });
  } catch (err) {
    logger.warn('[Audit] retention_stats_failed:', err.message);
    sendError(res, 500, 'retention_stats_failed', { message: err.message });
  }
});

// POST /api/audit/retention/purge — Trigger purge of old entries
router.post('/retention/purge', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = auditLogger.purgeOldEntries(orgId);
    logger.info(`[Audit] Retention purge triggered by ${req.user?.email || 'admin'} for org ${orgId}: ${result.purged} purged, ${result.remaining} remaining`);
    try {
      auditLogger.log({
        orgId,
        actorId: req.user?.id || 'unknown',
        actorEmail: req.user?.email || 'unknown',
        action: 'retention_purge',
        entity: 'audit_log',
        entityId: 'purge',
        metadata: result,
      });
    } catch (logErr) {
      logger.warn('[Audit] Failed to audit-log retention purge:', logErr.message);
    }
    res.json({ success: true, orgId, ...result });
  } catch (err) {
    logger.warn('[Audit] retention_purge_failed:', err.message);
    sendError(res, 500, 'retention_purge_failed', { message: err.message });
  }
});

// GET /api/audit/cluster/keyring — Cluster keyring status (admin only)
router.get('/cluster/keyring', authorize('admin:all'), (req, res) => {
  try {
    res.json({ success: true, status: clusterSync.getStatus() });
  } catch (err) {
    logger.warn('[Audit] cluster_keyring_status_failed:', err.message);
    sendError(res, 500, 'cluster_keyring_status_failed', { message: err.message });
  }
});

// POST /api/audit/cluster/keyring/rotate — Coordinate cluster-wide rotation (leader only)
router.post('/cluster/keyring/rotate', authorize('admin:all'), (req, res) => {
  try {
    const { newKeyRaw, graceMs } = req.body || {};
    if (!newKeyRaw) {
      return sendError(res, 400, 'missing_new_key', { message: 'newKeyRaw is required' });
    }
    const status = clusterSync.proposeRotate(newKeyRaw, graceMs);
    res.json({ success: true, status });
  } catch (err) {
    if (err.statusCode === 423) {
      return sendError(res, 423, 'not_leader', { message: err.message });
    }
    logger.warn('[Audit] cluster_keyring_rotate_failed:', err.message);
    sendError(res, 500, 'cluster_keyring_rotate_failed', { message: err.message });
  }
});

// GET /api/audit/cluster/events — Cluster event timeline (admin only, Sync.com-style)
//   Query params: eventType, node, startDate, endDate, limit, offset
router.get('/cluster/events', authorize('admin:all'), (req, res) => {
  try {
    const { eventType, node, startDate, endDate } = req.query || {};
    const events = clusterSync.queryEvents({
      eventType,
      node,
      startDate,
      endDate,
      limit: Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    const stats = clusterSync.getEventStats();
    res.json({ success: true, ...events, stats });
  } catch (err) {
    logger.warn('[Audit] cluster_events_failed:', err.message);
    sendError(res, 500, 'cluster_events_failed', { message: err.message });
  }
});

// GET /api/audit/archive/search — Search cold archive (admin only)
router.get('/archive/search', authorize('admin:all'), async (req, res) => {
  try {
    const { startDate, endDate, action, orgId, limit, offset } = req.query || {};
    const result = await coldArchiveSearch.search({ startDate, endDate, action, orgId, limit, offset });
    res.json({ success: true, ...result });
  } catch (err) {
    if (err.statusCode === 400) {
      return sendError(res, 400, err.message, { message: err.message });
    }
    logger.warn('[Audit] archive_search_failed:', err.message);
    sendError(res, 500, 'archive_search_failed', { message: err.message });
  }
});

// GET /api/audit/compliance/report — Generate compliance report (JSON or CSV)
router.get('/compliance/report', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const format = req.query.format === 'csv' ? 'csv' : 'json';
    const report = auditLogger.generateComplianceReport(orgId);

    if (format === 'csv') {
      const csv = auditLogger.complianceReportToCsv(report);
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="compliance_proof_${report.reportId}.csv"`);
      return res.status(200).send(csv);
    }

    res.json({ success: true, report });
  } catch (err) {
    logger.warn('[Audit] compliance_report_failed:', err.message);
    sendError(res, 500, 'compliance_report_failed', { message: err.message });
  }
});

// ── PII Policy Sync Routes ───────────────────────────────────────────────────
router.get('/pii/frameworks', authorize('admin:all'), (req, res) => {
  try { res.json({ success: true, frameworks: piiPolicyStore.COMPLIANCE_FRAMEWORKS }); }
  catch (err) { logger.warn('[Audit] pii_frameworks_failed:', err.message); sendError(res, 500, 'pii_frameworks_failed', { message: err.message }); }
});
router.get('/pii/orgs', authorize('admin:all'), (req, res) => {
  try {
    const orgIds = piiPolicyStore.getAllOrgIds();
    const orgDetails = orgIds.map((orgId) => {
      const stats = piiPolicyStore.getStats(orgId);
      return { orgId, totalPolicies: stats.totalPolicies || 0, enabledPolicies: stats.enabledPolicies || 0, disabledPolicies: (stats.totalPolicies||0)-(stats.enabledPolicies||0), bySeverity: stats.bySeverity||{}, byCompliance: stats.byCompliance||{} };
    });
    res.json({ success: true, orgs: orgDetails, total: orgDetails.length });
  } catch (err) { logger.warn('[Audit] pii_orgs_list_failed:', err.message); sendError(res, 500, 'pii_orgs_list_failed', { message: err.message }); }
});
router.get('/pii/policies/:orgId', authorize('admin:all'), (req, res) => {
  try {
    const { orgId } = req.params;
    if (!orgId) return sendError(res, 400, 'invalid_org_id', { message: 'orgId is required' });
    const policies = piiPolicyStore.getPolicies(orgId);
    res.json({ success: true, orgId, policies, total: policies.length });
  } catch (err) { logger.warn('[Audit] pii_policies_get_failed:', err.message); sendError(res, 500, 'pii_policies_get_failed', { message: err.message }); }
});
router.post('/pii/sync-preview', authorize('admin:all'), (req, res) => {
  try {
    const { sourceOrgId, targetOrgIds, mode, compliance, severity, isDefault } = req.body || {};
    if (!sourceOrgId) return sendError(res, 400, 'invalid_request', { message: 'sourceOrgId is required' });
    let sourcePolicies = piiPolicyStore.getPolicies(sourceOrgId);
    const cf = Array.isArray(compliance) ? compliance : null;
    const sf = Array.isArray(severity) ? severity : null;
    const df = typeof isDefault === 'boolean' ? isDefault : null;
    if (cf) sourcePolicies = sourcePolicies.filter((p) => Array.isArray(p.compliance) && p.compliance.some((c) => cf.includes(c)));
    if (sf) sourcePolicies = sourcePolicies.filter((p) => sf.includes(p.severity));
    if (df !== null) sourcePolicies = sourcePolicies.filter((p) => Boolean(p.isDefault) === df);
    const allOrgs = piiPolicyStore.getAllOrgIds();
    const targets = Array.isArray(targetOrgIds) && targetOrgIds.length > 0 ? targetOrgIds.filter((o) => o !== sourceOrgId) : allOrgs.filter((o) => o !== sourceOrgId);
    const syncMode = mode === 'replace' ? 'replace' : 'merge';
    const previews = targets.map((tid) => {
      const tp = piiPolicyStore.getPolicies(tid);
      const ek = new Set(tp.map((p) => p.name + '::' + p.pattern));
      let wc = 0, ws = 0, wr = 0;
      if (syncMode === 'replace') wr = tp.length;
      for (const src of sourcePolicies) { const k = src.name + '::' + src.pattern; if (syncMode === 'merge' && ek.has(k)) ws++; else wc++; }
      return { orgId: tid, mode: syncMode, sourcePolicyCount: sourcePolicies.length, targetPolicyCount: tp.length, wouldClone: wc, wouldSkip: ws, wouldRemove: wr };
    });
    res.json({ success: true, sourceOrgId, sourcePolicyCount: sourcePolicies.length, mode: syncMode, targetCount: targets.length, previews });
  } catch (err) { logger.warn('[Audit] pii_sync_preview_failed:', err.message); sendError(res, 500, 'pii_sync_preview_failed', { message: err.message }); }
});
router.post('/pii/sync', authorize('admin:all'), (req, res) => {
  try {
    const { sourceOrgId, targetOrgIds, mode, compliance, severity, isDefault } = req.body || {};
    if (!sourceOrgId) return sendError(res, 400, 'invalid_request', { message: 'sourceOrgId is required' });
    const allOrgs = piiPolicyStore.getAllOrgIds();
    const targets = Array.isArray(targetOrgIds) && targetOrgIds.length > 0 ? targetOrgIds.filter((o) => o !== sourceOrgId) : allOrgs.filter((o) => o !== sourceOrgId);
    if (targets.length === 0) return sendError(res, 400, 'no_targets', { message: 'No target orgs available to sync to' });
    const options = {};
    if (mode) options.mode = mode;
    if (Array.isArray(compliance)) options.compliance = compliance;
    if (Array.isArray(severity)) options.severity = severity;
    if (typeof isDefault === 'boolean') options.isDefault = isDefault;
    const result = piiPolicyStore.syncPoliciesToOrgs(sourceOrgId, targets, options);
    try { auditLogger.log({ orgId: getOrgId(req), actorId: req.user?.id || 'unknown', actorEmail: req.user?.email || 'unknown', action: 'pii_policy_sync', entity: 'pii_policies', entityId: sourceOrgId, metadata: { sourceOrgId, targetCount: targets.length, mode: options.mode || 'merge', totalCloned: result.totalCloned, totalSkipped: result.totalSkipped, totalRemoved: result.totalRemoved } }); } catch (logErr) { logger.warn('[Audit] Failed to audit-log PII policy sync:', logErr.message); }
    logger.info('[Audit] pii_policy_sync source:', sourceOrgId, 'targets:', targets.length, 'cloned:', result.totalCloned);
    res.json({ success: true, ...result });
  } catch (err) { logger.warn('[Audit] pii_sync_failed:', err.message); sendError(res, 500, 'pii_sync_failed', { message: err.message }); }
});


// GET /api/audit/pii/sync-history — Aggregated sync history for dashboard charting
//   Query params: limit (default 50, max 200), days (default 30, max 365)
router.get('/pii/sync-history', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 200);
    const days = Math.min(Math.max(parseInt(req.query.days, 10) || 30, 1), 365);
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

    // Query all pii_policy_sync entries within the time window
    const result = auditLogger.query({
      orgId,
      action: 'pii_policy_sync',
      startDate,
      limit: 500,
      offset: 0,
    });

    const entries = result.entries || [];

    // Build aggregated data for charts
    // 1. Timeline data — group by day
    const byDay = {};
    // 2. By mode — merge vs replace counts
    let mergeCount = 0;
    let replaceCount = 0;
    // 3. Totals
    let totalCloned = 0;
    let totalSkipped = 0;
    let totalRemoved = 0;
    // 4. By actor
    const byActor = {};
    // 5. By source org
    const bySourceOrg = {};

    for (const entry of entries) {
      const meta = entry.metadata || {};
      const day = entry.timestamp.slice(0, 10); // YYYY-MM-DD

      // Timeline
      if (!byDay[day]) {
        byDay[day] = { date: day, syncs: 0, cloned: 0, skipped: 0, removed: 0 };
      }
      byDay[day].syncs++;
      byDay[day].cloned += meta.totalCloned || 0;
      byDay[day].skipped += meta.totalSkipped || 0;
      byDay[day].removed += meta.totalRemoved || 0;

      // Mode
      if (meta.mode === 'replace') replaceCount++;
      else mergeCount++;

      // Totals
      totalCloned += meta.totalCloned || 0;
      totalSkipped += meta.totalSkipped || 0;
      totalRemoved += meta.totalRemoved || 0;

      // By actor
      const actor = entry.actorEmail || entry.actorId || 'unknown';
      if (!byActor[actor]) byActor[actor] = { actor, syncs: 0, cloned: 0 };
      byActor[actor].syncs++;
      byActor[actor].cloned += meta.totalCloned || 0;

      // By source org
      const srcOrg = meta.sourceOrgId || 'unknown';
      if (!bySourceOrg[srcOrg]) bySourceOrg[srcOrg] = { sourceOrg: srcOrg, syncs: 0, cloned: 0 };
      bySourceOrg[srcOrg].syncs++;
      bySourceOrg[srcOrg].cloned += meta.totalCloned || 0;
    }

    // Convert to sorted arrays
    const timeline = Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date));
    const actors = Object.values(byActor).sort((a, b) => b.syncs - a.syncs).slice(0, 10);
    const sourceOrgs = Object.values(bySourceOrg).sort((a, b) => b.syncs - a.syncs).slice(0, 10);

    // Recent sync events (most recent first, limited)
    const recent = entries.slice(0, limit).map((e) => ({
      id: e.id,
      timestamp: e.timestamp,
      actorEmail: e.actorEmail,
      sourceOrgId: e.metadata?.sourceOrgId || 'unknown',
      targetCount: e.metadata?.targetCount || 0,
      mode: e.metadata?.mode || 'merge',
      totalCloned: e.metadata?.totalCloned || 0,
      totalSkipped: e.metadata?.totalSkipped || 0,
      totalRemoved: e.metadata?.totalRemoved || 0,
    }));

    res.json({
      success: true,
      totalSyncs: entries.length,
      totalCloned,
      totalSkipped,
      totalRemoved,
      mergeCount,
      replaceCount,
      timeline,
      actors,
      sourceOrgs,
      recent,
      days,
    });
  } catch (err) {
    logger.warn('[Audit] pii_sync_history_failed:', err.message);
    sendError(res, 500, 'pii_sync_history_failed', { message: err.message });
  }
});

module.exports = router;
