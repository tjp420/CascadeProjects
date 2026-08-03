'use strict';

/**
 * Track 66: PQC Lending Collateral & ZK Solvency Proof Processors —
 * extension tests.
 *
 * Tests the new collateral rebalancing, batch pool initialization,
 * committee signature aggregation, pool cancellation, cross-chain
 * settlement, HW-SNARK proof generation, batch solvency verification,
 * slashing window validation, partial signature aggregation, and
 * summary statistics.
 */
const { PqcLendingCollateralHub, POOL_STATUS, REBALANCE_DIRECTION } = require('../pqc-lending-collateral-hub.cjs');
const { ZkSolvencyProofProcessor, PROOF_STATUS, SLASH_REASON, HW_ACCEL_TYPES } = require('../zk-solvency-proof-processor.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minLtvRatio: 50,
  minLiquidationSignatureQuorum: 3,
  maxBorrowValueCap: 1000000000,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireBorrowerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrSubSolvencyClaims: true,
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
    blindedBorrowValueCommitment: 'pedersen-borrow-001',
    blindedCollateralCommitment: 'pedersen-collateral-001',
    blindedSafetyMarginCommitment: 'pedersen-margin-001',
    ltvRatio: 75,
    borrowValueCap: 1000000,
    pqcSignatureScheme: 'ML-DSA-65',
    borrowerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseSolvencyRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedCollateralCommitment: 'pedersen-collateral-001',
    blindedBorrowValueCommitment: 'pedersen-borrow-001',
    zkSolvencyRangeProofHash: 'zk-solvency-proof-001',
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: 'committee-hash-001',
    attestationAuthority: 'mock-authority',
    partialSignature: 'partial-sig-001',
    collateralValue: 400,
    borrowValue: 300,
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

function setupHubAndProcessor() {
  const events = [];
  const attestationClient = new EnclaveAttestationClient({
    allowedAuthorities: ['mock-authority'],
    allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
  });
  const hub = new PqcLendingCollateralHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const processor = new ZkSolvencyProofProcessor({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, processor };
}

function setupAndInitPool() {
  const ctx = setupHubAndProcessor();
  const pool = ctx.hub.initializePool(baseInitRequest());
  return { ...ctx, pool };
}

function setupInitAndSolvency() {
  const ctx = setupAndInitPool();
  const proof = ctx.processor.verifySolvencyProof(baseSolvencyRequest(ctx.pool.poolId));
  return { ...ctx, proof };
}

describe('Track 66 PQC Lending Collateral extensions', () => {
  describe('PqcLendingCollateralHub — collateral rebalancing', () => {
    test('rebalances collateral with increase direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceCollateral({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 50000,
      });
      expect(rebalance.rebalanceId).toBeDefined();
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.INCREASE);
      expect(rebalance.rebalanceEpoch).toBe(1);
    });

    test('rebalances collateral with decrease direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceCollateral({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.DECREASE,
        rebalanceAmount: 25000,
      });
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.DECREASE);
    });

    test('updates LTV ratio on rebalance', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceCollateral({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 50000,
        newLtvRatio: 65,
      });
      expect(rebalance.newLtvRatio).toBe(65);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.ltvRatio).toBe(65);
    });

    test('rejects rebalance with invalid direction', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceCollateral({
        poolId: ctx.pool.poolId,
        direction: 'invalid',
        rebalanceAmount: 100,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with non-positive amount', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceCollateral({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 0,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with missing poolId', () => {
      const { hub } = setupHubAndProcessor();
      expect(() => hub.rebalanceCollateral({})).toThrow(HsmAdapterError);
    });

    test('rejects rebalance on liquidated pool', () => {
      const ctx = setupInitAndSolvency();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
      expect(() => ctx.hub.rebalanceCollateral({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 100,
      })).toThrow(HsmAdapterError);
    });

    test('returns rebalance record via getRebalance', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceCollateral({
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

  describe('PqcLendingCollateralHub — batch initialization', () => {
    test('batch initializes multiple pools', () => {
      const { hub } = setupHubAndProcessor();
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
      const { hub } = setupHubAndProcessor();
      const r1 = baseInitRequest();
      r1.poolId = 'pool-ok';
      const r2 = baseInitRequest();
      r2.poolId = 'pool-ok'; // duplicate
      const r3 = baseInitRequest();
      r3.poolId = 'pool-ok2';
      r3.ltvRatio = 30; // below min
      const result = hub.batchInitializePools([r1, r2, r3]);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
    });

    test('rejects empty batch', () => {
      const { hub } = setupHubAndProcessor();
      expect(() => hub.batchInitializePools([])).toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { hub } = setupHubAndProcessor();
      const bigBatch = Array.from({ length: 51 }, () => baseInitRequest());
      expect(() => hub.batchInitializePools(bigBatch)).toThrow(HsmAdapterError);
    });
  });

  describe('PqcLendingCollateralHub — cross-chain settlement', () => {
    test('settles a liquidated pool cross-chain', () => {
      const ctx = setupInitAndSolvency();
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
      const ctx = setupInitAndSolvency();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
      expect(() => ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'wrong-chain',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with missing poolId', () => {
      const { hub } = setupHubAndProcessor();
      expect(() => hub.settlePool({ targetChainId: 'chain-b' }))
        .toThrow(HsmAdapterError);
    });

    test('returns settlement record via getSettlement', () => {
      const ctx = setupInitAndSolvency();
      ctx.hub.liquidatePool(baseLiquidateRequest(ctx.pool.poolId));
      ctx.hub.settlePool({ poolId: ctx.pool.poolId, targetChainId: 'chain-b' });
      const s = ctx.hub.getSettlement(ctx.pool.poolId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe('chain-b');
    });
  });

  describe('PqcLendingCollateralHub — committee aggregation', () => {
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
      const { hub } = setupHubAndProcessor();
      expect(() => hub.aggregateCommitteeSignatures('unknown', [
        { peerId: 'p1', signature: 's1' },
        { peerId: 'p2', signature: 's2' },
        { peerId: 'p3', signature: 's3' },
      ])).toThrow(HsmAdapterError);
    });
  });

  describe('PqcLendingCollateralHub — cancellation', () => {
    test('cancels an open pool', () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.cancelPool(ctx.pool.poolId);
      expect(result.cancelled).toBe(true);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.status).toBe(POOL_STATUS.CANCELLED);
    });

    test('rejects cancelling liquidated pool', () => {
      const ctx = setupInitAndSolvency();
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
      const { hub } = setupHubAndProcessor();
      expect(() => hub.cancelPool('unknown')).toThrow(HsmAdapterError);
    });
  });

  describe('PqcLendingCollateralHub — queries and stats', () => {
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

  describe('ZkSolvencyProofProcessor — HW-SNARK proof generation', () => {
    test('generates a hardware-accelerated SNARK proof', () => {
      const ctx = setupAndInitPool();
      const proof = ctx.processor.generateHwSnarkProof({
        poolId: ctx.pool.poolId,
        collateralValue: 500,
        borrowValue: 300,
      });
      expect(proof.zkSolvencyRangeProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe('groth16');
    });

    test('rejects proof generation with missing poolId', () => {
      const { processor } = setupHubAndProcessor();
      expect(() => processor.generateHwSnarkProof({ collateralValue: 100, borrowValue: 50 }))
        .toThrow(HsmAdapterError);
    });

    test('rejects proof generation with missing values', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.processor.generateHwSnarkProof({ poolId: ctx.pool.poolId }))
        .toThrow(HsmAdapterError);
    });

    test('rejects proof generation for unknown pool', () => {
      const { processor } = setupHubAndProcessor();
      expect(() => processor.generateHwSnarkProof({
        poolId: 'unknown',
        collateralValue: 100,
        borrowValue: 50,
      })).toThrow(HsmAdapterError);
    });
  });

  describe('ZkSolvencyProofProcessor — batch solvency verification', () => {
    test('batch verifies multiple solvency proofs', () => {
      const ctx = setupHubAndProcessor();
      const pools = [];
      for (let i = 0; i < 3; i++) {
        const req = baseInitRequest();
        req.poolId = `pool-bv-${i}`;
        const p = ctx.hub.initializePool(req);
        pools.push(p);
      }
      const batch = pools.map((p, i) => {
        const r = baseSolvencyRequest(p.poolId);
        r.peerId = `peer-bv-${i}`;
        return r;
      });
      const result = ctx.processor.batchVerifySolvencyProofs(batch);
      expect(result.verifiedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test('batch verification handles mixed valid/invalid', () => {
      const ctx = setupHubAndProcessor();
      const req = baseInitRequest();
      req.poolId = 'pool-mix';
      ctx.hub.initializePool(req);
      const batch = [
        (() => { const r = baseSolvencyRequest('pool-mix'); r.peerId = 'p1'; return r; })(),
        (() => { const r = baseSolvencyRequest('pool-mix'); r.peerId = 'p2'; return r; })(),
        (() => { const r = baseSolvencyRequest('unknown-pool'); r.peerId = 'p3'; return r; })(),
      ];
      const result = ctx.processor.batchVerifySolvencyProofs(batch);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test('rejects empty batch', () => {
      const { processor } = setupHubAndProcessor();
      expect(() => processor.batchVerifySolvencyProofs([])).toThrow(HsmAdapterError);
    });

    test('rejects batch exceeding max size', () => {
      const { processor } = setupHubAndProcessor();
      const bigBatch = Array.from({ length: 101 }, () => baseSolvencyRequest('x'));
      expect(() => processor.batchVerifySolvencyProofs(bigBatch)).toThrow(HsmAdapterError);
    });

    test('records batch history', () => {
      const ctx = setupHubAndProcessor();
      const req = baseInitRequest();
      req.poolId = 'pool-bh';
      ctx.hub.initializePool(req);
      const r = baseSolvencyRequest('pool-bh');
      r.peerId = 'p-bh';
      ctx.processor.batchVerifySolvencyProofs([r]);
      expect(ctx.processor.getBatchHistory().length).toBe(1);
    });
  });

  describe('ZkSolvencyProofProcessor — partial signature aggregation', () => {
    test('aggregates partial signatures', () => {
      const ctx = setupAndInitPool();
      const result = ctx.processor.aggregatePartialSignatures(ctx.pool.poolId, [
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
      const solvReq = baseSolvencyRequest(ctx.pool.poolId);
      solvReq.zkSolvencyRangeProofHash = null;
      solvReq.peerId = 'bad-peer';
      try { ctx.processor.verifySolvencyProof(solvReq); } catch (e) { /* expected */ }
      expect(ctx.processor.isPeerBanned('bad-peer')).toBe(true);
      expect(() => ctx.processor.aggregatePartialSignatures(ctx.pool.poolId, [
        { peerId: 'bad-peer', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with insufficient signatures', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.processor.aggregatePartialSignatures(ctx.pool.poolId, [
        { peerId: 'p1', signature: 'sig-1' },
      ])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with missing poolId', () => {
      const { processor } = setupHubAndProcessor();
      expect(() => processor.aggregatePartialSignatures('', [
        { peerId: 'p1', signature: 's1' },
      ])).toThrow(HsmAdapterError);
    });
  });

  describe('ZkSolvencyProofProcessor — slashing window validation', () => {
    test('validates proof within slashing window', () => {
      const ctx = setupAndInitPool();
      const proofTs = Math.floor(Date.now() / 1000);
      const result = ctx.processor.validateSlashingWindow(ctx.pool.poolId, proofTs);
      expect(result.withinWindow).toBe(true);
    });

    test('detects proof outside slashing window', () => {
      const ctx = setupAndInitPool();
      const proofTs = Math.floor(Date.now() / 1000) + 100000;
      const result = ctx.processor.validateSlashingWindow(ctx.pool.poolId, proofTs);
      expect(result.withinWindow).toBe(false);
    });

    test('rejects validation for unknown pool', () => {
      const { processor } = setupHubAndProcessor();
      expect(() => processor.validateSlashingWindow('unknown', 1000))
        .toThrow(HsmAdapterError);
    });

    test('rejects validation with invalid timestamp', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.processor.validateSlashingWindow(ctx.pool.poolId, 'bad'))
        .toThrow(HsmAdapterError);
    });
  });

  describe('ZkSolvencyProofProcessor — slashing and stats', () => {
    test('records slashes for malformed proofs', () => {
      const ctx = setupAndInitPool();
      const solvReq = baseSolvencyRequest(ctx.pool.poolId);
      solvReq.zkSolvencyRangeProofHash = null;
      solvReq.peerId = 'peer-slash';
      try { ctx.processor.verifySolvencyProof(solvReq); } catch (e) { /* expected */ }
      const stats = ctx.processor.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('records slashes for sub-solvency proofs', () => {
      const ctx = setupAndInitPool();
      const solvReq = baseSolvencyRequest(ctx.pool.poolId);
      solvReq.peerId = 'peer-sub-solv';
      solvReq.collateralValue = 100;
      solvReq.borrowValue = 200; // LTV > 100%
      try { ctx.processor.verifySolvencyProof(solvReq); } catch (e) { /* expected */ }
      const stats = ctx.processor.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test('returns slashed proofs list', () => {
      const ctx = setupAndInitPool();
      const solvReq = baseSolvencyRequest(ctx.pool.poolId);
      solvReq.zkSolvencyRangeProofHash = null;
      solvReq.peerId = 'peer-slash-2';
      try { ctx.processor.verifySolvencyProof(solvReq); } catch (e) { /* expected */ }
      expect(ctx.processor.getSlashedProofs().length).toBeGreaterThan(0);
    });

    test('returns summary stats', () => {
      const ctx = setupInitAndSolvency();
      const stats = ctx.processor.getStats();
      expect(stats.totalVerified).toBeGreaterThan(0);
      expect(stats.hwAccelType).toBeDefined();
    });

    test('PROOF_STATUS, SLASH_REASON, and HW_ACCEL_TYPES constants are exported', () => {
      expect(PROOF_STATUS.VERIFIED).toBe('verified');
      expect(PROOF_STATUS.SLASHED).toBe('slashed');
      expect(SLASH_REASON.MALFORMED).toBe('malformed_proof');
      expect(SLASH_REASON.DUPLICATE).toBe('duplicate_proof');
      expect(SLASH_REASON.SUB_SOLVENCY).toBe('sub_solvency');
      expect(SLASH_REASON.BANNED_PEER).toBe('banned_peer');
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe('gpu_cuda');
      expect(HW_ACCEL_TYPES.ASIC).toBe('asic');
      expect(HW_ACCEL_TYPES.SIMULATED).toBe('simulated');
    });
  });

  describe('full Track 66 extended flow', () => {
    test('complete init → rebalance → solvency → liquidate → settle flow', () => {
      const ctx = setupHubAndProcessor();
      // Initialize pool
      const req = baseInitRequest();
      req.poolId = 'pool-full-flow';
      const pool = ctx.hub.initializePool(req);
      expect(pool.poolId).toBe('pool-full-flow');
      // Rebalance collateral (increase)
      const rebalance = ctx.hub.rebalanceCollateral({
        poolId: pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 50000,
        newLtvRatio: 70,
      });
      expect(rebalance.rebalanceEpoch).toBe(1);
      // Generate HW-SNARK proof
      const snarkProof = ctx.processor.generateHwSnarkProof({
        poolId: pool.poolId,
        collateralValue: 500,
        borrowValue: 350,
      });
      expect(snarkProof.zkSolvencyRangeProofHash).toBeDefined();
      // Verify solvency proof
      const solvReq = baseSolvencyRequest(pool.poolId);
      solvReq.peerId = 'peer-solv';
      solvReq.zkSolvencyRangeProofHash = snarkProof.zkSolvencyRangeProofHash;
      solvReq.collateralValue = 500;
      solvReq.borrowValue = 350;
      const proof = ctx.processor.verifySolvencyProof(solvReq);
      expect(proof.status).toBe(PROOF_STATUS.VERIFIED);
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
      const windowResult = ctx.processor.validateSlashingWindow(
        pool.poolId,
        Math.floor(Date.now() / 1000),
      );
      expect(windowResult.withinWindow).toBe(true);
      // Verify stats
      const hStats = ctx.hub.getStats();
      expect(hStats.liquidateCount).toBeGreaterThan(0);
      expect(hStats.settleCount).toBeGreaterThan(0);
      expect(hStats.rebalanceCount).toBeGreaterThan(0);
      const pStats = ctx.processor.getStats();
      expect(pStats.proofCount).toBeGreaterThan(0);
      expect(pStats.hwProofCount).toBeGreaterThan(0);
    });
  });
});
