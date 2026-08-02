'use strict';

/**
 * Track 42: Group reshard engine.
 *
 * Computes Lagrangian coefficient vectors for threshold share
 * expansion and contraction. Integrates with the enclave attestation
 * client to require attestation before admitting new nodes.
 *
 * @module hsm-adapter/group-reshard-engine
 */

const { HsmAdapterError } = require('./base-adapter.cjs');
const { secureZeroize } = require('./secure-zeroize.cjs');

class GroupReshardEngine {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {object[]} [options.nodes]
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this.nodes = options.nodes || [];
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
    this._prime = _bigPrime();
  }

  /**
   * Initiate resharding from one threshold window to another.
   * @param {number} oldThreshold
   * @param {number} oldSize
   * @param {number} newThreshold
   * @param {number} newSize
   * @param {string[]} newNodeIds
   * @returns {object}
   */
  reshard(oldThreshold, oldSize, newThreshold, newSize, newNodeIds = []) {
    _assertAllowedWindow(this.policy, newThreshold, newSize);
    _assertSizeBound(this.policy, newSize);
    _assertExpansionFactor(this.policy, oldSize, newSize);

    const existing = this.nodes.map((n) => n.id);
    for (const id of newNodeIds) {
      if (existing.includes(id)) continue;
      if (this.policy.requireNewNodeAttestation && this._attestationClient) {
        if (!this._attestationClient.isVerified(id)) {
          throw new HsmAdapterError('RESHARDING_UNATTESTED_NODE', `node ${id} has not been attested`);
        }
      }
    }

    if (this._audit) {
      this._audit('COMMITTEE_RESHARDING_INITIATED', {
        oldThreshold,
        oldSize,
        newThreshold,
        newSize,
        newNodes: newNodeIds,
      });
    }

    const newShares = this._interpolateShares(oldThreshold, oldSize, newThreshold, newSize);
    const result = {
      newThreshold,
      newSize,
      newShares,
      coefficients: _computeLagrangeCoefficients(this.nodes, oldSize),
    };
    _zeroizeTransient(newShares);
    return result;
  }

  /**
   * Expand a committee by generating new additive shares that preserve the secret.
   * @param {number} threshold
   * @param {number} oldSize
   * @param {number} newSize
   * @returns {object}
   */
  expand(threshold, oldSize, newSize) {
    return this.reshard(threshold, oldSize, threshold, newSize, []);
  }

  /**
   * Contract a committee by dropping excess shares and keeping the threshold.
   * @param {number} threshold
   * @param {number} oldSize
   * @param {number} newSize
   * @returns {object}
   */
  contract(threshold, oldSize, newSize) {
    return this.reshard(threshold, oldSize, threshold, newSize, []);
  }

  _interpolateShares(oldThreshold, oldSize, newThreshold, newSize) {
    const coeffs = _computeLagrangeCoefficients(this.nodes, oldSize);
    const shares = [];
    for (let i = 0; i < newSize; i += 1) {
      shares.push({
        index: i + 1,
        value: _deriveShareForIndex(this.nodes, coeffs, i + 1),
      });
    }
    return shares;
  }
}

function _bigPrime() {
  // Large safe 64-bit prime for field arithmetic demonstrations.
  return 170141183460469231731687303715884105727n;
}

function _assertAllowedWindow(policy, threshold, size) {
  const windows = policy.allowedThresholdWindows || [];
  const ok = windows.some(([t, c]) => t === threshold && c === size);
  if (!ok) {
    throw new HsmAdapterError('RESHARDING_WINDOW_BLOCKED', `window ${threshold}-of-${size} is not allowed`);
  }
}

function _assertSizeBound(policy, size) {
  if (size > (policy.maxCommitteeSize || Infinity)) {
    throw new HsmAdapterError('RESHARDING_SIZE_BLOCKED', `committee size ${size} exceeds maximum ${policy.maxCommitteeSize}`);
  }
}

function _assertExpansionFactor(policy, oldSize, newSize) {
  const factor = newSize / oldSize;
  if (factor > (policy.maxCommitteeExpansionFactor || Infinity)) {
    throw new HsmAdapterError('RESHARDING_EXPANSION_BLOCKED', `expansion factor ${factor} exceeds maximum ${policy.maxCommitteeExpansionFactor}`);
  }
}

function _computeLagrangeCoefficients(nodes, total) {
  const p = _bigPrime();
  const coeffs = [];
  for (let i = 0; i < total; i += 1) {
    let num = 1n;
    let den = 1n;
    const xi = BigInt(i + 1);
    for (let j = 0; j < total; j += 1) {
      if (i === j) continue;
      const xj = BigInt(j + 1);
      num = (num * (p - xj)) % p;
      den = (den * (xi - xj + p)) % p;
    }
    const invDen = _modInverse(den, p);
    coeffs.push(Number((num * invDen) % p));
  }
  return coeffs;
}

function _deriveShareForIndex(nodes, coeffs, index) {
  if (nodes.length === 0) return index;
  const p = _bigPrime();
  let acc = 0n;
  for (let i = 0; i < nodes.length; i += 1) {
    const value = typeof nodes[i].share === 'bigint' ? nodes[i].share : BigInt(nodes[i].share || 1);
    const basis = _lagrangeBasis(i + 1, index);
    acc = (acc + (value * basis % p)) % p;
  }
  return Number(acc);
}

function _lagrangeBasis(sourceIndex, targetIndex) {
  const p = _bigPrime();
  let num = 1n;
  let den = 1n;
  for (let j = 0; j < 5; j += 1) {
    if (j + 1 === sourceIndex) continue;
    const xj = BigInt(j + 1);
    num = (num * (BigInt(targetIndex) - xj + p)) % p;
    den = (den * (BigInt(sourceIndex) - xj + p)) % p;
  }
  return (num * _modInverse(den, p)) % p;
}

function _modInverse(a, m) {
  let t = 0n;
  let newT = 1n;
  let r = m;
  let newR = a % m;
  while (newR !== 0n) {
    const q = r / newR;
    [t, newT] = [newT, t - q * newT];
    [r, newR] = [newR, r - q * newR];
  }
  if (r > 1n) throw new HsmAdapterError('MATH_ERROR', 'value is not invertible');
  if (t < 0n) t += m;
  return t;
}

function _zeroizeTransient(shares) {
  for (const share of shares) {
    if (Buffer.isBuffer(share.value)) {
      secureZeroize(share.value);
    } else if (typeof share.value === 'number') {
      share.value = 0;
    }
  }
}

module.exports = { GroupReshardEngine };
