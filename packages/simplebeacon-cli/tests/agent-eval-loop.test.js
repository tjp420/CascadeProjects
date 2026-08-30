// simplebeacon-ignore: Test file — fixture paths and mock secrets are false positives
const { test, describe, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");

// We need to mock the scan module and fetch before requiring agent-eval-loop.
// Use Node's module cache override via require.cache injection.

const SCAN_MODULE_PATH = require.resolve("../src/scan");
const AGENT_EVAL_MODULE_PATH = require.resolve("../src/lib/agent-eval-loop");

/**
 * Helper: inject a mock scan module into the require cache.
 * @param {Object} mockRunScan - Mock implementation of runScan
 */
function mockScanModule(mockRunScan) {
  require.cache[SCAN_MODULE_PATH] = {
    id: SCAN_MODULE_PATH,
    filename: SCAN_MODULE_PATH,
    loaded: true,
    exports: { runScan: mockRunScan },
  };
}

/**
 * Helper: clear the agent-eval-loop module from cache so it re-requires
 * with the current scan module mock.
 */
function clearAgentEvalCache() {
  delete require.cache[AGENT_EVAL_MODULE_PATH];
}

/**
 * Helper: load agent-eval-loop with the current module cache state.
 * @returns {Object} The module exports
 */
function loadAgentEvalLoop() {
  clearAgentEvalCache();
  return require("../src/lib/agent-eval-loop");
}

/**
 * Build a mock scan result.
 * @param {Object} overrides
 * @returns {Object} Scan report shape matching runScan output
 */
function buildScanReport(overrides = {}) {
  return {
    issues: overrides.issues || [],
    findings: overrides.findings || overrides.issues || [],
    gate: {
      pass: overrides.pass ?? true,
      blockingCount: overrides.blockingCount || 0,
      ...overrides.gate,
    },
    qualityScore: overrides.qualityScore ?? 95,
    ...overrides.extra,
  };
}

/**
 * Build a mock finding/issue.
 * @param {Object} overrides
 * @returns {Object} Issue shape
 */
function buildIssue(overrides = {}) {
  return {
    severity: overrides.severity || "high",
    pattern: overrides.pattern || "ai-fiction-kpi",
    file: overrides.file || "src/handler.ts",
    line: overrides.line || 42,
    message: overrides.message || "Mock LLM placeholder detected",
    ...overrides.extra,
  };
}

// ─── extractCodeBlocks ────────────────────────────────────────────────────

describe("extractCodeBlocks", () => {
  let mod;
  beforeEach(() => {
    mockScanModule(async () => buildScanReport());
    mod = loadAgentEvalLoop();
  });

  test("extracts a single fenced block with language tag", () => {
    const text = "Here is code:\n```js\nconsole.log('hello');\n```\nDone.";
    const blocks = mod.extractCodeBlocks(text);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].language, "js");
    assert.equal(blocks[0].code, "console.log('hello');");
  });

  test("extracts a fenced block without language tag (defaults to txt)", () => {
    const text = "Code:\n```\nplain text code\n```";
    const blocks = mod.extractCodeBlocks(text);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].language, "txt");
    assert.equal(blocks[0].code, "plain text code");
  });

  test("extracts multiple fenced blocks", () => {
    const text =
      "First:\n```python\nprint(1)\n```\nSecond:\n```ts\nconst x: number = 1;\n```";
    const blocks = mod.extractCodeBlocks(text);
    assert.equal(blocks.length, 2);
    assert.equal(blocks[0].language, "python");
    assert.equal(blocks[0].code, "print(1)");
    assert.equal(blocks[1].language, "ts");
    assert.equal(blocks[1].code, "const x: number = 1;");
  });

  test("returns empty array when no fenced blocks present", () => {
    const text = "Just regular text without any code blocks.";
    const blocks = mod.extractCodeBlocks(text);
    assert.equal(blocks.length, 0);
  });

  test("handles empty fenced block", () => {
    const text = "Empty:\n```js\n```";
    const blocks = mod.extractCodeBlocks(text);
    // The regex requires at least \n after the opening fence, so empty block
    // with just ```js\n``` produces code = "" after trim
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].language, "js");
    assert.equal(blocks[0].code, "");
  });

  test("does not match inline backtick code (single backticks)", () => {
    const text = "Use `const x = 1` for variables.";
    const blocks = mod.extractCodeBlocks(text);
    assert.equal(blocks.length, 0);
  });

  test("handles multi-line code blocks with varying whitespace", () => {
    const text = "```js\n  function foo() {\n    return 42;\n  }\n```";
    const blocks = mod.extractCodeBlocks(text);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].code, "function foo() {\n    return 42;\n  }");
  });

  test("handles code blocks containing backtick-like content inside", () => {
    // Nested backticks inside a fenced block — the regex is non-greedy so
    // it matches up to the first closing ```
    const text = "```js\nconst s = \"hello\";\n```";
    const blocks = mod.extractCodeBlocks(text);
    assert.equal(blocks.length, 1);
    assert.equal(blocks[0].code, 'const s = "hello";');
  });
});

// ─── saveOutputToWorkspace ────────────────────────────────────────────────

describe("saveOutputToWorkspace", () => {
  let mod;
  let workspace;

  beforeEach(() => {
    mockScanModule(async () => buildScanReport());
    mod = loadAgentEvalLoop();
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sb-save-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(workspace, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });

  test("saves string output as response.txt", () => {
    const files = mod.saveOutputToWorkspace(workspace, "Hello world");
    assert.ok(files.some((f) => f.endsWith("response.txt")));
    const content = fs.readFileSync(
      path.join(workspace, "response.txt"),
      "utf8",
    );
    assert.equal(content, "Hello world");
  });

  test("saves string output with code blocks as separate files", () => {
    const output = "Here:\n```js\nconsole.log(1);\n```\nDone.";
    const files = mod.saveOutputToWorkspace(workspace, output);
    // response.txt + block-1.js
    assert.ok(files.some((f) => f.endsWith("response.txt")));
    assert.ok(files.some((f) => f.endsWith("block-1.js")));
    const blockContent = fs.readFileSync(
      path.join(workspace, "block-1.js"),
      "utf8",
    );
    assert.equal(blockContent, "console.log(1);");
  });

  test("saves array output as individual files", () => {
    const output = [
      { path: "src/handler.ts", content: "export const x = 1;" },
      { path: "src/utils.ts", content: "export const y = 2;" },
    ];
    const files = mod.saveOutputToWorkspace(workspace, output);
    assert.equal(files.length, 2);
    assert.ok(fs.existsSync(path.join(workspace, "src", "handler.ts")));
    assert.ok(fs.existsSync(path.join(workspace, "src", "utils.ts")));
  });

  test("creates nested directories for array output paths", () => {
    const output = [
      { path: "deep/nested/dir/file.js", content: "module.exports = 1;" },
    ];
    const files = mod.saveOutputToWorkspace(workspace, output);
    assert.equal(files.length, 1);
    assert.ok(
      fs.existsSync(
        path.join(workspace, "deep", "nested", "dir", "file.js"),
      ),
    );
  });

  test("skips array entries missing path or content", () => {
    const output = [
      { path: "valid.ts", content: "export const x = 1;" },
      { path: null, content: "no path" },
      { path: "no-content.ts", content: null },
      {},
    ];
    const files = mod.saveOutputToWorkspace(workspace, output);
    assert.equal(files.length, 1);
    assert.ok(fs.existsSync(path.join(workspace, "valid.ts")));
  });

  test("path traversal via .. is blocked and flattened to workspace root", () => {
    // Model output with .. segments that would escape the workspace.
    // The safeResolvePath guard should flatten to basename inside workspace.
    const output = [
      { path: "subdir/../../../escape.txt", content: "traversal attempt" },
    ];
    const files = mod.saveOutputToWorkspace(workspace, output);
    assert.equal(files.length, 1);

    // The file should be contained inside the workspace as escape.txt
    const safePath = path.join(workspace, "escape.txt");
    assert.ok(fs.existsSync(safePath), "File should be flattened to workspace root");
    assert.equal(
      fs.readFileSync(safePath, "utf8"),
      "traversal attempt",
    );

    // The file should NOT exist at the traversed path outside workspace
    const escapedPath = path.resolve(
      path.join(workspace, "subdir/../../../escape.txt"),
    );
    assert.ok(
      !escapedPath.startsWith(path.resolve(workspace) + path.sep),
      "Traversed path should resolve outside workspace",
    );
    assert.ok(!fs.existsSync(escapedPath), "File must not escape workspace boundary");
  });

  test("absolute path in model output is contained within workspace", () => {
    // An absolute path like /etc/passwd should not write outside workspace.
    // path.resolve(workspaceRoot, "/etc/passwd") returns "/etc/passwd" on Unix
    // which does not start with workspaceRoot — so it gets flattened.
    const output = [
      { path: "/etc/passwd", content: "should not write here" },
    ];
    const files = mod.saveOutputToWorkspace(workspace, output);
    assert.equal(files.length, 1);

    // Should be flattened to basename inside workspace
    const safePath = path.join(workspace, "passwd");
    assert.ok(fs.existsSync(safePath), "Absolute path should be flattened to workspace root");
    assert.equal(fs.readFileSync(safePath, "utf8"), "should not write here");
  });

  test("legitimate nested paths still work after containment guard", () => {
    // Normal relative paths without .. should work as before
    const output = [
      { path: "src/handler.ts", content: "export const x = 1;" },
      { path: "deep/nested/dir/file.js", content: "module.exports = 1;" },
    ];
    const files = mod.saveOutputToWorkspace(workspace, output);
    assert.equal(files.length, 2);
    assert.ok(fs.existsSync(path.join(workspace, "src", "handler.ts")));
    assert.ok(
      fs.existsSync(path.join(workspace, "deep", "nested", "dir", "file.js")),
    );
  });
});

// ─── formatFindingsSummary ────────────────────────────────────────────────

describe("formatFindingsSummary", () => {
  let mod;
  beforeEach(() => {
    mockScanModule(async () => buildScanReport());
    mod = loadAgentEvalLoop();
  });

  test("formats a passing gate", () => {
    const summary = mod.formatFindingsSummary([], { pass: true });
    assert.ok(summary.includes("PASS"));
    assert.ok(!summary.includes("Blocking"));
  });

  test("formats a failing gate with blocking count", () => {
    const summary = mod.formatFindingsSummary([], {
      pass: false,
      blockingCount: 3,
    });
    assert.ok(summary.includes("FAIL"));
    assert.ok(summary.includes("Blocking issues: 3"));
  });

  test("formats individual findings with severity, pattern, file, line", () => {
    const issues = [
      buildIssue({
        severity: "critical",
        pattern: "hardcoded-secret",
        file: "src/config.ts",
        line: 10,
        message: "API key detected",
      }),
    ];
    const summary = mod.formatFindingsSummary(issues, { pass: false });
    assert.ok(summary.includes("[CRITICAL]"));
    assert.ok(summary.includes("hardcoded-secret"));
    assert.ok(summary.includes("src/config.ts:10"));
    assert.ok(summary.includes("API key detected"));
  });

  test("truncates at 15 findings with a 'more' suffix", () => {
    const issues = [];
    for (let i = 0; i < 20; i++) {
      issues.push(buildIssue({ pattern: `pattern-${i}`, file: `f-${i}.ts` }));
    }
    const summary = mod.formatFindingsSummary(issues, { pass: false });
    assert.ok(summary.includes("... and 5 more findings"));
    // Should contain pattern-0 through pattern-14 but not pattern-15
    assert.ok(summary.includes("pattern-0"));
    assert.ok(summary.includes("pattern-14"));
    assert.ok(!summary.includes("pattern-15"));
  });

  test("handles empty issues array for failing gate", () => {
    const summary = mod.formatFindingsSummary([], {
      pass: false,
      blockingCount: 0,
    });
    assert.ok(summary.includes("FAIL"));
  });

  test("uses fallback values for missing fields", () => {
    const issues = [{}]; // no severity, pattern, file, line, message
    const summary = mod.formatFindingsSummary(issues, { pass: false });
    assert.ok(summary.includes("[MEDIUM]"));
    assert.ok(summary.includes("unknown"));
  });
});

// ─── scanWorkspace ────────────────────────────────────────────────────────

describe("scanWorkspace", () => {
  let workspace;

  beforeEach(() => {
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sb-scan-"));
  });

  afterEach(() => {
    try {
      fs.rmSync(workspace, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });

  test("returns passed=true when gate passes with no blocking issues", async () => {
    mockScanModule(async () => buildScanReport({ pass: true }));
    const mod = loadAgentEvalLoop();
    const result = await mod.scanWorkspace(workspace);
    assert.equal(result.passed, true);
    assert.equal(result.blockingCount, 0);
    assert.equal(result.highSeverityCount, 0);
  });

  test("returns passed=false when gate fails", async () => {
    mockScanModule(async () =>
      buildScanReport({
        pass: false,
        blockingCount: 2,
        issues: [buildIssue({ severity: "high" })],
      }),
    );
    const mod = loadAgentEvalLoop();
    const result = await mod.scanWorkspace(workspace);
    assert.equal(result.passed, false);
    assert.equal(result.blockingCount, 2);
    assert.equal(result.highSeverityCount, 1);
  });

  test("returns passed=false when high-severity issues exist even if gate passes", async () => {
    mockScanModule(async () =>
      buildScanReport({
        pass: true,
        blockingCount: 0,
        issues: [buildIssue({ severity: "critical" })],
      }),
    );
    const mod = loadAgentEvalLoop();
    const result = await mod.scanWorkspace(workspace);
    assert.equal(result.passed, false);
    assert.equal(result.highSeverityCount, 1);
  });

  test("includes qualityScore from scan report", async () => {
    mockScanModule(async () => buildScanReport({ qualityScore: 78 }));
    const mod = loadAgentEvalLoop();
    const result = await mod.scanWorkspace(workspace);
    assert.equal(result.qualityScore, 78);
  });

  test("includes summary string from formatFindingsSummary", async () => {
    mockScanModule(async () =>
      buildScanReport({
        pass: false,
        blockingCount: 1,
        issues: [buildIssue()],
      }),
    );
    const mod = loadAgentEvalLoop();
    const result = await mod.scanWorkspace(workspace);
    assert.ok(typeof result.summary === "string");
    assert.ok(result.summary.includes("FAIL"));
  });
});

// ─── callModel (mocked fetch) ─────────────────────────────────────────────

describe("callModel", () => {
  let originalFetch;

  beforeEach(() => {
    originalFetch = global.fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
  });

  test("throws when no API key is provided", async () => {
    mockScanModule(async () => buildScanReport());
    const mod = loadAgentEvalLoop();
    delete process.env.OPENAI_API_KEY;
    await assert.rejects(
      () => mod.callModel("test prompt", { apiKey: null }),
      /No API key provided/,
    );
  });

  test("returns content from successful API response", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "Generated code here" } }],
      }),
      text: async () => "",
    });

    mockScanModule(async () => buildScanReport());
    const mod = loadAgentEvalLoop();
    const result = await mod.callModel("test", { apiKey: "test-key" });
    assert.equal(result, "Generated code here");
  });

  test("throws on non-ok HTTP response", async () => {
    global.fetch = async () => ({
      ok: false,
      status: 401,
      text: async () => "Unauthorized",
    });

    mockScanModule(async () => buildScanReport());
    const mod = loadAgentEvalLoop();
    await assert.rejects(
      () => mod.callModel("test", { apiKey: "bad-key" }),
      /Model API error 401/,
    );
  });

  test("throws when response has no content", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({ choices: [{ message: {} }] }),
      text: async () => "",
    });

    mockScanModule(async () => buildScanReport());
    const mod = loadAgentEvalLoop();
    await assert.rejects(
      () => mod.callModel("test", { apiKey: "test-key" }),
      /Model returned empty response/,
    );
  });

  test("uses OPENAI_API_KEY env var as fallback", async () => {
    process.env.OPENAI_API_KEY = "env-key";
    let capturedAuth;
    global.fetch = async (_url, opts) => {
      capturedAuth = opts.headers.Authorization;
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "ok" } }],
        }),
        text: async () => "",
      };
    };

    mockScanModule(async () => buildScanReport());
    const mod = loadAgentEvalLoop();
    await mod.callModel("test", {});
    assert.equal(capturedAuth, "Bearer env-key");
  });
});

// ─── runAgentEvalLoop (lifecycle states) ──────────────────────────────────

describe("runAgentEvalLoop", () => {
  let originalFetch;
  let workspace;

  beforeEach(() => {
    originalFetch = global.fetch;
    workspace = fs.mkdtempSync(path.join(os.tmpdir(), "sb-loop-"));
  });

  afterEach(() => {
    global.fetch = originalFetch;
    delete process.env.OPENAI_API_KEY;
    try {
      fs.rmSync(workspace, { recursive: true, force: true });
    } catch {
      // best effort
    }
  });

  test("passes on first attempt when scan returns pass", async () => {
    let modelCallCount = 0;
    global.fetch = async () => ({
      ok: true,
      json: async () => {
        modelCallCount++;
        return {
          choices: [
            { message: { content: "```js\nconst x = 1;\n```" } },
          ],
        };
      },
      text: async () => "",
    });

    mockScanModule(async () => buildScanReport({ pass: true }));
    const mod = loadAgentEvalLoop();

    const result = await mod.runAgentEvalLoop({
      prompt: "Write a function",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: false,
    });

    assert.equal(result.passed, true);
    assert.equal(result.attempts, 1);
    assert.equal(modelCallCount, 1);
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0].passed, true);
  });

  test("corrects on retry when second scan passes", async () => {
    let modelCallCount = 0;
    global.fetch = async () => ({
      ok: true,
      json: async () => {
        modelCallCount++;
        return {
          choices: [
            { message: { content: `Attempt ${modelCallCount} code` } },
          ],
        };
      },
      text: async () => "",
    });

    let scanCallCount = 0;
    mockScanModule(async () => {
      scanCallCount++;
      if (scanCallCount === 1) {
        return buildScanReport({
          pass: false,
          blockingCount: 1,
          issues: [buildIssue()],
        });
      }
      return buildScanReport({ pass: true });
    });

    const mod = loadAgentEvalLoop();

    const result = await mod.runAgentEvalLoop({
      prompt: "Write a function",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: false,
      maxAttempts: 3,
    });

    assert.equal(result.passed, true);
    assert.equal(result.attempts, 2);
    assert.equal(modelCallCount, 2);
    assert.equal(result.history.length, 2);
    assert.equal(result.history[0].passed, false);
    assert.equal(result.history[1].passed, true);
  });

  test("exhausts max attempts when scan never passes", async () => {
    let modelCallCount = 0;
    global.fetch = async () => ({
      ok: true,
      json: async () => {
        modelCallCount++;
        return {
          choices: [{ message: { content: "always bad code" } }],
        };
      },
      text: async () => "",
    });

    mockScanModule(async () =>
      buildScanReport({
        pass: false,
        blockingCount: 5,
        issues: [buildIssue()],
      }),
    );

    const mod = loadAgentEvalLoop();

    const result = await mod.runAgentEvalLoop({
      prompt: "Write a function",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: false,
      maxAttempts: 3,
    });

    assert.equal(result.passed, false);
    assert.equal(result.attempts, 3);
    assert.equal(modelCallCount, 3);
    assert.equal(result.history.length, 3);
    assert.ok(result.history.every((h) => h.passed === false));
  });

  test("gracefully handles network fetch exception", async () => {
    global.fetch = async () => {
      throw new Error("ECONNREFUSED");
    };

    mockScanModule(async () => buildScanReport({ pass: true }));
    const mod = loadAgentEvalLoop();

    await assert.rejects(
      () =>
        mod.runAgentEvalLoop({
          prompt: "Write a function",
          apiKey: "test-key",
          workspaceDir: workspace,
          cleanup: false,
          maxAttempts: 3,
        }),
      /ECONNREFUSED/,
    );
  });

  test("calls onAttempt callback before each attempt", async () => {
    const attempts = [];
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "code" } }],
      }),
      text: async () => "",
    });

    mockScanModule(async () => buildScanReport({ pass: true }));
    const mod = loadAgentEvalLoop();

    await mod.runAgentEvalLoop({
      prompt: "Write code",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: false,
      onAttempt: ({ attempt, maxAttempts }) => {
        attempts.push({ attempt, maxAttempts });
      },
    });

    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].attempt, 1);
    assert.equal(attempts[0].maxAttempts, 3);
  });

  test("calls onScanComplete callback after each scan", async () => {
    const scans = [];
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "code" } }],
      }),
      text: async () => "",
    });

    let scanCallCount = 0;
    mockScanModule(async () => {
      scanCallCount++;
      if (scanCallCount === 1) {
        return buildScanReport({ pass: false, blockingCount: 1 });
      }
      return buildScanReport({ pass: true });
    });

    const mod = loadAgentEvalLoop();

    await mod.runAgentEvalLoop({
      prompt: "Write code",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: false,
      maxAttempts: 3,
      onScanComplete: ({ attempt, scanResult }) => {
        scans.push({ attempt, passed: scanResult.passed });
      },
    });

    assert.equal(scans.length, 2);
    assert.equal(scans[0].attempt, 1);
    assert.equal(scans[0].passed, false);
    assert.equal(scans[1].attempt, 2);
    assert.equal(scans[1].passed, true);
  });

  test("cleans up workspace by default on success", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "code" } }],
      }),
      text: async () => "",
    });

    mockScanModule(async () => buildScanReport({ pass: true }));
    const mod = loadAgentEvalLoop();

    const result = await mod.runAgentEvalLoop({
      prompt: "Write code",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: true,
    });

    assert.equal(result.workspace, null);
    assert.ok(!fs.existsSync(workspace), "Workspace should be removed");
  });

  test("preserves workspace when cleanup=false", async () => {
    global.fetch = async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "code" } }],
      }),
      text: async () => "",
    });

    mockScanModule(async () => buildScanReport({ pass: true }));
    const mod = loadAgentEvalLoop();

    const result = await mod.runAgentEvalLoop({
      prompt: "Write code",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: false,
    });

    assert.equal(result.workspace, workspace);
    assert.ok(fs.existsSync(workspace), "Workspace should be preserved");
  });

  test("throws when prompt is missing", async () => {
    mockScanModule(async () => buildScanReport());
    const mod = loadAgentEvalLoop();
    await assert.rejects(
      () => mod.runAgentEvalLoop({ apiKey: "test-key" }),
      /prompt is required/,
    );
  });

  test("appends scan findings to prompt on retry", async () => {
    const capturedPrompts = [];
    global.fetch = async (_url, opts) => {
      const body = JSON.parse(opts.body);
      capturedPrompts.push(body.messages[1].content);
      return {
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "code" } }],
        }),
        text: async () => "",
      };
    };

    let scanCallCount = 0;
    mockScanModule(async () => {
      scanCallCount++;
      if (scanCallCount === 1) {
        return buildScanReport({
          pass: false,
          blockingCount: 1,
          issues: [
            buildIssue({
              pattern: "test-pattern",
              file: "test.ts",
              line: 5,
              message: "Test finding",
            }),
          ],
        });
      }
      return buildScanReport({ pass: true });
    });

    const mod = loadAgentEvalLoop();

    await mod.runAgentEvalLoop({
      prompt: "Write a function",
      apiKey: "test-key",
      workspaceDir: workspace,
      cleanup: false,
      maxAttempts: 3,
    });

    assert.equal(capturedPrompts.length, 2);
    // First prompt should be the original
    assert.equal(capturedPrompts[0], "Write a function");
    // Second prompt should include the original + feedback
    assert.ok(capturedPrompts[1].includes("Write a function"));
    assert.ok(capturedPrompts[1].includes("SimpleBeacon Feedback"));
    assert.ok(capturedPrompts[1].includes("test-pattern"));
    assert.ok(capturedPrompts[1].includes("test.ts:5"));
  });
});
