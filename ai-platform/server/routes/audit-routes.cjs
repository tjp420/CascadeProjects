'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../../src/lib/app-logger.cjs');
const { processEvent } = require('../lib/alert-dispatcher.cjs');

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

module.exports = router;
