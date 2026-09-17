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

  it("reads compact sb_last_scan { files, issues, gate }", () => {
    const row = mapSnapshotToHistoryRow({
      files: 23142,
      issues: 12,
      gate: false,
    });
    assert.ok(row);
    assert.equal(row.projectName, "Local scan");
    assert.equal(row.issueCount, 12);
    assert.equal(row.blockingCount, null);
  });
});

describe("getLocalScanHistory", () => {
  it("returns an empty list when browser storage is missing", async () => {
    const rows = await getLocalScanHistory();
    assert.deepEqual(rows, []);
  });
});
