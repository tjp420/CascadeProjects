const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const {
  analyzeFullDirectory,
  resolveHashConcurrency,
} = require("../src/lib/full-directory-scanner");

test("resolveHashConcurrency defaults to 32 and caps at 64", () => {
  const prev = process.env.SIMPLEBEACON_HASH_CONCURRENCY;
  delete process.env.SIMPLEBEACON_HASH_CONCURRENCY;
  try {
    assert.equal(resolveHashConcurrency(100), 32);
    assert.equal(resolveHashConcurrency(8), 8);
    process.env.SIMPLEBEACON_HASH_CONCURRENCY = "4";
    assert.equal(resolveHashConcurrency(100), 4);
    process.env.SIMPLEBEACON_HASH_CONCURRENCY = "99";
    assert.equal(resolveHashConcurrency(100), 64);
  } finally {
    if (prev === undefined) delete process.env.SIMPLEBEACON_HASH_CONCURRENCY;
    else process.env.SIMPLEBEACON_HASH_CONCURRENCY = prev;
  }
});

test("analyzeFullDirectory hashes concurrently without dropping binary or json inventory", async () => {
  const prev = process.env.SIMPLEBEACON_HASH_CONCURRENCY;
  process.env.SIMPLEBEACON_HASH_CONCURRENCY = "4";
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-full-hash-"));
  try {
    const srcDir = path.join(tmp, "src");
    fs.mkdirSync(srcDir, { recursive: true });
    const text = "const n = 1;\n";
    fs.writeFileSync(path.join(srcDir, "ok.js"), text);
    fs.writeFileSync(path.join(srcDir, "broken.json"), "{not json");
    fs.writeFileSync(path.join(srcDir, "empty.txt"), "");
    fs.writeFileSync(path.join(srcDir, "blob.bin"), Buffer.from([0, 1, 2, 3]));
    const oversized = Buffer.alloc(64, 0x61);
    fs.writeFileSync(path.join(srcDir, "big.txt"), oversized);

    const report = await analyzeFullDirectory(tmp, {
      universal: true,
      maxContentBytes: 32,
      parallel: false,
      skipDirs: new Set([".git"]),
      rules: {
        productionLeak: false,
        agencyHandoff: false,
        euAiAct: false,
        tokenBleed: false,
        architectureDrift: false,
        fileNaming: false,
        security: false,
        fiction: false,
      },
    });

    assert.equal(report.stats.hashConcurrency, 4);
    assert.equal(report.stats.emptyFiles, 1);
    assert.equal(report.stats.filesBinaryHashed, 1);
    assert.equal(report.stats.jsonInvalid, 1);
    assert.equal(report.stats.filesLargeHashed, 1);
    const ok = report.files.find((f) => f.relativePath === "src/ok.js");
    assert.ok(ok);
    assert.equal(
      ok.hash,
      crypto.createHash("sha256").update(text).digest("hex"),
    );
    const blob = report.files.find((f) => f.relativePath === "src/blob.bin");
    assert.ok(blob.hash);
    assert.ok(
      report.issues.some(
        (i) => i.type === "Invalid JSON" && /broken\.json/.test(i.filePath),
      ),
    );
  } finally {
    if (prev === undefined) delete process.env.SIMPLEBEACON_HASH_CONCURRENCY;
    else process.env.SIMPLEBEACON_HASH_CONCURRENCY = prev;
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
