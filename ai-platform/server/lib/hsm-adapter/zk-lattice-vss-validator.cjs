"use strict";

const { CryptoPolicyEngine } = require("./crypto-policy-engine.cjs");
const { incrementCounter } = require("./hsm-metrics.cjs");

class ZkLatticeVssValidator {
  constructor(engine) {
    this.engine = engine || new CryptoPolicyEngine();
  }

  validate(tenantId, claim) {
    const policy = this.engine.getPolicy(tenantId);

    if (policy.latticeVssGating.requireEnclaveBindingAttestation) {
      if (!claim.enclaveBindingAttestation) {
        throw new Error("VSSCLAIM_UNATTESTED_BINDING");
      }
    }

    if (!Array.isArray(claim.shares)) {
      throw new Error("VSSCLAIM_INSUFFICIENT_SHARES");
    }

    const shareCount = claim.shares.length;
    const minShares = policy.latticeVssGating.minVssShares;

    if (shareCount < minShares) {
      throw new Error("VSSCLAIM_INSUFFICIENT_SHARES");
    }

    if (
      typeof claim.degreeBound === "number" &&
      claim.degreeBound > policy.latticeVssGating.maxDegreeBound
    ) {
      throw new Error("VSSCLAIM_DEGREE_BOUND_EXCEEDED");
    }

    this.engine.validate(tenantId, "latticeVssGating", claim);

    incrementCounter("hsm_zk_vss_claim_verified_total");
    return true;
  }
}

module.exports = { ZkLatticeVssValidator };
