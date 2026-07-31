'use strict';

/**
 * Security Monitor Settings API — Endpoints for managing anomaly
 * detection thresholds, alert cooldown profiles, and rolling baselines.
 *
 * Endpoints:
 *   GET  /api/security-monitor/settings   — Get current settings
 *   PUT  /api/security-monitor/settings   — Update settings (admin:all)
 *   POST /api/security-monitor/settings/reset — Reset to defaults (admin:all)
 *   GET  /api/security-monitor/status     — Get monitor runtime status
 *   POST /api/security-monitor/restart    — Restart monitor with new settings (admin:all)
 *   POST /api/security-monitor/run-once   — Trigger immediate check (admin:all)
 *
 * @module security-monitor-settings-routes
 */

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const settingsStore = require('../lib/security-monitor-settings-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

// GET /api/security-monitor/settings
router.get('/settings', (req, res) => {
  try {
    const settings = settingsStore.getSettings();
    const defaults = settingsStore.getDefaults();
    res.json({ success: true, settings, defaults });
  } catch (err) {
    logger.warn('[SecMonitor] settings_get_failed:', err.message);
    sendError(res, 500, 'settings_get_failed', { message: err.message });
  }
});

// PUT /api/security-monitor/settings
router.put('/settings', authorize('admin:all'), (req, res) => {
  try {
    const result = settingsStore.updateSettings(req.body);
    if (!result.success) {
      return sendError(res, 400, 'settings_update_failed', { message: result.error });
    }
    logger.info(`[SecMonitor] Settings updated by ${req.user?.email || 'admin'}`);

    // Restart the monitor if poll interval changed
    if (req.body.pollIntervalMs !== undefined) {
      try {
        const securityMonitor = require('../lib/security-monitor.cjs');
        securityMonitor.restart();
        logger.info('[SecMonitor] Restarted with new poll interval');
      } catch {
        // Monitor may not be running
      }
    }

    res.json({ success: true, settings: result.settings });
  } catch (err) {
    logger.warn('[SecMonitor] settings_update_failed:', err.message);
    sendError(res, 500, 'settings_update_failed', { message: err.message });
  }
});

// POST /api/security-monitor/settings/reset
router.post('/settings/reset', authorize('admin:all'), (req, res) => {
  try {
    const result = settingsStore.resetSettings();
    logger.info(`[SecMonitor] Settings reset to defaults by ${req.user?.email || 'admin'}`);

    try {
      const securityMonitor = require('../lib/security-monitor.cjs');
      securityMonitor.restart();
    } catch {
      // Monitor may not be running
    }

    res.json({ success: true, settings: result.settings });
  } catch (err) {
    logger.warn('[SecMonitor] settings_reset_failed:', err.message);
    sendError(res, 500, 'settings_reset_failed', { message: err.message });
  }
});

// GET /api/security-monitor/status
router.get('/status', (req, res) => {
  try {
    const securityMonitor = require('../lib/security-monitor.cjs');
    const status = securityMonitor.getStatus();
    res.json({ success: true, ...status });
  } catch (err) {
    logger.warn('[SecMonitor] status_failed:', err.message);
    sendError(res, 500, 'status_failed', { message: err.message });
  }
});

// POST /api/security-monitor/restart
router.post('/restart', authorize('admin:all'), (req, res) => {
  try {
    const securityMonitor = require('../lib/security-monitor.cjs');
    securityMonitor.restart();
    logger.info(`[SecMonitor] Restarted by ${req.user?.email || 'admin'}`);
    res.json({ success: true, message: 'Security monitor restarted' });
  } catch (err) {
    logger.warn('[SecMonitor] restart_failed:', err.message);
    sendError(res, 500, 'restart_failed', { message: err.message });
  }
});

// POST /api/security-monitor/run-once
router.post('/run-once', authorize('admin:all'), async (req, res) => {
  try {
    const securityMonitor = require('../lib/security-monitor.cjs');
    const results = await securityMonitor.runOnce();
    logger.info(`[SecMonitor] Manual check triggered by ${req.user?.email || 'admin'}`);
    res.json({ success: true, results });
  } catch (err) {
    logger.warn('[SecMonitor] run_once_failed:', err.message);
    sendError(res, 500, 'run_once_failed', { message: err.message });
  }
});

module.exports = router;
