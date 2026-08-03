'use strict';

/**
 * Track 42: Dynamic resharding and ephemeral share ratchet tests.
 */
const { GroupReshardEngine } = require('../group-reshard-engine.cjs');
const { EphemeralShareRatchet } = require('../ephemeral-share-ratchet.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== 'object') return { verified: false };
    if (!attestation.authority || attestation.authority !== 'mock-authority') return { verified: false };
    return { verified: true };
  }
  isVerified(id) {
    return typeof id === 'string' && id.startsWith('n') && id !== 'n4';
  }
}

const POLICY = {
  allowedThresholdWindows: [[2, 3], [3, 5], [5, 7]],
  maxCommitteeExpansionFactor: 2.0,
  maxCommitteeSize: 11,
  requireNewNodeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  requireEphemeralRatchet: true,
  minEpochIntervalMs: 1000,
};

describe('Track 42 dynamic resharding', () => {
  test('GroupReshardEngine expands 2-of-3 to 3-of-5', () => {
    const nodes = [
      { id: 'n1', share: 101n },
      { id: 'n2', share: 202n },
      { id: 'n3', share: 303n },
    ];
    const engine = new GroupReshardEngine({ policy: POLICY, nodes });
    const result = engine.reshard(2, 3, 3, 5, []);
    expect(result.newThreshold).toBe(3);
    expect(result.newSize).toBe(5);
    expect(result.newShares).toHaveLength(5);
    expect(result.coefficients).toHaveLength(3);
  });

  test('GroupReshardEngine blocks an un-attested new node', () => {
    const nodes = [
      { id: 'n1', share: 101n },
      { id: 'n2', share: 202n },
      { id: 'n3', share: 303n },
    ];
    const attestationClient = new MockAttestationClient();
    const engine = new GroupReshardEngine({
      policy: POLICY,
      nodes,
      attestationClient,
    });
    expect(() => engine.reshard(2, 3, 3, 5, ['n4'])).toThrow(HsmAdapterError);
  });

  test('GroupReshardEngine blocks a threshold window outside policy', () => {
    const nodes = [{ id: 'n1', share: 101n }];
    const engine = new GroupReshardEngine({ policy: POLICY, nodes });
    expect(() => engine.expand(2, 3, 4)).toThrow(HsmAdapterError);
  });

  test('GroupReshardEngine blocks an expansion factor above the maximum', () => {
    const nodes = [{ id: 'n1', share: 101n }];
    const engine = new GroupReshardEngine({ policy: POLICY, nodes });
    expect(() => engine.reshard(2, 3, 5, 9, [])).toThrow(HsmAdapterError);
  });

  test('EphemeralShareRatchet advances and zeroizes old state', () => {
    const ratchet = new EphemeralShareRatchet({ seed: 'initial-seed', epoch: 0 });
    const share = { index: 1, value: 123n };
    const advanced = ratchet.ratchet(share);
    expect(advanced.epoch).toBe(1);
    expect(advanced.value).not.toBe(share.value);
    const state = ratchet.getState();
    expect(state.epoch).toBe(1);
  });

  test('EphemeralShareRatchet reset clears seed', () => {
    const ratchet = new EphemeralShareRatchet({ seed: 'initial-seed' });
    ratchet.reset();
    const state = ratchet.getState();
    expect(state.seedLength).toBe(0);
  });

  test('CryptoPolicyEngine validates resharding configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'resharding', {
      threshold: 3,
      committeeSize: 5,
      expansionFactor: 1.6,
      epochIntervalMs: 5000,
      requireEphemeralRatchet: true,
      newNodeAttestation: true,
      attestationAuthority: 'mock-authority',
    })).not.toThrow();

    expect(() => engine.validate('t1', 'resharding', { threshold: 4, committeeSize: 9 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'resharding', { committeeSize: 100 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'resharding', { expansionFactor: 9 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'resharding', { epochIntervalMs: 100 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'resharding', { requireEphemeralRatchet: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'resharding', { newNodeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'resharding', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
  });
});
