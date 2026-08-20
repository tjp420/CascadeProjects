"use strict";

/**
 * Track 61: Recursive Proof Aggregation Engine tests.
 */
const {
  RecursiveProofAggregationEngine,
  DEFAULT_OPTIONS,
  PROOF_STATUS,
  AGG_STATUS,
  AGG_TYPE,
} = require("../recursive-proof-aggregation-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 61: RecursiveProofAggregationEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new RecursiveProofAggregationEngine({
      maxProofs: 500,
      maxRecursionDepth: 10,
      maxFoldBatch: 8,
      maxChainLength: 50,
      maxTreeDepth: 8,
    });
  });

  // Helper: submit N proofs
  function submitProofs(engine, count, sourceType = "generic") {
    for (let i = 0; i < count; i++) {
      engine.submitProof({
        proofId: `p${i}`,
        sourceType,
        proofData: `proof-data-${i}`,
      });
    }
  }

  describe("submitProof", () => {
    test("submits a proof", () => {
      const result = engine.submitProof({
        proofId: "p1",
        sourceType: "vdf",
        proofData: "proof-data-1",
      });
      expect(result.proofId).toBe("p1");
      expect(result.sourceType).toBe("vdf");
      expect(result.status).toBe(PROOF_STATUS.VERIFIED);
      expect(result.proofHash).toBeDefined();
    });

    test("rejects null config", () => {
      expect(() => engine.submitProof(null)).toThrow(HsmAdapterError);
    });

    test("rejects missing proofId", () => {
      expect(() => engine.submitProof({ proofData: "x" })).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects duplicate proofId", () => {
      engine.submitProof({ proofId: "p1", proofData: "x" });
      expect(() =>
        engine.submitProof({ proofId: "p1", proofData: "x" }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects missing proofData", () => {
      expect(() => engine.submitProof({ proofId: "p1" })).toThrow(
        HsmAdapterError,
      );
    });

    test("accepts Buffer proofData", () => {
      const result = engine.submitProof({
        proofId: "p1",
        proofData: Buffer.from("binary-proof-data"),
      });
      expect(result.proofId).toBe("p1");
    });

    test("rejects proof exceeding max size", () => {
      const big = "x".repeat(5000);
      expect(() =>
        engine.submitProof({ proofId: "p1", proofData: big }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("foldProofs", () => {
    test("folds two proofs into one", () => {
      submitProofs(engine, 2);
      const result = engine.foldProofs("p0", "p1");
      expect(result.status).toBe(PROOF_STATUS.FOLDED);
      expect(result.foldCount).toBe(1);
      expect(result.innerProofs).toEqual(["p0", "p1"]);
    });

    test("rejects unknown proof", () => {
      submitProofs(engine, 1);
      expect(() => engine.foldProofs("p0", "unknown")).toThrow(HsmAdapterError);
    });

    test("rejects unknown first proof", () => {
      submitProofs(engine, 1);
      expect(() => engine.foldProofs("unknown", "p0")).toThrow(HsmAdapterError);
    });

    test("folds recursively (fold of folds)", () => {
      submitProofs(engine, 4);
      const fold1 = engine.foldProofs("p0", "p1", "f1");
      const fold2 = engine.foldProofs("p2", "p3", "f2");
      const fold3 = engine.foldProofs("f1", "f2", "f3");
      expect(fold3.foldCount).toBe(2);
      expect(fold3.innerProofs).toEqual(["f1", "f2"]);
    });

    test("marks inner proofs as folded", () => {
      submitProofs(engine, 2);
      engine.foldProofs("p0", "p1", "f1");
      const p0 = engine.getProof("p0");
      expect(p0.foldedInto).toBe("f1");
    });
  });

  describe("aggregateChain", () => {
    test("aggregates proofs in a chain", () => {
      submitProofs(engine, 5);
      const result = engine.aggregateChain(["p0", "p1", "p2", "p3", "p4"]);
      expect(result.type).toBe(AGG_TYPE.CHAIN);
      expect(result.proofCount).toBe(5);
      expect(result.recursionDepth).toBe(4);
      expect(result.finalProofId).toBeDefined();
      expect(result.status).toBe(AGG_STATUS.COMPLETED);
    });

    test("rejects insufficient proofs", () => {
      submitProofs(engine, 1);
      expect(() => engine.aggregateChain(["p0"])).toThrow(HsmAdapterError);
    });

    test("rejects chain too long", () => {
      submitProofs(engine, 60);
      const ids = Array.from({ length: 60 }, (_, i) => `p${i}`);
      expect(() => engine.aggregateChain(ids)).toThrow(HsmAdapterError);
    });

    test("rejects unknown proof in chain", () => {
      submitProofs(engine, 2);
      expect(() => engine.aggregateChain(["p0", "unknown"])).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("aggregateTree", () => {
    test("aggregates proofs in a tree", () => {
      submitProofs(engine, 8);
      const result = engine.aggregateTree([
        "p0",
        "p1",
        "p2",
        "p3",
        "p4",
        "p5",
        "p6",
        "p7",
      ]);
      expect(result.type).toBe(AGG_TYPE.TREE);
      expect(result.proofCount).toBe(8);
      expect(result.recursionDepth).toBe(3); // log2(8) = 3
      expect(result.finalProofId).toBeDefined();
    });

    test("aggregates odd number of proofs", () => {
      submitProofs(engine, 5);
      const result = engine.aggregateTree(["p0", "p1", "p2", "p3", "p4"]);
      expect(result.proofCount).toBe(5);
      expect(result.status).toBe(AGG_STATUS.COMPLETED);
    });

    test("rejects insufficient proofs", () => {
      submitProofs(engine, 1);
      expect(() => engine.aggregateTree(["p0"])).toThrow(HsmAdapterError);
    });

    test("rejects tree too deep", () => {
      const bigEngine = new RecursiveProofAggregationEngine({
        maxProofs: 600,
        maxTreeDepth: 3,
      });
      submitProofs(bigEngine, 20);
      const ids = Array.from({ length: 20 }, (_, i) => `p${i}`);
      expect(() => bigEngine.aggregateTree(ids)).toThrow(HsmAdapterError);
    });
  });

  describe("aggregateVdfProofs", () => {
    test("aggregates VDF proofs", () => {
      submitProofs(engine, 4, "vdf");
      const result = engine.aggregateVdfProofs(["p0", "p1", "p2", "p3"]);
      expect(result.type).toBe(AGG_TYPE.VDF);
      expect(result.proofCount).toBe(4);
    });

    test("rejects non-VDF proof", () => {
      submitProofs(engine, 2, "generic");
      expect(() => engine.aggregateVdfProofs(["p0", "p1"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects insufficient proofs", () => {
      submitProofs(engine, 1, "vdf");
      expect(() => engine.aggregateVdfProofs(["p0"])).toThrow(HsmAdapterError);
    });
  });

  describe("compressMixnetState", () => {
    test("compresses multi-hop mixnet states", () => {
      submitProofs(engine, 5, "mixnet");
      const result = engine.compressMixnetState(["p0", "p1", "p2", "p3", "p4"]);
      expect(result.type).toBe(AGG_TYPE.MIXNET);
      expect(result.hopCount).toBe(5);
      expect(result.recursionDepth).toBe(4);
    });

    test("rejects non-mixnet proof", () => {
      submitProofs(engine, 2, "generic");
      expect(() => engine.compressMixnetState(["p0", "p1"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects insufficient proofs", () => {
      submitProofs(engine, 1, "mixnet");
      expect(() => engine.compressMixnetState(["p0"])).toThrow(HsmAdapterError);
    });
  });

  describe("verifyAggregation", () => {
    test("verifies a completed chain aggregation", () => {
      submitProofs(engine, 3);
      const agg = engine.aggregateChain(["p0", "p1", "p2"]);
      const result = engine.verifyAggregation(agg.aggId);
      expect(result.verified).toBe(true);
      expect(result.proofCount).toBe(3);
    });

    test("verifies a completed tree aggregation", () => {
      submitProofs(engine, 4);
      const agg = engine.aggregateTree(["p0", "p1", "p2", "p3"]);
      const result = engine.verifyAggregation(agg.aggId);
      expect(result.verified).toBe(true);
    });

    test("rejects unknown aggregation", () => {
      expect(() => engine.verifyAggregation("unknown")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects incomplete aggregation", () => {
      submitProofs(engine, 3);
      // Manually create an incomplete aggregation
      engine._aggregations.set("incomplete", {
        aggId: "incomplete",
        type: AGG_TYPE.CHAIN,
        proofIds: ["p0", "p1", "p2"],
        proofCount: 3,
        status: AGG_STATUS.FOLDING,
        finalProofId: null,
        recursionDepth: 0,
      });
      expect(() => engine.verifyAggregation("incomplete")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("getProof", () => {
    test("returns proof info", () => {
      engine.submitProof({ proofId: "p1", proofData: "x" });
      const proof = engine.getProof("p1");
      expect(proof).not.toBeNull();
      expect(proof.proofId).toBe("p1");
    });

    test("returns null for unknown proof", () => {
      expect(engine.getProof("unknown")).toBeNull();
    });
  });

  describe("getAggregation", () => {
    test("returns aggregation info", () => {
      submitProofs(engine, 3);
      const agg = engine.aggregateChain(["p0", "p1", "p2"]);
      const info = engine.getAggregation(agg.aggId);
      expect(info).not.toBeNull();
      expect(info.aggId).toBe(agg.aggId);
    });

    test("returns null for unknown aggregation", () => {
      expect(engine.getAggregation("unknown")).toBeNull();
    });
  });

  describe("getAggregations", () => {
    test("returns all aggregations", () => {
      submitProofs(engine, 6);
      engine.aggregateChain(["p0", "p1", "p2"], "a1");
      engine.aggregateTree(["p3", "p4", "p5"], "a2");
      expect(engine.getAggregations().length).toBe(2);
    });
  });

  describe("getCompletedAggregations", () => {
    test("returns completed aggregations", () => {
      submitProofs(engine, 3);
      engine.aggregateChain(["p0", "p1", "p2"]);
      expect(engine.getCompletedAggregations().length).toBe(1);
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      submitProofs(engine, 3);
      const stats = engine.getStats();
      expect(stats.totalProofs).toBe(3);
      expect(stats.totalAggregations).toBe(0);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      submitProofs(engine, 3);
      engine.reset();
      expect(engine.getStats().totalProofs).toBe(0);
    });
  });

  describe("full recursive aggregation flow", () => {
    test("complete submit -> fold -> aggregate -> verify flow", () => {
      // Submit 8 VDF proofs
      submitProofs(engine, 8, "vdf");
      // Aggregate using tree (3 levels of recursion)
      const treeResult = engine.aggregateTree([
        "p0",
        "p1",
        "p2",
        "p3",
        "p4",
        "p5",
        "p6",
        "p7",
      ]);
      expect(treeResult.recursionDepth).toBe(3);
      expect(treeResult.status).toBe(AGG_STATUS.COMPLETED);
      // Verify the aggregation
      const verifyResult = engine.verifyAggregation(treeResult.aggId);
      expect(verifyResult.verified).toBe(true);
      expect(verifyResult.recursionDepth).toBe(3);
      // Verify stats
      const stats = engine.getStats();
      expect(stats.totalProofs).toBeGreaterThan(8); // Original + folded
      expect(stats.foldCount).toBe(7); // 7 folds for 8 proofs
      expect(stats.aggCount).toBe(1);
    });

    test("mixnet state compression flow", () => {
      // Submit 5 mixnet hop proofs
      submitProofs(engine, 5, "mixnet");
      // Compress multi-hop mixnet state
      const compressResult = engine.compressMixnetState([
        "p0",
        "p1",
        "p2",
        "p3",
        "p4",
      ]);
      expect(compressResult.type).toBe(AGG_TYPE.MIXNET);
      expect(compressResult.hopCount).toBe(5);
      expect(compressResult.recursionDepth).toBe(4);
      // Verify compression
      const verifyResult = engine.verifyAggregation(compressResult.aggId);
      expect(verifyResult.verified).toBe(true);
    });

    test("VDF recursive aggregation flow", () => {
      // Submit 6 VDF proofs
      submitProofs(engine, 6, "vdf");
      // Aggregate VDF proofs
      const vdfResult = engine.aggregateVdfProofs([
        "p0",
        "p1",
        "p2",
        "p3",
        "p4",
        "p5",
      ]);
      expect(vdfResult.type).toBe(AGG_TYPE.VDF);
      expect(vdfResult.proofCount).toBe(6);
      // Verify
      const verifyResult = engine.verifyAggregation(vdfResult.aggId);
      expect(verifyResult.verified).toBe(true);
    });
  });
});
