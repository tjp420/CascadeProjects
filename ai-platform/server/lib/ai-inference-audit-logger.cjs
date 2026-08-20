// SPDX-License-Identifier: MIT
/**
 * Structured inference audit logging for EU AI Act accountability trails.
 *
 * @license MIT
 */
const crypto = require("crypto");
const logger = require("./app-logger.cjs");

/**
 * Log an AI inference decision event for audit trails.
 * @param {Object} [event={}] - Inference event payload.
 * @param {string} [event.traceId] - Unique trace identifier.
 * @param {string} [event.provider] - Model provider name.
 * @param {string} [event.operation] - Operation type.
 * @param {string} [event.projectLabel] - Project label.
 * @param {string} [event.outcome] - Inference outcome.
 * @param {Object} [event.metadata] - Additional metadata.
 * @returns {string} The assigned traceId.
 */
function logInferenceEvent(event = {}) {
  const traceId = event.traceId || crypto.randomUUID();
  logger.info("[ai-audit] inference decision", {
    traceId,
    provider: event.provider || "unknown",
    operation: event.operation || "inference",
    projectLabel: event.projectLabel || null,
    outcome: event.outcome || "ok",
    ...(event.metadata && typeof event.metadata === "object"
      ? event.metadata
      : {}),
  });
  return traceId;
}

module.exports = {
  logInferenceEvent,
};
