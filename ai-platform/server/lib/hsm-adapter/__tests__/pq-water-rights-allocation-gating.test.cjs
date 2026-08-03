'use strict';

/**
 * Track 88: PQ Water Rights Allocation Gating tests.
 */
const { PqcWaterRightsAllocationGatingHub } = require('../pqc-water-rights-allocation-gating-hub.cjs');
const { ZkWaterRightsClaimValidator } = require('../zk-water-rights-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minWatershedQuorum: 4,
  maxAllocationWindowSeconds: 31536000,
  maxFlowChainDepth: 20,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireWaterAuthorityInitializerAttestation: true,
  requireWatershedOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderWaterClaims: true,
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
    blindedWaterAllocationCommitment: 'pedersen-allocation-001',
    blindedWatershedFlowCommitment: 'pedersen-flow-001',
    blindedRiparianRightsCommitment: 'pedersen-riparian-001',
    allocationWindowSeconds: 15768000,
    flowChainDepth: 10,
    pqcSignatureScheme: 'ML-DSA-65',
    waterAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedWatershedFlowCommitment: 'pedersen-flow-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkWaterRangeProofHash: 'zk-water-proof-001',
    watershedOversightCommitteeAttestation: mockAttestation(),
    watershedOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    mpcProof: 'mpc-proof-001',
    allocationWindowSeconds: 15768000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    watershedOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c', 'sig-d'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcWaterRightsAllocationGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkWaterRightsClaimValidator({
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
  const claim = ctx.validator.verifyWaterClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 88 PQ water rights allocation gating', () => {
  test('PqcWaterRightsAllocationGatingHub initializes a pool and emits WATER_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'WATER_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkWaterRightsClaimValidator verifies a water claim and emits ZK_WATER_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyWaterClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_WATER_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcWaterRightsAllocationGatingHub completes accreditation after claim and emits WATERSHED_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'WATERSHED_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcWaterRightsAllocationGatingHub rejects allocation window exceeding maximum', () => {
    const hub = new PqcWaterRightsAllocationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.allocationWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWaterRightsAllocationGatingHub rejects flow chain depth exceeding maximum', () => {
    const hub = new PqcWaterRightsAllocationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.flowChainDepth = 40;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWaterRightsAllocationGatingHub rejects un-attested water authority initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcWaterRightsAllocationGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.waterAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkWaterRightsClaimValidator rejects un-attested watershed oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkWaterRightsClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.watershedOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyWaterClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcWaterRightsAllocationGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcWaterRightsAllocationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWaterRightsAllocationGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWaterRightsAllocationGatingHub rejects accreditation completion before water claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcWaterRightsAllocationGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a', 'sig-b'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkWaterRightsClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkWaterRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyWaterClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkWaterRightsClaimValidator bans peers broadcasting out-of-bounds allocation windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.allocationWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyWaterClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkWaterRightsClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyWaterClaim(clReq);
    expect(() => validator.verifyWaterClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq water gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqWaterGating', {
      watershedQuorum: 4,
      allocationWindowSeconds: 15768000,
      flowChainDepth: 10,
      pqcSignatureScheme: 'ML-DSA-65',
      waterAuthorityInitializerAttestation: true,
      watershedOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderWaterClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqWaterGating', { watershedQuorum: 2 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { allocationWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { flowChainDepth: 40 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { waterAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { watershedOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { banMalformedOrOutOfOrderWaterClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWaterGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
