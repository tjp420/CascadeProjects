import assert from "node:assert/strict";
import { describe, it, beforeEach } from "node:test";
import { getRawLastScan } from "./scan-history.ts";

describe("getRawLastScan", () => {
  beforeEach(() => {
    // provide a minimal localStorage mock for node test environment
    global.localStorage = {
      store: {},
      getItem(key) { return this.store[key] ?? null; },
      setItem(key, val) { this.store[key] = String(val); },
      removeItem(key) { delete this.store[key]; },
      clear() { this.store = {}; },
    };
  });

  it("returns parsed snapshot when sb_last_scan_report exists in localStorage", async () => {
    const sample = { projectName: "X", generatedAt: "2026-09-16T12:00:00Z", issueCount: 5 };
    localStorage.setItem("sb_last_scan_report", JSON.stringify(sample));
    const raw = await getRawLastScan();
    assert.deepEqual(raw, sample);
  });

  it("returns null when no storage present", async () => {
    localStorage.clear();
    const raw = await getRawLastScan();
    assert.equal(raw, null);
  });
});
