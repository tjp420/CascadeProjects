"use strict";

/**
 * Context Window Chunker — Unit Tests
 *
 * Verifies intelligent token-aware chunking for local LLM orchestration:
 *  - Token estimation accuracy
 *  - Context window resolution per model
 *  - Single-file chunking on line boundaries
 *  - Multi-file sweep batch planning
 *  - Memory-bounded result aggregation
 *  - Prompt assembly with chunk context
 *  - Large codebase simulation (hundreds of thousands of lines)
 *  - Enterprise sweep execution with mock analysis function
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert");

const {
  estimateTokens,
  estimateTotalTokens,
  resolveContextWindow,
  availableContentTokens,
  tokensToChars,
  chunkContent,
  planMultiFileSweep,
  executeMultiFileSweep,
  createResultAggregator,
  buildChunkPrompt,
  DEFAULT_CONTEXT_WINDOWS,
  CHARS_PER_TOKEN,
  DEFAULT_SYSTEM_PROMPT_TOKENS,
  DEFAULT_RESPONSE_TOKENS,
  DEFAULT_MAX_CACHED_RESULTS,
} = require("../context-window-chunker.cjs");

// ── Token estimation ─────────────────────────────────────────────────────

describe("Token estimation", () => {
  it("estimateTokens returns 0 for empty/null input", () => {
    assert.strictEqual(estimateTokens(""), 0);
    assert.strictEqual(estimateTokens(null), 0);
    assert.strictEqual(estimateTokens(undefined), 0);
  });

  it("estimateTokens returns positive value for non-empty text", () => {
    const text = "const x = 42;";
    const tokens = estimateTokens(text);
    assert.ok(tokens > 0, "should return positive token count");
    // 14 chars / 3.5 = 4 tokens
    assert.strictEqual(tokens, 4);
  });

  it("estimateTokens scales with content length", () => {
    const short = "hello";
    const long =
      "hello world this is a much longer string with many more tokens";
    assert.ok(estimateTokens(long) > estimateTokens(short));
  });

  it("estimateTotalTokens sums system prompt + content", () => {
    const systemPrompt = "You are a code analyzer.";
    const content = "const x = 42;";
    const total = estimateTotalTokens(systemPrompt, content);
    assert.strictEqual(
      total,
      estimateTokens(systemPrompt) + estimateTokens(content),
    );
  });
});

// ── Context window resolution ────────────────────────────────────────────

describe("Context window resolution", () => {
  it("returns known model context window", () => {
    assert.strictEqual(
      resolveContextWindow("llama3.2"),
      DEFAULT_CONTEXT_WINDOWS["llama3.2"],
    );
    assert.strictEqual(
      resolveContextWindow("mistral"),
      DEFAULT_CONTEXT_WINDOWS["mistral"],
    );
    assert.strictEqual(
      resolveContextWindow("qwen2.5-coder"),
      DEFAULT_CONTEXT_WINDOWS["qwen2.5-coder"],
    );
  });

  it("returns default for unknown model", () => {
    assert.strictEqual(
      resolveContextWindow("unknown-model"),
      DEFAULT_CONTEXT_WINDOWS.default,
    );
  });

  it("uses explicit override when provided", () => {
    assert.strictEqual(resolveContextWindow("llama3.2", 99999), 99999);
  });

  it("matches model variants with prefix (e.g. llama3.2:latest)", () => {
    assert.strictEqual(
      resolveContextWindow("llama3.2:latest"),
      DEFAULT_CONTEXT_WINDOWS["llama3.2"],
    );
    assert.strictEqual(
      resolveContextWindow("mistral:7b"),
      DEFAULT_CONTEXT_WINDOWS["mistral"],
    );
  });

  it("respects OLLAMA_NUM_CTX env var", () => {
    const prev = process.env.OLLAMA_NUM_CTX;
    process.env.OLLAMA_NUM_CTX = "16384";
    try {
      assert.strictEqual(resolveContextWindow("llama3.2"), 16384);
    } finally {
      if (prev) process.env.OLLAMA_NUM_CTX = prev;
      else delete process.env.OLLAMA_NUM_CTX;
    }
  });
});

// ── Available content tokens ─────────────────────────────────────────────

describe("availableContentTokens", () => {
  it("subtracts system prompt and response tokens from context window", () => {
    const available = availableContentTokens(8192, 500, 1024);
    assert.strictEqual(available, 8192 - 500 - 1024);
  });

  it("returns minimum 256 when context window is very small", () => {
    const available = availableContentTokens(100, 50, 50);
    assert.strictEqual(available, 256);
  });

  it("handles zero reserved tokens", () => {
    const available = availableContentTokens(4096, 0, 0);
    assert.strictEqual(available, 4096);
  });
});

// ── tokensToChars ────────────────────────────────────────────────────────

describe("tokensToChars", () => {
  it("converts tokens to chars using CHARS_PER_TOKEN ratio", () => {
    assert.strictEqual(tokensToChars(1000), Math.floor(1000 * CHARS_PER_TOKEN));
  });

  it("returns 0 for 0 tokens", () => {
    assert.strictEqual(tokensToChars(0), 0);
  });
});

// ── Single-file chunking ─────────────────────────────────────────────────

describe("chunkContent", () => {
  it("returns single chunk when content fits within budget", () => {
    const content = "const x = 42;\n";
    const chunks = chunkContent(content, { model: "llama3.2" });
    assert.strictEqual(chunks.length, 1);
    assert.strictEqual(chunks[0], content);
  });

  it("returns empty array for empty/null content", () => {
    assert.deepStrictEqual(chunkContent("", { model: "llama3.2" }), []);
    assert.deepStrictEqual(chunkContent(null, { model: "llama3.2" }), []);
  });

  it("splits content on line boundaries when exceeding budget", () => {
    // Create content that exceeds a small context window
    const lines = [];
    for (let i = 0; i < 100; i++) {
      lines.push(`// Line ${i}: ${"x".repeat(100)}`);
    }
    const content = lines.join("\n");

    // Use a very small maxTokens to force chunking
    const chunks = chunkContent(content, { maxTokens: 100 });
    assert.ok(chunks.length > 1, "should produce multiple chunks");

    // Each chunk should not exceed the char budget
    const maxChars = tokensToChars(100);
    for (const chunk of chunks) {
      assert.ok(
        chunk.length <= maxChars,
        `chunk length ${chunk.length} should be <= ${maxChars}`,
      );
    }
  });

  it("handles single line exceeding chunk size by splitting at char boundary", () => {
    const longLine = "x".repeat(10000);
    const chunks = chunkContent(longLine, { maxTokens: 100 });
    assert.ok(chunks.length > 1, "should split long single line");
    const maxChars = tokensToChars(100);
    for (const chunk of chunks) {
      assert.ok(
        chunk.length <= maxChars,
        "each chunk should be within char budget",
      );
    }
  });

  it("preserves content integrity — concatenating chunks restores original (approximately)", () => {
    const lines = [];
    for (let i = 0; i < 50; i++) {
      lines.push(`function fn${i}() { return ${i}; }`);
    }
    const content = lines.join("\n");
    const chunks = chunkContent(content, { maxTokens: 50 });
    const reconstructed = chunks.join("\n");
    // Content should be approximately the same (may differ slightly at chunk boundaries)
    assert.ok(
      reconstructed.length >= content.length * 0.95,
      "reconstructed content should be close to original",
    );
  });

  it("respects explicit maxTokens over context window", () => {
    const content = "x".repeat(10000);
    const chunks = chunkContent(content, { maxTokens: 500, model: "llama3.2" });
    const maxChars = tokensToChars(500);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= maxChars, "should respect explicit maxTokens");
    }
  });
});

// ── Multi-file sweep planning ────────────────────────────────────────────

describe("planMultiFileSweep", () => {
  it("returns empty array for non-array input", () => {
    assert.deepStrictEqual(planMultiFileSweep(null), []);
    assert.deepStrictEqual(planMultiFileSweep("not an array"), []);
  });

  it("groups small files into a single batch", () => {
    const files = [
      { path: "a.js", content: "const a = 1;" },
      { path: "b.js", content: "const b = 2;" },
      { path: "c.js", content: "const c = 3;" },
    ];
    const batches = planMultiFileSweep(files, { model: "llama3.2" });
    assert.strictEqual(
      batches.length,
      1,
      "small files should fit in one batch",
    );
    assert.strictEqual(
      batches[0].length,
      3,
      "batch should contain all 3 files",
    );
  });

  it("splits large files across multiple batches", () => {
    const largeContent = "x".repeat(100000);
    const files = [{ path: "large.js", content: largeContent }];
    const batches = planMultiFileSweep(files, { maxTokens: 500 });
    assert.ok(batches.length > 1, "large file should span multiple batches");
  });

  it("skips files with no content", () => {
    const files = [
      { path: "a.js", content: "const a = 1;" },
      { path: "empty.js", content: "" },
      { path: "null.js", content: null },
    ];
    const batches = planMultiFileSweep(files, { model: "llama3.2" });
    const allChunks = batches.flat();
    assert.strictEqual(
      allChunks.length,
      1,
      "only the non-empty file should be included",
    );
    assert.strictEqual(allChunks[0].path, "a.js");
  });

  it("assigns correct chunk indices for multi-chunk files", () => {
    const largeContent = "x".repeat(50000);
    const files = [{ path: "big.js", content: largeContent }];
    const batches = planMultiFileSweep(files, { maxTokens: 200 });
    const allChunks = batches.flat();
    assert.ok(allChunks.length > 1, "should have multiple chunks");
    assert.strictEqual(allChunks[0].chunkIndex, 0);
    assert.strictEqual(allChunks[0].totalChunks, allChunks.length);
    // Last chunk should have the highest index
    const lastChunk = allChunks[allChunks.length - 1];
    assert.strictEqual(lastChunk.chunkIndex, allChunks.length - 1);
  });

  it("includes estimatedTokens for each chunk", () => {
    const files = [{ path: "a.js", content: "const a = 1;" }];
    const batches = planMultiFileSweep(files, { model: "llama3.2" });
    const chunk = batches[0][0];
    assert.ok(typeof chunk.estimatedTokens === "number");
    assert.ok(chunk.estimatedTokens > 0);
  });
});

// ── Memory-bounded result aggregation ────────────────────────────────────

describe("createResultAggregator", () => {
  it("stores results up to maxResults", () => {
    const agg = createResultAggregator(5);
    for (let i = 0; i < 5; i++) {
      agg.add({ path: `file${i}.js`, result: `result${i}` });
    }
    assert.strictEqual(agg.size(), 5);
    assert.strictEqual(agg.getAll().length, 5);
  });

  it("evicts oldest results when exceeding maxResults (FIFO)", () => {
    const agg = createResultAggregator(3);
    for (let i = 0; i < 10; i++) {
      agg.add({ path: `file${i}.js`, result: `result${i}` });
    }
    assert.strictEqual(agg.size(), 3, "should only keep last 3 results");
    const results = agg.getAll();
    assert.strictEqual(results[0].path, "file7.js");
    assert.strictEqual(results[2].path, "file9.js");
  });

  it("tracks summary statistics", () => {
    const agg = createResultAggregator(100);
    agg.add({ path: "a.js", chunkCount: 3, estimatedTokens: 500 });
    agg.add({
      path: "b.js",
      chunkCount: 2,
      estimatedTokens: 300,
      error: "failed",
    });

    const summary = agg.getSummary();
    assert.strictEqual(summary.totalProcessed, 2);
    assert.strictEqual(summary.totalChunks, 5);
    assert.strictEqual(summary.totalTokensEstimated, 800);
    assert.strictEqual(summary.totalErrors, 1);
  });

  it("tracks evicted count in summary", () => {
    const agg = createResultAggregator(3);
    for (let i = 0; i < 10; i++) {
      agg.add({ path: `file${i}.js` });
    }
    const summary = agg.getSummary();
    assert.strictEqual(summary.totalProcessed, 10);
    assert.strictEqual(summary.evicted, 7);
    assert.strictEqual(summary.cachedResults, 3);
  });

  it("clear() resets all state", () => {
    const agg = createResultAggregator(10);
    agg.add({ path: "a.js", chunkCount: 1, estimatedTokens: 100 });
    agg.clear();
    assert.strictEqual(agg.size(), 0);
    const summary = agg.getSummary();
    assert.strictEqual(summary.totalProcessed, 0);
    assert.strictEqual(summary.totalChunks, 0);
  });

  it("uses default maxResults when not specified", () => {
    const agg = createResultAggregator();
    for (let i = 0; i < DEFAULT_MAX_CACHED_RESULTS + 50; i++) {
      agg.add({ path: `file${i}.js` });
    }
    assert.strictEqual(agg.size(), DEFAULT_MAX_CACHED_RESULTS);
  });
});

// ── Prompt assembly ──────────────────────────────────────────────────────

describe("buildChunkPrompt", () => {
  it("includes file path in prompt", () => {
    const prompt = buildChunkPrompt("const x = 1;", {
      filePath: "src/index.js",
    });
    assert.ok(prompt.includes("src/index.js"));
  });

  it("includes chunk position for multi-chunk files", () => {
    const prompt = buildChunkPrompt("const x = 1;", {
      filePath: "big.js",
      chunkIndex: 2,
      totalChunks: 5,
    });
    assert.ok(
      prompt.includes("chunk 3 of 5"),
      "should show 1-based chunk position",
    );
  });

  it("omits chunk position for single-chunk files", () => {
    const prompt = buildChunkPrompt("const x = 1;", {
      filePath: "small.js",
      chunkIndex: 0,
      totalChunks: 1,
    });
    assert.ok(
      !prompt.includes("chunk 1 of 1"),
      "should not show chunk position for single chunk",
    );
  });

  it("includes analysis type-specific instructions", () => {
    const securityPrompt = buildChunkPrompt("const x = 1;", {
      analysisType: "security",
    });
    assert.ok(securityPrompt.includes("Vulnerabilities"));

    const perfPrompt = buildChunkPrompt("const x = 1;", {
      analysisType: "performance",
    });
    assert.ok(perfPrompt.includes("Performance bottlenecks"));

    const archPrompt = buildChunkPrompt("const x = 1;", {
      analysisType: "architecture",
    });
    assert.ok(archPrompt.includes("Design patterns"));
  });

  it("includes content in code block", () => {
    const content = "const x = 42;";
    const prompt = buildChunkPrompt(content, { language: "javascript" });
    assert.ok(prompt.includes("```javascript"));
    assert.ok(prompt.includes(content));
  });
});

// ── Multi-file sweep execution ───────────────────────────────────────────

describe("executeMultiFileSweep", () => {
  it("returns empty result for no files", async () => {
    const result = await executeMultiFileSweep([], async () => ({}));
    assert.strictEqual(result.summary.totalProcessed, 0);
    assert.strictEqual(result.results.length, 0);
  });

  it("returns empty result for non-function analyzer", async () => {
    const result = await executeMultiFileSweep(
      [{ path: "a.js", content: "x" }],
      null,
    );
    assert.strictEqual(result.summary.totalProcessed, 0);
  });

  it("calls analyzeFn for each chunk and collects results", async () => {
    const files = [
      { path: "a.js", content: "const a = 1;" },
      { path: "b.js", content: "const b = 2;" },
    ];
    let callCount = 0;
    const analyzeFn = async (chunk) => {
      callCount++;
      return { analysis: `result for ${chunk.path}` };
    };

    const result = await executeMultiFileSweep(files, analyzeFn, {
      model: "llama3.2",
    });
    assert.strictEqual(callCount, 2);
    assert.strictEqual(result.summary.totalProcessed, 2);
    assert.strictEqual(result.summary.totalErrors, 0);
    assert.strictEqual(result.results.length, 2);
  });

  it("handles analyzer errors gracefully", async () => {
    const files = [{ path: "a.js", content: "const a = 1;" }];
    const analyzeFn = async () => {
      throw new Error("LLM unavailable");
    };

    const result = await executeMultiFileSweep(files, analyzeFn, {
      model: "llama3.2",
    });
    assert.strictEqual(result.summary.totalProcessed, 1);
    assert.strictEqual(result.summary.totalErrors, 1);
    assert.ok(result.results[0].error);
  });

  it("processes large codebase with hundreds of files without memory blowup", async () => {
    // Simulate 200 files with ~500 lines each (~100K lines total)
    const files = [];
    for (let i = 0; i < 200; i++) {
      const lines = [];
      for (let j = 0; j < 50; j++) {
        lines.push(`// file ${i} line ${j}\nconst val${j} = ${j};`);
      }
      files.push({ path: `file${i}.js`, content: lines.join("\n") });
    }

    const analyzeFn = async (chunk) => ({ findings: [] });
    const result = await executeMultiFileSweep(files, analyzeFn, {
      model: "llama3.2",
      maxResults: 50, // small buffer to test eviction
    });

    // All files should be processed
    assert.strictEqual(result.summary.totalProcessed, 200);
    // But only 50 results should be cached (memory-bounded)
    assert.strictEqual(result.results.length, 50);
    assert.strictEqual(result.summary.evicted, 150);
  });
});

// ── Large codebase simulation ────────────────────────────────────────────

describe("Large codebase simulation (enterprise workload)", () => {
  it("handles a single very large file (100K lines)", () => {
    // Simulate a 100K-line file
    const lines = [];
    for (let i = 0; i < 100000; i++) {
      lines.push(`const x${i} = ${i}; // line ${i}`);
    }
    const content = lines.join("\n");

    const chunks = chunkContent(content, { model: "llama3.2" });
    assert.ok(
      chunks.length > 1,
      "100K-line file should produce multiple chunks",
    );

    // Each chunk should be within the context window budget
    const contextWindow = resolveContextWindow("llama3.2");
    const available = availableContentTokens(
      contextWindow,
      DEFAULT_SYSTEM_PROMPT_TOKENS,
      DEFAULT_RESPONSE_TOKENS,
    );
    const maxChars = tokensToChars(available);
    for (const chunk of chunks) {
      assert.ok(
        chunk.length <= maxChars,
        `chunk should fit within context window (${chunk.length} <= ${maxChars})`,
      );
    }
  });

  it("plans sweep for 500 files efficiently", () => {
    const files = [];
    for (let i = 0; i < 500; i++) {
      files.push({
        path: `src/module${i}/index.js`,
        content: `function fn${i}() { return ${i}; }`,
      });
    }

    const batches = planMultiFileSweep(files, { model: "llama3.2" });
    assert.ok(batches.length >= 1, "should produce at least one batch");

    // All 500 files should be accounted for
    const totalChunks = batches.flat().length;
    assert.strictEqual(totalChunks, 500, "all 500 files should be included");
  });

  it("aggregator memory stays bounded for 1000 results with maxResults=100", () => {
    const agg = createResultAggregator(100);
    for (let i = 0; i < 1000; i++) {
      agg.add({ path: `file${i}.js`, estimatedTokens: 100, chunkCount: 1 });
    }

    assert.strictEqual(agg.size(), 100, "should only retain 100 results");
    const summary = agg.getSummary();
    assert.strictEqual(summary.totalProcessed, 1000);
    assert.strictEqual(summary.evicted, 900);
    assert.strictEqual(summary.totalTokensEstimated, 100000);
  });

  it("executeMultiFileSweep completes within reasonable time for 100 files", async () => {
    const files = [];
    for (let i = 0; i < 100; i++) {
      files.push({ path: `f${i}.js`, content: `const x${i} = ${i};` });
    }

    const start = Date.now();
    const result = await executeMultiFileSweep(
      files,
      async () => ({ ok: true }),
      {
        model: "llama3.2",
      },
    );
    const elapsed = Date.now() - start;

    assert.strictEqual(result.summary.totalProcessed, 100);
    // Should complete in under 5 seconds (mock analyzer is instant)
    assert.ok(elapsed < 5000, `sweep should complete quickly (${elapsed}ms)`);
  });
});

// ── Edge cases ───────────────────────────────────────────────────────────

describe("Edge cases", () => {
  it("chunkContent handles content with no newlines", () => {
    const content = "x".repeat(10000);
    const chunks = chunkContent(content, { maxTokens: 100 });
    assert.ok(chunks.length > 1);
    const maxChars = tokensToChars(100);
    for (const chunk of chunks) {
      assert.ok(chunk.length <= maxChars);
    }
  });

  it("chunkContent handles content with only newlines", () => {
    const content = "\n".repeat(1000);
    const chunks = chunkContent(content, { maxTokens: 50 });
    // Should still produce chunks
    assert.ok(chunks.length >= 1);
  });

  it("planMultiFileSweep handles mixed file sizes", () => {
    const files = [
      { path: "tiny.js", content: "x" },
      { path: "medium.js", content: "x".repeat(5000) },
      { path: "huge.js", content: "x".repeat(50000) },
    ];
    const batches = planMultiFileSweep(files, { maxTokens: 200 });
    assert.ok(batches.length >= 1);
    const allChunks = batches.flat();
    assert.ok(allChunks.length >= 3, "all files should be represented");
  });

  it("resolveContextWindow handles empty/null model", () => {
    assert.strictEqual(
      resolveContextWindow(""),
      DEFAULT_CONTEXT_WINDOWS.default,
    );
    assert.strictEqual(
      resolveContextWindow(null),
      DEFAULT_CONTEXT_WINDOWS.default,
    );
    assert.strictEqual(
      resolveContextWindow(undefined),
      DEFAULT_CONTEXT_WINDOWS.default,
    );
  });

  it("estimateTokens handles unicode content", () => {
    const unicode = 'const café = "naïve"; // résumé';
    const tokens = estimateTokens(unicode);
    assert.ok(tokens > 0, "should handle unicode content");
  });
});
