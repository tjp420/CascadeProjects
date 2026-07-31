'use strict';

/**
 * Proxy Performance Metrics API — Endpoints for querying high-resolution
 * performance metrics, provider latency profiles, and backpressure stats.
 *
 * Endpoints:
 *   GET  /api/proxy-performance/stats           — Aggregate window stats
 *   GET  /api/proxy-performance/recent          — Recent request metrics
 *   GET  /api/proxy-performance/providers       — Provider latency profiles
 *   GET  /api/proxy-performance/rollups         — Historical minute rollups
 *   GET  /api/proxy-performance/backpressure    — Queue backpressure snapshot
 *   POST /api/proxy-performance/reset           — Reset all metrics (admin:all)
 *
 * @module proxy-performance-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const perfStore = require('../lib/proxy-performance-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

router.get('/stats', (req, res) => {
  try {
    const stats = perfStore.getStats();
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'perf_stats_failed', { message: err.message });
  }
});

router.get('/recent', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 50;
    const metrics = perfStore.getRecentMetrics(limit);
    res.json({ success: true, metrics, count: metrics.length });
  } catch (err) {
    sendError(res, 500, 'perf_recent_failed', { message: err.message });
  }
});

router.get('/providers', (req, res) => {
  try {
    const profiles = perfStore.getProviderProfiles();
    res.json({ success: true, providers: profiles });
  } catch (err) {
    sendError(res, 500, 'perf_providers_failed', { message: err.message });
  }
});

router.get('/rollups', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 60;
    const rollups = perfStore.getRollups(limit);
    res.json({ success: true, rollups, count: rollups.length });
  } catch (err) {
    sendError(res, 500, 'perf_rollups_failed', { message: err.message });
  }
});

router.get('/backpressure', (req, res) => {
  try {
    const bp = perfStore.getQueueBackpressure();
    res.json({ success: true, backpressure: bp });
  } catch (err) {
    sendError(res, 500, 'perf_backpressure_failed', { message: err.message });
  }
});

router.post('/reset', authorize('admin:all'), (req, res) => {
  try {
    perfStore.resetMetrics();
    logger.info(`[ProxyPerf] Metrics reset by ${req.user?.email || 'admin'}`);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'perf_reset_failed', { message: err.message });
  }
});

module.exports = router;
