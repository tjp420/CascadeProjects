'use strict';

const auditLogger = require('./audit-logger.cjs');
const guardrailIncidentStore = require('./guardrail-incident-store.cjs');
const { processEvent } = require('./alert-dispatcher.cjs');
const logger = require('./app-logger.cjs');

const POLL_INTERVAL_MS = 60 * 1000;
const GUARDRAIL_SPIKE_THRESHOLD = 10;
const GUARDRAIL_SPIKE_WINDOW_MS = 5 * 60 * 1000;
const ALERT_COOLDOWN_MS = 15 * 60 * 1000;

const lastAlertedAt = new Map();
const lastGuardrailCounts = new Map();

function getKnownOrgIds() {
  const orgIds = new Set();
  try {
    const auditStore = auditLogger.query({ orgId: '', limit: 1 });
    if (auditStore && auditStore.entries) {
      for (const entry of auditStore.entries) {
        if (entry.orgId) orgIds.add(entry.orgId);
      }
    }
  } catch {}
  try {
    const stats = guardrailIncidentStore.getStats('');
    if (stats && stats.total > 0) orgIds.add('default');
  } catch {}
  orgIds.add('default');
  return [...orgIds];
}

function shouldAlert(key) {
  const last = lastAlertedAt.get(key);
  if (!last) return true;
  return Date.now() - last > ALERT_COOLDOWN_MS;
}

function markAlerted(key) {
  lastAlertedAt.set(key, Date.now());
}

async function checkAuditChain(orgId) {
  try {
    const result = auditLogger.verifyChain(orgId);
    if (!result.valid) {
      const alertKey = `audit_chain_broken:${orgId}`;
      if (!shouldAlert(alertKey)) return;

      logger.warn(
        `[SecurityMonitor] Audit chain broken for org ${orgId}: ${result.reason}`
      );

      await processEvent(orgId, 'audit_chain_broken', {
        severity: 'critical',
        message: `Audit log integrity failure: ${result.reason}`,
        data: {
          orgId,
          brokenEntryId: result.brokenEntryId,
          brokenAt: result.brokenAt,
          verifiedEntries: result.verifiedEntries,
          totalEntries: result.totalEntries,
        },
      });

      markAlerted(alertKey);
    }
  } catch (err) {
    logger.warn(`[SecurityMonitor] Audit chain check failed for ${orgId}:`, err.message);
  }
}

async function checkGuardrailAnomalies(orgId) {
  try {
    const stats = guardrailIncidentStore.getStats(orgId);
    const currentBlocked = stats.blockedCount || 0;

    const lastBlocked = lastGuardrailCounts.get(orgId) || 0;
    const delta = currentBlocked - lastBlocked;

    if (delta >= GUARDRAIL_SPIKE_THRESHOLD) {
      const alertKey = `guardrail_anomaly_spike:${orgId}`;
      if (!shouldAlert(alertKey)) return;

      logger.warn(
        `[SecurityMonitor] Guardrail anomaly spike for org ${orgId}: ${delta} new blocks`
      );

      await processEvent(orgId, 'guardrail_anomaly_spike', {
        severity: 'high',
        message: `Guardrail anomaly spike: ${delta} new blocked incidents detected`,
        data: {
          orgId,
          currentBlocked,
          previousBlocked: lastBlocked,
          delta,
          byVerdict: stats.byVerdict,
          byMatchType: stats.byMatchType,
        },
      });

      markAlerted(alertKey);
    }

    lastGuardrailCounts.set(orgId, currentBlocked);
  } catch (err) {
    logger.warn(`[SecurityMonitor] Guardrail check failed for ${orgId}:`, err.message);
  }
}

async function runChecks() {
  const orgIds = getKnownOrgIds();
  for (const orgId of orgIds) {
    await checkAuditChain(orgId);
    await checkGuardrailAnomalies(orgId);
  }
}

let intervalId = null;

function start() {
  if (intervalId) return;
  logger.info('[SecurityMonitor] Starting security threat monitor');
  setTimeout(runChecks, 10 * 1000);
  intervalId = setInterval(runChecks, POLL_INTERVAL_MS);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[SecurityMonitor] Stopped security threat monitor');
  }
}

module.exports = { start, stop, runChecks };
