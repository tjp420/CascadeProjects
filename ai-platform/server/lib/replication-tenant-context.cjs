"use strict";

/**
 * Replication Tenant Context
 *
 * Shared module for tenant validation across all cross-cluster replication engines.
 * Provides standardized tenant context validation, cross-tenant rejection, and
 * SIEM event tagging.
 *
 * Security invariants:
 *   - Fail-closed: Missing tenantId on inbound message is rejected (unless backward-compat)
 *   - No cross-tenant leakage: Tenant A's key material cannot replicate to Tenant B
 *   - Tenant-tagged audit: All SIEM events include tenant context
 *   - Backward compatible: Messages without tenantId treated as 'default' tenant
 *
 * @module replication-tenant-context
 */

const { incrementCounter } = require("./hsm-adapter/hsm-metrics.cjs");

const TENANT_FIELD = "tenantId";
const DEFAULT_TENANT = "default";
const BACKWARD_COMPAT_MODE =
  process.env.REPLICATION_TENANT_BACKWARD_COMPAT !== "false";

// Safe identifier pattern matching existing isSafeId pattern
const TENANT_ID_PATTERN = /^[a-zA-Z0-9-_]+$/;

/**
 * Validate a tenant identifier.
 * @param {string} tenantId
 * @returns {boolean}
 */
function isValidTenantId(tenantId) {
  return (
    typeof tenantId === "string" &&
    TENANT_ID_PATTERN.test(tenantId) &&
    tenantId.length > 0 &&
    tenantId.length <= 128
  );
}

/**
 * Extract tenant context from a message.
 * In backward-compat mode, missing tenantId defaults to 'default'.
 * @param {object} message - Replication message
 * @param {object} [options] - Options
 * @param {boolean} [options.strict] - If true, reject missing tenantId
 * @returns {{ tenantId: string, valid: boolean, reason: string|null }}
 */
function extractTenantContext(message, options = {}) {
  const strict = options.strict || !BACKWARD_COMPAT_MODE;

  if (!message || typeof message !== "object") {
    return { tenantId: null, valid: false, reason: "invalid_message_object" };
  }

  const rawTenantId = message[TENANT_FIELD];

  if (rawTenantId === undefined || rawTenantId === null) {
    if (strict) {
      return { tenantId: null, valid: false, reason: "missing_tenant_id" };
    }
    return { tenantId: DEFAULT_TENANT, valid: true, reason: null };
  }

  if (!isValidTenantId(rawTenantId)) {
    return { tenantId: null, valid: false, reason: "invalid_tenant_id_format" };
  }

  return { tenantId: rawTenantId, valid: true, reason: null };
}

/**
 * Validate tenant context on an inbound replication message.
 * Increments metrics and returns validation result.
 * @param {object} message - Inbound replication message
 * @param {string} sourceTenant - Expected source tenant (optional)
 * @returns {{ valid: boolean, tenantId: string|null, reason: string|null }}
 */
function validateTenantContext(message, sourceTenant) {
  const ctx = extractTenantContext(message);

  if (!ctx.valid) {
    incrementCounter("hsm_replication_tenant_isolation_violation_total");
    return { valid: false, tenantId: null, reason: ctx.reason };
  }

  // If sourceTenant is provided, verify it matches
  if (sourceTenant !== undefined && sourceTenant !== null) {
    if (!isValidTenantId(sourceTenant)) {
      incrementCounter("hsm_replication_tenant_isolation_violation_total");
      return {
        valid: false,
        tenantId: null,
        reason: "invalid_source_tenant_id",
      };
    }
    if (ctx.tenantId !== sourceTenant) {
      incrementCounter("hsm_replication_cross_tenant_rejected_total");
      return {
        valid: false,
        tenantId: ctx.tenantId,
        reason: "cross_tenant_mismatch",
      };
    }
  }

  incrementCounter("hsm_replication_tenant_context_validated_total");
  return { valid: true, tenantId: ctx.tenantId, reason: null };
}

/**
 * Reject cross-tenant replication attempt.
 * Throws a standardized error with tenant context.
 * @param {string} sourceTenant
 * @param {string} targetTenant
 * @throws {Error}
 */
function rejectCrossTenant(sourceTenant, targetTenant) {
  incrementCounter("hsm_replication_cross_tenant_rejected_total");
  const err = new Error(
    "CROSS_TENANT_REPLICATION_REJECTED: source=" +
      sourceTenant +
      " target=" +
      targetTenant,
  );
  err.code = "CROSS_TENANT_REPLICATION_REJECTED";
  err.sourceTenant = sourceTenant;
  err.targetTenant = targetTenant;
  throw err;
}

/**
 * Tag a SIEM event with tenant context.
 * @param {object} event - SIEM event object
 * @param {string} tenantId
 * @returns {object} The tagged event (mutated in place)
 */
function tagSIEMEvent(event, tenantId) {
  if (!event || typeof event !== "object") return event;
  if (tenantId && isValidTenantId(tenantId)) {
    event[TENANT_FIELD] = tenantId;
  } else {
    event[TENANT_FIELD] = DEFAULT_TENANT;
  }
  return event;
}

/**
 * Create a tenant-scoped message by adding tenantId to an outbound message.
 * @param {object} message - Outbound message
 * @param {string} tenantId
 * @returns {object} The tagged message (mutated in place)
 */
function tagOutboundMessage(message, tenantId) {
  if (!message || typeof message !== "object") return message;
  if (tenantId && isValidTenantId(tenantId)) {
    message[TENANT_FIELD] = tenantId;
  }
  return message;
}

/**
 * Check if two tenant IDs match (safe comparison).
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function tenantsMatch(a, b) {
  return String(a || "") === String(b || "");
}

module.exports = {
  TENANT_FIELD,
  DEFAULT_TENANT,
  BACKWARD_COMPAT_MODE,
  isValidTenantId,
  extractTenantContext,
  validateTenantContext,
  rejectCrossTenant,
  tagSIEMEvent,
  tagOutboundMessage,
  tenantsMatch,
};
