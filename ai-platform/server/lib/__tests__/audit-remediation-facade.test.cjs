// simplebeacon-ignore: debugArtifacts
"use strict";

jest.mock("../simplebeacon-proxy.cjs", () => ({
  collectIssues: jest.fn().mockReturnValue([]),
}));

const recipes = require("../audit-remediation-recipes.cjs");

describe("audit-remediation-recipes facade", () => {
  test("re-exports submodule helpers and orchestrators", () => {
    expect(typeof recipes.classifyRowKind).toBe("function");
    expect(typeof recipes.buildFixSpec).toBe("function");
    expect(typeof recipes.buildSortedRemediationRows).toBe("function");
    expect(typeof recipes.buildRemediationRowsFromScan).toBe("function");
    expect(typeof recipes.buildFixPlanFromScan).toBe("function");
    expect(recipes.FIX_SPEC_VERSION).toBe(1);
    expect(recipes.IMPACT_BY_KIND).toBeDefined();
    expect(recipes.DEFAULT_RECIPES).toBeDefined();
  });

  test("buildFixSpec produces structured fix metadata for a gate finding", () => {
    const fixSpec = recipes.buildFixSpec(
      {
        severity: "high",
        location: "src/auth.js:12",
        rule: "console_or_debugger",
        snippet: 'console.log("debug")',
      },
      { projectPath: "/project" },
    );

    expect(fixSpec.version).toBe(1);
    expect(fixSpec.kind).toBe("debug-artifact");
    expect(fixSpec.severity).toBe("high");
    expect(Array.isArray(fixSpec.changes)).toBe(true);
    expect(fixSpec.changes.length).toBeGreaterThan(0);
    expect(Array.isArray(fixSpec.verify)).toBe(true);
  });

  test("buildSortedRemediationRows enriches issues from scan payload", () => {
    const rows = recipes.buildSortedRemediationRows({
      issues: [
        {
          filePath: "src/index.js",
          line: 1,
          severity: "low",
          type: "tech-debt",
          description: "TODO: finish feature",
        },
      ],
      gate: { pass: false },
    });

    expect(rows).toHaveLength(1);
    expect(rows[0].kind).toBe("tech-debt");
    expect(rows[0].fixSpec).toBeDefined();
    expect(typeof rows[0].recipe).toBe("string");
  });

  test("buildFixPlanFromScan returns summary counts", () => {
    const plan = recipes.buildFixPlanFromScan({
      issues: [
        {
          filePath: "src/index.js",
          line: 1,
          severity: "critical",
          type: "credential",
          description: "sk_live_test_key",
        },
      ],
      gate: { pass: false },
    });

    expect(plan.fixCount).toBe(1);
    expect(plan.summary.gateBlockingCount).toBeGreaterThanOrEqual(1);
    expect(plan.fixes).toHaveLength(1);
  });
});
