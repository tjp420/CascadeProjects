'use strict';

/**
 * Rate-Limit Quota API — Endpoints for managing quota policies,
 * viewing usage stats, and checking bucket status.
 *
 * Endpoints:
 *   GET  /api/rate-limit/policies           — Get all quota policies
 *   PUT  /api/rate-limit/policies            — Update policies (admin:all)
 *   POST /api/rate-limit/policies/reset      — Reset to defaults (admin:all)
 *   GET  /api/rate-limit/usage               — Get all usage data
 *   GET  /api/rate-limit/usage/:scope/:key   — Get usage for specific scope+key
 *   GET  /api/rate-limit/usage/stats         — Get aggregate usage stats
 *   GET  /api/rate-limit/bucket/:scope/:key  — Get bucket status
 *   POST /api/rate-limit/usage/reset         — Reset all usage (admin:all)
 *
 * @module rate-limit-quota-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const quotaStore = require('../lib/rate-limit-quota-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

router.get('/policies', (req, res) => {
  try {
    const policies = quotaStore.getPolicies();
    res.json({ success: true, policies });
  } catch (err) {
    sendError(res, 500, 'quota_policies_failed', { message: err.message });
  }
});

router.put('/policies', authorize('admin:all'), (req, res) => {
  try {
    const { scope, updates } = req.body;
    if (!scope || !updates) {
      return sendError(res, 400, 'missing_params', { message: 'scope and updates required' });
    }
    const result = quotaStore.updatePolicy(scope, updates);
    logger.info(`[Quota] Policies updated by ${req.user?.email || 'admin'}: scope=${scope}`);
    res.json({ success: true, policies: result.policies });
  } catch (err) {
    sendError(res, 500, 'quota_update_failed', { message: err.message });
  }
});

router.post('/policies/reset', authorize('admin:all'), (req, res) => {
  try {
    const result = quotaStore.resetPolicies();
    logger.info(`[Quota] Policies reset to defaults by ${req.user?.email || 'admin'}`);
    res.json({ success: true, policies: result.policies });
  } catch (err) {
    sendError(res, 500, 'quota_reset_failed', { message: err.message });
  }
});

router.get('/usage', (req, res) => {
  try {
    const usage = quotaStore.getAllUsage();
    res.json({ success: true, usage });
  } catch (err) {
    sendError(res, 500, 'quota_usage_failed', { message: err.message });
  }
});

router.get('/usage/stats', (req, res) => {
  try {
    const stats = quotaStore.getUsageStats();
    res.json({ success: true, stats });
  } catch (err) {
    sendError(res, 500, 'quota_usage_stats_failed', { message: err.message });
  }
});

router.get('/usage/:scope/:key', (req, res) => {
  try {
    const usage = quotaStore.getUsage(req.params.scope, req.params.key);
    if (!usage) return sendError(res, 404, 'usage_not_found');
    res.json({ success: true, usage });
  } catch (err) {
    sendError(res, 500, 'quota_usage_failed', { message: err.message });
  }
});

router.get('/bucket/:scope/:key', (req, res) => {
  try {
    const status = quotaStore.getBucketStatus(req.params.scope, req.params.key);
    res.json({ success: true, bucket: status });
  } catch (err) {
    sendError(res, 500, 'bucket_status_failed', { message: err.message });
  }
});

router.post('/usage/reset', authorize('admin:all'), (req, res) => {
  try {
    quotaStore.resetUsage();
    logger.info(`[Quota] Usage reset by ${req.user?.email || 'admin'}`);
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'usage_reset_failed', { message: err.message });
  }
});

module.exports = router;
