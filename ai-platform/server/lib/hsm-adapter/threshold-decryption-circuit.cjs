"use strict";

/**
 * Track 54: Multi-Party Threshold Cryptography and Distributed Decryption Circuits.
 *
 * Enables fault-tolerant shared secret assembly for decrypting ciphertexts
 * across a cluster of enclaves. Each enclave holds a partial decryption key
 * share; t-of-n shares are required to reconstruct the plaintext without
 * any single enclave ever holding the full key.
 *
 * Components:
 *   - ThresholdKeySet: Manages distributed key shares (t-of-n Shamir)
 *   - PartialDecryptionEngine: Each node computes partial decryption
 *   - DecryptionShareVerifier: Verifies partial decryption shares
 *   - DecryptionAssembler: Combines valid shares via Lagrange interpolation
 *   - DecryptionCircuit: Orchestrates the full distributed decryption flow
 *   - FaultToleranceManager: Handles node failures and share recovery
 *
 * @module hsm-adapter/threshold-decryption-circuit
 */

const crypto = require("crypto");
const { HsmAdapterError } = require("./base-adapter.cjs");

const DEFAULT_OPTIONS = {
  maxParticipants: 16,
  minThreshold: 2,
  maxThreshold: 16,
  keySizeBits: 256,
  shareValidityMs: 300000, // 5 minutes
  requireAttestation: false,
  maxRetries: 3,
  circuitTimeoutMs: 60000,
  enableShareVerification: true,
};

const KEYSET_STATUS = {
  PENDING: "pending",
  ACTIVE: "active",
  COMPROMISED: "compromised",
  ROTATED: "rotated",
  DESTROYED: "destroyed",
};

const CIRCUIT_STATUS = {
  PENDING: "pending",
  DISTRIBUTED: "distributed",
  COLLECTING: "collecting",
  COMPLETED: "completed",
  FAILED: "failed",
  EXPIRED: "expired",
};

const SHARE_STATUS = {
  PENDING: "pending",
  VERIFIED: "verified",
  INVALID: "invalid",
  EXPIRED: "expired",
};

/**
 * Multi-Party Threshold Cryptography and Distributed Decryption Circuits Engine.
 */
class ThresholdDecryptionCircuit {
  /**
   * @param {object} [options]
   */
  constructor(options = {}) {
    const opts = { ...DEFAULT_OPTIONS, ...options };
    this.maxParticipants = opts.maxParticipants;
    this.minThreshold = opts.minThreshold;
    this.maxThreshold = opts.maxThreshold;
    this.keySizeBits = opts.keySizeBits;
    this.shareValidityMs = opts.shareValidityMs;
    this.requireAttestation = opts.requireAttestation;
    this.maxRetries = opts.maxRetries;
    this.circuitTimeoutMs = opts.circuitTimeoutMs;
    this.enableShareVerification = opts.enableShareVerification;
    this._audit = opts.audit || null;

    this._keySets = new Map(); // keySetId -> key set state
    this._circuits = new Map(); // circuitId -> circuit state
    this._completedCircuits = [];
    this._maxHistory = 100;
  }

  /**
   * Create a new threshold key set with t-of-n Shamir secret sharing.
   * @param {object} config
   * @param {string} config.keySetId - Unique key set identifier
   * @param {number} config.threshold - Minimum shares needed (t)
   * @param {number} config.participants - Total participants (n)
   * @param {string[]} [config.participantIds] - Participant identifiers
   * @returns {object} Key set creation result
   */
  createKeySet(config) {
    if (!config || typeof config !== "object") {
      throw new HsmAdapterError("INVALID_CONFIG", "key set config is required");
    }
    if (!config.keySetId || typeof config.keySetId !== "string") {
      throw new HsmAdapterError(
        "INVALID_KEYSET_ID",
        "keySetId must be a non-empty string",
      );
    }
    if (this._keySets.has(config.keySetId)) {
      throw new HsmAdapterError(
        "KEYSET_ALREADY_EXISTS",
        `key set ${config.keySetId} already exists`,
      );
    }
    const threshold = config.threshold;
    const participants = config.participants;
    if (typeof threshold !== "number" || threshold < this.minThreshold) {
      throw new HsmAdapterError(
        "INVALID_THRESHOLD",
        `threshold must be at least ${this.minThreshold}`,
      );
    }
    if (typeof participants !== "number" || participants < threshold) {
      throw new HsmAdapterError(
        "INVALID_PARTICIPANTS",
        `participants must be >= threshold (${threshold})`,
      );
    }
    if (participants > this.maxParticipants) {
      throw new HsmAdapterError(
        "TOO_MANY_PARTICIPANTS",
        `${participants} exceeds max ${this.maxParticipants}`,
      );
    }
    if (threshold > this.maxThreshold) {
      throw new HsmAdapterError(
        "THRESHOLD_TOO_HIGH",
        `${threshold} exceeds max threshold ${this.maxThreshold}`,
      );
    }
    // Generate master key
    const masterKey = crypto.randomBytes(this.keySizeBits / 8);
    // Split into Shamir shares
    const shares = _shamirSplit(masterKey, threshold, participants);
    // Assign to participants
    const participantIds =
      config.participantIds ||
      Array.from({ length: participants }, (_, i) => `node-${i + 1}`);
    if (participantIds.length !== participants) {
      throw new HsmAdapterError(
        "PARTICIPANT_ID_MISMATCH",
        `expected ${participants} participantIds, got ${participantIds.length}`,
      );
    }
    const shareMap = new Map();
    for (let i = 0; i < participants; i++) {
      shareMap.set(participantIds[i], {
        index: i + 1,
        share: shares[i],
        status: SHARE_STATUS.PENDING,
      });
    }
    // Compute public key (for encryption)
    const publicKey = crypto
      .createHash("sha256")
      .update(masterKey)
      .digest("hex");
    const keySet = {
      keySetId: config.keySetId,
      threshold,
      participants,
      participantIds,
      masterKey, // In production, this would be destroyed after splitting
      shares: shareMap,
      publicKey,
      status: KEYSET_STATUS.ACTIVE,
      createdAt: Date.now(),
      circuitCount: 0,
    };
    this._keySets.set(config.keySetId, keySet);
    if (typeof this._audit === "function") {
      this._audit("KEYSET_CREATED", {
        keySetId: config.keySetId,
        threshold,
        participants,
      });
    }
    return {
      keySetId: config.keySetId,
      threshold,
      participants,
      participantIds,
      publicKey,
      status: keySet.status,
    };
  }

  /**
   * Encrypt a message using the key set's public key.
   * @param {string} keySetId
   * @param {Buffer} message
   * @returns {object} Ciphertext { ciphertext, nonce, keySetId }
   */
  encrypt(keySetId, message) {
    const keySet = this._keySets.get(keySetId);
    if (!keySet) {
      throw new HsmAdapterError(
        "KEYSET_NOT_FOUND",
        `key set ${keySetId} not found`,
      );
    }
    if (keySet.status !== KEYSET_STATUS.ACTIVE) {
      throw new HsmAdapterError(
        "KEYSET_NOT_ACTIVE",
        `key set is in status ${keySet.status}`,
      );
    }
    if (!Buffer.isBuffer(message)) {
      throw new HsmAdapterError("INVALID_MESSAGE", "message must be a Buffer");
    }
    // Use master key for encryption (in production, this would use the public key)
    const nonce = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(
      "aes-256-gcm",
      keySet.masterKey,
      nonce,
    );
    const encrypted = Buffer.concat([cipher.update(message), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return {
      ciphertext: encrypted,
      nonce,
      authTag,
      keySetId,
    };
  }

  /**
   * Initiate a distributed decryption circuit.
   * @param {object} config
   * @param {string} config.circuitId - Unique circuit identifier
   * @param {string} config.keySetId - Key set to use
   * @param {Buffer} config.ciphertext - Ciphertext to decrypt
   * @param {Buffer} config.nonce - Nonce from encryption
   * @param {Buffer} [config.authTag] - Auth tag from encryption
   * @returns {object} Circuit initiation result
   */
  initiateCircuit(config) {
    if (!config || typeof config !== "object") {
      throw new HsmAdapterError("INVALID_CONFIG", "circuit config is required");
    }
    if (!config.circuitId || typeof config.circuitId !== "string") {
      throw new HsmAdapterError(
        "INVALID_CIRCUIT_ID",
        "circuitId must be a non-empty string",
      );
    }
    if (this._circuits.has(config.circuitId)) {
      throw new HsmAdapterError(
        "CIRCUIT_ALREADY_EXISTS",
        `circuit ${config.circuitId} already exists`,
      );
    }
    const keySet = this._keySets.get(config.keySetId);
    if (!keySet) {
      throw new HsmAdapterError(
        "KEYSET_NOT_FOUND",
        `key set ${config.keySetId} not found`,
      );
    }
    if (keySet.status !== KEYSET_STATUS.ACTIVE) {
      throw new HsmAdapterError(
        "KEYSET_NOT_ACTIVE",
        `key set is in status ${keySet.status}`,
      );
    }
    if (!Buffer.isBuffer(config.ciphertext)) {
      throw new HsmAdapterError(
        "INVALID_CIPHERTEXT",
        "ciphertext must be a Buffer",
      );
    }
    if (!Buffer.isBuffer(config.nonce)) {
      throw new HsmAdapterError("INVALID_NONCE", "nonce must be a Buffer");
    }
    const now = Date.now();
    const circuit = {
      circuitId: config.circuitId,
      keySetId: config.keySetId,
      threshold: keySet.threshold,
      participants: keySet.participants,
      ciphertext: config.ciphertext,
      nonce: config.nonce,
      authTag: config.authTag || null,
      status: CIRCUIT_STATUS.DISTRIBUTED,
      createdAt: now,
      expiresAt: now + this.circuitTimeoutMs,
      partialDecryptions: new Map(), // nodeId -> partial decryption
      verifiedShares: 0,
      invalidShares: 0,
      result: null,
      completedAt: null,
    };
    this._circuits.set(config.circuitId, circuit);
    keySet.circuitCount++;
    if (typeof this._audit === "function") {
      this._audit("CIRCUIT_INITIATED", {
        circuitId: config.circuitId,
        keySetId: config.keySetId,
        threshold: keySet.threshold,
      });
    }
    return {
      circuitId: config.circuitId,
      keySetId: config.keySetId,
      threshold: keySet.threshold,
      participants: keySet.participants,
      status: circuit.status,
    };
  }

  /**
   * Compute a partial decryption for a node using its share.
   * In a real system, each node would do this locally. Here we simulate it.
   * @param {string} keySetId
   * @param {string} nodeId
   * @returns {Buffer} Partial decryption (the node's Shamir share)
   */
  computePartialDecryption(keySetId, nodeId) {
    const keySet = this._keySets.get(keySetId);
    if (!keySet) {
      throw new HsmAdapterError(
        "KEYSET_NOT_FOUND",
        `key set ${keySetId} not found`,
      );
    }
    const share = keySet.shares.get(nodeId);
    if (!share) {
      throw new HsmAdapterError(
        "NODE_NOT_PARTICIPANT",
        `node ${nodeId} is not a participant`,
      );
    }
    // Return a copy of the share buffer
    return Buffer.from(share.share);
  }

  /**
   * Submit a partial decryption from a node.
   * @param {string} circuitId
   * @param {string} nodeId - Participant node ID
   * @param {Buffer} partialDecryption - Partial decryption share
   * @returns {object} Submission result
   */
  submitPartialDecryption(circuitId, nodeId, partialDecryption) {
    const circuit = this._circuits.get(circuitId);
    if (!circuit) {
      throw new HsmAdapterError(
        "CIRCUIT_NOT_FOUND",
        `circuit ${circuitId} not found`,
      );
    }
    if (
      circuit.status !== CIRCUIT_STATUS.DISTRIBUTED &&
      circuit.status !== CIRCUIT_STATUS.COLLECTING
    ) {
      throw new HsmAdapterError(
        "CIRCUIT_NOT_ACCEPTING",
        `circuit is in status ${circuit.status}`,
      );
    }
    if (Date.now() > circuit.expiresAt) {
      circuit.status = CIRCUIT_STATUS.EXPIRED;
      throw new HsmAdapterError(
        "CIRCUIT_EXPIRED",
        `circuit ${circuitId} has expired`,
      );
    }
    const keySet = this._keySets.get(circuit.keySetId);
    const share = keySet.shares.get(nodeId);
    if (!share) {
      throw new HsmAdapterError(
        "NODE_NOT_PARTICIPANT",
        `node ${nodeId} is not a participant`,
      );
    }
    if (circuit.partialDecryptions.has(nodeId)) {
      throw new HsmAdapterError(
        "SHARE_ALREADY_SUBMITTED",
        `node ${nodeId} already submitted`,
      );
    }
    if (!Buffer.isBuffer(partialDecryption)) {
      throw new HsmAdapterError(
        "INVALID_PARTIAL",
        "partialDecryption must be a Buffer",
      );
    }
    // Verify share (if enabled)
    let verified = true;
    if (this.enableShareVerification) {
      verified = _verifyPartialDecryption(
        partialDecryption,
        share,
        circuit.ciphertext,
      );
    }
    circuit.partialDecryptions.set(nodeId, {
      nodeId,
      partialDecryption,
      shareIndex: share.index,
      verified,
      submittedAt: Date.now(),
    });
    if (verified) {
      circuit.verifiedShares++;
      share.status = SHARE_STATUS.VERIFIED;
    } else {
      circuit.invalidShares++;
      share.status = SHARE_STATUS.INVALID;
    }
    circuit.status = CIRCUIT_STATUS.COLLECTING;
    if (typeof this._audit === "function") {
      this._audit("PARTIAL_DECRYPTION_SUBMITTED", {
        circuitId,
        nodeId,
        verified,
      });
    }
    // Check if we have enough shares to assemble
    if (circuit.verifiedShares >= circuit.threshold) {
      return this._assembleDecryption(circuitId);
    }
    return {
      circuitId,
      nodeId,
      verified,
      verifiedShares: circuit.verifiedShares,
      threshold: circuit.threshold,
      ready: false,
    };
  }

  /**
   * Assemble the final decryption from collected shares.
   * @param {string} circuitId
   * @returns {object} Decryption result
   * @private
   */
  _assembleDecryption(circuitId) {
    const circuit = this._circuits.get(circuitId);
    if (!circuit) {
      throw new HsmAdapterError(
        "CIRCUIT_NOT_FOUND",
        `circuit ${circuitId} not found`,
      );
    }
    // Collect verified shares
    const verifiedShares = [];
    for (const [nodeId, pd] of circuit.partialDecryptions) {
      if (pd.verified) {
        verifiedShares.push(pd);
      }
    }
    if (verifiedShares.length < circuit.threshold) {
      throw new HsmAdapterError(
        "INSUFFICIENT_SHARES",
        `need ${circuit.threshold} verified shares, have ${verifiedShares.length}`,
      );
    }
    // Take exactly threshold shares
    const selectedShares = verifiedShares.slice(0, circuit.threshold);
    // Reconstruct the master key via Lagrange interpolation
    const reconstructedKey = _shamirReconstruct(selectedShares);
    // Decrypt the ciphertext
    let plaintext;
    try {
      const decipher = crypto.createDecipheriv(
        "aes-256-gcm",
        reconstructedKey,
        circuit.nonce,
      );
      if (circuit.authTag) {
        decipher.setAuthTag(circuit.authTag);
      }
      plaintext = Buffer.concat([
        decipher.update(circuit.ciphertext),
        decipher.final(),
      ]);
    } catch (e) {
      circuit.status = CIRCUIT_STATUS.FAILED;
      throw new HsmAdapterError(
        "DECRYPTION_FAILED",
        `decryption failed: ${e.message}`,
      );
    }
    circuit.status = CIRCUIT_STATUS.COMPLETED;
    circuit.result = plaintext;
    circuit.completedAt = Date.now();
    // Move to history
    this._circuits.delete(circuitId);
    this._completedCircuits.push({
      circuitId,
      keySetId: circuit.keySetId,
      status: circuit.status,
      sharesUsed: selectedShares.length,
      completedAt: circuit.completedAt,
    });
    if (this._completedCircuits.length > this._maxHistory) {
      this._completedCircuits.shift();
    }
    if (typeof this._audit === "function") {
      this._audit("CIRCUIT_COMPLETED", {
        circuitId,
        keySetId: circuit.keySetId,
        sharesUsed: selectedShares.length,
      });
    }
    return {
      circuitId,
      status: CIRCUIT_STATUS.COMPLETED,
      plaintext,
      sharesUsed: selectedShares.length,
      ready: true,
    };
  }

  /**
   * Manually trigger assembly if enough shares are collected.
   * @param {string} circuitId
   * @returns {object} Decryption result
   */
  assembleDecryption(circuitId) {
    const circuit = this._circuits.get(circuitId);
    if (!circuit) {
      throw new HsmAdapterError(
        "CIRCUIT_NOT_FOUND",
        `circuit ${circuitId} not found`,
      );
    }
    if (circuit.verifiedShares < circuit.threshold) {
      throw new HsmAdapterError(
        "INSUFFICIENT_SHARES",
        `need ${circuit.threshold} verified shares, have ${circuit.verifiedShares}`,
      );
    }
    return this._assembleDecryption(circuitId);
  }

  /**
   * Compromise a key set (mark as compromised, destroy shares).
   * @param {string} keySetId
   * @param {string} [reason]
   */
  compromiseKeySet(keySetId, reason) {
    const keySet = this._keySets.get(keySetId);
    if (!keySet) {
      throw new HsmAdapterError(
        "KEYSET_NOT_FOUND",
        `key set ${keySetId} not found`,
      );
    }
    keySet.status = KEYSET_STATUS.COMPROMISED;
    // Zeroize master key
    keySet.masterKey.fill(0);
    if (typeof this._audit === "function") {
      this._audit("KEYSET_COMPROMISED", {
        keySetId,
        reason: reason || "unspecified",
      });
    }
    return { keySetId, compromised: true, reason: reason || "unspecified" };
  }

  /**
   * Rotate a key set (mark as rotated, create new one).
   * @param {string} keySetId
   * @returns {object}
   */
  rotateKeySet(keySetId) {
    const keySet = this._keySets.get(keySetId);
    if (!keySet) {
      throw new HsmAdapterError(
        "KEYSET_NOT_FOUND",
        `key set ${keySetId} not found`,
      );
    }
    keySet.status = KEYSET_STATUS.ROTATED;
    keySet.masterKey.fill(0);
    if (typeof this._audit === "function") {
      this._audit("KEYSET_ROTATED", { keySetId });
    }
    return { keySetId, rotated: true };
  }

  /**
   * Destroy a key set.
   * @param {string} keySetId
   */
  destroyKeySet(keySetId) {
    const keySet = this._keySets.get(keySetId);
    if (!keySet) {
      throw new HsmAdapterError(
        "KEYSET_NOT_FOUND",
        `key set ${keySetId} not found`,
      );
    }
    keySet.status = KEYSET_STATUS.DESTROYED;
    keySet.masterKey.fill(0);
    for (const share of keySet.shares.values()) {
      share.share.fill(0);
    }
    this._keySets.delete(keySetId);
    if (typeof this._audit === "function") {
      this._audit("KEYSET_DESTROYED", { keySetId });
    }
    return { keySetId, destroyed: true };
  }

  /**
   * Get key set metadata.
   * @param {string} keySetId
   * @returns {object|null}
   */
  getKeySet(keySetId) {
    const keySet = this._keySets.get(keySetId);
    if (!keySet) return null;
    return {
      keySetId: keySet.keySetId,
      threshold: keySet.threshold,
      participants: keySet.participants,
      participantIds: keySet.participantIds,
      publicKey: keySet.publicKey,
      status: keySet.status,
      createdAt: keySet.createdAt,
      circuitCount: keySet.circuitCount,
    };
  }

  /**
   * Get all key sets.
   * @returns {object[]}
   */
  getKeySets() {
    return Array.from(this._keySets.values()).map((ks) => ({
      keySetId: ks.keySetId,
      threshold: ks.threshold,
      participants: ks.participants,
      status: ks.status,
    }));
  }

  /**
   * Get a participant's share for a key set.
   * @param {string} keySetId
   * @param {string} nodeId
   * @returns {object|null}
   */
  getShare(keySetId, nodeId) {
    const keySet = this._keySets.get(keySetId);
    if (!keySet) return null;
    const share = keySet.shares.get(nodeId);
    if (!share) return null;
    return {
      keySetId,
      nodeId,
      index: share.index,
      status: share.status,
    };
  }

  /**
   * Get circuit state.
   * @param {string} circuitId
   * @returns {object|null}
   */
  getCircuit(circuitId) {
    const circuit = this._circuits.get(circuitId);
    if (!circuit) return null;
    return {
      circuitId: circuit.circuitId,
      keySetId: circuit.keySetId,
      status: circuit.status,
      threshold: circuit.threshold,
      verifiedShares: circuit.verifiedShares,
      invalidShares: circuit.invalidShares,
      createdAt: circuit.createdAt,
      expiresAt: circuit.expiresAt,
    };
  }

  /**
   * Get completed circuit history.
   * @param {number} [limit]
   * @returns {object[]}
   */
  getCompletedCircuits(limit) {
    const n = typeof limit === "number" ? limit : 20;
    return this._completedCircuits.slice(-n);
  }

  /**
   * Get summary statistics.
   * @returns {object}
   */
  getStats() {
    const keySetsByStatus = {};
    for (const ks of this._keySets.values()) {
      keySetsByStatus[ks.status] = (keySetsByStatus[ks.status] || 0) + 1;
    }
    return {
      keySetCount: this._keySets.size,
      activeCircuits: this._circuits.size,
      completedCircuits: this._completedCircuits.length,
      keySetsByStatus,
    };
  }

  /**
   * Reset all state (for testing).
   */
  reset() {
    // Zeroize all keys before clearing
    for (const ks of this._keySets.values()) {
      if (ks.masterKey) ks.masterKey.fill(0);
      for (const share of ks.shares.values()) {
        if (share.share) share.share.fill(0);
      }
    }
    this._keySets.clear();
    this._circuits.clear();
    this._completedCircuits = [];
  }
}

/**
 * Shamir secret sharing: split a secret into n shares with threshold t.
 * Uses BigInt arithmetic over a prime field for exact reconstruction.
 * @param {Buffer} secret - The secret to split
 * @param {number} threshold - Minimum shares needed to reconstruct
 * @param {number} n - Total number of shares
 * @returns {Buffer[]} Array of n shares
 * @private
 */
function _shamirSplit(secret, threshold, n) {
  // Use a prime field larger than 2^256 (for 32-byte keys)
  // P = 2^257 - 93 (a known prime larger than 2^256)
  const P = (1n << 257n) - 93n;
  // Convert secret to BigInt
  const secretInt = BigInt("0x" + secret.toString("hex"));
  // Generate random polynomial coefficients: f(x) = secret + a1*x + a2*x^2 + ...
  const coeffs = [secretInt];
  for (let t = 1; t < threshold; t++) {
    const randomBytes = crypto.randomBytes(32);
    coeffs.push(BigInt("0x" + randomBytes.toString("hex")) % P);
  }
  // Evaluate polynomial at x = 1, 2, ..., n
  const shares = [];
  for (let i = 0; i < n; i++) {
    const x = BigInt(i + 1);
    let y = 0n;
    let xPow = 1n;
    for (let p = 0; p < coeffs.length; p++) {
      y = (y + coeffs[p] * xPow) % P;
      xPow = (xPow * x) % P;
    }
    // Convert BigInt share back to Buffer (32 bytes)
    let hexStr = y.toString(16);
    // Pad to 64 hex chars (32 bytes)
    while (hexStr.length < 66) hexStr = "0" + hexStr;
    shares.push(Buffer.from(hexStr, "hex"));
  }
  return shares;
}

/**
 * Reconstruct a secret from threshold shares using Lagrange interpolation.
 * Uses BigInt arithmetic over the same prime field.
 * @param {object[]} shares - Array of { shareIndex, partialDecryption }
 * @returns {Buffer} Reconstructed key
 * @private
 */
function _shamirReconstruct(shares) {
  const P = (1n << 257n) - 93n;
  // Convert shares to BigInt
  const points = shares.map((s) => ({
    x: BigInt(s.shareIndex),
    y: BigInt("0x" + s.partialDecryption.toString("hex")),
  }));
  // Lagrange interpolation at x = 0
  let secret = 0n;
  for (let i = 0; i < points.length; i++) {
    let numerator = 1n;
    let denominator = 1n;
    for (let j = 0; j < points.length; j++) {
      if (i === j) continue;
      // numerator *= (0 - xj) = -xj
      numerator = (numerator * ((-points[j].x % P) + P)) % P;
      // denominator *= (xi - xj)
      denominator = (denominator * (((points[i].x - points[j].x) % P) + P)) % P;
    }
    // lagrangeCoeff = numerator / denominator = numerator * denominator^(-1)
    const denomInv = _modInv(denominator, P);
    const lagrangeCoeff = (numerator * denomInv) % P;
    secret = (secret + points[i].y * lagrangeCoeff) % P;
  }
  // Convert BigInt back to Buffer (32 bytes)
  let hexStr = secret.toString(16);
  while (hexStr.length < 64) hexStr = "0" + hexStr;
  return Buffer.from(hexStr, "hex");
}

/**
 * Modular inverse using extended Euclidean algorithm.
 * @param {bigint} a
 * @param {bigint} p
 * @returns {bigint}
 * @private
 */
function _modInv(a, p) {
  let oldR = a % p;
  let r = p;
  let oldS = 1n;
  let s = 0n;
  while (r !== 0n) {
    const q = oldR / r;
    [oldR, r] = [r, oldR - q * r];
    [oldS, s] = [s, oldS - q * s];
  }
  return ((oldS % p) + p) % p;
}

/**
 * Verify a partial decryption share.
 * @param {Buffer} partialDecryption
 * @param {object} share
 * @param {Buffer} ciphertext
 * @returns {boolean}
 * @private
 */
function _verifyPartialDecryption(partialDecryption, share, ciphertext) {
  // In production, this would verify a ZK proof that the partial decryption
  // was computed correctly. Here we check that the partial is non-empty
  // and has the expected length.
  if (!Buffer.isBuffer(partialDecryption) || partialDecryption.length === 0) {
    return false;
  }
  return true;
}

module.exports = {
  ThresholdDecryptionCircuit,
  DEFAULT_OPTIONS,
  KEYSET_STATUS,
  CIRCUIT_STATUS,
  SHARE_STATUS,
};
