'use strict';

/**
 * Track 93: PQ Cultural Heritage Provenance Gating tests.
 */
const { PqcCulturalHeritageProvenanceGatingHub } = require('../pqc-cultural-heritage-provenance-gating-hub.cjs');
const { ZkAuthenticationClaimValidator } = require('../zk-authentication-claim-validator.cjs');
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
  minAuthenticationQuorum: 4,
  maxAuthenticationWindowSeconds: 15552000,
  maxProvenanceChainDepth: 20,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireUnescoAuthorityInitializerAttestation: true,
  requireCulturalHeritageOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderAuthenticationClaims: true,
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
    blindedMaterialCompositionCommitment: 'pedersen-material-001',
    blindedProvenanceChainCommitment: 'pedersen-provenance-001',
    blindedCollectorIdentityCommitment: 'pedersen-collector-001',
    authenticationWindowSeconds: 7776000,
    provenanceChainDepth: 10,
    pqcSignatureScheme: 'ML-DSA-65',
    unescoAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedProvenanceChainCommitment: 'pedersen-provenance-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkAuthenticationRangeProofHash: 'zk-authentication-proof-001',
    culturalHeritageOversightCommitteeAttestation: mockAttestation(),
    culturalHeritageOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    fuzzyMatchThreshold: 0.85,
    fuzzyMatchProofHash: 'fuzzy-match-proof-001',
    authenticationWindowSeconds: 7776000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    culturalHeritageOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c', 'sig-d'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcCulturalHeritageProvenanceGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkAuthenticationClaimValidator({
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
  const claim = ctx.validator.verifyAuthenticationClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 93 PQ cultural heritage provenance gating', () => {
  test('PqcCulturalHeritageProvenanceGatingHub initializes a pool and emits HERITAGE_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'HERITAGE_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkAuthenticationClaimValidator verifies an authentication claim and emits ZK_AUTHENTICATION_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyAuthenticationClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.fuzzyMatchThreshold).toBe(0.85);
    expect(events.some((e) => e.event === 'ZK_AUTHENTICATION_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcCulturalHeritageProvenanceGatingHub completes accreditation after claim and emits PROVENANCE_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'PROVENANCE_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcCulturalHeritageProvenanceGatingHub rejects authentication window exceeding maximum', () => {
    const hub = new PqcCulturalHeritageProvenanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.authenticationWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCulturalHeritageProvenanceGatingHub rejects provenance chain depth exceeding maximum', () => {
    const hub = new PqcCulturalHeritageProvenanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.provenanceChainDepth = 40;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCulturalHeritageProvenanceGatingHub rejects un-attested UNESCO authority initializer', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcCulturalHeritageProvenanceGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.unescoAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkAuthenticationClaimValidator rejects un-attested cultural heritage oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkAuthenticationClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.culturalHeritageOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyAuthenticationClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcCulturalHeritageProvenanceGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcCulturalHeritageProvenanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCulturalHeritageProvenanceGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCulturalHeritageProvenanceGatingHub rejects accreditation completion before authentication claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcCulturalHeritageProvenanceGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a', 'sig-b'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkAuthenticationClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkAuthenticationRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyAuthenticationClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkAuthenticationClaimValidator bans peers broadcasting invalid fuzzy match thresholds', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.fuzzyMatchThreshold = 1.5;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyAuthenticationClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkAuthenticationClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyAuthenticationClaim(clReq);
    expect(() => validator.verifyAuthenticationClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq heritage gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqHeritageGating', {
      authenticationQuorum: 4,
      authenticationWindowSeconds: 7776000,
      provenanceChainDepth: 10,
      pqcSignatureScheme: 'ML-DSA-65',
      unescoAuthorityInitializerAttestation: true,
      culturalHeritageOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderAuthenticationClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqHeritageGating', { authenticationQuorum: 2 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { authenticationWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { provenanceChainDepth: 40 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { unescoAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { culturalHeritageOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { banMalformedOrOutOfOrderAuthenticationClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqHeritageGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
