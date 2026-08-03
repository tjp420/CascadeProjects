'use strict';

/**
 * Track 71: PQ Identity Gating tests.
 */
const { PqcIdentityGatingHub } = require('../pqc-identity-gating-hub.cjs');
const { ZkIdentityGatingValidator } = require('../zk-identity-gating-validator.cjs');
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
  minAttestationQuorum: 3,
  maxAttestationContractLifetimeSeconds: 31536000,
  maxCredentialDepth: 16,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireIdentityInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderIdentityClaims: true,
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
    blindedRawCredentialCommitment: 'pedersen-cred-001',
    blindedAttributeMetricCommitment: 'pedersen-attr-001',
    blindedIdentityHashCommitment: 'pedersen-idhash-001',
    attestationContractLifetimeSeconds: 15552000,
    credentialDepth: 8,
    pqcSignatureScheme: 'ML-DSA-65',
    identityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedAttributeMetricCommitment: 'pedersen-attr-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkAttributeRangeProofHash: 'zk-attribute-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    contractLifetimeSeconds: 15552000,
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
  const hub = new PqcIdentityGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkIdentityGatingValidator({
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
  const claim = ctx.validator.verifyAttributeClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 71 PQ identity gating', () => {
  test('PqcIdentityGatingHub initializes a pool and emits IDENTITY_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'IDENTITY_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkIdentityGatingValidator verifies an attribute claim and emits ZK_ATTRIBUTE_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyAttributeClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_ATTRIBUTE_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcIdentityGatingHub completes gating after claim and emits SOVEREIGN_IDENTITY_GATING_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeGating(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'SOVEREIGN_IDENTITY_GATING_COMPLETED')).toBe(true);
  });

  test('PqcIdentityGatingHub rejects attestation contract lifetime exceeding maximum', () => {
    const hub = new PqcIdentityGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.attestationContractLifetimeSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcIdentityGatingHub rejects credential depth exceeding maximum', () => {
    const hub = new PqcIdentityGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.credentialDepth = 32;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcIdentityGatingHub rejects un-attested identity initializer', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcIdentityGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.identityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkIdentityGatingValidator rejects un-attested clearing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkIdentityGatingValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyAttributeClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcIdentityGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcIdentityGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcIdentityGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcIdentityGatingHub rejects gating completion before attribute claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeGating(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcIdentityGatingHub rejects gating completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeGating(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkIdentityGatingValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkAttributeRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyAttributeClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkIdentityGatingValidator bans peers broadcasting out-of-bounds contract lifetimes', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.contractLifetimeSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyAttributeClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkIdentityGatingValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyAttributeClaim(clReq);
    expect(() => validator.verifyAttributeClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq identity gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqIdentityGating', {
      attestationQuorum: 3,
      attestationContractLifetimeSeconds: 15552000,
      credentialDepth: 8,
      pqcSignatureScheme: 'ML-DSA-65',
      identityInitializerAttestation: true,
      clearingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderIdentityClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqIdentityGating', { attestationQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { attestationContractLifetimeSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { credentialDepth: 32 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { identityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { clearingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { banMalformedOrOutOfOrderIdentityClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqIdentityGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
