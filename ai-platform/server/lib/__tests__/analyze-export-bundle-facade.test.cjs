"use strict";

jest.mock("../analyze-deliverable-access.cjs", () => ({
  getTierManifest: jest.fn(),
  resolveDeliverableTier: jest.fn().mockReturnValue({ tier: "operator" }),
  DELIVERABLE_TIERS: {
    operator: {
      tier: "operator",
      label: "Operator",
      requiresCompleteScan: false,
    },
    handoff: {
      tier: "handoff",
      label: "Handoff",
      requiresCompleteScan: true,
      minScanKind: ["complete"],
    },
  },
}));
jest.mock("../simplebeacon-proxy.cjs", () => ({
  sanitizeFrozenAuditDeliverableHtml: jest.fn((html) => html),
  sanitizeEuAiActSprintArtifactExport: jest.fn((v) => v),
  projectLabelFromPath: jest.fn().mockReturnValue("project"),
  redactProjectPathForExport: jest.fn().mockReturnValue("/redacted/project"),
  sanitizeCompleteScanExport: jest.fn((scan) => scan),
  applyPublicGateToAnalyzeResponse: jest
    .fn()
    .mockReturnValue({ publicSummary: {} }),
  sanitizePublicOutput: jest.fn().mockReturnValue({ summary: {} }),
  sanitizePublicSummaryArtifactExport: jest
    .fn()
    .mockReturnValue({ type: "simplebeacon-public-summary" }),
  sanitizeSimplebeaconReportExport: jest.fn((v) => v),
  sanitizeFictionDigestExport: jest.fn((v) => v),
  sanitizeComplianceChecklistArtifactExport: jest.fn((v) => v),
  sanitizeConsolidationExport: jest.fn((v) => v),
  sanitizeCodebaseReportExport: jest.fn((v) => v),
  sanitizeDataCleanupReportExport: jest.fn((v) => v),
  sanitizeCleanupBriefExport: jest.fn((v) => v),
  sanitizeNpmAuditExport: jest.fn((v) => v),
  sanitizeRoadmapExport: jest.fn((v) => v),
  buildReAttestationNoteArtifact: jest
    .fn()
    .mockReturnValue({ type: "re-attestation" }),
}));

const bundle = require("../analyze-export-bundle.cjs");

describe("analyze-export-bundle facade", () => {
  test("re-exports orchestration and submodule helpers", () => {
    expect(typeof bundle.buildAnalyzeExportZipStream).toBe("function");
    expect(typeof bundle.collectExportArtifacts).toBe("function");
    expect(typeof bundle.validateScanForTier).toBe("function");
    expect(typeof bundle.resolveEnginesRun).toBe("function");
    expect(typeof bundle.filterCompleteScanForEngines).toBe("function");
    expect(typeof bundle.slugify).toBe("function");
    expect(typeof bundle.dateStamp).toBe("function");
    expect(bundle.ARTIFACT_ENGINE_REQUIREMENTS).toBeDefined();
    expect(bundle.ENGINE_RESULT_KEYS).toBeDefined();
  });

  test("slugify and dateStamp produce stable export labels", () => {
    expect(bundle.slugify("My Project Name!!")).toBe("my-project-name");
    expect(bundle.dateStamp(new Date("2026-07-15T12:00:00.000Z"))).toBe(
      "2026-07-15",
    );
  });

  test("validateScanForTier delegates to validation submodule", () => {
    expect(bundle.validateScanForTier("operator", "gate")).toEqual({
      ok: true,
    });
  });
});
