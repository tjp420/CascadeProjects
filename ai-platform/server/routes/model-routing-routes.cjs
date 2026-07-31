'use strict';

/**
 * Model-Routing Optimizer API — Endpoints for managing model tiers,
 * routing configuration, and routing stats.
 *
 * Endpoints:
 *   GET  /api/model-routing/tiers          — List all tiers
 *   GET  /api/model-routing/tiers/:id      — Get specific tier
 *   POST /api/model-routing/tiers          — Create tier (admin:all)
 *   PUT  /api/model-routing/tiers/:id      — Update tier (admin:all)
 *   DELETE /api/model-routing/tiers/:id    — Delete tier (admin:all)
 *   GET  /api/model-routing/config         — Get routing config
 *   PUT  /api/model-routing/config         — Update routing config (admin:all)
 *   GET  /api/model-routing/stats          — Get routing stats
 *   POST /api/model-routing/stats/reset    — Reset stats (admin:all)
 *   POST /api/model-routing/test           — Test routing against sample text (admin:all)
 *
 * @module model-routing-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const modelRoutingStore = require('../lib/model-routing-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

// ── Tier CRUD ───────────────────────────────────────────────────────────────

router.get('/tiers', (req, res) => {
  try {
    const tiers = modelRoutingStore.getTiers();
    res.json({ success: true, tiers });
  } catch (err) {
    sendError(res, 500, 'tiers_get_failed', { message: err.message });
  }
});

router.get('/tiers/:id', (req, res) => {
  try {
    const tier = modelRoutingStore.getTier(req.params.id);
    if (!tier) return sendError(res, 404, 'tier_not_found');
    res.json({ success: true, tier });
  } catch (err) {
    sendError(res, 500, 'tier_get_failed', { message: err.message });
  }
});

router.post('/tiers', authorize('admin:all'), (req, res) => {
  try {
    const result = modelRoutingStore.createTier(req.body);
    if (!result.success) return sendError(res, 400, 'tier_create_failed', { message: result.error });
    logger.info(`[ModelRouting] Tier created by ${req.user?.email || 'admin'}: ${result.tier.id}`);
    res.json({ success: true, tier: result.tier });
  } catch (err) {
    sendError(res, 500, 'tier_create_failed', { message: err.message });
  }
});

router.put('/tiers/:id', authorize('admin:all'), (req, res) => {
  try {
    const result = modelRoutingStore.updateTier(req.params.id, req.body);
    if (!result.success) return sendError(res, 404, 'tier_not_found');
    logger.info(`[ModelRouting] Tier updated by ${req.user?.email || 'admin'}: ${req.params.id}`);
    res.json({ success: true, tier: result.tier });
  } catch (err) {
    sendError(res, 500, 'tier_update_failed', { message: err.message });
  }
});

router.delete('/tiers/:id', authorize('admin:all'), (req, res) => {
  try {
    const result = modelRoutingStore.deleteTier(req.params.id);
    if (!result.success) return sendError(res, 404, 'tier_not_found');
    logger.info(`[ModelRouting] Tier deleted by ${req.user?.email || 'admin'}: ${req.params.id}`);
    res.json({ success: true, deleted: result.deleted });
  } catch (err) {
    sendError(res, 500, 'tier_delete_failed', { message: err.message });
  }
});

// ── Routing Config ──────────────────────────────────────────────────────────

router.get('/config', (req, res) => {
  try {
    const config = modelRoutingStore.getRoutingConfig();
    res.json({ success: true, config });
  } catch (err) {
    sendError(res, 500, 'config_get_failed', { message: err.message });
  }
});

router.put('/config', authorize('admin:all'), (req, res) => {
  try {
    const result = modelRoutingStore.updateRoutingConfig(req.body);
    logger.info(`[ModelRouting] Config updated by ${req.user?.email || 'admin'}`);
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'config_update_failed', { message: err.message });
  }
});

// ── Stats ───────────────────────────────────────────────────────────────────

router.get('/stats', (req, res) => {
  try {
    const stats = modelRoutingStore.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'stats_get_failed', { message: err.message });
  }
});

router.post('/stats/reset', authorize('admin:all'), (req, res) => {
  try {
    const result = modelRoutingStore.resetStats();
    logger.info(`[ModelRouting] Stats reset by ${req.user?.email || 'admin'}`);
    res.json({ success: true, stats: result.stats });
  } catch (err) {
    sendError(res, 500, 'stats_reset_failed', { message: err.message });
  }
});

// ── Test ────────────────────────────────────────────────────────────────────

router.post('/test', authorize('admin:all'), (req, res) => {
  try {
    const { prompt, messages } = req.body;
    if (!prompt || typeof prompt !== 'string') {
      return sendError(res, 400, 'prompt_required', { message: 'prompt is required' });
    }
    const result = modelRoutingStore.testRouting(prompt, messages || []);
    res.json(result);
  } catch (err) {
    sendError(res, 500, 'test_failed', { message: err.message });
  }
});

module.exports = router;
