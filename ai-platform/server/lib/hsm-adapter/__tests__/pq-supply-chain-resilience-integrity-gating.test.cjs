'use strict';

const { PqcSupplyChainResilienceIntegrityGatingHub } = require('../pqc-supply-chain-resilience-integrity-gating-hub.cjs');
const { ZkResilienceClaimValidator } = require('../zk-resilience-claim-validator.cjs');
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
  minResilienceQuorum: 10,
  maxResilienceWindowSeconds: 172800,
  maxResilienceChainDepth: 28,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireSupplyChainResilienceAuthorityInitializerAttestation: true,
  requireSupplyChainEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderResilienceClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedDisruptionPredictionCommitment:'pedersen-disruption-prediction-001', blindedSupplierDiversityCommitment:'pedersen-supplier-diversity-001', blindedSupplyChainResilienceAuthorityIdentityCommitment:'pedersen-resilience-auth-001', resilienceWindowSeconds:86400, resilienceChainDepth:20, pqcSignatureScheme:'ML-DSA-65', supplyChainResilienceAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedDisruptionPredictionCommitment:'pedersen-disruption-prediction-001', blindedSupplierDiversityCommitment:'pedersen-supplier-diversity-001', blindedSupplyChainResilienceAuthorityIdentityCommitment:'pedersen-resilience-auth-001', zkResilienceRangeProofHash:'zk-resilience-proof-001', verifiableSecretSharingDigest:'vss-digest-001', supplyChainEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', supplyChainEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f','sig-g','sig-h','sig-i','sig-j'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcSupplyChainResilienceIntegrityGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkResilienceClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyResilienceClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 103 PQ supply chain resilience integrity gating', () => {
  test('initializes a pool and emits SUPPLY_CHAIN_RESILIENCE_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='SUPPLY_CHAIN_RESILIENCE_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies a resilience claim and emits ZK_RESILIENCE_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyResilienceClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.verifiableSecretSharingDigest).toBe('vss-digest-001');
    expect(events.some(e=>e.event==='ZK_RESILIENCE_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits RESILIENCE_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='RESILIENCE_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects resilience window exceeding maximum', () => {
    const hub = new PqcSupplyChainResilienceIntegrityGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.resilienceWindowSeconds = 999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects resilience chain depth exceeding maximum', () => {
    const hub = new PqcSupplyChainResilienceIntegrityGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.resilienceChainDepth = 32;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested supply chain resilience authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcSupplyChainResilienceIntegrityGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.supplyChainResilienceAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested supply chain ethics oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkResilienceClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.supplyChainEthicsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyResilienceClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcSupplyChainResilienceIntegrityGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before resilience claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkResilienceRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkResilienceRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyResilienceClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing verifiableSecretSharingDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.verifiableSecretSharingDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyResilienceClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyResilienceClaim(cr);
    expect(()=>validator.verifyResilienceClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq supply chain resilience integrity gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{resilienceQuorum:10,resilienceWindowSeconds:86400,resilienceChainDepth:20,pqcSignatureScheme:'ML-DSA-65',supplyChainResilienceAuthorityInitializerAttestation:true,supplyChainEthicsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderResilienceClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{resilienceQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{resilienceWindowSeconds:999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{resilienceChainDepth:32})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{supplyChainResilienceAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{supplyChainEthicsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{banMalformedOrOutOfOrderResilienceClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqSupplyChainResilienceIntegrityGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
