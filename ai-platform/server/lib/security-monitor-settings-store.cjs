'use strict';

/**
 * Security Monitor Settings Store ?????? Persisted configuration for
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
  orgPartitionEnforcementEnabled: true,
  orgPartitionAlertOnViolation: true,
  orgPartitionViolationAlertThreshold: 5,
  // Violation retention policy
  orgPartitionViolationTtlMs: 24 * 60 * 60 * 1000, // 24 hours
  orgPartitionViolationMaxLog: 1000,
  orgPartitionViolationCleanupIntervalMs: 5 * 60 * 1000, // 5 minutes
  orgPartitionViolationMemoryGuardMb: 50, // refuse to store new violations above this
  // ── Stream Interdiction Engine ──
  // Multi-axis sliding-window failure tracker that auto-interdicts API keys
  // when failure rates exceed per-type thresholds within the rolling window.
  streamInterdictionEnabled: true,
  streamInterdictionWindowMs: 5 * 60 * 1000, // 5 minute sliding window
  streamInterdictionTtlMs: 30 * 60 * 1000, // 30 minute lockout for stream-triggered
  streamInterdictionMaxFailures: 10000, // max failure records in memory
  streamInterdictionThresholds: {
    chain_verification: 3, // chain integrity failures in window
    pii_violation: 5, // unredacted PII detected in window
    guardrail_refusal: 5, // agent guardrail refusals in window
    auth_failure: 10, // authentication failures in window
    org_partition: 5, // cross-org access violations in window
    rate_limit: 10, // rate limit breaches in window
    bundle_verification: 3, // compliance bundle verification failures in window
  },
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
  try {
    fs.writeFileSync(SETTINGS_PATH, JSON.stringify(store, null, 2), 'utf8');
  } catch (e) {
    console.error('security-monitor-settings-store.cjs error:', e);
    // Fallback: write to temp then rename (atomic write pattern)
    const tmp = SETTINGS_PATH + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(store, null, 2), 'utf8');
    try { fs.unlinkSync(SETTINGS_PATH); } catch (_) {}
    fs.renameSync(tmp, SETTINGS_PATH);
  }
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
  if (
    updated.orgPartitionViolationAlertThreshold !== undefined &&
    updated.orgPartitionViolationAlertThreshold < 1
  ) {
    return {
      success: false,
      error: 'orgPartitionViolationAlertThreshold must be at least 1',
    };
  }
  if (updated.orgPartitionViolationTtlMs !== undefined && updated.orgPartitionViolationTtlMs < 60000) {
    return {
      success: false,
      error: 'orgPartitionViolationTtlMs must be at least 60000 (1 minute)',
    };
  }
  if (updated.orgPartitionViolationMaxLog !== undefined && updated.orgPartitionViolationMaxLog < 10) {
    return {
      success: false,
      error: 'orgPartitionViolationMaxLog must be at least 10',
    };
  }
  if (
    updated.orgPartitionViolationCleanupIntervalMs !== undefined &&
    updated.orgPartitionViolationCleanupIntervalMs < 10000
  ) {
    return {
      success: false,
      error: 'orgPartitionViolationCleanupIntervalMs must be at least 10000 (10 seconds)',
    };
  }
  if (
    updated.orgPartitionViolationMemoryGuardMb !== undefined &&
    updated.orgPartitionViolationMemoryGuardMb < 1
  ) {
    return {
      success: false,
      error: 'orgPartitionViolationMemoryGuardMb must be at least 1',
    };
  }

  // ── Stream Interdiction validation ──
  if (updated.streamInterdictionWindowMs !== undefined && updated.streamInterdictionWindowMs < 10000) {
    return {
      success: false,
      error: 'streamInterdictionWindowMs must be at least 10000 (10 seconds)',
    };
  }
  if (updated.streamInterdictionTtlMs !== undefined && updated.streamInterdictionTtlMs < 1000) {
    return {
      success: false,
      error: 'streamInterdictionTtlMs must be at least 1000 (1 second)',
    };
  }
  if (updated.streamInterdictionMaxFailures !== undefined && updated.streamInterdictionMaxFailures < 100) {
    return {
      success: false,
      error: 'streamInterdictionMaxFailures must be at least 100',
    };
  }
  if (updated.streamInterdictionThresholds !== undefined) {
    if (typeof updated.streamInterdictionThresholds !== 'object' || Array.isArray(updated.streamInterdictionThresholds)) {
      return { success: false, error: 'streamInterdictionThresholds must be an object' };
    }
    for (const [type, threshold] of Object.entries(updated.streamInterdictionThresholds)) {
      if (typeof threshold !== 'number' || threshold < 1) {
        return { success: false, error: `streamInterdictionThresholds.${type} must be a number >= 1` };
      }
    }
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
