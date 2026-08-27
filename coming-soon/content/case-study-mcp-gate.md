# Case Study: MCP stdio Compression Mangled Scan Results — AI Agents Saw 0 Findings When 2 Critical Issues Existed

**Date:** 2026-08-26
**Severity:** Production-breaking
**Component:** MCP stdio server (`packages/simplebeacon-cli/src/mcp/stdio-server.js`)
**Status:** Fixed in v3.0.532

## Summary

A payload compression layer in the MCP stdio server was silently destroying scan results before they reached AI agents. When an AI agent called `scan_snippet` via MCP stdio, the server returned `{s:{pass:false,block:0}, i:[]}` — showing **zero findings** — even when the scanner had detected **2 critical-severity production-leak issues**. The bug was caught by the integration test suite, not by manual testing or user reports.

## The Bug

### Architecture

The MCP stdio server applies two compression layers to tool results before sending them to the LLM agent:

1. **Payload compression** (`compressToolPayload`) — routes specific tool results through `compressScanReport`, `compressGateStatus`, or `compressSuggestions` based on tool name
2. **TOON compression** (`compressToolResult`) — recursively strips null/undefined/empty fields

### Root Cause

The `reportTools` set included `scan_snippet` and `scan_file`:

```javascript
const reportTools = new Set([
  "scan_project",
  "scan_snippet",    // BUG: not a full report
  "scan_file",       // BUG: not a full report
  "scan_staged",
  "scan_deployment_readiness"
]);
```

`compressScanReport` expects a full scan report with `gate`, `detectedIssues`, `severityCounts` fields. But `scan_snippet` returns a compact object:

```json
{
  "filePath": "src/handler.js",
  "findingCount": 2,
  "blockingCount": 2,
  "findings": [...]
}
```

When `compressScanReport` processed this, it found no `gate` field (defaulted to `{}`), no `detectedIssues` (defaulted to `[]`), and produced:

```json
{
  "s": {"pass": false, "block": 0, "warn": 0, "crit": 0, "high": 0, "med": 0, "low": 0, "files": 0, "lines": 0, "score": null, "time": 0},
  "i": []
}
```

The `findingCount`, `blockingCount`, and entire `findings` array were silently discarded.

### Same bug in gate_status

The `gateTools` set included `gate_status` and `handoff_check`:

```javascript
const gateTools = new Set([
  "gate_status",     // BUG: returns {ok, gatePass}, not raw gate
  "handoff_check",   // BUG: returns {agentId, gate}, not raw gate
  "gate_finalize"
]);
```

`compressGateStatus` expects a raw gate object with `pass`, `blockingIssues`, `warningIssues`. But `gate_status` returns `{ok: true, gatePass: true, blockingCount: 0, ...}`. The `ok` field was lost, and the test `assert.equal(typeof gatePayload.ok, "boolean")` failed.

## Reproduction

### Before fix (v3.0.531)

```
$ echo '{"jsonrpc":"2.0","id":3,"method":"tools/call","params":{"name":"scan_snippet","arguments":{"content":"import x from '../web/data/status-sample.json';\n","filePath":"src/handler.js"}}}' | node bin/simplebeacon-mcp.js --offline

{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\"s\":{\"pass\":false,\"block\":0,\"warn\":0,\"crit\":0,\"high\":0,\"med\":0,\"low\":0,\"files\":0,\"lines\":0,\"score\":null,\"time\":0},\"i\":[]}"}]}}
```

**0 findings reported. 2 critical issues hidden.**

### Direct scan (no MCP stdio compression)

```
$ node -e "const {scanSnippetContent}=require('./src/lib/snippet-scanner'); const r=scanSnippetContent('import x from \'../web/data/status-sample.json\';\n', {filePath:'src/handler.js'}); console.log(JSON.stringify(r, null, 2))"

{
  "filePath": "src/handler.js",
  "findingCount": 2,
  "blockingCount": 2,
  "findings": [
    {
      "severity": "critical",
      "type": "production-leak",
      "pattern": "sample-json",
      "description": "src/handler.js:1 references mock/sample path (sample-json)",
      "recommendedAction": "Replace hardcoded sample data imports with measured runtime API/scanner output before release"
    },
    {
      "severity": "critical",
      "type": "production-leak",
      "pattern": "web-data-sample",
      "description": "src/handler.js:1 references mock/sample path (web-data-sample)",
      "recommendedAction": "Replace hardcoded sample data imports with measured runtime API/scanner output before release"
    }
  ]
}
```

**2 critical findings. The scanner worked. The compression layer destroyed them.**

### After fix (v3.0.532)

```
{"jsonrpc":"2.0","id":3,"result":{"content":[{"type":"text","text":"{\n  \"filePath\": \"src/handler.js\",\n  \"findingCount\": 2,\n  \"blockingCount\": 2,\n  \"findings\": [...]\n}"}]}}
```

**2 findings reported correctly.**

## Impact

| Metric | Value |
|--------|-------|
| Findings hidden per scan | All of them (100% data loss) |
| Affected tools | `scan_snippet`, `scan_file`, `gate_status`, `handoff_check` |
| Affected users | Any AI agent connecting via MCP stdio (Cursor, Windsurf, Continue, Cline) |
| Duration | Present since v3.0.531 (compression feature release) |
| Severity | Critical — AI agents had zero visibility into scan results |

## How It Was Caught

The integration test `tests/mcp-stdio.integration.test.js` spawns the MCP server as a subprocess and exercises the full JSON-RPC pipeline:

```javascript
test("MCP stdio: initialize, tools/list, scan_snippet, gate_status", async () => {
  const { lines, exitCode } = await sendMcpSession([
    INIT, INITIALIZED,
    { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} },
    {
      jsonrpc: "2.0", id: 3, method: "tools/call",
      params: {
        name: "scan_snippet",
        arguments: {
          content: "import x from '../web/data/status-sample.json';\n",
          filePath: "src/handler.js",
        },
      },
    },
    // ...
  ]);
  const snippetPayload = JSON.parse(snippet.result.content[0].text);
  assert.ok(snippetPayload.findingCount >= 1);  // FAILED — findingCount was undefined
});
```

The test failed with:
```
AssertionError: The expression evaluated to a falsy value:
assert.ok(snippetPayload.findingCount >= 1)
```

Because `findingCount` was `undefined` — the compression layer had stripped it.

## The Fix

Removed `scan_snippet` and `scan_file` from `reportTools` (they have their own `compressed` arg for per-finding compression). Removed `gate_status` and `handoff_check` from `gateTools` (they return status objects, not raw gates). Both still get TOON compression (strips empty/null fields).

```javascript
// Before (buggy):
const reportTools = new Set(["scan_project", "scan_snippet", "scan_file", "scan_staged", "scan_deployment_readiness"]);
const gateTools = new Set(["gate_status", "handoff_check", "gate_finalize"]);

// After (fixed):
const reportTools = new Set(["scan_project", "scan_staged", "scan_deployment_readiness"]);
const gateTools = new Set(["gate_finalize"]);
```

## Verification

| Test | Before | After |
|------|--------|-------|
| MCP stdio integration tests | 1/3 pass | 3/3 pass |
| CLI tests (npm test) | 937/937 pass | 937/937 pass |
| Extension tests | 647/647 pass | 647/647 pass |
| Gate scan | PASS, 0 blocking | PASS, 0 blocking |
| npm prepublishOnly | Failed (required --ignore-scripts) | Passed cleanly |

## Lessons

1. **Integration tests are the last line of defense.** Unit tests on `scanSnippetContent` passed. Unit tests on `compressScanReport` passed. The bug only appeared when the two were composed through the stdio server. The integration test caught what unit tests couldn't.

2. **Compression layers are dangerous.** Adding a transformation step between the scanner and the consumer silently destroyed data. The compression function wasn't broken — it correctly compressed what it received. The bug was in the routing: applying a report-level compressor to a snippet-level result.

3. **Type mismatches are silent.** `compressScanReport` didn't throw when it received a snippet result — it just returned an empty-shaped object. JavaScript's lack of type safety meant the mismatch was invisible until an integration test checked the output shape.

---

*This case study documents a real bug caught by SimpleBeacon's own test suite in a real codebase. The scan outputs are unmodified terminal output. No metrics were fabricated.*
