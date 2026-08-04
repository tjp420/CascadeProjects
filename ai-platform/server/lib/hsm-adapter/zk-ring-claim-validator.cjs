'use strict';

const { CryptoPolicyEngine } = require('./crypto-policy-engine.cjs');
const { incrementCounter } = require('./hsm-metrics.cjs');

class ZkRingClaimValidator {
  constructor(engine) {
    this.engine = engine || new CryptoPolicyEngine();
  }

  validate(tenantId, claim) {
    const policy = this.engine.getPolicy(tenantId);

    if (policy.ringGating.requireBlindedLinkabilityAttestation) {
      if (!claim.blindedLinkabilityAttestation || typeof claim.linkabilityToken !== 'string') {
        throw new Error('RINGCLAIM_UNATTESTED_LINKABILITY');
      }
    }

    this.engine.validate(tenantId, 'ringGating', claim);

    if (!Array.isArray(claim.anonymitySet)) {
      throw new Error('RINGCLAIM_INVALID_ANONYMITY_SET_SIZE');
    }

    const setSize = claim.anonymitySet.length;
    const min = policy.ringGating.minRingSize;
    const max = policy.ringGating.maxRingSize;

    if (setSize < min || setSize > max) {
      throw new Error('RINGCLAIM_INVALID_ANONYMITY_SET_SIZE');
    }

    incrementCounter('hsm_zk_ring_claim_verified_total');
    return true;
  }
}

module.exports = { ZkRingClaimValidator };
