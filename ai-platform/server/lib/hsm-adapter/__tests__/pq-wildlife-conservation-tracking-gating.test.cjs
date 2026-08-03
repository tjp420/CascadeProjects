'use strict';

/**
 * Track 90: PQ Wildlife Conservation Tracking Gating tests.
 */
const { PqcWildlifeConservationTrackingGatingHub } = require('../pqc-wildlife-conservation-tracking-gating-hub.cjs');
const { ZkConservationClaimValidator } = require('../zk-conservation-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minConservationQuorum: 4,
  maxMonitoringWindowSeconds: 2592000,
  maxTelemetryChainDepth: 14,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireConservationAuthorityInitializerAttestation: true,
  requireBiodiversityOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderConservationClaims: true,
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
    blindedSpeciesTelemetryCommitment: 'pedersen-species-001',
    blindedHabitatBoundaryCommitment: 'pedersen-habitat-001',
    blindedRangerIdentityCommitment: 'pedersen-ranger-001',
    monitoringWindowSeconds: 1296000,
    telemetryChainDepth: 7,
    pqcSignatureScheme: 'ML-DSA-65',
    conservationAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedHabitatBoundaryCommitment: 'pedersen-habitat-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkConservationRangeProofHash: 'zk-conservation-proof-001',
    biodiversityOversightCommitteeAttestation: mockAttestation(),
    biodiversityOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    linkableRingSignature: 'linkable-ring-sig-001',
    linkabilityTag: 'link-tag-001',
    monitoringWindowSeconds: 1296000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    biodiversityOversightCommitteeAttestation: mockAttestation(),
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
  const hub = new PqcWildlifeConservationTrackingGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkConservationClaimValidator({
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
  const claim = ctx.validator.verifyConservationClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 90 PQ wildlife conservation tracking gating', () => {
  test('PqcWildlifeConservationTrackingGatingHub initializes a pool and emits WILDLIFE_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'WILDLIFE_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkConservationClaimValidator verifies a conservation claim and emits ZK_CONSERVATION_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyConservationClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_CONSERVATION_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcWildlifeConservationTrackingGatingHub completes accreditation after claim and emits BIODIVERSITY_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'BIODIVERSITY_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcWildlifeConservationTrackingGatingHub rejects monitoring window exceeding maximum', () => {
    const hub = new PqcWildlifeConservationTrackingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.monitoringWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWildlifeConservationTrackingGatingHub rejects telemetry chain depth exceeding maximum', () => {
    const hub = new PqcWildlifeConservationTrackingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.telemetryChainDepth = 28;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWildlifeConservationTrackingGatingHub rejects un-attested conservation authority initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcWildlifeConservationTrackingGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.conservationAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkConservationClaimValidator rejects un-attested biodiversity oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkConservationClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.biodiversityOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyConservationClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcWildlifeConservationTrackingGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcWildlifeConservationTrackingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWildlifeConservationTrackingGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcWildlifeConservationTrackingGatingHub rejects accreditation completion before conservation claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcWildlifeConservationTrackingGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a', 'sig-b'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkConservationClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkConservationRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyConservationClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkConservationClaimValidator bans peers broadcasting out-of-bounds monitoring windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.monitoringWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyConservationClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkConservationClaimValidator detects double-reporting via linkability tag and bans peer', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq1 = baseClaimRequest(pool.poolId);
    clReq1.peerId = 'peer-1';
    clReq1.linkabilityTag = 'dup-tag-001';
    validator.verifyConservationClaim(clReq1);
    const clReq2 = baseClaimRequest(pool.poolId);
    clReq2.peerId = 'peer-2';
    clReq2.linkabilityTag = 'dup-tag-001';
    expect(() => validator.verifyConservationClaim(clReq2)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-2')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq wildlife gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqWildlifeGating', {
      conservationQuorum: 4,
      monitoringWindowSeconds: 1296000,
      telemetryChainDepth: 7,
      pqcSignatureScheme: 'ML-DSA-65',
      conservationAuthorityInitializerAttestation: true,
      biodiversityOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderConservationClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqWildlifeGating', { conservationQuorum: 2 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { monitoringWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { telemetryChainDepth: 28 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { conservationAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { biodiversityOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { banMalformedOrOutOfOrderConservationClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqWildlifeGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
