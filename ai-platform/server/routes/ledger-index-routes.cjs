'use strict';

/**
 * Ledger Index API — Endpoints for index management and query performance.
 *
 * Endpoints:
 *   GET  /api/ledger/stats           — Index engine stats
 *   POST /api/ledger/rebuild         — Rebuild all indexes from stores
 *   GET  /api/ledger/rollups         — Daily rollups for org
 *   GET  /api/ledger/hourly-actions  — Hourly action counts for org
 *
 * @module ledger-index-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const ledgerIndexEngine = require('../lib/ledger-index-engine.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

// GET /api/ledger/stats
router.get('/stats', (req, res) => {
  try {
    const stats = ledgerIndexEngine.getStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.warn('[LedgerIndex] stats_failed:', err.message);
    sendError(res, 500, 'ledger_stats_failed', { message: err.message });
  }
});

// POST /api/ledger/rebuild — rebuild all indexes (admin only)
router.post('/rebuild', authorize('admin:all'), (req, res) => {
  try {
    const fs = require('fs');
    const path = require('path');

    let auditStore = null;
    let analyticsStore = null;

    const auditPath = path.join(process.cwd(), '.simplebeacon', 'audit-log.json');
    if (fs.existsSync(auditPath)) {
      auditStore = JSON.parse(fs.readFileSync(auditPath, 'utf8'));
    }

    const analyticsPath = path.join(process.cwd(), '.simplebeacon', 'usage-analytics.json');
    if (fs.existsSync(analyticsPath)) {
      analyticsStore = JSON.parse(fs.readFileSync(analyticsPath, 'utf8'));
    }

    ledgerIndexEngine.rebuildAll(auditStore, analyticsStore);

    const stats = ledgerIndexEngine.getStats();
    logger.info(`[LedgerIndex] Rebuild triggered by ${req.user?.email || 'admin'}`);
    res.json({ success: true, message: 'Indexes rebuilt', stats });
  } catch (err) {
    logger.error('[LedgerIndex] rebuild_failed:', err.message);
    sendError(res, 500, 'ledger_rebuild_failed', { message: err.message });
  }
});

// GET /api/ledger/rollups?startDate=&endDate=
router.get('/rollups', (req, res) => {
  try {
    const orgId = req.user?.id || req.user?.email || 'default';
    const { startDate, endDate } = req.query;
    const rollups = ledgerIndexEngine.getDailyRollups(orgId, startDate, endDate);
    res.json({ success: true, rollups });
  } catch (err) {
    logger.warn('[LedgerIndex] rollups_failed:', err.message);
    sendError(res, 500, 'ledger_rollups_failed', { message: err.message });
  }
});

// GET /api/ledger/hourly-actions?hours=24
router.get('/hourly-actions', (req, res) => {
  try {
    const orgId = req.user?.id || req.user?.email || 'default';
    const hours = parseInt(req.query.hours, 10) || 24;
    const actions = ledgerIndexEngine.getHourlyActions(orgId, hours);
    res.json({ success: true, actions });
  } catch (err) {
    logger.warn('[LedgerIndex] hourly_actions_failed:', err.message);
    sendError(res, 500, 'ledger_hourly_actions_failed', { message: err.message });
  }
});

module.exports = router;
