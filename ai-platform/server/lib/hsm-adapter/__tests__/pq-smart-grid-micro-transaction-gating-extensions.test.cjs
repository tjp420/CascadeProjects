"use strict";

/**
 * Track 91: PQC Smart-Grid Micro-Transaction Gating & ZK Micro-Transaction
 * Claim Validators — extension tests.
 *
 * Tests the new batch pool initialization, consumption chain depth
 * rebalancing, committee signature aggregation, pool
 * cancellation, cross-chain settlement, HW-SNARK proof
 * generation, batch micro-transaction claim verification, slashing
 * window validation, partial signature aggregation, slash
 * event recording with reason codes, and summary statistics.
 */
const {
  PqcSmartGridMicroTransactionGatingHub,
  POOL_STATUS,
  REBALANCE_DIRECTION,
} = require("../pqc-smart-grid-micro-transaction-gating-hub.cjs");
const {
  ZkMicroTransactionClaimValidator,
  CLAIM_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
} = require("../zk-micro-transaction-claim-validator.cjs");
const {
  EnclaveAttestationClient,
} = require("../enclave-attestation-client.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

class MockAttestationClient {
  verify(attestation) {
    if (!attestation || typeof attestation !== "object")
      return { verified: false };
    if (!attestation.authority || attestation.authority !== "mock-authority")
      return { verified: false };
    return { verified: true };
  }
}

const POLICY = {
  minGridOperatorQuorum: 5,
  maxTransactionWindowSeconds: 86400,
  maxConsumptionChainDepth: 18,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireGridAuthorityInitializerAttestation: true,
  requireLoadBalanceOversightCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderMicroTransactionClaims: true,
  requireCanonicalPayloadLayout: true,
};

function mockAttestation() {
  return {
    version: 1,
    enclaveType: "mock",
    measurement: "MOCK_MEASUREMENT_00000000000000000000000000000000",
    mrenclave: "MOCK_MRENCLAVE_00000000000000000000000000000000",
    timestamp: Math.floor(Date.now() / 1000),
    attestationAgeSeconds: 0,
    authority: "mock-authority",
    signature: "mock-signature-placeholder",
  };
}

function baseInitRequest() {
  return {
    sourceTenantId: "tenant-a",
    targetChainId: "chain-b",
    blindedConsumptionTelemetryCommitment: "pedersen-consumption-001",
    blindedLoadBalanceCommitment: "pedersen-loadbalance-001",
    blindedMeterIdentityCommitment: "pedersen-meter-001",
    transactionWindowSeconds: 43200,
    consumptionChainDepth: 12,
    pqcSignatureScheme: "ML-DSA-65",
    gridAuthorityInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseClaimRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedLoadBalanceCommitment: "pedersen-loadbalance-001",
    blindedClaimValueCommitment: "pedersen-claimval-001",
    zkMicroTransactionRangeProofHash: "zk-microtx-proof-001",
    loadBalanceOversightCommitteeAttestation: mockAttestation(),
    loadBalanceOversightCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    blindThresholdSignature: "partial-sig-001",
    transactionWindowSeconds: 43200,
  };
}

function baseCompleteRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    loadBalanceOversightCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c", "sig-d", "sig-e"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
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
  const claim = ctx.validator.verifyMicroTransactionClaim(
    baseClaimRequest(ctx.pool.poolId),
  );
  return { ...ctx, claim };
}

describe("Track 91 PQC Smart-Grid Micro-Transaction Gating extensions", () => {
  describe("PqcSmartGridMicroTransactionGatingHub — consumption chain depth rebalancing", () => {
    test("rebalances consumption chain depth with increase direction", () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceConsumptionChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
      });
      expect(rebalance.rebalanceId).toBeDefined();
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.INCREASE);
      expect(rebalance.rebalanceEpoch).toBe(1);
    });

    test("rebalances consumption chain depth with decrease direction", () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceConsumptionChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.DECREASE,
        rebalanceAmount: 2,
      });
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.DECREASE);
    });

    test("updates consumptionChainDepth on rebalance when newConsumptionChainDepth provided", () => {
      const ctx = setupAndInitPool();
      ctx.hub.rebalanceConsumptionChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
        newConsumptionChainDepth: 12,
      });
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.consumptionChainDepth).toBe(12);
      expect(pool.rebalanceEpoch).toBe(1);
    });

    test("rejects rebalance with invalid direction", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.hub.rebalanceConsumptionChainDepth({
          poolId: ctx.pool.poolId,
          direction: "invalid",
          rebalanceAmount: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects rebalance with non-positive amount", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.hub.rebalanceConsumptionChainDepth({
          poolId: ctx.pool.poolId,
          direction: REBALANCE_DIRECTION.INCREASE,
          rebalanceAmount: 0,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects rebalance with missing poolId", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.rebalanceConsumptionChainDepth({})).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects rebalance on accredited pool", () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() =>
        ctx.hub.rebalanceConsumptionChainDepth({
          poolId: ctx.pool.poolId,
          direction: REBALANCE_DIRECTION.INCREASE,
          rebalanceAmount: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("returns rebalance record via getRebalance", () => {
      const ctx = setupAndInitPool();
      const rebalance = ctx.hub.rebalanceConsumptionChainDepth({
        poolId: ctx.pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
      });
      const retrieved = ctx.hub.getRebalance(rebalance.rebalanceId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.rebalanceId).toBe(rebalance.rebalanceId);
    });

    test("POOL_STATUS and REBALANCE_DIRECTION constants are exported", () => {
      expect(POOL_STATUS.OPEN).toBe("open");
      expect(POOL_STATUS.REBALANCING).toBe("rebalancing");
      expect(POOL_STATUS.ACCREDITED).toBe("accredited");
      expect(POOL_STATUS.SETTLED).toBe("settled");
      expect(POOL_STATUS.CANCELLED).toBe("cancelled");
      expect(REBALANCE_DIRECTION.INCREASE).toBe("increase");
      expect(REBALANCE_DIRECTION.DECREASE).toBe("decrease");
    });
  });

  describe("PqcSmartGridMicroTransactionGatingHub — batch initialization", () => {
    test("batch initializes multiple pools", () => {
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

    test("batch init handles mixed valid/invalid", () => {
      const { hub } = setupHubAndValidator();
      const r1 = baseInitRequest();
      r1.poolId = "pool-ok";
      const r2 = baseInitRequest();
      r2.poolId = "pool-ok";
      const r3 = baseInitRequest();
      r3.poolId = "pool-ok2";
      r3.consumptionChainDepth = 999;
      const result = hub.batchInitializePools([r1, r2, r3]);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
    });

    test("rejects empty batch", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.batchInitializePools([])).toThrow(HsmAdapterError);
    });

    test("rejects batch exceeding max size", () => {
      const { hub } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 51 }, () => baseInitRequest());
      expect(() => hub.batchInitializePools(bigBatch)).toThrow(HsmAdapterError);
    });
  });

  describe("PqcSmartGridMicroTransactionGatingHub — cross-chain settlement", () => {
    test("settles an accredited pool cross-chain", () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      const settlement = ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: "chain-b",
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe("chain-b");
    });

    test("rejects settlement of non-accredited pool", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.hub.settlePool({
          poolId: ctx.pool.poolId,
          targetChainId: "chain-b",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with mismatched chain", () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() =>
        ctx.hub.settlePool({
          poolId: ctx.pool.poolId,
          targetChainId: "wrong-chain",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with missing poolId", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.settlePool({ targetChainId: "chain-b" })).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects settlement with missing targetChainId", () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.settlePool({ poolId: ctx.pool.poolId })).toThrow(
        HsmAdapterError,
      );
    });

    test("returns settlement record via getSettlement", () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      ctx.hub.settlePool({
        poolId: ctx.pool.poolId,
        targetChainId: "chain-b",
      });
      const s = ctx.hub.getSettlement(ctx.pool.poolId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe("chain-b");
    });
  });

  describe("PqcSmartGridMicroTransactionGatingHub — committee aggregation", () => {
    test("aggregates committee signatures", () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, [
        { peerId: "p1", signature: "sig-1" },
        { peerId: "p2", signature: "sig-2" },
        { peerId: "p3", signature: "sig-3" },
        { peerId: "p4", signature: "sig-4" },
        { peerId: "p5", signature: "sig-5" },
      ]);
      expect(result.signatureCount).toBe(5);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test("rejects aggregation with insufficient signatures", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, [
          { peerId: "p1", signature: "sig-1" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with no signatures", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, []),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation for unknown pool", () => {
      const { hub } = setupHubAndValidator();
      expect(() =>
        hub.aggregateCommitteeSignatures("unknown", [
          { peerId: "p1", signature: "s1" },
          { peerId: "p2", signature: "s2" },
          { peerId: "p3", signature: "s3" },
          { peerId: "p4", signature: "s4" },
          { peerId: "p5", signature: "s5" },
        ]),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("PqcSmartGridMicroTransactionGatingHub — cancellation", () => {
    test("cancels an open pool", () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.cancelPool(ctx.pool.poolId);
      expect(result.cancelled).toBe(true);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.status).toBe(POOL_STATUS.CANCELLED);
    });

    test("rejects cancelling accredited pool", () => {
      const ctx = setupInitAndClaim();
      ctx.hub.completeAccreditation(baseCompleteRequest(ctx.pool.poolId));
      expect(() => ctx.hub.cancelPool(ctx.pool.poolId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects double cancellation", () => {
      const ctx = setupAndInitPool();
      ctx.hub.cancelPool(ctx.pool.poolId);
      expect(() => ctx.hub.cancelPool(ctx.pool.poolId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects cancelling unknown pool", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.cancelPool("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("PqcSmartGridMicroTransactionGatingHub — queries and stats", () => {
    test("returns pools list", () => {
      const ctx = setupAndInitPool();
      expect(ctx.hub.getPools().length).toBe(1);
    });

    test("returns summary stats", () => {
      const ctx = setupAndInitPool();
      const stats = ctx.hub.getStats();
      expect(stats.totalPools).toBe(1);
      expect(stats.poolsByStatus).toBeDefined();
      expect(stats.initCount).toBeGreaterThan(0);
    });
  });

  describe("ZkMicroTransactionClaimValidator — HW-SNARK proof generation", () => {
    test("generates a hardware-accelerated SNARK proof", () => {
      const ctx = setupAndInitPool();
      const proof = ctx.validator.generateHwSnarkProof({
        poolId: ctx.pool.poolId,
        loadBalance: 500,
        claimValue: 450,
      });
      expect(proof.zkMicroTransactionRangeProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe("groth16");
    });

    test("rejects proof generation with missing poolId", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.generateHwSnarkProof({ loadBalance: 100, claimValue: 50 }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation with missing values", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.validator.generateHwSnarkProof({ poolId: ctx.pool.poolId }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation for unknown pool", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.generateHwSnarkProof({
          poolId: "unknown",
          loadBalance: 100,
          claimValue: 50,
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMicroTransactionClaimValidator — batch micro-transaction claim verification", () => {
    test("batch verifies multiple micro-transaction claims", () => {
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
      const result = ctx.validator.batchVerifyMicroTransactionClaims(batch);
      expect(result.verifiedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test("batch verification handles mixed valid/invalid", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.poolId = "pool-mix";
      ctx.hub.initializePool(req);
      const batch = [
        (() => {
          const r = baseClaimRequest("pool-mix");
          r.peerId = "p1";
          return r;
        })(),
        (() => {
          const r = baseClaimRequest("pool-mix");
          r.peerId = "p2";
          return r;
        })(),
        (() => {
          const r = baseClaimRequest("unknown-pool");
          r.peerId = "p3";
          return r;
        })(),
      ];
      const result = ctx.validator.batchVerifyMicroTransactionClaims(batch);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test("rejects empty batch", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.batchVerifyMicroTransactionClaims([])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects batch exceeding max size", () => {
      const { validator } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 101 }, () => baseClaimRequest("x"));
      expect(() =>
        validator.batchVerifyMicroTransactionClaims(bigBatch),
      ).toThrow(HsmAdapterError);
    });

    test("records batch history", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.poolId = "pool-bh";
      ctx.hub.initializePool(req);
      const r = baseClaimRequest("pool-bh");
      r.peerId = "p-bh";
      ctx.validator.batchVerifyMicroTransactionClaims([r]);
      expect(ctx.validator.getBatchHistory().length).toBe(1);
    });
  });

  describe("ZkMicroTransactionClaimValidator — partial signature aggregation", () => {
    test("aggregates blind threshold signatures", () => {
      const ctx = setupAndInitPool();
      const result = ctx.validator.aggregateBlindThresholdSignatures(
        ctx.pool.poolId,
        [
          { peerId: "p1", signature: "sig-1" },
          { peerId: "p2", signature: "sig-2" },
          { peerId: "p3", signature: "sig-3" },
          { peerId: "p4", signature: "sig-4" },
          { peerId: "p5", signature: "sig-5" },
        ],
      );
      expect(result.signatureCount).toBe(5);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test("rejects aggregation with banned peer", () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.zkMicroTransactionRangeProofHash = null;
      cReq.peerId = "bad-peer";
      try {
        ctx.validator.verifyMicroTransactionClaim(cReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.validator.isPeerBanned("bad-peer")).toBe(true);
      expect(() =>
        ctx.validator.aggregateBlindThresholdSignatures(ctx.pool.poolId, [
          { peerId: "bad-peer", signature: "sig-1" },
          { peerId: "p2", signature: "sig-2" },
          { peerId: "p3", signature: "sig-3" },
          { peerId: "p4", signature: "sig-4" },
          { peerId: "p5", signature: "sig-5" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with insufficient signatures", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.validator.aggregateBlindThresholdSignatures(ctx.pool.poolId, [
          { peerId: "p1", signature: "sig-1" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with missing poolId", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.aggregateBlindThresholdSignatures("", [
          { peerId: "p1", signature: "s1" },
        ]),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMicroTransactionClaimValidator — slashing window validation", () => {
    test("validates claim within slashing window", () => {
      const ctx = setupAndInitPool();
      const claimTs = Math.floor(Date.now() / 1000);
      const result = ctx.validator.validateSlashingWindow(
        ctx.pool.poolId,
        claimTs,
      );
      expect(result.withinWindow).toBe(true);
    });

    test("detects claim outside slashing window", () => {
      const ctx = setupAndInitPool();
      const claimTs = Math.floor(Date.now() / 1000) + 100000000;
      const result = ctx.validator.validateSlashingWindow(
        ctx.pool.poolId,
        claimTs,
      );
      expect(result.withinWindow).toBe(false);
    });

    test("rejects validation for unknown pool", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow("unknown", 1000)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects validation with invalid timestamp", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.validator.validateSlashingWindow(ctx.pool.poolId, "bad"),
      ).toThrow(HsmAdapterError);
    });

    test("rejects validation with missing poolId", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow("", 1000)).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("ZkMicroTransactionClaimValidator — slashing and stats", () => {
    test("records slashes for malformed claims", () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.zkMicroTransactionRangeProofHash = null;
      cReq.peerId = "peer-slash";
      try {
        ctx.validator.verifyMicroTransactionClaim(cReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("records slashes for out-of-bounds transcript expiration", () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.peerId = "peer-oob";
      cReq.transactionWindowSeconds = 999999999;
      try {
        ctx.validator.verifyMicroTransactionClaim(cReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("records slashes for duplicate claims", () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.peerId = "peer-dup";
      ctx.validator.verifyMicroTransactionClaim(cReq);
      try {
        ctx.validator.verifyMicroTransactionClaim(cReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("returns slashed claims list", () => {
      const ctx = setupAndInitPool();
      const cReq = baseClaimRequest(ctx.pool.poolId);
      cReq.zkMicroTransactionRangeProofHash = null;
      cReq.peerId = "peer-slash-2";
      try {
        ctx.validator.verifyMicroTransactionClaim(cReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.validator.getSlashedClaims().length).toBeGreaterThan(0);
    });

    test("returns summary stats", () => {
      const ctx = setupInitAndClaim();
      const stats = ctx.validator.getStats();
      expect(stats.totalVerified).toBeGreaterThan(0);
      expect(stats.hwAccelType).toBeDefined();
    });

    test("CLAIM_STATUS, SLASH_REASON, and HW_ACCEL_TYPES constants are exported", () => {
      expect(CLAIM_STATUS.VERIFIED).toBe("verified");
      expect(CLAIM_STATUS.SLASHED).toBe("slashed");
      expect(SLASH_REASON.MALFORMED).toBe("malformed_claim");
      expect(SLASH_REASON.DUPLICATE).toBe("duplicate_claim");
      expect(SLASH_REASON.TRANSACTION_WINDOW_OUT_OF_BOUNDS).toBe(
        "transaction_window_out_of_bounds",
      );
      expect(SLASH_REASON.POOL_NOT_FOUND).toBe("pool_not_found");
      expect(SLASH_REASON.BANNED_PEER).toBe("banned_peer");
      expect(SLASH_REASON.OUT_OF_WINDOW).toBe("out_of_window");
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe("gpu_cuda");
      expect(HW_ACCEL_TYPES.FPGA).toBe("fpga");
      expect(HW_ACCEL_TYPES.ASIC).toBe("asic");
      expect(HW_ACCEL_TYPES.SIMULATED).toBe("simulated");
    });
  });

  describe("full Track 91 extended flow", () => {
    test("complete init → rebalance → claim → accredit → settle flow", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.poolId = "pool-full-flow";
      const pool = ctx.hub.initializePool(req);
      expect(pool.poolId).toBe("pool-full-flow");
      const rebalance = ctx.hub.rebalanceConsumptionChainDepth({
        poolId: pool.poolId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 3,
        newConsumptionChainDepth: 12,
      });
      expect(rebalance.rebalanceEpoch).toBe(1);
      const snarkProof = ctx.validator.generateHwSnarkProof({
        poolId: pool.poolId,
        loadBalance: 500,
        claimValue: 450,
      });
      expect(snarkProof.zkMicroTransactionRangeProofHash).toBeDefined();
      const cReq = baseClaimRequest(pool.poolId);
      cReq.peerId = "peer-claim";
      cReq.zkMicroTransactionRangeProofHash =
        snarkProof.zkMicroTransactionRangeProofHash;
      const claim = ctx.validator.verifyMicroTransactionClaim(cReq);
      expect(claim.status).toBe(CLAIM_STATUS.VERIFIED);
      const sigResult = ctx.hub.aggregateCommitteeSignatures(pool.poolId, [
        { peerId: "peer-0", signature: "sig-0" },
        { peerId: "peer-1", signature: "sig-1" },
        { peerId: "peer-2", signature: "sig-2" },
        { peerId: "peer-3", signature: "sig-3" },
        { peerId: "peer-4", signature: "sig-4" },
      ]);
      expect(sigResult.signatureCount).toBe(5);
      const completion = ctx.hub.completeAccreditation(
        baseCompleteRequest(pool.poolId),
      );
      expect(completion.completionId).toBeDefined();
      const settlement = ctx.hub.settlePool({
        poolId: pool.poolId,
        targetChainId: "chain-b",
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
