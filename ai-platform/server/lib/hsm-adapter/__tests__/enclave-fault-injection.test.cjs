"use strict";

/**
 * Track 48: Enclave Fault Injection and Byzantine Chaos Testing tests.
 */
const {
  EnclaveFaultInjection,
  DEFAULT_OPTIONS,
  FAULT_TYPE,
  FAULT_STATUS,
  SCENARIO_STATUS,
} = require("../enclave-fault-injection.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");

describe("Track 48: EnclaveFaultInjection", () => {
  let engine;

  beforeEach(() => {
    engine = new EnclaveFaultInjection({
      maxConcurrentFaults: 10,
      defaultFaultDurationMs: 1000,
      chaosProbability: 0.5,
      deterministicSeed: 42,
    });
  });

  describe("injectFault", () => {
    test("injects a byzantine equivocation fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.BYZANTINE_EQUIVOCATION,
        targetEnclaveId: "e1",
      });
      expect(result.faultId).toBeDefined();
      expect(result.faultType).toBe(FAULT_TYPE.BYZANTINE_EQUIVOCATION);
      expect(result.targetEnclaveId).toBe("e1");
      expect(result.status).toBe(FAULT_STATUS.ACTIVE);
      expect(result.effects).toContain("conflicting-responses");
    });

    test("injects a network partition fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.NETWORK_PARTITION,
        targetEnclaveId: "e1",
      });
      expect(result.faultType).toBe(FAULT_TYPE.NETWORK_PARTITION);
      expect(result.effects).toContain("isolation");
    });

    test("injects an enclave crash fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      expect(result.faultType).toBe(FAULT_TYPE.ENCLAVE_CRASH);
      expect(result.effects).toContain("process-termination");
    });

    test("injects a key corruption fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.KEY_CORRUPTION,
        targetEnclaveId: "e1",
      });
      expect(result.faultType).toBe(FAULT_TYPE.KEY_CORRUPTION);
      expect(result.effects).toContain("key-material-altered");
    });

    test("injects a timing attack fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.TIMING_ATTACK,
        targetEnclaveId: "e1",
      });
      expect(result.faultType).toBe(FAULT_TYPE.TIMING_ATTACK);
      expect(result.effects).toContain("timing-leak");
    });

    test("injects a heartbeat loss fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.HEARTBEAT_LOSS,
        targetEnclaveId: "e1",
      });
      expect(result.faultType).toBe(FAULT_TYPE.HEARTBEAT_LOSS);
      expect(result.effects).toContain("heartbeat-timeout");
    });

    test("injects a state divergence fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.STATE_DIVERGENCE,
        targetEnclaveId: "e1",
      });
      expect(result.faultType).toBe(FAULT_TYPE.STATE_DIVERGENCE);
      expect(result.effects).toContain("inconsistent-state");
    });

    test("rejects invalid config", () => {
      expect(() => engine.injectFault(null)).toThrow(HsmAdapterError);
    });

    test("rejects invalid fault type", () => {
      expect(() =>
        engine.injectFault({
          faultType: "invalid-type",
          targetEnclaveId: "e1",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects empty target enclave ID", () => {
      expect(() =>
        engine.injectFault({
          faultType: FAULT_TYPE.ENCLAVE_CRASH,
          targetEnclaveId: "",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("enforces max concurrent faults", () => {
      const small = new EnclaveFaultInjection({ maxConcurrentFaults: 2 });
      small.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      small.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e2",
      });
      expect(() =>
        small.injectFault({
          faultType: FAULT_TYPE.ENCLAVE_CRASH,
          targetEnclaveId: "e3",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("rejects disabled fault type", () => {
      const restricted = new EnclaveFaultInjection({
        enableCrashFaults: false,
      });
      expect(() =>
        restricted.injectFault({
          faultType: FAULT_TYPE.ENCLAVE_CRASH,
          targetEnclaveId: "e1",
        }),
      ).toThrow(HsmAdapterError);
    });

    test("respects max fault duration", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
        durationMs: 999999,
      });
      const fault = engine.getFault(result.faultId);
      expect(fault.durationMs).toBeLessThanOrEqual(60000);
    });
  });

  describe("cancelFault", () => {
    test("cancels an active fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      const cancelResult = engine.cancelFault(result.faultId);
      expect(cancelResult.cancelled).toBe(true);
      expect(engine.getFault(result.faultId).status).toBe(
        FAULT_STATUS.CANCELLED,
      );
    });

    test("rejects unknown fault ID", () => {
      expect(() => engine.cancelFault("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("resolveFault", () => {
    test("resolves an active fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      const resolveResult = engine.resolveFault(result.faultId);
      expect(resolveResult.resolved).toBe(true);
      expect(engine.getFault(result.faultId).status).toBe(
        FAULT_STATUS.RESOLVED,
      );
    });

    test("rejects unknown fault ID", () => {
      expect(() => engine.resolveFault("unknown")).toThrow(HsmAdapterError);
    });
  });

  describe("checkExpiredFaults", () => {
    test("expires faults past their duration", () => {
      const fast = new EnclaveFaultInjection({ defaultFaultDurationMs: 50 });
      fast.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      return new Promise((resolve) => setTimeout(resolve, 100)).then(() => {
        const expired = fast.checkExpiredFaults();
        expect(expired.length).toBe(1);
      });
    });

    test("does not expire active faults", () => {
      engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
        durationMs: 5000,
      });
      const expired = engine.checkExpiredFaults();
      expect(expired.length).toBe(0);
    });
  });

  describe("chaosStep", () => {
    test("injects faults randomly based on probability", () => {
      const highProb = new EnclaveFaultInjection({
        chaosProbability: 1.0, // always inject
        deterministicSeed: 123,
      });
      const injected = highProb.chaosStep(["e1", "e2", "e3"]);
      expect(injected.length).toBeGreaterThan(0);
    });

    test("returns empty when probability is 0", () => {
      const noChaos = new EnclaveFaultInjection({ chaosProbability: 0 });
      const injected = noChaos.chaosStep(["e1", "e2"]);
      expect(injected.length).toBe(0);
    });

    test("returns empty for empty targets", () => {
      const injected = engine.chaosStep([]);
      expect(injected.length).toBe(0);
    });

    test("deterministic mode produces reproducible results", () => {
      const seed1 = new EnclaveFaultInjection({
        chaosProbability: 1.0,
        deterministicSeed: 99,
      });
      const seed2 = new EnclaveFaultInjection({
        chaosProbability: 1.0,
        deterministicSeed: 99,
      });
      const r1 = seed1.chaosStep(["e1", "e2", "e3"]);
      const r2 = seed2.chaosStep(["e1", "e2", "e3"]);
      expect(r1.length).toBe(r2.length);
      for (let i = 0; i < r1.length; i++) {
        expect(r1[i].faultType).toBe(r2[i].faultType);
        expect(r1[i].targetEnclaveId).toBe(r2[i].targetEnclaveId);
      }
    });
  });

  describe("runScenario", () => {
    test("runs a multi-step scenario", () => {
      const result = engine.runScenario({
        name: "byzantine-cluster-test",
        steps: [
          {
            faultType: FAULT_TYPE.BYZANTINE_EQUIVOCATION,
            targetEnclaveId: "e1",
          },
          { faultType: FAULT_TYPE.NETWORK_PARTITION, targetEnclaveId: "e2" },
          { faultType: FAULT_TYPE.HEARTBEAT_LOSS, targetEnclaveId: "e3" },
        ],
      });
      expect(result.status).toBe(SCENARIO_STATUS.COMPLETED);
      expect(result.completedSteps).toBe(3);
      expect(result.injectedFaults.length).toBe(3);
      expect(result.errors.length).toBe(0);
    });

    test("records errors for invalid steps", () => {
      const result = engine.runScenario({
        name: "mixed-scenario",
        steps: [
          { faultType: FAULT_TYPE.ENCLAVE_CRASH, targetEnclaveId: "e1" },
          { faultType: "invalid-type", targetEnclaveId: "e2" },
        ],
      });
      expect(result.status).toBe(SCENARIO_STATUS.FAILED);
      expect(result.completedSteps).toBe(1);
      expect(result.errors.length).toBe(1);
    });

    test("rejects invalid scenario", () => {
      expect(() => engine.runScenario(null)).toThrow(HsmAdapterError);
      expect(() => engine.runScenario({ name: "test" })).toThrow(
        HsmAdapterError,
      );
    });
  });

  describe("validateRecovery", () => {
    test("returns recovered when no active faults", () => {
      const result = engine.validateRecovery();
      expect(result.recovered).toBe(true);
      expect(result.activeFaults).toBe(0);
    });

    test("returns not recovered when faults are active", () => {
      engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      const result = engine.validateRecovery();
      expect(result.recovered).toBe(false);
      expect(result.activeFaults).toBe(1);
    });

    test("counts resolved and expired faults", () => {
      const r1 = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      const r2 = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e2",
      });
      engine.resolveFault(r1.faultId);
      engine.cancelFault(r2.faultId);
      const result = engine.validateRecovery();
      expect(result.resolvedFaults).toBe(1);
      expect(result.cancelledFaults).toBe(1);
    });
  });

  describe("getFault", () => {
    test("returns active fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      const fault = engine.getFault(result.faultId);
      expect(fault).not.toBeNull();
      expect(fault.faultId).toBe(result.faultId);
    });

    test("returns historical fault", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      engine.resolveFault(result.faultId);
      const fault = engine.getFault(result.faultId);
      expect(fault).not.toBeNull();
      expect(fault.status).toBe(FAULT_STATUS.RESOLVED);
    });

    test("returns null for unknown fault", () => {
      expect(engine.getFault("unknown")).toBeNull();
    });
  });

  describe("getActiveFaults", () => {
    test("returns all active faults", () => {
      engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      engine.injectFault({
        faultType: FAULT_TYPE.NETWORK_PARTITION,
        targetEnclaveId: "e2",
      });
      const active = engine.getActiveFaults();
      expect(active.length).toBe(2);
    });
  });

  describe("getFaultHistory", () => {
    test("returns fault history", () => {
      const r1 = engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      engine.resolveFault(r1.faultId);
      const history = engine.getFaultHistory();
      expect(history.length).toBe(1);
      expect(history[0].status).toBe(FAULT_STATUS.RESOLVED);
    });
  });

  describe("getScenario", () => {
    test("returns scenario by ID", () => {
      const result = engine.runScenario({
        name: "test-scenario",
        steps: [{ faultType: FAULT_TYPE.ENCLAVE_CRASH, targetEnclaveId: "e1" }],
      });
      const scenario = engine.getScenario(result.scenarioId);
      expect(scenario).not.toBeNull();
      expect(scenario.name).toBe("test-scenario");
    });

    test("returns null for unknown scenario", () => {
      expect(engine.getScenario("unknown")).toBeNull();
    });
  });

  describe("getStats", () => {
    test("returns summary statistics", () => {
      engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      engine.injectFault({
        faultType: FAULT_TYPE.BYZANTINE_EQUIVOCATION,
        targetEnclaveId: "e2",
      });
      const stats = engine.getStats();
      expect(stats.activeFaults).toBe(2);
      expect(stats.byType[FAULT_TYPE.ENCLAVE_CRASH]).toBe(1);
      expect(stats.byType[FAULT_TYPE.BYZANTINE_EQUIVOCATION]).toBe(1);
      expect(stats.deterministicMode).toBe(true);
    });
  });

  describe("reset", () => {
    test("clears all state", () => {
      engine.injectFault({
        faultType: FAULT_TYPE.ENCLAVE_CRASH,
        targetEnclaveId: "e1",
      });
      engine.reset();
      expect(engine.getActiveFaults().length).toBe(0);
      expect(engine.getFaultHistory().length).toBe(0);
    });
  });

  describe("recovery actions", () => {
    test("byzantine fault has recovery actions", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.BYZANTINE_EQUIVOCATION,
        targetEnclaveId: "e1",
      });
      const fault = engine.getFault(result.faultId);
      expect(fault.recoveryActions).toContain("quarantine-node");
    });

    test("key corruption has rotate-key recovery", () => {
      const result = engine.injectFault({
        faultType: FAULT_TYPE.KEY_CORRUPTION,
        targetEnclaveId: "e1",
      });
      const fault = engine.getFault(result.faultId);
      expect(fault.recoveryActions).toContain("rotate-key");
    });
  });
});
