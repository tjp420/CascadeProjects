'use strict';

/**
 * Content Moderation API — Endpoints for managing moderation policies,
 * viewing flagged content, and testing toxicity scoring.
 *
 * Endpoints:
 *   GET  /api/content-moderation/config           — Get moderation config
 *   PUT  /api/content-moderation/config            — Update config (admin:all)
 *   POST /api/content-moderation/config/reset      — Reset to defaults (admin:all)
 *   GET  /api/content-moderation/flagged           — List flagged content
 *   GET  /api/content-moderation/stats             — Get moderation stats
 *   POST /api/content-moderation/test              — Test text scoring (admin:all)
 *   POST /api/content-moderation/flagged/clear     — Clear flagged content (admin:all)
 *
 * @module content-moderation-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const moderationStore = require('../lib/content-moderation-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

router.get('/config', (req, res) => {
  try {
    const config = moderationStore.getConfig();
    res.json({ success: true, config });
  } catch (err) {
    sendError(res, 500, 'moderation_config_failed', { message: err.message });
  }
});

router.put('/config', authorize('admin:all'), (req, res) => {
  try {
    const result = moderationStore.updateConfig(req.body || {});
    logger.info(`[ContentMod] Config updated by ${req.user?.email || 'admin'}`);
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'moderation_update_failed', { message: err.message });
  }
});

router.post('/config/reset', authorize('admin:all'), (req, res) => {
  try {
    const result = moderationStore.resetConfig();
    logger.info(`[ContentMod] Config reset by ${req.user?.email || 'admin'}`);
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'moderation_reset_failed', { message: err.message });
  }
});

router.get('/flagged', (req, res) => {
  try {
    const filter = {
      verdict: req.query.verdict,
      direction: req.query.direction,
      userId: req.query.userId,
      minScore: req.query.minScore ? parseInt(req.query.minScore, 10) : undefined,
    };
    const limit = parseInt(req.query.limit, 10) || 50;
    const flagged = moderationStore.getFlaggedContent(limit, filter);
    res.json({ success: true, flagged, count: flagged.length });
  } catch (err) {
    sendError(res, 500, 'moderation_flagged_failed', { message: err.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const stats = moderationStore.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'moderation_stats_failed', { message: err.message });
  }
});

router.post('/test', authorize('admin:all'), (req, res) => {
  try {
    const { text } = req.body;
    if (!text || typeof text !== 'string') {
      return sendError(res, 400, 'missing_params', { message: 'text required' });
    }
    const result = moderationStore.scoreToxicity(text);
    res.json({ success: true, result });
  } catch (err) {
    sendError(res, 500, 'moderation_test_failed', { message: err.message });
  }
});

router.post('/flagged/clear', authorize('admin:all'), (req, res) => {
  try {
    moderationStore.clearFlagged();
    logger.info(`[ContentMod] Flagged content cleared by ${req.user?.email || 'admin'}`);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'moderation_clear_failed', { message: err.message });
  }
});

module.exports = router;
