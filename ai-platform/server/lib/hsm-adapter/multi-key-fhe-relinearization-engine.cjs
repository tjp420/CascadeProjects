'use strict';

/**
 * Track 58: Fully Homomorphic Encryption Multi-Key Relinearization Engine.
 *
 * Bridges isolated user key spaces over the mesh by supporting multi-key
 * FHE operations. Each user has their own FHE key pair; ciphertexts
 * encrypted under different keys can be combined homomorphically through
 * relinearization keys that allow cross-key operations without revealing
 * private keys.
 *
 * Components:
 *   - MultiKeyFheKeyGenerator: Generates per-user FHE key pairs
 *   - RelinearizationKeyFactory: Creates relinearization keys for cross-key ops
 *   - MultiKeyEncryptor: Encrypts plaintexts under a specific user's key
 *   - MultiKeyEvaluator: Performs homomorphic operations across keys
 *   - RelinearizationEngine: Relinearizes ciphertexts after multiplication
 *   - NoiseBudgetTracker: Tracks noise growth in ciphertexts
 *   - KeySwitchingEngine: Switches ciphertexts between key spaces
 *   - BootstrappingManager: Refreshes noise budget via bootstrapping
 *
 * @module hsm-adapter/multi-key-fhe-relinearization-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

const DEFAULT_OPTIONS = {
  fieldPrime: (1n << 256n) - 189n,
  maxKeyPairs: 50,
  maxNoiseBudget: 1000,
  noiseThreshold: 100,
  maxCiphertextOps: 10000,
  enableBootstrapping: true,
  enableKeySwitching: true,
  maxRelinearizationKeys: 200,
  evaluationTimeoutMs: 30000,
};

const KEY_STATUS = {
  ACTIVE: 'active',
  COMPROMISED: 'compromised',
  REVOKED: 'revoked',
  EXPIRED: 'expired',
};

const CIPHERTEXT_STATUS = {
  FRESH: 'fresh',
  EVALUATED: 'evaluated',
  RELINEARIZED: 'relinearized',
  BOOTSTRAPPED: 'bootstrapped',
  EXHAUSTED: 'exhausted',
};

const OP_TYPE = {
  ADD: 'add',
  MUL: 'mul',
  SCALAR_MUL: 'scalarMul',
  SCALAR_ADD: 'scalarAdd',
  SUB: 'sub',
};

/**
 * Multi-Key FHE Relinearization Engine.
 */
class MultiKeyFheRelinearizationEngine {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.fieldPrime = opts.fieldPrime;
    this.maxKeyPairs = opts.maxKeyPairs;
    this.maxNoiseBudget = opts.maxNoiseBudget;
    this.noiseThreshold = opts.noiseThreshold;
    this.maxCiphertextOps = opts.maxCiphertextOps;
    this.enableBootstrapping = opts.enableBootstrapping;
    this.enableKeySwitching = opts.enableKeySwitching;
    this.maxRelinearizationKeys = opts.maxRelinearizationKeys;
    this.evaluationTimeoutMs = opts.evaluationTimeoutMs;
    this._audit = opts.audit || null;

    this._keyPairs = new Map(); // keyId -> key pair
    this._relinKeys = new Map(); // relinKeyId -> relinearization key
    this._ciphertexts = new Map(); // ciphertextId -> ciphertext
    this._evalHistory = [];
    this._maxHistory = 100;
    this._opCount = 0;
    this._bootstrapCount = 0;
    this._relinCount = 0;
    this._keySwitchCount = 0;
  }

  /**
   * Generate a new FHE key pair for a user.
   * @param {string} keyId - Unique key identifier
   * @param {string} [userId] - User identifier
   * @returns {object} Key pair info
   */
  generateKeyPair(keyId, userId) {
    if (!keyId || typeof keyId !== 'string') {
      throw new HsmAdapterError('INVALID_KEY_ID', 'keyId must be a non-empty string');
    }
    if (this._keyPairs.has(keyId)) {
      throw new HsmAdapterError('KEY_ALREADY_EXISTS', `key ${keyId} already exists`);
    }
    if (this._keyPairs.size >= this.maxKeyPairs) {
      throw new HsmAdapterError('MAX_KEY_PAIRS_REACHED',
        `maximum ${this.maxKeyPairs} key pairs reached`);
    }
    // Generate FHE key pair (simulated LWE-style)
    const secretKey = _randomFieldElement(this.fieldPrime);
    const publicKey = _modPow(_generator(), secretKey, this.fieldPrime);
    const keyPair = {
      keyId,
      userId: userId || keyId,
      secretKey,
      publicKey,
      status: KEY_STATUS.ACTIVE,
      createdAt: Date.now(),
      encryptionCount: 0,
      decryptionCount: 0,
    };
    this._keyPairs.set(keyId, keyPair);
    if (typeof this._audit === 'function') {
      this._audit('KEY_PAIR_GENERATED', { keyId, userId: keyPair.userId });
    }
    return {
      keyId,
      userId: keyPair.userId,
      status: keyPair.status,
      publicKey: keyPair.publicKey.toString(16),
    };
  }

  /**
   * Generate a relinearization key between two key pairs.
   * @param {string} relinKeyId - Unique relinearization key ID
   * @param {string} sourceKeyId - Source key ID
   * @param {string} targetKeyId - Target key ID
   * @returns {object} Relinearization key info
   */
  generateRelinearizationKey(relinKeyId, sourceKeyId, targetKeyId) {
    if (!relinKeyId || typeof relinKeyId !== 'string') {
      throw new HsmAdapterError('INVALID_RELIN_KEY_ID', 'relinKeyId must be a non-empty string');
    }
    if (this._relinKeys.has(relinKeyId)) {
      throw new HsmAdapterError('RELIN_KEY_ALREADY_EXISTS',
        `relinearization key ${relinKeyId} already exists`);
    }
    if (this._relinKeys.size >= this.maxRelinearizationKeys) {
      throw new HsmAdapterError('MAX_RELIN_KEYS_REACHED',
        `maximum ${this.maxRelinearizationKeys} relinearization keys reached`);
    }
    const sourceKey = this._keyPairs.get(sourceKeyId);
    if (!sourceKey) {
      throw new HsmAdapterError('KEY_NOT_FOUND', `source key ${sourceKeyId} not found`);
    }
    const targetKey = this._keyPairs.get(targetKeyId);
    if (!targetKey) {
      throw new HsmAdapterError('KEY_NOT_FOUND', `target key ${targetKeyId} not found`);
    }
    if (sourceKey.status !== KEY_STATUS.ACTIVE) {
      throw new HsmAdapterError('KEY_NOT_ACTIVE', `source key ${sourceKeyId} is ${sourceKey.status}`);
    }
    if (targetKey.status !== KEY_STATUS.ACTIVE) {
      throw new HsmAdapterError('KEY_NOT_ACTIVE', `target key ${targetKeyId} is ${targetKey.status}`);
    }
    // Generate relinearization key (simulated)
    const relinKeyData = crypto.createHash('sha256')
      .update(`relin:${sourceKeyId}:${targetKeyId}:${sourceKey.secretKey.toString(16)}`)
      .digest();
    const relinKey = {
      relinKeyId,
      sourceKeyId,
      targetKeyId,
      data: relinKeyData,
      createdAt: Date.now(),
      usageCount: 0,
    };
    this._relinKeys.set(relinKeyId, relinKey);
    if (typeof this._audit === 'function') {
      this._audit('RELIN_KEY_GENERATED', { relinKeyId, sourceKeyId, targetKeyId });
    }
    return {
      relinKeyId,
      sourceKeyId,
      targetKeyId,
      size: relinKeyData.length,
    };
  }

  /**
   * Encrypt a plaintext under a specific key.
   * @param {string} keyId - Key to encrypt under
   * @param {bigint|number} plaintext - Value to encrypt
   * @returns {object} Ciphertext info
   */
  encrypt(keyId, plaintext) {
    const keyPair = this._keyPairs.get(keyId);
    if (!keyPair) {
      throw new HsmAdapterError('KEY_NOT_FOUND', `key ${keyId} not found`);
    }
    if (keyPair.status !== KEY_STATUS.ACTIVE) {
      throw new HsmAdapterError('KEY_NOT_ACTIVE', `key ${keyId} is ${keyPair.status}`);
    }
    const pt = _toFieldElement(this.fieldPrime, plaintext);
    // Simulated FHE encryption: ciphertext = plaintext + noise * publicKey
    const noise = _randomFieldElement(this.fieldPrime);
    const ciphertextValue = (pt + noise * keyPair.publicKey) % this.fieldPrime;
    const ciphertextId = `ct-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    const ciphertext = {
      ciphertextId,
      keyId,
      value: ciphertextValue,
      noise,
      noiseBudget: this.maxNoiseBudget,
      status: CIPHERTEXT_STATUS.FRESH,
      plaintext: pt, // For verification in simulation
      createdAt: Date.now(),
      opCount: 0,
    };
    this._ciphertexts.set(ciphertextId, ciphertext);
    keyPair.encryptionCount++;
    if (typeof this._audit === 'function') {
      this._audit('ENCRYPTED', { ciphertextId, keyId });
    }
    return {
      ciphertextId,
      keyId,
      status: ciphertext.status,
      noiseBudget: ciphertext.noiseBudget,
    };
  }

  /**
   * Decrypt a ciphertext with the secret key.
   * @param {string} ciphertextId
   * @returns {object} Decryption result
   */
  decrypt(ciphertextId) {
    const ct = this._ciphertexts.get(ciphertextId);
    if (!ct) {
      throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${ciphertextId} not found`);
    }
    const keyPair = this._keyPairs.get(ct.keyId);
    if (!keyPair) {
      throw new HsmAdapterError('KEY_NOT_FOUND', `key ${ct.keyId} not found`);
    }
    if (keyPair.status !== KEY_STATUS.ACTIVE) {
      throw new HsmAdapterError('KEY_NOT_ACTIVE', `key ${ct.keyId} is ${keyPair.status}`);
    }
    // Simulated decryption: plaintext = (ciphertext mod secretKey)
    const plaintext = ct.plaintext; // In simulation, we stored it
    keyPair.decryptionCount++;
    if (typeof this._audit === 'function') {
      this._audit('DECRYPTED', { ciphertextId, keyId: ct.keyId });
    }
    return {
      ciphertextId,
      plaintext,
      keyId: ct.keyId,
    };
  }

  /**
   * Perform homomorphic addition of two ciphertexts.
   * @param {string} ctId1
   * @param {string} ctId2
   * @returns {object} Result ciphertext
   */
  add(ctId1, ctId2) {
    return this._evaluate(OP_TYPE.ADD, [ctId1, ctId2]);
  }

  /**
   * Perform homomorphic subtraction of two ciphertexts.
   * @param {string} ctId1
   * @param {string} ctId2
   * @returns {object} Result ciphertext
   */
  sub(ctId1, ctId2) {
    return this._evaluate(OP_TYPE.SUB, [ctId1, ctId2]);
  }

  /**
   * Perform homomorphic multiplication of two ciphertexts.
   * Requires relinearization if keys differ.
   * @param {string} ctId1
   * @param {string} ctId2
   * @param {string} [relinKeyId] - Relinearization key for cross-key mul
   * @returns {object} Result ciphertext
   */
  mul(ctId1, ctId2, relinKeyId) {
    const ct1 = this._ciphertexts.get(ctId1);
    if (!ct1) throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${ctId1} not found`);
    const ct2 = this._ciphertexts.get(ctId2);
    if (!ct2) throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${ctId2} not found`);
    // Check noise budget
    if (ct1.noiseBudget < this.noiseThreshold || ct2.noiseBudget < this.noiseThreshold) {
      if (this.enableBootstrapping) {
        this._bootstrap(ctId1);
        this._bootstrap(ctId2);
      } else {
        throw new HsmAdapterError('NOISE_BUDGET_EXHAUSTED',
          `noise budget too low for multiplication`);
      }
    }
    // Same key — direct multiplication
    if (ct1.keyId === ct2.keyId) {
      return this._evaluate(OP_TYPE.MUL, [ctId1, ctId2]);
    }
    // Different keys — need relinearization
    if (!relinKeyId) {
      throw new HsmAdapterError('RELIN_KEY_REQUIRED',
        `cross-key multiplication requires a relinearization key`);
    }
    const relinKey = this._relinKeys.get(relinKeyId);
    if (!relinKey) {
      throw new HsmAdapterError('RELIN_KEY_NOT_FOUND', `relinearization key ${relinKeyId} not found`);
    }
    // Check relin key matches the ciphertexts' keys
    const sourceMatches = relinKey.sourceKeyId === ct1.keyId || relinKey.sourceKeyId === ct2.keyId;
    const targetMatches = relinKey.targetKeyId === ct1.keyId || relinKey.targetKeyId === ct2.keyId;
    if (!sourceMatches || !targetMatches) {
      throw new HsmAdapterError('RELIN_KEY_MISMATCH',
        `relinearization key does not match ciphertext keys`);
    }
    // Perform relinearized multiplication
    const result = this._evaluate(OP_TYPE.MUL, [ctId1, ctId2], relinKeyId);
    // Mark as relinearized
    const resultCt = this._ciphertexts.get(result.ciphertextId);
    resultCt.status = CIPHERTEXT_STATUS.RELINEARIZED;
    result.status = CIPHERTEXT_STATUS.RELINEARIZED;
    relinKey.usageCount++;
    this._relinCount++;
    return result;
  }

  /**
   * Perform scalar multiplication on a ciphertext.
   * @param {string} ciphertextId
   * @param {bigint|number} scalar
   * @returns {object} Result ciphertext
   */
  scalarMul(ciphertextId, scalar) {
    const ct = this._ciphertexts.get(ciphertextId);
    if (!ct) {
      throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${ciphertextId} not found`);
    }
    const s = _toFieldElement(this.fieldPrime, scalar);
    const newPlaintext = (ct.plaintext * s) % this.fieldPrime;
    const newValue = (ct.value * s) % this.fieldPrime;
    const newCtId = `ct-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    const newCiphertext = {
      ciphertextId: newCtId,
      keyId: ct.keyId,
      value: newValue,
      noise: (ct.noise * s) % this.fieldPrime,
      noiseBudget: ct.noiseBudget - 1,
      status: CIPHERTEXT_STATUS.EVALUATED,
      plaintext: newPlaintext,
      createdAt: Date.now(),
      opCount: ct.opCount + 1,
    };
    this._ciphertexts.set(newCtId, newCiphertext);
    this._opCount++;
    this._checkNoiseBudget(newCtId);
    this._recordHistory('SCALAR_MUL', ct.ciphertextId, newCtId);
    return {
      ciphertextId: newCtId,
      keyId: newCiphertext.keyId,
      status: newCiphertext.status,
      noiseBudget: newCiphertext.noiseBudget,
    };
  }

  /**
   * Perform scalar addition on a ciphertext.
   * @param {string} ciphertextId
   * @param {bigint|number} scalar
   * @returns {object} Result ciphertext
   */
  scalarAdd(ciphertextId, scalar) {
    const ct = this._ciphertexts.get(ciphertextId);
    if (!ct) {
      throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${ciphertextId} not found`);
    }
    const s = _toFieldElement(this.fieldPrime, scalar);
    const newPlaintext = (ct.plaintext + s) % this.fieldPrime;
    const newValue = (ct.value + s) % this.fieldPrime;
    const newCtId = `ct-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    const newCiphertext = {
      ciphertextId: newCtId,
      keyId: ct.keyId,
      value: newValue,
      noise: ct.noise,
      noiseBudget: ct.noiseBudget,
      status: CIPHERTEXT_STATUS.EVALUATED,
      plaintext: newPlaintext,
      createdAt: Date.now(),
      opCount: ct.opCount + 1,
    };
    this._ciphertexts.set(newCtId, newCiphertext);
    this._opCount++;
    this._recordHistory('SCALAR_ADD', ct.ciphertextId, newCtId);
    return {
      ciphertextId: newCtId,
      keyId: newCiphertext.keyId,
      status: newCiphertext.status,
      noiseBudget: newCiphertext.noiseBudget,
    };
  }

  /**
   * Switch a ciphertext to a different key space.
   * @param {string} ciphertextId
   * @param {string} targetKeyId
   * @param {string} relinKeyId
   * @returns {object} Switched ciphertext
   */
  switchKey(ciphertextId, targetKeyId, relinKeyId) {
    if (!this.enableKeySwitching) {
      throw new HsmAdapterError('KEY_SWITCHING_DISABLED', 'key switching is disabled');
    }
    const ct = this._ciphertexts.get(ciphertextId);
    if (!ct) {
      throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${ciphertextId} not found`);
    }
    const targetKey = this._keyPairs.get(targetKeyId);
    if (!targetKey) {
      throw new HsmAdapterError('KEY_NOT_FOUND', `target key ${targetKeyId} not found`);
    }
    if (targetKey.status !== KEY_STATUS.ACTIVE) {
      throw new HsmAdapterError('KEY_NOT_ACTIVE', `target key ${targetKeyId} is ${targetKey.status}`);
    }
    const relinKey = this._relinKeys.get(relinKeyId);
    if (!relinKey) {
      throw new HsmAdapterError('RELIN_KEY_NOT_FOUND', `relinearization key ${relinKeyId} not found`);
    }
    if (relinKey.sourceKeyId !== ct.keyId || relinKey.targetKeyId !== targetKeyId) {
      throw new HsmAdapterError('RELIN_KEY_MISMATCH',
        `relinearization key does not match source/target keys`);
    }
    const newCtId = `ct-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    const newCiphertext = {
      ciphertextId: newCtId,
      keyId: targetKeyId,
      value: ct.value,
      noise: ct.noise,
      noiseBudget: ct.noiseBudget - 5, // Key switching costs noise
      status: CIPHERTEXT_STATUS.EVALUATED,
      plaintext: ct.plaintext,
      createdAt: Date.now(),
      opCount: ct.opCount + 1,
    };
    this._ciphertexts.set(newCtId, newCiphertext);
    relinKey.usageCount++;
    this._keySwitchCount++;
    this._opCount++;
    this._checkNoiseBudget(newCtId);
    this._recordHistory('KEY_SWITCH', ct.ciphertextId, newCtId);
    if (typeof this._audit === 'function') {
      this._audit('KEY_SWITCHED', { ciphertextId, newCtId, targetKeyId });
    }
    return {
      ciphertextId: newCtId,
      keyId: targetKeyId,
      status: newCiphertext.status,
      noiseBudget: newCiphertext.noiseBudget,
    };
  }

  /**
   * Bootstrap a ciphertext to refresh its noise budget.
   * @param {string} ciphertextId
   * @returns {object} Bootstrapped ciphertext
   */
  bootstrap(ciphertextId) {
    if (!this.enableBootstrapping) {
      throw new HsmAdapterError('BOOTSTRAPPING_DISABLED', 'bootstrapping is disabled');
    }
    return this._bootstrap(ciphertextId);
  }

  /**
   * Revoke a key pair.
   * @param {string} keyId
   */
  revokeKey(keyId) {
    const keyPair = this._keyPairs.get(keyId);
    if (!keyPair) {
      throw new HsmAdapterError('KEY_NOT_FOUND', `key ${keyId} not found`);
    }
    keyPair.status = KEY_STATUS.REVOKED;
    keyPair.secretKey = 0n; // Zeroize
    if (typeof this._audit === 'function') {
      this._audit('KEY_REVOKED', { keyId });
    }
    return { keyId, revoked: true };
  }

  /**
   * Get key pair info.
   * @param {string} keyId
   * @returns {object|null}
   */
  getKeyPair(keyId) {
    const keyPair = this._keyPairs.get(keyId);
    if (!keyPair) return null;
    return {
      keyId,
      userId: keyPair.userId,
      status: keyPair.status,
      publicKey: keyPair.publicKey.toString(16),
      encryptionCount: keyPair.encryptionCount,
      decryptionCount: keyPair.decryptionCount,
      createdAt: keyPair.createdAt,
    };
  }

  /**
   * Get all key pairs.
   * @returns {object[]}
   */
  getKeyPairs() {
    return Array.from(this._keyPairs.values()).map(k => ({
      keyId: k.keyId,
      userId: k.userId,
      status: k.status,
      encryptionCount: k.encryptionCount,
    }));
  }

  /**
   * Get ciphertext info.
   * @param {string} ciphertextId
   * @returns {object|null}
   */
  getCiphertext(ciphertextId) {
    const ct = this._ciphertexts.get(ciphertextId);
    if (!ct) return null;
    return {
      ciphertextId: ct.ciphertextId,
      keyId: ct.keyId,
      status: ct.status,
      noiseBudget: ct.noiseBudget,
      opCount: ct.opCount,
      createdAt: ct.createdAt,
    };
  }

  /**
   * Get relinearization key info.
   * @param {string} relinKeyId
   * @returns {object|null}
   */
  getRelinearizationKey(relinKeyId) {
    const relinKey = this._relinKeys.get(relinKeyId);
    if (!relinKey) return null;
    return {
      relinKeyId: relinKey.relinKeyId,
      sourceKeyId: relinKey.sourceKeyId,
      targetKeyId: relinKey.targetKeyId,
      usageCount: relinKey.usageCount,
      createdAt: relinKey.createdAt,
    };
  }

  /**
   * Get evaluation history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getEvalHistory(limit) {
    const n = typeof limit === 'number' ? limit : 20;
    return this._evalHistory.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const keysByStatus = {};
    for (const k of this._keyPairs.values()) {
      keysByStatus[k.status] = (keysByStatus[k.status] || 0) + 1;
    }
    return {
      totalKeyPairs: this._keyPairs.size,
      totalRelinKeys: this._relinKeys.size,
      activeCiphertexts: this._ciphertexts.size,
      totalOps: this._opCount,
      bootstrapCount: this._bootstrapCount,
      relinearizationCount: this._relinCount,
      keySwitchCount: this._keySwitchCount,
      keysByStatus,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    this._keyPairs.clear();
    this._relinKeys.clear();
    this._ciphertexts.clear();
    this._evalHistory = [];
    this._opCount = 0;
    this._bootstrapCount = 0;
    this._relinCount = 0;
    this._keySwitchCount = 0;
  }

  // ---- Private methods ----

  /**
   * Evaluate a homomorphic operation.
   * @private
   */
  _evaluate(op, ctIds, relinKeyId) {
    if (this._opCount >= this.maxCiphertextOps) {
      throw new HsmAdapterError('MAX_OPS_REACHED',
        `maximum ${this.maxCiphertextOps} operations reached`);
    }
    const cts = ctIds.map(id => {
      const ct = this._ciphertexts.get(id);
      if (!ct) throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${id} not found`);
      return ct;
    });
    let newPlaintext, newValue, newNoise, noiseCost;
    switch (op) {
      case OP_TYPE.ADD:
        newPlaintext = (cts[0].plaintext + cts[1].plaintext) % this.fieldPrime;
        newValue = (cts[0].value + cts[1].value) % this.fieldPrime;
        newNoise = (cts[0].noise + cts[1].noise) % this.fieldPrime;
        noiseCost = 1;
        break;
      case OP_TYPE.SUB:
        newPlaintext = (cts[0].plaintext - cts[1].plaintext + this.fieldPrime) % this.fieldPrime;
        newValue = (cts[0].value - cts[1].value + this.fieldPrime) % this.fieldPrime;
        newNoise = (cts[0].noise - cts[1].noise + this.fieldPrime) % this.fieldPrime;
        noiseCost = 1;
        break;
      case OP_TYPE.MUL:
        newPlaintext = (cts[0].plaintext * cts[1].plaintext) % this.fieldPrime;
        newValue = (cts[0].value * cts[1].value) % this.fieldPrime;
        newNoise = (cts[0].noise * cts[1].noise) % this.fieldPrime;
        noiseCost = 10; // Multiplication is expensive
        break;
      default:
        throw new HsmAdapterError('INVALID_OP', `unknown operation: ${op}`);
    }
    // Determine result key
    let resultKeyId = cts[0].keyId;
    if (cts.length > 1 && cts[0].keyId !== cts[1].keyId) {
      // Cross-key operation — use target key from relin key
      if (relinKeyId) {
        const relinKey = this._relinKeys.get(relinKeyId);
        if (relinKey) {
          resultKeyId = relinKey.targetKeyId;
        }
      } else {
        resultKeyId = cts[0].keyId; // Default to first
      }
    }
    const newCtId = `ct-${Date.now()}-${crypto.randomInt(0, 1000000)}`;
    const minNoiseBudget = Math.min(...cts.map(c => c.noiseBudget));
    const newCiphertext = {
      ciphertextId: newCtId,
      keyId: resultKeyId,
      value: newValue,
      noise: newNoise,
      noiseBudget: minNoiseBudget - noiseCost,
      status: CIPHERTEXT_STATUS.EVALUATED,
      plaintext: newPlaintext,
      createdAt: Date.now(),
      opCount: cts.reduce((sum, c) => sum + c.opCount, 0) + 1,
    };
    this._ciphertexts.set(newCtId, newCiphertext);
    this._opCount++;
    this._checkNoiseBudget(newCtId);
    this._recordHistory(op, ctIds.join(','), newCtId);
    return {
      ciphertextId: newCtId,
      keyId: resultKeyId,
      status: newCiphertext.status,
      noiseBudget: newCiphertext.noiseBudget,
    };
  }

  /**
   * Check noise budget and bootstrap if needed.
   * @private
   */
  _checkNoiseBudget(ciphertextId) {
    const ct = this._ciphertexts.get(ciphertextId);
    if (!ct) return;
    if (ct.noiseBudget <= 0) {
      ct.status = CIPHERTEXT_STATUS.EXHAUSTED;
      if (this.enableBootstrapping) {
        this._bootstrap(ciphertextId);
      }
    } else if (ct.noiseBudget < this.noiseThreshold) {
      // Low noise budget — flag for bootstrapping
      ct.status = CIPHERTEXT_STATUS.EVALUATED;
    }
  }

  /**
   * Bootstrap a ciphertext to refresh its noise budget.
   * @private
   */
  _bootstrap(ciphertextId) {
    const ct = this._ciphertexts.get(ciphertextId);
    if (!ct) {
      throw new HsmAdapterError('CIPHERTEXT_NOT_FOUND', `ciphertext ${ciphertextId} not found`);
    }
    ct.noiseBudget = this.maxNoiseBudget;
    ct.status = CIPHERTEXT_STATUS.BOOTSTRAPPED;
    this._bootstrapCount++;
    this._recordHistory('BOOTSTRAP', ciphertextId, ciphertextId);
    if (typeof this._audit === 'function') {
      this._audit('BOOTSTRAPPED', { ciphertextId });
    }
    return {
      ciphertextId,
      status: ct.status,
      noiseBudget: ct.noiseBudget,
    };
  }

  /**
   * Record evaluation history.
   * @private
   */
  _recordHistory(op, inputIds, outputId) {
    this._evalHistory.push({
      op,
      inputIds,
      outputId,
      timestamp: Date.now(),
    });
    if (this._evalHistory.length > this._maxHistory) {
      this._evalHistory.shift();
    }
  }
}

/**
 * Convert a value to a field element.
 * @param {bigint} fieldPrime
 * @param {*} val
 * @returns {bigint}
 * @private
 */
function _toFieldElement(fieldPrime, val) {
  if (typeof val === 'bigint') return val % fieldPrime;
  if (typeof val === 'number') return BigInt(val) % fieldPrime;
  if (typeof val === 'string') {
    try { return BigInt(val) % fieldPrime; } catch { return 0n; }
  }
  return 0n;
}

/**
 * Generate a random field element.
 * @param {bigint} fieldPrime
 * @returns {bigint}
 * @private
 */
function _randomFieldElement(fieldPrime) {
  const bytes = crypto.randomBytes(32);
  let value = 0n;
  for (const b of bytes) {
    value = (value << 8n) | BigInt(b);
  }
  return value % fieldPrime;
}

/**
 * Modular exponentiation.
 * @param {bigint} base
 * @param {bigint} exp
 * @param {bigint} mod
 * @returns {bigint}
 * @private
 */
function _modPow(base, exp, mod) {
  let result = 1n;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e & 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e = e >> 1n;
  }
  return result;
}

/**
 * Generator for the field.
 * @returns {bigint}
 * @private
 */
function _generator() {
  return 3n;
}

module.exports = {
  MultiKeyFheRelinearizationEngine,
  DEFAULT_OPTIONS,
  KEY_STATUS,
  CIPHERTEXT_STATUS,
  OP_TYPE,
};
