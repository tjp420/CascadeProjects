'use strict';

/**
 * Track 85: PQ Telecom Routing Gating tests.
 */
const { PqcTelecomRoutingGatingHub } = require('../pqc-telecom-routing-gating-hub.cjs');
const { ZkBandwidthClaimValidator } = require('../zk-bandwidth-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { CryptoPolicyEngine } = require('../crypto-policy-engine.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minTelecomPeeringQuorum: 3,
  maxAllocationWindowSeconds: 2592000,
  maxNetworkRoutingDepth: 32,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireCarrierEndpointInitializerAttestation: true,
  requireRoutingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderTelecomClaims: true,
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
    blindedRoutingVolumeCommitment: 'pedersen-routing-001',
    blindedLatencyBoundCommitment: 'pedersen-latency-001',
    blindedInfrastructureHashCommitment: 'pedersen-infra-001',
    allocationWindowSeconds: 1296000,
    networkRoutingDepth: 16,
    pqcSignatureScheme: 'ML-DSA-65',
    carrierEndpointInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedLatencyBoundCommitment: 'pedersen-latency-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkTelecomRangeProofHash: 'zk-telecom-proof-001',
    routingCommitteeAttestation: mockAttestation(),
    routingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    blindSignature: 'blind-sig-001',
    allocationWindowSeconds: 1296000,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    routingCommitteeAttestation: mockAttestation(),
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
  const hub = new PqcTelecomRoutingGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkBandwidthClaimValidator({
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
  const claim = ctx.validator.verifyBandwidthClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 85 PQ telecom routing gating', () => {
  test('PqcTelecomRoutingGatingHub initializes a pool and emits TELECOM_ROUTING_POOL_INITIALIZED', () => {
    const { events, hub } = setupHubAndValidator();
    const pool = hub.initializePool(baseInitRequest());
    expect(pool.status).toBe('open');
    expect(pool.poolId).toBeDefined();
    expect(events.some((e) => e.event === 'TELECOM_ROUTING_POOL_INITIALIZED')).toBe(true);
  });

  test('ZkBandwidthClaimValidator verifies a bandwidth claim and emits ZK_BANDWIDTH_CLAIM_VERIFIED', () => {
    const { events, validator, pool } = setupAndInitPool();
    const claim = validator.verifyBandwidthClaim(baseClaimRequest(pool.poolId));
    expect(claim.claimId).toBeDefined();
    expect(events.some((e) => e.event === 'ZK_BANDWIDTH_CLAIM_VERIFIED')).toBe(true);
  });

  test('PqcTelecomRoutingGatingHub completes accreditation after claim and emits ROUTING_ACCREDITATION_COMPLETED', () => {
    const { events, hub, pool } = setupInitAndClaim();
    const completion = hub.completeAccreditation(baseCompleteRequest(pool.poolId));
    expect(completion.completionId).toBeDefined();
    expect(events.some((e) => e.event === 'ROUTING_ACCREDITATION_COMPLETED')).toBe(true);
  });

  test('PqcTelecomRoutingGatingHub rejects allocation window exceeding maximum', () => {
    const hub = new PqcTelecomRoutingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.allocationWindowSeconds = 99999999;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcTelecomRoutingGatingHub rejects network routing depth exceeding maximum', () => {
    const hub = new PqcTelecomRoutingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.networkRoutingDepth = 64;
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcTelecomRoutingGatingHub rejects un-attested carrier endpoint initializer', () => {
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const hub = new PqcTelecomRoutingGatingHub({ policy: POLICY, attestationClient });
    const request = baseInitRequest();
    request.carrierEndpointInitializerAttestation = { authority: 'bad' };
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('ZkBandwidthClaimValidator rejects un-attested routing committee', () => {
    const { hub, pool } = setupAndInitPool();
    const attestationClient = new EnclaveAttestationClient({
      allowedAuthorities: ['mock-authority'],
      allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
    });
    const validator = new ZkBandwidthClaimValidator({ policy: POLICY, hub, attestationClient });
    const clReq = baseClaimRequest(pool.poolId);
    clReq.routingCommitteeAttestation = { authority: 'bad' };
    expect(() => validator.verifyBandwidthClaim(clReq)).toThrow(HsmAdapterError);
  });

  test('PqcTelecomRoutingGatingHub rejects unpermitted PQC signature scheme', () => {
    const hub = new PqcTelecomRoutingGatingHub({ policy: POLICY });
    const request = baseInitRequest();
    request.pqcSignatureScheme = 'RSA-2048';
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcTelecomRoutingGatingHub rejects duplicate pool initialization', () => {
    const { hub } = setupHubAndValidator();
    const request = baseInitRequest();
    request.poolId = 'pool-dup';
    hub.initializePool(request);
    expect(() => hub.initializePool(request)).toThrow(HsmAdapterError);
  });

  test('PqcTelecomRoutingGatingHub rejects accreditation completion before bandwidth claim verification', () => {
    const { hub, pool } = setupAndInitPool();
    expect(() => hub.completeAccreditation(baseCompleteRequest(pool.poolId))).toThrow(HsmAdapterError);
  });

  test('PqcTelecomRoutingGatingHub rejects accreditation completion with insufficient quorum', () => {
    const { hub, pool } = setupInitAndClaim();
    const compReq = baseCompleteRequest(pool.poolId);
    compReq.committeeSignatures = ['sig-a'];
    expect(() => hub.completeAccreditation(compReq)).toThrow(HsmAdapterError);
  });

  test('ZkBandwidthClaimValidator bans peers broadcasting malformed claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.zkTelecomRangeProofHash = null;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyBandwidthClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkBandwidthClaimValidator bans peers broadcasting out-of-bounds allocation windows', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.allocationWindowSeconds = 99999999;
    clReq.peerId = 'peer-bad';
    expect(() => validator.verifyBandwidthClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('ZkBandwidthClaimValidator bans peers broadcasting duplicate claims', () => {
    const { validator, pool } = setupAndInitPool();
    const clReq = baseClaimRequest(pool.poolId);
    clReq.peerId = 'peer-bad';
    validator.verifyBandwidthClaim(clReq);
    expect(() => validator.verifyBandwidthClaim(clReq)).toThrow(HsmAdapterError);
    expect(validator.isPeerBanned('peer-bad')).toBe(true);
  });

  test('CryptoPolicyEngine validates pq telecom gating configuration', () => {
    const engine = new CryptoPolicyEngine({ default: {} });
    expect(() => engine.validate('t1', 'pqTelecomGating', {
      telecomPeeringQuorum: 3,
      allocationWindowSeconds: 1296000,
      networkRoutingDepth: 16,
      pqcSignatureScheme: 'ML-DSA-65',
      carrierEndpointInitializerAttestation: true,
      routingCommitteeAttestation: true,
      attestationAuthority: 'mock-authority',
      banMalformedOrOutOfOrderTelecomClaims: true,
      canonicalPayloadLayout: true,
    })).not.toThrow();

    expect(() => engine.validate('t1', 'pqTelecomGating', { telecomPeeringQuorum: 1 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { allocationWindowSeconds: 99999999 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { networkRoutingDepth: 64 })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { pqcSignatureScheme: 'RSA-2048' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { carrierEndpointInitializerAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { routingCommitteeAttestation: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { attestationAuthority: 'bad' })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { banMalformedOrOutOfOrderTelecomClaims: false })).toThrow(HsmAdapterError);
    expect(() => engine.validate('t1', 'pqTelecomGating', { canonicalPayloadLayout: false })).toThrow(HsmAdapterError);
  });
});
