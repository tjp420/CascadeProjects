'use strict';

const { PqcHolographicStorageContentAddressableGatingHub } = require('../pqc-holographic-storage-content-addressable-gating-hub.cjs');
const { ZkHolographicClaimValidator } = require('../zk-holographic-claim-validator.cjs');
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
  minHolographicQuorum: 20,
  maxPhaseValidationWindowSeconds: 10,
  maxVolumetricChainDepth: 50,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireHolographicStorageAuthorityInitializerAttestation: true,
  requireHolographicEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderHolographicClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', sourceVolumetricSectorId:'sector-001', targetVolumetricSectorId:'sector-002', blindedVolumetricSectorDigestCommitment:'pedersen-volumetric-sector-001', blindedHolographicStateCommitment:'pedersen-holographic-state-001', blindedInterferencePatternPhaseCommitment:'pedersen-interference-phase-001', phaseValidationWindowSeconds:10, volumetricChainDepth:22, pqcSignatureScheme:'ML-DSA-65', holographicStorageAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedVolumetricSectorDigestCommitment:'pedersen-volumetric-sector-001', blindedHolographicStateCommitment:'pedersen-holographic-state-001', blindedInterferencePatternPhaseCommitment:'pedersen-interference-phase-001', zkHolographicRangeProofHash:'zk-holographic-proof-001', holographicStateDigest:'hgs-digest-001', holographicEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', holographicEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f','sig-g','sig-h','sig-i','sig-j','sig-k','sig-l','sig-m','sig-n','sig-o','sig-p','sig-q','sig-r','sig-s','sig-t'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcHolographicStorageContentAddressableGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkHolographicClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyHolographicClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 110 PQ holographic storage content-addressable gating', () => {
  test('initializes a pool and emits HOLOGRAPHIC_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='HOLOGRAPHIC_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies a holographic claim and emits ZK_HOLOGRAPHIC_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyHolographicClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.holographicStateDigest).toBe('hgs-digest-001');
    expect(events.some(e=>e.event==='ZK_HOLOGRAPHIC_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits PHASE_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='PHASE_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects phase validation window exceeding maximum', () => {
    const hub = new PqcHolographicStorageContentAddressableGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.phaseValidationWindowSeconds = 999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects volumetric chain depth exceeding maximum', () => {
    const hub = new PqcHolographicStorageContentAddressableGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.volumetricChainDepth = 52;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested holographic storage authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcHolographicStorageContentAddressableGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.holographicStorageAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested holographic ethics oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkHolographicClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.holographicEthicsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyHolographicClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcHolographicStorageContentAddressableGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before holographic claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkHolographicRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkHolographicRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyHolographicClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing holographicStateDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.holographicStateDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyHolographicClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyHolographicClaim(cr);
    expect(()=>validator.verifyHolographicClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq holographic storage content-addressable gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{holographicQuorum:20,phaseValidationWindowSeconds:10,volumetricChainDepth:22,pqcSignatureScheme:'ML-DSA-65',holographicStorageAuthorityInitializerAttestation:true,holographicEthicsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderHolographicClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{holographicQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{phaseValidationWindowSeconds:999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{volumetricChainDepth:52})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{holographicStorageAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{holographicEthicsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{banMalformedOrOutOfOrderHolographicClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqHolographicStorageContentAddressableGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
