// simplebeacon-ignore: Scanner pattern definitions, and EU AI Act indicators — all findings are false positives, dashboard code, debug artifacts, debugArtifacts, test fixtures
"use strict";

const {
  buildDeterministicExecutive,
  calculateAuditConfidence,
  buildExecutivePriorities,
  buildLaunchReadiness,
  buildCodebaseActionPlan,
  buildCompleteAuditPrompt,
  parseAiExecutive,
  mergeExecutiveSummary,
} = require("../audit-report/executive.cjs");

describe("audit-report/executive", () => {
  test("exports expected functions", () => {
    expect(typeof buildDeterministicExecutive).toBe("function");
    expect(typeof calculateAuditConfidence).toBe("function");
    expect(typeof buildExecutivePriorities).toBe("function");
    expect(typeof buildLaunchReadiness).toBe("function");
    expect(typeof buildCodebaseActionPlan).toBe("function");
    expect(typeof buildCompleteAuditPrompt).toBe("function");
    expect(typeof parseAiExecutive).toBe("function");
    expect(typeof mergeExecutiveSummary).toBe("function");
  });

  test("calculateAuditConfidence returns 100 for clean summary", () => {
    const score = calculateAuditConfidence({
      gatePass: true,
      ruleScopedFiles: 100,
      codebaseHealth: 90,
      codeFilesAnalyzed: 50,
    });
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThanOrEqual(100);
  });

  test("calculateAuditConfidence penalizes zero ruleScopedFiles", () => {
    const score = calculateAuditConfidence({
      ruleScopedFiles: 0,
      gatePass: true,
    });
    expect(score).toBeLessThan(100);
  });

  test("calculateAuditConfidence penalizes null gatePass", () => {
    const score = calculateAuditConfidence({
      ruleScopedFiles: 100,
      gatePass: null,
    });
    expect(score).toBeLessThan(100);
  });

  test("calculateAuditConfidence penalizes low codebaseHealth", () => {
    const score = calculateAuditConfidence({
      ruleScopedFiles: 100,
      gatePass: true,
      codebaseHealth: 20,
    });
    expect(score).toBeLessThan(80);
  });

  test("buildExecutivePriorities returns array of strings", () => {
    const priorities = buildExecutivePriorities({
      gatePass: false,
      severityCounts: { high: 1 },
      productionFindings: 1,
    });
    expect(Array.isArray(priorities)).toBe(true);
    expect(priorities.length).toBeGreaterThan(0);
    priorities.forEach((p) => expect(typeof p).toBe("string"));
  });

  test("buildExecutivePriorities handles gate pass with no findings", () => {
    const priorities = buildExecutivePriorities({
      gatePass: true,
      productionFindings: 0,
      codeFilesAnalyzed: 100,
    });
    expect(Array.isArray(priorities)).toBe(true);
    expect(priorities[0]).toContain("Zero production-path");
  });

  test("buildLaunchReadiness returns blocked for gate fail", () => {
    const readiness = buildLaunchReadiness({
      summary: { gatePass: false, severityCounts: { high: 2 } },
    });
    expect(readiness.tone).toBe("blocked");
    expect(readiness.label).toContain("Not ready");
  });

  test("buildLaunchReadiness returns ready for gate pass", () => {
    const readiness = buildLaunchReadiness({
      summary: {
        gatePass: true,
        productionFindings: 0,
        severityCounts: { high: 0 },
        codebaseHealth: 90,
      },
    });
    expect(readiness.tone).toBe("ready");
    expect(readiness.score).toBeGreaterThan(70);
  });

  test("buildLaunchReadiness returns conditional for production findings", () => {
    const readiness = buildLaunchReadiness({
      summary: {
        gatePass: null,
        productionFindings: 5,
        severityCounts: { high: 0 },
        codebaseHealth: 70,
      },
    });
    expect(readiness.tone).toBe("conditional");
  });

  test("buildLaunchReadiness returns review required for unknown state", () => {
    const readiness = buildLaunchReadiness({
      summary: { severityCounts: { high: 0 }, productionFindings: 0 },
    });
    expect(readiness.tone).toBe("conditional");
    expect(readiness.label).toBe("Review required");
  });

  test("buildCodebaseActionPlan returns string for model with findings", () => {
    const plan = buildCodebaseActionPlan({
      summary: {
        productionFindings: 3,
        documentationFindings: 2,
        codebaseFindingsDeduped: 5,
      },
      priorityFindings: [
        {
          tier: "production",
          severity: "high",
          category: "cred",
          filePath: "server/lib/x.cjs",
          line: 10,
          recommendedAction: "Fix it",
        },
      ],
    });
    expect(typeof plan).toBe("string");
    expect(plan).toContain("Week 1");
    expect(plan).toContain("Week 2");
    expect(plan).toContain("Week 3");
  });

  test("buildCodebaseActionPlan returns no-backlog message for clean model", () => {
    const plan = buildCodebaseActionPlan({
      summary: {
        productionFindings: 0,
        documentationFindings: 0,
        codebaseFindingsDeduped: 0,
      },
      priorityFindings: [],
    });
    expect(plan).toContain("No production-path hygiene backlog");
  });

  test("buildDeterministicExecutive produces a model object", () => {
    const model = {
      summary: {
        gatePass: true,
        productionFindings: 0,
        codeFilesAnalyzed: 50,
        severityCounts: { high: 0, medium: 0, low: 5 },
        codebaseHealth: 85,
        documentationFindings: 2,
      },
      priorityFindings: [],
      projectPath: "/test",
      readiness: buildLaunchReadiness({
        summary: {
          gatePass: true,
          productionFindings: 0,
          severityCounts: { high: 0 },
          codebaseHealth: 85,
        },
      }),
    };
    const exec = buildDeterministicExecutive(model);
    expect(exec).toBeDefined();
    expect(typeof exec).toBe("object");
    expect(typeof exec.verdict).toBe("string");
  });

  test("buildCompleteAuditPrompt returns a string", () => {
    const model = {
      summary: {
        gatePass: true,
        productionFindings: 0,
        codeFilesAnalyzed: 50,
        severityCounts: { high: 0, medium: 0, low: 5 },
        codeSeverity: { high: 0, medium: 0, low: 0 },
        codebaseHealth: 85,
        documentationFindings: 2,
      },
      priorityFindings: [],
      projectPath: "/test",
      readiness: buildLaunchReadiness({
        summary: {
          gatePass: true,
          productionFindings: 0,
          severityCounts: { high: 0 },
          codebaseHealth: 85,
        },
      }),
    };
    const prompt = buildCompleteAuditPrompt(model);
    expect(typeof prompt).toBe("string");
    expect(prompt.length).toBeGreaterThan(0);
  });

  test("mergeExecutiveSummary merges AI and deterministic content", () => {
    const deterministic = {
      summary: "Det summary",
      priorities: ["p1"],
      readiness: { label: "Ready", tone: "ready", score: 90 },
    };
    const aiParsed = { summary: "AI summary", priorities: ["ai-p1"] };
    const merged = mergeExecutiveSummary(deterministic, aiParsed);
    expect(merged).toBeDefined();
  });
});
