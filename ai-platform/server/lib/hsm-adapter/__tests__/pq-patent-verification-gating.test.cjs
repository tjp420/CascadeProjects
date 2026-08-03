'use strict';

/**
 * Track 74: PQ Patent Verification Gating tests.
 */
const { PqcPatentVerificationGatingHub } = require('../pqc-patent-verification-gating-hub.cjs');
const { ZkPatentClaimValidator } = require('../zk-patent-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minLicensingQuorum: 3,
  maxPatentExpirationSeconds: 47304000,
  maxClaimScopeDepth: 32,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requirePatentOfficeInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderPatentClaims: true,
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
    blindedPatentClaimCommitment: 'pedersen-patent-001',
    blindedLicensingMetricCommitment: 'pedersen-lic-001',
    blindedInventorHashCommitment: 'pedersen-inventor-001',
    patentExpirationSeconds: 23652000,
    claimScopeDepth: 16,
    pqcSignatureScheme: 'ML-DSA-65',
    patentOfficeInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedLicensingMetricCommitment: 'pedersen-lic-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkPatentRangeProofHash: 'zk-patent-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    patentExpirationSeconds: 23652000,
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
  const hub = new PqcPatentVerificationGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkPatentClaimValidator({
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
  const claim = ctx.validator.verifyPatentClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 74 PQ patent verification gating', () => {
  test('PqcPatentVerificationGatingHub initializes a pool and emits PATENT_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'PATENT_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkPatentClaimValidator verifies a patent claim and emits ZK_PATENT_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyPatentClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_PATENT_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcPatentVerificationGatingHub completes accreditation after claim and emits PATENT_LICENSE_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'PATENT_LICENSE_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcPatentVerificationGatingHub rejects patent expiration exceeding maximum', () => {
    const hub = new PqcPatentVerificationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.patentExpirationSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcPatentVerificationGatingHub rejects claim scope depth exceeding maximum', () => {
    const hub = new PqcPatentVerificationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.claimScopeDepth = 64;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcPatentVerificationGatingHub rejects un-attested patent office initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcPatentVerificationGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.patentOfficeInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkPatentClaimValidator rejects un-attested clearing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkPatentClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyPatentClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcPatentVerificationGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcPatentVerificationGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcPatentVerificationGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcPatentVerificationGatingHub rejects accreditation completion before patent claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcPatentVerificationGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkPatentClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkPatentRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyPatentClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkPatentClaimValidator bans peers broadcasting out-of-bounds patent expirations', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.patentExpirationSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyPatentClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkPatentClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyPatentClaim(clReq);
    expect(() => validator.verifyPatentClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq patent gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqPatentGating', {
      licensingQuorum: 3,
      patentExpirationSeconds: 23652000,
      claimScopeDepth: 16,
      pqcSignatureScheme: 'ML-DSA-65',
      patentOfficeInitializerAttestation: true,
      clearingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderPatentClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqPatentGating', { licensingQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { patentExpirationSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { claimScopeDepth: 64 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { patentOfficeInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { clearingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { banMalformedOrOutOfOrderPatentClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqPatentGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
