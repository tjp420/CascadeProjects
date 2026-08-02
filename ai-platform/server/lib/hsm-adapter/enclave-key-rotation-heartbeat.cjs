'use strict';

/**
 * Track 45: Enclave Key Rotation and Cryptographic Heartbeats.
 *
 * Implements rolling key schedules across the sharded enclave layout
 * with epoch-based key advancement and cryptographic heartbeat protocol
 * for enclave liveness verification.
 *
 * Components:
 *   - KeyEpochManager: Tracks key epochs per enclave with rotation intervals
 *   - CryptographicHeartbeat: Challenge-response liveness checks
 *   - KeyQuarantine: Isolates keys from enclaves that miss heartbeats
 *   - RotationScheduler: Manages automatic epoch advancement
 *
 * @module hsm-adapter/enclave-key-rotation-heartbeat
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  rotationIntervalMs: 3600000, // 1 hour
  maxKeyAgeMs: 86400000, // 24 hours
  heartbeatIntervalMs: 30000, // 30 seconds
  heartbeatTimeoutMs: 90000, // 3 missed heartbeats
  maxMissedHeartbeats: 3,
  challengeNonceBytes: 32,
  hashAlgorithm: 'sha256',
  maxEpochs: 100000,
  gracePeriodMs: 5000, // grace period after rotation before old key is revoked
};

const KEY_STATUS = {
  ACTIVE: 'active',
  ROTATING: 'rotating',
  QUARANTINED: 'quarantined',
  REVOKED: 'revoked',
};

const HEARTBEAT_STATUS = {
  HEALTHY: 'healthy',
  DEGRADED: 'degraded',
  UNRESPONSIVE: 'unresponsive',
};

/**
 * Enclave Key Rotation and Cryptographic Heartbeat Engine.
 */
class EnclaveKeyRotationEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.rotationIntervalMs = opts.rotationIntervalMs;
    this.maxKeyAgeMs = opts.maxKeyAgeMs;
    this.heartbeatIntervalMs = opts.heartbeatIntervalMs;
    this.heartbeatTimeoutMs = opts.heartbeatTimeoutMs;
    this.maxMissedHeartbeats = opts.maxMissedHeartbeats;
    this.challengeNonceBytes = opts.challengeNonceBytes;
    this.hashAlgorithm = opts.hashAlgorithm;
    this.maxEpochs = opts.maxEpochs;
    this.gracePeriodMs = opts.gracePeriodMs;
    this._audit = opts.audit || null;

    // Per-enclave key state: enclaveId -> { epoch, keyId, status, createdAt, rotatedAt, keyMaterial }
    this._enclaveKeys = new Map();
    // Pending heartbeat challenges: challengeId -> { enclaveId, nonce, issuedAt, expiresAt }
    this._pendingChallenges = new Map();
    // Heartbeat tracking: enclaveId -> { lastResponse, missedCount, status }
    this._heartbeatState = new Map();
    // Rotation history: enclaveId -> array of { epoch, keyId, rotatedAt }
    this._rotationHistory = new Map();
    this._timerHandle = null;
  }

  /**
   * Register an enclave for key rotation and heartbeat tracking.
   * @param {string} enclaveId
   * @param {object} [meta]
   * @param {Buffer} [meta.initialKey] - Initial key material (optional)
   */
  registerEnclave(enclaveId, meta) {
    if (!enclaveId || typeof enclaveId !== 'string') {
      throw new HsmAdapterError('INVALID_ENCLAVE', 'enclaveId must be a non-empty string');
    }
    if (this._enclaveKeys.has(enclaveId)) {
      throw new HsmAdapterError('ENCLAVE_ALREADY_REGISTERED',
        `enclave ${enclaveId} already registered`);
    }
    const now = Date.now();
    const keyId = _generateKeyId(enclaveId, 0);
    this._enclaveKeys.set(enclaveId, {
      epoch: 0,
      keyId,
      status: KEY_STATUS.ACTIVE,
      createdAt: now,
      rotatedAt: now,
      keyMaterial: (meta && meta.initialKey) || crypto.randomBytes(32),
    });
    this._heartbeatState.set(enclaveId, {
      lastResponse: now,
      missedCount: 0,
      status: HEARTBEAT_STATUS.HEALTHY,
    });
    this._rotationHistory.set(enclaveId, [{ epoch: 0, keyId, rotatedAt: now }]);
    if (typeof this._audit === 'function') {
      this._audit('ENCLAVE_REGISTERED', { enclaveId, epoch: 0, keyId });
    }
  }

  /**
   * Unregister an enclave.
   * @param {string} enclaveId
   */
  unregisterEnclave(enclaveId) {
    if (!this._enclaveKeys.has(enclaveId)) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    this._enclaveKeys.delete(enclaveId);
    this._heartbeatState.delete(enclaveId);
    this._rotationHistory.delete(enclaveId);
    // Clean up pending challenges for this enclave
    for (const [challengeId, challenge] of this._pendingChallenges) {
      if (challenge.enclaveId === enclaveId) {
        this._pendingChallenges.delete(challengeId);
      }
    }
  }

  /**
   * Issue a cryptographic heartbeat challenge to an enclave.
   * @param {string} enclaveId
   * @returns {object} Challenge with nonce and challenge ID
   */
  issueHeartbeat(enclaveId) {
    const keyState = this._enclaveKeys.get(enclaveId);
    if (!keyState) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    if (keyState.status === KEY_STATUS.QUARANTINED || keyState.status === KEY_STATUS.REVOKED) {
      throw new HsmAdapterError('ENCLAVE_KEY_NOT_ACTIVE',
        `enclave ${enclaveId} key status is ${keyState.status}`);
    }
    const nonce = crypto.randomBytes(this.challengeNonceBytes).toString('hex');
    const challengeId = _hash(this.hashAlgorithm, enclaveId + ':' + nonce + ':' + Date.now());
    const now = Date.now();
    const challenge = {
      challengeId,
      enclaveId,
      nonce,
      epoch: keyState.epoch,
      keyId: keyState.keyId,
      issuedAt: now,
      expiresAt: now + this.heartbeatTimeoutMs,
    };
    this._pendingChallenges.set(challengeId, challenge);
    if (typeof this._audit === 'function') {
      this._audit('HEARTBEAT_ISSUED', { enclaveId, challengeId, epoch: keyState.epoch });
    }
    return { challengeId, nonce, epoch: keyState.epoch };
  }

  /**
   * Process a heartbeat response from an enclave.
   * @param {string} challengeId
   * @param {string} enclaveId
   * @param {string} response - The cryptographic response (HMAC of nonce with key)
   * @returns {object} Verification result
   */
  processHeartbeatResponse(challengeId, enclaveId, response) {
    const challenge = this._pendingChallenges.get(challengeId);
    if (!challenge) {
      throw new HsmAdapterError('CHALLENGE_NOT_FOUND', `challenge ${challengeId} not found`);
    }
    if (challenge.enclaveId !== enclaveId) {
      throw new HsmAdapterError('CHALLENGE_MISMATCH',
        `challenge was issued to ${challenge.enclaveId}, not ${enclaveId}`);
    }
    const now = Date.now();
    if (now > challenge.expiresAt) {
      this._pendingChallenges.delete(challengeId);
      this._incrementMissed(enclaveId);
      throw new HsmAdapterError('CHALLENGE_EXPIRED',
        `challenge ${challengeId} has expired`);
    }
    const keyState = this._enclaveKeys.get(enclaveId);
    if (!keyState) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    // Verify response: expected HMAC-SHA256 of nonce using current key material
    const expectedResponse = _computeHmac(this.hashAlgorithm, keyState.keyMaterial, challenge.nonce);
    if (response !== expectedResponse) {
      this._incrementMissed(enclaveId);
      throw new HsmAdapterError('HEARTBEAT_RESPONSE_INVALID',
        `response does not match expected HMAC`);
    }
    // Success — reset missed count
    this._pendingChallenges.delete(challengeId);
    const hbState = this._heartbeatState.get(enclaveId);
    hbState.lastResponse = now;
    hbState.missedCount = 0;
    hbState.status = HEARTBEAT_STATUS.HEALTHY;
    if (typeof this._audit === 'function') {
      this._audit('HEARTBEAT_VERIFIED', { enclaveId, challengeId, epoch: keyState.epoch });
    }
    return { verified: true, enclaveId, epoch: keyState.epoch };
  }

  /**
   * Increment missed heartbeat count and potentially quarantine.
   * @param {string} enclaveId
   * @private
   */
  _incrementMissed(enclaveId) {
    const hbState = this._heartbeatState.get(enclaveId);
    if (!hbState) return;
    hbState.missedCount++;
    if (hbState.missedCount >= this.maxMissedHeartbeats) {
      hbState.status = HEARTBEAT_STATUS.UNRESPONSIVE;
      const keyState = this._enclaveKeys.get(enclaveId);
      if (keyState && keyState.status === KEY_STATUS.ACTIVE) {
        keyState.status = KEY_STATUS.QUARANTINED;
        if (typeof this._audit === 'function') {
          this._audit('KEY_QUARANTINED', { enclaveId, epoch: keyState.epoch, missedCount: hbState.missedCount });
        }
      }
    } else if (hbState.missedCount >= 1) {
      hbState.status = HEARTBEAT_STATUS.DEGRADED;
    }
  }

  /**
   * Rotate the key for an enclave (manual or scheduled).
   * @param {string} enclaveId
   * @returns {object} Rotation result
   */
  rotateKey(enclaveId) {
    const keyState = this._enclaveKeys.get(enclaveId);
    if (!keyState) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    if (keyState.status === KEY_STATUS.QUARANTINED) {
      throw new HsmAdapterError('KEY_QUARANTINED',
        `enclave ${enclaveId} key is quarantined, cannot rotate`);
    }
    if (keyState.epoch >= this.maxEpochs) {
      throw new HsmAdapterError('MAX_EPOCHS_REACHED',
        `enclave ${enclaveId} has reached max epochs ${this.maxEpochs}`);
    }
    const oldKeyId = keyState.keyId;
    const oldKeyMaterial = keyState.keyMaterial;
    keyState.epoch++;
    keyState.keyId = _generateKeyId(enclaveId, keyState.epoch);
    keyState.keyMaterial = crypto.randomBytes(32);
    keyState.rotatedAt = Date.now();
    keyState.status = KEY_STATUS.ACTIVE;
    // Record history
    const history = this._rotationHistory.get(enclaveId);
    history.push({ epoch: keyState.epoch, keyId: keyState.keyId, rotatedAt: keyState.rotatedAt });
    // Zeroize old key material
    if (Buffer.isBuffer(oldKeyMaterial)) {
      oldKeyMaterial.fill(0);
    }
    if (typeof this._audit === 'function') {
      this._audit('KEY_ROTATED', { enclaveId, oldEpoch: keyState.epoch - 1, newEpoch: keyState.epoch, oldKeyId, newKeyId: keyState.keyId });
    }
    return {
      enclaveId,
      oldEpoch: keyState.epoch - 1,
      newEpoch: keyState.epoch,
      oldKeyId,
      newKeyId: keyState.keyId,
      rotatedAt: keyState.rotatedAt,
    };
  }

  /**
   * Check all enclaves for keys that need rotation based on age.
   * @returns {object[]} List of rotations performed
   */
  checkAndRotate() {
    const now = Date.now();
    const rotations = [];
    for (const [enclaveId, keyState] of this._enclaveKeys) {
      if (keyState.status !== KEY_STATUS.ACTIVE) continue;
      const age = now - keyState.rotatedAt;
      if (age >= this.rotationIntervalMs) {
        try {
          const result = this.rotateKey(enclaveId);
          rotations.push(result);
        } catch (e) {
          // Skip if rotation fails (e.g. quarantined)
          if (typeof this._audit === 'function') {
            this._audit('ROTATION_SKIPPED', { enclaveId, reason: e.message });
          }
        }
      }
    }
    return rotations;
  }

  /**
   * Check for expired heartbeat challenges and update missed counts.
   * @returns {object[]} List of expired challenges
   */
  checkExpiredChallenges() {
    const now = Date.now();
    const expired = [];
    for (const [challengeId, challenge] of this._pendingChallenges) {
      if (now > challenge.expiresAt) {
        this._pendingChallenges.delete(challengeId);
        this._incrementMissed(challenge.enclaveId);
        expired.push({ challengeId, enclaveId: challenge.enclaveId, expiredAt: now });
      }
    }
    return expired;
  }

  /**
   * Revoke a quarantined key.
   * @param {string} enclaveId
   * @returns {object} Revocation result
   */
  revokeKey(enclaveId) {
    const keyState = this._enclaveKeys.get(enclaveId);
    if (!keyState) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    if (keyState.status !== KEY_STATUS.QUARANTINED) {
      throw new HsmAdapterError('KEY_NOT_QUARANTINED',
        `enclave ${enclaveId} key status is ${keyState.status}, must be quarantined to revoke`);
    }
    keyState.status = KEY_STATUS.REVOKED;
    if (Buffer.isBuffer(keyState.keyMaterial)) {
      keyState.keyMaterial.fill(0);
    }
    if (typeof this._audit === 'function') {
      this._audit('KEY_REVOKED', { enclaveId, epoch: keyState.epoch, keyId: keyState.keyId });
    }
    return { enclaveId, epoch: keyState.epoch, keyId: keyState.keyId, revoked: true };
  }

  /**
   * Recover a quarantined enclave by rotating its key.
   * @param {string} enclaveId
   * @returns {object} Recovery result
   */
  recoverEnclave(enclaveId) {
    const keyState = this._enclaveKeys.get(enclaveId);
    if (!keyState) {
      throw new HsmAdapterError('ENCLAVE_NOT_FOUND', `enclave ${enclaveId} not found`);
    }
    if (keyState.status !== KEY_STATUS.QUARANTINED) {
      throw new HsmAdapterError('ENCLAVE_NOT_QUARANTINED',
        `enclave ${enclaveId} is not quarantined (status: ${keyState.status})`);
    }
    // Force rotation to recover
    keyState.status = KEY_STATUS.ACTIVE; // Temporarily set to active for rotation
    const result = this.rotateKey(enclaveId);
    // Reset heartbeat state
    const hbState = this._heartbeatState.get(enclaveId);
    if (hbState) {
      hbState.missedCount = 0;
      hbState.status = HEARTBEAT_STATUS.HEALTHY;
      hbState.lastResponse = Date.now();
    }
    if (typeof this._audit === 'function') {
      this._audit('ENCLAVE_RECOVERED', { enclaveId, newEpoch: result.newEpoch });
    }
    return { ...result, recovered: true };
  }

  /**
   * Get the key state for an enclave.
   * @param {string} enclaveId
   * @returns {object|null}
   */
  getKeyState(enclaveId) {
    const state = this._enclaveKeys.get(enclaveId);
    if (!state) return null;
    return {
      enclaveId,
      epoch: state.epoch,
      keyId: state.keyId,
      status: state.status,
      createdAt: state.createdAt,
      rotatedAt: state.rotatedAt,
      keyAgeMs: Date.now() - state.rotatedAt,
    };
  }

  /**
   * Get the heartbeat state for an enclave.
   * @param {string} enclaveId
   * @returns {object|null}
   */
  getHeartbeatState(enclaveId) {
    const state = this._heartbeatState.get(enclaveId);
    if (!state) return null;
    return {
      enclaveId,
      status: state.status,
      missedCount: state.missedCount,
      lastResponse: state.lastResponse,
      ageMs: Date.now() - state.lastResponse,
    };
  }

  /**
   * Get rotation history for an enclave.
   * @param {string} enclaveId
   * @returns {object[]}
   */
  getRotationHistory(enclaveId) {
    return (this._rotationHistory.get(enclaveId) || []).slice();
  }

  /**
   * Get all registered enclaves.
   * @returns {object[]}
   */
  getEnclaves() {
    return Array.from(this._enclaveKeys.keys()).map(id => this.getKeyState(id));
  }

  /**
   * Get pending heartbeat challenges.
   * @returns {object[]}
   */
  getPendingChallenges() {
    return Array.from(this._pendingChallenges.values()).map(c => ({
      challengeId: c.challengeId,
      enclaveId: c.enclaveId,
      epoch: c.epoch,
      issuedAt: c.issuedAt,
      expiresAt: c.expiresAt,
      ageMs: Date.now() - c.issuedAt,
    }));
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    let active = 0, quarantined = 0, revoked = 0;
    let healthy = 0, degraded = 0, unresponsive = 0;
    for (const state of this._enclaveKeys.values()) {
      if (state.status === KEY_STATUS.ACTIVE) active++;
      else if (state.status === KEY_STATUS.QUARANTINED) quarantined++;
      else if (state.status === KEY_STATUS.REVOKED) revoked++;
    }
    for (const state of this._heartbeatState.values()) {
      if (state.status === HEARTBEAT_STATUS.HEALTHY) healthy++;
      else if (state.status === HEARTBEAT_STATUS.DEGRADED) degraded++;
      else if (state.status === HEARTBEAT_STATUS.UNRESPONSIVE) unresponsive++;
    }
    return {
      enclaveCount: this._enclaveKeys.size,
      activeKeys: active,
      quarantinedKeys: quarantined,
      revokedKeys: revoked,
      healthyEnclaves: healthy,
      degradedEnclaves: degraded,
      unresponsiveEnclaves: unresponsive,
      pendingChallenges: this._pendingChallenges.size,
      rotationIntervalMs: this.rotationIntervalMs,
      heartbeatIntervalMs: this.heartbeatIntervalMs,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    // Zeroize all key material
    for (const state of this._enclaveKeys.values()) {
      if (Buffer.isBuffer(state.keyMaterial)) {
        state.keyMaterial.fill(0);
      }
    }
    this._enclaveKeys.clear();
    this._pendingChallenges.clear();
    this._heartbeatState.clear();
    this._rotationHistory.clear();
  }
}

function _generateKeyId(enclaveId, epoch) {
  return crypto.createHash('sha256')
    .update(enclaveId + ':epoch:' + epoch + ':' + Date.now())
    .digest('hex')
    .substring(0, 32);
}

function _hash(algo, data) {
  return crypto.createHash(algo).update(data).digest('hex');
}

function _computeHmac(algo, key, message) {
  return crypto.createHmac(algo, key).update(message).digest('hex');
}

module.exports = { EnclaveKeyRotationEngine, DEFAULT_OPTIONS, KEY_STATUS, HEARTBEAT_STATUS };
