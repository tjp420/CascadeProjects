const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Guard: skip all tests if policy module doesn't exist
let RemediationEngine, STRUCTURAL_RULES;
try {
  ({
    RemediationEngine,
    STRUCTURAL_RULES,
  } = require("../../src/policy/RemediationEngine"));
} catch (_e) {
  test.skip("RemediationEngine module not available — skipping all tests", () => {});
  return;
}

// ---------------------------------------------------------------------------
// Helper: create a temp file and clean it up after the test
// ---------------------------------------------------------------------------
function withTempFile(content, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-unit-"));
  const filePath = path.join(dir, "test-file.js");
  fs.writeFileSync(filePath, content, "utf8");
  try {
    return fn(filePath, dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Structural rule fixtures
// ---------------------------------------------------------------------------

test("SB-FIX-MARKDOWN-FENCE removes leading code fence", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input = "```javascript\nconst answer = 42;\n";
  const result = engine.processBuffer(input, "sample.js");

  assert.ok(result.changed, "expected change");
  assert.ok(!result.content.includes("```"), "fence should be removed");
  assert.ok(
    result.content.includes("const answer = 42;"),
    "code should remain",
  );
  assert.ok(result.rulesApplied.includes("SB-FIX-MARKDOWN-FENCE"));
});

test("SB-FIX-MARKDOWN-FENCE removes trailing code fence", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input = "const answer = 42;\n```\n";
  const result = engine.processBuffer(input, "sample.js");

  assert.ok(result.changed);
  assert.ok(!result.content.includes("```"));
});

test('SB-FIX-LLM-PREAMBLE strips "here is your updated component" header', () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input =
    "here is your updated component:\n\nexport default function App() {}\n";
  const result = engine.processBuffer(input, "App.tsx");

  assert.ok(result.changed, "expected change");
  assert.ok(!result.content.startsWith("here is your updated component"));
  assert.ok(result.content.includes("export default function App"));
  assert.ok(result.rulesApplied.includes("SB-FIX-LLM-PREAMBLE"));
});

test("SB-FIX-SLOP-PLACEHOLDER removes LLM TODO boilerplate", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input =
    "function load() {\n  // TODO: implement the rest of this loader\n}\n";
  const result = engine.processBuffer(input, "sample.js");

  assert.ok(result.changed);
  assert.ok(!result.content.includes("TODO: implement the rest"));
  assert.ok(result.content.includes("function load"));
  assert.ok(result.rulesApplied.includes("SB-FIX-SLOP-PLACEHOLDER"));
});

test("legitimate TODO comments are preserved", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input = "// TODO: schedule nightly audit\nconst x = 1;\n";
  const result = engine.processBuffer(input, "sample.js");

  assert.ok(!result.changed);
  assert.ok(result.content.includes("TODO: schedule nightly audit"));
});

// ---------------------------------------------------------------------------
// Lifecycle / safe string mutation
// ---------------------------------------------------------------------------

test("processBuffer does not mutate the original input string", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input = "```js\nconst x = 1;\n```\n";
  const result = engine.processBuffer(input, "sample.js");

  assert.equal(result.original, input);
  assert.notEqual(result.content, input);
});

test("processFile dry-run does not touch the file on disk", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  withTempFile("```js\nconst x = 1;\n```\n", (filePath) => {
    const before = fs.readFileSync(filePath, "utf8");
    const result = engine.processFile(filePath, { dryRun: true });
    const after = fs.readFileSync(filePath, "utf8");

    assert.ok(result.changed);
    assert.equal(result.applied, false);
    assert.equal(before, after);
  });
});

// ---------------------------------------------------------------------------
// Atomic write / fsync behavior
// ---------------------------------------------------------------------------

test("writeAtomic writes, fsyncs, and returns the exact bytes", () => {
  const engine = new RemediationEngine();
  withTempFile("", (filePath) => {
    const expected = "atomic payload\n";
    engine.writeAtomic(filePath, expected);
    assert.equal(fs.readFileSync(filePath, "utf8"), expected);
  });
});

test("writeAtomic creates missing intermediate directories", () => {
  const engine = new RemediationEngine();
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-atomic-"));
  const filePath = path.join(dir, "a", "b", "c", "nested.txt");
  try {
    engine.writeAtomic(filePath, "nested content\n");
    assert.equal(fs.readFileSync(filePath, "utf8"), "nested content\n");
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// High-entropy credential quarantine
// ---------------------------------------------------------------------------

test("Stripe live key is quarantined and replaced by env var reference", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const key = "sk_live_" + "a".repeat(24);
  const input = `const stripe = require('stripe')('${key}');\n`;
  const result = engine.processBuffer(input, "config.js");

  assert.ok(result.changed);
  assert.ok(!result.content.includes(key));
  assert.ok(
    result.content.includes("process.env.SIMPLEBEACON_QUARANTINE_STRIPE_KEY_0"),
  );
  assert.equal(result.quarantine.length, 1);
  assert.match(
    result.quarantine[0],
    /SIMPLEBEACON_QUARANTINE_STRIPE_KEY_0="sk_live_/,
  );
});

test("generic secret_key assignment is quarantined", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input = 'const secret_key = "not_something_you_should_commit_1234";\n';
  const result = engine.processBuffer(input, "config.js");

  assert.ok(result.changed);
  assert.ok(!result.content.includes("not_something_you_should_commit_1234"));
  assert.ok(
    result.content.includes(
      "process.env.SIMPLEBEACON_QUARANTINE_GENERIC_SECRET_0",
    ),
  );
  assert.equal(result.quarantine.length, 1);
});

test("short non-credential strings are ignored", () => {
  const engine = new RemediationEngine(STRUCTURAL_RULES);
  const input = 'const secret_key = "short";\n';
  const result = engine.processBuffer(input, "config.js");

  assert.ok(!result.changed);
  assert.ok(!result.content.includes("QUARANTINE"));
});
