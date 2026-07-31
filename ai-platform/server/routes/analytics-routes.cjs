'use strict';

/**
 * Usage Analytics API — Endpoints for scan metrics, violation trends,
 * compliance posture scores, and global usage statistics.
 *
 * Endpoints:
 *   GET  /api/analytics/stats              — Global stats across all orgs
 *   GET  /api/analytics/org/:orgId         — Per-org summary
 *   GET  /api/analytics/scans              — Paginated scan history
 *   GET  /api/analytics/trends             — Time-series trend data
 *   GET  /api/analytics/heatmap            — Violation heatmap by category
 *   GET  /api/analytics/repositories       — Top repositories by scan count
 *   POST /api/analytics/record             — Record a scan (internal/CI)
 *
 * @module analytics-routes
 */

const express = require('express');
const logger = require('../lib/app-logger.cjs');
const analyticsStore = require('../lib/usage-analytics-store.cjs');

const router = express.Router();

// GET /api/analytics/stats — global stats
router.get('/stats', (req, res) => {
  try {
    const stats = analyticsStore.getGlobalStats();
    res.json({ success: true, ...stats });
  } catch (err) {
    logger.error('[Analytics] Stats failed:', err.message);
    res.status(500).json({ error: 'stats_failed', message: err.message });
  }
});

// GET /api/analytics/org/:orgId — per-org summary
router.get('/org/:orgId', (req, res) => {
  try {
    const summary = analyticsStore.getOrgSummary(req.params.orgId);
    if (!summary) return res.status(404).json({ error: 'org_not_found', message: 'No scans recorded for this organization' });
    res.json({ success: true, ...summary });
  } catch (err) {
    res.status(500).json({ error: 'org_summary_failed', message: err.message });
  }
});

// GET /api/analytics/scans — paginated scan history
router.get('/scans', (req, res) => {
  try {
    const filters = {
      orgId: req.query.orgId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      repository: req.query.repository,
      limit: parseInt(req.query.limit, 10) || 50,
      offset: parseInt(req.query.offset, 10) || 0,
    };
    const result = analyticsStore.getScans(filters);
    res.json({
      success: true,
      scans: result.scans,
      pagination: {
        total: result.total,
        limit: result.limit,
        offset: result.offset,
        hasNext: result.offset + result.limit < result.total,
        hasPrev: result.offset > 0,
      },
    });
  } catch (err) {
    res.status(500).json({ error: 'scans_query_failed', message: err.message });
  }
});

// GET /api/analytics/trends — time-series trend data
router.get('/trends', (req, res) => {
  try {
    const filters = {
      orgId: req.query.orgId,
      startDate: req.query.startDate,
      endDate: req.query.endDate,
      granularity: req.query.granularity || 'day',
    };
    const trend = analyticsStore.getTrendData(filters);
    res.json({ success: true, trend, granularity: filters.granularity });
  } catch (err) {
    res.status(500).json({ error: 'trends_failed', message: err.message });
  }
});

// GET /api/analytics/heatmap — violation heatmap by category
router.get('/heatmap', (req, res) => {
  try {
    const filters = {
      orgId: req.query.orgId,
      startDate: req.query.startDate,
    };
    const heatmap = analyticsStore.getViolationHeatmap(filters);
    res.json({ success: true, heatmap });
  } catch (err) {
    res.status(500).json({ error: 'heatmap_failed', message: err.message });
  }
});

// GET /api/analytics/repositories — top repositories
router.get('/repositories', (req, res) => {
  try {
    const limit = parseInt(req.query.limit, 10) || 10;
    const repos = analyticsStore.getTopRepositories(req.query.orgId, limit);
    res.json({ success: true, repositories: repos });
  } catch (err) {
    res.status(500).json({ error: 'repositories_failed', message: err.message });
  }
});

// POST /api/analytics/record — record a scan (called by CLI/CI)
router.post('/record', (req, res) => {
  try {
    const { orgId, summary, projectPath, categoryCounts, languageBreakdown, scanDurationMs, gateStatus, repository, branch, commitSha, triggeredBy } = req.body || {};

    if (!orgId) return res.status(400).json({ error: 'orgId is required' });
    if (!summary || typeof summary !== 'object') return res.status(400).json({ error: 'summary object is required' });

    const entry = analyticsStore.recordScan({
      orgId,
      summary,
      projectPath,
      categoryCounts,
      languageBreakdown,
      scanDurationMs,
      gateStatus,
      repository,
      branch,
      commitSha,
      triggeredBy,
    });

    res.status(201).json({ success: true, scanId: entry.scanId, postureScore: entry.postureScore });
  } catch (err) {
    logger.error('[Analytics] Record failed:', err.message);
    res.status(500).json({ error: 'record_failed', message: err.message });
  }
});

module.exports = router;
