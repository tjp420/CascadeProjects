'use strict';

const { PqcNeuralNetworkInferenceIntegrityGatingHub } = require('../pqc-neural-network-inference-integrity-gating-hub.cjs');
const { ZkNeuralClaimValidator } = require('../zk-neural-claim-validator.cjs');
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
  minNeuralQuorum: 8,
  maxInferenceWindowSeconds: 604800,
  maxInferenceChainDepth: 24,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireNeuralNetworkAuthorityInitializerAttestation: true,
  requireNeuralEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderNeuralClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedNeuralMeasurementCommitment:'pedersen-neural-measurement-001', blindedInferenceProbabilityCommitment:'pedersen-inference-prob-001', blindedNeuralNetworkAuthorityIdentityCommitment:'pedersen-neural-auth-001', inferenceWindowSeconds:302400, inferenceChainDepth:16, pqcSignatureScheme:'ML-DSA-65', neuralNetworkAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedNeuralMeasurementCommitment:'pedersen-neural-measurement-001', blindedInferenceProbabilityCommitment:'pedersen-inference-prob-001', blindedNeuralNetworkAuthorityIdentityCommitment:'pedersen-neural-auth-001', zkNeuralRangeProofHash:'zk-neural-proof-001', merkleMountainRangeDigest:'mmr-digest-001', neuralEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', neuralEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f','sig-g','sig-h'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcNeuralNetworkInferenceIntegrityGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkNeuralClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyNeuralClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 101 PQ neural network inference integrity gating', () => {
  test('initializes a pool and emits NEURAL_INFERENCE_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='NEURAL_INFERENCE_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies a neural claim and emits ZK_NEURAL_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyNeuralClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.merkleMountainRangeDigest).toBe('mmr-digest-001');
    expect(events.some(e=>e.event==='ZK_NEURAL_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits INFERENCE_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='INFERENCE_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects inference window exceeding maximum', () => {
    const hub = new PqcNeuralNetworkInferenceIntegrityGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.inferenceWindowSeconds = 99999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects inference chain depth exceeding maximum', () => {
    const hub = new PqcNeuralNetworkInferenceIntegrityGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.inferenceChainDepth = 30;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested neural network authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcNeuralNetworkInferenceIntegrityGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.neuralNetworkAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested neural ethics oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkNeuralClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.neuralEthicsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyNeuralClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcNeuralNetworkInferenceIntegrityGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before neural claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkNeuralRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkNeuralRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyNeuralClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing merkleMountainRangeDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.merkleMountainRangeDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyNeuralClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyNeuralClaim(cr);
    expect(()=>validator.verifyNeuralClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq neural network inference integrity gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{neuralQuorum:8,inferenceWindowSeconds:302400,inferenceChainDepth:16,pqcSignatureScheme:'ML-DSA-65',neuralNetworkAuthorityInitializerAttestation:true,neuralEthicsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderNeuralClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{neuralQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{inferenceWindowSeconds:99999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{inferenceChainDepth:30})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{neuralNetworkAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{neuralEthicsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{banMalformedOrOutOfOrderNeuralClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqNeuralNetworkInferenceIntegrityGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
