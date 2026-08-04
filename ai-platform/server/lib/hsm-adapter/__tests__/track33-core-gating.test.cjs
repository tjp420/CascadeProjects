'use strict';

const { PqcDirectAccumulatorMembershipGatingHub } = require('../pqc-direct-accumulator-membership-gating-hub.cjs');
const { ZkAccumulatorClaimValidator } = require('../zk-accumulator-claim-validator.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const hsmMetrics = require('../hsm-metrics.cjs');

describe('Track 33 core gating hub', () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  test('FSM advances OPEN -> WITNESSES_COLLECTED -> PROOF_VALIDATED -> ACCREDITED', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    expect(hub.state).toBe('OPEN');

    hub.collectWitnesses(new Array(8).fill('witness'));
    expect(hub.state).toBe('WITNESSES_COLLECTED');

    hub.validateProof({
      accumulatorSize: 1024,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    });
    expect(hub.state).toBe('PROOF_VALIDATED');

    hub.accredit();
    expect(hub.state).toBe('ACCREDITED');

    expect(hsmMetrics.getMetrics().hsm_accumulatorgate_pool_initialized_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_zk_accumulator_claim_verified_total).toBe(1);
    expect(hsmMetrics.getMetrics().hsm_accumulator_accreditation_completed_total).toBe(1);
  });

  test('out-of-order accredit throws invalid transition', () => {
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', new CryptoPolicyEngine());
    expect(() => hub.accredit()).toThrow(/ACCUMULATORGATE_INVALID_TRANSITION/);
  });

  test('insufficient witness quorum throws ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    hub.collectWitnesses(new Array(4).fill('witness'));
    expect(() => hub.validateProof({
      accumulatorSize: 1024,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    })).toThrow(/ACCUMULATORCLAIM_INSUFFICIENT_WITNESS_QUORUM/);
  });

  test('accumulator tree size exceeded throws ACCUMULATORCLAIM_TREE_SIZE_EXCEEDED', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    hub.collectWitnesses(new Array(8).fill('witness'));
    expect(() => hub.validateProof({
      accumulatorSize: 100000,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    })).toThrow(/ACCUMULATORCLAIM_TREE_SIZE_EXCEEDED/);
  });

  test('missing enclave attestation throws ACCUMULATORCLAIM_UNATTESTED_MEMBERSHIP', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    hub.collectWitnesses(new Array(8).fill('witness'));
    expect(() => hub.validateProof({
      accumulatorSize: 1024,
      enclaveMembershipAttestation: false,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    })).toThrow(/ACCUMULATORCLAIM_UNATTESTED_MEMBERSHIP/);
  });

  test('unsupported accumulator type throws ACCUMULATORGATE_POLICY_VIOLATION', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    hub.collectWitnesses(new Array(8).fill('witness'));
    expect(() => hub.validateProof({
      accumulatorSize: 1024,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'invalid-type',
      canonicalPayloadLayout: true,
    })).toThrow(/ACCUMULATORGATE_POLICY_VIOLATION/);
  });

  test('tenant override of minWitnessQuorum is respected', () => {
    const engine = new CryptoPolicyEngine({
      version: '0.0.0',
      default: {},
      tenants: {
        t1: { accumulatorGating: { minWitnessQuorum: 4 } },
      },
    });
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    hub.collectWitnesses(new Array(4).fill('witness'));
    hub.validateProof({
      accumulatorSize: 1024,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    });
    expect(hub.state).toBe('PROOF_VALIDATED');
  });

  test('DEFAULT_POLICY has exactly one accumulatorGating key (duplicate removed)', () => {
    const { DEFAULT_POLICY } = require('../crypto-policy-engine.cjs');
    const keys = Object.keys(DEFAULT_POLICY).filter((k) => k === 'accumulatorGating');
    expect(keys.length).toBe(1);
    expect(DEFAULT_POLICY.accumulatorGating.maxAccumulatorSize).toBe(65536);
    expect(DEFAULT_POLICY.accumulatorGating.minWitnessQuorum).toBe(8);
  });

  test('non-array witnesses to collectWitnesses throws ACCUMULATORGATE_INVALID_WITNESSES', () => {
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', new CryptoPolicyEngine());
    expect(() => hub.collectWitnesses('not-an-array')).toThrow(/ACCUMULATORGATE_INVALID_WITNESSES/);
  });

  test('validateProof called twice throws ACCUMULATORGATE_INVALID_TRANSITION', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    hub.collectWitnesses(new Array(8).fill('witness'));
    hub.validateProof({
      accumulatorSize: 1024,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    });
    expect(() => hub.validateProof({
      accumulatorSize: 1024,
      enclaveMembershipAttestation: true,
      attestationAuthority: 'mock-authority',
      accumulatorType: 'rsa-accumulator',
      canonicalPayloadLayout: true,
    })).toThrow(/ACCUMULATORGATE_INVALID_TRANSITION/);
  });

  test('hub isolation across tenants — two hubs do not share state', () => {
    const engine = new CryptoPolicyEngine();
    const hubA = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    const hubB = new PqcDirectAccumulatorMembershipGatingHub('t2', engine);
    expect(hubA.state).toBe('OPEN');
    expect(hubB.state).toBe('OPEN');
    hubA.collectWitnesses(new Array(8).fill('w'));
    expect(hubA.state).toBe('WITNESSES_COLLECTED');
    expect(hubB.state).toBe('OPEN');
    expect(hubA.witnesses).not.toBe(hubB.witnesses);
  });

  test('witness array is copied (external mutation does not affect hub)', () => {
    const engine = new CryptoPolicyEngine();
    const hub = new PqcDirectAccumulatorMembershipGatingHub('t1', engine);
    const external = new Array(8).fill('w');
    hub.collectWitnesses(external);
    external.push('extra');
    expect(hub.witnesses.length).toBe(8);
  });
});
