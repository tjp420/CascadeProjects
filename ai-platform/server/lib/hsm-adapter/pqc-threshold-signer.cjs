'use strict';

/**
 * Track 27: Post-Quantum Threshold Signature signer.
 *
 * Simulates a PQC threshold partial signature using a node's DKG-derived
 * secret share. Each partial signature is bound to the message, node id,
 * and public commitment so the aggregator can verify share integrity.
 *
 * @module hsm-adapter/pqc-threshold-signer
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// Small prime-order subgroup for commitment verification: p=11, g=3, q=5.
const DEFAULT_PRIME = 11n;
const DEFAULT_GENERATOR = 3n;
const DEFAULT_SUBGROUP_ORDER = 5n;

function _hashBigInt(inputs) {
  const h = crypto.createHash('sha256');
  for (const item of inputs) {
    h.update(typeof item === 'string' ? item : item.toString());
  }
  return BigInt('0x' + h.digest('hex').slice(0, 16)) % DEFAULT_SUBGROUP_ORDER;
}

function _modExp(base, exp, mod) {
  let result = 1n % mod;
  let b = base % mod;
  let e = exp;
  while (e > 0n) {
    if (e % 2n === 1n) result = (result * b) % mod;
    b = (b * b) % mod;
    e = e / 2n;
  }
  return result;
}

class PqcThresholdSigner {
  /**
   * @param {object} options
   * @param {number} options.nodeId
   * @param {string} options.scheme - e.g. 'ml-dsa-65', 'fn-dsa-512'
   * @param {BigInt} options.secretShare - DKG-derived group secret share
   * @param {BigInt} [options.publicCommitment] - g^secretShare mod p
   * @param {BigInt} [options.prime]
   * @param {BigInt} [options.generator]
   */
  constructor(options = {}) {
    this.nodeId = options.nodeId;
    this.scheme = options.scheme;
    this._secretShare = options.secretShare;
    this._publicCommitment = options.publicCommitment || _modExp(options.generator || DEFAULT_GENERATOR, this._secretShare % DEFAULT_SUBGROUP_ORDER, options.prime || DEFAULT_PRIME);
    this._prime = options.prime || DEFAULT_PRIME;
    this._generator = options.generator || DEFAULT_GENERATOR;
  }

  /**
   * Produce a partial signature on a message.
   * @param {string|Buffer} message
   * @returns {{nodeId: number, scheme: string, challenge: BigInt, response: BigInt, commitment: BigInt}}
   */
  sign(message) {
    if (!message) {
      throw new HsmAdapterError('INVALID_INPUT', 'message is required');
    }
    const msg = typeof message === 'string' ? message : message.toString('hex');
    const challenge = _hashBigInt([msg, this.nodeId, this.scheme]);
    // response = challenge * secretShare (mod subgroup order) for simple Schnorr-like relation
    const response = (challenge * this._secretShare) % DEFAULT_SUBGROUP_ORDER;
    return {
      nodeId: this.nodeId,
      scheme: this.scheme,
      challenge,
      response,
      commitment: this._publicCommitment,
    };
  }

  /**
   * Verify a partial signature against a public commitment.
   * @param {object} partial
   * @param {string|Buffer} message
   * @returns {boolean}
   */
  static verifyPartial(partial, message) {
    if (!partial || !partial.commitment) {
      throw new HsmAdapterError('INVALID_INPUT', 'partial and commitment are required');
    }
    const msg = typeof message === 'string' ? message : message.toString('hex');
    const challenge = _hashBigInt([msg, partial.nodeId, partial.scheme]);
    if (challenge !== partial.challenge) {
      return false;
    }
    // g^response == commitment^challenge (mod prime)
    const left = _modExp(DEFAULT_GENERATOR, partial.response, DEFAULT_PRIME);
    const right = _modExp(partial.commitment, challenge, DEFAULT_PRIME);
    return left === right;
  }
}

module.exports = { PqcThresholdSigner };
