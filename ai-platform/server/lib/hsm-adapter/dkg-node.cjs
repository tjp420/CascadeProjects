'use strict';

/**
 * Track 26: Distributed Key Generation (DKG) node.
 *
 * Implements a joint-Feldman verifiable secret sharing primitive. Each node
 * generates a random polynomial of degree t over a prime-order subgroup, evaluates
 * shares for every participant, and broadcasts public commitments to its coefficients.
 *
 * @module hsm-adapter/dkg-node
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');

// A small safe prime for unit testing: p = 11, q = 5, generator = 3.
const DEFAULT_PRIME = 11n;
const DEFAULT_SUBGROUP_ORDER = 5n;
const DEFAULT_GENERATOR = 3n;

function _randomFieldScalar(order) {
  const bytes = Math.ceil(order.toString(2).length / 8) + 8;
  for (;;) {
    const hex = crypto.randomBytes(bytes).toString('hex');
    const value = BigInt('0x' + hex) % order;
    if (value >= 0n) return value;
  }
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

function _evaluatePolynomial(coefficients, x, order) {
  let result = 0n;
  let power = 1n;
  const xBig = BigInt(x);
  for (const c of coefficients) {
    result = (result + c * power) % order;
    power = (power * xBig) % order;
  }
  return result;
}

class DkgNode {
  /**
   * @param {object} options
   * @param {number} options.nodeId - 1-based participant index
   * @param {BigInt} [options.prime] - large prime finite field modulus
   * @param {BigInt} [options.subgroupOrder] - order of the subgroup used for secrets
   * @param {BigInt} [options.generator] - subgroup generator for commitments
   * @param {Function} [options.audit] - (event, info) => void
   */
  constructor(options = {}) {
    this.nodeId = options.nodeId;
    if (!Number.isInteger(this.nodeId) || this.nodeId < 1) {
      throw new HsmAdapterError('INVALID_INPUT', 'nodeId must be a positive integer');
    }
    this._prime = options.prime || DEFAULT_PRIME;
    this._subgroupOrder = options.subgroupOrder || DEFAULT_SUBGROUP_ORDER;
    this._generator = options.generator || DEFAULT_GENERATOR;
    this._audit = options.audit || null;
    this._coefficients = [];
    this._commitments = [];
    this._shares = [];
  }

  /**
   * Generate a random polynomial of the requested degree. The constant term is
   * the node\'s secret contribution to the group master secret.
   * @param {number} degree
   * @returns {BigInt[]} polynomial coefficients [a0, a1, ..., at]
   */
  generatePolynomial(degree) {
    if (!Number.isInteger(degree) || degree < 1) {
      throw new HsmAdapterError('INVALID_INPUT', 'polynomial degree must be at least 1');
    }
    this._coefficients = [];
    for (let i = 0; i <= degree; i += 1) {
      this._coefficients.push(_randomFieldScalar(this._subgroupOrder));
    }
    this._commitments = this._coefficients.map((c) => _modExp(this._generator, c, this._prime));
    return this._coefficients;
  }

  /**
   * Compute a secret share for every participant.
   * @param {number[]} participantIds
   * @returns {Array<{recipientId: number, value: BigInt}>}
   */
  computeSharesFor(participantIds) {
    if (this._coefficients.length === 0) {
      throw new HsmAdapterError('DKG_NOT_INITIALIZED', 'polynomial not generated');
    }
    this._shares = participantIds.map((id) => ({
      recipientId: id,
      value: _evaluatePolynomial(this._coefficients, id, this._subgroupOrder),
    }));
    return this._shares;
  }

  /**
   * Feldman public commitments to the polynomial coefficients.
   * @returns {BigInt[]}
   */
  getCommitments() {
    return this._commitments;
  }

  /**
   * Verify a received share against the sender\'s commitments using
   * g^share == product(C_j^{recipientId^j}) mod p.
   * @param {BigInt} share
   * @param {number} recipientId
   * @param {BigInt[]} commitments
   * @returns {boolean}
   */
  verifyShare(share, recipientId, commitments) {
    const x = BigInt(recipientId);
    const left = _modExp(this._generator, share % this._subgroupOrder, this._prime);
    let right = 1n;
    let power = 1n;
    for (const c of commitments) {
      right = (right * _modExp(c, power, this._prime)) % this._prime;
      power = (power * x) % this._subgroupOrder;
    }
    return left === right;
  }

  /**
   * Build the node\'s final group share by summing all verified shares.
   * @param {BigInt[]} verifiedShares
   * @returns {BigInt}
   */
  aggregateGroupShare(verifiedShares) {
    return verifiedShares.reduce((sum, s) => (sum + s) % this._subgroupOrder, 0n);
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { nodeId: this.nodeId, timestamp: Date.now(), ...info });
  }
}

module.exports = { DkgNode };
