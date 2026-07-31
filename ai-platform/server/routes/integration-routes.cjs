'use strict';

/**
 * Integration Marketplace API — CRUD endpoints for managing per-organization
 * webhook and notification integrations (Slack, Teams, Jira, GitHub PR).
 *
 * Endpoints:
 *   GET    /api/integrations                    — List all configs (admin)
 *   GET    /api/integrations/org/:orgId         — List configs for an org
 *   POST   /api/integrations                    — Create integration config
 *   PUT    /api/integrations/:configId          — Update integration config
 *   DELETE /api/integrations/:configId          — Delete integration config
 *   GET    /api/integrations/types              — List available integration types
 *   GET    /api/integrations/events             — List available event types
 *   GET    /api/integrations/stats              — Integration stats
 *   POST   /api/integrations/:configId/test     — Test integration connectivity
 *   POST   /api/integrations/dispatch           — Manually dispatch an event
 *
 * @module integration-routes
 */

const express = require('express');
const rateLimit = require('express-rate-limit');
const logger = require('../lib/app-logger.cjs');
const integrationStore = require('../lib/integration-config-store.cjs');
const webhookEngine = require('../lib/webhook-engine.cjs');
const { validateParam, VALIDATION_PATTERNS } = require('../middleware/validate-params.cjs');

const router = express.Router();

const integrationRateLimit = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => res.status(429).json({ error: 'too_many_requests', message: 'Too many requests' }),
});

// GET /api/integrations — list all configs (masked)
router.get('/', (req, res) => {
  try {
    const { orgId } = req.query;
    const configs = orgId
      ? integrationStore.getConfigsByOrg(orgId)
      : integrationStore.getAllConfigs();
    res.json({ success: true, configs });
  } catch (err) {
    res.status(500).json({ error: 'list_failed', message: err.message });
  }
});

// GET /api/integrations/types — available integration types
router.get('/types', (req, res) => {
  res.json({ success: true, types: integrationStore.INTEGRATION_TYPES });
});

// GET /api/integrations/events — available event types
router.get('/events', (req, res) => {
  res.json({ success: true, events: integrationStore.EVENT_TYPES });
});

// GET /api/integrations/stats
router.get('/stats', (req, res) => {
  try {
    res.json({ success: true, ...integrationStore.getStats() });
  } catch (err) {
    res.status(500).json({ error: 'stats_failed', message: err.message });
  }
});

// POST /api/integrations — create config
router.post('/', integrationRateLimit, (req, res) => {
  try {
    const { type, orgId, name, enabled, events, ...rest } = req.body || {};
    if (!type) return res.status(400).json({ error: 'type is required' });

    const config = integrationStore.createConfig({
      type, orgId, name, enabled, events, ...rest,
    });
    res.status(201).json({ success: true, config });
  } catch (err) {
    logger.error('[Integrations] Create failed:', err.message);
    res.status(400).json({ error: 'create_failed', message: err.message });
  }
});

// PUT /api/integrations/:configId — update config
router.put('/:configId', validateParam('configId', VALIDATION_PATTERNS.configId), (req, res) => {
  try {
    const updated = integrationStore.updateConfig(req.params.configId, req.body || {});
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(400).json({ error: 'update_failed', message: err.message });
  }
});

// DELETE /api/integrations/:configId
router.delete('/:configId', validateParam('configId', VALIDATION_PATTERNS.configId), (req, res) => {
  try {
    const deleted = integrationStore.deleteConfig(req.params.configId);
    if (!deleted) return res.status(404).json({ error: 'not_found' });
    res.json({ success: true, deleted: true });
  } catch (err) {
    res.status(500).json({ error: 'delete_failed', message: err.message });
  }
});

// POST /api/integrations/:configId/test — test connectivity
router.post('/:configId/test', validateParam('configId', VALIDATION_PATTERNS.configId), async (req, res) => {
  try {
    const config = integrationStore.getConfigDecrypted(req.params.configId);
    if (!config) return res.status(404).json({ error: 'not_found' });
    if (!config.enabled) return res.status(400).json({ error: 'config_disabled' });

    const testPayload = webhookEngine.buildEventPayload('scan_completed', {
      orgId: config.orgId,
      summary: 'Test notification from SimpleBeacon Integration Marketplace',
      severity: 'info',
      issueCount: 0,
    });

    const adapter = webhookEngine.ADAPTERS[config.type];
    if (!adapter) return res.status(400).json({ error: 'no_adapter' });

    const result = await adapter(config, testPayload);
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[Integrations] Test failed:', err.message);
    res.status(500).json({ error: 'test_failed', message: err.message });
  }
});

// POST /api/integrations/dispatch — manually dispatch event
router.post('/dispatch', integrationRateLimit, async (req, res) => {
  try {
    const { event, orgId, ...context } = req.body || {};
    if (!event || !orgId) {
      return res.status(400).json({ error: 'event and orgId are required' });
    }

    const result = await webhookEngine.dispatchEvent(event, { orgId, ...context });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.error('[Integrations] Dispatch failed:', err.message);
    res.status(500).json({ error: 'dispatch_failed', message: err.message });
  }
});

module.exports = router;
