const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateScannablePath,
} = require("../src/lib/scannable-path");
const {
  scanSnippetContent,
  scanFileOnDisk,
} = require("../src/lib/snippet-scanner");
const fs = require("fs");
const os = require("os");
const path = require("path");

test("evaluateScannablePath allows JS/TS/Python/env/YAML/JSON", () => {
  assert.equal(evaluateScannablePath("src/api/handler.ts").scannable, true);
  assert.equal(evaluateScannablePath("src/app.py").scannable, true);
  assert.equal(evaluateScannablePath(".env.production").scannable, true);
  assert.equal(evaluateScannablePath(".github/workflows/ci.yml").scannable, true);
  assert.equal(evaluateScannablePath("package.json").scannable, true);
});

test("evaluateScannablePath skips Doom assets and unknowns", () => {
  assert.equal(evaluateScannablePath("MODELDEF").scannable, false);
  assert.equal(evaluateScannablePath("actors/weapon.zs").scannable, false);
  assert.equal(evaluateScannablePath("models/gun.md3").scannable, false);
  assert.equal(evaluateScannablePath("textures/skin.png").scannable, false);
  assert.equal(evaluateScannablePath("README.md").scannable, false);
  assert.equal(evaluateScannablePath("package-lock.json").scannable, false);
});

test("scanSnippetContent skips MODELDEF without scanning content", () => {
  const result = scanSnippetContent("Model MODELDEF { Path \"models\" }", {
    filePath: "MODELDEF",
  });
  assert.equal(result.skipped, true);
  assert.equal(result.findingCount, 0);
  assert.equal(result.reason, "unscannable-basename");
});

test("scanFileOnDisk skips unscannable files without reading as findings", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-skip-"));
  try {
    fs.writeFileSync(path.join(root, "MODELDEF"), "Model Foo {}\n");
    const result = scanFileOnDisk(root, "MODELDEF");
    assert.equal(result.skipped, true);
    assert.equal(result.findingCount, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanFileOnDisk skips NUL-byte buffers as binary", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-bin-"));
  try {
    fs.writeFileSync(path.join(root, "ok.ts"), Buffer.from([0x00, 0x01, 0x02, 0x03]));
    const result = scanFileOnDisk(root, "ok.ts");
    assert.equal(result.skipped, true);
    assert.equal(result.reason, "binary");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("slimScanResult always exposes agent finding keys", () => {
  const { slimScanResult } = require("../src/lib/scannable-path");
  const slim = slimScanResult({
    filePath: "src/auth.ts",
    findingCount: 1,
    blockingCount: 1,
    findings: [
      {
        filePath: "src/auth.ts",
        line: 14,
        pattern: "secure-transport",
        severity: "high",
        recommendedAction: "Use https",
      },
    ],
  });
  assert.equal(slim.ok, true);
  assert.equal(slim.next, "fix_then_rescan_once");
  assert.equal(slim.findings[0].file, "src/auth.ts");
  assert.equal(slim.findings[0].line, 14);
  assert.equal(slim.findings[0].rule, "secure-transport");
  assert.equal(slim.findings[0].severity, "high");
  assert.equal(slim.findings[0].fix, "Use https");
});

test("readCodeMapHint returns counts and capped entry points", () => {
  const { readCodeMapHint } = require("../src/lib/scannable-path");
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-map-"));
  try {
    assert.equal(readCodeMapHint(root), null);
    fs.mkdirSync(path.join(root, ".simplebeacon"));
    fs.writeFileSync(
      path.join(root, ".simplebeacon", "codemap.json"),
      JSON.stringify({
        files: ["a.ts", "b.ts"],
        entryPoints: ["src/index.ts", "src/cli.ts"],
      }),
    );
    const hint = readCodeMapHint(root);
    assert.equal(hint.fileCount, 2);
    assert.deepEqual(hint.entryPoints, ["src/index.ts", "src/cli.ts"]);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scanFileOnDisk returns cached result for unchanged hash", () => {
  const { resetFileScanCache } = require("../src/lib/snippet-scanner");
  resetFileScanCache();
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-hash-"));
  try {
    fs.writeFileSync(path.join(root, "a.js"), "const n = 1;\n");
    const first = scanFileOnDisk(root, "a.js");
    const second = scanFileOnDisk(root, "a.js");
    assert.equal(second.cached, true);
    assert.equal(second.reason, "unchanged-hash");
    assert.equal(second.findingCount, first.findingCount);
  } finally {
    resetFileScanCache();
    fs.rmSync(root, { recursive: true, force: true });
  }
});
