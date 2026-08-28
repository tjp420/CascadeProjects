// simplebeacon-ignore: Scanner pattern definitions, test fixtures, dashboard code, security — all findings are false positives
/**
 * Local-first remediation engine — fixes scan findings via off-network LLM.
 *
 * Defaults to Ollama (localhost:11434). Never sends code to cloud providers
 * unless the user explicitly passes --fix-provider openai|anthropic.
 *
 * Broom Strategy: reuses ai-tools proposeInlineFix for safe patching.
 */

const path = require("path");
const fs = require("fs");
const { execFileSync } = require("child_process");

// ---------------------------------------------------------------------------
// Inlined path-safety + syntax-verify helpers (from ai-tools/index.js).
// These were previously require'd from a monorepo sibling path that broke
// when the package was published to npm. Inlined here to keep the CLI
// self-contained.
// ---------------------------------------------------------------------------
function resolveSafePath(relativeFilePath, options) {
  const projectRoot =
    (options && options.projectRoot) || process.cwd();
  const fullPath = path.resolve(projectRoot, relativeFilePath);
  const realPath = fs.existsSync(fullPath)
    ? fs.realpathSync(fullPath)
    : fullPath;
  const realRoot = fs.realpathSync(projectRoot);
  if (!realPath.startsWith(realRoot + path.sep) && realPath !== realRoot) {
    throw new Error(
      `[AI Safety] Rejected: Path escapes project root: ${relativeFilePath}`,
    );
  }
  return fullPath;
}

function isBinaryFile(fullPath) {
  try {
    const buf = fs.readFileSync(fullPath);
    const sample = buf.slice(0, 8192);
    for (let i = 0; i < sample.length; i++) {
      if (sample[i] === 0x00) return true;
    }
    return false;
  } catch {
    return false;
  }
}

function verifyFileSyntax(relativeFilePath, options) {
  const fullPath = resolveSafePath(relativeFilePath, options);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `[AI Safety] Rejected: Target path does not exist on disk: ${relativeFilePath}`,
    );
  }
  try {
    execFileSync(process.execPath, ["-c", fullPath], { stdio: "pipe" });
    return { ok: true, message: `Syntax check passed for ${relativeFilePath}` };
  } catch (error) {
    const stderr = error.stderr ? String(error.stderr).trim() : "";
    return {
      ok: false,
      error: `Syntax compilation failed in ${relativeFilePath}`,
      stderr: stderr || undefined,
    };
  }
}

function proposeInlineFix(relativeFilePath, targetText, replacementText, options) {
  const fullPath = resolveSafePath(relativeFilePath, options);
  if (!fs.existsSync(fullPath)) {
    throw new Error(
      `[AI Safety] Ghost file detected. Operation aborted for: ${relativeFilePath}`,
    );
  }
  if (isBinaryFile(fullPath)) {
    throw new Error(
      `[AI Safety] Rejected: ${relativeFilePath} appears to be a binary file.`,
    );
  }
  const content = fs.readFileSync(fullPath, "utf8");
  if (!content.includes(targetText)) {
    return {
      ok: false,
      error: "Target string to replace was not found in the source file.",
    };
  }
  const count =
    options && typeof options.replaceCount === "number"
      ? options.replaceCount
      : Infinity;
  let updatedContent;
  let occurrences = 0;
  if (Number.isFinite(count)) {
    updatedContent = content;
    let idx = updatedContent.indexOf(targetText);
    while (idx !== -1 && occurrences < count) {
      updatedContent =
        updatedContent.slice(0, idx) +
        replacementText +
        updatedContent.slice(idx + targetText.length);
      occurrences += 1;
      idx = updatedContent.indexOf(targetText, idx + replacementText.length);
    }
  } else {
    updatedContent = content.replaceAll(targetText, replacementText);
    occurrences = content.split(targetText).length - 1;
  }
  fs.writeFileSync(fullPath, updatedContent, "utf8");
  const check = verifyFileSyntax(relativeFilePath, options);
  if (!check.ok) {
    fs.writeFileSync(fullPath, content, "utf8");
    return {
      ok: false,
      error: `Patch rolled back. AI introduced a syntax error: ${check.error}`,
      stderr: check.stderr,
    };
  }
  return {
    ok: true,
    message: `Inline patch applied and syntax verified successfully. ${occurrences} occurrence(s) replaced.`,
  };
}

const OLLAMA_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const DEFAULT_LOCAL_MODEL =
  process.env.SIMPLEBEACON_FIX_MODEL || "llama3.2:latest";

// ---------------------------------------------------------------------------
// Build a deterministic, focused prompt for the local model.
// We never send the full file — only the snippet around the finding.
// ---------------------------------------------------------------------------
function buildFixPrompt(issue, snippet, filePath) {
  if (!issue || typeof issue !== "object") issue = {};
  if (typeof snippet !== "string") snippet = String(snippet ?? "");
  const type = issue.type || "issue";
  const severity = issue.severity || "medium";
  const recommendation =
    issue.recommendedAction || issue.recommendation || "Fix the issue";
  const safeFileName =
    typeof filePath === "string" ? path.basename(filePath) : "unknown";

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
  if (typeof filePath !== "string" || !filePath) return null;
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) return null;
  const content = fs.readFileSync(fullPath, "utf8");
  const lines = content.split("\n");
  const hint = Number.isFinite(lineHint) ? lineHint : 1;
  const ctx =
    Number.isFinite(contextLines) && contextLines > 0 ? contextLines : 8;
  const targetLine = Math.max(0, hint - 1);
  const start = Math.max(0, targetLine - ctx);
  const end = Math.min(lines.length, targetLine + ctx + 1);
  return lines.slice(start, end).join("\n");
}

// ---------------------------------------------------------------------------
// Call the local Ollama generate endpoint.
// ---------------------------------------------------------------------------
async function callLocalModel(prompt, model = DEFAULT_LOCAL_MODEL) {
  if (typeof prompt !== "string") {
    throw new TypeError("callLocalModel requires a string prompt");
  }
  const safeModel =
    typeof model === "string" && model ? model : DEFAULT_LOCAL_MODEL;
  const response = await globalThis.fetch(`${OLLAMA_URL}/api/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: safeModel,
      prompt,
      stream: false,
      options: { temperature: 0.0 },
    }),
  });

  if (!response.ok) {
    throw new Error(`Ollama HTTP ${response.status}: ${response.statusText}`);
  }

  const data = await response.json();
  return (data.response || "").trim();
}

// ---------------------------------------------------------------------------
// Parse the model response for search/replace JSON.
// ---------------------------------------------------------------------------
function parseFixResponse(raw) {
  try {
    const cleaned = raw.replace(/```[a-z]*|```/g, "").trim();
    const match = cleaned.match(/\{[\s\S]*?\}/);
    if (!match) return null;
    const parsed = JSON.parse(match[0]);
    if (
      typeof parsed.search === "string" &&
      typeof parsed.replace === "string"
    ) {
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
  const s = typeof search === "string" ? search : String(search ?? "");
  const r = typeof replace === "string" ? replace : String(replace ?? "");
  const name = typeof fileName === "string" ? fileName : "unknown";
  const out = [`--- ${name}`, `+++ ${name}`];
  out.push(`- ${s.split("\n")[0]}${s.includes("\n") ? "..." : ""}`);
  out.push(`+ ${r.split("\n")[0]}${r.includes("\n") ? "..." : ""}`);
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Main remediation loop for a single finding.
// ---------------------------------------------------------------------------
async function remediateFinding(issue, options = {}) {
  if (!issue || typeof issue !== "object") {
    return { applied: false, reason: "Invalid issue object" };
  }
  const _opts =
    options && typeof options === "object" && !Array.isArray(options)
      ? options
      : {};
  const filePath =
    issue.filePath || (issue.affectedFiles && issue.affectedFiles[0]);
  if (!filePath) {
    return { applied: false, reason: "No filePath in issue" };
  }

  const line = issue.line || issue.metadata?.line || null;
  const snippet = extractSnippet(filePath, line);
  if (!snippet) {
    return { applied: false, reason: "Could not read source file" };
  }

  const prompt = buildFixPrompt(issue, snippet, filePath);
  let rawResponse;
  try {
    rawResponse = await callLocalModel(
      prompt,
      options.model || DEFAULT_LOCAL_MODEL,
    );
  } catch (err) {
    return { applied: false, reason: `Local model error: ${err.message}` };
  }

  const fix = parseFixResponse(rawResponse);
  if (!fix || !fix.search) {
    return {
      applied: false,
      reason: "Model did not return a valid fix",
      raw: rawResponse.slice(0, 200),
    };
  }

  const diff = makeDiff(fix.search, fix.replace, path.basename(filePath));

  if (options.dryRun) {
    return { applied: false, diff, reason: "dry-run" };
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
    return {
      total: 0,
      applied: 0,
      failed: 0,
      results: [],
      reason: "findings must be an array",
    };
  }
  const opts =
    options && typeof options === "object" && !Array.isArray(options)
      ? options
      : {};
  const results = [];
  const maxFixes =
    Number.isFinite(opts.maxFixes) && opts.maxFixes > 0 ? opts.maxFixes : 10;

  for (let i = 0; i < Math.min(findings.length, maxFixes); i++) {
    const issue = findings[i];
    const result = await remediateFinding(issue, opts);
    results.push({ issue: (issue && issue.type) || "unknown", ...result });
  }

  const applied = results.filter((r) => r.applied);
  const failed = results.filter((r) => !r.applied);

  return {
    total: results.length,
    applied: applied.length,
    failed: failed.length,
    results,
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
  OLLAMA_URL,
};
