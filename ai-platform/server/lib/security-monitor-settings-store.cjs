'use strict';

/**
 * Security Monitor Settings Store — Persisted configuration for
 * anomaly detection thresholds, alert cooldown profiles, and rolling
 * baseline parameters. Allows administrators to live-update security
 * monitor behavior without restarting the server.
 *
 * @module security-monitor-settings-store
 */

const fs = require('fs');
const path = require('path');

const SETTINGS_PATH =
  process.env.SECURITY_MONITOR_SETTINGS_PATH ||
  path.join(process.cwd(), '.simplebeacon', 'security-monitor-settings.json');

const DEFAULT_SETTINGS = {
  pollIntervalMs: 60 * 1000,
  guardrailSpikeThreshold: 10,
  guardrailSpikeWindowMs: 5 * 60 * 1000,
  alertCooldownMs: 15 * 60 * 1000,
  autoHealEnabled: true,
  rollingBaselineWindowMs: 60 * 60 * 1000,
  anomalyDeltaThreshold: 10,
  anomalySeverityLevels: ['critical', 'high', 'medium'],
  chainIntegrityCheckEnabled: true,
  guardrailAnomalyCheckEnabled: true,
  maxAlertsPerOrgPerHour: 20,
  webhookKeyAutoPurgeEnabled: true,
  webhookKeyGraceWindowMs: 24 * 60 * 60 * 1000,
  updatedAt: null,
};

let _cache = null;
let _cacheDirty = true;

function readStore() {
  if (_cache && !_cacheDirty) return _cache;
  try {
    if (fs.existsSync(SETTINGS_PATH)) {
      const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
      _cache = Object.assign({}, DEFAULT_SETTINGS, JSON.parse(raw));
    } else {
      _cache = Object.assign({}, DEFAULT_SETTINGS);
    }
  } catch {
    _cache = Object.assign({}, DEFAULT_SETTINGS);
  }
  _cacheDirty = false;
  return _cache;
}

function writeStore(store) {
  const dir = path.dirname(SETTINGS_PATH);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const tmp = SETTINGS_PATH + '.tmp';
  fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
  fs.renameSync(tmp, SETTINGS_PATH);
  _cache = store;
  _cacheDirty = false;
}

function getSettings() {
  return readStore();
}

function updateSettings(updates) {
  const current = readStore();
  const updated = Object.assign({}, current, updates, {
    updatedAt: new Date().toISOString(),
  });

  // Validate numeric fields
  if (updated.pollIntervalMs !== undefined && updated.pollIntervalMs < 10000) {
    return { success: false, error: 'pollIntervalMs must be at least 10000 (10 seconds)' };
  }
  if (updated.guardrailSpikeThreshold !== undefined && updated.guardrailSpikeThreshold < 1) {
    return { success: false, error: 'guardrailSpikeThreshold must be at least 1' };
  }
  if (updated.guardrailSpikeWindowMs !== undefined && updated.guardrailSpikeWindowMs < 60000) {
    return { success: false, error: 'guardrailSpikeWindowMs must be at least 60000 (1 minute)' };
  }
  if (updated.alertCooldownMs !== undefined && updated.alertCooldownMs < 0) {
    return { success: false, error: 'alertCooldownMs must be >= 0' };
  }
  if (updated.rollingBaselineWindowMs !== undefined && updated.rollingBaselineWindowMs < 60000) {
    return { success: false, error: 'rollingBaselineWindowMs must be at least 60000 (1 minute)' };
  }
  if (updated.anomalyDeltaThreshold !== undefined && updated.anomalyDeltaThreshold < 1) {
    return { success: false, error: 'anomalyDeltaThreshold must be at least 1' };
  }
  if (updated.maxAlertsPerOrgPerHour !== undefined && updated.maxAlertsPerOrgPerHour < 1) {
    return { success: false, error: 'maxAlertsPerOrgPerHour must be at least 1' };
  }
  if (updated.webhookKeyGraceWindowMs !== undefined && updated.webhookKeyGraceWindowMs < 60000) {
    return { success: false, error: 'webhookKeyGraceWindowMs must be at least 60000 (1 minute)' };
  }

  // Validate severity levels
  if (updated.anomalySeverityLevels !== undefined) {
    const valid = ['critical', 'high', 'medium', 'low', 'info'];
    if (!Array.isArray(updated.anomalySeverityLevels)) {
      return { success: false, error: 'anomalySeverityLevels must be an array' };
    }
    for (const s of updated.anomalySeverityLevels) {
      if (!valid.includes(s)) {
        return { success: false, error: 'Invalid severity level: ' + s };
      }
    }
  }

  writeStore(updated);
  return { success: true, settings: updated };
}

function resetSettings() {
  const reset = Object.assign({}, DEFAULT_SETTINGS, {
    updatedAt: new Date().toISOString(),
  });
  writeStore(reset);
  return { success: true, settings: reset };
}

function getDefaults() {
  return Object.assign({}, DEFAULT_SETTINGS);
}

module.exports = {
  getSettings,
  updateSettings,
  resetSettings,
  getDefaults,
  SETTINGS_PATH,
};
