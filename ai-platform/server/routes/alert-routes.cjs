'use strict';

const express = require('express');
const { authenticate } = require('../middleware/auth.cjs');
const { authorize } = require('../middleware/authorize.cjs');
const ruleStore = require('../lib/alert-rule-store.cjs');
const incidentStore = require('../lib/alert-incident-store.cjs');
const { processEvent, deliverAlert, buildPayload } = require('../lib/alert-dispatcher.cjs');
const auditLogger = require('../lib/audit-logger.cjs');
const logger = require('../lib/app-logger.cjs');
const { sendError } = require('../lib/response-helpers.cjs');
const { maskSecret } = require('../lib/crypto-utils.cjs');

const router = express.Router();

function getOrgId(req) {
  return req.user?.id || req.user?.email || 'default';
}

const SENSITIVE_DEST_FIELDS = ['url', 'secret', 'routingKey', 'email', 'to', 'webhookUrl'];

function maskRule(rule) {
  if (!rule) return null;
  const masked = { ...rule };
  if (masked.webhookUrl) masked.webhookUrl = maskSecret(masked.webhookUrl);
  if (masked.destination && typeof masked.destination === 'object') {
    masked.destination = { ...masked.destination };
    for (const field of SENSITIVE_DEST_FIELDS) {
      if (masked.destination[field]) {
        masked.destination[field] = maskSecret(masked.destination[field]);
      }
    }
  }
  return masked;
}

router.use(authenticate);

// ── GET /api/alerts/rules ───────────────────────────────────────────────────
router.get('/rules', (req, res) => {
  try {
    const orgId = getOrgId(req);
    const rules = ruleStore.getAllRules(orgId).map(maskRule);
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
    res.json({ success: true, rule: maskRule(rule) });
  } catch (err) {
    logger.warn('[Alerts] rule_fetch_failed failed:', err.message);
    sendError(res, 500, 'rule_fetch_failed', { message: err.message });
  }
});

// ── POST /api/alerts/rules ──────────────────────────────────────────────────
router.post('/rules', authorize('admin:all'), (req, res) => {
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
      newValue: maskRule(rule),
      metadata: { route: req.originalUrl },
    });
    res.json({ success: true, rule: maskRule(rule) });
  } catch (err) {
    logger.warn('[Alerts] rule_save_failed failed:', err.message);
    sendError(res, 500, 'rule_save_failed', { message: err.message });
  }
});

// ── DELETE /api/alerts/rules/:id ────────────────────────────────────────────
router.delete('/rules/:id', authorize('admin:all'), (req, res) => {
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

// ── Webhook Signing Key Rotation ────────────────────────────────────────────

// GET /api/alerts/rules/:id/rotation-status — check grace window state
router.get('/rules/:id/rotation-status', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const status = ruleStore.getRotationStatus(req.params.id, orgId);
    res.json({ success: true, ...status });
  } catch (err) {
    logger.warn('[Alerts] rotation_status_failed:', err.message);
    sendError(res, 500, 'rotation_status_failed', { message: err.message });
  }
});

// POST /api/alerts/rules/:id/rotate-secret — rotate webhook HMAC signing key
//
// Body:
//   newSecret: string  (optional — if omitted, a 32-byte hex secret is generated)
//   graceWindowMs: number  (optional — override default 24h grace window for status reporting)
//
// Returns the new secret in plaintext (one-time view) plus rotation status.
router.post('/rules/:id/rotate-secret', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const ruleId = req.params.id;

    // Verify rule exists
    const rule = ruleStore.getRule(ruleId, orgId);
    if (!rule) return sendError(res, 404, 'rule_not_found', { message: 'Alert rule not found' });

    if (rule.destinationType !== 'webhook') {
      return sendError(res, 400, 'not_webhook_rule', {
        message: 'Secret rotation is only applicable to webhook destination rules.',
      });
    }

    // Generate or use provided secret
    const newSecret = req.body?.newSecret || ruleStore.generateSecret(32);
    const result = ruleStore.rotateSecret(ruleId, orgId, newSecret);
    if (!result.success) {
      return sendError(res, 400, 'rotation_failed', { message: result.error });
    }

    const status = ruleStore.getRotationStatus(ruleId, orgId, req.body?.graceWindowMs);

    // Audit log the rotation
    try {
      auditLogger.log({
        orgId,
        actorId: req.user?.id || 'system',
        actorEmail: req.user?.email || 'system',
        action: 'webhook_key_rotation',
        entity: 'alert_rule',
        entityId: ruleId,
        metadata: {
          ruleName: rule.name,
          graceWindowMs: status.graceWindowMs,
          graceWindowEndsAt: status.graceWindowEndsAt,
        },
      });
    } catch (logErr) {
      logger.warn('[Alerts] Failed to audit-log key rotation:', logErr.message);
    }

    logger.info(`[Alerts] Webhook secret rotated for rule ${ruleId} (org ${orgId}). Grace window active until ${status.graceWindowEndsAt}`);

    // Return the new secret in plaintext — this is the only time it's shown
    res.json({
      success: true,
      newSecret,
      rotation: status,
      note: 'Store this secret securely. It will not be shown again in plaintext.',
    });
  } catch (err) {
    logger.warn('[Alerts] rotate_secret_failed:', err.message);
    sendError(res, 500, 'rotate_secret_failed', { message: err.message });
  }
});

// POST /api/alerts/rules/:id/clear-previous-secret — purge old secret after grace window
//
// Body:
//   force: boolean  (if true, clear even if grace window is still active)
router.post('/rules/:id/clear-previous-secret', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const ruleId = req.params.id;

    const rule = ruleStore.getRule(ruleId, orgId);
    if (!rule) return sendError(res, 404, 'rule_not_found', { message: 'Alert rule not found' });

    const force = Boolean(req.body?.force);
    const result = ruleStore.clearPreviousSecret(ruleId, orgId, force);
    if (!result.success) {
      return sendError(res, 400, 'clear_previous_failed', { message: result.error });
    }

    // Audit log the purge
    try {
      auditLogger.log({
        orgId,
        actorId: req.user?.id || 'system',
        actorEmail: req.user?.email || 'system',
        action: 'webhook_key_purge_previous',
        entity: 'alert_rule',
        entityId: ruleId,
        metadata: { ruleName: rule.name, force, cleared: result.cleared },
      });
    } catch (logErr) {
      logger.warn('[Alerts] Failed to audit-log previous secret purge:', logErr.message);
    }

    logger.info(`[Alerts] Previous webhook secret cleared for rule ${ruleId} (org ${orgId}), force=${force}`);
    res.json({ success: true, cleared: result.cleared });
  } catch (err) {
    logger.warn('[Alerts] clear_previous_secret_failed:', err.message);
    sendError(res, 500, 'clear_previous_secret_failed', { message: err.message });
  }
});

// POST /api/alerts/rules/:id/generate-secret — generate a random secret without rotating
// Useful for the UI to pre-fill a suggested secret in the rotation form
router.post('/rules/:id/generate-secret', authorize('admin:all'), (req, res) => {
  try {
    const orgId = getOrgId(req);
    const rule = ruleStore.getRule(req.params.id, orgId);
    if (!rule) return sendError(res, 404, 'rule_not_found', { message: 'Alert rule not found' });

    const bytes = req.body?.bytes || 32;
    const secret = ruleStore.generateSecret(bytes);
    res.json({ success: true, secret });
  } catch (err) {
    logger.warn('[Alerts] generate_secret_failed:', err.message);
    sendError(res, 500, 'generate_secret_failed', { message: err.message });
  }
});

module.exports = router;
