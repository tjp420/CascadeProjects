'use strict';

const express = require('express');
const { authenticate, authorize } = require('../middleware/auth.cjs');
const failoverStore = require('../lib/provider-failover-store.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const logger = require('../lib/app-logger.cjs');

const router = express.Router();

router.use(authenticate);

router.get('/stats', function (req, res) {
  try {
    res.json({ success: true, stats: failoverStore.getStats() });
  } catch (err) {
    sendError(res, 500, 'failover_stats_failed', { message: err.message });
  }
});

router.get('/providers', function (req, res) {
  try {
    res.json({ success: true, providers: failoverStore.getAllProviderStatuses() });
  } catch (err) {
    sendError(res, 500, 'failover_providers_failed', { message: err.message });
  }
});

router.get('/providers/:id', function (req, res) {
  try {
    var status = failoverStore.getProviderStatus(req.params.id);
    if (!status) return sendError(res, 404, 'provider_not_found');
    res.json({ success: true, provider: status });
  } catch (err) {
    sendError(res, 500, 'failover_provider_failed', { message: err.message });
  }
});

router.post('/providers/:id/reset', authorize('admin:all'), function (req, res) {
  try {
    failoverStore.resetCircuit(req.params.id);
    logger.info('[ProviderFailover] Circuit reset for ' + req.params.id + ' by ' + (req.user && req.user.email || 'admin'));
    res.json({ success: true, provider: failoverStore.getProviderStatus(req.params.id) });
  } catch (err) {
    sendError(res, 500, 'circuit_reset_failed', { message: err.message });
  }
});

router.post('/providers/reset-all', authorize('admin:all'), function (req, res) {
  try {
    failoverStore.resetAllCircuits();
    logger.info('[ProviderFailover] All circuits reset by ' + (req.user && req.user.email || 'admin'));
    res.json({ success: true, providers: failoverStore.getAllProviderStatuses() });
  } catch (err) {
    sendError(res, 500, 'circuit_reset_all_failed', { message: err.message });
  }
});

router.put('/providers/:id/override', authorize('admin:all'), function (req, res) {
  try {
    var providerId = req.params.id;
    if (!failoverStore.PROVIDERS.includes(providerId)) {
      return sendError(res, 404, 'provider_not_found');
    }
    var result = failoverStore.updateConfig({
      providerOverrides: { [providerId]: req.body || {} },
    });
    logger.info('[ProviderFailover] Override for ' + providerId + ' updated by ' + (req.user && req.user.email || 'admin'));
    res.json({ success: true, provider: failoverStore.getProviderStatus(providerId), config: result.config });
  } catch (err) {
    sendError(res, 500, 'override_update_failed', { message: err.message });
  }
});

router.get('/events', function (req, res) {
  try {
    var limit = parseInt(req.query.limit, 10) || 50;
    res.json({ success: true, events: failoverStore.getFailoverEvents(limit) });
  } catch (err) {
    sendError(res, 500, 'failover_events_failed', { message: err.message });
  }
});

router.post('/events/clear', authorize('admin:all'), function (req, res) {
  try {
    failoverStore.clearEvents();
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'events_clear_failed', { message: err.message });
  }
});

router.get('/config', function (req, res) {
  try {
    res.json({ success: true, config: failoverStore.getConfig() });
  } catch (err) {
    sendError(res, 500, 'failover_config_failed', { message: err.message });
  }
});

router.put('/config', authorize('admin:all'), function (req, res) {
  try {
    var result = failoverStore.updateConfig(req.body || {});
    logger.info('[ProviderFailover] Config updated by ' + (req.user && req.user.email || 'admin'));
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'failover_config_update_failed', { message: err.message });
  }
});

router.post('/config/reset', authorize('admin:all'), function (req, res) {
  try {
    var result = failoverStore.resetConfig();
    logger.info('[ProviderFailover] Config reset by ' + (req.user && req.user.email || 'admin'));
    res.json({ success: true, config: result.config });
  } catch (err) {
    sendError(res, 500, 'failover_config_reset_failed', { message: err.message });
  }
});

router.post('/health-check', authorize('admin:all'), async function (req, res) {
  try {
    var results = await failoverStore.runHealthChecks();
    res.json({ success: true, results: results });
  } catch (err) {
    sendError(res, 500, 'health_check_failed', { message: err.message });
  }
});

router.post('/stats/reset', authorize('admin:all'), function (req, res) {
  try {
    failoverStore.resetStats();
    logger.info('[ProviderFailover] Stats reset by ' + (req.user && req.user.email || 'admin'));
    res.json({ success: true });
  } catch (err) {
    sendError(res, 500, 'stats_reset_failed', { message: err.message });
  }
});

module.exports = router;
