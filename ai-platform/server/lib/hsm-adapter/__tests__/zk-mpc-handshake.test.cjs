"use strict";

/**
 * Track 46: Zero-Knowledge Inter-Enclave MPC Handshakes tests.
 */
const {
  ZkMpcHandshake,
  DEFAULT_OPTIONS,
  HANDSHAKE_PHASE,
  PROOF_STATUS,
  generateZkProof,
} = require("../zk-mpc-handshake.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 46: ZkMpcHandshake", () => {
  let engine;

  beforeEach(() => {
    engine = new ZkMpcHandshake({
      minParticipants: 2,
      maxParticipants: 5,
      handshakeTimeoutMs: 5000,
    });
  });

  describe("initiate", () => {
    test("initiates a handshake with valid participants", () => {
      const result = engine.initiate({
        participantIds: ["e1", "e2", "e3"],
        purpose: "key-generation",
      });
      expect(result.handshakeId).toBeDefined();
      expect(result.phase).toBe(HANDSHAKE_PHASE.INITIATED);
      expect(result.participantIds.length).toBe(3);
    });

    test("rejects insufficient participants", () => {
      expect(() => engine.initiate({ participantIds: ["e1"] })).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects too many participants", () => {
      const small = new ZkMpcHandshake({
        minParticipants: 2,
        maxParticipants: 3,
      });
      expect(() =>
        small.initiate({ participantIds: ["e1", "e2", "e3", "e4"] }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects duplicate participants", () => {
      expect(() => engine.initiate({ participantIds: ["e1", "e1"] })).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects missing config", () => {
      expect(() => engine.initiate(null)).toThrow(HsmAdapterError);
    });

    test("rejects missing participantIds", () => {
      expect(() => engine.initiate({ purpose: "test" })).toThrow(
        HsmAdapterError,
      );
    });

    test("enforces max concurrent handshakes", () => {
      const small = new ZkMpcHandshake({
        minParticipants: 2,
        maxConcurrentHandshakes: 1,
      });
      small.initiate({ participantIds: ["e1", "e2"] });
      expect(() => small.initiate({ participantIds: ["e3", "e4"] })).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("commit", () => {
    test("accepts a valid commitment", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      const commitResult = engine.commit(
        result.handshakeId,
        "e1",
        "commitment-hash-1",
      );
      expect(commitResult.committed).toBe(true);
      expect(commitResult.participantId).toBe("e1");
    });

    test("advances phase when all participants commit", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      const handshake = engine.getHandshake(result.handshakeId);
      expect(handshake.phase).toBe(HANDSHAKE_PHASE.COMMITTED);
      expect(handshake.commitmentCount).toBe(2);
    });

    test("rejects commitment from unauthorized participant", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      expect(() => engine.commit(result.handshakeId, "e3", "commit-3")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects duplicate commitment", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      expect(() =>
        engine.commit(result.handshakeId, "e1", "commit-1b"),
      ).toThrow(HsmAdapterError);
    });

    test("rejects empty commitment", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      expect(() => engine.commit(result.handshakeId, "e1", "")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects commitment to unknown handshake", () => {
      expect(() => engine.commit("fake-id", "e1", "commit")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("prove", () => {
    test("accepts a valid proof", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      const proof = generateZkProof("sha256", "secret-1", "commit-1");
      const proveResult = engine.prove(result.handshakeId, "e1", proof);
      expect(proveResult.proven).toBe(true);
    });

    test("advances phase when all proofs submitted", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      const proof1 = generateZkProof("sha256", "secret-1", "commit-1");
      const proof2 = generateZkProof("sha256", "secret-2", "commit-2");
      engine.prove(result.handshakeId, "e1", proof1);
      engine.prove(result.handshakeId, "e2", proof2);
      const handshake = engine.getHandshake(result.handshakeId);
      expect(handshake.phase).toBe(HANDSHAKE_PHASE.PROVEN);
    });

    test("rejects proof before commitment", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      const proof = generateZkProof("sha256", "secret-1", "commit-1");
      expect(() => engine.prove(result.handshakeId, "e1", proof)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects duplicate proof", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      const proof = generateZkProof("sha256", "secret-1", "commit-1");
      engine.prove(result.handshakeId, "e1", proof);
      expect(() => engine.prove(result.handshakeId, "e1", proof)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects invalid proof format", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      expect(() =>
        engine.prove(result.handshakeId, "e1", { challenge: "x" }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects proof from unauthorized participant", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      const proof = generateZkProof("sha256", "secret-3", "commit-3");
      expect(() => engine.prove(result.handshakeId, "e3", proof)).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("verifyProofs", () => {
    test("verifies all valid proofs", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      const proof1 = generateZkProof("sha256", "secret-1", "commit-1");
      const proof2 = generateZkProof("sha256", "secret-2", "commit-2");
      engine.prove(result.handshakeId, "e1", proof1);
      engine.prove(result.handshakeId, "e2", proof2);
      const verifyResult = engine.verifyProofs(result.handshakeId);
      expect(verifyResult.phase).toBe(HANDSHAKE_PHASE.VERIFIED);
      expect(verifyResult.verifiedCount).toBe(2);
    });

    test("aborts when proofs are invalid", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      // Submit invalid proofs (wrong challenge)
      engine.prove(result.handshakeId, "e1", {
        challenge: "wrong",
        response: "a".repeat(64),
        publicCommitment: "pc1",
      });
      engine.prove(result.handshakeId, "e2", {
        challenge: "wrong",
        response: "b".repeat(64),
        publicCommitment: "pc2",
      });
      const verifyResult = engine.verifyProofs(result.handshakeId);
      expect(verifyResult.phase).toBe(HANDSHAKE_PHASE.ABORTED);
      expect(verifyResult.verifiedCount).toBe(0);
    });

    test("rejects verification in wrong phase", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      expect(() => engine.verifyProofs(result.handshakeId)).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("finalize", () => {
    test("finalizes a verified handshake", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      engine.prove(
        result.handshakeId,
        "e1",
        generateZkProof("sha256", "s1", "commit-1"),
      );
      engine.prove(
        result.handshakeId,
        "e2",
        generateZkProof("sha256", "s2", "commit-2"),
      );
      engine.verifyProofs(result.handshakeId);
      const finalResult = engine.finalize(
        result.handshakeId,
        "combined-pub-key-123",
      );
      expect(finalResult.phase).toBe(HANDSHAKE_PHASE.FINALIZED);
      expect(finalResult.combinedPublicKey).toBe("combined-pub-key-123");
    });

    test("rejects finalization without verification", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      expect(() => engine.finalize(result.handshakeId, "key")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects empty public key", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "commit-1");
      engine.commit(result.handshakeId, "e2", "commit-2");
      engine.prove(
        result.handshakeId,
        "e1",
        generateZkProof("sha256", "s1", "commit-1"),
      );
      engine.prove(
        result.handshakeId,
        "e2",
        generateZkProof("sha256", "s2", "commit-2"),
      );
      engine.verifyProofs(result.handshakeId);
      expect(() => engine.finalize(result.handshakeId, "")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("full handshake flow", () => {
    test("complete 5-phase handshake with 3 participants", () => {
      const result = engine.initiate({
        participantIds: ["e1", "e2", "e3"],
        purpose: "distributed-keygen",
        coordinatorId: "e1",
      });
      // Phase 2: Commit
      for (const pid of ["e1", "e2", "e3"]) {
        engine.commit(result.handshakeId, pid, "commit-" + pid);
      }
      // Phase 3: Prove
      for (const pid of ["e1", "e2", "e3"]) {
        const proof = generateZkProof(
          "sha256",
          "secret-" + pid,
          "commit-" + pid,
        );
        engine.prove(result.handshakeId, pid, proof);
      }
      // Phase 4: Verify
      const verifyResult = engine.verifyProofs(result.handshakeId);
      expect(verifyResult.verifiedCount).toBe(3);
      // Phase 5: Finalize
      const finalResult = engine.finalize(
        result.handshakeId,
        "aggregated-public-key",
      );
      expect(finalResult.phase).toBe(HANDSHAKE_PHASE.FINALIZED);
      expect(finalResult.participantIds.length).toBe(3);
    });
  });

  describe("getHandshake", () => {
    test("returns active handshake state", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      const handshake = engine.getHandshake(result.handshakeId);
      expect(handshake.id).toBe(result.handshakeId);
      expect(handshake.phase).toBe(HANDSHAKE_PHASE.INITIATED);
    });

    test("returns completed handshake from history", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "c1");
      engine.commit(result.handshakeId, "e2", "c2");
      engine.prove(
        result.handshakeId,
        "e1",
        generateZkProof("sha256", "s1", "c1"),
      );
      engine.prove(
        result.handshakeId,
        "e2",
        generateZkProof("sha256", "s2", "c2"),
      );
      engine.verifyProofs(result.handshakeId);
      engine.finalize(result.handshakeId, "pub-key");
      const handshake = engine.getHandshake(result.handshakeId);
      expect(handshake.phase).toBe(HANDSHAKE_PHASE.FINALIZED);
    });

    test("returns null for unknown handshake", () => {
      expect(engine.getHandshake("unknown")).toBeNull();
    });
  });

  describe("getActiveHandshakes", () => {
    test("returns all active handshakes", () => {
      engine.initiate({ participantIds: ["e1", "e2"] });
      engine.initiate({ participantIds: ["e3", "e4"] });
      const active = engine.getActiveHandshakes();
      expect(active.length).toBe(2);
    });
  });

  describe("getCompletedHandshakes", () => {
    test("returns completed handshake history", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      engine.commit(result.handshakeId, "e1", "c1");
      engine.commit(result.handshakeId, "e2", "c2");
      engine.prove(
        result.handshakeId,
        "e1",
        generateZkProof("sha256", "s1", "c1"),
      );
      engine.prove(
        result.handshakeId,
        "e2",
        generateZkProof("sha256", "s2", "c2"),
      );
      engine.verifyProofs(result.handshakeId);
      engine.finalize(result.handshakeId, "pub-key");
      const completed = engine.getCompletedHandshakes();
      expect(completed.length).toBe(1);
      expect(completed[0].phase).toBe(HANDSHAKE_PHASE.FINALIZED);
    });
  });

  describe("checkExpired", () => {
    test("expires handshakes past timeout", () => {
      const fast = new ZkMpcHandshake({
        minParticipants: 2,
        handshakeTimeoutMs: 50,
      });
      fast.initiate({ participantIds: ["e1", "e2"] });
      return new Promise((resolve) => setTimeout(resolve, 60)).then(() => {
        const expired = fast.checkExpired();
        expect(expired.length).toBe(1);
      });
    });
  });

  describe("abort", () => {
    test("aborts an active handshake", () => {
      const result = engine.initiate({ participantIds: ["e1", "e2"] });
      const abortResult = engine.abort(result.handshakeId, "test-abort");
      expect(abortResult.aborted).toBe(true);
      expect(abortResult.reason).toBe("test-abort");
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      engine.initiate({ participantIds: ["e1", "e2"] });
      engine.initiate({ participantIds: ["e3", "e4"] });
      const stats = engine.getStats();
      expect(stats.activeHandshakes).toBe(2);
      expect(stats.byPhase[HANDSHAKE_PHASE.INITIATED]).toBe(2);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      engine.initiate({ participantIds: ["e1", "e2"] });
      engine.reset();
      expect(engine.getActiveHandshakes().length).toBe(0);
      expect(engine.getCompletedHandshakes().length).toBe(0);
    });
  });

  describe("generateZkProof utility", () => {
    test("generates a proof with challenge, response, and publicCommitment", () => {
      const proof = generateZkProof("sha256", "my-secret", "my-commitment");
      expect(proof.challenge).toBeDefined();
      expect(proof.response).toBeDefined();
      expect(proof.publicCommitment).toBeDefined();
      expect(typeof proof.challenge).toBe("string");
      expect(proof.response.length).toBe(64); // SHA-256 hex
    });

    test("generates different proofs for different secrets", () => {
      const p1 = generateZkProof("sha256", "secret-1", "commitment");
      const p2 = generateZkProof("sha256", "secret-2", "commitment");
      expect(p1.response).not.toBe(p2.response);
    });
  });
});
