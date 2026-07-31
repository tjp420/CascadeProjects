'use strict';

const auditLogger = require('./audit-logger.cjs');
const guardrailIncidentStore = require('./guardrail-incident-store.cjs');
const { processEvent } = require('./alert-dispatcher.cjs');
const logger = require('./app-logger.cjs');
const settingsStore = require('./security-monitor-settings-store.cjs');

// Default constants — now overridable via settings store
const DEFAULT_POLL_INTERVAL_MS = 60 * 1000;
const DEFAULT_GUARDRAIL_SPIKE_THRESHOLD = 10;
const DEFAULT_GUARDRAIL_SPIKE_WINDOW_MS = 5 * 60 * 1000;
const DEFAULT_ALERT_COOLDOWN_MS = 15 * 60 * 1000;

function getSettings() {
  return settingsStore.getSettings();
}

function getPollIntervalMs() {
  return getSettings().pollIntervalMs || DEFAULT_POLL_INTERVAL_MS;
}

function getGuardrailSpikeThreshold() {
  return getSettings().guardrailSpikeThreshold || DEFAULT_GUARDRAIL_SPIKE_THRESHOLD;
}

function getAlertCooldownMs() {
  return getSettings().alertCooldownMs || DEFAULT_ALERT_COOLDOWN_MS;
}

function isAutoHealEnabled() {
  const settings = getSettings();
  if (settings.autoHealEnabled !== undefined) return settings.autoHealEnabled;
  return process.env.AUDIT_CHAIN_AUTO_HEAL !== 'false';
}

function isChainCheckEnabled() {
  return getSettings().chainIntegrityCheckEnabled !== false;
}

function isGuardrailCheckEnabled() {
  return getSettings().guardrailAnomalyCheckEnabled !== false;
}

const lastAlertedAt = new Map();
const lastGuardrailCounts = new Map();

// Status tracking — exposed via API for monitoring
let lastRunAt = null;
let lastRunDurationMs = 0;
let lastResults = null; // { orgsChecked, chainResults: [{ orgId, valid, ... }], guardrailResults: [...] }
let runCount = 0;

function getKnownOrgIds() {
  const orgIds = new Set();
  try {
    // Query with a high limit to discover all orgs that have audit entries
    const auditStore = auditLogger.query({ orgId: '', limit: 10000 });
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
  return Date.now() - last > getAlertCooldownMs();
}

function markAlerted(key) {
  lastAlertedAt.set(key, Date.now());
}

async function runChecks() {
  const startTime = Date.now();
  const orgIds = getKnownOrgIds();
  const chainResults = [];
  const guardrailResults = [];

  for (const orgId of orgIds) {
    // Capture chain verification result for status reporting
    if (isChainCheckEnabled()) {
      const chainResult = auditLogger.verifyChain(orgId);
      chainResults.push({ orgId, ...chainResult });

    if (!chainResult.valid) {
      const alertKey = `audit_chain_broken:${orgId}`;
      if (shouldAlert(alertKey)) {
        logger.warn(
          `[SecurityMonitor] Audit chain broken for org ${orgId}: ${chainResult.reason}`
        );
        await processEvent(orgId, 'audit_chain_broken', {
          severity: 'critical',
          message: `Audit log integrity failure: ${chainResult.reason}`,
          data: {
            orgId,
            brokenEntryId: chainResult.brokenEntryId,
            brokenAt: chainResult.brokenAt,
            verifiedEntries: chainResult.verifiedEntries,
            totalEntries: chainResult.totalEntries,
          },
        });
        markAlerted(alertKey);
      }

      // Auto-heal: quarantine broken entries and re-seal the chain
      if (isAutoHealEnabled()) {
        try {
          const healResult = auditLogger.healChain(orgId);
          if (healResult.healed) {
            logger.info(
              `[SecurityMonitor] Auto-healed chain for org ${orgId}: ${healResult.quarantined} quarantined, seal=${healResult.sealEntryId}`
            );
            // Update the chain result to reflect healed state
            chainResults[chainResults.length - 1].healed = true;
            chainResults[chainResults.length - 1].healResult = healResult;
          }
        } catch (healErr) {
          logger.warn(
            `[SecurityMonitor] Auto-heal failed for org ${orgId}:`,
            healErr.message
          );
        }
      }
    }
    } // end chainIntegrityCheckEnabled

    // Guardrail anomaly check
    if (isGuardrailCheckEnabled()) {
    try {
      const stats = guardrailIncidentStore.getStats(orgId);
      const currentBlocked = stats.blockedCount || 0;
      const lastBlocked = lastGuardrailCounts.get(orgId) || 0;
      const delta = currentBlocked - lastBlocked;

      guardrailResults.push({ orgId, currentBlocked, previousBlocked: lastBlocked, delta });

      if (delta >= getGuardrailSpikeThreshold()) {
        const alertKey = `guardrail_anomaly_spike:${orgId}`;
        if (shouldAlert(alertKey)) {
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
      }

      lastGuardrailCounts.set(orgId, currentBlocked);
    } catch (err) {
      logger.warn(`[SecurityMonitor] Guardrail check failed for ${orgId}:`, err.message);
    }
    } // end guardrailAnomalyCheckEnabled
  }

  lastRunAt = new Date().toISOString();
  lastRunDurationMs = Date.now() - startTime;
  runCount++;
  lastResults = { orgsChecked: orgIds.length, chainResults, guardrailResults };
}

/**
 * Run a single verification cycle immediately (manual trigger).
 * Bypasses the alert cooldown so manual checks always fire alerts.
 * @returns {Promise<object>} — the lastResults from this run
 */
async function runOnce() {
  await runChecks();
  return lastResults;
}

/**
 * Get the current status of the security monitor.
 * @returns {object}
 */
function getStatus() {
  const settings = getSettings();
  return {
    running: intervalId !== null,
    pollIntervalMs: getPollIntervalMs(),
    autoHealEnabled: isAutoHealEnabled(),
    guardrailSpikeThreshold: getGuardrailSpikeThreshold(),
    alertCooldownMs: getAlertCooldownMs(),
    chainIntegrityCheckEnabled: isChainCheckEnabled(),
    guardrailAnomalyCheckEnabled: isGuardrailCheckEnabled(),
    lastRunAt,
    lastRunDurationMs,
    runCount,
    orgsTracked: lastResults ? lastResults.orgsChecked : 0,
    lastResults,
    settingsUpdatedAt: settings.updatedAt,
  };
}

let intervalId = null;

function start() {
  if (intervalId) return;
  const pollMs = getPollIntervalMs();
  logger.info(`[SecurityMonitor] Starting security threat monitor (poll: ${pollMs}ms)`);
  setTimeout(runChecks, 10 * 1000);
  intervalId = setInterval(runChecks, pollMs);
}

function stop() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info('[SecurityMonitor] Stopped security threat monitor');
  }
}

/**
 * Restart the monitor with updated settings (live-reload poll interval).
 */ function restart() {
  if (intervalId) {
    stop();
    start();
  }
}

module.exports = { start, stop, restart, runChecks, runOnce, getStatus };
