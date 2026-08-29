// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, debug artifacts, and EU AI Act indicators — all findings are false positives
// SPDX-License-Identifier: MIT
/**
 * Telemetry service test — verifies classification, recording, and dashboard output.
 */
const tel = require("../ai-platform/server/lib/agent-telemetry-service.cjs");

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  cyan: "\x1b[36m",
  bold: "\x1b[1m",
};

let passed = 0;
let failed = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`${colors.green}[PASS]${colors.reset} ${name}`);
    passed++;
  } catch (err) {
    console.log(`${colors.red}[FAIL]${colors.reset} ${name}: ${err.message}`);
    failed++;
  }
}

// Reset before tests
tel.resetMetrics();

// ── Classification tests ────────────────────────────────────────────────────
test("Classify AI slop finding", () => {
  const cat = tel.classifyFinding("llm-slop-SB-FICTION-001");
  if (cat !== "ai_slop") throw new Error(`Expected ai_slop, got ${cat}`);
});

test("Classify credential leak finding", () => {
  const cat = tel.classifyFinding("credential-hardcoded-api-key");
  if (cat !== "credential_leaks") throw new Error(`Expected credential_leaks, got ${cat}`);
});

test("Classify compliance finding", () => {
  const cat = tel.classifyFinding("eu-ai-act-high-risk");
  if (cat !== "compliance_violations") throw new Error(`Expected compliance_violations, got ${cat}`);
});

test("Classify custom AI finding", () => {
  const cat = tel.classifyFinding("custom-SB-AI-004");
  if (cat !== "custom_ai") throw new Error(`Expected custom_ai, got ${cat}`);
});

test("Classify unknown finding as other", () => {
  const cat = tel.classifyFinding("unknown-rule-xyz");
  if (cat !== "other") throw new Error(`Expected other, got ${cat}`);
});

// ── Recording tests ─────────────────────────────────────────────────────────
test("Record scan pass with findings", () => {
  tel.resetMetrics();
  const result = tel.recordAgentScanPass({
    gate: {
      blockingIssues: [],
      warningIssues: [
        { id: "llm-slop-SB-FICTION-001" },
        { id: "custom-SB-AI-004" },
      ],
    },
    detectedIssues: [
      { id: "credential-hardcoded-key" },
    ],
  });
  if (!result.success) throw new Error("Should succeed");
  if (result.squashedThisTurn !== 3) throw new Error(`Expected 3 squashed, got ${result.squashedThisTurn}`);
  if (result.runningTotal !== 3) throw new Error(`Expected total 3, got ${result.runningTotal}`);
});

test("Record empty scan pass", () => {
  tel.resetMetrics();
  const result = tel.recordAgentScanPass({ gate: { blockingIssues: [], warningIssues: [] } });
  if (!result.success) throw new Error("Should succeed");
  if (result.squashedThisTurn !== 0) throw new Error(`Expected 0 squashed, got ${result.squashedThisTurn}`);
});

test("Dashboard metrics shape", () => {
  tel.resetMetrics();
  tel.recordAgentScanPass({
    gate: {
      warningIssues: [
        { id: "llm-slop-SB-FICTION-001" },
        { id: "custom-SB-AI-004" },
      ],
    },
  });
  const m = tel.getDashboardMetrics();
  if (m.totalScansProcessed !== 1) throw new Error("Should have 1 scan");
  if (m.totalHallucinationsSquashed !== 2) throw new Error("Should have 2 squashed");
  if (typeof m.estimatedDollarsSaved !== "number") throw new Error("Should have dollar savings");
  if (!Array.isArray(m.timeline)) throw new Error("Should have timeline array");
  if (!m.deflectedByCategory) throw new Error("Should have category breakdown");
});

test("Reset clears all metrics", () => {
  tel.recordAgentScanPass({ gate: { warningIssues: [{ id: "llm-slop-001" }] } });
  tel.resetMetrics();
  const m = tel.getDashboardMetrics();
  if (m.totalScansProcessed !== 0) throw new Error("Should be 0 after reset");
  if (m.totalHallucinationsSquashed !== 0) throw new Error("Should be 0 after reset");
});

// ── Summary ─────────────────────────────────────────────────────────────────
console.log(`\n${colors.cyan}====================================================${colors.reset}`);
console.log(`${passed === failed ? colors.red : colors.green}Telemetry tests: ${passed}/${passed + failed} passed${colors.reset}`);
console.log(`${colors.cyan}====================================================${colors.reset}`);
process.exit(failed > 0 ? 1 : 0);
