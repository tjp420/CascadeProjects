/**
 * Local-first remediation engine — fixes scan findings via off-network LLM.
 *
 * Defaults to Ollama (localhost:11434). Never sends code to cloud providers
 * unless the user explicitly passes --fix-provider openai|anthropic.
 *
 * Broom Strategy: reuses ai-tools proposeInlineFix for safe patching.
 */

const path = require('path');
const fs = require('fs');
const { proposeInlineFix } = require('../../../../ai-tools/index.js');

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';
const DEFAULT_LOCAL_MODEL = process.env.SIMPLEBEACON_FIX_MODEL || 'llama3.2:latest';

// ---------------------------------------------------------------------------
// Build a deterministic, focused prompt for the local model.
// We never send the full file — only the snippet around the finding.
// ---------------------------------------------------------------------------
function buildFixPrompt(issue, snippet, filePath) {
    const type = issue.type || 'issue';
    const severity = issue.severity || 'medium';
    const recommendation = issue.recommendedAction || issue.recommendation || 'Fix the issue';

    return `You are a deterministic code-fixing assistant. Your task is to fix ONE specific issue in the provided code snippet.

Issue: ${type} (${severity})
File: ${path.basename(filePath)}
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
    const fullPath = path.resolve(filePath);
    if (!fs.existsSync(fullPath)) return null;
    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split('\n');
    const targetLine = Math.max(0, (lineHint || 1) - 1);
    const start = Math.max(0, targetLine - contextLines);
    const end = Math.min(lines.length, targetLine + contextLines + 1);
    return lines.slice(start, end).join('\n');
}

// ---------------------------------------------------------------------------
// Call the local Ollama generate endpoint.
// ---------------------------------------------------------------------------
async function callLocalModel(prompt, model = DEFAULT_LOCAL_MODEL) {
    const response = await fetch(`${OLLAMA_URL}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            model,
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
    const out = [`--- ${fileName}`, `+++ ${fileName}`];
    out.push(`- ${search.split('\n')[0]}${search.includes('\n') ? '...' : ''}`);
    out.push(`+ ${replace.split('\n')[0]}${replace.includes('\n') ? '...' : ''}`);
    return out.join('\n');
}

// ---------------------------------------------------------------------------
// Main remediation loop for a single finding.
// ---------------------------------------------------------------------------
async function remediateFinding(issue, options = {}) {
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
    const results = [];
    const maxFixes = options.maxFixes || 10;

    for (let i = 0; i < Math.min(findings.length, maxFixes); i++) {
        const issue = findings[i];
        const result = await remediateFinding(issue, options);
        results.push({ issue: issue.type || 'unknown', ...result });
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
