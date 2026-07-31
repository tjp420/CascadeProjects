'use strict';

// HSM Vault Provider (Software-Simulated Mock)
//
// Provides key derivation inside an isolated memory structure, simulating
// a Hardware Security Module boundary. The internal root key never leaves
// this module context — only derived per-tenant keys are returned.
//
// This mock is activated when process.env.HSM_PROVIDER is set. If the
// module fails to load or throws during derivation, crypto-utils.cjs
// catches the error and falls back to local HMAC key derivation.
//
// Configuration:
//   HSM_PROVIDER — set to 'mock' (or any truthy value) to activate
//   HSM_MOCK_ROOT_KEY — optional hex string to seed the simulated HSM
//     root key (default: random 32 bytes generated at module load time)

const crypto = require('crypto');

// Simulated HSM root key — locked down at module scope, never exported.
// In production, this would be inside tamper-resistant hardware.
const _HSM_ROOT_KEY = process.env.HSM_MOCK_ROOT_KEY
  ? Buffer.from(process.env.HSM_MOCK_ROOT_KEY, 'hex')
  : crypto.randomBytes(32);

/**
 * Generic key derivation from the simulated HSM boundary.
 * Computes an HMAC-SHA256 signature using the internal HSM root key
 * over the orgId and context string.
 * @param {string} orgId — Tenant organization ID
 * @param {string} [context] — Optional context string (default: 'default')
 * @returns {Buffer} 32-byte derived key
 * @throws {TypeError} if orgId is not a non-empty string
 */
function deriveKey(orgId, context) {
  if (!orgId || typeof orgId !== 'string') {
    throw new TypeError('HSM key derivation requires a valid organization identifier string');
  }
  return crypto.createHmac('sha256', _HSM_ROOT_KEY)
    .update(`${orgId}::${context || 'default'}`)
    .digest();
}

/**
 * Org-level key derivation via HSM — matches the hook signature expected
 * by crypto-utils.cjs deriveOrgKey().
 * @param {string} orgId — Tenant organization ID
 * @returns {Buffer} 32-byte derived key
 * @throws {TypeError} if orgId is not a non-empty string
 */
function deriveOrgKeyViaHsm(orgId) {
  return deriveKey(orgId, 'org-key');
}

module.exports = {
  deriveKey,
  deriveOrgKeyViaHsm,
};
