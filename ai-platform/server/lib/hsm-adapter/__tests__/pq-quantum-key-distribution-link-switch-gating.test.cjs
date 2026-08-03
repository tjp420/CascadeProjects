'use strict';

const { PqcQuantumKeyDistributionLinkSwitchGatingHub } = require('../pqc-quantum-key-distribution-link-switch-gating-hub.cjs');
const { ZkQkdLinkClaimValidator } = require('../zk-qkd-link-claim-validator.cjs');
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
  minQkdQuorum: 18,
  maxEntanglementWindowSeconds: 60,
  maxQkdSwitchChainDepth: 42,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireQkdLinkAuthorityInitializerAttestation: true,
  requireQkdEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderQkdLinkClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', sourceOpticalNodeId:'optical-001', targetOpticalNodeId:'optical-002', blindedOpticalLinkPathCommitment:'pedersen-optical-link-001', blindedQuantumSecretSharingCommitment:'pedersen-qss-001', blindedEntanglingChannelCommitment:'pedersen-entangling-001', entanglementWindowSeconds:60, qkdSwitchChainDepth:22, pqcSignatureScheme:'ML-DSA-65', qkdLinkAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedOpticalLinkPathCommitment:'pedersen-optical-link-001', blindedQuantumSecretSharingCommitment:'pedersen-qss-001', blindedEntanglingChannelCommitment:'pedersen-entangling-001', zkQkdLinkRangeProofHash:'zk-qkd-link-proof-001', quantumSecretSharingDigest:'qss-digest-001', qkdEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', qkdEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f','sig-g','sig-h','sig-i','sig-j','sig-k','sig-l','sig-m','sig-n','sig-o','sig-p','sig-q','sig-r'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcQuantumKeyDistributionLinkSwitchGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkQkdLinkClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyQkdLinkClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 109 PQ quantum key distribution link-switch gating', () => {
  test('initializes a pool and emits QKD_LINK_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='QKD_LINK_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies a qkd link claim and emits ZK_QKD_LINK_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyQkdLinkClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.quantumSecretSharingDigest).toBe('qss-digest-001');
    expect(events.some(e=>e.event==='ZK_QKD_LINK_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits ENTANGLEMENT_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='ENTANGLEMENT_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects entanglement window exceeding maximum', () => {
    const hub = new PqcQuantumKeyDistributionLinkSwitchGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.entanglementWindowSeconds = 999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects qkd switch chain depth exceeding maximum', () => {
    const hub = new PqcQuantumKeyDistributionLinkSwitchGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.qkdSwitchChainDepth = 44;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested qkd link authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcQuantumKeyDistributionLinkSwitchGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.qkdLinkAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested qkd ethics oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkQkdLinkClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.qkdEthicsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyQkdLinkClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcQuantumKeyDistributionLinkSwitchGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before qkd link claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkQkdLinkRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkQkdLinkRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyQkdLinkClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing quantumSecretSharingDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.quantumSecretSharingDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyQkdLinkClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyQkdLinkClaim(cr);
    expect(()=>validator.verifyQkdLinkClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq quantum key distribution link-switch gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{qkdQuorum:18,entanglementWindowSeconds:60,qkdSwitchChainDepth:22,pqcSignatureScheme:'ML-DSA-65',qkdLinkAuthorityInitializerAttestation:true,qkdEthicsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderQkdLinkClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{qkdQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{entanglementWindowSeconds:999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{qkdSwitchChainDepth:44})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{qkdLinkAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{qkdEthicsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{banMalformedOrOutOfOrderQkdLinkClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumKeyDistributionLinkSwitchGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
