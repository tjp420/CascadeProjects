"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  generateBeacons,
  generateBeaconIndex,
  scanBeacons,
  loadIndex,
  saveIndex,
  defaultIndexPath,
  getLanguageForExt,
  DEFAULT_BEACONS_DIR,
} = require("../src/lib/semantic-lighthouse");

// ─── generateBeacons: basic extraction ──────────────────────────────────────

test("generateBeacons extracts JavaScript classes and functions", () => {
  const code = `
class EnterpriseBilling {
  constructor(apiKey) {
    this.key = apiKey;
  }
  processInvoice(userId, amount) {
    return "processed";
  }
}
function standaloneFunc(a, b) {
  return a + b;
}
const arrowFn = (x) => x * 2;
`;
  const { beacons } = generateBeacons("billing.js", code);
  const names = beacons.map((b) => b.name);
  assert.ok(names.includes("EnterpriseBilling"), "should extract class name");
  assert.ok(names.includes("standaloneFunc"), "should extract function name");
  assert.ok(names.includes("arrowFn"), "should extract arrow function name");
  assert.ok(names.includes("constructor"), "should extract constructor method");
  assert.ok(names.includes("processInvoice"), "should extract method name");
});

test("generateBeacons extracts TypeScript interfaces, types, and enums", () => {
  const code = `
interface BillingConfig {
  apiKey: string;
  timeout: number;
}
type PaymentStatus = "paid" | "pending" | "failed";
enum Tier {
  Developer = "developer",
  TeamPro = "team_pro",
}
class BillingEngine implements BillingConfig {
  apiKey: string;
  processRefund(chargeId: string): boolean {
    return true;
  }
}
`;
  const { beacons } = generateBeacons("types.ts", code);
  const names = beacons.map((b) => b.name);
  assert.ok(names.includes("BillingConfig"), "should extract interface");
  assert.ok(names.includes("PaymentStatus"), "should extract type alias");
  assert.ok(names.includes("Tier"), "should extract enum");
  assert.ok(names.includes("BillingEngine"), "should extract class");
  assert.ok(names.includes("processRefund"), "should extract method");
});

test("generateBeacons extracts Python classes and functions", () => {
  const code = `
class EnterpriseBillingEngine(StripeBridge):
    def __init__(self, api_key):
        self.key = api_key

    def process_invoice_v2(self, user_id, amount_cents=1000):
        return "invoice_processed"

    async def execute_refund(self, charge_id):
        return True

def standalone_function(x):
    return x * 2
`;
  const { beacons } = generateBeacons("billing.py", code);
  const names = beacons.map((b) => b.name);
  assert.ok(names.includes("EnterpriseBillingEngine"), "should extract Python class");
  assert.ok(names.includes("__init__"), "should extract __init__ method");
  assert.ok(names.includes("process_invoice_v2"), "should extract method");
  assert.ok(names.includes("execute_refund"), "should extract async method");
  assert.ok(names.includes("standalone_function"), "should extract function");
});

test("generateBeacons extracts TODO/FIXME/BUG intent beacons", () => {
  const code = `
function processRefund(chargeId) {
  // TODO: add idempotency check
  // FIXME: race condition if webhook drops out early
  // BUG: this crashes on null chargeId
  return true;
}
`;
  const { beacons } = generateBeacons("refund.js", code);
  const intentBeacons = beacons.filter((b) => b.type === "intent_beacon");
  assert.equal(intentBeacons.length, 3, "should extract 3 intent beacons");
  const entities = intentBeacons.map((b) => b.entity);
  assert.ok(entities.includes("TODO"), "should find TODO");
  assert.ok(entities.includes("FIXME"), "should find FIXME");
  assert.ok(entities.includes("BUG"), "should find BUG");
});

test("generateBeacons extracts Go structs and functions", () => {
  const code = `
type BillingEngine struct {
    apiKey string
}

type PaymentProcessor interface {
    Process(amount int) error
}

func (e *BillingEngine) ProcessRefund(chargeID string) error {
    return nil
}

func standaloneFunc(x int) int {
    return x * 2
}
`;
  const { beacons } = generateBeacons("billing.go", code);
  const names = beacons.map((b) => b.name);
  assert.ok(names.includes("BillingEngine"), "should extract Go struct");
  assert.ok(names.includes("PaymentProcessor"), "should extract Go interface");
  assert.ok(names.includes("ProcessRefund"), "should extract Go method");
  assert.ok(names.includes("standaloneFunc"), "should extract Go function");
});

test("generateBeacons returns empty for unsupported file types", () => {
  const { beacons, fileTokens, beaconTokens } = generateBeacons("readme.md", "# Hello\n\nSome text");
  assert.equal(beacons.length, 0);
  assert.ok(fileTokens > 0, "should still count file tokens");
  assert.equal(beaconTokens, 0);
});

test("generateBeacons computes correct line numbers", () => {
  const code = `line1\nline2\nclass Foo {\nline4\nfunction bar() {}\n`;
  const { beacons } = generateBeacons("test.js", code);
  const classBeacon = beacons.find((b) => b.name === "Foo");
  const funcBeacon = beacons.find((b) => b.name === "bar");
  assert.equal(classBeacon.line, 3, "class should be on line 3");
  assert.equal(funcBeacon.line, 5, "function should be on line 5");
});

test("generateBeacons deduplicates overlapping matches", () => {
  const code = `class Foo {\n  constructor() {}\n  bar() {}\n}\n`;
  const { beacons } = generateBeacons("test.js", code);
  // Each entity:line should be unique
  const keys = beacons.map((b) => `${b.entity}:${b.name}:${b.line}`);
  const uniqueKeys = new Set(keys);
  assert.equal(keys.length, uniqueKeys.size, "no duplicate beacons");
});

test("generateBeacons token weights are smaller than file tokens", () => {
  const code = `
class EnterpriseBillingEngine {
  constructor(apiKey) {
    this.key = apiKey;
    this.cache = new Map();
    this.logger = console;
  }

  processInvoiceV2(userId, amountCents = 1000) {
    // 400 lines of complex financial calculations
    const result = this.calculateTax(amountCents);
    const net = this.applyDiscount(result, userId);
    return { net, gross: amountCents };
  }

  executeEmergencyRefund(chargeId) {
    // TODO: BUG: race condition if webhook drops out early
    return true;
  }
}
`;
  const { fileTokens, beaconTokens } = generateBeacons("billing.js", code);
  assert.ok(beaconTokens < fileTokens, "beacon tokens should be less than file tokens");
  assert.ok(beaconTokens > 0, "should have some beacon tokens");
});

// ─── scanBeacons: low-cost search ───────────────────────────────────────────

test("scanBeacons finds matching targets by name", () => {
  const index = {
    files: [
      {
        file: "billing.js",
        beacons: [
          { name: "processRefund", entity: "function", type: "functional_target", line: 10, signature: "function processRefund(chargeId)", tokenWeight: 10 },
          { name: "generateReport", entity: "function", type: "functional_target", line: 20, signature: "function generateReport()", tokenWeight: 8 },
        ],
        fileTokens: 500,
      },
    ],
  };
  const results = scanBeacons(index, "refund");
  assert.equal(results.length, 1);
  assert.equal(results[0].entityName, "processRefund");
  assert.equal(results[0].targetLine, 10);
  assert.equal(results[0].targetFile, "billing.js");
});

test("scanBeacons boosts intent beacons (TODO/FIXME/BUG)", () => {
  const index = {
    files: [
      {
        file: "billing.js",
        beacons: [
          { name: "processRefund", entity: "function", type: "functional_target", line: 10, signature: "function processRefund()", tokenWeight: 10 },
          { name: "race condition if webhook drops", entity: "BUG", type: "intent_beacon", line: 15, signature: "// BUG: race condition", tokenWeight: 8 },
        ],
        fileTokens: 500,
      },
    ],
  };
  const results = scanBeacons(index, "refund race");
  // Both match "refund" or "race" — but BUG beacon gets +2 boost
  assert.equal(results.length, 2);
  assert.ok(results[0].score >= results[1].score, "results sorted by score");
  // The BUG beacon should rank higher due to intent boost
  assert.equal(results[0].entityType, "BUG", "intent beacon should rank first");
});

test("scanBeacons returns empty for no matches", () => {
  const index = {
    files: [
      {
        file: "billing.js",
        beacons: [
          { name: "processRefund", entity: "function", type: "functional_target", line: 10, signature: "function processRefund()", tokenWeight: 10 },
        ],
        fileTokens: 500,
      },
    ],
  };
  const results = scanBeacons(index, "nonexistent");
  assert.equal(results.length, 0);
});

test("scanBeacons respects k limit", () => {
  const beacons = [];
  for (let i = 0; i < 20; i++) {
    beacons.push({
      name: `refundFunc${i}`,
      entity: "function",
      type: "functional_target",
      line: i + 1,
      signature: `function refundFunc${i}()`,
      tokenWeight: 10,
    });
  }
  const index = {
    files: [{ file: "billing.js", beacons, fileTokens: 5000 }],
  };
  const results = scanBeacons(index, "refund", { k: 5 });
  assert.equal(results.length, 5, "should respect k limit");
});

test("scanBeacons filters by entity type", () => {
  const index = {
    files: [
      {
        file: "billing.js",
        beacons: [
          { name: "Billing", entity: "class", type: "structural_anchor", line: 1, signature: "class Billing", tokenWeight: 5 },
          { name: "refund", entity: "function", type: "functional_target", line: 10, signature: "function refund()", tokenWeight: 8 },
          { name: "TODO refund", entity: "TODO", type: "intent_beacon", line: 15, signature: "// TODO: refund", tokenWeight: 6 },
        ],
        fileTokens: 500,
      },
    ],
  };
  const results = scanBeacons(index, "refund", { entityFilter: ["function"] });
  assert.equal(results.length, 1);
  assert.equal(results[0].entityType, "function");
});

test("scanBeacons handles multi-term queries", () => {
  const index = {
    files: [
      {
        file: "billing.js",
        beacons: [
          { name: "processRefund", entity: "function", type: "functional_target", line: 10, signature: "function processRefund(chargeId)", tokenWeight: 10 },
          { name: "refundHandler", entity: "class", type: "structural_anchor", line: 1, signature: "class refundHandler", tokenWeight: 8 },
        ],
        fileTokens: 500,
      },
    ],
  };
  const results = scanBeacons(index, "refund class");
  // Both match "refund", but refundHandler also matches "class"
  assert.equal(results.length, 2);
  assert.ok(results[0].score >= results[1].score);
  assert.ok(results[0].matchedTerms.length >= results[1].matchedTerms.length);
});

// ─── generateBeaconIndex: project-wide indexing ─────────────────────────────

test("generateBeaconIndex walks a project and writes index to disk", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beacon-test-"));
  try {
    fs.writeFileSync(
      path.join(tmpDir, "billing.js"),
      "class Billing { processRefund() {} }",
    );
    fs.writeFileSync(
      path.join(tmpDir, "types.ts"),
      "interface Config { apiKey: string; }",
    );
    fs.writeFileSync(
      path.join(tmpDir, "readme.md"),
      "# Not a code file",
    );

    const { index, outputDir } = await generateBeaconIndex(tmpDir);
    assert.ok(index.summary.filesIndexed >= 2, "should index at least 2 code files");
    assert.ok(index.summary.totalBeacons > 0, "should have beacons");
    assert.ok(index.summary.tokenReductionPct > 0, "should show token reduction");
    assert.ok(fs.existsSync(path.join(outputDir, "beacon-index.json")), "should write index file");

    const fileNames = index.files.map((f) => f.file);
    assert.ok(fileNames.some((f) => f.endsWith("billing.js")), "should include billing.js");
    assert.ok(fileNames.some((f) => f.endsWith("types.ts")), "should include types.ts");
    assert.ok(!fileNames.some((f) => f.endsWith("readme.md")), "should NOT include readme.md");
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

// ─── Persistence helpers ────────────────────────────────────────────────────

test("loadIndex and saveIndex round-trip", () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "beacon-persist-"));
  try {
    const indexPath = path.join(tmpDir, "beacon-index.json");
    const index = {
      summary: { filesIndexed: 1, totalBeacons: 2, totalFileTokens: 100, totalBeaconTokens: 20, tokenReductionPct: 80 },
      files: [{ file: "test.js", beacons: [{ name: "foo", line: 1 }] }],
    };
    saveIndex(index, indexPath);
    const loaded = loadIndex(indexPath);
    assert.deepEqual(loaded, index);
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("defaultIndexPath returns expected path", () => {
  const p = defaultIndexPath("/my/project");
  const normalized = p.replace(/\\/g, "/");
  assert.ok(normalized.includes("beacon-index.json"));
  assert.ok(normalized.includes(DEFAULT_BEACONS_DIR));
});

// ─── Language detection ─────────────────────────────────────────────────────

test("getLanguageForExt maps common extensions", () => {
  assert.equal(getLanguageForExt(".js"), "javascript");
  assert.equal(getLanguageForExt(".ts"), "typescript");
  assert.equal(getLanguageForExt(".tsx"), "typescript");
  assert.equal(getLanguageForExt(".py"), "python");
  assert.equal(getLanguageForExt(".go"), "go");
  assert.equal(getLanguageForExt(".rs"), "rust");
  assert.equal(getLanguageForExt(".java"), "java");
  assert.equal(getLanguageForExt(".rb"), "ruby");
  assert.equal(getLanguageForExt(".cs"), "csharp");
  assert.equal(getLanguageForExt(".php"), "php");
  assert.equal(getLanguageForExt(".sh"), "shell");
  assert.equal(getLanguageForExt(".sql"), "sql");
});

test("getLanguageForExt returns null for unsupported extensions", () => {
  assert.equal(getLanguageForExt(".md"), null);
  assert.equal(getLanguageForExt(".txt"), null);
  assert.equal(getLanguageForExt(".json"), null);
  assert.equal(getLanguageForExt(".html"), null);
  assert.equal(getLanguageForExt(".css"), null);
});

test("getLanguageForExt is case-insensitive", () => {
  assert.equal(getLanguageForExt(".JS"), "javascript");
  assert.equal(getLanguageForExt(".TS"), "typescript");
  assert.equal(getLanguageForExt(".Py"), "python");
});
