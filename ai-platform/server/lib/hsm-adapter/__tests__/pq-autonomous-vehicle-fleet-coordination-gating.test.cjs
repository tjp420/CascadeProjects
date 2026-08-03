'use strict';

const { PqcAutonomousVehicleFleetCoordinationGatingHub } = require('../pqc-autonomous-vehicle-fleet-coordination-gating-hub.cjs');
const { ZkAutonomousClaimValidator } = require('../zk-autonomous-claim-validator.cjs');
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
  minAutonomousQuorum: 9,
  maxCoordinationWindowSeconds: 86400,
  maxCoordinationChainDepth: 26,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireAutonomousMobilityAuthorityInitializerAttestation: true,
  requireAutonomousEthicsOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderAutonomousClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return { version:1, enclaveType:'mock', measurement:'MOCK_MEASUREMENT_00000000000000000000000000000000', mrenclave:'MOCK_MRENCLAVE_00000000000000000000000000000000', timestamp:Math.floor(Date.now()/1000), attestationAgeSeconds:0, authority:'mock-authority', signature:'mock-signature-placeholder' };
}

function baseInitRequest() {
  return { sourceTenantId:'tenant-a', targetChainId:'chain-b', blindedTrajectoryMeasurementCommitment:'pedersen-trajectory-measurement-001', blindedCoordinationProbabilityCommitment:'pedersen-coordination-prob-001', blindedAutonomousMobilityAuthorityIdentityCommitment:'pedersen-autonomous-auth-001', coordinationWindowSeconds:43200, coordinationChainDepth:18, pqcSignatureScheme:'ML-DSA-65', autonomousMobilityAuthorityInitializerAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseClaimRequest(poolId) {
  return { poolId:poolId||'pool-001', blindedTrajectoryMeasurementCommitment:'pedersen-trajectory-measurement-001', blindedCoordinationProbabilityCommitment:'pedersen-coordination-prob-001', blindedAutonomousMobilityAuthorityIdentityCommitment:'pedersen-autonomous-auth-001', zkAutonomousRangeProofHash:'zk-autonomous-proof-001', polynomialCommitmentDigest:'poly-commit-digest-001', autonomousEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority' };
}

function baseCompleteRequest(poolId) {
  return { poolId:poolId||'pool-001', autonomousEthicsOversightCommitteeAttestation:mockAttestation(), attestationAuthority:'mock-authority', committeeSignatures:['sig-a','sig-b','sig-c','sig-d','sig-e','sig-f','sig-g','sig-h','sig-i'] };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcAutonomousVehicleFleetCoordinationGatingHub({ policy:POLICY, attestationClient, audit:(event,info)=>events.push({event,info}) });
  const validator = new ZkAutonomousClaimValidator({ policy:POLICY, hub, attestationClient, audit:(event,info)=>events.push({event,info}) });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyAutonomousClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 102 PQ autonomous vehicle fleet coordination gating', () => {
  test('initializes a pool and emits AUTONOMOUS_COORDINATION_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some(e=>e.event==='AUTONOMOUS_COORDINATION_POOL_INITIALIZED')).toBe(true);
  });

  test('verifies an autonomous claim and emits ZK_AUTONOMOUS_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyAutonomousClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(claim.polynomialCommitmentDigest).toBe('poly-commit-digest-001');
    expect(events.some(e=>e.event==='ZK_AUTONOMOUS_CLAIM_VERIFIED')).toBe(true);
  });

  test('completes accreditation after claim and emits COORDINATION_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some(e=>e.event==='COORDINATION_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('rejects coordination window exceeding maximum', () => {
    const hub = new PqcAutonomousVehicleFleetCoordinationGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.coordinationWindowSeconds = 999999;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects coordination chain depth exceeding maximum', () => {
    const hub = new PqcAutonomousVehicleFleetCoordinationGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.coordinationChainDepth = 30;
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested autonomous mobility authority initializer', () => {
    const ac = new MockAttestationClient();
    const hub = new PqcAutonomousVehicleFleetCoordinationGatingHub({ policy:POLICY, attestationClient:ac });
    const req = baseInitRequest(); req.autonomousMobilityAuthorityInitializerAttestation = { authority:'bad' };
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects un-attested autonomous ethics oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const ac = new MockAttestationClient();
    const v = new ZkAutonomousClaimValidator({ policy:POLICY, hub, attestationClient:ac });
    const cr = baseClaimRequest(pool.poolId); cr.autonomousEthicsOversightCommitteeAttestation = { authority:'bad' };
    expect(()=>v.verifyAutonomousClaim(cr)).toThrow(HsmAdapterError);
  });

  test('rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcAutonomousVehicleFleetCoordinationGatingHub({ policy:POLICY });
    const req = baseInitRequest(); req.pqcSignatureScheme = 'RSA-2048';
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const req = baseInitRequest(); req.poolId = 'pool-dup';
    hub.initializePool(req);
    expect(()=>hub.initializePool(req)).toThrow(HsmAdapterError);
  });

  test('rejects accreditation before autonomous claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(()=>hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('rejects accreditation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const cr = baseCompleteRequest(pool.poolId); cr.committeeSignatures = ['sig-a','sig-b'];
    expect(()=>hub.completeAccreditation(cr)).toThrow(HsmAdapterError);
  });

  test('bans peers broadcasting malformed claims (missing zkAutonomousRangeProofHash)', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.zkAutonomousRangeProofHash = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyAutonomousClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting missing polynomialCommitmentDigest', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.polynomialCommitmentDigest = null; cr.peerId = 'peer-bad';
    expect(()=>validator.verifyAutonomousClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const cr = baseClaimRequest(pool.poolId); cr.peerId = 'peer-bad';
    validator.verifyAutonomousClaim(cr);
    expect(()=>validator.verifyAutonomousClaim(cr)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq autonomous vehicle fleet coordination gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default:{} });
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{autonomousQuorum:9,coordinationWindowSeconds:43200,coordinationChainDepth:18,pqcSignatureScheme:'ML-DSA-65',autonomousMobilityAuthorityInitializerAttestation:true,autonomousEthicsOversightCommitteeAttestation:true,attestationAuthority:'mock-authority',banMalformedOrOutOfOrderAutonomousClaims:true,canonicalPayloadLayout:true})).not.toThrow();
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{autonomousQuorum:2})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{coordinationWindowSeconds:999999})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{coordinationChainDepth:30})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{pqcSignatureScheme:'RSA-2048'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{autonomousMobilityAuthorityInitializerAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{autonomousEthicsOversightCommitteeAttestation:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{attestationAuthority:'bad'})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{banMalformedOrOutOfOrderAutonomousClaims:false})).toThrow(HsmAdapterError);
    expect(()=>engine.validate('t1','pqAutonomousVehicleFleetCoordinationGating',{canonicalPayloadLayout:false})).toThrow(HsmAdapterError);
  });
});
