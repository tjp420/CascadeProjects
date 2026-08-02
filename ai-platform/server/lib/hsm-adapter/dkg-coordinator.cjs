'use strict';

/**
 * Track 26: Distributed Key Generation (DKG) coordinator.
 *
 * Orchestrates a joint-Feldman DKG round across N nodes. Each participant
 * generates its own polynomial, broadcasts commitments, and distributes shares.
 * The coordinator collects shares, verifies them, and emits the aggregated
 * public key.
 *
 * @module hsm-adapter/dkg-coordinator
 */

const crypto = require('crypto');
const { HsmAdapterError } = require('./base-adapter.cjs');
const { DkgNode } = require('./dkg-node.cjs');

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

class DkgCoordinator {
  /**
   * @param {object} options
   * @param {number} options.nodeCount
   * @param {number} options.threshold
   * @param {BigInt} [options.prime]
   * @param {BigInt} [options.subgroupOrder]
   * @param {BigInt} [options.generator]
   * @param {string} [options.tenantId]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.nodeCount = options.nodeCount;
    this.threshold = options.threshold;
    this._prime = options.prime || 11n;
    this._subgroupOrder = options.subgroupOrder || 5n;
    this._generator = options.generator || 3n;
    this._tenantId = options.tenantId || null;
    this._audit = options.audit || null;
    this._nodes = [];
    this._publicKey = null;
  }

  /**
   * Initialize nodes and start the DKG round.
   * @returns {Promise<object>}
   */
  runRound() {
    if (!Number.isInteger(this.nodeCount) || this.nodeCount < 2) {
      throw new HsmAdapterError('INVALID_INPUT', 'nodeCount must be at least 2');
    }
    if (!Number.isInteger(this.threshold) || this.threshold < 1 || this.threshold > this.nodeCount) {
      throw new HsmAdapterError('INVALID_INPUT', 'threshold must be 1 <= t <= nodeCount');
    }

    const ids = Array.from({ length: this.nodeCount }, (_, i) => i + 1);
    this._nodes = ids.map((id) => new DkgNode({
      nodeId: id,
      prime: this._prime,
      subgroupOrder: this._subgroupOrder,
      generator: this._generator,
    }));

    // Phase 1: each node generates a polynomial and broadcasts commitments.
    const allCommitments = this._nodes.map((node) => {
      node.generatePolynomial(this.threshold - 1);
      return { nodeId: node.nodeId, commitments: node.getCommitments() };
    });

    // Phase 2: each node computes shares for every participant.
    const allShares = this._nodes.map((node) => ({
      nodeId: node.nodeId,
      shares: node.computeSharesFor(ids),
    }));

    // Phase 3: each node verifies every share it received.
    const verifiedGroupShares = ids.map((id) => {
      const recipient = this._nodes[id - 1];
      const received = allShares
        .filter((s) => s.nodeId !== id)
        .map((s) => {
          const shareEntry = s.shares.find((sh) => sh.recipientId === id);
          const senderCommitments = allCommitments.find((c) => c.nodeId === s.nodeId).commitments;
          const valid = recipient.verifyShare(shareEntry.value, id, senderCommitments);
          if (!valid) {
            throw new HsmAdapterError('DKG_INVALID_SHARE', `node ${id} rejected share from ${s.nodeId}`);
          }
          return shareEntry.value;
        });
      const ownShare = allShares.find((s) => s.nodeId === id).shares.find((sh) => sh.recipientId === id).value;
      return recipient.aggregateGroupShare([...received, ownShare]);
    });

    // Phase 4: aggregate public group key: product of C_0 (constant term commitments).
    this._publicKey = allCommitments
      .map((c) => c.commitments[0])
      .reduce((prod, c0) => (prod * c0) % this._prime, 1n);

    this._emitAudit('DKG_ROUND_COMPLETED', {
      tenantId: this._tenantId,
      nodeCount: this.nodeCount,
      threshold: this.threshold,
      publicKey: this._publicKey.toString(16),
    });

    return {
      publicKey: this._publicKey,
      groupShares: verifiedGroupShares,
      commitments: allCommitments,
    };
  }

  _emitAudit(event, info) {
    if (this._audit) this._audit(event, { timestamp: Date.now(), ...info });
  }
}

module.exports = { DkgCoordinator };
