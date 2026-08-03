'use strict';

const { PqcDecentralizedIdentityProofGatingHub } = require('../pqc-decentralized-identity-proof-gating-hub.cjs');
const { ZkIdentityClaimValidator } = require('../zk-identity-claim-validator.cjs');
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
  minIdentityQuorum: 12,
  maxRevocationWindowSeconds: 86400,
  maxIdentityChainDepth: 32,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireIdentityAuthorityInitializerAttestation: true,
  requireIdentityEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderIdentityClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedIdentityAccumulatorDigestCommitment:'pedersen-id-acc-001', blindedMembershipWitnessCommitment:'pedersen-mem-witness-001', blindedIdentityAuthorityIdentityCommitment:'pedersen-id-auth-001', revocationWindowSeconds:86400, identityChainDepth:22, pqcSignatureScheme:'ML-DSA-65', identityAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedIdentityAccumulatorDigestCommitment:'pedersen-id-acc-001', blindedMembershipWitnessCommitment:'pedersen-mem-witness-001', blindedIdentityAuthorityIdentityCommitment:'pedersen-id-auth-001', zkIdentityRangeProofHash:'zk-id-proof-001', zeroKnowledgeAccumulatorDigest:'zk-acc-digest-001', identityEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', identityEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f','sig-g','sig-h','sig-i','sig-j','sig-k','sig-l'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcDecentralizedIdentityProofGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkIdentityClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyIdentityClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 105 PQ decentralized identity proof gating', () => {
  test('initializes a pool and emits IDENTITY_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='IDENTITY_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies an identity claim and emits ZK_IDENTITY_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyIdentityClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.zeroKnowledgeAccumulatorDigest).toBe('zk-acc-digest-001');
    expect(events.some(e=>e.event==='ZK_IDENTITY_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits REVOCATION_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='REVOCATION_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects revocation window exceeding maximum', () => {
    const hub = new PqcDecentralizedIdentityProofGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.revocationWindowSeconds = 999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects identity chain depth exceeding maximum', () => {
    const hub = new PqcDecentralizedIdentityProofGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.identityChainDepth = 34;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested identity authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcDecentralizedIdentityProofGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.identityAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested identity ethics oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkIdentityClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.identityEthicsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyIdentityClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcDecentralizedIdentityProofGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before identity claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkIdentityRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkIdentityRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyIdentityClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing zeroKnowledgeAccumulatorDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zeroKnowledgeAccumulatorDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyIdentityClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyIdentityClaim(cr);
    expect(()=>validator.verifyIdentityClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq decentralized identity proof gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{identityQuorum:12,revocationWindowSeconds:86400,identityChainDepth:22,pqcSignatureScheme:'ML-DSA-65',identityAuthorityInitializerAttestation:true,identityEthicsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderIdentityClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{identityQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{revocationWindowSeconds:999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{identityChainDepth:34})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{identityAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{identityEthicsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{banMalformedOrOutOfOrderIdentityClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqDecentralizedIdentityProofGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
