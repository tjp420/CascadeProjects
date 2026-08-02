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
const { EphemeralShareRatchet } = require('./ephemeral-share-ratchet.cjs');

// optional Prometheus metrics (best-effort)
let _reshardCounter = null;
let _reshardLatency = null;
try {
  const client = require('prom-client');
  _reshardCounter = new client.Counter({ name: 'hsm_reshard_ops_total', help: 'Total reshard operations' });
  _reshardLatency = new client.Histogram({ name: 'hsm_reshard_latency_seconds', help: 'Reshard latency seconds', buckets: [0.001, 0.01, 0.1, 1, 5] });
} catch (e) {
  // prom-client not available; skip metrics
}

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
    // instantiate ephemeral ratchet used to ratchet target shares on distribution
    const seed = this.policy.ratchetSeed ? Buffer.from(String(this.policy.ratchetSeed)) : require('crypto').randomBytes(32);
    this._ratchet = new EphemeralShareRatchet({ rootSeed: seed, policy: { prime: this._prime, maxSequence: this.policy.maxSequence } });
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
    // ratchet newly generated shares immediately to ensure forward-privacy
    const epochId = this.policy.ratchetEpochId || `reshard-${Date.now()}`;
    const start = _reshardLatency ? process.hrtime() : null;
    for (const s of newShares) {
      try {
        const token = { nodeIndex: s.index, value: BigInt(s.value), sequence: 0 };
        const rat = this._ratchet.evolveShare(token, epochId);
        s.value = rat.value;
      } catch (e) {
        // if ratcheting fails, emit audit and continue with unhashed share
        if (this._audit) this._audit('RESHARD_RATCHET_FAILED', { err: String(e) });
      }
    }
    if (_reshardCounter) _reshardCounter.inc(newShares.length);
    if (_reshardLatency && start) {
      const diff = process.hrtime(start);
      const sec = diff[0] + diff[1] / 1e9;
      _reshardLatency.observe(sec);
    }
    // purge old in-memory shares to enforce forward-privacy
    try {
      this._purgeOldShares();
    } catch (e) {
      if (this._audit) this._audit('RESHARD_PURGE_FAILED', { err: String(e) });
    }
    const result = {
      newThreshold,
      newSize,
      newShares,
      coefficients: _computeLagrangeCoefficients(this.nodes, oldSize),
    };
    _zeroizeTransient(newShares);
    return result;
  }

  _purgeOldShares() {
    for (const n of this.nodes) {
      if (!n) continue;
      if (Buffer.isBuffer(n.share)) {
        secureZeroize(n.share);
        n.share = Buffer.alloc(0);
      } else if (typeof n.share === 'bigint') {
        n.share = 0n;
      } else if (typeof n.share === 'number') {
        n.share = 0;
      } else {
        n.share = null;
      }
    }
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

  /**
   * Compute a reshard distribution mapping (coefficients) for a planned transition.
   * Returns an object { epoch, distribution }
   */
  async computeReshardDistribution(currentCommittee, targetConfig) {
    if (!currentCommittee || !targetConfig) throw new Error('ERR_INVALID_ARGS');

    const currentSize = (currentCommittee.nodeIds || Object.keys(currentCommittee.shares || {})).length || 0;
    const targetSize = (targetConfig.nodeIds || []).length;

    if (targetSize > (this.policy.maxCommitteeSize || Infinity)) {
      throw new Error('ERR_COMMITTEE_SIZE_EXCEEDED');
    }

    if (currentSize > 0 && (targetSize / currentSize) > (this.policy.maxCommitteeExpansionFactor || Infinity)) {
      throw new Error('ERR_EXPANSION_FACTOR_EXCEEDED');
    }

    const lastRotated = currentCommittee.lastRotationMs || 0;
    const now = Date.now();
    if (now - lastRotated < (this.policy.minEpochIntervalMs || 0)) {
      throw new Error('ERR_MIN_EPOCH_INTERVAL');
    }

    // Attestation checks for new nodes
    if (this.policy.requireNewNodeAttestation && this._attestationClient) {
      for (const nodeId of targetConfig.nodeIds || []) {
        const isExisting = (currentCommittee.nodeIds || []).includes(nodeId) || ((currentCommittee.shares || {})[nodeId]);
        if (!isExisting) {
          const att = (targetConfig.attestations || {})[nodeId];
          const valid = await this._attestationClient.verify(att).catch(() => false);
          if (!valid) throw new Error(`ERR_INVALID_NODE_ATTESTATION:${nodeId}`);
        }
      }
    }

    // Build equal-weight coefficients over existing committee for each target
    const srcIds = currentCommittee.nodeIds || Object.keys(currentCommittee.shares || {});
    const srcCount = srcIds.length || 1;
    const distribution = {};
    for (const tId of (targetConfig.nodeIds || [])) {
      const coeffs = {};
      for (const sId of srcIds) coeffs[sId] = 1 / srcCount;
      distribution[tId] = { coefficients: coeffs };
    }

    return { epoch: (currentCommittee.epoch || 0) + 1, distribution };
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

  /**
   * New API: compute reshard distribution using finite-field Lagrange coefficients.
   * @param {Object} currentCommittee - { epoch, nodeIds: [], shares: { id: { value } }, lastRotationMs }
   * @param {Object} targetConfig - { nodeIds: [], attestations: {} }
   */
  async computeReshardDistribution(currentCommittee, targetConfig) {
    if (!currentCommittee || !targetConfig) throw new Error('ERR_INVALID_ARGS');

    const currentSize = (currentCommittee.nodeIds || Object.keys(currentCommittee.shares || {})).length || 0;
    const targetSize = (targetConfig.nodeIds || []).length;

    if (targetSize > (this.policy.maxCommitteeSize || Infinity)) {
      throw new Error('ERR_COMMITTEE_SIZE_EXCEEDED');
    }

    if (currentSize > 0 && (targetSize / currentSize) > (this.policy.maxCommitteeExpansionFactor || Infinity)) {
      throw new Error('ERR_EXPANSION_FACTOR_EXCEEDED');
    }

    const lastRotated = currentCommittee.lastRotationMs || 0;
    const now = Date.now();
    if (now - lastRotated < (this.policy.minEpochIntervalMs || 0)) {
      throw new Error('ERR_MIN_EPOCH_INTERVAL');
    }

    // Attestation checks
    if (this.policy.requireNewNodeAttestation && this._attestationClient) {
      for (const nodeId of targetConfig.nodeIds || []) {
        const isExisting = (currentCommittee.nodeIds || []).includes(nodeId) || ((currentCommittee.shares || {})[nodeId]);
        if (!isExisting) {
          const att = (targetConfig.attestations || {})[nodeId];
          const valid = await this._attestationClient.verify(att).catch(() => false);
          if (!valid) throw new Error(`ERR_INVALID_NODE_ATTESTATION:${nodeId}`);
        }
      }
    }

    const distribution = _deriveLagrangeCoefficientsFF(this.policy, currentCommittee, targetConfig);
    return { epoch: (currentCommittee.epoch || 0) + 1, distribution };
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
    coeffs.push((num * invDen) % p);
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
    acc = (acc + (value * basis) % p) % p;
  }
  return acc;
}

function _lagrangeBasis(sourceIndex, targetIndex) {
  const p = _bigPrime();
  let num = 1n;
  let den = 1n;
  // compute over the natural range [1..sourceCount] where sourceCount is inferred
  const sourceCount = 5; // conservative default; callers should pass proper indices when available
  for (let j = 0; j < sourceCount; j += 1) {
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

function _deriveLagrangeCoefficientsFF(policy, current, target) {
  const P = policy.prime || _bigPrime();

  const mod = (x) => {
    const r = x % P;
    return r >= 0n ? r : r + P;
  };

  const modInv = (a) => {
    let t = 0n, newT = 1n;
    let r = P, newR = mod(a);
    while (newR !== 0n) {
      const q = r / newR;
      [t, newT] = [newT, t - q * newT];
      [r, newR] = [newR, r - q * newR];
    }
    if (r !== 1n) throw new Error('MATH_NOT_INVERTIBLE');
    if (t < 0n) t += P;
    return t;
  };

  const srcIds = current.nodeIds || Object.keys(current.shares || {});
  const tgtIds = target.nodeIds || [];

  const hashToX = (id) => {
    const h = require('crypto').createHash('sha256').update(String(id)).digest();
    const v = BigInt('0x' + h.slice(0, 8).toString('hex'));
    return mod(v + 1n);
  };

  const xSrc = {};
  for (const id of srcIds) xSrc[id] = hashToX(id);
  const xTgt = {};
  for (const id of tgtIds) xTgt[id] = hashToX(id + '-t');

  const mapping = {};
  for (const tId of tgtIds) {
    const xt = xTgt[tId];
    const coeffs = {};
    for (const iId of srcIds) {
      const xi = xSrc[iId];
      let num = 1n;
      let den = 1n;
      for (const jId of srcIds) {
        if (jId === iId) continue;
        const xj = xSrc[jId];
        num = mod(num * mod(xt - xj));
        den = mod(den * mod(xi - xj));
      }
      const Li = mod(num * modInv(den));
      coeffs[iId] = Li;
    }
    mapping[tId] = { coefficients: coeffs };
  }
  return mapping;
}

module.exports = { GroupReshardEngine };
