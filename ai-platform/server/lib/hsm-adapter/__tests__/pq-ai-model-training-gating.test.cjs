'use strict';

/**
 * Track 82: PQ AI Model Training Gating tests.
 */
const { PqcAiModelTrainingGatingHub } = require('../pqc-ai-model-training-gating-hub.cjs');
const { ZkTrainingClaimValidator } = require('../zk-training-claim-validator.cjs');
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
  minTrainingOversightQuorum: 3,
  maxTrainingWindowSeconds: 63072000,
  maxProvenanceDepth: 64,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireTrainingAuthorityInitializerAttestation: true,
  requireModelAuditCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderTrainingClaims: true,
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
    blindedModelWeightCommitment: 'pedersen-weights-001',
    blindedDatasetProvenanceCommitment: 'pedersen-dataset-001',
    blindedTrainingMetricCommitment: 'pedersen-metric-001',
    trainingWindowSeconds: 31536000,
    provenanceDepth: 32,
    pqcSignatureScheme: 'ML-DSA-65',
    trainingAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedDatasetProvenanceCommitment: 'pedersen-dataset-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkTrainingRangeProofHash: 'zk-training-proof-001',
    modelAuditCommitteeAttestation: mockAttestation(),
    modelAuditCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    trainingWindowSeconds: 31536000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    modelAuditCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcAiModelTrainingGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkTrainingClaimValidator({
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
  const claim = ctx.validator.verifyTrainingClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 82 PQ AI model training gating', () => {
  test('PqcAiModelTrainingGatingHub initializes a pool and emits TRAINING_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'TRAINING_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkTrainingClaimValidator verifies a training claim and emits ZK_TRAINING_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyTrainingClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_TRAINING_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcAiModelTrainingGatingHub completes accreditation after claim and emits MODEL_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'MODEL_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcAiModelTrainingGatingHub rejects training window exceeding maximum', () => {
    const hub = new PqcAiModelTrainingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.trainingWindowSeconds = 999999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcAiModelTrainingGatingHub rejects provenance depth exceeding maximum', () => {
    const hub = new PqcAiModelTrainingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.provenanceDepth = 128;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcAiModelTrainingGatingHub rejects un-attested training authority initializer', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcAiModelTrainingGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.trainingAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkTrainingClaimValidator rejects un-attested model audit committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkTrainingClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.modelAuditCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyTrainingClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcAiModelTrainingGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcAiModelTrainingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcAiModelTrainingGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcAiModelTrainingGatingHub rejects accreditation completion before training claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcAiModelTrainingGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkTrainingClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkTrainingRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyTrainingClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkTrainingClaimValidator bans peers broadcasting out-of-bounds training windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.trainingWindowSeconds = 999999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyTrainingClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkTrainingClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyTrainingClaim(clReq);
    expect(() => validator.verifyTrainingClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq training gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqTrainingGating', {
      trainingOversightQuorum: 3,
      trainingWindowSeconds: 31536000,
      provenanceDepth: 32,
      pqcSignatureScheme: 'ML-DSA-65',
      trainingAuthorityInitializerAttestation: true,
      modelAuditCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderTrainingClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqTrainingGating', { trainingOversightQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { trainingWindowSeconds: 999999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { provenanceDepth: 128 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { trainingAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { modelAuditCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { banMalformedOrOutOfOrderTrainingClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTrainingGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
