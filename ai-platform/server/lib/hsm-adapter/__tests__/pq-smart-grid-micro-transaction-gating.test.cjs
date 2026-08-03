'use strict';

/**
 * Track 91: PQ Smart-Grid Micro-Transaction Gating tests.
 */
const { PqcSmartGridMicroTransactionGatingHub } = require('../pqc-smart-grid-micro-transaction-gating-hub.cjs');
const { ZkMicroTransactionClaimValidator } = require('../zk-micro-transaction-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minGridOperatorQuorum: 5,
  maxTransactionWindowSeconds: 86400,
  maxConsumptionChainDepth: 18,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireGridAuthorityInitializerAttestation: true,
  requireLoadBalanceOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderMicroTransactionClaims: true,
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
    blindedConsumptionTelemetryCommitment: 'pedersen-consumption-001',
    blindedLoadBalanceCommitment: 'pedersen-loadbalance-001',
    blindedMeterIdentityCommitment: 'pedersen-meter-001',
    transactionWindowSeconds: 43200,
    consumptionChainDepth: 9,
    pqcSignatureScheme: 'ML-DSA-65',
    gridAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedLoadBalanceCommitment: 'pedersen-loadbalance-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkMicroTransactionRangeProofHash: 'zk-microtx-proof-001',
    loadBalanceOversightCommitteeAttestation: mockAttestation(),
    loadBalanceOversightCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    blindThresholdSignature: 'blind-threshold-sig-001',
    transactionWindowSeconds: 43200,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    loadBalanceOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c', 'sig-d', 'sig-e'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcSmartGridMicroTransactionGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkMicroTransactionClaimValidator({
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
  const claim = ctx.validator.verifyMicroTransactionClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 91 PQ smart-grid micro-transaction gating', () => {
  test('PqcSmartGridMicroTransactionGatingHub initializes a pool and emits SMARTGRID_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'SMARTGRID_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkMicroTransactionClaimValidator verifies a micro-transaction claim and emits ZK_MICRO_TRANSACTION_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyMicroTransactionClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_MICRO_TRANSACTION_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcSmartGridMicroTransactionGatingHub completes accreditation after claim and emits LOAD_BALANCE_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'LOAD_BALANCE_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcSmartGridMicroTransactionGatingHub rejects transaction window exceeding maximum', () => {
    const hub = new PqcSmartGridMicroTransactionGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.transactionWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSmartGridMicroTransactionGatingHub rejects consumption chain depth exceeding maximum', () => {
    const hub = new PqcSmartGridMicroTransactionGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.consumptionChainDepth = 36;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSmartGridMicroTransactionGatingHub rejects un-attested grid authority initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcSmartGridMicroTransactionGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.gridAuthorityInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkMicroTransactionClaimValidator rejects un-attested load balance oversight committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkMicroTransactionClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.loadBalanceOversightCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyMicroTransactionClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcSmartGridMicroTransactionGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcSmartGridMicroTransactionGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSmartGridMicroTransactionGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcSmartGridMicroTransactionGatingHub rejects accreditation completion before micro-transaction claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcSmartGridMicroTransactionGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a', 'sig-b', 'sig-c'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkMicroTransactionClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkMicroTransactionRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyMicroTransactionClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkMicroTransactionClaimValidator bans peers broadcasting out-of-bounds transaction windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.transactionWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyMicroTransactionClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkMicroTransactionClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyMicroTransactionClaim(clReq);
    expect(() => validator.verifyMicroTransactionClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq smart grid gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqSmartGridGating', {
      gridOperatorQuorum: 5,
      transactionWindowSeconds: 43200,
      consumptionChainDepth: 9,
      pqcSignatureScheme: 'ML-DSA-65',
      gridAuthorityInitializerAttestation: true,
      loadBalanceOversightCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderMicroTransactionClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqSmartGridGating', { gridOperatorQuorum: 2 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { transactionWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { consumptionChainDepth: 36 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { gridAuthorityInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { loadBalanceOversightCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { banMalformedOrOutOfOrderMicroTransactionClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqSmartGridGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
