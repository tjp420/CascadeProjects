'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const ruleStore = require('../lib/alert-rule-store.cjs');
const incidentStore = require('../lib/alert-incident-store.cjs');
const { processEvent, deliverAlert, buildPayload } = require('../lib/alert-dispatcher.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const logger = require('../lib/app-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');

const router = express.Router();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

router.use(authenticate);

// ── GET /api/alerts/rules ───────────────────────────────────────────────────
router.get('/rules', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const rules = ruleStore.getAllRules(orgId);
    res.json({ success: true, rules });
  } catch (err) {
    logger.warn('[Alerts] rules_fetch_failed failed:', err.message);
    sendError(res, 500, 'rules_fetch_failed', { message: err.message });
  }
});

// ── GET /api/alerts/rules/:id ───────────────────────────────────────────────
router.get('/rules/:id', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const rule = ruleStore.getRule(req.params.id, orgId);
    if (!rule) return sendError(res, 404, 'rule_not_found');
    res.json({ success: true, rule });
  } catch (err) {
    logger.warn('[Alerts] rule_fetch_failed failed:', err.message);
    sendError(res, 500, 'rule_fetch_failed', { message: err.message });
  }
});

// ── POST /api/alerts/rules ──────────────────────────────────────────────────
router.post('/rules', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const {
      id,
      name,
      eventType,
      destinationType,
      webhookUrl,
      destination,
      enabled,
      threshold,
      cooldownMinutes,
      severityFilter,
    } = req.body || {};
    if (!id) return sendError(res, 400, 'id is required');
    if (!name) return sendError(res, 400, 'name is required');
    if (!eventType) return sendError(res, 400, 'eventType is required');
    if (!ruleStore.EVENT_TYPES.includes(eventType))
      return sendError(res, 400, `eventType must be one of: ${ruleStore.EVENT_TYPES.join(', ')}`);
    if (!destinationType) return sendError(res, 400, 'destinationType is required');
    if (!ruleStore.DESTINATION_TYPES.includes(destinationType))
      return sendError(
        res,
        400,
        `destinationType must be one of: ${ruleStore.DESTINATION_TYPES.join(', ')}`
      );
    if (destinationType === 'webhook' && !webhookUrl)
      return sendError(res, 400, 'webhookUrl is required for webhook destination');

    const rule = ruleStore.setRule(
      id,
      {
        name,
        eventType,
        destinationType,
        webhookUrl,
        destination,
        enabled,
        threshold,
        cooldownMinutes,
        severityFilter,
      },
      orgId
    );
    auditLogger.log({
      orgId,
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'CREATE',
      entity: 'alert_rule',
      entityId: id,
      newValue: rule,
      metadata: { route: req.originalUrl },
    });
    res.json({ success: true, rule });
  } catch (err) {
    logger.warn('[Alerts] rule_save_failed failed:', err.message);
    sendError(res, 500, 'rule_save_failed', { message: err.message });
  }
});

// ── DELETE /api/alerts/rules/:id ────────────────────────────────────────────
router.delete('/rules/:id', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const oldRule = ruleStore.getRule(req.params.id, orgId);
    ruleStore.deleteRule(req.params.id, orgId);
    auditLogger.log({
      orgId,
      actorId: req.user?.id,
      actorEmail: req.user?.email,
      action: 'DELETE',
      entity: 'alert_rule',
      entityId: req.params.id,
      oldValue: oldRule,
      metadata: { route: req.originalUrl },
    });
    res.json({ success: true, deleted: req.params.id });
  } catch (err) {
    logger.warn('[Alerts] rule_delete_failed failed:', err.message);
    sendError(res, 500, 'rule_delete_failed', { message: err.message });
  }
});

// ── GET /api/alerts/incidents ───────────────────────────────────────────────
//   Query: status, eventType, ruleId, limit, offset
router.get('/incidents', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const result = incidentStore.query({
      orgId,
      status: req.query.status || '',
      eventType: req.query.eventType || '',
      ruleId: req.query.ruleId || '',
      limit: Math.min(parseInt(req.query.limit, 10) || 100, 500),
      offset: Math.max(parseInt(req.query.offset, 10) || 0, 0),
    });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Alerts] incidents_fetch_failed failed:', err.message);
    sendError(res, 500, 'incidents_fetch_failed', { message: err.message });
  }
});

// ── GET /api/alerts/stats ───────────────────────────────────────────────────
router.get('/stats', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const stats = incidentStore.getStats(orgId);
    const rules = ruleStore.getAllRules(orgId);
    res.json({
      success: true,
      stats: {
        ...stats,
        totalRules: rules.length,
        enabledRules: rules.filter((r) => r.enabled).length,
      },
    });
  } catch (err) {
    logger.warn('[Alerts] alert_stats_failed failed:', err.message);
    sendError(res, 500, 'alert_stats_failed', { message: err.message });
  }
});

// ── POST /api/alerts/test ───────────────────────────────────────────────────
//   Test dispatch a rule without waiting for a real event
router.post('/test', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { ruleId } = req.body || {};
    if (!ruleId) return sendError(res, 400, 'ruleId is required');

    const rule = ruleStore.getRule(ruleId, orgId);
    if (!rule) return sendError(res, 404, 'rule_not_found');

    const payload = buildPayload(
      'test',
      {
        message: `Test alert for rule: ${rule.name}`,
        severity: 'info',
        data: { triggeredBy: req.user?.email },
      },
      orgId
    );
    const delivery = await deliverAlert(rule, payload);

    const incident = incidentStore.recordIncident({
      orgId,
      ruleId: rule.id,
      ruleName: rule.name,
      eventType: 'test',
      destinationType: rule.destinationType,
      destination: rule.destination,
      payload,
      status: delivery.status,
      attempts: delivery.attempts,
      responseStatus: delivery.responseStatus,
      responseBody: delivery.responseBody,
      error: delivery.error,
      durationMs: delivery.durationMs,
    });

    ruleStore.updateFireStats(rule.id, orgId);

    res.json({ success: true, delivery, incident });
  } catch (err) {
    logger.warn('[Alerts] alert_test_failed failed:', err.message);
    sendError(res, 500, 'alert_test_failed', { message: err.message });
  }
});

// ── POST /api/alerts/trigger ────────────────────────────────────────────────
//   Manually trigger an event (for testing/integration)
router.post('/trigger', async (req, res) => {
  try {
    const orgId = getOrgId(req);
    const { eventType, severity, message, data } = req.body || {};
    if (!eventType) return sendError(res, 400, 'eventType is required');
    if (!ruleStore.EVENT_TYPES.includes(eventType))
      return sendError(res, 400, `eventType must be one of: ${ruleStore.EVENT_TYPES.join(', ')}`);

    const result = await processEvent(orgId, eventType, { severity, message, data });
    res.json({ success: true, ...result });
  } catch (err) {
    logger.warn('[Alerts] alert_trigger_failed failed:', err.message);
    sendError(res, 500, 'alert_trigger_failed', { message: err.message });
  }
});

// ── GET /api/alerts/event-types ─────────────────────────────────────────────
router.get('/event-types', (req, res) => {
  res.json({
    success: true,
    eventTypes: ruleStore.EVENT_TYPES,
    destinationTypes: ruleStore.DESTINATION_TYPES,
  });
});

module.exports = router;
