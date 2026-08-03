'use strict';

/**
 * Track 86: PQ Health Insurance Claim Auditing Gating tests.
 */
const { PqcHealthInsuranceClaimAuditingGatingHub } = require('../pqc-health-insurance-claim-auditing-gating-hub.cjs');
const { ZkInsuranceClaimValidator } = require('../zk-insurance-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minClaimsAuditQuorum: 3,
  maxClaimWindowSeconds: 5184000,
  maxBillingSequenceDepth: 24,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireInsuranceAuthorityInitializerAttestation: true,
  requireActuarialCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderClaims: true,
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
    blindedDiagnosticBillingCommitment: 'pedersen-billing-001',
    blindedActuarialRiskCodeCommitment: 'pedersen-riskcode-001',
    blindedPayoutCommitment: 'pedersen-payout-001',
    claimWindowSeconds: 2592000,
    billingSequenceDepth: 12,
    pqcSignatureScheme: 'ML-DSA-65',
    insuranceAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedActuarialRiskCodeCommitment: 'pedersen-riskcode-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkInsuranceRangeProofHash: 'zk-insurance-proof-001',
    actuarialCommitteeAttestation: mockAttestation(),
    actuarialCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    tFheProof: 'tfhe-proof-001',
    claimWindowSeconds: 2592000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    actuarialCommitteeAttestation: mockAttestation(),
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
  const hub = new PqcHealthInsuranceClaimAuditingGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkInsuranceClaimValidator({
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
  const claim = ctx.validator.verifyClaimAudit(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 86 PQ health insurance claim auditing gating', () => {
  test('PqcHealthInsuranceClaimAuditingGatingHub initializes a pool and emits INSURANCE_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'INSURANCE_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkInsuranceClaimValidator verifies a claim audit and emits ZK_CLAIM_AUDIT_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyClaimAudit(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_CLAIM_AUDIT_VERIFIED')).toBe(true);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub completes accreditation after claim and emits ACTUARIAL_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'ACTUARIAL_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub rejects claim window exceeding maximum', () => {
    const hub = new PqcHealthInsuranceClaimAuditingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.claimWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub rejects billing sequence depth exceeding maximum', () => {
    const hub = new PqcHealthInsuranceClaimAuditingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.billingSequenceDepth = 48;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub rejects un-attested insurance authority initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcHealthInsuranceClaimAuditingGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.insuranceAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkInsuranceClaimValidator rejects un-attested actuarial committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkInsuranceClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.actuarialCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyClaimAudit(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcHealthInsuranceClaimAuditingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub rejects accreditation completion before claim audit verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcHealthInsuranceClaimAuditingGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkInsuranceClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkInsuranceRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyClaimAudit(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkInsuranceClaimValidator bans peers broadcasting out-of-bounds claim windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.claimWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyClaimAudit(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkInsuranceClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyClaimAudit(clReq);
    expect(() => validator.verifyClaimAudit(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq insurance gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqInsuranceGating', {
      claimsAuditQuorum: 3,
      claimWindowSeconds: 2592000,
      billingSequenceDepth: 12,
      pqcSignatureScheme: 'ML-DSA-65',
      insuranceAuthorityInitializerAttestation: true,
      actuarialCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqInsuranceGating', { claimsAuditQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { claimWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { billingSequenceDepth: 48 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { insuranceAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { actuarialCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { banMalformedOrOutOfOrderClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqInsuranceGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
