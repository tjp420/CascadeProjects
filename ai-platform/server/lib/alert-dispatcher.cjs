'use strict';

const crypto = require('crypto');
const logger = require('../../src/lib/app-logger.cjs');
const ruleStore = require('./alert-rule-store.cjs');
const incidentStore = require('./alert-incident-store.cjs');
const { sendEmail } = require('./email-service.cjs');

const MAX_RETRIES = 3;
const BASE_DELAY_MS = 1000;

/**
 * Incident broadcaster callback — injected by the server to broadcast incidents
 * over WebSocket to connected dashboard clients. Fire-and-forget: errors here
 * must never block alert delivery.
 */
let incidentBroadcaster = null;

/**
 * Register a broadcast callback invoked after each incident is recorded.
 * The callback receives { type: 'INCIDENT_STREAM', data: incident }.
 * @param {function|null} fn — broadcast function or null to clear
 */
function setIncidentBroadcaster(fn) {
  incidentBroadcaster = typeof fn === 'function' ? fn : null;
}

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
 * Map severity to Slack attachment color hex codes.
 */
const SEVERITY_COLORS = {
  critical: '#FF0000', // red
  high: '#FF8C00',     // dark orange
  medium: '#FFD700',   // gold
  low: '#00BFFF',      // deep sky blue
  info: '#36A2EB',     // blue
};

/**
 * Format an alert payload as a Slack Incoming Webhook message.
 * Returns a JSON string ready to POST to a Slack webhook URL.
 * @param {object} payload — the alert payload from buildPayload()
 * @returns {string} JSON string for Slack webhook
 */
function formatSlackMessage(payload) {
  const color = SEVERITY_COLORS[payload.severity] || SEVERITY_COLORS.info;
  const severityEmoji = payload.severity === 'critical' ? ':rotating_light:'
    : payload.severity === 'high' ? ':warning:'
    : payload.severity === 'medium' ? ':yellow_heart:'
    : ':information_source:';

  const fields = [];
  if (payload.data && typeof payload.data === 'object') {
    for (const [key, value] of Object.entries(payload.data)) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      fields.push({ title: key, value: displayValue, short: displayValue.length <= 25 });
    }
  }

  return JSON.stringify({
    text: `${severityEmoji} *SimpleBeacon Alert*: ${payload.event}`,
    attachments: [
      {
        color,
        title: payload.event,
        text: payload.message,
        fields: fields.length > 0 ? fields.slice(0, 10) : undefined,
        footer: payload.source,
        ts: Math.floor(new Date(payload.timestamp).getTime() / 1000),
      },
    ],
  });
}

/**
 * Format an alert payload as an email message with subject, text, and HTML body.
 * @param {object} payload — the alert payload from buildPayload()
 * @returns {{ subject: string, text: string, html: string }}
 */
function formatEmailMessage(payload) {
  const severityTag = payload.severity.toUpperCase();
  const subject = `[SimpleBeacon Alert] ${severityTag}: ${payload.event}`;

  const lines = [
    `SimpleBeacon Alert`,
    ``,
    `Event:      ${payload.event}`,
    `Severity:   ${payload.severity}`,
    `Message:    ${payload.message}`,
    `Timestamp:  ${payload.timestamp}`,
    `Org ID:     ${payload.orgId}`,
  ];

  if (payload.data && typeof payload.data === 'object' && Object.keys(payload.data).length > 0) {
    lines.push(``, `Details:`);
    for (const [key, value] of Object.entries(payload.data)) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      lines.push(`  ${key}: ${displayValue}`);
    }
  }

  lines.push(``, `Source: ${payload.source}`);

  const text = lines.join('\n');

  const dataRows = [];
  if (payload.data && typeof payload.data === 'object') {
    for (const [key, value] of Object.entries(payload.data)) {
      const displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
      dataRows.push(`<tr><td style="padding:2px 8px;font-weight:bold;">${key}</td><td style="padding:2px 8px;">${displayValue}</td></tr>`);
    }
  }

  const html = `<div style="font-family:sans-serif;max-width:600px;">
<h2 style="color:${SEVERITY_COLORS[payload.severity] || SEVERITY_COLORS.info};">SimpleBeacon Alert</h2>
<table style="border-collapse:collapse;margin-bottom:16px;">
<tr><td style="padding:2px 8px;font-weight:bold;">Event</td><td style="padding:2px 8px;">${payload.event}</td></tr>
<tr><td style="padding:2px 8px;font-weight:bold;">Severity</td><td style="padding:2px 8px;text-transform:uppercase;color:${SEVERITY_COLORS[payload.severity] || SEVERITY_COLORS.info};">${payload.severity}</td></tr>
<tr><td style="padding:2px 8px;font-weight:bold;">Message</td><td style="padding:2px 8px;">${payload.message}</td></tr>
<tr><td style="padding:2px 8px;font-weight:bold;">Timestamp</td><td style="padding:2px 8px;">${payload.timestamp}</td></tr>
</table>
${dataRows.length > 0 ? `<h3>Details</h3><table style="border-collapse:collapse;margin-bottom:16px;">${dataRows.join('')}</table>` : ''}
<p style="color:#888;font-size:12px;">Source: ${payload.source}</p>
</div>`;

  return { subject, text, html };
}

/**
 * Deliver an alert via email using the existing email-service.cjs infrastructure.
 * Bypasses the HTTP fetch loop — uses sendEmail() directly.
 */
async function deliverEmailAlert(rule, payload) {
  const recipient = rule.destination?.email || rule.destination?.to || '';
  if (!recipient) {
    return { status: 'failed', error: 'No email recipient configured (set destination.email)', attempts: 0, responseStatus: null, responseBody: '', durationMs: 0 };
  }

  const { subject, text, html } = formatEmailMessage(payload);
  const startTime = Date.now();

  try {
    const result = await sendEmail({ to: recipient, subject, text, html });
    const durationMs = Date.now() - startTime;

    if (result.sent) {
      return { status: 'delivered', error: '', attempts: 1, responseStatus: 200, responseBody: `Email sent via ${result.provider || 'email-service'}`, durationMs };
    }
    if (result.queued) {
      return { status: 'delivered', error: '', attempts: 1, responseStatus: 200, responseBody: 'Email queued to disk for later delivery', durationMs };
    }
    return { status: 'failed', error: result.error || 'Email send failed', attempts: 1, responseStatus: null, responseBody: '', durationMs };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    return { status: 'failed', error: err.message, attempts: 1, responseStatus: null, responseBody: '', durationMs };
  }
}

/**
 * Map SimpleBeacon severity to PagerDuty severity.
 * PagerDuty accepts: critical, error, warning, info
 */
const PAGERDUTY_SEVERITY_MAP = {
  critical: 'critical',
  high: 'error',
  medium: 'warning',
  low: 'info',
  info: 'info',
};

/**
 * Format an alert payload as a PagerDuty Events API v2 event.
 * @param {object} payload — the alert payload from buildPayload()
 * @param {object} rule — the alert rule (for routing key and dedup key)
 * @returns {object} PagerDuty Events v2 payload
 */
function formatPagerDutyEvent(payload, rule) {
  const routingKey = rule.destination?.routingKey || rule.webhookUrl || '';
  const dedupKey = rule.destination?.dedupKey || `${payload.orgId}:${payload.event}`;

  return {
    routing_key: routingKey,
    event_action: 'trigger',
    dedup_key: dedupKey.slice(0, 255),
    payload: {
      summary: payload.message.slice(0, 1024),
      source: payload.data?.repository || payload.data?.source || payload.source,
      severity: PAGERDUTY_SEVERITY_MAP[payload.severity] || 'info',
      timestamp: payload.timestamp,
      component: payload.data?.component || '',
      group: payload.data?.group || payload.orgId,
      class: payload.event,
      custom_details: payload.data || {},
    },
  };
}

/**
 * Deliver an alert via PagerDuty Events API v2.
 * POSTs to https://events.pagerduty.com/v2/enqueue with retry logic.
 * @param {object} rule — the alert rule
 * @param {object} payload — the alert payload
 * @returns {Promise<object>} delivery result
 */
async function deliverPagerDutyAlert(rule, payload) {
  const event = formatPagerDutyEvent(payload, rule);
  if (!event.routing_key) {
    return { status: 'failed', error: 'No PagerDuty routing key configured (set destination.routingKey or webhookUrl)', attempts: 0, responseStatus: null, responseBody: '', durationMs: 0 };
  }

  const body = JSON.stringify(event);
  let lastError = '';
  let attempts = 0;
  const startTime = Date.now();

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    attempts++;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

    if (attempt < MAX_RETRIES - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise(r => setTimeout(r, delay));
    }
  }

  const durationMs = Date.now() - startTime;
  return { status: 'failed', error: lastError, attempts, responseStatus: null, responseBody: '', durationMs };
}

/**
 * Deliver a single alert to its destination with retry logic.
 */
async function deliverAlert(rule, payload) {
  // Email destination uses a separate delivery path (no HTTP fetch)
  if (rule.destinationType === 'email') {
    return deliverEmailAlert(rule, payload);
  }

  // PagerDuty destination uses the Events API v2 endpoint
  if (rule.destinationType === 'pagerduty') {
    return deliverPagerDutyAlert(rule, payload);
  }

  const url = rule.webhookUrl || rule.destination?.url;
  if (!url) {
    return {
      status: 'failed',
      error: 'No webhook URL configured',
      attempts: 0,
      responseStatus: null,
      responseBody: '',
      durationMs: 0,
    };
  }

  const isSlack = rule.destinationType === 'slack';
  const body = isSlack ? formatSlackMessage(payload) : JSON.stringify(payload);
  const secret = rule.destination?.secret || '';
  const signature = signPayload(body, secret);

  const headers = {
    'Content-Type': 'application/json',
    'X-SimpleBeacon-Event': payload.event,
    'X-SimpleBeacon-Signature': signature,
  };

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
        return {
          status: 'delivered',
          error: '',
          attempts,
          responseStatus: response.status,
          responseBody: responseText.slice(0, 500),
          durationMs,
        };
      }

      lastError = `HTTP ${response.status}: ${responseText.slice(0, 200)}`;

      // 4xx errors are not retryable
      if (response.status >= 400 && response.status < 500) {
        return {
          status: 'failed',
          error: lastError,
          attempts,
          responseStatus: response.status,
          responseBody: responseText.slice(0, 500),
          durationMs,
        };
      }
    } catch (err) {
      lastError = err.message;
    }

    // Exponential backoff
    if (attempt < MAX_RETRIES - 1) {
      const delay = BASE_DELAY_MS * Math.pow(2, attempt);
      await new Promise((r) => setTimeout(r, delay));
    }
  }

  const durationMs = Date.now() - startTime;
  return {
    status: 'failed',
    error: lastError,
    attempts,
    responseStatus: null,
    responseBody: '',
    durationMs,
  };
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

    // Broadcast incident to connected WebSocket clients (fire-and-forget)
    if (incidentBroadcaster) {
      try {
        incidentBroadcaster({
          type: 'INCIDENT_STREAM',
          data: {
            id: incident.id,
            ruleId: rule.id,
            ruleName: rule.name,
            status: delivery.status,
            destinationType: rule.destinationType,
            createdAt: incident.timestamp || incident.createdAt || new Date().toISOString(),
            error: delivery.error || '',
          },
        });
      } catch (broadcastErr) {
        logger.warn('[AlertDispatcher] Incident broadcast failed:', broadcastErr.message);
      }
    }

    // Update rule fire stats
    ruleStore.updateFireStats(rule.id, orgId);

    results.push({ ruleId: rule.id, incidentId: incident.id, status: delivery.status });

    if (delivery.status === 'delivered') {
      logger.info(
        `[AlertDispatcher] Delivered alert for rule "${rule.name}" to ${rule.destinationType}`
      );
    } else {
      logger.warn(
        `[AlertDispatcher] Failed to deliver alert for rule "${rule.name}": ${delivery.error}`
      );
    }
  }

  return { dispatched: results.length, results };
}

module.exports = {
  processEvent,
  deliverAlert,
  buildPayload,
  signPayload,
  formatSlackMessage,
  formatEmailMessage,
  formatPagerDutyEvent,
  setIncidentBroadcaster,
};
