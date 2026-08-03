'use strict';

const { PqcPolarResearchDataGatingHub } = require('../pqc-polar-research-data-gating-hub.cjs');
const { ZkResearchClaimValidator } = require('../zk-research-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minPolarQuorum: 5,
  maxDataRetentionWindowSeconds: 7776000,
  maxResearchChainDepth: 14,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireAntarcticTreatySecretariatInitializerAttestation: true,
  requirePolarResearchOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderResearchClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedResearchDataCommitment:'pedersen-researchdata-001', blindedSensorTelemetryCommitment:'pedersen-sensortelemetry-001', blindedInstitutionIdentityCommitment:'pedersen-institution-001', dataRetentionWindowSeconds:3888000, researchChainDepth:7, pqcSignatureScheme:'ML-DSA-65', antarcticTreatySecretariatInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedResearchDataCommitment:'pedersen-researchdata-001', blindedSensorTelemetryCommitment:'pedersen-sensortelemetry-001', blindedInstitutionIdentityCommitment:'pedersen-institution-001', zkResearchRangeProofHash:'zk-research-proof-001', vdfProofHash:'vdf-proof-hash-001', polarResearchOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', polarResearchOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({ allowedAuthorities:['mock-authority'], allowedMeasurements:['MOCK_MEASUREMENT_00000000000000000000000000000000'] });
  const hub = new PqcPolarResearchDataGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkResearchClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyResearchClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 96 PQ polar research data gating', () => {
  test('initializes a pool and emits POLAR_RESEARCH_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='POLAR_RESEARCH_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies a research claim and emits ZK_RESEARCH_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyResearchClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.vdfProofHash).toBe('vdf-proof-hash-001');
    expect(events.some(e=>e.event==='ZK_RESEARCH_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits DATA_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='DATA_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects data retention window exceeding maximum', () => {
    const hub = new PqcPolarResearchDataGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.dataRetentionWindowSeconds = 99999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects research chain depth exceeding maximum', () => {
    const hub = new PqcPolarResearchDataGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.researchChainDepth = 30;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested Antarctic Treaty Secretariat initializer', () => {
    const ac = new EnclaveAttestationClient({ allowedAuthorities:['mock-authority'], allowedMeasurements:['MOCK_MEASUREMENT_00000000000000000000000000000000'] });
    const hub = new PqcPolarResearchDataGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.antarcticTreatySecretariatInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested polar research oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new EnclaveAttestationClient({ allowedAuthorities:['mock-authority'], allowedMeasurements:['MOCK_MEASUREMENT_00000000000000000000000000000000'] });
    const v = new ZkResearchClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.polarResearchOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyResearchClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcPolarResearchDataGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before research claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b','sig-c'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkResearchRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkResearchRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyResearchClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing vdfProofHash', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.vdfProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyResearchClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyResearchClaim(cr);
    expect(()=>validator.verifyResearchClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq polar research gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqPolarResearchGating',{polarQuorum:5,dataRetentionWindowSeconds:3888000,researchChainDepth:7,pqcSignatureScheme:'ML-DSA-65',antarcticTreatySecretariatInitializerAttestation:true,polarResearchOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderResearchClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqPolarResearchGating',{polarQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{dataRetentionWindowSeconds:99999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{researchChainDepth:30})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{antarcticTreatySecretariatInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{polarResearchOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{banMalformedOrOutOfOrderResearchClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqPolarResearchGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
