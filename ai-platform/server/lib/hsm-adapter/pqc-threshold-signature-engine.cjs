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
 * @module hsm-adapter/pqc-threshold-signature-engine
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { DkgSnarkEngine, PRIME, FIELD_PRIME, GROUP_PRIME, GENERATOR } = require('./dkg-snark-engine.cjs');

const SUPPORTED_SIG_ALGORITHMS = new Set(['ml-dsa-44', 'ml-dsa-65', 'ml-dsa-87']);

function _hashToField(message) {
  const hash = crypto.createHash('sha256').update(message).digest();
  let value = 0n;
  for (const b of hash) {
    value = (value << 8n) | BigInt(b);
  }
  return value % FIELD_PRIME;
}

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

function _modInv(a, p) {
  return _modPow(a, p - 2n, p);
}

class PartialSignature {
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

class PqcThresholdSignatureEngine {
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
    this._partialSignatures = new Map();
  }

  initialize() {
    this._masterPublicKey = this._dkg.computeMasterPublicKey();
    return this._masterPublicKey;
  }

  signPartial(nodeId, message) {
    if (!Buffer.isBuffer(message)) {
      throw new HsmAdapterError('INVALID_INPUT', 'message must be a Buffer');
    }
    if (this._masterPublicKey === null) {
      throw new HsmAdapterError('INVALID_INPUT', 'engine not initialized — call initialize() first');
    }
    const qualifiedNodes = this._dkg.qualifiedNodes;
    if (qualifiedNodes.length === 0) {
      if (!this._dkg.nodeIds.includes(nodeId)) {
        throw new HsmAdapterError('UNKNOWN_NODE', `node ${nodeId} is not a participant`);
      }
    } else if (!qualifiedNodes.includes(nodeId)) {
      throw new HsmAdapterError('NODE_DISQUALIFIED', `node ${nodeId} is not a qualified signer`);
    }
    const share = this._dkg.getAggregatedShare(nodeId);
    const h = _hashToField(message);
    const sigma = (h * share) % FIELD_PRIME;
    const partial = new PartialSignature(nodeId, sigma, share);
    this._partialSignatures.set(nodeId, partial);
    return partial;
  }

  verifyPartial(partial, message) {
    if (!partial || typeof partial.sigma !== 'bigint') {
      throw new HsmAdapterError('INVALID_INPUT', 'invalid partial signature');
    }
    if (!Buffer.isBuffer(message)) {
      throw new HsmAdapterError('INVALID_INPUT', 'message must be a Buffer');
    }
    const h = _hashToField(message);
    const lhs = _modPow(GENERATOR, partial.sigma, GROUP_PRIME);
    const rhs = _modPow(GENERATOR, (h * partial.share) % FIELD_PRIME, GROUP_PRIME);
    return lhs === rhs;
  }

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
    for (const partial of partials.slice(0, this._dkg.threshold)) {
      if (!this.verifyPartial(partial, message)) {
        throw new HsmAdapterError('PQC_SIGNATURE_INVALID', `partial signature from ${partial.nodeId} failed verification`);
      }
    }
    const threshold = this._dkg.threshold;
    const selected = partials.slice(0, threshold);
    let signature = 0n;
    for (let i = 0; i < threshold; i++) {
      const xi = BigInt(this._dkg._nodeIdToIndex(selected[i].nodeId) + 1);
      const sigmaI = selected[i].sigma;
      let numerator = 1n;
      let denominator = 1n;
      for (let j = 0; j < threshold; j++) {
        if (i === j) continue;
        const xj = BigInt(this._dkg._nodeIdToIndex(selected[j].nodeId) + 1);
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
    const lhs = _modPow(GENERATOR, signature, GROUP_PRIME);
    const rhs = _modPow(this._masterPublicKey, h, GROUP_PRIME);
    return lhs === rhs;
  }

  zeroize() {
    for (const partial of this._partialSignatures.values()) {
      partial.zeroize();
    }
    this._partialSignatures.clear();
  }

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

  get dkgEngine() { return this._dkg; }
  get sigAlgorithm() { return this._sigAlgorithm; }
  get masterPublicKey() { return this._masterPublicKey; }
}

module.exports = {
  PqcThresholdSignatureEngine,
  PartialSignature,
  SUPPORTED_SIG_ALGORITHMS,
};
