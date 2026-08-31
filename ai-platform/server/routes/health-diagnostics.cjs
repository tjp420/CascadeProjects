"use strict";

/**
 * @module health-diagnostics
 * Automated health check endpoint and background cron runner.
 *
 * Exposes GET /api/v1/health/diagnostics which runs shallow + deep checks
 * on core infrastructure dependencies (encryption key, data files, memory).
 *
 * A background interval runs the same checks every 15 minutes and emits
 * CRITICAL_SYS_ALERT log traces when status slips to DOWN or DEGRADED.
 *
 * @file server/routes/health-diagnostics.cjs
 */

const express = require("express");
const fs = require("fs");
const path = require("path");
const logger = require("../lib/app-logger.cjs");

// Health alert notifier — sends Slack/Discord alerts on status transitions
let healthAlerts = null;
try {
  healthAlerts = require("../lib/health-alerts.cjs");
} catch (e) {
  logger.warn("[HealthDiagnostics] health-alerts not loaded:", e.message);
}

const router = express.Router();

const HEALTH_CHECK_INTERVAL_MS = 15 * 60 * 1000; // 15 minutes
const MEMORY_WARN_THRESHOLD_MB = 400; // heapUsed warning threshold
const MEMORY_CRITICAL_THRESHOLD_MB = 800; // heapUsed critical threshold

// ── Sub-system checkers ────────────────────────────────────────────────────

/**
 * Check encryption key availability.
 * Reads .simplebeacon/.encryption-key and verifies it contains a valid
 * 64-character hex key (256-bit AES key).
 * @returns {{ status: string, detail: object }}
 */
function checkEncryptionKey() {
  const keyPath = path.join(process.cwd(), ".simplebeacon", ".encryption-key");
  try {
    if (!fs.existsSync(keyPath)) {
      return {
        status: "DOWN",
        detail: { path: keyPath, reason: "encryption_key_missing" },
      };
    }
    const raw = fs.readFileSync(keyPath, "utf8").trim();
    if (!/^[0-9a-fA-F]{64}$/.test(raw)) {
      return {
        status: "DEGRADED",
        detail: {
          path: keyPath,
          reason: "encryption_key_invalid_format",
          length: raw.length,
        },
      };
    }
    return {
      status: "UP",
      detail: { path: keyPath, keyLength: 256 },
    };
  } catch (err) {
    return {
      status: "DOWN",
      detail: {
        path: keyPath,
        reason: "encryption_key_read_error",
        error: err.message,
      },
    };
  }
}

/**
 * Check datastore integrity for core data files.
 * Verifies that webhook-configs.json and user-ai-keys.json exist, are readable,
 * and contain valid JSON arrays/objects. Missing files are reported as
 * INITIALIZED_EMPTY rather than throwing.
 * @returns {{ status: string, files: object[] }}
 */
function checkDatastoreIntegrity() {
  const dataDir = path.join(process.cwd(), ".simplebeacon");
  const targets = ["webhook-configs.json", "user-ai-keys.json"];
  const fileResults = [];
  let overallStatus = "UP";

  for (const filename of targets) {
    const filePath = path.join(dataDir, filename);
    try {
      if (!fs.existsSync(filePath)) {
        fileResults.push({
          file: filename,
          status: "INITIALIZED_EMPTY",
          reason: "file_not_yet_created",
        });
        // INITIALIZED_EMPTY is not a failure — it's a valid fresh-install state
        continue;
      }
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      const validType =
        Array.isArray(parsed) ||
        (typeof parsed === "object" && parsed !== null);
      if (!validType) {
        fileResults.push({
          file: filename,
          status: "DEGRADED",
          reason: "invalid_json_type",
          type: typeof parsed,
        });
        overallStatus = overallStatus === "UP" ? "DEGRADED" : overallStatus;
      } else {
        const count = Array.isArray(parsed)
          ? parsed.length
          : Object.keys(parsed).length;
        fileResults.push({
          file: filename,
          status: "UP",
          entries: count,
        });
      }
    } catch (err) {
      if (err instanceof SyntaxError) {
        fileResults.push({
          file: filename,
          status: "DEGRADED",
          reason: "json_parse_error",
          error: err.message,
        });
        overallStatus = overallStatus === "UP" ? "DEGRADED" : overallStatus;
      } else {
        fileResults.push({
          file: filename,
          status: "DOWN",
          reason: "read_error",
          error: err.message,
        });
        overallStatus = "DOWN";
      }
    }
  }

  return { status: overallStatus, files: fileResults };
}

/**
 * Check internal memory gauge using process.memoryUsage().
 * Flags if the backend is approaching an OOM condition.
 * @returns {{ status: string, detail: object }}
 */
function checkMemoryGauge() {
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const rssMB = Math.round(mem.rss / 1024 / 1024);
  const externalMB = Math.round((mem.external || 0) / 1024 / 1024);

  let status = "UP";
  if (heapUsedMB >= MEMORY_CRITICAL_THRESHOLD_MB) {
    status = "DOWN";
  } else if (heapUsedMB >= MEMORY_WARN_THRESHOLD_MB) {
    status = "DEGRADED";
  }

  return {
    status,
    detail: {
      heapUsedMB,
      heapTotalMB,
      rssMB,
      externalMB,
      warnThresholdMB: MEMORY_WARN_THRESHOLD_MB,
      criticalThresholdMB: MEMORY_CRITICAL_THRESHOLD_MB,
    },
  };
}

// ── Aggregate health check ─────────────────────────────────────────────────

/**
 * Run all sub-system checks and aggregate the overall health status.
 * @returns {{ status: string, timestamp: string, checks: object }}
 */
function runHealthChecks() {
  const encryption = checkEncryptionKey();
  const datastore = checkDatastoreIntegrity();
  const memory = checkMemoryGauge();

  const subChecks = { encryption, datastore, memory };
  const statuses = [encryption.status, datastore.status, memory.status];

  let overall;
  if (statuses.includes("DOWN")) {
    overall = "DOWN";
  } else if (statuses.includes("DEGRADED")) {
    overall = "DEGRADED";
  } else {
    overall = "UP";
  }

  return {
    status: overall,
    timestamp: new Date().toISOString(),
    checks: subChecks,
  };
}

// ── Background cron runner ─────────────────────────────────────────────────

let _intervalHandle = null;
let _lastCheckResult = null;

/**
 * Emit a CRITICAL_SYS_ALERT log trace when health status slips.
 * @param {{ status: string, checks: object }} result
 */
function emitAlertIfNeeded(result) {
  if (result.status === "UP") return;
  const alertLevel = result.status === "DOWN" ? "error" : "warn";
  logger[alertLevel]("CRITICAL_SYS_ALERT: health check degraded", {
    status: result.status,
    timestamp: result.timestamp,
    checks: {
      encryption: result.checks.encryption.status,
      datastore: result.checks.datastore.status,
      memory: result.checks.memory.status,
    },
  });
}

/**
 * Start the background health check interval (every 15 minutes).
 * Safe to call multiple times — won't create duplicate intervals.
 * @returns {NodeJS.Timeout|null}
 */
function startHealthCheckCron() {
  if (_intervalHandle) return _intervalHandle;
  if (process.env.NODE_ENV === "test") return null; // skip in test to avoid open handles

  const tick = async () => {
    try {
      const result = runHealthChecks();
      _lastCheckResult = result;
      emitAlertIfNeeded(result);
      // Send outbound alert if status changed (Slack/Discord webhook)
      if (healthAlerts) {
        await healthAlerts.processHealthAlert(result);
      }
      logger.info("[HealthDiagnostics] periodic check complete", {
        status: result.status,
      });
    } catch (err) {
      logger.error("[HealthDiagnostics] periodic check failed", {
        error: err.message,
      });
    }
  };

  _intervalHandle = setInterval(tick, HEALTH_CHECK_INTERVAL_MS);
  // Don't keep the process alive solely for this interval
  if (_intervalHandle.unref) _intervalHandle.unref();
  logger.info("[HealthDiagnostics] background cron started", {
    intervalMs: HEALTH_CHECK_INTERVAL_MS,
  });
  return _intervalHandle;
}

/**
 * Stop the background health check interval.
 * @returns {void}
 */
function stopHealthCheckCron() {
  if (_intervalHandle) {
    clearInterval(_intervalHandle);
    _intervalHandle = null;
    logger.info("[HealthDiagnostics] background cron stopped");
  }
}

/**
 * Get the last periodic check result (or null if cron hasn't run yet).
 * @returns {object|null}
 */
function getLastCheckResult() {
  return _lastCheckResult;
}

// ── Route handler ──────────────────────────────────────────────────────────

router.get("/", (req, res) => {
  const result = runHealthChecks();
  const httpStatus =
    result.status === "DOWN" ? 503 : result.status === "DEGRADED" ? 200 : 200;
  res.status(httpStatus).json(result);
});

// ── Exports ────────────────────────────────────────────────────────────────

module.exports = router;
module.exports.runHealthChecks = runHealthChecks;
module.exports.checkEncryptionKey = checkEncryptionKey;
module.exports.checkDatastoreIntegrity = checkDatastoreIntegrity;
module.exports.checkMemoryGauge = checkMemoryGauge;
module.exports.startHealthCheckCron = startHealthCheckCron;
module.exports.stopHealthCheckCron = stopHealthCheckCron;
module.exports.getLastCheckResult = getLastCheckResult;
module.exports.HEALTH_CHECK_INTERVAL_MS = HEALTH_CHECK_INTERVAL_MS;
