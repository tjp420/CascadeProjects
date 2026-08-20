#!/usr/bin/env node
"use strict";

/**
 * Canary Metric Simulator — Milestone 4
 *
 * Generates mock telemetry at each canary stage, injects controlled faults,
 * feeds them through `checkRollback()`, and verifies rollback decisions.
 *
 * Usage:
 *   node scripts/canary-metric-simulator.cjs                    # run all scenarios
 *   node scripts/canary-metric-simulator.cjs --scenario=healthy  # run one scenario
 *   node scripts/canary-metric-simulator.cjs --json              # machine-readable output
 *
 * Scenarios:
 *   healthy       — all metrics within thresholds, no rollback
 *   connection    — connection drop spike exceeds 5% delta
 *   handshake     — handshake failure rate exceeds 10%
 *   downgrade     — downgrade rejection rate exceeds 5%
 *   heartbeat     — heartbeat timeout multiplier exceeds 2x
 *   noisy-node    — single node exceeds 50% failure rate
 *   cascading     — multiple thresholds breached simultaneously
 *   stage-progression — simulate all 5 canary stages with healthy metrics
 *   deprecation   — verify deprecation window expiry behavior
 */

const path = require("path");
const {
  loadCanaryConfig,
  shouldEnableHybrid,
  checkRollback,
  resolveDeprecationState,
  enrollmentScore,
} = require("../server/lib/quantum-hybrid-rollout.cjs");

const CONFIG_PATH = path.join(
  __dirname,
  "..",
  "server",
  "config",
  "quantum-hybrid-canary.json",
);

// ── Mock metric generators ─────────────────────────────────────────────────

function healthyMetrics(stagePercent) {
  return {
    connectionDropRatePct: 1.0,
    baselineConnectionDropRatePct: 1.0,
    handshakeFailureRatePct: 2.0,
    downgradeRejectedRatePct: 0.5,
    heartbeatTimeoutRatePct: 0.3,
    baselineHeartbeatTimeoutRatePct: 0.3,
    perNodeHandshakeFailurePct: {},
    _stage: stagePercent,
  };
}

function connectionDropSpike(stagePercent) {
  return {
    ...healthyMetrics(stagePercent),
    connectionDropRatePct: 8.0,
    baselineConnectionDropRatePct: 1.5,
  };
}

function handshakeFailure(stagePercent) {
  return {
    ...healthyMetrics(stagePercent),
    handshakeFailureRatePct: 12.0,
  };
}

function downgradeSpike(stagePercent) {
  return {
    ...healthyMetrics(stagePercent),
    downgradeRejectedRatePct: 7.0,
  };
}

function heartbeatTimeout(stagePercent) {
  return {
    ...healthyMetrics(stagePercent),
    heartbeatTimeoutRatePct: 1.2,
    baselineHeartbeatTimeoutRatePct: 0.3,
  };
}

function noisyNode(stagePercent) {
  return {
    ...healthyMetrics(stagePercent),
    perNodeHandshakeFailurePct: {
      "node-canary-03": 75.0,
      "node-canary-07": 3.0,
    },
  };
}

function cascadingFailure(stagePercent) {
  return {
    connectionDropRatePct: 10.0,
    baselineConnectionDropRatePct: 2.0,
    handshakeFailureRatePct: 18.0,
    downgradeRejectedRatePct: 9.0,
    heartbeatTimeoutRatePct: 2.0,
    baselineHeartbeatTimeoutRatePct: 0.5,
    perNodeHandshakeFailurePct: {
      "node-canary-01": 60.0,
      "node-canary-02": 45.0,
    },
    _stage: stagePercent,
  };
}

// ── Scenario definitions ───────────────────────────────────────────────────

const SCENARIOS = {
  healthy: {
    generate: healthyMetrics,
    expectRollback: false,
    description: "All metrics within thresholds",
  },
  connection: {
    generate: connectionDropSpike,
    expectRollback: true,
    description: "Connection drop spike > 5% delta",
  },
  handshake: {
    generate: handshakeFailure,
    expectRollback: true,
    description: "Handshake failure rate > 10%",
  },
  downgrade: {
    generate: downgradeSpike,
    expectRollback: true,
    description: "Downgrade rejection rate > 5%",
  },
  heartbeat: {
    generate: heartbeatTimeout,
    expectRollback: true,
    description: "Heartbeat timeout multiplier > 2x",
  },
  "noisy-node": {
    generate: noisyNode,
    expectRollback: true,
    description: "Single node failure > 50%",
  },
  cascading: {
    generate: cascadingFailure,
    expectRollback: true,
    description: "Multiple thresholds breached",
  },
};

// ── Simulator runner ───────────────────────────────────────────────────────

function runScenario(name, config) {
  const scenario = SCENARIOS[name];
  if (!scenario) {
    return { name, error: `Unknown scenario: ${name}` };
  }

  const stages = config.canary_parameters.stages || [0, 5, 25, 50, 100];
  const results = [];

  for (const stagePercent of stages) {
    const metrics = scenario.generate(stagePercent);
    const decision = checkRollback(metrics, config);

    const passed = decision.shouldRollback === scenario.expectRollback;
    results.push({
      stage: stagePercent,
      metrics: {
        connectionDropRatePct: metrics.connectionDropRatePct,
        baselineConnectionDropRatePct: metrics.baselineConnectionDropRatePct,
        handshakeFailureRatePct: metrics.handshakeFailureRatePct,
        downgradeRejectedRatePct: metrics.downgradeRejectedRatePct,
        heartbeatTimeoutRatePct: metrics.heartbeatTimeoutRatePct,
        baselineHeartbeatTimeoutRatePct:
          metrics.baselineHeartbeatTimeoutRatePct,
        perNodeHandshakeFailurePct: metrics.perNodeHandshakeFailurePct,
      },
      decision,
      passed,
    });
  }

  const allPassed = results.every((r) => r.passed);
  return {
    name,
    description: scenario.description,
    expectRollback: scenario.expectRollback,
    results,
    allPassed,
  };
}

function runStageProgression(config) {
  const stages = config.canary_parameters.stages || [0, 5, 25, 50, 100];
  const salt = config.canary_parameters.salt || "simplebeacon:canary:v1";
  // Use 1000 nodes for tighter convergence to expected percentages.
  // With 100 nodes, variance at the 25% stage can exceed 5%.
  const NODE_COUNT = 1000;
  const nodeIds = Array.from(
    { length: NODE_COUNT },
    (_, i) => `node-${String(i).padStart(4, "0")}`,
  );

  const results = stages.map((stagePercent) => {
    const cfg = JSON.parse(JSON.stringify(config));
    cfg.canary_parameters.default_enabled = true;
    cfg.canary_parameters.stages = [stagePercent];

    const enrolled = nodeIds.filter((id) => shouldEnableHybrid(id, cfg));
    const enrollmentPct = (enrolled.length / nodeIds.length) * 100;

    // Verify deterministic enrollment
    const scores = nodeIds.map((id) => enrollmentScore(id, salt));
    const enrolledByScore = scores.filter((s) => s < stagePercent).length;
    const deterministic = enrolled.length === enrolledByScore;

    return {
      stage: stagePercent,
      enrolledCount: enrolled.length,
      enrollmentPct: parseFloat(enrollmentPct.toFixed(1)),
      expectedPct: stagePercent,
      deterministic,
      passed: deterministic && Math.abs(enrollmentPct - stagePercent) <= 3.0,
    };
  });

  const allPassed = results.every((r) => r.passed);
  return { name: "stage-progression", results, allPassed };
}

function runDeprecationCheck(config) {
  const windowDays = config.canary_parameters.deprecation_window_days || 14;
  const now = Date.now();
  const msPerDay = 24 * 60 * 60 * 1000;

  const cases = [
    { label: "day-0", offset: 0, expected: true },
    { label: "day-7", offset: 7 * msPerDay, expected: true },
    { label: "day-13", offset: 13 * msPerDay, expected: true },
    { label: "day-14", offset: 14 * msPerDay, expected: false },
    { label: "day-15", offset: 15 * msPerDay, expected: false },
    { label: "day-30", offset: 30 * msPerDay, expected: false },
  ];

  const results = cases.map((c) => {
    const active = resolveDeprecationState(now - c.offset, windowDays);
    return {
      label: c.label,
      offsetDays: c.offset / msPerDay,
      deprecationActive: active,
      expected: c.expected,
      passed: active === c.expected,
    };
  });

  const allPassed = results.every((r) => r.passed);
  return { name: "deprecation", results, allPassed };
}

// ── CLI entry point ────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const jsonMode = args.includes("--json");
  const scenarioArg = args.find((a) => a.startsWith("--scenario="));
  const requestedScenario = scenarioArg ? scenarioArg.split("=")[1] : null;

  const config = loadCanaryConfig(CONFIG_PATH);

  const scenarioNames = requestedScenario
    ? [requestedScenario]
    : [...Object.keys(SCENARIOS), "stage-progression", "deprecation"];

  const outputs = [];

  for (const name of scenarioNames) {
    let result;
    if (name === "stage-progression") {
      result = runStageProgression(config);
    } else if (name === "deprecation") {
      result = runDeprecationCheck(config);
    } else {
      result = runScenario(name, config);
    }
    outputs.push(result);
  }

  const totalPassed = outputs.filter((o) => o.allPassed).length;
  const totalScenarios = outputs.length;
  const overallPass = totalPassed === totalScenarios;

  if (jsonMode) {
    console.log(
      JSON.stringify(
        {
          totalScenarios,
          totalPassed,
          overallPass,
          scenarios: outputs,
        },
        null,
        2,
      ),
    );
  } else {
    console.log("=== Canary Metric Simulator ===");
    console.log();
    for (const out of outputs) {
      const status = out.allPassed ? "PASS" : "FAIL";
      const desc = out.description || out.name;
      console.log(`[${status}] ${out.name}: ${desc}`);
      if (out.results) {
        for (const r of out.results) {
          const subStatus = r.passed ? "ok" : "FAIL";
          if (r.stage !== undefined) {
            console.log(
              `       stage ${r.stage}% → ${subStatus} (rollback=${r.decision?.shouldRollback}, reasons=${r.decision?.reasons?.length || 0})`,
            );
          } else if (r.label) {
            console.log(
              `       ${r.label}: deprecationActive=${r.deprecationActive} → ${subStatus}`,
            );
          } else if (r.enrolledCount !== undefined) {
            console.log(
              `       stage ${r.stage}%: enrolled=${r.enrolledCount}/1000 (${r.enrollmentPct}%) → ${subStatus}`,
            );
          }
        }
      }
      console.log();
    }
    console.log(`=== ${totalPassed}/${totalScenarios} scenarios passed ===`);
    console.log(`Overall: ${overallPass ? "PASS" : "FAIL"}`);
  }

  process.exit(overallPass ? 0 : 1);
}

if (require.main === module) {
  main();
}

module.exports = {
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
};
