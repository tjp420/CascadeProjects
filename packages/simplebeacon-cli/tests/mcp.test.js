// simplebeacon-ignore: Scanner pattern definitions, test fixtures, and dashboard code, security — all findings are false positives
const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
    scanSnippetContent,
    readGateStatus
} = require('../src/lib/snippet-scanner');
const { explainFinding } = require('../src/mcp/rule-catalog');
const { createMcpToolHandlers } = require('../src/mcp/tools');
const { createMcpStdioServer } = require('../src/mcp/stdio-server');

test('scanSnippetContent detects mock path in snippet', () => {
    const result = scanSnippetContent(
        "const data = require('../web/data/status-sample.json');\n",
        { filePath: 'src/api/handler.js' }
    );
    assert.ok(result.findingCount >= 1);
    assert.ok(result.findings.some((f) => f.type === 'Production Leak' || f.pattern));
});

test('scanSnippetContent detects LLM placeholder slop', () => {
    const result = scanSnippetContent(
        'const endpoint = "YOUR_API_KEY_HERE";\n',
        { filePath: 'src/util.js' }
    );
    assert.ok(result.findings.some((f) => f.pattern === 'SB-FICTION-001'));
});

test('scanSnippetContent detects credential pattern', () => {
    const result = scanSnippetContent(
        'const key = "AKIA1A2B3C4D5E6F7G8H";\n',
        { filePath: 'config.js' }
    );
    assert.ok(result.blockingCount >= 1);
});

test('explainFinding returns production leak metadata', () => {
    const info = explainFinding('sample-json');
    assert.equal(info.found, true);
    assert.equal(info.category, 'production-leak');
    assert.equal(info.usesLlm, false);
});

test('MCP tool handlers return JSON content blocks', () => {
    const handlers = createMcpToolHandlers({ offline: true });
    const out = handlers.scan_snippet({
        content: "import data from '../web/data/status-sample.json';\n",
        filePath: 'src/api/handler.js'
    });
    assert.equal(out.content[0].type, 'text');
    const parsed = JSON.parse(out.content[0].text);
    assert.ok(Array.isArray(parsed.findings));
});

test('MCP stdio server exposes thirteen tools', () => {
    const server = createMcpStdioServer({ offline: true });
    const list = server.toolListResult();
    assert.equal(list.tools.length, 13);
    assert.ok(list.tools.some((t) => t.name === 'gate_status'));
    assert.ok(list.tools.some((t) => t.name === 'scan_project'));
    assert.ok(list.tools.some((t) => t.name === 'get_action_plan'));
});

test('readGateStatus handles missing report gracefully', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sb-mcp-'));
    const status = readGateStatus(tmp);
    assert.equal(status.ok, false);
    assert.match(status.error, /No report found/);
});
