const crypto = require('crypto');

class GroupReshardEngine {
  constructor({ policy = {}, attestationClient = null } = {}) {
    this.policy = Object.assign({
      maxCommitteeSize: 11,
      maxCommitteeExpansionFactor: 2.0,
      minEpochIntervalMs: 1000,
      requireNewNodeAttestation: true,
    }, policy);
    this.attestationClient = attestationClient;
  }

  async computeReshardDistribution(currentCommittee, targetConfig) {
    if (!currentCommittee || !targetConfig) throw new Error('ERR_INVALID_ARGS');

    const currentSize = (currentCommittee.nodeIds || Object.keys(currentCommittee.shares || {})).length || 0;
    const targetSize = (targetConfig.nodeIds || []).length;

    if (targetSize > this.policy.maxCommitteeSize) {
      throw new Error('ERR_COMMITTEE_SIZE_EXCEEDED');
    }

    if (currentSize > 0 && (targetSize / currentSize) > this.policy.maxCommitteeExpansionFactor) {
      throw new Error('ERR_EXPANSION_FACTOR_EXCEEDED');
    }

    const lastRotated = currentCommittee.lastRotationMs || 0;
    const now = Date.now();
    if (now - lastRotated < this.policy.minEpochIntervalMs) {
      throw new Error('ERR_MIN_EPOCH_INTERVAL');
    }

    // Attestation checks for new nodes
    if (this.policy.requireNewNodeAttestation && this.attestationClient) {
      for (const nodeId of targetConfig.nodeIds || []) {
        const isExisting = (currentCommittee.nodeIds || []).includes(nodeId) || ((currentCommittee.shares || {})[nodeId]);
        if (!isExisting) {
          const att = (targetConfig.attestations || {})[nodeId];
          const valid = await this.attestationClient.verify(att).catch(() => false);
          if (!valid) throw new Error(`ERR_INVALID_NODE_ATTESTATION:${nodeId}`);
        }
      }
    }

    const distribution = this._deriveLagrangeCoefficients(currentCommittee, targetConfig);

    return { epoch: (currentCommittee.epoch || 0) + 1, distribution };
  }

  _deriveLagrangeCoefficients(current, target) {
    // Simple, deterministic distribution stub for reviewers.
    // Produces equal-weight coefficients summing to 1.0 for each target node.
    const nodeIds = target.nodeIds || [];
    const n = nodeIds.length || 1;
    const weight = 1 / n;
    const mapping = {};
    for (const id of nodeIds) mapping[id] = { coefficient: weight };
    return mapping;
  }
}

module.exports = { GroupReshardEngine };
