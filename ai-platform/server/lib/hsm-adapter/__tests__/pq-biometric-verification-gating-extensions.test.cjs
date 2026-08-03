'use strict';

/**
 * Track 77: PQC Biometric Verification Gating & ZK Biometric Claim Validators —
 * extension tests.
 *
 * Tests the batch pool initialization, liveness metric depth
 * rebalancing, committee signature aggregation, pool
 * cancellation, cross-chain settlement, HW-SNARK proof
 * generation, batch biometric claim verification, slashing
 * window validation, partial signature aggregation, slash
 * event recording with reason codes, and summary statistics.
 */
const {
  PqcBiometricVerificationGatingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
} = require('../pqc-biometric-verification-gating-hub.cjs');
const {
  ZkBiometricClaimValidator,
  CLAIM_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
} = require('../zk-biometric-claim-validator.cjs');
const { EnclaveAttestationClient, _signMock } = require('../enclave-attestation-client.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== 'object') return { verified: false };
    if (!attestation.authority || attestation.authority !== 'mock-authority') return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minBiometricAuthorityQuorum: 3,
  maxTemplateExpirationSeconds: 15552000,
  maxLivenessMetricDepth: 16,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireBiometricAuthorityInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderBiometricClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  const attestation = {
    version: 1,
    enclaveType: 'mock',
    measurement: 'MOCK_MEASUREMENT_00000000000000000000000000000000',
    mrenclave: 'MOCK_MRENCLAVE_00000000000000000000000000000000',
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: 'mock-authority',
  };
  attestation.signature = _signMock(attestation);
  return attestation;
}

function baseInitRequest() {
  return {
    sourceTenantId: 'tenant-a',
    targetChainId: 'chain-b',
    blindedTemplateHashCommitment: 'pedersen-template-001',
    blindedLivenessMetricCommitment: 'pedersen-liveness-001',
    blindedSubjectHashCommitment: 'pedersen-subject-001',
    templateExpirationSeconds: 7776000,
    livenessMetricDepth: 8,
    pqcSignatureScheme: 'ML-DSA-65',
    biometricAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedLivenessMetricCommitment: 'pedersen-liveness-001',
    blindedClaimValueCommitment: 'pedersen-claimval-001',
    zkBiometricRangeProofHash: 'zk-biometric-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    templateExpirationSeconds: 7776000,
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
  const attestationClient = new MockAttestationClient();
  const hub = new PqcBiometricVerificationGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkBiometricClaimValidator({
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
  const claim = ctx.validator.verifyBiometricClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 77 PQC Biometric Verification Gating extensions', () => {
  describe('PqcBiometricVerificationGatingHub — liveness metric depth rebalancing', () => {
    test('rebalances liveness metric depth with increase direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceLivenessMetricDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 2,
      });
      expect(rebalance.rebalanceId).toBeDefined();
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.INCREASE);
      expect(rebalance.rebalanceEpoch).toBe(1);
    });

    test('rebalances liveness metric depth with decrease direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceLivenessMetricDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.DECREASE,
        rebalanceAmount: 1,
      });
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.DECREASE);
    });

    test('updates livenessMetricDepth on rebalance when newLivenessMetricDepth provided', () => {
      const ctx = setupAndInitPool();
      ctx.hub.rebalanceLivenessMetricDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 2,
        newLivenessMetricDepth: 12,
      });
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.livenessMetricDepth).toBe(12);
      expect(pool.rebalanceEpoch).toBe(1);
    });

    test('rejects rebalance with invalid direction', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceLivenessMetricDepth({
        poolId: ctx.pool.poolId,
        direction: 'invalid',
        rebalanceAmount: 2,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with non-positive amount', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceLivenessMetricDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 0,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with missing poolId', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.rebalanceLivenessMetricDepth({})).toThrow(HsmAdapterError);
    });

    test('rejects rebalance on accredited pool', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.rebalanceLivenessMetricDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 2,
      })).toThrow(HsmAdapterError);
    });

    test('returns rebalance record via getRebalance', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceLivenessMetricDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 2,
      });
      const retrieved = ctx.hub.getRebalance(rebalance.rebalanceId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.rebalanceId).toBe(rebalance.rebalanceId);
    });

    test('POOL_STATUS and REBALANCE_DIRECTION constants are exported', () => {
      expect(POOL_STATUS.OPEN).toBe('open');
      expect(POOL_STATUS.REBALANCING).toBe('rebalancing');
      expect(POOL_STATUS.ACCREDITED).toBe('accredited');
      expect(POOL_STATUS.SETTLED).toBe('settled');
      expect(POOL_STATUS.CANCELLED).toBe('cancelled');
      expect(REBALANCE_DIRECTION.INCREASE).toBe('increase');
      expect(REBALANCE_DIRECTION.DECREASE).toBe('decrease');
    });
  });

  describe('PqcBiometricVerificationGatingHub — batch initialization', () => {
    test('batch initializes multiple pools', () => {
      const { hub } = setupHubAndValidator();
      const reqs = [];
      for (let i = 0; i < 3; i++) {
        const r = baseInitRequest();
        r.poolId = `pool-batch-${i}`;
        reqs.push(r);
      }
      const result = hub.batchInitializePools(reqs);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test('batch init handles mixed valid/invalid', () => {
      const { hub } = setupHubAndValidator();
      const r1 = baseInitRequest();
      r1.poolId = 'pool-ok';
      const r2 = baseInitRequest();
      r2.poolId = 'pool-ok';
      const r3 = baseInitRequest();
      r3.poolId = 'pool-ok2';
      r3.livenessMetricDepth = 999;
      const result = hub.batchInitializePools([r1, r2, r3]);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
    });

    test('rejects empty batch', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.batchInitializePools([])).toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { hub } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 51 }, () => baseInitRequest());
      expect(() => hub.batchInitializePools(bigBatch)).toThrow(HsmAdapterError);
    });
  });

  describe('PqcBiometricVerificationGatingHub — cross-chain settlement', () => {
    test('settles an accredited pool cross-chain', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      const settlement = ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-b',
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe('chain-b');
    });

    test('rejects settlement of non-accredited pool', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with mismatched chain', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'wrong-chain',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with missing poolId', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.settlePool({ targetChainId: 'chain-b' }))
        .toThrow(HsmAdapterError);
    });

    test('rejects settlement with missing targetChainId', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.settlePool({ poolId: ctx.pool.poolId }))
        .toThrow(HsmAdapterError);
    });

    test('returns settlement record via getSettlement', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-b',
      });
      const s = ctx.hub.getSettlement(ctx.pool.poolId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe('chain-b');
    });
  });

  describe('PqcBiometricVerificationGatingHub — committee aggregation', () => {
    test('aggregates committee signatures', () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, [
        { peerId: 'p1', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test('rejects aggregation with insufficient signatures', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, [
        { peerId: 'p1', signature: 'sig-1' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with no signatures', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, []))
        .toThrow(HsmAdapterError);
    });

    test('rejects aggregation for unknown pool', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.aggregateCommitteeSignatures('unknown', [
        { peerId: 'p1', signature: 's1' },
        { peerId: 'p2', signature: 's2' },
        { peerId: 'p3', signature: 's3' },
      ])).toThrow(HsmAdapterError);
    });
  });

  describe('PqcBiometricVerificationGatingHub — cancellation', () => {
    test('cancels an open pool', () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.cancelPool(ctx.pool.poolId);
      expect(result.cancelled).toBe(true);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.status).toBe(POOL_STATUS.CANCELLED);
    });

    test('rejects cancelling accredited pool', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.cancelPool(ctx.pool.poolId))
        .toThrow(HsmAdapterError);
    });

    test('rejects double cancellation', () => {
      const ctx = setupAndInitPool();
      ctx.hub.cancelPool(ctx.pool.poolId);
      expect(() => ctx.hub.cancelPool(ctx.pool.poolId))
        .toThrow(HsmAdapterError);
    });

    test('rejects cancelling unknown pool', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.cancelPool('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('PqcBiometricVerificationGatingHub — queries and stats', () => {
    test('returns pools list', () => {
      const ctx = setupAndInitPool();
      expect(ctx.hub.getPools().length).toBe(1);
    });

    test('returns pool count', () => {
      const ctx = setupAndInitPool();
      expect(ctx.hub.getPoolCount()).toBe(1);
    });

    test('returns summary stats', () => {
      const ctx = setupAndInitPool();
      const stats = ctx.hub.getStats();
      expect(stats.totalPools).toBe(1);
      expect(stats.poolsByStatus).toBeDefined();
      expect(stats.initCount).toBeGreaterThan(0);
    });
  });

  describe('ZkBiometricClaimValidator — HW-SNARK proof generation', () => {
    test('generates a hardware-accelerated SNARK proof', () => {
      const ctx = setupAndInitPool();
      const proof = ctx.validator.generateHwSnarkProof({
        poolId: ctx.pool.poolId,
        livenessMetric: 95,
        claimValue: 90,
      });
      expect(proof.zkBiometricRangeProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe('groth16');
    });

    test('rejects proof generation with missing poolId', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.generateHwSnarkProof({ livenessMetric: 100, claimValue: 50 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects proof generation with missing values', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.validator.generateHwSnarkProof({ poolId: ctx.pool.poolId }))
        .toThrow(HsmAdapterError);
    });

    test('rejects proof generation for unknown pool', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.generateHwSnarkProof({
        poolId: 'unknown',
        livenessMetric: 100,
        claimValue: 50,
      })).toThrow(HsmAdapterError);
    });
  });

  describe('ZkBiometricClaimValidator — batch biometric claim verification', () => {
    test('batch verifies multiple biometric claims', () => {
      const ctx = setupHubAndValidator();
      const pools = [];
      for (let i = 0; i < 3; i++) {
        const req = baseInitRequest();
        req.poolId = `pool-bv-${i}`;
        const p = ctx.hub.initializePool(req);
        pools.push(p);
      }
      const batch = pools.map((p, i) => {
        const r = baseClaimRequest(p.poolId);
        r.peerId = `peer-bv-${i}`;
        return r;
      });
      const result = ctx.validator.batchVerifyBiometricClaims(batch);
      expect(result.verifiedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test('batch verification handles mixed valid/invalid', () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.poolId = 'pool-mix';
      ctx.hub.initializePool(req);
      const batch = [
        (() => { const r = baseClaimRequest('pool-mix'); r.peerId = 'p1'; return r; })(),
        (() => { const r = baseClaimRequest('pool-mix'); r.peerId = 'p2'; return r; })(),
        (() => { const r = baseClaimRequest('unknown-pool'); r.peerId = 'p3'; return r; })(),
      ];
      const result = ctx.validator.batchVerifyBiometricClaims(batch);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test('rejects empty batch', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.batchVerifyBiometricClaims([])).toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { validator } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 101 }, () => baseClaimRequest('x'));
      expect(() => validator.batchVerifyBiometricClaims(bigBatch)).toThrow(HsmAdapterError);
    });

    test('records batch history', () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.poolId = 'pool-bh';
      ctx.hub.initializePool(req);
      const r = baseClaimRequest('pool-bh');
      r.peerId = 'p-bh';
      ctx.validator.batchVerifyBiometricClaims([r]);
      expect(ctx.validator.getBatchHistory().length).toBe(1);
    });
  });

  describe('ZkBiometricClaimValidator — partial signature aggregation', () => {
    test('aggregates partial signatures', () => {
      const ctx = setupAndInitPool();
      const result = ctx.validator.aggregatePartialSignatures(ctx.pool.poolId, [
        { peerId: 'p1', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test('rejects aggregation with banned peer', () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.zkBiometricRangeProofHash = null;
      cReq.peerId = 'bad-peer';
      try { ctx.validator.verifyBiometricClaim(cReq); } catch (e) { /* expected */ }
      expect(ctx.validator.isPeerBanned('bad-peer')).toBe(true);
      expect(() => ctx.validator.aggregatePartialSignatures(ctx.pool.poolId, [
        { peerId: 'bad-peer', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with insufficient signatures', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.validator.aggregatePartialSignatures(ctx.pool.poolId, [
        { peerId: 'p1', signature: 'sig-1' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with missing poolId', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.aggregatePartialSignatures('', [
        { peerId: 'p1', signature: 's1' },
      ])).toThrow(HsmAdapterError);
    });
  });

  describe('ZkBiometricClaimValidator — slashing window validation', () => {
    test('validates claim within slashing window', () => {
      const ctx = setupAndInitPool();
      const claimTs = Math.floor(Date.now() / 1000);
      const result = ctx.validator.validateSlashingWindow(ctx.pool.poolId, claimTs);
      expect(result.withinWindow).toBe(true);
    });

    test('detects claim outside slashing window', () => {
      const ctx = setupAndInitPool();
      const claimTs = Math.floor(Date.now() / 1000) + 99999999;
      const result = ctx.validator.validateSlashingWindow(ctx.pool.poolId, claimTs);
      expect(result.withinWindow).toBe(false);
    });

    test('rejects validation for unknown pool', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow('unknown', 1000))
        .toThrow(HsmAdapterError);
    });

    test('rejects validation with invalid timestamp', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.validator.validateSlashingWindow(ctx.pool.poolId, 'bad'))
        .toThrow(HsmAdapterError);
    });

    test('rejects validation with missing poolId', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow('', 1000))
        .toThrow(HsmAdapterError);
    });
  });

  describe('ZkBiometricClaimValidator — slashing and stats', () => {
    test('records slashes for malformed claims', () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.zkBiometricRangeProofHash = null;
      cReq.peerId = 'peer-slash';
      try { ctx.validator.verifyBiometricClaim(cReq); } catch (e) { /* expected */ }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('records slashes for out-of-bounds template expiration', () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.peerId = 'peer-oob';
      cReq.templateExpirationSeconds = 99999999;
      try { ctx.validator.verifyBiometricClaim(cReq); } catch (e) { /* expected */ }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('records slashes for duplicate claims', () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.peerId = 'peer-dup';
      ctx.validator.verifyBiometricClaim(cReq);
      try { ctx.validator.verifyBiometricClaim(cReq); } catch (e) { /* expected */ }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('returns slashed claims list', () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.zkBiometricRangeProofHash = null;
      cReq.peerId = 'peer-slash-2';
      try { ctx.validator.verifyBiometricClaim(cReq); } catch (e) { /* expected */ }
      expect(ctx.validator.getSlashedClaims().length).toBeGreaterThan(0);
    });

    test('returns verified claims list', () => {
      const ctx = setupInitAndClaim();
      expect(ctx.validator.getVerifiedClaims().length).toBeGreaterThan(0);
    });

    test('returns summary stats', () => {
      const ctx = setupInitAndClaim();
      const stats = ctx.validator.getStats();
      expect(stats.totalVerified).toBeGreaterThan(0);
      expect(stats.hwAccelType).toBeDefined();
    });

    test('CLAIM_STATUS, SLASH_REASON, and HW_ACCEL_TYPES constants are exported', () => {
      expect(CLAIM_STATUS.VERIFIED).toBe('verified');
      expect(CLAIM_STATUS.SLASHED).toBe('slashed');
      expect(SLASH_REASON.MALFORMED).toBe('malformed_claim');
      expect(SLASH_REASON.DUPLICATE).toBe('duplicate_claim');
      expect(SLASH_REASON.TEMPLATE_EXPIRATION_OUT_OF_BOUNDS).toBe('template_expiration_out_of_bounds');
      expect(SLASH_REASON.POOL_NOT_FOUND).toBe('pool_not_found');
      expect(SLASH_REASON.BANNED_PEER).toBe('banned_peer');
      expect(SLASH_REASON.OUT_OF_WINDOW).toBe('out_of_window');
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe('gpu_cuda');
      expect(HW_ACCEL_TYPES.FPGA).toBe('fpga');
      expect(HW_ACCEL_TYPES.ASIC).toBe('asic');
      expect(HW_ACCEL_TYPES.SIMULATED).toBe('simulated');
    });
  });

  describe('full Track 77 extended flow', () => {
    test('complete init -> rebalance -> claim -> complete -> settle flow', () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.poolId = 'pool-full-flow';
      const pool = ctx.hub.initializePool(req);
      expect(pool.poolId).toBe('pool-full-flow');
      const rebalance = ctx.hub.rebalanceLivenessMetricDepth({
        poolId: pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 2,
        newLivenessMetricDepth: 12,
      });
      expect(rebalance.rebalanceEpoch).toBe(1);
      const snarkProof = ctx.validator.generateHwSnarkProof({
        poolId: pool.poolId,
        livenessMetric: 95,
        claimValue: 90,
      });
      expect(snarkProof.zkBiometricRangeProofHash).toBeDefined();
      const cReq = baseClaimRequest(pool.poolId);
      cReq.peerId = 'peer-claim';
      cReq.zkBiometricRangeProofHash = snarkProof.zkBiometricRangeProofHash;
      const claim = ctx.validator.verifyBiometricClaim(cReq);
      expect(claim.status).toBe(CLAIM_STATUS.VERIFIED);
      const sigResult = ctx.hub.aggregateCommitteeSignatures(pool.poolId, [
        { peerId: 'peer-0', signature: 'sig-0' },
        { peerId: 'peer-1', signature: 'sig-1' },
        { peerId: 'peer-2', signature: 'sig-2' },
      ]);
      expect(sigResult.signatureCount).toBe(3);
      const completion = ctx.hub.completeAccreditation(baseCompleteRequest(pool.poolId));
      expect(completion.completionId).toBeDefined();
      const settlement = ctx.hub.settlePool({
        poolId: pool.poolId,
        targetChainId: 'chain-b',
      });
      expect(settlement.settlementId).toBeDefined();
      const windowResult = ctx.validator.validateSlashingWindow(
        pool.poolId,
        Math.floor(Date.now() / 1000),
      );
      expect(windowResult.withinWindow).toBe(true);
      const hStats = ctx.hub.getStats();
      expect(hStats.accreditCount).toBeGreaterThan(0);
      expect(hStats.settleCount).toBeGreaterThan(0);
      expect(hStats.rebalanceCount).toBeGreaterThan(0);
      const vStats = ctx.validator.getStats();
      expect(vStats.claimCount).toBeGreaterThan(0);
      expect(vStats.hwProofCount).toBeGreaterThan(0);
    });
  });
});
