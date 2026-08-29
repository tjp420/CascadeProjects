const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

const {
  estimateTokens,
  estimatePromptTokens,
  trimContext,
  looksLikeCode,
  lineSignalScore,
} = require("../src/lib/token-estimator");

test("estimateTokens returns 0 for empty input", () => {
  assert.equal(estimateTokens(""), 0);
  assert.equal(estimateTokens(null), 0);
  assert.equal(estimateTokens(undefined), 0);
});

test("estimateTokens returns positive count for prose", () => {
  const text = "The quick brown fox jumps over the lazy dog";
  const tokens = estimateTokens(text);
  assert.ok(tokens > 0, "should return positive token count");
  // ~9 words / ~3.4 chars per token for prose-ish -> at least 2
  assert.ok(tokens >= 2, `expected >= 2, got ${tokens}`);
});

test("estimateTokens treats code as denser than prose", () => {
  // Use comparable non-whitespace lengths so the density multiplier is what's tested.
  const prose = "the quick brown fox jumps over the lazy dog and runs away fast";
  const code = "function add(a,b){return a+b;} const sub=(x,y)=>x-y;";
  const proseTokens = estimateTokens(prose, { isCode: false });
  const codeTokens = estimateTokens(code, { isCode: true });
  assert.ok(codeTokens >= proseTokens, `code (${codeTokens}) should be >= prose (${proseTokens}) for similar length`);
});

test("estimateTokens uses filePath to detect code", () => {
  const text = "function foo() { return 1; }";
  const asJs = estimateTokens(text, { filePath: "foo.js" });
  const asMd = estimateTokens(text, { filePath: "foo.md" });
  assert.ok(asJs >= asMd, "js file should be treated as denser code");
});

test("looksLikeCode detects code vs prose", () => {
  assert.equal(looksLikeCode("function foo() { return 1; }"), true);
  assert.equal(looksLikeCode("The quick brown fox jumps over the lazy dog."), false);
});

test("estimatePromptTokens sums parts and adds message boundary overhead", () => {
  const { total, parts } = estimatePromptTokens({
    system: "You are helpful.",
    context: "function foo() {}",
    user: "Explain foo.",
  });
  assert.ok(parts.system > 0);
  assert.ok(parts.context > 0);
  assert.ok(parts.user > 0);
  assert.ok(total >= parts.system + parts.context + parts.user);
});

test("estimatePromptTokens handles empty prompt", () => {
  const { total, parts } = estimatePromptTokens({});
  assert.equal(total, 0);
  assert.equal(parts.system, 0);
});

test("trimContext returns original when within budget", () => {
  const ctx = "line one\nline two\nline three";
  const result = trimContext(ctx, 10000);
  assert.equal(result.trimmed, ctx);
  assert.equal(result.droppedLines, 0);
  assert.equal(result.trimmedTokens, result.originalTokens);
});

test("trimContext drops low-signal lines to meet budget", () => {
  const lines = [];
  for (let i = 0; i < 100; i++) lines.push(`// comment line ${i}`);
  for (let i = 0; i < 20; i++) lines.push(`function fn${i}(a, b) { return a + b; }`);
  const ctx = lines.join("\n");
  const result = trimContext(ctx, 50);
  assert.ok(result.trimmedTokens <= 75, `trimmed (${result.trimmedTokens}) should be near budget (within 1.5x)`);
  assert.ok(result.droppedLines > 0, "should have dropped some lines");
  assert.ok(result.originalTokens > result.trimmedTokens, "should have reduced tokens");
});

test("trimContext preserves high-signal signatures over comments", () => {
  const lines = [];
  for (let i = 0; i < 50; i++) lines.push(`// boring comment ${i}`);
  lines.push("function criticalSignature(a, b) { return a + b; }");
  const ctx = lines.join("\n");
  const result = trimContext(ctx, 30);
  assert.match(result.trimmed, /criticalSignature/);
});

test("lineSignalScore ranks signatures above comments above blanks", () => {
  const sig = lineSignalScore("function foo(a, b) { }");
  const comment = lineSignalScore("// a comment");
  const blank = lineSignalScore("");
  assert.ok(sig > comment, "signature should score higher than comment");
  assert.ok(comment > blank, "comment should score higher than blank");
});

test("trimContext handles empty input", () => {
  const result = trimContext("", 100);
  assert.equal(result.trimmed, "");
  assert.equal(result.originalTokens, 0);
});
