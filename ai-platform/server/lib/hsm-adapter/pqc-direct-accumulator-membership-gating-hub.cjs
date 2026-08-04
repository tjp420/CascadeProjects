'use strict';

const { ZkAccumulatorClaimValidator } = require('./zk-accumulator-claim-validator.cjs');
const { incrementCounter } = require('./hsm-metrics.cjs');

class PqcDirectAccumulatorMembershipGatingHub {
  constructor(tenantId, policyEngine) {
    this.tenantId = tenantId;
    this.state = 'OPEN';
    this.witnesses = [];
    this.validator = new ZkAccumulatorClaimValidator(policyEngine);
    this.claim = null;
    incrementCounter('hsm_accumulatorgate_pool_initialized_total');
  }

  _ensureTransition(from, to) {
    if (this.state !== from) {
      throw new Error(`ACCUMULATORGATE_INVALID_TRANSITION: cannot move from ${this.state} to ${to}`);
    }
    this.state = to;
  }

  collectWitnesses(witnesses) {
    this._ensureTransition('OPEN', 'WITNESSES_COLLECTED');
    if (!Array.isArray(witnesses)) {
      throw new Error('ACCUMULATORGATE_INVALID_WITNESSES');
    }
    this.witnesses = [...witnesses];
    return this.state;
  }

  validateProof(claim) {
    this._ensureTransition('WITNESSES_COLLECTED', 'PROOF_VALIDATED');
    this.claim = { ...claim, witnesses: this.witnesses };
    this.validator.validate(this.tenantId, this.claim);
    return this.state;
  }

  accredit() {
    this._ensureTransition('PROOF_VALIDATED', 'ACCREDITED');
    incrementCounter('hsm_accumulator_accreditation_completed_total');
    return this.state;
  }
}

module.exports = { PqcDirectAccumulatorMembershipGatingHub };
