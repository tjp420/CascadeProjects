import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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
