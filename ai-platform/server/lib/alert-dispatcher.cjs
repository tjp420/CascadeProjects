'use strict';

const crypto = require('crypto');
const logger = require('../../src/lib/app-logger.cjs');
const ruleStore = require('./alert-rule-store.cjs');
const incidentStore = require('./alert-incident-store.cjs');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Sign a webhook payload with HMAC-SHA256.
 */
function signPayload(payload, secret) {
  if (!secret) return '';
  const body = typeof payload === 'string' ? payload : JSON.stringify(payload);
  return crypto.createHmac('sha256', secret).update(body).digest('hex');
}

/**
 * Build the alert payload for a given event.
 */
function buildPayload(eventType, context, orgId) {
  return {
    event: eventType,
    orgId,
    timestamp: new Date().toISOString(),
    severity: context?.severity || 'high',
    message: context?.message || `Alert: ${eventType}`,
    data: context?.data || {},
    source: 'simplebeacon-alert-engine',
  };
}

/**
 * Deliver a single alert to its destination with retry logic.
 */
async function deliverAlert(rule, payload) {
  const url = rule.webhookUrl || rule.destination?.url;
  if (!url) {
    return { status: 'failed', error: 'No webhook URL configured', attempts: 0, responseStatus: null, responseBody: '', durationMs: 0 };
  }

  const body = JSON.stringify(payload);
  const secret = rule.destination?.secret || '';
  const signature = signPayload(body, secret);

  const headers = {
    'Content-Type': 'application/json',
    'X-SimpleBeacon-Event': payload.event,
    'X-SimpleBeacon-Signature': signature,
  };

  // Slack-specific formatting
  if (rule.destinationType === 'slack') {
    headers['Content-Type'] = 'application/json';
  }

  let lastError = '';
  let attempts = 0;
  const startTime = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    attempts++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(url, {
        method: 'POST',
        headers,
        body,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      const responseText = await response.text();
      const durationMs = Date.now() - startTime;

      if (response.ok) {
        return { status: 'delivered', error: '', attempts, responseStatus: response.status, responseBody: responseText.slice(0, 500), durationMs };
      }

      lastError = `HTTP ${response.status}: ${responseText.slice(0, 200)}`;

      // 4xx errors are not retryable
      if (response.status >= 400 && response.status < 500) {
        return { status: 'failed', error: lastError, attempts, responseStatus: response.status, responseBody: responseText.slice(0, 500), durationMs };
      }
    } catch (err) {
      lastError = err.message;
    }

    // Exponential backoff
    if (attempt < MAX_RETRIES - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  const durationMs = Date.now() - startTime;
  return { status: 'failed', error: lastError, attempts, responseStatus: null, responseBody: '', durationMs };
}

/**
 * Process an event: find matching rules, build payloads, deliver, log incidents.
 * This is the main entry point called by trigger points.
 * @param {string} orgId
 * @param {string} eventType
 * @param {object} context — { severity, message, data }
 */
async function processEvent(orgId, eventType, context = {}) {
  const rules = ruleStore.findMatchingRules(orgId, eventType, context);
  if (rules.length === 0) return { dispatched: 0, results: [] };

  const results = [];

  for (const rule of rules) {
    const payload = buildPayload(eventType, context, orgId);

    // Deliver
    const delivery = await deliverAlert(rule, payload);

    // Log incident
    const incident = incidentStore.recordIncident({
      orgId,
      ruleId: rule.id,
      ruleName: rule.name,
      eventType,
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

    // Update rule fire stats
    ruleStore.updateFireStats(rule.id, orgId);

    results.push({ ruleId: rule.id, incidentId: incident.id, status: delivery.status });

    if (delivery.status === 'delivered') {
      logger.info(`[AlertDispatcher] Delivered alert for rule "${rule.name}" to ${rule.destinationType}`);
    } else {
      logger.warn(`[AlertDispatcher] Failed to deliver alert for rule "${rule.name}": ${delivery.error}`);
    }
  }

  return { dispatched: results.length, results };
}

module.exports = {
  processEvent,
  deliverAlert,
  buildPayload,
  signPayload,
};
