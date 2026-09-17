// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  scanSnippetContent,
  readGateStatus,
} = require("../src/lib/snippet-scanner");
const { explainFinding } = require("../src/mcp/rule-catalog");
const { createMcpToolHandlers } = require("../src/mcp/tools");
const { createMcpStdioServer } = require("../src/mcp/stdio-server");

test("scanSnippetContent detects mock path in snippet", () => {
  const result = scanSnippetContent(
    "const data = require('../web/data/status-sample.json');\n",
    { filePath: "src/api/handler.js" },
  );
  assert.ok(result.findingCount >= 1);
  assert.ok(
    result.findings.some((f) => f.type === "Production Leak" || f.pattern),
  );
});

test("scanSnippetContent detects LLM placeholder slop", () => {
  const result = scanSnippetContent('const endpoint = "YOUR_API_KEY_HERE";\n', {
    filePath: "src/util.js",
  });
  assert.ok(result.findings.some((f) => f.pattern === "SB-FICTION-001"));
});

test("scanSnippetContent detects credential pattern", () => {
  const result = scanSnippetContent('const key = "AKIA1A2B3C4D5E6F7G8H";\n', {
    filePath: "config.js",
  });
  assert.ok(result.blockingCount >= 1);
});

test("explainFinding returns production leak metadata", () => {
  const info = explainFinding("sample-json");
  assert.equal(info.found, true);
  assert.equal(info.category, "production-leak");
  assert.equal(info.usesLlm, false);
});

test("MCP tool handlers return JSON content blocks", () => {
  const handlers = createMcpToolHandlers({ offline: true });
  const out = handlers.scan_snippet({
    content: "import data from '../web/data/status-sample.json';\n",
    filePath: "src/api/handler.js",
  });
  assert.equal(out.content[0].type, "text");
  const parsed = JSON.parse(out.content[0].text);
  assert.ok(Array.isArray(parsed.findings));
});

test("explain_finding appends codeMap hint when codemap.json exists", () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const handlers = createMcpToolHandlers({ offline: true });
  const withoutMap = JSON.parse(
    handlers.explain_finding({ patternId: "SB-FICTION-001" }).content[0].text,
  );
  assert.equal(withoutMap.found, true);
  assert.equal(withoutMap.codeMap, undefined);

  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-mcp-map-"));
  try {
    fs.mkdirSync(path.join(root, ".simplebeacon"));
    fs.writeFileSync(
      path.join(root, ".simplebeacon", "codemap.json"),
      JSON.stringify({
        files: ["src/a.ts", "src/b.ts", "src/c.ts"],
        entryPoints: ["src/index.ts"],
      }),
    );
    const withMap = JSON.parse(
      handlers.explain_finding({
        patternId: "SB-FICTION-001",
        projectRoot: root,
      }).content[0].text,
    );
    assert.equal(withMap.codeMap.fileCount, 3);
    assert.deepEqual(withMap.codeMap.entryPoints, ["src/index.ts"]);
    assert.equal(withMap.codeMap.files, undefined);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MCP stdio server exposes slim tools by default and fifteen when full", () => {
  const slim = createMcpStdioServer({ offline: true, toolProfile: "slim" });
  assert.equal(slim.toolListResult().tools.length, 5);
  assert.ok(slim.toolListResult().tools.some((t) => t.name === "gate_status"));
  assert.ok(
    slim
      .toolListResult()
      .tools.some((t) => t.name === "simplebeacon_workspace_context"),
  );
  assert.ok(!slim.toolListResult().tools.some((t) => t.name === "scan_project"));
  assert.ok(!slim.toolListResult().tools.some((t) => t.name === "suggest_fixes"));
  const full = createMcpStdioServer({ offline: true, fullTools: true });
  assert.equal(full.toolListResult().tools.length, 15);
  assert.ok(full.toolListResult().tools.some((t) => t.name === "scan_project"));
  assert.ok(full.toolListResult().tools.some((t) => t.name === "get_action_plan"));
  assert.ok(
    full.toolListResult().tools.some((t) => t.name === "scan_deployment_readiness"),
  );
});

test("readGateStatus handles missing report gracefully", () => {
  const fs = require("fs");
  const os = require("os");
  const path = require("path");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-mcp-"));
  const status = readGateStatus(tmp);
  assert.equal(status.ok, false);
  assert.match(status.error, /No report found/);
});
