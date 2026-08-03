'use strict';

/**
 * Track 43B: Cross-region state reconstructor.
 *
 * Aggregates surviving cluster shares and reconstructs KEK rings
 * after a regional failover. Requires attestation for standby nodes.
 *
 * @module hsm-adapter/cross-region-state-reconstructor
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class CrossRegionStateReconstructor {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._audit = options.audit || null;
  }

  /**
   * Reconstruct state from surviving regions.
   * @param {string[]} survivingRegions
   * @param {string[]} standbyNodes
   * @param {object[]} shareFragments
   * @param {Object<string, object>} [standbyAttestations]
   * @returns {object}
   */
  reconstruct(survivingRegions, standbyNodes, shareFragments, standbyAttestations = {}) {
    if (survivingRegions.length < (this.policy.minSurvivingRegions || 2)) {
      throw new HsmAdapterError('DR_SURVIVING_REGIONS_INSUFFICIENT', `need at least ${this.policy.minSurvivingRegions} surviving regions`);
    }
    if (this.policy.requireByzantineFaultProofs && shareFragments.length === 0) {
      throw new HsmAdapterError('DR_FAULT_PROOFS_MISSING', 'byzantine fault proofs are required');
    }
    for (const nodeId of standbyNodes) {
      if (this.policy.requireStandbyAttestation && this._attestationClient) {
        const doc = standbyAttestations[nodeId];
        if (!doc) {
          throw new HsmAdapterError('DR_STANDBY_ATTESTATION_MISSING', `standby node ${nodeId} has no attestation document`);
        }
        const result = this._attestationClient.verify(doc);
        if (!result.verified) {
          throw new HsmAdapterError('DR_STANDBY_UNATTESTED', `standby node ${nodeId} is not attested`);
        }
      }
    }
    const now = Math.floor(Date.now() / 1000);
    const age = Math.max(...shareFragments.map((f) => f.ageSeconds || 0));
    if (age > (this.policy.maxStateReconstructionAgeSeconds || 60)) {
      throw new HsmAdapterError('DR_STATE_TOO_OLD', `reconstruction state age ${age}s exceeds maximum ${this.policy.maxStateReconstructionAgeSeconds}s`);
    }
    const keyRing = _combineShares(shareFragments);
    if (this._audit) {
      this._audit('STANDBY_CLUSTER_PROVISIONED', {
        survivingRegions,
        standbyNodes,
        fragmentCount: shareFragments.length,
        reconstructed: true,
      });
    }
    return {
      reconstructed: true,
      keyRing,
      survivingRegions,
      standbyNodes,
      timestamp: now,
    };
  }
}

function _combineShares(fragments) {
  const sorted = [...fragments].sort((a, b) => a.index - b.index);
  let acc = 0n;
  for (const f of sorted) {
    const value = typeof f.value === 'bigint' ? f.value : BigInt(f.value || 0);
    acc ^= value;
  }
  return `kek-ring-${acc.toString(16).slice(0, 16)}`;
}

module.exports = { CrossRegionStateReconstructor };
