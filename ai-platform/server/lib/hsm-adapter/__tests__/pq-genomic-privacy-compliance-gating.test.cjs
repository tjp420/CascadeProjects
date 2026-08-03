'use strict';

const { PqcGenomicPrivacyComplianceGatingHub } = require('../pqc-genomic-privacy-compliance-gating-hub.cjs');
const { ZkGenomicClaimValidator } = require('../zk-genomic-claim-validator.cjs');
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
  minGenomicQuorum: 6,
  maxConsentWindowSeconds: 31536000,
  maxComplianceChainDepth: 20,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireGenomicPrivacyAuthorityInitializerAttestation: true,
  requireGenomicEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderGenomicClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedDnaSequenceAccessCommitment:'pedersen-dna-access-001', blindedConsentProbabilityCommitment:'pedersen-consent-prob-001', blindedGenomicPrivacyAuthorityIdentityCommitment:'pedersen-genomic-auth-001', consentWindowSeconds:15552000, complianceChainDepth:12, pqcSignatureScheme:'ML-DSA-65', genomicPrivacyAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedDnaSequenceAccessCommitment:'pedersen-dna-access-001', blindedConsentProbabilityCommitment:'pedersen-consent-prob-001', blindedGenomicPrivacyAuthorityIdentityCommitment:'pedersen-genomic-auth-001', zkGenomicRangeProofHash:'zk-genomic-proof-001', symmetricPredicateProofDigest:'symmetric-predicate-digest-001', genomicEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', genomicEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcGenomicPrivacyComplianceGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkGenomicClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyGenomicClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 99 PQ genomic privacy compliance gating', () => {
  test('initializes a pool and emits GENOMIC_COMPLIANCE_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='GENOMIC_COMPLIANCE_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies a genomic claim and emits ZK_GENOMIC_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyGenomicClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.symmetricPredicateProofDigest).toBe('symmetric-predicate-digest-001');
    expect(events.some(e=>e.event==='ZK_GENOMIC_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits CONSENT_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='CONSENT_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects consent window exceeding maximum', () => {
    const hub = new PqcGenomicPrivacyComplianceGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.consentWindowSeconds = 99999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects compliance chain depth exceeding maximum', () => {
    const hub = new PqcGenomicPrivacyComplianceGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.complianceChainDepth = 30;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested genomic privacy authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcGenomicPrivacyComplianceGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.genomicPrivacyAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested genomic ethics oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkGenomicClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.genomicEthicsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyGenomicClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcGenomicPrivacyComplianceGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before genomic claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkGenomicRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkGenomicRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyGenomicClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing symmetricPredicateProofDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.symmetricPredicateProofDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyGenomicClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyGenomicClaim(cr);
    expect(()=>validator.verifyGenomicClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq genomic privacy compliance gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{genomicQuorum:6,consentWindowSeconds:15552000,complianceChainDepth:12,pqcSignatureScheme:'ML-DSA-65',genomicPrivacyAuthorityInitializerAttestation:true,genomicEthicsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderGenomicClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{genomicQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{consentWindowSeconds:99999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{complianceChainDepth:30})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{genomicPrivacyAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{genomicEthicsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{banMalformedOrOutOfOrderGenomicClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqGenomicPrivacyComplianceGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
