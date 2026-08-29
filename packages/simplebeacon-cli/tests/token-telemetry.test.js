const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  loadLedger,
  saveLedger,
  recordEvent,
  summarizeLedger,
  defaultLedgerPath,
  DEFAULT_TELEMETRY_DIR,
} = require("../src/lib/token-telemetry");

function tmpLedgerPath() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-telemetry-"));
  return path.join(dir, "token-ledger.json");
}

test("loadLedger returns empty structure for missing file", () => {
  const ledger = loadLedger(path.join(os.tmpdir(), "does-not-exist-" + Date.now() + ".json"));
  assert.deepEqual(ledger, { entries: [], version: 1 });
});

test("recordEvent writes and reloads", () => {
  const ledgerPath = tmpLedgerPath();
  const { entry, ledgerSize } = recordEvent({
    ledgerPath,
    action: "summarize",
    capability: "summary",
    inputTokens: 1000,
    outputTokens: 200,
    savedTokens: 800,
  });
  assert.equal(entry.action, "summarize");
  assert.equal(ledgerSize, 1);
  const reloaded = loadLedger(ledgerPath);
  assert.equal(reloaded.entries.length, 1);
  assert.equal(reloaded.entries[0].inputTokens, 1000);
  assert.equal(reloaded.entries[0].savedTokens, 800);
});

test("recordEvent floors and clamps token counts", () => {
  const ledgerPath = tmpLedgerPath();
  recordEvent({
    ledgerPath,
    action: "x",
    capability: "estimator",
    inputTokens: -50,
    outputTokens: 1.7,
    savedTokens: 2.9,
  });
  const [entry] = loadLedger(ledgerPath).entries;
  assert.equal(entry.inputTokens, 0, "negative should clamp to 0");
  assert.equal(entry.outputTokens, 1, "should floor to 1");
  assert.equal(entry.savedTokens, 2, "should floor to 2");
});

test("summarizeLedger aggregates by capability", () => {
  const ledgerPath = tmpLedgerPath();
  recordEvent({ ledgerPath, action: "a", capability: "summary", inputTokens: 100, savedTokens: 50 });
  recordEvent({ ledgerPath, action: "b", capability: "summary", inputTokens: 200, savedTokens: 100 });
  recordEvent({ ledgerPath, action: "c", capability: "embeddings", inputTokens: 50 });
  const report = summarizeLedger(ledgerPath);
  assert.equal(report.totalCalls, 3);
  assert.equal(report.totalInputTokens, 350);
  assert.equal(report.totalSavedTokens, 150);
  assert.equal(report.byCapability.summary.calls, 2);
  assert.equal(report.byCapability.summary.inputTokens, 300);
  assert.equal(report.byCapability.embeddings.calls, 1);
});

test("summarizeLedger respects since filter", () => {
  const ledgerPath = tmpLedgerPath();
  recordEvent({ ledgerPath, action: "a", capability: "summary", inputTokens: 100 });
  const future = new Date(Date.now() + 100000).toISOString();
  const report = summarizeLedger(ledgerPath, { since: future });
  assert.equal(report.totalCalls, 0, "future since filter should exclude all");
});

test("summarizeLedger computes netTokenCost", () => {
  const ledgerPath = tmpLedgerPath();
  recordEvent({ ledgerPath, action: "a", capability: "x", inputTokens: 100, outputTokens: 20, savedTokens: 30 });
  const report = summarizeLedger(ledgerPath);
  assert.equal(report.netTokenCost, 100 + 20 - 30);
});

test("defaultLedgerPath ends with telemetry dir + ledger name", () => {
  const p = defaultLedgerPath("/tmp/proj");
  const normalized = p.replace(/\\/g, "/");
  assert.ok(normalized.includes(DEFAULT_TELEMETRY_DIR), `${normalized} should include ${DEFAULT_TELEMETRY_DIR}`);
  assert.ok(p.endsWith("token-ledger.json"));
});

test("saveLedger trims to MAX_LEDGER_ENTRIES", () => {
  const ledgerPath = tmpLedgerPath();
  const { MAX_LEDGER_ENTRIES } = require("../src/lib/token-telemetry");
  const ledger = { entries: [], version: 1 };
  for (let i = 0; i < MAX_LEDGER_ENTRIES + 100; i++) {
    ledger.entries.push({ timestamp: new Date().toISOString(), action: "x", capability: "x", inputTokens: 1, outputTokens: 0, savedTokens: 0, detail: null });
  }
  saveLedger(ledgerPath, ledger);
  const reloaded = loadLedger(ledgerPath);
  assert.equal(reloaded.entries.length, MAX_LEDGER_ENTRIES);
});
