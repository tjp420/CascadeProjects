"use strict";

/**
 * Health Alert Notifier — sends outbound alerts when the server health
 * status transitions to DEGRADED or DOWN.
 *
 * Uses HEALTH_ALERT_WEBHOOK env var (Slack or Discord incoming webhook URL).
 * Falls back to PURCHASE_ALERT_WEBHOOK if HEALTH_ALERT_WEBHOOK is not set,
 * so a single webhook can serve both purchase and health notifications.
 *
 * Alert dedup: tracks the last alerted status per check name. Only sends
 * an alert when the status changes (e.g., UP → DOWN) or when recovering
 * (DOWN → UP). This prevents alert storms during sustained outages.
 *
 * @module health-alerts
 */

const https = require("https");
const logger = require("./app-logger.cjs");

let _lastStatusByCheck = {};
let _lastOverallStatus = "UP";

/**
 * Get the configured webhook URL.
 * @returns {string|null}
 */
function getWebhookUrl() {
  return (
    process.env.HEALTH_ALERT_WEBHOOK ||
    process.env.PURCHASE_ALERT_WEBHOOK ||
    null
  );
}

/**
 * Detect platform from webhook URL.
 * @param {string} url
 * @returns {"slack"|"discord"|"unknown"}
 */
function detectPlatform(url) {
  if (!url) return "unknown";
  if (url.includes("hooks.slack.com")) return "slack";
  if (url.includes("discord.com/api/webhooks")) return "discord";
  return "unknown";
}

/**
 * Format the alert payload for the target platform.
 * @param {Object} params
 * @param {string} params.previousStatus
 * @param {string} params.currentStatus
 * @param {Object} params.checks
 * @param {string} params.timestamp
 * @param {string} [params.recovered] - Which check recovered (for recovery alerts)
 * @returns {Object} Platform-specific payload
 */
function formatAlertPayload({ previousStatus, currentStatus, checks, timestamp }) {
  const platform = detectPlatform(getWebhookUrl());
  const isRecovery = currentStatus === "UP" && previousStatus !== "UP";
  const emoji = currentStatus === "DOWN" ? "🔴" : currentStatus === "DEGRADED" ? "🟡" : "🟢";
  const title = isRecovery
    ? "SimpleBeacon Health Recovered"
    : `SimpleBeacon Health: ${currentStatus}`;

  const checkLines = Object.entries(checks)
    .map(([name, result]) => {
      const icon = result.status === "DOWN" ? "🔴" : result.status === "DEGRADED" ? "🟡" : "🟢";
      return `${icon} ${name}: ${result.status}`;
    })
    .join("\n");

  const text = `${emoji} ${title}\nPrevious: ${previousStatus} → Current: ${currentStatus}\nTime: ${timestamp}\n\n${checkLines}`;

  if (platform === "slack") {
    return {
      text,
      mrkdwn: true,
    };
  }

  if (platform === "discord") {
    return {
      content: text,
    };
  }

  // Generic JSON payload
  return {
    title,
    previousStatus,
    currentStatus,
    timestamp,
    checks: Object.fromEntries(
      Object.entries(checks).map(([k, v]) => [k, v.status]),
    ),
  };
}

/**
 * Send an HTTP POST to the webhook URL.
 * @param {string} url
 * @param {Object} payload
 * @returns {Promise<{ sent: boolean, error?: string }>}
 */
function postToWebhook(url, payload) {
  return new Promise((resolve) => {
    try {
      const urlObj = new URL(url);
      const body = JSON.stringify(payload);
      const options = {
        method: "POST",
        hostname: urlObj.hostname,
        path: urlObj.pathname + urlObj.search,
        headers: {
          "Content-Type": "application/json",
          "Content-Length": Buffer.byteLength(body),
        },
        timeout: 10000,
      };

      const req = https.request(options, (res) => {
        res.resume();
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ sent: true });
        } else {
          resolve({ sent: false, error: `HTTP ${res.statusCode}` });
        }
      });

      req.on("error", (err) => {
        resolve({ sent: false, error: err.message });
      });

      req.on("timeout", () => {
        req.destroy();
        resolve({ sent: false, error: "timeout" });
      });

      req.write(body);
      req.end();
    } catch (err) {
      resolve({ sent: false, error: err.message });
    }
  });
}

/**
 * Check if a status transition warrants an alert.
 * Only alert on:
 * - Any transition to DOWN or DEGRADED (new incident)
 * - Any transition from DOWN/DEGRADED back to UP (recovery)
 * Do NOT alert when status stays the same (avoid alert storms).
 * @param {string} previous
 * @param {string} current
 * @returns {boolean}
 */
function shouldAlert(previous, current) {
  if (previous === current) return false;
  // Alert on any change involving a non-UP state
  if (current !== "UP" || previous !== "UP") return true;
  return false;
}

/**
 * Process a health check result and send alerts if needed.
 * @param {{ status: string, timestamp: string, checks: Object }} result
 * @returns {Promise<{ alerted: boolean, platform: string|null, error?: string }>}
 */
async function processHealthAlert(result) {
  const previous = _lastOverallStatus;
  const current = result.status;

  // Update tracking state
  _lastOverallStatus = current;

  if (!shouldAlert(previous, current)) {
    return { alerted: false, platform: null };
  }

  const webhookUrl = getWebhookUrl();
  if (!webhookUrl) {
    // No webhook configured — log only (existing behavior)
    return { alerted: false, platform: null };
  }

  const platform = detectPlatform(webhookUrl);
  const payload = formatAlertPayload({
    previousStatus: previous,
    currentStatus: current,
    checks: result.checks,
    timestamp: result.timestamp,
  });

  const postResult = await postToWebhook(webhookUrl, payload);

  if (postResult.sent) {
    logger.info(`[HealthAlert] Sent ${platform} alert: ${previous} → ${current}`);
  } else {
    logger.warn(`[HealthAlert] Failed to send ${platform} alert:`, postResult.error);
  }

  return {
    alerted: postResult.sent,
    platform,
    error: postResult.error,
  };
}

/**
 * Reset internal state (for testing).
 */
function resetState() {
  _lastStatusByCheck = {};
  _lastOverallStatus = "UP";
}

module.exports = {
  processHealthAlert,
  detectPlatform,
  formatAlertPayload,
  shouldAlert,
  getWebhookUrl,
  resetState,
};
