"use strict";

/**
 * Track 64: PQC Prediction Markets & ZK Resolution Validators —
 * extension tests.
 *
 * Tests the new multi-asset privacy pool support, batch market
 * initialization, dispute resolution escalation, cross-chain
 * settlement, market cancellation/expiration, HW-SNARK proof
 * generation, batch vote verification, slashing window validation,
 * partial signature aggregation, and summary statistics.
 */
const {
  PqcPredictionMarketHub,
  MARKET_STATUS,
  MARKET_TYPE,
} = require("../pqc-prediction-market-hub.cjs");
const {
  ZkMarketResolutionValidator,
  VOTE_STATUS,
  SLASH_REASON,
  HW_ACCEL_TYPES,
} = require("../zk-market-resolution-validator.cjs");
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
  minReporterQuorum: 3,
  maxDisputeResolutionEpochs: 5,
  maxContractLifetimeSeconds: 2592000,
  maxAssetWeightCap: 1000000,
  allowedPqcSignatureSchemes: ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"],
  requireMarketInitializerAttestation: true,
  requireReporterRelayAttestation: true,
  allowedAttestationAuthorities: ["mock-authority"],
  banMalformedOrOutOfOrderResolutionClaims: true,
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
    marketType: "binary",
    blindedOutcomeCommitment: "pedersen-outcome-001",
    assetWeight: 1000,
    expirationTimestamp: now + 86400,
    pqcSignatureScheme: "ML-DSA-65",
    marketInitializerAttestation: mockAttestation(),
    attestationAuthority: "mock-authority",
  };
}

function baseVoteRequest(marketId) {
  return {
    marketId: marketId || "market-001",
    blindedVoteCommitment: "pedersen-vote-001",
    zkTruthProofHash: "zk-truth-proof-001",
    reporterRelayAttestation: mockAttestation(),
    reporterRelayAttestationHash: "relay-hash-001",
    attestationAuthority: "mock-authority",
    partialSignature: "partial-sig-001",
  };
}

function baseFinalizeRequest(marketId) {
  return {
    marketId: marketId || "market-001",
    resolutionEpoch: 1,
  };
}

function setupHubAndValidator() {
  const events = [];
  const attestationClient = new MockAttestationClient();
  const hub = new PqcPredictionMarketHub({
    policy: POLICY,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  const validator = new ZkMarketResolutionValidator({
    policy: POLICY,
    hub,
    attestationClient,
    audit: (event, info) => events.push({ event, info }),
  });
  return { events, attestationClient, hub, validator };
}

function setupAndInitMarket() {
  const ctx = setupHubAndValidator();
  const market = ctx.hub.initializeMarket(baseInitRequest());
  return { ...ctx, market };
}

function setupInitAndVotes(voteCount = 3) {
  const ctx = setupAndInitMarket();
  for (let i = 0; i < voteCount; i++) {
    const voteReq = baseVoteRequest(ctx.market.marketId);
    voteReq.peerId = `peer-${i}`;
    ctx.validator.recordResolutionVote(voteReq);
  }
  return { ...ctx };
}

describe("Track 64 PQC Prediction Markets extensions", () => {
  describe("PqcPredictionMarketHub — multi-asset privacy pools", () => {
    test("initializes market with multi-asset pool parameters", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.marketType = MARKET_TYPE.MULTI_ASSET;
      req.multiAssetPool = {
        assetIds: ["asset-1", "asset-2", "asset-3"],
        blindedAssetValues: ["blind-1", "blind-2", "blind-3"],
        shieldedPoolType: "pedersen",
        merkleRoot: "merkle-root-001",
      };
      const market = ctx.hub.initializeMarket(req);
      expect(market.multiAssetPool).toBeDefined();
      expect(market.multiAssetPool.assetIds.length).toBe(3);
      expect(market.multiAssetPool.shieldedPoolType).toBe("pedersen");
    });

    test("rejects multi-asset pool with no asset IDs", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.multiAssetPool = { assetIds: [] };
      expect(() => ctx.hub.initializeMarket(req)).toThrow(HsmAdapterError);
    });

    test("rejects multi-asset pool with too many assets", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.multiAssetPool = {
        assetIds: Array.from({ length: 101 }, (_, i) => `asset-${i}`),
      };
      expect(() => ctx.hub.initializeMarket(req)).toThrow(HsmAdapterError);
    });

    test("rejects invalid multi-asset pool object", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.multiAssetPool = "not-an-object";
      expect(() => ctx.hub.initializeMarket(req)).toThrow(HsmAdapterError);
    });

    test("MARKET_STATUS and MARKET_TYPE constants are exported", () => {
      expect(MARKET_STATUS.OPEN).toBe("open");
      expect(MARKET_STATUS.DISPUTED).toBe("disputed");
      expect(MARKET_STATUS.FINALIZED).toBe("finalized");
      expect(MARKET_STATUS.SETTLED).toBe("settled");
      expect(MARKET_STATUS.EXPIRED).toBe("expired");
      expect(MARKET_STATUS.CANCELLED).toBe("cancelled");
      expect(MARKET_TYPE.BINARY).toBe("binary");
      expect(MARKET_TYPE.SCALAR).toBe("scalar");
      expect(MARKET_TYPE.MULTI_ASSET).toBe("multi_asset");
    });
  });

  describe("PqcPredictionMarketHub — batch initialization", () => {
    test("batch initializes multiple markets", () => {
      const { hub } = setupHubAndValidator();
      const reqs = [];
      for (let i = 0; i < 3; i++) {
        const r = baseInitRequest();
        r.marketId = `market-batch-${i}`;
        reqs.push(r);
      }
      const result = hub.batchInitializeMarkets(reqs);
      expect(result.successCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test("batch init handles mixed valid/invalid", () => {
      const { hub } = setupHubAndValidator();
      const r1 = baseInitRequest();
      r1.marketId = "market-ok";
      const r2 = baseInitRequest();
      r2.marketId = "market-ok"; // duplicate
      const r3 = baseInitRequest();
      r3.marketId = "market-ok2";
      r3.assetWeight = 2000000; // exceeds cap
      const result = hub.batchInitializeMarkets([r1, r2, r3]);
      expect(result.successCount).toBe(1);
      expect(result.failedCount).toBe(2);
    });

    test("rejects empty batch", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.batchInitializeMarkets([])).toThrow(HsmAdapterError);
    });

    test("rejects batch exceeding max size", () => {
      const { hub } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 51 }, () => baseInitRequest());
      expect(() => hub.batchInitializeMarkets(bigBatch)).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("PqcPredictionMarketHub — dispute resolution", () => {
    test("escalates a market to dispute", () => {
      const ctx = setupAndInitMarket();
      const dispute = ctx.hub.escalateDispute({
        marketId: ctx.market.marketId,
        disputeReason: "reporter_disagreement",
      });
      expect(dispute.disputeId).toBeDefined();
      expect(dispute.disputeEpoch).toBe(1);
      const market = ctx.hub.getMarket(ctx.market.marketId);
      expect(market.status).toBe(MARKET_STATUS.DISPUTED);
    });

    test("rejects dispute escalation on finalized market", () => {
      const ctx = setupInitAndVotes();
      ctx.hub.finalizeMarket(baseFinalizeRequest(ctx.market.marketId));
      expect(() =>
        ctx.hub.escalateDispute({ marketId: ctx.market.marketId }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects dispute escalation on cancelled market", () => {
      const ctx = setupAndInitMarket();
      ctx.hub.cancelMarket(ctx.market.marketId);
      expect(() =>
        ctx.hub.escalateDispute({ marketId: ctx.market.marketId }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects dispute escalation exceeding max epochs", () => {
      const ctx = setupAndInitMarket();
      for (let i = 0; i < 5; i++) {
        ctx.hub.escalateDispute({ marketId: ctx.market.marketId });
      }
      expect(() =>
        ctx.hub.escalateDispute({ marketId: ctx.market.marketId }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects dispute with missing marketId", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.escalateDispute({})).toThrow(HsmAdapterError);
    });

    test("returns dispute record via getDispute", () => {
      const ctx = setupAndInitMarket();
      const dispute = ctx.hub.escalateDispute({
        marketId: ctx.market.marketId,
      });
      const retrieved = ctx.hub.getDispute(dispute.disputeId);
      expect(retrieved).not.toBeNull();
      expect(retrieved.disputeId).toBe(dispute.disputeId);
    });
  });

  describe("PqcPredictionMarketHub — cross-chain settlement", () => {
    test("settles a finalized market cross-chain", () => {
      const ctx = setupInitAndVotes();
      ctx.hub.finalizeMarket(baseFinalizeRequest(ctx.market.marketId));
      const settlement = ctx.hub.settleMarket({
        marketId: ctx.market.marketId,
        targetChainId: "chain-b",
      });
      expect(settlement.settlementId).toBeDefined();
      expect(settlement.targetChainId).toBe("chain-b");
    });

    test("rejects settlement of non-finalized market", () => {
      const ctx = setupAndInitMarket();
      expect(() =>
        ctx.hub.settleMarket({
          marketId: ctx.market.marketId,
          targetChainId: "chain-b",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with mismatched chain", () => {
      const ctx = setupInitAndVotes();
      ctx.hub.finalizeMarket(baseFinalizeRequest(ctx.market.marketId));
      expect(() =>
        ctx.hub.settleMarket({
          marketId: ctx.market.marketId,
          targetChainId: "wrong-chain",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects settlement with missing marketId", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.settleMarket({ targetChainId: "chain-b" })).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects settlement with missing targetChainId", () => {
      const ctx = setupInitAndVotes();
      ctx.hub.finalizeMarket(baseFinalizeRequest(ctx.market.marketId));
      expect(() =>
        ctx.hub.settleMarket({ marketId: ctx.market.marketId }),
      ).toThrow(HsmAdapterError);
    });

    test("returns settlement record via getSettlement", () => {
      const ctx = setupInitAndVotes();
      ctx.hub.finalizeMarket(baseFinalizeRequest(ctx.market.marketId));
      ctx.hub.settleMarket({
        marketId: ctx.market.marketId,
        targetChainId: "chain-b",
      });
      const s = ctx.hub.getSettlement(ctx.market.marketId);
      expect(s).not.toBeNull();
      expect(s.targetChainId).toBe("chain-b");
    });
  });

  describe("PqcPredictionMarketHub — committee aggregation", () => {
    test("aggregates committee signatures", () => {
      const ctx = setupAndInitMarket();
      const result = ctx.hub.aggregateCommitteeSignatures(ctx.market.marketId, [
        { peerId: "p1", signature: "sig-1" },
        { peerId: "p2", signature: "sig-2" },
        { peerId: "p3", signature: "sig-3" },
      ]);
      expect(result.signatureCount).toBe(3);
      expect(result.aggregatedSignature).toBeDefined();
    });

    test("rejects aggregation with insufficient signatures", () => {
      const ctx = setupAndInitMarket();
      expect(() =>
        ctx.hub.aggregateCommitteeSignatures(ctx.market.marketId, [
          { peerId: "p1", signature: "sig-1" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with no signatures", () => {
      const ctx = setupAndInitMarket();
      expect(() =>
        ctx.hub.aggregateCommitteeSignatures(ctx.market.marketId, []),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation for unknown market", () => {
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

  describe("PqcPredictionMarketHub — cancellation and expiration", () => {
    test("cancels an open market", () => {
      const ctx = setupAndInitMarket();
      const result = ctx.hub.cancelMarket(ctx.market.marketId);
      expect(result.cancelled).toBe(true);
      const market = ctx.hub.getMarket(ctx.market.marketId);
      expect(market.status).toBe(MARKET_STATUS.CANCELLED);
    });

    test("rejects cancelling finalized market", () => {
      const ctx = setupInitAndVotes();
      ctx.hub.finalizeMarket(baseFinalizeRequest(ctx.market.marketId));
      expect(() => ctx.hub.cancelMarket(ctx.market.marketId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects double cancellation", () => {
      const ctx = setupAndInitMarket();
      ctx.hub.cancelMarket(ctx.market.marketId);
      expect(() => ctx.hub.cancelMarket(ctx.market.marketId)).toThrow(
        HsmAdapterError,
      );
    });

    test("expires a market", () => {
      const ctx = setupAndInitMarket();
      const result = ctx.hub.expireMarket(ctx.market.marketId);
      expect(result.expired).toBe(true);
      const market = ctx.hub.getMarket(ctx.market.marketId);
      expect(market.status).toBe(MARKET_STATUS.EXPIRED);
    });

    test("rejects double expiration", () => {
      const ctx = setupAndInitMarket();
      ctx.hub.expireMarket(ctx.market.marketId);
      expect(() => ctx.hub.expireMarket(ctx.market.marketId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects cancelling unknown market", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.cancelMarket("unknown")).toThrow(HsmAdapterError);
    });

    test("rejects expiring unknown market", () => {
      const { hub } = setupHubAndValidator();
      expect(() => hub.expireMarket("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("PqcPredictionMarketHub — queries and stats", () => {
    test("returns markets list", () => {
      const ctx = setupAndInitMarket();
      expect(ctx.hub.getMarkets().length).toBe(1);
    });

    test("returns summary stats", () => {
      const ctx = setupAndInitMarket();
      const stats = ctx.hub.getStats();
      expect(stats.totalMarkets).toBe(1);
      expect(stats.marketsByStatus).toBeDefined();
      expect(stats.initCount).toBeGreaterThan(0);
    });
  });

  describe("ZkMarketResolutionValidator — HW-SNARK proof generation", () => {
    test("generates a hardware-accelerated SNARK proof", () => {
      const ctx = setupAndInitMarket();
      const proof = ctx.validator.generateHwSnarkProof({
        marketId: ctx.market.marketId,
        voteOutcome: "YES",
      });
      expect(proof.zkTruthProofHash).toBeDefined();
      expect(proof.hwAccelType).toBeDefined();
      expect(proof.proofSystem).toBe("groth16");
    });

    test("rejects proof generation with missing marketId", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.generateHwSnarkProof({ voteOutcome: "YES" }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation with missing outcome", () => {
      const ctx = setupAndInitMarket();
      expect(() =>
        ctx.validator.generateHwSnarkProof({ marketId: ctx.market.marketId }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof generation for unknown market", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.generateHwSnarkProof({
          marketId: "unknown",
          voteOutcome: "YES",
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMarketResolutionValidator — batch vote recording", () => {
    test("batch records multiple resolution votes", () => {
      const ctx = setupHubAndValidator();
      const markets = [];
      for (let i = 0; i < 3; i++) {
        const req = baseInitRequest();
        req.marketId = `market-bv-${i}`;
        const m = ctx.hub.initializeMarket(req);
        markets.push(m);
      }
      const batch = markets.map((m, i) => {
        const v = baseVoteRequest(m.marketId);
        v.peerId = `peer-bv-${i}`;
        return v;
      });
      const result = ctx.validator.batchRecordVotes(batch);
      expect(result.recordedCount).toBe(3);
      expect(result.failedCount).toBe(0);
    });

    test("batch recording handles mixed valid/invalid", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.marketId = "market-mix";
      ctx.hub.initializeMarket(req);
      const batch = [
        (() => {
          const v = baseVoteRequest("market-mix");
          v.peerId = "p1";
          return v;
        })(),
        (() => {
          const v = baseVoteRequest("market-mix");
          v.peerId = "p2";
          return v;
        })(),
        (() => {
          const v = baseVoteRequest("unknown-market");
          v.peerId = "p3";
          return v;
        })(),
      ];
      const result = ctx.validator.batchRecordVotes(batch);
      expect(result.recordedCount).toBe(2);
      expect(result.failedCount).toBe(1);
    });

    test("rejects empty batch", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.batchRecordVotes([])).toThrow(HsmAdapterError);
    });

    test("rejects batch exceeding max size", () => {
      const { validator } = setupHubAndValidator();
      const bigBatch = Array.from({ length: 101 }, () => baseVoteRequest("x"));
      expect(() => validator.batchRecordVotes(bigBatch)).toThrow(
        HsmAdapterError,
      );
    });

    test("records batch history", () => {
      const ctx = setupHubAndValidator();
      const req = baseInitRequest();
      req.marketId = "market-bh";
      ctx.hub.initializeMarket(req);
      const v = baseVoteRequest("market-bh");
      v.peerId = "p-bh";
      ctx.validator.batchRecordVotes([v]);
      expect(ctx.validator.getBatchHistory().length).toBe(1);
    });
  });

  describe("ZkMarketResolutionValidator — partial signature aggregation", () => {
    test("aggregates partial signatures", () => {
      const ctx = setupAndInitMarket();
      const result = ctx.validator.aggregatePartialSignatures(
        ctx.market.marketId,
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
      const ctx = setupAndInitMarket();
      // Ban a peer first
      const voteReq = baseVoteRequest(ctx.market.marketId);
      voteReq.zkTruthProofHash = null;
      voteReq.peerId = "bad-peer";
      try {
        ctx.validator.recordResolutionVote(voteReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.validator.isPeerBanned("bad-peer")).toBe(true);
      expect(() =>
        ctx.validator.aggregatePartialSignatures(ctx.market.marketId, [
          { peerId: "bad-peer", signature: "sig-1" },
          { peerId: "p2", signature: "sig-2" },
          { peerId: "p3", signature: "sig-3" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with insufficient signatures", () => {
      const ctx = setupAndInitMarket();
      expect(() =>
        ctx.validator.aggregatePartialSignatures(ctx.market.marketId, [
          { peerId: "p1", signature: "sig-1" },
        ]),
      ).toThrow(HsmAdapterError);
    });

    test("rejects aggregation with missing marketId", () => {
      const { validator } = setupHubAndValidator();
      expect(() =>
        validator.aggregatePartialSignatures("", [
          { peerId: "p1", signature: "s1" },
        ]),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMarketResolutionValidator — slashing window validation", () => {
    test("validates vote within slashing window", () => {
      const ctx = setupAndInitMarket();
      const voteTs = Math.floor(Date.now() / 1000);
      const result = ctx.validator.validateSlashingWindow(
        ctx.market.marketId,
        voteTs,
      );
      expect(result.withinWindow).toBe(true);
    });

    test("detects vote outside slashing window", () => {
      const ctx = setupAndInitMarket();
      const voteTs = ctx.market.expirationTimestamp + 10000;
      const result = ctx.validator.validateSlashingWindow(
        ctx.market.marketId,
        voteTs,
      );
      expect(result.withinWindow).toBe(false);
    });

    test("rejects validation for unknown market", () => {
      const { validator } = setupHubAndValidator();
      expect(() => validator.validateSlashingWindow("unknown", 1000)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects validation with invalid timestamp", () => {
      const ctx = setupAndInitMarket();
      expect(() =>
        ctx.validator.validateSlashingWindow(ctx.market.marketId, "bad"),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("ZkMarketResolutionValidator — slashing and stats", () => {
    test("records slashes for malformed votes", () => {
      const ctx = setupAndInitMarket();
      const voteReq = baseVoteRequest(ctx.market.marketId);
      voteReq.zkTruthProofHash = null;
      voteReq.peerId = "peer-slash";
      try {
        ctx.validator.recordResolutionVote(voteReq);
      } catch (e) {
        /* expected */
      }
      const stats = ctx.validator.getSlashingStats();
      expect(stats.totalSlashes).toBeGreaterThan(0);
    });

    test("returns slashed votes list", () => {
      const ctx = setupAndInitMarket();
      const voteReq = baseVoteRequest(ctx.market.marketId);
      voteReq.zkTruthProofHash = null;
      voteReq.peerId = "peer-slash-2";
      try {
        ctx.validator.recordResolutionVote(voteReq);
      } catch (e) {
        /* expected */
      }
      expect(ctx.validator.getSlashedVotes().length).toBeGreaterThan(0);
    });

    test("returns summary stats", () => {
      const ctx = setupInitAndVotes();
      const stats = ctx.validator.getStats();
      expect(stats.totalRecorded).toBeGreaterThan(0);
      expect(stats.hwAccelType).toBeDefined();
    });

    test("VOTE_STATUS, SLASH_REASON, and HW_ACCEL_TYPES constants are exported", () => {
      expect(VOTE_STATUS.RECORDED).toBe("recorded");
      expect(VOTE_STATUS.SLASHED).toBe("slashed");
      expect(SLASH_REASON.MALFORMED).toBe("malformed_vote");
      expect(SLASH_REASON.DUPLICATE).toBe("duplicate_vote");
      expect(SLASH_REASON.BANNED_PEER).toBe("banned_peer");
      expect(HW_ACCEL_TYPES.GPU_CUDA).toBe("gpu_cuda");
      expect(HW_ACCEL_TYPES.ASIC).toBe("asic");
      expect(HW_ACCEL_TYPES.SIMULATED).toBe("simulated");
    });
  });

  describe("full Track 64 extended flow", () => {
    test("complete init → vote → dispute → finalize → settle flow", () => {
      const ctx = setupHubAndValidator();
      // Initialize market with multi-asset pool
      const req = baseInitRequest();
      req.marketId = "market-full-flow";
      req.marketType = MARKET_TYPE.MULTI_ASSET;
      req.multiAssetPool = {
        assetIds: ["asset-1", "asset-2"],
        shieldedPoolType: "pedersen",
      };
      const market = ctx.hub.initializeMarket(req);
      expect(market.multiAssetPool).toBeDefined();
      // Generate HW-SNARK proof
      const snarkProof = ctx.validator.generateHwSnarkProof({
        marketId: market.marketId,
        voteOutcome: "YES",
      });
      expect(snarkProof.zkTruthProofHash).toBeDefined();
      // Record resolution votes
      for (let i = 0; i < 3; i++) {
        const voteReq = baseVoteRequest(market.marketId);
        voteReq.peerId = `peer-${i}`;
        voteReq.zkTruthProofHash = `${snarkProof.zkTruthProofHash}-${i}`;
        const vote = ctx.validator.recordResolutionVote(voteReq);
        expect(vote.status).toBe(VOTE_STATUS.RECORDED);
      }
      // Aggregate committee signatures
      const sigResult = ctx.hub.aggregateCommitteeSignatures(market.marketId, [
        { peerId: "peer-0", signature: "sig-0" },
        { peerId: "peer-1", signature: "sig-1" },
        { peerId: "peer-2", signature: "sig-2" },
      ]);
      expect(sigResult.signatureCount).toBe(3);
      // Escalate dispute then resolve
      const dispute = ctx.hub.escalateDispute({
        marketId: market.marketId,
        disputeReason: "reporter_disagreement",
      });
      expect(dispute.disputeEpoch).toBe(1);
      // Finalize market
      const finalization = ctx.hub.finalizeMarket({
        marketId: market.marketId,
        resolutionEpoch: 1,
      });
      expect(finalization.finalId).toBeDefined();
      // Settle cross-chain
      const settlement = ctx.hub.settleMarket({
        marketId: market.marketId,
        targetChainId: "chain-b",
      });
      expect(settlement.settlementId).toBeDefined();
      // Validate slashing window
      const windowResult = ctx.validator.validateSlashingWindow(
        market.marketId,
        Math.floor(Date.now() / 1000),
      );
      expect(windowResult.withinWindow).toBe(true);
      // Verify stats
      const hStats = ctx.hub.getStats();
      expect(hStats.finalizeCount).toBeGreaterThan(0);
      expect(hStats.settleCount).toBeGreaterThan(0);
      expect(hStats.disputeCount).toBeGreaterThan(0);
      const vStats = ctx.validator.getStats();
      expect(vStats.voteCount).toBeGreaterThan(0);
      expect(vStats.hwProofCount).toBeGreaterThan(0);
    });
  });
});
