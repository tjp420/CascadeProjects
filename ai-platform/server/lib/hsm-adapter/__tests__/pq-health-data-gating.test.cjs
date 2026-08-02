'use strict';

/**
 * Track 72: PQ Health Data Gating tests.
 */
const { PqcHealthDataGatingHub } = require('../pqc-health-data-gating-hub.cjs');
const { ZkHealthAttributeValidator } = require('../zk-health-attribute-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minVerificationQuorum: 3,
  maxRecordExpirationLifetimeSeconds: 7776000,
  maxDiagnosticObservationDepth: 32,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireRecordInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderHealthClaims: true,
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
    blindedRawMedicalRecordCommitment: 'pedersen-medrecord-001',
    blindedDiagnosticObservationCommitment: 'pedersen-diagobs-001',
    blindedPatientIdentityHashCommitment: 'pedersen-patienthash-001',
    recordExpirationLifetimeSeconds: 2592000,
    diagnosticObservationDepth: 16,
    pqcSignatureScheme: 'ML-DSA-65',
    recordInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedDiagnosticObservationCommitment: 'pedersen-diagobs-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkHealthRangeProofHash: 'zk-health-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    recordExpirationLifetimeSeconds: 2592000,
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
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcHealthDataGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkHealthAttributeValidator({
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
  const claim = ctx.validator.verifyHealthClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 72 PQ health data gating', () => {
  test('PqcHealthDataGatingHub initializes a pool and emits HEALTH_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'HEALTH_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkHealthAttributeValidator verifies a health claim and emits ZK_HEALTH_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyHealthClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_HEALTH_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcHealthDataGatingHub completes gating after claim and emits HEALTH_RECORD_GATING_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeGating(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'HEALTH_RECORD_GATING_COMPLETED')).toBe(true);
  });

  test('PqcHealthDataGatingHub rejects record expiration lifetime exceeding maximum', () => {
    const hub = new PqcHealthDataGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.recordExpirationLifetimeSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthDataGatingHub rejects diagnostic observation depth exceeding maximum', () => {
    const hub = new PqcHealthDataGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.diagnosticObservationDepth = 64;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthDataGatingHub rejects un-attested record initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcHealthDataGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.recordInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkHealthAttributeValidator rejects un-attested clearing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkHealthAttributeValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyHealthClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcHealthDataGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcHealthDataGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthDataGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthDataGatingHub rejects gating completion before health claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeGating(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcHealthDataGatingHub rejects gating completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeGating(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkHealthAttributeValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkHealthRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyHealthClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkHealthAttributeValidator bans peers broadcasting out-of-bounds expiration lifetimes', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.recordExpirationLifetimeSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyHealthClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkHealthAttributeValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyHealthClaim(clReq);
    expect(() => validator.verifyHealthClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq health data gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqHealthDataGating', {
      verificationQuorum: 3,
      recordExpirationLifetimeSeconds: 2592000,
      diagnosticObservationDepth: 16,
      pqcSignatureScheme: 'ML-DSA-65',
      recordInitializerAttestation: true,
      clearingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderHealthClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqHealthDataGating', { verificationQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { recordExpirationLifetimeSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { diagnosticObservationDepth: 64 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { recordInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { clearingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { banMalformedOrOutOfOrderHealthClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHealthDataGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
