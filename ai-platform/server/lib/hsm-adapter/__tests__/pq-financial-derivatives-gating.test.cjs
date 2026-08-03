'use strict';

/**
 * Track 78: PQ Financial Derivatives Gating tests.
 */
const { PqcFinancialDerivativesGatingHub } = require('../pqc-financial-derivatives-gating-hub.cjs');
const { ZkDerivativeClaimValidator } = require('../zk-derivative-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minClearingHouseQuorum: 3,
  maxContractExpirationSeconds: 31536000,
  maxRiskMetricDepth: 32,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireClearingHouseInitializerAttestation: true,
  requireRiskCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderDerivativeClaims: true,
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
    blindedContractTermsCommitment: 'pedersen-terms-001',
    blindedCounterpartyRiskCommitment: 'pedersen-risk-001',
    blindedSettlementHashCommitment: 'pedersen-settlement-001',
    contractExpirationSeconds: 15552000,
    riskMetricDepth: 16,
    pqcSignatureScheme: 'ML-DSA-65',
    clearingHouseInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedCounterpartyRiskCommitment: 'pedersen-risk-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkDerivativeRangeProofHash: 'zk-derivative-proof-001',
    riskCommitteeAttestation: mockAttestation(),
    riskCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    contractExpirationSeconds: 15552000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    riskCommitteeAttestation: mockAttestation(),
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
  const hub = new PqcFinancialDerivativesGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkDerivativeClaimValidator({
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
  const claim = ctx.validator.verifyDerivativeClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 78 PQ financial derivatives gating', () => {
  test('PqcFinancialDerivativesGatingHub initializes a pool and emits DERIVATIVE_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'DERIVATIVE_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkDerivativeClaimValidator verifies a derivative claim and emits ZK_DERIVATIVE_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyDerivativeClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_DERIVATIVE_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcFinancialDerivativesGatingHub completes accreditation after claim and emits COUNTERPARTY_RISK_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'COUNTERPARTY_RISK_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcFinancialDerivativesGatingHub rejects contract expiration exceeding maximum', () => {
    const hub = new PqcFinancialDerivativesGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.contractExpirationSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcFinancialDerivativesGatingHub rejects risk metric depth exceeding maximum', () => {
    const hub = new PqcFinancialDerivativesGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.riskMetricDepth = 64;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcFinancialDerivativesGatingHub rejects un-attested clearing house initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcFinancialDerivativesGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.clearingHouseInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkDerivativeClaimValidator rejects un-attested risk committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkDerivativeClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.riskCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyDerivativeClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcFinancialDerivativesGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcFinancialDerivativesGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcFinancialDerivativesGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcFinancialDerivativesGatingHub rejects accreditation completion before derivative claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcFinancialDerivativesGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkDerivativeClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkDerivativeRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyDerivativeClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkDerivativeClaimValidator bans peers broadcasting out-of-bounds contract expirations', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.contractExpirationSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyDerivativeClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkDerivativeClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyDerivativeClaim(clReq);
    expect(() => validator.verifyDerivativeClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq derivative gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqDerivativeGating', {
      clearingHouseQuorum: 3,
      contractExpirationSeconds: 15552000,
      riskMetricDepth: 16,
      pqcSignatureScheme: 'ML-DSA-65',
      clearingHouseInitializerAttestation: true,
      riskCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderDerivativeClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqDerivativeGating', { clearingHouseQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { contractExpirationSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { riskMetricDepth: 64 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { clearingHouseInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { riskCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { banMalformedOrOutOfOrderDerivativeClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqDerivativeGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
