const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  walkProject,
  summarizeFile,
  summarizeProject,
  buildIndex,
  extractFacts,
  DEFAULT_SKIP_DIRS,
} = require("../src/lib/project-summarizer");

function makeTmpProject() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-summarize-"));
  fs.mkdirSync(path.join(dir, "src"), { recursive: true });
  fs.mkdirSync(path.join(dir, "node_modules", "pkg"), { recursive: true });
  fs.writeFileSync(
    path.join(dir, "src", "foo.js"),
    [
      "const MAX_SIZE = 100;",
      "export function add(a, b) { return a + b; }",
      "export class Calculator { multiply(x, y) { return x * y; } }",
      "const helper = (a) => a + 1;",
      "module.exports = { add };",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(dir, "src", "bar.py"),
    ["def greet(name):", "    return f'hi {name}'", "class Bar:", "    pass", "import os"].join("\n"),
  );
  fs.writeFileSync(path.join(dir, "README.md"), "# Project\n\nDoes things.");
  // node_modules should be skipped
  fs.writeFileSync(path.join(dir, "node_modules", "pkg", "index.js"), "module.exports = 1;");
  return dir;
}

test("walkProject skips node_modules and .git", async () => {
  const dir = makeTmpProject();
  const files = await walkProject(dir);
  const rels = files.map((f) => f.relPath);
  assert.ok(!rels.some((r) => r.startsWith("node_modules/")), "should skip node_modules");
  assert.ok(rels.includes("src/foo.js"));
  assert.ok(rels.includes("src/bar.py"));
  assert.ok(rels.includes("README.md"));
});

test("walkProject respects maxFileBytes", async () => {
  const dir = makeTmpProject();
  fs.writeFileSync(path.join(dir, "big.txt"), "x".repeat(1024));
  const files = await walkProject(dir, { maxFileBytes: 100 });
  const rels = files.map((f) => f.relPath);
  assert.ok(!rels.includes("big.txt"), "should skip oversized file");
});

test("summarizeFile extracts JS facts", async () => {
  const dir = makeTmpProject();
  const summary = await summarizeFile({
    absPath: path.join(dir, "src", "foo.js"),
    relPath: "src/foo.js",
    ext: ".js",
    size: 200,
    mtimeMs: Date.now(),
  });
  assert.ok(summary.exports.includes("add"), `exports: ${JSON.stringify(summary.exports)}`);
  assert.ok(summary.classes.includes("Calculator"));
  assert.ok(summary.topConstants.includes("MAX_SIZE"));
  assert.ok(summary.signatures.some((s) => s.startsWith("add(")));
  assert.ok(summary.tokenEstimate > 0);
  assert.ok(summary.lines > 0);
  assert.ok(summary.summary.length > 0);
});

test("summarizeFile extracts Python facts", async () => {
  const dir = makeTmpProject();
  const summary = await summarizeFile({
    absPath: path.join(dir, "src", "bar.py"),
    relPath: "src/bar.py",
    ext: ".py",
    size: 100,
    mtimeMs: Date.now(),
  });
  assert.ok(summary.signatures.some((s) => s.startsWith("greet(")));
  assert.ok(summary.classes.includes("Bar"));
  assert.ok(summary.dependencies.includes("os"));
});

test("extractFacts returns empty arrays for empty content", () => {
  const facts = extractFacts("", ".js");
  assert.deepEqual(facts, { exports: [], signatures: [], classes: [], topConstants: [], dependencies: [] });
});

test("summarizeProject writes index.json and per-file summaries", async () => {
  const dir = makeTmpProject();
  const { index, summaries, outputDir } = await summarizeProject(dir);
  assert.ok(index.fileCount >= 3);
  assert.ok(summaries.length >= 3);
  assert.ok(fs.existsSync(path.join(outputDir, "index.json")));
  // per-file summary written
  const files = fs.readdirSync(outputDir).filter((f) => f.endsWith(".json"));
  assert.ok(files.length >= 3);
});

test("buildIndex aggregates categories and totals", () => {
  const summaries = [
    { path: "a.js", ext: ".js", category: "code", tokenEstimate: 100, lines: 10, sizeBytes: 500, summary: "a" },
    { path: "b.md", ext: ".md", category: "docs", tokenEstimate: 50, lines: 5, sizeBytes: 200, summary: "b" },
  ];
  const index = buildIndex(summaries);
  assert.equal(index.fileCount, 2);
  assert.equal(index.totalTokens, 150);
  assert.equal(index.byCategory.code.count, 1);
  assert.equal(index.byCategory.docs.count, 1);
});

test("summarizeProject sorts summaries by token cost descending", async () => {
  const dir = makeTmpProject();
  const { summaries } = await summarizeProject(dir);
  for (let i = 1; i < summaries.length; i++) {
    assert.ok(summaries[i - 1].tokenEstimate >= summaries[i].tokenEstimate, "should be sorted desc");
  }
});

test("DEFAULT_SKIP_DIRS includes node_modules and .git", () => {
  assert.ok(DEFAULT_SKIP_DIRS.has("node_modules"));
  assert.ok(DEFAULT_SKIP_DIRS.has(".git"));
});
