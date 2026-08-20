"use strict";

/**
 * Track 63: PQC Blind Option Pools & HW-SNARK VDF Aggregators —
 * extension tests.
 *
 * Tests the new VDF-locked execution, cross-chain settlement,
 * batch initialization, committee signature aggregation, pool
 * expiration/cancellation, HW-SNARK proof generation, batch margin
 * verification, slashing windows, and partial signature aggregation.
 */
const {
  PqcBlindOptionPoolHub,
  POOL_STATUS,
  VDF_PARAMS,
} = require("../pqc-blind-option-pool-hub.cjs");
const {
  ZkMarginAdequacyProcessor,
  PROOF_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
} = require("../zk-margin-adequacy-processor.cjs");
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
  minCollateralRatio: 150,
  minExecutionSignatureQuorum: 3,
  maxContractLifetimeSeconds: 2592000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireInitializerAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrSubCollateralProofs: true,
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
  const now = Math.floor(Date.now() / 1000);
  return {
    sourceTenantId: "tenant-a",
    targetChainId: "chain-b",
    blindedValueCommitment: "pedersen-value-001",
    blindedStrikeCommitment: "pedersen-strike-001",
    blindedCollateralCommitment: "pedersen-collateral-001",
    collateralRatio: 200,
    expirationTimestamp: now + 86400,
    pqcSignatureScheme: "ML-DSA-65",
    initializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseMarginProofRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    blindedCollateralCommitment: "pedersen-collateral-001",
    blindedStrikeCommitment: "pedersen-strike-001",
    zkRangeProofHash: "zk-range-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    collateralValue: 300,
    strikeValue: 100,
  };
}

function baseExecRequest(poolId) {
  return {
    poolId: poolId || "pool-001",
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndProcessor() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcBlindOptionPoolHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const processor = new ZkMarginAdequacyProcessor({
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

function setupInitAndMargin() {
  const ctx = setupAndInitPool();
  const proof = ctx.processor.verifyMarginAdequacy(
    baseMarginProofRequest(ctx.pool.poolId),
  );
  return { ...ctx, proof };
}

describe("Track 63 PQC Blind Option Pools extensions", () => {
  describe("PqcBlindOptionPoolHub — VDF-locked execution", () => {
    test("initializes pool with VDF lock parameters", () => {
      const { pool } = setupAndInitPool();
      expect(pool.vdfLock).toBeDefined();
      expect(pool.vdfLock.difficulty).toBe(VDF_PARAMS.defaultDifficulty);
      expect(pool.vdfLock.seed).toBeDefined();
      expect(pool.vdfLock.vdfProofHash).toBeDefined();
      expect(pool.vdfLock.algorithm).toBe("wesolowski");
    });

    test("VDF lock is not enforced by default", () => {
      const { pool } = setupAndInitPool();
      expect(pool.vdfLock.enforced).toBe(false);
    });

    test("VDF lock is enforced when enforceVdfLock is true", () => {
      const ctx = setupHubAndProcessor();
      const req = baseInitRequest();
      req.enforceVdfLock = true;
      const pool = ctx.hub.initializePool(req);
      expect(pool.vdfLock.enforced).toBe(true);
    });

    test("rejects VDF difficulty below minimum", () => {
      const { hub } = setupHubAndProcessor();
      const req = baseInitRequest();
      req.vdfDifficulty = 512;
      expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
    });

    test("rejects VDF difficulty above maximum", () => {
      const { hub } = setupHubAndProcessor();
      const req = baseInitRequest();
      req.vdfDifficulty = 100000;
      expect(() => hub.initializePool(req)).toThrow(HsmAdapterError);
    });

    test("rejects execution when VDF lock is enforced and not yet unlocked", () => {
      const ctx = setupHubAndProcessor();
      const req = baseInitRequest();
      req.enforceVdfLock = true;
      const pool = ctx.hub.initializePool(req);
      ctx.processor.verifyMarginAdequacy(baseMarginProofRequest(pool.poolId));
      expect(() =>
        ctx.hub.executeContract(baseExecRequest(pool.poolId)),
      ).toThrow(HsmAdapterError);
    });

    test("POOL_STATUS and VDF_PARAMS constants are exported", () => {
      expect(POOL_STATUS.OPEN).toBe("open");
      expect(POOL_STATUS.EXECUTED).toBe("executed");
      expect(POOL_STATUS.SETTLED).toBe("settled");
      expect(POOL_STATUS.EXPIRED).toBe("expired");
      expect(POOL_STATUS.CANCELLED).toBe("cancelled");
      expect(VDF_PARAMS.minDifficulty).toBe(1024);
      expect(VDF_PARAMS.maxDifficulty).toBe(65536);
    });
  });

  describe("PqcBlindOptionPoolHub — cross-chain settlement", () => {
    test("settles an executed contract cross-chain", () => {
      const ctx = setupInitAndMargin();
      ctx.hub.executeContract(baseExecRequest(ctx.pool.poolId));
      const settlement = ctx.hub.settleContract({
        poolId: ctx.pool.poolId,
        targetChainId: "chain-b",
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe("chain-b");
    });

    test("rejects settlement of non-executed pool", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.hub.settleContract({
          poolId: ctx.pool.poolId,
          targetChainId: "chain-b",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with mismatched chain", () => {
      const ctx = setupInitAndMargin();
      ctx.hub.executeContract(baseExecRequest(ctx.pool.poolId));
      expect(() =>
        ctx.hub.settleContract({
          poolId: ctx.pool.poolId,
          targetChainId: "wrong-chain",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with missing poolId", () => {
      const { hub } = setupHubAndProcessor();
      expect(() => hub.settleContract({ targetChainId: "chain-b" })).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects settlement with missing targetChainId", () => {
      const ctx = setupInitAndMargin();
      ctx.hub.executeContract(baseExecRequest(ctx.pool.poolId));
      expect(() => ctx.hub.settleContract({ poolId: ctx.pool.poolId })).toThrow(
        HsmAdapterError,
      );
    });

    test("returns settlement record via getSettlement", () => {
      const ctx = setupInitAndMargin();
      ctx.hub.executeContract(baseExecRequest(ctx.pool.poolId));
      ctx.hub.settleContract({
        poolId: ctx.pool.poolId,
        targetChainId: "chain-b",
      });
      const s = ctx.hub.getSettlement(ctx.pool.poolId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe("chain-b");
    });

    test("returns null for unknown settlement", () => {
      const { hub } = setupHubAndProcessor();
      expect(hub.getSettlement("unknown")).toBeNull();
    });
  });

  describe("PqcBlindOptionPoolHub — batch initialization", () => {
    test("batch initializes multiple pools", () => {
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

    test("batch init handles mixed valid/invalid", () => {
      const { hub } = setupHubAndProcessor();
      const r1 = baseInitRequest();
      r1.poolId = "pool-ok";
      const r2 = baseInitRequest();
      r2.poolId = "pool-ok"; // duplicate
      const r3 = baseInitRequest();
      r3.poolId = "pool-ok2";
      r3.collateralRatio = 50; // below minimum
      const result = hub.batchInitializePools([r1, r2, r3]);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
    });

    test("rejects empty batch", () => {
      const { hub } = setupHubAndProcessor();
      expect(() => hub.batchInitializePools([])).toThrow(HsmAdapterError);
    });

    test("rejects batch exceeding max size", () => {
      const { hub } = setupHubAndProcessor();
      const bigBatch = Array.from({ length: 51 }, () => baseInitRequest());
      expect(() => hub.batchInitializePools(bigBatch)).toThrow(HsmAdapterError);
    });
  });

  describe("PqcBlindOptionPoolHub — committee aggregation", () => {
    test("aggregates committee signatures", () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.aggregateCommitteeSignatures(ctx.pool.poolId, [
        { peerId: "p1", signature: "sig-1" },
        { peerId: "p2", signature: "sig-2" },
        { peerId: "p3", signature: "sig-3" },
      ]);
      expect(result.signatureCount).toBe(3);
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
      const { hub } = setupHubAndProcessor();
      expect(() =>
        hub.aggregateCommitteeSignatures("unknown", [
          { peerId: "p1", signature: "s1" },
          { peerId: "p2", signature: "s2" },
          { peerId: "p3", signature: "s3" },
        ]),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("PqcBlindOptionPoolHub — cancellation and expiration", () => {
    test("cancels an open pool", () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.cancelPool(ctx.pool.poolId);
      expect(result.cancelled).toBe(true);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.status).toBe(POOL_STATUS.CANCELLED);
    });

    test("rejects cancelling executed pool", () => {
      const ctx = setupInitAndMargin();
      ctx.hub.executeContract(baseExecRequest(ctx.pool.poolId));
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

    test("expires a pool", () => {
      const ctx = setupAndInitPool();
      const result = ctx.hub.expirePool(ctx.pool.poolId);
      expect(result.expired).toBe(true);
      const pool = ctx.hub.getPool(ctx.pool.poolId);
      expect(pool.status).toBe(POOL_STATUS.EXPIRED);
    });

    test("rejects double expiration", () => {
      const ctx = setupAndInitPool();
      ctx.hub.expirePool(ctx.pool.poolId);
      expect(() => ctx.hub.expirePool(ctx.pool.poolId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects cancelling unknown pool", () => {
      const { hub } = setupHubAndProcessor();
      expect(() => hub.cancelPool("unknown")).toThrow(HsmAdapterError);
    });

    test("rejects expiring unknown pool", () => {
      const { hub } = setupHubAndProcessor();
      expect(() => hub.expirePool("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("PqcBlindOptionPoolHub — queries and stats", () => {
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

  describe("ZkMarginAdequacyProcessor — HW-SNARK proof generation", () => {
    test("generates a hardware-accelerated SNARK proof", () => {
      const ctx = setupAndInitPool();
      const proof = ctx.processor.generateHwSnarkProof({
        poolId: ctx.pool.poolId,
        collateralValue: 300,
        strikeValue: 100,
      });
      expect(proof.zkRangeProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe("groth16");
    });

    test("rejects proof generation with missing poolId", () => {
      const { processor } = setupHubAndProcessor();
      expect(() =>
        processor.generateHwSnarkProof({
          collateralValue: 300,
          strikeValue: 100,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation with missing values", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.processor.generateHwSnarkProof({
          poolId: ctx.pool.poolId,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation for unknown pool", () => {
      const { processor } = setupHubAndProcessor();
      expect(() =>
        processor.generateHwSnarkProof({
          poolId: "unknown",
          collateralValue: 300,
          strikeValue: 100,
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMarginAdequacyProcessor — batch verification", () => {
    test("batch verifies multiple margin proofs", () => {
      const ctx = setupHubAndProcessor();
      const pools = [];
      for (let i = 0; i < 3; i++) {
        const req = baseInitRequest();
        req.poolId = `pool-bv-${i}`;
        const p = ctx.hub.initializePool(req);
        pools.push(p);
      }
      const batch = pools.map((p) => baseMarginProofRequest(p.poolId));
      const result = ctx.processor.batchVerifyMarginAdequacy(batch);
      expect(result.verifiedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test("batch verification handles mixed valid/invalid", () => {
      const ctx = setupHubAndProcessor();
      for (let i = 0; i < 2; i++) {
        const req = baseInitRequest();
        req.poolId = `pool-mix-${i}`;
        ctx.hub.initializePool(req);
      }
      const batch = [
        baseMarginProofRequest("pool-mix-0"),
        baseMarginProofRequest("pool-mix-1"),
        baseMarginProofRequest("unknown-pool"),
      ];
      const result = ctx.processor.batchVerifyMarginAdequacy(batch);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test("rejects empty batch", () => {
      const { processor } = setupHubAndProcessor();
      expect(() => processor.batchVerifyMarginAdequacy([])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects batch exceeding max size", () => {
      const { processor } = setupHubAndProcessor();
      const bigBatch = Array.from({ length: 101 }, () =>
        baseMarginProofRequest("x"),
      );
      expect(() => processor.batchVerifyMarginAdequacy(bigBatch)).toThrow(
        HsmAdapterError,
      );
    });

    test("records batch history", () => {
      const ctx = setupHubAndProcessor();
      const req = baseInitRequest();
      req.poolId = "pool-bh";
      ctx.hub.initializePool(req);
      ctx.processor.batchVerifyMarginAdequacy([
        baseMarginProofRequest("pool-bh"),
      ]);
      expect(ctx.processor.getBatchHistory().length).toBe(1);
    });
  });

  describe("ZkMarginAdequacyProcessor — partial signature aggregation", () => {
    test("aggregates partial signatures", () => {
      const ctx = setupAndInitPool();
      const result = ctx.processor.aggregatePartialSignatures(ctx.pool.poolId, [
        { peerId: "p1", signature: "sig-1" },
        { peerId: "p2", signature: "sig-2" },
        { peerId: "p3", signature: "sig-3" },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test("rejects aggregation with banned peer", () => {
      const ctx = setupAndInitPool();
      // Ban a peer first
      const proofReq = baseMarginProofRequest(ctx.pool.poolId);
      proofReq.zkRangeProofHash = null;
      proofReq.peerId = "bad-peer";
      try {
        ctx.processor.verifyMarginAdequacy(proofReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.processor.isPeerBanned("bad-peer")).toBe(true);
      expect(() =>
        ctx.processor.aggregatePartialSignatures(ctx.pool.poolId, [
          { peerId: "bad-peer", signature: "sig-1" },
          { peerId: "p2", signature: "sig-2" },
          { peerId: "p3", signature: "sig-3" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with insufficient signatures", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.processor.aggregatePartialSignatures(ctx.pool.poolId, [
          { peerId: "p1", signature: "sig-1" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with missing poolId", () => {
      const { processor } = setupHubAndProcessor();
      expect(() =>
        processor.aggregatePartialSignatures("", [
          { peerId: "p1", signature: "s1" },
        ]),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMarginAdequacyProcessor — slashing window validation", () => {
    test("validates proof within slashing window", () => {
      const ctx = setupAndInitPool();
      const proofTs = Math.floor(Date.now() / 1000);
      const result = ctx.processor.validateSlashingWindow(
        ctx.pool.poolId,
        proofTs,
      );
      expect(result.withinWindow).toBe(true);
    });

    test("detects proof outside slashing window", () => {
      const ctx = setupAndInitPool();
      const proofTs = ctx.pool.expirationTimestamp + 10000;
      const result = ctx.processor.validateSlashingWindow(
        ctx.pool.poolId,
        proofTs,
      );
      expect(result.withinWindow).toBe(false);
    });

    test("rejects validation for unknown pool", () => {
      const { processor } = setupHubAndProcessor();
      expect(() => processor.validateSlashingWindow("unknown", 1000)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects validation with invalid timestamp", () => {
      const ctx = setupAndInitPool();
      expect(() =>
        ctx.processor.validateSlashingWindow(ctx.pool.poolId, "bad"),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMarginAdequacyProcessor — slashing and stats", () => {
    test("records slashes for sub-collateral proofs", () => {
      const ctx = setupAndInitPool();
      const proofReq = baseMarginProofRequest(ctx.pool.poolId);
      proofReq.collateralValue = 50;
      proofReq.strikeValue = 100;
      proofReq.peerId = "peer-slash";
      try {
        ctx.processor.verifyMarginAdequacy(proofReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.processor.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("returns slashed proofs list", () => {
      const ctx = setupAndInitPool();
      const proofReq = baseMarginProofRequest(ctx.pool.poolId);
      proofReq.zkRangeProofHash = null;
      proofReq.peerId = "peer-slash-2";
      try {
        ctx.processor.verifyMarginAdequacy(proofReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.processor.getSlashedProofs().length).toBeGreaterThan(0);
    });

    test("returns summary stats", () => {
      const ctx = setupInitAndMargin();
      const stats = ctx.processor.getStats();
      expect(stats.totalVerified).toBeGreaterThan(0);
      expect(stats.hwAccelType).toBeDefined();
    });

    test("PROOF_STATUS, SLASH_REASON, and HW_ACCEL_TYPES constants are exported", () => {
      expect(PROOF_STATUS.VERIFIED).toBe("verified");
      expect(PROOF_STATUS.SLASHED).toBe("slashed");
      expect(SLASH_REASON.SUB_COLLATERAL).toBe("sub_collateral");
      expect(SLASH_REASON.DUPLICATE).toBe("duplicate_proof");
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe("gpu_cuda");
      expect(HW_ACCEL_TYPES.ASIC).toBe("asic");
      expect(HW_ACCEL_TYPES.SIMULATED).toBe("simulated");
    });
  });

  describe("full Track 63 extended flow", () => {
    test("complete init → margin → exec → settle flow", () => {
      const ctx = setupHubAndProcessor();
      // Initialize pool
      const req = baseInitRequest();
      req.poolId = "pool-full-flow";
      const pool = ctx.hub.initializePool(req);
      expect(pool.vdfLock).toBeDefined();
      // Generate HW-SNARK proof
      const snarkProof = ctx.processor.generateHwSnarkProof({
        poolId: pool.poolId,
        collateralValue: 300,
        strikeValue: 100,
      });
      expect(snarkProof.zkRangeProofHash).toBeDefined();
      // Verify margin adequacy
      const marginReq = baseMarginProofRequest(pool.poolId);
      marginReq.zkRangeProofHash = snarkProof.zkRangeProofHash;
      const marginProof = ctx.processor.verifyMarginAdequacy(marginReq);
      expect(marginProof.status).toBe(PROOF_STATUS.VERIFIED);
      // Aggregate committee signatures
      const sigResult = ctx.hub.aggregateCommitteeSignatures(pool.poolId, [
        { peerId: "p1", signature: "sig-1" },
        { peerId: "p2", signature: "sig-2" },
        { peerId: "p3", signature: "sig-3" },
      ]);
      expect(sigResult.signatureCount).toBe(3);
      // Execute contract
      const exec = ctx.hub.executeContract(baseExecRequest(pool.poolId));
      expect(exec.execId).toBeDefined();
      // Settle cross-chain
      const settlement = ctx.hub.settleContract({
        poolId: pool.poolId,
        targetChainId: "chain-b",
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
      expect(hStats.execCount).toBeGreaterThan(0);
      expect(hStats.settleCount).toBeGreaterThan(0);
      const pStats = ctx.processor.getStats();
      expect(pStats.verifyCount).toBeGreaterThan(0);
      expect(pStats.hwProofCount).toBeGreaterThan(0);
    });
  });
});
