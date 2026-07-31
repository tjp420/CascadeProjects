'use strict';

/**
 * Session Audit API — Endpoints for querying conversation histories
 * and replay data for compliance teams.
 *
 * Endpoints:
 *   GET  /api/session-audit/sessions          — List sessions (paginated, filtered)
 *   GET  /api/session-audit/sessions/:id      — Get full session with all turns
 *   GET  /api/session-audit/sessions/:id/turns/:turnId — Get specific turn
 *   DELETE /api/session-audit/sessions/:id    — Delete session (admin:all)
 *   GET  /api/session-audit/stats             — Get aggregate stats
 *
 * @module session-audit-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const sessionAuditStore = require('../lib/session-audit-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

// GET /api/session-audit/sessions
router.get('/sessions', (req, res) => {
  try {
    const options = {
      userId: req.query.userId,
      orgId: req.query.orgId,
      provider: req.query.provider,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    };
    const result = sessionAuditStore.listSessions(options);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[SessionAudit] list_sessions_failed:', err.message);
    sendError(res, 500, 'list_sessions_failed', { message: err.message });
  }
});

// GET /api/session-audit/sessions/:id
router.get('/sessions/:id', (req, res) => {
  try {
    const session = sessionAuditStore.getSession(req.params.id);
    if (!session) return sendError(res, 404, 'session_not_found');
    res.json({ success: true, session });
  } catch (err) {
    logger.warn('[SessionAudit] get_session_failed:', err.message);
    sendError(res, 500, 'get_session_failed', { message: err.message });
  }
});

// GET /api/session-audit/sessions/:id/turns/:turnId
router.get('/sessions/:id/turns/:turnId', (req, res) => {
  try {
    const turn = sessionAuditStore.getTurn(req.params.id, req.params.turnId);
    if (!turn) return sendError(res, 404, 'turn_not_found');
    res.json({ success: true, turn });
  } catch (err) {
    logger.warn('[SessionAudit] get_turn_failed:', err.message);
    sendError(res, 500, 'get_turn_failed', { message: err.message });
  }
});

// DELETE /api/session-audit/sessions/:id
router.delete('/sessions/:id', authorize('admin:all'), (req, res) => {
  try {
    const result = sessionAuditStore.deleteSession(req.params.id);
    if (!result.success) return sendError(res, 404, 'session_not_found');
    logger.info(`[SessionAudit] Session deleted by ${req.user?.email || 'admin'}: ${req.params.id}`);
    res.json({ success: true });
  } catch (err) {
    logger.warn('[SessionAudit] delete_session_failed:', err.message);
    sendError(res, 500, 'delete_session_failed', { message: err.message });
  }
});

// GET /api/session-audit/stats
router.get('/stats', (req, res) => {
  try {
    const stats = sessionAuditStore.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    logger.warn('[SessionAudit] stats_failed:', err.message);
    sendError(res, 500, 'stats_failed', { message: err.message });
  }
});

module.exports = router;
