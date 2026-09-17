import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getLocalScanHistory,
  mapSnapshotToHistoryRow,
} from "./scan-history.ts";

describe("mapSnapshotToHistoryRow", () => {
  it("returns null for empty storage payloads", () => {
    assert.equal(mapSnapshotToHistoryRow(null), null);
    assert.equal(mapSnapshotToHistoryRow(undefined), null);
    assert.equal(mapSnapshotToHistoryRow("not-an-object"), null);
  });

  it("binds projectName, timestamp, findings, and blocking from a report snapshot", () => {
    const row = mapSnapshotToHistoryRow({
      projectPath: "C:\\Users\\user\\CascadeProjects",
      generatedAt: "2026-09-17T00:40:28.838Z",
      issueCount: 12,
      gate: { pass: false, blockingCount: 3 },
    });
    assert.ok(row);
    assert.equal(row.projectName, "C:\\Users\\user\\CascadeProjects");
    assert.equal(row.timestamp, "2026-09-17T00:40:28.838Z");
    assert.equal(row.issueCount, 12);
    assert.equal(row.blockingCount, 3);
  });

  it("still maps a compact snapshot when extra report fields are noisy", () => {
    const row = mapSnapshotToHistoryRow({
      files: 852,
      issues: 118,
      gate: false,
      projectPath: "unbreakable-oracle-final",
      generatedAt: "2026-09-15T00:12:44.000Z",
    });
    assert.ok(row);
    assert.equal(row.projectName, "unbreakable-oracle-final");
    assert.equal(row.issueCount, 118);
  });
});

describe("getLocalScanHistory", () => {
  it("returns an empty list when browser storage is missing", async () => {
    const rows = await getLocalScanHistory();
    assert.deepEqual(rows, []);
  });
});
