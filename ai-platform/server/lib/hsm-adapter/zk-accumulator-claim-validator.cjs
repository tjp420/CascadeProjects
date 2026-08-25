"use strict";

const { CryptoPolicyEngine } = require("./crypto-policy-engine.cjs");
const { incrementCounter } = require("./hsm-metrics.cjs");

class ZkAccumulatorClaimValidator {
  constructor(engine) {
    this.engine = engine || new CryptoPolicyEngine();
  }

  validate(tenantId, claim) {
    const policy = this.engine.getPolicy(tenantId);

    if (policy.accumulatorGating.requireEnclaveMembershipAttestation) {
      if (!claim.enclaveMembershipAttestation) {
        throw new Error("ACCUMULATORCLAIM_UNATTESTED_MEMBERSHIP");
      }
    }

    if (!Array.isArray(claim.witnesses)) {
      throw new Error("ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM");
    }

    const witnessCount = claim.witnesses.length;
    const minQuorum = policy.accumulatorGating.minWitnessQuorum;

    if (witnessCount < minQuorum) {
      throw new Error("ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM");
    }

    if (
      typeof claim.accumulatorSize === "number" &&
      claim.accumulatorSize > policy.accumulatorGating.maxAccumulatorSize
    ) {
      throw new Error("ACCUMULATORCLAIM_TREE_SIZE_EXCEEDED");
    }

    this.engine.validate(tenantId, "accumulatorGating", claim);

    incrementCounter("hsm_zk_accumulator_claim_verified_total");
    return true;
  }
}

module.exports = { ZkAccumulatorClaimValidator };
