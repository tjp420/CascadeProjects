'use strict';

const { ZkLatticeVssValidator } = require('./zk-lattice-vss-validator.cjs');
const { incrementCounter } = require('./hsm-metrics.cjs');

class PqcLatticeVssGatingHub {
  constructor(tenantId, policyEngine) {
    this.tenantId = tenantId;
    this.state = 'OPEN';
    this.shares = [];
    this.validator = new ZkLatticeVssValidator(policyEngine);
    this.claim = null;
    incrementCounter('hsm_vssgate_pool_initialized_total');
  }

  _ensureTransition(from, to) {
    if (this.state !== from) {
      throw new Error(`VSSGATE_INVALID_TRANSITION: cannot move from ${this.state} to ${to}`);
    }
    this.state = to;
  }

  collectShares(shares) {
    this._ensureTransition('OPEN', 'SHARES_COLLECTED');
    if (!Array.isArray(shares)) {
      throw new Error('VSSGATE_INVALID_SHARES');
    }
    this.shares = [...shares];
    return this.state;
  }

  validateProof(claim) {
    this._ensureTransition('SHARES_COLLECTED', 'PROOF_VALIDATED');
    this.claim = { ...claim, shares: this.shares };
    this.validator.validate(this.tenantId, this.claim);
    return this.state;
  }

  accredit() {
    this._ensureTransition('PROOF_VALIDATED', 'ACCREDITED');
    incrementCounter('hsm_vss_accreditation_completed_total');
    return this.state;
  }
}

module.exports = { PqcLatticeVssGatingHub };
