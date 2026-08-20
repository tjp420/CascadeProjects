"use strict";

/**
 * Track 47: Post-Quantum Cryptographic Enclave Migrations tests.
 */
const {
  PqcEnclaveMigrationEngine,
  DEFAULT_OPTIONS,
  MIGRATION_PHASE,
  ALGORITHM_CLASS,
  SIGNATURE_CONSTRAINT_STATUS,
} = require("../pqc-enclave-migration.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 47: PqcEnclaveMigrationEngine", () => {
  let engine;

  beforeEach(() => {
    engine = new PqcEnclaveMigrationEngine({
      requireHybridTransition: true,
      hybridTransitionPeriodMs: 100, // short for testing
      requireAttestation: false,
      maxMigrationAttempts: 3,
    });
  });

  describe("registerEnclave", () => {
    test("registers an enclave with default algorithms", () => {
      const result = engine.registerEnclave("e1");
      expect(result.enclaveId).toBe("e1");
      expect(result.phase).toBe(MIGRATION_PHASE.PENDING);
      const state = engine.getMigrationState("e1");
      expect(state.currentAlgorithm).toBe("ECDH-P256");
      expect(state.targetPqcAlgorithm).toBe("ML-KEM-768");
    });

    test("registers with custom algorithms", () => {
      engine.registerEnclave("e1", {
        currentAlgorithm: "RSA-4096",
        targetPqcAlgorithm: "ML-KEM-1024",
        targetDsaAlgorithm: "ML-DSA-87",
      });
      const state = engine.getMigrationState("e1");
      expect(state.currentAlgorithm).toBe("RSA-4096");
      expect(state.targetPqcAlgorithm).toBe("ML-KEM-1024");
      expect(state.targetDsaAlgorithm).toBe("ML-DSA-87");
    });

    test("rejects empty enclave ID", () => {
      expect(() => engine.registerEnclave("")).toThrow(HsmAdapterError);
    });

    test("rejects duplicate registration", () => {
      engine.registerEnclave("e1");
      expect(() => engine.registerEnclave("e1")).toThrow(HsmAdapterError);
    });

    test("rejects unsupported classical algorithm", () => {
      expect(() =>
        engine.registerEnclave("e1", { currentAlgorithm: "DES" }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unsupported PQC algorithm", () => {
      expect(() =>
        engine.registerEnclave("e1", { targetPqcAlgorithm: "Kyber-512" }),
      ).toThrow(HsmAdapterError);
    });

    test("initializes signature constraint", () => {
      engine.registerEnclave("e1");
      const constraint = engine.getSignatureConstraint("e1");
      expect(constraint).not.toBeNull();
      expect(constraint.status).toBe(SIGNATURE_CONSTRAINT_STATUS.NOT_REQUIRED);
      expect(constraint.requiredAlgorithm).toBe("ML-DSA-65");
    });
  });

  describe("planMigration", () => {
    test("plans a migration", () => {
      engine.registerEnclave("e1");
      const plan = engine.planMigration("e1");
      expect(plan.enclaveId).toBe("e1");
      expect(plan.phases).toContain("hybrid-active");
      expect(plan.phases).toContain("pqc-active");
      expect(plan.phases).toContain("completed");
    });

    test("rejects planning non-pending enclave", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      expect(() => engine.planMigration("e1")).toThrow(HsmAdapterError);
    });

    test("rejects planning unknown enclave", () => {
      expect(() => engine.planMigration("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("activateHybrid", () => {
    test("activates hybrid mode", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      const result = engine.activateHybrid("e1", "attestation");
      expect(result.phase).toBe(MIGRATION_PHASE.HYBRID_ACTIVE);
      expect(result.algorithmClass).toBe(ALGORITHM_CLASS.HYBRID);
      expect(result.algorithms.length).toBe(2);
    });

    test("rejects hybrid without planning", () => {
      engine.registerEnclave("e1");
      expect(() => engine.activateHybrid("e1")).toThrow(HsmAdapterError);
    });

    test("rejects unknown enclave", () => {
      expect(() => engine.activateHybrid("unknown")).toThrow(HsmAdapterError);
    });

    test("requires attestation when configured", () => {
      const strict = new PqcEnclaveMigrationEngine({
        requireAttestation: true,
      });
      strict.registerEnclave("e1");
      strict.planMigration("e1");
      expect(() => strict.activateHybrid("e1")).toThrow(HsmAdapterError);
      const result = strict.activateHybrid("e1", "attestation-proof");
      expect(result.phase).toBe(MIGRATION_PHASE.HYBRID_ACTIVE);
    });

    test("activates signature constraint to pending", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      const constraint = engine.getSignatureConstraint("e1");
      expect(constraint.status).toBe(SIGNATURE_CONSTRAINT_STATUS.PENDING);
    });
  });

  describe("activatePqc", () => {
    test("rejects PQC activation without hybrid", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      expect(() => engine.activatePqc("e1")).toThrow(HsmAdapterError);
    });

    test("rejects PQC activation during hybrid period", () => {
      const slowEngine = new PqcEnclaveMigrationEngine({
        requireHybridTransition: true,
        hybridTransitionPeriodMs: 10000,
        requireAttestation: false,
      });
      slowEngine.registerEnclave("e1");
      slowEngine.planMigration("e1");
      slowEngine.activateHybrid("e1");
      expect(() => slowEngine.activatePqc("e1")).toThrow(HsmAdapterError);
    });

    test("activates PQC after hybrid period", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      return new Promise((resolve) => setTimeout(resolve, 150)).then(() => {
        const result = engine.activatePqc("e1");
        expect(result.phase).toBe(MIGRATION_PHASE.PQC_ACTIVE);
        expect(result.algorithmClass).toBe(ALGORITHM_CLASS.PQC);
        expect(result.algorithm).toBe("ML-KEM-768");
      });
    });

    test("rejects unknown enclave", () => {
      expect(() => engine.activatePqc("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("completeMigration", () => {
    test("completes migration after PQC activation", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      return new Promise((resolve) => setTimeout(resolve, 150)).then(() => {
        engine.activatePqc("e1");
        const result = engine.completeMigration("e1");
        expect(result.phase).toBe(MIGRATION_PHASE.COMPLETED);
      });
    });

    test("rejects completion without PQC activation", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      expect(() => engine.completeMigration("e1")).toThrow(HsmAdapterError);
    });
  });

  describe("rollback", () => {
    test("rolls back from hybrid to classical", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      const result = engine.rollback("e1", "test-rollback");
      expect(result.phase).toBe(MIGRATION_PHASE.ROLLBACK);
      expect(result.rolledBack).toBe(true);
      expect(result.attempts).toBe(1);
    });

    test("rejects rollback from pending state", () => {
      engine.registerEnclave("e1");
      expect(() => engine.rollback("e1")).toThrow(HsmAdapterError);
    });

    test("rejects rollback from completed state", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      return new Promise((resolve) => setTimeout(resolve, 150)).then(() => {
        engine.activatePqc("e1");
        engine.completeMigration("e1");
        expect(() => engine.rollback("e1")).toThrow(HsmAdapterError);
      });
    });

    test("fails after max attempts", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      engine.rollback("e1", "attempt-1");
      // Re-plan and re-activate
      const state = engine._enclaves.get("e1");
      state.phase = MIGRATION_PHASE.PLANNED;
      engine.activateHybrid("e1");
      engine.rollback("e1", "attempt-2");
      state.phase = MIGRATION_PHASE.PLANNED;
      engine.activateHybrid("e1");
      const result = engine.rollback("e1", "attempt-3");
      expect(result.phase).toBe(MIGRATION_PHASE.FAILED);
      expect(result.failed).toBe(true);
    });
  });

  describe("satisfySignatureConstraint", () => {
    test("satisfies a pending constraint", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      const result = engine.satisfySignatureConstraint("e1", {
        algorithm: "ML-DSA-65",
        signature: "a".repeat(128),
      });
      expect(result.satisfied).toBe(true);
      expect(result.algorithm).toBe("ML-DSA-65");
      const constraint = engine.getSignatureConstraint("e1");
      expect(constraint.status).toBe(SIGNATURE_CONSTRAINT_STATUS.SATISFIED);
    });

    test("rejects invalid proof format", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      expect(() =>
        engine.satisfySignatureConstraint("e1", { algorithm: "ML-DSA-65" }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unsupported algorithm", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      expect(() =>
        engine.satisfySignatureConstraint("e1", {
          algorithm: "RSA-2048",
          signature: "a".repeat(128),
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects algorithm mismatch", () => {
      engine.registerEnclave("e1", { targetDsaAlgorithm: "ML-DSA-87" });
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      expect(() =>
        engine.satisfySignatureConstraint("e1", {
          algorithm: "ML-DSA-65",
          signature: "a".repeat(128),
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects short signature", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      expect(() =>
        engine.satisfySignatureConstraint("e1", {
          algorithm: "ML-DSA-65",
          signature: "short",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects unknown enclave", () => {
      expect(() =>
        engine.satisfySignatureConstraint("unknown", {
          algorithm: "ML-DSA-65",
          signature: "a".repeat(128),
        }),
      ).toThrow(HsmAdapterError);
    });
  });

  describe("violateSignatureConstraint", () => {
    test("violates a constraint", () => {
      engine.registerEnclave("e1");
      const result = engine.violateSignatureConstraint("e1", "test-violation");
      expect(result.violated).toBe(true);
      const constraint = engine.getSignatureConstraint("e1");
      expect(constraint.status).toBe(SIGNATURE_CONSTRAINT_STATUS.VIOLATED);
    });

    test("rejects unknown enclave", () => {
      expect(() => engine.violateSignatureConstraint("unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("getMigrationState", () => {
    test("returns state for registered enclave", () => {
      engine.registerEnclave("e1");
      const state = engine.getMigrationState("e1");
      expect(state.enclaveId).toBe("e1");
      expect(state.phase).toBe(MIGRATION_PHASE.PENDING);
    });

    test("returns null for unknown enclave", () => {
      expect(engine.getMigrationState("unknown")).toBeNull();
    });
  });

  describe("getSignatureConstraint", () => {
    test("returns constraint for registered enclave", () => {
      engine.registerEnclave("e1");
      const constraint = engine.getSignatureConstraint("e1");
      expect(constraint.enclaveId).toBe("e1");
      expect(constraint.requiredAlgorithm).toBe("ML-DSA-65");
    });

    test("returns null for unknown enclave", () => {
      expect(engine.getSignatureConstraint("unknown")).toBeNull();
    });
  });

  describe("getAllEnclaves", () => {
    test("returns all registered enclaves", () => {
      engine.registerEnclave("e1");
      engine.registerEnclave("e2");
      const all = engine.getAllEnclaves();
      expect(all.length).toBe(2);
    });
  });

  describe("getMigrationLog", () => {
    test("returns migration log entries", () => {
      engine.registerEnclave("e1");
      engine.planMigration("e1");
      const log = engine.getMigrationLog();
      expect(log.length).toBe(1);
      expect(log[0].event).toBe("MIGRATION_PLANNED");
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      engine.registerEnclave("e1");
      engine.registerEnclave("e2");
      engine.planMigration("e1");
      engine.activateHybrid("e1");
      const stats = engine.getStats();
      expect(stats.enclaveCount).toBe(2);
      expect(stats.classicalCount).toBe(1); // e2
      expect(stats.hybridCount).toBe(1); // e1
      expect(stats.byPhase[MIGRATION_PHASE.HYBRID_ACTIVE]).toBe(1);
    });
  });

  describe("unregisterEnclave", () => {
    test("removes an enclave", () => {
      engine.registerEnclave("e1");
      engine.unregisterEnclave("e1");
      expect(engine.getMigrationState("e1")).toBeNull();
      expect(engine.getSignatureConstraint("e1")).toBeNull();
    });

    test("rejects unknown enclave", () => {
      expect(() => engine.unregisterEnclave("unknown")).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      engine.registerEnclave("e1");
      engine.registerEnclave("e2");
      engine.reset();
      expect(engine.getAllEnclaves().length).toBe(0);
      expect(engine.getMigrationLog().length).toBe(0);
    });
  });

  describe("no-hybrid-transition mode", () => {
    test("allows direct PQC activation without hybrid", () => {
      const noHybrid = new PqcEnclaveMigrationEngine({
        requireHybridTransition: false,
        requireAttestation: false,
      });
      noHybrid.registerEnclave("e1");
      noHybrid.planMigration("e1");
      const result = noHybrid.activatePqc("e1");
      expect(result.phase).toBe(MIGRATION_PHASE.PQC_ACTIVE);
      noHybrid.reset();
    });

    test("plan shows shorter phases without hybrid", () => {
      const noHybrid = new PqcEnclaveMigrationEngine({
        requireHybridTransition: false,
      });
      noHybrid.registerEnclave("e1");
      const plan = noHybrid.planMigration("e1");
      expect(plan.phases).not.toContain("hybrid-active");
      noHybrid.reset();
    });
  });

  describe("full migration flow", () => {
    test("complete classical -> hybrid -> PQC -> completed flow", () => {
      engine.registerEnclave("e1", {
        currentAlgorithm: "ECDH-P384",
        targetPqcAlgorithm: "ML-KEM-1024",
        targetDsaAlgorithm: "ML-DSA-87",
      });
      // Phase 1: Plan
      engine.planMigration("e1");
      // Phase 2: Hybrid
      engine.activateHybrid("e1", "attestation");
      // Satisfy signature constraint
      engine.satisfySignatureConstraint("e1", {
        algorithm: "ML-DSA-87",
        signature: "x".repeat(128),
      });
      // Phase 3: PQC (after hybrid period)
      return new Promise((resolve) => setTimeout(resolve, 150)).then(() => {
        const pqcResult = engine.activatePqc("e1");
        expect(pqcResult.algorithm).toBe("ML-KEM-1024");
        // Phase 4: Complete
        const completeResult = engine.completeMigration("e1");
        expect(completeResult.phase).toBe(MIGRATION_PHASE.COMPLETED);
        const state = engine.getMigrationState("e1");
        expect(state.phase).toBe(MIGRATION_PHASE.COMPLETED);
      });
    });
  });
});
