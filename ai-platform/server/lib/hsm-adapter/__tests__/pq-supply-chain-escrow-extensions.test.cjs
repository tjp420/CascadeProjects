"use strict";

/**
 * Track 68: PQC Supply Chain Escrow & ZK Order Milestone Validators —
 * extension tests.
 *
 * Tests the new batch order initialization, delivery epoch rebalancing,
 * committee signature aggregation, order cancellation, cross-chain
 * settlement, HW-SNARK proof generation, batch milestone verification,
 * slashing window validation, partial signature aggregation, slash
 * event recording with reason codes, and summary statistics.
 */
const {
  PqcSupplyChainEscrowHub,
  ORDER_STATUS,
  REBALANCE_DIRECTION,
} = require("../pqc-supply-chain-escrow-hub.cjs");
const {
  ZkOrderMilestoneValidator,
  MILESTONE_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
} = require("../zk-order-milestone-validator.cjs");
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
  minOrderMatchingQuorum: 3,
  maxProcurementDeliveryEpochs: 30,
  maxEscrowFundingCap: 1000000000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireProcurementInitiatorAttestation: true,
  requireClearingCommitteeAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderDeliveryAssertions: true,
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
    blindedOrderValueCommitment: "pedersen-order-001",
    blindedLogisticsVolumeCommitment: "pedersen-logistics-001",
    blindedDepositMarginCommitment: "pedersen-deposit-001",
    deliveryEpochs: 15,
    escrowFundingCap: 1000000,
    pqcSignatureScheme: "ML-DSA-65",
    procurementInitiatorAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseMilestoneRequest(orderId) {
  return {
    orderId: orderId || "order-001",
    blindedDeliveryQuantityCommitment: "pedersen-quantity-001",
    blindedDeliveryValueCommitment: "pedersen-deliveryvalue-001",
    zkMilestoneRangeProofHash: "zk-milestone-proof-001",
    clearingCommitteeAttestation: mockAttestation(),
    clearingCommitteeAttestationHash: "committee-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
    deliveryEpoch: 10,
  };
}

function baseReleaseRequest(orderId) {
  return {
    orderId: orderId || "order-001",
    clearingCommitteeAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
    committeeSignatures: ["sig-a", "sig-b", "sig-c"],
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcSupplyChainEscrowHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkOrderMilestoneValidator({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, validator };
}

function setupAndInitOrder() {
  const ctx = setupHubAndValidator();
  const order = ctx.hub.initializeOrder(baseInitRequest());
  return { ...ctx, order };
}

function setupInitAndMilestone() {
  const ctx = setupAndInitOrder();
  const milestone = ctx.validator.verifyMilestone(
    baseMilestoneRequest(ctx.order.orderId),
  );
  return { ...ctx, milestone };
}

describe("Track 68 PQC Supply Chain Escrow extensions", () => {
  describe("PqcSupplyChainEscrowHub — delivery epoch rebalancing", () => {
    test("rebalances delivery epochs with increase direction", () => {
      const ctx = setupAndInitOrder();
      const rebalance = ctx.hub.rebalanceDeliveryEpochs({
        orderId: ctx.order.orderId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 5,
      });
      expect(rebalance.rebalanceId).toBeDefined();
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.INCREASE);
      expect(rebalance.rebalanceEpoch).toBe(1);
    });

    test("rebalances delivery epochs with decrease direction", () => {
      const ctx = setupAndInitOrder();
      const rebalance = ctx.hub.rebalanceDeliveryEpochs({
        orderId: ctx.order.orderId,
        direction: REBALANCE_DIRECTION.DECREASE,
        rebalanceAmount: 3,
      });
      expect(rebalance.direction).toBe(REBALANCE_DIRECTION.DECREASE);
    });

    test("updates deliveryEpochs on rebalance when newDeliveryEpochs provided", () => {
      const ctx = setupAndInitOrder();
      ctx.hub.rebalanceDeliveryEpochs({
        orderId: ctx.order.orderId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 5,
        newDeliveryEpochs: 20,
      });
      const order = ctx.hub.getOrder(ctx.order.orderId);
      expect(order.deliveryEpochs).toBe(20);
      expect(order.rebalanceEpoch).toBe(1);
    });

    test("rejects rebalance with invalid direction", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.hub.rebalanceDeliveryEpochs({
          orderId: ctx.order.orderId,
          direction: "invalid",
          rebalanceAmount: 5,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects rebalance with non-positive amount", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.hub.rebalanceDeliveryEpochs({
          orderId: ctx.order.orderId,
          direction: REBALANCE_DIRECTION.INCREASE,
          rebalanceAmount: 0,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects rebalance with missing orderId", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.rebalanceDeliveryEpochs({})).toThrow(HsmAdapterError);
    });

    test("rejects rebalance on released order", () => {
      const ctx = setupInitAndMilestone();
      ctx.hub.releaseEscrow(baseReleaseRequest(ctx.order.orderId));
      expect(() =>
        ctx.hub.rebalanceDeliveryEpochs({
          orderId: ctx.order.orderId,
          direction: REBALANCE_DIRECTION.INCREASE,
          rebalanceAmount: 5,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("returns rebalance record via getRebalance", () => {
      const ctx = setupAndInitOrder();
      const rebalance = ctx.hub.rebalanceDeliveryEpochs({
        orderId: ctx.order.orderId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 5,
      });
      const retrieved = ctx.hub.getRebalance(rebalance.rebalanceId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.rebalanceId).toBe(rebalance.rebalanceId);
    });

    test("ORDER_STATUS and REBALANCE_DIRECTION constants are exported", () => {
      expect(ORDER_STATUS.OPEN).toBe("open");
      expect(ORDER_STATUS.REBALANCING).toBe("rebalancing");
      expect(ORDER_STATUS.RELEASED).toBe("released");
      expect(ORDER_STATUS.SETTLED).toBe("settled");
      expect(ORDER_STATUS.CANCELLED).toBe("cancelled");
      expect(REBALANCE_DIRECTION.INCREASE).toBe("increase");
      expect(REBALANCE_DIRECTION.DECREASE).toBe("decrease");
    });
  });

  describe("PqcSupplyChainEscrowHub — batch initialization", () => {
    test("batch initializes multiple orders", () => {
      const { hub } = setupHubAndValidator();
      const reqs = [];
      for (let i = 0; i < 3; i++) {
        const r = baseInitRequest();
        r.orderId = `order-batch-${i}`;
        reqs.push(r);
      }
      const result = hub.batchInitializeOrders(reqs);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test("batch init handles mixed valid/invalid", () => {
      const { hub } = setupHubAndValidator();
      const r1 = baseInitRequest();
      r1.orderId = "order-ok";
      const r2 = baseInitRequest();
      r2.orderId = "order-ok";
      const r3 = baseInitRequest();
      r3.orderId = "order-ok2";
      r3.deliveryEpochs = 999;
      const result = hub.batchInitializeOrders([r1, r2, r3]);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
    });

    test("rejects empty batch", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.batchInitializeOrders([])).toThrow(HsmAdapterError);
    });

    test("rejects batch exceeding max size", () => {
      const { hub } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 51 }, () => baseInitRequest());
      expect(() => hub.batchInitializeOrders(bigBatch)).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("PqcSupplyChainEscrowHub — cross-chain settlement", () => {
    test("settles a released order cross-chain", () => {
      const ctx = setupInitAndMilestone();
      ctx.hub.releaseEscrow(baseReleaseRequest(ctx.order.orderId));
      const settlement = ctx.hub.settleOrder({
        orderId: ctx.order.orderId,
        targetChainId: "chain-b",
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe("chain-b");
    });

    test("rejects settlement of non-released order", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.hub.settleOrder({
          orderId: ctx.order.orderId,
          targetChainId: "chain-b",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with mismatched chain", () => {
      const ctx = setupInitAndMilestone();
      ctx.hub.releaseEscrow(baseReleaseRequest(ctx.order.orderId));
      expect(() =>
        ctx.hub.settleOrder({
          orderId: ctx.order.orderId,
          targetChainId: "wrong-chain",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with missing orderId", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.settleOrder({ targetChainId: "chain-b" })).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects settlement with missing targetChainId", () => {
      const ctx = setupInitAndMilestone();
      ctx.hub.releaseEscrow(baseReleaseRequest(ctx.order.orderId));
      expect(() => ctx.hub.settleOrder({ orderId: ctx.order.orderId })).toThrow(
        HsmAdapterError,
      );
    });

    test("returns settlement record via getSettlement", () => {
      const ctx = setupInitAndMilestone();
      ctx.hub.releaseEscrow(baseReleaseRequest(ctx.order.orderId));
      ctx.hub.settleOrder({
        orderId: ctx.order.orderId,
        targetChainId: "chain-b",
      });
      const s = ctx.hub.getSettlement(ctx.order.orderId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe("chain-b");
    });
  });

  describe("PqcSupplyChainEscrowHub — committee aggregation", () => {
    test("aggregates committee signatures", () => {
      const ctx = setupAndInitOrder();
      const result = ctx.hub.aggregateCommitteeSignatures(ctx.order.orderId, [
        { peerId: "p1", signature: "sig-1" },
        { peerId: "p2", signature: "sig-2" },
        { peerId: "p3", signature: "sig-3" },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test("rejects aggregation with insufficient signatures", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.hub.aggregateCommitteeSignatures(ctx.order.orderId, [
          { peerId: "p1", signature: "sig-1" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with no signatures", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.hub.aggregateCommitteeSignatures(ctx.order.orderId, []),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation for unknown order", () => {
      const { hub } = setupHubAndValidator();
      expect(() =>
        hub.aggregateCommitteeSignatures("unknown", [
          { peerId: "p1", signature: "s1" },
          { peerId: "p2", signature: "s2" },
          { peerId: "p3", signature: "s3" },
        ]),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("PqcSupplyChainEscrowHub — cancellation", () => {
    test("cancels an open order", () => {
      const ctx = setupAndInitOrder();
      const result = ctx.hub.cancelOrder(ctx.order.orderId);
      expect(result.cancelled).toBe(true);
      const order = ctx.hub.getOrder(ctx.order.orderId);
      expect(order.status).toBe(ORDER_STATUS.CANCELLED);
    });

    test("rejects cancelling released order", () => {
      const ctx = setupInitAndMilestone();
      ctx.hub.releaseEscrow(baseReleaseRequest(ctx.order.orderId));
      expect(() => ctx.hub.cancelOrder(ctx.order.orderId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects double cancellation", () => {
      const ctx = setupAndInitOrder();
      ctx.hub.cancelOrder(ctx.order.orderId);
      expect(() => ctx.hub.cancelOrder(ctx.order.orderId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects cancelling unknown order", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.cancelOrder("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("PqcSupplyChainEscrowHub — queries and stats", () => {
    test("returns orders list", () => {
      const ctx = setupAndInitOrder();
      expect(ctx.hub.getOrders().length).toBe(1);
    });

    test("returns summary stats", () => {
      const ctx = setupAndInitOrder();
      const stats = ctx.hub.getStats();
      expect(stats.totalOrders).toBe(1);
      expect(stats.ordersByStatus).toBeDefined();
      expect(stats.initCount).toBeGreaterThan(0);
    });
  });

  describe("ZkOrderMilestoneValidator — HW-SNARK proof generation", () => {
    test("generates a hardware-accelerated SNARK proof", () => {
      const ctx = setupAndInitOrder();
      const proof = ctx.validator.generateHwSnarkProof({
        orderId: ctx.order.orderId,
        deliveryQuantity: 100,
        deliveryValue: 5000,
      });
      expect(proof.zkMilestoneRangeProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe("groth16");
    });

    test("rejects proof generation with missing orderId", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.generateHwSnarkProof({
          deliveryQuantity: 100,
          deliveryValue: 50,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation with missing values", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.validator.generateHwSnarkProof({ orderId: ctx.order.orderId }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation for unknown order", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.generateHwSnarkProof({
          orderId: "unknown",
          deliveryQuantity: 100,
          deliveryValue: 50,
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkOrderMilestoneValidator — batch milestone verification", () => {
    test("batch verifies multiple milestone proofs", () => {
      const ctx = setupHubAndValidator();
      const orders = [];
      for (let i = 0; i < 3; i++) {
        const req = baseInitRequest();
        req.orderId = `order-bv-${i}`;
        const o = ctx.hub.initializeOrder(req);
        orders.push(o);
      }
      const batch = orders.map((o, i) => {
        const r = baseMilestoneRequest(o.orderId);
        r.peerId = `peer-bv-${i}`;
        return r;
      });
      const result = ctx.validator.batchVerifyMilestones(batch);
      expect(result.verifiedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test("batch verification handles mixed valid/invalid", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.orderId = "order-mix";
      ctx.hub.initializeOrder(req);
      const batch = [
        (() => {
          const r = baseMilestoneRequest("order-mix");
          r.peerId = "p1";
          return r;
        })(),
        (() => {
          const r = baseMilestoneRequest("order-mix");
          r.peerId = "p2";
          return r;
        })(),
        (() => {
          const r = baseMilestoneRequest("unknown-order");
          r.peerId = "p3";
          return r;
        })(),
      ];
      const result = ctx.validator.batchVerifyMilestones(batch);
      expect(result.verifiedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test("rejects empty batch", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.batchVerifyMilestones([])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects batch exceeding max size", () => {
      const { validator } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 101 }, () =>
        baseMilestoneRequest("x"),
      );
      expect(() => validator.batchVerifyMilestones(bigBatch)).toThrow(
        HsmAdapterError,
      );
    });

    test("records batch history", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.orderId = "order-bh";
      ctx.hub.initializeOrder(req);
      const r = baseMilestoneRequest("order-bh");
      r.peerId = "p-bh";
      ctx.validator.batchVerifyMilestones([r]);
      expect(ctx.validator.getBatchHistory().length).toBe(1);
    });
  });

  describe("ZkOrderMilestoneValidator — partial signature aggregation", () => {
    test("aggregates partial signatures", () => {
      const ctx = setupAndInitOrder();
      const result = ctx.validator.aggregatePartialSignatures(
        ctx.order.orderId,
        [
          { peerId: "p1", signature: "sig-1" },
          { peerId: "p2", signature: "sig-2" },
          { peerId: "p3", signature: "sig-3" },
        ],
      );
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test("rejects aggregation with banned peer", () => {
      const ctx = setupAndInitOrder();
      const mReq = baseMilestoneRequest(ctx.order.orderId);
      mReq.zkMilestoneRangeProofHash = null;
      mReq.peerId = "bad-peer";
      try {
        ctx.validator.verifyMilestone(mReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.validator.isPeerBanned("bad-peer")).toBe(true);
      expect(() =>
        ctx.validator.aggregatePartialSignatures(ctx.order.orderId, [
          { peerId: "bad-peer", signature: "sig-1" },
          { peerId: "p2", signature: "sig-2" },
          { peerId: "p3", signature: "sig-3" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with insufficient signatures", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.validator.aggregatePartialSignatures(ctx.order.orderId, [
          { peerId: "p1", signature: "sig-1" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with missing orderId", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.aggregatePartialSignatures("", [
          { peerId: "p1", signature: "s1" },
        ]),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkOrderMilestoneValidator — slashing window validation", () => {
    test("validates milestone within slashing window", () => {
      const ctx = setupAndInitOrder();
      const claimTs = Math.floor(Date.now() / 1000);
      const result = ctx.validator.validateSlashingWindow(
        ctx.order.orderId,
        claimTs,
      );
      expect(result.withinWindow).toBe(true);
    });

    test("detects milestone outside slashing window", () => {
      const ctx = setupAndInitOrder();
      const claimTs = Math.floor(Date.now() / 1000) + 100000000;
      const result = ctx.validator.validateSlashingWindow(
        ctx.order.orderId,
        claimTs,
      );
      expect(result.withinWindow).toBe(false);
    });

    test("rejects validation for unknown order", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow("unknown", 1000)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects validation with invalid timestamp", () => {
      const ctx = setupAndInitOrder();
      expect(() =>
        ctx.validator.validateSlashingWindow(ctx.order.orderId, "bad"),
      ).toThrow(HsmAdapterError);
    });

    test("rejects validation with missing orderId", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow("", 1000)).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("ZkOrderMilestoneValidator — slashing and stats", () => {
    test("records slashes for malformed milestones", () => {
      const ctx = setupAndInitOrder();
      const mReq = baseMilestoneRequest(ctx.order.orderId);
      mReq.zkMilestoneRangeProofHash = null;
      mReq.peerId = "peer-slash";
      try {
        ctx.validator.verifyMilestone(mReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("records slashes for out-of-bounds epoch", () => {
      const ctx = setupAndInitOrder();
      const mReq = baseMilestoneRequest(ctx.order.orderId);
      mReq.peerId = "peer-oob";
      mReq.deliveryEpoch = 999;
      try {
        ctx.validator.verifyMilestone(mReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("records slashes for duplicate milestones", () => {
      const ctx = setupAndInitOrder();
      const mReq = baseMilestoneRequest(ctx.order.orderId);
      mReq.peerId = "peer-dup";
      ctx.validator.verifyMilestone(mReq);
      try {
        ctx.validator.verifyMilestone(mReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("returns slashed milestones list", () => {
      const ctx = setupAndInitOrder();
      const mReq = baseMilestoneRequest(ctx.order.orderId);
      mReq.zkMilestoneRangeProofHash = null;
      mReq.peerId = "peer-slash-2";
      try {
        ctx.validator.verifyMilestone(mReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.validator.getSlashedMilestones().length).toBeGreaterThan(0);
    });

    test("returns summary stats", () => {
      const ctx = setupInitAndMilestone();
      const stats = ctx.validator.getStats();
      expect(stats.totalVerified).toBeGreaterThan(0);
      expect(stats.hwAccelType).toBeDefined();
    });

    test("MILESTONE_STATUS, SLASH_REASON, and HW_ACCEL_TYPES constants are exported", () => {
      expect(MILESTONE_STATUS.VERIFIED).toBe("verified");
      expect(MILESTONE_STATUS.SLASHED).toBe("slashed");
      expect(SLASH_REASON.MALFORMED).toBe("malformed_milestone");
      expect(SLASH_REASON.DUPLICATE).toBe("duplicate_milestone");
      expect(SLASH_REASON.EPOCH_OUT_OF_BOUNDS).toBe("epoch_out_of_bounds");
      expect(SLASH_REASON.ORDER_NOT_FOUND).toBe("order_not_found");
      expect(SLASH_REASON.BANNED_PEER).toBe("banned_peer");
      expect(SLASH_REASON.OUT_OF_WINDOW).toBe("out_of_window");
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe("gpu_cuda");
      expect(HW_ACCEL_TYPES.FPGA).toBe("fpga");
      expect(HW_ACCEL_TYPES.ASIC).toBe("asic");
      expect(HW_ACCEL_TYPES.SIMULATED).toBe("simulated");
    });
  });

  describe("full Track 68 extended flow", () => {
    test("complete init → rebalance → milestone → release → settle flow", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.orderId = "order-full-flow";
      const order = ctx.hub.initializeOrder(req);
      expect(order.orderId).toBe("order-full-flow");
      const rebalance = ctx.hub.rebalanceDeliveryEpochs({
        orderId: order.orderId,
        direction: REBALANCE_DIRECTION.INCREASE,
        rebalanceAmount: 5,
        newDeliveryEpochs: 20,
      });
      expect(rebalance.rebalanceEpoch).toBe(1);
      const snarkProof = ctx.validator.generateHwSnarkProof({
        orderId: order.orderId,
        deliveryQuantity: 100,
        deliveryValue: 5000,
      });
      expect(snarkProof.zkMilestoneRangeProofHash).toBeDefined();
      const mReq = baseMilestoneRequest(order.orderId);
      mReq.peerId = "peer-milestone";
      mReq.zkMilestoneRangeProofHash = snarkProof.zkMilestoneRangeProofHash;
      const milestone = ctx.validator.verifyMilestone(mReq);
      expect(milestone.status).toBe(MILESTONE_STATUS.VERIFIED);
      const sigResult = ctx.hub.aggregateCommitteeSignatures(order.orderId, [
        { peerId: "peer-0", signature: "sig-0" },
        { peerId: "peer-1", signature: "sig-1" },
        { peerId: "peer-2", signature: "sig-2" },
      ]);
      expect(sigResult.signatureCount).toBe(3);
      const release = ctx.hub.releaseEscrow(baseReleaseRequest(order.orderId));
      expect(release.releaseId).toBeDefined();
      const settlement = ctx.hub.settleOrder({
        orderId: order.orderId,
        targetChainId: "chain-b",
      });
      expect(settlement.settlementId).toBeDefined();
      const windowResult = ctx.validator.validateSlashingWindow(
        order.orderId,
        Math.floor(Date.now() / 1000),
      );
      expect(windowResult.withinWindow).toBe(true);
      const hStats = ctx.hub.getStats();
      expect(hStats.releaseCount).toBeGreaterThan(0);
      expect(hStats.settleCount).toBeGreaterThan(0);
      expect(hStats.rebalanceCount).toBeGreaterThan(0);
      const vStats = ctx.validator.getStats();
      expect(vStats.claimCount).toBeGreaterThan(0);
      expect(vStats.hwProofCount).toBeGreaterThan(0);
    });
  });
});
