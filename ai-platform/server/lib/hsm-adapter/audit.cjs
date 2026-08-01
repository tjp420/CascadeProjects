'use strict';

/**
 * Track 10: HSM adapter audit trail integration.
 *
 * Wraps the cluster audit bus (audit-logger.cjs) with HSM-specific
 * helpers that enforce non-secret telemetry. All audit events emit
 * only structural metadata — never plaintext, KEK material, or
 * base64 key blobs.
 *
 * Action naming convention (snake_case, matches existing audit-logger
 * patterns like 'partition_config_update', 'pii_policy_sync'):
 *
 *   hsm_kek_create      — KEK provisioned
 *   hsm_kek_rotate      — KEK rotated
 *   hsm_kek_list        — KEK inventory queried
 *   hsm_wrap            — Low-level AES-KW wrap
 *   hsm_unwrap          — Low-level AES-KW unwrap
 *   hsm_export_keyring  — High-level T10K export
 *   hsm_import_keyring  — High-level T10K import
 *
 * @module hsm-adapter/audit
 */

const os = require('os');

// Lazy-load audit-logger to avoid circular imports at module load time.
let _auditLogger = null;
function _getAuditLogger() {
  if (_auditLogger) return _auditLogger;
  try {
    _auditLogger = require('../audit-logger.cjs');
  } catch {
    _auditLogger = null; // audit-logger unavailable — audit becomes no-op
  }
  return _auditLogger;
}

/**
 * Resolve the node identifier for audit events.
 * Matches cluster-keyring-sync.cjs convention: NODE_ID env var, then hostname.
 * @returns {string}
 */
function _resolveNodeId() {
  return process.env.NODE_ID || os.hostname() || 'node';
}

/**
 * Fields that must NEVER appear in audit metadata because they may
 * contain secret material. These are stripped before logging.
 */
const FORBIDDEN_METADATA_KEYS = new Set([
  'kek', 'plaintext', 'wrapped', 'ciphertext', 'keyData',
  'masterKek', 'key', 'data', 'secret', 'token', 'pin',
  'rawKey', 'keyMaterial', 'privateKey', 'seed',
]);

/**
 * Scrub a metadata object to remove any forbidden keys and enforce
 * non-secret telemetry. Recursively walks nested objects.
 *
 * @param {object} meta - metadata to scrub
 * @returns {object} scrubbed metadata (only non-secret fields retained)
 */
function scrubMetadata(meta) {
  if (!meta || typeof meta !== 'object') return {};
  const cleaned = {};
  for (const [key, value] of Object.entries(meta)) {
    if (FORBIDDEN_METADATA_KEYS.has(key)) continue;
    if (Buffer.isBuffer(value)) continue; // never log raw buffers
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const nested = scrubMetadata(value);
      if (Object.keys(nested).length > 0) cleaned[key] = nested;
    } else if (Array.isArray(value)) {
      // Only log array lengths, not contents (could contain secrets)
      cleaned[key] = value.length;
    } else {
      cleaned[key] = value;
    }
  }
  return cleaned;
}

/**
 * Emit an HSM audit event. Non-secret metadata only.
 *
 * @param {object} params
 * @param {string} params.action — one of the hsm_* action strings above
 * @param {string} [params.orgId] — tenant org ID (defaults to 'default')
 * @param {string} [params.kekId] — KEK identifier involved (non-secret)
 * @param {string} [params.algorithm] — algorithm name (non-secret)
 * @param {number} [params.payloadSize] — size of wrapped/unwrapped payload
 * @param {string} [params.result] — 'success' or 'failure'
 * @param {string} [params.errorCode] — HsmAdapterError code on failure
 * @param {object} [params.extra] — additional non-secret metadata
 * @param {string} [params.nodeId] — override node identifier
 * @returns {boolean} true if logged, false if audit-logger unavailable
 */
function emitAuditEvent(params) {
  const logger = _getAuditLogger();
  if (!logger || typeof logger.log !== 'function') return false;

  const nodeId = params.nodeId || _resolveNodeId();
  const metadata = scrubMetadata({
    kekId: params.kekId || null,
    algorithm: params.algorithm || null,
    payloadSize: params.payloadSize != null ? params.payloadSize : null,
    result: params.result || 'success',
    errorCode: params.errorCode || null,
    node: nodeId,
    provider: params.provider || null,
    ...(params.extra || {}),
  });

  try {
    logger.log({
      orgId: params.orgId || 'default',
      actorId: `hsm-adapter:${nodeId}`,
      actorEmail: 'system',
      action: params.action,
      entity: 'hsm_keyring',
      entityId: params.kekId || nodeId,
      metadata,
    });
    return true;
  } catch {
    // Audit logging must never break crypto operations
    return false;
  }
}

module.exports = {
  emitAuditEvent,
  scrubMetadata,
  resolveNodeId: _resolveNodeId,
  FORBIDDEN_METADATA_KEYS,
  // Action constants for type-safe usage
  ACTIONS: {
    KEK_CREATE: 'hsm_kek_create',
    KEK_ROTATE: 'hsm_kek_rotate',
    KEK_LIST: 'hsm_kek_list',
    WRAP: 'hsm_wrap',
    UNWRAP: 'hsm_unwrap',
    EXPORT_KEYRING: 'hsm_export_keyring',
    IMPORT_KEYRING: 'hsm_import_keyring',
    ROTATE_KEYRING: 'hsm_rotate_keyring',
  },
};
