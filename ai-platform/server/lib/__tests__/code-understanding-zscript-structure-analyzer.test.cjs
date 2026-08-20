"use strict";

const fs = require("fs");
const path = require("path");
const os = require("os");
const {
  collectZscriptFiles,
  parseZscriptFile,
  buildStructureReport,
} = require("../code-understanding/zscript-structure-analyzer.cjs");

describe("code-understanding/zscript-structure-analyzer", () => {
  test("exports expected functions", () => {
    expect(typeof collectZscriptFiles).toBe("function");
    expect(typeof parseZscriptFile).toBe("function");
    expect(typeof buildStructureReport).toBe("function");
  });

  test("collectZscriptFiles returns array", async () => {
    const result = await collectZscriptFiles("/nonexistent/path");
    expect(Array.isArray(result)).toBe(true);
  });

  test("parseZscriptFile returns object for valid content", () => {
    const content = "class MyActor : Actor { States { Spawn: TNT1 A 1; } }";
    const result = parseZscriptFile(content, "test.zs");
    expect(typeof result).toBe("object");
  });

  test("buildStructureReport returns object", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "zscript-test-"));
    fs.writeFileSync(path.join(tmpDir, "test.zs"), "class X : Actor { }");
    try {
      const result = await buildStructureReport(tmpDir);
      expect(typeof result).toBe("object");
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
