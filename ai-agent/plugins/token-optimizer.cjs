'use strict';
/**
 * SimpleBeacon Token Optimization Module
 *
 * Reduces LLM token usage by providing focused context instead of whole repos.
 * Four components:
 *   1. scan_and_summarize — compact function signatures + snippets for changed files
 *   2. build_embeddings_and_index + top_k_context — RAG-based snippet retrieval
 *   3. preparePromptForEdit — builds a focused prompt with token estimation
 *   4. Token-usage logging — quantifies savings over time
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFile } = require('child_process');
const { promisify } = require('util');
const execFileP = promisify(execFile);

// ─── Token estimation ───────────────────────────────────────────────────────

/**
 * Rough token estimate: ~4 chars per token for English/code text.
 * @param {string} text
 * @returns {number}
 */
function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(String(text).length / 4);
}

// ─── 1. Summarizer ──────────────────────────────────────────────────────────

/**
 * Extract compact summaries from source files.
 * Returns function signatures, docstrings, and import lists without full source.
 *
 * @param {string} projectRoot
 * @param {string[]} changedPaths — files to summarize
 * @returns {Promise<{summaries: object[], totalTokens: number}>}
 */
async function scanAndSummarize(projectRoot, changedPaths) {
    const root = path.resolve(projectRoot);
    const summaries = [];

    for (const relPath of changedPaths) {
        const fullPath = path.resolve(root, relPath);
        if (!fullPath.startsWith(root) || !fs.existsSync(fullPath)) continue;

        const ext = path.extname(fullPath);
        if (!['.js', '.cjs', '.mjs', '.ts', '.tsx', '.py', '.jsx'].includes(ext)) continue;

        const content = fs.readFileSync(fullPath, 'utf8');
        const summary = summarizeFile(relPath, content);
        summaries.push(summary);
    }

    const totalTokens = summaries.reduce((sum, s) => sum + s.estimatedTokens, 0);
    return { summaries, totalTokens };
}

/**
 * Summarize a single file: extract functions, imports, and top-level structure.
 */
function summarizeFile(filePath, content) {
    const lines = content.split('\n');
    const ext = path.extname(filePath);

    const imports = [];
    const functions = [];
    const classes = [];
    const exports = [];

    const fnPatterns = [
        /(?:export\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)/g,
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?\(([^)]*)\)\s*=>/g,
        /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s+)?function\s*\(([^)]*)\)/g,
    ];

    const classPattern = /(?:export\s+)?class\s+(\w+)/g;
    const importPattern = /(?:import|require)\s*\(?\s*['"]([^'"]+)['"]\s*\)?/g;

    lines.forEach((line, i) => {
        const trimmed = line.trim();

        // Imports
        let m;
        importPattern.lastIndex = 0;
        if ((m = importPattern.exec(trimmed))) {
            imports.push({ module: m[1], line: i + 1 });
        }

        // Functions
        for (const pattern of fnPatterns) {
            pattern.lastIndex = 0;
            if ((m = pattern.exec(trimmed))) {
                const name = m[1];
                const params = m[2].trim();
                const docstring = extractDocstring(lines, i);
                const snippet = extractSnippet(lines, i, 5);
                functions.push({
                    name,
                    params,
                    line: i + 1,
                    async: /async/.test(trimmed),
                    exported: /export/.test(trimmed),
                    docstring: docstring,
                    snippet: snippet,
                });
                break;
            }
        }

        // Classes
        classPattern.lastIndex = 0;
        if ((m = classPattern.exec(trimmed))) {
            classes.push({ name: m[1], line: i + 1 });
        }

        // Exports
        if (/^export\s+(?:default|const|function|class)/.test(trimmed)) {
            exports.push({ line: i + 1, text: trimmed.slice(0, 100) });
        }
    });

    const summaryText = buildSummaryText(filePath, imports, functions, classes, exports);
    return {
        filePath,
        totalLines: lines.length,
        imports: imports.slice(0, 20),
        functions: functions.slice(0, 30),
        classes: classes.slice(0, 10),
        exports: exports.slice(0, 15),
        summaryText,
        estimatedTokens: estimateTokens(summaryText),
    };
}

function extractDocstring(lines, fnLine) {
    // Check for JSDoc comment above the function
    if (fnLine > 0) {
        const prevLine = (lines[fnLine - 1] || '').trim();
        if (prevLine.endsWith('*/')) {
            // Walk backwards to find /**
            for (let j = fnLine - 1; j >= Math.max(0, fnLine - 10); j--) {
                if ((lines[j] || '').trim().startsWith('/**')) {
                    return lines.slice(j, fnLine).join('\n').trim();
                }
            }
        }
    }
    // Check for inline comment
    const fnLineText = (lines[fnLine] || '').trim();
    const inlineMatch = fnLineText.match(/\/\/\s*(.+)$/);
    if (inlineMatch) return inlineMatch[1];
    return null;
}

function extractSnippet(lines, startLine, maxLines) {
    const end = Math.min(startLine + maxLines, lines.length);
    return lines.slice(startLine, end).join('\n');
}

function buildSummaryText(filePath, imports, functions, classes, exports) {
    const parts = [`# ${filePath}`];

    if (imports.length > 0) {
        parts.push(`## Imports (${imports.length})`);
        imports.slice(0, 10).forEach(i => parts.push(`- L${i.line}: ${i.module}`));
    }

    if (classes.length > 0) {
        parts.push(`## Classes (${classes.length})`);
        classes.forEach(c => parts.push(`- L${c.line}: class ${c.name}`));
    }

    if (functions.length > 0) {
        parts.push(`## Functions (${functions.length})`);
        functions.slice(0, 15).forEach(f => {
            const asyncTag = f.async ? 'async ' : '';
            const exportTag = f.exported ? 'export ' : '';
            parts.push(`- L${f.line}: ${exportTag}${asyncTag}${f.name}(${f.params})`);
            if (f.docstring) parts.push(`  ${f.docstring.slice(0, 120)}`);
        });
    }

    return parts.join('\n');
}

// ─── 2. Embeddings + Top-K Retrieval ────────────────────────────────────────

/**
 * Build a lightweight embedding index for a project.
 * Uses TF-IDF-style hashing (no external deps) for offline operation.
 *
 * @param {string} projectRoot
 * @param {object} [opts] — { maxFiles, chunkSize }
 * @returns {Promise<{index: object[], fileCount: number, chunkCount: number}>}
 */
async function buildEmbeddingsAndIndex(projectRoot, opts = {}) {
    const root = path.resolve(projectRoot);
    const maxFiles = opts.maxFiles || 500;
    const chunkSize = opts.chunkSize || 40; // lines per chunk

    const sourceFiles = collectSourceFiles(root, maxFiles);
    const index = [];

    for (const relPath of sourceFiles) {
        const fullPath = path.join(root, relPath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const lines = content.split('\n');

        // Chunk the file
        for (let i = 0; i < lines.length; i += chunkSize) {
            const chunk = lines.slice(i, Math.min(i + chunkSize, lines.length)).join('\n');
            const embedding = hashEmbedding(chunk);
            index.push({
                filePath: relPath,
                startLine: i + 1,
                endLine: Math.min(i + chunkSize, lines.length),
                embedding,
                tokenEstimate: estimateTokens(chunk),
                preview: chunk.slice(0, 200),
            });
        }
    }

    return { index, fileCount: sourceFiles.length, chunkCount: index.length };
}

function collectSourceFiles(root, maxFiles) {
    const extensions = ['.js', '.cjs', '.mjs', '.ts', '.tsx', '.jsx', '.py'];
    const skipDirs = new Set(['node_modules', '.git', 'dist', 'build', 'coverage', '.simplebeacon', '__pycache__']);
    const results = [];

    function walk(dir, depth) {
        if (depth > 8 || results.length >= maxFiles) return;
        let entries;
        try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
        for (const entry of entries) {
            if (results.length >= maxFiles) return;
            if (entry.isDirectory()) {
                if (!skipDirs.has(entry.name)) walk(path.join(dir, entry.name), depth + 1);
            } else if (extensions.includes(path.extname(entry.name))) {
                results.push(path.relative(root, path.join(dir, entry.name)).replace(/\\/g, '/'));
            }
        }
    }

    walk(root, 0);
    return results;
}

/**
 * Simple hash-based embedding: creates a 128-dim vector from token frequencies.
 * No external deps — works offline. Good enough for cosine similarity retrieval.
 * Uses SHA-256 (not MD5) for hashing — MD5 is flagged as weak crypto.
 */
function hashEmbedding(text) {
    const dims = 128;
    const vec = new Float32Array(dims);
    const tokens = text.toLowerCase().match(/[a-z_][a-z0-9_]{2,}/g) || [];

    for (const token of tokens) {
        const hash = crypto.createHash('sha256').update(token).digest();
        const idx = hash.readUInt32LE(0) % dims;
        vec[idx] += 1;
    }

    // Normalize
    let norm = 0;
    for (let i = 0; i < dims; i++) norm += vec[i] * vec[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < dims; i++) vec[i] /= norm;

    return Array.from(vec);
}

function cosineSimilarity(a, b) {
    let dot = 0;
    for (let i = 0; i < a.length; i++) dot += a[i] * b[i];
    return dot;
}

/**
 * Retrieve top-k relevant chunks for a query.
 *
 * @param {string} query
 * @param {object[]} index — from buildEmbeddingsAndIndex
 * @param {number} [k] — number of results (default 5)
 * @returns {{filePath: string, startLine: number, endLine: number, score: number, preview: string, tokenEstimate: number}[]}
 */
function topKContext(query, index, k = 5) {
    const queryEmbedding = hashEmbedding(query);
    const scored = index.map(chunk => ({
        filePath: chunk.filePath,
        startLine: chunk.startLine,
        endLine: chunk.endLine,
        score: cosineSimilarity(queryEmbedding, chunk.embedding),
        preview: chunk.preview,
        tokenEstimate: chunk.tokenEstimate,
    }));
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, k);
}

// ─── 3. Prompt Builder + Token Estimation ───────────────────────────────────

/**
 * Build a focused prompt for an edit task.
 * Combines summaries of changed files + top-k retrieval results.
 *
 * @param {string} projectRoot
 * @param {string[]} changedPaths
 * @param {string} intent — what the edit should accomplish
 * @param {object} [opts] — { index, k, includeSnippets, maxTokens }
 * @returns {Promise<{prompt: string, estimatedTokens: number, contextChunks: number, breakdown: object}>}
 */
async function preparePromptForEdit(projectRoot, changedPaths, intent, opts = {}) {
    const k = opts.k || 5;
    const maxTokens = opts.maxTokens || 4000;
    const includeSnippets = opts.includeSnippets !== false;
    const index = opts.index || null;

    // Get summaries of changed files
    const { summaries, totalTokens: summaryTokens } = await scanAndSummarize(projectRoot, changedPaths);

    // Get top-k context from embeddings if index is provided
    let retrievalResults = [];
    let retrievalTokens = 0;
    if (index && index.length > 0) {
        retrievalResults = topKContext(intent, index, k);
        retrievalTokens = retrievalResults.reduce((sum, r) => sum + r.tokenEstimate, 0);
    }

    // Build the prompt
    const parts = [];

    // Header
    parts.push('# Task');
    parts.push(`File(s): ${changedPaths.join(', ')}`);
    parts.push(`Objective: ${intent}`);
    parts.push('');

    // Changed file summaries
    parts.push('# Changed File Summaries');
    for (const s of summaries) {
        parts.push(s.summaryText);
        parts.push('');
    }

    // Retrieval context (if available)
    if (retrievalResults.length > 0) {
        parts.push('# Related Context (top-k retrieval)');
        for (const r of retrievalResults) {
            parts.push(`## ${r.filePath} (L${r.startLine}-${r.endLine}, score: ${r.score.toFixed(3)})`);
            if (includeSnippets) {
                parts.push('```');
                parts.push(r.preview);
                parts.push('```');
            }
            parts.push('');
        }
    }

    // Instructions
    parts.push('# Instructions');
    parts.push('Apply the minimal change needed to accomplish the objective.');
    parts.push('Do not modify unrelated code. Include the file path and line numbers in any patch.');

    const prompt = parts.join('\n');
    const estimatedTokens = estimateTokens(prompt);

    const breakdown = {
        summaryTokens,
        retrievalTokens,
        totalPromptTokens: estimatedTokens,
        contextChunks: retrievalResults.length,
        filesSummarized: summaries.length,
        withinBudget: estimatedTokens <= maxTokens,
    };

    return { prompt, estimatedTokens, contextChunks: retrievalResults.length, breakdown };
}

// ─── 4. Token-Usage Logging ─────────────────────────────────────────────────

const logStore = [];
const MAX_LOG = 10000;

/**
 * Log a token-usage event.
 * @param {object} entry — { event, promptTokens, completionTokens, model, task, savedTokens }
 */
function logTokenUsage(entry) {
    const record = {
        timestamp: new Date().toISOString(),
        event: entry.event || 'unknown',
        promptTokens: entry.promptTokens || 0,
        completionTokens: entry.completionTokens || 0,
        totalTokens: (entry.promptTokens || 0) + (entry.completionTokens || 0),
        model: entry.model || 'unknown',
        task: entry.task || 'unknown',
        savedTokens: entry.savedTokens || 0,
        sessionId: entry.sessionId || null,
    };
    logStore.push(record);
    if (logStore.length > MAX_LOG) logStore.shift();
    return record;
}

/**
 * Get token-usage summary stats.
 */
function getTokenUsageSummary() {
    if (logStore.length === 0) {
        return { totalRequests: 0, totalTokens: 0, totalSaved: 0, avgTokensPerRequest: 0 };
    }
    const totalTokens = logStore.reduce((s, e) => s + e.totalTokens, 0);
    const totalSaved = logStore.reduce((s, e) => s + e.savedTokens, 0);
    return {
        totalRequests: logStore.length,
        totalTokens,
        totalSaved,
        avgTokensPerRequest: Math.round(totalTokens / logStore.length),
        avgSavedPerRequest: Math.round(totalSaved / logStore.length),
        byEvent: groupBy(logStore, 'event'),
        byModel: groupBy(logStore, 'model'),
        recent: logStore.slice(-20),
    };
}

function groupBy(arr, key) {
    const result = {};
    for (const item of arr) {
        const k = item[key] || 'unknown';
        if (!result[k]) result[k] = { count: 0, totalTokens: 0, totalSaved: 0 };
        result[k].count++;
        result[k].totalTokens += item.totalTokens;
        result[k].totalSaved += item.savedTokens;
    }
    return result;
}

// ─── Plugin Registration ────────────────────────────────────────────────────

module.exports = {
    name: 'simplebeacon-token-optimizer',
    version: '1.0.0',
    description: 'Token optimization module — summarizer, embeddings, prompt builder, usage logging',

    // Expose individual functions
    estimateTokens,
    scanAndSummarize,
    buildEmbeddingsAndIndex,
    topKContext,
    preparePromptForEdit,
    logTokenUsage,
    getTokenUsageSummary,

    // Register with an agent context
    register: function register(agent) {
        const registerHandler = (typeof agent.registerHandler === 'function')
            ? agent.registerHandler.bind(agent)
            : null;

        const handlers = {
            scan_and_summarize: scanAndSummarize,
            build_embeddings_and_index: buildEmbeddingsAndIndex,
            top_k_context: topKContext,
            prepare_prompt_for_edit: preparePromptForEdit,
            log_token_usage: logTokenUsage,
            get_token_usage_summary: getTokenUsageSummary,
            estimate_tokens: estimateTokens,
        };

        if (registerHandler) {
            for (const [name, fn] of Object.entries(handlers)) {
                registerHandler(`simplebeacon.${name}`, fn);
            }
        }

        // Attach helpers directly
        agent.simplebeacon = agent.simplebeacon || {};
        Object.assign(agent.simplebeacon, handlers);

        return handlers;
    },
};
