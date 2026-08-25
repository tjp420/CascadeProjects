"use strict";

/**
 * Milestone 4: Quantum-hybrid handshake production canary rollout controller.
 *
 * Provides deterministic node enrollment, threshold-based rollback, and
 * deprecation-window state resolution for the `CLUSTER_QUANTUM_HYBRID`
 * default promotion.
 *
 * @module quantum-hybrid-rollout
 */

// Best-effort: try to record into the cluster-wide timeline (if available)
let _clusterSync = null;
try {
  _clusterSync = require("./cluster-keyring-sync.cjs");
} catch (e) {
  _clusterSync = null;
}

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const DEFAULT_CONFIG_PATH = path.join(
  __dirname,
  "..",
  "config",
  "quantum-hybrid-canary.json",
);

const ROLLOUT_EVENT = "quantum_hybrid_rollback";
const MS_PER_DAY = 24 * 60 * 60 * 1000;

let _telemetryRecorder = null;

/**
 * Inject a function to pipe rollout events into the unified cluster timeline.
 * @param {Function} fn - (eventType, node, details) => void
 */
function setTelemetryRecorder(fn) {
  _telemetryRecorder = fn;
}

function _recordTelemetry(details) {
  if (typeof _telemetryRecorder === "function") {
    try {
      _telemetryRecorder(ROLLOUT_EVENT, null, details);
    } catch {
      // best-effort telemetry; do not block rollback logic
    }
  }
}

/**
 * Load the canary configuration from disk.
 * @param {string} [configPath]
 * @returns {object}
 */
function loadCanaryConfig(configPath) {
  const p = configPath || DEFAULT_CONFIG_PATH;
  const raw = fs.readFileSync(p, "utf8");
  return JSON.parse(raw);
}

/**
 * Resolve the active configuration, applying runtime environment overrides.
 * @returns {object}
 */
function getCanaryConfig() {
  const config = loadCanaryConfig();

  const percent = process.env.CLUSTER_QUANTUM_HYBRID_PERCENT;
  if (percent !== undefined) {
    config.canary_parameters.stages = [parseInt(percent, 10)];
  }

  const nodeList = (process.env.CLUSTER_QUANTUM_HYBRID_NODE_LIST || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  config.canary_parameters.node_allowlist = nodeList;

  const enabled = process.env.CLUSTER_QUANTUM_HYBRID_DEFAULT;
  if (enabled !== undefined) {
    config.canary_parameters.default_enabled =
      enabled === "1" || enabled === "true";
  }

  return config;
}

/**
 * Deterministic 0-99 enrollment score for a node.
 * @param {string} nodeId
 * @param {string} salt
 * @returns {number}
 */
function enrollmentScore(nodeId, salt) {
  const hash = crypto
    .createHash("sha256")
    .update(String(nodeId))
    .update(salt)
    .digest();
  return hash.readUInt32BE(0) % 100;
}

/**
 * Decide whether this node should enable the hybrid handshake.
 * @param {string} nodeId
 * @param {object} [config]
 * @returns {boolean}
 */
function shouldEnableHybrid(nodeId, config) {
  const cfg = config || getCanaryConfig();
  const params = cfg.canary_parameters || {};

  if (!params.default_enabled) {
    return false;
  }

  const allowlist = new Set(params.node_allowlist || []);
  if (allowlist.has(String(nodeId))) {
    return true;
  }

  const stages =
    Array.isArray(params.stages) && params.stages.length ? params.stages : [0];
  const activePercent = stages[stages.length - 1];

  const salt = params.salt || "simplebeacon:canary:v1";
  return enrollmentScore(nodeId, salt) < activePercent;
}

/**
 * Evaluate metrics against rollback thresholds.
 * @param {object} metrics
 * @param {object} [config]
 * @returns {{ shouldRollback: boolean, reasons: string[] }}
 */
function checkRollback(metrics, config) {
  const cfg = config || getCanaryConfig();
  const th = cfg.rollback_thresholds || {};
  const reasons = [];

  if (metrics == null || typeof metrics !== "object") {
    return { shouldRollback: false, reasons };
  }

  const connectionDropSpike =
    (metrics.connectionDropRatePct || 0) -
    (metrics.baselineConnectionDropRatePct || 0);
  if (connectionDropSpike > (th.connection_drop_rate_spike_pct || 5.0)) {
    reasons.push(`connection_drop_spike: ${connectionDropSpike.toFixed(2)}%`);
  }

  if (
    (metrics.handshakeFailureRatePct || 0) >
    (th.handshake_failure_rate_pct || 10.0)
  ) {
    reasons.push(
      `handshake_failure_rate: ${metrics.handshakeFailureRatePct.toFixed(2)}%`,
    );
  }

  if (
    (metrics.downgradeRejectedRatePct || 0) >
    (th.downgrade_rejected_rate_pct || 5.0)
  ) {
    reasons.push(
      `downgrade_rejected_rate: ${metrics.downgradeRejectedRatePct.toFixed(2)}%`,
    );
  }

  const hbMultiplier = metrics.baselineHeartbeatTimeoutRatePct
    ? (metrics.heartbeatTimeoutRatePct || 0) /
      metrics.baselineHeartbeatTimeoutRatePct
    : 0;
  if (
    hbMultiplier > (th.heartbeat_timeout_multiplier || 2.0) &&
    (metrics.heartbeatTimeoutRatePct || 0) > 0
  ) {
    reasons.push(`heartbeat_timeout_multiplier: ${hbMultiplier.toFixed(2)}x`);
  }

  const perNode = metrics.perNodeHandshakeFailurePct || {};
  for (const [node, rate] of Object.entries(perNode)) {
    if (rate > (th.single_node_failure_max_pct || 50.0)) {
      reasons.push(`single_node_failure: ${node}=${rate.toFixed(2)}%`);
    }
  }

  const shouldRollback = reasons.length > 0;
  if (shouldRollback) {
    const details = {
      reasons,
      metricsSnapshot: metrics,
      triggeredAt: Date.now(),
    };
    try {
      if (_clusterSync && typeof _clusterSync.recordTelemetry === "function") {
        const evtType =
          (_clusterSync.EVENT_TYPES &&
            _clusterSync.EVENT_TYPES.QUANTUM_ROLLBACK) ||
          ROLLOUT_EVENT;
        _clusterSync.recordTelemetry(evtType, null, details);
      }
      // Determine severity for hybrid enforcement
      let hard = false;
      // Severe if metrics exceed 2x configured thresholds
      if (
        (metrics.connectionDropRatePct || 0) -
          (metrics.baselineConnectionDropRatePct || 0) >
        (th.connection_drop_rate_spike_pct || 5.0) * 2
      ) {
        hard = true;
      }
      if (
        (metrics.handshakeFailureRatePct || 0) >
        (th.handshake_failure_rate_pct || 10.0) * 2
      ) {
        hard = true;
      }
      const perNode2 = metrics.perNodeHandshakeFailurePct || {};
      for (const [node, rate] of Object.entries(perNode2)) {
        if (rate > (th.single_node_failure_max_pct || 50.0) * 2) {
          hard = true;
          break;
        }
      }

      if (
        _clusterSync &&
        typeof _clusterSync.tripCanaryCircuit === "function"
      ) {
        _clusterSync.tripCanaryCircuit(hard);
      }
    } catch (e) {
      console.error("quantum-hybrid-rollout.cjs error:", e);
      // swallow telemetry errors — rollback decision must not fail
    }
  }
  return { shouldRollback, reasons };
}

/**
 * Determine whether `QUANTUM_DEGRADE_ALLOWED` should still be active.
 * @param {number} rolloutStartTimeMs
 * @param {number} [deprecationWindowDays]
 * @returns {boolean}
 */
function resolveDeprecationState(rolloutStartTimeMs, deprecationWindowDays) {
  const window =
    (deprecationWindowDays !== undefined ? deprecationWindowDays : 14) *
    MS_PER_DAY;
  return Date.now() - rolloutStartTimeMs < window;
}

module.exports = {
  loadCanaryConfig,
  getCanaryConfig,
  enrollmentScore,
  shouldEnableHybrid,
  checkRollback,
  resolveDeprecationState,
  setTelemetryRecorder,
  ROLLOUT_EVENT,
};
