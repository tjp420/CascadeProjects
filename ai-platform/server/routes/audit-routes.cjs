'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const { authorize, enforceOrgPartition, getPartitionStats, getPartitionViolations } = require('../middleware/authorize.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs').child('audit-routes');

const router = express.Router();

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

module.exports = router;
