"use strict";

const crypto = require("crypto");
const {
  ThresholdAccountRecoveryEngine,
  GuardianRegistry,
  RECOVERY_STATE,
  VALID_TRANSITIONS,
} = require("../threshold-account-recovery-engine.cjs");
const { HsmAdapterError } = require("../base-adapter.cjs");
const hsmMetrics = require("../hsm-metrics.cjs");

describe("ThresholdAccountRecoveryEngine — Track 39 Threshold Account Recovery", () => {
  beforeEach(() => {
    hsmMetrics.reset();
  });

  const GUARDIANS = ["g-1", "g-2", "g-3", "g-4", "g-5"];
  const THRESHOLD = 3;

  function _genShare() {
    return crypto.randomBytes(32).toString("hex");
  }

  function _setupAccount(
    engine,
    accountId = "acct-1",
    guardians = GUARDIANS,
    threshold = THRESHOLD,
  ) {
    engine.registerAccount(accountId, guardians, threshold);
    for (const g of guardians) {
      engine.storeRecoveryShare(accountId, g, _genShare());
    }
  }

  // ── L2.01: Full happy-path ──
  describe("L2.01: happy-path account recovery lifecycle", () => {
    test("register → request → approve (quorum) → execute → restore", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      expect(req.state).toBe(RECOVERY_STATE.REQUESTED);
      expect(req.requestId).toBeDefined();

      // Guardians approve
      const a1 = engine.approveRecovery(req.requestId, "g-1", req.nonce);
      expect(a1.quorumReached).toBe(false);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      const a3 = engine.approveRecovery(req.requestId, "g-3", req.nonce);
      expect(a3.quorumReached).toBe(true);

      // Execute (time-lock is 0)
      const result = engine.executeRecovery(req.requestId);
      expect(result.state).toBe(RECOVERY_STATE.RESTORED);
      expect(result.sharesCollected).toBe(3);
    });
  });

  // ── L2.02: GuardianRegistry ──
  describe("L2.02: GuardianRegistry per-account tracking", () => {
    test("registers account with guardians and threshold", () => {
      const registry = new GuardianRegistry();
      registry.registerAccount("acct-1", GUARDIANS, THRESHOLD);
      const account = registry.getAccount("acct-1");
      expect(account.guardians).toEqual(GUARDIANS);
      expect(account.threshold).toBe(THRESHOLD);
      expect(account.guardianCount).toBe(5);
    });

    test("isGuardian checks designation", () => {
      const registry = new GuardianRegistry();
      registry.registerAccount("acct-1", GUARDIANS, THRESHOLD);
      expect(registry.isGuardian("acct-1", "g-1")).toBe(true);
      expect(registry.isGuardian("acct-1", "g-unknown")).toBe(false);
    });

    test("storeShare and getShare", () => {
      const registry = new GuardianRegistry();
      registry.registerAccount("acct-1", GUARDIANS, THRESHOLD);
      const share = _genShare();
      registry.storeShare("acct-1", "g-1", share);
      expect(registry.getShare("acct-1", "g-1")).toBe(share);
      expect(registry.getShare("acct-1", "g-2")).toBeNull();
    });

    test("storeShare throws for unknown guardian", () => {
      const registry = new GuardianRegistry();
      registry.registerAccount("acct-1", GUARDIANS, THRESHOLD);
      expect(() =>
        registry.storeShare("acct-1", "unknown", _genShare()),
      ).toThrow(HsmAdapterError);
    });
  });

  // ── L2.03: BFT quorum approvals ──
  describe("L2.03: BFT quorum approvals", () => {
    test("execution fails without quorum", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      // Only 2 approvals, need 3
      expect(() => engine.executeRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      );
    });

    test("quorum exactly at threshold succeeds", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine, "acct-1", GUARDIANS, 4);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      engine.approveRecovery(req.requestId, "g-3", req.nonce);
      expect(() => engine.executeRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      ); // 3 < 4

      engine.approveRecovery(req.requestId, "g-4", req.nonce);
      const result = engine.executeRecovery(req.requestId);
      expect(result.state).toBe(RECOVERY_STATE.RESTORED);
    });
  });

  // ── L2.04: Multiple accounts tracked independently ──
  describe("L2.04: multiple accounts independent", () => {
    test("two accounts can have separate recoveries", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine, "acct-1");
      _setupAccount(engine, "acct-2");

      const req1 = engine.initiateRecovery("acct-1");
      const req2 = engine.initiateRecovery("acct-2");

      expect(req1.requestId).not.toBe(req2.requestId);

      // Approve acct-1 only
      engine.approveRecovery(req1.requestId, "g-1", req1.nonce);
      engine.approveRecovery(req1.requestId, "g-2", req1.nonce);
      engine.approveRecovery(req1.requestId, "g-3", req1.nonce);
      const r1 = engine.executeRecovery(req1.requestId);
      expect(r1.state).toBe(RECOVERY_STATE.RESTORED);

      // acct-2 should still be in REQUESTED state
      expect(engine.getRecoveryState(req2.requestId).state).toBe(
        RECOVERY_STATE.REQUESTED,
      );
    });
  });

  // ── L2.05: State machine ──
  describe("L2.05: state machine transitions", () => {
    test("cannot approve without request", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);
      expect(() => engine.approveRecovery("unknown", "g-1", "nonce")).toThrow(
        HsmAdapterError,
      );
    });

    test("cannot execute without approvals", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);
      const req = engine.initiateRecovery("acct-1");
      expect(() => engine.executeRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      );
    });

    test("restored state is terminal", () => {
      expect(VALID_TRANSITIONS[RECOVERY_STATE.RESTORED]).toEqual([]);
    });

    test("rejected state is terminal", () => {
      expect(VALID_TRANSITIONS[RECOVERY_STATE.REJECTED]).toEqual([]);
    });
  });

  // ── L2.06: Policy validation ──
  describe("L2.06: policy validation", () => {
    test("CryptoPolicyEngine includes thresholdAccountRecovery block", () => {
      const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
      const engine = new CryptoPolicyEngine();
      const policy = engine.getPolicy("default");
      expect(policy.thresholdAccountRecovery).toBeDefined();
      expect(policy.thresholdAccountRecovery.minGuardians).toBe(3);
      expect(policy.thresholdAccountRecovery.requireQuorumApproval).toBe(true);
      expect(policy.thresholdAccountRecovery.requireAntiReplay).toBe(true);
    });

    test("tenant policy can override thresholdAccountRecovery settings", () => {
      const { CryptoPolicyEngine } = require("../crypto-policy-engine.cjs");
      const engine = new CryptoPolicyEngine({
        default: true,
        tenants: {
          "tenant-a": { thresholdAccountRecovery: { minGuardians: 5 } },
        },
      });
      const policy = engine.getPolicy("tenant-a");
      expect(policy.thresholdAccountRecovery.minGuardians).toBe(5);
    });
  });

  // ── L2.07: Time-lock ──
  describe("L2.07: time-lock enforcement", () => {
    test("execution blocked before time-lock expires", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 100000,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      engine.approveRecovery(req.requestId, "g-3", req.nonce);

      // Time-lock should block
      expect(() => engine.executeRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      );
      const state = engine.getRecoveryState(req.requestId);
      expect(state.timeLockExpired).toBe(false);
    });

    test("execution succeeds after time-lock expires", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      engine.approveRecovery(req.requestId, "g-3", req.nonce);

      const result = engine.executeRecovery(req.requestId);
      expect(result.state).toBe(RECOVERY_STATE.RESTORED);
    });

    test("per-request time-lock override", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 100000,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1", 0); // override to 0
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      engine.approveRecovery(req.requestId, "g-3", req.nonce);

      const result = engine.executeRecovery(req.requestId);
      expect(result.state).toBe(RECOVERY_STATE.RESTORED);
    });
  });

  // ── L2.08: Guardian management ──
  describe("L2.08: guardian management", () => {
    test("add guardian with quorum approval", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const registry = engine.getRegistry();
      const approvers = ["g-1", "g-2", "g-3"]; // quorum of 3
      registry.addGuardian("acct-1", "g-6", approvers);
      expect(registry.isGuardian("acct-1", "g-6")).toBe(true);
    });

    test("add guardian fails without quorum", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const registry = engine.getRegistry();
      expect(() => registry.addGuardian("acct-1", "g-6", ["g-1"])).toThrow(
        HsmAdapterError,
      );
    });

    test("remove guardian with quorum approval", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const registry = engine.getRegistry();
      const approvers = ["g-1", "g-2", "g-3"];
      registry.removeGuardian("acct-1", "g-5", approvers);
      expect(registry.isGuardian("acct-1", "g-5")).toBe(false);
    });

    test("remove guardian blocked when it would break quorum", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine, "acct-1", ["g-1", "g-2", "g-3"], 3);

      const registry = engine.getRegistry();
      const approvers = ["g-1", "g-2", "g-3"];
      expect(() => registry.removeGuardian("acct-1", "g-3", approvers)).toThrow(
        HsmAdapterError,
      );
    });
  });

  // ── L3.01: Anti-replay ──
  describe("L3.01: anti-replay protection", () => {
    test("wrong nonce rejected", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      expect(() =>
        engine.approveRecovery(req.requestId, "g-1", "wrong-nonce"),
      ).toThrow(HsmAdapterError);
    });

    test("cannot initiate duplicate recovery for same account", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      engine.initiateRecovery("acct-1");
      expect(() => engine.initiateRecovery("acct-1")).toThrow(HsmAdapterError);
    });
  });

  // ── L3.02: Cannot recover without quorum ──
  describe("L3.02: cannot recover without quorum", () => {
    test("insufficient approvals blocks execution", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      expect(() => engine.executeRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      );
    });
  });

  // ── L3.03: Cannot approve after restored ──
  describe("L3.03: cannot approve after restored", () => {
    test("approval after restore rejected", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      engine.approveRecovery(req.requestId, "g-3", req.nonce);
      engine.executeRecovery(req.requestId);

      expect(() =>
        engine.approveRecovery(req.requestId, "g-4", req.nonce),
      ).toThrow(HsmAdapterError);
    });
  });

  // ── L3.04: Rejected is terminal ──
  describe("L3.04: rejected is terminal", () => {
    test("cannot reject already restored", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      engine.approveRecovery(req.requestId, "g-3", req.nonce);
      engine.executeRecovery(req.requestId);
      expect(() => engine.rejectRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      );
    });

    test("cannot reject already rejected", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.rejectRecovery(req.requestId, "test");
      expect(() => engine.rejectRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      );
    });

    test("rejected recovery cannot be executed", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      engine.approveRecovery(req.requestId, "g-2", req.nonce);
      engine.approveRecovery(req.requestId, "g-3", req.nonce);
      engine.rejectRecovery(req.requestId, "fraud");
      expect(() => engine.executeRecovery(req.requestId)).toThrow(
        HsmAdapterError,
      );
    });
  });

  // ── L3.05: Unauthorized guardian ──
  describe("L3.05: unauthorized guardian approval", () => {
    test("non-guardian approval rejected", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      expect(() =>
        engine.approveRecovery(req.requestId, "unknown", req.nonce),
      ).toThrow(HsmAdapterError);
    });

    test("duplicate guardian approval rejected", () => {
      const engine = new ThresholdAccountRecoveryEngine({
        defaultTimeLockMs: 0,
      });
      _setupAccount(engine);

      const req = engine.initiateRecovery("acct-1");
      engine.approveRecovery(req.requestId, "g-1", req.nonce);
      expect(() =>
        engine.approveRecovery(req.requestId, "g-1", req.nonce),
      ).toThrow(HsmAdapterError);
    });
  });

  // ── Metrics ──
  describe("metrics counters", () => {
    test("hsm-metrics includes recovery counters", () => {
      const metrics = hsmMetrics.getMetrics();
      expect(metrics).toHaveProperty("hsm_recovery_requested_total", 0);
      expect(metrics).toHaveProperty("hsm_recovery_approved_total", 0);
      expect(metrics).toHaveProperty("hsm_recovery_executed_total", 0);
      expect(metrics).toHaveProperty("hsm_recovery_rejected_total", 0);
      expect(metrics).toHaveProperty("hsm_recovery_replay_blocked_total", 0);
      expect(metrics).toHaveProperty("hsm_recovery_time_lock_blocked_total", 0);
      expect(metrics).toHaveProperty("hsm_recovery_active", 0);
    });

    test("incrementCounter works for recovery counters", () => {
      hsmMetrics.incrementCounter("hsm_recovery_requested_total", 5);
      hsmMetrics.incrementCounter("hsm_recovery_executed_total", 3);
      const metrics = hsmMetrics.getMetrics();
      expect(metrics.hsm_recovery_requested_total).toBe(5);
      expect(metrics.hsm_recovery_executed_total).toBe(3);
    });

    test("Prometheus output includes recovery metrics", () => {
      hsmMetrics.incrementCounter("hsm_recovery_requested_total", 1);
      const output = hsmMetrics.renderPrometheus();
      expect(output).toContain("# HELP hsm_recovery_requested_total");
      expect(output).toContain("# TYPE hsm_recovery_requested_total counter");
      expect(output).toContain("hsm_recovery_requested_total 1");
    });
  });

  // ── Engine state telemetry ──
  describe("getEngineState telemetry", () => {
    test("returns correct initial state", () => {
      const engine = new ThresholdAccountRecoveryEngine();
      const state = engine.getEngineState();
      expect(state.registeredAccounts).toBe(0);
      expect(state.totalRecoveryRequests).toBe(0);
      expect(state.activeRecoveries).toBe(0);
    });

    test("tracks registered accounts", () => {
      const engine = new ThresholdAccountRecoveryEngine();
      _setupAccount(engine, "acct-1");
      _setupAccount(engine, "acct-2");
      expect(engine.getEngineState().registeredAccounts).toBe(2);
    });
  });

  // ── Error cases ──
  describe("error cases", () => {
    test("initiateRecovery throws for unregistered account", () => {
      const engine = new ThresholdAccountRecoveryEngine();
      expect(() => engine.initiateRecovery("unknown")).toThrow(HsmAdapterError);
    });

    test("getRecoveryState throws for unknown request", () => {
      const engine = new ThresholdAccountRecoveryEngine();
      expect(() => engine.getRecoveryState("unknown")).toThrow(HsmAdapterError);
    });

    test("registerAccount throws for empty guardians", () => {
      const engine = new ThresholdAccountRecoveryEngine();
      expect(() => engine.registerAccount("acct-1", [], 1)).toThrow(
        HsmAdapterError,
      );
    });

    test("registerAccount throws for threshold > guardians", () => {
      const engine = new ThresholdAccountRecoveryEngine();
      expect(() => engine.registerAccount("acct-1", ["g-1"], 2)).toThrow(
        HsmAdapterError,
      );
    });
  });
});
