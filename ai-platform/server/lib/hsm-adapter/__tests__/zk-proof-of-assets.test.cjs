"use strict";

const crypto = require("crypto");
const {
  ZkProofOfAssetsEngine,
  AssetCommitment,
  MerkleCommitmentTree,
  PROOF_STATE,
  VALID_TRANSITIONS,
} = require("../zk-proof-of-assets-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

describe("ZkProofOfAssetsEngine — Track 36 ZK Proof-of-Assets", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  const VALIDATORS = ["val-1", "val-2", "val-3", "val-4", "val-5"];

  // ── L2.01: Full happy-path ──
  describe("L2.01: happy-path proof-of-assets lifecycle", () => {
    test("register assets → create proof → commit → generate → verify → sign (quorum)", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      engine.registerAsset("tenant-a", "asset-2", 2000);

      const draft = engine.createProof("tenant-a", 2500);
      expect(draft.state).toBe(PROOF_STATE.DRAFT);
      expect(draft.aggregateBacking).toBe(3000);
      expect(draft.claimedBacking).toBe(2500);

      engine.commitProof(draft.proofId);
      expect(engine.getProofState(draft.proofId).state).toBe(
        PROOF_STATE.COMMITTED,
      );

      const proofBundle = engine.generateProof(draft.proofId);
      expect(engine.getProofState(draft.proofId).state).toBe(
        PROOF_STATE.PROVEN,
      );

      const result = engine.verifyProof(proofBundle);
      expect(result.verified).toBe(true);
      expect(engine.getProofState(draft.proofId).state).toBe(
        PROOF_STATE.VERIFIED,
      );

      // Quorum signatures
      engine.signProof(draft.proofId, "val-1", "sig-1");
      engine.signProof(draft.proofId, "val-2", "sig-2");
      expect(engine.isFinalized(draft.proofId)).toBe(false);

      engine.signProof(draft.proofId, "val-3", "sig-3");
      expect(engine.isFinalized(draft.proofId)).toBe(true);
    });
  });

  // ── L2.02: AssetCommitment ──
  describe("L2.02: AssetCommitment", () => {
    test("hides amount via Pedersen-style blinding", () => {
      const c1 = new AssetCommitment("asset-1", 1000, "blinding-a");
      const c2 = new AssetCommitment("asset-1", 1000, "blinding-b");
      // Same amount, different blinding → different commitments
      expect(c1.commitment).not.toBe(c2.commitment);
    });

    test("verify returns true for correct amount and blinding", () => {
      const c = new AssetCommitment("asset-1", 500, "my-blinding");
      expect(c.verify("asset-1", 500, "my-blinding")).toBe(true);
    });

    test("verify returns false for wrong amount", () => {
      const c = new AssetCommitment("asset-1", 500, "my-blinding");
      expect(c.verify("asset-1", 999, "my-blinding")).toBe(false);
    });

    test("rejects zero or negative amount", () => {
      expect(() => new AssetCommitment("asset-1", 0)).toThrow(HsmAdapterError);
      expect(() => new AssetCommitment("asset-1", -100)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects empty assetId", () => {
      expect(() => new AssetCommitment("", 100)).toThrow(HsmAdapterError);
    });
  });

  // ── L2.03: MerkleCommitmentTree ──
  describe("L2.03: MerkleCommitmentTree", () => {
    test("aggregates commitments into compact root", () => {
      const c1 = new AssetCommitment("a1", 100, "b1");
      const c2 = new AssetCommitment("a2", 200, "b2");
      const c3 = new AssetCommitment("a3", 300, "b3");
      const tree = new MerkleCommitmentTree([c1, c2, c3]);
      expect(tree.getRoot()).toHaveLength(64); // SHA-256 hex
      expect(tree.leafCount()).toBe(3);
    });

    test("contains returns true for existing commitment", () => {
      const c1 = new AssetCommitment("a1", 100, "b1");
      const tree = new MerkleCommitmentTree([c1]);
      expect(tree.contains(c1.commitment)).toBe(true);
      expect(tree.contains("nonexistent")).toBe(false);
    });

    test("deterministic root for same commitments", () => {
      const c1 = new AssetCommitment("a1", 100, "b1");
      const c2 = new AssetCommitment("a2", 200, "b2");
      const tree1 = new MerkleCommitmentTree([c1, c2]);
      const tree2 = new MerkleCommitmentTree([c1, c2]);
      expect(tree1.getRoot()).toBe(tree2.getRoot());
    });

    test("rejects empty commitments array", () => {
      expect(() => new MerkleCommitmentTree([])).toThrow(HsmAdapterError);
    });
  });

  // ── L2.04: Multiple tenants independent ──
  describe("L2.04: multiple tenants independent", () => {
    test("tenants tracked independently with isolated assets", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-a1", 1000);
      engine.registerAsset("tenant-b", "asset-b1", 2000);

      expect(engine.getTenantAssets("tenant-a")).toEqual(["asset-a1"]);
      expect(engine.getTenantAssets("tenant-b")).toEqual(["asset-b1"]);

      const proofA = engine.createProof("tenant-a", 900);
      const proofB = engine.createProof("tenant-b", 1900);
      expect(proofA.proofId).not.toBe(proofB.proofId);
      expect(proofA.aggregateBacking).toBe(1000);
      expect(proofB.aggregateBacking).toBe(2000);
    });
  });

  // ── L2.05: State machine ──
  describe("L2.05: state machine transitions", () => {
    test("cannot generate proof without committing", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      expect(() => engine.generateProof(draft.proofId)).toThrow(
        HsmAdapterError,
      );
    });

    test("cannot verify proof without generating", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      engine.commitProof(draft.proofId);
      expect(() => engine.verifyProof({ proofId: draft.proofId })).toThrow(
        HsmAdapterError,
      );
    });

    test("cannot sign proof without verifying", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      engine.commitProof(draft.proofId);
      expect(() => engine.signProof(draft.proofId, "val-1", "sig")).toThrow(
        HsmAdapterError,
      );
    });

    test("verified state is terminal", () => {
      expect(VALID_TRANSITIONS[PROOF_STATE.VERIFIED]).toEqual([]);
    });

    test("invalid state is terminal", () => {
      expect(VALID_TRANSITIONS[PROOF_STATE.INVALID]).toEqual([]);
    });
  });

  // ── L2.06: Policy validation ──
  describe("L2.06: policy validation", () => {
    test("CryptoPolicyEngine includes zkProofOfAssets block", () => {
      const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy("default");
      expect(policy.zkProofOfAssets).toBeDefined();
      expect(policy.zkProofOfAssets.minQuorumNodes).toBe(3);
      expect(policy.zkProofOfAssets.maxAssetsPerProof).toBe(256);
      expect(policy.zkProofOfAssets.requireQuorumFinalization).toBe(true);
    });

    test("tenant policy can override zkProofOfAssets settings", () => {
      const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: { "tenant-a": { zkProofOfAssets: { minQuorumNodes: 5 } } },
      });
      const policy = engine.getPolicy("tenant-a");
      expect(policy.zkProofOfAssets.minQuorumNodes).toBe(5);
    });
  });

  // ── L2.07: Proof verifies without revealing amounts ──
  describe("L2.07: proof verifies without revealing amounts", () => {
    test("proof bundle does not contain individual asset amounts", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      engine.registerAsset("tenant-a", "asset-2", 2000);
      const draft = engine.createProof("tenant-a", 2500);
      engine.commitProof(draft.proofId);
      const proofBundle = engine.generateProof(draft.proofId);

      // The proof bundle should not expose individual amounts
      expect(proofBundle).not.toHaveProperty("amounts");
      expect(proofBundle).not.toHaveProperty("assetAmounts");
      // It should have aggregate backing (which is the sum, not individual)
      expect(proofBundle.aggregateBacking).toBe(3000);
      expect(proofBundle.claimedBacking).toBe(2500);
    });
  });

  // ── L2.08: BFT quorum signatures ──
  describe("L2.08: BFT quorum signatures", () => {
    test("proof not finalized until quorum signatures reached", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 4,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      engine.commitProof(draft.proofId);
      const bundle = engine.generateProof(draft.proofId);
      engine.verifyProof(bundle);

      engine.signProof(draft.proofId, "val-1", "s1");
      engine.signProof(draft.proofId, "val-2", "s2");
      engine.signProof(draft.proofId, "val-3", "s3");
      expect(engine.isFinalized(draft.proofId)).toBe(false); // 3 < 4

      engine.signProof(draft.proofId, "val-4", "s4");
      expect(engine.isFinalized(draft.proofId)).toBe(true); // 4 >= 4
    });
  });

  // ── L3.01: Anti-inflation ──
  describe("L3.01: anti-inflation", () => {
    test("double-counted asset across tenants rejected", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "shared-asset", 1000);
      expect(() =>
        engine.registerAsset("tenant-b", "shared-asset", 1000),
      ).toThrow(HsmAdapterError);
    });

    test("same asset re-registered by same tenant is allowed (update)", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      engine.registerAsset("tenant-a", "asset-1", 2000); // update
      expect(engine.getTenantAssets("tenant-a")).toEqual(["asset-1"]);
    });
  });

  // ── L3.02: Tampered proof ──
  describe("L3.02: tampered proof rejected", () => {
    test("tampered proof hash rejected", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      engine.commitProof(draft.proofId);
      const bundle = engine.generateProof(draft.proofId);

      // Tamper with the proof hash
      const tamperedBundle = { ...bundle, proofHash: "tampered-hash" };
      expect(() => engine.verifyProof(tamperedBundle)).toThrow(HsmAdapterError);
      expect(engine.getProofState(draft.proofId).state).toBe(
        PROOF_STATE.INVALID,
      );
    });

    test("tampered Merkle root rejected", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      engine.commitProof(draft.proofId);
      const bundle = engine.generateProof(draft.proofId);

      const tamperedBundle = { ...bundle, merkleRoot: "tampered-root" };
      expect(() => engine.verifyProof(tamperedBundle)).toThrow(HsmAdapterError);
    });
  });

  // ── L3.03: Cannot finalize without quorum ──
  describe("L3.03: cannot finalize without quorum", () => {
    test("proof not finalized with insufficient signatures", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 4,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      engine.commitProof(draft.proofId);
      const bundle = engine.generateProof(draft.proofId);
      engine.verifyProof(bundle);

      engine.signProof(draft.proofId, "val-1", "s1");
      engine.signProof(draft.proofId, "val-2", "s2");
      expect(engine.isFinalized(draft.proofId)).toBe(false);
    });
  });

  // ── L3.04: Invalid commitment ──
  describe("L3.04: invalid commitment rejected", () => {
    test("zero amount rejected", () => {
      expect(() => new AssetCommitment("a1", 0)).toThrow(HsmAdapterError);
    });

    test("negative amount rejected", () => {
      expect(() => new AssetCommitment("a1", -100)).toThrow(HsmAdapterError);
    });

    test("insufficient backing rejected", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 500);
      expect(() => engine.createProof("tenant-a", 1000)).toThrow(
        HsmAdapterError,
      );
    });
  });

  // ── Metrics ──
  describe("metrics counters", () => {
    test("hsm-metrics includes poa counters", () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty("hsm_poa_asset_registered_total", 0);
      expect(metrics).toHaveProperty("hsm_poa_proof_created_total", 0);
      expect(metrics).toHaveProperty("hsm_poa_proof_verified_total", 0);
      expect(metrics).toHaveProperty("hsm_poa_proof_invalid_total", 0);
      expect(metrics).toHaveProperty("hsm_poa_double_count_blocked_total", 0);
      expect(metrics).toHaveProperty("hsm_poa_quorum_signatures_total", 0);
      expect(metrics).toHaveProperty("hsm_poa_active_proofs", 0);
    });

    test("incrementCounter works for poa counters", () => {
      hsmMetrics.incrementCounter("hsm_poa_proof_created_total", 3);
      hsmMetrics.incrementCounter("hsm_poa_proof_verified_total", 2);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_poa_proof_created_total).toBe(3);
      expect(metrics.hsm_poa_proof_verified_total).toBe(2);
    });

    test("Prometheus output includes poa metrics", () => {
      hsmMetrics.incrementCounter("hsm_poa_proof_created_total", 1);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain("# HELP hsm_poa_proof_created_total");
      expect(output).toContain("# TYPE hsm_poa_proof_created_total counter");
      expect(output).toContain("hsm_poa_proof_created_total 1");
    });
  });

  // ── Engine state telemetry ──
  describe("getEngineState telemetry", () => {
    test("returns correct engine state", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      expect(engine.getEngineState().totalTenants).toBe(0);
      expect(engine.getEngineState().totalProofs).toBe(0);
      expect(engine.getEngineState().validatorCount).toBe(5);

      engine.registerAsset("tenant-a", "asset-1", 1000);
      expect(engine.getEngineState().totalTenants).toBe(1);
      expect(engine.getEngineState().totalAssets).toBe(1);
    });
  });

  // ── Error cases ──
  describe("error cases", () => {
    test("constructor throws for empty validators", () => {
      expect(() => new ZkProofOfAssetsEngine({ validatorNodes: [] })).toThrow(
        HsmAdapterError,
      );
    });

    test("createProof throws for unknown tenant", () => {
      const engine = new ZkProofOfAssetsEngine({ validatorNodes: VALIDATORS });
      expect(() => engine.createProof("unknown", 100)).toThrow(HsmAdapterError);
    });

    test("signProof throws for unknown validator", () => {
      const engine = new ZkProofOfAssetsEngine({
        validatorNodes: VALIDATORS,
        minQuorumNodes: 3,
      });
      engine.registerAsset("tenant-a", "asset-1", 1000);
      const draft = engine.createProof("tenant-a", 900);
      engine.commitProof(draft.proofId);
      const bundle = engine.generateProof(draft.proofId);
      engine.verifyProof(bundle);
      expect(() =>
        engine.signProof(draft.proofId, "unknown-val", "sig"),
      ).toThrow(HsmAdapterError);
    });

    test("getProofState throws for unknown proof", () => {
      const engine = new ZkProofOfAssetsEngine({ validatorNodes: VALIDATORS });
      expect(() => engine.getProofState("unknown")).toThrow(HsmAdapterError);
    });
  });
});
