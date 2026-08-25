const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { createMcpToolHandlers, TOOL_DEFINITIONS } = require("../src/mcp/tools");

function makeTempProject() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-mcp-deploy-"));
  fs.mkdirSync(path.join(root, "api-server"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "api-server", "package.json"),
    JSON.stringify(
      {
        name: "test-api",
        version: "1.0.0",
        scripts: { start: "node server.cjs" },
      },
      null,
      2,
    ),
  );
  fs.writeFileSync(
    path.join(root, "api-server", "server.cjs"),
    "const port = process.env.PORT || 3000;\n",
  );
  fs.writeFileSync(
    path.join(root, "api-server", "render.yaml"),
    [
      "services:",
      "  - type: web",
      "    name: test-api",
      "    startCommand: node server.cjs",
      "    envVars:",
      "      - key: PORT",
      "        value: 10000",
    ].join("\n"),
  );
  fs.writeFileSync(
    path.join(root, "package.json"),
    JSON.stringify(
      {
        name: "test-monorepo",
        version: "1.0.0",
        private: true,
        workspaces: ["api-server"],
      },
      null,
      2,
    ),
  );
  return root;
}

test("scan_deployment_readiness is registered in TOOL_DEFINITIONS", () => {
  const tool = TOOL_DEFINITIONS.find(
    (t) => t.name === "scan_deployment_readiness",
  );
  assert.ok(tool, "scan_deployment_readiness should be in TOOL_DEFINITIONS");
  assert.ok(tool.description.includes("deployment topology"));
  assert.ok(tool.inputSchema.properties.projectRoot);
});

test("scan_deployment_readiness returns ready=true for clean project", async () => {
  const root = makeTempProject();
  try {
    const handlers = createMcpToolHandlers({ offline: true });
    const result = await handlers.scan_deployment_readiness({
      projectRoot: root,
    });
    assert.equal(result.content[0].type, "text");
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.ready, true);
    assert.equal(payload.blockingCount, 0);
    assert.equal(payload.localOnly, true);
    assert.ok(payload.scanned > 0);
    handlers.dispose();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scan_deployment_readiness returns ready=false when env var missing", async () => {
  const root = makeTempProject();
  try {
    // Add env var reference not in render.yaml
    fs.writeFileSync(
      path.join(root, "api-server", "server.cjs"),
      "const port = process.env.PORT || 3000;\nconst key = process.env.STRIPE_SECRET_KEY;\n",
    );
    const handlers = createMcpToolHandlers({ offline: true });
    const result = await handlers.scan_deployment_readiness({
      projectRoot: root,
    });
    const payload = JSON.parse(result.content[0].text);
    assert.equal(payload.ready, false);
    assert.ok(payload.blockingCount > 0);
    assert.ok(payload.blockingIssues.some((i) => i.rule === "SB-DEP-002"));
    handlers.dispose();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("scan_deployment_readiness returns structured payload", async () => {
  const root = makeTempProject();
  try {
    const handlers = createMcpToolHandlers({ offline: true });
    const result = await handlers.scan_deployment_readiness({
      projectRoot: root,
    });
    const payload = JSON.parse(result.content[0].text);
    assert.ok(typeof payload.ready === "boolean");
    assert.ok(typeof payload.scanned === "number");
    assert.ok(typeof payload.totalFindings === "number");
    assert.ok(Array.isArray(payload.blockingIssues));
    assert.ok(Array.isArray(payload.warningIssues));
    assert.ok(Array.isArray(payload.documentedExceptions));
    assert.equal(
      payload.methodology,
      "Deterministic topology scan — no code uploaded",
    );
    handlers.dispose();
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
