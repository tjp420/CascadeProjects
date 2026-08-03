'use strict';

/**
 * Track 70: PQ Carbon Credit Tokenization tests.
 */
const { PqcCarbonCreditTokenizationHub } = require('../pqc-carbon-credit-tokenization-hub.cjs');
const { ZkCarbonRetirementValidator } = require('../zk-carbon-retirement-validator.cjs');
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
  minRetirementQuorum: 3,
  maxVintageAgeSeconds: 63072000,
  maxCarbonTonnageCap: 1000000000,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireAssetInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderRetirementAssertions: true,
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
    blindedCarbonVolumeCommitment: 'pedersen-carbon-001',
    blindedVintageCertificationCommitment: 'pedersen-vintage-001',
    blindedRetiredAllocationCommitment: 'pedersen-retired-001',
    vintageAgeSeconds: 31536000,
    carbonTonnageCap: 1000000,
    pqcSignatureScheme: 'ML-DSA-65',
    assetInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseRetirementRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedRetiredAllocationCommitment: 'pedersen-retired-001',
    blindedRetirementQuantityCommitment: 'pedersen-retireqty-001',
    zkRetirementRangeProofHash: 'zk-retirement-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    vintageAgeSeconds: 31536000,
  };
}

function baseFinalizeRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
    committeeSignatures: ['sig-a', 'sig-b', 'sig-c'],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcCarbonCreditTokenizationHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkCarbonRetirementValidator({
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

function setupInitAndRetirement() {
  const ctx = setupAndInitPool();
  const retirement = ctx.validator.verifyRetirementProof(baseRetirementRequest(ctx.pool.poolId));
  return { ...ctx, retirement };
}

describe('Track 70 PQ carbon credit tokenization', () => {
  test('PqcCarbonCreditTokenizationHub initializes a pool and emits CARBON_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'CARBON_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkCarbonRetirementValidator verifies a retirement proof and emits ZK_RETIREMENT_PROOF_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const retirement = validator.verifyRetirementProof(baseRetirementRequest(pool.poolId));
    expect(retirement.retirementId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_RETIREMENT_PROOF_VERIFIED')).toBe(true);
  });

  test('PqcCarbonCreditTokenizationHub finalizes a retirement after proof and emits CARBON_CREDIT_RETIREMENT_FINALIZED', () => {
    const { events, hub, pool } = setupInitAndRetirement();
    const finalization = hub.finalizeRetirement(baseFinalizeRequest(pool.poolId));
    expect(finalization.finalizationId).toBeDefined();
    expect(events.some((e) => e.event === 'CARBON_CREDIT_RETIREMENT_FINALIZED')).toBe(true);
  });

  test('PqcCarbonCreditTokenizationHub rejects vintage age seconds exceeding maximum', () => {
    const hub = new PqcCarbonCreditTokenizationHub({ policy: POLICY });
    const request = baseInitRequest();
    request.vintageAgeSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCarbonCreditTokenizationHub rejects carbon tonnage cap exceeding maximum', () => {
    const hub = new PqcCarbonCreditTokenizationHub({ policy: POLICY });
    const request = baseInitRequest();
    request.carbonTonnageCap = 2000000000;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCarbonCreditTokenizationHub rejects un-attested asset initializer', () => {
    const attestationClient = new MockAttestationClient();
    const hub = new PqcCarbonCreditTokenizationHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.assetInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkCarbonRetirementValidator rejects un-attested clearing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new MockAttestationClient();
    const validator = new ZkCarbonRetirementValidator({ policy: POLICY, hub, attestationClient });
    const retReq = baseRetirementRequest(pool.poolId);
    retReq.clearingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyRetirementProof(retReq)).toThrow(HsmAdapterError);
  });

  test('PqcCarbonCreditTokenizationHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcCarbonCreditTokenizationHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCarbonCreditTokenizationHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcCarbonCreditTokenizationHub rejects retirement finalization before proof verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.finalizeRetirement(baseFinalizeRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcCarbonCreditTokenizationHub rejects retirement finalization with insufficient quorum', () => {
    const { hub, pool } = setupInitAndRetirement();
    const finReq = baseFinalizeRequest(pool.poolId);
    finReq.committeeSignatures = ['sig-a'];
    expect(() => hub.finalizeRetirement(finReq)).toThrow(HsmAdapterError);
  });

  test('ZkCarbonRetirementValidator bans peers broadcasting malformed retirement proofs', () => {
    const { validator, pool } = setupAndInitPool();
    const retReq = baseRetirementRequest(pool.poolId);
    retReq.zkRetirementRangeProofHash = null;
    retReq.peerId = 'peer-bad';
    expect(() => validator.verifyRetirementProof(retReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkCarbonRetirementValidator bans peers broadcasting out-of-bounds vintage ages', () => {
    const { validator, pool } = setupAndInitPool();
    const retReq = baseRetirementRequest(pool.poolId);
    retReq.vintageAgeSeconds = 99999999;
    retReq.peerId = 'peer-bad';
    expect(() => validator.verifyRetirementProof(retReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkCarbonRetirementValidator bans peers broadcasting duplicate retirement proofs', () => {
    const { validator, pool } = setupAndInitPool();
    const retReq = baseRetirementRequest(pool.poolId);
    retReq.peerId = 'peer-bad';
    validator.verifyRetirementProof(retReq);
    expect(() => validator.verifyRetirementProof(retReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq carbon tokenization configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqCarbonTokenization', {
      retirementQuorum: 3,
      vintageAgeSeconds: 31536000,
      carbonTonnageCap: 1000000,
      pqcSignatureScheme: 'ML-DSA-65',
      assetInitializerAttestation: true,
      clearingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderRetirementAssertions: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqCarbonTokenization', { retirementQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { vintageAgeSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { carbonTonnageCap: 2000000000 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { assetInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { clearingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { banMalformedOrOutOfOrderRetirementAssertions: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqCarbonTokenization', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
