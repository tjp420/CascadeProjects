'use strict';

/**
 * Track 96: PQC Polar Research Data Gating & ZK Research
 * Claim Validators — extension tests.
 *
 * Tests the new batch pool initialization, research chain depth
 * rebalancing, committee signature aggregation, pool
 * cancellation, cross-chain settlement, HW-SNARK proof
 * generation, batch research claim verification, slashing
 * window validation, VDF proof hash aggregation, slash event
 * recording with reason codes, and summary statistics.
 */
const {
  PqcPolarResearchDataGatingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
} = require('../pqc-polar-research-data-gating-hub.cjs');
const {
  ZkResearchClaimValidator,
  CLAIM_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
} = require('../zk-research-claim-validator.cjs');
const { EnclaveAttestationClient } = require('../enclave-attestation-client.cjs');
const { HsmAdapterError } = require('../base-adapter.cjs');

const POLICY = {
  minPolarQuorum: 5,
  maxDataRetentionWindowSeconds: 7776000,
  maxResearchChainDepth: 14,
  allowedPqcSignatureSchemes: ['ML-DSA-44', 'ML-DSA-65', 'ML-DSA-87'],
  requireAntarcticTreatySecretariatInitializerAttestation: true,
  requirePolarResearchOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ['mock-authority'],
  banMalformedOrOutOfOrderResearchClaims: true,
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
    blindedResearchDataCommitment: 'pedersen-researchdata-001',
    blindedSensorTelemetryCommitment: 'pedersen-sensortelemetry-001',
    blindedInstitutionIdentityCommitment: 'pedersen-institution-001',
    dataRetentionWindowSeconds: 3888000,
    researchChainDepth: 10,
    pqcSignatureScheme: 'ML-DSA-65',
    antarcticTreatySecretariatInitializerAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    blindedResearchDataCommitment: 'pedersen-researchdata-001',
    blindedSensorTelemetryCommitment: 'pedersen-sensortelemetry-001',
    blindedInstitutionIdentityCommitment: 'pedersen-institution-001',
    zkResearchRangeProofHash: 'zk-research-proof-001',
    vdfProofHash: 'vdf-proof-hash-001',
    polarResearchOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: 'mock-authority',
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || 'pool-001',
    polarResearchOversightCommitteeAttestation: mockAttestation(),
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
  const hub = new PqcPolarResearchDataGatingHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkResearchClaimValidator({
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
  const claim = ctx.validator.verifyResearchClaim(baseClaimRequest(ctx.pool.poolId));
  return { ...ctx, claim };
}

describe('Track 96 PQC Polar Research Data Gating extensions', () => {
  describe('PqcPolarResearchDataGatingHub — research chain depth rebalancing', () => {
    test('rebalances research chain depth with increase direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
      });
      expect(rebalance.rebalanceId).toBeDefined();
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.INCREASE);
      expect(rebalance.rebalanceEpoch).toBe(1);
    });

    test('rebalances research chain depth with decrease direction', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.DECREASE,
        rebalanceAmount: 2,
      });
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.DECREASE);
    });

    test('updates researchChainDepth on rebalance when newResearchChainDepth provided', () => {
      const ctx = setupAndInitPool();
      ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
        newResearchChainDepth: 12,
      });
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.researchChainDepth).toBe(12);
      expect(pool.rebalanceEpoch).toBe(1);
    });

    test('rejects rebalance with invalid direction', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: 'invalid',
        rebalanceAmount: 3,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with non-positive amount', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 0,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance with missing poolId', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.rebalanceResearchChainDepth({
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance on non-existent pool', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.rebalanceResearchChainDepth({
        poolId: 'pool-nonexistent',
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
      })).toThrow(HsmAdapterError);
    });

    test('rejects rebalance that exceeds maxResearchChainDepth', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
        newResearchChainDepth: 20,
      })).toThrow(HsmAdapterError);
    });

    test('emits POLARGATE_RESEARCH_DEPTH_REBALANCED event', () => {
      const ctx = setupAndInitPool();
      ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
      });
      expect(ctx.events.some(e => e.event === 'POLARGATE_RESEARCH_DEPTH_REBALANCED')).toBe(true);
    });

    test('getRebalance returns rebalance record by id', () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceResearchChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
        rebalanceId: 'rebal-test-001',
      });
      const retrieved = ctx.hub.getRebalance('rebal-test-001');
      expect(retrieved).not.toBeNull();
      expect(retrieved.rebalanceId).toBe('rebal-test-001');
    });
  });

  describe('PqcPolarResearchDataGatingHub — batch pool initialization', () => {
    test('batch initializes multiple pools successfully', () => {
      const { hub } = setupHubAndValidator();
      const reqs = [
        { ...baseInitRequest(), poolId: 'batch-1' },
        { ...baseInitRequest(), poolId: 'batch-2' },
        { ...baseInitRequest(), poolId: 'batch-3' },
      ];
      const result = hub.batchInitializePools(reqs);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
      expect(result.results).toHaveLength(3);
    });

    test('batch init reports failures for invalid requests', () => {
      const { hub } = setupHubAndValidator();
      const reqs = [
        { ...baseInitRequest(), poolId: 'batch-ok' },
        { ...baseInitRequest(), poolId: 'batch-ok', researchChainDepth: 30 },
      ];
      const result = hub.batchInitializePools(reqs);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });

    test('batch init rejects empty array', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.batchInitializePools([])).toThrow(HsmAdapterError);
    });

    test('batch init rejects array exceeding max batch size', () => {
      const attestationClient = new EnclaveAttestationClient({
        allowedAuthorities: ['mock-authority'],
        allowedMeasurements: ['MOCK_MEASUREMENT_00000000000000000000000000000000'],
      });
      const hub = new PqcPolarResearchDataGatingHub({
        policy: POLICY,
        attestationClient,
        maxBatchSize: 2,
      });
      const reqs = [
        { ...baseInitRequest(), poolId: 'b-1' },
        { ...baseInitRequest(), poolId: 'b-2' },
        { ...baseInitRequest(), poolId: 'b-3' },
      ];
      expect(() => hub.batchInitializePools(reqs)).toThrow(HsmAdapterError);
    });

    test('batch init emits POLARGATE_BATCH_INITIALIZED event', () => {
      const ctx = setupHubAndValidator();
      const reqs = [{ ...baseInitRequest(), poolId: 'batch-evt-1' }];
      ctx.hub.batchInitializePools(reqs);
      expect(ctx.events.some(e => e.event === 'POLARGATE_BATCH_INITIALIZED')).toBe(true);
    });
  });

  describe('PqcPolarResearchDataGatingHub — committee signature aggregation', () => {
    test('aggregates committee signatures meeting quorum', () => {
      const ctx = setupAndInitPool();
      const sigs = [
        { peerId: 'p1', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
        { peerId: 'p3', signature: 'sig-3' },
        { peerId: 'p4', signature: 'sig-4' },
        { peerId: 'p5', signature: 'sig-5' },
      ];
      const result = ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, sigs);
      expect(result.signatureCount).toBe(5);
      expect(result.aggregatedSignature).toBeDefined();
      expect(result.participantIds).toHaveLength(5);
    });

    test('rejects aggregation below quorum', () => {
      const ctx = setupAndInitPool();
      const sigs = [
        { peerId: 'p1', signature: 'sig-1' },
        { peerId: 'p2', signature: 'sig-2' },
      ];
      expect(() => ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, sigs)).toThrow(HsmAdapterError);
    });

    test('rejects aggregation with empty array', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, [])).toThrow(HsmAdapterError);
    });

    test('rejects aggregation on non-existent pool', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.aggregateCommitteeSignatures('pool-none', [
        { peerId: 'p1', signature: 's1' },
      ])).toThrow(HsmAdapterError);
    });

    test('emits POLARGATE_SIGNATURES_AGGREGATED event', () => {
      const ctx = setupAndInitPool();
      const sigs = Array.from({ length: 5 }, (_, i) => ({ peerId: `p${i}`, signature: `s${i}` }));
      ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, sigs);
      expect(ctx.events.some(e => e.event === 'POLARGATE_SIGNATURES_AGGREGATED')).toBe(true);
    });
  });

  describe('PqcPolarResearchDataGatingHub — pool cancellation', () => {
    test('cancels an open pool', () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.cancelPool(ctx.pool.poolId);
      expect(result.cancelled).toBe(true);
      expect(ctx.hub.getPool(ctx.pool.poolId).status).toBe(POOL_STATUS.CANCELLED);
    });

    test('rejects cancellation of accredited pool', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.cancelPool(ctx.pool.poolId)).toThrow(HsmAdapterError);
    });

    test('rejects cancellation of already cancelled pool', () => {
      const ctx = setupAndInitPool();
      ctx.hub.cancelPool(ctx.pool.poolId);
      expect(() => ctx.hub.cancelPool(ctx.pool.poolId)).toThrow(HsmAdapterError);
    });

    test('rejects cancellation of non-existent pool', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.cancelPool('pool-none')).toThrow(HsmAdapterError);
    });

    test('emits POLARGATE_CANCELLED event', () => {
      const ctx = setupAndInitPool();
      ctx.hub.cancelPool(ctx.pool.poolId);
      expect(ctx.events.some(e => e.event === 'POLARGATE_CANCELLED')).toBe(true);
    });
  });

  describe('PqcPolarResearchDataGatingHub — cross-chain settlement', () => {
    test('settles an accredited pool cross-chain', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      const settlement = ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-b',
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe('chain-b');
      expect(settlement.settlementProofHash).toBeDefined();
    });

    test('rejects settlement of non-accredited pool', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-b',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with mismatched chain id', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: 'chain-wrong',
      })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with missing chain id', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.settlePool({ poolId: ctx.pool.poolId })).toThrow(HsmAdapterError);
    });

    test('rejects settlement with missing poolId', () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.settlePool({})).toThrow(HsmAdapterError);
    });

    test('emits POLARGATE_SETTLED event', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      ctx.hub.settlePool({ poolId: ctx.pool.poolId, targetChainId: 'chain-b' });
      expect(ctx.events.some(e => e.event === 'POLARGATE_SETTLED')).toBe(true);
    });

    test('getSettlement returns settlement by pool id', () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      ctx.hub.settlePool({ poolId: ctx.pool.poolId, targetChainId: 'chain-b' });
      const s = ctx.hub.getSettlement(ctx.pool.poolId);
      expect(s).not.toBeNull();
      expect(s.poolId).toBe(ctx.pool.poolId);
    });
  });

  describe('PqcPolarResearchDataGatingHub — summary statistics', () => {
    test('getStats returns correct counts after operations', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 's-1' });
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 's-2' });
      ctx.hub.cancelPool('s-2');
      const stats = ctx.hub.getStats();
      expect(stats.totalPools).toBe(2);
      expect(stats.cancelCount).toBe(1);
      expect(stats.initCount).toBe(2);
      expect(stats.poolsByStatus[POOL_STATUS.OPEN]).toBe(1);
      expect(stats.poolsByStatus[POOL_STATUS.CANCELLED]).toBe(1);
    });

    test('getPools returns metadata array', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'm-1' });
      const pools = ctx.hub.getPools();
      expect(pools).toHaveLength(1);
      expect(pools[0].poolId).toBe('m-1');
      expect(pools[0].status).toBe(POOL_STATUS.OPEN);
    });
  });

  describe('ZkResearchClaimValidator — HW-SNARK proof generation', () => {
    test('generates a HW-SNARK proof with simulated accel', () => {
      const ctx = setupAndInitPool();
      const proof = ctx.validator.generateHwSnarkProof({
        poolId: ctx.pool.poolId,
        researchDataVolume: 1000,
        claimValue: 500,
      });
      expect(proof.zkResearchRangeProofHash).toBeDefined();
      expect(proof.hwAccelType).toBe(HW_ACCEL_TYPES.SIMULATED);
      expect(proof.proofSystem).toBe('groth16');
    });

    test('generates a HW-SNARK proof with GPU CUDA accel', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'gpu-1' });
      const validator = new ZkResearchClaimValidator({
        policy: POLICY, hub: ctx.hub, hwAccelType: HW_ACCEL_TYPES.GPU_CUDA,
      });
      const proof = validator.generateHwSnarkProof({
        poolId: 'gpu-1', researchDataVolume: 2000, claimValue: 800,
      });
      expect(proof.hwAccelType).toBe(HW_ACCEL_TYPES.GPU_CUDA);
    });

    test('rejects HW-SNARK proof with missing poolId', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.generateHwSnarkProof({
        researchDataVolume: 1000, claimValue: 500,
      })).toThrow(HsmAdapterError);
    });

    test('rejects HW-SNARK proof with missing numeric fields', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.validator.generateHwSnarkProof({
        poolId: ctx.pool.poolId,
      })).toThrow(HsmAdapterError);
    });

    test('rejects HW-SNARK proof on non-existent pool', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.generateHwSnarkProof({
        poolId: 'pool-none', researchDataVolume: 1000, claimValue: 500,
      })).toThrow(HsmAdapterError);
    });

    test('emits POLARCLAIM_HW_SNARK_PROOF_GENERATED event', () => {
      const ctx = setupAndInitPool();
      ctx.validator.generateHwSnarkProof({
        poolId: ctx.pool.poolId, researchDataVolume: 1000, claimValue: 500,
      });
      expect(ctx.events.some(e => e.event === 'POLARCLAIM_HW_SNARK_PROOF_GENERATED')).toBe(true);
    });
  });

  describe('ZkResearchClaimValidator — batch verification', () => {
    test('batch verifies multiple research claims', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'bv-1' });
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'bv-2' });
      const reqs = [
        { ...baseClaimRequest('bv-1'), peerId: 'p1' },
        { ...baseClaimRequest('bv-2'), peerId: 'p2' },
      ];
      const result = ctx.validator.batchVerifyResearchClaims(reqs);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(0);
    });

    test('batch verify reports failures for invalid claims', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'bv-3' });
      const reqs = [
        { ...baseClaimRequest('bv-3'), peerId: 'p3' },
        { ...baseClaimRequest('pool-none'), peerId: 'p4' },
      ];
      const result = ctx.validator.batchVerifyResearchClaims(reqs);
      expect(result.verifiedCount).toBe(1);
      expect(result.failedCount).toBe(1);
    });

    test('batch verify rejects empty array', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.batchVerifyResearchClaims([])).toThrow(HsmAdapterError);
    });

    test('batch verify rejects array exceeding max batch size', () => {
      const ctx = setupHubAndValidator();
      const validator = new ZkResearchClaimValidator({
        policy: POLICY, hub: ctx.hub, maxBatchSize: 1,
      });
      const reqs = [
        { ...baseClaimRequest('p1'), peerId: 'a' },
        { ...baseClaimRequest('p2'), peerId: 'b' },
      ];
      expect(() => validator.batchVerifyResearchClaims(reqs)).toThrow(HsmAdapterError);
    });

    test('batch verify records history', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'bh-1' });
      ctx.validator.batchVerifyResearchClaims([
        { ...baseClaimRequest('bh-1'), peerId: 'h1' },
      ]);
      const history = ctx.validator.getBatchHistory();
      expect(history).toHaveLength(1);
      expect(history[0].batchSize).toBe(1);
    });

    test('batch verify emits POLARCLAIM_BATCH_VERIFIED event', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'be-1' });
      ctx.validator.batchVerifyResearchClaims([
        { ...baseClaimRequest('be-1'), peerId: 'e1' },
      ]);
      expect(ctx.events.some(e => e.event === 'POLARCLAIM_BATCH_VERIFIED')).toBe(true);
    });
  });

  describe('ZkResearchClaimValidator — slashing window validation', () => {
    test('validates a claim within the slashing window', () => {
      const ctx = setupAndInitPool();
      const now = Math.floor(Date.now() / 1000);
      const result = ctx.validator.validateSlashingWindow(ctx.pool.poolId, now);
      expect(result.withinWindow).toBe(true);
      expect(result.ageSeconds).toBeLessThanOrEqual(5);
    });

    test('rejects slashing window with missing poolId', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow('', 1000)).toThrow(HsmAdapterError);
    });

    test('rejects slashing window with invalid timestamp', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.validator.validateSlashingWindow(ctx.pool.poolId, -1)).toThrow(HsmAdapterError);
    });

    test('rejects slashing window on non-existent pool', () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow('pool-none', 1000)).toThrow(HsmAdapterError);
    });
  });

  describe('ZkResearchClaimValidator — VDF proof hash aggregation', () => {
    test('aggregates VDF proof hashes meeting quorum', () => {
      const ctx = setupAndInitPool();
      const hashes = Array.from({ length: 5 }, (_, i) => ({ peerId: `p${i}`, signature: `vdf-${i}` }));
      const result = ctx.validator.aggregateVdfProofHashes(ctx.pool.poolId, hashes);
      expect(result.signatureCount).toBe(5);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test('rejects VDF aggregation below quorum', () => {
      const ctx = setupAndInitPool();
      const hashes = [{ peerId: 'p1', signature: 'vdf-1' }];
      expect(() => ctx.validator.aggregateVdfProofHashes(ctx.pool.poolId, hashes)).toThrow(HsmAdapterError);
    });

    test('rejects VDF aggregation with empty array', () => {
      const ctx = setupAndInitPool();
      expect(() => ctx.validator.aggregateVdfProofHashes(ctx.pool.poolId, [])).toThrow(HsmAdapterError);
    });

    test('rejects VDF aggregation with banned peer', () => {
      const ctx = setupAndInitPool();
      const cr = { ...baseClaimRequest(ctx.pool.poolId), zkResearchRangeProofHash: null, peerId: 'bad-peer' };
      try { ctx.validator.verifyResearchClaim(cr); } catch {}
      expect(ctx.validator.isPeerBanned('bad-peer')).toBe(true);
      const hashes = [
        { peerId: 'bad-peer', signature: 'vdf-bad' },
        ...Array.from({ length: 4 }, (_, i) => ({ peerId: `p${i}`, signature: `vdf-${i}` })),
      ];
      expect(() => ctx.validator.aggregateVdfProofHashes(ctx.pool.poolId, hashes)).toThrow(HsmAdapterError);
    });

    test('emits POLARCLAIM_VDF_PROOF_HASHES_AGGREGATED event', () => {
      const ctx = setupAndInitPool();
      const hashes = Array.from({ length: 5 }, (_, i) => ({ peerId: `p${i}`, signature: `vdf-${i}` }));
      ctx.validator.aggregateVdfProofHashes(ctx.pool.poolId, hashes);
      expect(ctx.events.some(e => e.event === 'POLARCLAIM_VDF_PROOF_HASHES_AGGREGATED')).toBe(true);
    });
  });

  describe('ZkResearchClaimValidator — slash event recording', () => {
    test('records slash with MALFORMED reason for missing zk proof', () => {
      const ctx = setupAndInitPool();
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), zkResearchRangeProofHash: null, peerId: 'p-mal' }); } catch {}
      const slashed = ctx.validator.getSlashedClaims();
      expect(slashed.some(s => s.reason === SLASH_REASON.MALFORMED && s.peerId === 'p-mal')).toBe(true);
    });

    test('records slash with DATA_WINDOW_OUT_OF_BOUNDS reason', () => {
      const ctx = setupAndInitPool();
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), dataRetentionWindowSeconds: 99999999, peerId: 'p-win' }); } catch {}
      const slashed = ctx.validator.getSlashedClaims();
      expect(slashed.some(s => s.reason === SLASH_REASON.DATA_WINDOW_OUT_OF_BOUNDS && s.peerId === 'p-win')).toBe(true);
    });

    test('records slash with DUPLICATE reason', () => {
      const ctx = setupAndInitPool();
      ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), peerId: 'p-dup' });
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), peerId: 'p-dup' }); } catch {}
      const slashed = ctx.validator.getSlashedClaims();
      expect(slashed.some(s => s.reason === SLASH_REASON.DUPLICATE && s.peerId === 'p-dup')).toBe(true);
    });

    test('records slash with POOL_NOT_FOUND reason', () => {
      const { validator } = setupHubAndValidator();
      try { validator.verifyResearchClaim({ ...baseClaimRequest('pool-none'), peerId: 'p-nf' }); } catch {}
      const slashed = validator.getSlashedClaims();
      expect(slashed.some(s => s.reason === SLASH_REASON.POOL_NOT_FOUND && s.peerId === 'p-nf')).toBe(true);
    });

    test('records slash with BANNED_PEER reason', () => {
      const ctx = setupAndInitPool();
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), zkResearchRangeProofHash: null, peerId: 'p-ban' }); } catch {}
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), peerId: 'p-ban' }); } catch {}
      const slashed = ctx.validator.getSlashedClaims();
      expect(slashed.some(s => s.reason === SLASH_REASON.BANNED_PEER && s.peerId === 'p-ban')).toBe(true);
    });

    test('emits POLARCLAIM_SLASHED event on slash', () => {
      const ctx = setupAndInitPool();
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), zkResearchRangeProofHash: null, peerId: 'p-evt' }); } catch {}
      expect(ctx.events.some(e => e.event === 'POLARCLAIM_SLASHED')).toBe(true);
    });

    test('getSlashingStats returns correct counts by reason', () => {
      const ctx = setupAndInitPool();
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), zkResearchRangeProofHash: null, peerId: 'p-s1' }); } catch {}
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), vdfProofHash: null, peerId: 'p-s2' }); } catch {}
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThanOrEqual(2);
      expect(stats.byReason[SLASH_REASON.MALFORMED]).toBeGreaterThanOrEqual(2);
    });
  });

  describe('ZkResearchClaimValidator — summary statistics', () => {
    test('getStats returns correct counts after operations', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'stat-1' });
      ctx.validator.verifyResearchClaim({ ...baseClaimRequest('stat-1'), peerId: 'p1' });
      const stats = ctx.validator.getStats();
      expect(stats.totalVerified).toBe(1);
      expect(stats.claimCount).toBe(1);
      expect(stats.bannedPeers).toBe(0);
    });

    test('getStats tracks hwProofCount', () => {
      const ctx = setupAndInitPool();
      ctx.validator.generateHwSnarkProof({
        poolId: ctx.pool.poolId, researchDataVolume: 1000, claimValue: 500,
      });
      const stats = ctx.validator.getStats();
      expect(stats.hwProofCount).toBe(1);
    });

    test('getStats tracks bannedPeers', () => {
      const ctx = setupAndInitPool();
      try { ctx.validator.verifyResearchClaim({ ...baseClaimRequest(ctx.pool.poolId), zkResearchRangeProofHash: null, peerId: 'p-ban' }); } catch {}
      const stats = ctx.validator.getStats();
      expect(stats.bannedPeers).toBe(1);
    });

    test('getVerifiedClaims returns array of verified claims', () => {
      const ctx = setupHubAndValidator();
      ctx.hub.initializePool({ ...baseInitRequest(), poolId: 'vc-1' });
      ctx.validator.verifyResearchClaim({ ...baseClaimRequest('vc-1'), peerId: 'p1' });
      const claims = ctx.validator.getVerifiedClaims();
      expect(claims).toHaveLength(1);
      expect(claims[0].status).toBe(CLAIM_STATUS.VERIFIED);
    });
  });
});
