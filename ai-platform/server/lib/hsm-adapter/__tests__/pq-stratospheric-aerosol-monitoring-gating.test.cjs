'use strict';

const { PqcStratosphericAerosolMonitoringGatingHub } = require('../pqc-stratospheric-aerosol-monitoring-gating-hub.cjs');
const { ZkAerosolClaimValidator } = require('../zk-aerosol-claim-validator.cjs');
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
  minClimateQuorum: 4,
  maxDeploymentWindowSeconds: 31536000,
  maxMonitoringChainDepth: 16,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireClimateAuthorityInitializerAttestation: true,
  requireStratosphericOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderAerosolClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedAerosolDispersionCommitment:'pedersen-aerosoldispersion-001', blindedSensorCalibrationCommitment:'pedersen-sensorcalibration-001', blindedClimateAuthorityIdentityCommitment:'pedersen-climateauth-001', deploymentWindowSeconds:15552000, monitoringChainDepth:8, pqcSignatureScheme:'ML-DSA-65', climateAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedAerosolDispersionCommitment:'pedersen-aerosoldispersion-001', blindedSensorCalibrationCommitment:'pedersen-sensorcalibration-001', blindedClimateAuthorityIdentityCommitment:'pedersen-climateauth-001', zkAerosolRangeProofHash:'zk-aerosol-proof-001', latticeSignatureDigest:'lattice-sig-digest-001', stratosphericOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', stratosphericOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcStratosphericAerosolMonitoringGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkAerosolClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyAerosolClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 97 PQ stratospheric aerosol monitoring gating', () => {
  test('initializes a pool and emits STRATOSPHERIC_MONITORING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='STRATOSPHERIC_MONITORING_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies an aerosol claim and emits ZK_AEROSOL_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyAerosolClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.latticeSignatureDigest).toBe('lattice-sig-digest-001');
    expect(events.some(e=>e.event==='ZK_AEROSOL_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits DEPLOYMENT_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='DEPLOYMENT_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects deployment window exceeding maximum', () => {
    const hub = new PqcStratosphericAerosolMonitoringGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.deploymentWindowSeconds = 99999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects monitoring chain depth exceeding maximum', () => {
    const hub = new PqcStratosphericAerosolMonitoringGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.monitoringChainDepth = 30;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested climate authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcStratosphericAerosolMonitoringGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.climateAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested stratospheric oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkAerosolClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.stratosphericOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyAerosolClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcStratosphericAerosolMonitoringGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before aerosol claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkAerosolRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkAerosolRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyAerosolClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing latticeSignatureDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.latticeSignatureDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyAerosolClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyAerosolClaim(cr);
    expect(()=>validator.verifyAerosolClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq stratospheric aerosol gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{climateQuorum:4,deploymentWindowSeconds:15552000,monitoringChainDepth:8,pqcSignatureScheme:'ML-DSA-65',climateAuthorityInitializerAttestation:true,stratosphericOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderAerosolClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{climateQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{deploymentWindowSeconds:99999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{monitoringChainDepth:30})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{climateAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{stratosphericOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{banMalformedOrOutOfOrderAerosolClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqStratosphericAerosolGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
