const { test } = require("node:test");
const assert = require("node:assert/strict");
const {
  SLIM_TOOL_NAMES,
  TOOL_DEFINITIONS,
  listToolDefinitions,
  resolveMcpToolProfile,
} = require("../src/mcp/tools");
const { createMcpStdioServer } = require("../src/mcp/stdio-server");

test("default MCP tool profile is slim", () => {
  const prev = process.env.SIMPLEBEACON_MCP_PROFILE;
  delete process.env.SIMPLEBEACON_MCP_PROFILE;
  try {
    assert.equal(resolveMcpToolProfile({ argv: [] }), "slim");
    const listed = listToolDefinitions({ argv: [] });
    assert.equal(listed.length, SLIM_TOOL_NAMES.length);
    assert.ok(listed.every((t) => SLIM_TOOL_NAMES.includes(t.name)));
    assert.ok(!listed.some((t) => t.name === "scan_project"));
    assert.ok(!listed.some((t) => t.name === "suggest_fixes"));
    assert.ok(!listed.some((t) => t.name === "generate_marketing"));
  } finally {
    if (prev !== undefined) process.env.SIMPLEBEACON_MCP_PROFILE = prev;
  }
});

test("full MCP profile lists every tool definition", () => {
  const listed = listToolDefinitions({ fullTools: true });
  assert.equal(listed.length, TOOL_DEFINITIONS.length);
  assert.ok(listed.some((t) => t.name === "scan_deployment_readiness"));
});

test("stdio tools/list defaults to slim", () => {
  const prev = process.env.SIMPLEBEACON_MCP_PROFILE;
  delete process.env.SIMPLEBEACON_MCP_PROFILE;
  try {
    const server = createMcpStdioServer({ offline: true, argv: [] });
    assert.equal(server.toolProfile, "slim");
    assert.equal(server.toolListResult().tools.length, SLIM_TOOL_NAMES.length);
  } finally {
    if (prev !== undefined) process.env.SIMPLEBEACON_MCP_PROFILE = prev;
  }
});
