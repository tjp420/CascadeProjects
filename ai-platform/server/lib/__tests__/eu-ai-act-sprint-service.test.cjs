"use strict";

jest.mock("../simplebeacon-proxy.cjs", () => ({
  buildAssessmentReport: jest.fn(),
  evaluateComplianceChecklist: jest.fn(),
  evaluateGate: jest.fn().mockReturnValue({ pass: true }),
  formatJsonReport: jest
    .fn()
    .mockReturnValue({ summary: {}, gate: { pass: true } }),
  initSimplebeacon: jest.fn(),
  loadSimplebeaconConfig: jest.fn().mockReturnValue({ gate: {} }),
  resolvePlatformRoot: jest.fn().mockReturnValue({ platformRoot: "/test" }),
  runScan: jest.fn().mockResolvedValue({ rawIssues: [], detectedIssues: [] }),
}));

const {
  ARTIFACT_NAMES,
  runEuAiActSprint,
} = require("../eu-ai-act-sprint-service.cjs");

describe("eu-ai-act-sprint-service", () => {
  test("exports expected functions and constants", () => {
    expect(typeof runEuAiActSprint).toBe("function");
    expect(ARTIFACT_NAMES).toBeDefined();
    expect(ARTIFACT_NAMES.report).toBe("eu-ai-act-report.json");
    expect(ARTIFACT_NAMES.compliance).toBe("eu-ai-act-compliance.json");
    expect(ARTIFACT_NAMES.assessment).toBe("eu-ai-act-assessment.json");
  });

  test("runEuAiActSprint throws on missing projectPath", async () => {
    await expect(runEuAiActSprint({})).rejects.toThrow(
      "projectPath is required",
    );
  });

  test("runEuAiActSprint throws on nonexistent path", async () => {
    await expect(
      runEuAiActSprint({ projectPath: "/nonexistent/path/xyz" }),
    ).rejects.toThrow("does not exist");
  });

  test("runEuAiActSprint throws when path is a file not directory", async () => {
    const os = require("os");
    const fs = require("fs");
    const path = require("path");
    const tmpFile = path.join(os.tmpdir(), `euai-test-${Date.now()}.txt`);
    fs.writeFileSync(tmpFile, "test");
    try {
      await expect(runEuAiActSprint({ projectPath: tmpFile })).rejects.toThrow(
        "must be a directory",
      );
    } finally {
      fs.unlinkSync(tmpFile);
    }
  });
});
