'use strict';

/**
 * Track 92: PQ Global Health Epidemiological Surveillance Gating tests.
 */
const { PqcGlobalHealthEpidemiologicalSurveillanceGatingHub } = require('../pqc-global-health-epidemiological-surveillance-gating-hub.cjs');
const { ZkEpidemiologicalClaimValidator } = require('../zk-epidemiological-claim-validator.cjs');
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
  minEpidemiologyQuorum: 5,
  maxSurveillanceWindowSeconds: 604800,
  maxGenomicChainDepth: 16,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireWhoAuthorityInitializerAttestation: true,
  requireEpidemiologyOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderEpidemiologicalClaims: true,
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
    blindedCaseTelemetryCommitment: 'pedersen-casetelemetry-001',
    blindedGenomicSequenceCommitment: 'pedersen-genomic-001',
    blindedHealthAuthorityIdentityCommitment: 'pedersen-healthauth-001',
    surveillanceWindowSeconds: 302400,
    genomicChainDepth: 8,
    pqcSignatureScheme: 'ML-DSA-65',
    whoAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedGenomicSequenceCommitment: 'pedersen-genomic-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkEpidemiologicalRangeProofHash: 'zk-epidemiological-proof-001',
    epidemiologyOversightCommitteeAttestation: mockAttestation(),
    epidemiologyOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    functionalEncryptionKeyDigest: 'fe-key-digest-001',
    surveillanceWindowSeconds: 302400,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    epidemiologyOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c', 'sig-d', 'sig-e'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcGlobalHealthEpidemiologicalSurveillanceGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkEpidemiologicalClaimValidator({
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
  const claim = ctx.validator.verifyEpidemiologicalClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 92 PQ global health epidemiological surveillance gating', () => {
  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub initializes a pool and emits EPIDEMIOLOGY_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'EPIDEMIOLOGY_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkEpidemiologicalClaimValidator verifies an epidemiological claim and emits ZK_EPIDEMIOLOGICAL_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyEpidemiologicalClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_EPIDEMIOLOGICAL_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub completes accreditation after claim and emits OUTBREAK_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'OUTBREAK_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub rejects surveillance window exceeding maximum', () => {
    const hub = new PqcGlobalHealthEpidemiologicalSurveillanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.surveillanceWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub rejects genomic chain depth exceeding maximum', () => {
    const hub = new PqcGlobalHealthEpidemiologicalSurveillanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.genomicChainDepth = 32;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub rejects un-attested WHO authority initializer', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcGlobalHealthEpidemiologicalSurveillanceGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.whoAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkEpidemiologicalClaimValidator rejects un-attested epidemiology oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkEpidemiologicalClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.epidemiologyOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyEpidemiologicalClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcGlobalHealthEpidemiologicalSurveillanceGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub rejects accreditation completion before epidemiological claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcGlobalHealthEpidemiologicalSurveillanceGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a', 'sig-b', 'sig-c'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkEpidemiologicalClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkEpidemiologicalRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyEpidemiologicalClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkEpidemiologicalClaimValidator bans peers broadcasting out-of-bounds surveillance windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.surveillanceWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyEpidemiologicalClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkEpidemiologicalClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyEpidemiologicalClaim(clReq);
    expect(() => validator.verifyEpidemiologicalClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq epidemiology gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', {
      epidemiologyQuorum: 5,
      surveillanceWindowSeconds: 302400,
      genomicChainDepth: 8,
      pqcSignatureScheme: 'ML-DSA-65',
      whoAuthorityInitializerAttestation: true,
      epidemiologyOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderEpidemiologicalClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { epidemiologyQuorum: 2 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { surveillanceWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { genomicChainDepth: 32 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { whoAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { epidemiologyOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { banMalformedOrOutOfOrderEpidemiologicalClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEpidemiologyGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
