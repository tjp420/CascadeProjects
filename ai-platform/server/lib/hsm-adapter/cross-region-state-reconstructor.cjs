'use strict';

/**
 * Track 43B: Cross-region state reconstructor.
 *
 * Aggregates surviving cluster digests and reconstructs KEK rings
 * after a regional failover. Requires attestation for standby nodes.
 *
 * The reconstructor now consumes real Track 35 reconciliation digests
 * (from ClusterKeyReconciliationEngine) instead of synthetic share fragments.
 *
 * @module hsm-adapter/cross-region-state-reconstructor
 */

const { HsmAdapterError } = require('./base-adapter.cjs');

class CrossRegionStateReconstructor {
  /**
   * @param {object} options
   * @param {object} options.policy
   * @param {EnclaveAttestationClient} [options.attestationClient]
   * @param {ClusterKeyReconciliationEngine} [options.clusterReconciler]
   * @param {Function} [options.audit]
   */
  constructor(options = {}) {
    this.policy = options.policy || {};
    this._attestationClient = options.attestationClient || null;
    this._clusterReconciler = options.clusterReconciler || null;
    this._audit = options.audit || null;
  }

  /**
   * Reconstruct state from surviving regions.
   *
   * @param {string[]} survivingRegions
   * @param {string[]} standbyNodes
   * @param {object|string} input - Reconciliation digest object, or a keyId
   *   string when a live `clusterReconciler` is configured.
   * @param {Object<string, object>} [standbyAttestations]
   * @returns {object}
   */
  reconstruct(survivingRegions, standbyNodes, input, standbyAttestations = {}) {
    if (survivingRegions.length < (this.policy.minSurvivingRegions || 2)) {
      throw new HsmAdapterError('DR_SURVIVING_REGIONS_INSUFFICIENT', `need at least ${this.policy.minSurvivingRegions} surviving regions`);
    }
    if (this.policy.requireByzantineFaultProofs && (!input || (Array.isArray(input) && input.length === 0))) {
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

    const digest = this._resolveDigest(survivingRegions, input);

    if (digest.severity === 'critical') {
      throw new HsmAdapterError('DR_DIVERGENCE_CRITICAL', `reconstruction key ${digest.keyId} has critical divergence`);
    }

    const minQuorum = digest.quorumRequired
      || this.policy.minReconstructionQuorumNodes
      || this.policy.minFailoverQuorumNodes
      || 2;
    if (digest.majorityCount < minQuorum) {
      throw new HsmAdapterError('DR_QUORUM_INSUFFICIENT', `majority count ${digest.majorityCount} below required quorum ${minQuorum}`);
    }

    const now = Math.floor(Date.now() / 1000);
    const age = digest.ageSeconds || 0;
    if (age > (this.policy.maxStateReconstructionAgeSeconds || 60)) {
      throw new HsmAdapterError('DR_STATE_TOO_OLD', `reconstruction state age ${age}s exceeds maximum ${this.policy.maxStateReconstructionAgeSeconds}s`);
    }

    const keyRing = `kek-ring-${digest.majorityFingerprint.slice(0, 16)}-${digest.quorumEpoch}`;
    if (this._audit) {
      this._audit('STANDBY_CLUSTER_PROVISIONED', {
        survivingRegions,
        standbyNodes,
        keyId: digest.keyId,
        majorityCount: digest.majorityCount,
        quorumEpoch: digest.quorumEpoch,
        reconstructed: true,
      });
    }
    return {
      reconstructed: true,
      keyRing,
      survivingRegions,
      standbyNodes,
      keyId: digest.keyId,
      quorumEpoch: digest.quorumEpoch,
      timestamp: now,
    };
  }

  /**
   * Resolve an input argument into a normalized reconciliation digest.
   *
   * Supported input types:
   *   - object: a Track 35 `reconciliationDigest` object
   *   - string: a `keyId` to resolve against a live `clusterReconciler`
   *   - array: legacy mock `shareFragments` (XORed for backward compatibility)
   *
   * @private
   * @param {string[]} survivingRegions
   * @param {object|string|Array} input
   * @returns {object}
   */
  _resolveDigest(survivingRegions, input) {
    if (Array.isArray(input)) {
      // Legacy mock share fragments path
      return {
        keyId: 'legacy',
        severity: 'none',
        majorityCount: input.length,
        majorityFingerprint: _combineShares(input),
        quorumEpoch: 0,
        quorumRequired: input.length,
        ageSeconds: Math.max(...input.map((f) => f.ageSeconds || 0)),
      };
    }

    if (typeof input === 'string') {
      if (!this._clusterReconciler) {
        throw new HsmAdapterError('DR_RECONCILER_NOT_CONFIGURED', 'clusterReconciler is required when keyId is a string');
      }
      const keyId = input;
      const fingerprints = survivingRegions.map((nodeId) => {
        const fp = this._clusterReconciler.getKeyFingerprint(keyId, nodeId);
        return fp || 'missing';
      });
      const counts = {};
      for (const fp of fingerprints) {
        counts[fp] = (counts[fp] || 0) + 1;
      }
      let majorityFingerprint = '';
      let majorityCount = 0;
      for (const [fp, count] of Object.entries(counts)) {
        if (count > majorityCount) {
          majorityCount = count;
          majorityFingerprint = fp;
        }
      }
      const state = this._clusterReconciler.getReconciliationState(keyId);
      const allAgree = fingerprints.length > 0 && majorityCount === fingerprints.length;
      return {
        keyId,
        severity: allAgree ? 'none' : 'critical',
        majorityCount,
        majorityFingerprint,
        quorumEpoch: state.promotedEpoch || 0,
        quorumRequired: state.quorumRequired || majorityCount,
        ageSeconds: 0,
      };
    }

    if (input && typeof input === 'object') {
      if (!input.majorityFingerprint) {
        throw new HsmAdapterError('DR_DIGEST_INVALID', 'reconciliationDigest missing majorityFingerprint');
      }
      return {
        keyId: input.keyId || 'unknown',
        severity: input.severity || 'none',
        majorityCount: input.majorityCount || 0,
        majorityFingerprint: input.majorityFingerprint,
        quorumEpoch: input.quorumEpoch || 0,
        quorumRequired: input.quorumRequired || input.majorityCount,
        ageSeconds: input.ageSeconds || 0,
      };
    }

    throw new HsmAdapterError('DR_DIGEST_INVALID', 'reconstruction input must be a reconciliation digest object, keyId string, or legacy share fragment array');
  }
}

function _combineShares(fragments) {
  const sorted = [...fragments].sort((a, b) => a.index - b.index);
  let acc = 0n;
  for (const f of sorted) {
    const value = typeof f.value === 'bigint' ? f.value : BigInt(f.value || 0);
    acc ^= value;
  }
  return acc.toString(16).slice(0, 16);
}

module.exports = { CrossRegionStateReconstructor };
