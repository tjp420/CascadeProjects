'use strict';

/**
 * Track 75: PQ Energy Certificate Gating tests.
 */
const { PqcEnergyCertificateGatingHub } = require('../pqc-energy-certificate-gating-hub.cjs');
const { ZkEnergyClaimValidator } = require('../zk-energy-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minGridOperatorQuorum: 3,
  maxCertificateExpirationSeconds: 63072000,
  maxProductionMetricDepth: 48,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireGridOperatorInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderEnergyClaims: true,
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
    blindedCertificateCommitment: 'pedersen-cert-001',
    blindedGridMetricCommitment: 'pedersen-grid-001',
    blindedProducerHashCommitment: 'pedersen-producer-001',
    certificateExpirationSeconds: 31536000,
    productionMetricDepth: 24,
    pqcSignatureScheme: 'ML-DSA-65',
    gridOperatorInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedGridMetricCommitment: 'pedersen-grid-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkEnergyRangeProofHash: 'zk-energy-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    certificateExpirationSeconds: 31536000,
  };
}

function baseCompleteRequest(poolId) {
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
  const hub = new PqcEnergyCertificateGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkEnergyClaimValidator({
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
  const claim = ctx.validator.verifyEnergyClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 75 PQ energy certificate gating', () => {
  test('PqcEnergyCertificateGatingHub initializes a pool and emits ENERGY_GATING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'ENERGY_GATING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkEnergyClaimValidator verifies an energy claim and emits ZK_ENERGY_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyEnergyClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_ENERGY_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcEnergyCertificateGatingHub completes accreditation after claim and emits CERTIFICATE_TRADING_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'CERTIFICATE_TRADING_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcEnergyCertificateGatingHub rejects certificate expiration exceeding maximum', () => {
    const hub = new PqcEnergyCertificateGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.certificateExpirationSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcEnergyCertificateGatingHub rejects production metric depth exceeding maximum', () => {
    const hub = new PqcEnergyCertificateGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.productionMetricDepth = 96;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcEnergyCertificateGatingHub rejects un-attested grid operator initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcEnergyCertificateGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.gridOperatorInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkEnergyClaimValidator rejects un-attested clearing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkEnergyClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.clearingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyEnergyClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcEnergyCertificateGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcEnergyCertificateGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcEnergyCertificateGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcEnergyCertificateGatingHub rejects accreditation completion before energy claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcEnergyCertificateGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkEnergyClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkEnergyRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyEnergyClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkEnergyClaimValidator bans peers broadcasting out-of-bounds certificate expirations', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.certificateExpirationSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyEnergyClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkEnergyClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyEnergyClaim(clReq);
    expect(() => validator.verifyEnergyClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq energy gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqEnergyGating', {
      gridOperatorQuorum: 3,
      certificateExpirationSeconds: 31536000,
      productionMetricDepth: 24,
      pqcSignatureScheme: 'ML-DSA-65',
      gridOperatorInitializerAttestation: true,
      clearingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderEnergyClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqEnergyGating', { gridOperatorQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { certificateExpirationSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { productionMetricDepth: 96 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { gridOperatorInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { clearingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { banMalformedOrOutOfOrderEnergyClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqEnergyGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
