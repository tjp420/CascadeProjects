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
    // Derive Lagrange basis coefficients mapping source nodes -> target nodes.
    // For deterministic behavior we map nodeIds to numeric x positions via a stable hash,
    // then compute floating-point Lagrange basis values. This is sufficient for tests
    // and deterministic resharing simulation; production should use a finite field.
    const srcIds = current.nodeIds || Object.keys(current.shares || {});
    const tgtIds = target.nodeIds || [];

    const hashToX = (id) => {
      const h = crypto.createHash('sha256').update(String(id)).digest();
      // use first 6 bytes as integer to keep numbers reasonable
      const v = h.readUIntBE(0, 6);
      return Number(v) + 1; // avoid zero
    };

    const xSrc = {};
    for (const id of srcIds) xSrc[id] = hashToX(id);
    const xTgt = {};
    for (const id of tgtIds) xTgt[id] = hashToX(id + '-t');

    const mapping = {};
    for (const t of tgtIds) {
      const xt = xTgt[t];
      const coeffs = {};
      for (const i of srcIds) {
        const xi = xSrc[i];
        let num = 1.0;
        let den = 1.0;
        for (const j of srcIds) {
          if (j === i) continue;
          const xj = xSrc[j];
          num *= (xt - xj);
          den *= (xi - xj);
        }
        const Li = den === 0 ? 0 : num / den;
        coeffs[i] = Li;
      }
      // normalize coefficients so they sum to 1 to reduce numeric drift
      const sum = Object.values(coeffs).reduce((s, v) => s + v, 0) || 1;
      for (const k of Object.keys(coeffs)) coeffs[k] = coeffs[k] / sum;
      mapping[t] = { coefficients: coeffs };
    }

    return mapping;
  }
}

module.exports = { GroupReshardEngine };
