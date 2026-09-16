import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildRoadmapFromScan,
  countIssuesBySeverity,
  selectIssuesForBrowserStorage,
} from "./collect-scan-issues.ts";

describe("selectIssuesForBrowserStorage", () => {
  it("keeps Critical and Low when Medium floods the list", () => {
    const issues = [
      ...Array.from({ length: 40 }, (_, i) => ({
        severity: "critical",
        type: "cred",
        id: `c${i}`,
      })),
      ...Array.from({ length: 2000 }, (_, i) => ({
        severity: "medium",
        type: "todo",
        id: `m${i}`,
      })),
      ...Array.from({ length: 30 }, (_, i) => ({
        severity: "low",
        type: "info",
        id: `l${i}`,
      })),
      ...Array.from({ length: 20 }, (_, i) => ({
        severity: "high",
        type: "rce",
        id: `h${i}`,
      })),
    ];

    const flat = issues.slice(0, 50);
    assert.equal(
      flat.filter((i) => i.severity === "critical").length,
      40,
      "naive slice keeps critical first only by luck of array order",
    );
    assert.equal(
      flat.filter((i) => i.severity === "low").length,
      0,
      "naive slice drops all low when medium follows critical",
    );

    // Shuffle so Critical is not first — mirrors scanner emission order.
    const shuffled = [
      ...issues.filter((i) => i.severity === "medium"),
      ...issues.filter((i) => i.severity === "low"),
      ...issues.filter((i) => i.severity === "high"),
      ...issues.filter((i) => i.severity === "critical"),
    ];
    const picked = selectIssuesForBrowserStorage(shuffled, 50);
    const counts = countIssuesBySeverity(picked);

    assert.equal(picked.length, 50);
    assert.ok(counts.critical > 0, "critical must appear in capped list");
    assert.ok(counts.high > 0, "high must appear in capped list");
    assert.ok(counts.low > 0, "low must appear in capped list");
    assert.ok(counts.medium > 0, "medium still gets remainder slots");
  });
});

describe("buildRoadmapFromScan", () => {
  it("returns null for a path-only stub", () => {
    assert.equal(buildRoadmapFromScan({ projectPath: "CascadeProjects" }), null);
  });

  it("builds a roadmap from the compact sb_last_scan summary", () => {
    const roadmap = buildRoadmapFromScan({
      files: 23142,
      issues: 12,
      gate: false,
    });
    assert.ok(roadmap);
    assert.equal(roadmap.executiveSummary.totalFeatures, 12);
    assert.equal(roadmap.executiveSummary.projectHealth, "In Progress");
  });

  it("drops demo backups, outbound payloads, and analysis dumps from the roadmap", () => {
    const roadmap = buildRoadmapFromScan({
      projectPath: "C:\\Users\\user\\CascadeProjects",
      issueCount: 39272,
      gate: { pass: false },
      severityCounts: { critical: 56, high: 150, medium: 39033, low: 33 },
      detectedIssues: [
        {
          severity: "critical",
          type: "hardcoded-secret",
          description: "Credential echo in demo report",
          file: "demo/demo-report.json",
          line: 12,
        },
        {
          severity: "high",
          type: "token-leak",
          description: "Backup copy of scan JSON",
          file: "demo/demo-report.json.simplebeacon-backup.1",
          line: 4,
        },
        {
          severity: "high",
          type: "sensitiveData",
          description: "GitHub payload dump",
          file: "CascadeProjects/.outbound/github_issues_payload.json",
          line: 4,
        },
        {
          severity: "high",
          type: "euAiAct",
          description: "Prioritized findings dump",
          file: ".analysis/prioritized-findings.json",
          line: 5,
        },
        {
          severity: "critical",
          type: "hardcoded-secret",
          description: "Live env leak",
          file: "coming-soon/server.cjs",
          line: 40,
        },
      ],
    });
    assert.ok(roadmap);
    assert.equal(roadmap.actionPlan.length, 1);
    assert.equal(roadmap.actionPlan[0].category, "coming-soon/server.cjs");
    assert.equal(roadmap.risks.length, 1);
    assert.equal(roadmap.executiveSummary.totalFeatures, 1);
    assert.equal(roadmap.executiveSummary.projectHealth, "Blocked");
    assert.deepEqual(
      roadmap.actionPlan.map((row) => row.category),
      ["coming-soon/server.cjs"],
    );
  });

  it("builds an empty production roadmap when every listed finding is an artifact", () => {
    const roadmap = buildRoadmapFromScan({
      projectPath: "C:\\Users\\user\\CascadeProjects",
      issueCount: 39272,
      gate: { pass: false },
      severityCounts: { critical: 56, high: 150, medium: 39033, low: 33 },
      detectedIssues: [
        {
          severity: "critical",
          type: "hardcoded-secret",
          description: "Credential echo in demo report",
          file: "demo/demo-report.json",
          line: 12,
        },
        {
          severity: "high",
          type: "token-leak",
          description: "Backup copy of scan JSON",
          file: "demo/demo-report.json.simplebeacon-backup.1",
          line: 4,
        },
      ],
    });
    assert.ok(roadmap);
    assert.equal(roadmap.executiveSummary.totalFeatures, 0);
    assert.equal(roadmap.executiveSummary.projectHealth, "Healthy");
    assert.equal(roadmap.actionPlan.length, 0);
    assert.equal(roadmap.risks.length, 0);
  });
});
