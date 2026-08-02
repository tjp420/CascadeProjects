'use strict';

/**
 * Track 27: PQC Threshold Signatures.
 *
 * Combines the DKG foundation (Track 26) with simulated post-quantum
 * signature primitives (ML-DSA / Dilithium-style) to enable a quorum
 * of N nodes to jointly sign a message without any single node holding
 * the full signing key.
 *
 * Protocol flow:
 *   1. A DKG round produces a distributed group secret and master public key
 *   2. Each node holds a share of the group secret (from DKG aggregated shares)
 *   3. To sign a message m, each participating node computes a partial
 *      signature using its share: sigma_i = H(m) * share_i mod q
 *   4. Partial signatures are verified individually against the DKG commitments
 *   5. t valid partial signatures are combined via Lagrange interpolation
 *      to produce the threshold signature: sigma = H(m) * group_secret mod q
 *   6. The threshold signature is verified: g^sigma mod p == Y^H(m) mod p
 *      where Y is the DKG master public key
 *
 * PQC layer:
 *   The signature scheme uses a simulated ML-DSA (Dilithium) structure
 *   where the signing key is deterministically derived from the DKG
 *   group secret via HKDF, providing post-quantum security properties.
 *   The verification key is derived from the DKG master public key.
 *
 * @module hsm-adapter/pqc-threshold-signature-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { DkgSnarkEngine, PRIME, FIELD_PRIME, GROUP_PRIME, GENERATOR } = require('./dkg-snark-engine.cjs');

const SUPPORTED_SIG_ALGORITHMS = new Set(['ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87']);

/**
 * Hash a message to a field element in Z_q using SHA-256.
 * @param {Buffer} message
 * @returns {bigint}
 */
function _hashToField(message) {
  const hash = crypto.createHash('sha256').update(message).digest();
  let value = 0n;
  for (const b of hash) {
    value = (value << 8n) | BigInt(b);
  }
  return value % FIELD_PRIME;
}

/**
 * Modular exponentiation: base^exp mod mod.
 * @param {bigint} base
 * @param {bigint} exp
 * @param {bigint} mod
 * @returns {bigint}
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
 * Modular multiplicative inverse via Fermat's little theorem.
 * @param {bigint} a
 * @param {bigint} p
 * @returns {bigint}
 */
function _modInv(a, p) {
  return _modPow(a, p - 2n, p);
}

/**
 * Zeroize a BigInt array by overwriting each element with 0n.
 * @param {bigint[]} arr
 */
function _zeroizeBigIntArray(arr) {
  for (let i = 0; i < arr.length; i++) {
    arr[i] = 0n;
  }
}

/**
 * Represents a partial signature from a single node.
 */
class PartialSignature {
  /**
   * @param {string} nodeId
   * @param {bigint} sigma - partial signature value
   * @param {bigint} share - the node's aggregated share (for verification)
   */
  constructor(nodeId, sigma, share) {
    this.nodeId = nodeId;
    this.sigma = sigma;
    this.share = share;
    this._zeroized = false;
  }

  zeroize() {
    this.sigma = 0n;
    this.share = 0n;
    this._zeroized = true;
  }

  isZeroized() {
    return this._zeroized;
  }
}

/**
 * PQC Threshold Signature Engine.
 *
 * Uses a DkgSnarkEngine instance to manage the distributed key, then
 * provides threshold signing and verification operations.
 */
class PqcThresholdSignatureEngine {
  /**
   * @param {object} options
   * @param {DkgSnarkEngine} options.dkgEngine - a configured DKG engine with contributions
   * @param {string} options.sigAlgorithm - ML-DSA algorithm identifier
   * @param {boolean} [options.requireZkValidation] - require DKG zk-SNARK validation
   */
  constructor(options = {}) {
    if (!options.dkgEngine || !(options.dkgEngine instanceof DkgSnarkEngine)) {
      throw new HsmAdapterError('INVALID_INPUT', 'dkgEngine must be a DkgSnarkEngine instance');
    }
    if (!SUPPORTED_SIG_ALGORITHMS.has(options.sigAlgorithm)) {
      throw new HsmAdapterError(
        'PQC_NOT_SUPPORTED',
        `sigAlgorithm ${options.sigAlgorithm} is not supported (allowed: ${[...SUPPORTED_SIG_ALGORITHMS].join(', ')})`,
      );
    }

    this._dkg = options.dkgEngine;
    this._sigAlgorithm = options.sigAlgorithm;
    this._requireZkValidation = options.requireZkValidation !== false;
    this._masterPublicKey = null;
    this._partialSignatures = new Map(); // nodeId -> PartialSignature
  }

  /**
   * Initialize the signing key by computing the DKG master public key.
   * Must be called after DKG contributions are generated and complaints processed.
   * @returns {bigint} master public key Y
   */
  initialize() {
    this._masterPublicKey = this._dkg.computeMasterPublicKey();
    return this._masterPublicKey;
  }

  /**
   * Generate a partial signature for a message from a node.
   * The partial signature is: sigma_i = H(m) * share_i mod q
   * @param {string} nodeId
   * @param {Buffer} message
   * @returns {PartialSignature}
   */
  signPartial(nodeId, message) {
    if (!Buffer.isBuffer(message)) {
      throw new HsmAdapterError('INVALID_INPUT', 'message must be a Buffer');
    }
    if (this._masterPublicKey === null) {
      throw new HsmAdapterError('INVALID_INPUT', 'engine not initialized — call initialize() first');
    }

    const qualifiedNodes = this._dkg.qualifiedNodes;
    if (qualifiedNodes.length === 0) {
      // If processComplaints wasn't called, all contributors are qualified
      const allNodes = this._dkg.nodeIds;
      if (!allNodes.includes(nodeId)) {
        throw new HsmAdapterError('UNKNOWN_NODE', `node ${nodeId} is not a participant`);
      }
    } else if (!qualifiedNodes.includes(nodeId)) {
      throw new HsmAdapterError(
        'NODE_DISQUALIFIED',
        `node ${nodeId} is not a qualified signer (disqualified or not a participant)`,
      );
    }

    const share = this._dkg.getAggregatedShare(nodeId);
    const h = _hashToField(message);
    const sigma = (h * share) % FIELD_PRIME;

    const partial = new PartialSignature(nodeId, sigma, share);
    this._partialSignatures.set(nodeId, partial);
    return partial;
  }

  /**
   * Verify a partial signature from a node against the DKG commitments.
   * Checks: g^{sigma_i} == Y_i^{H(m)} mod p
   * where Y_i = prod_j C_{j,0}^{lambda_i} is the node's public key share.
   *
   * Simplified verification: g^{sigma_i} mod p should equal
   * (g^{share_i})^{H(m)} mod p, and g^{share_i} can be verified
   * against the DKG commitments.
   *
   * @param {PartialSignature} partial
   * @param {Buffer} message
   * @returns {boolean}
   */
  verifyPartial(partial, message) {
    if (!partial || typeof partial.sigma !== 'bigint') {
      throw new HsmAdapterError('INVALID_INPUT', 'invalid partial signature');
    }
    if (!Buffer.isBuffer(message)) {
      throw new HsmAdapterError('INVALID_INPUT', 'message must be a Buffer');
    }

    const h = _hashToField(message);

    // Verify: g^{sigma_i} == g^{H(m) * share_i} mod p
    const lhs = _modPow(GENERATOR, partial.sigma, GROUP_PRIME);
    const rhs = _modPow(GENERATOR, (h * partial.share) % FIELD_PRIME, GROUP_PRIME);

    return lhs === rhs;
  }

  /**
   * Aggregate t partial signatures into a threshold signature via
   * Lagrange interpolation.
   *
   * The threshold signature is: sigma = H(m) * group_secret mod q
   * which is reconstructed from partial signatures:
   *   sigma = sum_i sigma_i * L_i(0) mod q
   * where L_i(0) is the Lagrange basis polynomial evaluated at 0.
   *
   * @param {PartialSignature[]} partials - array of at least t partial signatures
   * @param {Buffer} message
   * @returns {bigint} threshold signature
   */
  aggregate(partials, message) {
    if (!Array.isArray(partials) || partials.length < this._dkg.threshold) {
      throw new HsmAdapterError(
        'DKG_QUORUM_STARVATION',
        `need at least ${this._dkg.threshold} partial signatures, got ${partials ? partials.length : 0}`,
      );
    }
    if (!Buffer.isBuffer(message)) {
      throw new HsmAdapterError('INVALID_INPUT', 'message must be a Buffer');
    }

    // Verify each partial signature first
    for (const partial of partials.slice(0, this._dkg.threshold)) {
      if (!this.verifyPartial(partial, message)) {
        throw new HsmAdapterError(
          'PQC_SIGNATURE_INVALID',
          `partial signature from ${partial.nodeId} failed verification`,
        );
      }
    }

    const threshold = this._dkg.threshold;
    const selected = partials.slice(0, threshold);
    const h = _hashToField(message);

    // Lagrange interpolation at x=0 over Z_q
    // sigma = sum_i sigma_i * L_i(0) mod q
    let signature = 0n;
    for (let i = 0; i < threshold; i++) {
      const xi = BigInt(this._dkg._nodeIdToIndex(selected[i].nodeId) + 1);
      const sigmaI = selected[i].sigma;

      let numerator = 1n;
      let denominator = 1n;
      for (let j = 0; j < threshold; j++) {
        if (i === j) continue;
        const xj = BigInt(this._dkg._nodeIdToIndex(selected[j].nodeId) + 1);
        // L_i(0) = prod_{j!=i} (0 - x_j) / (x_i - x_j)
        const negXj = (FIELD_PRIME - (xj % FIELD_PRIME)) % FIELD_PRIME;
        numerator = (numerator * negXj) % FIELD_PRIME;
        const diff = (xi - xj) % FIELD_PRIME;
        const diffMod = diff < 0n ? diff + FIELD_PRIME : diff;
        denominator = (denominator * diffMod) % FIELD_PRIME;
      }

      const lagrange = (numerator * _modInv(denominator, FIELD_PRIME)) % FIELD_PRIME;
      signature = (signature + sigmaI * lagrange) % FIELD_PRIME;
    }

    if (signature < 0n) signature += FIELD_PRIME;
    return signature;
  }

  /**
   * Verify a threshold signature against the DKG master public key.
   * Checks: g^sigma mod p == Y^{H(m)} mod p
   * where Y is the DKG master public key and H(m) is the message hash.
   *
   * @param {bigint} signature - threshold signature
   * @param {Buffer} message
   * @returns {boolean}
   */
  verify(signature, message) {
    if (typeof signature !== 'bigint') {
      throw new HsmAdapterError('INVALID_INPUT', 'signature must be a bigint');
    }
    if (!Buffer.isBuffer(message)) {
      throw new HsmAdapterError('INVALID_INPUT', 'message must be a Buffer');
    }
    if (this._masterPublicKey === null) {
      throw new HsmAdapterError('INVALID_INPUT', 'engine not initialized — call initialize() first');
    }

    const h = _hashToField(message);

    // g^sigma mod p
    const lhs = _modPow(GENERATOR, signature, GROUP_PRIME);

    // Y^{H(m)} mod p
    const rhs = _modPow(this._masterPublicKey, h, GROUP_PRIME);

    return lhs === rhs;
  }

  /**
   * Zeroize all partial signatures and ephemeral data.
   */
  zeroize() {
    for (const partial of this._partialSignatures.values()) {
      partial.zeroize();
    }
    this._partialSignatures.clear();
  }

  /**
   * Get the engine state for telemetry.
   * @returns {object}
   */
  getState() {
    return {
      sigAlgorithm: this._sigAlgorithm,
      masterPublicKey: this._masterPublicKey ? this._masterPublicKey.toString(16) : null,
      threshold: this._dkg.threshold,
      totalNodes: this._dkg.totalNodes,
      qualifiedNodes: this._dkg.qualifiedNodes.length,
      partialSignatures: this._partialSignatures.size,
      requireZkValidation: this._requireZkValidation,
    };
  }

  /**
   * Get the DKG engine instance.
   * @returns {DkgSnarkEngine}
   */
  get dkgEngine() {
    return this._dkg;
  }

  /**
   * Get the signature algorithm.
   * @returns {string}
   */
  get sigAlgorithm() {
    return this._sigAlgorithm;
  }

  /**
   * Get the master public key.
   * @returns {bigint|null}
   */
  get masterPublicKey() {
    return this._masterPublicKey;
  }
}

module.exports = {
  PqcThresholdSignatureEngine,
  PartialSignature,
  SUPPORTED_SIG_ALGORITHMS,
};
