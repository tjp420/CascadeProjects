"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const os = require("os");
const path = require("path");
const {
  estimateTokens,
  scanAndSummarize,
  buildEmbeddingsAndIndex,
  topKContext,
  preparePromptForEdit,
  logTokenUsage,
  getTokenUsageSummary,
} = require("../plugins/token-optimizer.cjs");

// ─── estimateTokens ──────────────────────────────────────────────────────────

test("estimateTokens returns 0 for empty input", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
});

test("estimateTokens approximates 4 chars per token", () => {
  assert.equal(estimateTokens("hello world!"), 3); // 12 chars / 4 = 3
  assert.equal(estimateTokens("a"), 1); // 1 char / 4 = 0.25 -> ceil = 1
  assert.ok(estimateTokens("const x = 42;") > 0);
});

// ─── scanAndSummarize ────────────────────────────────────────────────────────

test("scanAndSummarize extracts functions and imports from a JS file", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-summarize-"));
  const testFile = path.join(tmp, "example.js");
  fs.writeFileSync(
    testFile,
    [
      "const path = require('path');",
      "const fs = require('fs');",
      "",
      "/** Add two numbers */",
      "function add(a, b) {",
      "  return a + b;",
      "}",
      "",
      "const multiply = (x, y) => x * y;",
      "",
      "async function fetchData(url) {",
      "  return await fetch(url);",
      "}",
      "",
      "module.exports = { add, multiply };",
    ].join("\n"),
  );

  const result = await scanAndSummarize(tmp, ["example.js"]);
  assert.equal(result.summaries.length, 1);
  const s = result.summaries[0];
  assert.equal(s.filePath, "example.js");
  assert.ok(s.functions.length >= 3);
  assert.ok(s.imports.length >= 2);
  assert.ok(s.estimatedTokens > 0);

  // Check function names
  const fnNames = s.functions.map((f) => f.name);
  assert.ok(fnNames.includes("add"));
  assert.ok(fnNames.includes("multiply"));
  assert.ok(fnNames.includes("fetchData"));

  // Check docstring extraction
  const addFn = s.functions.find((f) => f.name === "add");
  assert.ok(addFn.docstring && addFn.docstring.includes("Add two numbers"));

  fs.rmSync(tmp, { recursive: true, force: true });
});

test("scanAndSummarize skips non-existent files", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-summarize-skip-"));
  const result = await scanAndSummarize(tmp, ["nonexistent.js"]);
  assert.equal(result.summaries.length, 0);
  assert.equal(result.totalTokens, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("scanAndSummarize skips non-source files", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-summarize-nonsource-"));
  fs.writeFileSync(path.join(tmp, "readme.md"), "# Hello");
  const result = await scanAndSummarize(tmp, ["readme.md"]);
  assert.equal(result.summaries.length, 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ─── buildEmbeddingsAndIndex ─────────────────────────────────────────────────

test("buildEmbeddingsAndIndex creates chunks with embeddings", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-embed-"));
  fs.writeFileSync(
    path.join(tmp, "app.js"),
    [
      'function hello() { return "world"; }',
      'function goodbye() { return "bye"; }',
      "module.exports = { hello, goodbye };",
    ].join("\n"),
  );

  const result = await buildEmbeddingsAndIndex(tmp, {
    maxFiles: 10,
    chunkSize: 40,
  });
  assert.ok(result.fileCount >= 1);
  assert.ok(result.chunkCount >= 1);
  assert.ok(result.index[0].embedding.length === 128);
  assert.ok(result.index[0].tokenEstimate > 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("buildEmbeddingsAndIndex skips node_modules and .git", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-embed-skip-"));
  fs.mkdirSync(path.join(tmp, "node_modules"), { recursive: true });
  fs.writeFileSync(
    path.join(tmp, "node_modules", "dep.js"),
    "module.exports = {};",
  );
  fs.writeFileSync(path.join(tmp, "main.js"), "function main() {}");

  const result = await buildEmbeddingsAndIndex(tmp, { maxFiles: 50 });
  const files = new Set(result.index.map((c) => c.filePath));
  assert.ok(files.has("main.js"));
  assert.ok(!files.has("node_modules/dep.js"));
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ─── topKContext ─────────────────────────────────────────────────────────────

test("topKContext returns ranked results", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-topk-"));
  fs.writeFileSync(
    path.join(tmp, "auth.js"),
    "function authenticate(user, password) { return true; }",
  );
  fs.writeFileSync(
    path.join(tmp, "billing.js"),
    "function processPayment(amount, currency) { return true; }",
  );
  fs.writeFileSync(
    path.join(tmp, "utils.js"),
    "function formatDate(date) { return date.toString(); }",
  );

  const { index } = await buildEmbeddingsAndIndex(tmp, { maxFiles: 10 });
  const results = topKContext("authenticate user password login", index, 2);
  assert.equal(results.length, 2);
  assert.ok(results[0].score >= results[1].score);
  // Auth file should rank highest for auth query
  assert.ok(
    results[0].filePath.includes("auth"),
    `Expected auth.js, got ${results[0].filePath}`,
  );
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("topKContext returns empty for empty index", () => {
  const results = topKContext("test", [], 5);
  assert.equal(results.length, 0);
});

// ─── preparePromptForEdit ────────────────────────────────────────────────────

test("preparePromptForEdit builds a focused prompt with token estimate", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-prompt-"));
  fs.writeFileSync(
    path.join(tmp, "handler.js"),
    [
      "const db = require('./db');",
      "/** Get user by ID */",
      "function getUser(id) {",
      '  return db.query("SELECT * FROM users WHERE id = ?", [id]);',
      "}",
      "module.exports = { getUser };",
    ].join("\n"),
  );

  const result = await preparePromptForEdit(
    tmp,
    ["handler.js"],
    "Add caching to getUser function",
    { maxTokens: 2000 },
  );

  assert.ok(result.prompt.includes("# Task"));
  assert.ok(result.prompt.includes("handler.js"));
  assert.ok(result.prompt.includes("Add caching to getUser"));
  assert.ok(result.prompt.includes("getUser"));
  assert.ok(result.estimatedTokens > 0);
  assert.ok(result.breakdown.filesSummarized === 1);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("preparePromptForEdit uses index for retrieval when provided", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "sb-prompt-idx-"));
  fs.writeFileSync(
    path.join(tmp, "target.js"),
    "function target() { return 42; }",
  );
  fs.writeFileSync(
    path.join(tmp, "related.js"),
    'function relatedUtil() { return "helper"; }',
  );

  const { index } = await buildEmbeddingsAndIndex(tmp, { maxFiles: 10 });
  const result = await preparePromptForEdit(
    tmp,
    ["target.js"],
    "modify target function",
    { index, k: 2 },
  );

  assert.ok(result.contextChunks > 0);
  assert.ok(result.breakdown.retrievalTokens > 0);
  fs.rmSync(tmp, { recursive: true, force: true });
});

// ─── Token-usage logging ─────────────────────────────────────────────────────

test("logTokenUsage stores entries", () => {
  const before = getTokenUsageSummary().totalRequests;
  logTokenUsage({
    event: "edit",
    promptTokens: 500,
    completionTokens: 200,
    model: "gpt-4",
    savedTokens: 5000,
  });
  const after = getTokenUsageSummary();
  assert.equal(after.totalRequests, before + 1);
});

test("getTokenUsageSummary returns aggregated stats", () => {
  logTokenUsage({
    event: "edit",
    promptTokens: 100,
    completionTokens: 50,
    model: "gpt-4",
    savedTokens: 1000,
  });
  logTokenUsage({
    event: "edit",
    promptTokens: 200,
    completionTokens: 100,
    model: "gpt-4",
    savedTokens: 2000,
  });
  const summary = getTokenUsageSummary();
  assert.ok(summary.totalRequests >= 2);
  assert.ok(summary.totalTokens > 0);
  assert.ok(summary.totalSaved > 0);
  assert.ok(summary.byEvent.edit);
  assert.ok(summary.byModel["gpt-4"]);
});

// ─── Plugin registration ─────────────────────────────────────────────────────

test("register attaches handlers to agent context", () => {
  const registered = [];
  const agent = {
    registerHandler: (name, fn) => {
      registered.push(name);
    },
    simplebeacon: {},
  };
  const optimizer = require("../plugins/token-optimizer.cjs");
  const handlers = optimizer.register(agent);

  assert.ok(registered.includes("simplebeacon.scan_and_summarize"));
  assert.ok(registered.includes("simplebeacon.build_embeddings_and_index"));
  assert.ok(registered.includes("simplebeacon.top_k_context"));
  assert.ok(registered.includes("simplebeacon.prepare_prompt_for_edit"));
  assert.ok(registered.includes("simplebeacon.log_token_usage"));
  assert.ok(agent.simplebeacon.scan_and_summarize);
  assert.ok(agent.simplebeacon.estimate_tokens);
});
