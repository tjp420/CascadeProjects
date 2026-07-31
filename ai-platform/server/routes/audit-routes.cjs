'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const auditPolicyStore = require('../lib/audit-policy-store.cjs');
const logStreamAnalyzer = require('../lib/log-stream-analyzer.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../../src/lib/app-logger.cjs');
const { processEvent } = require('../lib/alert-dispatcher.cjs');

// Wire stream analyzer events to the alert dispatcher
logStreamAnalyzer.setStreamEventCallback((event) => {
  const eventType = event.type === 'LOG_STREAM_BURST' ? 'log_stream_burst' : 'log_stream_anomaly';
  processEvent(event.orgId, eventType, {
    severity: event.severity,
    message: event.message,
    data: event.data,
  }).catch((err) => {
    logger.warn('[Audit] Stream event alert trigger failed:', err.message);
  });
});

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
    logger.warn('[Audit] audit_query_failed failed:', err.message);
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
    logger.warn('[Audit] audit_stats_failed failed:', err.message);
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
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.json"`
      );
      res.send(JSON.stringify(result.entries, null, 2));
      return;
    }

    // CSV format
    const headers = [
      'Timestamp',
      'ID',
      'Action',
      'Entity',
      'Entity ID',
      'Actor ID',
      'Actor Email',
      'Changes',
    ];
    const rows = [headers.join(',')];
    for (const e of result.entries) {
      const changes = e.changes
        .map((c) => `${c.field}: ${JSON.stringify(c.oldValue)} -> ${JSON.stringify(c.newValue)}`)
        .join('; ');
      rows.push(
        [
          e.timestamp,
          e.id,
          e.action,
          e.entity,
          e.entityId,
          e.actorId,
          e.actorEmail,
          `"${changes.replace(/"/g, '""')}"`,
        ].join(',')
      );
    }
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="audit-log-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(rows.join('\n'));
  } catch (err) {
    logger.warn('[Audit] audit_export_failed failed:', err.message);
    sendError(res, 500, 'audit_export_failed', { message: err.message });
  }
});

// ── DELETE /api/audit/log/:entryId ──────────────────────────────────────────
//   Delete an audit log entry and trigger audit_delete alert event
router.delete('/log/:entryId', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { entryId } = req.params;
    if (!entryId) {
      sendError(res, 400, 'invalid_params', { message: 'entryId is required' });
      return;
    }

    const deleted = auditLogger.deleteEntry(orgId, entryId);
    if (!deleted) {
      sendError(res, 404, 'audit_entry_not_found', { message: 'Audit entry not found' });
      return;
    }

    // Trigger audit_delete alert event
    processEvent(orgId, 'audit_delete', {
      severity: 'high',
      message: `Audit entry deleted: ${deleted.action} on ${deleted.entity}`,
      data: {
        entryId: deleted.id,
        action: deleted.action,
        entity: deleted.entity,
        entityId: deleted.entityId,
        actorId: deleted.actorId,
        deletedBy: getActor(req).actorId,
      },
    }).catch((err) => {
      logger.warn('[Audit] audit_delete alert trigger failed:', err.message);
    });

    res.json({ success: true, deleted: deleted.id });
  } catch (err) {
    logger.warn('[Audit] audit_delete_failed:', err.message);
    sendError(res, 500, 'audit_delete_failed', { message: err.message });
  }
});

// ── GET /api/audit/policy ───────────────────────────────────────────────────
//   Get the current retention policy for the authenticated org
router.get('/policy', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const policy = auditPolicyStore.getPolicy(orgId);
    res.json({ success: true, orgId, policy });
  } catch (err) {
    logger.warn('[Audit] audit_policy_get_failed:', err.message);
    sendError(res, 500, 'audit_policy_get_failed', { message: err.message });
  }
});

// ── PUT /api/audit/policy ───────────────────────────────────────────────────
//   Update retention policy for the authenticated org
//   Body: { retentionDays?, maxEntries?, archiveEnabled?, archiveAfterDays? }
router.put('/policy', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const updates = {};

    if (req.body.retentionDays !== undefined) {
      const v = Number(req.body.retentionDays);
      if (!Number.isFinite(v) || v < 1 || v > 3650) {
        sendError(res, 400, 'invalid_params', { message: 'retentionDays must be 1-3650' });
        return;
      }
      updates.retentionDays = Math.floor(v);
    }
    if (req.body.maxEntries !== undefined) {
      const v = Number(req.body.maxEntries);
      if (!Number.isFinite(v) || v < 100 || v > 100000) {
        sendError(res, 400, 'invalid_params', { message: 'maxEntries must be 100-100000' });
        return;
      }
      updates.maxEntries = Math.floor(v);
    }
    if (req.body.archiveEnabled !== undefined) {
      updates.archiveEnabled = Boolean(req.body.archiveEnabled);
    }
    if (req.body.archiveAfterDays !== undefined) {
      const v = Number(req.body.archiveAfterDays);
      if (!Number.isFinite(v) || v < 1 || v > 3650) {
        sendError(res, 400, 'invalid_params', { message: 'archiveAfterDays must be 1-3650' });
        return;
      }
      updates.archiveAfterDays = Math.floor(v);
    }

    const policy = auditPolicyStore.setPolicy(orgId, updates);
    logger.info(`[Audit] Policy updated for org ${orgId}:`, updates);
    res.json({ success: true, orgId, policy });
  } catch (err) {
    logger.warn('[Audit] audit_policy_update_failed:', err.message);
    sendError(res, 500, 'audit_policy_update_failed', { message: err.message });
  }
});

// ── POST /api/audit/policy/reset ────────────────────────────────────────────
//   Reset retention policy to defaults for the authenticated org
router.post('/policy/reset', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const policy = auditPolicyStore.resetPolicy(orgId);
    logger.info(`[Audit] Policy reset to defaults for org ${orgId}`);
    res.json({ success: true, orgId, policy });
  } catch (err) {
    logger.warn('[Audit] audit_policy_reset_failed:', err.message);
    sendError(res, 500, 'audit_policy_reset_failed', { message: err.message });
  }
});

// ── POST /api/audit/retention/enforce ───────────────────────────────────────
//   Manually trigger retention enforcement for the authenticated org
router.post('/retention/enforce', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = auditLogger.enforceRetentionPolicy(orgId);
    logger.info(
      `[Audit] Retention enforced for org ${orgId}: archived=${result.archived} deleted=${result.deleted} remaining=${result.remaining}`
    );

    // Trigger alert event for retention enforcement
    processEvent(orgId, 'audit_retention_enforced', {
      severity: 'medium',
      message: `Audit retention enforced: ${result.archived} archived, ${result.deleted} deleted`,
      data: { orgId, ...result },
    }).catch((err) => {
      logger.warn('[Audit] retention alert trigger failed:', err.message);
    });

    res.json({ success: true, orgId, result });
  } catch (err) {
    logger.warn('[Audit] audit_retention_enforce_failed:', err.message);
    sendError(res, 500, 'audit_retention_enforce_failed', { message: err.message });
  }
});

// ── GET /api/audit/report ───────────────────────────────────────────────────
//   Generate a compliance report for the authenticated org
//   Query params: startDate, endDate (ISO timestamps)
router.get('/report', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const report = auditLogger.generateComplianceReport(orgId, {
      startDate: req.query.startDate || '',
      endDate: req.query.endDate || '',
    });
    res.json({ success: true, report });
  } catch (err) {
    logger.warn('[Audit] audit_report_failed:', err.message);
    sendError(res, 500, 'audit_report_failed', { message: err.message });
  }
});

// ── GET /api/audit/stream/stats ─────────────────────────────────────────────
//   Get real-time stream analyzer stats (burst detection + anomaly tracking)
router.get('/stream/stats', (req, res) => {
  try {
    const stats = logStreamAnalyzer.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    logger.warn('[Audit] audit_stream_stats_failed:', err.message);
    sendError(res, 500, 'audit_stream_stats_failed', { message: err.message });
  }
});

router.get('/verify', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = auditLogger.verifyChain(orgId);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Audit] audit_verify_failed:', err.message);
    sendError(res, 500, 'audit_verify_failed', { message: err.message });
  }
});

module.exports = router;
