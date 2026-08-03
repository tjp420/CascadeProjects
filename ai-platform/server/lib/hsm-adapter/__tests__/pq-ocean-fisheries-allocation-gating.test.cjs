'use strict';

/**
 * Track 94: PQ Ocean Fisheries Allocation Gating tests.
 */
const { PqcOceanFisheriesAllocationGatingHub } = require('../pqc-ocean-fisheries-allocation-gating-hub.cjs');
const { ZkCatchClaimValidator } = require('../zk-catch-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minMaritimeQuorum: 5,
  maxCatchTrackingWindowSeconds: 2592000,
  maxVesselTelemetryChainDepth: 12,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireRfmoAuthorityInitializerAttestation: true,
  requireMarineSanctuaryOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderCatchClaims: true,
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
    blindedCatchTelemetryCommitment: 'pedersen-catchtelemetry-001',
    blindedQuotaAllocationCommitment: 'pedersen-quota-001',
    blindedMaritimeAuthorityIdentityCommitment: 'pedersen-maritime-001',
    catchTrackingWindowSeconds: 1296000,
    vesselTelemetryChainDepth: 6,
    pqcSignatureScheme: 'ML-DSA-65',
    rfmoAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedQuotaAllocationCommitment: 'pedersen-quota-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkCatchRangeProofHash: 'zk-catch-proof-001',
    marineSanctuaryOversightCommitteeAttestation: mockAttestation(),
    marineSanctuaryOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    proxyReEncryptionKeyDigest: 'pre-key-digest-001',
    catchTrackingWindowSeconds: 1296000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    marineSanctuaryOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c', 'sig-d', 'sig-e'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcOceanFisheriesAllocationGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkCatchClaimValidator({
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
  const claim = ctx.validator.verifyCatchClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 94 PQ ocean fisheries allocation gating', () => {
  test('PqcOceanFisheriesAllocationGatingHub initializes a pool and emits FISHERIES_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'FISHERIES_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkCatchClaimValidator verifies a catch claim and emits ZK_CATCH_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyCatchClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.proxyReEncryptionKeyDigest).toBe('pre-key-digest-001');
    expect(events.some((e) => e.event === 'ZK_CATCH_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcOceanFisheriesAllocationGatingHub completes accreditation after claim and emits QUOTA_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'QUOTA_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcOceanFisheriesAllocationGatingHub rejects catch tracking window exceeding maximum', () => {
    const hub = new PqcOceanFisheriesAllocationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.catchTrackingWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcOceanFisheriesAllocationGatingHub rejects vessel telemetry chain depth exceeding maximum', () => {
    const hub = new PqcOceanFisheriesAllocationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.vesselTelemetryChainDepth = 24;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcOceanFisheriesAllocationGatingHub rejects un-attested RFMO authority initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcOceanFisheriesAllocationGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.rfmoAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkCatchClaimValidator rejects un-attested marine sanctuary oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkCatchClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.marineSanctuaryOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyCatchClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcOceanFisheriesAllocationGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcOceanFisheriesAllocationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcOceanFisheriesAllocationGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcOceanFisheriesAllocationGatingHub rejects accreditation completion before catch claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcOceanFisheriesAllocationGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a', 'sig-b', 'sig-c'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkCatchClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkCatchRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyCatchClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkCatchClaimValidator bans peers broadcasting missing proxy re-encryption key digest', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.proxyReEncryptionKeyDigest = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyCatchClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkCatchClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyCatchClaim(clReq);
    expect(() => validator.verifyCatchClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq fisheries gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqFisheriesGating', {
      maritimeQuorum: 5,
      catchTrackingWindowSeconds: 1296000,
      vesselTelemetryChainDepth: 6,
      pqcSignatureScheme: 'ML-DSA-65',
      rfmoAuthorityInitializerAttestation: true,
      marineSanctuaryOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderCatchClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqFisheriesGating', { maritimeQuorum: 2 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { catchTrackingWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { vesselTelemetryChainDepth: 24 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { rfmoAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { marineSanctuaryOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { banMalformedOrOutOfOrderCatchClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqFisheriesGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
