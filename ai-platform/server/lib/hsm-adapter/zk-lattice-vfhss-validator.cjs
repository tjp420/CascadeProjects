"use strict";

const { CryptoPolicyEngine } = require("./crypto-policy-engine.cjs");
const { incrementCounter } = require("./hsm-metrics.cjs");

class ZkLatticeVfhssValidator {
  constructor(engine) {
    this.engine = engine || new CryptoPolicyEngine();
  }

  validate(tenantId, claim) {
    const policy = this.engine.getPolicy(tenantId);

    if (policy.latticeVfhssGating.requireEnclaveEvaluationAttestation) {
      if (!claim.enclaveEvaluationAttestation) {
        throw new Error("VFHSSCLAIM_UNATTESTED_EVALUATION");
      }
    }

    if (!Array.isArray(claim.shares)) {
      throw new Error("VFHSSCLAIM_INSUFFICIENT_SHARES");
    }

    const shareCount = claim.shares.length;
    const minShares = policy.latticeVfhssGating.minVfhssShares;

    if (shareCount < minShares) {
      throw new Error("VFHSSCLAIM_INSUFFICIENT_SHARES");
    }

    if (
      typeof claim.homomorphicDepth === "number" &&
      claim.homomorphicDepth > policy.latticeVfhssGating.maxHomomorphicDepth
    ) {
      throw new Error("VFHSSCLAIM_HOMOMORPHIC_DEPTH_EXCEEDED");
    }

    this.engine.validate(tenantId, "latticeVfhssGating", claim);

    incrementCounter("hsm_zk_vfhss_claim_verified_total");
    return true;
  }
}

module.exports = { ZkLatticeVfhssValidator };
