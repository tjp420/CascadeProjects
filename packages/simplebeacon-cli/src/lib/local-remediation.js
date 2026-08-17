// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Local-first remediation engine — fixes scan findings via off-network LLM.
 *
 * Defaults to Ollama (localhost:11434). Never sends code to cloud providers
 * unless the user explicitly passes --fix-provider openai|anthropic.
 *
 * Uses bundled inline-fix.js for safe patching (npm-safe; no monorepo ai-tools path).
 */

const path = require('path');
const fs = require('fs');
const { proposeInlineFix } = require('./inline-fix.js');

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_LOCAL_MODEL = process.env.SIMPLEBEACON_FIX_MODEL || 'llama3.2:latest';

// ---------------------------------------------------------------------------
// Build a deterministic, focused prompt for the local model.
// We never send the full file — only the snippet around the finding.
// ---------------------------------------------------------------------------
function buildFixPrompt(issue, snippet, filePath) {
    if (!issue || typeof issue !== 'object') issue = {};
    if (typeof snippet !== 'string') snippet = String(snippet ?? '');
    const type = issue.type || 'issue';
    const severity = issue.severity || 'medium';
    const recommendation = issue.recommendedAction || issue.recommendation || 'Fix the issue';
    const safeFileName = typeof filePath === 'string' ? path.basename(filePath) : 'unknown';

    return `You are a deterministic code-fixing assistant. Your task is to fix ONE specific issue in the provided code snippet.

Issue: ${type} (${severity})
File: ${safeFileName}
Recommendation: ${recommendation}

Rules:
- Return ONLY a JSON object with "search" and "replace" fields.
- "search" must be the exact text from the snippet to replace.
- "replace" must be the corrected text.
- Do not add comments, explanations, or markdown fences.
- If the issue cannot be safely fixed from the snippet alone, return {"search":"","replace":""}.

Snippet:
${snippet}

JSON response:`;
}

// ---------------------------------------------------------------------------
// Extract a small context window around a finding line.
// ---------------------------------------------------------------------------
function extractSnippet(filePath, lineHint, contextLines = 8) {
    if (typeof filePath !== 'string' || !filePath) return null;
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const hint = Number.isFinite(lineHint) ? lineHint : 1;
    const ctx = Number.isFinite(contextLines) && contextLines > 0 ? contextLines : 8;
    const targetLine = Math.max(0, hint - 1);
    const start = Math.max(0, targetLine - ctx);
    const end = Math.min(lines.length, targetLine + ctx + 1);
    return lines.slice(start, end).join('\n');
}

// ---------------------------------------------------------------------------
// Call the local Ollama generate endpoint.
// ---------------------------------------------------------------------------
async function callLocalModel(prompt, model = DEFAULT_LOCAL_MODEL) {
    if (typeof prompt !== 'string') {
        throw new TypeError('callLocalModel requires a string prompt');
    }
    const safeModel = typeof model === 'string' && model ? model : DEFAULT_LOCAL_MODEL;
    const response = await globalThis.fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model: safeModel,
            prompt,
            stream: false,
            options: { temperature: 0.0 }
        })
    });

    if (!response.ok) {
        throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();
    return (data.response || '').trim();
}

// ---------------------------------------------------------------------------
// Parse the model response for search/replace JSON.
// ---------------------------------------------------------------------------
function parseFixResponse(raw) {
    try {
        const cleaned = raw.replace(/```[a-z]*|```/g, '').trim();
        const match = cleaned.match(/\{[\s\S]*?\}/);
        if (!match) return null;
        const parsed = JSON.parse(match[0]);
        if (typeof parsed.search === 'string' && typeof parsed.replace === 'string') {
            return parsed;
        }
        return null;
    } catch {
        return null;
    }
}

// ---------------------------------------------------------------------------
// Generate a unified-diff-style string for terminal display.
// ---------------------------------------------------------------------------
function makeDiff(search, replace, fileName) {
    const s = typeof search === 'string' ? search : String(search ?? '');
    const r = typeof replace === 'string' ? replace : String(replace ?? '');
    const name = typeof fileName === 'string' ? fileName : 'unknown';
    const out = [`--- ${name}`, `+++ ${name}`];
    out.push(`- ${s.split('\n')[0]}${s.includes('\n') ? '...' : ''}`);
    out.push(`+ ${r.split('\n')[0]}${r.includes('\n') ? '...' : ''}`);
    return out.join('\n');
}

// ---------------------------------------------------------------------------
// Main remediation loop for a single finding.
// ---------------------------------------------------------------------------
async function remediateFinding(issue, options = {}) {
    if (!issue || typeof issue !== 'object') {
        return { applied: false, reason: 'Invalid issue object' };
    }
    const _opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
    const filePath = issue.filePath || (issue.affectedFiles && issue.affectedFiles[0]);
    if (!filePath) {
        return { applied: false, reason: 'No filePath in issue' };
    }

    const line = issue.line || issue.metadata?.line || null;
    const snippet = extractSnippet(filePath, line);
    if (!snippet) {
        return { applied: false, reason: 'Could not read source file' };
    }

    const prompt = buildFixPrompt(issue, snippet, filePath);
    let rawResponse;
    try {
        rawResponse = await callLocalModel(prompt, options.model || DEFAULT_LOCAL_MODEL);
    } catch (err) {
        return { applied: false, reason: `Local model error: ${err.message}` };
    }

    const fix = parseFixResponse(rawResponse);
    if (!fix || !fix.search) {
        return { applied: false, reason: 'Model did not return a valid fix', raw: rawResponse.slice(0, 200) };
    }

    const diff = makeDiff(fix.search, fix.replace, path.basename(filePath));

    if (options.dryRun) {
        return { applied: false, diff, reason: 'dry-run' };
    }

    try {
        const result = proposeInlineFix(filePath, fix.search, fix.replace);
        if (!result.ok) {
            return { applied: false, diff, reason: `Patch failed: ${result.error}` };
        }
        return { applied: true, diff, filePath };
    } catch (err) {
        return { applied: false, diff, reason: `Safety block: ${err.message}` };
    }
}

// ---------------------------------------------------------------------------
// Batch remediation across multiple findings.
// ---------------------------------------------------------------------------
async function runLocalRemediation(findings, options = {}) {
    if (!Array.isArray(findings)) {
        return { total: 0, applied: 0, failed: 0, results: [], reason: 'findings must be an array' };
    }
    const opts = (options && typeof options === 'object' && !Array.isArray(options)) ? options : {};
    const results = [];
    const maxFixes = Number.isFinite(opts.maxFixes) && opts.maxFixes > 0 ? opts.maxFixes : 10;

    for (let i = 0; i < Math.min(findings.length, maxFixes); i++) {
        const issue = findings[i];
        const result = await remediateFinding(issue, opts);
        results.push({ issue: (issue && issue.type) || 'unknown', ...result });
    }

    const applied = results.filter((r) => r.applied);
    const failed = results.filter((r) => !r.applied);

    return {
        total: results.length,
        applied: applied.length,
        failed: failed.length,
        results
    };
}

module.exports = {
    runLocalRemediation,
    remediateFinding,
    buildFixPrompt,
    extractSnippet,
    callLocalModel,
    parseFixResponse,
    makeDiff,
    DEFAULT_LOCAL_MODEL,
    OLLAMA_URL
};
