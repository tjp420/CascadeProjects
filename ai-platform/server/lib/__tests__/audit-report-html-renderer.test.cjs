"use strict";

const {
  renderCompleteAuditHtml,
} = require("../audit-report/html-renderer.cjs");
const { buildLaunchReadiness } = require("../audit-report/executive.cjs");

describe("audit-report/html-renderer", () => {
  test("exports renderCompleteAuditHtml function", () => {
    expect(typeof renderCompleteAuditHtml).toBe("function");
  });

  test("renderCompleteAuditHtml produces HTML string", () => {
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
      exportTier: { tier: "handoff", label: "Handoff" },
      readiness: buildLaunchReadiness({
        summary: {
          gatePass: true,
          productionFindings: 0,
          severityCounts: { high: 0 },
          codebaseHealth: 85,
        },
      }),
      categoryRollup: [],
      markdown: { compliance: "## Compliance checklist" },
      scopeLines: ["Full repository scan", "Production paths only"],
      reportId: "RPT-001",
      client: "Test Client",
      company: "Test Co",
      assessor: "Simplebeacon",
      engineLabel: "Simplebeacon 1.4",
      repositoryLabel: "test-repo",
      branch: "main",
      generatedAt: new Date().toISOString(),
      remediationRows: [],
    };
    const html = renderCompleteAuditHtml(model);
    expect(typeof html).toBe("string");
    expect(html).toContain("<html");
    expect(html).toContain("</html>");
  });
});
