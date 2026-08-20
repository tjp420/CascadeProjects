"use strict";

const { ZkRingClaimValidator } = require("./zk-ring-claim-validator.cjs");
const { incrementCounter } = require("./hsm-metrics.cjs");

class PqcBlindedRingSignatureGatingHub {
  constructor(tenantId, policyEngine) {
    this.tenantId = tenantId;
    this.state = "OPEN";
    this.keys = [];
    this.validator = new ZkRingClaimValidator(policyEngine);
    this.claim = null;
    incrementCounter("hsm_ringgate_pool_initialized_total");
  }

  _ensureTransition(from, to) {
    if (this.state !== from) {
      throw new Error(
        `RINGGATE_INVALID_TRANSITION: cannot move from ${this.state} to ${to}`,
      );
    }
    this.state = to;
  }

  collectKeys(keys) {
    this._ensureTransition("OPEN", "KEYS_COLLECTED");
    if (!Array.isArray(keys)) {
      throw new Error("RINGGATE_INVALID_KEYS");
    }
    this.keys = keys;
    return this.state;
  }

  validateProof(claim) {
    this._ensureTransition("KEYS_COLLECTED", "PROOF_VALIDATED");
    this.claim = { ...claim, anonymitySet: this.keys };
    this.validator.validate(this.tenantId, this.claim);
    return this.state;
  }

  accredit() {
    this._ensureTransition("PROOF_VALIDATED", "ACCREDITED");
    incrementCounter("hsm_ring_accreditation_completed_total");
    return this.state;
  }
}

module.exports = { PqcBlindedRingSignatureGatingHub };
