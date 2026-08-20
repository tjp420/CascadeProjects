const { test } = require("node:test");
const assert = require("node:assert/strict");
const { validateFormat, selectPayload } = require("../src/lib/format-utils");

test("validateFormat accepts text", () => {
  assert.doesNotThrow(() => validateFormat("text"));
});

test("validateFormat accepts json", () => {
  assert.doesNotThrow(() => validateFormat("json"));
});

test("validateFormat accepts action-plan", () => {
  assert.doesNotThrow(() => validateFormat("action-plan"));
});

test("validateFormat rejects invalid format", () => {
  assert.throws(() => validateFormat("xml"), /Invalid --format/);
  assert.throws(() => validateFormat(""), /Invalid --format/);
  assert.throws(() => validateFormat("yaml"), /Invalid --format/);
});

test("selectPayload returns JSON for json format", () => {
  const report = { projectRoot: "/tmp", qualityScore: 100, rawIssues: [] };
  const gateResult = { pass: true, blockingIssues: [] };
  const jsonReport = { ...report, gate: gateResult };
  const payload = selectPayload(report, gateResult, jsonReport, "json");
  assert.equal(typeof payload, "string");
  const parsed = JSON.parse(payload);
  assert.equal(parsed.qualityScore, 100);
});

test("selectPayload returns text for text format", () => {
  const report = { projectRoot: "/tmp", qualityScore: 100, rawIssues: [] };
  const gateResult = { pass: true, blockingIssues: [] };
  const jsonReport = { ...report, gate: gateResult };
  const payload = selectPayload(report, gateResult, jsonReport, "text");
  assert.equal(typeof payload, "string");
  assert.ok(payload.includes("Simplebeacon"));
});

test("selectPayload returns action plan for action-plan format", () => {
  const report = { projectRoot: "/tmp", qualityScore: 100, rawIssues: [] };
  const gateResult = { pass: true, blockingIssues: [] };
  const jsonReport = { ...report, gate: gateResult };
  const payload = selectPayload(report, gateResult, jsonReport, "action-plan");
  assert.equal(typeof payload, "string");
  assert.ok(payload.includes("Simplebeacon Action Plan"));
});
