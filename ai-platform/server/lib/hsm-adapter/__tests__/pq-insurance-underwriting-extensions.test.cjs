'use strict';

/**
 * Track 67: PQC Insurance Underwriting & ZK Risk Exposure Validators —
 * extension tests.
 *
 * Tests the new risk rebalancing, batch pool initialization,
 * committee signature aggregation, pool cancellation, cross-chain
 * settlement, HW-SNARK proof generation, batch claim verification,
 * slashing window validation, partial signature aggregation, and
 * summary statistics.
 */
const { PqcInsuranceUnderwritingHub, POOL_STATUS, REBALANCE_DIRECTION } = require('../pqc-insurance-underwriting-hub.cjs');
const { ZkRiskExposureValidator, CLAIM_STATUS, SLASH_REASON, HW_ACCEL_TYPES } = require('../zk-risk-exposure-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== 'object') return { verified: false };
    if (!attestation.authority || attestation.authority !== 'mock-authority') return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minReserveRatio: 30,
  minClaimQuorum: 3,
  maxPoolRiskExposureCap: 1000000000,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireCoverageInitiatorAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderClaimAssertions: true,
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
  const attestationClient = new MockAttestationClient();
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

describe('Track 67 PQC Insurance Underwriting extensions', () => {
  describe('PqcInsuranceUnderwritingHub — risk rebalancing', () => {
    test('rebalances risk exposure with increase direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceRiskExposure({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 50000,
      });
      expect(rebalance.rebalanceId).toBeDefined();
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.INCREASE);
      expect(rebalance.rebalanceEpoch).toBe(1);
    });

    test('rebalances risk exposure with decrease direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceRiskExposure({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.DECREASE,
        rebalanceAmount: 25000,
      });
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.DECREASE);
    });

    test('updates reserve ratio on rebalance', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceRiskExposure({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 50000,
        newReserveRatio: 60,
      });
      expect(rebalance.newReserveRatio).toBe(60);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.reserveRatio).toBe(60);
    });

    test('rejects rebalance with invalid direction', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceRiskExposure({
        poolId: ctx.pool.poolId,
        direction: 'invalid',
        rebalanceAmount: 100,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with non-positive amount', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceRiskExposure({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 0,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with missing poolId', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.rebalanceRiskExposure({})).toThrow(HsmAdapterError);
    });

    test('rejects rebalance on liquidated pool', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
      expect(() => ctx.hub.rebalanceRiskExposure({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 100,
      })).toThrow(HsmAdapterError);
    });

    test('returns rebalance record via getRebalance', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceRiskExposure({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 100,
      });
      const retrieved = ctx.hub.getRebalance(rebalance.rebalanceId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.rebalanceId).toBe(rebalance.rebalanceId);
    });

    test('POOL_STATUS and REBALANCE_DIRECTION constants are exported', () => {
      expect(POOL_STATUS.OPEN).toBe('open');
      expect(POOL_STATUS.REBALANCING).toBe('rebalancing');
      expect(POOL_STATUS.LIQUIDATED).toBe('liquidated');
      expect(POOL_STATUS.SETTLED).toBe('settled');
      expect(POOL_STATUS.CANCELLED).toBe('cancelled');
      expect(REBALANCE_DIRECTION.INCREASE).toBe('increase');
      expect(REBALANCE_DIRECTION.DECREASE).toBe('decrease');
    });
  });

  describe('PqcInsuranceUnderwritingHub — batch initialization', () => {
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
      r2.poolId = 'pool-ok'; // duplicate
      const r3 = baseInitRequest();
      r3.poolId = 'pool-ok2';
      r3.reserveRatio = 10; // below min
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

  describe('PqcInsuranceUnderwritingHub — cross-chain settlement', () => {
    test('settles a liquidated pool cross-chain', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
      const settlement = ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-b',
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe('chain-b');
    });

    test('rejects settlement of non-liquidated pool', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with mismatched chain', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
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

    test('returns settlement record via getSettlement', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
      ctx.hub.settlePool({ poolId: ctx.pool.poolId, targetChainId: 'chain-b' });
      const s = ctx.hub.getSettlement(ctx.pool.poolId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe('chain-b');
    });
  });

  describe('PqcInsuranceUnderwritingHub — committee aggregation', () => {
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

  describe('PqcInsuranceUnderwritingHub — cancellation', () => {
    test('cancels an open pool', () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.cancelPool(ctx.pool.poolId);
      expect(result.cancelled).toBe(true);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.status).toBe(POOL_STATUS.CANCELLED);
    });

    test('rejects cancelling liquidated pool', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
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

  describe('PqcInsuranceUnderwritingHub — queries and stats', () => {
    test('returns pools list', () => {
      const ctx = setupAndInitPool();
      expect(ctx.hub.getPools().length).toBe(1);
    });

    test('returns summary stats', () => {
      const ctx = setupAndInitPool();
      const stats = ctx.hub.getStats();
      expect(stats.totalPools).toBe(1);
      expect(stats.poolsByStatus).toBeDefined();
      expect(stats.initCount).toBeGreaterThan(0);
    });
  });

  describe('ZkRiskExposureValidator — HW-SNARK proof generation', () => {
    test('generates a hardware-accelerated SNARK proof', () => {
      const ctx = setupAndInitPool();
      const proof = ctx.validator.generateHwSnarkProof({
        poolId: ctx.pool.poolId,
        reserveValue: 500,
        premiumValue: 1000,
      });
      expect(proof.zkRiskExposureProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe('groth16');
    });

    test('rejects proof generation with missing poolId', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.generateHwSnarkProof({ reserveValue: 100, premiumValue: 50 }))
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
        reserveValue: 100,
        premiumValue: 50,
      })).toThrow(HsmAdapterError);
    });
  });

  describe('ZkRiskExposureValidator — batch claim verification', () => {
    test('batch verifies multiple claim eligibility proofs', () => {
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
      const result = ctx.validator.batchVerifyClaims(batch);
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
      const result = ctx.validator.batchVerifyClaims(batch);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test('rejects empty batch', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.batchVerifyClaims([])).toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { validator } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 101 }, () => baseClaimRequest('x'));
      expect(() => validator.batchVerifyClaims(bigBatch)).toThrow(HsmAdapterError);
    });

    test('records batch history', () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.poolId = 'pool-bh';
      ctx.hub.initializePool(req);
      const r = baseClaimRequest('pool-bh');
      r.peerId = 'p-bh';
      ctx.validator.batchVerifyClaims([r]);
      expect(ctx.validator.getBatchHistory().length).toBe(1);
    });
  });

  describe('ZkRiskExposureValidator — partial signature aggregation', () => {
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
      // Ban a peer first
      const claimReq = baseClaimRequest(ctx.pool.poolId);
      claimReq.zkRiskExposureProofHash = null;
      claimReq.peerId = 'bad-peer';
      try { ctx.validator.verifyClaimEligibility(claimReq); } catch (e) { /* expected */ }
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

  describe('ZkRiskExposureValidator — slashing window validation', () => {
    test('validates claim within slashing window', () => {
      const ctx = setupAndInitPool();
      const claimTs = Math.floor(Date.now() / 1000);
      const result = ctx.validator.validateSlashingWindow(ctx.pool.poolId, claimTs);
      expect(result.withinWindow).toBe(true);
    });

    test('detects claim outside slashing window', () => {
      const ctx = setupAndInitPool();
      const claimTs = Math.floor(Date.now() / 1000) + 100000;
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
  });

  describe('ZkRiskExposureValidator — slashing and stats', () => {
    test('records slashes for malformed claims', () => {
      const ctx = setupAndInitPool();
      const claimReq = baseClaimRequest(ctx.pool.poolId);
      claimReq.zkRiskExposureProofHash = null;
      claimReq.peerId = 'peer-slash';
      try { ctx.validator.verifyClaimEligibility(claimReq); } catch (e) { /* expected */ }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('records slashes for sub-reserve claims', () => {
      const ctx = setupAndInitPool();
      const claimReq = baseClaimRequest(ctx.pool.poolId);
      claimReq.peerId = 'peer-sub-reserve';
      claimReq.reserveValue = 100;
      claimReq.premiumValue = 1000; // reserve ratio = 10% < 30%
      try { ctx.validator.verifyClaimEligibility(claimReq); } catch (e) { /* expected */ }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('returns slashed claims list', () => {
      const ctx = setupAndInitPool();
      const claimReq = baseClaimRequest(ctx.pool.poolId);
      claimReq.zkRiskExposureProofHash = null;
      claimReq.peerId = 'peer-slash-2';
      try { ctx.validator.verifyClaimEligibility(claimReq); } catch (e) { /* expected */ }
      expect(ctx.validator.getSlashedClaims().length).toBeGreaterThan(0);
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
      expect(SLASH_REASON.SUB_RESERVE).toBe('sub_reserve');
      expect(SLASH_REASON.BANNED_PEER).toBe('banned_peer');
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe('gpu_cuda');
      expect(HW_ACCEL_TYPES.ASIC).toBe('asic');
      expect(HW_ACCEL_TYPES.SIMULATED).toBe('simulated');
    });
  });

  describe('full Track 67 extended flow', () => {
    test('complete init → rebalance → claim → liquidate → settle flow', () => {
      const ctx = setupHubAndValidator();
      // Initialize pool
      const req = baseInitRequest();
      req.poolId = 'pool-full-flow';
      const pool = ctx.hub.initializePool(req);
      expect(pool.poolId).toBe('pool-full-flow');
      // Rebalance risk exposure (increase)
      const rebalance = ctx.hub.rebalanceRiskExposure({
        poolId: pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 50000,
        newReserveRatio: 60,
      });
      expect(rebalance.rebalanceEpoch).toBe(1);
      // Generate HW-SNARK proof
      const snarkProof = ctx.validator.generateHwSnarkProof({
        poolId: pool.poolId,
        reserveValue: 600,
        premiumValue: 1000,
      });
      expect(snarkProof.zkRiskExposureProofHash).toBeDefined();
      // Verify claim eligibility
      const claimReq = baseClaimRequest(pool.poolId);
      claimReq.peerId = 'peer-claim';
      claimReq.zkRiskExposureProofHash = snarkProof.zkRiskExposureProofHash;
      claimReq.reserveValue = 600;
      claimReq.premiumValue = 1000;
      const claim = ctx.validator.verifyClaimEligibility(claimReq);
      expect(claim.status).toBe(CLAIM_STATUS.VERIFIED);
      // Aggregate committee signatures
      const sigResult = ctx.hub.aggregateCommitteeSignatures(pool.poolId, [
        { peerId: 'peer-0', signature: 'sig-0' },
        { peerId: 'peer-1', signature: 'sig-1' },
        { peerId: 'peer-2', signature: 'sig-2' },
      ]);
      expect(sigResult.signatureCount).toBe(3);
      // Liquidate pool
      const liquidation = ctx.hub.liquidatePool(baseLiquidateRequest(pool.poolId));
      expect(liquidation.liquidationId).toBeDefined();
      // Settle cross-chain
      const settlement = ctx.hub.settlePool({
        poolId: pool.poolId,
        targetChainId: 'chain-b',
      });
      expect(settlement.settlementId).toBeDefined();
      // Validate slashing window
      const windowResult = ctx.validator.validateSlashingWindow(
        pool.poolId,
        Math.floor(Date.now() / 1000),
      );
      expect(windowResult.withinWindow).toBe(true);
      // Verify stats
      const hStats = ctx.hub.getStats();
      expect(hStats.liquidateCount).toBeGreaterThan(0);
      expect(hStats.settleCount).toBeGreaterThan(0);
      expect(hStats.rebalanceCount).toBeGreaterThan(0);
      const vStats = ctx.validator.getStats();
      expect(vStats.claimCount).toBeGreaterThan(0);
      expect(vStats.hwProofCount).toBeGreaterThan(0);
    });
  });
});
