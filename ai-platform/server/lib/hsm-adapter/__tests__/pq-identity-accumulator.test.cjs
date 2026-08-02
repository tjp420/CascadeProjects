'use strict';

/**
 * Track 57: Post-Quantum ZK Identity Accumulator tests.
 */
const { PqIdentityAccumulator } = require('../pq-identity-accumulator.cjs');
const { ZkMembershipProofProcessor } = require('../zk-membership-proof-processor.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  maxTreeDepth: 20,
  allowedMembershipProofSystems: ['groth16', 'plonk', 'marlin'],
  mandatoryUpdateEpochSeconds: 3600,
  requireRootUpdateAttestation: true,
  requireMembershipProofAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedMembershipPeers: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
    signature: 'mock-signature-placeholder',
  };
}

function mockPublicKey(id) {
  return `pq-pubkey-${id}-${'x'.repeat(32)}`;
}

describe('Track 57 PQ identity accumulator', () => {
  test('PqIdentityAccumulator adds a member and emits IDENTITY_ACCUMULATOR_UPDATED', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const accumulator = new PqIdentityAccumulator({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = accumulator.addMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    expect(result.status).toBe('updated');
    expect(result.rootHash).toBeDefined();
    expect(result.memberCount).toBe(1);
    expect(events.some((e) => e.event === 'IDENTITY_ACCUMULATOR_UPDATED')).toBe(true);
  });

  test('PqIdentityAccumulator supports real-time state updates', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const accumulator = new PqIdentityAccumulator({
      policy: POLICY,
      attestationClient,
    });
    accumulator.addMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    const r1 = accumulator.getState();
    accumulator.addMember({
      publicKey: mockPublicKey('b'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    const r2 = accumulator.getState();
    expect(r2.memberCount).toBe(2);
    expect(r2.rootHash).not.toBe(r1.rootHash);
  });

  test('PqIdentityAccumulator rejects un-attested root update', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const accumulator = new PqIdentityAccumulator({
      policy: POLICY,
      attestationClient,
    });
    expect(() => accumulator.addMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: { authority: 'bad' },
      attestationAuthority: 'mock-authority',
    })).toThrow(HsmAdapterError);
  });

  test('PqIdentityAccumulator rejects unpermitted attestation authority', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const accumulator = new PqIdentityAccumulator({
      policy: POLICY,
      attestationClient,
    });
    expect(() => accumulator.addMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'bad-authority',
    })).toThrow(HsmAdapterError);
  });

  test('PqIdentityAccumulator rejects duplicate member', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const accumulator = new PqIdentityAccumulator({
      policy: POLICY,
      attestationClient,
    });
    accumulator.addMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    expect(() => accumulator.addMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    })).toThrow(HsmAdapterError);
  });

  test('PqIdentityAccumulator removes a member and updates root', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const accumulator = new PqIdentityAccumulator({
      policy: POLICY,
      attestationClient,
    });
    accumulator.addMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    const r1 = accumulator.getState();
    accumulator.removeMember({
      publicKey: mockPublicKey('a'),
      sourceTenantId: 'tenant-a',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    const r2 = accumulator.getState();
    expect(r2.memberCount).toBe(0);
    expect(r2.rootHash).toBeNull();
  });

  test('ZkMembershipProofProcessor validates a valid membership proof', () => {
    const events = [];
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const processor = new ZkMembershipProofProcessor({
      policy: POLICY,
      attestationClient,
      audit: (event, info) => events.push({ event, info }),
    });
    const result = processor.verifyProof({
      rootHashReference: 'root-abc',
      expectedRootHash: 'root-abc',
      proof: 'mock-zk-proof-payload',
      membershipProofSystem: 'groth16',
      claimType: 'membership',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    expect(result.verified).toBe(true);
    expect(events.some((e) => e.event === 'ZK_MEMBERSHIP_CLAIM_VALIDATED')).toBe(true);
  });

  test('ZkMembershipProofProcessor validates a valid non-membership proof', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const processor = new ZkMembershipProofProcessor({
      policy: POLICY,
      attestationClient,
    });
    const result = processor.verifyProof({
      rootHashReference: 'root-abc',
      expectedRootHash: 'root-abc',
      proof: 'mock-zk-proof-non-membership',
      membershipProofSystem: 'plonk',
      claimType: 'non-membership',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    });
    expect(result.verified).toBe(true);
    expect(result.claimType).toBe('non-membership');
  });

  test('ZkMembershipProofProcessor bans peers broadcasting malformed proofs', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const processor = new ZkMembershipProofProcessor({
      policy: POLICY,
      attestationClient,
    });
    expect(() => processor.verifyProof({
      rootHashReference: 'root-abc',
      expectedRootHash: 'root-different',
      proof: 'mock-zk-proof-payload',
      membershipProofSystem: 'groth16',
      claimType: 'membership',
      peerId: 'peer-bad',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    })).toThrow(HsmAdapterError);
    expect(processor.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkMembershipProofProcessor rejects unpermitted membership proof system', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const processor = new ZkMembershipProofProcessor({
      policy: POLICY,
      attestationClient,
    });
    expect(() => processor.verifyProof({
      rootHashReference: 'root-abc',
      expectedRootHash: 'root-abc',
      proof: 'mock-zk-proof-payload',
      membershipProofSystem: 'bulletproofs',
      claimType: 'membership',
      attestation: mockAttestation(),
      attestationAuthority: 'mock-authority',
    })).toThrow(HsmAdapterError);
  });

  test('ZkMembershipProofProcessor rejects un-attested membership proof', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const processor = new ZkMembershipProofProcessor({
      policy: POLICY,
      attestationClient,
    });
    expect(() => processor.verifyProof({
      rootHashReference: 'root-abc',
      expectedRootHash: 'root-abc',
      proof: 'mock-zk-proof-payload',
      membershipProofSystem: 'groth16',
      claimType: 'membership',
      attestation: { authority: 'bad' },
      attestationAuthority: 'mock-authority',
    })).toThrow(HsmAdapterError);
  });

  test('CryptoPolicyEngine validates pq identity accumulator configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', {
      treeDepth: 10,
      membershipProofSystem: 'groth16',
      updateEpochSeconds: 3600,
      rootUpdateAttestation: true,
      membershipProofAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedMembershipPeers: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { treeDepth: 32 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { membershipProofSystem: 'bulletproofs' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { updateEpochSeconds: 60 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { rootUpdateAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { membershipProofAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { banMalformedMembershipPeers: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityAccumulator', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
