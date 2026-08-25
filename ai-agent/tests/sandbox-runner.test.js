"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  createSandbox,
  applyPatch,
  runCommand,
  syntaxCheck,
  cleanupSandbox,
  sandboxPatchAndTest,
} = require("../plugins/sandbox-runner.cjs");

test("createSandbox copies files into a temp directory", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-sb-test-"));
  fs.writeFileSync(path.join(tmp, "app.js"), "function app() { return 42; }");
  fs.writeFileSync(path.join(tmp, "config.json"), '{"key":"value"}');

  const sandbox = createSandbox(tmp, ["app.js", "config.json"]);
  assert.ok(fs.existsSync(path.join(sandbox, "app.js")));
  assert.ok(fs.existsSync(path.join(sandbox, "config.json")));
  assert.equal(
    fs.readFileSync(path.join(sandbox, "app.js"), "utf8"),
    "function app() { return 42; }",
  );

  cleanupSandbox(sandbox);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("createSandbox skips non-existent files", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-sb-skip-"));
  const sandbox = createSandbox(tmp, ["nonexistent.js"]);
  assert.ok(!fs.existsSync(path.join(sandbox, "nonexistent.js")));
  cleanupSandbox(sandbox);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("applyPatch replaces text in sandbox file", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-patch-"));
  fs.writeFileSync(path.join(tmp, "target.js"), "const x = 1;\nconst y = 2;\n");

  const sandbox = createSandbox(tmp, ["target.js"]);
  const result = applyPatch(
    sandbox,
    "target.js",
    "const x = 1;",
    "const x = 42;",
  );
  assert.ok(result.ok);
  assert.ok(result.diff.includes("-const x = 1;"));
  assert.ok(result.diff.includes("+const x = 42;"));
  assert.ok(
    fs
      .readFileSync(path.join(sandbox, "target.js"), "utf8")
      .includes("const x = 42;"),
  );

  cleanupSandbox(sandbox);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("applyPatch fails when search string not found", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-patch-fail-"));
  fs.writeFileSync(path.join(tmp, "target.js"), "const x = 1;\n");

  const sandbox = createSandbox(tmp, ["target.js"]);
  const result = applyPatch(
    sandbox,
    "target.js",
    "nonexistent code",
    "replacement",
  );
  assert.ok(!result.ok);
  assert.ok(result.error.includes("Search string not found"));

  cleanupSandbox(sandbox);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("syntaxCheck validates JS files", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-syntax-"));
  fs.writeFileSync(path.join(tmp, "valid.js"), "const x = 1;\n");
  fs.writeFileSync(path.join(tmp, "invalid.js"), "const x = ;\n");

  const sandbox = createSandbox(tmp, ["valid.js", "invalid.js"]);
  const validResult = syntaxCheck(sandbox, "valid.js");
  assert.ok(validResult.ok);

  const invalidResult = syntaxCheck(sandbox, "invalid.js");
  assert.ok(!invalidResult.ok);

  cleanupSandbox(sandbox);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("syntaxCheck skips unknown extensions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-syntax-skip-"));
  fs.writeFileSync(path.join(tmp, "data.txt"), "hello world");

  const sandbox = createSandbox(tmp, ["data.txt"]);
  const result = syntaxCheck(sandbox, "data.txt");
  assert.ok(result.ok); // skipped = ok

  cleanupSandbox(sandbox);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("sandboxPatchAndTest runs full workflow", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-full-"));
  fs.writeFileSync(
    path.join(tmp, "math.js"),
    "function add(a, b) {\n  return a + b;\n}\nmodule.exports = { add };",
  );

  const result = await sandboxPatchAndTest(
    tmp,
    ["math.js"],
    {
      path: "math.js",
      search: "return a + b;",
      replace: "return a - b;",
    },
    { testCommand: "node", testArgs: ["-e", 'require("./math.js")'] },
  );

  assert.ok(result.applied);
  assert.ok(result.syntaxOk);
  // Test command runs node -e which should succeed (exit 0)
  // even though the function now subtracts — the test just requires the module
  cleanupSandbox(tmp, { recursive: true, force: true });
});

test("cleanupSandbox removes the directory", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-cleanup-"));
  fs.writeFileSync(path.join(tmp, "file.js"), "test");
  const sandbox = createSandbox(tmp, ["file.js"]);
  assert.ok(fs.existsSync(sandbox));
  cleanupSandbox(sandbox);
  assert.ok(!fs.existsSync(sandbox));
  fs.rmSync(tmp, { recursive: true, force: true });
});
