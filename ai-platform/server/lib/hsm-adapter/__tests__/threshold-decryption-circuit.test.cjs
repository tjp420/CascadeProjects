"use strict";

/**
 * Track 54: Multi-Party Threshold Cryptography and Distributed Decryption Circuits tests.
 */
const crypto = require("crypto");
const {
  ThresholdDecryptionCircuit,
  DEFAULT_OPTIONS,
  KEYSET_STATUS,
  CIRCUIT_STATUS,
  SHARE_STATUS,
} = require("../threshold-decryption-circuit.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 54: ThresholdDecryptionCircuit", () => {
  let engine;

  beforeEach(() => {
    engine = new ThresholdDecryptionCircuit({
      minThreshold: 2,
      maxParticipants: 10,
      requireAttestation: false,
    });
  });

  describe("createKeySet", () => {
    test("creates a key set with t-of-n shares", () => {
      const ks = engine.createKeySet({
        keySetId: "ks1",
        threshold: 3,
        participants: 5,
      });
      expect(ks.keySetId).toBe("ks1");
      expect(ks.threshold).toBe(3);
      expect(ks.participants).toBe(5);
      expect(ks.status).toBe(KEYSET_STATUS.ACTIVE);
      expect(ks.participantIds.length).toBe(5);
    });

    test("accepts custom participant IDs", () => {
      const ks = engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["alpha", "beta", "gamma"],
      });
      expect(ks.participantIds).toEqual(["alpha", "beta", "gamma"]);
    });

    test("rejects null config", () => {
      expect(() => engine.createKeySet(null)).toThrow(HsmAdapterError);
    });

    test("rejects empty keySetId", () => {
      expect(() =>
        engine.createKeySet({
          threshold: 2,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects duplicate keySetId", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      expect(() =>
        engine.createKeySet({
          keySetId: "ks1",
          threshold: 2,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects threshold below minimum", () => {
      expect(() =>
        engine.createKeySet({
          keySetId: "ks1",
          threshold: 1,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects participants < threshold", () => {
      expect(() =>
        engine.createKeySet({
          keySetId: "ks1",
          threshold: 5,
          participants: 3,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects too many participants", () => {
      expect(() =>
        engine.createKeySet({
          keySetId: "ks1",
          threshold: 2,
          participants: 20,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects participant ID mismatch", () => {
      expect(() =>
        engine.createKeySet({
          keySetId: "ks1",
          threshold: 2,
          participants: 3,
          participantIds: ["a", "b"],
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("encrypt", () => {
    test("encrypts a message", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const ct = engine.encrypt("ks1", Buffer.from("hello world"));
      expect(ct.ciphertext).toBeDefined();
      expect(ct.nonce).toBeDefined();
      expect(ct.authTag).toBeDefined();
      expect(ct.keySetId).toBe("ks1");
    });

    test("rejects unknown key set", () => {
      expect(() => engine.encrypt("unknown", Buffer.from("hello"))).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects non-Buffer message", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      expect(() => engine.encrypt("ks1", "hello")).toThrow(HsmAdapterError);
    });

    test("rejects compromised key set", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      engine.compromiseKeySet("ks1");
      expect(() => engine.encrypt("ks1", Buffer.from("hello"))).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("initiateCircuit", () => {
    test("initiates a decryption circuit", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      const circuit = engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
        authTag: ct.authTag,
      });
      expect(circuit.circuitId).toBe("c1");
      expect(circuit.status).toBe(CIRCUIT_STATUS.DISTRIBUTED);
      expect(circuit.threshold).toBe(2);
    });

    test("rejects null config", () => {
      expect(() => engine.initiateCircuit(null)).toThrow(HsmAdapterError);
    });

    test("rejects missing circuitId", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      expect(() =>
        engine.initiateCircuit({
          keySetId: "ks1",
          ciphertext: Buffer.from("a"),
          nonce: Buffer.from("b"),
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects duplicate circuitId", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
      });
      expect(() =>
        engine.initiateCircuit({
          circuitId: "c1",
          keySetId: "ks1",
          ciphertext: ct.ciphertext,
          nonce: ct.nonce,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown key set", () => {
      expect(() =>
        engine.initiateCircuit({
          circuitId: "c1",
          keySetId: "unknown",
          ciphertext: Buffer.from("a"),
          nonce: Buffer.from("b"),
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects non-Buffer ciphertext", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      expect(() =>
        engine.initiateCircuit({
          circuitId: "c1",
          keySetId: "ks1",
          ciphertext: "not-a-buffer",
          nonce: Buffer.from("b"),
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("submitPartialDecryption", () => {
    test("accepts a partial decryption share", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
        authTag: ct.authTag,
      });
      const result = engine.submitPartialDecryption(
        "c1",
        "n1",
        engine.computePartialDecryption("ks1", "n1"),
      );
      expect(result.verified).toBe(true);
      expect(result.verifiedShares).toBe(1);
      expect(result.ready).toBe(false);
    });

    test("assembles when threshold reached", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello world"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
        authTag: ct.authTag,
      });
      // Submit first share
      engine.submitPartialDecryption(
        "c1",
        "n1",
        engine.computePartialDecryption("ks1", "n1"),
      );
      // Submit second share — should trigger assembly
      const result = engine.submitPartialDecryption(
        "c1",
        "n2",
        engine.computePartialDecryption("ks1", "n2"),
      );
      expect(result.ready).toBe(true);
      expect(result.status).toBe(CIRCUIT_STATUS.COMPLETED);
    });

    test("rejects unknown circuit", () => {
      expect(() =>
        engine.submitPartialDecryption("unknown", "n1", Buffer.from("a")),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown node", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
      });
      expect(() =>
        engine.submitPartialDecryption("c1", "unknown", Buffer.from("a")),
      ).toThrow(HsmAdapterError);
    });

    test("rejects duplicate submission", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
      });
      engine.submitPartialDecryption("c1", "n1", Buffer.from("a"));
      expect(() =>
        engine.submitPartialDecryption("c1", "n1", Buffer.from("b")),
      ).toThrow(HsmAdapterError);
    });

    test("rejects non-Buffer partial", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
      });
      expect(() =>
        engine.submitPartialDecryption("c1", "n1", "not-a-buffer"),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("assembleDecryption", () => {
    test("manually assembles when enough shares collected", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello world"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
        authTag: ct.authTag,
      });
      engine.submitPartialDecryption(
        "c1",
        "n1",
        engine.computePartialDecryption("ks1", "n1"),
      );
      engine.submitPartialDecryption(
        "c1",
        "n2",
        engine.computePartialDecryption("ks1", "n2"),
      );
      // Third share triggers auto-assembly (threshold=3)
      const result = engine.submitPartialDecryption(
        "c1",
        "n3",
        engine.computePartialDecryption("ks1", "n3"),
      );
      expect(result.status).toBe(CIRCUIT_STATUS.COMPLETED);
      expect(result.sharesUsed).toBe(3);
    });

    test("rejects insufficient shares", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 3,
        participants: 5,
        participantIds: ["n1", "n2", "n3", "n4", "n5"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
      });
      engine.submitPartialDecryption(
        "c1",
        "n1",
        engine.computePartialDecryption("ks1", "n1"),
      );
      expect(() => engine.assembleDecryption("c1")).toThrow(HsmAdapterError);
    });

    test("rejects unknown circuit", () => {
      expect(() => engine.assembleDecryption("unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("compromiseKeySet", () => {
    test("compromises a key set", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const result = engine.compromiseKeySet("ks1", "security incident");
      expect(result.compromised).toBe(true);
      const ks = engine.getKeySet("ks1");
      expect(ks.status).toBe(KEYSET_STATUS.COMPROMISED);
    });

    test("rejects unknown key set", () => {
      expect(() => engine.compromiseKeySet("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("rotateKeySet", () => {
    test("rotates a key set", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const result = engine.rotateKeySet("ks1");
      expect(result.rotated).toBe(true);
      const ks = engine.getKeySet("ks1");
      expect(ks.status).toBe(KEYSET_STATUS.ROTATED);
    });

    test("rejects unknown key set", () => {
      expect(() => engine.rotateKeySet("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("destroyKeySet", () => {
    test("destroys a key set", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const result = engine.destroyKeySet("ks1");
      expect(result.destroyed).toBe(true);
      expect(engine.getKeySet("ks1")).toBeNull();
    });

    test("rejects unknown key set", () => {
      expect(() => engine.destroyKeySet("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("getKeySet", () => {
    test("returns key set metadata", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const ks = engine.getKeySet("ks1");
      expect(ks).not.toBeNull();
      expect(ks.keySetId).toBe("ks1");
      expect(ks.threshold).toBe(2);
    });

    test("returns null for unknown key set", () => {
      expect(engine.getKeySet("unknown")).toBeNull();
    });
  });

  describe("getKeySets", () => {
    test("returns all key sets", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      engine.createKeySet({ keySetId: "ks2", threshold: 3, participants: 5 });
      expect(engine.getKeySets().length).toBe(2);
    });
  });

  describe("getShare", () => {
    test("returns share metadata", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const share = engine.getShare("ks1", "n1");
      expect(share).not.toBeNull();
      expect(share.nodeId).toBe("n1");
      expect(share.index).toBe(1);
    });

    test("returns null for unknown node", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      expect(engine.getShare("ks1", "unknown")).toBeNull();
    });
  });

  describe("getCircuit", () => {
    test("returns circuit state", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
      });
      const circuit = engine.getCircuit("c1");
      expect(circuit).not.toBeNull();
      expect(circuit.circuitId).toBe("c1");
      expect(circuit.status).toBe(CIRCUIT_STATUS.DISTRIBUTED);
    });

    test("returns null for unknown circuit", () => {
      expect(engine.getCircuit("unknown")).toBeNull();
    });
  });

  describe("getCompletedCircuits", () => {
    test("returns completed circuit history", () => {
      engine.createKeySet({
        keySetId: "ks1",
        threshold: 2,
        participants: 3,
        participantIds: ["n1", "n2", "n3"],
      });
      const ct = engine.encrypt("ks1", Buffer.from("hello"));
      engine.initiateCircuit({
        circuitId: "c1",
        keySetId: "ks1",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
        authTag: ct.authTag,
      });
      engine.submitPartialDecryption(
        "c1",
        "n1",
        engine.computePartialDecryption("ks1", "n1"),
      );
      engine.submitPartialDecryption(
        "c1",
        "n2",
        engine.computePartialDecryption("ks1", "n2"),
      );
      expect(engine.getCompletedCircuits().length).toBe(1);
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      const stats = engine.getStats();
      expect(stats.keySetCount).toBe(1);
      expect(stats.activeCircuits).toBe(0);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      engine.createKeySet({ keySetId: "ks1", threshold: 2, participants: 3 });
      engine.reset();
      expect(engine.getKeySets().length).toBe(0);
    });
  });

  describe("full distributed decryption flow", () => {
    test("complete encrypt -> distribute -> decrypt flow", () => {
      // Create a 3-of-5 threshold key set
      engine.createKeySet({
        keySetId: "treasury-keys",
        threshold: 3,
        participants: 5,
        participantIds: [
          "enclave-a",
          "enclave-b",
          "enclave-c",
          "enclave-d",
          "enclave-e",
        ],
      });
      // Encrypt a secret message
      const secret = Buffer.from("The eagle flies at midnight");
      const ct = engine.encrypt("treasury-keys", secret);
      // Initiate distributed decryption circuit
      const circuit = engine.initiateCircuit({
        circuitId: "decrypt-001",
        keySetId: "treasury-keys",
        ciphertext: ct.ciphertext,
        nonce: ct.nonce,
        authTag: ct.authTag,
      });
      expect(circuit.status).toBe(CIRCUIT_STATUS.DISTRIBUTED);
      // Submit partial decryptions from 3 enclaves
      const r1 = engine.submitPartialDecryption(
        "decrypt-001",
        "enclave-a",
        engine.computePartialDecryption("treasury-keys", "enclave-a"),
      );
      expect(r1.ready).toBe(false);
      const r2 = engine.submitPartialDecryption(
        "decrypt-001",
        "enclave-b",
        engine.computePartialDecryption("treasury-keys", "enclave-b"),
      );
      expect(r2.ready).toBe(false);
      // Third share should trigger assembly
      const r3 = engine.submitPartialDecryption(
        "decrypt-001",
        "enclave-c",
        engine.computePartialDecryption("treasury-keys", "enclave-c"),
      );
      expect(r3.ready).toBe(true);
      expect(r3.status).toBe(CIRCUIT_STATUS.COMPLETED);
      // Verify the decrypted plaintext matches the original
      expect(r3.plaintext.equals(secret)).toBe(true);
      // Verify stats
      const stats = engine.getStats();
      expect(stats.completedCircuits).toBe(1);
    });
  });
});
