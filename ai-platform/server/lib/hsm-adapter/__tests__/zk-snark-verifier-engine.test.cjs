"use strict";

/**
 * Track 57: zk-SNARK Enclave Verifiers tests.
 */
const {
  ZkSnarkVerifierEngine,
  DEFAULT_OPTIONS,
  CIRCUIT_STATUS,
  PROOF_STATUS,
  SETUP_STATUS,
} = require("../zk-snark-verifier-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 57: ZkSnarkVerifierEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new ZkSnarkVerifierEngine({
      maxConstraints: 1000,
      maxWitnessSize: 500,
      maxProofSize: 4096,
    });
  });

  // Helper: create a simple multiplication circuit
  function createSimpleCircuit(engine, circuitId = "mul-circuit") {
    return engine.compileCircuit({
      circuitId,
      name: "Multiplication Circuit",
      constraints: [
        { type: "mul", a: 1, b: 2 }, // public * private = output
      ],
      publicInputs: ["x"],
      privateInputs: ["y"],
    });
  }

  // Helper: full setup for a circuit
  function setupCircuit(
    engine,
    circuitId = "mul-circuit",
    setupId = "setup-1",
  ) {
    createSimpleCircuit(engine, circuitId);
    return engine.generateTrustedSetup(circuitId, { setupId });
  }

  describe("compileCircuit", () => {
    test("compiles a valid circuit", () => {
      const result = createSimpleCircuit(engine);
      expect(result.circuitId).toBe("mul-circuit");
      expect(result.status).toBe(CIRCUIT_STATUS.COMPILED);
      expect(result.constraintCount).toBe(1);
      expect(result.publicInputCount).toBe(1);
      expect(result.privateInputCount).toBe(1);
      expect(result.hash).toBeDefined();
    });

    test("rejects null config", () => {
      expect(() => engine.compileCircuit(null)).toThrow(HsmAdapterError);
    });

    test("rejects missing circuitId", () => {
      expect(() =>
        engine.compileCircuit({
          constraints: [{ type: "mul", a: 1, b: 2 }],
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects duplicate circuitId", () => {
      createSimpleCircuit(engine);
      expect(() => createSimpleCircuit(engine)).toThrow(HsmAdapterError);
    });

    test("rejects empty constraints", () => {
      expect(() =>
        engine.compileCircuit({
          circuitId: "c1",
          constraints: [],
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects too many constraints", () => {
      const constraints = Array.from({ length: 1001 }, () => ({
        type: "mul",
        a: 0,
        b: 0,
      }));
      expect(() =>
        engine.compileCircuit({
          circuitId: "c1",
          constraints,
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects invalid constraint structure", () => {
      expect(() =>
        engine.compileCircuit({
          circuitId: "c1",
          constraints: [{ noType: true }],
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("generateTrustedSetup", () => {
    test("generates a trusted setup", () => {
      createSimpleCircuit(engine);
      const result = engine.generateTrustedSetup("mul-circuit", {
        setupId: "s1",
      });
      expect(result.setupId).toBe("s1");
      expect(result.status).toBe(SETUP_STATUS.READY);
      expect(result.provingKeySize).toBeGreaterThan(0);
      expect(result.verificationKeySize).toBeGreaterThan(0);
    });

    test("rejects unknown circuit", () => {
      expect(() => engine.generateTrustedSetup("unknown")).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects duplicate setupId", () => {
      createSimpleCircuit(engine);
      engine.generateTrustedSetup("mul-circuit", { setupId: "s1" });
      expect(() =>
        engine.generateTrustedSetup("mul-circuit", { setupId: "s1" }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("generateProof", () => {
    test("generates a proof", () => {
      setupCircuit(engine);
      const result = engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 5 },
        privateInputs: { y: 7 },
      });
      expect(result.proofId).toBe("p1");
      expect(result.status).toBe(PROOF_STATUS.GENERATED);
      expect(result.proofSize).toBeGreaterThan(0);
    });

    test("rejects null config", () => {
      expect(() => engine.generateProof(null)).toThrow(HsmAdapterError);
    });

    test("rejects missing proofId", () => {
      setupCircuit(engine);
      expect(() =>
        engine.generateProof({
          circuitId: "mul-circuit",
          setupId: "setup-1",
          publicInputs: { x: 5 },
          privateInputs: { y: 7 },
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects duplicate proofId", () => {
      setupCircuit(engine);
      engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 5 },
        privateInputs: { y: 7 },
      });
      expect(() =>
        engine.generateProof({
          proofId: "p1",
          circuitId: "mul-circuit",
          setupId: "setup-1",
          publicInputs: { x: 5 },
          privateInputs: { y: 7 },
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown circuit", () => {
      expect(() =>
        engine.generateProof({
          proofId: "p1",
          circuitId: "unknown",
          setupId: "s1",
          publicInputs: {},
          privateInputs: {},
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown setup", () => {
      createSimpleCircuit(engine);
      expect(() =>
        engine.generateProof({
          proofId: "p1",
          circuitId: "mul-circuit",
          setupId: "unknown",
          publicInputs: { x: 5 },
          privateInputs: { y: 7 },
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects setup-circuit mismatch", () => {
      setupCircuit(engine);
      engine.compileCircuit({
        circuitId: "other-circuit",
        constraints: [{ type: "add", a: 1, b: 2 }],
        publicInputs: ["a"],
        privateInputs: ["b"],
      });
      engine.generateTrustedSetup("other-circuit", { setupId: "setup-2" });
      expect(() =>
        engine.generateProof({
          proofId: "p1",
          circuitId: "other-circuit",
          setupId: "setup-1",
          publicInputs: { a: 5 },
          privateInputs: { b: 7 },
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects missing public input", () => {
      setupCircuit(engine);
      expect(() =>
        engine.generateProof({
          proofId: "p1",
          circuitId: "mul-circuit",
          setupId: "setup-1",
          publicInputs: {},
          privateInputs: { y: 7 },
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects missing private input", () => {
      setupCircuit(engine);
      expect(() =>
        engine.generateProof({
          proofId: "p1",
          circuitId: "mul-circuit",
          setupId: "setup-1",
          publicInputs: { x: 5 },
          privateInputs: {},
        }),
      ).toThrow(HsmAdapterError);
    });

    test("accepts enclave attestation", () => {
      setupCircuit(engine);
      const result = engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 5 },
        privateInputs: { y: 7 },
        enclaveAttestation: "att-hash-123",
      });
      expect(result.enclaveAttestation).toBe("att-hash-123");
    });
  });

  describe("verifyProof", () => {
    test("verifies a valid proof", () => {
      setupCircuit(engine);
      engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 5 },
        privateInputs: { y: 7 },
      });
      const result = engine.verifyProof("p1");
      expect(result.verified).toBe(true);
      expect(result.status).toBe(PROOF_STATUS.VERIFIED);
    });

    test("rejects unknown proof", () => {
      expect(() => engine.verifyProof("unknown")).toThrow(HsmAdapterError);
    });

    test("rejects expired proof", () => {
      setupCircuit(engine);
      engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 5 },
        privateInputs: { y: 7 },
      });
      // Manually expire the proof
      const proof = engine._proofs.get("p1");
      proof.status = PROOF_STATUS.EXPIRED;
      expect(() => engine.verifyProof("p1")).toThrow(HsmAdapterError);
    });
  });

  describe("aggregateProofs", () => {
    test("aggregates verified proofs", () => {
      setupCircuit(engine);
      // Generate and verify 3 proofs
      for (let i = 0; i < 3; i++) {
        engine.generateProof({
          proofId: `p${i}`,
          circuitId: "mul-circuit",
          setupId: "setup-1",
          publicInputs: { x: i + 1 },
          privateInputs: { y: i + 2 },
        });
        engine.verifyProof(`p${i}`);
      }
      const result = engine.aggregateProofs(["p0", "p1", "p2"]);
      expect(result.proofCount).toBe(3);
      expect(result.aggId).toBeDefined();
    });

    test("rejects insufficient proofs", () => {
      setupCircuit(engine);
      engine.generateProof({
        proofId: "p0",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 1 },
        privateInputs: { y: 2 },
      });
      engine.verifyProof("p0");
      expect(() => engine.aggregateProofs(["p0"])).toThrow(HsmAdapterError);
    });

    test("rejects unverified proof", () => {
      setupCircuit(engine);
      engine.generateProof({
        proofId: "p0",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 1 },
        privateInputs: { y: 2 },
      });
      engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 2 },
        privateInputs: { y: 3 },
      });
      engine.verifyProof("p0");
      // p1 not verified
      expect(() => engine.aggregateProofs(["p0", "p1"])).toThrow(
        HsmAdapterError,
      );
    });

    test("rejects unknown proof", () => {
      expect(() => engine.aggregateProofs(["unknown1", "unknown2"])).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("verifyAggregatedProof", () => {
    test("verifies an aggregated proof", () => {
      setupCircuit(engine);
      for (let i = 0; i < 3; i++) {
        engine.generateProof({
          proofId: `p${i}`,
          circuitId: "mul-circuit",
          setupId: "setup-1",
          publicInputs: { x: i + 1 },
          privateInputs: { y: i + 2 },
        });
        engine.verifyProof(`p${i}`);
      }
      const agg = engine.aggregateProofs(["p0", "p1", "p2"]);
      const result = engine.verifyAggregatedProof(agg.aggId);
      expect(result.verified).toBe(true);
    });

    test("rejects unknown aggregated proof", () => {
      expect(() => engine.verifyAggregatedProof("unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("destroySetup", () => {
    test("destroys a trusted setup", () => {
      setupCircuit(engine);
      const result = engine.destroySetup("setup-1");
      expect(result.destroyed).toBe(true);
      const setup = engine.getSetup("setup-1");
      expect(setup.status).toBe(SETUP_STATUS.DESTROYED);
    });

    test("rejects unknown setup", () => {
      expect(() => engine.destroySetup("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("getCircuit", () => {
    test("returns circuit metadata", () => {
      createSimpleCircuit(engine);
      const c = engine.getCircuit("mul-circuit");
      expect(c).not.toBeNull();
      expect(c.circuitId).toBe("mul-circuit");
      expect(c.constraintCount).toBe(1);
    });

    test("returns null for unknown circuit", () => {
      expect(engine.getCircuit("unknown")).toBeNull();
    });
  });

  describe("getCircuits", () => {
    test("returns all circuits", () => {
      createSimpleCircuit(engine, "c1");
      engine.compileCircuit({
        circuitId: "c2",
        constraints: [{ type: "add", a: 1, b: 2 }],
        publicInputs: ["a"],
        privateInputs: ["b"],
      });
      expect(engine.getCircuits().length).toBe(2);
    });
  });

  describe("getProof", () => {
    test("returns proof metadata", () => {
      setupCircuit(engine);
      engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 5 },
        privateInputs: { y: 7 },
      });
      const p = engine.getProof("p1");
      expect(p).not.toBeNull();
      expect(p.proofId).toBe("p1");
      expect(p.status).toBe(PROOF_STATUS.GENERATED);
    });

    test("returns null for unknown proof", () => {
      expect(engine.getProof("unknown")).toBeNull();
    });
  });

  describe("getSetup", () => {
    test("returns setup metadata", () => {
      setupCircuit(engine);
      const s = engine.getSetup("setup-1");
      expect(s).not.toBeNull();
      expect(s.setupId).toBe("setup-1");
      expect(s.status).toBe(SETUP_STATUS.READY);
    });

    test("returns null for unknown setup", () => {
      expect(engine.getSetup("unknown")).toBeNull();
    });
  });

  describe("getCompletedProofs", () => {
    test("returns completed proofs", () => {
      setupCircuit(engine);
      engine.generateProof({
        proofId: "p1",
        circuitId: "mul-circuit",
        setupId: "setup-1",
        publicInputs: { x: 5 },
        privateInputs: { y: 7 },
      });
      engine.verifyProof("p1");
      expect(engine.getCompletedProofs().length).toBe(1);
    });
  });

  describe("getAggregatedProof", () => {
    test("returns aggregated proof metadata", () => {
      setupCircuit(engine);
      for (let i = 0; i < 3; i++) {
        engine.generateProof({
          proofId: `p${i}`,
          circuitId: "mul-circuit",
          setupId: "setup-1",
          publicInputs: { x: i + 1 },
          privateInputs: { y: i + 2 },
        });
        engine.verifyProof(`p${i}`);
      }
      const agg = engine.aggregateProofs(["p0", "p1", "p2"]);
      const info = engine.getAggregatedProof(agg.aggId);
      expect(info).not.toBeNull();
      expect(info.proofCount).toBe(3);
    });

    test("returns null for unknown aggregated proof", () => {
      expect(engine.getAggregatedProof("unknown")).toBeNull();
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      createSimpleCircuit(engine);
      const stats = engine.getStats();
      expect(stats.totalCircuits).toBe(1);
      expect(stats.totalSetups).toBe(0);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      createSimpleCircuit(engine);
      engine.reset();
      expect(engine.getStats().totalCircuits).toBe(0);
    });
  });

  describe("full zk-SNARK flow", () => {
    test("complete compile -> setup -> prove -> verify -> aggregate flow", () => {
      // Compile circuit
      engine.compileCircuit({
        circuitId: "enclave-computation",
        name: "Enclave Computation Proof",
        constraints: [
          { type: "mul", a: 1, b: 2 },
          { type: "add", a: 0, b: 3 },
        ],
        publicInputs: ["output"],
        privateInputs: ["secret"],
      });
      // Generate trusted setup
      engine.generateTrustedSetup("enclave-computation", {
        setupId: "main-setup",
      });
      // Generate proofs for 3 enclave computations
      const proofIds = [];
      for (let i = 0; i < 3; i++) {
        const pid = `enclave-proof-${i}`;
        engine.generateProof({
          proofId: pid,
          circuitId: "enclave-computation",
          setupId: "main-setup",
          publicInputs: { output: (i + 1) * 10 },
          privateInputs: { secret: i + 1 },
          enclaveAttestation: `att-${i}`,
        });
        proofIds.push(pid);
      }
      // Verify all proofs
      for (const pid of proofIds) {
        const result = engine.verifyProof(pid);
        expect(result.verified).toBe(true);
      }
      // Aggregate proofs
      const agg = engine.aggregateProofs(proofIds);
      expect(agg.proofCount).toBe(3);
      // Verify aggregated proof
      const aggResult = engine.verifyAggregatedProof(agg.aggId);
      expect(aggResult.verified).toBe(true);
      // Verify stats
      const stats = engine.getStats();
      expect(stats.totalCircuits).toBe(1);
      expect(stats.aggregatedProofs).toBe(1);
      expect(stats.completedProofs).toBe(3);
      // Destroy setup (toxic waste cleanup)
      const destroyed = engine.destroySetup("main-setup");
      expect(destroyed.destroyed).toBe(true);
      const setup = engine.getSetup("main-setup");
      expect(setup.status).toBe(SETUP_STATUS.DESTROYED);
    });
  });
});
