'use strict';

const { PqcBlindedRingSignatureGatingHub } = require('../pqc-blinded-ring-signature-gating-hub.cjs');
const { ZkRingClaimValidator } = require('../zk-ring-claim-validator.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 32 core gating hub', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('FSM advances OPEN -> KEYS_COLLECTED -> PROOF_VALIDATED -> ACCREDITED', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcBlindedRingSignatureGatingHub('t1', engine);
    expect(hub.state).toBe('OPEN');

    hub.collectKeys(new Array(16).fill('pub'));
    expect(hub.state).toBe('KEYS_COLLECTED');

    hub.validateProof({
      blindedLinkabilityAttestation: true,
      linkabilityToken: 'token-1',
    });
    expect(hub.state).toBe('PROOF_VALIDATED');

    hub.accredit();
    expect(hub.state).toBe('ACCREDITED');

    expect(hsmMetrics.getMetrics().hsm_ringgate_pool_initialized_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_zk_ring_claim_verified_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_ring_accreditation_completed_total).toBe(1);
  });

  test('out-of-order accredit throws invalid transition', () => {
    const hub = new PqcBlindedRingSignatureGatingHub('t1', new CryptoPolicyEngine());
    expect(() => hub.accredit()).toThrow(/RINGGATE_INVALID_TRANSITION/);
  });

  test('invalid ring size below minimum throws RINGCLAIM_INVALID_ANONYMITY_SET_SIZE', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcBlindedRingSignatureGatingHub('t1', engine);
    hub.collectKeys(new Array(8).fill('pub'));
    expect(() => hub.validateProof({
      blindedLinkabilityAttestation: true,
      linkabilityToken: 'token-1',
    })).toThrow(/RINGCLAIM_INVALID_ANONYMITY_SET_SIZE/);
  });

  test('invalid ring size above maximum throws RINGCLAIM_INVALID_ANONYMITY_SET_SIZE', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcBlindedRingSignatureGatingHub('t1', engine);
    hub.collectKeys(new Array(200).fill('pub'));
    expect(() => hub.validateProof({
      blindedLinkabilityAttestation: true,
      linkabilityToken: 'token-1',
    })).toThrow(/RINGCLAIM_INVALID_ANONYMITY_SET_SIZE/);
  });

  test('missing linkability attestation throws RINGCLAIM_UNATTESTED_LINKABILITY', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcBlindedRingSignatureGatingHub('t1', engine);
    hub.collectKeys(new Array(32).fill('pub'));
    expect(() => hub.validateProof({
      blindedLinkabilityAttestation: false,
      linkabilityToken: 'token-1',
    })).toThrow(/RINGCLAIM_UNATTESTED_LINKABILITY/);
  });
});
