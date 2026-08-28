const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const { scanAstStructural } = require("../../src/rules/ast-structural-scanner");

async function withTempProject(files, fn) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "sb-ast-struct-"));
  for (const [rel, content] of Object.entries(files)) {
    const full = path.join(dir, ...rel.split("/"));
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, content, "utf8");
  }
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

test("SB-QUAL-006 flags triple-nested try/catch (depth=3)", async () => {
  const code = `
function evaluateTelemetryState() {
    try {
        try {
            try {
                console.log("deep slop");
            } catch (e) { throw e; }
        } catch (innerErr) { throw innerErr; }
    } catch (outerErr) { throw outerErr; }
}
`;
  const result = await withTempProject({ "src/index.js": code }, (dir) =>
    scanAstStructural(dir, { sourcePaths: ["src"] }),
  );

  const nested = result.issues.filter(
    (i) => i.metadata?.ruleId === "SB-QUAL-006",
  );
  assert.equal(nested.length, 1, "should flag exactly one triple-nested try/catch");
  assert.equal(nested[0].severity, "medium");
  assert.match(nested[0].description, /3 levels deep/);
});

test("SB-QUAL-006 does not flag double-nested try/catch (depth=2)", async () => {
  const code = `
function normalErrorHandling() {
    try {
        try {
            console.log("acceptable nesting");
        } catch (e) { throw e; }
    } catch (outer) { throw outer; }
}
`;
  const result = await withTempProject({ "src/index.js": code }, (dir) =>
    scanAstStructural(dir, { sourcePaths: ["src"] }),
  );

  const nested = result.issues.filter(
    (i) => i.metadata?.ruleId === "SB-QUAL-006",
  );
  assert.equal(nested.length, 0, "should not flag double-nested try/catch");
});

test("SB-QUAL-006 does not flag single try/catch", async () => {
  const code = `
function simpleHandler() {
    try {
        console.log("normal code");
    } catch (e) {
        console.error(e);
    }
}
`;
  const result = await withTempProject({ "src/index.js": code }, (dir) =>
    scanAstStructural(dir, { sourcePaths: ["src"] }),
  );

  const nested = result.issues.filter(
    (i) => i.metadata?.ruleId === "SB-QUAL-006",
  );
  assert.equal(nested.length, 0, "should not flag single try/catch");
});

test("SB-QUAL-006 flags multiple triple-nested blocks in different files", async () => {
  const code = `
function deepNest() {
    try { try { try { } catch(a) { throw a; } } catch(b) { throw b; } } catch(c) { throw c; }
}
`;
  const result = await withTempProject(
    { "src/a.js": code, "src/b.js": code },
    (dir) => scanAstStructural(dir, { sourcePaths: ["src"] }),
  );

  const nested = result.issues.filter(
    (i) => i.metadata?.ruleId === "SB-QUAL-006",
  );
  assert.equal(nested.length, 2, "should flag both files");
});

test("ast-structural scanner falls back to root when sourcePaths do not exist", async () => {
  const code = `
function deepNest() {
    try { try { try { } catch(a) { throw a; } } catch(b) { throw b; } } catch(c) { throw c; }
}
`;
  // No src/lib/server/web dirs — just a flat file at root
  const result = await withTempProject({ "index.js": code }, (dir) =>
    scanAstStructural(dir, { sourcePaths: ["src", "lib", "server", "web"] }),
  );

  assert.ok(result.scanned > 0, "should scan files via root fallback");
  const nested = result.issues.filter(
    (i) => i.metadata?.ruleId === "SB-QUAL-006",
  );
  assert.equal(nested.length, 1, "should find the triple-nested block via fallback");
});
