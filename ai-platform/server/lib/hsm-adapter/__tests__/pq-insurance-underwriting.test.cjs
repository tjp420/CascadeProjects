'use strict';

/**
 * Track 67: PQ Insurance Underwriting tests.
 */
const { PqcInsuranceUnderwritingHub } = require('../pqc-insurance-underwriting-hub.cjs');
const { ZkRiskExposureValidator } = require('../zk-risk-exposure-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minReserveRatio: 30,
  minClaimQuorum: 3,
  maxPoolRiskExposureCap: 1000000000,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireCoverageInitiatorAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderClaimAssertions: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
    signature: 'mock-signature-placeholder',
  };
}

function baseInitRequest() {
  return {
    sourceTenantId: 'tenant-a',
    targetChainId: 'chain-b',
    blindedPremiumCommitment: 'pedersen-premium-001',
    blindedReserveCommitment: 'pedersen-reserve-001',
    blindedMaxClaimCommitment: 'pedersen-maxclaim-001',
    reserveRatio: 50,
    poolRiskExposureCap: 1000000,
    pqcSignatureScheme: 'ML-DSA-65',
    coverageInitiatorAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedReserveCommitment: 'pedersen-reserve-001',
    blindedLossExposureCommitment: 'pedersen-lossexposure-001',
    zkRiskExposureProofHash: 'zk-risk-exposure-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    reserveValue: 500,
    premiumValue: 1000,
  };
}

function baseLiquidateRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcInsuranceUnderwritingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkRiskExposureValidator({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, validator };
}

function setupAndInitPool() {
  const ctx = setupHubAndValidator();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndClaim() {
  const ctx = setupAndInitPool();
  const claim = ctx.validator.verifyClaimEligibility(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 67 PQ insurance underwriting', () => {
  test('PqcInsuranceUnderwritingHub initializes a pool and emits INSURANCE_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'INSURANCE_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkRiskExposureValidator verifies claim eligibility and emits ZK_CLAIM_ELIGIBILITY_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyClaimEligibility(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_CLAIM_ELIGIBILITY_VERIFIED')).toBe(true);
  });

  test('PqcInsuranceUnderwritingHub liquidates a pool after claim eligibility and emits UNDERWRITING_POOL_LIQUIDATED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const liquidation = hub.liquidatePool(baseLiquidateRequest(pool.poolId));
    expect(liquidation.liquidationId).toBeDefined();
    expect(events.some((e) => e.event === 'UNDERWRITING_POOL_LIQUIDATED')).toBe(true);
  });

  test('PqcInsuranceUnderwritingHub rejects reserve ratio below minimum', () => {
    const hub = new PqcInsuranceUnderwritingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.reserveRatio = 20;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcInsuranceUnderwritingHub rejects pool risk exposure cap exceeding maximum', () => {
    const hub = new PqcInsuranceUnderwritingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.poolRiskExposureCap = 2000000000;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcInsuranceUnderwritingHub rejects un-attested coverage initiator', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcInsuranceUnderwritingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.coverageInitiatorAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkRiskExposureValidator rejects un-attested clearing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkRiskExposureValidator({ policy: POLICY, hub, attestationClient });
    const claimReq = baseClaimRequest(pool.poolId);
    claimReq.clearingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyClaimEligibility(claimReq)).toThrow(HsmAdapterError);
  });

  test('PqcInsuranceUnderwritingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcInsuranceUnderwritingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcInsuranceUnderwritingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcInsuranceUnderwritingHub rejects liquidation before claim eligibility verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.liquidatePool(baseLiquidateRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcInsuranceUnderwritingHub rejects liquidation with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const liqReq = baseLiquidateRequest(pool.poolId);
    liqReq.committeeSignatures = ['sig-a'];
    expect(() => hub.liquidatePool(liqReq)).toThrow(HsmAdapterError);
  });

  test('ZkRiskExposureValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const claimReq = baseClaimRequest(pool.poolId);
    claimReq.zkRiskExposureProofHash = null;
    claimReq.peerId = 'peer-bad';
    expect(() => validator.verifyClaimEligibility(claimReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkRiskExposureValidator bans peers broadcasting sub-reserve claims', () => {
    const { validator, pool } = setupAndInitPool();
    const claimReq = baseClaimRequest(pool.poolId);
    claimReq.reserveValue = 100;
    claimReq.premiumValue = 1000;
    claimReq.peerId = 'peer-bad';
    expect(() => validator.verifyClaimEligibility(claimReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkRiskExposureValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const claimReq = baseClaimRequest(pool.poolId);
    claimReq.peerId = 'peer-bad';
    validator.verifyClaimEligibility(claimReq);
    expect(() => validator.verifyClaimEligibility(claimReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq insurance underwriting configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', {
      reserveRatio: 50,
      claimQuorum: 3,
      poolRiskExposureCap: 1000000,
      pqcSignatureScheme: 'ML-DSA-65',
      coverageInitiatorAttestation: true,
      clearingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderClaimAssertions: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { reserveRatio: 20 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { claimQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { poolRiskExposureCap: 2000000000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { coverageInitiatorAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { clearingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { banMalformedOrOutOfOrderClaimAssertions: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceUnderwriting', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
