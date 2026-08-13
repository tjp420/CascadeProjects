'use strict';

/**
 * Context Window Chunker — Intelligent token-aware chunking for local LLM
 * orchestration.
 *
 * Solves three critical problems for enterprise multi-file code sweeps:
 *
 *  1. **Prompt truncation prevention**: Replaces naive `content.slice(0, 4000)`
 *     with token-estimation-aware chunking that respects the model's context
 *     window size, leaving room for the system prompt and response tokens.
 *
 *  2. **Multi-file sweep orchestration**: Processes hundreds of files in
 *     context-window-sized batches, aggregating results without unbounded
 *     memory growth.
 *
 *  3. **Memory-bounded aggregation**: Uses a sliding-window result buffer
 *     so that memory usage stays bounded even when scanning hundreds of
 *     thousands of lines of source code.
 *
 * @module context-window-chunker
 */

// ── Defaults ───────────────────────────────────────────────────────────────

/**
 * Default model context window sizes (in tokens).
 * These are conservative defaults — the actual context window can be
 * overridden via options or env vars.
 */
const DEFAULT_CONTEXT_WINDOWS = {
  'llama3.2': 4096,
  'llama3.2:1b': 4096,
  'llama3.1': 128000,
  'llama3': 8192,
  'mistral': 32768,
  'mixtral': 32768,
  'qwen2.5': 32768,
  'qwen2.5-coder': 32768,
  'phi3': 128000,
  'gemma2': 8192,
  'unbreakable-oracle': 8192,
  'unbreakable-oracle:latest': 8192,
  'default': 4096,
};

/**
 * Approximate chars-per-token ratio for source code.
 * Code tends to be ~3.5-4.5 chars per token; we use a conservative 3.5
 * to avoid underestimating token count (overestimating is safe).
 */
const CHARS_PER_TOKEN = 3.5;

/**
 * Default token budget reserved for the system prompt + instructions.
 */
const DEFAULT_SYSTEM_PROMPT_TOKENS = 500;

/**
 * Default token budget reserved for the model's response.
 */
const DEFAULT_RESPONSE_TOKENS = 1024;

/**
 * Default maximum number of result entries to retain in memory during
 * a multi-file sweep. Older results are evicted (FIFO).
 */
const DEFAULT_MAX_CACHED_RESULTS = 100;

/**
 * Default maximum file size (in chars) to attempt to process as a single
 * chunk. Files larger than this are split into multiple chunks.
 */
const DEFAULT_MAX_FILE_CHARS = 500000; // ~143K tokens at 3.5 chars/token

// ── Token estimation ───────────────────────────────────────────────────────

/**
 * Estimate the number of tokens in a given string.
 *
 * Uses a conservative chars-per-token ratio. This is intentionally an
 * over-estimate (fewer chars per token) so that we err on the side of
 * smaller chunks rather than overflowing the context window.
 *
 * @param {string} text - The text to estimate token count for.
 * @returns {number} Estimated token count (always >= 0).
 */
function estimateTokens(text) {
  if (!text || typeof text !== 'string') return 0;
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

/**
 * Estimate the number of tokens in a system prompt + user content combination.
 *
 * @param {string} systemPrompt - The system/instruction prompt.
 * @param {string} content - The user content (code, text, etc.).
 * @returns {number} Total estimated tokens.
 */
function estimateTotalTokens(systemPrompt, content) {
  return estimateTokens(systemPrompt) + estimateTokens(content);
}

// ── Context window resolution ──────────────────────────────────────────────

/**
 * Resolve the context window size (in tokens) for a given model.
 *
 * Checks env var `OLLAMA_NUM_CTX` first, then the model registry, then
 * falls back to the default.
 *
 * @param {string} model - Model identifier (e.g. 'llama3.2', 'mistral').
 * @param {number} [override] - Explicit override (highest priority).
 * @returns {number} Context window size in tokens.
 */
function resolveContextWindow(model, override) {
  if (typeof override === 'number' && override > 0) return override;

  const envCtx = parseInt(process.env.OLLAMA_NUM_CTX, 10);
  if (Number.isFinite(envCtx) && envCtx > 0) return envCtx;

  const modelKey = String(model || '').toLowerCase().trim();
  if (DEFAULT_CONTEXT_WINDOWS[modelKey]) return DEFAULT_CONTEXT_WINDOWS[modelKey];

  // Try prefix match (e.g. 'llama3.2:latest' matches 'llama3.2')
  for (const key of Object.keys(DEFAULT_CONTEXT_WINDOWS)) {
    if (key !== 'default' && modelKey.startsWith(key)) {
      return DEFAULT_CONTEXT_WINDOWS[key];
    }
  }

  return DEFAULT_CONTEXT_WINDOWS.default;
}

// ── Chunking ───────────────────────────────────────────────────────────────

/**
 * Calculate the available content token budget after reserving space for
 * the system prompt and response.
 *
 * @param {number} contextWindow - Total context window in tokens.
 * @param {number} systemPromptTokens - Tokens reserved for system prompt.
 * @param {number} responseTokens - Tokens reserved for model response.
 * @returns {number} Available tokens for content.
 */
function availableContentTokens(contextWindow, systemPromptTokens, responseTokens) {
  const reserved = (systemPromptTokens || 0) + (responseTokens || 0);
  return Math.max(256, contextWindow - reserved);
}

/**
 * Convert a token budget to an approximate character budget.
 *
 * @param {number} tokens - Token budget.
 * @returns {number} Character budget.
 */
function tokensToChars(tokens) {
  return Math.floor(tokens * CHARS_PER_TOKEN);
}

/**
 * Split a large string into chunks that fit within the available token budget.
 *
 * Chunks are split on line boundaries when possible to avoid cutting
 * mid-statement. If a single line exceeds the chunk size, it is split
 * at the character boundary.
 *
 * @param {string} content - The content to chunk.
 * @param {object} [opts]
 * @param {number} [opts.maxTokens] - Max tokens per chunk (defaults to available).
 * @param {number} [opts.contextWindow] - Model context window size.
 * @param {string} [opts.model] - Model name (for context window lookup).
 * @param {number} [opts.systemPromptTokens] - Tokens reserved for system prompt.
 * @param {number} [opts.responseTokens] - Tokens reserved for response.
 * @returns {string[]} Array of content chunks.
 */
function chunkContent(content, opts = {}) {
  if (!content || typeof content !== 'string') return [];

  const contextWindow = resolveContextWindow(opts.model, opts.contextWindow);
  const availableTokens = opts.maxTokens || availableContentTokens(
    contextWindow,
    opts.systemPromptTokens || DEFAULT_SYSTEM_PROMPT_TOKENS,
    opts.responseTokens || DEFAULT_RESPONSE_TOKENS,
  );
  const maxChars = tokensToChars(availableTokens);

  // If content fits in a single chunk, return it as-is
  if (content.length <= maxChars) return [content];

  const chunks = [];
  const lines = content.split('\n');
  let currentChunk = '';
  let currentLength = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineLength = line.length + 1; // +1 for the newline

    // If adding this line would exceed the chunk size, flush the current chunk
    if (currentLength + lineLength > maxChars && currentLength > 0) {
      chunks.push(currentChunk);
      currentChunk = '';
      currentLength = 0;
    }

    // If a single line exceeds the max chunk size, split it at char boundaries
    if (lineLength > maxChars) {
      for (let j = 0; j < line.length; j += maxChars) {
        if (currentLength > 0) {
          chunks.push(currentChunk);
          currentChunk = '';
          currentLength = 0;
        }
        const segment = line.slice(j, j + maxChars);
        chunks.push(segment);
      }
    } else {
      // Use explicit length check instead of truthiness to handle empty lines
      if (currentLength > 0) {
        currentChunk += '\n' + line;
      } else {
        currentChunk = line;
      }
      currentLength += lineLength;
    }
  }

  if (currentLength > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// ── Multi-file sweep orchestration ─────────────────────────────────────────

/**
 * Create a batch plan for processing multiple files through the LLM.
 *
 * Groups files into batches where each batch's total token count fits
 * within the available content token budget. Files that individually
 * exceed the budget are split into sub-chunks.
 *
 * @param {Array<{path: string, content: string}>} files - Files to process.
 * @param {object} [opts] - Chunking options (same as chunkContent).
 * @returns {Array<Array<{path: string, chunkIndex: number, totalChunks: number, content: string, estimatedTokens: number}>>}
 *   Array of batches, each batch is an array of chunk descriptors.
 */
function planMultiFileSweep(files, opts = {}) {
  if (!Array.isArray(files)) return [];

  const contextWindow = resolveContextWindow(opts.model, opts.contextWindow);
  const availableTokens = opts.maxTokens || availableContentTokens(
    contextWindow,
    opts.systemPromptTokens || DEFAULT_SYSTEM_PROMPT_TOKENS,
    opts.responseTokens || DEFAULT_RESPONSE_TOKENS,
  );

  const batches = [];
  let currentBatch = [];
  let currentBatchTokens = 0;

  for (const file of files) {
    if (!file || !file.content) continue;

    const fileChunks = chunkContent(file.content, opts);
    const totalChunks = fileChunks.length;

    for (let i = 0; i < fileChunks.length; i++) {
      const chunk = fileChunks[i];
      const chunkTokens = estimateTokens(chunk);

      const chunkDesc = {
        path: file.path || `file-${batches.length}-${i}`,
        chunkIndex: i,
        totalChunks,
        content: chunk,
        estimatedTokens: chunkTokens,
      };

      // If this chunk alone exceeds the batch budget, put it in its own batch
      if (chunkTokens > availableTokens) {
        // Flush current batch first
        if (currentBatch.length > 0) {
          batches.push(currentBatch);
          currentBatch = [];
          currentBatchTokens = 0;
        }
        batches.push([chunkDesc]);
        continue;
      }

      // If adding this chunk would exceed the batch budget, flush and start new
      if (currentBatchTokens + chunkTokens > availableTokens && currentBatch.length > 0) {
        batches.push(currentBatch);
        currentBatch = [];
        currentBatchTokens = 0;
      }

      currentBatch.push(chunkDesc);
      currentBatchTokens += chunkTokens;
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

// ── Memory-bounded result aggregation ──────────────────────────────────────

/**
 * Create a memory-bounded result aggregator for multi-file sweeps.
 *
 * Stores up to `maxResults` result entries. When the buffer is full,
 * the oldest entries are evicted (FIFO). This prevents unbounded memory
 * growth when processing hundreds of thousands of lines of source code.
 *
 * @param {number} [maxResults=DEFAULT_MAX_CACHED_RESULTS] - Max results to retain.
 * @returns {{add, getAll, getSummary, size, clear}} Aggregator instance.
 */
function createResultAggregator(maxResults = DEFAULT_MAX_CACHED_RESULTS) {
  const results = [];
  let totalProcessed = 0;
  let totalChunks = 0;
  let totalTokensEstimated = 0;
  let totalErrors = 0;

  return {
    add(entry) {
      totalProcessed++;
      if (entry) {
        totalChunks += entry.chunkCount || 1;
        totalTokensEstimated += entry.estimatedTokens || 0;
        if (entry.error) totalErrors++;
      }
      results.push(entry);
      // Evict oldest entries if over capacity
      while (results.length > maxResults) {
        results.shift();
      }
    },

    getAll() {
      return results.slice();
    },

    getSummary() {
      return {
        totalProcessed,
        totalChunks,
        totalTokensEstimated,
        totalErrors,
        cachedResults: results.length,
        maxCachedResults: maxResults,
        evicted: Math.max(0, totalProcessed - results.length),
      };
    },

    size() {
      return results.length;
    },

    clear() {
      results.length = 0;
      totalProcessed = 0;
      totalChunks = 0;
      totalTokensEstimated = 0;
      totalErrors = 0;
    },
  };
}

// ── Prompt assembly ────────────────────────────────────────────────────────

/**
 * Build a context-aware analysis prompt for a single chunk of content.
 *
 * Includes file path, chunk position, and total chunk count so the model
 * understands the context of what it's analyzing.
 *
 * @param {string} content - The chunk content to analyze.
 * @param {object} [context]
 * @param {string} [context.filePath] - File path being analyzed.
 * @param {number} [context.chunkIndex] - Current chunk index (0-based).
 * @param {number} [context.totalChunks] - Total chunks for this file.
 * @param {string} [context.analysisType] - Type of analysis ('security', 'performance', etc.).
 * @returns {string} Assembled prompt.
 */
function buildChunkPrompt(content, context = {}) {
  const { filePath, chunkIndex, totalChunks, analysisType } = context;
  const language = context.language || 'unknown';

  let prompt = `Analyze the following ${language} code`;
  if (filePath) prompt += ` from file "${filePath}"`;
  if (totalChunks > 1) {
    prompt += ` (chunk ${chunkIndex + 1} of ${totalChunks})`;
  }
  prompt += `.\n\nProvide insights on:\n`;
  prompt += `- Code quality and best practices\n`;
  prompt += `- Potential issues or improvements\n`;
  prompt += `- Complexity and maintainability\n`;
  prompt += `- Security considerations\n`;

  if (analysisType === 'security') {
    prompt += `- Vulnerabilities and security risks\n`;
    prompt += `- Input validation and sanitization\n`;
  } else if (analysisType === 'performance') {
    prompt += `- Performance bottlenecks\n`;
    prompt += `- Optimization opportunities\n`;
  } else if (analysisType === 'architecture') {
    prompt += `- Design patterns\n`;
    prompt += `- Architectural concerns\n`;
  }

  prompt += `\n\nCode:\n\`\`\`${language}\n${content}\n\`\`\`\n\n`;
  prompt += `Provide a concise, structured analysis focusing on actionable insights.`;

  return prompt;
}

// ── Sweep execution helper ─────────────────────────────────────────────────

/**
 * Execute a multi-file sweep using a provided analysis function.
 *
 * This is the main entry point for enterprise multi-file code analysis.
 * It:
 *   1. Plans the batches (grouping files into context-window-sized chunks)
 *   2. Calls the analysis function for each batch
 *   3. Aggregates results in a memory-bounded buffer
 *   4. Returns a summary with aggregated findings
 *
 * @param {Array<{path: string, content: string}>} files - Files to analyze.
 * @param {Function} analyzeFn - Async function(chunk) -> result. Called per chunk.
 * @param {object} [opts] - Options (model, contextWindow, maxResults, etc.).
 * @returns {Promise<{summary: object, results: Array}>} Sweep results.
 */
async function executeMultiFileSweep(files, analyzeFn, opts = {}) {
  if (!Array.isArray(files) || typeof analyzeFn !== 'function') {
    return { summary: { totalProcessed: 0, totalChunks: 0, totalErrors: 0 }, results: [] };
  }

  const batches = planMultiFileSweep(files, opts);
  const aggregator = createResultAggregator(opts.maxResults || DEFAULT_MAX_CACHED_RESULTS);

  for (const batch of batches) {
    for (const chunk of batch) {
      try {
        const result = await analyzeFn(chunk);
        aggregator.add({
          path: chunk.path,
          chunkIndex: chunk.chunkIndex,
          chunkCount: chunk.totalChunks,
          estimatedTokens: chunk.estimatedTokens,
          result,
        });
      } catch (error) {
        aggregator.add({
          path: chunk.path,
          chunkIndex: chunk.chunkIndex,
          chunkCount: chunk.totalChunks,
          estimatedTokens: chunk.estimatedTokens,
          error: error.message,
        });
      }
    }
  }

  return {
    summary: aggregator.getSummary(),
    results: aggregator.getAll(),
  };
}

// ── Module exports ─────────────────────────────────────────────────────────

module.exports = {
  // Constants
  DEFAULT_CONTEXT_WINDOWS,
  CHARS_PER_TOKEN,
  DEFAULT_SYSTEM_PROMPT_TOKENS,
  DEFAULT_RESPONSE_TOKENS,
  DEFAULT_MAX_CACHED_RESULTS,
  DEFAULT_MAX_FILE_CHARS,

  // Token estimation
  estimateTokens,
  estimateTotalTokens,

  // Context window resolution
  resolveContextWindow,
  availableContentTokens,
  tokensToChars,

  // Chunking
  chunkContent,

  // Multi-file sweep
  planMultiFileSweep,
  executeMultiFileSweep,
  createResultAggregator,

  // Prompt assembly
  buildChunkPrompt,
};
