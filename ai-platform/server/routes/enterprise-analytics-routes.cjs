"use strict";

/**
 * Enterprise Analytics facade — a convenience route that returns a compact
 * analytics payload tailored for the enterprise admin dashboard views.
 *
 * GET /api/enterprise/analytics?orgId=<id>&days=<n>
 *
 * Returns: { success: true, stats, trend, heatmap, repositories }
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const analyticsStore = require('../lib/usage-analytics-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

router.get('/', (req, res) => {
  try {
    const orgId = req.query.orgId || null;
    const days = Math.min(Math.max(parseInt(String(req.query.days || '90'), 10) || 90, 1), 365);
    const repository = req.query.repository || null;
    const branch = req.query.branch || null;

    // Compute startDate filter for trend/heatmap if days provided
    const startDate = new Date(Date.now() - Math.max(1, days) * 24 * 60 * 60 * 1000).toISOString();

    const filterOpts = { orgId, repository, branch, startDate };

    const stats = orgId ? analyticsStore.getOrgSummary(orgId) : analyticsStore.getGlobalStats(filterOpts);

    const trend = analyticsStore.getTrendData({ ...filterOpts, granularity: 'day' });
    const heatmap = analyticsStore.getViolationHeatmap(filterOpts);
    const repositories = analyticsStore.getTopRepositories(orgId, Math.min(Math.max(parseInt(String(req.query.limit || '10'), 10) || 10, 1), 100));

    res.json({ success: true, stats, trend, heatmap, repositories });
  } catch (err) {
    logger.error('[EnterpriseAnalytics] Failed to serve analytics:', err?.message || err);
    sendError(res, 500, 'enterprise_analytics_failed', { message: String(err) });
  }
});

// GET /api/enterprise/analytics/filters — distinct repositories and branches for dropdown population
router.get('/filters', (req, res) => {
  try {
    const orgId = req.query.orgId || null;
    const repository = req.query.repository || null;
    const repositories = analyticsStore.getDistinctRepositories(orgId);
    const branches = analyticsStore.getDistinctBranches(orgId, repository);
    res.json({ success: true, repositories, branches });
  } catch (err) {
    logger.error('[EnterpriseAnalytics] Filters failed:', err?.message || err);
    sendError(res, 500, 'filters_failed', { message: String(err) });
  }
});

module.exports = router;
