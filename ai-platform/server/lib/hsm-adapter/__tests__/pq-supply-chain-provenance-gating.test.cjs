'use strict';

/**
 * Track 76: PQ Supply Chain Provenance Gating tests.
 */
const { PqcSupplyChainProvenanceGatingHub } = require('../pqc-supply-chain-provenance-gating-hub.cjs');
const { ZkProvenanceClaimValidator } = require('../zk-provenance-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== 'object') return { verified: false };
    if (!attestation.authority || attestation.authority !== 'mock-authority') return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minSupplierCheckpointQuorum: 3,
  maxTransitExpirationSeconds: 7776000,
  maxComponentLineageDepth: 64,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireFactoryEndpointInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderProvenanceClaims: true,
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

function baseInitRequest() {
  return {
    sourceTenantId: 'tenant-a',
    targetChainId: 'chain-b',
    blindedLineageCommitment: 'pedersen-lineage-001',
    blindedSupplierHashCommitment: 'pedersen-supplier-001',
    blindedManufacturingMetricCommitment: 'pedersen-mfg-001',
    transitExpirationSeconds: 3888000,
    componentLineageDepth: 32,
    pqcSignatureScheme: 'ML-DSA-65',
    factoryEndpointInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedSupplierHashCommitment: 'pedersen-supplier-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkProvenanceRangeProofHash: 'zk-provenance-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    transitExpirationSeconds: 3888000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcSupplyChainProvenanceGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkProvenanceClaimValidator({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyProvenanceClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 76 PQ supply chain provenance gating', () => {
  test('PqcSupplyChainProvenanceGatingHub initializes a pool and emits SUPPLY_CHAIN_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'SUPPLY_CHAIN_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkProvenanceClaimValidator verifies a provenance claim and emits ZK_PROVENANCE_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyProvenanceClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_PROVENANCE_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcSupplyChainProvenanceGatingHub completes accreditation after claim and emits COMPONENT_LINEAGE_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'COMPONENT_LINEAGE_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcSupplyChainProvenanceGatingHub rejects transit expiration exceeding maximum', () => {
    const hub = new PqcSupplyChainProvenanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.transitExpirationSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSupplyChainProvenanceGatingHub rejects component lineage depth exceeding maximum', () => {
    const hub = new PqcSupplyChainProvenanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.componentLineageDepth = 128;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSupplyChainProvenanceGatingHub rejects un-attested factory endpoint initializer', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcSupplyChainProvenanceGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.factoryEndpointInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkProvenanceClaimValidator rejects un-attested clearing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkProvenanceClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyProvenanceClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcSupplyChainProvenanceGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcSupplyChainProvenanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSupplyChainProvenanceGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSupplyChainProvenanceGatingHub rejects accreditation completion before provenance claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcSupplyChainProvenanceGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkProvenanceClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkProvenanceRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyProvenanceClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkProvenanceClaimValidator bans peers broadcasting out-of-bounds transit expirations', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.transitExpirationSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyProvenanceClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkProvenanceClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyProvenanceClaim(clReq);
    expect(() => validator.verifyProvenanceClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq supply chain gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqSupplyChainGating', {
      supplierCheckpointQuorum: 3,
      transitExpirationSeconds: 3888000,
      componentLineageDepth: 32,
      pqcSignatureScheme: 'ML-DSA-65',
      factoryEndpointInitializerAttestation: true,
      clearingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderProvenanceClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqSupplyChainGating', { supplierCheckpointQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { transitExpirationSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { componentLineageDepth: 128 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { factoryEndpointInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { clearingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { banMalformedOrOutOfOrderProvenanceClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSupplyChainGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
