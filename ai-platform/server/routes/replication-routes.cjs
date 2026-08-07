'use strict';

/**
 * Regional Replication Routes
 *
 * Express routes for cross-zone scan report and telemetry replication.
 *
 * Endpoints:
 *   POST /api/replication/sync           - Sync a payload to one or all zones
 *   GET  /api/replication/status         - Get replication status for all zones
 *   GET  /api/replication/status/:zone   - Get per-zone replication status
 *   GET  /api/replication/conflicts      - List pending conflicts
 *   POST /api/replication/resolve-conflict - Manually resolve a conflict
 *
 * @module replication-routes
 */

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const { sendError, sendSuccess } = require('../lib/response-helpers.cjs');
const { RegionalReplicationRouter, CONFLICT_STRATEGIES } = require('../lib/regional-replication-router.cjs');

const router = express.Router();

// Shared router instance (singleton)
let _replicationRouter = null;

/**
 * Get or create the shared replication router instance.
 * @returns {RegionalReplicationRouter}
 */
function getReplicationRouter() {
  if (!_replicationRouter) {
    _replicationRouter = new RegionalReplicationRouter();
  }
  return _replicationRouter;
}

// All routes require authentication
router.use(authenticate);

/**
 * POST /api/replication/sync
 * Body: { zone?: string, payload: { type, data, version?, timestamp? } }
 * If zone is omitted, syncs to all zones.
 */
router.post('/sync', async (req, res) => {
  try {
    const { zone, payload } = req.body || {};
    if (!payload) {
      return sendError(res, 400, 'missing_payload', { message: 'Request body must include a payload object' });
    }
    const replicationRouter = getReplicationRouter();
    if (zone) {
      const result = await replicationRouter.sync(zone, payload);
      return sendSuccess(res, { result });
    }
    const results = await replicationRouter.syncAll(payload);
    return sendSuccess(res, { results });
  } catch (err) {
    return sendError(res, 500, 'sync_failed', { message: err.message });
  }
});

/**
 * GET /api/replication/status
 * Returns status for all zones.
 */
router.get('/status', (req, res) => {
  const replicationRouter = getReplicationRouter();
  const status = replicationRouter.getStatus();
  return sendSuccess(res, { zones: status });
});

/**
 * GET /api/replication/status/:zone
 * Returns status for a specific zone.
 */
router.get('/status/:zone', (req, res) => {
  const { zone } = req.params;
  const replicationRouter = getReplicationRouter();
  const status = replicationRouter.getZoneStatus(zone);
  if (!status) {
    return sendError(res, 404, 'zone_not_found', { message: `Zone not found: ${zone}` });
  }
  return sendSuccess(res, { zone: status });
});

/**
 * GET /api/replication/conflicts
 * Lists all pending conflicts.
 */
router.get('/conflicts', (req, res) => {
  const replicationRouter = getReplicationRouter();
  const conflicts = replicationRouter.getConflicts();
  return sendSuccess(res, { conflicts, count: conflicts.length });
});

/**
 * POST /api/replication/resolve-conflict
 * Body: { conflictId, strategy, manualPayload? }
 */
router.post('/resolve-conflict', (req, res) => {
  try {
    const { conflictId, strategy, manualPayload } = req.body || {};
    if (!conflictId) {
      return sendError(res, 400, 'missing_conflict_id', { message: 'conflictId is required' });
    }
    if (!strategy) {
      return sendError(res, 400, 'missing_strategy', { message: 'strategy is required (latest-wins or manual)' });
    }
    const replicationRouter = getReplicationRouter();
    const result = replicationRouter.resolveConflict(conflictId, strategy, manualPayload);
    return sendSuccess(res, { result });
  } catch (err) {
    return sendError(res, 500, 'resolution_failed', { message: err.message });
  }
});

module.exports = router;
