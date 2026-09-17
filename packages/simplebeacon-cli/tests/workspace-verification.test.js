"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { verifyAgentRequest } = require("../src/lib/workspace-verification");
const { createMcpToolHandlers } = require("../src/mcp/tools");

test("verifyAgentRequest blocks missing symbols without inventing them", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-preflight-"));
  try {
    fs.mkdirSync(path.join(root, "src", "auth"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "auth", "login.js"),
      'const db = require("./database.js");\nfunction login() { return true; }\n',
    );
    fs.writeFileSync(
      path.join(root, "src", "auth", "database.js"),
      "function connect() { return true; }\n",
    );

    const payload = verifyAgentRequest({
      workspaceRoot: root,
      files: ["src/auth/login.js"],
      symbols: [
        { file: "src/auth/login.js", symbol: "login" },
        { file: "src/auth/login.js", symbol: "calculateRisk" },
      ],
    });

    assert.equal(payload.simplebeacon.operation, "workspace_verification");
    assert.equal(payload.file.exists, true);
    assert.equal(payload.simplebeacon.verified, false);
    assert.deepEqual(
      payload.verification.find((row) => row.symbol === "login"),
      { file: "src/auth/login.js", symbol: "login", status: "found" },
    );
    assert.deepEqual(
      payload.verification.find((row) => row.symbol === "calculateRisk"),
      {
        file: "src/auth/login.js",
        symbol: "calculateRisk",
        status: "not_found",
      },
    );
    assert.ok(
      payload.blockers.some(
        (row) =>
          row.type === "missing_symbol" && row.symbol === "calculateRisk",
      ),
    );
    assert.ok(payload.relevantFiles.includes("src/auth/login.js"));
    assert.ok(payload.relevantFiles.includes("src/auth/database.js"));
    assert.equal(payload.unresolvedImports.length, 0);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("verifyAgentRequest blocks missing files", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-preflight-miss-"));
  try {
    const payload = verifyAgentRequest({
      workspaceRoot: root,
      files: ["src/missing.js"],
    });
    assert.equal(payload.file.exists, false);
    assert.equal(payload.blockers[0].type, "missing_file");
    assert.equal(payload.blockers[0].status, "not_found");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("MCP simplebeacon_workspace_context returns JSON blockers", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "sb-preflight-mcp-"));
  try {
    fs.mkdirSync(path.join(root, "src"), { recursive: true });
    fs.writeFileSync(
      path.join(root, "src", "login.js"),
      "function login() { return true; }\n",
    );
    const handlers = createMcpToolHandlers({ offline: true });
    const out = handlers.simplebeacon_workspace_context({
      projectRoot: root,
      files: ["src/login.js"],
      symbols: [{ file: "src/login.js", symbol: "calculateRisk" }],
    });
    const parsed = JSON.parse(out.content[0].text);
    assert.equal(parsed.verification[0].status, "not_found");
    assert.equal(parsed.blockers[0].type, "missing_symbol");
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
