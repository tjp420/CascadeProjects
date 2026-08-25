"use strict";

/**
 * Tests for the canary metric simulator.
 *
 * Verifies that mock telemetry generators produce the expected metric
 * shapes, that rollback decisions match expectations across all canary
 * stages, and that the stage progression and deprecation checks converge
 * correctly.
 */

const path = require("path");
const {
  healthyMetrics,
  connectionDropSpike,
  handshakeFailure,
  downgradeSpike,
  heartbeatTimeout,
  noisyNode,
  cascadingFailure,
  runScenario,
  runStageProgression,
  runDeprecationCheck,
  SCENARIOS,
} = require("../../../scripts/canary-metric-simulator.cjs");

const { loadCanaryConfig } = require("../quantum-hybrid-rollout.cjs");

const CONFIG_PATH = path.join(
  __dirname,
  "..",
  "..",
  "config",
  "quantum-hybrid-canary.json",
);

describe("canary-metric-simulator", () => {
  const config = loadCanaryConfig(CONFIG_PATH);

  describe("mock metric generators", () => {
    test("healthyMetrics produces within-threshold values", () => {
      const m = healthyMetrics(25);
      expect(m.connectionDropRatePct).toBe(1.0);
      expect(m.handshakeFailureRatePct).toBe(2.0);
      expect(m.downgradeRejectedRatePct).toBe(0.5);
      expect(m.heartbeatTimeoutRatePct).toBe(m.baselineHeartbeatTimeoutRatePct);
      expect(m.perNodeHandshakeFailurePct).toEqual({});
    });

    test("connectionDropSpike produces a >5% delta", () => {
      const m = connectionDropSpike(50);
      const delta = m.connectionDropRatePct - m.baselineConnectionDropRatePct;
      expect(delta).toBeGreaterThan(5.0);
    });

    test("handshakeFailure produces >10% failure rate", () => {
      const m = handshakeFailure(25);
      expect(m.handshakeFailureRatePct).toBeGreaterThan(10.0);
    });

    test("downgradeSpike produces >5% rejection rate", () => {
      const m = downgradeSpike(25);
      expect(m.downgradeRejectedRatePct).toBeGreaterThan(5.0);
    });

    test("heartbeatTimeout produces >2x multiplier", () => {
      const m = heartbeatTimeout(25);
      const multiplier =
        m.heartbeatTimeoutRatePct / m.baselineHeartbeatTimeoutRatePct;
      expect(multiplier).toBeGreaterThan(2.0);
    });

    test("noisyNode produces a single node >50% failure", () => {
      const m = noisyNode(25);
      const rates = Object.values(m.perNodeHandshakeFailurePct);
      expect(Math.max(...rates)).toBeGreaterThan(50.0);
    });

    test("cascadingFailure breaches multiple thresholds", () => {
      const m = cascadingFailure(50);
      const delta = m.connectionDropRatePct - m.baselineConnectionDropRatePct;
      expect(delta).toBeGreaterThan(5.0);
      expect(m.handshakeFailureRatePct).toBeGreaterThan(10.0);
      expect(m.downgradeRejectedRatePct).toBeGreaterThan(5.0);
      const multiplier =
        m.heartbeatTimeoutRatePct / m.baselineHeartbeatTimeoutRatePct;
      expect(multiplier).toBeGreaterThan(2.0);
      const maxNodeRate = Math.max(
        ...Object.values(m.perNodeHandshakeFailurePct),
      );
      expect(maxNodeRate).toBeGreaterThan(50.0);
    });
  });

  describe("scenario runner — rollback decisions", () => {
    test("healthy scenario: no rollback at any stage", () => {
      const result = runScenario("healthy", config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.decision.shouldRollback).toBe(false);
        expect(r.decision.reasons).toHaveLength(0);
      }
    });

    test("connection scenario: rollback at all stages", () => {
      const result = runScenario("connection", config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.decision.shouldRollback).toBe(true);
        expect(r.decision.reasons.length).toBeGreaterThanOrEqual(1);
        expect(r.decision.reasons[0]).toMatch(/connection_drop_spike/);
      }
    });

    test("handshake scenario: rollback at all stages", () => {
      const result = runScenario("handshake", config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.decision.shouldRollback).toBe(true);
        expect(r.decision.reasons[0]).toMatch(/handshake_failure_rate/);
      }
    });

    test("downgrade scenario: rollback at all stages", () => {
      const result = runScenario("downgrade", config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.decision.shouldRollback).toBe(true);
        expect(r.decision.reasons[0]).toMatch(/downgrade_rejected_rate/);
      }
    });

    test("heartbeat scenario: rollback at all stages", () => {
      const result = runScenario("heartbeat", config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.decision.shouldRollback).toBe(true);
        expect(r.decision.reasons[0]).toMatch(/heartbeat_timeout_multiplier/);
      }
    });

    test("noisy-node scenario: rollback at all stages", () => {
      const result = runScenario("noisy-node", config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.decision.shouldRollback).toBe(true);
        expect(r.decision.reasons[0]).toMatch(/single_node_failure/);
      }
    });

    test("cascading scenario: rollback with 5 reasons at all stages", () => {
      const result = runScenario("cascading", config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.decision.shouldRollback).toBe(true);
        expect(r.decision.reasons.length).toBe(5);
      }
    });

    test("unknown scenario returns error", () => {
      const result = runScenario("nonexistent", config);
      expect(result.error).toBeDefined();
      expect(result.error).toMatch(/Unknown scenario/);
    });
  });

  describe("stage progression — deterministic enrollment", () => {
    test("all stages pass with deterministic enrollment", () => {
      const result = runStageProgression(config);
      expect(result.allPassed).toBe(true);
      for (const r of result.results) {
        expect(r.deterministic).toBe(true);
        expect(r.passed).toBe(true);
      }
    });

    test("0% stage enrolls zero nodes", () => {
      const result = runStageProgression(config);
      const stage0 = result.results.find((r) => r.stage === 0);
      expect(stage0.enrolledCount).toBe(0);
    });

    test("100% stage enrolls all nodes", () => {
      const result = runStageProgression(config);
      const stage100 = result.results.find((r) => r.stage === 100);
      expect(stage100.enrolledCount).toBe(1000);
    });
  });

  describe("deprecation window", () => {
    test("deprecation active within 14 days", () => {
      const result = runDeprecationCheck(config);
      expect(result.allPassed).toBe(true);
      const day7 = result.results.find((r) => r.label === "day-7");
      expect(day7.deprecationActive).toBe(true);
    });

    test("deprecation expired after 14 days", () => {
      const result = runDeprecationCheck(config);
      const day15 = result.results.find((r) => r.label === "day-15");
      expect(day15.deprecationActive).toBe(false);
    });

    test("boundary: day-14 is expired (strict less-than)", () => {
      const result = runDeprecationCheck(config);
      const day14 = result.results.find((r) => r.label === "day-14");
      expect(day14.deprecationActive).toBe(false);
    });
  });
});
