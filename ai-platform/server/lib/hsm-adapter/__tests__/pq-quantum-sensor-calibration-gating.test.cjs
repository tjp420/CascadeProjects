'use strict';

const { PqcQuantumSensorCalibrationGatingHub } = require('../pqc-quantum-sensor-calibration-gating-hub.cjs');
const { ZkQuantumClaimValidator } = require('../zk-quantum-claim-validator.cjs');
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
  minQuantumQuorum: 7,
  maxCalibrationWindowSeconds: 7776000,
  maxCalibrationChainDepth: 22,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireQuantumMetrologyAuthorityInitializerAttestation: true,
  requireQuantumStandardsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderQuantumClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedQuantumMeasurementCommitment:'pedersen-quantum-measurement-001', blindedCalibrationProbabilityCommitment:'pedersen-calibration-prob-001', blindedQuantumMetrologyAuthorityIdentityCommitment:'pedersen-quantum-auth-001', calibrationWindowSeconds:3888000, calibrationChainDepth:14, pqcSignatureScheme:'ML-DSA-65', quantumMetrologyAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedQuantumMeasurementCommitment:'pedersen-quantum-measurement-001', blindedCalibrationProbabilityCommitment:'pedersen-calibration-prob-001', blindedQuantumMetrologyAuthorityIdentityCommitment:'pedersen-quantum-auth-001', zkQuantumRangeProofHash:'zk-quantum-proof-001', accumulationTreeDigest:'accumulation-tree-digest-001', quantumStandardsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', quantumStandardsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f','sig-g'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcQuantumSensorCalibrationGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkQuantumClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyQuantumClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 100 PQ quantum sensor calibration gating', () => {
  test('initializes a pool and emits QUANTUM_CALIBRATION_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='QUANTUM_CALIBRATION_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies a quantum claim and emits ZK_QUANTUM_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyQuantumClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.accumulationTreeDigest).toBe('accumulation-tree-digest-001');
    expect(events.some(e=>e.event==='ZK_QUANTUM_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits CALIBRATION_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='CALIBRATION_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects calibration window exceeding maximum', () => {
    const hub = new PqcQuantumSensorCalibrationGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.calibrationWindowSeconds = 99999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects calibration chain depth exceeding maximum', () => {
    const hub = new PqcQuantumSensorCalibrationGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.calibrationChainDepth = 30;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested quantum metrology authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcQuantumSensorCalibrationGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.quantumMetrologyAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested quantum standards oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkQuantumClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.quantumStandardsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyQuantumClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcQuantumSensorCalibrationGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before quantum claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkQuantumRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkQuantumRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyQuantumClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing accumulationTreeDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.accumulationTreeDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyQuantumClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyQuantumClaim(cr);
    expect(()=>validator.verifyQuantumClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq quantum sensor calibration gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{quantumQuorum:7,calibrationWindowSeconds:3888000,calibrationChainDepth:14,pqcSignatureScheme:'ML-DSA-65',quantumMetrologyAuthorityInitializerAttestation:true,quantumStandardsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderQuantumClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{quantumQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{calibrationWindowSeconds:99999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{calibrationChainDepth:30})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{quantumMetrologyAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{quantumStandardsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{banMalformedOrOutOfOrderQuantumClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqQuantumSensorCalibrationGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
