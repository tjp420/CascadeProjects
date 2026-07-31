'use strict';

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const retentionStore = require('../lib/data-retention-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

router.get('/config', (req, res) => {
  try {
    const config = retentionStore.getConfig();
    res.json({ success: true, config });
  } catch (err) {
    sendError(res, 500, 'retention_config_failed', { message: err.message });
  }
});

router.put('/config', authorize('admin:all'), (req, res) => {
  try {
    const result = retentionStore.updateConfig(req.body || {});
    logger.info(`[DataRetention] Config updated by ${req.user?.email || 'admin'}`);
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'retention_config_update_failed', { message: err.message });
  }
});

router.post('/config/reset', authorize('admin:all'), (req, res) => {
  try {
    const result = retentionStore.resetConfig();
    logger.info(`[DataRetention] Config reset by ${req.user?.email || 'admin'}`);
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'retention_config_reset_failed', { message: err.message });
  }
});

router.put('/policies/:catId', authorize('admin:all'), (req, res) => {
  try {
    const result = retentionStore.updatePolicy(req.params.catId, req.body || {});
    if (!result.success) {
      return sendError(res, 400, 'policy_update_failed', { message: result.error });
    }
    logger.info(`[DataRetention] Policy ${req.params.catId} updated by ${req.user?.email || 'admin'}`);
    res.json({ success: true, policy: result.policy });
  } catch (err) {
    sendError(res, 500, 'policy_update_failed', { message: err.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = retentionStore.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'retention_stats_failed', { message: err.message });
  }
});

router.get('/history', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 20;
    const history = retentionStore.getPurgeHistory(limit);
    res.json({ success: true, history, count: history.length });
  } catch (err) {
    sendError(res, 500, 'retention_history_failed', { message: err.message });
  }
});

router.post('/purge', authorize('admin:all'), (req, res) => {
  try {
    const result = retentionStore.runPurge({ userId: req.user?.email || 'admin' });
    logger.info(`[DataRetention] Manual purge by ${req.user?.email || 'admin'}: ${result.totalPurged} items`);
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, 'purge_failed', { message: err.message });
  }
});

router.post('/purge/preview', authorize('admin:all'), (req, res) => {
  try {
    const result = retentionStore.previewPurge();
    res.json({ success: true, ...result });
  } catch (err) {
    sendError(res, 500, 'purge_preview_failed', { message: err.message });
  }
});

router.post('/history/clear', authorize('admin:all'), (req, res) => {
  try {
    retentionStore.clearHistory();
    logger.info(`[DataRetention] History cleared by ${req.user?.email || 'admin'}`);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'history_clear_failed', { message: err.message });
  }
});

module.exports = router;
