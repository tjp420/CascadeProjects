'use strict';

/**
 * Track 42: Enclave Secret-Sealing and Attestation Policy Engine.
 *
 * Enforces cryptographic policies for sealing secrets inside hardware enclaves:
 *   - Sealing cipher strength requirements
 *   - Key rotation interval enforcement
 *   - Attestation freshness and replay protection
 *   - Challenge-response attestation with nonce tracking
 *   - Key provisioning scope and lifetime limits
 *
 * @module hsm-adapter/enclave-secret-sealing-policy
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_SEALING_POLICY = {
  allowedSealingCiphers: ['aes-256-gcm', 'aes-128-gcm'],
  minSealingKeyBits: 128,
  maxSealingKeyAgeMs: 86400000, // 24 hours
  requireKeyRotation: true,
  keyRotationIntervalMs: 3600000, // 1 hour
  maxSealedDataSizeBytes: 1048576, // 1 MB
  allowUnsealOutsideEnclave: false,
  attestation: {
    requireChallengeResponse: true,
    challengeNonceBytes: 32,
    maxChallengeAgeMs: 30000, // 30 seconds
    replayProtectionWindow: 300000, // 5 minutes
    minTtlSeconds: 300,
    maxAgeSeconds: 60,
  },
  keyProvisioning: {
    allowedKeyTypes: ['kek', 'kek-fragment', 'wrap-key', 'signing-key'],
    maxKeyAgeMs: 604800000, // 7 days
    requireAttestationBeforeProvision: true,
    maxProvisionedKeys: 100,
  },
};

class EnclaveSecretSealingPolicy {
  /**
   * @param {object} [options]
   * @param {object} [options.policy] - Override default policy fields
   * @param {Function} [options.audit] - Audit callback
   */
  constructor(options = {}) {
    const opts = options || {};
    this.policy = _deepMerge(DEFAULT_SEALING_POLICY, opts.policy || {});
    this._audit = opts.audit || null;
    this._usedNonces = new Map(); // nonce -> timestamp
    this._sealedKeys = new Map(); // keyId -> { sealedAt, keyType, cipher }
    this._provisionedKeyCount = 0;
  }

  /**
   * Validate a sealing operation against policy.
   * @param {object} config
   * @param {string} config.cipher - Sealing cipher (e.g. 'aes-256-gcm')
   * @param {number} config.keyBits - Key size in bits
   * @param {number} [config.dataSizeBytes] - Size of data being sealed
   * @param {number} [config.keyAgeMs] - Age of the sealing key
   * @returns {object} Validation result
   */
  validateSeal(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'seal config is required');
    }
    const cipher = config.cipher;
    if (typeof cipher !== 'string' || !this.policy.allowedSealingCiphers.includes(cipher)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        `sealing cipher ${cipher} is not allowed; permitted: ${this.policy.allowedSealingCiphers.join(', ')}`);
    }
    const keyBits = Number(config.keyBits);
    if (!Number.isFinite(keyBits) || keyBits < this.policy.minSealingKeyBits) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        `sealing key size ${keyBits} is below minimum ${this.policy.minSealingKeyBits} bits`);
    }
    if (typeof config.dataSizeBytes === 'number' && config.dataSizeBytes > this.policy.maxSealedDataSizeBytes) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        `sealed data size ${config.dataSizeBytes} exceeds maximum ${this.policy.maxSealedDataSizeBytes} bytes`);
    }
    if (this.policy.requireKeyRotation && typeof config.keyAgeMs === 'number') {
      if (config.keyAgeMs > this.policy.keyRotationIntervalMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
          `sealing key age ${config.keyAgeMs}ms exceeds rotation interval ${this.policy.keyRotationIntervalMs}ms`);
      }
      if (config.keyAgeMs > this.policy.maxSealingKeyAgeMs) {
        throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
          `sealing key age ${config.keyAgeMs}ms exceeds maximum ${this.policy.maxSealingKeyAgeMs}ms`);
      }
    }
    if (typeof this._audit === 'function') {
      this._audit('SEALING_POLICY_VALIDATED', { cipher, keyBits });
    }
    return { valid: true, cipher, keyBits };
  }

  /**
   * Validate an unseal operation against policy.
   * @param {object} config
   * @param {boolean} [config.insideEnclave] - Whether the unseal is happening inside the enclave boundary
   * @returns {object} Validation result
   */
  validateUnseal(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'unseal config is required');
    }
    if (!this.policy.allowUnsealOutsideEnclave && config.insideEnclave === false) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        'unseal outside enclave boundary is not allowed');
    }
    if (typeof this._audit === 'function') {
      this._audit('UNSEAL_POLICY_VALIDATED', { insideEnclave: config.insideEnclave !== false });
    }
    return { valid: true };
  }

  /**
   * Generate a challenge nonce for attestation.
   * @returns {object} Challenge with nonce and expiry
   */
  generateChallenge() {
    const nonceBytes = this.policy.attestation.challengeNonceBytes;
    const nonce = crypto.randomBytes(nonceBytes).toString('hex');
    const expiresAt = Date.now() + this.policy.attestation.maxChallengeAgeMs;
    if (typeof this._audit === 'function') {
      this._audit('ATTESTATION_CHALLENGE_ISSUED', { nonce: nonce.substring(0, 8) + '...', expiresAt });
    }
    return { nonce, expiresAt };
  }

  /**
   * Validate an attestation response against policy, including replay protection.
   * @param {object} attestation
   * @param {string} attestation.nonce - The challenge nonce that was issued
   * @param {number} attestation.timestamp - Attestation timestamp (seconds)
   * @param {number} [attestation.attestationAgeSeconds] - Reported age
   * @param {string} [attestation.measurement] - MRENCLAVE measurement
   * @returns {object} Validation result
   */
  validateAttestation(attestation) {
    if (!attestation || typeof attestation !== 'object') {
      throw new HsmAdapterError('ATTESTATION_INVALID_DOCUMENT', 'attestation is required');
    }
    // Check challenge-response if required
    if (this.policy.attestation.requireChallengeResponse) {
      if (!attestation.nonce) {
        throw new HsmAdapterError('ATTESTATION_CHALLENGE_MISSING', 'challenge nonce is required');
      }
      // Replay protection
      const now = Date.now();
      const replayWindow = this.policy.attestation.replayProtectionWindow;
      // Clean expired nonces
      for (const [usedNonce, ts] of this._usedNonces) {
        if (now - ts > replayWindow) this._usedNonces.delete(usedNonce);
      }
      if (this._usedNonces.has(attestation.nonce)) {
        throw new HsmAdapterError('ATTESTATION_REPLAY_DETECTED',
          'attestation nonce has already been used');
      }
      this._usedNonces.set(attestation.nonce, now);
    }
    // Check attestation age
    const age = typeof attestation.attestationAgeSeconds === 'number'
      ? attestation.attestationAgeSeconds
      : (Date.now() / 1000 - (attestation.timestamp || 0));
    if (age > this.policy.attestation.maxAgeSeconds) {
      throw new HsmAdapterError('ATTESTATION_EXPIRED',
        `attestation age ${age}s exceeds maximum ${this.policy.attestation.maxAgeSeconds}s`);
    }
    // Check minimum TTL
    if (typeof attestation.ttlSeconds === 'number' && attestation.ttlSeconds < this.policy.attestation.minTtlSeconds) {
      throw new HsmAdapterError('ATTESTATION_TTL_TOO_SHORT',
        `attestation TTL ${attestation.ttlSeconds}s is below minimum ${this.policy.attestation.minTtlSeconds}s`);
    }
    if (typeof this._audit === 'function') {
      this._audit('ATTESTATION_POLICY_VALIDATED', {
        measurement: attestation.measurement,
        age,
      });
    }
    return { valid: true, age };
  }

  /**
   * Validate a key provisioning operation against policy.
   * @param {object} config
   * @param {string} config.keyType - Type of key being provisioned
   * @param {boolean} [config.attestationVerified] - Whether attestation has been verified
   * @param {number} [config.keyAgeMs] - Age of the key material
   * @returns {object} Validation result
   */
  validateKeyProvisioning(config) {
    if (!config || typeof config !== 'object') {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED', 'provisioning config is required');
    }
    const kp = this.policy.keyProvisioning;
    if (typeof config.keyType !== 'string' || !kp.allowedKeyTypes.includes(config.keyType)) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        `key type ${config.keyType} is not allowed; permitted: ${kp.allowedKeyTypes.join(', ')}`);
    }
    if (kp.requireAttestationBeforeProvision && !config.attestationVerified) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        'key provisioning requires attestation to be verified first');
    }
    if (typeof config.keyAgeMs === 'number' && config.keyAgeMs > kp.maxKeyAgeMs) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        `key age ${config.keyAgeMs}ms exceeds maximum ${kp.maxKeyAgeMs}ms`);
    }
    if (this._provisionedKeyCount >= kp.maxProvisionedKeys) {
      throw new HsmAdapterError('POLICY_VIOLATION_BLOCKED',
        `maximum provisioned keys (${kp.maxProvisionedKeys}) reached`);
    }
    this._provisionedKeyCount++;
    if (typeof this._audit === 'function') {
      this._audit('KEY_PROVISIONING_POLICY_VALIDATED', { keyType: config.keyType });
    }
    return { valid: true, keyType: config.keyType };
  }

  /**
   * Record a sealed key for tracking.
   * @param {string} keyId
   * @param {object} meta
   * @param {string} meta.keyType
   * @param {string} meta.cipher
   */
  recordSealedKey(keyId, meta) {
    this._sealedKeys.set(keyId, { sealedAt: Date.now(), ...meta });
  }

  /**
   * Remove a sealed key from tracking.
   * @param {string} keyId
   */
  removeSealedKey(keyId) {
    this._sealedKeys.delete(keyId);
  }

  /**
   * Get the current count of provisioned keys.
   * @returns {number}
   */
  get provisionedKeyCount() {
    return this._provisionedKeyCount;
  }

  /**
   * Get the current count of tracked sealed keys.
   * @returns {number}
   */
  get sealedKeyCount() {
    return this._sealedKeys.size;
  }

  /**
   * Reset internal state (for testing).
   */
  reset() {
    this._usedNonces.clear();
    this._sealedKeys.clear();
    this._provisionedKeyCount = 0;
  }
}

function _deepMerge(target, source) {
  const result = { ...target };
  for (const [key, value] of Object.entries(source)) {
    if (value && typeof value === 'object' && !Array.isArray(value) && target[key] && typeof target[key] === 'object') {
      result[key] = _deepMerge(target[key], value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

module.exports = { EnclaveSecretSealingPolicy, DEFAULT_SEALING_POLICY };
