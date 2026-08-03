'use strict';

/**
 * Track 87: PQ Space-Asset Telemetry Gating tests.
 */
const { PqcSpaceAssetTelemetryGatingHub } = require('../pqc-space-asset-telemetry-gating-hub.cjs');
const { ZkOrbitalSlotClaimValidator } = require('../zk-orbital-slot-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minOrbitalSlotQuorum: 5,
  maxSlotAllocationWindowSeconds: 31536000,
  maxTelemetryChainDepth: 16,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireSpaceAuthorityInitializerAttestation: true,
  requireOrbitalOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderOrbitalClaims: true,
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
    blindedOrbitalTelemetryCommitment: 'pedersen-telemetry-001',
    blindedSlotAllocationCommitment: 'pedersen-slot-001',
    blindedSatelliteIdentityCommitment: 'pedersen-satellite-001',
    slotAllocationWindowSeconds: 15768000,
    telemetryChainDepth: 8,
    pqcSignatureScheme: 'ML-DSA-65',
    spaceAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedSlotAllocationCommitment: 'pedersen-slot-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkOrbitalRangeProofHash: 'zk-orbital-proof-001',
    orbitalOversightCommitteeAttestation: mockAttestation(),
    orbitalOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    thresholdSignature: 'threshold-sig-001',
    slotAllocationWindowSeconds: 15768000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    orbitalOversightCommitteeAttestation: mockAttestation(),
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
  const hub = new PqcSpaceAssetTelemetryGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkOrbitalSlotClaimValidator({
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
  const claim = ctx.validator.verifyTelemetryClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 87 PQ space-asset telemetry gating', () => {
  test('PqcSpaceAssetTelemetryGatingHub initializes a pool and emits ORBITAL_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'ORBITAL_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkOrbitalSlotClaimValidator verifies a telemetry claim and emits ZK_TELEMETRY_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyTelemetryClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_TELEMETRY_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcSpaceAssetTelemetryGatingHub completes accreditation after claim and emits ORBITAL_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'ORBITAL_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcSpaceAssetTelemetryGatingHub rejects slot allocation window exceeding maximum', () => {
    const hub = new PqcSpaceAssetTelemetryGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.slotAllocationWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSpaceAssetTelemetryGatingHub rejects telemetry chain depth exceeding maximum', () => {
    const hub = new PqcSpaceAssetTelemetryGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.telemetryChainDepth = 32;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSpaceAssetTelemetryGatingHub rejects un-attested space authority initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcSpaceAssetTelemetryGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.spaceAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkOrbitalSlotClaimValidator rejects un-attested orbital oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkOrbitalSlotClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.orbitalOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyTelemetryClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcSpaceAssetTelemetryGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcSpaceAssetTelemetryGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSpaceAssetTelemetryGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSpaceAssetTelemetryGatingHub rejects accreditation completion before telemetry claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcSpaceAssetTelemetryGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a', 'sig-b'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkOrbitalSlotClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkOrbitalRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyTelemetryClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkOrbitalSlotClaimValidator bans peers broadcasting out-of-bounds slot windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.slotAllocationWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyTelemetryClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkOrbitalSlotClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyTelemetryClaim(clReq);
    expect(() => validator.verifyTelemetryClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq space gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqSpaceGating', {
      orbitalSlotQuorum: 5,
      slotAllocationWindowSeconds: 15768000,
      telemetryChainDepth: 8,
      pqcSignatureScheme: 'ML-DSA-65',
      spaceAuthorityInitializerAttestation: true,
      orbitalOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderOrbitalClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqSpaceGating', { orbitalSlotQuorum: 3 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { slotAllocationWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { telemetryChainDepth: 32 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { spaceAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { orbitalOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { banMalformedOrOutOfOrderOrbitalClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSpaceGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
